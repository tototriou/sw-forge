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
// Options communes :
//   --apercu               palier 1 seulement — n'exécute RIEN
//   --arret=<étape>        mainstat | dominance | feasibility | filterslot
//                          | demi-builds | appariement | classement (défaut)
//   --suivre=<id,id,…>     suit ces runes d'étage en étage
//   --blocages             classe les conditions par impact (⚠️ COÛTEUX : le
//                          pré-filtrage est relancé une fois par condition ;
//                          calculé d'office si la recherche ne rend rien)
//   --repetitions=<n>      répétitions de la mesure de temps (défaut 1)
//   --json                 sort le résultat brut, sans mise en forme
// Overrides (⚠️ chacun MARQUE le run comme divergent de la prod) :
//   --slotFilterCap=<n>  --bucketCap=<n>  --maxCollected=<n>  --maxMs=<n>
//   --regime=sequentiel|parallele  --combos=potential|relevance|combined|objective

import { executerHarnais } from './lib/diagnosticHarness';
import { rendreParametres, resoudreConfig } from './lib/diagnosticConfig';
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

const args = process.argv.slice(2);
const drapeau = (nom: string) => args.includes(`--${nom}`);
const valeur = (nom: string): string | undefined =>
  args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const nombre = (nom: string): number | undefined => {
  const v = valeur(nom);
  if (v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    console.error(`--${nom} : nombre attendu, reçu « ${v} ».`);
    process.exit(1);
  }
  return n;
};

const ARRETS: ArretApres[] = ['mainstat', 'dominance', 'feasibility', 'filterslot', 'demi-builds', 'appariement', 'classement'];

function lireStats(brut: string | undefined): Partial<Record<StatKey, number>> {
  if (!brut) return {};
  const out: Partial<Record<StatKey, number>> = {};
  for (const paire of brut.split(',')) {
    const [k, v] = paire.split(':');
    const n = Number(v);
    if (!k || !Number.isFinite(n)) {
      console.error(`Format attendu « stat:valeur » séparé par des virgules — reçu « ${paire} ».`);
      process.exit(1);
    }
    out[k.trim() as StatKey] = n;
  }
  return out;
}

function construireConfig(): ConfigHarnais {
  const overrides: OverridesHarnais = {};
  if (nombre('slotFilterCap') != null) overrides.slotFilterCap = nombre('slotFilterCap');
  if (nombre('bucketCap') != null) overrides.bucketCap = nombre('bucketCap');
  if (nombre('maxCollected') != null) overrides.maxCollected = nombre('maxCollected');
  if (nombre('maxMs') != null) overrides.maxMs = nombre('maxMs');
  const regime = valeur('regime');
  if (regime != null) {
    if (regime !== 'sequentiel' && regime !== 'parallele') {
      console.error(`--regime : « sequentiel » ou « parallele », reçu « ${regime} ».`);
      process.exit(1);
    }
    overrides.regime = regime as RegimeAppariement;
  }
  const combos = valeur('combos');
  if (combos != null) overrides.combosOrderMode = combos as OverridesHarnais['combosOrderMode'];

  const arret = (valeur('arret') ?? 'classement') as ArretApres;
  if (!ARRETS.includes(arret)) {
    console.error(`--arret : ${ARRETS.join(' | ')} — reçu « ${arret} ».`);
    process.exit(1);
  }

  const commun = {
    overrides,
    arretApres: arret,
    suivre: valeur('suivre')?.split(',').map((s) => Number(s.trim())),
    blocages: drapeau('blocages'),
    repetitions: nombre('repetitions'),
  };

  if (drapeau('synthetique')) {
    // ⚠️ Les runes IMPOSÉES sont exposées ici parce qu'elles sont la cause
    // n° 1 d'un « 0 build » qui n'a rien d'algorithmique : un verrou dont la
    // rune n'existe pas dans le pool vide l'emplacement EXPRÈS. Le mode
    // recette les porte déjà (`recipe.requirement.lockedRunes`) ; sans
    // équivalent ici, ce cas ne serait pas reproductible sans compte réel.
    const verrous: Partial<Record<number, number>> = {};
    for (const paire of valeur('verrous')?.split(',') ?? []) {
      const [slot, id] = paire.split(':').map(Number);
      if (!Number.isFinite(slot) || !Number.isFinite(id)) {
        console.error(`--verrous : format « slot:runeId », reçu « ${paire} ».`);
        process.exit(1);
      }
      verrous[slot] = id;
    }
    const requirement: SyntheticRequirement = {
      sets: valeur('sets')?.split(',').map((s) => s.trim()) ?? [],
      minStats: lireStats(valeur('min')),
      maxStats: lireStats(valeur('max')),
      ...(Object.keys(verrous).length > 0 ? { lockedRunes: verrous } : {}),
    };
    const assortiment = valeur('assortiment') ?? 'joker';
    const sets =
      assortiment === 'sans-joker' ? SETS_SANS_JOKER : assortiment === 'varies' ? SETS_VARIES : SETS_JOKER;
    // ⚠️ `--cap` n'a PAS de défaut, volontairement : voir la règle « aucun
    // repli silencieux » dans diagnosticConfig.ts. Le laisser vide ferait
    // mesurer la moitié de la rétention de production, en silence.
    return {
      source: {
        type: 'synthetique',
        seed: nombre('seed') ?? 1,
        runesParEmplacement: nombre('runes') ?? 20,
        sets,
        requirement,
        slotFilterCap: nombre('cap')!,
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
          return { type: 'siege' as const, deckId: Number(id), defense: variante === 'defense' };
        })()
      : { type: 'box' };
  return { source: { type: 'recette', cheminCompte: compte, cheminRecette: recette, mode }, ...commun };
}

/* --------------------------------------------------------------------------
 * Mise en forme
 * ----------------------------------------------------------------------- */

const ms = (n: number) => `${n.toFixed(0)} ms`;
const nb = (n: number) => n.toLocaleString('fr-FR');

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
      l.push(
        `  sans ${i.stat.padEnd(5)} ${i.borne === 'min' ? '≥' : '≤'} ${String(i.demande).padStart(7)} → ${nb(i.poolMinSansElle).padStart(7)}` +
          `   (${i.poolMinSansElle > b.poolMinActuel ? `+${nb(i.poolMinSansElle - b.poolMinActuel)}` : 'aucun gain'})`
      );
    }
    l.push(
      '  ⚠️ Chaque condition est retirée ENTIÈREMENT : ça classe par impact, ça ne dit pas',
      '     DE COMBIEN relâcher. Deux conditions peuvent donner le même chiffre sans être',
      '     équivalentes.'
    );
  }

  if (r.demiBuilds) {
    l.push('', 'Demi-builds', '─'.repeat(72));
    l.push(`  moitié A : ${nb(r.demiBuilds.compartimentsA)} compartiment(s), ${nb(r.demiBuilds.combosA)} demi-build(s)`);
    l.push(`  moitié B : ${nb(r.demiBuilds.compartimentsB)} compartiment(s), ${nb(r.demiBuilds.combosB)} demi-build(s)`);
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
      l.push(`  ${c.complet ? 'complet' : `incomplet — raison : ${c.motif}`}`);
      l.push(`  explored ${nb(c.explored)} / totalPairs ${nb(c.totalPairs)}`);
      if (c.incoherence) l.push(`  ⚠️ ${c.incoherence}`);
    }
  }

  if (r.temps) {
    l.push('', 'Temps par phase', '─'.repeat(72));
    for (const [nom, s] of Object.entries(r.temps)) {
      l.push(
        `  ${nom.padEnd(12)} min ${ms(s.min).padStart(10)}   médiane ${ms(s.mediane).padStart(10)}   ` +
          `dispersion ${s.dispersionPct.toFixed(1)} %   (${s.repetitions} rép.)`
      );
      if (s.avertissement) l.push(`    ${s.avertissement}`);
    }
    l.push(`  ⚠️ ${r.fidelite.noteNavigateur}`);
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

async function main() {
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
  const resultat = await executerHarnais(config);
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
