// Supabase Edge Function: verify-checkout
// Appelée par l'app au retour de Stripe. Vérifie AUPRÈS DE STRIPE que la
// session est payée, puis confirme la course côté serveur.
// Si la course ne peut plus être confirmée (déjà payée par une autre session,
// annulée entre-temps…), le paiement est remboursé automatiquement.
// Le webhook stripe-webhook fait la même chose si le client ferme l'onglet.
// Peut être appelée plusieurs fois sans effet de bord.

import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Logique commune avec stripe-webhook (garder les deux copies identiques) ──
async function refundSession(s: Stripe.Checkout.Session) {
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
  if (pi) {
    try {
      await stripe.refunds.create({ payment_intent: pi }, { idempotencyKey: "bleenr_refund_" + s.id });
    } catch (e) {
      const msg = String((e as any)?.code ?? "") + " " + String((e as any)?.message ?? "");
      if (!/already.*refunded|charge_already_refunded/i.test(msg)) throw e;
    }
  }
  const md = s.metadata ?? {};
  await admin.from("ride_checkouts").upsert({
    session_id: s.id, ride_id: md.rideId, offer_id: md.offerId || null, user_id: md.userId || null,
    amount: Number(s.amount_total ?? 0) / 100, status: "refunded", updated_at: new Date().toISOString(),
  });
}
async function settleSession(s: Stripe.Checkout.Session) {
  if (s.payment_status !== "paid") return { paid: false, status: s.payment_status };
  const md = s.metadata ?? {};
  if (!md.rideId || !md.offerId) return { paid: true, confirmed: false, error: "Métadonnées manquantes" };
  const amount = Math.round(Number(s.amount_total ?? 0)) / 100;
  const { data, error } = await admin.rpc("confirm_ride_payment", {
    p_session: s.id, p_ride: md.rideId, p_offer: md.offerId, p_amount: amount,
  });
  if (error) throw new Error("confirm_ride_payment: " + error.message);   // erreur technique : pas de remboursement
  const row = Array.isArray(data) ? data[0] : data;
  const result = row?.result as string;
  if (result === "confirmed" || result === "already") {
    return { paid: true, confirmed: true, rideId: md.rideId, driverId: row?.driver ?? null, amount };
  }
  // duplicate | not_confirmable | refunded → l'argent est rendu au client
  if (result !== "refunded") await refundSession(s);
  return { paid: true, confirmed: false, refunded: true, reason: result, amount };
}
// ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user) return json({ error: "Session expirée, reconnectez-vous." }, 401);

    const { sessionId } = await req.json();
    if (!sessionId || !/^cs_/.test(sessionId)) return json({ error: "Session de paiement invalide" }, 400);

    const s = await stripe.checkout.sessions.retrieve(sessionId);   // source de vérité : Stripe
    if ((s.metadata ?? {}).userId !== u.user.id) return json({ error: "Paiement d'un autre utilisateur" }, 403);

    return json(await settleSession(s));
  } catch (e) {
    console.error("verify-checkout", e);
    return json({ error: "Vérification du paiement impossible" }, 500);
  }
});
