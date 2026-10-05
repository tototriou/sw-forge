// Libellé dérivé de propriété unique de relique (implementation-relique,
// B.5c bis) — « <effet> en fonction <stat> », affiché dans le sélecteur
// « Relique — propriété unique » (OptimizerSection.tsx) et, via
// `RelicDetailBox`/`formatRelicUnique`, sur la carte candidat.
//
// ⚠️ game-data-curation s'applique ici : `relicUniqueEffectLabel` assemble
// deux moitiés qui sont chacune des mots du jeu déjà curés dans
// `RELIC_UNIQUE` (les six fonctions CONQUETE/TENACITE/BRAVOURE/ETERNITE/
// ORIGINE/REGENERATION, et `stat.phrase`) — l'assemblage « en fonction » est
// le nôtre, pas une nouvelle mécanique déduite. Ce test vérifie que les 16
// types du corpus produisent bien 16 libellés DISTINCTS, sans « type
// inconnu » — contrat du lot B.5c bis.
//
// `formatRelicUsage` (B.5c ter) : compteur `n / 150` réintroduit dans
// `RelicDetailBox` — D3, ../spec/outils/optimizer/reliques.md § 7.

import { RELIC_MAX_INSTANCES, RELIC_UNIQUE, formatRelicUsage, relicUniqueEffectLabel } from '../src/lib/effects';
import { egal, ok, titre } from './outils';

export default function testRelicUniqueLabel() {
  titre('Relique — libellé dérivé de propriété unique (16 types)');

  const types = Object.keys(RELIC_UNIQUE).map(Number);
  egal(types.length, 16, 'le corpus RELIC_UNIQUE porte bien 16 types');

  const labels = types.map((t) => relicUniqueEffectLabel(t));

  ok(
    labels.every((l): l is string => typeof l === 'string' && l.length > 0),
    'aucun « type inconnu » : les 16 types connus rendent tous un libellé'
  );

  ok(new Set(labels).size === labels.length, 'les 16 libellés sont deux à deux DISTINCTS');

  // ⚠️ Mots du jeu attendus (cadrage B.5c bis, rév. 31) — vérifie que
  // l'assemblage utilise bien les mots exacts, pas une paraphrase.
  egal(relicUniqueEffectLabel(1), "DGTS infligés en fonction d'ATQ", 'Conquête · ATQ (type 1)');
  egal(relicUniqueEffectLabel(6), 'DGTS reçus en fonction du max des PV', 'Ténacité · PV (type 6)');
  egal(relicUniqueEffectLabel(7), 'ATQ en fonction de VIT', 'Bravoure · VIT (type 7)');
  egal(relicUniqueEffectLabel(12), 'DEF en fonction du max des PV', 'Éternité · PV (type 12)');
  egal(relicUniqueEffectLabel(13), "Max des PV en fonction d'ATQ", 'Origine · ATQ (type 13)');
  egal(
    relicUniqueEffectLabel(16),
    'Soins et boucliers accordés en fonction du max des PV',
    'Régénération · PV (type 16)'
  );

  egal(relicUniqueEffectLabel(999), undefined, 'un type hors corpus reste `undefined`, jamais deviné');

  titre('Relique — compteur d’occupation (n / 150, D3)');

  egal(RELIC_MAX_INSTANCES, 150, 'la constante nommée vaut 150 (valeur de jeu au 2026-09)');
  egal(formatRelicUsage(1), 'Équipée sur 1 exemplaire / 150', 'singulier à 1 exemplaire');
  egal(formatRelicUsage(96), 'Équipée sur 96 exemplaires / 150', 'pluriel au-delà de 1');
  egal(formatRelicUsage(150), 'Équipée sur 150 exemplaires / 150', 'au plafond : affiché, jamais opposé');
}
