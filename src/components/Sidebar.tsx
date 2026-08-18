import { ReactNode, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useStickyState } from '../hooks/useStickyState';

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
const GLISSEMENT = {
  initial: (entrant: boolean) => ({ opacity: 0, x: entrant ? 8 : -8 }),
  animate: { opacity: 1, x: 0 },
  exit: (entrant: boolean) => ({ opacity: 0, x: entrant ? -8 : 8 }),
};

const COURBE = { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const };

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
        onClick={() => setOuverte(null)}
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
      <div className="flex-1 grid overflow-y-auto overflow-x-hidden [&>*]:col-start-1 [&>*]:row-start-1">
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
                <button
                  type="button"
                  onClick={() => setOuverte(null)}
                  title={`${niveauDeux.titre} — revenir à toutes les sections`}
                  className={`group mx-2.5 mb-1 flex items-center rounded-md py-1.5
                              transition-colors hoverable:bg-panel2 ${
                                retractee ? 'justify-center px-0' : 'gap-1.5 px-1.5'
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
                <nav
                  className={`flex flex-col gap-0.5 border-t border-border-soft pb-2 pt-2 ${
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
                  className={`flex flex-col gap-0.5 pb-2 ${
                    retractee ? 'px-1.5' : 'px-2.5'
                  }`}
                >
                  <Groupes groupes={groupes} retractee={retractee} onOuvrir={setOuverte} />
                </nav>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

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
}: {
  groupes: SidebarGroupe[];
  retractee: boolean;
  // Ouvre une section dans la barre, sans naviguer. ⚠️ Reçoit son TITRE, pas
  // l'objet : voir `ouverte` plus haut — l'objet se figeait au clic.
  onOuvrir?: (titre: string) => void;
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
            <LienBarre key={l.key} lien={l} retractee={retractee} onOuvrir={onOuvrir} />
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
}: {
  lien: SidebarLien;
  retractee: boolean;
  onOuvrir?: (titre: string) => void;
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
      // ⚠️ Rétractée, le `title` est la SEULE façon de savoir où l'on va : les
      // libellés ont disparu et neuf icônes ne se distinguent pas toutes au
      // premier coup d'œil.
      // ⚠️ Repliée, le `title` est la SEULE façon de savoir où mène une icône.
      title={retractee ? lien.label : undefined}
      // ⚠️ UN SEUL marqueur de sélection : le fond teinté. Pas de fond +
      // bordure + gras cumulés — la règle du design system.
      // ⚠️ 32 px de haut, icône 16, texte 14 : les proportions d'une barre
      // d'application (Vercel, Linear) plutôt que d'un menu de site. Une entrée
      // plus serrée fait une liste qu'on parcourt du regard ; à cette taille on
      // vise sans effort, et la colonne respire.
      // ⚠️ `w-full` : un `<button>` ne s'étire pas comme un `<a>`. Sans lui, les
      // entrées qui ouvrent une section (Siège, Mon compte, Outils) étaient
      // larges comme leur texte, et leur fond au survol s'arrêtait au milieu de
      // la barre — trois entrées visiblement différentes des six autres.
      className={`group relative flex w-full items-center rounded-md py-1.5 text-left
                  text-sm transition-colors ${
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
      {/* ⚠️ L'icône ne se teinte PLUS en `ctx` sur l'entrée active : le contour
          porte l'état, et une icône colorée par-dessus faisait un troisième
          signal pour dire la même chose (spec/shared/design.md — un seul
          marqueur). Elle suit l'encre du libellé, qui passe à `ink`. */}
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
