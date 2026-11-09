// Supabase Edge Function: stripe-payouts
// Vire aux flottes (comptes Stripe Express) la part des courses terminées : prestation TVAC − commission
// Bleenr TVAC (core/billing.ts › ridePayout, mêmes règles que la facture de commission).
// Appelée toutes les heures par la base (pg_cron → run_stripe_payouts, stripe_connect.sql) avec le secret
// x-hook-secret (NOTIFY_HOOK_SECRET), ou à la main par l'admin connecté.
// Jamais deux virements pour une course : un seul par « transfer_group » ride_<id>, vérifié chez Stripe.
// Solde Stripe insuffisant ou autre erreur : la course reste « failed » et sera retentée à l'heure suivante.
//
// Secret optionnel : PAYOUT_DELAY_HOURS (délai après la fin de la course, 24 h par défaut).

import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { billingConfig, ridePayout } from "../_shared/billing.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);
const HOOK_SECRET = Deno.env.get("NOTIFY_HOOK_SECRET") ?? "";
const ADMIN_EMAIL = "kb@bleenr.com";
const DELAY = Math.max(0, parseInt(Deno.env.get("PAYOUT_DELAY_HOURS") ?? "24", 10) || 0);

function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function allowed(req: Request) {
  if (sameSecret(req.headers.get("x-hook-secret") ?? "", HOOK_SECRET)) return true;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data } = await admin.auth.getUser(token);
  return data?.user?.email === ADMIN_EMAIL;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await allowed(req))) return json({ error: "forbidden" }, 403);

  const { data: settings } = await admin.from("billing_settings").select("*").eq("id", 1).maybeSingle();
  const cfg = billingConfig(settings ?? {});
  const { data: list, error } = await admin.rpc("payout_candidates", { p_delay_hours: DELAY });
  if (error) return json({ error: "payout_candidates: " + error.message }, 500);

  const done: unknown[] = [];
  for (const r of list ?? []) {
    const amount = ridePayout(r, cfg, r.address_country).net;
    const cents = Math.round(amount * 100);
    const group = "ride_" + r.ride_id;
    const { data: prev } = await admin.from("ride_payouts").select("attempts").eq("ride_id", r.ride_id).maybeSingle();
    const attempts = (prev?.attempts ?? 0) + 1;
    const save = (o: Record<string, unknown>) => admin.from("ride_payouts").upsert({
      ride_id: r.ride_id, driver_id: r.driver_id, account_id: r.account_id, amount, attempts,
      updated_at: new Date().toISOString(), ...o,
    }, { onConflict: "ride_id" });
    try {
      if (cents <= 0) { await save({ status: "paid", transfer_id: null, error: "montant nul" }); continue; }
      // Déjà viré (base pas mise à jour après un virement réussi) : on reprend ce virement
      const existing = (await stripe.transfers.list({ transfer_group: group, limit: 10 })).data
        .find((t) => !t.reversed && t.destination === r.account_id);
      const tr = existing ?? await stripe.transfers.create({
        amount: cents,
        currency: "eur",
        destination: r.account_id,
        transfer_group: group,
        description: `Course Bleenr ${r.booking_code ?? String(r.ride_id).slice(0, 8)}`,
        metadata: { rideId: r.ride_id, driverId: r.driver_id },
      }, { idempotencyKey: `bleenr_payout_${r.ride_id}_${attempts}` });
      await save({ status: "paid", transfer_id: tr.id, error: null, amount: tr.amount / 100 });
      done.push({ ride: r.ride_id, amount: tr.amount / 100, transfer: tr.id });
    } catch (e) {
      const msg = String((e as any)?.code ?? "") + " " + String((e as any)?.message ?? e);
      console.warn("payout", r.ride_id, msg);
      await save({ status: "failed", error: msg.trim().slice(0, 300) });
      // Solde insuffisant : inutile d'essayer les suivantes maintenant
      if (/balance_insufficient|insufficient/i.test(msg)) break;
    }
  }
  console.log("stripe-payouts", JSON.stringify({ candidates: (list ?? []).length, paid: done.length }));
  return json({ candidates: (list ?? []).length, paid: done });
});
