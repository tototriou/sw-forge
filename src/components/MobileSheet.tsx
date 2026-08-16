import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SOUS_LG, useMediaQuery } from '../hooks/useMediaQuery';
import { useScrollBloque } from '../hooks/useScrollBloque';

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
// ⚠️ **Hauteur plafonnée à 85 % de `dvh`**, jamais plein écran. `dvh` et non
// `vh` : sur iOS, `vh` vaut la hauteur avec la barre d'adresse dépliée, et le
// panneau dépassait donc de l'écran une fois celle-ci repliée. la bande de page qui
// reste visible en haut dit qu'on est toujours sur cette page, et qu'un appui
// hors du panneau le referme. En plein écran, il devient indiscernable d'un
// changement de page.

export default function MobileSheet({
  ouvert,
  onFermer,
  titre,
  centre = false,
  children,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  // ⚠️ Panneau de SECOND niveau : celui qui s'ouvre DEPUIS un autre panneau (le
  // formulaire de catégorie, ouvert depuis « Options »). Il se pose plus haut
  // dans la pile et son voile est OPAQUE, de sorte qu'il recouvre entièrement
  // celui d'en dessous. Deux panneaux visibles à la fois, c'était deux titres,
  // deux croix, et plus aucun moyen de savoir laquelle ferme quoi.
  //
  // Il se CENTRE aussi verticalement : ce n'est plus une liste d'actions qu'on
  // parcourt du pouce, mais un formulaire court qu'on remplit. Collé en bas
  // sous le clavier, il n'en restait qu'une bande.
  centre?: boolean;
  children: ReactNode;
}) {
  // ⚠️ **Le panneau n'existe qu'en dessous de `lg`.** `lg:hidden` le masquait
  // visuellement, mais l'effet ci-dessous s'exécutait quand même : il posait
  // `overflow: hidden` sur `body` et la page de BUREAU ne défilait plus, sans
  // qu'aucun panneau ne soit visible pour l'expliquer. Il suffisait d'ouvrir le
  // panneau sur un écran étroit puis d'élargir la fenêtre.
  const sousLg = useMediaQuery(SOUS_LG);
  const visible = ouvert && sousLg;

  // La page derrière ne défile plus. ⚠️ Par le hook partagé, jamais à la main :
  // un dialogue peut s'ouvrir PAR-DESSUS ce panneau, et deux composants qui
  // mémorisent chacun la valeur précédente se marchent dessus (voir le hook).
  useScrollBloque(visible);

  // Échap ferme — même garantie que la coquille `Modale`, dont ce panneau est un
  // cousin.
  useEffect(() => {
    if (!visible) return;
    // ⚠️ `stopPropagation` : deux panneaux peuvent être ouverts l'un sur
    // l'autre (le formulaire de catégorie par-dessus « Options »). Sans cela,
    // une seule pression d'Échap fermait les DEUX — les deux écouteurs sont
    // actifs sur `document`. Le panneau du dessus est le dernier monté, donc le
    // dernier abonné : il reçoit l'événement en premier et l'arrête là.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onFermer();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [visible, onFermer]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            className={`fixed inset-0 lg:hidden ${
              centre ? 'z-[60] bg-bg/95' : 'z-50 bg-bg/70'
            }`}
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
            // Le panneau de second niveau ne monte pas du bas : il paraît au
            // centre, comme une boîte de dialogue. Le glissement dit « je viens
            // du bord » ; ici on ne vient de nulle part, on interrompt.
            initial={centre ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            animate={centre ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={centre ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            // ⚠️ Le panneau se pose SUR la barre d'onglets (`z-50` contre son
            // `z-40`) : elle mène ailleurs, or on est en train d'agir ici. La
            // laisser dépasser inviterait à quitter la page au milieu d'un
            // réglage.
            className={`fixed flex flex-col border-border bg-panel lg:hidden ${
              centre
                ? 'inset-x-4 top-1/2 z-[60] max-h-[80dvh] -translate-y-1/2 rounded-2xl border shadow-glow shadow-black/60'
                : 'inset-x-0 bottom-0 z-50 max-h-[85dvh] rounded-t-2xl border-t'
            }`}
            style={centre ? undefined : { paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Barrette de préhension — la convention des panneaux montants sur
                téléphone. Elle ne fait rien (le glissement n'est pas implémenté)
                mais elle dit d'où vient le panneau et par où il repart.
                ⚠️ Absente du panneau centré : il ne monte pas du bord, une
                poignée y promettrait un geste qui n'existe pas. */}
            {!centre && (
              <div className="flex justify-center pt-2">
                <span className="h-1 w-9 rounded-full bg-border" aria-hidden />
              </div>
            )}

            <div className="flex flex-none items-center gap-2 px-4 pb-1.5 pt-1.5">
              {/* ⚠️ `text-sm` et non `text-base` : ce titre rappelle où l'on est,
                  il n'annonce pas une page. À la taille d'un titre de section il
                  pesait autant que les actions qu'il coiffe. */}
              <h2 className="font-display text-sm tracking-wide text-ink">{titre}</h2>
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
              className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-0.5"
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
