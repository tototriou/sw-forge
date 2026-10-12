// Session de navigateur du banc d'affichage : Chromium sans fenêtre, un
// contexte par format, l'import du compte, les étapes de préparation d'un
// état, la mesure et la capture.
//
// Distincte de la session du skill run-swblacksmith, dont elle reprend le
// patron d'import : le banc possède son navigateur et son serveur, sert une
// construction (pas le serveur de dev) et ne doit rien écrire sur la sortie
// standard qui vienne de la page — avec un compte réel, un message de la
// page peut porter un nom de monstre ou de joueur.

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { FORMATS } from './ecrans.ts';
import { medias, mesurer, stabiliser } from './mesure.ts';

export { medias };

// Conteneur Linux (claude.ai/code) : Chromium y est préinstallé pour une
// autre version de Playwright. Même repli que la session du skill.
const CHROMIUM_PREINSTALLE = '/opt/pw-browsers/chromium';

export async function lancerNavigateur() {
  return chromium.launch().catch((err) => {
    if (!existsSync(CHROMIUM_PREINSTALLE)) throw err;
    return chromium.launch({ executablePath: CHROMIUM_PREINSTALLE });
  });
}

/** Options du contexte Playwright d'un format. */
export function optionsFormat(format) {
  const f = FORMATS[format];
  return {
    viewport: { width: f.largeur, height: f.hauteur },
    deviceScaleFactor: 1,
    isMobile: f.tactile,
    hasTouch: f.tactile,
  };
}

/**
 * Un contexte au format voulu, avec un compteur des messages d'erreur de ses
 * pages : on en garde le NOMBRE, et le texte seulement si `garderTextes`.
 */
export async function ouvrirContexte(navigateur, format, { etatStockage, garderTextes }) {
  const contexte = await navigateur.newContext({
    ...optionsFormat(format),
    ...(etatStockage ? { storageState: etatStockage } : {}),
  });
  const messages = { erreursPage: 0, erreursConsole: 0, textes: [] };
  contexte.on('page', (page) => suivreMessages(page, messages, garderTextes));
  return { contexte, messages };
}

function suivreMessages(page, messages, garderTextes) {
  page.on('pageerror', (err) => {
    messages.erreursPage++;
    if (garderTextes) messages.textes.push(`[pageerror] ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    messages.erreursConsole++;
    if (garderTextes) messages.textes.push(`[console.error] ${msg.text()}`);
  });
}

/** Erreur du banc dont le message est écrit par le banc, jamais par la page. */
export class ErreurBanc extends Error {}

/**
 * Importe `compte` et ferme la boîte de consentement, puis rend l'état du
 * stockage (IndexedDB compris) : chaque état mesuré repart de lui.
 *
 * ⚠️ Pas par le premier `input[type=file]` de l'accueil : c'est l'import RTA.
 * À l'ordinateur, bouton « Importer un compte » de la barre latérale ; au
 * téléphone la barre est repliée, on vise l'input `accept=json` du pied.
 * Un import refusé ne lève rien : on le détecte à l'écran.
 */
export async function importerCompte(page, base, compte) {
  await page.goto(`${base}/#/compte/runes`, { waitUntil: 'networkidle' });
  const bouton = page.getByRole('button', { name: 'Importer un compte', exact: true }).filter({ visible: true });
  if ((await bouton.count()) === 1) {
    const [selecteur] = await Promise.all([page.waitForEvent('filechooser'), bouton.click()]);
    await selecteur.setFiles(compte);
  } else {
    const champ = page.locator('input[type="file"][accept*="json"]').last();
    if ((await champ.count()) === 0) throw new ErreurBanc('import du compte : aucun champ d’import trouvé');
    await champ.setInputFiles(compte);
  }
  // Boîte de consentement (IndexedDB) au tout premier import : on l'attend,
  // bornée — son absence n'est pas une erreur, l'import refusé en est une.
  const garder = page.getByRole('button', { name: /Garder mes données/ });
  await garder.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await garder.isVisible().catch(() => false)) await garder.click();
  await page.waitForLoadState('networkidle');
  if (await compteAbsent(page)) throw new ErreurBanc('import du compte refusé : l’app n’a chargé aucune donnée');
  // L'app écrit le compte dans IndexedDB APRÈS le consentement, sans rien
  // afficher : un état pris trop tôt n'a que localStorage, et chaque état
  // mesuré ensuite s'ouvrirait sans compte. On attend un état du stockage qui
  // porte au moins un enregistrement IndexedDB et ne change plus pendant 1 s.
  const debut = Date.now();
  let precedent = null;
  let stableDepuis = Date.now();
  while (Date.now() - debut < 15000) {
    const etat = await page.context().storageState({ indexedDB: true });
    const texte = JSON.stringify(etat);
    const enregistrements = etat.origins.flatMap((o) => o.indexedDB ?? []).flatMap((d) => d.stores).reduce((n, s) => n + s.records.length, 0);
    if (texte !== precedent) {
      precedent = texte;
      stableDepuis = Date.now();
    } else if (enregistrements > 0 && Date.now() - stableDepuis >= 1000) {
      return etat;
    }
    await page.waitForTimeout(250);
  }
  throw new ErreurBanc('import du compte : le stockage du navigateur ne s’est pas stabilisé (IndexedDB vide ou en écriture)');
}

/** L'app dit qu'aucun compte n'est chargé (message de l'Optimizer et des écrans de compte). */
export async function compteAbsent(page) {
  return page.getByText('Aucune donnée de compte chargée').isVisible().catch(() => false);
}

/** Attend que la page se pose (voir `stabiliser`). */
export async function attendrePose(page) {
  return page.evaluate(stabiliser, { calmeMs: 400, maxMs: 6000 });
}

function decrireCible(c) {
  return `${c.role} « ${c.nom} »${c.etendu === undefined ? '' : c.etendu ? ' (déplié)' : ' (replié)'}${c.pres ? ` près de ${decrireCible(c.pres)}` : ''}`;
}

/**
 * L'élément unique et visible que désigne `cible`, ou une ErreurBanc.
 * Avec `pres`, parmi plusieurs candidats, celui dont le plus petit contenant
 * commun avec le repère est le plus profond ; une égalité est une ambiguïté.
 */
async function localiser(page, cible, attenteMs = 0) {
  const options = { name: cible.nom, exact: true, ...(cible.etendu === undefined ? {} : { expanded: cible.etendu }) };
  const loc = page.getByRole(cible.role, options).filter({ visible: true });
  if (attenteMs) await loc.first().waitFor({ state: 'visible', timeout: attenteMs }).catch(() => {});
  const n = await loc.count();
  if (n === 1 && !cible.pres) return loc.elementHandle({ timeout: 5000 });
  if (n === 0 || !cible.pres) throw new ErreurBanc(`${decrireCible(cible)} : ${n} élément(s) visible(s), 1 attendu`);
  const repere = await localiser(page, cible.pres);
  const candidats = await loc.elementHandles();
  const profondeurs = await page.evaluate(
    ([els, r]) =>
      els.map((e) => {
        let a = e;
        while (a && !a.contains(r)) a = a.parentElement;
        let d = 0;
        for (let x = a; x; x = x.parentElement) d++;
        return d;
      }),
    [candidats, repere],
  );
  const max = Math.max(...profondeurs);
  const retenus = profondeurs.flatMap((d, i) => (d === max ? [i] : []));
  if (retenus.length !== 1) throw new ErreurBanc(`${decrireCible(cible)} : ${retenus.length} candidat(s) à égalité près du repère`);
  return candidats[retenus[0]];
}

/**
 * Joue les étapes d'un état. Une cible doit désigner exactement un élément
 * visible : sinon l'état n'est pas atteint, avec la cause.
 */
export async function preparer(page, etapes) {
  const clicsRejoues = [];
  for (const etape of etapes) {
    if ('attendre' in etape) {
      await localiser(page, etape.attendre, 5000);
      continue;
    }
    if ('saisir' in etape) {
      const champ = await localiser(page, etape.saisir, 5000);
      await champ.fill(etape.texte, { timeout: 5000 });
      continue;
    }
    // L'élément est pris AVANT le clic : une tentative ratée peut faire
    // défiler la page, et un localisateur filtré sur « visible » ne plus le
    // retrouver.
    const element = await localiser(page, etape.cliquer, 5000);
    try {
      await element.click({ timeout: 5000 });
    } catch (err) {
      // ⚠️ Sur une page qui déborde, Chromium mobile élargit la fenêtre de
      // mise en page au-delà de la fenêtre visible, et Playwright juge la
      // cible « hors de la fenêtre » : le clic échoue à cause du défaut même
      // que le banc doit mesurer. Ce cas SEUL est rejoué par
      // `element.click()`, et compté ; tout autre échec rend l'état non
      // atteint. La postcondition de l'état dit ensuite si le rejeu a suffi.
      if (!/outside of the viewport/i.test(String(err?.message))) {
        throw new ErreurBanc(`cliquer ${decrireCible(etape.cliquer)} : clic impossible`);
      }
      await element.evaluate((el) => el.click());
      clicsRejoues.push(decrireCible(etape.cliquer));
    }
  }
  return { clicsRejoues };
}

/** La postcondition d'un état : chaque cible unique et visible. */
export async function verifierAtteint(page, cibles) {
  for (const cible of cibles) {
    try {
      await localiser(page, cible, 5000);
    } catch (err) {
      throw new ErreurBanc(`postcondition : ${err instanceof ErreurBanc ? err.message : decrireCible(cible)}`);
    }
  }
}

/** Attend que la page se pose, mesure, capture. */
export async function mesurerEtCapturer(page, capture) {
  const posee = await attendrePose(page);
  const mesure = await page.evaluate(mesurer);
  // ⚠️ La fenêtre seule, pas `fullPage` : Playwright agrandit alors la
  // fenêtre le temps de la capture, la page se recompose (éléments fixes au
  // milieu, panneau flottant repositionné en plein fondu) et l'image ne
  // montre plus ce qui a été mesuré.
  await page.screenshot({ path: capture });
  return { posee, mesure };
}
