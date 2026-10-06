// La mise à jour de l'application de bureau, côté page — chantier
// application-bureau, lot 5 (décisions 11 et 12 ; src/components/BlocApplication.tsx).
//
// ⚠️ Ce que le bloc « Application » des Réglages promet : la mise à jour
// remise à plus tard reste faisable ICI, le bouton ne disparaît jamais, et
// rien ne se télécharge sans un clic sur « Mettre à jour ».

import { presentationMiseAJour } from '../src/components/BlocApplication';
import { egal, ok, titre } from './outils';

export default function testBureauMiseAJour() {
  titre('bureau · mise à jour — le bloc « Application », phase par phase');
  const v = '2.0.1';
  const cas: [Parameters<typeof presentationMiseAJour>[0], string, boolean][] = [
    [null, 'Rechercher', true],
    [{ phase: 'aucune', version: '2.0.0' }, 'Rechercher', true],
    [{ phase: 'recherche', version: '2.0.0' }, 'Recherche…', false],
    [{ phase: 'a-jour', version: '2.0.0' }, 'Rechercher', true],
    [{ phase: 'injoignable', version: '2.0.0' }, 'Rechercher', true],
    [{ phase: 'disponible', version: v }, 'Mettre à jour', true],
    [{ phase: 'telechargement', version: v }, 'Téléchargement…', false],
    [{ phase: 'prete', version: v }, 'Redémarrer', true],
    [{ phase: 'echec', version: v }, 'Réessayer', true],
  ];
  for (const [etat, libelle, actif] of cas) {
    const p = presentationMiseAJour(etat);
    const nom = etat?.phase ?? 'rien reçu';
    egal(p.libelle, libelle, `${nom} : « ${libelle} »`);
    egal(!!p.action, actif, `${nom} : bouton ${actif ? 'actif' : 'désactivé — mais affiché'}`);
    ok(p.texte.length > 0, `${nom} : une ligne d'explication (hauteur constante)`);
  }
  ok(presentationMiseAJour({ phase: 'disponible', version: v }).texte.includes(v), 'disponible : la version est dite');
  ok(presentationMiseAJour({ phase: 'prete', version: v }).texte.includes('fermeture'), 'prête : installée à la fermeture, dit');

  titre('bureau · mise à jour — rien sans un clic');
  // Aucune phase ne télécharge d'elle-même : seules « disponible » et
  // « echec » mènent à un téléchargement, et seulement par leur bouton.
  const versTelechargement = cas.filter(([e]) => {
    const p = presentationMiseAJour(e);
    return p.libelle === 'Mettre à jour' || p.libelle === 'Réessayer';
  });
  egal(versTelechargement.map(([e]) => e?.phase), ['disponible', 'echec'], 'seuls « disponible » et « echec » proposent de télécharger');
}
