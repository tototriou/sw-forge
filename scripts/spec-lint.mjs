// Vérifie les documents de `spec/` contre le contrat de rangement — B.4 de
// `CADRAGE-rangement-specs.md`. Deux régimes : documents actifs (bloc
// terminal ≤ 100 lignes, fichier ≤ 500 hors exception, en-tête avec Statut
// reconnu, slugs uniques, références `fichier § section` résolues) et
// `archive/` (seule la présence de `**Statut :** ARCHIVE` est exigée).
//
// Usage : `node scripts/spec-lint.mjs [--json]`
// Périmètre et exceptions déclarés dans `spec/spec-lint.json`.
//
// ⚠️ Le parseur (titres, blocs, en-tête, références, mode dossier) vit dans
// `scripts/lib/spec-markdown.mjs`, partagé avec `spec-toc` — ce script ne
// fait qu'appliquer les règles de B.4 et mettre en forme.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocsTerminaux, enTete, fichiersMarkdown, referencesSection, slug, titres } from './lib/spec-markdown.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

function estDansPerimetre(relatif, perimetre) {
  return perimetre.some((motif) => {
    const prefixe = motif.replace(/\/\*\*$/, '');
    return relatif === prefixe || relatif.startsWith(`${prefixe}/`);
  });
}

function estArchive(relatif) {
  return /(^|\/)archive\//.test(relatif);
}

// B.5 : un Statut n'est reconnu que s'il commence par une des trois natures
// (A.2) — « présent et non vide » ne suffit plus depuis le lot 5. Comparaison
// insensible à la casse : les en-têtes existants écrivent « État actuel »,
// pas « ÉTAT ACTUEL ».
const NATURES_RECONNUES = ['ÉTAT ACTUEL', 'DÉCISION', 'ARCHIVE'];

function statutReconnu(statut) {
  if (!statut || !statut.trim()) return false;
  const normalise = statut.trim().toUpperCase();
  return NATURES_RECONNUES.some((nature) => normalise.startsWith(nature));
}

// Un lien/`Source :` peut désigner un chemin relatif au fichier qui le
// porte, à la racine du dépôt, ou à `spec/` — le premier qui existe gagne.
function resoudreChemin(cheminSource, racine, refFichier) {
  const candidats = [
    resolve(dirname(cheminSource), refFichier),
    resolve(racine, refFichier),
    resolve(racine, 'spec', refFichier),
  ];
  return candidats.find((c) => existsSync(c)) ?? null;
}

// `verifier` s'exécute en deux passes implicites via le cache : la présence
// d'une exception se juge sur l'état ACTUEL du fichier visé (fichier > 500
// ou au moins un bloc > 100), pas sur sa seule inscription dans la liste.
//
// `options.inclureLongueurs = false` limite le contrôle aux en-têtes, aux
// slugs et aux références — c'est la cible `spec-lint-en-tetes` de B.4 ;
// `true` (par défaut) ajoute les longueurs et les exceptions — la cible
// `spec-lint`.
export function verifier(racine, config, options = {}) {
  const inclureLongueurs = options.inclureLongueurs ?? true;
  const perimetre = config.perimetre ?? [];
  const exceptions = config.exceptions ?? [];
  const exceptionsParFichier = new Map(exceptions.map((e) => [e.fichier, e]));
  const exceptionsUtilisees = new Set();
  const erreurs = [];
  const slugsCache = new Map();

  function slugsDe(cheminAbsolu) {
    if (slugsCache.has(cheminAbsolu)) return slugsCache.get(cheminAbsolu);
    const compteurs = new Map();
    const texte = readFileSync(cheminAbsolu, 'utf8');
    const ensemble = new Set(titres(texte).map((t) => slug(t.texte, compteurs)));
    slugsCache.set(cheminAbsolu, ensemble);
    return ensemble;
  }

  for (const cheminAbsolu of fichiersMarkdown(racine)) {
    const relatif = relative(racine, cheminAbsolu).replace(/\\/g, '/');
    if (!estDansPerimetre(relatif, perimetre)) continue;

    const texte = readFileSync(cheminAbsolu, 'utf8');
    const { statut } = enTete(texte);

    if (estArchive(relatif)) {
      if (!statut || !statut.trim().startsWith('ARCHIVE')) {
        erreurs.push({ fichier: relatif, regle: 'statut-archive', message: 'en-tête sans « **Statut :** ARCHIVE »' });
      }
      continue; // archive/ : aucune autre règle (A.2, B.4)
    }

    if (!statutReconnu(statut)) {
      erreurs.push({ fichier: relatif, regle: 'entete', message: 'en-tête absent ou sans champ Statut reconnu' });
    }

    // Slugs dupliqués : slug SANS compteur partagé (chaque titre jugé isolément) —
    // sinon slug() les déduplique lui-même (`-1`, `-2`) et deux titres identiques
    // ne collisionneraient jamais.
    const vus = new Map();
    for (const t of titres(texte)) {
      const base = slug(t.texte);
      if (vus.has(base)) {
        erreurs.push({ fichier: relatif, ligne: t.ligne, regle: 'slug-duplique', message: `slug « ${base} » déjà utilisé à la ligne ${vus.get(base)}` });
      } else {
        vus.set(base, t.ligne);
      }
    }

    for (const ref of referencesSection(texte)) {
      const cible = resoudreChemin(cheminAbsolu, racine, ref.fichier);
      const slugRef = slug(ref.section);
      if (!cible || !slugsDe(cible).has(slugRef)) {
        erreurs.push({ fichier: relatif, ligne: ref.ligne, regle: 'reference-cassee', message: `« ${ref.fichier} § ${ref.section} » non résolue` });
      }
    }

    if (!inclureLongueurs) continue;

    const nbLignes = texte.split(/\r\n|\n/).length;
    const blocs = blocsTerminaux(texte);
    const depasseFichier = nbLignes > 500;
    const depasseBloc = blocs.some((b) => b.lignes > 100);
    const exception = exceptionsParFichier.get(relatif);

    if (exception) {
      exceptionsUtilisees.add(relatif);
      if (!depasseFichier && !depasseBloc) {
        erreurs.push({ fichier: relatif, regle: 'exception-perimee', message: `${nbLignes} lignes, aucun bloc > 100 : l'exception doit être retirée` });
      }
      continue;
    }

    if (depasseFichier) {
      erreurs.push({ fichier: relatif, regle: 'fichier-trop-long', message: `${nbLignes} lignes (> 500)` });
    }
    for (const bloc of blocs) {
      if (bloc.lignes > 100) {
        erreurs.push({ fichier: relatif, ligne: bloc.debut, regle: 'bloc-trop-long', message: `bloc de ${bloc.lignes} lignes (> 100)` });
      }
    }
  }

  return { erreurs, exceptionsUtilisees };
}

function main() {
  const config = JSON.parse(readFileSync(resolve(RACINE, 'spec/spec-lint.json'), 'utf8'));
  const veutJson = process.argv.includes('--json');
  const veutEnTetesSeules = process.argv.includes('--en-tetes');
  const { erreurs } = verifier(RACINE, config, { inclureLongueurs: !veutEnTetesSeules });

  if (veutJson) {
    console.log(JSON.stringify(erreurs, null, 2));
  } else if (erreurs.length === 0) {
    console.log('spec-lint : aucune erreur.');
  } else {
    for (const e of erreurs) {
      console.error(`${e.fichier}${e.ligne ? `:${e.ligne}` : ''} [${e.regle}] ${e.message}`);
    }
  }
  process.exit(erreurs.length === 0 ? 0 : 1);
}

// ⚠️ Pas de comparaison par `import.meta.url` : ce fichier est aussi importé
// (pour `verifier()`) par les tests, empaquetés par esbuild — son
// `import.meta.url` n'y désigne pas fiablement CE module. Le nom de
// l'argv[1] réel, lui, ne varie pas.
const executeDirectement = Boolean(process.argv[1]?.replace(/\\/g, '/').endsWith('/spec-lint.mjs'));
if (executeDirectement) main();
