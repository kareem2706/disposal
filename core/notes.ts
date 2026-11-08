// ════════════════════════════════════════════════════════════════
// Bleenr core — lecture des notes techniques d'une course (rides.notes)
// Partagé par le site (BleenrCore.*) et l'app iOS (src/core, copie de ce dossier).
// Logique pure : aucune dépendance au navigateur, à React ou à Supabase.
// ════════════════════════════════════════════════════════════════

/** Un trajet d'une course mixte (« Mixte: SEG1 | SEG2 | … » dans rides.notes). */
export type MixedSegment = {
  /** « A>B » (transfert) ou « Disposition » (mise à disposition) */
  type: string;
  /** true pour une mise à disposition */
  disp: boolean;
  time: string;
  from: string;
  to: string;
  /** durée d'une mise à disposition, ex. « 3h » */
  dur: string;
  date: string;
  pax: string;
  veh: string;
  note: string;
  flight: string;
  train: string;
  flight2: string;
  train2: string;
  paxName: string;
  paxTel: string;
  lugL: number;
  lugS: number;
};

/** Valeur d'un tag « |nom:valeur » dans les notes (vide si absent). */
export function noteTag(notes: string | null | undefined, tag: string): string {
  return (((notes || '').match(new RegExp('\\|' + tag + ':([^|]+)')) || [])[1] || '').trim();
}

/** Durée d'une mise à disposition (« Durée:3h » → « 3h »). */
export function disposalDuration(notes: string | null | undefined): string {
  return ((notes || '').match(/Durée:([^\s|,]+)/) || [])[1] || '';
}

/** Retire un éventuel préfixe d'heure « HH:MM: » d'une adresse. */
export function cleanAddr<T extends string | null | undefined>(addr: T): T {
  if (!addr) return addr;
  return addr.replace(/^\d{1,2}:\d{2}:/, '').trim() as T;
}

/**
 * Trajets d'une course mixte.
 * Format d'un trajet : « A>B@HH:MM:départ>arrivée(durée)|d:DATE|p:PAX|v:GAMME|lg:L/S|n:NOTE|fl:…|tr:…|pn:…|pt:… »
 * Les trajets sont séparés par « | » suivi de « A>B » ou « Disposition ».
 */
export function parseMixedNotes(notes: string | null | undefined): MixedSegment[] {
  if (!notes || notes.indexOf('Mixte:') < 0) return [];
  let raw = notes.replace(/^Mixte:\s*/, '');
  // Tags de la course (|pax: |tel: |flight: |train: …) : ne font pas partie du dernier trajet
  raw = raw.replace(/\|[a-z_]{3,}:[^|]*/g, '');
  const segs = raw.split(/\s*\|\s*(?=A>B|Disposition)/);
  const out: MixedSegment[] = [];
  for (let s of segs) {
    s = s.trim();
    // Retire « |k:valeur » du trajet et renvoie la valeur
    const take = (re: RegExp): string => {
      const m = s.match(re);
      if (!m) return '';
      s = s.replace(m[0], '');
      return m[1].trim();
    };
    // Même ordre d'extraction que l'ancienne version du site
    const date = take(/\|d:([^|]+)/);
    const flight = take(/\|fl:([^|]*)/);
    const train = take(/\|tr:([^|]*)/);
    const paxName = take(/\|pn:([^|]*)/);
    const paxTel = take(/\|pt:([^|]*)/);
    const flight2 = take(/\|fl2:([^|]*)/);
    const train2 = take(/\|tr2:([^|]*)/);
    let lugL = 0, lugS = 0;
    const lgm = s.match(/\|lg:([^|]*)/);
    if (lgm) { const lg = lgm[1].split('/'); lugL = parseInt(lg[0], 10) || 0; lugS = parseInt(lg[1], 10) || 0; s = s.replace(lgm[0], ''); }
    const note = take(/\|n:([^|]*)/);
    const pax = take(/\|p:([^|]+)/);
    const veh = take(/\|v:([^|]+)/);
    s = s.trim();
    // Heure : « A>B@08:00:départ>arrivée »
    let time = '';
    const at = s.indexOf('@');
    if (at > 0) {
      const typeRaw = s.slice(0, at).trim();
      const afterAt = s.slice(at + 1);
      const c = afterAt.indexOf(':', 5); // le « : » après « HH:MM »
      if (c > 0) { time = afterAt.slice(0, c).trim(); s = typeRaw + ':' + afterAt.slice(c + 1); }
    }
    const ci = s.indexOf(':');
    if (ci < 0) continue;
    const type = s.slice(0, ci).trim();
    let rest = s.slice(ci + 1).trim();
    let dur = '';
    const dm = rest.match(/\(([^)]+)\)/);
    if (dm) { dur = dm[1]; rest = rest.replace(dm[0], '').trim(); }
    const pts = rest.split('>');
    out.push({
      type, disp: type.toLowerCase().indexOf('disp') >= 0, time,
      from: (pts[0] || '').trim(), to: (pts[1] || '').trim(), dur, date, pax, veh, note,
      flight, train, flight2, train2, paxName, paxTel, lugL, lugS,
    });
  }
  return out;
}
