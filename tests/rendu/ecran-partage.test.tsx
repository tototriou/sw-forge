// Écran partagé : ce que montrent un volet, la barre latérale et la barre du
// haut (docs/02-app/transverse/feat-navigation/ecran-partage.md). Les
// transitions (navigation, verrou, fermeture) sont vérifiées sur le calcul pur,
// dans tests/volets.test.ts.

import VoletEcran from '../../src/components/VoletEcran';
import { RecherchePalette } from '../../src/components/Palette';
import Sidebar from '../../src/components/Sidebar';
import { DeuxVolets } from '../../src/ui';
import { egal, ok, titre } from '../outils';
import { bouton, rendre, texteVisible } from './outils-rendu';
import { rendreApp } from './app.test';

const rien = () => {};

function volet(p: { actif: boolean; verrouille: boolean; verrouIndisponible: boolean }) {
  return rendre(
    <VoletEcran
      fil={['Outils', 'Optimizer']}
      {...p}
      onActiver={rien}
      onVerrouiller={rien}
      onInverser={rien}
      onFermer={rien}
    >
      <p>contenu</p>
    </VoletEcran>
  );
}

export function testRenduEcranPartageVolet() {
  titre('rendu · Écran partagé — l\'en-tête d\'un volet');

  const actif = volet({ actif: true, verrouille: false, verrouIndisponible: false });
  ok(actif.includes('aria-label="Volet actif : Optimizer"'), 'le volet nomme sa page et dit qu\'il est actif');
  ok(/border-accent/.test(actif) && !/border-border-soft[^"]*bg-bg/.test(actif), 'le volet actif : UN contour, d\'accent');
  ok(texteVisible(actif).includes('Outils Optimizer'), 'son fil d\'Ariane');
  const verrou = bouton(actif, 'Verrouiller ce volet : sa page ne changera plus en naviguant');
  ok(!!verrou && verrou.presse === false && !verrou.desactive, 'le cadenas, ouvert');
  ok(bouton(actif, 'Inverser les volets') !== undefined, 'inverser les volets');
  ok(bouton(actif, 'Fermer ce volet')?.desactive === false, 'la croix ferme le volet');

  const verrouille = volet({ actif: false, verrouille: true, verrouIndisponible: false });
  ok(verrouille.includes('aria-label="Volet inactif : Optimizer"'), 'un volet inactif le dit');
  ok(texteVisible(verrouille).includes('Verrouillé'), 'un volet verrouillé l\'affiche');
  egal(bouton(verrouille, 'Déverrouiller ce volet')?.presse, true, 'son cadenas est enclenché');
  egal(bouton(verrouille, 'Déverrouiller pour fermer')?.desactive, true, 'sa croix est grisée et dit pourquoi');

  const autre = volet({ actif: true, verrouille: false, verrouIndisponible: true });
  egal(bouton(autre, 'Un seul volet verrouillé à la fois')?.desactive, true,
    'l\'autre volet verrouillé : ce cadenas-ci est grisé et dit pourquoi');

  ok(actif.includes('data-volet=""') && actif.includes('[container-name:volet]') && actif.includes('[container-type:inline-size]'),
    'le corps du volet est le conteneur `volet` que lit le CSS responsive');

  const vide = rendre(
    <VoletEcran fil={['Nouveau volet']} actif verrouille={false} verrouIndisponible={false} vide
      onActiver={rien} onVerrouiller={rien} onInverser={rien} onFermer={rien}>
      <p>sélecteur</p>
    </VoletEcran>
  );
  ok(!/Verrouiller ce volet/.test(vide), 'un volet vide n\'a pas de cadenas');
  ok(bouton(vide, 'Fermer ce volet')?.desactive === false, 'mais se ferme');
}

export function testRenduEcranPartageSelecteur() {
  titre('rendu · Écran partagé — le sélecteur d\'un volet vide');
  const html = rendre(
    <RecherchePalette
      groupesPour={() => [{ titre: 'Pages', entrees: [{ cle: 'rta', libelle: 'Ma prépa', contexte: 'RTA', faire: rien }] }]}
      onChoisir={rien}
      invite="Rechercher une page…"
      aide="Essaie le nom d'une page : RTA, Siège, Runes…"
      onEchap={rien}
    />
  );
  ok(/placeholder="Rechercher une page…"/.test(html), 'le champ, et ce qu\'il cherche');
  ok(/role="listbox"/.test(html) && texteVisible(html).includes('Ma prépa'), 'les pages, en liste au clavier, saisie vide comprise');
}

export function testRenduEcranPartageBarre() {
  titre('rendu · Écran partagé — la barre latérale');
  const html = rendre(
    <Sidebar
      groupes={[
        {
          liens: [
            { key: 'rta', label: 'RTA', hash: '#/rta', icon: null, actif: false, aCote: rien, volet: 'à droite' },
            { key: 'bestiary', label: 'Bestiaire', hash: '#/bestiary', icon: null, actif: true },
          ],
        },
      ]}
      retractee={false}
      onToggleRetract={rien}
    />
  );
  ok(bouton(html, 'Ouvrir « RTA » à côté') !== undefined, 'une entrée qui tient à côté propose « Ouvrir à côté »');
  ok(bouton(html, 'Ouvrir « Bestiaire » à côté') === undefined, 'sans `aCote`, pas de bouton');
  ok(texteVisible(html).includes('RTA à droite'), 'la mention du volet qui affiche la page');

  const repliee = rendre(
    <Sidebar
      groupes={[{ liens: [{ key: 'rta', label: 'RTA', hash: '#/rta', icon: null, actif: false, aCote: rien, volet: 'à droite' }] }]}
      retractee
      onToggleRetract={rien}
    />
  );
  ok(bouton(repliee, 'Ouvrir « RTA » à côté') === undefined && !texteVisible(repliee).includes('à droite'),
    'barre repliée : ni bouton ni mention, pas de place à côté de l\'icône');
}

export function testRenduEcranPartageSeparateur() {
  titre('rendu · Écran partagé — les deux volets et leur séparateur');
  const html = rendre(
    <DeuxVolets
      gauche={<p>gauche</p>}
      droite={<p>droite</p>}
      minGauche={690}
      minDroite={818}
      taille={50}
      onTaille={rien}
      libelleSeparateur="Redimensionner les deux pages"
    />
  );
  ok(texteVisible(html).includes('gauche') && texteVisible(html).includes('droite'), 'les deux zones');
  ok(/role="separator"/.test(html), 'un séparateur, au rôle ARIA de séparateur');
  ok(html.includes('aria-label="Redimensionner les deux pages"'), 'nommé pour un lecteur d\'écran');
}

export function testRenduEcranPartageBouton() {
  titre('rendu · Écran partagé — le bouton de la barre du haut');
  // Fenêtre de test : aucune media query ne correspond, donc trop étroite.
  const b = bouton(rendreApp('#/rta'), 'Écran partagé');
  ok(!!b, 'le bouton est là, au bureau');
  ok(!!b?.desactive && (b?.title ?? '').includes('Fenêtre trop étroite'),
    'fenêtre trop étroite : désactivé, et il dit quoi faire');
  egal(b?.presse, false, 'il n\'est pas enfoncé hors écran partagé');
}
