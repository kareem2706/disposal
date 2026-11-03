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
import { callout, mailLayout, type MailOpts, steps, tripCard } from "../_shared/mail.ts";

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
// Préférences e-mail du destinataire (Profil → Notifications). Par défaut : activé.
const PREF_KEY: Record<string, string> = {
  ride_created: "ride_published", offer_received: "offer_received", offer_updated: "offer_updated",
  ride_confirmed_client: "ride_confirmed", driver_note: "driver_message", assignment_changed: "driver_message",
  driver_on_way: "driver_on_way",
};
async function wantsEmail(userId: string | null | undefined, type: string): Promise<boolean> {
  const key = PREF_KEY[type];
  if (!key || !userId) return true;
  const { data } = await admin.from("profiles").select("notif_prefs").eq("id", userId).maybeSingle();
  return (data?.notif_prefs as any)?.email?.[key] !== false;
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

// ── Mise en page (commune à tous les e-mails : ../_shared/mail.ts) ──
const b = (v?: string) => (v ? `<b style="color:#16201B;">${v}</b>` : "");
const hi = (n?: string) => `Bonjour${n ? " " + n : ""},<br>`;
// Carte du trajet + infos utiles (passager, référence, chauffeur, véhicule, montant)
function trip(d: Record<string, string>, o: { price?: boolean; title?: string } = {}) {
  return tripCard(d, {
    title: o.title,
    info: [
      ["Passager", d.passenger ?? ""], ["Référence", d.code ?? ""],
      ["Chauffeur", d.driver ?? ""], ["Véhicule", d.vehicle ?? ""], ["Bagages", d.luggage ?? ""],
      ...(o.price === false ? [] : [["Montant TVAC", d.price ?? ""] as [string, string]]),
    ],
  });
}
const mail = (subject: string, o: MailOpts) => ({ subject, html: mailLayout({ preheader: o.preheader ?? "", ...o }) });

// ── Templates ────────────────────────────────────────────────────
type Payload = { type: string; data?: Record<string, string> };

function build({ type, data = {} }: Payload) {
  const url = `${APP_URL}/`;
  const d = data;   // valeurs déjà échappées par sanitize()

  switch (type) {
    case "ride_problem":
      return mail(`⚠️ Problème signalé — ${d.code ?? ""}`, {
        title: "Un client signale un problème.",
        intro: `Client : ${b(d.clientName)}${d.clientEmail ? ` · ${d.clientEmail}` : ""}${d.clientPhone ? ` · ${d.clientPhone}` : ""}`,
        card: trip(d),
        after: callout("Message du client", d.message ?? "", "danger"),
        cta: { label: "Ouvrir Bleenr", url },
      });

    case "ride_created":
      return mail(`Demande publiée — ${d.code ?? ""}`, {
        title: "Votre demande est publiée.",
        preheader: "Les chauffeurs partenaires peuvent maintenant vous envoyer leurs offres.",
        intro: `${hi(d.clientName)}votre demande ${b(d.code)} est en ligne. Les chauffeurs partenaires peuvent maintenant vous envoyer leurs offres.`,
        card: trip(d, { price: false }),
        cta: { label: "Consulter ma demande", url },
        note: "Nous vous préviendrons dès qu'un chauffeur aura envoyé une offre.",
      });

    case "offer_received":
      return mail(`Nouvelle offre reçue — ${d.code ?? ""}`, {
        title: "Vous avez reçu une offre.",
        preheader: "Un chauffeur a répondu à votre demande.",
        intro: `${hi(d.clientName)}un chauffeur vient d'envoyer une offre pour votre demande ${b(d.code)}.`,
        card: trip(d),
        cta: { label: "Consulter l'offre", url },
        note: "Comparez les offres reçues et confirmez celle qui vous convient.",
      });

    case "offer_updated": {
      const w = d.action === "withdrawn";
      return mail(`${w ? "Une offre a été retirée" : "Une offre a été modifiée"} — ${d.code ?? ""}`, {
        title: w ? "Une offre a été retirée." : "Une offre a été mise à jour.",
        intro: `${hi(d.clientName)}${w
          ? `un chauffeur a retiré son offre sur votre demande ${b(d.code)}. Les autres offres restent valables et votre demande reste visible par les chauffeurs.`
          : `un chauffeur a modifié son offre sur votre demande ${b(d.code)}${d.price ? ` : nouveau montant ${b(d.price + " TVAC")}` : ""}.`}`,
        card: trip(d, { price: false }),
        cta: { label: "Voir mes offres", url },
      });
    }

    case "ride_confirmed_client":
      return mail(`Course confirmée — ${d.code ?? ""}`, {
        title: "Votre course est confirmée.",
        preheader: "Paiement reçu, votre chauffeur est réservé.",
        intro: `${hi(d.clientName)}votre paiement a bien été reçu et votre course ${b(d.code)} est confirmée.`,
        card: trip(d),
        after: d.driverPhone ? callout("Votre chauffeur", `Vous pouvez le joindre au ${b(d.driverPhone)}.`, "info") : "",
        cta: { label: "Voir les détails", url },
        note: "Vous recevrez un rappel la veille du départ.",
      });

    case "ride_confirmed_driver":
      return mail(`Mission confirmée — ${d.code ?? ""}`, {
        title: "Votre mission est confirmée.",
        intro: `${hi(d.driverName)}votre offre a été acceptée et le paiement est reçu. La mission ${b(d.code)} vous est attribuée.`,
        card: trip(d, { title: "Votre mission" }),
        cta: { label: "Voir ma mission", url },
        note: "Pensez à télécharger votre ordre de mission depuis l'application.",
      });

    case "ride_cancelled":
      return mail(`Course annulée — ${d.code ?? ""}`, {
        title: "Course annulée.",
        intro: `${hi(d.name)}la course ${b(d.code)} a été annulée.`,
        card: trip(d),
        after: callout("Remboursement", d.refund === "yes"
          ? "Un remboursement intégral sera effectué sous 5 à 10 jours ouvrables, sur le moyen de paiement utilisé."
          : "Conformément aux conditions générales, cette annulation tardive ne donne pas lieu à un remboursement.", d.refund === "yes" ? "info" : "warn"),
        cta: { label: "Ouvrir Bleenr", url },
      });

    case "ride_reminder":
      return mail(`Rappel — votre course demain (${d.code ?? ""})`, {
        title: "Votre course a lieu demain.",
        preheader: "Petit rappel avant votre départ.",
        intro: `${hi(d.name)}petit rappel concernant votre course ${b(d.code)}.`,
        card: trip(d, { price: false }),
        cta: { label: "Voir les détails", url },
        note: "Votre chauffeur vous attendra au lieu de prise en charge.",
      });

    case "welcome_client":
      return mail("Bienvenue sur Bleenr", {
        title: `Bienvenue${d.name ? ", " + d.name : ""}.`,
        intro: "Votre compte Bleenr est créé. Vous pouvez dès maintenant réserver un chauffeur privé en quelques clics.",
        card: steps("Comment ça marche", [
          "Publiez votre demande de course",
          "Recevez les offres des chauffeurs partenaires",
          "Choisissez la vôtre et confirmez le paiement",
          "Votre chauffeur vous attend au point de départ",
        ]),
        after: d.isPro === "yes"
          ? "Votre compte professionnel vous donne accès au carnet de passagers et à la facturation mensuelle centralisée."
          : "Vous recevrez un e-mail à chaque étape : offre reçue, course confirmée, rappel la veille du départ.",
        cta: { label: "Réserver ma première course", url },
      });

    case "welcome_driver":
      return mail("Bienvenue sur Bleenr — activation de votre compte", {
        title: `Bienvenue${d.name ? ", " + d.name : ""}.`,
        intro: "Votre compte chauffeur Bleenr est créé. Avant d'accéder à la marketplace, votre flotte doit être validée par nos équipes.",
        card: steps("Prochaines étapes", [
          "Complétez votre profil et vos coordonnées",
          "Ajoutez vos véhicules et vos chauffeurs",
          "Téléversez vos documents (licence, assurance, contrôle technique)",
          "Notre équipe valide votre dossier sous 48 h ouvrées",
        ]),
        cta: { label: "Compléter mon profil", url },
        note: "Une fois votre flotte validée, vous serez alerté à chaque nouvelle course disponible.",
      });

    case "new_marketplace_ride":
      return mail(`Nouvelle course disponible — ${d.code ?? ""}`, {
        title: "Nouvelle course disponible.",
        preheader: "Une demande correspondant à votre flotte vient d'être publiée.",
        intro: `${hi(d.driverName)}une nouvelle demande ${b(d.code)} correspondant à votre flotte vient d'être publiée sur la marketplace.`,
        card: trip(d, { title: "La course" }),
        cta: { label: "Faire une offre", url },
        note: "Soyez réactif : les clients choisissent souvent parmi les premières offres.",
      });

    case "ride_completed":
      return mail(`Merci d'avoir voyagé avec Bleenr — ${d.code ?? ""}`, {
        title: `Merci${d.clientName ? ", " + d.clientName : ""}.`,
        intro: "Votre course est terminée. Merci d'avoir fait confiance à Bleenr.",
        card: trip(d),
        after: callout("Votre avis compte", "Prenez quelques secondes pour noter votre chauffeur : cela nous aide à garantir un service de qualité.<br><br>Un souci ? Signalez-le depuis la fiche de votre demande (menu ⋮ → Signaler un problème).", "neutral"),
        cta: { label: "Noter mon chauffeur", url },
        note: "Au plaisir de vous revoir très bientôt.",
      });

    case "offer_accepted_driver":
      return mail(`Offre acceptée — ${d.code ?? ""}`, {
        title: "Votre offre a été acceptée.",
        intro: `Bonjour,<br>le client a retenu votre offre pour la course ${b(d.code)}. Elle vous sera attribuée dès réception du paiement.`,
        card: trip(d, { title: "La course" }),
        cta: { label: "Voir la mission", url },
      });

    case "ride_updated":
      return mail(`Course modifiée — ${d.code ?? ""}`, {
        title: "Une course a été modifiée.",
        intro: `Bonjour,<br>le client a modifié ${d.changes ? b(d.changes) : "sa course"} sur la demande ${b(d.code)}.`,
        card: trip(d, { title: "La course", price: false }),
        after: d.note ? callout("Note", d.note) : "",
        cta: { label: "Voir la course", url },
        note: "Si vous aviez envoyé une offre, vérifiez qu'elle est toujours adaptée.",
      });

    case "driver_on_way":
      return mail(`Votre chauffeur est en route — ${d.code ?? ""}`, {
        title: "Votre chauffeur est en route.",
        preheader: "Il se dirige vers le lieu de prise en charge.",
        intro: `Bonjour,<br>votre chauffeur vient de partir vers le lieu de prise en charge de la course ${b(d.code)}.`,
        card: trip(d, { price: false }),
        after: d.driverPhone ? callout("Votre chauffeur", `Vous pouvez le joindre au ${b(d.driverPhone)}.`, "info") : "",
        cta: { label: "Suivre en direct", url },
      });

    case "driver_note":
      return mail(`Message de votre chauffeur — ${d.code ?? ""}`, {
        title: d.noteAction === "updated" ? "Votre chauffeur a mis à jour son message." : "Votre chauffeur vous a laissé un message.",
        intro: `Bonjour,<br>message concernant votre course ${b(d.code)} :`,
        card: callout("Message du chauffeur", d.note ?? "", "info"),
        after: trip(d, { price: false }),
        cta: { label: "Voir la course", url },
      });

    case "assignment_changed":
      return mail(`Mise à jour de votre course — ${d.code ?? ""}`, {
        title: "Votre course a été mise à jour.",
        intro: `Bonjour,<br>le transporteur a modifié ${d.changes ? b(d.changes) : "l'attribution"} de votre course ${b(d.code)}.`,
        card: trip(d, { price: false }),
        after: d.driverPhone ? callout("Votre chauffeur", `Vous pouvez le joindre au ${b(d.driverPhone)}.`, "info") : "",
        cta: { label: "Voir la course", url },
      });

    case "ride_no_show":
      return mail(`Course clôturée (absence) — ${d.code ?? ""}`, {
        title: "Vous n'étiez pas au rendez-vous.",
        intro: `Bonjour,<br>votre chauffeur s'est présenté au lieu de prise en charge, mais vous n'étiez pas présent. La course ${b(d.code)} a été clôturée.`,
        card: trip(d),
        cta: { label: "Voir la course", url },
        note: "Une erreur ? Écrivez-nous à info@bleenr.com.",
      });

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
      if (!["ride_completed", "driver_on_way", "ride_no_show", "offer_received", "offer_updated", "driver_note", "assignment_changed"].includes(type)
          || !Array.isArray(payload?.to_user_ids)) {
        return json({ ok: false, error: "Non autorisé" }, 403);
      }
      let sent = 0;
      for (const id of (payload.to_user_ids as unknown[]).map(String).slice(0, 5)) {
        if (!(await wantsEmail(id, type))) continue;   // désactivé par le destinataire
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

    // ── Envoi groupé aux fleets vérifiées ──
    if (payload?.broadcast === "verified_drivers") {
      if (type !== "new_marketplace_ride" && type !== "ride_updated") return json({ ok: false, error: "Non autorisé" }, 403);
      if (type === "ride_updated") {
        // Demande modifiée : contenu construit ici à partir de la course (jamais la note ni le passager)
        const { data: r } = await admin.from("rides")
          .select("id, client_id, status, booking_code, ride_date, ride_time, from_address, to_address, trip_type")
          .eq("id", String(payload?.ride_id ?? "")).maybeSingle();
        if (!r || (!isAdmin && r.client_id !== user.id) || !["waiting", "offers"].includes(r.status)) {
          return json({ ok: false, error: "Non autorisé" }, 403);
        }
        if (!isAdmin && limited("upd:" + r.id, 10)) return json({ ok: false, error: "Trop d'envois pour cette demande" }, 429);
        const LBL = ["date", "heure", "départ", "arrivée", "passagers", "véhicule", "type de course"];
        const chg = String(payload?.data?.changes ?? "").split(",").map((x) => x.trim()).filter((x) => LBL.includes(x));
        const day = r.ride_date ? String(r.ride_date).slice(0, 10).split("-").reverse().join("/") : "";
        const short = (a?: string | null) => String(a ?? "").split(",")[0].trim();
        Object.keys(data).forEach((k) => delete data[k]);
        Object.assign(data, sanitize({
          code: r.booking_code ?? String(r.id).slice(0, 8), date: day, time: String(r.ride_time ?? "").slice(0, 5),
          from: short(r.from_address), to: r.trip_type === "disposal" ? "Mise à disposition" : short(r.to_address),
          changes: chg.join(", "),
        }));
        if (!chg.length) return json({ ok: true, sent: 0 });
      } else {
        // Nouvelle demande : contenu construit ici à partir de la course (le navigateur ne fournit que son id)
        const { data: r } = await admin.from("rides")
          .select("id, client_id, status, booking_code, ride_date, ride_time, from_address, to_address, trip_type, is_subcontract, final_price, created_at, passengers, luggage_large, luggage_small")
          .eq("id", String(payload?.ride_id ?? "")).maybeSingle();
        const recent = r?.created_at && Date.now() - new Date(r.created_at).getTime() < 15 * 60_000;
        if (!r || !["waiting", "offers"].includes(r.status) || (!isAdmin && (r.client_id !== user.id || !recent))) {
          return json({ ok: false, error: "Non autorisé" }, 403);
        }
        if (limited("mkt:" + r.id, 1, 24 * 3600_000)) return json({ ok: true, sent: 0, skipped: "déjà envoyé" });
        if (!isAdmin && limited("broadcast:" + user.id, 5)) return json({ ok: false, error: "Trop d'envois groupés" }, 429);
        const TL: Record<string, string> = { ab: "A → B", disposal: "Mise à disposition", mixed: "Course mixte" };
        const day = r.ride_date ? String(r.ride_date).slice(0, 10).split("-").reverse().join("/") : "";
        Object.keys(data).forEach((k) => delete data[k]);
        Object.assign(data, sanitize({
          code: r.booking_code ?? String(r.id).slice(0, 8), date: day, time: String(r.ride_time ?? "").slice(0, 5),
          from: r.from_address ?? "", to: r.to_address || TL[r.trip_type ?? ""] || "",
          passenger: r.passengers ? r.passengers + " passager" + (r.passengers > 1 ? "s" : "") : "",
          luggage: [r.luggage_large ? r.luggage_large + " valise" + (r.luggage_large > 1 ? "s" : "") : "", r.luggage_small ? r.luggage_small + " sac" + (r.luggage_small > 1 ? "s" : "") : ""].filter(Boolean).join(" · "),
          // prix fixe uniquement pour une sous-traitance (jamais le prix d'un client)
          price: r.is_subcontract && r.final_price ? Number(r.final_price).toFixed(2).replace(".", ",") + " € HTVA" : "",
        }));
        if (r.is_subcontract) payload.exclude_user_id = r.client_id;
      }
      const { data: drivers } = await admin.from("profiles")
        .select("id, first_name").eq("role", "driver").eq("fleet_verified", "validated").limit(500);
      // Uniquement les fleets qui ont un véhicule de la gamme demandée (vehicle_class_filter.sql)
      // + assez de places pour les passagers (ride_rules.sql : fleets_for_ride) ; repli sur la gamme seule
      let { data: okFleets, error: fErr } = await admin.rpc("fleets_for_ride", { p_ride: String(payload?.ride_id ?? "") });
      if (fErr) {
        const { data: rcls } = await admin.from("rides").select("vehicle_type").eq("id", String(payload?.ride_id ?? "")).maybeSingle();
        ({ data: okFleets, error: fErr } = await admin.rpc("fleets_for_class", { p_class: rcls?.vehicle_type ?? null }));
      }
      const allowedFleets = fErr ? null : new Set(((okFleets as unknown[]) ?? []).map((x: any) => String(typeof x === "object" && x ? Object.values(x)[0] : x)));
      let sent = 0;
      for (const d of drivers ?? []) {
        if (d.id === user.id || d.id === payload?.exclude_user_id) continue;
        if (allowedFleets && !allowedFleets.has(d.id)) continue;
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
        if (!(await wantsEmail(id, type))) { skipped.push({ id, reason: "désactivé par le destinataire" }); continue; }
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
    if (to === user.email?.toLowerCase() && !(await wantsEmail(user.id, type))) return json({ ok: true, skipped: "désactivé par le destinataire" });
    return json({ ok: true, id: await sendOne(to, type, data) });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 400);
  }
});
