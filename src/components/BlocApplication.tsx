import { ReactNode, useEffect, useState } from 'react';
import { EtatMiseAJour, rechercherMiseAJour, redemarrerPourMettreAJour, suivreMiseAJour, telechargerMiseAJour } from '../lib/bureau';
import Bouton from '../ui/Bouton';

// Le bloc « Application » des Réglages — application de bureau seulement
// (lot 5, décision 12). ⚠️ **La mise à jour reste à portée** : remise à plus
// tard (la croix de la notification), elle se fait ici quand il veut. UN
// bouton, toujours affiché, qui suit la phase (bureau/miseAJour.ts) —
// désactivé quand il n'y a rien à faire, jamais retiré.

export interface PresentationMiseAJour {
  libelle: string;
  // Absente : bouton désactivé.
  action?: () => void;
  // La ligne sous la version — toujours une : le bloc ne change pas de
  // hauteur d'une phase à l'autre.
  texte: string;
}

// Pure : ce que le bloc montre pour un état (`null` : la page n'a encore rien
// reçu, comme « aucune »).
export function presentationMiseAJour(etat: EtatMiseAJour | null): PresentationMiseAJour {
  switch (etat?.phase ?? 'aucune') {
    case 'aucune':
      return { libelle: 'Rechercher', action: rechercherMiseAJour, texte: 'Les nouvelles versions sont cherchées au lancement.' };
    case 'recherche':
      return { libelle: 'Recherche…', texte: "Recherche d'une nouvelle version…" };
    case 'a-jour':
      return { libelle: 'Rechercher', action: rechercherMiseAJour, texte: 'Tu as la dernière version.' };
    case 'injoignable':
      return { libelle: 'Rechercher', action: rechercherMiseAJour, texte: 'Impossible de vérifier : pas de connexion ?' };
    case 'disponible':
      return { libelle: 'Mettre à jour', action: telechargerMiseAJour, texte: `Nouvelle version ${etat!.version} disponible.` };
    case 'telechargement':
      return { libelle: 'Téléchargement…', texte: `Téléchargement de la version ${etat!.version}…` };
    case 'prete':
      return {
        libelle: 'Redémarrer',
        action: redemarrerPourMettreAJour,
        texte: `Version ${etat!.version} prête : installée au redémarrage, ou à la fermeture de l'app.`,
      };
    case 'echec':
      return { libelle: 'Réessayer', action: telechargerMiseAJour, texte: "Le téléchargement n'a pas abouti." };
  }
}

export default function BlocApplication({ classeCarte, intitule }: { classeCarte: string; intitule?: ReactNode }) {
  const [etat, setEtat] = useState<EtatMiseAJour | null>(null);
  useEffect(() => suivreMiseAJour(setEtat), []);
  const p = presentationMiseAJour(etat);
  return (
    // `data-bloc-application` : repère du mode preuve (bureau/preuve.ts).
    <section data-bloc-application>
      {intitule}
      <div className={classeCarte}>
        <div className="py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">Version {__APP_VERSION__}</span>
            {/* ⚠️ Largeur réservée : « Rechercher » → « Recherche… » ne
                déplace pas le bouton qu'on vient de cliquer. */}
            <Bouton
              taille="sm"
              libelle={p.libelle}
              onClick={p.action}
              disabled={!p.action}
              className="flex-none min-w-[8.5rem]"
            />
          </div>
          <p className="mt-1 text-micro text-ink-dim leading-snug">{p.texte}</p>
        </div>
      </div>
    </section>
  );
}
