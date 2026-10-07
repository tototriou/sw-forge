// La résolution de l'équipement par build et le
// classement résolu, extraits de l'écran (`resoudreEquipement`, `affichees`,
// OptimizerSection.tsx) en deux producteurs que le CLI appelle aussi :
// `entreeResolutionDuBuild` (relicQueue.ts) et `classementResolu`
// (artifactQueue.ts).
//
// Référence de l'extraction : `entreeResolutionAvant`, copie FIGÉE de
// `entreeResolution` (scripts/lib/relicDifferentiel.ts) au commit 7905df36,
// elle-même copie TEL QUEL de l'assemblage d'avant de l'écran
// (`faireParamsArtefacts` + `resoudreEquipement`). Le
// différentiel passe par le producteur partagé : la référence vit donc ici.
// Le nouveau producteur doit rendre, candidat par candidat, le même
// `ResultatArtefacts` sur le corpus écrit à la main (`CORPUS_5A`),
// avec et sans dimension relique, pour chaque régime — et le différentiel
// (`resoudreCandidat`) aussi, sur ce corpus sans buff ni verrou.

import { readFileSync } from 'node:fs';
import { ArtifactArchetype, ArtifactDetail, ElementKey, RelicDetail } from '../src/types';
import { RelicContext } from '../src/lib/relicOptim';
import { BuildCandidate, OptionsDeClassement, SearchParams, aurasPropresParRunes, conditionsPaireFixePosees, optionsDeClassement, respecteConditionsPaireFixe, scoreDuCandidat, searchBuilds, sortCandidates } from '../src/lib/runeBuildOptim';
import { ResultatArtefacts, classementResolu, cleBuild } from '../src/lib/artifactQueue';
import { EntreeResolution, entreeResolutionDuBuild, etatReliqueDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { ReglagesDifferentiel, maxStatsActifsDe, regimeDe, resoudreCandidat, runesDe } from '../scripts/lib/relicDifferentiel';
import { DEFAULT_DAMAGE_SETUP, aurasPropresDesRunes } from '../src/lib/damage';
import { StatRow, computeStats, statsParPaire } from '../src/lib/stats';
import { ArtifactSearchParams } from '../src/lib/artifactOptim';
import { evaluerPourRegime } from '../src/lib/artifactEvaluation';
import { CORPUS_5A } from './relic-search.test';
import { DEGATS_FICHE } from './artifact-fiche.test';
import { egal, ok, titre } from './outils';

const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };

// Un petit inventaire d'artéfacts éligibles (fire / attack), pour que
// `chercherPaires` ait de vraies paires à classer : principales ATQ, DEF, PV
// et une ligne 219 (dégâts supplémentaires) qui ne sert qu'en « Dégâts réels ».
function art(id: number, kind: 'element' | 'archetype', code: number, value: number, subs: [number, number][] = []): ArtifactDetail {
  return {
    id, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
    level: 15, rarity: 5, main: { code, value }, subs: subs.map(([c, v]) => ({ code: c, value: v })),
  };
}
const INVENTAIRE = [
  art(901, 'element', 101, 100), art(902, 'element', 102, 100, [[219, 10]]), art(903, 'element', 100, 1500),
  art(904, 'archetype', 101, 100, [[219, 5]]), art(905, 'archetype', 100, 1500), art(906, 'archetype', 102, 100),
];

// `entreeResolution` (scripts/lib/relicDifferentiel.ts) au commit 7905df36,
// recopiée TELLE QUELLE (commentaires retirés) : la référence de l'extraction.
function entreeResolutionAvant(p: SearchParams, c: BuildCandidate, ctx: RelicContext | undefined, r: ReglagesDifferentiel): EntreeResolution {
  const gear = { base: p.base, runes: runesDe(p, c), artifacts: p.artifacts, relic: p.relic };
  const regime = regimeDe(r);
  const conditionsPosees = conditionsPaireFixePosees(p.requirement);
  const fixe = r.paireFixe;
  return {
    gear,
    faireParams: (rel): ArtifactSearchParams => {
      const statsAvec = statsParPaire({ ...gear, relic: rel });
      const exclusive = r.exclusive ? { relique: rel, setup: r.exclusive.setup, element: r.exclusive.element } : undefined;
      const propres = aurasPropresDesRunes(gear.runes);
      const evaluer =
        regime === 'degats_reels'
          ? evaluerPourRegime(regime, statsAvec, propres, r.degats!, exclusive)
          : evaluerPourRegime(regime, statsAvec, propres, exclusive);
      return {
        porteur: r.porteur,
        inventaire: fixe ? [] : (r.inventaireArtefacts ?? []),
        equipes: fixe ?? [],
        principaleParSorte: fixe ? { element: 'equipped', archetype: 'equipped' } : {},
        lignesVerrouillees: fixe ? [] : (r.lignesVerrouillees ?? []),
        maxStatsActifs: maxStatsActifsDe(p),
        evaluer,
      };
    },
    respecteConditions: conditionsPosees ? (arts) => respecteConditionsPaireFixe(computeStats({ ...gear, artifacts: arts }), p.requirement, aurasPropresDesRunes(gear.runes)) : null,
    requirement: p.requirement,
    regimeAucun: regime === 'aucun',
    // Seul ajout à la copie : le champ obligatoire du départage
    // des régimes de stat, qui n'existait pas au commit 7905df36.
    regimeDeStat: regime === 'hp' || regime === 'atk' || regime === 'def',
    relicContext: ctx,
  };
}

export function testResolutionProducteurPartage() {
  titre('Résolution par build — le producteur partagé rend l’assemblage de l’écran, candidat par candidat');

  const exclusive = { setup: DEFAULT_DAMAGE_SETUP, element: null };
  const criteres: { critere: ReglagesDifferentiel['critere']; degats: typeof DEGATS_FICHE | null }[] = [
    { critere: 'degats_reels', degats: DEGATS_FICHE },
    { critere: 'ehp', degats: null },
    { critere: 'atk', degats: null },
    { critere: 'efficience', degats: null },
  ];
  let compares = 0;
  for (const fx of Object.values(CORPUS_5A)) {
    const p: SearchParams = { ...fx.p0, relicContext: fx.ctx };
    const candidats = searchBuilds(p).candidates;
    // UN jeu de caches et UN objet de paramètres de paires pour
    // toute la fixture, comme une file de l'écran — chaque candidat, relique,
    // contexte et critère suivant relit les profils et préfiltres des
    // précédents, comparé à la référence qui recalcule tout.
    const caches = nouveauxCachesResolution();
    const artifactParams = {
      porteur: PORTEUR, inventaire: INVENTAIRE, equipes: [], principaleParSorte: {},
      lignesVerrouillees: [], maxStatsActifs: maxStatsActifsDe(p),
    };
    for (const [nomCtx, ctx] of [['recherche', fx.ctx], ['relique fixe', undefined]] as [string, RelicContext | undefined][]) {
      for (const { critere, degats } of criteres) {
        const reglages: ReglagesDifferentiel = { critere, degats, porteur: PORTEUR, inventaireArtefacts: INVENTAIRE, exclusive };
        const regime = regimeDe(reglages);
        const differents: string[] = [];
        for (const c of candidats) {
          // La référence : l'assemblage d'avant de l'écran, recopié tel quel.
          const ref = resoudreEquipementDuBuild(entreeResolutionAvant(p, c, ctx, reglages));
          // Le différentiel, qui passe par les producteurs.
          if (JSON.stringify(resoudreCandidat(p, c, ctx, reglages)) !== JSON.stringify(ref)) differents.push(`différentiel ${cleBuild(c)}`);
          // Le producteur partagé, avec les mêmes paramètres de paires que
          // la référence (son `evaluer` est remplacé par le producteur).
          const nouveau = resoudreEquipementDuBuild(entreeResolutionDuBuild({
            fiche: { base: p.base, runes: [], artifacts: p.artifacts, relic: p.relic },
            runes: runesDe(p, c),
            artifactParams,
            regime,
            degats,
            exclusive,
            requirement: p.requirement,
            relicContext: ctx,
            caches,
          }));
          if (JSON.stringify(nouveau) !== JSON.stringify(ref)) differents.push(cleBuild(c));
          compares++;
        }
        egal(differents, [], `${fx.nom}, ${nomCtx}, ${critere} : ${candidats.length} candidat(s), même résultat que l’assemblage de l’écran (producteur partagé et différentiel)`);
      }
    }
  }
  ok(compares > 0, `${compares} résolutions comparées au total`);

  // Garde : « Dégâts réels » sans contexte de dégâts est une incohérence de
  // l'appelant (le régime effectif n'a pas été rabattu), jamais un repli.
  const fx = CORPUS_5A.A;
  const c = searchBuilds({ ...fx.p0, relicContext: fx.ctx }).candidates[0];
  let leve = false;
  try {
    entreeResolutionDuBuild({
      fiche: { base: fx.p0.base, runes: [], artifacts: [], relic: undefined }, runes: runesDe(fx.p0, c),
      artifactParams: { porteur: PORTEUR, inventaire: [], equipes: [], principaleParSorte: {} },
      regime: 'degats_reels', degats: null, exclusive, requirement: fx.p0.requirement, relicContext: undefined, caches: null,
    });
  } catch {
    leve = true;
  }
  ok(leve, 'régime « Dégâts réels » sans contexte de dégâts : refus explicite');

  // Raccordement : l'écran appelle CE producteur, avec ses propres valeurs.
  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(/const resoudreEquipement = useMemo\(\(\) => \{\s*if \(!artifactParams \|\| !selected \|\| !optimiserArtefacts\) return null;[\s\S]{0,200}?resoudreEquipementDuBuild\(\s*entreeResolutionDuBuild\(\{\s*fiche: selected\.gear,\s*runes: runesDuBuild\(c, runeById\),\s*artifactParams,\s*regime: regimeEquipement,\s*degats: contexteDegatsArtefacts,\s*exclusive: contexteExclusive,\s*requirement: requirementAvecAuras,\s*relicContext: relicContextRecherche,\s*caches: cachesResolution,/.test(ecran),
    'écran : la file résout par entreeResolutionDuBuild (fiche, runes du candidat par runesDuBuild, artifactParams, régime effectif, contexte, conditions avec auras, contexte relique lancé, caches de la file)');
  ok(/\}, \[artifactParams, selected, optimiserArtefacts, runeById, regimeEquipement, contexteDegatsArtefacts, contexteExclusive, requirementAvecAuras, relicContextRecherche, cachesResolution\]\);/.test(ecran),
    'écran : le mémo de résolution dépend de chacune de ses entrées');
  // Les caches de la file se refont avec la signature des réglages
  // et les paramètres de paires (l'inventaire) — jamais un état global.
  ok(/const cachesResolution = useMemo\(\(\) => nouveauxCachesResolution\(\), \[signatureArtefacts, artifactParams\]\);/.test(ecran),
    'écran : caches de la file neufs à chaque signature des réglages ou paramètres de paires');
  ok(!/faireParamsArtefacts/.test(ecran), 'écran : plus aucun assemblage local des paramètres de paires');
}

/* ── `classementResolu` : attentes écrites à la main ──────────────────────── */

function stats(atk: number): StatRow[] {
  return [{ key: 'atk', label: 'ATQ', base: atk, bonus: 0, total: atk, suffix: '' }];
}
function candidat(ids: number[], atk: number): BuildCandidate {
  return { runeIds: ids, stats: stats(atk), effTotal: 0 };
}
function resultat(atk: number, conforme: boolean, relique?: RelicDetail): ResultatArtefacts {
  return { paire: null, artefacts: [], stats: stats(atk), meilleurSansVerrous: null, conforme, ...(relique ? { relique } : {}) };
}

export function testClassementResolu() {
  titre('classementResolu — le classement affiché d’un cache résolu');

  const options: OptionsDeClassement = { aurasPropresDe: aurasPropresParRunes(new Map()) };
  const a = candidat([1], 1000), b = candidat([2], 900), c = candidat([3], 800), d = candidat([4], 700), e = candidat([5], 600);
  const base = sortCandidates([a, b, c, d, e], 'atk', options);
  egal(base.map(cleBuild), ['1', '2', '3', '4', '5'], 'précondition : ordre de base par ATQ');

  ok(classementResolu(base, new Map(), 'atk', options) === base, 'cache vide : l’ordre de base est rendu tel quel (même tableau)');

  const r = (rid: number): RelicDetail => ({ id: rid, upgrade: 9, main: { code: 100, value: 0 } });
  const cache = new Map<string, ResultatArtefacts>([
    [cleBuild(a), resultat(1100, false, r(3))], // rejeté : aucun couple faisable
    [cleBuild(b), resultat(1200, true, r(7))], // résolu, passe devant
    [cleBuild(d), resultat(1200, true, r(5))], // ex æquo avec b : rid 5 avant rid 7
    // c et e absents : pas encore résolus, gardés avec leurs stats de base
  ]);
  const classes = classementResolu(base, cache, 'atk', options);
  egal(classes.map(cleBuild), ['4', '2', '3', '5'],
    'a écarté (non conforme) ; b et d remontent à 1 200, départagés par rid (5 avant 7) ; c et e gardent leur rang de base');
  egal(classes.map((x) => scoreDuCandidat(x, 'atk', options)), [1200, 1200, 800, 600], 'stats remplacées par celles de l’équipement retenu');
  egal(base.map(cleBuild), ['1', '2', '3', '4', '5'], 'l’ordre de base n’est pas muté');

  // Les options affichées lisent le MÊME cache : relique retenue par build.
  const etat = (x: BuildCandidate) => etatReliqueDuBuild(cache.get(cleBuild(x)), undefined, undefined);
  const opts = optionsDeClassement({
    realDamage: null, damageSetup: DEFAULT_DAMAGE_SETUP, runeById: new Map(), metric: 'eff',
    aurasPropresDe: aurasPropresParRunes(new Map()), artefactsDuBuild: () => null, etatReliqueDe: etat,
    contexteExclusive: { setup: DEFAULT_DAMAGE_SETUP, element: null },
  });
  egal(classementResolu(base, cache, 'atk', opts).map(cleBuild), ['4', '2', '3', '5'], 'avec les options du producteur : même classement');

  // Raccordement : l'écran classe par CE producteur.
  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(/const affichees = useMemo\(\s*\(\) => classementResolu\(fullSortedCandidates, fileArtefacts\.parBuild, sortBy, optionsDuTriAffiche\),\s*\[fullSortedCandidates, fileArtefacts\.parBuild, sortBy, optionsDuTriAffiche\]/.test(ecran),
    'écran : le classement affiché vient de classementResolu (ordre de base, cache de la file, tri, options affichées)');
}
