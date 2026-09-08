// Diagnostic TEMPORAIRE : pour une liste d'ids de runes donnée, indique quel
// monstre de la box (unit_id/com2usId/nom) les porte ACTUELLEMENT selon
// unit_list, pour comprendre pourquoi excludedRuneIds() les exclut du pool
// d'un autre monstre qui, lui, les référence dans son deck de siège.
//
// Usage : rune-owner-diag.ts <export.json> <id1,id2,...>
//
// ⚠️ **POURQUOI CE SCRIPT SURVIT AU HARNAIS** (vérifié le 2026-09-08, §11.3
// des extensions — le sort des dix scripts G1). Il ne touche PAS le moteur :
// aucune de ses lignes n'appelle `prepareSearch`/`buildBuckets`/
// `pairBuckets`. Il répond à une question sur les DONNÉES DE COMPTE, pas sur
// le pipeline, et c'est exactement celle que le harnais laisse ouverte.
//
// Le harnais, lui, rend l'étage 0 (`admissibiliteBuildCible`) et sait dire
// qu'une rune est absente du pool d'entrée — mais sa formulation est une
// DISJONCTION, vérifiée sur la sortie réelle :
//
//   « rune #55195147924 ABSENTE du pool d'entrée — exclue par ailleurs
//     (portée par un autre monstre), OU venue d'un autre compte. »
//
// Ce script-ci FERME cette disjonction en NOMMANT le porteur. Relevé le
// 2026-09-08 sur les quatre runes que `--suivre` fait sortir en
// `ENTRÉE_INADMISSIBLE` pour Sonia deck 6 (tototriou) : Dr. Felix, Leah
// (deux runes) et Lushen. Le harnais ne peut pas produire cette grandeur —
// il ne voit que le pool qu'on lui donne, jamais la box qui l'a amputé.
// C'est donc le complément naturel d'un `ENTRÉE_INADMISSIBLE`, pas un
// doublon. ⚠️ Ne pas le supprimer « parce que le harnais couvre » :
// il couvre le CONSTAT d'absence, jamais sa CAUSE.
//
// ⚠️ Limite connue, laissée telle quelle : le bloc final (« Exemplaires de
// Sonia dans la box ») est CODÉ EN DUR sur « sonia » — résidu de
// l'investigation qui a produit ce script. Il reste informatif (il montre
// qu'un compte porte plusieurs exemplaires du même monstre, ce qui explique
// qu'un runage « cible » appartienne à un autre exemplaire), mais il ne suit
// PAS les identifiants passés en argument. Le rendre générique demanderait
// un argument de plus — hors du périmètre de la passe du §11.3, qui décide
// du SORT des scripts et ne les refactore pas.

import { readFileSync } from 'fs';
import { parseAccountSource, parseAccountBox } from '../src/lib/importAccount';

const [exportPath, idsArg] = process.argv.slice(2);
const ids = new Set(idsArg.split(',').map((s) => Number(s.trim())));

const raw = readFileSync(exportPath, 'utf8');
const data = parseAccountSource(raw)!;
const monstersRaw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const monstersList = Array.isArray(monstersRaw) ? monstersRaw : monstersRaw.monsters;
const nameByCom2us = new Map<number, string>(monstersList.map((m: any) => [m.com2usId, m.name]));

const { monsters: box, error } = parseAccountBox(data);
if (error) console.error('Erreur box :', error);

for (const id of ids) {
  const owners = box.filter((b) => b.gear?.runes.some((r) => r.id === id));
  console.log(`Rune ${id} : portée par ${owners.length} monstre(s) dans la box actuelle :`);
  for (const o of owners) {
    console.log(`  - ${nameByCom2us.get(o.com2usId) ?? '???'} (unitId=${o.unitId}, com2usId=${o.com2usId}, niveau ${o.level})`);
  }
  if (owners.length === 0) console.log('  (aucun — cette rune n\'est équipée sur AUCUN monstre de la box actuelle, elle devrait être en inventaire libre)');
}

// Sonia elle-même : combien d'exemplaires dans la box, quels com2usId ?
const soniaEntries = box.filter((b) => (nameByCom2us.get(b.com2usId) ?? '').toLowerCase().includes('sonia'));
console.log(`\nExemplaires de Sonia dans la box : ${soniaEntries.length}`);
for (const s of soniaEntries) {
  console.log(`  - unitId=${s.unitId}, com2usId=${s.com2usId}, niveau ${s.level}, runes=[${s.gear?.runes.map((r) => r.id).join(',')}]`);
}
