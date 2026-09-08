// Les profils de pool synthétique nommés — piste 11b (§7 des extensions).
//
// ⚠️ **Ce test ne vérifie pas que le moteur a raison ; il vérifie qu'un
// profil tient encore ce qu'il PROMET.** Chaque grandeur de `attendu` a été
// mesurée pendant la calibration de 11b ; les relire à chaque exécution est
// la seule défense contre un profil qui dériverait en silence — et un profil
// qui dérive est pire qu'un profil absent, puisqu'un différentiel bâti
// dessus rendrait « aucune divergence » avec l'autorité d'un résultat.
//
// ⚠️ Ce qui est vérifié ici est exactement la liste que 11a exige de 11b, et
// dans cet ordre : complétude et MOTIF · régime · totalPairs · rang de la
// cible ET population. Le TEMPS est délibérément dehors — une machine plus
// lente ne doit pas faire échouer une vérification de justesse.
//
// ⚠️ `algo-verify` ne s'y applique pas, même doctrine que
// `diagnostic-harness.test.ts` : c'est de l'OUTILLAGE, et ce qui est en jeu
// n'est pas la justesse d'un algorithme mais la fidélité de ce que le
// harnais rapporte.

import { egal, ok, titre } from './outils';
import { executerHarnais } from '../scripts/lib/diagnosticHarness';
import {
  NOMS_PROFILS,
  PROFILS,
  configDuProfil,
  trouverProfil,
} from '../scripts/lib/diagnosticProfils';
import { PARALLEL_PAIRING_THRESHOLD } from '../src/workers/parallelPairing';

export default async function testDiagnosticProfils() {
  titre('Profils de pool synthétique nommés (11b) — chaque profil tient-il ce qu’il promet ?');

  /* ── Le catalogue lui-même ─────────────────────────────────────────── */

  ok(PROFILS.length > 0, 'au moins un profil existe');
  egal(
    new Set(NOMS_PROFILS).size,
    NOMS_PROFILS.length,
    'les noms de profil sont uniques — sans quoi `--profil=<nom>` en désignerait deux'
  );

  // ⚠️ « Aucun repli silencieux » (§4.4 règle 4) : un nom inconnu REFUSE en
  // listant ce qui existe, il ne retombe pas sur le premier profil.
  let refuse = false;
  try {
    trouverProfil('nom-qui-n-existe-pas');
  } catch (e) {
    refuse = e instanceof Error && e.message.includes(NOMS_PROFILS[0]);
  }
  ok(refuse, 'un nom de profil inconnu est REFUSÉ, et le refus nomme les profils qui existent');

  for (const profil of PROFILS) {
    // ⚠️ La cible est posée par CONSTRUCTION, jamais laissée à l'appelant :
    // un profil dont on oublierait de suivre la cible rendrait un résultat
    // sans `rang` ni `verdictBuildCible`, donc sans les éléments 1 et 3 de
    // l'oracle — un profil qui ne tient pas l'exigence n° 4 en l'annonçant.
    egal(
      configDuProfil(profil).suivre,
      profil.cible,
      `${profil.nom} — la cible est posée dans \`suivre\` par construction`
    );
    egal(profil.cible.length, 6, `${profil.nom} — la cible porte SIX runes (une par emplacement)`);
    ok(
      profil.axesVerifies.length > 0 && profil.limites.length > 0,
      `${profil.nom} — porte ses axes vérifiés ET ses limites, jamais l’un sans l’autre`
    );
  }

  /* ── Chaque profil, exécuté ────────────────────────────────────────── */

  for (const profil of PROFILS) {
    const a = profil.attendu;
    const r = await executerHarnais(configDuProfil(profil));

    // ── Exigences n° 1 et 2 : COMPLET, ou tronqué par QUOTA.
    egal(r.completude?.complet, a.complet, `${profil.nom} — complétude`);
    // ⚠️ Le motif est relu, pas déduit : c'est LE piège nommé par 11a. Un
    // profil à faible rendement n'atteint jamais son quota, et le run
    // retombe alors sur `maxMs` EN SILENCE — ce qui violerait l'exigence
    // n° 1 sans que rien ne le dise. Ici, un `maxMs` inattendu échoue.
    egal(
      r.completude?.motif,
      a.complet ? undefined : a.motif,
      `${profil.nom} — motif de troncature (jamais \`maxMs\` : ce serait une troncature par le TEMPS)`
    );
    ok(
      r.completude?.incoherence == null,
      `${profil.nom} — aucune incohérence complet/explored (§3.3)`
    );

    // ── Exigence n° 3 : le régime, et sa MARGE au seuil.
    egal(r.regime?.applique, a.regime, `${profil.nom} — régime appliqué`);
    egal(r.completude?.totalPairs, a.totalPairs, `${profil.nom} — totalPairs`);
    ok(r.regime?.force !== true, `${profil.nom} — le régime suit le seuil de PROD, il n’est pas forcé`);
    // ⚠️ « Franchement » d'un côté ou de l'autre, jamais à cheval : le
    // seuil est ce qu'un changement de configuration peut faire traverser,
    // et 11a exige de le vérifier PAR BRAS. Un facteur 2 est le minimum
    // pour que le bras comparé ne bascule pas sur une variation modeste.
    const marge =
      a.regime === 'parallele'
        ? a.totalPairs / PARALLEL_PAIRING_THRESHOLD
        : PARALLEL_PAIRING_THRESHOLD / a.totalPairs;
    ok(
      marge >= 2,
      `${profil.nom} — le régime est FRANCHEMENT ${a.regime} (×${marge.toFixed(1)} du seuil), pas à cheval sur les 100 M`
    );

    // ── Exigences n° 4 et 5 : la cible existe, et n'est pas au rang 1.
    const rang = r.appariementBuildCible?.rang;
    ok(rang != null, `${profil.nom} — le build cible est situé (rang + population disponibles)`);
    if (rang) {
      egal(rang.rang, a.rang, `${profil.nom} — rang de la cible`);
      egal(rang.population, a.population, `${profil.nom} — population des candidats collectés`);
      // ⚠️ L'exigence n° 5 n'est pas une préférence : une cible au rang 1
      // masque toute la sensibilité du classement à l'instant de coupe
      // (mesure I de 11a — verdict et rang identiques pendant que la
      // population variait de 32 %).
      ok(rang.rang > 1, `${profil.nom} — la cible n’est PAS au rang 1 (elle est #${rang.rang})`);
      ok(
        rang.rang <= rang.population,
        `${profil.nom} — le rang tient dans la population (#${rang.rang} / ${rang.population})`
      );
    }
  }
}
