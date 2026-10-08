import { ReactNode, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useStickyState } from '../hooks/useStickyState';
import { BoutonIcone } from '../ui';
import Logo from './Logo';

// Barre de navigation LATÉRALE (bureau) — refonte graphique, lot 4
// (maquette « Barre latérale » ; docs/02-app/transverse/).
//
// De haut en bas : l'identité et le repli, le compte chargé, la recherche,
// les groupes (Jouer, Mon compte, Outils, Ressources), Paramètres en pied.
//
// ⚠️ **Les sous-sections se DÉROULENT sous leur entrée**, en retrait, avec un
// filet vertical qui dit à qui elles appartiennent. Elles REMPLAÇAIENT la
// liste (un second niveau à part entière) : on perdait de vue les autres
// sections dès qu'on entrait dans une. Déroulées sur place, on voit à la fois
// où l'on est et tout ce qu'on peut atteindre.
//
// ⚠️ **La barre navigue SEULE, la page ne suit qu'au choix d'une
// destination** — la règle ne change pas. Cliquer « Siège » déroule ses
// sous-sections sans charger de page ; on choisit ensuite laquelle.
//
// ⚠️ **Elle disparaît sous `lg`**, remplacée par la barre d'onglets du bas
// (voir MobileTabs). Une correction destinée à un format ne touche pas l'autre.

// ⚠️ 248 / 56 px. À 224, la carte du compte (avatar, nom, date d'export et
// nombre de monstres) tronquait sa seconde ligne ; repliée, une icône de 16
// garde 20 px de marge de chaque côté.
export const LARGEUR_SIDEBAR = 248;
export const LARGEUR_SIDEBAR_RETRACTEE = 56;

export interface SidebarLien {
  key: string;
  label: string;
  // Destination. ⚠️ **Absente quand l'entrée DÉROULE une section** : on
  // navigue dans la barre, PUIS on choisit — la page ne change qu'au second
  // clic.
  hash?: string;
  icon: ReactNode;
  // La section à dérouler au clic, pour une entrée qui en a une. Elle porte le
  // chevron — « il y a des entrées en dessous » —, jamais un compteur.
  ouvre?: SidebarSection;
  // Mention courte à droite du libellé (« Bientôt ») : un état de la PAGE,
  // pas de la navigation.
  badge?: string;
  actif: boolean;
}

export interface SidebarGroupe {
  // ⚠️ Un intitulé de groupe n'est PAS un lien : « Ressources » ne mène nulle
  // part, il annonce ce qui suit.
  titre?: string;
  // Icône du groupe. ⚠️ Sert au panneau mobile, qui fait CHOISIR le groupe
  // avant sa vue (voir MobileNavSheet). La barre latérale n'en a pas l'usage.
  icone?: ReactNode;
  liens: SidebarLien[];
}

// Une section à sous-sections : son titre, ses entrées.
export interface SidebarSection {
  titre: string;
  icon: ReactNode;
  // ⚠️ Des GROUPES, comme au premier niveau — le panneau mobile regroupe les
  // vues de « Mon compte » par inventaire.
  groupes: SidebarGroupe[];
}

// Glissement latéral entre deux niveaux. ⚠️ Exportés pour le panneau de
// navigation MOBILE (MobileNavSheet), qui descend encore d'un niveau à l'autre ;
// la barre bureau, elle, déroule sur place et n'en a plus l'usage.
export const GLISSEMENT = {
  initial: (entrant: boolean) => ({ opacity: 0, x: entrant ? 8 : -8 }),
  animate: { opacity: 1, x: 0 },
  exit: (entrant: boolean) => ({ opacity: 0, x: entrant ? -8 : 8 }),
};

export const COURBE = { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const };

// Le repli de la barre, exposé pour que le contenu décale sa marge en même
// temps. ⚠️ `useStickyState` : le choix tient pour la session, sans passer par
// le consentement de conservation (même règle que MobileNotice).
export function useSidebarRetractee() {
  return useStickyState('sidebar.retractee', false);
}

// Clé de la DESTINATION courante, telle que la barre la voit. Elle change à
// chaque changement de destination — pas seulement de section — et c'est elle
// qui remet la barre dans l'état de la route (voir `bascules`).
export function cleRouteBarre(
  section: SidebarSection | null | undefined,
  groupes: SidebarGroupe[]
): string {
  const actif = (gs: SidebarGroupe[]) =>
    gs.flatMap((g) => g.liens).find((l) => l.actif)?.key ?? '';
  return [section?.titre ?? '', section ? actif(section.groupes) : '', actif(groupes)].join('|');
}

// Fonds d'état des entrées. Survol : un voile d'ENCRE léger (la maquette de la
// refonte ; l'entrée active en prenait un plus appuyé, jusqu'au rebranding —
// voir plus bas). ⚠️ L'encre et non une surface : la
// barre a le fond de la page, et `panel`/`panel2` ne s'en écartent pas dans le
// même ordre d'un thème à l'autre (`panel` est le plus loin du fond en
// Atelier, `panel2` en Forge). Un voile d'encre s'en écarte toujours d'autant
// plus qu'il est dense.
// ⚠️ **L'entrée ACTIVE est en braise** depuis le rebranding (décision 29 — la
// toile, « En situation ») : fond braise sombre (`accent-soft`), texte et
// icône en braise lisible (5.58 en Forge, 4.91 en Atelier). Le survol garde
// le voile d'encre : lui ne dit pas « on est ici ».
const FOND_SURVOL = 'hoverable:bg-ink/5 hoverable:text-ink';
const FOND_ACTIF = 'bg-accent-soft text-accent';

export default function Sidebar({
  groupes,
  compte,
  recherche,
  retractee,
  onToggleRetract,
  pied,
}: {
  groupes: SidebarGroupe[];
  // Carte du compte chargé, rendue par l'appelant (voir SidebarCompte).
  compte?: ReactNode;
  // Champ de recherche, rendu par l'appelant (il seul connaît les destinations).
  recherche?: ReactNode;
  retractee: boolean;
  onToggleRetract: () => void;
  // Bas de barre : Paramètres. Rendu par l'appelant.
  pied?: ReactNode;
}) {
  // La section que la ROUTE déroule : celle de l'entrée active.
  const sectionRoute =
    groupes.flatMap((g) => g.liens).find((l) => l.actif && l.ouvre)?.ouvre ?? null;

  // Sections déroulées ou refermées À LA MAIN, par titre. Absente = suivre la
  // route (déroulée si c'est la section où l'on est).
  // ⚠️ Le TITRE, jamais l'objet : l'objet se figerait avec les `actif` de
  // l'instant du clic, et le surlignage ne suivrait plus la navigation.
  const [bascules, setBascules] = useState<Record<string, boolean>>({});

  // ⚠️ Changer de destination REPOSE la barre sur la route : arriver dans le
  // Siège le déroule, et ce qu'on avait déroulé en passant se referme.
  const cleRoute = cleRouteBarre(sectionRoute, groupes);
  const derniereRoute = useRef(cleRoute);
  if (derniereRoute.current !== cleRoute) {
    derniereRoute.current = cleRoute;
    if (Object.keys(bascules).length > 0) setBascules({});
  }

  const deroulee = (l: SidebarLien) => (l.ouvre ? (bascules[l.ouvre.titre] ?? l.actif) : false);

  // ⚠️ **Pas d'aperçu au survol.** Un panneau sortait à droite de la barre
  // quand la souris passait sur une section refermée ; le mainteneur l'a fait
  // retirer (2026-09-24, [retrait #12] du cadrage de la refonte) : les
  // sous-sections se déroulent désormais sous leur entrée, l'aperçu doublait
  // ce geste et surgissait dès qu'on traversait la barre.
  const basculer = (l: SidebarLien) => {
    const titre = l.ouvre!.titre;
    setBascules((b) => ({ ...b, [titre]: !deroulee(l) }));
  };

  return (
    <aside
      style={{ width: retractee ? LARGEUR_SIDEBAR_RETRACTEE : LARGEUR_SIDEBAR }}
      // ⚠️ La LARGEUR s'anime, pas un `translateX` : la barre se replie sur
      // elle-même et rend sa place au contenu.
      // ⚠️ Le fond des BARRES (`bar`, rebranding, décision 5), séparé par un
      // filet : la barre fait partie de l'application, elle ne se pose pas
      // dessus comme un panneau. C'était le fond de la page.
      className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col gap-3 border-r border-border-soft
                 bg-bar pb-3 pt-3.5 transition-[width] duration-[180ms] ease-out"
    >
      {/* ⚠️ Liseré d'ACCENT CONTEXTUEL : il porte l'élément du monstre
          consulté. Dégradé vers le transparent pour ne pas tirer l'œil. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px]
                   bg-gradient-to-b from-ctx to-transparent opacity-80"
      />

      {/* Identité et repli. ⚠️ Le repli vit EN TÊTE, à côté du nom : c'est un
          réglage de la barre elle-même, pas une destination. Repliée, les deux
          s'empilent. */}
      <div
        // Dans l'app de bureau, la rangée du logo prolonge la barre de la
        // fenêtre (index.css § Application de bureau). Sans effet sur le site.
        data-barre-fenetre
        className={`flex flex-none items-center ${
          retractee ? 'flex-col gap-2 px-0' : 'gap-2.5 pl-4 pr-3'
        }`}
      >
        <a
          href="#/"
          // Le logo ramène à l'accueil ET remet la barre dans l'état de la
          // route — même sur l'accueil, où la route ne change pas.
          onClick={() => setBascules({})}
          className="flex min-w-0 items-center gap-2.5 focus-visible:outline-none"
        >
          <Logo replie={retractee} />
        </a>
        {/* ⚠️ `ml-auto` sur le bouton, plus un espaceur `flex-1` : l'espaceur
            coûtait un écart de 10 px de plus, et « SW Blacksmith » n'a que
            130 px pour tenir (rebranding R2). */}
        <BoutonIcone
          libelle={retractee ? 'Déplier la navigation' : 'Replier la navigation'}
          icone={retractee ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          onClick={onToggleRetract}
          className={`flex-none text-ink-dimmer ${retractee ? '' : 'ml-auto'}`}
        />
      </div>

      {compte && <div className={`flex-none ${retractee ? 'px-1.5' : 'px-3'}`}>{compte}</div>}

      {/* ⚠️ HORS de la zone défilante : la liste de suggestions est en
          `absolute`, et l'`overflow-x-hidden` du repli la coupait net. */}
      {recherche}

      <nav
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden ${
          retractee ? 'px-1.5' : 'px-3'
        }`}
      >
        {groupes.map((g, i) => (
          <div key={g.titre ?? i} className="flex flex-col gap-px">
            {/* ⚠️ **Les groupes se séparent VISIBLEMENT** — demandé par
                Le mainteneur : un intitulé gris ne suffisait pas, les quatre groupes
                se lisaient comme une seule liste. Un FILET avant chaque groupe
                (sauf le premier), et l'intitulé à la couleur principale de
                l'app. Le menu reste neutre par ailleurs : les teintes de
                section, essayées sur les icônes, ont été écartées.
                Repliée, l'intitulé disparaît et le filet raccourcit : « ce qui
                suit est un autre groupe » est la seule information qui
                survit à la réduction. */}
            {i > 0 && (
              <span
                aria-hidden
                className={`block h-px bg-border ${retractee ? 'mx-auto my-2 w-5' : 'mx-2.5 mt-3'}`}
              />
            )}
            {g.titre && !retractee && <span className="label block px-2.5 pb-1 pt-2.5 text-accent">{g.titre}</span>}
            {g.liens.map((l) => {
              const ouverte = deroulee(l);
              return (
                <div key={l.key} className="flex flex-col gap-px">
                  <LienBarre
                    lien={l}
                    retractee={retractee}
                    deroulee={ouverte}
                    onBasculer={() => basculer(l)}
                  />
                  {ouverte && l.ouvre && <SousSections section={l.ouvre} retractee={retractee} />}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {pied && <div className={`flex-none border-t border-border-soft pt-2 ${retractee ? 'px-1.5' : 'px-3'}`}>{pied}</div>}
    </aside>
  );
}

// Les sous-sections d'une section déroulée, sous son entrée.
function SousSections({ section, retractee }: { section: SidebarSection; retractee: boolean }) {
  // Repliée, pas de place pour un libellé en retrait : l'icône de la
  // sous-section, et son nom dans le `title`.
  if (retractee) {
    return (
      <>
        {section.groupes.flatMap((g) => g.liens).map((s) => (
          <a
            key={s.key}
            href={s.hash}
            title={s.label}
            aria-label={s.label}
            aria-current={s.actif ? 'page' : undefined}
            className={`flex h-8 items-center justify-center rounded-lg transition-colors ${
              s.actif ? FOND_ACTIF : `text-ink-dimmer ${FOND_SURVOL}`
            }`}
          >
            {s.icon}
          </a>
        ))}
      </>
    );
  }
  // ⚠️ **UN filet continu, porté par le BLOC, pas un bout de trait par ligne.**
  // Dessiné dans chaque ligne, il traversait le fond de la sous-section
  // choisie et se coupait dans l'espace entre deux lignes — relevé par
  // Le mainteneur : « le rendu avec les lignes des sous-sections et la zone de
  // sélection fait bizarre ». Le bloc est décalé de 18 px (10 de marge + la
  // moitié d'une icône de 16) : son contour gauche tombe dans l'axe de l'icône
  // de l'entrée parente, et le fond de sélection commence APRÈS lui.
  return (
    <div className="ml-[18px] flex flex-col gap-px border-l border-border py-0.5 pl-2">
      {section.groupes.map((g, i) => (
        <div key={g.titre ?? i} className="flex flex-col gap-px">
          {g.titre && <span className="label block px-2.5 pb-0.5 pt-1.5">{g.titre}</span>}
          {g.liens.map((s) => (
            <a
              key={s.key}
              href={s.hash}
              aria-current={s.actif ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                s.actif ? FOND_ACTIF : `text-ink-dim ${FOND_SURVOL}`
              }`}
            >
              {/* ⚠️ L'icône de la sous-section, comme avant la refonte —
                  demandé par le mainteneur : la maquette n'en montrait pas, mais
                  chaque vue a la sienne et elle se repère plus vite qu'un mot. */}
              <span className="flex flex-none items-center">{s.icon}</span>
              <span className="min-w-0 truncate">{s.label}</span>
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}

// Une entrée du premier niveau.
function LienBarre({
  lien,
  retractee,
  deroulee,
  onBasculer,
}: {
  lien: SidebarLien;
  retractee: boolean;
  deroulee: boolean;
  onBasculer: () => void;
}) {
  // ⚠️ Un BOUTON quand l'entrée déroule une section, un LIEN quand elle mène
  // quelque part : le premier ne va nulle part, il n'a rien à faire dans
  // l'historique du navigateur.
  const Balise = lien.ouvre ? 'button' : 'a';
  // ⚠️ L'entrée d'une section DÉROULÉE ne porte pas le fond actif : c'est la
  // sous-section choisie qui le porte, juste en dessous. Refermée, elle le
  // reprend — on sait toujours où l'on est.
  const marquee = lien.actif && !deroulee;
  return (
    <Balise
      {...(lien.ouvre
        ? { type: 'button' as const, onClick: onBasculer, 'aria-expanded': deroulee }
        : { href: lien.hash })}
      aria-current={lien.actif && !lien.ouvre ? 'page' : undefined}
      // Repliée, le `title` est la SEULE façon de savoir où mène une icône.
      title={retractee ? lien.label : undefined}
      // ⚠️ 32 px de haut, icône 16, texte 14 : le gabarit de la maquette.
      // `w-full` : un `<button>` ne s'étire pas comme un `<a>`.
      className={`flex h-8 w-full flex-none items-center rounded-lg text-left text-md font-medium
                  transition-colors ${retractee ? 'justify-center px-0' : 'gap-2.5 px-2.5'} ${
                    marquee ? FOND_ACTIF : `text-ink-dim ${FOND_SURVOL}`
                  }`}
    >
      <span className="flex flex-none items-center">{lien.icon}</span>
      {!retractee && (
        <>
          <span className="min-w-0 flex-1 truncate">{lien.label}</span>
          {lien.badge && (
            <span className="flex-none rounded-full border border-border-soft bg-panel2 px-1.5 text-micro font-semibold text-ink-dim">
              {lien.badge}
            </span>
          )}
          {lien.ouvre &&
            (deroulee ? (
              <ChevronDown size={14} aria-hidden className="flex-none text-ink-dimmer" />
            ) : (
              <ChevronRight size={14} aria-hidden className="flex-none text-ink-dimmer" />
            ))}
        </>
      )}
    </Balise>
  );
}
