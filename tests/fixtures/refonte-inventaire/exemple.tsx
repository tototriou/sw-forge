// Fixture de `tests/refonte-inventaire.test.ts` : chaque ligne marquée VU doit
// entrer dans l'inventaire, chaque ligne marquée IGNORÉ ne doit pas y entrer.
// Jamais compilée par l'app (hors de src/).

export function Exemple({ route, ouvert, setMessage }: { route: string; ouvert: boolean; setMessage: (m: string) => void }) {
  const onglets = [{ key: 'a', label: 'Ma prépa', hash: '#/rta' }]; // VU prop:label, route
  const classe = ouvert ? 'bg-panel text-ink' : 'bg-bg'; // IGNORÉ : pas affiché
  if (route === 'accueil') setMessage('Fichier importé'); // VU message ; IGNORÉ la comparaison
  return (
    <div className="flex gap-2" data-test="ignore-moi">
      Texte affiché
      <button title="Infobulle" aria-label={ouvert ? 'Fermer le panneau' : 'Ouvrir le panneau'}>
        {ouvert ? 'Replier' : 'Déplier'}
      </button>
      {ouvert && 'Seulement ouvert'}
      {route === 'rta' ? <span>Prépa</span> : null}
      <a href="#/siege/defense">Défense</a>
      <input placeholder={`Rechercher ${route}…`} />
      <p>L&apos;apostrophe décodée</p>
      {onglets.map((o) => o.label.toUpperCase())}
      {String('appel ignoré')}
      <span className={classe}>12</span>
    </div>
  );
}
