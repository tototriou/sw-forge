// Parseur Markdown partagé pour les vérifications de rangement de `spec/`.
//
// ⚠️ **Une seule implémentation dans le dépôt** : tout script (contrôle de
// slugs, de niveaux, futur `spec-toc`) importe ce fichier — jamais une copie
// scratch, jamais une réimplémentation dans un hook. Voir
// `CADRAGE-rangement-specs.md`, B.2.
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
