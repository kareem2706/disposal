// Supabase Edge Function: notify-drivers
// Appelée par un Database Webhook sur la table rides (INSERT + UPDATE).
// Envoie des notifications push (Expo) aux chauffeurs de l'app Bleenr Chauffeur :
//   • « Nouvelle demande »  → tous les chauffeurs (sauf le créateur) quand une demande est publiée
//   • « Demande / Mission modifiée » → chauffeurs ayant fait une offre + chauffeur attribué, quand le client change
//     date, heure, adresses, gamme, passagers, passager / téléphone, note pour le chauffeur (notification seule, sans pastille)
//   • « Demande annulée »   → chauffeurs ayant fait une offre + chauffeur attribué, quand la course passe à « cancelled »
//   • « Offre acceptée »    → le chauffeur dont l'offre est retenue (course confirmée ou en attente de paiement)
//   • Sous-traitance suivie → le donneur d'ordre : véhicule / chauffeur / note du sous-traitant, « En chemin », terminée
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
const VEH: Record<string, string> = { lowcost: "Economy", business: "Business", van: "Van", luxe: "Luxe", bus: "Bus", any: "Toute gamme" };
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Ride = Record<string, any>;
type Lang = "fr" | "en";

// ── Langue des notifications : celle du profil du destinataire (profiles.lang, choisie dans l'app ou sur le site) ──
const EN: Record<string, string> = {
  "date": "date", "heure": "time", "adresse de départ": "departure address", "adresse d'arrivée": "arrival address", "gamme": "category",
  "passagers": "passengers", "type de course": "ride type", "passager": "passenger", "téléphone du passager": "passenger’s phone",
  "note pour le chauffeur": "note for the driver", "note du client": "client’s note", "numéro de vol": "flight number", "numéro de train": "train number",
  "Toute gamme": "Any category", "Luxe": "Luxury", "Disposition": "Hourly",
  "Nouvelle sous-traitance": "New subcontract", "Nouvelle demande": "New request", "Mission modifiée": "Mission changed", "Demande modifiée": "Request changed",
  "Offre acceptée 🎉": "Offer accepted 🎉", "Demande annulée": "Request cancelled", "Course": "Ride", " est confirmée pour vous.": " is confirmed for you.",
  "Modifié par le client : ": "Changed by the client: ",
  "Sous-traitance mise à jour": "Subcontract updated", "Note modifiée : ": "Note changed: ", "Note ajoutée : ": "Note added: ", "La note a été supprimée": "The note was deleted",
  "En chemin": "On the way", "Le chauffeur est en route vers la prise en charge.": "The driver is heading to the pick-up.",
  "Client à bord": "Client on board", "Le passager est à bord, la mise à disposition a commencé.": "The passenger is on board, the hourly hire has started.",
  "En route vers la destination": "Heading to the destination", "Le passager est à bord, direction ": "The passenger is on board, heading to ", "la destination": "the destination",
  "Course terminée": "Ride completed", "Le sous-traitant a terminé la course.": "The subcontractor has completed the ride.",
  // lignes envoyées par subcontract_push.sql
  "Le véhicule a été retiré": "The vehicle was removed", "Véhicule assigné : ": "Vehicle assigned: ", "Changement de véhicule : ": "Vehicle changed: ",
  "Le chauffeur a été supprimé": "The driver was removed", "Chauffeur assigné : ": "Driver assigned: ", "Changement de chauffeur : ": "Driver changed: ",
  "véhicule": "vehicle", "chauffeur": "driver",
};
const T = (l: Lang, fr: string) => (l === "en" ? EN[fr] ?? fr : fr);
// Ligne venant de la base (« Chauffeur assigné : Mounir Bassi ») : préfixe traduit, nom inchangé
function trLine(l: Lang, line: string) {
  if (l !== "en") return line;
  if (EN[line]) return EN[line];
  const pre = Object.keys(EN).find((k) => k.endsWith(": ") && line.startsWith(k));
  return pre ? EN[pre] + line.slice(pre.length) : line;
}
async function langsOf(ids: string[]): Promise<Record<string, Lang>> {
  const u = [...new Set(ids.filter(Boolean))];
  if (!u.length) return {};
  const rows: any[] = await rest(`profiles?id=in.(${u.join(",")})&select=id,lang`).catch(() => []);
  const out: Record<string, Lang> = {};
  for (const r of rows) out[r.id] = r.lang === "en" ? "en" : "fr";
  return out;
}
type Kind = "new_request" | "request_updated" | "request_cancelled" | "offer_accepted";

async function rest(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  return r.ok ? await r.json() : [];
}

const short = (a?: string) => (a || "").split(",")[0].trim();
function when(r: Ride, l: Lang = "fr") {
  const [y, m, d] = String(r.ride_date || "").slice(0, 10).split("-").map(Number);
  if (!y) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = l === "en" ? `${DAYS_EN[dt.getUTCDay()]} ${d} ${MONTHS_EN[m - 1]}` : `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
  return day + (r.ride_time ? " · " + String(r.ride_time).slice(0, 5) : "");
}
function route(r: Ride, l: Lang = "fr") {
  if (r.trip_type === "disposal") {
    const dur = (String(r.notes || "").match(/Durée:([^\s|,]+)/) || [])[1];
    return `${T(l, "Disposition")}${dur ? " " + dur : ""} · ${short(r.from_address)}`;
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

// Gamme demandée → classes de véhicule acceptées (identique à vehicle_class_filter.sql)
const CLASS_VEHICLES: Record<string, string[]> = {
  any: ["lowcost", "business", "van", "luxe", "bus"],
  lowcost: ["lowcost", "business", "van", "luxe"], business: ["business", "van", "luxe"], van: ["van"], luxe: ["luxe"], bus: ["bus"],
};
// Places d'un véhicule (défaut selon la gamme, identique à _veh_seats de ride_rules.sql)
const seatsOf = (v: { seats?: number | null; c: string }) => v.seats ?? (v.c === "van" ? 7 : v.c === "bus" ? 50 : 3);
let fleetVeh: Map<string, { c: string; seats?: number | null }[]> | null = null;
async function loadFleetVehicles() {
  const rows: any[] = await rest(`fleet_vehicles?select=fleet_id,vehicle_class,seats,active,status`);
  fleetVeh = new Map();
  for (const v of rows) {
    if (v.active === false || v.status === "rejected") continue;
    fleetVeh.set(v.fleet_id, [...(fleetVeh.get(v.fleet_id) || []), { c: v.vehicle_class, seats: v.seats }]);
  }
}
// La fleet a-t-elle un véhicule de la gamme demandée avec assez de places ?
function canServe(fleetId: string, cls?: string | null, pax?: number | null) {
  const mine = fleetVeh?.get(fleetId) || [];
  const ok = cls ? (CLASS_VEHICLES[cls] || [cls]) : null;
  return mine.some((v) => (!ok || ok.includes(v.c)) && seatsOf(v) >= Math.max(1, pax || 1));
}

// Pastille de l'icône : nombre de demandes ouvertes sans offre du chauffeur, de sa gamme (même calcul que l'app)
async function badgeCounts(userIds: string[]): Promise<Record<string, number>> {
  const open: any[] = await rest(`rides?status=in.(waiting,offers)&select=id,client_id,vehicle_type,passengers`);
  const out: Record<string, number> = {};
  if (!userIds.length) return out;
  const ids = open.map((r) => r.id);
  const offers: any[] = ids.length ? await rest(`offers?ride_id=in.(${ids.join(",")})&select=ride_id,driver_id`) : [];
  const offered = new Set(offers.map((o) => o.driver_id + ":" + o.ride_id));
  // sous-traitances ciblées : comptées seulement pour les chauffeurs choisis
  const tg: any[] = ids.length ? await rest(`ride_targets?ride_id=in.(${ids.join(",")})&select=ride_id,driver_id`).catch(() => []) : [];
  const targeted = new Set(tg.map((x) => x.ride_id)), chosen = new Set(tg.map((x) => x.driver_id + ":" + x.ride_id));
  for (const u of userIds) out[u] = open.filter((r) => r.client_id !== u && !offered.has(u + ":" + r.id) && canServe(u, r.vehicle_type, r.passengers)
    && (!targeted.has(r.id) || chosen.has(u + ":" + r.id))).length;
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

// ── Suivi d'une sous-traitance : push au donneur d'ordre (client_id de la course) ──
// • course (rides UPDATE) : note du sous-traitant, « En chemin », course terminée
// • offre (SUB_ASSIGN, subcontract_push.sql) : véhicule / chauffeur changés
// title : texte français (traduit ici) ; lead : texte déjà prêt, ou fonction (langue → texte)
async function pushPoster(rec: Ride, title: string, lead: string | ((l: Lang) => string)) {
  if (!rec?.client_id) return 0;
  const toks: any[] = await rest(`push_tokens?user_id=eq.${rec.client_id}&select=token,prefs`);
  const l = (await langsOf([rec.client_id]))[rec.client_id] || "fr";
  const msgs = toks.filter((t) => (t.prefs?.sub_update ?? true) !== false).map((t) => ({
    to: t.token, title: `${T(l, title)}${rec.booking_code ? " · " + rec.booking_code : ""}`,
    body: typeof lead === "function" ? lead(l) : lead,   // sobre : uniquement ce qui a changé (la référence est dans le titre)
    sound: "default", data: { ride_id: rec.id, kind: "sub_update" }, channelId: "default",
  }));
  return msgs.length ? (await sendAll(msgs)).sent : 0;
}
async function subRideEvents(rec: Ride, old: Ride | null) {
  if (!old || !rec?.is_subcontract || !rec.client_id || !rec.driver_id || rec.driver_id === rec.client_id) return 0;
  if (rec.driver_id !== old.driver_id) return 0;   // acceptation : gérée ailleurs
  let n = 0;
  const nn = tag(rec.notes, "offer_note"), on = tag(old.notes, "offer_note");
  if (nn !== on) n += await pushPoster(rec, "Sous-traitance mise à jour", (l) => nn ? T(l, on ? "Note modifiée : " : "Note ajoutée : ") + nn.slice(0, 160) : T(l, "La note a été supprimée"));
  // Étapes de la course faites par le sous-traitant
  if (rec.on_way_at && !old.on_way_at) n += await pushPoster(rec, "En chemin", (l) => T(l, "Le chauffeur est en route vers la prise en charge."));
  if (rec.pickup_at && !old.pickup_at && rec.status !== "done") {
    n += rec.trip_type === "disposal"
      ? await pushPoster(rec, "Client à bord", (l) => T(l, "Le passager est à bord, la mise à disposition a commencé."))
      : await pushPoster(rec, "En route vers la destination", (l) => T(l, "Le passager est à bord, direction ") + (short(rec.to_address) || T(l, "la destination")) + ".");
  }
  if (rec.status === "done" && old.status !== "done") n += await pushPoster(rec, "Course terminée", (l) => T(l, "Le sous-traitant a terminé la course."));
  return n;
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
    // Véhicule / chauffeur d'une sous-traitance modifiés par le sous-traitant
    if (p.type === "SUB_ASSIGN") {
      const lines: string[] = Array.isArray(p.lines) ? p.lines.filter(Boolean) : [];
      const sent = lines.length ? await pushPoster(p.record, "Sous-traitance mise à jour", (l) => lines.map((x) => trLine(l, x)).join("\n")) : 0;
      return new Response(JSON.stringify({ kind: "sub_update", sent }), { status: 200 });
    }
    const rec: Ride = p.record, old: Ride | null = p.old_record ?? null;
    if (p.type === "UPDATE") await subRideEvents(rec, old).catch(() => 0);
    const kind = decide(p.type, rec, old);
    // La liste des demandes ouvertes a changé (nouvelle demande, demande annulée ou attribuée) → pastilles à jour
    const wasOpen = !!old && OPEN.includes(old.status), isOpen = !!rec && OPEN.includes(rec.status);
    const openChanged = (p.type === "INSERT" && isOpen) || (p.type === "UPDATE" && wasOpen !== isOpen);
    if (!kind && !openChanged) return new Response(JSON.stringify({ skipped: true }), { status: 200 });

    await loadFleetVehicles();
    // Destinataires de la notification visible
    let users: string[] | null = null; // null = tous les chauffeurs
    if (kind === "new_request") {
      // Uniquement les fleets qui ont un véhicule de la gamme demandée
      users = [...(fleetVeh?.keys() || [])].filter((f) => canServe(f, rec.vehicle_type, rec.passengers));
      // Sous-traitance réservée à une sélection de chauffeurs (subcontract_targets.sql)
      if (rec.is_subcontract) {
        const tg: any[] = await rest(`ride_targets?ride_id=eq.${rec.id}&select=driver_id`).catch(() => []);
        if (tg.length) { const ok = new Set(tg.map((x) => x.driver_id)); users = users.filter((u) => ok.has(u)); }
      }
    } else if (kind === "offer_accepted") {
      users = [rec.driver_id];
    } else if (kind) {
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
    const lug = (rec.luggage_large || rec.luggage_small) ? "🧳 " + (rec.luggage_large || 0) + " + " + (rec.luggage_small || 0) : "";
    const text = (l: Lang) => {
      const title = kind === "new_request" ? T(l, rec.is_subcontract ? "Nouvelle sous-traitance" : "Nouvelle demande")
        : kind === "request_updated" ? (mission ? `${T(l, "Mission modifiée")}${rec.booking_code ? " · " + rec.booking_code : ""}` : T(l, "Demande modifiée"))
        : kind === "offer_accepted" ? T(l, "Offre acceptée 🎉") : T(l, "Demande annulée");
      const veh = VEH[rec.vehicle_type] ? T(l, VEH[rec.vehicle_type]) : rec.vehicle_type;
      const extra = [veh, rec.passengers ? rec.passengers + " pax" : "", lug].filter(Boolean).join(" · ");
      const lead = kind === "offer_accepted" ? `${rec.booking_code || T(l, "Course")}${T(l, " est confirmée pour vous.")}`
        : changed.length ? T(l, "Modifié par le client : ") + [...new Set(changed.map((c) => T(l, c)))].join(", ") + "." : "";
      const body = [lead, route(rec, l), [when(rec, l), kind === "new_request" ? extra : ""].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
      return { title, body };
    };
    const langs = visible.length ? await langsOf(visible.map((t) => t.user_id)) : {};
    const byLang = { fr: kind ? text("fr") : null, en: kind ? text("en") : null };

    const shown = new Set(visible.map((t) => t.token));
    const msgs: any[] = visible.map((t) => ({
      to: t.token, ...(byLang[langs[t.user_id] || "fr"] as { title: string; body: string }), sound: "default", data: { ride_id: rec.id, kind }, channelId: "default",
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
