// ════════════════════════════════════════════════════════════════
// Bleenr core — libellés et mises en forme communes (site + app iOS)
// ════════════════════════════════════════════════════════════════

/** Gammes de véhicule : code en base → libellé affiché. */
export const VEHICLE_LABELS: Record<string, string> = {
  lowcost: 'Economy',
  business: 'Business',
  van: 'Van',
  luxe: 'Luxe',
  bus: 'Bus',
  any: 'Toute gamme',
};

/** Libellé d'une gamme (le code tel quel s'il est inconnu, vide si absent). */
export function vehicleLabel(code: string | null | undefined): string {
  if (!code) return '';
  return VEHICLE_LABELS[code] || code;
}

/**
 * Bagages : « 2 valises · 1 sac » (vide si aucun).
 * short = true : « 2 + 1 ».
 */
export function luggageText(large: unknown, small: unknown, short?: boolean): string {
  const L = parseInt(String(large), 10) || 0;
  const S = parseInt(String(small), 10) || 0;
  if (!L && !S) return '';
  if (short) return L + ' + ' + S;
  return [L ? L + ' valise' + (L > 1 ? 's' : '') : '', S ? S + ' sac' + (S > 1 ? 's' : '') : ''].filter(Boolean).join(' · ');
}

/** Date locale → « AAAA-MM-JJ » (sans décalage UTC). */
export function ymd(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** « AAAA-MM-JJ » → Date locale à minuit (null si invalide). */
export function parseDay(d: string | null | undefined): Date | null {
  if (!d) return null;
  const [y, m, dd] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd);
}
