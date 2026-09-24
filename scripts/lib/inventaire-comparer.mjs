// Comparaison d'inventaires de l'interface — lot 0 de
// `spec/chantiers/refonte-graphique.md` (B.0, A.6).
//
// Pur : aucune dépendance, aucun accès disque. L'extraction (qui a besoin du
// compilateur TypeScript) vit dans `scripts/inventaire-ui.mjs` ; ce module ne
// fait que DÉCIDER si un inventaire courant a perdu quelque chose par rapport à
// la référence figée.
//
// ⚠️ Une entrée de la référence absente de son fichier n'est acceptée que dans
// deux cas, et aucun autre (A.6) :
//   - elle est DÉPLACÉE : `deplacements["<fichier> :: <entrée>"] = { de, vers }`
//     ET on la retrouve bien dans le fichier `vers` — un déplacement déclaré
//     mais pas fait est une perte ;
//   - son retrait a été DÉCIDÉ par Thomas : `{ de, retrait: "A.2 bis #<n>" }`
//     ET le numéro figure dans A.2 bis sous la forme `[retrait #<n>]`.
// Une entrée NOUVELLE est toujours acceptée : ajouter n'efface rien.

export function cle(fichier, entree) {
  return `${fichier} :: ${entree}`;
}

// Numéros des retraits décidés : `[retrait #<n>]` dans la section A.2 bis du
// cadrage, et seulement là — un « [retrait #3] » cité ailleurs (un exemple, la
// Partie B) ne vaut pas décision.
export function decisionsRetrait(texteCadrage) {
  const debut = texteCadrage.search(/^###\s+A\.2 bis\b/m);
  if (debut < 0) return new Set();
  const reste = texteCadrage.slice(debut);
  // Le titre suivant se cherche APRÈS la ligne de titre de A.2 bis : chercher
  // depuis le 2ᵉ caractère retombait sur « ## A.2 bis » lui-même, et la section
  // lue était toujours vide (vu au premier passage du test).
  const finTitre = reste.indexOf('\n');
  const suivant = finTitre < 0 ? -1 : reste.slice(finTitre).search(/^#{1,3}\s/m);
  const section = suivant < 0 ? reste : reste.slice(0, finTitre + suivant);
  return new Set([...section.matchAll(/\[retrait #(\d+)\]/g)].map((m) => Number(m[1])));
}

export function comparer(reference, courant, deplacements, decisions) {
  const manquants = [];
  const deplacementsNonFaits = [];
  const retraitsNonDecides = [];
  const declares = new Set();

  for (const fichier of Object.keys(reference).sort()) {
    const ici = new Set(courant[fichier] ?? []);
    for (const entree of reference[fichier]) {
      if (ici.has(entree)) continue;
      const k = cle(fichier, entree);
      const d = deplacements[k];
      if (!d) {
        manquants.push({ fichier, entree });
        continue;
      }
      declares.add(k);
      if (d.retrait !== undefined) {
        const n = Number(String(d.retrait).match(/#(\d+)/)?.[1]);
        if (!decisions.has(n)) retraitsNonDecides.push({ fichier, entree, retrait: d.retrait });
      } else if (!(courant[d.vers] ?? []).includes(entree)) {
        deplacementsNonFaits.push({ fichier, entree, vers: d.vers });
      }
    }
  }

  // Une déclaration qui ne correspond à aucune disparition réelle est une
  // erreur aussi : elle masquerait, plus tard, une vraie perte de même nom.
  const orphelins = Object.keys(deplacements).filter((k) => !declares.has(k)).sort();

  return {
    ok: !manquants.length && !deplacementsNonFaits.length && !retraitsNonDecides.length && !orphelins.length,
    manquants,
    deplacementsNonFaits,
    retraitsNonDecides,
    orphelins,
  };
}
