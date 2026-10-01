// 6bis-b5b : producteurs réellement appelés par l'écran, contre des
// attentes indépendantes. Sources de jeu : cadrage A.2 ter et reliques §8.
import { readFileSync } from 'node:fs';
import type { ArtifactDetail, GearSet, RelicDetail } from '../src/types';
import { evaluateursArtefactsFiche } from '../src/lib/artifactFiche';
import { AUCUNE_AURA_PROPRE, DEFAULT_DAMAGE_SETUP, artifactDamageProfile,
  computeTotalDamage, estPrisEnCharge, skillDamageProfile } from '../src/lib/damage';
import type { DegatsContext } from '../src/lib/artifactEvaluation';
import { computeStats } from '../src/lib/stats';
import { scoreDeReference } from '../src/lib/runeBuildOptim';
import { paireRepresentative, type ArtifactSearchParams } from '../src/lib/artifactOptim';
import { egal, ok, titre } from './outils';

export const BASE_FICHE = { hp: 10000, atk: 1000, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
export const SETUP_FICHE = { ...DEFAULT_DAMAGE_SETUP, critMode: 'normal' as const };
const profil = skillDamageProfile({
  id: 1, com2usId: 1, nom: 'Sort témoin', description: null, slot: 1, passif: false,
  aoe: false, cooldown: null, coups: 1, niveauMax: 1, formule: '1.0*{ATK}',
  scale: [], ameliorations: [], icone: null, effets: [],
});
if (!profil || !estPrisEnCharge(profil)) throw new Error('Le sort témoin doit être calculable');
export const DEGATS_FICHE: DegatsContext = {
  profile: profil, passifs: [], setup: SETUP_FICHE, element: null,
  critSiPlusRapide: false, bonusDegatsSelonVit: null, bonusDegatsStack: null,
  monsterWide: {}, bonusDegatsConditionnel: null, bonusDegatsSelonCr: null,
  bonusDegatsSelonDef: null, bonusSiAtqSeuil: null,
};
export const CONTEXTE_FICHE = { setup: SETUP_FICHE, element: null };
export const REF_FICHE = { degats: DEGATS_FICHE, damageSetup: SETUP_FICHE, exclusive: CONTEXTE_FICHE };
export function artFiche(id: number, code: number, value: number, subs: [number, number][] = []): ArtifactDetail {
  return { id, kind: 'element', element: 'wind', level: 15, rarity: 5,
    main: { code, value }, subs: subs.map(([code, value]) => ({ code, value })) };
}
export function relFiche(type: number, tranche: number, percent = 10): RelicDetail {
  return { id: 1, upgrade: 5, main: { code: 100, value: 8 }, unique: { type, tranche, percent } };
}
export function gearFiche(relic?: RelicDetail): GearSet {
  return { base: BASE_FICHE, runes: [], artifacts: [], relic };
}
export function producteursFiche(gear: GearSet) {
  return evaluateursArtefactsFiche(gear, 'degats_reels', AUCUNE_AURA_PROPRE, DEGATS_FICHE, CONTEXTE_FICHE, []);
}
const proche = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

export function testArtefactsFichePoints() {
  titre('Fiche — Bravoure, Éternité, Origine : points dans 218–221, par paire');
  for (const [nom, type, tranche, codeRef, pointsBruts] of [
    ['Bravoure', 8, 700, 102, 10], // 100 points ATQ × 10 %
    ['Éternité', 10, 1300, 101, 5], // 50 points DEF × 10 %
    ['Origine', 13, 1300, 101, 10], // 1000 points PV × 1 %
  ] as const) {
    const relic = relFiche(type, tranche);
    const gear = gearFiche(relic);
    const neutre = producteursFiche({ ...gear, relic: { ...relic, unique: undefined } });
    const actuel = [artFiche(10, 100, 1500, [[218, 1], [219, 10], [220, 10], [221, 10]])];
    const retenu = [artFiche(11, codeRef, 100, [[218, 1], [219, 10], [220, 10], [221, 10]])];
    const e = producteursFiche(gear);
    // Sans points : PV = 10800 + 2000 ; ATQ = 1200 ; DEF = 600 ; VIT = 115.
    // La paire portée ajoute 1500 PV, sans franchir de tranche de référence.
    const attenduActuel = 143 + 120 + 60 + 11.5;
    const attenduRetenuNeutre = 128 + (codeRef === 101 ? 130 : 120) + (codeRef === 102 ? 70 : 60) + 11.5;
    egal(e.brut(actuel), attenduActuel, `${nom} : portée sous la tranche, ${attenduActuel}`);
    egal(neutre.brut(retenu), attenduRetenuNeutre, `${nom} : témoin de mêmes principales, sans effet unique`);
    egal(e.brut(retenu), attenduRetenuNeutre + pointsBruts, `${nom} : cran supplémentaire augmenté de ${pointsBruts}, recalcul pour la paire`);
    egal(e.brut(retenu) - e.brut(actuel), attenduRetenuNeutre + pointsBruts - attenduActuel,
      `${nom} : écart à la paire portée = ${attenduRetenuNeutre + pointsBruts - attenduActuel}`);
    const stats = computeStats({ ...gear, artifacts: retenu });
    const cle = type === 8 ? 'atk' : type === 10 ? 'def' : 'hp';
    const points = BASE_FICHE[cle] / 10;
    // L'attente ajoute les points explicites, sans appeler apportExclusive.
    const attendus = stats.map((s) => s.key === cle ? { ...s, total: s.total + points } : s);
    const reel = computeTotalDamage(DEGATS_FICHE.profile, [], attendus, SETUP_FICHE,
      AUCUNE_AURA_PROPRE, null, artifactDamageProfile(retenu));
    ok(proche(e.reel!(retenu), reel), `${nom} : points dans le cran réel, une seule fois (${reel.toFixed(6)})`);
    egal(computeStats({ ...gear, artifacts: retenu }), stats, `${nom} : aucune mutation des stats de fiche`);
  }
}

export function testArtefactsFicheConqueteTenacite() {
  titre('Fiche — Conquête, Ténacité, paire représentative et note de production');
  const a = artFiche(20, 101, 100, [[219, 10]]);
  const d = artFiche(21, 102, 100, [[219, 10]]);
  for (const [nom, type] of [['Conquête', 2], ['Ténacité', 5]] as const) {
    const gear = gearFiche(relFiche(type, 700));
    const e = producteursFiche(gear);
    const sans = producteursFiche({ ...gear, relic: { ...gear.relic!, unique: undefined } });
    for (const arts of [[a], [d]]) {
      egal(e.brut(arts), sans.brut(arts), `${nom} : dégâts supplémentaires inchangés (${e.brut(arts)})`);
      const brut = arts[0] === a ? 130 : 120;
      const gain = nom === 'Conquête' && arts[0] === d ? 0.1 : 0;
      const attendu = (sans.reel!(arts) - brut) * (1 + gain) + brut;
      ok(proche(e.reel!(arts), attendu), `${nom} : cran réel ${attendu.toFixed(6)}, Additionnel hors DMG%`);
      ok(proche(e.representatif(arts), attendu), `${nom} : représentative = note réelle (${attendu.toFixed(6)})`);
      ok(proche(scoreDeReference('degats_reels', { ...gear, artifacts: arts }, REF_FICHE)!, attendu),
        `${nom} : note de référence indépendante du nouvel évaluateur = production`);
    }
    const ecart = e.reel!([d]) - e.reel!([a]);
    const ref = scoreDeReference('degats_reels', { ...gear, artifacts: [d] }, REF_FICHE)!
      - scoreDeReference('degats_reels', { ...gear, artifacts: [a] }, REF_FICHE)!;
    ok(proche(ecart, ref), `${nom} : écart réel à la portée ${ref.toFixed(6)}`);
    const ehp = evaluateursArtefactsFiche(gear, 'ehp', AUCUNE_AURA_PROPRE, DEGATS_FICHE, CONTEXTE_FICHE, []);
    egal(ehp.representatif([d]), scoreDeReference('ehp', { ...gear, artifacts: [d] }, REF_FICHE),
      `${nom} : témoin EHP inchangé, Ténacité déjà comptée`);
  }
}

export function testArtefactsFicheCache() {
  titre('Fiche — mutation à identifiant constant et raccordements écran');
  const gear = gearFiche(relFiche(2, 700));
  const arts = [artFiche(30, 102, 100)];
  const mutant = { ...gear, relic: { ...gear.relic!, unique: { type: 2, tranche: 700, percent: 20 } } };
  const e = producteursFiche(gear), m = producteursFiche(mutant);
  ok(m.reel!(arts) > e.reel!(arts), 'même identifiant, Conquête 10 → 20 % : note réévaluée');
  const sansSort = evaluateursArtefactsFiche(gear, 'degats_reels', AUCUNE_AURA_PROPRE, null, CONTEXTE_FICHE, []);
  egal(sansSort.reel, null, 'sort absent : cran réel indisponible, repli explicite conservé');
  const params: ArtifactSearchParams = { porteur: { element: 'wind', archetype: 'attack' }, inventaire: arts,
    equipes: [], principaleParSorte: {}, evaluer: e.representatif };
  egal(paireRepresentative(params).map((a) => a.id), [30], 'la recherche utilise le producteur de représentative');
  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(ecran.includes('const evaluer = evaluateursFiche.representatif;') && ecran.includes('const evaluerBrut = evaluateursFiche.brut;')
    && ecran.includes('const evaluerReel = evaluateursFiche.reel;'), 'les trois évaluateurs testés sont ceux de l’écran');
  ok(ecran.includes('[selected, objective, aurasPropresFiche, contexteDegatsArtefacts, contexteExclusive, combatStats]'),
    'mémo : fiche entière (effet unique compris), objectif, auras et tout le contexte');
  ok(ecran.includes('gainBrutParCoup: scoreRetenu - scoreActuel') && ecran.includes('evaluerDegats(actuels)')
    && ecran.includes('evaluerDegats(retenue)'), 'écart affiché : même évaluateur pour la portée et la retenue');
}
