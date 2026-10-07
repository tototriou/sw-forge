// Tests de rendu — « Sauvegarder » et « Sauvegarder sous… » dans la barre du
// haut (spec/shared/sauvegarde-session.md, spec/shared/navigation.md § Barre
// supérieure). Sur le site, seul « Sauvegarder » ; dans l'app (pont du
// préchargement simulé), les deux, et l'infobulle nomme la session en cours.

import TopBar from '../../src/components/TopBar';
import { ok, titre } from '../outils';
import { rendreApp } from './app.test';
import { bouton, boutons, rendre } from './outils-rendu';

const rien = () => {};

function barre(props: { onSauvegarderSous?: () => void; onDeconnexion?: () => void; sessionEnCours?: string | null }): string {
  return rendre(
    <TopBar
      titre="Accueil"
      parametresActifs={false}
      onToggleParametres={rien}
      onRecherche={rien}
      onSauvegarder={rien}
      decalage={248}
      {...props}
    />
  );
}

export function testRenduBarreSession() {
  titre('rendu · barre du haut — « Sauvegarder » sur le site');
  const site = barre({ onDeconnexion: rien });
  const sauver = boutons(site).filter((b) => b.texte === 'Sauvegarder');
  ok(sauver.length === 1, 'ordinateur : un bouton « Sauvegarder »');
  ok(sauver[0]?.title === 'Sauvegarder la session dans un fichier (Ctrl+S)', 'son infobulle donne le raccourci');
  ok(bouton(site, 'Sauvegarder la session (Ctrl+S)')?.texte === '', 'téléphone : l’icône « Sauvegarder », nommée');
  ok(!bouton(site, 'Sauvegarder sous…'), 'pas de « Sauvegarder sous… » sans l’app');
  const ordre = boutons(site).map((b) => b.texte || b.ariaLabel);
  ok(
    ordre.indexOf('Sauvegarder') < ordre.indexOf('Se déconnecter') &&
      ordre.indexOf('Sauvegarder la session (Ctrl+S)') < ordre.indexOf('Rechercher'),
    '« Sauvegarder » précède la déconnexion (ordinateur) et la loupe (téléphone)'
  );

  titre('rendu · barre du haut — dans l’app de bureau');
  const app = barre({ onSauvegarderSous: rien, sessionEnCours: 'ma-session.json' });
  ok(bouton(app, 'Sauvegarder')?.title === 'Sauvegarder dans ma-session.json (Ctrl+S)', 'l’infobulle nomme la session en cours');
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

  titre('rendu · barre du haut — l’app les branche selon le support');
  const htmlSite = rendreApp('#/');
  ok(!bouton(htmlSite, 'Sauvegarder sous…'), 'site : l’app ne passe pas « Sauvegarder sous… »');
  ok(bouton(htmlSite, 'Se déconnecter') !== undefined, 'site : « Se déconnecter » reste');
  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = { bureau: true, plateforme: 'win32' };
  try {
    const html = rendreApp('#/');
    ok(bouton(html, 'Sauvegarder sous…') !== undefined, 'app : « Sauvegarder sous… » dans la barre');
    ok(!bouton(html, 'Se déconnecter'), 'app : pas de « Se déconnecter »');
    ok(bouton(html, 'Sauvegarder')?.title === 'Sauvegarder la session dans un fichier (Ctrl+S)', 'app, aucune session en cours : l’infobulle ne nomme rien');
  } finally {
    delete pont.swblacksmithBureau;
  }
}
