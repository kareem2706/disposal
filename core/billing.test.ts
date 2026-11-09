import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billingConfig, countryCode, offerNet, rideHtva, rideNetRevenue, pctText, onWayLock, inProgress, missionStage, ridePayout } from './index';

const S = {
  vat_rates_client_carrier: [{ country: 'BE', rate: 6 }, { country: 'FR', rate: 10 }],
  vat_rates_carrier_platform: [{ country: 'BE', rate: 21 }, { country: 'NL', rate: 0, reverse_charge: true }, { country: 'FR', rate: '' }],
  commission_rates: [{ country: 'BE', rate: 15 }, { country: 'FR', rate: '12.5' }, { country: 'LU', rate: '' }],
};

test('countryCode : nom, code, inconnu', () => {
  assert.equal(countryCode('Belgique'), 'BE');
  assert.equal(countryCode('pays-bas'), 'NL');
  assert.equal(countryCode('FR'), 'FR');
  assert.equal(countryCode('Atlantide'), 'BE');
  assert.equal(countryCode(null), 'BE');
});

test('billingConfig : commission par pays et replis', () => {
  const c = billingConfig(S);
  assert.equal(c.commFor('Belgique'), 15);
  assert.equal(c.commFor('France'), 12.5);
  assert.equal(c.commFor('Luxembourg'), 10);      // ligne vide → défaut 10 %
  assert.equal(c.commFor('Allemagne'), 15);       // pays absent → ligne Belgique
  assert.equal(billingConfig({}).commFor('BE'), 10);
  assert.equal(billingConfig({ platform_commission_rate: 18 }).commFor('FR'), 18); // ancienne valeur unique
});

test('billingConfig : TVA et autoliquidation', () => {
  const c = billingConfig(S);
  assert.equal(c.vatFor('France'), 10);
  assert.equal(c.vatFor('Belgique'), 6);
  assert.equal(billingConfig({}).vatFor('BE'), 6);
  assert.equal(c.rcFor('Pays-Bas'), true);
  assert.equal(c.cVatFor('Pays-Bas'), 0);
  assert.equal(c.cVatFor('Belgique'), 21);
  assert.equal(c.cVatFor('France'), 21);          // taux vide → 21 %
  assert.equal(billingConfig({ vat_reverse_charge_carrier_platform: true }).cVatFor('BE'), 0);
});

test('offerNet : commission et net au centime', () => {
  assert.deepEqual(offerNet(100, 15), { commission: 15, net: 85 });
  assert.deepEqual(offerNet(33.33, 15), { commission: 5, net: 28.33 });
  assert.deepEqual(offerNet(47.7, 12.5), { commission: 5.96, net: 41.74 });
  const { commission, net } = offerNet(123.45, 10);
  assert.equal(Math.round((commission + net) * 100) / 100, 123.45);
});

test('rideHtva / rideNetRevenue', () => {
  assert.equal(Math.round(rideHtva({ final_price: 106 }) * 100) / 100, 100);
  assert.equal(rideHtva({ final_price: 100, is_subcontract: true }), 100);
  assert.equal(rideHtva(null), 0);
  assert.equal(Math.round(rideNetRevenue({ final_price: 106 }, 15) * 100) / 100, 85);
  assert.equal(rideNetRevenue({ final_price: 106, payment_method: 'refunded' }, 15), 0);
  assert.equal(rideNetRevenue({ final_price: 106, is_subcontract: true }, 15), 0);
});

test('pctText', () => {
  assert.equal(pctText(12.5), '12,5');
  assert.equal(pctText('15'), '15');
  assert.equal(pctText(null), '0');
});

test('onWayLock : 4 h avant, paiement, modification', () => {
  const now = new Date(2026, 10, 9, 8, 0);
  const base = { status: 'confirmed', ride_date: '2026-11-09', ride_time: '12:00' };
  assert.equal(onWayLock(base, now), '');                                        // 12:00 − 4 h = 08:00 → disponible
  assert.equal(onWayLock({ ...base, ride_time: '12:30' }, now), 'En chemin dès 08:30');
  assert.equal(onWayLock({ ...base, ride_date: '2026-11-10' }, now), 'En chemin dès 10/11 08:00');
  assert.equal(onWayLock({ ...base, change_state: 'supplement' }, now), 'En attente du paiement du client');
  assert.equal(onWayLock({ ...base, change_state: 'to_review' }, now), 'Modification à traiter');
  assert.equal(onWayLock({ ...base, on_way_at: 'x' }, now), '');
  assert.equal(onWayLock({ ...base, status: 'waiting' }, now), '');
});

test('inProgress / missionStage', () => {
  assert.equal(inProgress({ status: 'active' }), true);
  assert.equal(inProgress({ status: 'confirmed', on_way_at: 'x' }), true);
  assert.equal(inProgress({ status: 'confirmed' }), false);
  assert.equal(missionStage({ status: 'confirmed' }), 0);
  assert.equal(missionStage({ status: 'confirmed', on_way_at: 'x' }), 1);
  assert.equal(missionStage({ status: 'active', on_way_at: 'x', pickup_at: 'y' }), 2);
  assert.equal(missionStage({ status: 'done' }), 3);
});

test('ridePayout : prestation TVAC − commission TVAC (comme la facture de commission)', () => {
  const cfg = billingConfig(S);
  // BE : 106 € TVAC → 100 HTVA ; commission 15 % = 15 + TVA 21 % = 18,15 → 87,85
  assert.deepEqual(ridePayout({ final_price: 106 }, cfg, 'Belgique'), { htva: 100, prestationTvac: 106, commissionTvac: 18.15, net: 87.85 });
  // NL : autoliquidation → commission sans TVA (15 % via la ligne BE de repli)
  assert.equal(ridePayout({ final_price: 106 }, cfg, 'NL').net, 91);
  // arrondis au centime : 85,40 € TVAC → 80,57 HTVA
  const p = ridePayout({ final_price: 85.4 }, cfg, 'BE');
  assert.equal(p.htva, 80.57); assert.equal(p.net, Math.round((p.prestationTvac - p.commissionTvac) * 100) / 100);
  assert.equal(ridePayout({ final_price: 106, is_subcontract: true }, cfg, 'BE').net, 0);
  assert.equal(ridePayout({ final_price: null }, cfg, 'BE').net, 0);
});
