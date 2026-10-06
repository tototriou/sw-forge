import { useEffect } from 'react';
import { EtatMiseAJour, redemarrerPourMettreAJour, suivreMiseAJour, telechargerMiseAJour } from '../lib/bureau';
import { Annonce, useNotifier } from '../ui/Notification';

// La mise à jour automatique, dite par la notification — application de
// bureau, lot 5 (bureau/miseAJour.ts). ⚠️ **L'utilisateur décide** : rien ne
// se télécharge sans « Mettre à jour », et la question RESTE jusqu'à sa
// réponse (la croix la ferme ; le bloc « Application » des Réglages la
// garde à portée, src/components/BlocApplication.tsx). Sur le site : inerte.
//
// Les phases d'une RECHERCHE (`aucune`, `recherche`, `a-jour`,
// `injoignable`) ne notifient rien : elles se lisent dans les Réglages.
function annonce({ phase, version }: EtatMiseAJour): Annonce | null {
  switch (phase) {
    case 'aucune':
    case 'recherche':
    case 'a-jour':
    case 'injoignable':
      return null;
    case 'disponible':
      return {
        message: `Nouvelle version ${version} disponible`,
        action: telechargerMiseAJour,
        libelleAction: 'Mettre à jour',
        persistante: true,
      };
    case 'telechargement':
      return { message: 'Téléchargement de la mise à jour…' };
    case 'prete':
      // Sans redémarrage, elle s'installe à la fermeture de l'app.
      return { message: 'Mise à jour prête', action: redemarrerPourMettreAJour, libelleAction: 'Redémarrer' };
    case 'echec':
      return {
        message: "La mise à jour n'a pas pu être téléchargée",
        action: telechargerMiseAJour,
        libelleAction: 'Réessayer',
        persistante: true,
      };
  }
}

export default function MiseAJourBureau() {
  const notifier = useNotifier();
  useEffect(
    () =>
      suivreMiseAJour((etat) => {
        const a = annonce(etat);
        if (a) notifier(a);
      }),
    [notifier]
  );
  return null;
}
