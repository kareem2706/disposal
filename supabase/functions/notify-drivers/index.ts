// Supabase Edge Function: notify-drivers
// Appelée par un Database Webhook sur la table rides (INSERT + UPDATE).
// Envoie des notifications push (Expo) aux chauffeurs de l'app Bleenr Chauffeur :
//   • « Nouvelle demande »  → tous les chauffeurs (sauf le créateur) quand une demande est publiée
//   • « Demande modifiée »  → chauffeurs ayant fait une offre + chauffeur attribué, si date/heure/adresses/véhicule/pax changent
//   • « Demande annulée »   → chauffeurs ayant fait une offre + chauffeur attribué, quand la course passe à « cancelled »
//   • « Offre acceptée »    → le chauffeur dont l'offre est retenue (course confirmée ou en attente de paiement)
// Les chauffeurs dont l'offre a été refusée (autre chauffeur retenu) ne reçoivent plus rien sur cette demande.
// Chaque chauffeur peut couper chaque type dans son profil (push_tokens.prefs).

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPEN = ["waiting", "offers"];
const WATCHED = ["ride_date", "ride_time", "from_address", "to_address", "vehicle_type", "passengers", "trip_type"];
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
  if (rec.status !== "cancelled" && WATCHED.some((k) => String(rec[k] ?? "") !== String(old[k] ?? ""))) return "request_updated";
  return null;
}

Deno.serve(async (req) => {
  try {
    const p = await req.json();
    const rec: Ride = p.record, old: Ride | null = p.old_record ?? null;
    const kind = decide(p.type, rec, old);
    if (!kind) return new Response(JSON.stringify({ skipped: true }), { status: 200 });

    // Destinataires
    let users: string[] | null = null; // null = tous les chauffeurs
    if (kind === "offer_accepted") {
      users = [rec.driver_id];
    } else if (kind !== "new_request") {
      // Offres en cours ou acceptée (pas les offres refusées) + chauffeur attribué
      const offers = await rest(`offers?ride_id=eq.${rec.id}&status=in.(pending,accepted)&select=driver_id`);
      users = [...new Set([...(offers as any[]).map((o) => o.driver_id), rec.driver_id].filter(Boolean))];
      if (!users.length) return new Response(JSON.stringify({ skipped: "no recipients" }), { status: 200 });
    }
    const filter = users ? `&user_id=in.(${users.join(",")})` : "";
    let tokens: any[] = await rest(`push_tokens?select=token,user_id,prefs${filter}`);
    tokens = tokens.filter((t) => t.user_id !== rec.client_id && (t.prefs?.[kind] ?? true) !== false);
    if (!tokens.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    const title = kind === "new_request" ? (rec.is_subcontract ? "Nouvelle sous-traitance" : "Nouvelle demande")
      : kind === "request_updated" ? "Demande modifiée"
      : kind === "offer_accepted" ? "Offre acceptée 🎉" : "Demande annulée";
    const extra = [VEH[rec.vehicle_type] || rec.vehicle_type, rec.passengers ? rec.passengers + " pax" : ""].filter(Boolean).join(" · ");
    const lead = kind === "offer_accepted" ? `${rec.booking_code || "Course"} est confirmée pour vous.` : "";
    const body = [lead, route(rec), [when(rec), kind === "new_request" ? extra : ""].filter(Boolean).join(" · ")].filter(Boolean).join("\n");

    const msgs = tokens.map((t) => ({ to: t.token, title, body, sound: "default", data: { ride_id: rec.id, kind }, channelId: "default" }));
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
    // Jetons d'apps désinstallées : nettoyage
    if (dead.length) {
      await fetch(`${SB_URL}/rest/v1/push_tokens?token=in.(${dead.map((d) => `"${d}"`).join(",")})`, {
        method: "DELETE", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      });
    }
    return new Response(JSON.stringify({ kind, sent }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
