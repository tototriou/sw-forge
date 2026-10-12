// Règle de mesure du banc d'affichage — « rien ne déborde », axe horizontal
// seul, tolérance de 1 px partout.
//
// Un écran DÉBORDE si l'une de ces quatre conditions est vraie :
//
// - page : `documentElement.scrollWidth > L` ;
// - contenu : un élément visible dont `scrollWidth` dépasse `clientWidth`,
//   sauf si l'élément est lui-même un défilement voulu ;
// - géométrie : un élément visible dont le rectangle sort de la fenêtre, à
//   droite (`right > L`) ou à gauche (`left < 0`), sauf s'il est dans un
//   défilement voulu ou dans un ancêtre qui le coupe ;
// - chevauchement : réservée aux éléments qui bénéficient de l'exception
//   « icône en coin » (plus bas), sa contrepartie.
//
// Définitions :
//
// - L, la largeur de la fenêtre : `documentElement.clientWidth`, et NON
//   `innerWidth`. Au téléphone (contexte `isMobile`), Chromium élargit la
//   fenêtre de mise en page jusqu'au contenu qui déborde : une page de 508 px
//   dans 360 px y donne `innerWidth = 508 = scrollWidth`, et le débordement
//   disparaît de la mesure qui devait le voir. `documentElement.clientWidth`
//   reste à 360 (relevé : tests/banc/cas/page-oui.html). À l'ordinateur, les
//   deux valeurs coïncident (barres de défilement superposées) ;
// - élément mesuré : `body` et chacun de ses descendants (`html` relève de
//   la règle « page ») ;
// - visible : l'élément a une boîte (`getClientRects()` non vide — un
//   élément sous `display: none`, ou en `display: contents`, n'en a pas) ;
// - défilement voulu : `overflow-x` calculé `auto` ou `scroll`, ET une classe
//   qui le déclare sur l'axe x (`overflow-x-auto`, `overflow-x-scroll`,
//   variantes à préfixe comprises, ex. `sm:overflow-x-auto`). Une boîte
//   `overflow-y-auto` seule n'en est pas une : son `overflow-x` calculé vaut
//   aussi `auto` (une valeur `visible` face à une valeur non `visible` sur
//   l'autre axe devient `auto`), sans que personne ait voulu un défilement
//   horizontal ;
// - ancêtre qui le coupe : `overflow-x` calculé `hidden` ou `clip`. Seuls
//   comptent les ancêtres de la CHAÎNE DES BLOCS CONTENANTS, comme pour le
//   navigateur : un élément `position: fixed` n'est coupé par aucun ancêtre
//   (sauf un ancêtre qui lui sert de bloc contenant : `transform`,
//   `perspective`, `filter`, `backdrop-filter`, `contain` paint/layout,
//   `will-change` correspondant) ; un élément `position: absolute` saute les
//   ancêtres statiques jusqu'à son bloc contenant. Un défilement voulu se
//   cherche sur la même chaîne. Sans cela, un élément fixe qui sort de
//   l'écran passerait pour coupé par un `overflow-hidden` qui ne le coupe
//   pas.
//   ⚠️ `html` n'en est jamais un, ni `body` quand le navigateur lui emprunte
//   son `overflow` pour la fenêtre (celui de `html` est `visible`) : le
//   navigateur applique cet `overflow` à la FENÊTRE, pas à une boîte. Ce
//   qu'il coupe est ce qui sort de l'écran — exactement ce que la règle doit
//   voir. L'app pose `overflow-x: hidden` sur `html` comme « filet de
//   sécurité » (src/index.css : « le masquer rend le contenu coupé
//   inatteignable ») ; compté comme ancêtre qui coupe, il abriterait tout
//   élément en flux, et la règle ne signalerait plus rien.
//
// Exclusions, chacune LOCALE (l'élément exclu n'est signalé par aucune règle ;
// ses ancêtres restent mesurés, et sont signalés s'il les élargit) :
//
// - texte EFFECTIVEMENT coupé par ellipsis : `text-overflow: ellipsis` avec
//   `overflow-x` calculé `hidden` ou `clip`, ET `scrollWidth > clientWidth`
//   sur l'élément — la coupe est voulue et se voit. Les propriétés sans
//   texte coupé n'excluent rien ;
// - `visibility: hidden` (ou `collapse`) : une copie invisible sert à
//   réserver une place, elle ne se voit pas ;
// - `display: none` : aucune boîte, rien à mesurer.
//
// `aria-hidden` SEUL n'est PAS une exclusion : un élément caché aux lecteurs
// d'écran reste visible à l'œil. Toute autre exclusion s'écrit ici, avec son
// motif.
//
// Exceptions décidées, qui portent AUSSI sur les ancêtres (chacune est
// étroite : s'il manque une de ses conditions, rien n'est exclu) :
//
// - décoratif coupé (le halo des cartes de l'accueil) : un élément à la fois
//   `aria-hidden="true"` (l'attribut, valeur `true`), `pointer-events: none`
//   CALCULÉ (hérité compris) et coupé par un ancêtre. « Coupé » : sur sa
//   chaîne de blocs contenants, le premier ancêtre dont l'`overflow-x`
//   calculé n'est pas `visible` vaut `hidden` ou `clip` — un `auto` ou un
//   `scroll` le laisse atteignable au défilement, il n'est pas coupé ; `html`
//   et `body` propagé ne coupent pas (voir plus haut). Le décoratif n'est
//   signalé par aucune règle, et ses ancêtres, jusqu'à celui qui le coupe
//   compris, ne le sont pas AU TITRE DE CE SEUL ÉLÉMENT : leur règle
//   « contenu » se relit au second passage, décoratifs retirés, et ne reste
//   que si un dépassement subsiste. Ses descendants se mesurent comme les
//   autres ;
// - zone de toucher agrandie : le pseudo-élément `::after` d'un élément de
//   classe `cible-tactile` (src/index.css : 44 px touchables, centrés sur
//   l'élément, sans un pixel de dessin) ne compte ni dans la mesure de son
//   élément ni dans celle de ses ancêtres hors `html`. La règle « page », elle,
//   le COMPTE : un `::after` qui élargit la page laisse un défilement latéral
//   au téléphone (décision D9 de l'utilisateur ; relevé
//   tests/banc/cas/zone-tactile-page.html : `isMobile` élargit la fenêtre de
//   mise en page à 373 px pour 360). Au second passage, sa règle « contenu »
//   et celle de ses ancêtres se relisent ce pseudo-élément retiré ; la page,
//   jamais. Aucun autre pseudo-élément
//   n'est exclu : un `::before` de la même classe, ou le `::after` d'une
//   autre, compte. Le pseudo est absolu : le retirer ne déplace rien. La
//   géométrie n'en dépend pas (un pseudo-élément n'a pas de rectangle) ;
// - marge négative (`-mx-1` et voisines) : pour un élément dont la marge
//   droite calculée (`getComputedStyle`, en px) est négative, le dépassement
//   qu'il impose à son parent — et, par lui, à chaque ancêtre qui le
//   contient, `html` compris — est diminué EXACTEMENT de cette marge ; ce
//   qui dépasse encore est signalé avec la tolérance commune de 1 px, sans
//   autre seuil (une exception « ≤ 4 px » laisserait passer un vrai
//   débordement porté par le même élément). Au second passage, l'élément est
//   décalé vers la gauche de la valeur de sa marge en reportant celle-ci de
//   droite à gauche (`margin-left` diminuée de la marge, `margin-right: 0`) :
//   sa largeur et son encombrement (marge gauche + largeur + marge droite) ne
//   changent pas, aucune autre boîte ne bouge, et son bord droit, avec tout ce
//   qu'il porte, revient au bord de sa boîte de marge. Pas `translate` : il
//   ferait de l'élément le bloc contenant de ses descendants `absolute` et
//   `fixed`, qui se replaceraient contre lui (relecture Codex n° 3 ;
//   tests/banc/cas/marge-negative-bloc.html), et il excluait un élément qui
//   portait déjà un `translate`, même nul (n° 11 ;
//   marge-negative-translate.html). Côté par côté : document
//   LTR, seul le côté droit entre dans `scrollWidth` (un dépassement à
//   gauche n'est pas atteignable au défilement), donc seule la marge droite
//   s'y soustrait ; une marge gauche négative ne diminue rien. Relevé :
//   Chromium rend par `getComputedStyle` la marge déclarée (−4 px) même
//   quand la boîte est trop large et que la marge utilisée diffère
//   (tests/banc/cas/marge-negative.html, ligne « large »). L'élément garde
//   sa géométrie : sortir de la fenêtre reste signalé. Rien ne se soustrait
//   en `direction: rtl`. Un `translate` que l'élément porte déjà reste en
//   place et compte (un décalage de 2 px au-delà de la marge reste signalé) ;
// - icône en coin (l'icône d'élément de `MonsterAvatar`, `absolute -top-1
//   -right-1`) : son contact avec SON bloc contenant (l'avatar) est permis,
//   jamais avec le reste. Elle SEULE : décision D11 de l'utilisateur, aucune
//   généralisation à un autre élément absolu à décalage négatif (bouton en
//   coin, halo, superposition `-inset-px`), qui se mesure comme les autres.
//   · Qui en bénéficie : l'icône d'élément, reconnue ici sans toucher
//     `src/` — un `<img>` dont la source résolue (`img.src`, URL absolue) se
//     termine par `/elements/<nom>.png` (src/components/ElementIcon.tsx). Si le chemin
//     d'image change, la signature ne la reconnaît plus et ses signalements
//     reviennent : la panne va du côté prudent. Elle doit être en
//     `position: absolute`, avec un décalage `right` DÉCLARÉ négatif —
//     valeur calculée qui n'est pas le mot-clé `auto` (`computedStyleMap`) ;
//     sa valeur en px est celle de `getComputedStyle`. Relevé (sonde du
//     lot 5, Chromium du banc) : un `right: auto` dont la valeur utilisée est
//     négative (`left: 0` et une largeur trop grande) rend `-6px` par
//     `getComputedStyle` mais `auto` par `computedStyleMap` — ce n'est pas
//     un décalage voulu, son dépassement reste entier. Son bloc contenant
//     doit être `body` ou un descendant, de direction `ltr`, et ne doit ni
//     couper ni défiler sur AUCUN des deux axes (`overflow-x` et `overflow-y`
//     calculés `visible` ; `overflow-y: clip` seul rogne le haut de l'icône —
//     relecture Codex n° 6, tests/banc/cas/coin-rogne-y.html) : une icône
//     rognée par son avatar est un vrai défaut, il reste signalé (décision de
//     l'utilisateur). Sinon, rien ne se soustrait et la règle
//     « chevauchement » ne s'applique pas.
//   · Côté par côté : document LTR, seul le côté droit entre dans
//     `scrollWidth` ; un `left` négatif ne diminue rien (le dépassement à
//     gauche n'est pas compté), et `top`/`bottom` sont hors de l'axe mesuré.
//   · Contact : le dépassement que l'élément impose à son bloc contenant est
//     diminué EXACTEMENT de son décalage droit ; ce qui dépasse encore est
//     signalé (tolérance de 1 px). Au second passage, pour la seule relecture
//     de son bloc contenant, son décalage est ramené à 0 (`right: 0`, avec
//     `transition: none`, et sa largeur figée à sa valeur calculée quand
//     `left` vaut `auto`, pour qu'une largeur `auto` ne prenne pas la place
//     rendue). `translate` ne convient pas ici : relevé (sonde du lot 5),
//     quand plusieurs icônes en reçoivent un ensemble, Chromium ne recalcule
//     pas le `scrollWidth` du bloc de celle qui porte déjà un `transform`
//     (47 px au lieu de 43) ; `right: 0` donne 43. Valeur surcontrainte (`left`,
//     `right` et `width` déclarés) : le navigateur ignore `right` en LTR, le
//     ramener à 0 ne change rien, et rien ne se soustrait — ce dépassement
//     ne vient pas du décalage.
//   · Jamais avec le reste : aucun ancêtre AU-DELÀ du bloc contenant, `html`
//     compris, n'en profite — son dépassement se compte en entier ; la
//     géométrie de l'élément ne change pas. Et la règle « chevauchement » :
//     la boîte de l'élément (`getBoundingClientRect`, premier passage) ne
//     coupe celle d'aucun élément visible (au sens plus haut, `visibility`
//     visible) DU MÊME PLAN qui n'est ni un de ses ancêtres ni un descendant
//     de son bloc contenant — coupe : intersection de plus de 1 px de large
//     ET de haut. Même plan : le même ancêtre (l'élément compris) le plus
//     proche en `position: fixed` ou `sticky`, ou aucun pour les deux. Une
//     barre ou un en-tête fixe ou collant, une modale, passent au-dessus du
//     contenu qui défile sous eux : leurs boîtes se coupent sans que l'icône
//     y soit pour rien (relevé du lot 5 : 81 coupes de ce genre dans l'app,
//     barre basse du bestiaire, en-tête, modales de « Dégâts réels »).
//     Signalé sur l'élément, avec l'autre élément (`avec`) et l'aire coupée
//     (`aire`, px²) ; parmi les éléments coupés, seuls les plus profonds (un
//     élément coupé dont un descendant est coupé aussi n'est pas repris).
//     Elle ne porte pas sur un élément exclu (`visibility: hidden`,
//     décoratif coupé, ellipsis). ⚠️ Limite nommée : dans un même plan, les
//     boîtes sont celles de la mise en page, sans la coupe d'un ancêtre
//     `overflow` ni l'ordre d'empilement (`z-index`, `absolute` hors de la
//     chaîne `fixed`/`sticky`).
//
// Second passage : chaque signalement « contenu » d'un élément concerné par
// une exception (et la page, si elle déborde et qu'une marge négative y
// porte) se relit une fois, puis tout est rendu tel quel avant la fin de
// `mesurer` (la capture suit la mesure). Trois temps, chacun ne posant que
// les neutralisations qui valent pour ce qu'il relit : (1) marges négatives
// seules, la page ; (2) en plus décoratifs coupés et zones de toucher, les
// éléments qui ne sont le bloc contenant d'aucune icône en coin ; (3) en plus
// les icônes en coin, chaque bloc contenant d'une icône — avec les seules
// icônes dont il est le bloc (relu à part s'il contient une icône d'un autre
// bloc). Neutralisations : décoratif coupé, `display: none` posé en ligne
// avec `!important` ; zone de toucher, une feuille de style ajoutée le temps
// de la lecture (`.cible-tactile::after { display: none !important }`) ;
// marge négative, `margin-left`/`margin-right` en ligne avec `!important` ; icône en
// coin, `right: 0` en ligne avec `!important` (voir plus haut). Le
// signalement garde ses valeurs du premier passage ;
// `depassement` porte celui qui reste, `page.relue` la largeur de page relue.
// Remise en état : chaque neutralisation en ligne pose aussi `transition:
// none !important` — une transition sur la propriété neutralisée (`transition:
// translate 1s`) ferait lire une valeur intermédiaire. Chaque élément touché
// garde son attribut `style` d'avant (présence comprise) et le retrouve à
// l'identique : rendre propriété par propriété perdait des déclarations
// (`transition-duration` seule, effacée avec le raccourci `transition`) et
// laissait un `style=""` neuf. Le rendu se fait en deux temps — l'attribut
// d'avant avec les transitions coupées, un rendu forcé, puis l'attribut
// d'avant seul — sinon rendre ensemble la valeur et sa transition relance
// celle-ci depuis la valeur neutralisée (relecture Codex n° 8 à 10 ;
// tests/banc/cas/restauration.html, et `cas.mjs` vérifie chaque page).
// ⚠️ Limite nommée : un décoratif EN FLUX retiré peut déplacer ses frères
// (rangée flex, ligne de texte) ; la relecture porte alors sur une
// disposition sans lui. Le halo est absolu : son retrait ne déplace rien.
//
// ⚠️ `mesurer` est exécutée DANS la page (`page.evaluate`) : Playwright en
// envoie le texte. Elle ne référence donc rien hors d'elle-même — pas une
// constante du module, pas un import.

export type Regle = 'contenu' | 'geometrie' | 'chevauchement';

export interface DescriptionElement {
  /**
   * Chemin depuis `body`, par rang parmi les frères (`div:nth-child(2)`),
   * tronqué à gauche ; l'`id` n'y figure qu'avec `detail`.
   */
  chemin: string;
  balise: string;
  id: string | null;
  /**
   * Attribut `class`, tronqué ; vide sans `detail` (compte réel). Jamais le
   * texte de l'élément : il peut venir du compte.
   */
  classes: string;
  profondeur: number;
}

export interface Signalement {
  regle: Regle;
  element: DescriptionElement;
  gauche: number;
  droite: number;
  largeur: number;
  scrollWidth: number;
  clientWidth: number;
  /**
   * Règle « contenu » : le dépassement retenu, en px — `scrollWidth −
   * clientWidth`, ou sa relecture au second passage (voir la tête).
   */
  depassement?: number;
  /**
   * Règle « contenu » : les descendants les plus hauts qui sortent de la
   * boîte de l'élément (3 au plus). Vide : le dépassement vient d'un
   * pseudo-élément ou de texte. Aide à la lecture, sans effet sur le verdict.
   */
  causes?: DescriptionElement[];
  /** Règle « chevauchement » : l'élément dont la boîte est coupée (voir la tête). */
  avec?: DescriptionElement;
  /** Règle « chevauchement » : l'aire de l'intersection des deux boîtes, en px². */
  aire?: number;
}

export interface Mesure {
  /** L, la largeur de référence (`documentElement.clientWidth`). */
  largeur: number;
  /** Relevée pour le manifeste, jamais comparée (voir la tête). */
  innerWidth: number;
  largeurVisuelle: number | null;
  /**
   * `scrollWidth` : premier passage ; `relue` : relecture au second passage,
   * quand une exception porte sur la page (voir la tête) — c'est elle qui
   * décide alors de `deborde`.
   */
  page: { scrollWidth: number; relue?: number; deborde: boolean };
  signalements: Signalement[];
  elementsMesures: number;
  /**
   * `decoratifs` : éléments exclus comme décoratif coupé ; `leves` :
   * signalements « contenu » levés au second passage ; `coins` : éléments
   * qui bénéficient de l'exception « icône en coin » (voir la tête).
   */
  exclus: { ellipsis: number; invisibles: number; decoratifs: number; leves: number; coins: number };
  deborde: boolean;
}

/**
 * `detail` : décrire les éléments par `id` et classes (compte d'exemple). Sans
 * lui, le chemin n'est que structurel (balise et rang) : avec un compte réel,
 * un `id` ou une classe peut porter une donnée du compte.
 */
export function mesurer(options: { detail: boolean }): Mesure {
  const TOLERANCE = 1;
  const detail = options.detail;
  const largeur = document.documentElement.clientWidth;
  const styles = new Map<Element, CSSStyleDeclaration>();
  const style = (el: Element) => {
    let s = styles.get(el);
    if (!s) {
      s = getComputedStyle(el);
      styles.set(el, s);
    }
    return s;
  };
  const coupe = (s: CSSStyleDeclaration) => s.overflowX === 'hidden' || s.overflowX === 'clip';
  const classesDe = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  const defilementVoulu = (el: Element) => {
    const s = style(el);
    if (s.overflowX !== 'auto' && s.overflowX !== 'scroll') return false;
    return classesDe(el).some((c) => /(^|:)overflow-x-(auto|scroll)$/.test(c));
  };
  // Ce ancêtre sert-il de bloc contenant à un élément `fixed` ?
  const contientFixe = (s: CSSStyleDeclaration) =>
    s.transform !== 'none' ||
    s.perspective !== 'none' ||
    s.filter !== 'none' ||
    (s.backdropFilter ?? 'none') !== 'none' ||
    /paint|layout|strict|content/.test(s.contain) ||
    /transform|perspective|filter/.test(s.willChange);
  const mode = (s: CSSStyleDeclaration) =>
    s.position === 'fixed' ? 'fixe' : s.position === 'absolute' ? 'absolu' : 'flux';

  // `abrite(a)` : `a` ou un ancêtre de sa chaîne de blocs contenants coupe ou
  // défile volontairement — un descendant de `a` qui sort de la fenêtre est
  // alors dans une boîte qui le retient.
  const abris = new Map<Element, boolean>();
  const suivant = (el: Element): Element | null => {
    const m = mode(style(el));
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = style(a);
      if (m === 'fixe' && !contientFixe(s)) continue;
      if (m === 'absolu' && s.position === 'static' && !contientFixe(s)) continue;
      return a;
    }
    return null;
  };
  // `html`, et `body` quand son `overflow` passe à la fenêtre : voir la tête.
  const racine = document.documentElement;
  const sR = style(racine);
  const fenetre = (a: Element) =>
    a === racine || (a === document.body && sR.overflowX === 'visible' && sR.overflowY === 'visible');
  const abrite = (a: Element | null): boolean => {
    if (!a) return false;
    const connu = abris.get(a);
    if (connu !== undefined) return connu;
    const r = (!fenetre(a) && (coupe(style(a)) || defilementVoulu(a))) || abrite(suivant(a));
    abris.set(a, r);
    return r;
  };

  // Décoratif coupé (tête) : rend l'ancêtre qui le coupe, `null` si
  // l'élément n'en est pas un.
  const decoratifs = new Map<Element, Element | null>();
  const coupeurDecoratif = (el: Element): Element | null => {
    const connu = decoratifs.get(el);
    if (connu !== undefined) return connu;
    let coupeur: Element | null = null;
    if (el.getAttribute('aria-hidden') === 'true' && style(el).pointerEvents === 'none') {
      for (let a = suivant(el); a; a = suivant(a)) {
        if (fenetre(a)) continue;
        const s = style(a);
        if (coupe(s)) coupeur = a;
        if (s.overflowX !== 'visible') break;
      }
    }
    decoratifs.set(el, coupeur);
    return coupeur;
  };

  // Icône en coin (tête) : le bloc contenant de l'icône d'élément au décalage
  // droit déclaré négatif, et la largeur à figer pendant la relecture (`left`
  // `auto`) ; `null` si l'élément n'en bénéficie pas.
  const iconeElement = (el: Element) =>
    el instanceof HTMLImageElement && /\/elements\/[^/?#]+\.png$/.test(el.src);
  const coinDe = (
    el: Element,
    s: CSSStyleDeclaration,
  ): { bloc: Element; largeurFigee: string | null } | null => {
    if (!iconeElement(el)) return null;
    if (s.position !== 'absolute' || typeof el.computedStyleMap !== 'function') return null;
    const carte = el.computedStyleMap();
    const valeur = carte.get('right');
    if (!valeur || valeur instanceof CSSKeywordValue) return null;
    const droite = parseFloat(s.right);
    if (!(droite < 0)) return null;
    const bloc = suivant(el);
    if (!bloc || bloc === racine) return null;
    const sB = style(bloc);
    if (sB.direction !== 'ltr' || sB.overflowX !== 'visible' || sB.overflowY !== 'visible') return null;
    return { bloc, largeurFigee: carte.get('left') instanceof CSSKeywordValue ? s.width : null };
  };

  const decrire = (el: Element): DescriptionElement => {
    const segments: string[] = [];
    let profondeur = 0;
    for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
      profondeur++;
      const parent = e.parentElement;
      const rang = parent ? Array.prototype.indexOf.call(parent.children, e) + 1 : 1;
      const balise = e.tagName.toLowerCase();
      segments.unshift(e === document.body ? 'body' : `${balise}${detail && e.id ? `#${e.id}` : ''}:nth-child(${rang})`);
    }
    const chemin = segments.length > 8 ? `… > ${segments.slice(-8).join(' > ')}` : segments.join(' > ');
    const classes = detail ? (el.getAttribute('class') ?? '').replace(/\s+/g, ' ').trim() : '';
    return {
      chemin,
      balise: el.tagName.toLowerCase(),
      id: detail ? el.id || null : null,
      classes: classes.length > 160 ? `${classes.slice(0, 160)}…` : classes,
      profondeur,
    };
  };

  const signalements: Signalement[] = [];
  const elementDe = new Map<Signalement, Element>();
  const decoratifsVus: Element[] = [];
  // Marge négative (tête) : l'élément, la valeur absolue de sa marge droite et
  // sa marge gauche calculée.
  const margesNegatives: { el: Element; marge: number; gauche: number }[] = [];
  // Icône en coin (tête) : l'élément et son bloc contenant.
  const coins: { el: Element; bloc: Element; largeurFigee: string | null }[] = [];
  // Règle « chevauchement » : les éléments visibles, leur boîte au premier
  // passage, et ceux qui ont passé les exclusions.
  const visibles: Element[] = [];
  const boites = new Map<Element, DOMRect>();
  const mesures = new Set<Element>();
  let elementsMesures = 0;
  let ellipsis = 0;
  let invisibles = 0;
  const releve = (el: Element, r: DOMRect, regle: Regle): Signalement => ({
    regle,
    element: decrire(el),
    gauche: Math.round(r.left * 10) / 10,
    droite: Math.round(r.right * 10) / 10,
    largeur: Math.round(r.width * 10) / 10,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  });
  // `body` compris : un dépassement qu'il porte lui-même (marge négative…)
  // ne se voit sur aucun de ses descendants.
  for (const el of [document.body, ...Array.from(document.body.querySelectorAll('*'))]) {
    if (el.getClientRects().length === 0) continue; // display: none, display: contents
    const s = style(el);
    // Avant toute exclusion : un élément exclu impose quand même son
    // dépassement à ses ancêtres.
    const margeDroite = parseFloat(s.marginRight);
    if (margeDroite < 0 && s.direction === 'ltr') margesNegatives.push({ el, marge: -margeDroite, gauche: parseFloat(s.marginLeft) || 0 });
    const coin = coinDe(el, s);
    if (coin) coins.push({ el, ...coin });
    if (s.visibility === 'hidden' || s.visibility === 'collapse') {
      invisibles++;
      continue;
    }
    const r = el.getBoundingClientRect();
    visibles.push(el);
    boites.set(el, r);
    if (coupeurDecoratif(el)) {
      decoratifsVus.push(el);
      continue;
    }
    // Ellipsis EFFECTIVE seulement : une boîte qui a les propriétés sans
    // texte coupé n'a rien de voulu à excuser, elle se mesure comme les autres.
    if (s.textOverflow === 'ellipsis' && coupe(s) && el.scrollWidth - el.clientWidth > TOLERANCE) {
      ellipsis++;
      continue;
    }
    elementsMesures++;
    mesures.add(el);
    if (el.scrollWidth - el.clientWidth > TOLERANCE && !defilementVoulu(el)) {
      // Pour lire le signalement, pas pour le décider : les descendants les
      // plus hauts dont la boîte sort de celle de l'élément. Aucun : ce qui
      // dépasse est un pseudo-élément (`::after`…) ou du texte.
      const interieurGauche = r.left + el.clientLeft;
      const interieurDroite = interieurGauche + el.clientWidth;
      const sort = (d: Element) => {
        const q = d.getBoundingClientRect();
        return (
          d.getClientRects().length > 0 &&
          !coupeurDecoratif(d) &&
          (q.right > interieurDroite + TOLERANCE || q.left < interieurGauche - TOLERANCE)
        );
      };
      const causes: DescriptionElement[] = [];
      for (const d of Array.from(el.querySelectorAll('*'))) {
        if (causes.length >= 3) break;
        if (!sort(d)) continue;
        let parent = d.parentElement;
        while (parent && parent !== el && !sort(parent)) parent = parent.parentElement;
        if (parent === el) causes.push(decrire(d));
      }
      const signalement: Signalement = { ...releve(el, r, 'contenu'), depassement: el.scrollWidth - el.clientWidth, causes };
      signalements.push(signalement);
      elementDe.set(signalement, el);
    }
    const sort = r.right > largeur + TOLERANCE || r.left < -TOLERANCE;
    if (sort && !abrite(suivant(el))) signalements.push(releve(el, r, 'geometrie'));
  }

  // Règle « chevauchement » (tête) : contrepartie de l'icône en coin. Le plan
  // d'un élément : lui-même ou son ancêtre le plus proche en `fixed` ou
  // `sticky`, `null` s'il n'en a aucun.
  const plans = new Map<Element, Element | null>();
  const planDe = (e: Element): Element | null => {
    const connu = plans.get(e);
    if (connu !== undefined) return connu;
    const p = style(e).position;
    const plan = p === 'fixed' || p === 'sticky' ? e : e.parentElement ? planDe(e.parentElement) : null;
    plans.set(e, plan);
    return plan;
  };
  for (const { el, bloc } of coins) {
    if (!mesures.has(el)) continue;
    const r = boites.get(el) as DOMRect;
    const plan = planDe(el);
    const aires = new Map<Element, number>();
    for (const autre of visibles) {
      if (autre.contains(el) || bloc.contains(autre)) continue;
      if (planDe(autre) !== plan) continue;
      const q = boites.get(autre) as DOMRect;
      const l = Math.min(r.right, q.right) - Math.max(r.left, q.left);
      const h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (l > TOLERANCE && h > TOLERANCE) aires.set(autre, l * h);
    }
    const coupes = Array.from(aires.keys());
    for (const autre of coupes) {
      if (coupes.some((d) => d !== autre && autre.contains(d))) continue;
      signalements.push({
        ...releve(el, r, 'chevauchement'),
        avec: decrire(autre),
        aire: Math.round((aires.get(autre) as number) * 10) / 10,
      });
    }
  }

  // Second passage (tête) : les ancêtres concernés par une exception.
  const scrollWidth = document.documentElement.scrollWidth;
  let pageRelue: number | undefined;
  // `body` compris : `querySelector` ne cherche que dans ses descendants.
  const ciblesTactiles =
    document.body.classList.contains('cible-tactile') || document.body.querySelector('.cible-tactile') !== null;
  // Icône en coin : ses blocs contenants, et ceux qui contiennent en plus
  // l'icône d'un autre bloc (relus à part : cette icône-là ne leur est pas
  // soustraite).
  const blocsCoins = new Set(coins.map((c) => c.bloc));
  const estBlocCoin = (a: Element) => blocsCoins.has(a);
  const blocMele = (a: Element) => coins.some((c) => c.bloc !== a && a.contains(c.el));
  const concerne = (a: Element) =>
    (ciblesTactiles && (a.classList.contains('cible-tactile') || a.querySelector('.cible-tactile') !== null)) ||
    decoratifsVus.some((d) => d !== a && a.contains(d) && (coupeurDecoratif(d) as Element).contains(a)) ||
    margesNegatives.some(({ el }) => el !== a && a.contains(el)) ||
    estBlocCoin(a);
  const aRelire = signalements.filter((s) => s.regle === 'contenu' && concerne(elementDe.get(s) as Element));
  const relirePage = scrollWidth > largeur + TOLERANCE && margesNegatives.length > 0;
  const leves = new Set<Signalement>();
  if (aRelire.length > 0 || relirePage) {
    const restaurer: (() => void)[] = [];
    // Remise en état (tête) : une pose garde l'attribut `style` d'avant, tel
    // quel, et coupe les transitions de l'élément le temps de la relecture.
    type Pose = { el: Element; avant: string | null };
    const poses: Pose[] = [];
    const poser = (el: Element, declarations: Record<string, string>): Pose => {
      const pose = { el, avant: el.getAttribute('style') };
      const st = (el as HTMLElement).style;
      for (const [propriete, valeur] of Object.entries(declarations)) st.setProperty(propriete, valeur, 'important');
      st.setProperty('transition', 'none', 'important');
      return pose;
    };
    // Rend les poses, la plus récente d'abord : l'attribut d'avant avec les
    // transitions encore coupées, un rendu forcé, puis l'attribut d'avant à
    // l'identique — seule `transition` change alors, aucune ne part.
    const rendre = (liste: Pose[]) => {
      const ordre = [...liste].reverse();
      for (const { el, avant } of ordre) el.setAttribute('style', `${avant ?? ''};transition:none !important`);
      void document.documentElement.offsetWidth;
      for (const { el, avant } of ordre) {
        if (avant === null) el.removeAttribute('style');
        else el.setAttribute('style', avant);
      }
    };
    const relire = (s: Signalement) => {
      const el = elementDe.get(s) as Element;
      const reste = el.scrollWidth - el.clientWidth;
      if (reste > TOLERANCE) s.depassement = reste;
      else leves.add(s);
    };
    // Ramène le décalage droit des icônes données à 0 ; rend de quoi les remettre.
    const decalerCoins = (liste: typeof coins) => {
      const siennes = liste.map((c) =>
        poser(c.el, c.largeurFigee !== null ? { width: c.largeurFigee, right: '0px' } : { right: '0px' }),
      );
      return () => rendre(siennes);
    };
    try {
      // (1) La page : marges négatives seules (D9 ne vaut pas pour elle, un
      // décoratif est coupé avant `html`, une icône en coin s'arrête à son bloc).
      for (const { el, marge, gauche } of margesNegatives) {
        poses.push(poser(el, { 'margin-left': `${gauche - marge}px`, 'margin-right': '0px' }));
      }
      if (relirePage) pageRelue = document.documentElement.scrollWidth;
      // (2) Les éléments qui ne sont le bloc d'aucune icône en coin.
      for (const d of decoratifsVus) poses.push(poser(d, { display: 'none' }));
      if (ciblesTactiles) {
        const zones = document.createElement('style');
        zones.textContent = '.cible-tactile::after { display: none !important; }';
        (document.head ?? document.documentElement).appendChild(zones);
        restaurer.push(() => zones.remove());
      }
      for (const s of aRelire) if (!estBlocCoin(elementDe.get(s) as Element)) relire(s);
      // (3) Les blocs d'icônes en coin : toutes les icônes ensemble pour un
      // bloc qui ne contient que les siennes (décaler une icône hors d'un bloc
      // ne change pas son `scrollWidth`), les siennes seules pour les autres.
      const blocs = aRelire.filter((s) => estBlocCoin(elementDe.get(s) as Element));
      const purs = blocs.filter((s) => !blocMele(elementDe.get(s) as Element));
      if (purs.length > 0) {
        const remettre = decalerCoins(coins);
        try {
          for (const s of purs) relire(s);
        } finally {
          remettre();
        }
      }
      for (const s of blocs.filter((b) => !purs.includes(b))) {
        const bloc = elementDe.get(s) as Element;
        const remettre = decalerCoins(coins.filter((c) => c.bloc === bloc));
        try {
          relire(s);
        } finally {
          remettre();
        }
      }
    } finally {
      for (const r of restaurer.reverse()) r();
      rendre(poses);
    }
  }
  const retenus = signalements.filter((s) => !leves.has(s));
  // Ordre de lecture, sans effet sur le verdict : la géométrie d'abord (ce
  // qui sort de l'écran se voit), puis le chevauchement, puis le contenu ; le
  // plus profond d'abord — c'est le plus souvent la cause, ses ancêtres n'en
  // sont que la conséquence.
  const rang: Record<Regle, number> = { geometrie: 0, chevauchement: 1, contenu: 2 };
  retenus.sort((a, b) => rang[a.regle] - rang[b.regle] || b.element.profondeur - a.element.profondeur);

  const pageDeborde = (pageRelue ?? scrollWidth) > largeur + TOLERANCE;
  return {
    largeur,
    innerWidth: window.innerWidth,
    largeurVisuelle: window.visualViewport ? window.visualViewport.width : null,
    page: { scrollWidth, ...(pageRelue !== undefined ? { relue: pageRelue } : {}), deborde: pageDeborde },
    signalements: retenus,
    elementsMesures,
    exclus: { ellipsis, invisibles, decoratifs: decoratifsVus.length, leves: leves.size, coins: coins.length },
    deborde: pageDeborde || retenus.length > 0,
  };
}

/** Les médias du pointeur, tels que la page les voit (manifeste). Exécutée dans la page. */
export function medias(): { pointeurGrossier: boolean; sansSurvol: boolean } {
  return {
    pointeurGrossier: matchMedia('(pointer: coarse)').matches,
    sansSurvol: matchMedia('(hover: none)').matches,
  };
}

/**
 * Attend que la page ne bouge plus : polices chargées, puis une empreinte de
 * la disposition (position de chaque boîte) identique pendant `calmeMs`.
 * Les animations de l'app (framer-motion) tournent en JavaScript, hors de
 * `document.getAnimations()` : seule la disposition dit qu'elles ont fini.
 * Rend `false` si les polices ne sont pas chargées après `policesMs`, ou si
 * la page bouge encore après `maxMs`. Exécutée dans la page.
 */
export async function stabiliser(bornes: { calmeMs: number; maxMs: number; policesMs: number }): Promise<boolean> {
  const polices = await Promise.race([
    document.fonts.ready.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), bornes.policesMs)),
  ]);
  const empreinte = () => {
    let somme = 0;
    let n = 0;
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      somme += r.left * 3 + r.top * 5 + r.width * 7 + r.height * 11;
      n++;
    }
    return `${n}:${Math.round(somme)}:${document.documentElement.scrollWidth}`;
  };
  const debut = performance.now();
  let precedente = empreinte();
  let calmeDepuis = performance.now();
  while (performance.now() - debut < bornes.maxMs) {
    await new Promise((r) => setTimeout(r, 100));
    const e = empreinte();
    if (e !== precedente) {
      precedente = e;
      calmeDepuis = performance.now();
    } else if (performance.now() - calmeDepuis >= bornes.calmeMs) {
      return polices;
    }
  }
  return false;
}
