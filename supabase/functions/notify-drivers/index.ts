// Supabase Edge Function: notify-drivers
// Appelée par un Database Webhook sur la table rides (INSERT + UPDATE).
// Envoie des notifications push (Expo) aux chauffeurs de l'app Bleenr Chauffeur :
//   • « Nouvelle demande »  → tous les chauffeurs (sauf le créateur) quand une demande est publiée
//   • « Demande / Mission modifiée » → chauffeurs ayant fait une offre + chauffeur attribué, quand le client change
//     date, heure, adresses, gamme, passagers, passager / téléphone, note pour le chauffeur (notification seule, sans pastille)
//   • « Demande annulée »   → chauffeurs ayant fait une offre + chauffeur attribué, quand la course passe à « cancelled »
//   • « Offre acceptée »    → le chauffeur dont l'offre est retenue (course confirmée ou en attente de paiement)
// Les chauffeurs dont l'offre a été refusée (autre chauffeur retenu) ne reçoivent plus rien sur cette demande.
// Pastille de l'icône : à chaque nouvelle demande, ou demande qui quitte la marketplace (annulée / attribuée),
// chaque téléphone reçoit le nombre de demandes ouvertes sans offre de sa part (mise à jour silencieuse si besoin).
// Chaque chauffeur peut couper chaque type dans son profil (push_tokens.prefs).

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPEN = ["waiting", "offers"];
const WATCHED = ["ride_date", "ride_time", "from_address", "to_address", "vehicle_type", "passengers", "trip_type"];
// Libellés des changements faits par le client (affichés dans la notification)
const LABELS: Record<string, string> = {
  ride_date: "date", ride_time: "heure", from_address: "adresse de départ", to_address: "adresse d'arrivée",
  vehicle_type: "gamme", passengers: "passagers", trip_type: "type de course",
  pax: "passager", tel: "téléphone du passager", note_drv: "note pour le chauffeur", note: "note du client",
  flight: "numéro de vol", train: "numéro de train",
};
const tag = (n: any, t: string) => ((String(n || "").match(new RegExp("\\|" + t + ":([^|]*)")) || [])[1] || "").trim();
// Partie des notes saisie par le client (sans les tags techniques ni la note du chauffeur |offer_note:)
const clientNote = (n: any) => String(n || "").replace(/\|(pax|tel|pemail|pref|note_drv|offer_note|flight|train):[^|]*/g, "").trim();
// Ce que le client a modifié (les changements faits par le chauffeur — note au client, étapes — sont ignorés)
// Note du client telle que recopiée automatiquement en « note pour le chauffeur » à la confirmation
// (même calcul que confirm_ride_payment / _promoteNotesToDriver)
const promotedNote = (n: any) =>
  String(n || "").replace(/\|(pax|tel|pemail|pref|flight|train):[^|]*/g, "").replace(/^Mixte:.*$/m, "")
    .replace(/Durée:[^\s|]+/g, "").replace(/\s+/g, " ").trim();
function clientChanges(rec: Ride, old: Ride): string[] {
  const out = WATCHED.filter((k) => String(rec[k] ?? "") !== String(old[k] ?? ""));
  for (const t of ["pax", "tel", "note_drv", "flight", "train"]) {
    if (tag(rec.notes, t) === tag(old.notes, t)) continue;
    // Recopie automatique de la note du client à la confirmation : ce n'est pas une modification du client
    if (t === "note_drv" && !tag(old.notes, t) && tag(rec.notes, t).replace(/\s+/g, " ") === promotedNote(old.notes)) continue;
    out.push(t);
  }
  if (clientNote(rec.notes) !== clientNote(old.notes)) out.push("note");
  return out;
}
const VEH: Record<string, string> = { lowcost: "Low-cost", business: "Business", van: "Van", luxe: "Luxe" };
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

type Ride = Record<string, any>;
type Kind = "new_request" | "request_updated" | "request_cancelled" | "offer_accepted";

async function rest(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  return r.ok ? await r.json() : [];
}

const short = (a?: string) => (a || "").split(",")[0].trim();
function when(r: Ride) {
  const [y, m, d] = String(r.ride_date || "").slice(0, 10).split("-").map(Number);
  if (!y) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}` + (r.ride_time ? " · " + String(r.ride_time).slice(0, 5) : "");
}
function route(r: Ride) {
  if (r.trip_type === "disposal") {
    const dur = (String(r.notes || "").match(/Durée:([^\s|,]+)/) || [])[1];
    return `Disposition${dur ? " " + dur : ""} · ${short(r.from_address)}`;
  }
  return `${short(r.from_address)} → ${short(r.to_address)}`;
}

function decide(type: string, rec: Ride, old: Ride | null): Kind | null {
  if (!rec || rec.status === "personal" || (rec.client_id && rec.client_id === rec.driver_id)) return null;
  if (type === "INSERT") return OPEN.includes(rec.status) ? "new_request" : null;
  if (type !== "UPDATE" || !old) return null;
  if (rec.status === "cancelled" && old.status !== "cancelled") return "request_cancelled";
  // Offre acceptée : un chauffeur est attribué à une demande qui était ouverte
  const assigned = ["confirmed", "pending_payment"].includes(rec.status) && !!rec.driver_id;
  if (assigned && (OPEN.includes(old.status) || !old.driver_id || old.driver_id !== rec.driver_id)) return "offer_accepted";
  // Demande qui (re)devient ouverte (ex. paiement validé, republication)
  if (OPEN.includes(rec.status) && !OPEN.includes(old.status) && old.status !== "cancelled") return "new_request";
  if (rec.status !== "cancelled" && rec.status !== "done" && clientChanges(rec, old).length) return "request_updated";
  return null;
}

// Pastille de l'icône : nombre de demandes ouvertes sans offre du chauffeur (même calcul que l'app)
async function badgeCounts(userIds: string[]): Promise<Record<string, number>> {
  const open: any[] = await rest(`rides?status=in.(waiting,offers)&select=id,client_id`);
  const out: Record<string, number> = {};
  if (!userIds.length) return out;
  const ids = open.map((r) => r.id);
  const offers: any[] = ids.length ? await rest(`offers?ride_id=in.(${ids.join(",")})&select=ride_id,driver_id`) : [];
  const offered = new Set(offers.map((o) => o.driver_id + ":" + o.ride_id));
  for (const u of userIds) out[u] = open.filter((r) => r.client_id !== u && !offered.has(u + ":" + r.id)).length;
  return out;
}

async function sendAll(msgs: any[]) {
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < msgs.length; i += 100) {
    const chunk = msgs.slice(i, i + 100);
    const r = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(chunk),
    });
    const j = await r.json().catch(() => ({}));
    (j.data || []).forEach((t: any, k: number) => {
      if (t.status === "ok") sent++;
      else if (t.details?.error === "DeviceNotRegistered") dead.push(chunk[k].to);
    });
  }
  return { sent, dead };
}

// Secret partagé avec le déclencheur SQL (security_hardening.sql) : sans lui, l'appel est refusé.
// Tant que NOTIFY_HOOK_SECRET n'est pas configuré, l'ancien comportement est conservé.
const HOOK_SECRET = Deno.env.get("NOTIFY_HOOK_SECRET") ?? "";
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (HOOK_SECRET && !sameSecret(req.headers.get("x-hook-secret") ?? "", HOOK_SECRET)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  try {
    const p = await req.json();
    const rec: Ride = p.record, old: Ride | null = p.old_record ?? null;
    const kind = decide(p.type, rec, old);
    // La liste des demandes ouvertes a changé (nouvelle demande, demande annulée ou attribuée) → pastilles à jour
    const wasOpen = !!old && OPEN.includes(old.status), isOpen = !!rec && OPEN.includes(rec.status);
    const openChanged = (p.type === "INSERT" && isOpen) || (p.type === "UPDATE" && wasOpen !== isOpen);
    if (!kind && !openChanged) return new Response(JSON.stringify({ skipped: true }), { status: 200 });

    // Destinataires de la notification visible
    let users: string[] | null = null; // null = tous les chauffeurs
    if (kind === "offer_accepted") {
      users = [rec.driver_id];
    } else if (kind && kind !== "new_request") {
      // Offres en cours ou acceptée (pas les offres refusées) + chauffeur attribué
      const offers = await rest(`offers?ride_id=eq.${rec.id}&status=in.(pending,accepted)&select=driver_id`);
      users = [...new Set([...(offers as any[]).map((o) => o.driver_id), rec.driver_id].filter(Boolean))];
    }
    // Tous les téléphones (pour la pastille), puis filtre pour la notification visible
    const all: any[] = await rest(`push_tokens?select=token,user_id,prefs`);
    const visible = kind ? all.filter((t) => t.user_id !== rec.client_id && (!users || users.includes(t.user_id)) && (t.prefs?.[kind] ?? true) !== false) : [];
    const badges = openChanged ? await badgeCounts([...new Set(all.map((t) => t.user_id))]) : {};

    const mission = !!rec.driver_id && ["confirmed", "active", "pending_payment"].includes(rec.status);
    const changed = kind === "request_updated" && old ? clientChanges(rec, old).map((k) => LABELS[k] || k) : [];
    const title = kind === "new_request" ? (rec.is_subcontract ? "Nouvelle sous-traitance" : "Nouvelle demande")
      : kind === "request_updated" ? (mission ? `Mission modifiée${rec.booking_code ? " · " + rec.booking_code : ""}` : "Demande modifiée")
      : kind === "offer_accepted" ? "Offre acceptée 🎉" : "Demande annulée";
    const extra = [VEH[rec.vehicle_type] || rec.vehicle_type, rec.passengers ? rec.passengers + " pax" : ""].filter(Boolean).join(" · ");
    const lead = kind === "offer_accepted" ? `${rec.booking_code || "Course"} est confirmée pour vous.`
      : changed.length ? "Modifié par le client : " + [...new Set(changed)].join(", ") + "." : "";
    const body = [lead, route(rec), [when(rec), kind === "new_request" ? extra : ""].filter(Boolean).join(" · ")].filter(Boolean).join("\n");

    const shown = new Set(visible.map((t) => t.token));
    const msgs: any[] = visible.map((t) => ({
      to: t.token, title, body, sound: "default", data: { ride_id: rec.id, kind }, channelId: "default",
      ...(openChanged ? { badge: badges[t.user_id] ?? 0 } : {}),
    }));
    // Les autres téléphones : mise à jour silencieuse de la pastille uniquement
    if (openChanged) {
      for (const t of all) if (!shown.has(t.token) && t.user_id !== rec.client_id) msgs.push({ to: t.token, badge: badges[t.user_id] ?? 0, _contentAvailable: true });
    }
    if (!msgs.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    const { sent, dead } = await sendAll(msgs);
    // Jetons d'apps désinstallées : nettoyage
    if (dead.length) {
      await fetch(`${SB_URL}/rest/v1/push_tokens?token=in.(${dead.map((d) => `"${d}"`).join(",")})`, {
        method: "DELETE", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      });
    }
    return new Response(JSON.stringify({ kind, openChanged, sent }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
