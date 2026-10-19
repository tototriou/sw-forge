// Les deux colonnes repliables de l'Optimizer au bureau, « Artéfacts et
// relique » et « Aura, exclusion, avancés », et le contrôle à onglets qui les
// ouvre (docs/02-app/optimizer/ecran/README.md, « Mise en page d'ensemble »).
//
// ⚠️ **Un état d'ouverture, pas un critère de recherche** : il vit dans
// l'écran, jamais dans `useOptimizerState` — rien à exporter dans une recette,
// rien à remettre à zéro au changement de monstre (même règle que le
// dépliement des réglages avancés).

export type ColonneRepliable = 'artefacts' | 'complements';

export interface ColonnesOuvertes {
  artefacts: boolean;
  complements: boolean;
  // La dernière ouverte : celle qui reste seule quand la largeur n'en tient
  // plus qu'une.
  derniere: ColonneRepliable | null;
}

export const AUCUNE_COLONNE: ColonnesOuvertes = { artefacts: false, complements: false, derniere: null };

const AUTRE: Record<ColonneRepliable, ColonneRepliable> = { artefacts: 'complements', complements: 'artefacts' };

// Les colonnes réellement affichées : là où une seule tient (`deuxTiennent`
// faux), la dernière ouverte seule — l'état garde les deux, pour les rendre
// ensemble si la largeur revient.
export function colonnesAffichees(etat: ColonnesOuvertes, deuxTiennent: boolean): Record<ColonneRepliable, boolean> {
  if (deuxTiennent || !(etat.artefacts && etat.complements)) return { artefacts: etat.artefacts, complements: etat.complements };
  const seule = etat.derniere ?? 'artefacts';
  return { artefacts: seule === 'artefacts', complements: seule === 'complements' };
}

// Le clic sur un onglet. Recliquer l'onglet affiché referme sa colonne ;
// cliquer l'autre l'ouvre, et ferme la première là où une seule tient. Là où
// les deux tiennent, la seconde s'ajoute à la première.
export function basculerColonne(etat: ColonnesOuvertes, colonne: ColonneRepliable, deuxTiennent: boolean): ColonnesOuvertes {
  const affichees = colonnesAffichees(etat, deuxTiennent);
  const autre = AUTRE[colonne];
  if (affichees[colonne]) {
    const restante = deuxTiennent ? etat[autre] : false;
    return { ...etat, [colonne]: false, [autre]: restante, derniere: restante ? autre : null };
  }
  return { ...etat, [colonne]: true, [autre]: deuxTiennent ? affichees[autre] : false, derniere: colonne };
}
