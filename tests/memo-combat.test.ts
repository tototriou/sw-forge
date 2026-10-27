// `MemoCombat` (src/lib/damage.ts) : ce que le calcul de dégâts relit à
// l'identique d'une paire d'artéfacts à l'autre — chronologie des poses entre
// les coups, stats au début du combat, stats de combat —, calculé une fois.
// La promesse : `computeTotalDamage` rend, avec le memo, EXACTEMENT ce qu'il
// rend sans lui (`Object.is`, au bit près), paire après paire, sur le corpus.
//
// Référence de contrôle (`algo-verify`) : le même appel sans memo, qui
// recalcule tout. Chaque sort calculable de chaque fiche du corpus, sous deux
// réglages : le défaut, et un réglage « riche » — buffs ATQ/DEF/VIT, Miriam,
// tous les passifs allumés, VIT adverse basse (critique forcé des monstres
// `critSiPlusRapide`, réglages recopiés à chaque appel), et, pour un sort à
// effets posables entre les coups, le scénario actif (chronologies). Un memo
// par build et par relique comme `evaluerPourRegime` : des paires tirées à
// graine fixe, dont les stats viennent de `statsParPaire` (le même tableau aux
// paires de mêmes principales, comme en production) et dont les profils
// portent des amplifications de buff variées ; chaque paire est notée deux
// fois, dans un ordre mélangé, pour relire ce que le memo a retenu.
//
// `PreparationReglage` (ce qui ne dépend que du réglage, une fois par
// recherche) : la même promesse avec UNE préparation partagée par tous les
// contextes du corpus, comme une file la partage entre ses builds et
// reliques ; puis, sur un contexte, plusieurs builds qui la partagent : après
// le premier, plus aucun terme du réglage n'est recalculé.

import { ArtifactDetail, ArtifactKind, BaseStats } from '../src/types';
import { ARTIFACT_SUB_MAX } from '../src/lib/artifacts';
import { artifactSubKinds } from '../src/lib/effects';
import { statsParPaire } from '../src/lib/stats';
import {
  AurasPropres,
  BORNE_CHRONOLOGIES,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  MemoCombat,
  PreparationReglage,
  artifactDamageProfile,
  computeTotalDamage,
  estPrisEnCharge,
  monsterDamageSkills,
  statsDebutCombat,
} from '../src/lib/damage';
import { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { mulberry32 } from '../scripts/lib/randomPool';
import { loadMonstersList } from '../scripts/lib/monstersData';
import { loadMonsterSkills } from '../scripts/lib/skillsData';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { RealDamageContext } from '../src/lib/runeBuildOptim';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 11000, atk: 780, def: 640, spd: 104, cr: 15, cd: 50, res: 15, acc: 0 };
const PROPRES: AurasPropres = { fight: 1, determination: 1, enhance: 0, accuracy: 0, tolerance: 0 };

// Quatre pièces par sorte, deux principales par sorte : des paires partagent
// leur tableau de stats (`statsParPaire`) et ne diffèrent que par UNE
// amplification de buff (`CODE_AMPLI_PAR_BUFF`) — le cas où une clé
// incomplète du memo rendrait une valeur fausse. Attribut : 204 (ATQ) sur les
// pièces 0 et 2, 205 (DEF) sur 1 et 3, à valeurs différentes ; type : 206
// (VIT) sur 0 et 2, 226 (ATQ et DEF) sur 1, rien sur 3. D'où, à stats égales :
// [0, t3] et [2, t3] ne diffèrent que par l'ATQ, [1, t3] et [3, t3] par la
// DEF, [—, t0] et [—, t2] par la VIT. Les trois autres lignes, tirées.
const AMPLI_PAR_PIECE: Record<ArtifactKind, (number | null)[]> = { element: [204, 205, 204, 205], archetype: [206, 226, 206, null] };

function pieces(rng: () => number, kind: ArtifactKind, id0: number): ArtifactDetail[] {
  const codes = Object.keys(ARTIFACT_SUB_MAX).map(Number).filter((c) => artifactSubKinds(c).includes(kind));
  const principales = kind === 'element' ? [{ code: 100, value: 1500 }, { code: 101, value: 100 }] : [{ code: 102, value: 100 }, { code: 101, value: 80 }];
  return AMPLI_PAR_PIECE[kind].map((ampli, i) => {
    const choisis = new Set<number>(ampli ? [ampli] : []);
    while (choisis.size < 4) {
      const c = codes[Math.floor(rng() * codes.length)]!;
      if (![204, 205, 206, 226].includes(c)) choisis.add(c);
    }
    return {
      id: id0 + i, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
      level: 15, rarity: 5,
      main: principales[i % 2]!,
      subs: [...choisis].map((code) => ({ code, value: code === ampli ? 5 + 10 * i : Math.max(1, Math.round(rng() * ARTIFACT_SUB_MAX[code]! * 10) / 10) })),
    };
  });
}

// Le contexte de dégâts du CLI (`buildRealDamageContext`) pour ce sort et ce réglage.
function contexte(com2usId: number, setup: DamageSetup): RealDamageContext | null {
  return buildRealDamageContext({ objective: 'degats_reels', damageSetup: setup } as unknown as OptimizerRecipe, com2usId, []);
}

function total(ctx: RealDamageContext, stats: ReturnType<ReturnType<typeof statsParPaire>>, arts: ArtifactDetail[], memo?: MemoCombat | PreparationReglage): number {
  return computeTotalDamage(
    ctx.profile, ctx.passifs, stats, ctx.setup, PROPRES, ctx.element, artifactDamageProfile(arts), ctx.critSiPlusRapide,
    ctx.bonusDegatsSelonVit, ctx.bonusDegatsStack, ctx.monsterWide, ctx.bonusDegatsConditionnel, ctx.bonusDegatsSelonCr,
    ctx.bonusDegatsSelonDef, ctx.bonusSiAtqSeuil, 0, memo
  );
}

export default function testMemoCombat() {
  titre('MemoCombat — computeTotalDamage avec le memo rend, au bit près, ce qu’il rend sans lui (corpus)');
  const rng = mulberry32(4242);
  const elements = pieces(rng, 'element', 9000);
  const archetypes = pieces(rng, 'archetype', 9100);
  const paires: ArtifactDetail[][] = [];
  for (const e of [null, ...elements]) for (const a of [null, ...archetypes]) paires.push([e, a].filter((x): x is ArtifactDetail => x != null));
  const statsAvec = statsParPaire({ base: BASE, runes: [], artifacts: [] });

  const ecarts: string[] = [];
  let sorts = 0;
  let appels = 0;
  let avecChronologie = 0;
  let avecStatsRetenues = 0;
  let avecCombatsRetenus = 0;
  let critiqueForce = 0;
  let passifsAllumes = 0;
  // Une préparation pour tout le corpus : une « file » qui verrait passer
  // tous ces réglages, bornes comprises.
  const preparationCorpus = new PreparationReglage();
  // La seule préparation, sans memo de stats : les notes du classement
  // (`optionsDeClassement`), un candidat par note.
  const preparationNotes = new PreparationReglage();
  const ecartsNotes: string[] = [];
  const ecartsPartage: string[] = [];
  const vus = new Set<number>();
  for (const m of loadMonstersList()) {
    const id = m.com2usId;
    if (id == null || vus.has(id)) continue;
    vus.add(id);
    const detail = loadMonsterSkills(id);
    if (!detail) continue;
    for (const sort of monsterDamageSkills(detail).filter(estPrisEnCharge)) {
      const defaut: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: sort.skillCom2usId, critMode: 'crit' };
      const base = contexte(id, defaut);
      if (!base) continue;
      const riche: DamageSetup = {
        ...defaut, atkBuff: true, defBuff: true, spdBuff: true, miriamActif: true, enemySpd: 40,
        passifsOffensifs: Object.fromEntries(base.passifs.map((p) => [p.skillCom2usId, true])),
        ...(base.profile.effetsEntreCoups?.length
          ? { scenariosEffetsEntreCoups: { [base.profile.skillCom2usId]: { actif: true, apresCoup: Object.fromEntries(base.profile.effetsEntreCoups.map((e) => [e.id, 1])) } } }
          : {}),
      };
      for (const setup of [defaut, riche]) {
        const ctx = setup === defaut ? base : contexte(id, setup)!;
        sorts++;
        if (setup === riche && ctx.critSiPlusRapide) critiqueForce++;
        if (setup === riche && ctx.passifs.length) passifsAllumes++;
        // Un memo par build et par relique : chaque paire, deux fois, ordre mélangé.
        const memo = new MemoCombat(PROPRES, ctx.element);
        const memoPartage = new MemoCombat(PROPRES, ctx.element, preparationCorpus);
        const ordre = [...paires, ...paires].map((p) => ({ p, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.p);
        for (const arts of ordre) {
          const stats = statsAvec(arts);
          const avec = total(ctx, stats, arts, memo);
          const sans = total(ctx, stats, arts);
          const partage = total(ctx, stats, arts, memoPartage);
          const note = total(ctx, stats, arts, preparationNotes);
          if (!Object.is(note, sans) && ecartsNotes.length < 5) {
            ecartsNotes.push(`${id} sort ${sort.skillCom2usId} (${setup === defaut ? 'défaut' : 'riche'}) [${arts.map((a) => a.id).join(',')}] : ${note} ≠ ${sans}`);
          }
          appels++;
          if (!Object.is(avec, sans) && ecarts.length < 5) {
            ecarts.push(`${id} sort ${sort.skillCom2usId} (${setup === defaut ? 'défaut' : 'riche'}) [${arts.map((a) => a.id).join(',')}] : ${avec} ≠ ${sans}`);
          }
          if (!Object.is(partage, sans) && ecartsPartage.length < 5) {
            ecartsPartage.push(`${id} sort ${sort.skillCom2usId} (${setup === defaut ? 'défaut' : 'riche'}) [${arts.map((a) => a.id).join(',')}] : ${partage} ≠ ${sans}`);
          }
        }
        const c = memo.compte;
        if (c.chronologies > 0) avecChronologie++;
        if (c.tableaux > 0) avecStatsRetenues++;
        if (c.combats > 0) avecCombatsRetenus++;
      }
    }
  }
  egal(ecarts, [], `${appels} notes de paires, ${sorts} contextes (sort × réglage) : avec le memo = sans le memo, au bit près`);
  ok(avecChronologie > 20, `… dont ${avecChronologie} contextes où le memo a retenu une chronologie de poses entre les coups`);
  ok(avecStatsRetenues > 100 && avecCombatsRetenus > 100, `… ${avecStatsRetenues} où il a retenu des stats au début du combat, ${avecCombatsRetenus} des stats de combat`);
  ok(critiqueForce > 0 && passifsAllumes > 0, `… ${critiqueForce} contextes à critique forcé, ${passifsAllumes} à passifs allumés`);
  egal(ecartsPartage, [], `… et avec UNE préparation du réglage partagée par les ${sorts} contextes (une file), au bit près`);
  egal(ecartsNotes, [], `… et avec la seule préparation passée à computeTotalDamage, sans memo de stats (les notes du classement), au bit près`);
  ok(preparationNotes.compte.calculs.termesLus > 0, `… qui relit ses termes (${preparationNotes.compte.calculs.termesLus} lus)`);
  const cc = preparationCorpus.compte.calculs;
  ok(cc.termesLus > 0 && cc.decoupesLues > 0 && cc.sortsLus > 0,
    `… qui relit ce qu’elle a préparé (termes ${cc.termesLus} lus pour ${cc.termes} calculés, découpes ${cc.decoupesLues}/${cc.decoupes}, sorts ${cc.sortsLus}/${cc.sorts})`);

  // ── Une recherche : plusieurs builds (bases de stats différentes) et leurs
  // paires partagent la préparation du réglage d'un contexte riche — scénario
  // de poses actif et passifs allumés si le corpus en a un. Après le premier
  // build, plus rien du réglage n'est recalculé : chronologies, sort, découpes
  // et termes ne sont que relus. ──
  {
    const riches = [...vus].flatMap((id) => monsterDamageSkills(loadMonsterSkills(id)).filter(estPrisEnCharge)
      .filter((s) => (s.effetsEntreCoups?.length ?? 0) > 0 && s.hits > 1).map((s) => ({ id, s })));
    const choix = riches.find(({ id, s }) => (contexte(id, { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: s.skillCom2usId })?.passifs.length ?? 0) > 0) ?? riches[0];
    ok(choix !== undefined, `un sort à poses entre les coups pour la recherche partagée (${choix?.id} sort ${choix?.s.skillCom2usId})`);
    if (choix) {
      const base0 = contexte(choix.id, { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: choix.s.skillCom2usId, critMode: 'crit' })!;
      const setup: DamageSetup = {
        ...DEFAULT_DAMAGE_SETUP, skillCom2usId: choix.s.skillCom2usId, critMode: 'crit', atkBuff: true,
        passifsOffensifs: Object.fromEntries(base0.passifs.map((p) => [p.skillCom2usId, true])),
        scenariosEffetsEntreCoups: { [choix.s.skillCom2usId]: { actif: true, apresCoup: Object.fromEntries(choix.s.effetsEntreCoups!.map((e) => [e.id, 1])) } },
      };
      const ctx = contexte(choix.id, setup)!;
      const preparation = new PreparationReglage();
      const bases: BaseStats[] = [BASE, { ...BASE, atk: 950, cd: 120, spd: 130 }, { ...BASE, hp: 15000, def: 900 }];
      const ecartsRecherche: string[] = [];
      let apresPremier: PreparationReglage['compte']['calculs'] | null = null;
      for (const [b, base] of bases.entries()) {
        const stats = statsParPaire({ base, runes: [], artifacts: [] });
        // Un évaluateur par build et par relique : deux « reliques » par build.
        for (let relique = 0; relique < 2; relique++) {
          const memo = new MemoCombat(PROPRES, ctx.element, preparation);
          for (const arts of paires) {
            const s = stats(arts);
            const avec = total(ctx, s, arts, memo);
            const sans = total(ctx, s, arts);
            if (!Object.is(avec, sans) && ecartsRecherche.length < 3) ecartsRecherche.push(`build ${b} [${arts.map((a) => a.id).join(',')}] : ${avec} ≠ ${sans}`);
          }
        }
        if (b === 0) apresPremier = preparation.compte.calculs;
      }
      const fin = preparation.compte.calculs;
      egal(ecartsRecherche, [], `${bases.length} builds × 2 reliques × ${paires.length} paires sur une préparation : au bit près`);
      egal(
        [fin.chronologies, fin.sorts, fin.decoupes, fin.termes, fin.termesHorsMemoire],
        [apresPremier!.chronologies, apresPremier!.sorts, apresPremier!.decoupes, apresPremier!.termes, apresPremier!.termesHorsMemoire],
        `… après le premier build, aucun calcul du réglage de plus (fin : ${JSON.stringify(fin)})`
      );
      ok(fin.chronologies > 0 && fin.termes > 0 && fin.decoupes > 0 && fin.termesLus > fin.termes,
        `… chronologies (${fin.chronologies}), découpes (${fin.decoupes}) et termes (${fin.termes}) calculés une fois, relus ${fin.termesLus} fois`);
    }
  }

  // ── Les clés, appelées directement : des cas qu'aucun sort du corpus
  // n'atteint aujourd'hui (un seul passif `coupsDuSortActif`), que la clé
  // doit garder quand même. ──
  {
    const sorts = [...vus].slice(0, 50).flatMap((id) => monsterDamageSkills(loadMonsterSkills(id)).filter(estPrisEnCharge));
    const [P, a, b] = sorts;
    const S: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'crit' };
    const MW = {};
    const v1 = { avant: [S], apres: S };
    const v2 = { avant: [S], apres: S };
    const memo = new MemoCombat(PROPRES, null);
    // Le réglage et le sort de `computeTotalDamage` : leurs chronologies se retiennent.
    memo.connaitre(S, P!);
    let appelsF2 = 0;
    memo.chronologie(P!, S, MW, [a!], () => v1);
    const r2 = memo.chronologie(P!, S, MW, [b!], () => (appelsF2++, v2));
    let appelsF1 = 0;
    const r1 = memo.chronologie(P!, S, MW, [a!], () => (appelsF1++, v1));
    ok(a !== b && appelsF2 === 1 && r2 === v2, 'chronologie : profils qui suivent différents, de même longueur → recalculée, sa valeur rendue');
    ok(appelsF1 === 0 && r1 === v1, '… et les mêmes profils qui suivent → la valeur retenue, sans recalcul');

    // Auras propres ou élément autres que ceux du memo : rien ne se retient,
    // chaque appel rend la fonction elle-même.
    const AUTRES: AurasPropres = { fight: 0, determination: 0, enhance: 0, accuracy: 0, tolerance: 0 };
    const stats = statsAvec([]);
    const garde = new MemoCombat(PROPRES, 'fire');
    garde.connaitre(S);
    const autresAuras = garde.debutCombat(stats, S, AUTRES, 'fire');
    const autreElement = garde.debutCombat(stats, S, PROPRES, 'water');
    egal(garde.compte.tableaux, 0, 'autres auras propres ou autre élément que ceux du memo : aucun tableau retenu');
    egal([autresAuras, autreElement, garde.debutCombat(stats, S, PROPRES, 'fire')],
      [statsDebutCombat(stats, S, AUTRES, 'fire'), statsDebutCombat(stats, S, PROPRES, 'water'), statsDebutCombat(stats, S, PROPRES, 'fire')],
      '… chaque appel rend statsDebutCombat sur ses propres entrées, puis celles du memo se retiennent');
  }

  // ── Bornes : un seul memo pour plus de réglages que de chronologies
  // retenues — vidé d'un coup, jamais un résultat différent. ──
  {
    const scenario = [...vus].map((id) => ({ id, d: loadMonsterSkills(id) })).flatMap(({ id, d }) =>
      monsterDamageSkills(d).filter(estPrisEnCharge).filter((s) => (s.effetsEntreCoups?.length ?? 0) > 0 && s.hits > 1).map((s) => ({ id, s }))
    )[0];
    ok(scenario !== undefined, `un sort à effets posables entre les coups pour l’essai des bornes (${scenario?.id} sort ${scenario?.s.skillCom2usId})`);
    if (scenario) {
      const memo = new MemoCombat(PROPRES, null);
      const ecartsBornes: string[] = [];
      let maxChronologies = 0;
      const reglage = (i: number): DamageSetup => ({
        ...DEFAULT_DAMAGE_SETUP, skillCom2usId: scenario.s.skillCom2usId, critMode: 'crit', enemyDef: 1000 + 37 * i,
        scenariosEffetsEntreCoups: { [scenario.s.skillCom2usId]: { actif: true, apresCoup: Object.fromEntries(scenario.s.effetsEntreCoups!.map((e) => [e.id, 1])) } },
      });
      // Le même sort (même profil) sous des réglages distincts : seul le
      // réglage distingue leurs chronologies.
      const commun = { ...contexte(scenario.id, reglage(0))!, element: null };
      for (let tour = 0; tour < 3; tour++) {
        for (let i = 0; i < BORNE_CHRONOLOGIES + 5; i++) {
          const ctx = { ...commun, setup: reglage(i) };
          for (const arts of paires.slice(0, 6)) {
            const stats = statsAvec(arts);
            const avec = total(ctx, stats, arts, memo);
            const sans = total(ctx, stats, arts);
            if (!Object.is(avec, sans)) ecartsBornes.push(`tour ${tour} réglage ${i} : ${avec} ≠ ${sans}`);
          }
          maxChronologies = Math.max(maxChronologies, memo.compte.chronologies);
        }
      }
      egal(ecartsBornes.slice(0, 3), [], `${3 * (BORNE_CHRONOLOGIES + 5)} réglages distincts sur un memo : résultat exact`);
      ok(maxChronologies <= BORNE_CHRONOLOGIES, `… au plus ${BORNE_CHRONOLOGIES} chronologies retenues (vu : ${maxChronologies})`);

      // ── Critique forcé sous scénario actif : le sort se calcule sous un
      // réglage à `critMode: 'crit'`, construit une fois par la préparation
      // du sort (`setupCritForce`) et donc relu, avec sa chronologie. Le memo
      // garde ce qui se relit (la chronologie du réglage lui-même, pour l'état
      // après le sort, et celle du réglage forcé) au lieu de se vider toutes
      // les `BORNE_CHRONOLOGIES` paires. Aucun monstre du corpus n'a à la fois
      // `critSiPlusRapide` et un sort à effets posables : le contexte le pose. ──
      const reglageForce: DamageSetup = { ...reglage(0), critMode: 'normal', enemySpd: 40 };
      const brut = { ...contexte(scenario.id, reglageForce)!, element: null };
      const force = { ...brut, critSiPlusRapide: true };
      const sansForce = { ...brut, critSiPlusRapide: false };
      const memoForce = new MemoCombat(PROPRES, null);
      const ecartsForce: string[] = [];
      let differeDuNonForce = 0;
      let chute = 0;
      let minApresPremier = { chronologies: Infinity, reglages: Infinity };
      let precedent = { chronologies: 0, reglages: 0 };
      for (let tour = 0; tour < 3; tour++) {
        for (const arts of paires) {
          const stats = statsAvec(arts);
          const avec = total(force, stats, arts, memoForce);
          const sans = total(force, stats, arts);
          if (!Object.is(avec, sans) && ecartsForce.length < 3) ecartsForce.push(`[${arts.map((a) => a.id).join(',')}] : ${avec} ≠ ${sans}`);
          if (!Object.is(sans, total(sansForce, stats, arts))) differeDuNonForce++;
          const c = memoForce.compte;
          if (c.chronologies < precedent.chronologies || c.reglages < precedent.reglages) chute++;
          precedent = c;
          minApresPremier = { chronologies: Math.min(minApresPremier.chronologies, c.chronologies), reglages: Math.min(minApresPremier.reglages, c.reglages) };
        }
      }
      const notesForce = 3 * paires.length;
      ok(notesForce > 2 * BORNE_CHRONOLOGIES && differeDuNonForce > 0,
        `critique forcé sous scénario actif : ${notesForce} notes sur un memo (plus de ${BORNE_CHRONOLOGIES}), dont ${differeDuNonForce} différentes du non forcé`);
      egal(ecartsForce, [], '… avec le memo = sans le memo, au bit près');
      egal(chute, 0, `… la mémoire ne retombe jamais (compte final ${JSON.stringify(memoForce.compte)})`);
      ok(minApresPremier.chronologies >= 1 && minApresPremier.reglages >= 1,
        `… et garde, dès la première note, la chronologie et le réglage qui se relisent (au moins ${minApresPremier.chronologies} et ${minApresPremier.reglages})`);
    }
  }

  // ── Ce qui ne peut pas être relu ne se retient pas : une chronologie dont
  // le réglage ou le sort n'est pas celui de `computeTotalDamage` (ni un
  // réglage qu'une chronologie retenue a rendu) est un objet recopié par
  // l'appel, jamais redemandé. ──
  {
    const sorts = [...vus].slice(0, 50).flatMap((id) => monsterDamageSkills(loadMonsterSkills(id)).filter(estPrisEnCharge));
    const [P, Q] = sorts;
    const S: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'crit' };
    const T: DamageSetup = { ...S };
    const MW = {};
    const v = { avant: [S], apres: S };
    const memo = new MemoCombat(PROPRES, null);
    memo.connaitre(S, P!);
    let appels = 0;
    const calcul = () => (appels++, v);
    const r1 = memo.chronologie(P!, T, MW, [], calcul);
    const r2 = memo.chronologie(Q!, S, MW, [], calcul);
    ok(r1 === v && r2 === v && appels === 2 && memo.compte.chronologies === 0,
      'réglage recopié (connu : un autre objet) ou sort non connu : la chronologie est calculée et rendue, rien ne se retient');
    memo.chronologie(P!, S, MW, [], calcul);
    memo.chronologie(P!, S, MW, [], calcul);
    ok(appels === 3 && memo.compte.chronologies === 1, '… le réglage et le sort connus : retenue, puis relue sans recalcul');
  }

  // ── Élément `undefined` (un contexte qui l'omet) : `computeTotalDamage` le
  // lit `null` (paramètre par défaut), le memo aussi — il garde sa mémoire. ──
  {
    const id = [...vus].find((x) => contexte(x, DEFAULT_DAMAGE_SETUP) !== null)!;
    const ctx = { ...contexte(id, DEFAULT_DAMAGE_SETUP)!, element: undefined as unknown as null };
    const memo = new MemoCombat(PROPRES, ctx.element);
    const ecartsElement: string[] = [];
    for (const arts of [...paires, ...paires]) {
      const stats = statsAvec(arts);
      const avec = total(ctx, stats, arts, memo);
      if (!Object.is(avec, total(ctx, stats, arts)) && ecartsElement.length < 3) ecartsElement.push(`[${arts.map((a) => a.id).join(',')}]`);
    }
    egal(ecartsElement, [], `élément undefined (${id}) : avec le memo = sans le memo, au bit près`);
    ok(memo.compte.tableaux > 0, `… et le memo retient les stats au début du combat (${memo.compte.tableaux} tableaux)`);
  }
}
