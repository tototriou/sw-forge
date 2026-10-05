// L'habillage de la fenêtre de bureau — chantier application-bureau, lot 1 bis
// (bureau/fenetre.ts, src/lib/bureau.ts).
//
// ⚠️ L'état mémorisé se relit avec méfiance : une fenêtre rouverte HORS de
// tout écran (moniteur débranché) serait introuvable, et l'utilisateur n'aurait
// aucun moyen de la récupérer depuis l'app.

import { couleursValides, DEFAUT, lireEtat, MINIMUM } from '../bureau/fenetre';
import { estBureau, tripletVersHex } from '../src/lib/bureau';
import { egal, ok, titre } from './outils';

const PRINCIPAL = { x: 0, y: 0, largeur: 1920, hauteur: 1040 };
const SECOND = { x: 1920, y: 0, largeur: 2560, hauteur: 1400 };

export default function testBureauFenetre() {
  titre('bureau · fenêtre — premier lancement et fichier illisible');
  egal(lireEtat(null, [PRINCIPAL]), { largeur: DEFAUT.largeur, hauteur: DEFAUT.hauteur, agrandie: false }, 'aucun fichier : taille par défaut, centrée');
  egal(lireEtat('pas un objet', [PRINCIPAL]).largeur, DEFAUT.largeur, 'fichier corrompu : les défauts');
  egal(lireEtat({ largeur: 'grand', hauteur: NaN }, [PRINCIPAL]).hauteur, DEFAUT.hauteur, 'valeurs illisibles : les défauts');

  titre('bureau · fenêtre — ce qui est repris');
  const repris = lireEtat({ x: 100, y: 80, largeur: 1500, hauteur: 950, agrandie: true }, [PRINCIPAL]);
  egal(repris, { x: 100, y: 80, largeur: 1500, hauteur: 950, agrandie: true }, 'position, taille et état agrandi repris');
  egal(lireEtat({ x: 2000, y: 100, largeur: 2400, hauteur: 1300 }, [PRINCIPAL, SECOND]).x, 2000, 'sur le second écran : la position reste');

  titre('bureau · fenêtre — jamais hors d’écran, jamais trop petite');
  const debranche = lireEtat({ x: 2000, y: 100, largeur: 2400, hauteur: 1300 }, [PRINCIPAL]);
  ok(debranche.x === undefined && debranche.y === undefined, 'second écran débranché : la fenêtre revient, centrée sur le principal');
  egal(debranche.largeur, 1920, '… et ne dépasse pas l’écran qui l’accueille');
  ok(lireEtat({ x: -1400, y: 100, largeur: 1440, hauteur: 900 }, [PRINCIPAL]).x === undefined, 'presque entièrement hors écran : recentrée');
  ok(lireEtat({ x: 100, y: 1030, largeur: 1440, hauteur: 900 }, [PRINCIPAL]).y === undefined, 'barre sous le bas de l’écran : recentrée');
  egal(lireEtat({ largeur: 600, hauteur: 300 }, [PRINCIPAL]), { largeur: MINIMUM.largeur, hauteur: MINIMUM.hauteur, agrandie: false }, 'plus petite que le minimum (format bureau, 1024 px) : relevée');

  titre('bureau · fenêtre — couleurs');
  const c = { fond: '#161514', barre: '#1b1a19', symboles: '#ede3d1' };
  egal(couleursValides(c), c, 'trois couleurs #rrggbb : acceptées');
  egal(couleursValides({ ...c, barre: 'red' }), undefined, 'une couleur mal formée : tout refusé');
  egal(couleursValides({ fond: '#000000' }), undefined, 'incomplètes : refusées');
  egal(lireEtat({ couleurs: { ...c, symboles: 'javascript:' } }, [PRINCIPAL]).couleurs, undefined, 'couleurs douteuses du fichier : ignorées');
  egal(tripletVersHex('27 26 25'), '#1b1a19', 'jeton « 27 26 25 » → #1b1a19');
  egal(tripletVersHex(' 255 253 248 '), '#fffdf8', 'espaces autour : tolérés');
  egal(tripletVersHex('256 0 0'), null, 'hors 0–255 : refusé');
  egal(tripletVersHex('var(--forge-bg)'), null, 'non résolu : refusé');

  titre('bureau · sur le site, rien');
  egal(estBureau(), false, 'hors de l’app de bureau, estBureau() vaut false');
}
