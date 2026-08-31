// Rejoue une recherche Optimizer EXACTEMENT telle qu'exportée depuis l'écran
// (bouton « Exporter les paramètres », voir OptimizerSection.tsx et
// src/lib/optimizerRecipe.ts), sur un export de compte réel — sans jamais
// retranscrire les réglages à la main. Ferme la boucle ouverte par
// l'investigation du cas Sonia : la recette vient de l'écran, pas d'une
// reconstruction manuelle sujette aux mêmes erreurs de fidélité que celles
// rencontrées cette session-là (voir le skill algo-verify).
//
// Usage : optimizer-search.ts <export.json> <recipe.json> [--rta] [--siege=<deckId>[:defense]]
//   --rta   : charge le monstre depuis son preset RTA (favoris/runé RTA) au
//             lieu de son build « Mon compte » (défaut).
//   --siege : charge le monstre depuis un deck de siège précis — offense par
//             défaut, `--siege=15:defense` pour un deck de défense.
// Un seul mode à la fois : sans `--rta` ni `--siege`, box (« Mon compte »).

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import {
  loadBoxMonster,
  loadRtaMonster,
  loadSiegeMonster,
  loadBoxItemsForExclusion,
  loadRtaEntriesForExclusion,
  loadSiegeTeamsForExclusion,
  printMonsterSummary,
} from './lib/loadMonster';
import { recipeToSearchParams, resolveArtifacts } from './lib/recipeToSearchParams';
import { loadMonsterSkills } from './lib/skillsData';
import { loadMonstersList } from './lib/monstersData';
import {
  DEFAULT_DAMAGE_SETUP,
  bonusDegatsConditionnelActif,
  bonusPassifActif,
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
  monsterCritSiPlusRapide,
  monsterDamageSkills,
  monsterOffensivePassives,
  passifActif,
  resolveDamageSkill,
  resolvedHits,
  resolvedLeaderSkill,
  resolvedStackPct,
  resolvedStackTrigger,
  artifactDamageProfile,
} from '../src/lib/damage';
import { runSearchToCompletion } from './lib/runSearch';
import { buildRealDamageContext } from './lib/realDamageCli';
import { sortCandidates } from '../src/lib/runeBuildOptim';
import { ExclusionSourceData, autoExcludedRuneIds, resolveExcludedRuneIds } from '../src/lib/optimizerExclusion';

const [exportPath, recipePath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const rtaMode = process.argv.includes('--rta');
const siegeArg = process.argv.find((a) => a.startsWith('--siege='))?.slice('--siege='.length);
if (!exportPath || !recipePath) {
  console.error('Usage: optimizer-search.ts <export.json> <recipe.json> [--rta] [--siege=<deckId>[:defense]]');
  process.exit(1);
}
if (rtaMode && siegeArg != null) {
  console.error('--rta et --siege sont exclusifs — un seul mode de chargement à la fois.');
  process.exit(1);
}

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}

// ⚠️ Un objectif retiré (`speed_nuker`, `degats`) peut encore apparaître dans
// une recette exportée avant son retrait (`parseOptimizerRecipe` ne valide
// pas `objective` contre le type) — même repli que l'écran
// (`OptimizerSection.tsx`, `importRecipe`), pour ne jamais faire diverger ce
// script du chemin de prod sur une recette ancienne.
const legacyObjective = recipe.objective as unknown as string;
if (legacyObjective === 'speed_nuker' || legacyObjective === 'degats') {
  console.warn(`⚠️ Objectif retiré « ${legacyObjective} » dans la recette — repli sur « efficience » (comme l'écran).`);
  recipe.objective = 'efficience';
}

console.log(
  `Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — objectif ${recipe.objective} — ` +
    `métrique ${recipe.metric} — préfiltrage ${recipe.slotFilterPreset} — ` +
    `piste B ${recipe.adaptiveTrancheWeighting ? 'ON' : 'off'} — exclure les runes déjà utilisées ${
      recipe.excludeUsedRunes ? `ON (${recipe.excludeUsedScope})` : 'off'
    }`
);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);
if (recipe.requirement.maxStats && Object.keys(recipe.requirement.maxStats).length > 0) {
  console.log(`maxStats : ${JSON.stringify(recipe.requirement.maxStats)}`);
}

const loaded = rtaMode
  ? loadRtaMonster(exportPath, recipe.monsterName)
  : siegeArg != null
    ? (() => {
        const [deckIdRaw, variant] = siegeArg.split(':');
        const deckId = Number(deckIdRaw);
        if (!Number.isFinite(deckId)) {
          console.error(`--siege=<deckId>[:defense] : deckId invalide (${deckIdRaw}).`);
          process.exit(1);
        }
        return loadSiegeMonster({ exportPath, deckId, monsterName: recipe.monsterName, defense: variant === 'defense', rest: [] });
      })()
    : loadBoxMonster(exportPath, recipe.monsterName);
const modeLabel = rtaMode ? 'RTA' : siegeArg != null ? 'siège' : 'box';
printMonsterSummary(modeLabel, loaded);

if (loaded.com2usId !== recipe.monsterCom2usId) {
  console.warn(
    `⚠️ com2usId chargé (${loaded.com2usId}) ≠ com2usId de la recette (${recipe.monsterCom2usId}) — ` +
      `même nom, mais peut-être pas le même monstre (homonyme de données ?). Vérifie avant de faire confiance au résultat.`
  );
}

// `exclusionData` (box + RTA + siège + monsterById) : chargée seulement si
// la recette en a besoin (automatique ET/OU manuelle) — coûte 3 lectures/
// parsages supplémentaires (box, RTA, les 2 siège) qu'une recette sans
// aucune exclusion n'a aucune raison de payer.
let exclusionData: ExclusionSourceData | undefined;
if (recipe.excludeUsedRunes || (recipe.excludedSelectors && recipe.excludedSelectors.length > 0)) {
  const monsterById = new Map(loadBoxItemsForExclusion(exportPath).map((b) => [String(b.monster.id), b.monster]));
  exclusionData = {
    box: loadBoxItemsForExclusion(exportPath),
    rtaEntries: loadRtaEntriesForExclusion(exportPath),
    siegeDefenseTeams: loadSiegeTeamsForExclusion(exportPath, true),
    siegeOffenseTeams: loadSiegeTeamsForExclusion(exportPath, false),
    monsterById,
  };
}

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
  // ⚠️ `SiegeTeam.id` est régénéré ALÉATOIREMENT à chaque chargement (voir
  // loadMonster.ts, `loadSiegeTeamsForExclusion`) — un SÉLECTEUR siège
  // exporté depuis l'écran (qui porte ce `teamId`) ne matchera JAMAIS un id
  // généré ici. Prévenir explicitement plutôt que laisser
  // `resolveExcludedRuneIds` l'ignorer en silence sans que personne ne
  // comprenne pourquoi.
  const siegeSelectors = recipe.excludedSelectors.filter((s) => s.source === 'siege-defense' || s.source === 'siege-offense');
  if (siegeSelectors.length > 0) {
    console.warn(
      `⚠️ ${siegeSelectors.length} exclusion(s) manuelle(s) de la recette viennent du Siège — ce script régénère des identifiants d'équipe DIFFÉRENTS à chaque exécution (voir loadMonster.ts) et ne peut donc PAS les résoudre fidèlement. Elles seront silencieusement ignorées ci-dessous (pool plus large que sur l'écran).`
    );
  }
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
    console.log(
      `Dégâts réels : sort « ${profile.nom} » (S${profile.slot}, ${resolvedHits(profile, s)} coup(s)` +
        `${profile.hitsRange ? ` [variable ${profile.hitsRange.min}-${profile.hitsRange.max}]` : ''}` +
        `${profile.aoe ? ', zone' : ''}${profile.ignoreDef ? ', ignore la DEF' : ''}` +
        `${profile.ignoreDefSelonVit ? `, ignore la DEF selon l'écart de VIT (100 % à ${profile.ignoreDefSelonVit.ecartMax}+ pts)` : ''}` +
        `${profile.skillupDamagePct ? `, +${profile.skillupDamagePct} % d'améliorations` : ''}) — ` +
        `cible ${s.enemyHp} PV / ${s.enemyDef} DEF` +
        `${profile.variables.includes('Relative SPD') ? ` / ${s.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd} VIT` : ''} — crit ${s.critMode}` +
        `${s.atkBuff ? ' — buff ATQ' : ''}${s.defBuff ? ' — buff DEF' : ''}${s.spdBuff ? ' — buff VIT' : ''}` +
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
          bonusAtqSeuil
        ).join(', ')}]`
    );
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
          switch (p.categorie.type) {
            case 'toujours':
              return `${p.nom} (toujours actif)${coups}`;
            // Déclenchement DÉDUIT des deux réglages de réduction de défense —
            // aucun bouton, d'où l'état résolu affiché plutôt qu'un réglage.
            case 'defBreak':
              return `${p.nom} (def break : ${passifActif(p, s) ? 'DÉCLENCHÉ' : 'non déclenché'})${coups}`;
            // La base compte toujours ; le bouton ne porte que le surplus.
            case 'bonus':
              return `${p.nom} (base comptée, +${p.categorie.pct} % ${bonusPassifActif(p, s) ? 'ACTIVÉ' : 'désactivé par défaut'})${coups}`;
            default:
              return `${p.nom} (conditionnel, ${passifActif(p, s) ? 'activé' : 'désactivé par défaut'})${coups}`;
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

const params = recipeToSearchParams(recipe, loaded, exclusionData);

console.log('\nRecherche en cours (avec escalade du budget, comme l\'app réelle — peut prendre plusieurs minutes)…');
const result = runSearchToCompletion(params);

console.log(
  `\n${result.candidates.length} build(s) trouvé(s) — tronqué : ${result.truncated} — ` +
    `${result.explored.toLocaleString('fr-FR')} paires explorées (escalade x${result.escalations}) — ` +
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
const classes = sortCandidates(result.candidates, recipe.objective, {
  realDamage,
  runeById: new Map(params.pool.map((r) => [r.id, r])),
  metric: recipe.metric,
});
console.log(`\nLes 20 meilleurs pour l'objectif « ${recipe.objective} » :`);
for (const c of classes.slice(0, 20)) {
  console.log(`  runes [${c.runeIds.join(',')}]`);
}
if (classes.length > 20) console.log(`  … et ${classes.length - 20} de plus.`);
