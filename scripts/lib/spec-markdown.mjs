// Parseur Markdown partagé pour les vérifications de rangement de `spec/`.
//
// ⚠️ **Une seule implémentation dans le dépôt** : tout script (contrôle de
// slugs, de niveaux, `spec-toc`, `spec-lint`) importe ce fichier — jamais une
// copie scratch, jamais une réimplémentation dans un hook. Voir
// `CADRAGE-rangement-specs.md`, B.2, B.3 et B.4.
//
// `titres(texte)` repère les lignes `^#{1,6} …`, hors blocs de code clôturés
// (```` ``` ```` ou `~~~`) : un exemple de titre Markdown DANS une citation
// de code n'est pas un titre du document.
//
// `slug(titre, compteurs)` reproduit l'algorithme de `github-slugger` : passage
// en minuscules, suppression des caractères qui ne sont ni lettre Unicode
// (accents conservés), ni chiffre, ni espace, ni `-`, puis chaque espace
// devient un `-`. Le second paramètre — une `Map` que l'appelant réutilise
// d'un titre à l'autre du MÊME document — porte le compteur d'occurrences :
// un slug déjà vu reçoit le suffixe `-1`, `-2`… dans l'ordre du fichier,
// comme les ancres réellement générées par GitHub.
//
// `sections(texte)` construit, pour CHAQUE titre, sa plage de lignes (jusqu'au
// prochain titre de niveau ≤ au sien) et sa première phrase de prose. Le
// compteur de slugs est une `Map` NEUVE créée ici : la fonction traite un
// fichier entier par appel, jamais un fragment partagé avec un autre fichier.
//
// `enTete(texte)` lit les lignes `**Champ :** valeur` entre le H1 et la
// première ligne de contenu qui n'en est pas une (les lignes vides
// intercalées sont ignorées, pas terminales — un en-tête réel du dépôt a une
// ligne vide entre le H1 et son premier champ). Absent ou périmé, elle rend
// `{ statut: null, lireSi: null }` : ce n'est pas une erreur ici, seulement
// pour `spec-lint`.
//
// `blocsTerminaux(texte)` découpe le fichier en blocs terminaux au sens de
// B.4 : les lignes entre un titre (exclu) et le PROCHAIN TITRE DE N'IMPORTE
// QUEL NIVEAU (exclu), ou la fin du fichier — pas jusqu'au niveau ≤ au sien
// comme `sections()`. Le préambule (avant le premier titre) est un bloc.
//
// `referencesSection(texte)` repère, hors bloc de code, les occurrences
// `fichier.md § Section` (champ `Source :` ou mention inline) que
// `spec-lint` résout vers un titre existant — la comparaison se fait PAR
// SLUG (`slug()` neutralise lien Markdown, parenthèses et backticks), donc la
// section capturée n'a pas besoin d'être un texte « propre ». La référence
// s'étend jusqu'à la fin de la phrase ou du séparateur « ; » : une parenthèse
// ou un crochet fermant équilibré par une ouverture VUE DEPUIS LE DÉBUT DE LA
// RÉFÉRENCE (mi-titre, ex. « 3.2 Dgts CRIT … (222-223) — ✅ IMPLÉMENTÉ ») ne
// termine plus la capture ; seul un fermant SANS ouvrant correspondant dans
// la capture la termine — c'est soit la parenthèse qui enveloppe toute la
// référence (« (fichier.md § Titre) »), soit le crochet fermant d'un lien
// Markdown (« [fichier.md § Titre](url) »). Un `;` termine toujours, sans
// condition de solde.
//
// `fichiersMarkdown(chemin)` liste récursivement les `.md` d'un fichier ou
// dossier, hors `node_modules/` et `.git/` — le « mode dossier » de
// `spec-toc` (B.3), partagé avec `spec-lint` qui en a besoin pour parcourir
// le périmètre.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function titres(texte) {
  const lignes = texte.split(/\r\n|\n/);
  const resultat = [];
  let dansBloc = false;
  lignes.forEach((ligne, index) => {
    if (/^(`{3,}|~{3,})/.test(ligne.trim())) {
      dansBloc = !dansBloc;
      return;
    }
    if (dansBloc) return;
    const m = ligne.match(/^(#{1,6}) (.+)$/);
    if (m) {
      resultat.push({ niveau: m[1].length, texte: m[2].trim(), ligne: index + 1 });
    }
  });
  return resultat;
}

export function slug(titre, compteurs = new Map()) {
  const base = titre
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');
  const rangPrecedent = compteurs.get(base) ?? -1;
  const rang = rangPrecedent + 1;
  compteurs.set(base, rang);
  return rang === 0 ? base : `${base}-${rang}`;
}

// Un booléen par ligne : la ligne appartient-elle à un bloc de code (la ligne
// de clôture elle-même comprise, comme `titres()` qui ne la traite jamais
// comme un titre).
function lignesDansBloc(lignes) {
  const dansBloc = [];
  let etat = false;
  for (const ligne of lignes) {
    if (/^(`{3,}|~{3,})/.test(ligne.trim())) {
      etat = !etat;
      dansBloc.push(true);
      continue;
    }
    dansBloc.push(etat);
  }
  return dansBloc;
}

// Première phrase de prose entre les lignes `debut+1` et `borne` (1-indexées,
// incluses) : premier paragraphe hors lignes vides, blocs de code et
// tableaux. Un item de liste compte comme de la prose, mais forme À LUI SEUL
// son paragraphe — il ne fusionne pas avec l'item suivant, même sans ligne
// vide entre les deux, sinon « première phrase » d'une section qui commence
// par une liste serait la liste entière.
function premierePhrase(lignes, dansBloc, debut, borne) {
  const paragraphe = [];
  for (let n = debut + 1; n <= borne; n++) {
    const brut = (lignes[n - 1] ?? '').trim();
    const horsProse = dansBloc[n - 1] || brut === '' || /^\|/.test(brut);
    if (horsProse) {
      if (paragraphe.length) break;
      continue;
    }
    paragraphe.push(brut);
    if (/^([-*+]|\d+[.)])\s/.test(brut)) break;
  }
  if (!paragraphe.length) return '—';
  const jointe = paragraphe.join(' ');
  return jointe.length > 120 ? jointe.slice(0, 120) : jointe;
}

export function sections(texte) {
  const lignes = texte.split(/\r\n|\n/);
  const dansBloc = lignesDansBloc(lignes);
  const listeTitres = titres(texte);
  const compteurs = new Map();
  return listeTitres.map((t, i) => {
    const debut = t.ligne;
    let fin = lignes.length;
    for (let j = i + 1; j < listeTitres.length; j++) {
      if (listeTitres[j].niveau <= t.niveau) {
        fin = listeTitres[j].ligne - 1;
        break;
      }
    }
    // La prose recherchée s'arrête au premier sous-titre de LA section, même
    // s'il n'a pas mis fin à la plage (un sous-titre ne termine pas la plage
    // de son parent, seul un titre de niveau ≤ le fait).
    const premierSousTitreLigne = i + 1 < listeTitres.length && listeTitres[i + 1].ligne <= fin
      ? listeTitres[i + 1].ligne - 1
      : fin;
    return {
      niveau: t.niveau,
      titre: t.texte,
      slug: slug(t.texte, compteurs),
      debut,
      fin,
      premierePhrase: premierePhrase(lignes, dansBloc, debut, premierSousTitreLigne),
    };
  });
}

export function enTete(texte) {
  const lignes = texte.split(/\r\n|\n/);
  const h1 = titres(texte).find((t) => t.niveau === 1);
  if (!h1) return { statut: null, lireSi: null };
  const champs = {};
  for (let n = h1.ligne + 1; n <= lignes.length; n++) {
    const brut = (lignes[n - 1] ?? '').trim();
    if (brut === '') continue;
    const m = brut.match(/^\*\*([^*:]+?)\s*:\*\*\s*(.*)$/);
    if (!m) break;
    champs[m[1].trim()] = m[2].trim();
  }
  return {
    statut: champs['Statut'] ?? null,
    lireSi: champs['Lire si'] ?? null,
  };
}

export function blocsTerminaux(texte) {
  const lignes = texte.split(/\r\n|\n/);
  const listeTitres = titres(texte);
  const blocs = [];
  const ajouter = (debut, fin) => {
    if (fin >= debut) blocs.push({ debut, fin, lignes: fin - debut + 1 });
  };
  if (listeTitres.length === 0) {
    ajouter(1, lignes.length);
    return blocs;
  }
  ajouter(1, listeTitres[0].ligne - 1);
  listeTitres.forEach((t, i) => {
    const debut = t.ligne + 1;
    const fin = i + 1 < listeTitres.length ? listeTitres[i + 1].ligne - 1 : lignes.length;
    ajouter(debut, fin);
  });
  return blocs;
}

// `X.md § ` — début d'une référence, comme champ `**Source :**` ou mention
// inline (y compris dans un lien `[X.md § Section](...)`) — hors bloc de
// code. La fin de la section se détermine ensuite caractère par caractère
// (voir plus haut), pas par cette seule regex.
const RE_REFERENCE_DEBUT = /([\w./-]+\.md)\s*§\s*/g;

export function referencesSection(texte) {
  const lignes = texte.split(/\r\n|\n/);
  const dansBloc = lignesDansBloc(lignes);
  const resultat = [];
  lignes.forEach((ligne, index) => {
    if (dansBloc[index]) return;
    for (const m of ligne.matchAll(RE_REFERENCE_DEBUT)) {
      const debut = m.index + m[0].length;
      let profondeurParenthese = 0;
      let profondeurCrochet = 0;
      let fin = ligne.length;
      for (let i = debut; i < ligne.length; i++) {
        const c = ligne[i];
        if (c === ';') { fin = i; break; }
        if (c === '(') { profondeurParenthese++; continue; }
        if (c === ')') {
          if (profondeurParenthese === 0) { fin = i; break; }
          profondeurParenthese--;
          continue;
        }
        if (c === '[') { profondeurCrochet++; continue; }
        if (c === ']') {
          if (profondeurCrochet === 0) { fin = i; break; }
          profondeurCrochet--;
          continue;
        }
      }
      const section = ligne.slice(debut, fin).trim().replace(/[\s.,;:]+$/, '');
      if (section) resultat.push({ ligne: index + 1, fichier: m[1], section });
    }
  });
  return resultat;
}

export function fichiersMarkdown(chemin) {
  const info = statSync(chemin);
  if (info.isFile()) return [chemin];
  const resultat = [];
  for (const entree of readdirSync(chemin, { withFileTypes: true })) {
    if (entree.name === 'node_modules' || entree.name === '.git') continue;
    const sousChemin = join(chemin, entree.name);
    if (entree.isDirectory()) resultat.push(...fichiersMarkdown(sousChemin));
    else if (entree.name.endsWith('.md')) resultat.push(sousChemin);
  }
  return resultat.sort();
}
