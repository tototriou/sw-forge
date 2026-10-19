// Banc du PROTOTYPE de résolution de l'équipement (src/lib/resolutionRapide.ts,
// non branché en production) : la résolution du CLI
// (`resoudreEquipementCli`, celle de la file de l'écran) et le prototype, sur
// les MÊMES builds d'une recette réelle, comparés build par build — en
// entier avec `--diagnostic`, hors le diagnostic d'un build rejeté sans lui
// (le prototype rend alors le résultat « aucune paire », sans le diagnostic
// d'un build rejeté, jamais montré à l'écran).
//
// Usage :
//   npx tsx scripts/banc-resolution-rapide.ts --compte=<export.json> --recette=<recette.json>
// Options :
//   --candidats=<fichier.json>  les identifiants de runes des candidats : relus s'ils
//                               existent, sinon calculés puis écrits (runs longs)
//   --echantillon=<n>           un build sur ⌈N / n⌉ dans l'ordre de collecte (défaut : tous)
//   --diagnostic                le prototype avec son option `diagnostic` (CLI, harnais)
//   --compter-notes             une passe de plus du prototype, `evaluer` compté
//                               (sondes de pertinence et paires), sans effet sur le résultat
//   --compter-production        de même pour la production (`resoudreEquipementDuBuild`), lente
//   --sortie=<dossier>          écrit le rapport texte et le JSON
//   --suffixe=<texte>           ajouté au nom des fichiers de sortie
//
// ⚠️ **Fidélité** (skill `algo-verify`) : les candidats viennent de la
// recherche de la recette au plafond de production (`MAX_COLLECTED`), `maxMs`
// levé (override MARQUÉ en tête de sortie), préparation par `prepareSearch`,
// moitiés par les Workers de production, appariement par le noyau rapide
// (`apparierRapide`, séquentiel, égal à `pairBuckets` au différentiel
// d'appariement). La référence est `resoudreEquipementCli` lui-même, sans copie ; le
// prototype reçoit l'entrée assemblée comme lui (`entreeResolutionDuBuild`,
// mêmes arguments) : une divergence d'assemblage se verrait comme un écart.
// La référence résout dans l'ordre de collecte, le prototype à REBOURS, chacun
// avec les caches d'une file : le résultat ne dépend pas de l'ordre.
//
// ⚠️ **Les temps affichés sont INDICATIFS** : une passe, dans le même
// processus, sans protocole. Ils ne servent à aucune conclusion ; la mesure
// est celle du pilote (skill `optimizer-perf-testing`).

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { isDeepStrictEqual } from 'util';
import { MAX_COLLECTED, SearchParams, prepareSearch } from '../src/lib/runeBuildOptim';
import { apparierRapide } from '../src/lib/appariementRapide';
import { EntreeResolution, entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { CachesResolutionRapide, compteursVides, resoudreEquipementDuBuildRapide } from '../src/lib/resolutionRapide';
import { regimeArtefacts, regimeEquipementDe } from '../src/lib/artifactEvaluation';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { ResultatArtefacts } from '../src/lib/artifactQueue';
import { computeStats } from '../src/lib/stats';
import { chargerRecette } from './lib/chargerRecette';
import { artefactsDuCli, resoudreEquipementCli } from './lib/recipeToSearchParams';
import { construireMoitiesEnParallele, ensureBuildHalfBundle } from './lib/buildHalvesNode';

const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);

async function candidats(params: SearchParams, fichier: string | undefined, dire: (l: string) => void): Promise<number[][]> {
  if (fichier && existsSync(fichier)) {
    const ids = JSON.parse(readFileSync(fichier, 'utf8')) as number[][];
    dire(`Candidats relus de ${fichier} : ${ids.length.toLocaleString('fr-FR')}`);
    return ids;
  }
  const p: SearchParams = { ...params, maxMs: Infinity, maxCollected: MAX_COLLECTED };
  const prepared = prepareSearch(p);
  if (!prepared) {
    dire('prepareSearch → null : aucun candidat.');
    return [];
  }
  const m = await construireMoitiesEnParallele(prepared, p, await ensureBuildHalfBundle());
  const gen = apparierRapide(prepared, m.bucketsA, m.bucketsB);
  let s = gen.next();
  while (!s.done) s = gen.next();
  const r = s.value;
  dire(
    `Candidats de la recherche (prototype d'appariement séquentiel, plafond ${MAX_COLLECTED.toLocaleString('fr-FR')}) : ` +
      `${r.candidates.length.toLocaleString('fr-FR')}, traitees ${r.traitees.toLocaleString('fr-FR')}, tronquée ${r.truncated}, chemin ${r.chemin}`
  );
  const ids = r.candidates.map((c) => c.runeIds);
  if (fichier) writeFileSync(fichier, JSON.stringify(ids));
  return ids;
}

// Ce que le prototype rend SANS diagnostic, lu sur la référence : un
// build conforme à l'identique ; un build rejeté, le résultat de la
// production quand aucune paire n'existe (stats du build sans artéfact ;
// relique portée hors mode `recherche`, aucune en `recherche`).
function sansDiagnostic(ref: ResultatArtefacts, e: EntreeResolution): ResultatArtefacts {
  if (ref.conforme) return ref;
  return e.relicContext?.mode === 'recherche'
    ? { paire: null, artefacts: [], stats: computeStats({ ...e.gear, relic: undefined }), meilleurSansVerrous: null, conforme: false, relique: undefined }
    : { paire: null, artefacts: [], stats: computeStats({ ...e.gear, artifacts: [], relic: e.gear.relic }), meilleurSansVerrous: null, conforme: false };
}

// L'entrée avec un `evaluer` qui compte ses appels — sondes de pertinence
// (pièces d'identifiant 0, `analyserPertinence`) et paires — et rend la même
// note : sans effet sur le résultat (les champs de `params` gardent leur
// identité, que lisent les memos).
interface Notes { sondes: number; paires: number }
function compteeNotes(e: EntreeResolution, n: Notes): EntreeResolution {
  return {
    ...e,
    faireParams: (r) => {
      const p = e.faireParams(r);
      return {
        ...p,
        evaluer: (arts) => {
          if (arts.some((a) => a.id === 0)) n.sondes++;
          else n.paires++;
          return p.evaluer(arts);
        },
      };
    },
  };
}

const empreinte = (lignes: string[]) => {
  const h = createHash('sha256');
  for (const l of lignes) h.update(l).update('\n');
  return h.digest('hex').slice(0, 16);
};

async function main(): Promise<number> {
  const lignes: string[] = [];
  const dire = (l: string) => {
    console.log(l);
    lignes.push(l);
  };
  const compte = valeur('compte');
  const recette = valeur('recette');
  if (!compte || !recette) throw new Error('--compte=… --recette=… attendus');
  const { recipe, loaded, params, avertissements } = chargerRecette(compte, recette);
  dire(`Recette ${recipe.monsterName} (objectif ${recipe.objective}, relique ${params.relicContext?.mode ?? 'sans contexte'}, ` +
    `${params.relicContext?.mode === 'recherche' ? `${params.relicContext.eligibles.length} éligibles` : 'relique portée'})`);
  for (const a of avertissements) dire(`⚠️ ${a}`);
  dire(`⚠️ DIVERGE DE LA PROD (override marqué) : maxMs = ∞ pour la recherche des candidats (plafond de candidats de production).`);

  const ids = await candidats(params, valeur('candidats'), dire);
  const n = Number(valeur('echantillon') ?? ids.length);
  const pas = Math.max(1, Math.ceil(ids.length / n));
  const indices = ids.map((_, i) => i).filter((i) => i % pas === 0);
  dire(`Échantillon : ${indices.length.toLocaleString('fr-FR')} builds (un sur ${pas}, ordre de collecte)`);

  // Référence : la résolution du CLI, telle quelle.
  const reference = resoudreEquipementCli(recipe, loaded, params);
  if (!reference) {
    dire('Aucune résolution (optimisation d’artéfacts coupée) : rien à comparer.');
    return 0;
  }
  const runeById = new Map(params.pool.map((r) => [r.id, r]));
  const runesDe = (i: number) => ids[i]!.map((id) => runeById.get(id)!).filter(Boolean);
  const candidatDe = (i: number) => ({ runeIds: ids[i]!, stats: [], effTotal: 0 });
  let debut = performance.now();
  const ref = new Map<number, ResultatArtefacts>();
  for (const i of indices) ref.set(i, reference(candidatDe(i)));
  const msRef = performance.now() - debut;

  // Prototype : l'entrée de `resoudreEquipementCli`, assemblée de même.
  const a = artefactsDuCli(recipe, loaded)!;
  const regime = regimeEquipementDe(regimeArtefacts(recipe.objective), a.degats != null);
  const exclusive = { setup: recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP, element: a.element };
  const diagnostic = args.includes('--diagnostic');
  const entreeDe = (i: number, caches: ReturnType<typeof nouveauxCachesResolution>) => entreeResolutionDuBuild({
    fiche: loaded.gear, runes: runesDe(i), artifactParams: a.params, regime, degats: a.degats, exclusive,
    requirement: params.requirement, relicContext: params.relicContext, caches,
  });
  dire(`Prototype : ${diagnostic ? 'AVEC diagnostic (option du CLI et du harnais) — comparé en entier' : 'SANS diagnostic (chemin de l’app) — comparé hors le diagnostic d’un build rejeté'}`);
  const caches = nouveauxCachesResolution();
  const rapide = new CachesResolutionRapide();
  const compteurs = compteursVides();
  const replis: string[] = [];
  const warn = console.warn;
  console.warn = (...m: unknown[]) => {
    replis.push(m.map(String).join(' '));
  };
  debut = performance.now();
  const proto = new Map<number, ResultatArtefacts>();
  const entrees = new Map<number, EntreeResolution>();
  try {
    for (const i of [...indices].reverse()) {
      const e = entreeDe(i, caches);
      entrees.set(i, e);
      proto.set(i, resoudreEquipementDuBuildRapide(e, rapide, compteurs, { diagnostic }));
    }
  } finally {
    console.warn = warn;
  }
  const msProto = performance.now() - debut;

  let egaux = 0;
  let egauxEntiers = 0;
  let conformes = 0;
  const ecarts: string[] = [];
  const jsonRef: string[] = [];
  for (const i of indices) {
    const r = ref.get(i)!;
    const p = proto.get(i)!;
    const attendu = diagnostic ? r : sansDiagnostic(r, entrees.get(i)!);
    jsonRef.push(JSON.stringify(r));
    if (r.conforme) conformes++;
    if (isDeepStrictEqual(r, p)) egauxEntiers++;
    if (isDeepStrictEqual(attendu, p)) egaux++;
    else if (ecarts.length < 5) ecarts.push(`build #${i} (${ids[i]!.join(',')}) : ${JSON.stringify(p).slice(0, 200)} ≠ ${JSON.stringify(attendu).slice(0, 200)}`);
  }
  const egal = egaux === indices.length;
  dire(`Référence (resoudreEquipementCli) : ${indices.length} builds, ${conformes} conformes, ${indices.length - conformes} rejetés · empreinte ${empreinte(jsonRef)} · ${(msRef / indices.length).toFixed(2)} ms/build [indicatif]`);
  dire(`Prototype (à rebours) : ${egal ? 'ÉGAL' : 'DIFFÈRE'} build par build ${diagnostic ? '' : 'hors diagnostic '}(${egaux}/${indices.length} ; ` +
    `égaux en entier, diagnostic compris : ${egauxEntiers}) · ${(msProto / indices.length).toFixed(2)} ms/build [indicatif]`);
  for (const e of ecarts) dire(`  ⚠️ ${e}`);
  dire(`Avertissements (note NaN, repli sur la production) : ${replis.length}`);
  for (const w of replis.slice(0, 3)) dire(`  ${w}`);
  dire(`Compteurs du prototype : ${JSON.stringify(compteurs)}`);
  if (compteurs.reliques > 0) {
    dire(`  reliques écartées sans note : ${((100 * compteurs.reliquesSansFormeFaisable) / compteurs.reliques).toFixed(1)} % ; ` +
      `reliques à forme faisable par build : ${(compteurs.reliquesNotees / compteurs.builds).toFixed(2)} ; ` +
      `paires faisables notées par build : ${(compteurs.notesFaisables / compteurs.builds).toFixed(1)} ; diagnostics de la production : ${compteurs.diagnostics}`);
  }

  // Les notes (appels d'`evaluer`) par build : comptes, pas des temps.
  const notes: Record<string, Notes & { parBuild: number }> = {};
  const compter = (nom: string, resoudre: (e: EntreeResolution) => ResultatArtefacts) => {
    const n: Notes = { sondes: 0, paires: 0 };
    const c = nouveauxCachesResolution();
    const w = console.warn;
    console.warn = () => {};
    try {
      for (const i of indices) resoudre(compteeNotes(entreeDe(i, c), n));
    } finally {
      console.warn = w;
    }
    notes[nom] = { ...n, parBuild: (n.sondes + n.paires) / indices.length };
    dire(`Notes par build, ${nom} : ${((n.sondes + n.paires) / indices.length).toFixed(1)} (sondes ${(n.sondes / indices.length).toFixed(1)}, paires ${(n.paires / indices.length).toFixed(1)}) [compte]`);
  };
  if (args.includes('--compter-notes')) {
    const r2 = new CachesResolutionRapide();
    compter(`prototype ${diagnostic ? 'avec' : 'sans'} diagnostic`, (e) => resoudreEquipementDuBuildRapide(e, r2, undefined, { diagnostic }));
  }
  if (args.includes('--compter-production')) compter('production', (e) => resoudreEquipementDuBuild(e));

  dire(`Verdict : ${egal ? `résolution IDENTIQUE build par build${diagnostic ? '' : ' hors diagnostic'}` : '⚠️ DIFFÉRENTIEL EN ÉCHEC'}`);

  const sortie = valeur('sortie');
  if (sortie) {
    mkdirSync(sortie, { recursive: true });
    const nom = `banc-resolution-${recipe.monsterName.toLowerCase()}${valeur('suffixe') ? `-${valeur('suffixe')}` : ''}`;
    const json = {
      recette: recipe.monsterName, date: new Date().toISOString(), candidats: ids.length, echantillon: indices.length, pas,
      diagnostic, egal, egaux, egauxEntiers, conformes, rejetes: indices.length - conformes, empreinteReference: empreinte(jsonRef), compteurs,
      avertissementsNaN: replis.length, notes,
      msParBuildReference: msRef / indices.length, msParBuildPrototype: msProto / indices.length, ecarts,
    };
    writeFileSync(join(sortie, `${nom}.json`), JSON.stringify(json, null, 2));
    writeFileSync(join(sortie, `${nom}.txt`), lignes.join('\n') + '\n');
  }
  return egal ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(2);
});
