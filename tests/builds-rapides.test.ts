// Builds les plus rapides par combinaison de sets (Résumé des runes) — voir
// src/lib/buildsRapides.ts.
//
// Discipline de .claude/skills/algo-verify/SKILL.md : le calcul ne parcourt pas
// les 6-uplets de runes, il énumère des RÉPARTITIONS de rôles (4A+2B, joker…).
// Un oubli dans cet inventaire donnerait un build valide jamais trouvé, ou un
// build annoncé actif qui ne l'est pas en jeu. La référence ci-dessous énumère
// donc VRAIMENT tous les 6-uplets et juge chacun avec `activeSets`, sans rien
// devoir à l'inventaire testé.

import { RuneDetail } from '../src/types';
import { activeSets, INTANGIBLE_SET } from '../src/lib/effects';
import {
  BROKEN,
  ComboVitesse,
  buildsLesPlusRapides,
  comboValide,
  comparerBuilds,
  mesurerRunes,
} from '../src/lib/buildsRapides';
import { REGLAGE_BUILDS_RAPIDES_DEFAUT, lireReglageBuildsRapides } from '../src/hooks/useBuildsRapides';
import { egal, ok, titre } from './outils';
// Pool synthétique PARTAGÉ — voir scripts/lib/randomPool.ts.
import { mulberry32, randomPool } from '../scripts/lib/randomPool';

// Référence NAÏVE : la chaîne #1, #2… obtenue en énumérant tous les 6-uplets à
// chaque étape. Valable seulement sur de petits pools.
function reference(pool: RuneDetail[], combo: ComboVitesse, nombre: number): number[][] {
  const m = mesurerRunes(pool);
  const utilisees = new Set<number>();
  const chaine: number[][] = [];
  for (let k = 0; k < nombre; k++) {
    const parSlot: RuneDetail[][] = [[], [], [], [], [], []];
    for (const r of pool) if (!utilisees.has(r.id)) parSlot[r.slot - 1].push(r);
    let best: RuneDetail[] | null = null;
    for (const r0 of parSlot[0])
      for (const r1 of parSlot[1])
        for (const r2 of parSlot[2])
          for (const r3 of parSlot[3])
            for (const r4 of parSlot[4])
              for (const r5 of parSlot[5]) {
                const runes = [r0, r1, r2, r3, r4, r5];
                // Une seule rune Intangible par monstre : règle du jeu.
                if (runes.filter((r) => r.set === INTANGIBLE_SET).length > 1) continue;
                const actifs = activeSets(runes.map((r) => r.set));
                if (!actifs.includes(combo.quatre)) continue;
                if (combo.deux !== BROKEN && !actifs.includes(combo.deux)) continue;
                if (!best || comparerBuilds(runes, best, m) < 0) best = runes;
              }
    if (!best) break;
    for (const r of best) utilisees.add(r.id);
    chaine.push(best.map((r) => r.id));
  }
  return chaine;
}

// Une rune à la main : `vit` en secondaire, `eff` réglé par une ATQ% en plus.
function rune(id: number, slot: number, set: string, vit: number, atqPct = 10): RuneDetail {
  return {
    id, slot, set, rank: 6, rarity: 5, level: 15,
    main: { code: slot === 2 ? 2 : 1, value: 10 },
    subs: [{ code: 8, value: vit }, { code: 4, value: atqPct }],
  };
}

const ids = (runes: RuneDetail[]) => runes.map((r) => r.id);

export default function testBuildsRapides() {
  titre('Builds les plus rapides — différentiel contre l’énumération de tous les 6-uplets');
  const combos: ComboVitesse[] = [
    { quatre: 'swift', deux: 'will' },
    { quatre: 'violent', deux: 'shield' },
    { quatre: 'swift', deux: BROKEN },
    { quatre: 'violent', deux: BROKEN },
    { quatre: 'violent', deux: 'will' },
  ];
  // Peu de sets, Intangible compris : assez de pièces par set pour que les
  // combinaisons se forment, et des jokers en concurrence.
  const sets = ['swift', 'violent', 'will', 'shield', 'intangible'];
  let divergences = 0;
  let buildsCompares = 0;
  let avecJoker = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const pool = randomPool(mulberry32(seed), 4 + (seed % 2), sets);
    const calcul = buildsLesPlusRapides(pool, combos, 3);
    for (let c = 0; c < combos.length; c++) {
      const attendu = reference(pool, combos[c], 3);
      const recu = calcul[c].builds.map((b) => ids(b.runes));
      buildsCompares += attendu.length;
      avecJoker += calcul[c].builds.filter((b) => b.runes.some((r) => r.set === INTANGIBLE_SET)).length;
      if (JSON.stringify(recu) !== JSON.stringify(attendu)) {
        divergences++;
        if (divergences <= 3) console.log('  divergence', seed, combos[c], { recu, attendu });
      }
    }
  }
  egal(divergences, 0, 'aucune divergence sur 80 pools × 5 combinaisons × 3 rangs');
  // Le différentiel ne prouve rien s'il ne compare que des listes vides, ou
  // s'il ne passe que par l'un des deux chemins, avec ou sans joker.
  ok(buildsCompares > 300, `assez de builds comparés (${buildsCompares})`);
  ok(avecJoker > 50, `des builds avec Intangible comparés (${avecJoker})`);
  ok(buildsCompares - avecJoker > 50, `des builds sans Intangible comparés (${buildsCompares - avecJoker})`);

  titre('Builds les plus rapides — cas écrits à la main');
  // Base : 4 Swift + 2 Will par slot, VIT croissante avec l'id du slot.
  const base: RuneDetail[] = [];
  for (let s = 1; s <= 6; s++) {
    base.push(rune(s * 10 + 1, s, 'swift', 20));
    base.push(rune(s * 10 + 2, s, 'swift', 10));
    base.push(rune(s * 10 + 3, s, 'will', 15));
    base.push(rune(s * 10 + 4, s, 'will', 5));
  }
  const [sw] = buildsLesPlusRapides(base, [{ quatre: 'swift', deux: 'will' }], 5);
  const premier = sw.builds[0];
  // 4 slots Swift à 20, 2 slots Will à 15.
  egal(premier.vitRunes, 4 * 20 + 2 * 15, 'le #1 prend les meilleures runes : 4 × 20 + 2 × 15');
  egal(premier.bonus, 25, 'Swift actif : +25 (25 % de la base 100)');
  egal(premier.total, 100 + 110 + 25, 'total = base + runes + bonus');
  egal(ids(premier.runes).map((id) => Math.floor(id / 10)), [1, 2, 3, 4, 5, 6], 'runes rangées slot 1 → 6');
  const vus = new Set<number>();
  let disjoints = true;
  for (const b of sw.builds) for (const r of b.runes) {
    if (vus.has(r.id)) disjoints = false;
    vus.add(r.id);
  }
  ok(disjoints, 'aucune rune ne sert deux builds de la même combinaison');
  ok(
    sw.builds.every((b, i) => i === 0 || sw.builds[i - 1].total >= b.total),
    'les builds viennent du plus rapide au moins rapide'
  );

  // Une Swift et une Will par slot : après le #1 (4 Swift + 2 Will), il reste
  // 2 Swift et 4 Will — plus aucun Swift + Will possible.
  const unParSet: RuneDetail[] = [];
  for (let s = 1; s <= 6; s++) unParSet.push(rune(s * 10 + 1, s, 'swift', s), rune(s * 10 + 3, s, 'will', 7 - s));
  const [seul] = buildsLesPlusRapides(unParSet, [{ quatre: 'swift', deux: 'will' }], 5);
  egal(seul.builds.length, 1, 'on s’arrête quand plus aucun build ne se forme');

  const [violentWill] = buildsLesPlusRapides(base, [{ quatre: 'violent', deux: 'will' }], 5);
  egal(violentWill.builds.length, 0, 'combinaison impossible : liste vide, sans erreur');

  // Joker : la meilleure rune du slot 3 est une Intangible à 40.
  const avecJ = [...base, rune(99, 3, INTANGIBLE_SET, 40)];
  const [j] = buildsLesPlusRapides(avecJ, [{ quatre: 'swift', deux: 'will' }], 1);
  ok(ids(j.builds[0].runes).includes(99), 'une Intangible plus rapide complète le set');
  egal(j.builds[0].bonus, 25, 'Swift complété par le joker : bonus compris');

  // Deux Intangible très rapides : une seule peut servir.
  const deuxJ = [...base, rune(98, 5, INTANGIBLE_SET, 60), rune(97, 6, INTANGIBLE_SET, 60)];
  const [broken] = buildsLesPlusRapides(deuxJ, [{ quatre: 'swift', deux: BROKEN }], 1);
  egal(
    broken.builds[0].runes.filter((r) => r.set === INTANGIBLE_SET).length,
    1,
    'jamais deux Intangible dans un build'
  );

  // Broken : 3 Swift + joker + deux runes de sets INCOMPLETS n'active pas
  // Swift. Les runes rapides sont Violent et Shield, une seule de chaque.
  const piege: RuneDetail[] = [
    rune(1, 1, 'swift', 10), rune(2, 2, 'swift', 10), rune(3, 3, 'swift', 10),
    rune(4, 4, INTANGIBLE_SET, 10), rune(5, 5, 'violent', 50), rune(6, 6, 'shield', 50),
    rune(7, 4, 'swift', 1), rune(8, 5, 'will', 1), rune(9, 6, 'will', 1),
  ];
  const [p] = buildsLesPlusRapides(piege, [{ quatre: 'swift', deux: BROKEN }], 1);
  const actifs = activeSets(p.builds[0].runes.map((r) => r.set));
  ok(actifs.includes('swift'), 'le build retenu active vraiment Swift');
  ok(
    !ids(p.builds[0].runes).includes(5) || !ids(p.builds[0].runes).includes(4),
    'pas de 3 Swift + joker + deux sets incomplets'
  );

  titre('Builds les plus rapides — combinaisons valides');
  ok(comboValide({ quatre: 'swift', deux: 'will' }), 'Swift + Will');
  ok(comboValide({ quatre: 'violent', deux: BROKEN }), 'Violent + Broken');
  ok(!comboValide({ quatre: 'will', deux: 'swift' }), 'un set 2 pièces ne se met pas en 4');
  ok(!comboValide({ quatre: 'swift', deux: INTANGIBLE_SET }), 'Intangible ne se vise pas');
  ok(!comboValide({ quatre: 'swift', deux: 'violent' }), 'deux sets 4 pièces : impossible');
  ok(!comboValide(null), 'rien');

  titre('Builds les plus rapides — relecture du réglage');
  egal(lireReglageBuildsRapides(null), REGLAGE_BUILDS_RAPIDES_DEFAUT, 'rien d’écrit : le défaut');
  egal(lireReglageBuildsRapides('pas du json'), REGLAGE_BUILDS_RAPIDES_DEFAUT, 'texte cassé : le défaut');
  egal(lireReglageBuildsRapides('null'), REGLAGE_BUILDS_RAPIDES_DEFAUT, 'null : le défaut');
  egal(
    lireReglageBuildsRapides(
      JSON.stringify({
        combos: [
          { quatre: 'swift', deux: 'will' },
          { quatre: 'swift', deux: 'will' },
          { quatre: 'will', deux: 'swift' },
          { quatre: 'violent', deux: BROKEN, extra: 1 },
        ],
        nombre: 99,
      })
    ),
    { combos: [{ quatre: 'swift', deux: 'will' }, { quatre: 'violent', deux: BROKEN }], nombre: 10 },
    'combinaisons invalides et doublons écartés, nombre borné à 10'
  );
  egal(lireReglageBuildsRapides('{"combos":[],"nombre":0}'), { combos: [], nombre: 1 }, 'aucune combinaison : liste vide gardée, nombre au moins 1');
}
