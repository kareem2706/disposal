// Tests du core (npm test) — lancés aussi par GitHub Actions avant chaque mise en ligne
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMixedNotes, noteTag, disposalDuration, cleanAddr, luggageText, vehicleLabel, ymd, parseDay } from './index';

const MIXED =
  'Mixte: A>B@10:00:Gare du Midi, 1060 Saint-Gilles, Belgique>The Hotel Brussels, Bd de Waterloo 38, 1000 Bruxelles|d:2026-11-09|p:2|v:business|lg:2/1|fl:SN 3123|pn:Marie Dupont|pt:+32 470 12 34 56'
  + ' | Disposition@14:00:Grand-Place, 1000 Bruxelles(3h)|d:2026-11-09|p:2|v:business|n:Attendre devant l\'hôtel'
  + ' | A>B@08:00:Hotel la bourse>Brussels Airport, 1930 Zaventem|d:2026-11-10|p:1|v:van|tr:IC 1832|fl2:SN 1|tr2:THA 9'
  + '|pax:Karim Bakhtaoui|tel:0489|flight:SN 3123';

test('parseMixedNotes : nombre de trajets et types', () => {
  const s = parseMixedNotes(MIXED);
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => x.type), ['A>B', 'Disposition', 'A>B']);
  assert.deepEqual(s.map((x) => x.disp), [false, true, false]);
});

test('parseMixedNotes : transfert complet', () => {
  const [a] = parseMixedNotes(MIXED);
  assert.equal(a.time, '10:00');
  assert.equal(a.from, 'Gare du Midi, 1060 Saint-Gilles, Belgique');
  assert.equal(a.to, 'The Hotel Brussels, Bd de Waterloo 38, 1000 Bruxelles');
  assert.equal(a.date, '2026-11-09');
  assert.equal(a.pax, '2');
  assert.equal(a.veh, 'business');
  assert.equal(a.lugL, 2);
  assert.equal(a.lugS, 1);
  assert.equal(a.flight, 'SN 3123');
  assert.equal(a.paxName, 'Marie Dupont');
  assert.equal(a.paxTel, '+32 470 12 34 56');
});

test('parseMixedNotes : mise à disposition (durée, note)', () => {
  const d = parseMixedNotes(MIXED)[1];
  assert.equal(d.time, '14:00');
  assert.equal(d.from, 'Grand-Place, 1000 Bruxelles');
  assert.equal(d.to, '');
  assert.equal(d.dur, '3h');
  assert.equal(d.note, 'Attendre devant l\'hôtel');
});

test('parseMixedNotes : les tags de la course ne polluent pas le dernier trajet', () => {
  const c = parseMixedNotes(MIXED)[2];
  assert.equal(c.to, 'Brussels Airport, 1930 Zaventem');
  assert.equal(c.train, 'IC 1832');
  assert.equal(c.flight2, 'SN 1');
  assert.equal(c.train2, 'THA 9');
  assert.equal(c.flight, '');
});

test('parseMixedNotes : notes vides ou non mixtes', () => {
  assert.deepEqual(parseMixedNotes(null), []);
  assert.deepEqual(parseMixedNotes(''), []);
  assert.deepEqual(parseMixedNotes('Durée:3h |pax:Karim'), []);
});

test('parseMixedNotes : trajet sans heure', () => {
  const [a] = parseMixedNotes('Mixte: A>B:Bruxelles>Liège|d:2026-12-01');
  assert.equal(a.time, '');
  assert.equal(a.from, 'Bruxelles');
  assert.equal(a.to, 'Liège');
});

test('noteTag', () => {
  const n = 'Bonjour |pax:Karim Bakhtaoui|tel: 0489 |flight:SN 3123';
  assert.equal(noteTag(n, 'pax'), 'Karim Bakhtaoui');
  assert.equal(noteTag(n, 'tel'), '0489');
  assert.equal(noteTag(n, 'train'), '');
  assert.equal(noteTag(null, 'pax'), '');
});

test('disposalDuration', () => {
  assert.equal(disposalDuration('Attente Durée:4h |pax:X'), '4h');
  assert.equal(disposalDuration('rien'), '');
  assert.equal(disposalDuration(undefined), '');
});

test('cleanAddr', () => {
  assert.equal(cleanAddr('08:00:Gare du Midi'), 'Gare du Midi');
  assert.equal(cleanAddr('Gare du Midi'), 'Gare du Midi');
  assert.equal(cleanAddr(null), null);
});

test('luggageText', () => {
  assert.equal(luggageText(2, 1), '2 valises · 1 sac');
  assert.equal(luggageText(1, 0), '1 valise');
  assert.equal(luggageText(0, 3), '3 sacs');
  assert.equal(luggageText(0, 0), '');
  assert.equal(luggageText(null, undefined), '');
  assert.equal(luggageText('2', '1', true), '2 + 1');
});

test('vehicleLabel', () => {
  assert.equal(vehicleLabel('lowcost'), 'Economy');
  assert.equal(vehicleLabel('any'), 'Toute gamme');
  assert.equal(vehicleLabel('xyz'), 'xyz');
  assert.equal(vehicleLabel(null), '');
});

test('ymd / parseDay', () => {
  assert.equal(ymd(new Date(2026, 10, 9)), '2026-11-09');
  assert.equal(ymd(parseDay('2026-11-09')!), '2026-11-09');
  assert.equal(parseDay(''), null);
  assert.equal(parseDay('abc'), null);
});
