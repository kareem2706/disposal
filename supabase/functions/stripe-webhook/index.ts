// Supabase Edge Function: stripe-webhook
// Appelée directement par Stripe (pas par l'app). Confirme la course dès que
// le paiement est encaissé, même si le client a fermé son navigateur.
// Chaque appel est authentifié par la signature Stripe (STRIPE_WEBHOOK_SECRET).
//
// ⚠ À déployer avec la vérification JWT DÉSACTIVÉE
//   (Supabase → Edge Functions → stripe-webhook → « Enforce JWT verification » : off)
//   car Stripe n'envoie pas de jeton Supabase. La signature Stripe la remplace.
//
// Événements à cocher dans Stripe : checkout.session.completed,
// checkout.session.async_payment_succeeded, checkout.session.expired

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
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const crypto = Stripe.createSubtleCryptoProvider();

// ── Logique commune avec verify-checkout (garder les deux copies identiques) ──
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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!WEBHOOK_SECRET) return new Response("STRIPE_WEBHOOK_SECRET manquant", { status: 500 });

  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET, undefined, crypto);
  } catch (e) {
    console.warn("signature invalide", e);
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    const s = event.data.object as Stripe.Checkout.Session;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const r = await settleSession(s);
        console.log(event.type, s.id, JSON.stringify(r));
        break;
      }
      case "checkout.session.expired":
        await admin.from("ride_checkouts").update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("session_id", s.id).eq("status", "open");
        break;
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    // Erreur technique : Stripe renverra l'événement plus tard (réessais automatiques)
    console.error("stripe-webhook", e);
    return new Response("Erreur temporaire", { status: 500 });
  }
});
