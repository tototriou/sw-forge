// Télécharge un texte en fichier, sans aucun envoi réseau. Sur le site, le
// navigateur l'enregistre ; dans l'application de bureau, la boîte
// « Enregistrer sous » s'ouvre (bureau/navigation.ts).
//
// L'adresse du fichier est libérée une minute après le clic, pas aussitôt :
// rien ne garantit que le téléchargement l'a déjà lue (une session pèse
// quelques Mo), et la libérer ne fait que rendre la mémoire plus tôt.
export function telechargerTexte(nomFichier: string, texte: string) {
  const url = URL.createObjectURL(new Blob([texte], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
