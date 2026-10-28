// L'adresse de la vue de développement des gabarits de l'Optimizer
// (docs/03-developpeur/vue-des-gabarits.md). `parseHash` (App.tsx)
// la lit déjà comme l'Optimizer : c'est `OutilsPage` qui la reconnaît, en
// développement seulement.
export const ADRESSE_GABARITS = '#/outils/optimizer/gabarits';

export function estAdresseGabarits(hash: string): boolean {
  return hash.replace(/^#\/?/, '').replace(/\/+$/, '') === ADRESSE_GABARITS.slice(2);
}
