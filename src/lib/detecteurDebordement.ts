// Détecteur de débordement horizontal — **développement uniquement**.
//
// ⚠️ **Le problème n'est pas de masquer le défilement, c'est de le trouver.**
// `overflow-x: hidden` sur `html` et `body` (voir index.css) empêche la barre
// d'apparaître, mais le contenu déborde toujours : il est simplement coupé, donc
// inatteignable. Et le symptôme se voit sur une page qui n'a rien à voir avec le
// composant fautif — un `min-width` rigide dans une carte fait défiler la page
// entière.
//
// Ce détecteur nomme le coupable dans la console au lieu de laisser chercher à
// la main. Il ne corrige rien : c'est un outil de diagnostic.
//
// ⚠️ Il compare à `documentElement.clientWidth` et non à `window.innerWidth` :
// le second INCLUT la barre de défilement verticale, et tous les éléments
// paraîtraient déborder de ~15 px sur desktop.

function coupables(): HTMLElement[] {
  const limite = document.documentElement.clientWidth;
  const trouves: HTMLElement[] = [];

  for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
    const r = el.getBoundingClientRect();
    // Un débordement d'un pixel vient d'un arrondi de sous-pixel, pas d'un
    // défaut de mise en page.
    if (r.width === 0 || r.right <= limite + 1) continue;

    // ⚠️ On ne retient que le PLUS PROFOND. Un enfant trop large déborde tous
    // ses parents : les signaler tous noierait le vrai coupable sous une liste
    // d'ancêtres innocents.
    if (el.querySelector(':scope *')) {
      const enfantDeborde = Array.from(el.querySelectorAll<HTMLElement>('*')).some(
        (e) => e.getBoundingClientRect().right > limite + 1
      );
      if (enfantDeborde) continue;
    }

    // Un flottant volontairement hors cadre (menu en cours d'animation de
    // sortie, élément masqué) n'intéresse pas.
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.opacity === '0') continue;

    trouves.push(el);
  }
  return trouves;
}

export function surveillerDebordement(): void {
  if (!import.meta.env.DEV) return;

  let dernierRapport = '';

  const verifier = () => {
    const trouves = coupables();
    // Même signature qu'au passage précédent : on ne réécrit pas la console à
    // chaque redimensionnement d'un pixel.
    const signature = trouves.map((e) => e.className).join('|');
    if (signature === dernierRapport) return;
    dernierRapport = signature;
    if (trouves.length === 0) return;

    console.warn(
      `[débordement] ${trouves.length} élément(s) dépassent la largeur de la page ` +
        `(${document.documentElement.clientWidth} px). Ils sont masqués par ` +
        `overflow-x:hidden, mais leur contenu est coupé.`
    );
    for (const el of trouves) {
      const r = el.getBoundingClientRect();
      console.warn(
        `  → dépasse de ${Math.round(r.right - document.documentElement.clientWidth)} px`,
        el
      );
    }
  };

  // Après la peinture initiale, puis à chaque changement de taille ou de DOM.
  // ⚠️ `requestAnimationFrame` : mesurer pendant le premier rendu donne des
  // positions qui n'ont pas encore convergé, et signale des faux coupables.
  requestAnimationFrame(verifier);
  window.addEventListener('resize', verifier);

  // Le DOM change à chaque navigation et à chaque ouverture de panneau.
  // Temporisé : une observation par lot de mutations, pas par mutation.
  let attente: number | undefined;
  new MutationObserver(() => {
    window.clearTimeout(attente);
    attente = window.setTimeout(verifier, 250);
  }).observe(document.body, { childList: true, subtree: true, attributes: true });
}
