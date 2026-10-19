// Supabase Edge Function: verify-checkout
// Appelée par l'app au retour de Stripe. Vérifie AUPRÈS DE STRIPE que la
// session est bien payée, puis confirme la course côté serveur
// (fonction SQL confirm_ride_offer, accessible uniquement avec la clé service_role).
// Peut être appelée plusieurs fois sans effet de bord.

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user) return json({ error: "Session expirée, reconnectez-vous." }, 401);

    const { sessionId } = await req.json();
    if (!sessionId || !/^cs_/.test(sessionId)) return json({ error: "Session de paiement invalide" }, 400);

    // Source de vérité : Stripe
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    const md = s.metadata ?? {};
    if (md.userId !== u.user.id) return json({ error: "Paiement d'un autre utilisateur" }, 403);
    if (s.payment_status !== "paid") return json({ paid: false, status: s.payment_status });

    const amount = Math.round(Number(s.amount_total ?? 0)) / 100;
    const { data: driverId, error } = await admin.rpc("confirm_ride_offer", {
      p_ride: md.rideId, p_offer: md.offerId, p_amount: amount, p_method: "stripe",
    });
    if (error) {
      console.error("confirm_ride_offer", error);
      return json({ paid: true, confirmed: false, error: error.message }, 409);
    }
    return json({ paid: true, confirmed: true, rideId: md.rideId, driverId, amount });
  } catch (e) {
    console.error("verify-checkout", e);
    return json({ error: "Vérification du paiement impossible" }, 400);
  }
});
