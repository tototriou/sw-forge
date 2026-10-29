// Tests de rendu — « Sauvegarder » et « Sauvegarder sous… » dans la barre du
// haut (docs/02-app/transverse/, docs/02-app/transverse/ § Barre
// supérieure). Dans l'app (pont du préchargement simulé) seulement : les
// deux, et l'infobulle nomme la session en cours. Sur le site, aucun accès à
// la sauvegarde de session.

import TopBar from '../../src/components/TopBar';
import { SettingsList } from '../../src/components/SettingsMenu';
import { ok, titre } from '../outils';
import { rendreApp } from './app.test';
import { bouton, boutons, rendre, texteVisible } from './outils-rendu';

const rien = () => {};

function barre(props: {
  onSauvegarder?: () => void;
  onSauvegarderSous?: () => void;
  onDeconnexion?: () => void;
  sessionEnCours?: string | null;
  sauvegardeIndisponible?: string | null;
}): string {
  return rendre(
    <TopBar
      titre="Accueil"
      parametresActifs={false}
      onToggleParametres={rien}
      onRecherche={rien}
      decalage={248}
      {...props}
    />
  );
}

export function testRenduBarreSession() {
  titre('rendu · barre du haut — pas de « Sauvegarder » sur le site');
  const site = barre({ onDeconnexion: rien });
  ok(!boutons(site).some((b) => b.texte === 'Sauvegarder'), 'ordinateur : aucun bouton « Sauvegarder »');
  ok(!bouton(site, 'Sauvegarder la session (Ctrl+S)'), 'téléphone : aucune icône « Sauvegarder »');
  ok(!bouton(site, 'Sauvegarder sous…'), 'pas de « Sauvegarder sous… »');
  ok(bouton(site, 'Se déconnecter') !== undefined && bouton(site, 'Rechercher') !== undefined, 'la déconnexion et la loupe restent');

  titre('rendu · barre du haut — dans l’app de bureau');
  const app = barre({ onSauvegarder: rien, onSauvegarderSous: rien, sessionEnCours: 'ma-session.json' });
  ok(bouton(app, 'Sauvegarder')?.title === 'Sauvegarder dans ma-session.json (Ctrl+S)', 'l’infobulle nomme la session en cours');
  ok(bouton(app, 'Sauvegarder la session (Ctrl+S)')?.texte === '', 'téléphone : l’icône « Sauvegarder », nommée');
  ok(
    bouton(app, 'Sauvegarder sous…')?.title ===
      'Enregistrer la session dans un autre fichier, qui devient la session en cours (l’ancien n’est plus modifié)',
    '« Sauvegarder sous… », son infobulle dit ce qu’il fait'
  );
  const ordreApp = boutons(app).map((b) => b.texte || b.ariaLabel);
  ok(
    ordreApp.indexOf('Sauvegarder') < ordreApp.indexOf('Sauvegarder sous…') && !ordreApp.includes('Se déconnecter'),
    'ordre : Sauvegarder, Sauvegarder sous… — sans « Se déconnecter »'
  );
  ok(
    ordreApp.indexOf('Sauvegarder la session (Ctrl+S)') < ordreApp.indexOf('Rechercher'),
    'téléphone : « Sauvegarder » précède la loupe'
  );

  titre('rendu · sauvegarde — désactivée tant que le compte se relit');
  const attente = 'Ton compte se charge encore : la sauvegarde attend qu’il soit relu.';
  const enAttente = barre({
    onSauvegarder: rien,
    onSauvegarderSous: rien,
    sessionEnCours: 'ma-session.json',
    sauvegardeIndisponible: attente,
  });
  for (const nom of ['Sauvegarder', 'Sauvegarder sous…']) {
    const b = boutons(enAttente).find((x) => x.texte === nom);
    ok(b?.desactive === true && b.title === attente, `« ${nom} » reste affiché, désactivé, avec la raison en infobulle`);
  }
  ok(bouton(enAttente, 'Sauvegarder la session (Ctrl+S)')?.desactive === true, 'téléphone : l’icône aussi est désactivée');
  const reglages = rendre(<SettingsList onSauvegarderSession={rien} sauvegardeIndisponible={attente} />);
  const ligne = boutons(reglages).find((x) => x.texte === 'Sauvegarder');
  ok(ligne?.desactive === true && ligne.title === attente, 'Paramètres : « Sauvegarder » désactivé, avec la raison');

  titre('rendu · sauvegarde de session — l’app la branche selon le support');
  const htmlSite = rendreApp('#/');
  ok(!boutons(htmlSite).some((b) => b.texte === 'Sauvegarder'), 'site : pas de « Sauvegarder » dans la barre');
  ok(!bouton(htmlSite, 'Sauvegarder la session (Ctrl+S)'), 'site : pas d’icône « Sauvegarder » au téléphone');
  ok(!bouton(htmlSite, 'Sauvegarder sous…'), 'site : pas de « Sauvegarder sous… »');
  ok(bouton(htmlSite, 'Se déconnecter') !== undefined, 'site : « Se déconnecter » reste');
  const parametresSite = rendreApp('#/parametres');
  ok(
    !boutons(parametresSite).some((b) => b.texte === 'Sauvegarder') &&
      !texteVisible(parametresSite).includes('Tout l’état de l’app dans un fichier'),
    'site : pas de ligne « Session » dans les Paramètres'
  );
  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = { bureau: true, plateforme: 'win32' };
  try {
    const html = rendreApp('#/');
    ok(bouton(html, 'Sauvegarder sous…') !== undefined, 'app : « Sauvegarder sous… » dans la barre');
    ok(!bouton(html, 'Se déconnecter'), 'app : pas de « Se déconnecter »');
    ok(bouton(html, 'Sauvegarder')?.title === 'Sauvegarder la session dans un fichier (Ctrl+S)', 'app, aucune session en cours : l’infobulle ne nomme rien');
    ok(boutons(rendreApp('#/parametres')).some((b) => b.texte === 'Sauvegarder'), 'app : la ligne « Session » des Paramètres');
  } finally {
    delete pont.swblacksmithBureau;
  }
}
