// Supabase Edge Function: campaign
// Campagnes e-mail (publicité / nouveautés) envoyées par l'admin depuis l'écran « Campagnes ».
//
//  POST (admin uniquement, jeton de session kb@bleenr.com)
//    { action: "preview" | "test" | "send", audience: "fleets" | "clients", user_ids: string[] | null (= tous),
//      subject, title, body, cta_label?, cta_url? }
//    • preview : renvoie le HTML exact qui sera envoyé
//    • test    : envoie la campagne à l'admin seulement
//    • send    : envoie aux destinataires choisis (désinscrits exclus), historique dans email_campaigns
//  GET / POST ?unsub=<id>&t=<signature>  (lien « Se désinscrire » de chaque e-mail, sans connexion)
//    → préférence marketing coupée, puis retour sur le site.
//
// ⚠ À déployer avec la vérification JWT DÉSACTIVÉE (le lien de désinscription est ouvert sans
//   connexion). L'envoi vérifie lui-même que l'appelant est l'admin.
// Le texte est écrit par l'admin en texte simple : tout est échappé, seuls **gras**, les
// paragraphes, les liens https et {prenom} sont mis en forme (aucun HTML injecté).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "Bleenr <noreply@bleenr.com>";
const APP_URL = (Deno.env.get("APP_URL") ?? "https://kareem2706.github.io/disposal").replace(/\/+$/, "");
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_EMAIL = "kb@bleenr.com";
const MAX_RECIPIENTS = 2000;
const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ── Signature du lien de désinscription (HMAC-SHA256, clé serveur) ──
async function sign(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("unsub:" + id)));
  return Array.from(sig.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const unsubUrl = async (id: string) => `${SB_URL}/functions/v1/campaign?unsub=${encodeURIComponent(id)}&t=${await sign(id)}`;

// ── Mise en forme (identique à _cmpRender dans index.html) ──
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
function inline(s: string, prenom: string) {
  return esc(s)
    .replace(/\{prenom\}/g, esc(prenom))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(https:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#1B5E3B;font-weight:600;">$1</a>');
}
type Content = { subject: string; title?: string; body: string; cta_label?: string; cta_url?: string };
function render(c: Content, prenom: string, unsub: string) {
  const paras = String(c.body ?? "").replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;">${inline(p, prenom).replace(/\n/g, "<br>")}</p>`).join("");
  const cta = c.cta_label && /^https:\/\//.test(c.cta_url ?? "")
    ? `<tr><td style="padding:8px 28px 0;"><a href="${esc(c.cta_url)}" style="display:inline-block;background:#1B5E3B;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">${esc(c.cta_label)}</a></td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <tr><td style="padding:26px 28px 0;"><div style="font-size:22px;font-weight:700;color:#1B5E3B;letter-spacing:-.02em;">Bleenr</div></td></tr>
        <tr><td style="padding:20px 28px 0;">
          ${c.title ? `<h1 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#1A1A18;">${inline(c.title, prenom)}</h1>` : ""}
          <div style="font-size:14.5px;line-height:1.65;color:#4A4A46;">${paras}</div>
        </td></tr>
        ${cta}
        <tr><td style="padding:26px 28px 28px;">
          <div style="border-top:1px solid #EDEBE6;padding-top:16px;font-size:12px;color:#8A8A84;line-height:1.5;">
            Vous recevez cet e-mail car vous avez un compte Bleenr.<br>
            <a href="${esc(unsub)}" style="color:#8A8A84;">Se désinscrire des offres et nouveautés Bleenr</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Désinscription ──
async function unsubscribe(url: URL) {
  const id = url.searchParams.get("unsub") ?? "";
  const ok = /^[0-9a-f-]{36}$/i.test(id) && url.searchParams.get("t") === (await sign(id));
  if (ok) {
    const { data: p } = await admin.from("profiles").select("notif_prefs").eq("id", id).maybeSingle();
    const prefs = (p?.notif_prefs as any) || {};
    prefs.email = { ...(prefs.email || {}), marketing: false };
    await admin.from("profiles").update({ notif_prefs: prefs }).eq("id", id);
  }
  // Supabase n'affiche pas de page HTML depuis une fonction : retour sur le site avec un message
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}/?unsubscribed=${ok ? "1" : "0"}` } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  if (url.searchParams.has("unsub")) return unsubscribe(url);
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    // Admin uniquement
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (u?.user?.email?.toLowerCase() !== ADMIN_EMAIL) return json({ error: "Réservé à l'administrateur" }, 403);
    if (!RESEND_KEY) return json({ error: "RESEND_API_KEY non configurée" }, 500);

    const p = await req.json();
    const action = String(p?.action ?? "preview");
    const audience = p?.audience === "fleets" ? "fleets" : "clients";
    const c: Content = {
      subject: String(p?.subject ?? "").trim().slice(0, 200),
      title: String(p?.title ?? "").trim().slice(0, 200),
      body: String(p?.body ?? "").slice(0, 20000),
      cta_label: String(p?.cta_label ?? "").trim().slice(0, 60),
      cta_url: String(p?.cta_url ?? "").trim().slice(0, 500),
    };
    if (action === "preview") return json({ html: render(c, "Karim", "#") });
    if (!c.subject || !c.body.trim()) return json({ error: "Objet et texte requis" }, 400);
    if (c.cta_label && !/^https:\/\//.test(c.cta_url ?? "")) return json({ error: "Le lien du bouton doit commencer par https://" }, 400);

    // Destinataires
    type Rcpt = { id: string; email: string; first_name: string };
    let list: Rcpt[] = [];
    let skipped = 0;
    if (action === "test") {
      list = [{ id: u.user.id, email: ADMIN_EMAIL, first_name: "Karim" }];
    } else {
      const ids: string[] | null = Array.isArray(p?.user_ids) ? p.user_ids.map(String) : null;
      if (ids && !ids.length) return json({ error: "Aucun destinataire sélectionné" }, 400);
      let q = admin.from("profiles").select("id,email,first_name,company_name,notif_prefs")
        .eq("role", audience === "fleets" ? "driver" : "client").limit(MAX_RECIPIENTS + 1);
      if (ids) q = q.in("id", ids.slice(0, MAX_RECIPIENTS));
      const { data, error } = await q;
      if (error) throw error;
      if ((data ?? []).length > MAX_RECIPIENTS) return json({ error: `Maximum ${MAX_RECIPIENTS} destinataires par envoi` }, 400);
      for (const r of data ?? []) {
        const email = String(r.email ?? "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || (r.notif_prefs as any)?.email?.marketing === false || email === ADMIN_EMAIL) { skipped++; continue; }
        list.push({ id: r.id, email, first_name: String(r.first_name ?? "").trim() });
      }
    }

    // Envoi par lots de 100 (API batch de Resend)
    let sent = 0;
    const errors: string[] = [];
    for (let i = 0; i < list.length; i += 100) {
      const batch = await Promise.all(list.slice(i, i + 100).map(async (r) => {
        const unsub = await unsubUrl(r.id);
        return {
          from: FROM, to: [r.email],
          subject: (action === "test" ? "[TEST] " : "") + c.subject.replace(/\{prenom\}/g, r.first_name || ""),
          html: render(c, r.first_name || "", unsub),
          headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        };
      }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok) sent += Array.isArray(out?.data) ? out.data.length : batch.length;
      else errors.push(out?.message ?? "Resend " + res.status);
    }

    if (action === "send") {
      await admin.from("email_campaigns").insert({
        audience, subject: c.subject, title: c.title, body: c.body, cta_label: c.cta_label || null, cta_url: c.cta_url || null,
        recipients: list.length + skipped, sent, skipped,
      });
    }
    console.log("campaign", action, audience, "sent", sent, "skipped", skipped, errors.join(" | "));
    return json({ ok: errors.length === 0, sent, skipped, errors });
  } catch (e) {
    console.error("campaign", e);
    return json({ error: (e as Error).message ?? "Erreur" }, 500);
  }
});
