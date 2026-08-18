import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SOUS_LG, useMediaQuery } from '../hooks/useMediaQuery';
import { useScrollBloque } from '../hooks/useScrollBloque';
import { BoutonIcone } from '../ui';
import { HAUTEUR_ONGLETS } from '../lib/layout';

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
// ⚠️ **Il s'ouvre à la hauteur de son CONTENU, plafonné à 80 % de `dvh`.** Un
// contenu court ne laisse pas de vide sous lui ; au-delà de 80 %, le corps se
// met à défiler. `dvh` et non `vh` : sur iOS, `vh` vaut la hauteur barre
// d'adresse dépliée, et le panneau dépassait de l'écran une fois celle-ci
// repliée. La bande de page visible en haut dit qu'on est toujours sur cette
// page, et qu'un appui hors du panneau le referme — en plein écran, il passerait
// pour un changement de page.
//
// ⚠️ **Hauteur mesurée puis FIGÉE à l'ouverture.** Le panneau est collé en bas
// et ne peut grandir que vers le HAUT : tant que sa hauteur suit le contenu,
// déplier quoi que ce soit dedans (une catégorie RTA, une 4ᵉ propriété) fait
// remonter d'un coup ce qu'on vient de toucher — la règle générale l'interdit
// (spec/shared/design.md). On mesure donc à l'ouverture (bornée par le plafond),
// on fige, et un contenu qui grandit ensuite se lit en défilant.

export default function MobileSheet({
  ouvert,
  onFermer,
  titre,
  centre = false,
  surLesOnglets = false,
  children,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  // ⚠️ **Le panneau se pose AU-DESSUS de la barre d'onglets au lieu de la
  // recouvrir.** C'est l'inverse du défaut, et pour une raison précise : le
  // panneau par défaut porte des ACTIONS, et la barre mène ailleurs — la
  // laisser dépasser inviterait à quitter la page au milieu d'un réglage. Un
  // panneau de NAVIGATION, lui, EST la barre : la masquer retirerait de l'écran
  // la section où l'on est et le moyen d'en changer, au moment même où l'on
  // navigue.
  // Il passe donc SOUS elle dans la pile (`z-[35]` contre son `z-40`) et se
  // décale de sa hauteur. Son voile, lui, reste sous la barre aussi : il couvre
  // la page et le bouton « Options », pas les onglets.
  surLesOnglets?: boolean;
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

  // Hauteur mesurée une fois à l'ouverture, puis figée (voir l'en-tête). ⚠️ En
  // `useLayoutEffect`, avant peinture : en `useEffect`, on voyait le panneau à sa
  // hauteur naturelle une image avant qu'elle soit figée. Le panneau CENTRÉ n'en
  // a pas besoin — il grandit autour de son axe et ne porte que des formulaires
  // courts, sans rien à déplier.
  const boite = useRef<HTMLDivElement>(null);
  const [hauteurFigee, setHauteurFigee] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!visible || centre) {
      setHauteurFigee(null);
      return;
    }
    const el = boite.current;
    if (el) setHauteurFigee(el.getBoundingClientRect().height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, centre]);

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
              centre
                ? 'z-[60] bg-bg/95'
                : surLesOnglets
                  ? 'z-30 bg-bg/70'
                  : 'z-50 bg-bg/70'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onFermer}
            role="presentation"
          />
          <motion.div
            ref={boite}
            role="dialog"
            // ⚠️ **Pas `aria-modal` quand la barre d'onglets reste utilisable.**
            // L'attribut annonce que TOUT le reste de la page est inerte ; ici
            // les onglets restent au-dessus du voile et cliquables, et un
            // lecteur d'écran aurait masqué la seule chose qu'on a
            // délibérément laissée visible.
            aria-modal={surLesOnglets ? undefined : true}
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
                ? 'inset-x-3 top-1/2 z-[60] max-h-[80dvh] -translate-y-1/2 rounded-2xl border shadow-glow shadow-black/60'
                : surLesOnglets
                  ? // ⚠️ `bottom` en `style` (voir plus bas), pas `bottom-0` :
                    // il se cale sur la hauteur de la barre d'onglets. Et
                    // `z-[35]`, donc SOUS elle (`z-40`) mais au-dessus de son
                    // propre voile (`z-30`).
                    'inset-x-0 z-[35] max-h-[70dvh] rounded-t-2xl border-t'
                  : 'inset-x-0 bottom-0 z-50 max-h-[80dvh] rounded-t-2xl border-t'
            }`}
            // Panneau montant : hauteur du contenu mesurée puis figée (voir
            // l'en-tête), plafonnée par `max-h-[80dvh]` ; le corps
            // `overflow-y-auto` défile au-delà. Centré : taille du formulaire,
            // même plafond.
            style={
              centre
                ? undefined
                : {
                    // ⚠️ Posé au-dessus des onglets, le panneau ne touche plus
                    // le bord de l'écran : c'est la BARRE qui absorbe l'encoche,
                    // et un rembourrage ici ajouterait une bande vide de plus.
                    ...(surLesOnglets
                      ? {
                          bottom: `calc(env(safe-area-inset-bottom) + ${HAUTEUR_ONGLETS}px)`,
                        }
                      : { paddingBottom: 'env(safe-area-inset-bottom)' }),
                    // `undefined` au premier rendu : c'est LUI qu'on mesure.
                    height: hauteurFigee ?? undefined,
                  }
            }
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

            {/* Même rembourrage latéral que le corps, sinon le titre et la croix
                ne s'alignent pas sur le contenu qu'ils coiffent. */}
            <div
              className={`flex flex-none items-center gap-2 pb-1.5 pt-1.5 ${
                centre ? 'px-3' : 'px-4'
              }`}
            >
              {/* ⚠️ `text-sm` et non `text-base` : ce titre rappelle où l'on est,
                  il n'annonce pas une page. À la taille d'un titre de section il
                  pesait autant que les actions qu'il coiffe. */}
              {/* ⚠️ Même taille que le reste du panneau (12 px). Ce qui le
                  distingue comme titre n'est pas sa taille mais sa POLICE
                  d'affichage et son espacement de lettres — à 13 px il pesait
                  autant que les actions qu'il coiffe. */}
              <h2 className="font-display text-xs tracking-wide text-ink">{titre}</h2>
              {/* ⚠️ `data-cible-fine` : cette croix vit dans l'en-tête du
                  panneau, dont la hauteur est mesurée pour laisser le maximum au
                  contenu. Portée à 40 px, elle imposait sa taille à toute la
                  bande de titre. */}
              <BoutonIcone
                onClick={onFermer}
                libelle="Fermer"
                icone={<X size={16} />}
                data-cible-fine
                className="ml-auto hoverable:bg-panel2"
              />
            </div>

            {/* ⚠️ `overscroll-contain` : arrivé en bas du panneau, le geste ne
                doit pas se propager à la page derrière — elle défilerait sous
                un panneau qui la recouvre. */}
            {/* ⚠️ `data-tiroir` : les boutons retrouvent leur LIBELLÉ ici. Ils
                le perdent dans la page faute de place (voir RtaBackupBar), mais
                ce panneau tient toute la largeur — une rangée d'icônes sans mots
                y serait un rébus. Voir la règle dans index.css. */}
            {/* ⚠️ Rembourrage LATÉRAL réduit sur le panneau centré : il porte un
                formulaire, dont les champs doivent prendre toute la largeur
                disponible. Entre les 12 px du panneau et les 16 px d'ici, un
                champ perdait 56 px sur 348 — un septième de l'écran en marges.
                Le panneau montant, lui, garde `px-4` : ses boutons en grille ont
                besoin de respirer du bord. */}
            <div
              data-tiroir
              className={`flex-1 overflow-y-auto overscroll-contain pb-4 pt-0.5 ${
                centre ? 'px-3' : 'px-4'
              }`}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
