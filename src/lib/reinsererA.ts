// Remettre un élément À SA PLACE dans une liste (« Annuler » une
// suppression) : à l'index d'origine, borné à la liste actuelle — pas au
// bout. Une seule copie pour les équipes de siège et les recommandations, pour
// qu'un correctif les touche toutes. Pure, pour être testée.
export function reinsererA<T>(liste: T[], el: T, index: number): T[] {
  const copie = [...liste];
  copie.splice(Math.min(Math.max(index, 0), copie.length), 0, el);
  return copie;
}
