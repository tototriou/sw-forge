// Oracle objet conservé pour les différentiels ; aucun chemin de production ne l'importe.
import { candidateMetricTotal, objectiveScore, sortCandidates, statTotal, type BuildCandidate, type Objective, type OptionsDeClassement, type RealDamageContext } from '../src/lib/runeBuildOptim';
import type { StatKey } from '../src/lib/effects';
import type { RuneDetail } from '../src/types';
import type { OptimMetric } from '../src/lib/runeOptim';
import type { DamageSetup, ArtifactDamageProfile, AurasPropres } from '../src/lib/damage';
import { APPORT_NEUTRE, type ApportExclusive } from '../src/lib/relicExclusive';

function classerParNote(candidats: BuildCandidate[], noter: ((c: BuildCandidate) => number) | null): BuildCandidate[] {
  if (!noter) return candidats.slice();
  const notes = candidats.map((c) => ({ c, s: noter(c) }));
  notes.sort((x, y) => y.s - x.s);
  return notes.map((n) => n.c);
}

const NOTES_CLASSEMENT = new WeakMap<BuildCandidate, { contexte: object; entrees: EntreesNote; note: number }>();
let contexteDesNotes: { empreinte: string; identite: object } | undefined;

type EntreesNote = { propres: AurasPropres; artefacts: ArtifactDamageProfile; apport: ApportExclusive };

// Les accesseurs peuvent recréer ces petites données sans changer leur sens.
// Comparaison directe, sans chaîne ni parcours des lignes de stats ; Object.is
// garde notamment NaN et le zéro négatif. Données sans cycle, comme le Worker.
function memesDonnees(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const gauche = a as Record<string, unknown>, droite = b as Record<string, unknown>;
  for (const k in gauche) if (Object.prototype.hasOwnProperty.call(gauche, k)) {
    if (!Object.prototype.hasOwnProperty.call(droite, k) || !memesDonnees(gauche[k], droite[k])) return false;
  }
  for (const k in droite) if (Object.prototype.hasOwnProperty.call(droite, k) && !Object.prototype.hasOwnProperty.call(gauche, k)) return false;
  return true;
}

/** Même tri stable, seules les notes de dégâts réels sont mémorisées. */
export function trierCandidatsIncrementalement(
  candidates: BuildCandidate[], sortBy: StatKey | Objective, opts: OptionsDeClassement,
  surNote?: (c: BuildCandidate, note: number) => void
): BuildCandidate[] {
  // Les autres notes coûtent moins que leur empreinte ; aucun parcours des
  // entrées de dégâts ni aucune sérialisation ne doit accompagner leur tri.
  if (sortBy !== 'degats_reels') return sortCandidates(candidates, sortBy, opts);
  // Seul le contexte COMMUN est sérialisé, une fois par publication. Aucune
  // empreinte par candidat : son identité porte ses stats immuables.
  const empreintes = new WeakMap<object, string>();
  const fonctionRencontree = Symbol();
  function empreinte(v: unknown): string {
    // Une fermeture mutable ne se compare ni par identité ni par son texte.
    if (typeof v === 'function') throw fonctionRencontree;
    if (v === null) return 'null';
    if (typeof v === 'number') return `n${Object.is(v, -0) ? '-0' : String(v)}`;
    if (typeof v !== 'object') return `${typeof v}:${JSON.stringify(v)}`;
    const connue = empreintes.get(v);
    if (connue !== undefined) return connue;
    const s = Array.isArray(v) ? `[${v.map(empreinte).join(',')}]`
      : `{${Object.entries(v).map(([k, valeur]) => `${JSON.stringify(k)}:${empreinte(valeur)}`).join(',')}}`;
    empreintes.set(v, s);
    return s;
  }
  const memoriser: MemoriserNote = (contexte, entreesDe, calculer) => {
    const commun = empreinte([sortBy, contexte]);
    // Comparer la chaîne commune UNE fois, puis une identité par candidat.
    if (contexteDesNotes?.empreinte !== commun) contexteDesNotes = { empreinte: commun, identite: {} };
    const identite = contexteDesNotes.identite;
    const verifiees = new WeakSet<object>();
    const verifier = (v: unknown): void => {
      // Une fermeture mutable ne se compare ni par identité ni par son texte.
      if (typeof v === 'function') throw fonctionRencontree;
      if (v === null || typeof v !== 'object' || verifiees.has(v)) return;
      verifiees.add(v);
      for (const k in v) if (Object.prototype.hasOwnProperty.call(v, k)) verifier((v as Record<string, unknown>)[k]);
    };
    // Détecter une fonction AVANT tout hit ou écriture, même si elle ne
    // concerne que le dernier build : le repli porte sur le tri entier.
    for (const c of candidates) verifier(entreesDe(c));
    return (c) => {
      const entrees = entreesDe(c);
      const connue = NOTES_CLASSEMENT.get(c);
      if (connue?.contexte === identite && memesDonnees(connue.entrees, entrees)) return connue.note;
      const note = calculer(c);
      NOTES_CLASSEMENT.set(c, { contexte: identite, entrees, note });
      return note;
    };
  };
  let score: ReturnType<typeof scorerPour>;
  try {
    score = scorerPour(sortBy, opts, memoriser);
  } catch (e) {
    if (e !== fonctionRencontree) throw e;
    score = scorerPour(sortBy, opts);
  }
  // L'observateur lit la note EFFECTIVEMENT utilisée, hit compris, pour
  // comparer les notes à une référence sans exposer la mémoire globale.
  const noter = score;
  return classerParNote(candidates, surNote && noter ? (c) => {
    const note = noter(c);
    surNote(c, note);
    return note;
  } : noter);
}

type MemoriserNote = (contexte: unknown, entreesDe: (c: BuildCandidate) => EntreesNote, calculer: (c: BuildCandidate) => number) => (c: BuildCandidate) => number;

function scorerPour(
  sortBy: StatKey | Objective,
  opts: {
    realDamage?: RealDamageContext | null;
    damageSetup?: DamageSetup;
    runeById?: Map<number, RuneDetail>;
    metric?: OptimMetric;
    artefactsDuBuild?: (c: BuildCandidate) => ArtifactDamageProfile | null;
    exclusiveDuBuild?: (c: BuildCandidate) => ApportExclusive | null;
    aurasPropresDe: (c: BuildCandidate) => AurasPropres;
  },
  memoriser?: MemoriserNote
): ((c: BuildCandidate) => number) | null {
  // Même patron qu'`artefactsDuBuild` : ce qui est PROPRE à un candidat une
  // fois son équipement résolu. Absent, ou rendant `null` (relique pas encore
  // résolue, aucune dimension relique) → neutre, l'ordre sans effet unique.
  const apportDe = (c: BuildCandidate) => opts.exclusiveDuBuild?.(c) ?? APPORT_NEUTRE;
  if (sortBy === 'efficience') {
    const { runeById, metric } = opts;
    if (!runeById || !metric) return null;
    return (c) => candidateMetricTotal(c, runeById, metric);
  }
  if (sortBy === 'degats_reels') {
    const ctx = opts.realDamage;
    if (!ctx) return null;
    if (!memoriser) return (c) => {
      const propre = opts.artefactsDuBuild?.(c);
      return objectiveScore(c, sortBy, opts.aurasPropresDe(c), propre ? { ...ctx, artefacts: propre } : ctx, apportDe(c));
    };
    // Matérialiser les accesseurs une fois par build : le calcul et sa clé
    // lisent EXACTEMENT les mêmes valeurs, même si les closures ont changé.
    const lire = (c: BuildCandidate) => ({ propres: opts.aurasPropresDe(c), artefacts: opts.artefactsDuBuild?.(c) ?? ctx.artefacts, apport: apportDe(c) });
    const valeurs = new WeakMap<BuildCandidate, ReturnType<typeof lire>>();
    const de = (c: BuildCandidate) => {
      let v = valeurs.get(c);
      if (!v) { v = lire(c); valeurs.set(c, v); }
      return v;
    };
    const calculer = (c: BuildCandidate) => {
      const v = de(c);
      return objectiveScore(c, sortBy, v.propres, { ...ctx, artefacts: v.artefacts }, v.apport);
    };
    const { artefacts: _repli, ...commun } = ctx;
    return memoriser(commun, de, calculer);
  }
  if (sortBy === 'ehp' || sortBy === 'vitesse')
    return (c) => objectiveScore(c, sortBy, opts.aurasPropresDe(c), undefined, apportDe(c), opts.damageSetup);
  // ⚠️ **Un tri par stat juge la FICHE** (`c.stats`), comme la carte
  // (`StatPanel`, `row.total`) et les conditions min/max : jamais les points
  // Bravoure/Éternité/Origine, acquis au début du combat comme les auras, le
  // lead et l'invocateur, qu'il ne compte pas non plus (option (a) de l'utilisateur). La MÊME expression
  // note une paire dans les régimes `hp`/`atk`/`def` (`evaluerPourRegime`).
  return (c) => statTotal(c.stats, sortBy);
}

