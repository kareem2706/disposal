// Adresse de retour vers le site : celle demandée si elle fait partie des adresses du site
// (APP_URL, APP_URLS séparées par des virgules, bleenr.com, www, dev, ancienne adresse GitHub), sinon APP_URL.
export function returnBase(asked0: unknown): string {
  const clean = (u: string) => u.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const app = clean(Deno.env.get("APP_URL") || "https://www.bleenr.com");
  const allowed = [app, ...(Deno.env.get("APP_URLS") || "").split(",").map((x) => clean(x.trim())).filter(Boolean),
    "https://bleenr.com", "https://www.bleenr.com", "https://dev.bleenr.com", "https://kareem2706.github.io/disposal"];
  const asked = clean(String(asked0 || ""));
  // Correspondance exacte ou sous-chemin (« https://bleenr.com/… ») : jamais « https://bleenr.com.evil.com »
  return asked && allowed.some((a) => asked === a || asked.startsWith(a + "/")) ? asked : app;
}
