// ════════════════════════════════════════════════════════════════
// Bleenr core — statuts et étapes d'une mission
// (les mêmes règles sont appliquées par le serveur : trigger des étapes de mission)
// ════════════════════════════════════════════════════════════════

export type RideStatusLike = {
  status?: string | null;
  ride_date?: string | null;
  ride_time?: string | null;
  on_way_at?: string | null;
  pickup_at?: string | null;
  change_state?: string | null;
};

/** Statuts d'une course, dans l'ordre de son cycle de vie. */
export const RIDE_STATUSES = ['waiting', 'offers', 'pending_payment', 'confirmed', 'active', 'done', 'cancelled'] as const;
/** « En chemin » possible au plus tôt N heures avant la prise en charge. */
export const ON_WAY_LEAD_HOURS = 4;

/** Course en cours : active, ou confirmée avec le chauffeur en route. */
export function inProgress(r: RideStatusLike): boolean {
  return r.status === 'active' || (r.status === 'confirmed' && !!r.on_way_at);
}

/** Étape de la mission : 0 à venir, 1 en chemin, 2 passager pris en charge, 3 terminée. */
export function missionStage(r: RideStatusLike): 0 | 1 | 2 | 3 {
  return r.status === 'done' ? 3 : r.pickup_at ? 2 : r.on_way_at ? 1 : 0;
}

/**
 * Pourquoi le bouton « En chemin » est bloqué (vide s'il est disponible) :
 * paiement d'un supplément en attente, modification à traiter, ou trop tôt (plus de 4 h avant).
 */
export function onWayLock(r: RideStatusLike, now: Date = new Date()): string {
  if (r.on_way_at || r.status !== 'confirmed') return '';
  if (r.change_state === 'supplement') return 'En attente du paiement du client';
  if (r.change_state) return 'Modification à traiter';
  if (!r.ride_date) return '';
  // Date locale construite champ par champ (pas d'analyse de chaîne : identique sur tous les moteurs JS)
  const [y, mo, d] = String(r.ride_date).slice(0, 10).split('-').map(Number);
  const [h, mi] = String(r.ride_time || '00:00').slice(0, 5).split(':').map(Number);
  const start = new Date(y, mo - 1, d, h || 0, mi || 0, 0);
  const from = new Date(start.getTime() - ON_WAY_LEAD_HOURS * 3600000);
  if (now >= from) return '';
  const p2 = (n: number) => String(n).padStart(2, '0');
  const same = from.toDateString() === now.toDateString();
  return 'En chemin dès ' + (same ? '' : p2(from.getDate()) + '/' + p2(from.getMonth() + 1) + ' ') + p2(from.getHours()) + ':' + p2(from.getMinutes());
}
