import { CSSProperties, ReactNode, forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

// Surface qui FLOTTE au-dessus de la page, ancrée à ce qui l'a ouverte : la
// popup d'édition d'une catégorie, le formulaire de création d'un monstre, la
// liste de résultats d'une recherche.
//
// ⚠️ **C'est la seule chose de l'app qui a le droit à une OMBRE.** L'élévation
// dit « je suis au-dessus, et je vais repartir » — c'est faux d'un bouton actif
// ou d'une carte sélectionnée, qui appartiennent à la page. Trois écrans
// recopiaient les mêmes `shadow-glow shadow-black/60`, et le jour où l'un
// d'eux ne l'a pas fait, il a paru collé au contenu qu'il recouvrait.
//
// ⚠️ **Toujours au PREMIER PLAN : la surface passe dans la couche supérieure
// du navigateur** (`popover="manual"` + `showPopover()`). Posée en `absolute`
// dans sa page, elle était rognée par tout ancêtre qui défile seul (les
// colonnes de l'Optimizer au bureau, la carte d'un deck du Siège) et passait
// sous la barre de défilement de cette boîte, voire sous la colonne voisine.
// La couche supérieure échappe aux `overflow`, aux `clip-path`, aux
// `transform` et aux contextes d'empilement de TOUS les ancêtres — ce que ni un
// `z-index` ni un `position: fixed` en place ne garantissent.
//
// ⚠️ **Et pas un portail** : la surface reste à SA place dans le DOM. Les
// fermetures au clic extérieur de l'app testent `racine.contains(cible)`, le
// focus et la navigation au clavier suivent l'ordre du document, les règles
// descendantes du parent s'appliquent : tout cela continue de marcher sans
// qu'aucun écran n'ait à le savoir. Un portail les aurait tous cassés.
//
// ⚠️ **La position est donc CALCULÉE**, en coordonnées de l'écran, sur l'ANCRE :
// le premier ancêtre positionné, celui qui servait de repère à l'`absolute`
// (le parent `relative` où l'écran pose le flottant), ou l'élément passé en
// `ancre` (le `<select>` du `Selecteur`). Elle se recalcule à
// chaque rendu, à chaque défilement (de n'importe quelle boîte) et à chaque
// redimensionnement. La surface :
//  - se pose sous l'ancre (ou au-dessus, ou à côté), à 6 px, alignée sur le
//    bord demandé ;
//  - garde les décalages `left` / `top` passés par `style`, lus comme avant
//    dans le repère de l'ancre (FlottantAuto, la liste de SelecteurMultiple) ;
//  - est BORNÉE à l'écran horizontalement, barre de défilement de la page
//    exclue : une ancre au bout d'une rangée ne la fait plus sortir ;
//  - bascule de l'autre côté de l'ancre quand elle ne tient pas du sien et
//    qu'il y a plus de place en face, et se borne en hauteur (avec
//    défilement) quand elle ne tient d'aucun : en couche supérieure, ce qui
//    sort de l'écran ne se rattrape plus en faisant défiler la page ;
//  - se masque quand l'ancre sort de ce qui la montre (une colonne qui défile),
//    plutôt que de flotter sur autre chose.
//
// ⚠️ **Les largeurs en POURCENTAGE se lisent sur l'ANCRE.** En couche
// supérieure, un `w-full` vaudrait toute la largeur de l'écran : `w-full` et
// `min-w-full` (dans `largeur`) et un `width` en `%` (dans `style`) sont
// convertis en pixels de la largeur de l'ancre, à chaque recalcul.
//
// ⚠️ Le `z-30` reste : c'est le repli d'un navigateur sans couche supérieure
// (la surface est alors `fixed` en place), et son rang dans l'échelle de l'app
// — contenu → barre du haut (20) → flottants (30) → onglets mobiles (40) →
// panneau montant (50) → panneau de second niveau (60) → dialogues (70).
//
// ⚠️ **L'origine de l'animation suit le point d'ancrage**, côté effectivement
// choisi compris : une surface qui grandit depuis son centre semble arriver de
// nulle part. Depuis le coin où elle est ancrée, elle dit d'où elle vient.

export interface FlottantProps {
  children: ReactNode;
  // Rembourrage intérieur. `aucun` pour une LISTE, dont les entrées doivent
  // toucher les bords — un rembourrage y laisse une bande morte au survol, et
  // l'entrée surlignée paraît décalée de son cadre.
  rembourrage?: 'aucun' | 'sm' | 'md';
  // Largeur. Par défaut celle de l'ancre (`w-full`, convertie en pixels), ce
  // qui convient à une liste de résultats posée sous son champ ; une popup
  // ancrée à un bouton étroit fixe la sienne.
  largeur?: string;
  // Ancrage : sous l'élément (défaut), au-dessus, ou À CÔTÉ.
  //
  // ⚠️ Décide AUSSI du sens de l'animation, qui doit partir du point d'ancrage
  // — sans quoi la surface semble arriver du mauvais côté.
  //
  // ⚠️ **`cote` est un AXE, pas une variante de `dessous`.** Un menu qui sort
  // sur le FLANC de son ancre — les sous-sections au survol d'une entrée de la
  // barre latérale — s'aligne sur le HAUT de l'ancre et se pose à sa DROITE.
  // Aucune combinaison de `dessous`/`dessus` et de `cote: gauche/droite` ne
  // l'exprime : celles-ci placent la surface au-dessus ou en dessous, jamais
  // à côté. `cote` ignore donc `cote:` (le côté horizontal), qui n'a plus de
  // sens quand c'est l'axe horizontal lui-même qui porte l'ancrage.
  ancrage?: 'dessous' | 'dessus' | 'cote';
  // Ancrage HORIZONTAL : aligné à gauche de l'ancre (défaut) ou à droite.
  //
  // ⚠️ `droite` sert quand l'ancre est près du bord de l'écran : la surface
  // s'ouvre alors vers l'intérieur. Voir [FlottantAuto](FlottantAuto.tsx), qui
  // choisit ce côté tout seul en mesurant.
  cote?: 'gauche' | 'droite';
  // L'élément auquel la surface s'ancre, quand ce n'est pas son premier
  // ancêtre positionné : sa boîte de BORDURE sert de repère.
  //
  // ⚠️ Sert à ce qu'on ne peut pas envelopper d'un parent `relative` sans
  // changer sa taille : le `<select>` du `Selecteur`, dont les appelants
  // visent la boîte par leurs classes. La surface reste dans le DOM juste
  // après lui.
  ancre?: HTMLElement | null;
  style?: CSSProperties;
  className?: string;
  role?: string;
  'aria-label'?: string;
  id?: string;
}

const REMBOURRAGES = { aucun: '', sm: 'p-2.5', md: 'p-3' } as const;

// Écart à l'ancre (l'ancien `mt-1.5`) et marge au bord de l'écran, en pixels :
// une surface qui touche exactement le bord paraît coupée même quand elle ne
// l'est pas.
const ECART = 6;
const MARGE = 8;

// Le navigateur sait-il poser un élément dans la couche supérieure ? Faux au
// rendu serveur des tests : l'attribut n'y est pas écrit.
const COUCHE_SUPERIEURE =
  typeof HTMLElement !== 'undefined' && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover');

// L'ancre : ce qui servait de repère à l'`absolute` — premier ancêtre
// positionné, ou qui crée un bloc conteneur (`transform`, `filter`…).
function ancreDe(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.position !== 'static' || cs.transform !== 'none' || cs.filter !== 'none'
      || cs.perspective !== 'none' || /paint|layout|strict|content/.test(cs.contain)) return p;
  }
  return document.documentElement;
}

// L'ancre est-elle encore visible, une fois rognée par les ancêtres qui
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
  return d >= g && b >= h;
}

// Un décalage de `style` en pixels (nombre ou « 12px »), sinon rien.
function enPixels(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^-?[\d.]+px$/.test(v.trim())) return parseFloat(v);
  return undefined;
}

const Flottant = forwardRef<HTMLDivElement, FlottantProps>(function Flottant(
  {
    children,
    rembourrage = 'md',
    largeur = 'w-full',
    ancrage = 'dessous',
    cote = 'gauche',
    ancre: ancreDonnee,
    style,
    className = '',
    ...reste
  },
  ref,
) {
  const boite = useRef<HTMLDivElement | null>(null);
  const poserRef = useCallback(
    (el: HTMLDivElement | null) => {
      boite.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    },
    [ref],
  );

  // Ce que le calcul lit, et non ce que React écrit : les décalages et la
  // largeur en `%` de `style` sont des consignes, la position finale est
  // posée par `placer`.
  const { left: styleGauche, top: styleHaut, ...styleReste } = style ?? {};
  const jetons = largeur.split(/\s+/).filter(Boolean);
  const pleineLargeur = jetons.includes('w-full');
  const minPleine = jetons.includes('min-w-full');
  const classesLargeur = jetons.filter((j) => j !== 'w-full' && j !== 'min-w-full').join(' ');
  const largeurEnPourcent = typeof styleReste.width === 'string' && styleReste.width.trim().endsWith('%');
  const pourcent = largeurEnPourcent
    ? parseFloat(styleReste.width as string) / 100
    : pleineLargeur && styleReste.width == null ? 1 : undefined;
  if (largeurEnPourcent) delete styleReste.width;
  const masque = /(^|\s)hidden(\s|$)/.test(className);

  const lues = () => ({
    ancrage, cote, ancre: ancreDonnee ?? null, gauche: enPixels(styleGauche), haut: enPixels(styleHaut), pourcent, minPleine, masque,
  });
  const consignes = useRef(lues());
  consignes.current = lues();

  const placer = useCallback(() => {
    const el = boite.current;
    if (!el) return;
    const c = consignes.current;
    // Couche supérieure : entrée à l'affichage, sortie quand l'écran la masque
    // (le `Menu`, toujours monté, masqué par `hidden`) — l'ordre de la couche
    // est celui des ouvertures, la dernière ouverte passe devant.
    if (COUCHE_SUPERIEURE) {
      try {
        const ouvert = el.matches(':popover-open');
        if (!c.masque && !ouvert) el.showPopover();
        else if (c.masque && ouvert) el.hidePopover();
      } catch { /* déconnecté : rien à placer */ }
    }
    if (c.masque || el.getClientRects().length === 0) return;

    // Ancre donnée : sa boîte de bordure. Ancêtre positionné : sa boîte de
    // rembourrage, le repère de l'`absolute`.
    const ancre = c.ancre ?? ancreDe(el);
    const ra = ancre.getBoundingClientRect();
    const sa = c.ancre ? null : getComputedStyle(ancre);
    const bord = (v: string | undefined) => (sa ? parseFloat(v ?? '') || 0 : 0);
    const a = {
      left: ra.left + bord(sa?.borderLeftWidth),
      top: ra.top + bord(sa?.borderTopWidth),
      right: ra.right - bord(sa?.borderRightWidth),
      bottom: ra.bottom - bord(sa?.borderBottomWidth),
    };
    el.style.visibility = visibleDansSesBoites(ancre) ? '' : 'hidden';
    if (c.pourcent != null) el.style.width = `${(a.right - a.left) * c.pourcent}px`;
    if (c.minPleine) el.style.minWidth = `${a.right - a.left}px`;
    // Hauteur NATURELLE (bornée par les classes de l'écran) avant toute
    // borne posée ici.
    el.style.maxHeight = '';
    el.style.overflowY = '';
    const w = el.offsetWidth;
    let h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    let gauche: number;
    if (c.ancrage === 'cote') gauche = a.right + ECART;
    else if (c.gauche != null) gauche = a.left + c.gauche;
    else gauche = c.cote === 'gauche' ? a.left : a.right - w;
    gauche = Math.max(MARGE, Math.min(gauche, vw - MARGE - w));

    let haut: number;
    let sens: 'dessous' | 'dessus' | 'cote' = c.ancrage;
    if (c.ancrage === 'cote') {
      haut = Math.max(MARGE, Math.min(a.top + (c.haut ?? 0), vh - MARGE - h));
    } else {
      const base = c.haut != null ? a.top + c.haut : a.bottom;
      const placeDessous = vh - MARGE - (base + ECART);
      const placeDessus = a.top - ECART - MARGE;
      if (c.ancrage === 'dessous' && h > placeDessous && placeDessus > placeDessous) sens = 'dessus';
      else if (c.ancrage === 'dessus' && h > placeDessus && placeDessous > placeDessus) sens = 'dessous';
      const place = Math.max(0, sens === 'dessous' ? placeDessous : placeDessus);
      if (h > place) {
        el.style.maxHeight = `${place}px`;
        el.style.overflowY = 'auto';
        h = place;
      }
      haut = sens === 'dessous' ? base + ECART : a.top - ECART - h;
    }
    el.style.left = `${gauche}px`;
    el.style.top = `${haut}px`;
    el.style.transformOrigin = sens === 'cote'
      ? 'top left'
      : `${sens === 'dessous' ? 'top' : 'bottom'} ${c.cote === 'gauche' ? 'left' : 'right'}`;
  }, []);

  // Avant de peindre, à chaque rendu : le contenu (une liste qui se filtre),
  // l'ancre ou les consignes ont pu changer.
  useLayoutEffect(placer);

  // Au défilement de n'importe quelle boîte — sauf la surface elle-même, qui
  // défile seule — et au redimensionnement de la fenêtre, de l'ancre ou du
  // contenu.
  useEffect(() => {
    const el = boite.current;
    const surDefilement = (e: Event) => {
      if (e.target instanceof Node && el?.contains(e.target)) return;
      placer();
    };
    window.addEventListener('scroll', surDefilement, true);
    window.addEventListener('resize', placer);
    let obs: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      obs = new ResizeObserver(() => placer());
      obs.observe(el);
      obs.observe(ancreDonnee ?? ancreDe(el));
    }
    return () => {
      window.removeEventListener('scroll', surDefilement, true);
      window.removeEventListener('resize', placer);
      obs?.disconnect();
    };
  }, [placer, ancreDonnee]);

  return (
    <div
      ref={poserRef}
      {...(COUCHE_SUPERIEURE ? { popover: 'manual' } : {})}
      style={styleReste}
      // ⚠️ Ce que la feuille du navigateur impose à un `popover` (centrage,
      // rembourrage, couleur) est rendu aux classes par `:where([popover])`
      // (index.css) ; l'écart à l'ancre est compté dans `placer`.
      // ⚠️ `overflow-hidden` : sans rembourrage, le contenu touche les bords et
      // ses coins carrés dépassaient de l'arrondi du cadre — quatre petits
      // ergots aux angles. C'est le cas de toute LISTE (`rembourrage="aucun"`),
      // dont les entrées doivent atteindre le bord pour que le survol ne laisse
      // pas de bande morte.
      className={`fixed left-0 top-0 z-30 overflow-hidden rounded-xl border border-border bg-panel
        shadow-glow shadow-black/60 ${classesLargeur} ${REMBOURRAGES[rembourrage]}
        animate-[popover_150ms_var(--ease-out)] ${className}`}
      {...reste}
    >
      {children}
    </div>
  );
});

export default Flottant;
