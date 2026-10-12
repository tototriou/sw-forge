// Règle de mesure du banc d'affichage — « rien ne déborde », axe horizontal
// seul, tolérance de 1 px partout.
//
// Un écran DÉBORDE si l'une de ces trois conditions est vraie :
//
// - page : `documentElement.scrollWidth > L` ;
// - contenu : un élément visible dont `scrollWidth` dépasse `clientWidth`,
//   sauf si l'élément est lui-même un défilement voulu ;
// - géométrie : un élément visible dont le rectangle sort de la fenêtre, à
//   droite (`right > L`) ou à gauche (`left < 0`), sauf s'il est dans un
//   défilement voulu ou dans un ancêtre qui le coupe.
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
//   élément ni dans celle de ses ancêtres, `html` compris (règle « page »).
//   Au second passage, sa règle « contenu », celle de ses ancêtres et la
//   page se relisent ce pseudo-élément retiré. Aucun autre pseudo-élément
//   n'est exclu : un `::before` de la même classe, ou le `::after` d'une
//   autre, compte. Le pseudo est absolu : le retirer ne déplace rien. La
//   géométrie n'en dépend pas (un pseudo-élément n'a pas de rectangle) ;
//
// Second passage : chaque signalement « contenu » d'un élément concerné par
// une exception (et la page, si elle déborde et qu'une exception y porte) se
// relit une fois, toutes les neutralisations posées ensemble, puis tout est
// rendu tel quel avant la fin de `mesurer` (la capture suit la mesure).
// Neutralisations : décoratif coupé, `display: none` posé en ligne avec
// `!important` ; zone de toucher, une feuille de style ajoutée le temps de la
// lecture (`.cible-tactile::after { display: none !important }`). Le
// signalement garde ses valeurs du premier passage ; `depassement` porte
// celui qui reste, `page.relue` la largeur de page relue.
// ⚠️ Limite nommée : un décoratif EN FLUX retiré peut déplacer ses frères
// (rangée flex, ligne de texte) ; la relecture porte alors sur une
// disposition sans lui. Le halo est absolu : son retrait ne déplace rien.
//
// ⚠️ `mesurer` est exécutée DANS la page (`page.evaluate`) : Playwright en
// envoie le texte. Elle ne référence donc rien hors d'elle-même — pas une
// constante du module, pas un import.

export type Regle = 'contenu' | 'geometrie';

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
   * signalements « contenu » levés au second passage (voir la tête).
   */
  exclus: { ellipsis: number; invisibles: number; decoratifs: number; leves: number };
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
  let elementsMesures = 0;
  let ellipsis = 0;
  let invisibles = 0;
  // `body` compris : un dépassement qu'il porte lui-même (marge négative…)
  // ne se voit sur aucun de ses descendants.
  for (const el of [document.body, ...Array.from(document.body.querySelectorAll('*'))]) {
    if (el.getClientRects().length === 0) continue; // display: none, display: contents
    const s = style(el);
    if (s.visibility === 'hidden' || s.visibility === 'collapse') {
      invisibles++;
      continue;
    }
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
    const r = el.getBoundingClientRect();
    const releve = (regle: Regle): Signalement => ({
      regle,
      element: decrire(el),
      gauche: Math.round(r.left * 10) / 10,
      droite: Math.round(r.right * 10) / 10,
      largeur: Math.round(r.width * 10) / 10,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
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
      const signalement: Signalement = { ...releve('contenu'), depassement: el.scrollWidth - el.clientWidth, causes };
      signalements.push(signalement);
      elementDe.set(signalement, el);
    }
    const sort = r.right > largeur + TOLERANCE || r.left < -TOLERANCE;
    if (sort && !abrite(suivant(el))) signalements.push(releve('geometrie'));
  }

  // Second passage (tête) : les ancêtres concernés par une exception.
  const scrollWidth = document.documentElement.scrollWidth;
  let pageRelue: number | undefined;
  const ciblesTactiles = document.body.querySelector('.cible-tactile') !== null;
  const concerne = (a: Element) =>
    (ciblesTactiles && (a.classList.contains('cible-tactile') || a.querySelector('.cible-tactile') !== null)) ||
    decoratifsVus.some((d) => d !== a && a.contains(d) && (coupeurDecoratif(d) as Element).contains(a));
  const aRelire = signalements.filter((s) => s.regle === 'contenu' && concerne(elementDe.get(s) as Element));
  const relirePage = scrollWidth > largeur + TOLERANCE && ciblesTactiles;
  const leves = new Set<Signalement>();
  if (aRelire.length > 0 || relirePage) {
    const restaurer: (() => void)[] = [];
    const poser = (el: Element, propriete: string, valeur: string) => {
      const st = (el as HTMLElement).style;
      const avant = st.getPropertyValue(propriete);
      const priorite = st.getPropertyPriority(propriete);
      st.setProperty(propriete, valeur, 'important');
      restaurer.push(() => (avant ? st.setProperty(propriete, avant, priorite) : st.removeProperty(propriete)));
    };
    try {
      for (const d of decoratifsVus) poser(d, 'display', 'none');
      if (ciblesTactiles) {
        const zones = document.createElement('style');
        zones.textContent = '.cible-tactile::after { display: none !important; }';
        (document.head ?? document.documentElement).appendChild(zones);
        restaurer.push(() => zones.remove());
      }
      for (const s of aRelire) {
        const el = elementDe.get(s) as Element;
        const reste = el.scrollWidth - el.clientWidth;
        if (reste > TOLERANCE) s.depassement = reste;
        else leves.add(s);
      }
      if (relirePage) pageRelue = document.documentElement.scrollWidth;
    } finally {
      for (const r of restaurer.reverse()) r();
    }
  }
  const retenus = signalements.filter((s) => !leves.has(s));
  // Ordre de lecture, sans effet sur le verdict : la géométrie d'abord (ce
  // qui sort de l'écran se voit), puis le plus profond d'abord — c'est le
  // plus souvent la cause, ses ancêtres n'en sont que la conséquence.
  retenus.sort(
    (a, b) => (a.regle === b.regle ? 0 : a.regle === 'geometrie' ? -1 : 1) || b.element.profondeur - a.element.profondeur,
  );

  const pageDeborde = (pageRelue ?? scrollWidth) > largeur + TOLERANCE;
  return {
    largeur,
    innerWidth: window.innerWidth,
    largeurVisuelle: window.visualViewport ? window.visualViewport.width : null,
    page: { scrollWidth, ...(pageRelue !== undefined ? { relue: pageRelue } : {}), deborde: pageDeborde },
    signalements: retenus,
    elementsMesures,
    exclus: { ellipsis, invisibles, decoratifs: decoratifsVus.length, leves: leves.size },
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
