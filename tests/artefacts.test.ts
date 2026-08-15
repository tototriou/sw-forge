// Score et efficience d'un artéfact.
//
// ⚠️ Grave et invisible : le score est censé être **celui que le jeu affiche**.
// S'il dérive, rien ne le signale à l'écran — le joueur compare un nombre à
// celui de sa fiche in-game et conclut que l'app se trompe partout.

import { parseAccountInventory } from '../src/lib/importAccount';
import {
  artifactScore,
  artifactEfficiency,
  artifactRolls,
  maxRolls,
  isFullStack,
  ARTIFACT_SUB_MAX,
} from '../src/lib/artifacts';
import { ArtifactDetail } from '../src/types';
import { egal, ok, titre, ignore, exportReel } from './outils';

// Artéfact minimal, pour éprouver la formule sans dépendre d'un export.
const art = (subs: [number, number][], rarity = 5): ArtifactDetail => ({
  kind: 'element',
  element: 'light',
  level: 15,
  rarity,
  main: { code: 100, value: 1500 },
  subs: subs.map(([code, value]) => ({ code, value })),
});

export default function testArtefacts() {
  titre('Artéfacts — score et efficience');

  // ⚠️ LE point de calage : cet artéfact existe, et le jeu affiche **147** sur
  // sa fiche. C'est la seule vérification qui rattache toute la table de
  // dénominateurs à la réalité — si elle casse, le score n'est plus celui du
  // jeu, quoi que disent les autres.
  //   3/25 + 11/30 + 6/25 + 9/20 = 1,176667 → round(× 125) = 147
  const capture = art([
    [303, 3], // Dégâts infligés à la Lumière +3 %
    [308, 11], // Dégâts reçus de la Lumière −11 %
    [302, 6], // Dégâts infligés au Vent +6 %
    [219, 9], // Dégâts add. par 9 % de l'ATQ
  ]);
  egal(artifactScore(capture), 147, 'score = celui affiché par le jeu (147)');

  // Chaque ligne rapportée au plafond de SA stat, jamais à un plafond commun :
  // un artéfact aux 4 lignes au max vaut 4 × (1/1.6) × 100 / … — soit 250 %,
  // très au-dessus de 100. Le divisseur 1,6 cale 100 % sur « excellent », pas
  // sur « parfait », exactement comme le 2,8 des runes.
  const parfait = art([
    [219, ARTIFACT_SUB_MAX[219]],
    [220, ARTIFACT_SUB_MAX[220]],
    [303, ARTIFACT_SUB_MAX[303]],
    [308, ARTIFACT_SUB_MAX[308]],
  ]);
  ok(artifactEfficiency(parfait) > 100, 'quatre lignes au plafond dépassent 100 %');

  // ⚠️ Un code inconnu compte 0 et ne fait pas exploser le score : inventer un
  // dénominateur par défaut fausserait la note sans que rien ne le signale.
  egal(artifactScore(art([[9999, 50]])), 0, 'un code inconnu ne compte pas');

  // Les échelles sont propres à chaque code — c'est tout l'objet de la table.
  ok(
    ARTIFACT_SUB_MAX[218] < 2 && ARTIFACT_SUB_MAX[221] > 100,
    'les codes 218 et 221 ont leur propre échelle (1,5 et 200)'
  );

  // ⚠️ Plafond = proc max × 5 (le proc initial + les 4 améliorations). Avec 4,
  // la capture donnait 184 au lieu de 147 et 24 lignes d'un compte réel
  // dépassaient leur plafond. C'est LA constante qui cale toute la table.
  egal(ARTIFACT_SUB_MAX[223], 60, 'plafond = proc max × 5 (223 : 12 × 5)');
  egal(ARTIFACT_SUB_MAX[221], 200, 'idem sur une autre échelle (221 : 40 × 5)');

  // ⚠️ Les 5 propriétés sans fourchette relevée (203, 207, 211, 212, 213) ne
  // doivent PAS recevoir un plafond deviné : mieux vaut qu'elles comptent 0 que
  // de fausser un score avec une valeur inventée.
  egal(
    [203, 207, 211, 212, 213].filter((c) => ARTIFACT_SUB_MAX[c] != null),
    [],
    'aucun plafond inventé pour les propriétés non relevées'
  );

  // Rolls : somme des améliorations posées sur les substats.
  egal(
    artifactRolls(art([[219, 9]]) as ArtifactDetail),
    0,
    'aucun roll déclaré ⇒ 0 (et non NaN)'
  );
  egal([maxRolls(3), maxRolls(4), maxRolls(5)], [2, 3, 4], 'rolls au +15 par rareté');

  // ⚠️ Quad roll = les 4 améliorations sur UNE seule ligne. Il n'existe qu'en
  // légendaire : un héroïque qui concentre ses 3 rolls a un tirage parfait pour
  // SON rang, mais ce n'est pas un quad roll — les compter ensemble mélangerait
  // deux tirages incomparables.
  const quad = (rolls: number[], rarity: number): ArtifactDetail => ({
    ...art([[219, 9]], rarity),
    subs: rolls.map((r, i) => ({ code: 300 + i, value: 5, rolls: r })),
  });
  ok(isFullStack(quad([4, 0, 0, 0], 5)), 'légendaire, 4 rolls sur une ligne ⇒ full stack');
  ok(!isFullStack(quad([3, 1, 0, 0], 5)), 'légendaire, rolls éparpillés ⇒ non');
  ok(isFullStack(quad([3, 0, 0, 0], 4)), 'héroïque, ses 3 rolls groupés ⇒ full stack pour son rang');
  ok(
    maxRolls(4) !== 4,
    "un héroïque ne peut pas atteindre 4 rolls — d'où le filtre légendaire du panneau"
  );

  /* ---- Sur l'export réel, quand il est là ------------------------------- */

  const brut = exportReel();
  if (!brut) {
    ignore('cohérence sur un inventaire réel', 'export réel absent');
    return;
  }

  const { artifacts } = parseAccountInventory(JSON.parse(brut));
  ok(artifacts.length > 0, `inventaire réel lu (${artifacts.length} artéfacts)`);

  // Aucun code de substat ne doit manquer à la table : un code non couvert est
  // silencieusement ignoré au calcul, donc un score trop bas sans alerte.
  const inconnus = new Set<number>();
  for (const a of artifacts) {
    for (const s of a.subs) if (!ARTIFACT_SUB_MAX[s.code]) inconnus.add(s.code);
  }
  egal([...inconnus], [], 'tous les codes de substat ont un dénominateur');

  // ⚠️ La somme des rolls d'un artéfact monté au +15 vaut ce que sa rareté
  // distribue. C'est ce qui valide la lecture de `sec_effects[i][2]` : si
  // l'index changeait de sens, ce compte s'effondrerait.
  //
  // ⚠️ Ce n'est PAS une égalité stricte : une ligne **convertie** repart à zéro
  // roll sans que l'artéfact les récupère, d'où quelques pièces en dessous du
  // compte (12 sur 2 120 au relevé, soit 0,6 %). On vérifie donc la règle sur
  // l'écrasante majorité, et surtout qu'aucun artéfact ne DÉPASSE son quota —
  // ça, ce serait un index mal lu.
  const montes = artifacts.filter((a) => a.level >= 15 && maxRolls(a.rarity) > 0);
  const conformes = montes.filter((a) => artifactRolls(a) === maxRolls(a.rarity));
  ok(
    montes.length > 0 && conformes.length / montes.length > 0.98,
    `rolls = ceux de la rareté sur ${((conformes.length / montes.length) * 100).toFixed(1)} % des artéfacts au +15`
  );
  egal(
    montes.filter((a) => artifactRolls(a) > maxRolls(a.rarity)).length,
    0,
    'aucun artéfact ne dépasse le quota de rolls de sa rareté'
  );

  // Garde-fou de calibrage : sur un compte réel, l'efficience doit rester dans
  // une plage plausible. Un dénominateur cassé enverrait la médiane à 5 % ou à
  // 400 % sans qu'aucune autre vérification ne bronche.
  const effs = artifacts.map(artifactEfficiency).sort((a, b) => a - b);
  const mediane = effs[Math.floor(effs.length / 2)];
  ok(
    mediane > 40 && mediane < 100,
    `médiane d'efficience plausible (${mediane.toFixed(1)} %)`
  );
}
