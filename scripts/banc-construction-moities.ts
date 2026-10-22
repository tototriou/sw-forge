// Banc de construction par le lanceur de l'écran, crans emboîtés compris.
// L'oracle séquentiel vit dans les tests différentiels, jamais dans ce banc.
// Un seul passage : temps indicatifs, sans conclusion comparative.
// Usage : --cas=tous ou --compte=<export> --recette=<recette> (répétable),
// --moities=A,B --ordre=<mode> --slotFilterCap=<n> --json=<fichier>.
// Voir docs/03-developpeur/optimizer/verification.md § Benchmarks.
import { writeFileSync } from 'fs';
import { availableParallelism } from 'os';
import { prepareSearch, SearchParams } from '../src/lib/runeBuildOptim';
import { OrdreCombos } from '../src/lib/constructionRapide';
import { nombreDeTravailleurs } from '../src/workers/parallelPairing';
import { construireMoitiesEnParallele, ensureBuildHalfBundle } from './lib/buildHalvesNode';
import { resoudreConfig } from './lib/diagnosticConfig';
import { resoudreCas, resoudreSelectionCas } from './lib/diagnosticLot';
import { CASES } from './lib/perfShared';

const args = process.argv.slice(2);
const valeurs = (nom: string) => args.filter((a) => a.startsWith(`--${nom}=`)).map((a) => a.slice(nom.length + 3));
const valeur = (nom: string) => valeurs(nom)[0];

async function main(): Promise<void> {
  if (valeur('fils') != null) throw new Error('--fils : le nombre de Workers vient de la règle des cœurs.');
  const cas: { libelle: string; params: SearchParams }[] = [];
  for (const sel of valeurs('cas')) for (const i of resoudreSelectionCas(sel)) {
    cas.push({ libelle: `cas ${i} — ${CASES[i].label}`, params: resoudreCas(i, {}).resolue.params });
  }
  for (const recette of valeurs('recette')) {
    const compte = valeur('compte');
    if (!compte) throw new Error('--recette demande --compte');
    const r = resoudreConfig({ source: { type: 'recette', cheminCompte: compte, cheminRecette: recette, mode: { type: 'box' } } });
    cas.push({ libelle: `recette ${r.recette?.monsterName}`, params: r.params });
  }
  if (!cas.length) throw new Error('Rien à faire : --cas=<sel> et/ou --compte=… --recette=…');
  const moities = (valeur('moities') ?? 'A,B').split(',');
  if (moities.some((h) => h !== 'A' && h !== 'B')) throw new Error('--moities attend A,B.');
  const ordre = valeur('ordre') as OrdreCombos | undefined;
  if (ordre && !['potential', 'relevance', 'combined', 'objective'].includes(ordre)) throw new Error('--ordre inconnu.');
  const chemin = await ensureBuildHalfBundle();
  const lignes = [];
  for (const c of cas) {
    const params = { ...c.params };
    const overrides: string[] = [];
    if (ordre) { params.combosOrderMode = ordre; overrides.push(`combosOrderMode=${ordre}`); }
    if (valeur('slotFilterCap') != null) {
      params.slotFilterCap = Number(valeur('slotFilterCap'));
      delete params.bucketCap;
      overrides.push(`slotFilterCap=${params.slotFilterCap} (bucketCap dérivé)`);
    }
    const p = prepareSearch(params);
    console.log(c.libelle, overrides.length ? `DIVERGE DE LA PROD : ${overrides.join(', ')}` : 'réglages de production');
    if (!p) { console.log('préparation vide'); continue; }
    const r = await construireMoitiesEnParallele(p, params, chemin);
    for (const h of moities) {
      const buckets = h === 'A' ? r.bucketsA : r.bucketsB;
      const ligne = { cas: c.libelle, moitie: h, travailleursDuPool: nombreDeTravailleurs(availableParallelism(), null),
        compartiments: buckets.length, combos: buckets.reduce((n, b) => n + b.combos.length, 0),
        msTranches: h === 'A' ? r.msA : r.msB, msConstructionMur: r.wallMs };
      lignes.push(ligne);
      console.log(JSON.stringify(ligne));
    }
  }
  console.log('Temps INDICATIFS : un passage, sans comparaison ; somme interne des tranches hors fusion, durée murale de toute la construction.');
  const json = valeur('json');
  if (json) writeFileSync(json, JSON.stringify(lignes, null, 2), 'utf8');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
