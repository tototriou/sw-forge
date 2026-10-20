import { ReactNode, createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import { BoutonIcone, FlottantAuto } from '../ui';
import MobileSheet from '../ui/MobileSheet';
import { useMediaQuery, SOUS_LG } from '../hooks/useMediaQuery';

// Bouton d'aide « ? » + son texte, sur DEUX supports selon le format — le patron
// né dans RunesCurve (Mon compte → Courbes), généralisé ici pour qu'un même
// besoin d'aide ne se réécrive plus à la main à chaque page.
//
// ⚠️ **Deux supports pour le même texte.** Une aide fait souvent une demi-page :
// ancrée à un petit bouton, une bulle flottante descend sous le bas de l'écran
// sur téléphone et ses dernières lignes passent derrière la barre d'onglets. Sous
// `lg` elle devient donc un PANNEAU MONTANT (`MobileSheet`), le composant que
// l'app emploie partout ailleurs pour ça ; à la souris, une bulle ancrée
// (`FlottantAuto`, qui mesure la place et choisit son côté).
//
// ⚠️ **Rien d'écrit à la main ici** : le bouton est un `BoutonIcone` (cadre, zone
// tactile, état actif sont ses axes), la bulle un `FlottantAuto` (bord, ombre et
// `z-index` lui appartiennent — jamais un `<div absolute z-…>` maison). C'est ce
// que la version manuscrite réécrivait un contrôle à la fois, chaque fois un peu
// différemment. Voir docs/03-developpeur/interface/.
//
// ⚠️ **Dans une boîte qui défile seule, la bulle sort de la boîte**
// (`AidesHorsDeLaBoite`) : posée en `absolute` dans un ancêtre
// `overflow: auto`, elle y serait rognée (une aide de 340 px ancrée au bord
// droit d'une colonne fixe de l'Optimizer n'en montrait que 15 %, avec une
// barre de défilement horizontale). La boîte le déclare par ce contexte ; la
// bulle passe alors par un portail, sous une ancre FANTÔME en `position: fixed`
// posée sur le bouton, recalée à chaque défilement et refermée quand le bouton
// sort de ce qui le montre. Ailleurs (contexte absent), rien ne change.
export const AidesHorsDeLaBoite = createContext(false);

interface Rect { left: number; top: number; width: number; height: number }

// Le bouton est-il encore visible, une fois rogné par les ancêtres qui
// rognent (colonne qui défile, volet) et par la fenêtre ?
function visibleDansSesBoites(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  let [g, h, d, b] = [r.left, r.top, r.right, r.bottom];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const q = p.getBoundingClientRect();
    [g, h, d, b] = [Math.max(g, q.left), Math.max(h, q.top), Math.min(d, q.right), Math.min(b, q.bottom)];
  }
  [g, h, d, b] = [Math.max(g, 0), Math.max(h, 0), Math.min(d, window.innerWidth), Math.min(b, window.innerHeight)];
  return d > g && b > h;
}

export default function HelpPopover({
  title,
  children,
  ariaLabel,
  width = 340,
}: {
  // Titre du panneau : sert de titre au panneau montant, d'en-tête à la bulle, et
  // de libellé au bouton faute d'`ariaLabel`.
  title: string;
  children: ReactNode;
  // Libellé du BOUTON quand il diffère du titre du panneau (« Comment lire ce
  // graphe ? » sur le bouton, « À quoi sert ce graphe ? » en en-tête).
  ariaLabel?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const auDoigt = useMediaQuery(SOUS_LG);
  const ref = useRef<HTMLDivElement>(null);
  const horsDeLaBoite = useContext(AidesHorsDeLaBoite) && !auDoigt;
  // L'ancre fantôme du portail : sa place à l'écran (celle du bouton).
  const fantome = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<Rect | null>(null);

  // Ferme la bulle au clic à l'extérieur — du bouton ET de la bulle, qui, en
  // portail, n'est plus dans le bouton.
  // ⚠️ Popover SEULEMENT : le panneau montant a son propre voile et sa croix, et
  // cet écouteur l'aurait refermé au premier appui à l'intérieur.
  useEffect(() => {
    if (!open || auDoigt) return;
    const onDown = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (fantome.current?.contains(cible)) return;
      if (ref.current && !ref.current.contains(cible)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, auDoigt]);

  // En portail : la place du bouton, relue avant de peindre puis à chaque
  // défilement (de la page, du volet, de la colonne ; pas de la bulle
  // elle-même, qui défile seule) et redimensionnement. Bouton sorti de ce qui
  // le montre : la bulle se ferme, plutôt que de flotter sur autre chose.
  useLayoutEffect(() => {
    if (!open || !horsDeLaBoite) { setPlace(null); return; }
    const relire = (e?: Event) => {
      if (e && e.target instanceof Node && fantome.current?.contains(e.target)) return;
      const el = ref.current;
      if (!el) return;
      if (!visibleDansSesBoites(el)) { setOpen(false); return; }
      const r = el.getBoundingClientRect();
      setPlace((avant) => (avant && avant.left === r.left && avant.top === r.top && avant.width === r.width && avant.height === r.height
        ? avant : { left: r.left, top: r.top, width: r.width, height: r.height }));
    };
    relire();
    window.addEventListener('scroll', relire, true);
    window.addEventListener('resize', relire);
    return () => {
      window.removeEventListener('scroll', relire, true);
      window.removeEventListener('resize', relire);
    };
  }, [open, horsDeLaBoite]);

  return (
    <div ref={ref} className="relative">
      <BoutonIcone
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        libelle={ariaLabel ?? title}
        icone={<HelpCircle size={14} />}
        cadre
        forme="pilule"
        zoneEtendue
        actif={open}
      />

      {/* À la SOURIS : bulle ancrée au bouton, qui choisit son côté. */}
      {/* ⚠️ **Rembourrée, bornée en hauteur, titre détaché** (le mainteneur, capture de
          « Comment est-ce calculé ? » :
          « ça ne rend pas bien, l'infobulle ») :
          - `rembourrage="md"` : `FlottantAuto` n'en pose aucun par défaut (il
            sert aussi aux LISTES, dont les entrées touchent le bord), et le
            texte collait au cadre ;
          - hauteur BORNÉE avec défilement : une aide longue sortait de l'écran
            par le bas, ses dernières lignes illisibles. `overflow-y-auto` passe
            après l'`overflow-hidden` de `Flottant` dans la feuille ;
          - le TITRE en 13 px, séparé du texte par un filet : à 12 px comme le
            corps, il ne s'en détachait pas. */}
      {horsDeLaBoite ? (
        // Hors de la boîte qui défile : même bulle, sous une ancre fantôme
        // posée sur le bouton, à l'étage des flottants (z-30, échelle de
        // Flottant.tsx). L'ancre laisse passer le pointeur, la bulle non.
        open && place && createPortal(
          <span
            ref={fantome}
            data-aide-hors-boite=""
            className="pointer-events-none fixed z-30"
            style={{ left: place.left, top: place.top, width: place.width, height: place.height }}
          >
            <FlottantAuto
              ouvert
              ancre={fantome}
              largeur={width}
              hauteur={420}
              rembourrage="md"
              className="pointer-events-auto max-h-[min(70vh,480px)] overflow-y-auto"
            >
              <div className="text-xs leading-relaxed text-ink-dim">
                <p className="mb-2 border-b border-border-soft pb-2 text-sm font-semibold text-ink">{title}</p>
                {children}
              </div>
            </FlottantAuto>
          </span>,
          document.body,
        )
      ) : (
        <FlottantAuto
          ouvert={open && !auDoigt}
          ancre={ref}
          largeur={width}
          hauteur={420}
          rembourrage="md"
          className="max-h-[min(70vh,480px)] overflow-y-auto"
        >
          <div className="text-xs leading-relaxed text-ink-dim">
            <p className="mb-2 border-b border-border-soft pb-2 text-sm font-semibold text-ink">{title}</p>
            {children}
          </div>
        </FlottantAuto>
      )}

      {/* AU DOIGT : panneau montant, pleine largeur, défilant, au-dessus des onglets. */}
      {/* Feuille : l'aide n'ouvre rien, elle passe devant une Modale ouverte. */}
      <MobileSheet ouvert={open && auDoigt} onFermer={() => setOpen(false)} titre={title} devantLesDialogues>
        <div className="text-xs leading-relaxed text-ink-dim">{children}</div>
      </MobileSheet>
    </div>
  );
}
