// Stripe Connect : copie de l'état du compte Stripe d'une flotte dans fleet_stripe (stripe_connect.sql)
import type Stripe from "npm:stripe@14.25.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export async function syncAccount(admin: SupabaseClient, acc: Stripe.Account) {
  const { data: row } = await admin.from("fleet_stripe").select("driver_id, payouts_since").eq("account_id", acc.id).maybeSingle();
  const driverId = row?.driver_id ?? acc.metadata?.driver_id;
  if (!driverId) return null;
  const payouts = !!acc.payouts_enabled && !!(acc.capabilities?.transfers === "active");
  const upd = {
    driver_id: driverId,
    account_id: acc.id,
    details_submitted: !!acc.details_submitted,
    payouts_enabled: payouts,
    // 1re activation : les courses commençant à partir de maintenant seront versées par Stripe
    payouts_since: row?.payouts_since ?? (payouts ? new Date().toISOString() : null),
    requirements_due: acc.requirements?.currently_due ?? [],
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("fleet_stripe").upsert(upd, { onConflict: "driver_id" });
  if (error) throw new Error("fleet_stripe: " + error.message);
  return upd;
}
