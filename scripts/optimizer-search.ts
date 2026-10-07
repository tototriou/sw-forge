// Rejoue une recherche Optimizer EXACTEMENT telle qu'exportée depuis l'écran
// (bouton « Exporter les paramètres », voir OptimizerSection.tsx et
// src/lib/optimizerRecipe.ts), sur un export de compte réel — sans jamais
// retranscrire les réglages à la main. Ferme la boucle ouverte par
// l'investigation du cas Sonia : la recette vient de l'écran, pas d'une
// reconstruction manuelle sujette aux mêmes erreurs de fidélité que celles
// rencontrées cette session-là (voir le skill algo-verify).
//
// Usage : optimizer-search.ts <export.json> <recipe.json> [--rta] [--siege=<deckId>[:defense]] [--resoudre-tout]
//   --rta   : charge le monstre depuis son preset RTA (favoris/runé RTA) au
//             lieu de son build « Mon compte » (défaut).
//   --siege : charge le monstre depuis un deck de siège précis — offense par
//             défaut, `--siege=15:defense` pour un deck de défense.
//   --resoudre-tout : résout l'équipement (paire d'artéfacts, relique) de
//             TOUS les candidats collectés, au lieu de faire comme la file de
//             l'écran (l'ordre de base jusqu'à 300 combinaisons confirmées en
//             mode relique « recherche », 100 sinon, et lignes imprimées).
//             Exhaustif, mais jusqu'à des dizaines de minutes avec des
//             artéfacts « Libre » (degats-et-aura 6bis-b5c).
// Un seul mode à la fois : sans `--rta` ni `--siege`, box (« Mon compte »).

import { printMonsterSummary } from './lib/loadMonster';
import { resolveArtifacts, toutVerifierDeLaRecette } from './lib/recipeToSearchParams';
import { chargerRecette } from './lib/chargerRecette';
import { activeSets, artifactSubName } from '../src/lib/effects';
import { loadMonsterSkills } from './lib/skillsData';
import { loadMonstersList } from './lib/monstersData';
import {
  CIBLE_DEGATS_LABELS,
  DEFAULT_DAMAGE_SETUP,
  bonusDegatsConditionnelActif,
  bonusPassifActif,
  cibleDegatsRetenue,
  cibleSecondairePriseEnCharge,
  damageRelevantStats,
  monsterBonusDegatsConditionnel,
  monsterBonusDegatsSelonCr,
  monsterBonusDegatsSelonDef,
  monsterBonusDegatsSelonVit,
  monsterBonusSiAtqSeuil,
  monsterBonusDegatsStackable,
  monsterBonusEcartDef,
  monsterBonusFixeCiblePvMax,
  monsterBonusFixeMaxHpPropre,
  monsterBonusParEffetCible,
  monsterBonusParEffetPropre,
  monsterBonusSacrifice,
  monsterBonusStatFixe,
  monsterCritRateSelonVit,
  monsterCritInterdit,
  monsterCritSiPlusRapide,
  monsterConditionsCombat,
  monsterCombatStatProfiles,
  monsterDamageSkills,
  monsterOffensivePassives,
  passifCompte,
  passifPeutSuivre,
  resolveDamageSkill,
  resolvedBuffsPropresCount,
  coupsAffichesDuSort,
  resolvedHits,
  resolvedLeaderSkill,
  resolvedStackPct,
  resolvedStackTrigger,
  resumeIgnoreDefRetenu,
  resumeSequenceDeCoups,
  artifactDamageProfile,
} from '../src/lib/damage';
import { runSearchToCompletion } from './lib/runSearch';
import { buildRealDamageContext } from './lib/realDamageCli';
import { NearMiss, RechercheRefusee, candidateMetricTotal, scoreDuCandidat } from '../src/lib/runeBuildOptim';
import { etatReliqueDuBuild } from '../src/lib/relicQueue';
import { cleBuild } from '../src/lib/artifactQueue';
import { LIGNES_IMPRIMEES, classerCommeLEcran } from './lib/classementCli';
import { autoExcludedRuneIds, resolveExcludedRuneIds } from '../src/lib/optimizerExclusion';

const [exportPath, recipePath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const rtaMode = process.argv.includes('--rta');
const siegeArg = process.argv.find((a) => a.startsWith('--siege='))?.slice('--siege='.length);
const toutResoudre = process.argv.includes('--resoudre-tout');
if (!exportPath || !recipePath) {
  console.error('Usage: optimizer-search.ts <export.json> <recipe.json> [--rta] [--siege=<deckId>[:defense]] [--resoudre-tout]');
  process.exit(1);
}
if (rtaMode && siegeArg != null) {
  console.error('--rta et --siege sont exclusifs — un seul mode de chargement à la fois.');
  process.exit(1);
}

// ⚠️ Toute la séquence « recette + compte → SearchParams » vit dans
// `chargerRecette` (scripts/lib/chargerRecette.ts) : repli d'un objectif
// retiré, choix du chargeur, contrôle du com2usId, données d'exclusion,
// `recipeToSearchParams`. Elle est PARTAGÉE avec le harnais de diagnostic —
// la refaire ici la ferait diverger, exactement la classe d'erreur que ce
// script a été écrit pour ne pas commettre.
let chargee;
try {
  chargee = chargerRecette(
    exportPath,
    recipePath,
    rtaMode
      ? { type: 'rta' }
      : siegeArg != null
        ? (() => {
            const [deckIdRaw, variant] = siegeArg.split(':');
            const deckId = Number(deckIdRaw);
            if (!Number.isFinite(deckId)) {
              console.error(`--siege=<deckId>[:defense] : deckId invalide (${deckIdRaw}).`);
              process.exit(1);
            }
            return { type: 'siege' as const, deckId, defense: variant === 'defense' };
          })()
        : { type: 'box' }
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
const { recipe, loaded, exclusionData, params, modeLabel } = chargee;
for (const a of chargee.avertissements) console.warn(`⚠️ ${a}`);

console.log(
  `Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — objectif ${recipe.objective} — ` +
    `métrique ${recipe.metric} — préfiltrage ${recipe.slotFilterPreset} — ` +
    `piste B ${recipe.adaptiveTrancheWeighting ? 'ON' : 'off'} — exclure les runes déjà utilisées ${
      recipe.excludeUsedRunes ? `ON (${recipe.excludeUsedScope})` : 'off'
    } — vérifier toutes les combinaisons trouvées ${toutVerifierDeLaRecette(recipe) ? 'ON' : 'off'}`
);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);
console.log(
  `Auras externes (autres monstres) : ${JSON.stringify(recipe.damageSetup?.setsAuraExternes ?? [])} ; ` +
    `activations propres du build : comptées dans le combat et le score ; ` +
    `RES/PRE (externes + propres) dans les conditions : ${recipe.compterAurasResPre ?? true}`
);
if (recipe.requirement.maxStats && Object.keys(recipe.requirement.maxStats).length > 0) {
  console.log(`maxStats : ${JSON.stringify(recipe.requirement.maxStats)}`);
}

printMonsterSummary(modeLabel, loaded);

// Exclusion AUTOMATIQUE (« Exclure les runes déjà utilisées ») : ⚠️ contrairement
// à l'exclusion MANUELLE ci-dessous, le périmètre « Défenses siège » ne
// dépend QUE de `monsterId` (stable), jamais de `SiegeTeam.id` (régénéré
// aléatoirement à chaque chargement, voir loadMonster.ts) — donc PLEINEMENT
// fiable ici, aucun avertissement nécessaire.
if (recipe.excludeUsedRunes && exclusionData) {
  const resolved = autoExcludedRuneIds(recipe.excludeUsedScope, exclusionData, loaded.com2usId);
  console.log(`Exclusion automatique (${recipe.excludeUsedScope}) : ${resolved.size} rune(s) exclue(s) sur ce compte.`);
}

// Exclusion MANUELLE (voir optimizerExclusion.ts).
if (recipe.excludedSelectors && recipe.excludedSelectors.length > 0 && exclusionData) {
  // ⚠️ Les sélecteurs venant du Siège ne sont pas résolubles hors de l'écran
  // (identifiants d'équipe régénérés à chaque chargement) — l'avertissement
  // est produit par `chargerRecette`, il n'est pas répété ici.
  //
  // ⚠️ Garde anti-auto-exclusion (Phase C, voir optimizerExclusion.ts) :
  // `ownUnitKey` (box, PAR ENTRÉE — `String(unitId)`, même format que
  // `BoxItem.key`/`mapBoxMonsters`) et `ownCom2usId` (RTA/siège, PAR
  // ESPÈCE). `loaded.unitId` vaut -1 en mode RTA/siège (non exposé par ces
  // presets, voir loadMonster.ts) — sans effet : cette branche ne sert
  // qu'à la box, où `unitId` est toujours réel.
  const resolved = resolveExcludedRuneIds(recipe.excludedSelectors, exclusionData, String(loaded.unitId), loaded.com2usId);
  console.log(`Exclusion manuelle : ${recipe.excludedSelectors.length} sélection(s) dans la recette, ${resolved.size} rune(s) réellement exclue(s) sur ce compte.`);
}

// Objectif « Dégâts réels » : dire QUEL sort a réellement été retenu et sur
// quelles stats le pré-filtrage va être orienté. Une recette reçue d'un autre
// joueur peut désigner un sort absent du monstre chargé ici — le repli sur le
// sort par défaut est silencieux côté code (voir `resolveDamageSkill`), il ne
// doit pas l'être côté console.
if (recipe.objective === 'degats_reels') {
  const detail = loadMonsterSkills(loaded.com2usId);
  const skills = monsterDamageSkills(detail);
  const profile = resolveDamageSkill(skills, recipe.damageSetup?.skillCom2usId ?? null);
  const s = recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
  const passifs = monsterOffensivePassives(detail);
  // Élément du monstre RÉELLEMENT chargé (pas celui de la recette) : c'est lui
  // qui décide de la compétence d'invocateur « Puis. d'att. de <élément> ».
  const monsterElement = loadMonstersList().find((m) => m.com2usId === loaded.com2usId)?.element ?? null;
  if (!profile) {
    console.warn(
      `⚠️ Objectif « Dégâts réels » mais AUCUN sort calculable pour ${loaded.monsterName} (fiche absente ou formules hors modèle) — ` +
        `le pré-filtrage retombe sur OBJECTIVE_RELEVANT_STATS.degats_reels (ATQ + Dgts Crit), l'objectif « Dégâts » n'existe plus.`
    );
  } else {
    if (s.skillCom2usId != null && s.skillCom2usId !== profile.skillCom2usId) {
      console.warn(`⚠️ Sort ${s.skillCom2usId} de la recette introuvable ici — repli sur « ${profile.nom} ».`);
    }
    const lead = resolvedLeaderSkill(s);
    const bonusConditionnel = monsterBonusDegatsConditionnel(detail);
    const bonusStatFixe = monsterBonusStatFixe(detail);
    const critRateSelonVit = monsterCritRateSelonVit(detail);
    const bonusEcartDef = monsterBonusEcartDef(detail);
    const bonusFixeCiblePvMax = monsterBonusFixeCiblePvMax(detail);
    const bonusFixeMaxHpPropre = monsterBonusFixeMaxHpPropre(detail);
    const bonusSacrifice = monsterBonusSacrifice(detail);
    const bonusEffetCibleMonstre = monsterBonusParEffetCible(detail);
    const bonusEffetPropre = monsterBonusParEffetPropre(detail);
    const bonusSelonCr = monsterBonusDegatsSelonCr(detail);
    const bonusSelonDef = monsterBonusDegatsSelonDef(detail);
    const bonusAtqSeuil = monsterBonusSiAtqSeuil(detail);
    const critInterdit = monsterCritInterdit(detail);
    const scenarioEntreCoups = s.scenariosEffetsEntreCoups?.[profile.skillCom2usId];
    // Blade Dancers (degats-et-aura 10b) : le cran d'ignore DEF RETENU par le
    // calcul, dans la MÊME phrase que le résumé du sort à l'écran.
    const ignoreDefRetenu = resumeIgnoreDefRetenu(profile, s);
    // Séquence curée (Blade Surge) : la séquence ENTIÈRE et la cible calculée,
    // avec les textes mêmes de l'écran (`resumeSequenceDeCoups`,
    // `CIBLE_DEGATS_LABELS`) — `resolvedHits` et `aoe` ne décrivent que la
    // donnée, jamais la séquence (degats-et-aura 8b).
    const sequence = profile.sequenceDeCoups;
    const cibleCalculee = cibleSecondairePriseEnCharge(profile.skillCom2usId)
      ? CIBLE_DEGATS_LABELS.find((c) => c.key === cibleDegatsRetenue(profile, s))?.label
      : undefined;
    // Même règle que le résumé de l'écran (`coupsAffichesDuSort`, P5a3) : sans build
    // ici, un coup en plus déduit de l'ATQ du build s'annonce en plage.
    const coupsAffiches = coupsAffichesDuSort(profile, s);
    console.log(
      `Dégâts réels : sort « ${profile.nom} » (S${profile.slot}, ${sequence ? resumeSequenceDeCoups(sequence) : `${coupsAffiches.dependDuBuild ? `${coupsAffiches.hits} à ${coupsAffiches.max}` : coupsAffiches.hits} coup(s)`}` +
        `${profile.hitsRange ? ` [variable ${profile.hitsRange.min}-${profile.hitsRange.max}${coupsAffiches.dependDuBuild ? ', selon l\'ATQ du build' : ''}]` : ''}` +
        `${!sequence && profile.aoe ? ', zone' : ''}${profile.ignoreDef ? ', ignore la DEF' : ''}` +
        `${ignoreDefRetenu ? `, ${ignoreDefRetenu.charAt(0).toLowerCase()}${ignoreDefRetenu.slice(1)}` : ''}` +
        `${profile.ignoreDefSelonVit ? `, ignore la DEF selon l'écart de VIT (100 % à ${profile.ignoreDefSelonVit.ecartMax}+ pts)` : ''}` +
        `${profile.skillupDamagePct ? `, +${profile.skillupDamagePct} % d'améliorations` : ''}) — ` +
        `${cibleCalculee ? `${cibleCalculee} — ` : ''}` +
        `cible ${s.enemyHp} PV / ${s.enemyDef} DEF` +
        `${profile.variables.some((v) => v === 'Relative SPD' || v === 'Target SPD') ? ` / ${s.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd} VIT` : ''} — ${critInterdit ? 'critique impossible' : `crit ${s.critMode}`}` +
        `${s.atkBuff ? ' — buff ATQ' : ''}${s.defBuff ? ' — buff DEF' : ''}${s.spdBuff ? ' — buff VIT' : ''}` +
        `${profile.bonusParEffetPropre?.source === 'buffs' ? ` — buffs propres ${resolvedBuffsPropresCount(profile.skillCom2usId, s)}/10` : ''}` +
        `${s.defBreak ? ' — def break avant' : ''}${s.defBreakParLeSort ? ' — def break posé par le sort' : ''}` +
        `${s.brand ? ' — marque' : ''}` +
        `${s.euldongActif ? ' — Euldong' : ''}${s.mirinaeActif ? ' — Mirinae' : ''}${s.deborahActif ? ' — Deborah' : ''}${s.miriamActif ? ' — Miriam' : ''}${s.transmissionActif ? ' — Dr. Matteo' : ''}${s.velaskaActif ? ` — Velaska (${s.velaskaPvPerduPct ?? 0}% PV perdus)` : ''}` +
        `${lead ? ` — lead ${lead.stat} +${lead.pct}%` : ''}` +
        `${bonusConditionnel && bonusDegatsConditionnelActif(bonusConditionnel, s) ? ` — ${bonusConditionnel.nom.replace(/\s*\(Passive\)\s*$/i, '')} (+${bonusConditionnel.pct}%)` : ''} — ` +
        // ⚠️ `?? DEFAULT` : une recette exportée AVANT ce champ n'en a pas.
        // L'élément vient du monstre CHARGÉ, jamais de la recette.
        `comp. invocateur ${s.summonerSkills ?? DEFAULT_DAMAGE_SETUP.summonerSkills} (${monsterElement ?? 'élément inconnu'}) — ` +
        `stats privilégiées [${damageRelevantStats(
          profile,
          passifs,
          s,
          monsterCritSiPlusRapide(detail),
          monsterBonusDegatsSelonVit(detail),
          monsterCritRateSelonVit(detail),
          bonusEcartDef,
          bonusFixeMaxHpPropre != null || bonusSacrifice != null,
          bonusSelonCr,
          bonusSelonDef,
          bonusAtqSeuil,
          {
            bonusParEffetCible: monsterBonusParEffetCible(detail) ?? undefined,
            conditionsCombat: monsterConditionsCombat(detail),
            combatStats: monsterCombatStatProfiles(detail),
            critInterdit,
          }
        ).join(', ')}]`
    );
    if (scenarioEntreCoups?.actif) {
      const poses = Object.entries(scenarioEntreCoups.apresCoup ?? {})
        .filter(([, hit]) => hit != null)
        .map(([effet, hit]) => `${effet} après le coup ${hit}`);
      console.log(
        `Scénario entre les coups : ${poses.length > 0 ? poses.join(', ') : 'aucune pose réussie'}` +
          `${scenarioEntreCoups.presentsInitialement?.length ? ` — déjà présents : ${scenarioEntreCoups.presentsInitialement.join(', ')}` : ''}.`
      );
    }
    if (bonusStatFixe) {
      console.log(`Ce monstre ajoute +${bonusStatFixe.cr} pts de Taux Crit et +${bonusStatFixe.cd} pts de Dgts Crit, toujours (Detect Weakspot).`);
    }
    if (critRateSelonVit) {
      console.log(`Ce monstre convertit sa VIT en Taux Crit (1 pt tous les ${critRateSelonVit.ptsParVit} pts), le surplus au-delà de 100 % en Dgts Crit.`);
    }
    if (bonusFixeCiblePvMax) {
      console.log(`Ce monstre ajoute +${bonusFixeCiblePvMax.pct} % des PV max de la cible au multiplicateur, toujours (Spear of Tenacity).`);
    }
    if (bonusEcartDef) {
      console.log(`Ce monstre ajoute ${bonusEcartDef.coeff * 100} % de son écart de DEF avec la cible au multiplicateur, toujours (Martial Arts Specialist).`);
    }
    if (bonusFixeMaxHpPropre) {
      console.log(`Ce monstre ajoute +${bonusFixeMaxHpPropre.pct} % de ses PV max, UNE FOIS par sort (Sickle Blade/Sand Blade).`);
    }
    if (bonusSacrifice) {
      const pv = Math.min(100, Math.max(0, s.pvActuelsAvantSacrificePct?.[bonusSacrifice.skillCom2usId] ?? 100));
      console.log(
        `Ce monstre se sacrifie ${bonusSacrifice.pctPerte} % de ses PV actuels chaque tour, +${bonusSacrifice.pctSurPerte} % de la perte en dégâts — PV actuels de la recette : ${pv} %.`
      );
    }
    if (bonusEffetCibleMonstre) {
      const c = s.effetsCibleCount?.[bonusEffetCibleMonstre.skillCom2usId] ?? 0;
      console.log(`Ce monstre ajoute +${bonusEffetCibleMonstre.pct} % par effet ${bonusEffetCibleMonstre.source} sur la cible — compte de la recette : ${c}.`);
    }
    if (bonusEffetPropre) {
      const c = s.effetsPropresCount?.[bonusEffetPropre.skillCom2usId] ?? 0;
      console.log(`Ce monstre ajoute +${bonusEffetPropre.pct} % par débuff sur lui-même — compte de la recette : ${c}.`);
    }
    if (bonusSelonCr) {
      console.log(`Ce monstre ajoute +${bonusSelonCr.ratio} % de dégâts par point de Taux Crit, toujours (Hidden Sense of Justice/Lethal Intent).`);
    }
    if (bonusSelonDef) {
      console.log(`Ce monstre majore ses dégâts selon sa DEF propre : +${bonusSelonDef.pctMax} % à ${bonusSelonDef.defMax} DEF ou plus (Aegis Shell).`);
    }
    if (bonusAtqSeuil) {
      console.log(
        `Ce monstre ajoute +${bonusAtqSeuil.pct} % de dégâts si son ATQ totale (avec lead) atteint ${bonusAtqSeuil.seuil}, toujours (Might of the Mercenary/Might of the Clan).`
      );
    }
    // `resolveArtifacts`, PAS `loaded.gear.artifacts` : ceux réellement
    // envoyés au moteur (réels, hypothétiques ou aucun selon la recette) —
    // même source que `params.artifacts` (défini plus bas dans ce fichier),
    // recalculée ici pour ne pas réordonner tout le script.
    const artefacts = artifactDamageProfile(resolveArtifacts(recipe, loaded));
    // ⚠️ Annoncé AVANT les effets : un verrou peut à lui seul expliquer que la
    // paire retenue soit plus faible qu'attendu, ou qu'il n'y en ait aucune.
    // Le taire ferait chercher la cause ailleurs.
    for (const l of recipe.lignesVerrouillees ?? []) {
      if (l.min > 0) console.log(`Ligne verrouillée : ${artifactSubName(l.code)} ≥ ${l.min} (cumulé sur la paire).`);
    }
    if (artefacts.ampliVitPct > 0)
      console.log(`Effet aug. VIT (artéfacts) : +${artefacts.ampliVitPct} % — amplifie le buff VIT s'il est actif.`);
    if (artefacts.ampliAtkPct > 0)
      console.log(`Effet renforcement ATQ (artéfacts) : +${artefacts.ampliAtkPct} % — amplifie le buff ATQ s'il est actif.`);
    if (artefacts.ampliDefPct > 0)
      console.log(`Effet renforcement DEF (artéfacts) : +${artefacts.ampliDefPct} % — amplifie le buff DEF s'il est actif.`);
    const lignesElement = Object.entries(artefacts.degatsElementPct);
    if (lignesElement.length > 0) {
      const vise = recipe.damageSetup?.enemyElement ?? null;
      const detail = lignesElement.map(([el, pct]) => `${el} +${pct} %`).join(', ');
      console.log(
        vise
          ? `Dgts infl. par élément (artéfacts) : ${detail} — élément visé : ${vise} (+${artefacts.degatsElementPct[vise] ?? 0} % appliqués).`
          : `Dgts infl. par élément (artéfacts) : ${detail} — AUCUN élément visé, ces lignes comptent 0.`
      );
    }
    if (monsterCritSiPlusRapide(detail)) {
      console.log(`Ce monstre force le critique quand il est plus rapide que l'adversaire (VIT adverse : ${s.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd}).`);
    }
    const bonusVit = monsterBonusDegatsSelonVit(detail);
    if (bonusVit) {
      console.log(
        `Ce monstre majore tous ses dégâts selon l'écart de VIT : +${bonusVit.pctMax} % à ${bonusVit.ecartMax} points d'écart ou plus (VIT adverse : ${s.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd}).`
      );
    }
    const bonusStack = monsterBonusDegatsStackable(detail);
    if (bonusStack) {
      const trigger = resolvedStackTrigger(bonusStack, s);
      const pct = resolvedStackPct(bonusStack, s);
      console.log(
        `Ce monstre porte un bonus de dégâts accumulable (« ${bonusStack.nom} », ${bonusStack.label} : jusqu'à ${bonusStack.triggerMax}${bonusStack.suffix}, +${bonusStack.ratio} % de dégâts par unité, plafond +${bonusStack.pctMax} %) — ${bonusStack.label} de la recette : ${trigger}${bonusStack.suffix} → +${pct} % de dégâts.`
      );
    }
    if (passifs.length > 0) {
      const detailPassifs = passifs
        .map((p) => {
          const coups = ` [${resolvedHits(p.profile, s)} coup(s)]`;
          // L'état affiché est celui du CALCUL, `passifCompte` avec le sort
          // RETENU (degats-et-aura 9b) — jamais `passifActif` seul, qui ignore
          // le sort. Un passif qui ne peut pas suivre ce sort dit pourquoi,
          // plutôt qu'un « désactivé » trompeur : lui-même choisi comme sort
          // (Tempest seul), ou slots déclencheurs curés qui l'excluent.
          if (!passifPeutSuivre(p, profile)) {
            return p.skillCom2usId === profile.skillCom2usId
              ? `${p.nom} (choisi comme sort : compté une seule fois)${coups}`
              : `${p.nom} (ne suit pas un S${profile.slot})${coups}`;
          }
          switch (p.categorie.type) {
            case 'toujours':
              return `${p.nom} (toujours actif)${coups}`;
            // Déclenchement DÉDUIT des deux réglages de réduction de défense —
            // aucun bouton, d'où l'état résolu affiché plutôt qu'un réglage.
            case 'defBreak':
              return `${p.nom} (def break : ${passifCompte(p, profile, s) ? 'DÉCLENCHÉ' : 'non déclenché'})${coups}`;
            // La base compte toujours ; le bouton ne porte que le surplus.
            case 'bonus':
              return `${p.nom} (base comptée, +${p.categorie.pct} % ${bonusPassifActif(p, s) ? 'ACTIVÉ' : 'désactivé par défaut'})${coups}`;
            default:
              return `${p.nom} (conditionnel, ${passifCompte(p, profile, s) ? 'activé' : 'désactivé par défaut'})${coups}`;
          }
        })
        .join(', ');
      console.log(`Passifs offensifs pris en compte : ${detailPassifs}`);
    }
  }
}

// Runes IMPOSÉES (`requirement.lockedRunes`) : un `runeId` est propre à un
// compte. Rejouer ici une recette exportée depuis un AUTRE compte (ou un
// export antérieur au re-runage) laisserait un verrou pointant dans le vide
// — le pool du slot tomberait à zéro et la recherche renverrait 0 build sans
// que rien ne l'explique. L'écran, lui, purge ces verrous à l'import (voir
// OptimizerSection.tsx) ; en CLI on AVERTIT plutôt que de modifier
// silencieusement la recette qu'on est censé rejouer telle quelle.
{
  const locks = recipe.requirement.lockedRunes ?? {};
  const entrees = Object.entries(locks).filter(([, id]) => id != null);
  if (entrees.length > 0) {
    const dispo = new Set(loaded.allRunes.map((r) => r.id));
    const absentes = entrees.filter(([, id]) => !dispo.has(id as number));
    console.log(
      `Runes imposées : ${entrees.map(([slot, id]) => `slot ${slot} → rune ${id}`).join(', ')} ` +
        `(le pool de ces emplacements tombe à 1).`
    );
    if (absentes.length > 0) {
      console.warn(
        `⚠️ ${absentes.length} rune(s) imposée(s) ABSENTE(S) de l'inventaire chargé (${absentes
          .map(([slot]) => `slot ${slot}`)
          .join(', ')}) — le pool de ces emplacements sera VIDE et la recherche renverra 0 build. ` +
          `Une recette portant des runes imposées n'est rejouable que sur le compte qui l'a exportée.`
      );
    }
  }
}



// Le contexte relique (garantie G) — la même ligne que le harnais
// (`diagnosticConfig.ts`) : en mode `recherche` les bornes sont RELÂCHÉES
// et les candidats sortent SANS relique ; la relique de chaque build est
// résolue après la recherche, comme la file de l'écran (6bis-b5c).
{
  const rc = params.relicContext;
  if (rc) {
    console.log(
      `Relique : mode ${rc.mode} (principale ${String(rc.principale)}, type ${String(rc.type)}, seuil +${rc.seuil}) — ` +
        `${rc.eligibles.length} éligible(s)${rc.vide ? `, pool vide (${rc.vide})` : ''}` +
        (rc.mode === 'recherche' ? ' — bornes relâchées, candidats collectés sans relique, relique résolue par build après la recherche' : '')
    );
  }
}

console.log('\nRecherche en cours (chemin de prod complet, séquentiel — peut prendre plusieurs minutes)…');
let result: ReturnType<typeof runSearchToCompletion>;
try {
  result = runSearchToCompletion(params);
} catch (e) {
  // Refus NOMMÉ du moteur (pool de reliques vide en mode recherche, D1) :
  // imprimé tel quel, jamais présenté comme « 0 build ».
  if (e instanceof RechercheRefusee) {
    console.error(`\n${e.message}`);
    process.exit(2);
  }
  throw e;
}

console.log(
  `\n${result.candidates.length} build(s) trouvé(s) — tronqué : ${result.truncated} — ` +
    `${result.explored.toLocaleString('fr-FR')} paires explorées — ` +
    `prep ${result.prepMs.toFixed(0)}ms · construction ${result.buildWallMs.toFixed(0)}ms · ` +
    `appariement ${result.pairingMs.toFixed(0)}ms · total ${(result.totalMs / 1000).toFixed(1)}s`
);
// ⚠️ **Trier AVANT d'afficher.** `result.candidates` sort dans l'ordre de
// collecte de l'appariement, pas classé par l'objectif : ce script affichait
// jusqu'ici 20 candidats ARBITRAIRES en les présentant comme des résultats.
// Un diagnostic s'y est laissé prendre et a conclu à tort que le moteur
// manquait un build meilleur — il était là, au rang 6. `sortCandidates` est
// la même porte que l'écran, pour qu'ils ne puissent plus diverger.
const realDamage = buildRealDamageContext(recipe, loaded.com2usId, params.artifacts);
if (recipe.objective === 'degats_reels' && !realDamage) {
  console.warn(`⚠️ Aucun sort calculable pour ${loaded.monsterName} — le classement reste dans l'ordre de collecte.`);
}
const runeByIdPool = new Map(params.pool.map((r) => [r.id, r]));
// ⚠️ Les producteurs MÊMES de l'écran (6bis-b5a, 6bis-b5c), assemblés dans
// `classerCommeLEcran` (scripts/lib/classementCli.ts) : l'ordre de base
// (`optionsDeClassement`), puis — là où l'écran a une file, optimisation
// d'artéfacts active (`ignoreArtifacts` faux) — la résolution de
// l'équipement et le classement de l'écran (`classementResolu`). Par défaut
// comme la file de l'écran (`kDeLaFile` : l'ordre de base jusqu'à 300
// combinaisons confirmées en mode relique « recherche », 100 sinon — 6bis-b18
// —, et lignes imprimées, jusqu'au point fixe) ; tous les candidats avec
// `--resoudre-tout`. Mode `recherche` : couple artéfacts/relique résolu
// ensemble, couples infaisables rejetés ; sinon la paire seule, avec la
// relique de la fiche.
const { classes, options: optionsAffichees, resolu } = classerCommeLEcran({
  recipe,
  loaded,
  params,
  candidates: result.candidates,
  realDamage,
  toutResoudre,
});
if (resolu) {
  console.log(
    resolu.mode === 'tout'
      ? `Équipement résolu pour TOUS les candidats (--resoudre-tout) : ${resolu.parBuild.size} build(s), ` +
          `${resolu.rejetes} rejeté(s) faute de couple artéfacts/relique faisable — ${resolu.ms.toFixed(0)}ms`
      : `Équipement résolu comme la file de l'écran : ${resolu.parBuild.size} build(s) sur ${result.candidates.length} — ` +
          (Number.isFinite(resolu.K)
            ? `l'ordre de base jusqu'à ${resolu.K} combinaisons confirmées (ou jusqu'au dernier build trouvé)`
            : `toutes les combinaisons trouvées (« Vérifier toutes les combinaisons trouvées » dans la recette)`) +
          ` et les ${LIGNES_IMPRIMEES} lignes imprimées, jusqu'au point fixe ` +
          `(${resolu.lots} lot(s)) — ${resolu.parBuild.size - resolu.rejetes} confirmée(s), ${resolu.rejetes} rejeté(s) faute de couple artéfacts/relique faisable — ${resolu.ms.toFixed(0)}ms. ` +
          `Les autres candidats restent classés dans l'ordre de base, non résolus ; --resoudre-tout pour tout résoudre.`
  );
  if (result.truncated) {
    console.log(`⚠️ Recherche tronquée : le classement résolu ne porte que sur les ${result.candidates.length} candidat(s) collecté(s).`);
  }
  if (classes.length === 0 && result.candidates.length > 0) {
    console.log('⚠️ Aucun build ne reste : chaque candidat collecté est rejeté faute de couple artéfacts/relique faisable.');
  }
} else if (toutResoudre) {
  console.log('--resoudre-tout sans effet : aucune résolution ici (optimisation d’artéfacts coupée, comme l’écran sans file).');
}
{
  const etat = etatReliqueDuBuild(undefined, params.relicContext, params.relic);
  console.log(
    etat.etat === 'fixe'
      ? `Effet unique de relique dans le tri : ${etat.relique ? 'compté (relique de la fiche)' : 'aucune relique'}`
      : resolu
        ? `Effet unique de relique dans le tri : compté (relique retenue par build résolu${resolu.mode === 'file' ? ' ; neutre pour un build non résolu' : ''})`
        : 'Effet unique de relique dans le tri : neutre (mode recherche sans résolution — espèce introuvable)'
  );
}
console.log(`\nLes ${LIGNES_IMPRIMEES} meilleurs pour l'objectif « ${recipe.objective} » :`);
// ⚠️ Le score affiché est `scoreDuCandidat` avec les options MÊMES du
// classement (6bis-b4) : la valeur qui classe, jamais une formule recopiée.
// Les sets actifs viennent d'`activeSets` et les activations d'aura propres
// du même `aurasPropresDe` que le score — ce qui permet de lire, sur un vrai
// compte, combien de sets d'aura CE build ajoute aux auras externes. Après
// résolution, la relique et les artéfacts RETENUS pour ce build.
for (const c of classes.slice(0, LIGNES_IMPRIMEES)) {
  const score = scoreDuCandidat(c, recipe.objective, optionsAffichees);
  const sets = activeSets(c.runeIds.map((id) => runeByIdPool.get(id)?.set ?? ''));
  const propres = Object.entries(optionsAffichees.aurasPropresDe(c)).filter(([, n]) => n > 0).map(([set, n]) => `${set} ${n}`);
  const joker = c.runeIds.some((id) => runeByIdPool.get(id)?.set === 'intangible');
  const r = resolu?.parBuild.get(cleBuild(c));
  const equipement = r
    ? ` — relique ${r.relique?.id ?? params.relic?.id ?? 'aucune'}${r.relique ? '' : ' (fiche)'} — artéfacts [${r.artefacts.map((a) => a.id).join(',')}]`
    : '';
  console.log(
    `  runes [${c.runeIds.join(',')}] — score ${score == null ? '—' : score.toFixed(1)} — ` +
      `sets [${sets.join('+') || 'aucun'}]${joker ? ' (Intangible)' : ''} — auras propres ${propres.join(', ') || 'aucune'}${equipement}`
  );
}
if (classes.length > LIGNES_IMPRIMEES) console.log(`  … et ${classes.length - LIGNES_IMPRIMEES} de plus.`);

// ⚠️ Sous-produit GRATUIT de `pairBuckets` (voir spec/outils/optimizer/
// moteur/diagnostics.md, « Quasi-succès à l'appariement ») — jamais recalculé, seulement mis en forme.
// Rendu SEULEMENT quand rien n'a été trouvé : sinon rien à chercher.
if (result.candidates.length === 0) {
  const runeById = new Map(params.pool.map((r) => [r.id, r]));
  // ⚠️ Même vocabulaire que le bloc de blocages du harnais (« −15 suffit »)
  // — décision explicite (2026-09-07) : un seul réflexe de lecture pour
  // tout le diagnostic.
  const describe = (m: NearMiss) =>
    m.shortfalls
      .map((s) => {
        const seuil = s.kind === 'min' ? s.requested - s.shortfall : s.requested + s.shortfall;
        const signe = s.kind === 'min' ? '−' : '+';
        return `${s.key} ${signe}${s.shortfall} suffirait (${s.kind === 'min' ? '≥' : '≤'} ${seuil})`;
      })
      .join(', ') + ` — ${candidateMetricTotal(m, runeById, recipe.metric).toFixed(1)}`;
  console.log('\nQuasi-succès à l’appariement — sous-produit gratuit de la vraie recherche :');
  if (result.globalNearMiss) {
    console.log(`  le plus proche, toutes conditions confondues : ${describe(result.globalNearMiss)}`);
  } else {
    console.log('  aucune paire explorée n’a jamais atteint le test conjoint exact (rejetée plus tôt)');
  }
  if (result.nearMissByCondition.length > 0) {
    console.log('  par condition (satisfait TOUT le reste, ne manque QUE celle-ci) :');
    for (const e of result.nearMissByCondition) {
      console.log(`    ${e.key} (${e.kind}) : ${describe(e.miss)}`);
    }
  }
}
