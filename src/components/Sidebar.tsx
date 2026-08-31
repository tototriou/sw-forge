import { ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useStickyState } from '../hooks/useStickyState';
import { Flottant } from '../ui';

// Barre de navigation LATÉRALE — la pièce centrale de la refonte.
//
// ⚠️ Elle remplace une rangée horizontale à deux menus déroulants. Le problème
// n'était pas l'esthétique : la rangée ne tenait plus. Neuf destinations, dont
// six enfouies derrière « Mon compte » et « Ressources », qu'il fallait ouvrir
// pour savoir ce qu'elles contenaient.
//
// ⚠️ **DEUX NIVEAUX, jamais les deux à la fois.** Entrer dans une section qui a
// des sous-sections REMPLACE la liste des sections par celles-ci, avec le titre
// de la section et un retour en tête :
//   - une seule liste à lire, jamais un arbre à démêler ;
//   - la place ainsi libérée revient aux sous-sections, qui étaient jusqu'ici
//     des onglets posés en haut de chaque page — chacune avec son rendu ;
//   - on sait toujours OÙ on est : le titre est en haut, pas noyé dans une
//     liste de dix entrées.
//
// ⚠️ **RÉTRACTABLE** — voir plus bas. Les écrans denses de l'app (inventaire de
// runes, optimiseur, ordre de tour) se lisent en largeur ; 212 px de barre en
// permanence, c'est une colonne de moins.
//
// ⚠️ **Elle disparaît sous `lg`**, remplacée par la barre d'onglets du bas
// (voir MobileTabs). Une sidebar sur 380 px mangerait la moitié de l'écran.

// ⚠️ 224 / 56 px : la barre porte des icônes de 17 et un texte de 14. À 212 px
// dépliée, « Recommandations » touchait le bord ; à 52 px repliée, une icône de
// 17 ne laissait que 17 px de marge autour d'elle — une cible à viser, là où
// une barre d'application se clique sans regarder.
export const LARGEUR_SIDEBAR = 224;
export const LARGEUR_SIDEBAR_RETRACTEE = 56;

export interface SidebarLien {
  key: string;
  label: string;
  // Destination. ⚠️ **Absente quand l'entrée OUVRE une section** : cliquer
  // « Siège » déployait la page de siège ET les sous-sections d'un coup, alors
  // qu'on n'avait pas encore choisi laquelle. On navigue dans la barre, PUIS on
  // choisit — la page ne change qu'au second clic.
  hash?: string;
  icon: ReactNode;
  // La section à OUVRIR au clic, pour une entrée qui en a une.
  // ⚠️ Elle porte le chevron « › » — pas un compteur : la barre affichait
  // « 1 284 » à côté de « Runes », et un nombre isolé au bout d'une entrée de
  // menu ne se lit pas. Le chevron dit la seule chose utile : « il y a un
  // niveau en dessous ».
  ouvre?: SidebarSection;
  actif: boolean;
}

export interface SidebarGroupe {
  // ⚠️ Un intitulé de groupe n'est PAS un lien : « Ressources » ne mène nulle
  // part, il annonce ce qui suit. C'est ce que l'ancien menu déroulant
  // confondait — on cliquait dessus pour ouvrir la liste, alors qu'on voulait
  // juste voir les entrées.
  titre?: string;
  // Icône du groupe. ⚠️ Sert au panneau mobile, qui fait CHOISIR le groupe
  // avant sa vue (voir MobileNavSheet) : à ce niveau-là, « Monstres / Runes /
  // Artéfacts » sont des destinations qu'on vise du pouce, et une liste de mots
  // nus se parcourt moins vite qu'une liste d'icônes. La barre latérale, elle,
  // montre les deux niveaux d'un coup et n'en a pas l'usage.
  icone?: ReactNode;
  liens: SidebarLien[];
}

// Vue « à l'intérieur d'une section » : son titre, ses sous-sections, et par où
// remonter.
export interface SidebarSection {
  titre: string;
  icon: ReactNode;
  // ⚠️ Des GROUPES, comme au premier niveau — pas une liste plate. « Mon
  // compte » porte trois inventaires (Monstres, Runes, Artéfacts) qui ont
  // chacun leurs vues : sans regroupement, les onze entrées se suivaient sans
  // qu'on sache laquelle appartient à quoi.
  groupes: SidebarGroupe[];
}

// Glissement latéral entre les deux niveaux.
//
// ⚠️ Le SENS porte le sens : on entre par la droite, on ressort par la gauche,
// comme on tourne une page. Un fondu seul dirait « ça a changé » sans dire
// « tu es descendu d'un niveau ».
//
// ⚠️ **8 px, 180 ms.** La liste doit sembler GLISSER, pas voler à travers
// l'écran : au-delà, le déplacement devient le sujet et on attend qu'il
// finisse. C'est une navigation, pas une démonstration.
// ⚠️ Exportés : le panneau de navigation mobile (MobileNavSheet) descend d'un
// niveau exactement de la même façon, et deux définitions du même mouvement
// auraient dérivé au premier réglage. C'est le vocabulaire du passage d'un
// NIVEAU à l'autre, quel que soit le format.
export const GLISSEMENT = {
  initial: (entrant: boolean) => ({ opacity: 0, x: entrant ? 8 : -8 }),
  animate: { opacity: 1, x: 0 },
  exit: (entrant: boolean) => ({ opacity: 0, x: entrant ? -8 : 8 }),
};

export const COURBE = { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const };

// Survol d'une entrée à sous-sections — les DEUX délais sont là pour la même
// raison : la souris TRAVERSE la barre pour atteindre autre chose, et un
// panneau qui apparaît puis disparaît à chaque passage fait clignoter l'écran.
//
// ⚠️ **Ouverture retardée = intention.** Sans délai, descendre du logo vers le
// pied de barre ouvrait puis fermait trois panneaux en chemin.
// ⚠️ **Fermeture retardée = tolérance.** Le trajet de l'entrée vers le panneau
// passe par les 6 px qui les séparent : fermer sur le premier `mouseleave`
// rendait le panneau inatteignable, il se refermait pile pendant la traversée.
const DELAI_OUVERTURE = 140;
const DELAI_FERMETURE = 180;

// Le repli de la barre, exposé pour que le contenu décale sa marge en même
// temps. ⚠️ `useStickyState` et non `useState` : le choix tient pour la
// session. Le persister demanderait le consentement de conservation — mettre
// une préférence d'affichage dans la même balance qu'une prépa RTA serait
// disproportionné (même règle que MobileNotice).
export function useSidebarRetractee() {
  return useStickyState('sidebar.retractee', false);
}

export default function Sidebar({
  groupes,
  section,
  recherche,
  retractee,
  onToggleRetract,
  pied,
}: {
  // Les sections de premier niveau. Affichées quand `section` est absent.
  groupes: SidebarGroupe[];
  // La section ouverte, si elle a des sous-sections. Elle REMPLACE `groupes`.
  section?: SidebarSection | null;
  // Champ de recherche, rendu par l'appelant (il seul connaît les destinations).
  // ⚠️ Posé au PREMIER niveau seulement : dans une section, la barre ne montre
  // que trois ou quatre sous-sections — les chercher n'aurait pas de sens.
  recherche?: ReactNode;
  retractee: boolean;
  onToggleRetract: () => void;
  // Bas de barre : import, réglages. Rendu par l'appelant — la sidebar ne
  // connaît ni le compte ni les préférences.
  pied?: ReactNode;
}) {
  // ⚠️ **DEUX états, pas trois : pliée ou dépliée.** Un déploiement temporaire
  // au survol a été essayé et retiré — il rendait la barre incohérente avec
  // elle-même. Repliée dans le Siège on voyait les icônes des SECTIONS ; au
  // survol elle basculait sur les SOUS-SECTIONS, donc d'autres icônes aux mêmes
  // places. Le contenu changeait sous le curseur, et on cliquait ce qui venait
  // d'arriver plutôt que ce qu'on visait.
  //
  // ⚠️ **La barre navigue SEULE, la page ne suit qu'au choix d'une
  // destination.** Cliquer « Siège » ouvrait la page de siège ET ses
  // sous-sections d'un coup, alors qu'on n'avait pas encore choisi laquelle ;
  // et le retour pointait vers `#/`, donc quittait l'écran pour consulter un
  // menu. La barre garde donc son propre niveau.
  //
  // ⚠️ **On mémorise le TITRE de la section ouverte, pas son objet.** L'objet
  // était stocké tel quel, donc figé à l'instant du clic : ses entrées gardaient
  // les `actif` calculés à ce moment-là. On naviguait de « Liste » à
  // « Courbes », la route changeait — mais comme on RESTE dans « Mon compte »,
  // la remise à zéro sur changement de route ne se déclenchait pas et la barre
  // continuait d'afficher l'ancien objet. **Le surlignage ne suivait donc la
  // navigation qu'après un aller-retour au premier niveau.**
  // Le titre, lui, est ré-résolu à chaque rendu sur les `groupes` reçus, qui
  // sont reconstruits par l'appelant à chaque changement de page.
  //
  // `null` = premier niveau. `undefined` = « suivre la route », l'état initial
  // et celui de chaque changement de page.
  const [ouverte, setOuverte] = useState<string | null | undefined>(undefined);

  // ⚠️ Changer de page REPOSE le niveau sur celui de la route : arriver dans le
  // Siège doit montrer ses sous-sections, même si on avait remonté ailleurs.
  const cleRoute = section?.titre ?? null;
  const derniereRoute = useRef(cleRoute);
  if (derniereRoute.current !== cleRoute) {
    derniereRoute.current = cleRoute;
    if (ouverte !== undefined) setOuverte(undefined);
  }

  // Le niveau affiché : celui qu'on a ouvert à la main, sinon celui de la route.
  // ⚠️ La section ouverte à la main est **retrouvée dans les `groupes` du rendu
  // courant**, jamais réutilisée depuis l'état : c'est ce qui garantit que ses
  // entrées portent l'`actif` de la page qu'on regarde vraiment.
  const niveauDeux =
    ouverte === undefined
      ? section
      : ouverte === null
        ? null
        : (groupes
            .flatMap((g) => g.liens)
            .find((l) => l.ouvre?.titre === ouverte)?.ouvre ?? null);

  // ---- Survol : les sous-sections sans descendre d'un niveau ----------------
  //
  // ⚠️ **Ce n'est PAS le déploiement au survol qui avait été retiré.** Celui-là
  // remplaçait le CONTENU de la barre repliée : les icônes des sections
  // cédaient la place à celles des sous-sections, aux mêmes coordonnées, et on
  // cliquait ce qui venait d'arriver plutôt que ce qu'on visait. Ici la barre
  // ne bouge pas d'un pixel — le panneau sort À CÔTÉ, hors du flux. Rien ne
  // change sous le curseur, ce qui est exactement la règle que l'ancien essai
  // violait.
  //
  // ⚠️ **Le survol N'AJOUTE rien au modèle : il RACCOURCIT un chemin.** Cliquer
  // « Siège » puis « Offense » reste le geste de référence — c'est le seul qui
  // marche au clavier, au doigt, et quand on sait déjà où l'on va. Le panneau
  // évite le premier des deux clics à la souris, sans devenir le seul moyen
  // d'atteindre une sous-section : il n'est jamais la SEULE porte.
  //
  // ⚠️ On mémorise le TITRE, jamais l'objet section — même raison qu'`ouverte`
  // ci-dessus : l'objet se figerait avec les `actif` de l'instant du survol.
  const [survol, setSurvol] = useState<{ titre: string; haut: number } | null>(null);
  const minuterie = useRef<number | undefined>(undefined);

  // ⚠️ **Le survol ne vaut QUE pour une vraie souris.** Sur un écran tactile, un
  // appui déclenche `mouseenter` avant le `click` : le panneau se serait ouvert
  // sous le doigt à chaque touche. Même garde que la variante `hoverable:` de
  // Tailwind, en JS parce que la décision est ici, pas dans une classe.
  const souris = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const survoler = (titre: string, cible: HTMLElement) => {
    window.clearTimeout(minuterie.current);
    if (!souris()) return;
    // Mesuré à l'ENTRÉE, pas au rendu : la zone défile, et le panneau doit
    // s'aligner sur l'entrée telle qu'elle est à l'écran à cet instant.
    const haut = cible.getBoundingClientRect().top;
    minuterie.current = window.setTimeout(() => setSurvol({ titre, haut }), DELAI_OUVERTURE);
  };

  const quitter = () => {
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => setSurvol(null), DELAI_FERMETURE);
  };

  // Fermeture immédiate — sans passer par le délai de tolérance, qui n'a de
  // sens que pour un trajet de souris.
  const fermer = () => {
    window.clearTimeout(minuterie.current);
    setSurvol(null);
  };

  useEffect(() => () => window.clearTimeout(minuterie.current), []);

  // ⚠️ Échap referme : le panneau est une surface flottante, et toutes celles
  // de l'app se ferment ainsi (spec/shared/design.md). Sans lui, un panneau
  // ouvert au survol restait à l'écran tant que la souris ne bougeait pas.
  useEffect(() => {
    if (!survol) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [survol]);

  // Ré-résolue à chaque rendu sur les `groupes` courants, comme `niveauDeux`.
  const sectionSurvolee = survol
    ? (groupes.flatMap((g) => g.liens).find((l) => l.ouvre?.titre === survol.titre)?.ouvre ?? null)
    : null;

  // ⚠️ Jamais au second niveau : les entrées de premier niveau ne sont plus à
  // l'écran, le panneau flotterait à côté d'une liste qui ne l'a pas ouvert.
  const panneau = !niveauDeux && survol && sectionSurvolee ? { survol, section: sectionSurvolee } : null;

  return (
    <motion.aside
      // ⚠️ La LARGEUR s'anime, pas un `translateX` : la barre se replie **sur
      // elle-même** et rend sa place au contenu. Un glissement hors écran
      // l'aurait masquée en laissant le trou.

      animate={{ width: retractee ? LARGEUR_SIDEBAR_RETRACTEE : LARGEUR_SIDEBAR }}
      transition={COURBE}
      initial={false}
      className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-border bg-panel"
    >
      {/* ⚠️ Liseré d'ACCENT CONTEXTUEL sur toute la hauteur : c'est lui qui
          porte l'élément du monstre consulté. Dégradé vers le transparent —
          à pleine hauteur, une barre de couleur pleine tirerait l'œil hors du
          contenu, qui est ce qu'on vient lire. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px]
                   bg-gradient-to-b from-ctx to-transparent opacity-80"
      />

      {/* ⚠️ Le logo et la recherche vivent HORS des deux niveaux : ils ne
          changent jamais, et les faire glisser à chaque changement de section
          donnait l'impression qu'ils partaient avec la liste. */}
      <a
        href="#/"
        // ⚠️ Le logo REMET AUSSI la barre au premier niveau. Il ramène à
        // l'accueil, donc la route change et l'état se repose — sauf si on
        // était DÉJÀ sur l'accueil (barre ouverte à la main sur une section) :
        // la route ne changeait pas, et la barre restait au second niveau.
        onClick={() => {
          fermer();
          setOuverte(null);
        }}
        className={`flex flex-none items-center gap-2.5 py-[18px] focus-visible:outline-none ${
          retractee ? 'justify-center px-0' : 'px-4'
        }`}
      >
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="w-7 h-7 flex-none" />
        {!retractee && <span className="font-display text-lg tracking-wide">SW Forge</span>}
      </a>

      {/* ⚠️ La recherche est HORS de la zone défilante ci-dessous : sa liste de
          suggestions est en `absolute`, et `overflow-x-hidden` (nécessaire au
          repli) la coupait net. Elle reste donc en tête de la barre, fixe.
          ⚠️ Au premier niveau seulement : dans une section, la barre ne montre
          que trois ou quatre sous-sections — les chercher n'aurait pas de sens,
          et le champ prendrait la place du titre. */}
      {!niveauDeux && recherche}

      {/* ⚠️ `grid` avec les deux niveaux dans la MÊME cellule : ils se
          superposent le temps de la transition, sans `position: absolute` qui
          sortirait le contenu du flux et écraserait la hauteur de la barre.
          ⚠️ **Pas de `mode="wait"`.** Il a été essayé et retiré : le niveau
          sortant devait finir avant que l'entrant commence, mais une navigation
          rapide (aller-retour avant la fin des 180 ms) interrompait la sortie
          et l'entrant ne montait jamais — la barre restait VIDE. En superposé,
          l'entrant est monté immédiatement, quoi qu'il arrive au sortant. */}
      {/* ⚠️ Défiler referme le panneau : son `top` a été mesuré à l'entrée de
          la souris, il ne suit pas la liste qui glisse dessous. Le recalculer
          en continu ferait courir le panneau le long de l'écran pendant qu'on
          molette — le refermer dit simplement « tu regardes autre chose ». */}
      <div
        onScroll={fermer}
        className="flex-1 grid overflow-y-auto overflow-x-hidden [&>*]:col-start-1 [&>*]:row-start-1"
      >
        <AnimatePresence custom={Boolean(niveauDeux)} initial={false}>
          <motion.div
            // ⚠️ La clé désigne le NIVEAU, pas la section. Elle a d'abord
            // contenu le titre (`section:Siège`) : passer d'une section à une
            // autre changeait alors la clé alors qu'on RESTE au niveau 2, et
            // `mode="wait"` enchaînait deux transitions qui se chevauchaient —
            // la barre restait vide. Le contenu se met simplement à jour dans
            // le même nœud, ce qui est le comportement voulu : on n'a pas
            // changé de niveau.
            key={niveauDeux ? 'section' : 'racine'}
            custom={Boolean(niveauDeux)}
            variants={GLISSEMENT}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={COURBE}
          >
            {niveauDeux ? (
              /* ---- Niveau 2 : à l'intérieur d'une section ---- */
              <>
                {/* ⚠️ **Le titre EST le retour** — une seule cible, pas deux.
                    C'étaient deux blocs distincts : un « ‹ Toutes les sections »
                    en petit gris, puis le nom de la section en dessous. Le lien
                    ne se lisait pas comme un bouton (pas de fond, pas de zone
                    cliquable visible) et il répétait une information que le
                    titre donnait déjà.
                    Fusionnés, on lit « ‹ Siège » : d'où l'on sort, et par où
                    remonter, en un seul geste.

                    ⚠️ C'est un LIEN vers l'accueil, pas un `history.back()` :
                    on peut être arrivé ici par un lien direct ou un signet,
                    auquel cas « revenir » n'aurait aucune destination. */}
                {/* ⚠️ Un BOUTON, pas un lien : il remonte d'un NIVEAU dans la
                    barre, il ne quitte pas la page. Il pointait vers `#/` et
                    ramenait à l'accueil — on perdait son écran pour consulter
                    un menu. La page ne change qu'au clic sur une destination. */}
                {/* ⚠️ **Le même gabarit que les entrées de la barre** : le
                    rembourrage du conteneur (`px-2.5`) + `rounded-md` + `px-2`
                    sur la cible. Il occupe donc toute la largeur utile comme
                    elles, pas la largeur de son libellé — un `<button>` fait
                    `width: auto` même en `display: flex`, d'où le `w-full`. */}
                <div className={`mb-1 ${retractee ? 'px-1.5' : 'px-2.5'}`}>
                  <button
                    type="button"
                    onClick={() => setOuverte(null)}
                    title={`${niveauDeux.titre} — revenir à toutes les sections`}
                    className={`group flex w-full items-center rounded-md py-2
                                transition-colors hoverable:bg-panel2 ${
                                  retractee ? 'justify-center px-0' : 'gap-1.5 px-2'
                                }`}
                  >
                    <ChevronLeft
                      size={retractee ? 17 : 16}
                      className="flex-none text-ink-dim transition-transform
                                 group-hoverable:-translate-x-0.5 group-hoverable:text-ink"
                    />
                    {!retractee && (
                      <>
                        <span className="flex-none text-ctx">{niveauDeux.icon}</span>
                        <span className="truncate font-display text-base tracking-wide text-ink">
                          {niveauDeux.titre}
                        </span>
                      </>
                    )}
                  </button>
                </div>
                <nav
                  className={`flex flex-col gap-1 border-t border-border-soft pb-2 pt-2 ${
                    retractee ? 'mt-2 px-1.5' : 'px-2.5'
                  }`}
                >
                  <Groupes groupes={niveauDeux.groupes} retractee={retractee} />
                </nav>
              </>
            ) : (
              /* ---- Niveau 1 : les sections ---- */
              <>
                <nav
                  className={`flex flex-col gap-1 pb-2 ${
                    retractee ? 'px-1.5' : 'px-2.5'
                  }`}
                >
                  <Groupes
                    groupes={groupes}
                    retractee={retractee}
                    // Descendre d'un niveau referme le panneau : ses entrées
                    // sont désormais dans la barre elle-même, le laisser
                    // ouvert les afficherait DEUX fois côte à côte.
                    onOuvrir={(titre) => {
                      fermer();
                      setOuverte(titre);
                    }}
                    onSurvol={survoler}
                    onQuitter={quitter}
                  />
                </nav>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ⚠️ Enfant DIRECT de l'aside, jamais de la zone défilante au-dessus :
          celle-ci porte `overflow-x-hidden` (nécessaire au repli), qui coupait
          net le panneau à la lisière de la barre. C'est déjà la raison pour
          laquelle la recherche vit hors de cette zone.
          ⚠️ L'aside est `fixed`, donc c'est LUI le bloc conteneur : le `top`
          mesuré à l'écran (`getBoundingClientRect`) s'y applique tel quel. */}
      {panneau && (
        <div
          className="absolute inset-x-0 h-0"
          style={{ top: panneau.survol.haut }}
          onMouseEnter={() => window.clearTimeout(minuterie.current)}
          onMouseLeave={quitter}
        >
          <Flottant
            ancrage="cote"
            rembourrage="aucun"
            largeur="w-56"
            // ⚠️ Hauteur bornée par le BAS DE L'ÉCRAN, pas par une valeur
            // fixe : le panneau s'aligne sur son entrée, qui peut être la
            // dernière de la barre. Calculée plutôt que mesurée — mesurer
            // aurait demandé un rendu de plus, donc un saut visible.
            style={{ maxHeight: `calc(100vh - ${panneau.survol.haut + 16}px)` }}
            className="flex flex-col overflow-y-auto"
          >
            {/* Le titre de la section, comme en tête du niveau 2 — on doit
                savoir de QUELLE entrée le panneau est sorti. Pas un bouton :
                ici il n'y a rien à replier, la souris s'en charge. */}
            <span
              className="flex flex-none items-center gap-1.5 border-b border-border-soft
                         px-3 py-2 font-display text-sm tracking-wide text-ink"
            >
              <span className="flex-none text-ctx">{panneau.section.icon}</span>
              {panneau.section.titre}
            </span>
            {/* ⚠️ Pas de `role="menu"` : il promet une navigation aux flèches
                que ce panneau n'offre pas (voir LienBarre). Une région nommée
                dit ce qu'elle est sans mentir sur ce qu'elle sait faire. */}
            <nav
              aria-label={`${panneau.section.titre} — sous-sections`}
              className="flex flex-col gap-0.5 p-1.5"
              onClick={fermer}
            >
              {/* ⚠️ Le MÊME rendu d'entrées que la barre — pas une liste à
                  part. Les sous-sections doivent se cliquer et se surligner
                  exactement comme au niveau 2, sinon le panneau devient un
                  troisième gabarit à tenir d'accord avec les deux autres.
                  `retractee={false}` : le panneau montre toujours les
                  libellés, c'est tout son intérêt quand la barre est repliée. */}
              <Groupes groupes={panneau.section.groupes} retractee={false} />
            </nav>
          </Flottant>
        </div>
      )}

      {pied && (
        <div className={`border-t border-border-soft ${retractee ? 'p-1.5' : 'p-2.5'}`}>
          {pied}
        </div>
      )}

      {/* ⚠️ Le bouton de repli est le DERNIER élément, seul sur sa ligne : c'est
          un réglage de l'affichage, pas une destination. Le mêler aux liens de
          navigation le ferait lire comme une page de plus. */}
      <button
        type="button"
        onClick={onToggleRetract}
        aria-label={retractee ? 'Déplier la navigation' : 'Replier la navigation'}
        title={retractee ? 'Déplier la navigation' : 'Replier la navigation'}
        className={`flex items-center gap-2.5 border-t border-border-soft py-2.5 text-xs
                    text-ink-dimmer transition-colors hoverable:bg-panel2 hoverable:text-ink ${
                      retractee ? 'justify-center px-0' : 'px-3.5'
                    }`}
      >
        {/* L'icône suit le CHOIX (`retractee`), pas l'affichage : survolée, une
            barre repliée est bien dépliée à l'écran, mais le bouton propose
            toujours de la déplier pour de bon. */}
        {retractee ? (
          <PanelLeftOpen size={16} className="flex-none" />
        ) : (
          <PanelLeftClose size={16} className="flex-none" />
        )}
        {!retractee && (retractee ? 'Déplier' : 'Replier')}
      </button>
    </motion.aside>
  );
}

// Les groupes d'une liste — le MÊME rendu aux deux niveaux. Il était écrit deux
// fois, et les deux copies commençaient déjà à diverger (un `mt-3` d'un côté,
// `mt-4` de l'autre).
function Groupes({
  groupes,
  retractee,
  onOuvrir,
  onSurvol,
  onQuitter,
}: {
  groupes: SidebarGroupe[];
  retractee: boolean;
  // Ouvre une section dans la barre, sans naviguer. ⚠️ Reçoit son TITRE, pas
  // l'objet : voir `ouverte` plus haut — l'objet se figeait au clic.
  onOuvrir?: (titre: string) => void;
  // Survol d'une entrée à sous-sections : ouvre le panneau latéral. ⚠️ Absents
  // dans le panneau LUI-MÊME, dont les entrées sont des destinations — une
  // sous-section n'a pas de sous-sections.
  onSurvol?: (titre: string, cible: HTMLElement) => void;
  onQuitter?: () => void;
}) {
  return (
    <>
      {groupes.map((g, i) => (
        <div key={g.titre ?? i}>
          {/* ⚠️ **Un FILET entre les groupes**, pas seulement un écart. Les
              onze entrées de « Mon compte » se suivaient en trois blocs que
              seule une marge distinguait : à cette densité, l'œil ne voyait
              qu'une longue liste. Le trait dit où un groupe finit.
              Il n'apparaît qu'à partir du DEUXIÈME : un filet en tête de liste
              séparerait le premier groupe de rien du tout. */}
          {i > 0 && (
            <span
              aria-hidden
              className={`my-2 block h-px bg-border-soft ${retractee ? 'mx-auto w-5' : ''}`}
            />
          )}
          {/* Repliée, l'intitulé disparaît : « Ressources » et « Artéfacts »
              n'ont pas de version en trois lettres qui veuille dire quelque
              chose, et l'abréger donnerait un mot inventé. C'est le filet
              au-dessus qui garde la seule information qui survit à la
              réduction — « ce qui suit est un autre groupe ». */}
          {g.titre && !retractee && <span className="label block px-2 pb-1.5">{g.titre}</span>}
          {g.liens.map((l) => (
            <LienBarre
              key={l.key}
              lien={l}
              retractee={retractee}
              onOuvrir={onOuvrir}
              onSurvol={onSurvol}
              onQuitter={onQuitter}
            />
          ))}
        </div>
      ))}
    </>
  );
}

// Une entrée de barre, identique aux deux niveaux : le second n'est pas un
// rendu à part, seulement une autre liste.
function LienBarre({
  lien,
  retractee,
  onOuvrir,
  onSurvol,
  onQuitter,
}: {
  lien: SidebarLien;
  retractee: boolean;
  onOuvrir?: (titre: string) => void;
  onSurvol?: (titre: string, cible: HTMLElement) => void;
  onQuitter?: () => void;
}) {
  // ⚠️ Un BOUTON quand l'entrée ouvre une section, un LIEN quand elle mène
  // quelque part. Le premier ne doit pas apparaître dans l'historique du
  // navigateur ni s'ouvrir dans un nouvel onglet : il ne va nulle part.
  const Balise = lien.ouvre ? 'button' : 'a';
  return (
    <Balise
      {...(lien.ouvre
        ? { type: 'button' as const, onClick: () => onOuvrir?.(lien.ouvre!.titre) }
        : { href: lien.hash })}
      aria-current={lien.actif ? 'page' : undefined}
      // ⚠️ **Un geste de SOURIS, et rien d'autre — pas de `focus`.** L'ouvrir
      // aussi au clavier a été écrit puis retiré : le panneau est rendu APRÈS
      // la zone défilante (il doit échapper à son `overflow-x-hidden`), donc
      // le `Tab` suivant va à l'entrée d'à côté, jamais dans le panneau. On
      // aurait affiché au clavier un menu que le clavier ne peut pas
      // atteindre. Le chemin clavier reste la descente en deux temps — elle
      // mène partout, c'est le geste de référence que le survol ne fait que
      // raccourcir à la souris.
      {...(lien.ouvre && (onSurvol || onQuitter)
        ? {
            onMouseEnter: (e: { currentTarget: HTMLElement }) =>
              onSurvol?.(lien.ouvre!.titre, e.currentTarget),
            onMouseLeave: () => onQuitter?.(),
          }
        : {})}
      // ⚠️ Rétractée, le `title` est la SEULE façon de savoir où l'on va : les
      // libellés ont disparu et neuf icônes ne se distinguent pas toutes au
      // premier coup d'œil.
      // ⚠️ Repliée, le `title` est la SEULE façon de savoir où mène une icône.
      title={retractee ? lien.label : undefined}
      // ⚠️ UN SEUL marqueur de sélection : le fond teinté. Pas de fond +
      // bordure + gras cumulés — la règle du design system.
      // ⚠️ ~37 px de haut, icône 17, texte 15 : les proportions d'une barre
      // d'application (Vercel, Linear) plutôt que d'un menu de site. Une entrée
      // plus serrée fait une liste qu'on parcourt du regard ; à cette taille on
      // vise sans effort, et la colonne respire.
      //
      // ⚠️ **`text-base` (15), pas 14.** L'entrée était en `text-sm` (13) et la
      // colonne se lisait serrée. L'échelle typographique de l'app n'a rien
      // entre 13 et 15 (spec/shared/design.md) : on ne pose pas un `text-[14px]`
      // pour adoucir le saut, ce serait une valeur en dur hors échelle — et la
      // première d'une série, puisque le cran suivant manquerait toujours.
      //
      // ⚠️ **La barre est `hidden lg:flex`**, donc ce réglage ne concerne QUE le
      // bureau. Le panneau de navigation du téléphone (MobileNavSheet) a son
      // propre rendu et ne partage que les types — une correction destinée à un
      // format ne doit pas toucher l'autre (spec/shared/deux-applications.md).
      // ⚠️ `w-full` : un `<button>` ne s'étire pas comme un `<a>`. Sans lui, les
      // entrées qui ouvrent une section (Siège, Mon compte, Outils) étaient
      // larges comme leur texte, et leur fond au survol s'arrêtait au milieu de
      // la barre — trois entrées visiblement différentes des six autres.
      className={`group relative flex w-full items-center rounded-md py-2 text-left
                  text-base transition-colors ${
                    retractee ? 'justify-center px-0' : 'gap-2.5 px-2'
                  } ${
                    lien.actif ? 'text-ink' : 'text-ink-dim hoverable:text-ink'
                  }`}
    >
      {/* Survol — rendu AVANT le fond actif, donc DESSOUS : une entrée déjà
          sélectionnée ne doit pas changer d'aspect quand la souris la traverse.
          Un `z-index` négatif la ferait passer derrière le fond de la barre. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-lg bg-panel2 opacity-0 transition-opacity
                   group-hoverable:opacity-100"
      />
      {/* Marqueur de l'entrée active — **le marqueur unique de l'app** :
          contour d'accent + fond très léger (voir spec/shared/design.md).
          ⚠️ **Le CONTOUR est indispensable.** L'entrée n'a longtemps porté que
          `bg-ctx-soft`, et c'est le cas que la règle décrit mot pour mot : un
          fond de panneau trop proche du gris ambiant, qui ne se voit pas. Sur
          les sous-sections (Runes → Liste, Courbes…) on ne savait plus laquelle
          on lisait.
          ⚠️ Le contour vit sur ce calque en `absolute`, pas sur l'entrée : posé
          sur elle, il aurait décalé de 1 px l'icône et le libellé au changement
          de page — un clic déplacerait ce qu'on vient de cliquer.
          ⚠️ **Pas de `layoutId`.** Un fond partagé qui GLISSE d'une ligne à
          l'autre a été essayé — l'effet est joli, mais le nœud animé traverse
          alors le changement de niveau, lui-même géré par un `AnimatePresence`.
          Framer déplaçait le fond entre deux parents dont l'un se démontait, et
          l'entrée perdait son contenu au passage : les icônes disparaissaient
          en naviguant. Une simple transition de couleur ne peut pas casser. */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-lg border border-ctx bg-ctx-soft transition-opacity ${
          lien.actif ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* ⚠️ Au survol, l'icône et le libellé glissent de 2 px vers la droite,
          ensemble. C'est le mouvement le plus discret qui dise « c'est
          cliquable » — sur une liste de neuf entrées, tout ce qui grossit ou
          change de couleur brutalement fait sursauter la colonne entière.
          `group-hoverable` : le mouvement part du LIEN, pas de chaque élément —
          ils doivent bouger d'un bloc. */}
      {/* ⚠️ L'icône porte la COULEUR DE SIGNATURE de sa section (posée à la
          source dans App.tsx, voir data/couleursSection) — la même que la carte
          de l'accueil. Elle est CONSTANTE, active ou non : ce n'est pas un
          marqueur d'état (celui-ci reste le contour d'accent — un seul marqueur,
          spec/shared/design.md), c'est l'identité de la section. La couleur est
          posée en `color` inline sur l'icône, donc l'encre du libellé
          (`ink`/`ink-dim`) ne la déteint pas. */}
      <span className="relative flex-none transition-transform group-hoverable:translate-x-0.5">
        {lien.icon}
      </span>
      {!retractee && (
        <>
          <span className="relative transition-transform group-hoverable:translate-x-0.5">
            {lien.label}
          </span>
          {lien.ouvre && (
            // Le chevron avance de 2 px au survol : il annonce le geste avant
            // qu'on le fasse. C'est le seul mouvement de la liste au repos.
            <ChevronRight
              size={13}
              aria-hidden
              className="relative ml-auto flex-none text-ink-dimmer transition-transform
                         group-hoverable:translate-x-0.5"
            />
          )}
        </>
      )}
    </Balise>
  );
}
