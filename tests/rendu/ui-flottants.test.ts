// Tests au navigateur de la liste ouverte du `Selecteur` et du `Flottant` en
// couche supérieure (src/ui/), avec le clavier et le pointeur réels de
// Playwright : ce qui se passe après un clic ou une touche ne se voit pas au
// rendu serveur. Banc : ui-flottants-banc.tsx.
import type { Page } from 'playwright';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { egal, ok, titre } from '../outils';

const BANC = 'tests/rendu/ui-flottants-banc.tsx';

async function ouvrir(telephone: boolean, nom: 'selecteur' | 'boite' | 'segmented') {
  const banc = await navigateurOptimizer(telephone, BANC);
  await banc.page.evaluate((n) => (globalThis as unknown as { bancOptimizer: { monter: (n: string) => void } }).bancOptimizer.monter(n), nom);
  return banc;
}

// L'état de la liste : ouverte, en couche supérieure, focus, entrée active.
const lireListe = (page: Page) => page.evaluate(() => {
  const liste = document.querySelector<HTMLElement>('[role="listbox"]');
  const actif = liste?.getAttribute('aria-activedescendant');
  return {
    ouverte: !!liste,
    coucheSuperieure: !!liste?.closest('[popover]')?.matches(':popover-open'),
    focusListe: !!liste && document.activeElement === liste,
    actif: actif ? document.getElementById(actif)?.textContent?.trim() ?? null : null,
    focus: document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName ?? '',
    valeur: document.querySelector('[data-valeur]')?.textContent ?? '',
    hauteurs: [...document.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => Math.round(o.getBoundingClientRect().height)),
  };
});

async function centre(page: Page, selecteur: string) {
  const b = (await page.locator(selecteur).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export async function testRenduUiSelecteurTab() {
  titre('rendu · src/ui — Selecteur : Tab parcourt la liste ouverte, bureau');
  const { browser, page } = await ouvrir(false, 'selecteur');
  try {
    const p = await centre(page, 'select');
    await page.mouse.click(p.x, p.y);
    let e = await lireListe(page);
    ok(e.ouverte && e.coucheSuperieure && e.focusListe, 'clic : la liste de la charte s\'ouvre en couche supérieure, focus dans la liste');
    await page.keyboard.press('Tab');
    egal((await lireListe(page)).actif, 'Bêta', 'ouverte à la souris, le premier Tab cercle la valeur retenue');
    await page.keyboard.press('Tab');
    egal((await lireListe(page)).actif, 'Delta', 'Tab passe à l\'entrée suivante, la désactivée sautée');
    await page.keyboard.press('Shift+Tab');
    egal((await lireListe(page)).actif, 'Bêta', 'Maj+Tab revient à la précédente');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    e = await lireListe(page);
    ok(!e.ouverte && e.valeur === 'b' && e.focus === 'Après', `après la dernière, Tab ferme sans choisir et continue au contrôle suivant (${JSON.stringify(e)})`);
  } finally { await browser.close(); }
}

export async function testRenduTelephoneUiSelecteurListe() {
  titre('rendu · src/ui — Selecteur : liste de la charte au doigt, téléphone');
  const { browser, page } = await ouvrir(true, 'selecteur');
  try {
    const p = await centre(page, 'select');
    await page.touchscreen.tap(p.x, p.y);
    // L'apparition (`popover`, 150 ms) part d'une échelle de 0,96 : les
    // hauteurs se lisent une fois la surface posée.
    await page.waitForTimeout(300);
    const e = await lireListe(page);
    ok(e.ouverte && e.coucheSuperieure, 'toucher : la liste de la charte s\'ouvre (pas la roue du système)');
    ok(e.hauteurs.length === 4 && e.hauteurs.every((h) => h === 40), `au doigt, entrées de 40 px (${e.hauteurs.join(', ')})`);
    const delta = await centre(page, '[role="option"]:has-text("Delta")');
    await page.touchscreen.tap(delta.x, delta.y);
    const apres = await lireListe(page);
    ok(!apres.ouverte && apres.valeur === 'd', 'toucher une entrée la choisit et ferme la liste');
  } finally { await browser.close(); }
}

export async function testRenduUiFlottantBoiteQuiDefile() {
  titre('rendu · src/ui — Flottant dans une boîte qui défile : premier plan, jamais rogné');
  const { browser, page } = await ouvrir(false, 'boite');
  try {
    const lire = () => page.evaluate(() => {
      const s = document.querySelector<HTMLElement>('[aria-label="Surface"]')!;
      const boite = document.querySelector<HTMLElement>('[data-boite]')!.getBoundingClientRect();
      const r = s.getBoundingClientRect();
      // Un point de la surface hors de la boîte (à droite et sous elle) : la
      // surface y est-elle ce que l'on voit ?
      const dehors = document.elementFromPoint(Math.min(r.right - 4, innerWidth - 1), Math.min(r.bottom - 4, innerHeight - 1));
      return {
        // Masquée quand l'ancre sort de sa boîte : `visibility: hidden`, la
        // surface restant ouverte dans la couche supérieure.
        ouverte: s.matches(':popover-open') && getComputedStyle(s).visibility !== 'hidden',
        debordeLaBoite: r.right > boite.right && r.bottom > boite.bottom,
        visibleDehors: !!dehors && s.contains(dehors),
      };
    });
    const e = await lire();
    ok(e.ouverte && e.debordeLaBoite && e.visibleDehors, `plus large et plus haute que sa boîte, la surface se voit en entier, au premier plan (${JSON.stringify(e)})`);
    await page.evaluate(() => { document.querySelector<HTMLElement>('[data-boite]')!.scrollTop = 200; });
    await page.waitForTimeout(100);
    ok(!(await lire()).ouverte, 'l\'ancre sortie de la boîte en la faisant défiler : la surface se masque');
    await page.evaluate(() => { document.querySelector<HTMLElement>('[data-boite]')!.scrollTop = 0; });
    await page.waitForTimeout(100);
    ok((await lire()).ouverte, 'l\'ancre revenue : la surface réapparaît');
  } finally { await browser.close(); }
}

// `Segmented` choisit sa forme à la mesure : sur une ligne tant que tout tient,
// ses libellés sur deux lignes (coupés à un espace, au texte normal) sinon,
// tous les crans à la même hauteur ; le clic ne change pas la forme.
export async function testRenduUiSegmentedDeuxLignes() {
  titre('rendu · src/ui — Segmented : deux lignes seulement quand une ne tient pas');
  const { browser, page } = await ouvrir(false, 'segmented');
  try {
    const lire = (largeur: number) => page.evaluate((l) => [...document.querySelectorAll<HTMLButtonElement>(`[data-segmented="${l}"] button`)].map((b) => ({
      texte: b.textContent, hauteur: Math.round(b.getBoundingClientRect().height), police: getComputedStyle(b).fontSize,
      deborde: b.scrollWidth > b.clientWidth,
    })), largeur);
    const large = await lire(600);
    ok(large.length === 4 && large.every((c) => c.hauteur === 26 && !c.deborde), `600 px : tout tient, les quatre crans sur une ligne, 26 px (${JSON.stringify(large.map((c) => c.hauteur))})`);
    const etroit = await lire(300);
    const hauteurs = etroit.map((c) => c.hauteur);
    ok(hauteurs.every((h) => h === hauteurs[0]) && hauteurs[0] > 26 && etroit.every((c) => !c.deborde && c.police === large[0].police),
      `300 px : libellés sur deux lignes, tous les crans à la même hauteur, au texte normal, sans débordement (${JSON.stringify(etroit)})`);
    await page.getByRole('button', { name: 'Offenses siège' }).last().click();
    egal((await lire(300)).map((c) => c.hauteur), hauteurs, 'un clic sur un cran ne change ni la forme ni la hauteur');
    egal((await lire(600)).map((c) => c.hauteur), large.map((c) => c.hauteur), 'ni celles du contrôle où tout tient');
  } finally { await browser.close(); }
}
