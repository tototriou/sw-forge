// Le harnais de diagnostic de l'Optimizer, en ligne de commande — la
// coquille MINCE : elle lit des arguments, appelle `executerHarnais` et met
// en forme. Toute la logique vit dans `scripts/lib/diagnostic*.ts`.
//
// ⚠️ **Il remplace l'écriture d'un script de diagnostic ad hoc.** Le motif
// qu'il supprime : des scripts qui reconstruisent à la main des morceaux du
// pipeline (le contexte min/max, les bornes d'artéfact, un `totalOf` maison)
// et qui dérivent du vrai moteur sans que rien ne le signale — un script
// infidèle qui ne trouve rien ressemble EXACTEMENT à un vrai bug.
//
// ⚠️ **Restitution en DEUX PALIERS**, parce que l'aperçu n'est pas gratuit :
//   - palier 1, INSTANTANÉ : la configuration effective, l'origine de chaque
//     paramètre, le drapeau de fidélité. Rien n'est exécuté. C'est ce qui
//     permet de challenger un run AVANT de le laisser tourner vingt minutes
//     pour un résultat faux — `--apercu` s'arrête là.
//   - palier 2, ~2 s : les tailles de pool par emplacement à chaque étage de
//     la préparation, et le suivi des runes demandées.
// Le vrai risque de temps est APRÈS, dans la construction des demi-builds et
// l'appariement : le point d'arrêt naturel pour relire est entre les deux.
//
// Usage — source RECETTE (fidélité maximale, chemin de prod complet) :
//   diagnostic-harness.ts --compte=<export.json> --recette=<recipe.json>
//                         [--rta | --siege=<deckId>[:defense]]
//
// Usage — source SYNTHÉTIQUE (reproductible, pool forcé) :
//   diagnostic-harness.ts --synthetique --seed=42 --runes=20 --cap=80
//                         [--sets=violent,will] [--min=spd:130,cr:40]
//                         [--max=res:60] [--assortiment=joker|sans-joker|varies]
//                         [--verrous=<slot:runeId,…>]  runes IMPOSÉES
//
// Usage — LOT sur les cas connus de `perfShared.ts` (§5.3 des extensions) :
//   diagnostic-harness.ts --cas=tous          les 7 cas, l'un après l'autre
//   diagnostic-harness.ts --cas=3             par indice
//   diagnostic-harness.ts --cas=ciri          par fragment de libellé
// ⚠️ N runs INDÉPENDANTS d'UNE condition, jamais un différentiel — le lot
// fait varier le CAS, pas le réglage. Le coût est ANNONCÉ avant d'être payé,
// et `--apercu` reste utile : il rend les N paliers 1 sans rien exécuter.
//
// Options communes :
//   --apercu               palier 1 seulement — n'exécute RIEN
//   --arret=<étape>        mainstat | dominance | feasibility | filterslot
//                          | demi-builds | appariement | classement (défaut)
//   --suivre=<id,id,…>     suit ces runes d'étage en étage — pour une rune
//                          qui atteint filterSlot, rend aussi son rang
//                          exact (relevance() + par stat) ; si les 3 ids
//                          d'une même moitié (1-3 ou 4-6) y sont TOUS, rend
//                          en plus le rang du demi-build dans son
//                          compartiment et les mieux classés à côté de lui
//   --blocages             cherche, par condition, DE COMBIEN la desserrer
//                          suffit (⚠️ COÛTEUX : une dichotomie par condition ;
//                          calculé d'office si la recherche ne rend rien)
//   --progression          A₂ : horodate les BuildingProgress de buildBuckets
//                          et rend la DISTRIBUTION des intervalles par moitié
//                          — cartographie de l'ÉLAGAGE (⚠️ ne départage PAS
//                          l'asymétrie A/B : voir l'avertissement imprimé)
//   --repetitions=<n>      répétitions de la mesure de temps (défaut 1)
//   --json                 sort le résultat brut, sans mise en forme
// Overrides (⚠️ chacun MARQUE le run comme divergent de la prod) :
//   --slotFilterCap=<n>  --bucketCap=<n>  --maxCollected=<n>  --maxMs=<n>
//   --regime=sequentiel|parallele  --combos=potential|relevance|combined|objective

import { executerHarnaisResolu } from './lib/diagnosticHarness';
import { rendreParametres, resoudreConfig } from './lib/diagnosticConfig';
import {
  OptionsLot,
  annoncerLot,
  executerLot,
  rendreRecapLot,
  resoudreCas,
  resoudreSelectionCas,
  verifierComptesDisponibles,
} from './lib/diagnosticLot';
import { SETS_JOKER, SETS_SANS_JOKER, SETS_VARIES } from './lib/randomPool';
import {
  ArretApres,
  ConfigHarnais,
  OverridesHarnais,
  RegimeAppariement,
  ResultatHarnais,
  SyntheticRequirement,
} from './lib/diagnosticTypes';
import { ModeChargement } from './lib/chargerRecette';
import { StatKey } from '../src/lib/effects';
import { ALL_STAT_KEYS } from '../src/lib/runeBuildOptim';

const args = process.argv.slice(2);
const drapeau = (nom: string) => args.includes(`--${nom}`);
const valeur = (nom: string): string | undefined =>
  args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);

/* --------------------------------------------------------------------------
 * Lecture des arguments — ⚠️ **« aucun repli silencieux » (§4.4 règle 4)
 * vaut AUSSI pour la ligne de commande.**
 *
 * C'est la règle que ce module existe pour tenir, et elle était enfreinte
 * ici même : `--combos=foobar` traversait le CLI par un simple `as`,
 * atteignait `buildBuckets` et changeait le PARCOURS de construction en
 * silence ; `--assortiment=foobar` retombait sur `SETS_JOKER` sans le dire ;
 * `--suivre=abc` produisait `NaN` ; `--siege=abc` un `deckId` `NaN`. Un
 * harnais qui accepte une valeur qu'il n'a pas comprise mesure autre chose
 * que ce qui a été demandé — avec l'autorité d'un diagnostic.
 *
 * D'où des lecteurs TYPÉS et bornés, sur le modèle déjà écrit pour
 * `--regime` : rien ne se lit sans une liste de valeurs admises ou une
 * borne métier, et un refus nomme toujours ce qui était attendu.
 * ----------------------------------------------------------------------- */

function refuser(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Une valeur d'un ensemble FERMÉ — jamais un `as` sur une chaîne libre. */
function lireEnum<T extends string>(nom: string, admises: readonly T[]): T | undefined {
  const v = valeur(nom);
  if (v == null) return undefined;
  if (!(admises as readonly string[]).includes(v)) {
    refuser(`--${nom} : ${admises.join(' | ')} — reçu « ${v} ».`);
  }
  return v as T;
}

/**
 * Un entier BORNÉ. ⚠️ La borne est métier, pas décorative : un
 * `--repetitions=0` ne répète rien, un `--cap=-3` ne veut rien dire, un
 * `--seed=1.5` ne rejoue pas le même pool.
 */
function lireEntier(nom: string, min: number, max = Number.MAX_SAFE_INTEGER): number | undefined {
  const v = valeur(nom);
  if (v == null) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    const attendu = max === Number.MAX_SAFE_INTEGER ? `entier ≥ ${min}` : `entier entre ${min} et ${max}`;
    refuser(`--${nom} : ${attendu} attendu — reçu « ${v} ».`);
  }
  return n;
}

/** Un réel strictement positif — pour `--maxMs`, qui n'a pas à être entier. */
function lireReelPositif(nom: string): number | undefined {
  const v = valeur(nom);
  if (v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    refuser(`--${nom} : nombre strictement positif attendu — reçu « ${v} ».`);
  }
  return n;
}

/** Une liste d'identifiants — ⚠️ `--suivre=abc` produisait `NaN` en silence. */
function lireListeEntiers(nom: string): number[] | undefined {
  const v = valeur(nom);
  if (v == null) return undefined;
  return v.split(',').map((brut) => {
    const n = Number(brut.trim());
    if (brut.trim() === '' || !Number.isInteger(n) || n <= 0) {
      refuser(`--${nom} : entiers positifs séparés par des virgules — reçu « ${brut} ».`);
    }
    return n;
  });
}

const ARRETS: ArretApres[] = ['mainstat', 'dominance', 'feasibility', 'filterslot', 'demi-builds', 'appariement', 'classement'];
const REGIMES: RegimeAppariement[] = ['sequentiel', 'parallele'];
const COMBOS: NonNullable<OverridesHarnais['combosOrderMode']>[] = ['potential', 'relevance', 'combined', 'objective'];
const ASSORTIMENTS = ['joker', 'sans-joker', 'varies'] as const;

/**
 * ⚠️ La CLÉ est validée, pas seulement la valeur : `--min=foobar:130`
 * posait une condition sur une statistique qui n'existe pas, donc une
 * condition que rien ne pouvait satisfaire — et le harnais l'aurait
 * diagnostiquée comme un « 0 build » du moteur.
 */
function lireStats(nom: string): Partial<Record<StatKey, number>> {
  const brut = valeur(nom);
  if (!brut) return {};
  const out: Partial<Record<StatKey, number>> = {};
  for (const paire of brut.split(',')) {
    const [k, v] = paire.split(':');
    const cle = k?.trim();
    const n = Number(v);
    if (!cle || !Number.isFinite(n)) {
      refuser(`--${nom} : format « stat:valeur » séparé par des virgules — reçu « ${paire} ».`);
    }
    if (!(ALL_STAT_KEYS as string[]).includes(cle)) {
      refuser(`--${nom} : statistique inconnue « ${cle} » — attendu ${ALL_STAT_KEYS.join(' | ')}.`);
    }
    out[cle as StatKey] = n;
  }
  return out;
}

/**
 * Tout ce qu'une `ConfigHarnais` porte EN PLUS de sa source — c'est-à-dire
 * exactement ce qu'un LOT garde constant d'un cas à l'autre.
 *
 * ⚠️ Extrait de `construireConfig` plutôt que recopié dans le chemin du lot :
 * une option ajoutée au CLI (comme `--progression` l'a été pour A₂) doit
 * atteindre les deux chemins par construction, pas parce qu'on y a pensé.
 */
function construireCommun(): OptionsLot {
  const overrides: OverridesHarnais = {};
  const slotFilterCap = lireEntier('slotFilterCap', 1);
  if (slotFilterCap != null) overrides.slotFilterCap = slotFilterCap;
  const bucketCap = lireEntier('bucketCap', 1);
  if (bucketCap != null) overrides.bucketCap = bucketCap;
  const maxCollected = lireEntier('maxCollected', 1);
  if (maxCollected != null) overrides.maxCollected = maxCollected;
  const maxMs = lireReelPositif('maxMs');
  if (maxMs != null) overrides.maxMs = maxMs;
  const regime = lireEnum('regime', REGIMES);
  if (regime != null) overrides.regime = regime;
  // ⚠️ Le `as` qui vivait ici laissait `--combos=foobar` atteindre
  // `buildBuckets` et changer le parcours de construction en silence.
  const combos = lireEnum('combos', COMBOS);
  if (combos != null) overrides.combosOrderMode = combos;

  return {
    overrides,
    arretApres: lireEnum('arret', ARRETS) ?? 'classement',
    suivre: lireListeEntiers('suivre'),
    blocages: drapeau('blocages'),
    // ⚠️ OPT-IN jusqu'ici : le worker de construction est PARTAGÉ avec
    // `perf-battery.ts`, l'outil de mesure de référence, qui ne doit rien
    // payer. Un défaut à `true` le ferait payer par ricochet.
    horodaterProgression: drapeau('progression'),
    repetitions: lireEntier('repetitions', 1),
  };
}

function construireConfig(): ConfigHarnais {
  const commun = construireCommun();

  if (drapeau('synthetique')) {
    // ⚠️ Les runes IMPOSÉES sont exposées ici parce qu'elles sont la cause
    // n° 1 d'un « 0 build » qui n'a rien d'algorithmique : un verrou dont la
    // rune n'existe pas dans le pool vide l'emplacement EXPRÈS. Le mode
    // recette les porte déjà (`recipe.requirement.lockedRunes`) ; sans
    // équivalent ici, ce cas ne serait pas reproductible sans compte réel.
    const verrous: Partial<Record<number, number>> = {};
    for (const paire of valeur('verrous')?.split(',') ?? []) {
      const [slot, id] = paire.split(':').map((s) => Number(s.trim()));
      // ⚠️ L'emplacement est borné à 1-6 : un `--verrous=7:123` posait un
      // verrou sur un emplacement inexistant, donc silencieusement ignoré.
      if (!Number.isInteger(slot) || slot < 1 || slot > 6 || !Number.isInteger(id) || id <= 0) {
        refuser(`--verrous : format « slot:runeId » (emplacement 1-6, identifiant entier positif) — reçu « ${paire} ».`);
      }
      verrous[slot] = id;
    }
    const requirement: SyntheticRequirement = {
      sets: valeur('sets')?.split(',').map((s) => s.trim()) ?? [],
      minStats: lireStats('min'),
      maxStats: lireStats('max'),
      ...(Object.keys(verrous).length > 0 ? { lockedRunes: verrous } : {}),
    };
    // ⚠️ Validé, jamais replié : `--assortiment=foobar` retombait sur
    // `SETS_JOKER` en silence, donc mesurait un autre pool que celui demandé.
    const assortiment = lireEnum('assortiment', ASSORTIMENTS) ?? 'joker';
    const sets =
      assortiment === 'sans-joker' ? SETS_SANS_JOKER : assortiment === 'varies' ? SETS_VARIES : SETS_JOKER;
    // ⚠️ `--cap` n'a PAS de défaut, volontairement : voir la règle « aucun
    // repli silencieux » dans diagnosticConfig.ts. Le laisser vide ferait
    // mesurer la moitié de la rétention de production, en silence — et
    // c'est `resoudreConfig` qui le refuse, avec le détail des deux axes.
    return {
      source: {
        type: 'synthetique',
        // ⚠️ La graine accepte 0 (valeur légitime de `mulberry32`), pas un
        // réel : `--seed=1.5` ne rejoue pas le même pool.
        seed: lireEntier('seed', 0) ?? 1,
        runesParEmplacement: lireEntier('runes', 1) ?? 20,
        sets,
        requirement,
        slotFilterCap: lireEntier('cap', 1)!,
      },
      ...commun,
    };
  }

  const compte = valeur('compte');
  const recette = valeur('recette');
  if (!compte || !recette) {
    console.error(
      'Il faut soit --synthetique, soit --compte=<export.json> --recette=<recipe.json>.\n' +
        'Voir l’en-tête de ce fichier pour la liste complète des options.'
    );
    process.exit(1);
  }
  const siege = valeur('siege');
  const mode: ModeChargement = drapeau('rta')
    ? { type: 'rta' }
    : siege != null
      ? (() => {
          const [id, variante] = siege.split(':');
          const deckId = Number(id);
          // ⚠️ `--siege=abc` donnait un `deckId` NaN, et `--siege=3:attaque`
          // basculait en attaque sans le dire (tout ce qui n'était pas
          // « defense » valait « pas défense »).
          if (!Number.isInteger(deckId) || deckId <= 0) {
            refuser(`--siege : format « deckId[:defense] », deckId entier positif — reçu « ${siege} ».`);
          }
          if (variante != null && variante !== 'defense') {
            refuser(`--siege : la seule variante admise est « defense » — reçu « ${variante} ».`);
          }
          return { type: 'siege' as const, deckId, defense: variante === 'defense' };
        })()
      : { type: 'box' };
  return { source: { type: 'recette', cheminCompte: compte, cheminRecette: recette, mode }, ...commun };
}

/* --------------------------------------------------------------------------
 * Mise en forme
 * ----------------------------------------------------------------------- */

const ms = (n: number) => `${n.toFixed(0)} ms`;
const nb = (n: number) => n.toLocaleString('fr-FR');
const mo = (octets: number) => `${(octets / 1024 / 1024).toFixed(1)} Mo`;
/**
 * Un intervalle d'A₂. ⚠️ Format à part : `ms()` arrondit à l'unité, ce qui
 * afficherait « 0 ms » sur la quasi-totalité d'une série par rune extérieure
 * — donc une distribution entièrement plate, exactement le contraire de ce
 * que cet instrument existe pour montrer.
 */
const msFin = (n: number) => (n >= 1 ? `${n.toFixed(1)} ms` : `${(n * 1000).toFixed(0)} µs`);

function rendreResultat(r: ResultatHarnais): string {
  const l: string[] = [];

  // ── Palier 2 : la préparation, étage par étage.
  l.push('', 'Préparation — runes restantes par emplacement', '─'.repeat(72));
  for (const t of r.preparation) {
    l.push(`  ${t.etage.padEnd(12)} [${t.nature.padEnd(10)}] ${t.parEmplacement.map((n) => String(n).padStart(5)).join(' ')}   total ${nb(t.total)}`);
  }

  if (r.suivi.length > 0) {
    l.push('', 'Suivi de runes', '─'.repeat(72));
    for (const s of r.suivi) {
      l.push(`  Rune #${s.id}`);
      if (!s.presenteAuDepart) {
        l.push('    ⚠️ ABSENTE du pool d’entrée — ce n’est pas « écartée par un étage ».');
        continue;
      }
      for (const e of s.parEtage) {
        l.push(`    ${e.etage.padEnd(12)} : ${e.present ? 'présente' : 'ABSENTE'}`);
      }
      if (s.premiereDisparition) {
        l.push(`    → première disparition : ${s.premiereDisparition.etage} [${s.premiereDisparition.nature}]`);
        l.push(`      ${s.premiereDisparition.signification}`);
      } else {
        l.push('    → survit à toute la préparation.');
      }
      if (s.detailFiltrage) {
        const d = s.detailFiltrage;
        l.push(
          `    filterSlot — relevance() : rang #${d.relevance.rang} / ${d.relevance.total}` +
            ` (cible=${d.relevance.score.toFixed(3)}, meilleur=${d.relevance.meilleur.toFixed(3)})`
        );
        if (d.relevanceParmiSet) {
          l.push(`      parmi le set demandé seulement : rang #${d.relevanceParmiSet.rang} / ${d.relevanceParmiSet.total}`);
        }
        for (const p of d.parStat) {
          l.push(
            `      ${p.stat.padEnd(4)} (garde ${p.keepN}) : rang #${p.rang} / ${p.total} ` +
              `${p.retenue ? '✅ retenue' : '❌ hors budget'} (cible=${p.valeur}, meilleur=${p.meilleure})`
          );
        }
      }
    }
  }

  if (r.detailDemiBuilds && r.detailDemiBuilds.length > 0) {
    l.push('', 'Détail du demi-build suivi', '─'.repeat(72));
    for (const d of r.detailDemiBuilds) {
      l.push(`  Moitié ${d.moitie} — runes [${d.runeIds.join(', ')}]`);
      if (d.absent) {
        l.push(`    ⚠️ ${d.absent}`);
        continue;
      }
      l.push(`    compartiment : rang #${d.compartimentRang} / ${d.compartimentTotal}`);
      l.push(`    demi-build   : rang #${d.comboRang} / ${d.comboTotal} dans son compartiment`);
      l.push(`    meilleurs classés du compartiment (cible marquée ⭐) :`);
      for (const c of d.meilleurs!) {
        const cible = c.runeIds.length === d.runeIds.length && c.runeIds.every((id) => d.runeIds.includes(id));
        const statsStr = c.parStat.map((p) => `${p.stat}: pct=${p.pct.toFixed(1)} flat=${p.flat.toFixed(1)}`).join('  ');
        l.push(`      ${cible ? '⭐' : '  '} relevanceScore=${c.relevanceScore.toFixed(3)}  runes=[${c.runeIds.join(', ')}]  ${statsStr}`);
      }
    }
  }

  // ⚠️ La faisabilité vient AVANT tout le reste : si une condition est
  // PROUVÉE hors de portée, aucun chiffre plus bas ne veut dire quoi que ce
  // soit sur la qualité de la recherche.
  const impossibles = r.faisabilite.preuves.filter((p) => !p.satisfiable);
  if (r.faisabilite.preuves.length > 0) {
    l.push('', 'Faisabilité — PREUVES (stat par stat, isolément)', '─'.repeat(72));
    for (const p of r.faisabilite.preuves) {
      const verdict = p.satisfiable
        ? 'rien ne prouve que ce soit impossible'
        : '❌ IMPOSSIBLE — preuve mathématique, aucune recherche n’y changera rien';
      l.push(
        `  ${p.stat.padEnd(5)} ${p.borne === 'min' ? '≥' : '≤'} ${String(p.demande).padStart(7)}   ` +
          `atteignable ${String(Math.round(p.atteignable)).padStart(7)}   ${verdict}`
      );
    }
    if (impossibles.length === 0) {
      l.push(
        '  ⚠️ Aucune preuve d’impossibilité ne veut PAS dire qu’un build existe : ces bornes',
        '     isolent chaque stat, les contraintes prises ENSEMBLE peuvent rester infaisables.'
      );
    }
  }

  if (r.faisabilite.blocages) {
    const b = r.faisabilite.blocages;
    l.push('', `Conditions bloquantes — INDICE, pas une preuve (calculé en ${ms(b.coutMs)})`, '─'.repeat(72));
    l.push(`  pool le plus restreint, toutes conditions posées : ${nb(b.poolMinActuel)}`);
    for (const i of b.impacts) {
      const borne = i.borne === 'min' ? '≥' : '≤';
      if (i.seuil == null) {
        l.push(`  ${i.stat.padEnd(5)} ${borne} ${String(i.demande).padStart(7)} → aucun gain, même desserrée entièrement`);
      } else {
        const signe = i.borne === 'min' ? '−' : '+';
        l.push(
          `  ${i.stat.padEnd(5)} ${signe}${i.ecart} suffit (${borne} ${String(i.seuil).padStart(7)}) →` +
            ` ${nb(i.poolAuSeuil!).padStart(7)} candidat(s)`
        );
      }
    }
    l.push(
      '  ⚠️ Toutes les AUTRES conditions restent posées : desserrer PLUSIEURS conditions à la',
      '     fois peut faire mieux que la somme de leurs écarts pris séparément.'
    );
  }

  if (r.quasiSucces) {
    const qs = r.quasiSucces;
    l.push('', 'Quasi-succès à l’appariement — sous-produit GRATUIT de la vraie recherche', '─'.repeat(72));
    // ⚠️ Même vocabulaire que le bloc « Conditions bloquantes » plus haut
    // (« −15 suffit ») — décision explicite (2026-09-07) : un seul réflexe
    // de lecture pour tout le diagnostic, plutôt que « manque »/« suffit »
    // pour la même idée de desserrage.
    const suffirait = (m: { stat: string; borne: 'min' | 'max'; demande: number; manque: number }) => {
      const seuil = m.borne === 'min' ? m.demande - m.manque : m.demande + m.manque;
      const signe = m.borne === 'min' ? '−' : '+';
      return `${m.stat} ${signe}${nb(m.manque)} suffirait (${m.borne === 'min' ? '≥' : '≤'} ${nb(seuil)})`;
    };
    if (qs.global) {
      const manques = qs.global.manques.map(suffirait).join(', ');
      l.push(`  le plus proche, toutes conditions confondues : ${manques} — ${nb(qs.global.total)}`);
    } else {
      l.push('  aucune paire explorée n’a jamais atteint le test conjoint exact (rejetée plus tôt)');
    }
    if (qs.parCondition.length > 0) {
      l.push('  par condition (satisfait TOUT le reste, ne manque QUE celle-ci) :');
      for (const p of qs.parCondition) {
        const m = p.quasiSucces.manques[0];
        l.push(`    ${p.stat.padEnd(5)} : ${suffirait(m)} — atteint ${nb(m.atteint)} — ${nb(p.quasiSucces.total)}`);
      }
    } else {
      l.push('  aucune condition n’a de quasi-succès ISOLÉ (jamais en échec seule parmi les paires explorées)');
    }
    l.push(
      '  ⚠️ Ne voit que ce que la recherche a RÉELLEMENT exploré avant troncature — une paire',
      '     encore plus proche, jamais atteinte, resterait invisible.'
    );
  }

  if (r.demiBuilds) {
    l.push('', 'Demi-builds', '─'.repeat(72));
    l.push(`  moitié A : ${nb(r.demiBuilds.compartimentsA)} compartiment(s), ${nb(r.demiBuilds.combosA)} demi-build(s)`);
    l.push(`  moitié B : ${nb(r.demiBuilds.compartimentsB)} compartiment(s), ${nb(r.demiBuilds.combosB)} demi-build(s)`);

    // ⚠️ « Taux de rétention de la CONSTRUCTION » — jamais « du
    // pré-filtrage » (ce serait `filterSlot`, un étage plus haut), jamais un
    // « rendement » ni une « efficacité » (le ratio ne dit rien de la
    // QUALITÉ des demi-builds retenus).
    const ret = r.demiBuilds.retention;
    l.push('', 'Taux de rétention de la CONSTRUCTION (buildBuckets sous bucketCap)', '─'.repeat(72));
    for (const [moitie, m] of [['A', ret.A], ['B', ret.B]] as const) {
      const pourcent = m.taux === 0 ? '0' : (m.taux * 100).toPrecision(3);
      l.push(
        `  moitié ${moitie} : ${m.parEmplacement.join(' × ')} = ${nb(m.produitBrut)} triplets énumérables au plus` +
          `   →   ${nb(m.retenus)} retenus   (${pourcent} %)`
      );
    }
    const rapport = ret.B.taux > 0 ? ret.A.taux / ret.B.taux : 0;
    l.push(`  rapport des taux A/B : ×${rapport.toFixed(2)}`);
    l.push(`  ${ret.regleInterpretation}`);

    // ⚠️ §4.1 bis — la TROISIÈME hypothèse de l'asymétrie A/B : A pourrait
    // énumérer autant, retenir autant, et être plus lent parce qu'il alloue
    // davantage. Chaque moitié ayant son propre worker_threads, donc son
    // propre tas, les deux chiffres ne peuvent pas se confondre.
    const mem = r.demiBuilds.memoire;
    l.push('', 'Mémoire en fin de construction, par moitié (palier LÉGER)', '─'.repeat(72));
    for (const [moitie, m] of [['A', mem.A], ['B', mem.B]] as const) {
      l.push(
        `  moitié ${moitie} : heapUsed ${mo(m.heapUsed)}   heapTotal ${mo(m.heapTotal)}   rss ${mo(m.rss)}`
      );
    }
    const ecart = mem.B.heapUsed > 0 ? mem.A.heapUsed / mem.B.heapUsed : 0;
    l.push(`  rapport heapUsed A/B : ×${ecart.toFixed(2)}`);
    l.push(`  ${mem.caveat}`);

    // ⚠️ §4.2 (A₂) — la CARTOGRAPHIE DE L'ÉLAGAGE, et rien d'autre. La
    // distribution est rendue entière (quantiles ET forme) : c'est la
    // dispersion qui porte l'information, une moyenne écraserait une série
    // bimodale — le cas qu'on vient précisément chercher.
    const prog = r.demiBuilds.progression;
    if (prog) {
      l.push('', 'Cartographie de l’ÉLAGAGE — intervalles entre BuildingProgress (A₂)', '─'.repeat(72));
      l.push(`  ${prog.avertissementPortee}`);
      l.push(`  ${prog.perimetreHorloge}`);
      // ⚠️ A₂ est le seul instrument du harnais qui se paie : son prix est
      // affiché AVEC lui, mesuré, jamais laissé à l'estimation du lecteur.
      l.push(`  ${prog.coutInstrumentation}`);
      for (const [moitie, m] of [['A', prog.A], ['B', prog.B]] as const) {
        const d = m.distribution;
        l.push(
          '',
          `  moitié ${moitie} : ${nb(m.runesExterieures)} rune(s) extérieure(s)` +
            `   prologue ${msFin(m.prologueMs)}   dernière rune + épilogue ${msFin(m.derniereEtEpilogueMs)}`,
          `    série homogène (${nb(d.n)} intervalles, ${msFin(d.totalMs)} au total) :` +
            `   min ${msFin(d.minMs)}   médiane ${msFin(d.medianeMs)}   p90 ${msFin(d.p90Ms)}   max ${msFin(d.maxMs)}`
        );
        // La FORME, pas seulement l'étalement : deux bosses ne se voient
        // dans aucun jeu de quantiles.
        const plafond = Math.max(1, ...d.histogramme.map((c) => c.effectif));
        for (const c of d.histogramme) {
          const barre = '█'.repeat(Math.round((c.effectif / plafond) * 32));
          l.push(`      ${msFin(c.basseMs).padStart(9)} – ${msFin(c.hauteMs).padEnd(9)} ${barre} ${c.effectif}`);
        }
        const div = m.divisionParPairesInterieures;
        l.push(
          `    médiane ÷ (${div.parEmplacementInterieurs.join(' × ')} = ${nb(div.diviseur)}) = ` +
            `${div.medianeNs.toFixed(1)} ns`,
          `    ${div.libelle}`
        );
      }
    }
  }

  if (r.regime) {
    l.push('', 'Régime d’appariement', '─'.repeat(72));
    l.push(`  totalPairs = ${nb(r.regime.totalPairs)}   seuil ${nb(r.regime.seuil)}`);
    l.push(`  régime : ${r.regime.applique.toUpperCase()} — ${r.regime.explication}`);
  }

  if (r.completude) {
    const c = r.completude;
    l.push('', 'Complétude', '─'.repeat(72));
    if (c.configurationInvalide) {
      l.push(`  ⚠️ CONFIGURATION INVALIDE — ${c.configurationInvalide}`);
    } else {
      // ⚠️ L'incohérence est un verdict À PART, pas une note en bas d'un
      // « complet » : le moteur annonce une recherche non tronquée qui n'a
      // pourtant pas parcouru tout l'espace, donc la cause n'est pas
      // déductible. Écrire « incomplet — raison : undefined » revenait à
      // présenter une absence de motif comme un motif.
      l.push(`  ${c.incoherence ? 'INCOHÉRENT — incomplet, motif NON déductible' : c.complet ? 'complet' : `incomplet — raison : ${c.motif}`}`);
      l.push(`  explored ${nb(c.explored)} / totalPairs ${nb(c.totalPairs)}`);
      if (c.incoherence) l.push(`  ⚠️ ${c.incoherence}`);
    }
  }

  if (r.temps) {
    l.push('', 'Temps par phase', '─'.repeat(72));
    // ⚠️ Liste EXPLICITE, jamais `Object.entries` : `temps` porte aussi du
    // texte (l'avertissement de comparaison), qu'une itération générique
    // rendrait comme une phase nommée « avertissementComparaison ».
    const phases = ['preparation', 'demiBuilds', 'demiBuildA', 'demiBuildB', 'appariement', 'total'] as const;
    for (const nom of phases) {
      const s = r.temps[nom];
      l.push(
        `  ${nom.padEnd(12)} min ${ms(s.min).padStart(10)}   médiane ${ms(s.mediane).padStart(10)}   ` +
          `dispersion ${s.dispersionPct.toFixed(1)} %   (${s.repetitions} rép.)`
      );
      if (s.avertissement) l.push(`    ${s.avertissement}`);
    }
    l.push(`  ⚠️ ${r.fidelite.noteNavigateur}`);
    l.push('', `  ${r.temps.avertissementComparaison}`);
  }

  if (r.meilleurs) {
    l.push('', `Les ${r.meilleurs.length} meilleurs (classés par sortCandidates — jamais candidates[0])`, '─'.repeat(72));
    for (const [i, b] of r.meilleurs.entries()) {
      l.push(`  ${String(i + 1).padStart(2)}. ${b.total.toFixed(2)}   runes [${b.runeIds.join(', ')}]`);
    }
  }

  return l.join('\n');
}

/* --------------------------------------------------------------------------
 * Exécution
 * ----------------------------------------------------------------------- */

/**
 * Le LOT — §5.3 des extensions. ⚠️ **Une boucle, et rien de plus** : chaque
 * cas produit exactement la sortie qu'il produirait lancé seul, palier 1
 * compris. Rien n'est agrégé, rien n'est comparé, aucun texte n'est
 * mutualisé — en particulier l'avertissement de comparaison, qui part avec
 * CHAQUE mesure de temps et doit donc apparaître autant de fois qu'il y a de
 * cas, jamais une seule fois en tête comme s'il ne valait que pour le
 * premier.
 */
async function mainLot(brut: string): Promise<void> {
  // ⚠️ Trois sources qui s'EXCLUENT — aucune préséance silencieuse. Un
  // `--cas=tous --synthetique` ne doit pas exécuter l'une des deux sans dire
  // laquelle il a ignorée.
  if (drapeau('synthetique') || valeur('compte') != null || valeur('recette') != null) {
    refuser(
      '--cas est une source à lui seul (les cas connus de scripts/lib/perfShared.ts) : ' +
        'il ne se combine ni avec --synthetique, ni avec --compte/--recette.'
    );
  }

  let indices: number[];
  try {
    indices = resoudreSelectionCas(brut);
    // ⚠️ AVANT l'annonce : les deux exports de compte sont gitignorés, et un
    // cas dont le fichier manque est refusé en le NOMMANT — jamais sauté en
    // silence, jamais remplacé par un pool synthétique.
    verifierComptesDisponibles(indices);
  } catch (e) {
    refuser(e instanceof Error ? e.message : String(e));
  }

  const commun = construireCommun();
  // ⚠️ Le coût se dit AVANT d'être payé : le palier 1 existe pour challenger
  // une configuration avant de laisser tourner vingt minutes, et un lot
  // multiplie ce temps par le nombre de cas.
  if (!drapeau('json')) console.log(annoncerLot(indices, commun));

  if (drapeau('apercu')) {
    // ⚠️ `--apercu` reste UTILE en lot, et c'est même là qu'il sert le plus :
    // il rend les N paliers 1 — donc les N drapeaux de fidélité — pour le
    // prix de N lectures d'export, sans exécuter la moindre recherche.
    const apercus = indices.map((i) => resoudreCas(i, commun).resolue);
    if (drapeau('json')) {
      console.log(
        JSON.stringify(
          indices.map((i, k) => ({ cas: i, parametres: apercus[k].parametres, fidelite: apercus[k].fidelite })),
          null,
          2
        )
      );
      return;
    }
    for (const [k, i] of indices.entries()) {
      console.log(`\n${'━'.repeat(78)}\nCas ${i} — ${apercus[k].descriptionSource}\n${'━'.repeat(78)}`);
      console.log(rendreParametres(apercus[k]));
    }
    console.log('\n(--apercu : rien n’a été exécuté.)');
    return;
  }

  const lot = await executerLot(indices, commun, {
    avant: (info, resolue) => {
      if (drapeau('json')) return;
      console.log(`\n${'━'.repeat(78)}\nCas ${info.index} (${info.position}/${info.total}) — ${info.libelle}\n${'━'.repeat(78)}`);
      console.log(rendreParametres(resolue));
      console.log(`\nArrêt après : ${commun.arretApres ?? 'classement'}`);
    },
    apres: (ligne) => {
      if (!drapeau('json')) console.log(rendreResultat(ligne.resultat));
    },
  });
  if (drapeau('json')) {
    console.log(JSON.stringify(lot, (_, v) => (v instanceof Set ? [...v] : v), 2));
    return;
  }
  console.log(rendreRecapLot(lot));
}

async function main() {
  const brutCas = valeur('cas');
  if (brutCas != null) return mainLot(brutCas);

  const config = construireConfig();

  // ── PALIER 1 — instantané, aucune exécution. Toujours affiché en premier :
  // c'est ce qu'on relit avant de laisser tourner quoi que ce soit.
  let resolue;
  try {
    resolue = resoudreConfig(config);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  if (!drapeau('json')) {
    console.log(rendreParametres(resolue));
    console.log(`\nArrêt après : ${config.arretApres ?? 'classement'}`);
  }
  if (drapeau('apercu')) {
    if (!drapeau('json')) console.log('\n(--apercu : rien n’a été exécuté.)');
    else console.log(JSON.stringify({ parametres: resolue.parametres, fidelite: resolue.fidelite }, null, 2));
    return;
  }

  // ── PALIERS SUIVANTS — la préparation réelle, puis les phases demandées.
  // ⚠️ **Sur la configuration DÉJÀ résolue ci-dessus**, jamais une seconde
  // résolution : en mode recette celle-ci relirait l'export de compte et la
  // recette sur le disque, qui ont pu changer entre les deux — le palier 1
  // décrirait alors une configuration qui n'est PAS celle qui s'exécute.
  const resultat = await executerHarnaisResolu(resolue, config);
  if (drapeau('json')) {
    console.log(JSON.stringify(resultat, (_, v) => (v instanceof Set ? [...v] : v), 2));
    return;
  }
  console.log(rendreResultat(resultat));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
