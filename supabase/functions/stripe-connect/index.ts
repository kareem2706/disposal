// Supabase Edge Function: stripe-connect
// Compte Stripe Express de la flotte connectée (versements automatiques, stripe_connect.sql).
//   { action: "onboard",   returnUrl } → crée le compte si besoin + lien d'inscription Stripe → { url }
//   { action: "status" }                → relit le compte chez Stripe et met fleet_stripe à jour → { state }
//   { action: "dashboard" }             → lien vers le tableau de bord Stripe Express de la flotte → { url }
// Seule la flotte elle-même peut agir sur son compte (jeton de session vérifié ici).

import { MFA_MSG, mfaBlocked } from "../_shared/mfa.ts";
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { returnBase } from "../_shared/site.ts";
import { syncAccount } from "../_shared/stripe_connect.ts";
import { countryCode } from "../_shared/billing.ts";

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
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const stateOf = (r: { details_submitted?: boolean; payouts_enabled?: boolean; requirements_due?: string[] | null } | null) =>
  !r ? "none" : r.payouts_enabled ? "active" : r.details_submitted ? "pending" : "incomplete";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user) return json({ error: "Session expirée, reconnectez-vous." }, 401);
    const user = u.user;
    if (await mfaBlocked(token, user.id)) return json({ error: MFA_MSG }, 403);

    const { data: prof } = await admin.from("profiles")
      .select("id, role, email, company_name, first_name, last_name, address_country").eq("id", user.id).maybeSingle();
    if (!prof || prof.role !== "driver") return json({ error: "Réservé aux flottes" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const { data: row } = await admin.from("fleet_stripe").select("*").eq("driver_id", user.id).maybeSingle();

    if (action === "status") {
      if (!row) return json({ state: "none" });
      const st = await syncAccount(admin, await stripe.accounts.retrieve(row.account_id));
      return json({ state: stateOf(st), requirements_due: st?.requirements_due ?? [] });
    }

    if (action === "dashboard") {
      if (!row?.details_submitted) return json({ error: "Terminez d'abord l'inscription Stripe" }, 409);
      const link = await stripe.accounts.createLoginLink(row.account_id);
      return json({ url: link.url });
    }

    if (action === "onboard") {
      let accountId = row?.account_id as string | undefined;
      if (!accountId) {
        const acc = await stripe.accounts.create({
          type: "express",
          country: countryCode(prof.address_country),
          email: prof.email || user.email || undefined,
          capabilities: { transfers: { requested: true } },
          business_profile: {
            mcc: "4121",   // limousines et taxis
            name: prof.company_name || [prof.first_name, prof.last_name].filter(Boolean).join(" ") || undefined,
            product_description: "Transport de personnes avec chauffeur (courses réservées via Bleenr)",
          },
          metadata: { driver_id: user.id },
        }, { idempotencyKey: "bleenr_connect_" + user.id });
        accountId = acc.id;
        const { error } = await admin.from("fleet_stripe").insert({ driver_id: user.id, account_id: acc.id });
        if (error && !/duplicate/i.test(error.message)) throw new Error("fleet_stripe: " + error.message);
      }
      const base = returnBase(body.returnUrl);
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        refresh_url: `${base}/?stripe=refresh`,
        return_url: `${base}/?stripe=return`,
      });
      return json({ url: link.url });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("stripe-connect", e);
    const msg = String((e as any)?.message ?? "");
    return json({ error: "Erreur Stripe" + (msg ? " : " + msg.slice(0, 200) : "") }, 400);
  }
});
