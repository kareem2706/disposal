// Supabase Edge Function: transport-status
// Statut en temps réel du vol ou du train d'une course (numéro saisi par le client à la création de la demande).
//   • Vols   : AeroDataBox (RapidAPI) — secret AERODATABOX_KEY (et AERODATABOX_HOST si autre que aerodatabox.p.rapidapi.com)
//   • Trains : iRail (SNCB, gratuit, sans clé) — trains passant par une gare belge
// Appel : POST { ride_id } avec la session de l'utilisateur (sb.functions.invoke). Réservé au client de la course,
// au chauffeur attribué (driver_id) et aux admins. Les numéros sont lus dans rides.notes (tags |flight: et |train:).
// Réponse : { items: [ { kind, number, ok, ... } ] } — un élément par numéro renseigné.
// Cache en mémoire (2 min vols, 1 min trains) pour ménager le quota du fournisseur de vols.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ADB_KEY = Deno.env.get("AERODATABOX_KEY") ?? "";
const ADB_HOST = Deno.env.get("AERODATABOX_HOST") ?? "aerodatabox.p.rapidapi.com";
const TZ = "Europe/Brussels";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Point = {
  place: string; code?: string; sched?: string; est?: string; delay?: number;
  terminal?: string; gate?: string; platform?: string; platformChanged?: boolean; belt?: string; cancelled?: boolean;
};
type Item = {
  kind: "flight" | "train"; number: string; ok: boolean; reason?: string; message?: string;
  label?: string; airline?: string; state?: "ok" | "delayed" | "cancelled" | "done" | "live" | "unknown"; statusText?: string;
  focus?: "dep" | "arr"; dep?: Point; arr?: Point; updatedAt?: string;
};

const tag = (n: string | null, t: string) => ((n || "").match(new RegExp("\\|" + t + ":([^|]*)")) || [])[1]?.trim() || "";
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const AIRPORT = /airport|aeroport|luchthaven|flughafen|aeropuerto|aeroporto|zaventem|\bbru\b|\bcrl\b/;
const STATION = /\bgare\b|station|bahnhof|stazione|estacion|\bhbf\b|centraal|\bmidi\b|\bzuid\b|eurostar|thalys|\btgv\b/;

// Mots significatifs d'un nom (gare / aéroport) retrouvés dans l'adresse de la course
const STOP = new Set(["gare", "station", "airport", "aeroport", "international", "de", "du", "des", "la", "le", "the", "of", "bruxelles", "brussel", "brussels"]);
function score(name: string, addr: string) {
  const a = norm(addr);
  const words = norm(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  let s = words.filter((w) => a.includes(w)).length;
  // « Bruxelles-Midi » ↔ « Gare du Midi, Bruxelles » : la ville seule compte peu
  if (!s && /bruxelles|brussel|brussels/.test(norm(name)) && /bruxelles|brussel|brussels/.test(a)) s = 0.5;
  return s;
}

const hhmm = (d: Date) => new Intl.DateTimeFormat("fr-BE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
const todayBxl = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); // AAAA-MM-JJ
const daysFromToday = (d: string) =>
  Math.round((Date.parse(d.slice(0, 10) + "T12:00:00Z") - Date.parse(todayBxl() + "T12:00:00Z")) / 86400000);

const cache = new Map<string, { t: number; v: Item }>();
async function cached(key: string, ttl: number, fn: () => Promise<Item>) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < ttl) return c.v;
  const v = await fn();
  if (v.ok || v.reason === "not_found") cache.set(key, { t: Date.now(), v });
  return v;
}

// ── Vols : AeroDataBox ────────────────────────────────────────────
const FLIGHT_STATUS: Record<string, [Item["state"], string]> = {
  Expected: ["ok", "Prévu"], CheckIn: ["ok", "Enregistrement"], Boarding: ["live", "Embarquement"],
  GateClosed: ["live", "Porte fermée"], Departed: ["live", "Décollé"], EnRoute: ["live", "En vol"],
  Approaching: ["live", "En approche"], Arrived: ["done", "Atterri"], Delayed: ["delayed", "Retardé"],
  Canceled: ["cancelled", "Annulé"], CanceledUncertain: ["cancelled", "Annulation probable"],
  Diverted: ["cancelled", "Dérouté"], Unknown: ["unknown", "Statut inconnu"],
};
function adbTime(t: any): Date | null {
  const s = t?.utc || "";
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}
function adbPoint(p: any): Point {
  const sched = adbTime(p?.scheduledTime);
  const est = adbTime(p?.revisedTime) || adbTime(p?.predictedTime) || adbTime(p?.runwayTime);
  const ap = p?.airport || {};
  return {
    place: ap.municipalityName || ap.shortName || ap.name || ap.iata || "—",
    code: ap.iata || ap.icao || "",
    sched: sched ? hhmm(sched) : undefined,
    est: est ? hhmm(est) : undefined,
    delay: sched && est ? Math.round((est.getTime() - sched.getTime()) / 60000) : undefined,
    terminal: p?.terminal || undefined, gate: p?.gate || undefined, belt: p?.baggageBelt || undefined,
  };
}
async function flightStatus(number: string, date: string, hint: string, focus: "dep" | "arr"): Promise<Item> {
  const base: Item = { kind: "flight", number, ok: false, focus };
  if (!ADB_KEY) return { ...base, reason: "not_configured", message: "Suivi des vols pas encore activé" };
  const r = await fetch(`https://${ADB_HOST}/flights/number/${encodeURIComponent(number)}/${date}?withAircraftImage=false&withLocation=false`, {
    headers: { "X-RapidAPI-Key": ADB_KEY, "X-RapidAPI-Host": ADB_HOST },
  });
  if (r.status === 204 || r.status === 404) return { ...base, reason: "not_found", message: "Vol introuvable à cette date" };
  if (!r.ok) return { ...base, reason: "provider", message: "Service des vols indisponible (" + r.status + ")" };
  const list: any[] = await r.json().catch(() => []);
  if (!Array.isArray(list) || !list.length) return { ...base, reason: "not_found", message: "Vol introuvable à cette date" };
  // Plusieurs tronçons : celui dont l'aéroport (arrivée ou départ selon la course) correspond à l'adresse
  const side = focus === "arr" ? "arrival" : "departure";
  const named = (f: any) => [f?.[side]?.airport?.name, f?.[side]?.airport?.municipalityName, f?.[side]?.airport?.iata].filter(Boolean).join(" ");
  let f = list.slice().sort((a, b) => score(named(b), hint) - score(named(a), hint))[0];
  if (!score(named(f), hint)) f = focus === "arr" ? list[list.length - 1] : list[0];
  const [state, text] = FLIGHT_STATUS[f.status] || ["unknown", f.status || "Statut inconnu"];
  const dep = adbPoint(f.departure), arr = adbPoint(f.arrival);
  const key = focus === "arr" ? arr : dep;
  let st = state, statusText = text;
  if ((state === "ok" || state === "live") && (key.delay ?? 0) >= 10) { st = "delayed"; statusText = text + " · retard " + key.delay + " min"; }
  else if (state === "ok" && key.delay != null && key.delay <= 0) statusText = "À l'heure";
  return {
    ...base, ok: true, label: f.number || number, airline: f.airline?.name || undefined,
    state: st, statusText, dep, arr, updatedAt: new Date().toISOString(),
  };
}

// ── Trains : iRail (SNCB) ─────────────────────────────────────────
function irailPoint(s: any, which: "dep" | "arr"): Point {
  const t = parseInt(s?.time || "0");
  const sched = which === "arr" && s?.scheduledArrivalTime ? parseInt(s.scheduledArrivalTime) : which === "dep" && s?.scheduledDepartureTime ? parseInt(s.scheduledDepartureTime) : t;
  const delaySec = parseInt((which === "arr" ? s?.arrivalDelay : s?.departureDelay) ?? s?.delay ?? "0") || 0;
  const cancelled = (which === "arr" ? s?.arrivalCanceled : s?.departureCanceled) === "1" || s?.canceled === "1";
  return {
    place: s?.stationinfo?.name || s?.station || "—",
    sched: sched ? hhmm(new Date(sched * 1000)) : undefined,
    est: sched ? hhmm(new Date((sched + delaySec) * 1000)) : undefined,
    delay: Math.round(delaySec / 60),
    platform: s?.platform && s.platform !== "?" ? String(s.platform) : undefined,
    platformChanged: s?.platforminfo?.normal === "0",
    cancelled,
  };
}
async function trainStatus(number: string, date: string, hint: string, focus: "dep" | "arr"): Promise<Item> {
  const base: Item = { kind: "train", number, ok: false, focus };
  const d = date.slice(8, 10) + date.slice(5, 7) + date.slice(2, 4); // JJMMAA
  const id = /^\d+$/.test(number) ? number : "BE.NMBS." + number;
  const r = await fetch(`https://api.irail.be/vehicle/?id=${encodeURIComponent(id)}&date=${d}&format=json&lang=fr&alerts=false`, {
    headers: { "User-Agent": "Bleenr/1.0 (https://bleenr.com; contact@bleenr.com)", Accept: "application/json" },
  });
  if (r.status === 404) return { ...base, reason: "not_found", message: "Train introuvable (réseau SNCB uniquement)" };
  if (!r.ok) return { ...base, reason: "provider", message: "Service des trains indisponible (" + r.status + ")" };
  const j: any = await r.json().catch(() => null);
  const stops: any[] = j?.stops?.stop || [];
  if (!stops.length) return { ...base, reason: "not_found", message: "Train introuvable (réseau SNCB uniquement)" };
  // Gare de la course : arrivée du passager (prise en charge à la gare) ou départ (dépose à la gare)
  let idx = -1, best = 0;
  stops.forEach((s, i) => { const v = score(s?.stationinfo?.name || s?.station || "", hint); if (v > best) { best = v; idx = i; } });
  const depStop = focus === "dep" && idx >= 0 ? stops[idx] : stops[0];
  const arrStop = focus === "arr" && idx >= 0 ? stops[idx] : stops[stops.length - 1];
  const dep = irailPoint(depStop, "dep"), arr = irailPoint(arrStop, "arr");
  const key = focus === "arr" ? arr : dep;
  const now = Date.now() / 1000;
  // Heure réelle (prévue + retard) dépassée de 2 min → considéré comme arrivé / parti
  const passed = (s: any, w: "dep" | "arr") => {
    const sch = parseInt((w === "arr" ? s?.scheduledArrivalTime : s?.scheduledDepartureTime) || s?.time || "0");
    const dl = parseInt((w === "arr" ? s?.arrivalDelay : s?.departureDelay) ?? s?.delay ?? "0") || 0;
    return sch > 0 && sch + dl + 120 < now;
  };
  const keyStop = focus === "arr" ? arrStop : depStop;
  let state: Item["state"] = "ok", statusText = "À l'heure";
  if (key.cancelled) { state = "cancelled"; statusText = "Supprimé"; }
  else if (focus === "arr" && (keyStop?.arrived === "1" || passed(keyStop, "arr"))) { state = "done"; statusText = "Arrivé" + ((key.delay ?? 0) > 0 ? " · +" + key.delay + " min" : ""); }
  else if (focus === "dep" && (keyStop?.left === "1" || passed(keyStop, "dep"))) { state = "done"; statusText = "Parti" + ((key.delay ?? 0) > 0 ? " · +" + key.delay + " min" : ""); }
  else if ((key.delay ?? 0) > 0) { state = "delayed"; statusText = "Retard " + key.delay + " min"; }
  else if (stops[0]?.left === "1" || passed(stops[0], "dep")) { state = "live"; statusText = "En circulation · à l'heure"; }
  return {
    ...base, ok: true, label: j?.vehicleinfo?.shortname || number, state, statusText, dep, arr,
    updatedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON || SB_SERVICE, Authorization: auth } });
    if (!u.ok) return json({ error: "unauthorized" }, 401);
    const user = await u.json();
    const { ride_id } = await req.json().catch(() => ({}));
    if (!ride_id) return json({ error: "ride_id manquant" }, 400);

    const H = { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE };
    const rr = await fetch(`${SB_URL}/rest/v1/rides?id=eq.${encodeURIComponent(ride_id)}&select=id,client_id,driver_id,status,notes,from_address,to_address,ride_date,trip_type`, { headers: H });
    const ride = (await rr.json())?.[0];
    if (!ride) return json({ error: "course introuvable" }, 404);
    let allowed = ride.client_id === user.id || ride.driver_id === user.id;
    if (!allowed) {
      const pr = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: H });
      allowed = (await pr.json())?.[0]?.role === "admin";
    }
    if (!allowed) return json({ error: "forbidden" }, 403);

    const from = ride.from_address || "", to = ride.to_address || "";
    const date = String(ride.ride_date || todayBxl()).slice(0, 10);
    const diff = daysFromToday(date);
    const items: Item[] = [];
    const wanted: Array<["flight" | "train", string, RegExp]> = [
      ["flight", tag(ride.notes, "flight").toUpperCase().replace(/[^A-Z0-9]/g, ""), AIRPORT],
      ["train", tag(ride.notes, "train").toUpperCase().replace(/[^A-Z0-9]/g, ""), STATION],
    ];
    for (const [kind, number, re] of wanted) {
      if (!number) continue;
      // Prise en charge à l'aéroport / la gare → on suit l'arrivée ; dépose → le départ
      const focus: "dep" | "arr" = re.test(norm(from)) || !re.test(norm(to)) ? "arr" : "dep";
      const hint = focus === "arr" ? from : to;
      if (diff > 1) { items.push({ kind, number, ok: false, focus, reason: "too_early", message: "Statut en temps réel disponible la veille du trajet" }); continue; }
      if (diff < -1) { items.push({ kind, number, ok: false, focus, reason: "past", message: "Trajet passé" }); continue; }
      try {
        items.push(kind === "flight"
          ? await cached(`f:${number}:${date}:${focus}:${norm(hint)}`, 120_000, () => flightStatus(number, date, hint, focus))
          : await cached(`t:${number}:${date}:${focus}:${norm(hint)}`, 60_000, () => trainStatus(number, date, hint, focus)));
      } catch (e) {
        items.push({ kind, number, ok: false, focus, reason: "provider", message: "Statut momentanément indisponible" });
        console.error(kind, number, e);
      }
    }
    return json({ items });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
