import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Tiroir latéral MOBILE : les actions et les filtres de la page courante.
//
// ⚠️ **Il existe parce que les pages ne tiennent pas.** La prépa RTA porte six
// boutons d'action, deux rangées de catégories et un champ de recherche ; le
// bestiaire, une recherche et trois familles de filtres. Empilés sur 348 px et
// portés à 40 px de haut par la règle tactile, ils repoussaient le CONTENU —
// trois écrans de contrôles avant d'atteindre ses monstres.
//
// ⚠️ **Ce n'est PAS une navigation.** La barre du bas mène aux pages ; ce tiroir
// ne porte que ce qui agit sur la page où l'on est déjà. Les mêmes contrôles y
// vivent — pas des copies : la page les rend, le tiroir ne fait que les
// accueillir sous `lg`.
//
// ⚠️ **À GAUCHE** : c'est de là que vient le bouton qui l'ouvre, dans le coin
// gauche de la barre. Un panneau qui surgit à l'opposé de son déclencheur oblige
// à chercher le lien entre les deux.

export default function MobileDrawer({
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
  const panneau = useRef<HTMLDivElement>(null);

  // Échap ferme, et la page derrière ne défile plus — mêmes garanties que la
  // coquille `Modale`, dont ce tiroir est un cousin.
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
            ref={panneau}
            role="dialog"
            aria-modal="true"
            aria-label={titre}
            // ⚠️ Le tiroir GLISSE depuis le bord gauche : c'est de là qu'il
            // vient, et le mouvement dit d'où il sort — donc où il retournera.
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(340px,88vw)] flex-col
                       border-r border-border bg-panel lg:hidden"
          >
            <div className="flex flex-none items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="font-display text-lg tracking-wide text-ink">{titre}</h2>
              <button
                type="button"
                onClick={onFermer}
                aria-label="Fermer"
                title="Fermer"
                className="ml-auto flex aspect-square h-8 w-8 items-center justify-center rounded-md
                           text-ink-dim transition-colors hoverable:bg-panel2 hoverable:text-ink"
              >
                <X size={17} />
              </button>
            </div>

            {/* ⚠️ `overscroll-contain` : arrivé en bas du tiroir, le geste ne
                doit pas se propager à la page derrière — elle défilerait sous
                un panneau qui la recouvre. */}
            {/* ⚠️ `data-tiroir` : les boutons retrouvent leur LIBELLÉ ici. Ils
                le perdent dans la page faute de place (voir RtaBackupBar), mais
                le tiroir est un panneau dédié de 340 px — une colonne d'icônes
                sans mots y serait un rébus. Voir la règle dans index.css. */}
            <div data-tiroir className="flex-1 overflow-y-auto overscroll-contain p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
