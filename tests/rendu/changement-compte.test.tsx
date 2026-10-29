// Tests de rendu — la modale du changement de compte (application de bureau,
// docs/02-app/transverse/feat-import-compte/bouton-import.md § « Le dossier
// SW Exporter »). Elle propose de sauvegarder la session avant que le compte
// choisi ne remplace prépa RTA, siège et box.

import ChangementCompteDialog from '../../src/components/ChangementCompteDialog';
import { ok, titre } from '../outils';
import { auTelephone, boutons, rendre, texteVisible } from './outils-rendu';

const rien = () => {};

// La `Modale` passe par un portail : `auTelephone` le pose en place.
const modale = (sauvegardeIndisponible: string | null) =>
  auTelephone(() =>
    rendre(
      <ChangementCompteDialog
        sauvegardeIndisponible={sauvegardeIndisponible}
        onSauvegarder={rien}
        onChanger={rien}
        onAnnuler={rien}
      />
    )
  );

export function testRenduChangementCompte() {
  titre('rendu · changement de compte — proposer de sauvegarder');
  const html = modale(null);
  const texte = texteVisible(html);
  ok(texte.includes('Sauvegarder ta session ?'), 'titre : « Sauvegarder ta session ? »');
  ok(
    texte.includes('va remplacer ta prépa RTA, tes équipes de siège et ta box') && texte.includes('seront perdus si tu ne sauvegardes pas'),
    'le message dit ce qui est remplacé, et ce qui se perd sans sauvegarde'
  );
  const libelles = boutons(html).map((b) => b.texte);
  ok(
    JSON.stringify(libelles) === JSON.stringify(['Changer sans sauvegarder', 'Annuler', 'Sauvegarder et changer']),
    `trois actions, celle qui ne perd rien en dernier (sous le pouce, à droite) : ${libelles.join(' · ')}`
  );
  ok(!boutons(html).some((b) => b.ariaLabel === 'Fermer' || b.texte === 'Fermer'), 'pas de croix : « Annuler » est la sortie');
  ok(boutons(html).every((b) => !b.desactive), 'tout est disponible quand la sauvegarde l’est');

  titre('rendu · changement de compte — la sauvegarde attend le compte');
  const attente = 'Ton compte se charge encore : la sauvegarde attend qu’il soit relu.';
  const enAttente = boutons(modale(attente));
  const sauver = enAttente.find((b) => b.texte === 'Sauvegarder et changer');
  ok(sauver?.desactive === true && sauver.title === attente, '« Sauvegarder et changer » reste affiché, désactivé, avec la raison');
  ok(enAttente.filter((b) => b.texte !== 'Sauvegarder et changer').every((b) => !b.desactive), 'les deux autres restent disponibles');
}
