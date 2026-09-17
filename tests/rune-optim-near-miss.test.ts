// Diagnostic « quasi-succès » à l'appariement — voir spec/outils/optimizer/
// near-miss-appariement.md. `pairBuckets` retient, au moment où une paire
// EXPLORÉE échoue le test conjoint exact, la MEILLEURE déjà vue — par
// condition (satisfait tout SAUF k) et globalement (le plus petit écart
// relatif MAX, toutes conditions confondues).
//
// ⚠️ **Pourquoi `artifactBounds`, pas seulement des runes qui varient** :
// quand `guaranteedMin === guaranteed` ET `artFlatMax === artFlatMin`
// (aucun artéfact, un seul type de set sans bonus de stat — ce qu'un pool
// synthétique minimal donne naturellement), le test rapide `quickOk` est
// MATHÉMATIQUEMENT IDENTIQUE au test conjoint exact — tout ce qui échoue
// l'un échoue l'autre AVANT MÊME d'atteindre `computeStats`, donc rien
// n'atteint jamais le code de near-miss. Vérifié en construisant d'abord
// EXACTEMENT ce cas dégénéré (`explored: 0`, `nearMissByCondition: []`) —
// ce n'est pas un bug du mécanisme, c'est la conséquence directe de sa
// définition (voir son commentaire dans runeBuildOptim.ts : alimenté
// SEULEMENT par des paires qui ont déjà passé `quickOk`). Le déclencheur
// réel est l'écart entre l'estimation OPTIMISTE (`artFlatMax`, utilisée par
// `quickOk`) et ce qu'un apport RÉEL (`artifactBounds.possibles`) peut
// effectivement fournir — exactement le mécanisme documenté dans
// `pairBuckets` (« borne GLOBALE, pas garantie atteignable par CETTE paire
// précise »). Un compte réel a presque toujours cet écart (plusieurs sets/
// artéfacts en jeu) ; le reproduire ici demande de le construire
// explicitement.
//
// ⚠️ algo-verify s'applique : chaque valeur attendue ci-dessous est DÉRIVÉE
// À LA MAIN (voir les commentaires), puis CONFIRMÉE en exécutant le vrai
// moteur sur ce scénario précis avant d'écrire l'assertion — jamais
// l'inverse (coller ce que le moteur a rendu sans le re-vérifier soi-même).

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import { BuildRequirement, NearMiss, PairingProgress, SearchResult, searchBuilds } from '../src/lib/runeBuildOptim';
import { drivePairing } from '../src/workers/pairingDriver';
import { egal, ok, titre } from './outils';

function line(code: number, value: number): EffectLine {
  return { code, value };
}
function rune(id: number, slot: number, mainCode: number, mainValue: number, decoyHp: number): RuneDetail {
  return { id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: line(mainCode, mainValue), subs: [{ code: 1, value: decoyHp }] };
}

const BASE: BaseStats = { hp: 1000, atk: 100, def: 100, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export default async function testRuneOptimNearMiss() {
  titre('Optimizer · quasi-succès à l’appariement (near-miss)');

  // Emplacement 1 : 3 variantes de VIT (code 8) — 0, +5, +20 — chacune avec
  // une sous-stat PV DÉCROISSANTE (1000, 500, 0) pour empêcher
  // `pruneDominated` d'en éliminer deux sur trois (même piège déjà rencontré
  // dans tests/rune-optim.test.ts : sans ce leurre anti-corrélé, la variante
  // VIT la plus haute domine strictement les deux autres). Emplacements 2-6 :
  // une seule rune neutre chacun, rien à choisir — pour garder le nombre de
  // paires explorées PETIT et vérifiable à la main (3 combinaisons, pas 3⁶).
  //
  // Aucune rune ne touche ATQ : ATQ = 100 (base) TOUJOURS, quel que soit le
  // choix de runes — seul l'APPORT D'ARTÉFACT peut le faire bouger.
  function buildPool(): RuneDetail[] {
    const pool: RuneDetail[] = [];
    let id = 1;
    pool.push(rune(id++, 1, 8, 0, 1000));
    pool.push(rune(id++, 1, 8, 5, 500));
    pool.push(rune(id++, 1, 8, 20, 0));
    for (let slot = 2; slot <= 6; slot++) pool.push(rune(id++, slot, 8, 0, 500));
    return pool;
  }

  // minStats.spd = 110, minStats.atk = 115 — VIT total selon la variante de
  // l'emplacement 1 : 100 / 105 / 120. ATQ total TOUJOURS 100 + apport
  // d'artéfact. `artifactBounds.max` (utilisé par `quickOk`, OPTIMISTE) :
  // ATQ +20 ET VIT +15 EN MÊME TEMPS — jamais atteignable par un SEUL apport
  // réel (`possibles`), qui n'offre JAMAIS les deux à la fois :
  //   apport 1 { atk:+20, spd:+0 }  — comble ATQ (100+20=120 ≥ 115), jamais VIT
  //   apport 2 { atk:+0,  spd:+15 } — comble VIT (+15), jamais ATQ
  //   apport 3 { atk:+0,  spd:+0 }  — ne comble rien
  const requirement: BuildRequirement = { sets: [], minStats: { spd: 110, atk: 115 } };
  const artifactBounds = {
    max: { atk: 20, spd: 15 },
    min: {},
    possibles: [
      { atk: 20, spd: 0 },
      { atk: 0, spd: 15 },
      { atk: 0, spd: 0 },
    ],
  };

  // ── Dérivation À LA MAIN, par emplacement-1 × apport (3 × 3 = 9 essais,
  // dont 1 réussit — voir plus bas) ──
  //
  // Variante VIT=100 (emplacement 1 à 0) :
  //   apport 1 : ATQ 120 ✅, VIT 100 ✗ (manque 10)         → VIT isolé, manque 10
  //   apport 2 : ATQ 100 ✗ (manque 15), VIT 100+15=115 ✅  → ATQ isolé, manque 15
  //   apport 3 : ATQ 100 ✗ (manque 15), VIT 100 ✗ (manque 10) → aucun isolé
  // Variante VIT=105 (emplacement 1 à +5) :
  //   apport 1 : ATQ 120 ✅, VIT 105 ✗ (manque 5)          → VIT isolé, manque 5  ← LE PLUS PROCHE
  //   apport 2 : ATQ 100 ✗ (manque 15), VIT 105+15=120 ✅  → ATQ isolé, manque 15 (à égalité avec l'autre)
  //   apport 3 : ATQ 100 ✗ (manque 15), VIT 105 ✗ (manque 5) → aucun isolé
  // Variante VIT=120 (emplacement 1 à +20) :
  //   apport 1 : ATQ 120 ✅, VIT 120 ✅ → LES DEUX PASSENT, ok=true, VRAI CANDIDAT
  //   (les apports 2/3 ne sont même pas essayés, la boucle s'arrête au 1er succès)
  //
  // Attendu : 1 seul candidat trouvé (variante VIT=120, apport 1). Near-miss
  // VIT isolé = manque 5 (la variante +5 bat la variante à 0, manque 10) ;
  // near-miss ATQ isolé = manque 15 (identique sur les deux variantes qui
  // échouent, ATQ ne dépendant d'aucun choix de rune). Near-miss global :
  // écart relatif VIT (5/110 ≈ 0,0455) < écart relatif ATQ (15/115 ≈ 0,1304)
  // → le global doit être EXACTEMENT le near-miss VIT (manque 5), pas ATQ.
  const result = searchBuilds({ base: BASE, artifacts: [], pool: buildPool(), requirement, metric: 'eff', artifactBounds });

  egal(result.explored, 3, '3 paires explorées (une par variante de l’emplacement 1, les 5 autres emplacements figés)');
  egal(result.candidates.length, 1, 'exactement 1 candidat réel (VIT=120 + apport ATQ+20, seule combinaison qui satisfait tout à la fois)');

  const spdEntry = result.nearMissByCondition.find((e) => e.key === 'spd' && e.kind === 'min');
  const atkEntry = result.nearMissByCondition.find((e) => e.key === 'atk' && e.kind === 'min');
  ok(spdEntry != null, 'VIT a un near-miss isolé (satisfait ATQ, échoue seulement sur VIT — via l’apport qui comble ATQ)');
  ok(atkEntry != null, 'ATQ a un near-miss isolé (satisfait VIT, échoue seulement sur ATQ — via l’apport qui comble VIT)');
  egal(result.nearMissByCondition.length, 2, 'exactement 2 entrées — aucune troisième condition n’existe ici, rien de plus à voir');

  egal(spdEntry?.miss.shortfalls[0]?.shortfall, 5, 'le manque VIT retenu est 5 (variante +5), PAS 10 (variante à 0) — le meilleur des deux observés');
  egal(spdEntry?.miss.shortfalls.length, 1, 'le near-miss VIT ne porte QUE le manque VIT — ATQ était satisfait sur cette tentative précise');
  egal(atkEntry?.miss.shortfalls[0]?.shortfall, 15, 'le manque ATQ retenu est 15 — constant, ATQ ne dépend d’aucun choix de rune ici');

  ok(result.globalNearMiss != null, 'un near-miss global existe (au moins une tentative a atteint le test conjoint exact)');
  egal(result.globalNearMiss?.shortfalls.length, 1, 'le near-miss global le plus proche ne manque QUE d’une seule condition (VIT)');
  egal(result.globalNearMiss?.shortfalls[0]?.key, 'spd', 'le near-miss global est celui de VIT (écart relatif 5/110), pas celui d’ATQ (15/115, plus grand)');
  egal(result.globalNearMiss?.shortfalls[0]?.shortfall, 5, 'même manque que le near-miss VIT isolé — c’est la MÊME tentative qui gagne les deux classements ici');

  // ── Cas limite : aucune condition posée — rien à suivre, aucun near-miss
  // ne doit jamais apparaître (comportement dégénéré, pas une erreur). ──
  {
    const requirementVide: BuildRequirement = { sets: [], minStats: {} };
    const r = searchBuilds({ base: BASE, artifacts: [], pool: buildPool(), requirement: requirementVide, metric: 'eff' });
    egal(r.nearMissByCondition.length, 0, 'aucune condition posée → aucun near-miss par condition');
    egal(r.globalNearMiss, null, 'aucune condition posée → aucun near-miss global (tout candidat est d’office valide)');
  }

  // ── Cas limite : condition triviale, satisfaite par TOUT candidat exploré
  // (`candidates.length > 0`, jamais un seul échec du test conjoint) — le
  // near-miss reste calculé (coût nul, voir le cadrage) mais n’a
  // logiquement rien à y ajouter. ──
  {
    const requirementTriviale: BuildRequirement = { sets: [], minStats: { spd: 100 } }; // déjà garanti par la base seule
    const r = searchBuilds({ base: BASE, artifacts: [], pool: buildPool(), requirement: requirementTriviale, metric: 'eff' });
    ok(r.candidates.length > 0, 'condition triviale → des candidats existent réellement');
    egal(r.globalNearMiss, null, 'aucune paire explorée n’a jamais échoué le test conjoint → pas de near-miss global à rapporter');
    egal(r.nearMissByCondition.length, 0, 'même raison : rien n’a jamais échoué, donc rien à isoler par condition');
  }

  titre('Optimizer · quasi-succès — survit à un arrêt manuel (drivePairing)');

  // ⚠️ Vérifie spécifiquement le correctif de spec/outils/optimizer/
  // near-miss-appariement.md, §5 : `drivePairing` reconstruisait
  // `SearchResult` À LA MAIN sur `isStopped()` (3 champs seulement) — sans
  // correction, le near-miss accumulé jusqu'à l'arrêt aurait été perdu en
  // silence. Générateur FACTICE (pas un vrai `pairBuckets`) — la question
  // posée ici porte sur `drivePairing` seul (voir algo-verify, point 6 :
  // vérifier au bon étage), jamais sur la justesse de l'appariement lui-même
  // (couverte juste au-dessus). Un vrai `pairBuckets` ne céderait la main
  // qu'après CHECKPOINT_EVERY (500) paires — bien au-delà de ce qu'un test
  // unitaire doit construire pour vérifier cette seule plomberie.
  {
    function fakeNearMiss(shortfall: number): NearMiss {
      return { runeIds: [], stats: [], effTotal: 0, shortfalls: [{ key: 'spd', kind: 'min', requested: 110, actual: 110 - shortfall, shortfall }] };
    }
    function* fakeGen(): Generator<PairingProgress, SearchResult, void> {
      yield {
        phase: 'pairing',
        candidates: [],
        explored: 500,
        nearMissByCondition: [{ key: 'spd', kind: 'min', miss: fakeNearMiss(7) }],
        globalNearMiss: fakeNearMiss(7),
      };
      // Ne doit JAMAIS être atteint dans ce test — `isStopped` répond `true`
      // dès le premier pas, `drivePairing` doit retourner avant ce `return`.
      throw new Error('le générateur factice a été drainé au-delà du premier arrêt — isStopped() ignoré');
    }
    const out = await drivePairing(fakeGen(), () => true, () => {});
    egal(out.truncated, true, 'un arrêt manuel est toujours rapporté comme une troncature');
    egal(out.nearMissByCondition.length, 1, 'le near-miss PAR CONDITION accumulé jusqu’à l’arrêt survit, pas remis à zéro');
    egal(out.nearMissByCondition[0]?.miss.shortfalls[0]?.shortfall, 7, 'la valeur exacte accumulée survit, pas juste sa présence');
    ok(out.globalNearMiss != null, 'le near-miss GLOBAL accumulé jusqu’à l’arrêt survit aussi');
    egal(out.globalNearMiss?.shortfalls[0]?.shortfall, 7, 'même valeur exacte côté global');
  }
}
