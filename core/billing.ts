// ════════════════════════════════════════════════════════════════
// Bleenr core — règles de facturation (Admin › Facturation, table billing_settings)
// Taux par pays : TVA client → transporteur, TVA transporteur → Bleenr (ou autoliquidation),
// commission Bleenr. Les montants réellement encaissés sont calculés par le serveur ;
// ces fonctions servent à l'affichage (offre, revenus, factures) côté site et app iOS.
// ════════════════════════════════════════════════════════════════

/** TVA appliquée aux paiements des clients (transport de personnes, Belgique). */
export const TVA_RATE = 0.06;
/** Commission Bleenr par défaut (%) si rien n'est configuré. */
export const DEFAULT_COMMISSION = 10;
/** TVA transporteur → Bleenr par défaut (%). */
export const DEFAULT_PLATFORM_VAT = 21;

/** Pays proposés dans Admin › Facturation : [code, nom]. */
export const BILLING_COUNTRIES: [string, string][] = [
  ['BE', 'Belgique'], ['FR', 'France'], ['NL', 'Pays-Bas'], ['LU', 'Luxembourg'], ['DE', 'Allemagne'],
  ['ES', 'Espagne'], ['IT', 'Italie'], ['PT', 'Portugal'], ['AT', 'Autriche'], ['IE', 'Irlande'],
  ['DK', 'Danemark'], ['SE', 'Suède'], ['FI', 'Finlande'], ['PL', 'Pologne'], ['CZ', 'Tchéquie'],
  ['GR', 'Grèce'], ['CH', 'Suisse'], ['GB', 'Royaume-Uni'], ['MC', 'Monaco'],
];

/** Nom (« Belgique ») ou code (« BE ») → code ; inconnu ou vide → « BE ». */
export function countryCode(country: string | null | undefined): string {
  if (country) {
    const c = String(country);
    const m = BILLING_COUNTRIES.find(([k, n]) => n.toLowerCase() === c.toLowerCase() || k === c);
    if (m) return m[0];
  }
  return 'BE';
}

export type RateRow = { country: string; rate?: number | string | null; reverse_charge?: boolean };
export type BillingSettings = {
  vat_rates_client_carrier?: RateRow[] | null;
  vat_rates_carrier_platform?: RateRow[] | null;
  vat_rate_carrier_platform?: number | string | null;
  vat_reverse_charge_carrier_platform?: boolean | null;
  commission_rates?: RateRow[] | null;
  platform_commission_rate?: number | string | null;
  [k: string]: unknown;
};

/** TVA transporteur → Bleenr par pays (repli sur l'ancienne valeur unique, Belgique). */
export function platformVatList(s: BillingSettings): RateRow[] {
  if (Array.isArray(s.vat_rates_carrier_platform) && s.vat_rates_carrier_platform.length) return s.vat_rates_carrier_platform;
  return [{ country: 'BE', rate: s.vat_rate_carrier_platform != null ? s.vat_rate_carrier_platform : '', reverse_charge: !!s.vat_reverse_charge_carrier_platform }];
}

/** Commission Bleenr par pays (repli sur l'ancienne valeur unique, Belgique). */
export function commissionList(s: BillingSettings): RateRow[] {
  if (Array.isArray(s.commission_rates) && s.commission_rates.length) return s.commission_rates;
  return [{ country: 'BE', rate: s.platform_commission_rate != null ? s.platform_commission_rate : '' }];
}

const pick = (list: RateRow[], country: string | null | undefined): RateRow | null => {
  const code = countryCode(country);
  return list.find((r) => r.country === code) || list.find((r) => r.country === 'BE') || list[0] || null;
};
const filled = (v: unknown) => v !== '' && v != null;

export type BillingConfig = {
  /** TVA client → transporteur (%), selon le pays de la fleet */
  vatFor(country?: string | null): number;
  /** Commission Bleenr (%), selon le pays de la fleet */
  commFor(country?: string | null): number;
  /** Autoliquidation sur la facture de commission, selon le pays de la fleet */
  rcFor(country?: string | null): boolean;
  /** TVA transporteur → Bleenr (%) ; 0 en autoliquidation */
  cVatFor(country?: string | null): number;
};

/** Règles de facturation tirées de billing_settings. */
export function billingConfig(s: BillingSettings | null | undefined, defaultClientVat = TVA_RATE * 100): BillingConfig {
  s = s || {};
  const vatClient = Array.isArray(s.vat_rates_client_carrier) ? s.vat_rates_client_carrier : [];
  const vatPlat = platformVatList(s);
  const comm = commissionList(s);
  return {
    vatFor: (country) => { const h = pick(vatClient, country); return h ? parseFloat(String(h.rate)) : defaultClientVat; },
    commFor: (country) => { const h = pick(comm, country); return h && filled(h.rate) ? parseFloat(String(h.rate)) : DEFAULT_COMMISSION; },
    rcFor: (country) => { const h = pick(vatPlat, country); return !!(h && h.reverse_charge); },
    cVatFor: (country) => {
      const h = pick(vatPlat, country);
      if (!h) return DEFAULT_PLATFORM_VAT;
      return h.reverse_charge ? 0 : filled(h.rate) ? parseFloat(String(h.rate)) : DEFAULT_PLATFORM_VAT;
    },
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Offre d'un chauffeur : commission Bleenr et montant net reçu (HTVA), arrondis au centime. */
export function offerNet(priceHtva: number, commissionPct: number): { commission: number; net: number } {
  const commission = Math.round(priceHtva * commissionPct) / 100;
  return { commission, net: round2(priceHtva - commission) };
}

/** Montant HTVA d'une course : prix payé ÷ (1 + TVA) ; une sous-traitance est déjà HTVA. */
export function rideHtva(r: { final_price?: number | string | null; is_subcontract?: boolean | null } | null | undefined): number {
  const p = parseFloat(String(r && r.final_price)) || 0;
  return r && r.is_subcontract ? p : p / (1 + TVA_RATE);
}

/** Revenu net d'une course terminée pour le chauffeur (0 si remboursée ou sous-traitance). */
export function rideNetRevenue(
  r: { final_price?: number | string | null; is_subcontract?: boolean | null; payment_method?: string | null },
  commissionPct: number,
): number {
  if (r.payment_method === 'refunded' || r.is_subcontract) return 0;
  return rideHtva(r) * (1 - commissionPct / 100);
}

/** Pourcentage affiché « 12,5 » (arrondi à 2 décimales, virgule). */
export function pctText(v: unknown): string {
  const n = Math.round((parseFloat(String(v)) || 0) * 100) / 100;
  return String(n).replace('.', ',');
}

const r2 = (v: number) => Math.round(((v || 0) + Number.EPSILON) * 100) / 100;

/**
 * Versement d'une course à la flotte (Stripe Connect), mêmes règles et arrondis que la facture de
 * commission (Admin › Facturation) : prestation TVAC − commission Bleenr TVAC.
 * Sous-traitance ou prix vide : rien à verser.
 */
export function ridePayout(
  r: { final_price?: number | string | null; is_subcontract?: boolean | null },
  cfg: BillingConfig,
  fleetCountry?: string | null,
): { htva: number; prestationTvac: number; commissionTvac: number; net: number } {
  if (!r || r.is_subcontract) return { htva: 0, prestationTvac: 0, commissionTvac: 0, net: 0 };
  const htva = r2(rideHtva(r));
  const prestationTvac = r2(htva + r2(htva * cfg.vatFor(fleetCountry) / 100));
  const cHt = r2(htva * cfg.commFor(fleetCountry) / 100);
  const commissionTvac = r2(cHt + r2(cHt * cfg.cVatFor(fleetCountry) / 100));
  return { htva, prestationTvac, commissionTvac, net: Math.max(0, r2(prestationTvac - commissionTvac)) };
}
