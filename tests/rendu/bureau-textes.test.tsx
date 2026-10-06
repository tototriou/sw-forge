// Tests de rendu — les textes qui parlent du NAVIGATEUR, dans l'app de bureau
// (chantier application-bureau, lot 8). Sur le site, rien ne change ; dans
// l'app (pont du préchargement simulé), chaque texte dit « application »,
// « machine », « système » ou « appareil ».

import HomePage from '../../src/pages/HomePage';
import { SettingsList } from '../../src/components/SettingsMenu';
import { KeepAccountDialog } from '../../src/ui/Dialogs';
import { THEME_CHOICES } from '../../src/hooks/useTheme';
import { ok, titre } from '../outils';
import { auTelephone, rendre, texteVisible } from './outils-rendu';

const rien = () => {};

function textes(): { accueil: string; reglages: string; question: string; theme: string } {
  return {
    accueil: texteVisible(rendre(<HomePage stats={{ rta: 0, defense: 0, offense: 0, recos: 0 }} onImport={rien} />)),
    reglages: texteVisible(rendre(<SettingsList onClearData={rien} onKeepAccount={rien} accountExportedAt={null} />)),
    // La `Modale` passe par un portail : `auTelephone` le pose en place.
    question: texteVisible(auTelephone(() => rendre(<KeepAccountDialog onChoose={rien} onDismiss={rien} />))),
    theme: THEME_CHOICES.find((c) => c.key === 'auto')!.hint,
  };
}

export function testRenduBureauTextes() {
  titre('rendu · textes du navigateur — sur le site, inchangés');
  const site = textes();
  ok(site.accueil.includes('tout est calculé dans ton navigateur'), 'accueil, promesse : « dans ton navigateur »');
  ok(site.accueil.includes("Rien n'est envoyé : tout se calcule dans ton navigateur."), 'accueil, étape 02 : « dans ton navigateur »');
  ok(site.reglages.includes('tout est perdu en fermant l’onglet') && site.reglages.includes('Tout reste dans ton navigateur'), 'Garder mes données : « l’onglet », « ton navigateur »');
  ok(site.question.includes('à ta prochaine visite') && site.question.includes("en fermant l'onglet"), 'question du premier import : « visite », « onglet »');
  ok(site.theme === 'Suit le thème de ton navigateur', 'thème Auto : « ton navigateur »');

  titre('rendu · textes du navigateur — dans l\'app de bureau');
  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = { bureau: true, plateforme: 'win32' };
  try {
    const app = textes();
    ok(app.accueil.includes('tout est calculé sur ta machine'), 'accueil, promesse : « sur ta machine »');
    ok(app.accueil.includes("Rien n'est envoyé : tout se calcule sur ta machine."), 'accueil, étape 02 : « sur ta machine »');
    ok(!app.accueil.includes('navigateur'), 'accueil : plus un mot de « navigateur »');
    ok(app.reglages.includes('tout est perdu en fermant l’application') && app.reglages.includes('Tout reste sur cette machine'), 'Garder mes données : « l’application », « cette machine »');
    ok(!/navigateur|onglet/.test(app.reglages), 'Réglages : ni « navigateur » ni « onglet »');
    ok(app.question.includes("à la prochaine ouverture de l'application") && app.question.includes("en fermant l'application"), 'question du premier import : « ouverture », « application »');
    ok(app.theme === 'Suit le thème de ton système', 'thème Auto : « ton système »');
  } finally {
    delete pont.swblacksmithBureau;
  }
}
