import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Panneau d'actions MOBILE : les filtres et les actions de la page courante.
//
// ⚠️ **Il monte DEPUIS LE BAS**, et remplace le tiroir latéral qui glissait de
// la gauche. Ce n'était pas une question de goût : son bouton d'ouverture est
// désormais dans la barre d'onglets, en bas de l'écran. Un panneau qui surgit à
// l'opposé de son déclencheur oblige à refaire le lien entre les deux à chaque
// fois. Ici le mouvement part du doigt qui l'a demandé.
//
// ⚠️ **Ce n'est PAS une navigation.** La barre d'onglets mène aux pages ; ce
// panneau ne porte que ce qui agit sur la page où l'on est déjà. Les mêmes
// contrôles y vivent — pas des copies : la page les rend, le panneau ne fait que
// les accueillir sous `lg`.
//
// ⚠️ **Hauteur plafonnée à 85 %**, jamais plein écran : la bande de page qui
// reste visible en haut dit qu'on est toujours sur cette page, et qu'un appui
// hors du panneau le referme. En plein écran, il devient indiscernable d'un
// changement de page.

export default function MobileSheet({
  ouvert,
  onFermer,
  titre,
  children,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  children: ReactNode;
}) {
  // Échap ferme, et la page derrière ne défile plus — mêmes garanties que la
  // coquille `Modale`, dont ce panneau est un cousin.
  useEffect(() => {
    if (!ouvert) return;
    const scrollAvant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = scrollAvant;
    };
  }, [ouvert, onFermer]);

  return (
    <AnimatePresence>
      {ouvert && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-bg/70 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onFermer}
            role="presentation"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={titre}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            // ⚠️ Le panneau se pose SUR la barre d'onglets (`z-50` contre son
            // `z-40`) : elle mène ailleurs, or on est en train d'agir ici. La
            // laisser dépasser inviterait à quitter la page au milieu d'un
            // réglage.
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col
                       rounded-t-2xl border-t border-border bg-panel lg:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Barrette de préhension — la convention des panneaux montants sur
                téléphone. Elle ne fait rien (le glissement n'est pas implémenté)
                mais elle dit d'où vient le panneau et par où il repart. */}
            <div className="flex justify-center pt-2">
              <span className="h-1 w-9 rounded-full bg-border" aria-hidden />
            </div>

            <div className="flex flex-none items-center gap-2 px-4 pb-2 pt-2">
              <h2 className="font-display text-base tracking-wide text-ink">{titre}</h2>
              <button
                type="button"
                onClick={onFermer}
                aria-label="Fermer"
                title="Fermer"
                data-cible-fine
                className="ml-auto flex aspect-square h-7 w-7 items-center justify-center rounded-md
                           text-ink-dim transition-colors hoverable:bg-panel2 hoverable:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {/* ⚠️ `overscroll-contain` : arrivé en bas du panneau, le geste ne
                doit pas se propager à la page derrière — elle défilerait sous
                un panneau qui la recouvre. */}
            {/* ⚠️ `data-tiroir` : les boutons retrouvent leur LIBELLÉ ici. Ils
                le perdent dans la page faute de place (voir RtaBackupBar), mais
                ce panneau tient toute la largeur — une rangée d'icônes sans mots
                y serait un rébus. Voir la règle dans index.css. */}
            <div
              data-tiroir
              className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1"
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
