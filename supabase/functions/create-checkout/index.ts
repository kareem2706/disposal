// Supabase Edge Function: create-checkout
// Crée une session Stripe Checkout pour l'offre choisie par le client.
// SÉCURITÉ : le montant n'est plus envoyé par le navigateur. Il est
// recalculé ici à partir du prix HTVA de l'offre en base (+ TVA 6 %),
// après avoir vérifié que l'utilisateur connecté est bien le client de la course.

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
const TVA_RATE = 0.06; // identique à TVA_RATE dans index.html

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
    // 1) Utilisateur connecté (jeton de session envoyé par l'app)
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user) return json({ error: "Session expirée, reconnectez-vous." }, 401);
    const user = u.user;

    const { rideId, offerId } = await req.json();
    if (!rideId || !offerId) return json({ error: "Paramètres manquants" }, 400);

    // 2) La course appartient au client et attend encore une offre
    const { data: ride } = await admin.from("rides")
      .select("id, client_id, status, booking_code").eq("id", rideId).maybeSingle();
    if (!ride || ride.client_id !== user.id) return json({ error: "Course introuvable" }, 404);
    if (!["waiting", "offers"].includes(ride.status)) {
      return json({ error: "Cette course n'est plus en attente de paiement" }, 409);
    }

    // 3) L'offre est bien pour cette course et toujours valable
    const { data: offer } = await admin.from("offers")
      .select("id, ride_id, price, status").eq("id", offerId).maybeSingle();
    if (!offer || offer.ride_id !== rideId || offer.status !== "pending") {
      return json({ error: "Cette offre n'est plus disponible" }, 409);
    }

    // 4) Montant calculé côté serveur (HTVA + TVA), en centimes
    const tvac = Math.round(Number(offer.price) * (1 + TVA_RATE) * 100) / 100;
    const unitAmount = Math.round(tvac * 100);
    if (!(unitAmount > 0)) return json({ error: "Montant invalide" }, 400);

    const origin = req.headers.get("origin") || "https://kareem2706.github.io/disposal";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email || undefined,
      automatic_tax: { enabled: false },
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: `Course Bleenr ${ride.booking_code ?? String(rideId).slice(0, 8)}` },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      metadata: { rideId, offerId, userId: user.id },
      success_url:
        `${origin}/?payment=success&ride=${rideId}&offer=${offerId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancel`,
    });

    return json({ url: session.url, amount: tvac });
  } catch (e) {
    console.error("create-checkout", e);
    return json({ error: "Erreur lors de la création de la session de paiement" }, 400);
  }
});
