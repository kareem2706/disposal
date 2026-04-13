// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout session for the exact TVAC amount provided.
// The frontend sends amount = HTVA * 1.06 (TVA 6% already included).
// No additional tax must be applied here — automatic_tax is explicitly disabled.

import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, rideId, offerId, clientEmail } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error("Montant invalide");
    }

    // amount is TVAC (HTVA + 6% TVA), already computed on the frontend.
    // Convert to cents — this is the exact amount Stripe will charge.
    const unitAmount = Math.round(amount * 100);

    const origin =
      req.headers.get("origin") ||
      "https://kareem2706.github.io/disposal";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: clientEmail || undefined,
      // Disable automatic tax: TVA 6% is already included in unitAmount.
      automatic_tax: { enabled: false },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Course Disposal - ${String(rideId || "").slice(0, 8)}`,
            },
            // Tax is already included in the unit_amount — do not add tax_rates.
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        rideId: rideId || "",
        offerId: offerId || "",
      },
      success_url: `${origin}/?payment=success&rideId=${rideId}`,
      cancel_url: `${origin}/?payment=cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
