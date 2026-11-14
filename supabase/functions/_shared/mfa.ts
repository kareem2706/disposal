// Double authentification dans les Edge Functions : un compte qui l'a activée doit avoir validé son code
// (jeton « aal2 ») pour utiliser une fonction. Les comptes sans double authentification ne sont pas concernés.
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const MFA_MSG = "Double authentification requise : reconnectez-vous et entrez le code de votre application d'authentification.";

// Niveau de connexion lu dans le jeton (déjà validé par getUser / auth/v1/user avant l'appel)
export function tokenAal(token: string): string {
  try {
    const p = token.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return String(JSON.parse(atob(p + "===".slice((p.length + 3) % 4))).aal ?? "");
  } catch { return ""; }
}

// true = accès refusé (double authentification activée mais code pas validé pour cette connexion)
export async function mfaBlocked(token: string, userId: string | null | undefined): Promise<boolean> {
  if (!userId || tokenAal(token) === "aal2") return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/mfa_user_enabled`, {
      method: "POST",
      headers: { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
      body: JSON.stringify({ p_uid: userId }),
    });
    if (!r.ok) { console.warn("mfa_user_enabled", r.status); return false; }
    return (await r.json()) === true;
  } catch (e) {
    console.warn("mfa_user_enabled", String(e));
    return false;
  }
}
