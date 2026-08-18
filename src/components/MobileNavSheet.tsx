import { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MobileSheet from '../ui/MobileSheet';
import { COURBE, GLISSEMENT, SidebarGroupe, SidebarSection } from './Sidebar';

// Choix de la SOUS-SECTION sur téléphone — le second niveau de navigation.
//
// ⚠️ **Toucher une section n'ouvre pas une page, il ouvre ce panneau.** C'est la
// même règle que la barre latérale (« la barre navigue SEULE ») portée au
// format tactile : on choisit d'abord OÙ, la page ne change qu'ensuite. Sans
// lui, « Compte » menait droit à l'inventaire de monstres et les dix autres vues
// n'étaient atteignables que par des rangées d'onglets posées dans la page —
// une par écran, chacune avec son rendu, invisibles tant qu'on n'y était pas.
//
// ⚠️ **DEUX TEMPS quand la section a des groupes** : on choisit d'abord
// l'inventaire (Monstres · Runes · Artéfacts), puis sa vue. Les dix
// destinations de « Mon compte » ont d'abord été posées à plat : c'est la liste
// de la barre latérale, qui tient sur un écran de bureau haut de 900 px et pas
// dans un panneau qui s'arrête au tiers de l'écran.
//
// ⚠️ **Un seul temps quand il n'y a rien à trancher.** « Siège » n'a qu'un
// groupe, sans intitulé : ses trois vues s'affichent directement. Faire choisir
// un groupe unique ajoute un geste sans rien donner à décider — la même règle
// qui laisse « Outils » en simple lien dans la barre d'onglets.
//
// ⚠️ **Des BOUTONS DÉLIMITÉS, pas du texte posé sur le fond.** Le panneau a
// d'abord été une liste à filets : trois libellés séparés par des traits, dont
// on ne voyait pas où commençait la cible. Chaque destination porte donc son
// cadre — c'est la `Pastille` de l'app, et son marqueur d'état est celui de
// toute l'app : contour d'accent + fond léger.
//
// ⚠️ **Il monte du BAS, sous le doigt qui l'a demandé.** Son déclencheur est un
// onglet de la barre du bas ; un menu qui surgirait en haut de l'écran
// obligerait à refaire le lien entre les deux à chaque fois — et le haut d'un
// téléphone tenu à une main est hors d'atteinte du pouce.
//
// ⚠️ **Les mêmes `SidebarSection` que la barre latérale**, pas une seconde
// liste. Une liste parallèle aurait divergé au premier écran ajouté, et le
// manque serait passé inaperçu : on ne cherche pas ce dont on ignore
// l'existence. C'est déjà la règle de `SidebarSearch`.

// ⚠️ **DEUX colonnes quand la largeur le permet, UNE seule sinon — jamais
// trois.** Les sept vues de Runes tiennent alors sur quatre rangées au lieu de
// sept, dans un panneau qui n'a que le tiers de l'écran.
//
// La borne à deux tient dans le `max()` : le minimum d'une colonne vaut **la
// moitié de la largeur** (moins la moitié de l'écart), donc trois n'entrent
// jamais. Un `minmax(140px, 1fr)` seul laissait `auto-fit` en poser trois dès
// 543 px de panneau — vrai sur une tablette étroite, et les vues y devenaient
// des vignettes.
//
// Et le plancher de 140 px garde le repli : dès que la moitié du panneau passe
// sous cette largeur (« Optimisation » et « Comparaison » s'y tronquent), plus
// aucune paire n'entre et la grille retombe **d'elle-même** sur une colonne
// pleine largeur. Un seul `max()` porte les deux règles — pas de second seuil à
// écrire, donc rien à maintenir d'accord.
//
// ⚠️ Les `_` sont la façon d'écrire une espace dans une valeur arbitraire
// Tailwind : `calc(50%_-_4px)` produit `calc(50% - 4px)`. Sans eux la classe
// n'est pas reconnue et **aucune règle n'est émise** — vérifié dans le CSS
// construit, pas seulement ici.
const GRILLE = 'grid-cols-[repeat(auto-fit,minmax(max(140px,calc(50%_-_4px)),1fr))]';

export default function MobileNavSheet({
  section,
  onFermer,
}: {
  // `null` = aucun panneau ouvert. La section vient du rendu courant, jamais
  // d'un objet mémorisé — voir `Sidebar`, où un objet figé au clic laissait le
  // surlignage en arrière d'une navigation.
  section: SidebarSection | null;
  onFermer: () => void;
}) {
  // Le groupe ouvert, par son TITRE. ⚠️ Le titre et non l'objet, pour la même
  // raison que partout ailleurs dans la navigation : un objet mémorisé se fige
  // à l'instant du clic et cesse de suivre les rendus suivants.
  const [groupeOuvert, setGroupeOuvert] = useState<string | null>(null);

  // ⚠️ On repart du PREMIER temps à chaque ouverture, et à chaque changement de
  // section. Rouvrir « Compte » sur les vues de Runes parce qu'on y était la
  // fois d'avant ferait apparaître une liste dont le titre ne dit pas d'où elle
  // sort — et « Siège » aurait hérité d'un groupe qui n'est pas le sien.
  useEffect(() => setGroupeOuvert(null), [section?.titre]);

  const groupes = section?.groupes ?? [];
  // Y a-t-il un groupe à CHOISIR ? Il en faut plusieurs, et qu'ils soient
  // nommés : un groupe sans intitulé n'est pas une destination, c'est juste une
  // façon de ranger la liste.
  const aDesGroupes = groupes.length > 1 && groupes.every((g) => g.titre);
  const groupeCourant = aDesGroupes
    ? (groupes.find((g) => g.titre === groupeOuvert) ?? null)
    : null;

  return (
    <MobileSheet
      ouvert={section !== null}
      onFermer={onFermer}
      // Le titre suit le temps où l'on est : « Mon compte », puis « Runes ».
      // C'est la seule chose qui dise ce qu'on est en train de choisir.
      titre={groupeCourant?.titre ?? section?.titre ?? ''}
      // ⚠️ Re-mesure de la hauteur au changement de temps. Figée sur le premier
      // (trois inventaires), les sept vues de Runes se seraient lues en défilant
      // dans une fenêtre trop courte. Voir MobileSheet.
      mesureCle={groupeCourant?.titre ?? ''}
      // ⚠️ **La barre d'onglets reste visible sous le panneau.** Le panneau
      // d'actions la recouvre à dessein — elle mène ailleurs, or on règle la
      // page où l'on est. Ici c'est l'inverse : ce panneau EST la navigation.
      // La masquer retirerait de l'écran la section où l'on se trouve et le
      // moyen d'en changer, au moment précis où l'on navigue.
      surLesOnglets
    >
      {section && (
        // ⚠️ `relative` : `popLayout` sort le niveau sortant du flux en
        // `absolute`. Sans ancêtre positionné ici, il se serait calé sur le
        // panneau `fixed` tout entier — donc sur son bord, en travers du titre.
        <div className="relative">
          {/* ⚠️ **Le MÊME glissement que la barre latérale** (`GLISSEMENT`,
              `COURBE` — 8 px, 180 ms), importé et non réécrit : descendre d'un
              niveau est le même geste, quel que soit le format.
              ⚠️ `mode="popLayout"` : le niveau sortant quitte le FLUX au lieu
              de rester empilé sous l'entrant. C'est ce qui permet à
              `MobileSheet` de re-mesurer la hauteur (voir `mesureCle`) sur le
              seul niveau entrant — les deux en flux, elle aurait relevé la
              somme des deux et le panneau se serait figé à une hauteur qui
              n'existe à aucun moment. */}
          <AnimatePresence mode="popLayout" custom={Boolean(groupeCourant)} initial={false}>
            <motion.div
              key={groupeCourant?.titre ?? 'racine'}
              custom={Boolean(groupeCourant)}
              variants={GLISSEMENT}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={COURBE}
              // ⚠️ `w-full` sur CHAQUE conteneur empilé de ce panneau. Le corps
              // du `MobileSheet` porte `data-tiroir`, et index.css y pose
              // `[data-tiroir] .flex-col { align-items: flex-start }` — une
              // règle écrite pour les RANGÉES D'ACTIONS, où quatre boutons
              // pleine largeur auraient le poids d'un menu principal. Elle
              // s'applique aussi ici, et sans `w-full` elle ramenait la grille
              // des vues à sa largeur de contenu : une seule colonne de 140 px
              // au milieu d'un panneau de 543. Ce panneau EST un menu
              // principal — il reprend donc toute la largeur, explicitement.
              className="flex w-full flex-col gap-2"
            >
              {groupeCourant ? (
                /* ── Second temps : les vues du groupe choisi ─────────────── */
                <>
                  {/* ⚠️ Le RETOUR en tête : on est descendu d'un niveau, il
                      faut pouvoir remonter sans refermer le panneau et le
                      rouvrir. Un `<button>` — il ne va nulle part.
                      ⚠️ Pleine largeur, au-dessus de la grille : c'est une
                      action sur le panneau, pas une destination de plus. */}
                  <Case
                    onClick={() => setGroupeOuvert(null)}
                    icone={<ChevronLeft size={16} />}
                    libelle={section.titre}
                    discret
                  />
                  <nav className={`grid w-full gap-2 ${GRILLE}`} aria-label={`Vues de ${groupeCourant.titre}`}>
                    {groupeCourant.liens.map((l) => (
                      <Case
                        key={l.key}
                        href={l.hash}
                        onClick={onFermer}
                        icone={l.icon}
                        libelle={l.label}
                        actif={l.actif}
                      />
                    ))}
                  </nav>
                </>
              ) : (
                /* ── Premier temps ────────────────────────────────────────
                   ⚠️ **Une seule colonne ici, quelle que soit la largeur.**
                   Les trois inventaires sont l'ossature du compte : les mettre
                   en grille les réduirait à des vignettes de la taille d'une
                   vue, alors qu'ils ne sont pas au même niveau. La grille est
                   réservée au second temps, où les sept vues de Runes doivent
                   tenir sans défiler. */
                <nav className="flex w-full flex-col gap-2" aria-label={`Sections de ${section.titre}`}>
                  {aDesGroupes
                    ? groupes.map((g) => <EntreeGroupe key={g.titre} groupe={g} onOuvrir={() => setGroupeOuvert(g.titre!)} onFermer={onFermer} />)
                    : groupes.flatMap((g) =>
                        g.liens.map((l) => (
                          <Case
                            key={l.key}
                            href={l.hash}
                            onClick={onFermer}
                            icone={l.icon}
                            libelle={l.label}
                            actif={l.actif}
                          />
                        ))
                      )}
                </nav>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </MobileSheet>
  );
}

// Un inventaire, au premier temps.
//
// ⚠️ **Un groupe à VUE UNIQUE mène directement à elle** (« Monstres » n'a que
// « Ma box ») : pas de chevron, pas de second temps. Le faire ouvrir une liste
// d'un seul choix demanderait deux gestes pour un endroit unique. Le libellé
// reste celui du GROUPE — c'est la liste des inventaires qu'on lit, et « Ma
// box » n'y aurait pas le même sens que ses deux voisins.
function EntreeGroupe({
  groupe,
  onOuvrir,
  onFermer,
}: {
  groupe: SidebarGroupe;
  onOuvrir: () => void;
  onFermer: () => void;
}) {
  // Le groupe où l'on se trouve : celui qui contient la vue courante. Sans ce
  // marqueur, le premier temps ne disait pas dans quel inventaire on est déjà.
  const actif = groupe.liens.some((l) => l.actif);
  const seule = groupe.liens.length === 1 ? groupe.liens[0] : null;
  return seule ? (
    <Case href={seule.hash} onClick={onFermer} icone={groupe.icone} libelle={groupe.titre!} actif={actif} />
  ) : (
    <Case onClick={onOuvrir} icone={groupe.icone} libelle={groupe.titre!} actif={actif} chevron />
  );
}

// Une cible du panneau — destination, ouverture de groupe ou retour.
//
// ⚠️ **UN SEUL rendu pour les trois.** Ils avaient chacun le leur, et les
// différences (centré ou non, avec ou sans chevron, cadre propre ou pas) se
// lisaient comme trois natures d'objets alors qu'ils font tous la même chose :
// mener quelque part. Seuls changent la BALISE (`<a>` qui navigue, `<button>`
// qui ne va nulle part) et ce qu'on pose à droite.
function Case({
  href,
  onClick,
  icone,
  libelle,
  actif = false,
  chevron = false,
  discret = false,
}: {
  // Présent = la cible NAVIGUE (`<a>`). Absent = elle agit dans le panneau
  // (`<button>`) : ouvrir un groupe, remonter d'un niveau. Même distinction que
  // la barre latérale — ce qui ne va nulle part n'a rien à faire dans
  // l'historique ni dans un « ouvrir dans un nouvel onglet ».
  href?: string;
  onClick: () => void;
  icone: ReactNode;
  libelle: string;
  actif?: boolean;
  chevron?: boolean;
  // Cible de RETOUR : même gabarit et même cadre, encre atténuée. Elle ramène
  // au niveau du dessus, elle n'est pas une destination de plus — la donner à
  // lire comme les autres la ferait viser par erreur.
  discret?: boolean;
}) {
  const Balise = href ? 'a' : 'button';
  return (
    <Balise
      {...(href ? { href } : { type: 'button' as const })}
      onClick={onClick}
      aria-current={actif ? 'page' : undefined}
      title={libelle}
      // ⚠️ `w-full` explicite : un `<button>` ne s'étire pas comme un `<a>`.
      // ⚠️ **44 px de haut**, la règle tactile : on vise du pouce sans regarder.
      // ⚠️ **Le cadre est PORTÉ PAR LA CIBLE**, pas par une liste qui les
      // engloberait : c'est lui qui dit où commence le bouton. Un seul contour,
      // de 1 px — le marqueur d'état ne fait que le teinter, il n'en ajoute pas
      // un second (spec/shared/design.md).
      className={`flex w-full min-h-[44px] items-center gap-2.5 rounded-lg border px-3
                  text-left text-sm transition-colors ${
                    actif
                      ? 'border-ctx bg-ctx-soft text-ink'
                      : `border-border bg-panel2/40 hoverable:border-accent hoverable:text-ink ${
                          discret ? 'text-ink-dimmer' : 'text-ink-dim'
                        }`
                  }`}
    >
      {/* Colonne d'icône à LARGEUR FIXE : sans elle, les libellés se décalaient
          d'une cible à l'autre au gré de la largeur des symboles — et en grille,
          les deux colonnes ne s'alignaient plus l'une sur l'autre. */}
      <span className={`flex w-[18px] flex-none justify-center ${actif ? 'text-ctx' : ''}`}>
        {icone}
      </span>
      {/* `truncate` : « Optimisation » et « Comparaison » frôlent la largeur
          d'une colonne sur les écrans les plus étroits. Le `title` garde le
          libellé entier. */}
      <span className="flex-1 truncate">{libelle}</span>
      {chevron && (
        // Le chevron dit la seule chose utile : « il y a un niveau en dessous ».
        // Même rôle que dans la barre latérale.
        <ChevronRight size={15} aria-hidden className="flex-none text-ink-dimmer" />
      )}
    </Balise>
  );
}
