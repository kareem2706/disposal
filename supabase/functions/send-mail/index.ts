// Supabase Edge Function: send-mail
// Emails transactionnels Bleenr via Resend. Modèles rendus côté serveur.
//
// SÉCURITÉ (19/10/2026) :
//  • l'appelant doit être connecté (jeton de session), sauf l'email de bienvenue
//    juste après l'inscription ;
//  • « to » direct : uniquement sa propre adresse (ou l'admin pour « ride_problem ») ;
//  • « to_user_ids » : uniquement des utilisateurs liés à l'appelant par une course ;
//  • envoi groupé aux fleets : uniquement « new_marketplace_ride », juste après
//    avoir publié une demande, avec une limite par heure ;
//  • toutes les données sont échappées (aucun HTML ou lien injecté) ;
//  • le destinataire est lu dans auth.users, pas dans profiles (modifiable).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "Bleenr <noreply@bleenr.com>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://kareem2706.github.io/disposal";
const ADMIN_EMAIL = "kb@bleenr.com";
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Limites en mémoire (par instance) : destinataire, expéditeur, envois groupés
const logs = new Map<string, number[]>();
function limited(key: string, max: number, windowMs = 3600_000) {
  const now = Date.now();
  const hits = (logs.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= max) return true;
  hits.push(now);
  logs.set(key, hits);
  return false;
}

// Échappe toutes les valeurs reçues du navigateur
const escHtml = (v: unknown) =>
  String(v ?? "").slice(0, 2000)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
function sanitize(data: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (/^[a-zA-Z_]{1,40}$/.test(k) && v != null && typeof v !== "object") out[k] = escHtml(v);
    }
  }
  return out;
}

async function emailOfUser(id: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(id);
  return data?.user?.email?.toLowerCase() ?? null;
}
async function sendOne(to: string, type: string, data: Record<string, string>) {
  if (limited("to:" + to, 30)) throw new Error("Trop d'envois pour ce destinataire, réessayez plus tard");
  const { subject, html } = build({ type, data });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: subject.replace(/&[a-z#0-9]+;/gi, " "), html }),
  });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(res?.message ?? "Échec de l'envoi");
  return res.id;
}

// ── Shared layout ────────────────────────────────────────────────
function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <tr><td style="padding:26px 28px 0;">
          <div style="font-size:22px;font-weight:700;color:#1B5E3B;letter-spacing:-.02em;">Bleenr</div>
        </td></tr>
        <tr><td style="padding:20px 28px 0;">
          <h1 style="margin:0 0 14px;font-size:18px;font-weight:700;color:#1A1A18;">${title}</h1>
          <div style="font-size:14px;line-height:1.6;color:#4A4A46;">${body}</div>
        </td></tr>
        ${cta ? `<tr><td style="padding:22px 28px 0;">
          <a href="${cta.url}" style="display:inline-block;background:#1B5E3B;color:#FFFFFF;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">${cta.label}</a>
        </td></tr>` : ""}
        <tr><td style="padding:26px 28px 28px;">
          <div style="border-top:1px solid #EDEBE6;padding-top:16px;font-size:12px;color:#8A8A84;line-height:1.5;">
            Cet email vous est envoyé automatiquement par Bleenr.<br>
            Merci de ne pas y répondre directement.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;font-size:13px;color:#8A8A84;width:130px;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:#1A1A18;font-weight:600;">${value}</td>
  </tr>`;
}

function rideTable(d: Record<string, string>) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background:#F6F5F2;border-radius:10px;padding:14px 16px;">
    ${d.code ? row("Référence", d.code) : ""}
    ${d.date ? row("Date", d.date + (d.time ? " · " + d.time : "")) : ""}
    ${d.from ? row("Départ", d.from) : ""}
    ${d.to ? row("Arrivée", d.to) : ""}
    ${d.vehicle ? row("Véhicule", d.vehicle) : ""}
    ${d.driver ? row("Chauffeur", d.driver) : ""}
    ${d.passenger ? row("Passager", d.passenger) : ""}
    ${d.price ? row("Montant TVAC", d.price) : ""}
  </table>`;
}

// ── Templates ────────────────────────────────────────────────────
type Payload = { type: string; data?: Record<string, string> };

function build({ type, data = {} }: Payload) {
  const url = `${APP_URL}/`;

  switch (type) {
    case "ride_problem": {
      const esc = (v?: string) => v ?? "";   // données déjà échappées par sanitize()
      return {
        subject: `⚠️ Problème signalé — ${data.code ?? ""}`,
        html: layout(
          "Un client signale un problème",
          `Client : <strong>${esc(data.clientName)}</strong>${data.clientEmail ? ` · ${esc(data.clientEmail)}` : ""}${data.clientPhone ? ` · ${esc(data.clientPhone)}` : ""}${rideTable(data)}<div style="padding:12px 14px;background:#FDECEA;border-radius:10px;color:#8A1F17;white-space:pre-wrap;">${esc(data.message)}</div>`,
          { label: "Ouvrir Bleenr", url },
        ),
      };
    }

    case "ride_created":
      return {
        subject: `Demande publiée — ${data.code ?? ""}`,
        html: layout(
          "Votre demande est publiée",
          `Bonjour ${data.clientName ?? ""},<br><br>Votre demande de course a bien été publiée. Les chauffeurs partenaires peuvent désormais vous envoyer leurs offres.${rideTable(data)}Vous recevrez un email dès qu'une offre sera disponible.`,
          { label: "Voir ma demande", url },
        ),
      };

    case "offer_received":
      return {
        subject: `Nouvelle offre reçue — ${data.code ?? ""}`,
        html: layout(
          "Vous avez reçu une offre",
          `Bonjour ${data.clientName ?? ""},<br><br>Un chauffeur vous a envoyé une offre pour votre course.${rideTable(data)}Connectez-vous pour la consulter et la confirmer.`,
          { label: "Consulter l'offre", url },
        ),
      };

    case "ride_confirmed_client":
      return {
        subject: `Course confirmée — ${data.code ?? ""}`,
        html: layout(
          "Votre course est confirmée",
          `Bonjour ${data.clientName ?? ""},<br><br>Votre paiement a bien été reçu et votre course est confirmée.${rideTable(data)}${data.driverPhone ? `Vous pouvez joindre votre chauffeur au <strong>${data.driverPhone}</strong>.` : ""}`,
          { label: "Voir les détails", url },
        ),
      };

    case "ride_confirmed_driver":
      return {
        subject: `Mission confirmée — ${data.code ?? ""}`,
        html: layout(
          "Votre mission est confirmée",
          `Bonjour ${data.driverName ?? ""},<br><br>Votre offre a été acceptée. La mission suivante vous est attribuée.${rideTable(data)}Pensez à télécharger votre ordre de mission depuis l'application.`,
          { label: "Voir ma mission", url },
        ),
      };

    case "ride_cancelled":
      return {
        subject: `Course annulée — ${data.code ?? ""}`,
        html: layout(
          "Course annulée",
          `Bonjour ${data.name ?? ""},<br><br>La course suivante a été annulée.${rideTable(data)}${data.refund === "yes"
            ? "Un remboursement intégral sera effectué sous 5 à 10 jours ouvrables."
            : "Conformément aux conditions générales, cette annulation intervenue à moins de 48 h du départ ne donne pas lieu à remboursement."}`,
        ),
      };

    case "ride_reminder":
      return {
        subject: `Rappel — votre course demain (${data.code ?? ""})`,
        html: layout(
          "Votre course a lieu demain",
          `Bonjour ${data.name ?? ""},<br><br>Petit rappel concernant votre course prévue demain.${rideTable(data)}`,
          { label: "Voir les détails", url },
        ),
      };

    case "welcome_client":
      return {
        subject: "Bienvenue sur Bleenr",
        html: layout(
          `Bienvenue${data.name ? ", " + data.name : ""}`,
          `Votre compte Bleenr est créé. Vous pouvez dès maintenant réserver un chauffeur privé en quelques clics.
          <div style="background:#F6F5F2;border-radius:10px;padding:16px 18px;margin:18px 0;">
            <div style="font-size:13px;font-weight:700;color:#1A1A18;margin-bottom:10px;">Comment ça marche</div>
            <div style="font-size:13px;color:#4A4A46;line-height:1.9;">
              <strong>1.</strong> Publiez votre demande de course<br>
              <strong>2.</strong> Recevez les offres des chauffeurs partenaires<br>
              <strong>3.</strong> Choisissez la vôtre et confirmez le paiement<br>
              <strong>4.</strong> Votre chauffeur vous attend au point de départ
            </div>
          </div>
          ${data.isPro === "yes"
            ? `Votre compte professionnel vous donne accès au carnet de passagers et à la facturation mensuelle centralisée.`
            : `Vous recevrez un email à chaque étape : offre reçue, course confirmée, rappel la veille du départ.`}`,
          { label: "Réserver ma première course", url },
        ),
      };

    case "welcome_driver":
      return {
        subject: "Bienvenue sur Bleenr — activation de votre compte",
        html: layout(
          `Bienvenue${data.name ? ", " + data.name : ""}`,
          `Votre compte chauffeur Bleenr est créé. Avant d'accéder à la marketplace, votre flotte doit être validée par nos équipes.
          <div style="background:#F6F5F2;border-radius:10px;padding:16px 18px;margin:18px 0;">
            <div style="font-size:13px;font-weight:700;color:#1A1A18;margin-bottom:10px;">Prochaines étapes</div>
            <div style="font-size:13px;color:#4A4A46;line-height:1.9;">
              <strong>1.</strong> Complétez votre profil et vos coordonnées<br>
              <strong>2.</strong> Ajoutez vos véhicules et vos chauffeurs<br>
              <strong>3.</strong> Téléversez vos documents (licence, assurance, contrôle technique)<br>
              <strong>4.</strong> Notre équipe valide votre dossier sous 48 h ouvrées
            </div>
          </div>
          Une fois votre flotte validée, vous recevrez une alerte à chaque nouvelle course disponible et pourrez soumettre vos offres.`,
          { label: "Compléter mon profil", url },
        ),
      };

    case "new_marketplace_ride":
      return {
        subject: `Nouvelle course disponible — ${data.code ?? ""}`,
        html: layout(
          "Nouvelle course sur la marketplace",
          `Bonjour ${data.driverName ?? ""},<br><br>Une nouvelle course correspondant à votre profil vient d'être publiée.${rideTable(data)}Soyez réactif : les offres sont traitées par ordre d'arrivée.`,
          { label: "Faire une offre", url },
        ),
      };

    case "ride_completed":
      return {
        subject: `Merci d'avoir voyagé avec Bleenr — ${data.code ?? ""}`,
        html: layout(
          `Merci${data.clientName ? ", " + data.clientName : ""} !`,
          `Votre course est terminée. Merci d'avoir fait confiance à Bleenr.${rideTable(data)}
          <div style="background:#F6F5F2;border-radius:10px;padding:16px 18px;margin:18px 0;">
            <div style="font-size:13px;font-weight:700;color:#1A1A18;margin-bottom:8px;">⭐ Votre avis compte</div>
            <div style="font-size:13px;color:#4A4A46;line-height:1.6;">Prenez quelques secondes pour noter votre chauffeur : cela nous aide à garantir un service de qualité.</div>
          </div>
          <div style="font-size:13px;color:#4A4A46;line-height:1.6;margin-bottom:6px;">
            Quelque chose ne s'est pas passé comme prévu ? Vous pouvez <strong>signaler un incident</strong>
            directement depuis la fiche de votre demande (menu <strong>⋮</strong> → <em>Signaler un problème</em>).
            Notre équipe vous répondra rapidement.
          </div>
          Nous espérons vous revoir très bientôt parmi nous.<br><br>L'équipe Bleenr`,
          { label: "Noter mon chauffeur", url },
        ),
      };

    case "offer_accepted_driver":
      return {
        subject: `Offre acceptée — ${data.code ?? ""}`,
        html: layout(
          "Votre offre a été acceptée",
          `Bonjour,<br><br>Le client a retenu votre offre. La course vous sera attribuée dès réception du paiement.${rideTable(data)}`,
          { label: "Voir la mission", url },
        ),
      };

    case "ride_updated":
      return {
        subject: `Course modifiée — ${data.code ?? ""}`,
        html: layout(
          "Le client a modifié sa course",
          `Bonjour,<br><br>Le client a modifié ${data.changes ? "<strong>" + data.changes + "</strong>" : "sa course"}.${rideTable(data)}${data.note ? `<div style="padding:12px 14px;background:#F6F5F2;border-radius:10px;font-style:italic;">${data.note}</div>` : ""}`,
          { label: "Voir la course", url },
        ),
      };

    case "driver_on_way":
      return {
        subject: `Votre chauffeur est en route — ${data.code ?? ""}`,
        html: layout(
          "Votre chauffeur est en route",
          `Bonjour,<br><br>Votre chauffeur vient de partir vers le point de prise en charge.${rideTable(data)}${data.driverPhone ? `Vous pouvez le joindre au <strong>${data.driverPhone}</strong>.` : ""}`,
          { label: "Suivre en direct", url },
        ),
      };

    case "driver_note":
      return {
        subject: `Message de votre chauffeur — ${data.code ?? ""}`,
        html: layout(
          data.noteAction === "updated" ? "Votre chauffeur a mis à jour son message" : "Votre chauffeur vous a laissé un message",
          `Bonjour,${rideTable(data)}<div style="padding:12px 14px;background:#EEF4FB;border-radius:10px;white-space:pre-wrap;">${data.note ?? ""}</div>`,
          { label: "Voir la course", url },
        ),
      };

    case "assignment_changed":
      return {
        subject: `Mise à jour de votre course — ${data.code ?? ""}`,
        html: layout(
          "Votre course a été mise à jour",
          `Bonjour,<br><br>Le transporteur a modifié ${data.changes ? "<strong>" + data.changes + "</strong>" : "l'attribution"} de votre course.${rideTable(data)}${data.driverPhone ? `Votre chauffeur : <strong>${data.driverPhone}</strong>.` : ""}`,
          { label: "Voir la course", url },
        ),
      };

    case "ride_no_show":
      return {
        subject: `Course clôturée (absence) — ${data.code ?? ""}`,
        html: layout(
          "Vous n'étiez pas au rendez-vous",
          `Bonjour,<br><br>Votre chauffeur s'est présenté au lieu de prise en charge, mais vous n'étiez pas présent. La course a été clôturée (No Show).${rideTable(data)}`,
          { label: "Voir la course", url },
        ),
      };

    default:
      throw new Error(`Type d'email inconnu : ${type}`);
  }
}

// ── Handler ──────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY non configurée");
    const payload = await req.json();
    const type = String(payload?.type ?? "");
    if (!type) throw new Error("Type d'email manquant");
    const data = sanitize(payload?.data);
    build({ type, data });   // type inconnu → erreur avant tout envoi

    // Appel système (déclencheur de la base) : secret partagé, uniquement certains emails
    const HOOK_SECRET = Deno.env.get("NOTIFY_HOOK_SECRET") ?? "";
    const hookHdr = req.headers.get("x-hook-secret") ?? "";
    if (hookHdr) {
      if (!HOOK_SECRET || hookHdr !== HOOK_SECRET) return json({ ok: false, error: "Non autorisé" }, 403);
      if (!["ride_completed", "driver_on_way", "ride_no_show", "offer_received", "driver_note", "assignment_changed"].includes(type)
          || !Array.isArray(payload?.to_user_ids)) {
        return json({ ok: false, error: "Non autorisé" }, 403);
      }
      let sent = 0;
      for (const id of (payload.to_user_ids as unknown[]).map(String).slice(0, 5)) {
        const to = await emailOfUser(id);
        if (!to) continue;
        const { data: p } = await admin.from("profiles").select("first_name").eq("id", id).maybeSingle();
        try { await sendOne(to, type, { ...data, clientName: escHtml(p?.first_name ?? "") }); sent++; }
        catch (e) { console.warn("send-mail system", e); }
      }
      console.log("send-mail", type, "(système) sent", sent);
      return json({ ok: true, sent });
    }

    // Appelant
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    const user = u?.user ?? null;
    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

    // ── Bienvenue : possible sans session, juste après l'inscription ──
    if (type === "welcome_client" || type === "welcome_driver") {
      const to = String(payload?.to ?? "").trim().toLowerCase();
      if (!user || user.email?.toLowerCase() !== to) {
        // pas encore connecté (email à confirmer) : le compte doit avoir moins de 15 min
        const { data: p } = await admin.from("profiles").select("id, created_at").eq("email", to).maybeSingle();
        const fresh = p?.created_at && Date.now() - new Date(p.created_at).getTime() < 15 * 60_000;
        const realEmail = p?.id ? await emailOfUser(p.id) : null;
        if (!fresh || realEmail !== to) return json({ ok: false, error: "Non autorisé" }, 403);
      }
      if (limited("welcome:" + to, 2, 24 * 3600_000)) return json({ ok: true, skipped: "déjà envoyé" });
      return json({ ok: true, id: await sendOne(to, type, data) });
    }

    if (!user) return json({ ok: false, error: "Connexion requise" }, 401);
    if (!isAdmin && limited("from:" + user.id, 60)) return json({ ok: false, error: "Trop d'envois, réessayez plus tard" }, 429);

    // ── Envoi groupé aux fleets vérifiées (nouvelle demande publiée) ──
    if (payload?.broadcast === "verified_drivers") {
      if (type !== "new_marketplace_ride") return json({ ok: false, error: "Non autorisé" }, 403);
      if (!isAdmin) {
        const since = new Date(Date.now() - 15 * 60_000).toISOString();
        const { count } = await admin.from("rides").select("id", { count: "exact", head: true })
          .eq("client_id", user.id).in("status", ["waiting", "offers"]).gte("created_at", since);
        if (!count) return json({ ok: false, error: "Non autorisé" }, 403);
        if (limited("broadcast:" + user.id, 5)) return json({ ok: false, error: "Trop d'envois groupés" }, 429);
      }
      const { data: drivers } = await admin.from("profiles")
        .select("id, first_name").eq("role", "driver").eq("fleet_verified", "validated").limit(500);
      let sent = 0;
      for (const d of drivers ?? []) {
        if (d.id === user.id || d.id === payload?.exclude_user_id) continue;
        try {
          const to = await emailOfUser(d.id);
          if (to) { await sendOne(to, type, { ...data, driverName: escHtml(d.first_name ?? "") }); sent++; }
        } catch (_) { /* un échec n'arrête pas l'envoi groupé */ }
      }
      return json({ ok: true, sent });
    }

    // ── Envoi à des utilisateurs (adresses résolues côté serveur) ──
    if (Array.isArray(payload?.to_user_ids)) {
      const ids = [...new Set((payload.to_user_ids as unknown[]).map(String))].slice(0, 20);
      let sent = 0;
      const skipped: { id: string; reason: string }[] = [];
      for (const id of ids) {
        if (!isAdmin) {
          const { data: ok, error: lErr } = await admin.rpc("users_linked", { p_a: user.id, p_b: id });
          if (lErr) {
            console.error("users_linked", lErr);
            return json({ ok: false, error: "users_linked : " + lErr.message + " (security_hardening2.sql exécuté ?)" }, 500);
          }
          if (!ok) { skipped.push({ id, reason: "pas de course commune" }); continue; }
        }
        const to = await emailOfUser(id);
        if (!to) { skipped.push({ id, reason: "adresse introuvable" }); continue; }
        try { await sendOne(to, type, data); sent++; }
        catch (e) { console.warn("send-mail", id, e); skipped.push({ id, reason: (e as Error).message }); }
      }
      console.log("send-mail", type, "from", user.id, "sent", sent, JSON.stringify(skipped));
      return json({ ok: sent > 0 || ids.length === 0, sent, skipped });
    }

    // ── Envoi direct ──
    const to = String(payload?.to ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Adresse email invalide");
    const allowed = isAdmin || to === user.email?.toLowerCase() || (to === ADMIN_EMAIL && type === "ride_problem");
    if (!allowed) return json({ ok: false, error: "Destinataire non autorisé" }, 403);
    return json({ ok: true, id: await sendOne(to, type, data) });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 400);
  }
});
