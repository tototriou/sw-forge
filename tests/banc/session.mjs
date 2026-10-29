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
import { fileURLToPath } from 'url';
import { FORMATS } from './ecrans.ts';
import { medias, mesurer, stabiliser } from './mesure.ts';

/* global document, getComputedStyle, window */ // Le contrôle géométrique s'exécute dans page.evaluate.

export { medias };

// Conteneur Linux (claude.ai/code) : Chromium y est préinstallé pour une
// autre version de Playwright. Même repli que la session du skill.
const CHROMIUM_PREINSTALLE = '/opt/pw-browsers/chromium';

// Les signaux sont au lanceur : il ferme le navigateur dans son propre
// nettoyage, et Playwright ne doit pas le fermer avant lui.
const SANS_SIGNAUX = { handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false, timeout: 60000 };

export async function lancerNavigateur() {
  return chromium.launch(SANS_SIGNAUX).catch((err) => {
    if (!existsSync(CHROMIUM_PREINSTALLE)) throw err;
    return chromium.launch({ ...SANS_SIGNAUX, executablePath: CHROMIUM_PREINSTALLE });
  });
}

/** Options du contexte Playwright d'un format. */
export function optionsFormat(format) {
  const f = typeof format === 'string' ? FORMATS[format] : format;
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
  return borne(page.evaluate(stabiliser, { calmeMs: 400, maxMs: 6000, policesMs: 5000 }), 20000, 'attente de la page');
}

/** Une promesse bornée : au-delà de `ms`, une ErreurBanc avec `cause`. */
export function borne(promesse, ms, cause) {
  let minuterie;
  const delai = new Promise((_, ko) => {
    minuterie = setTimeout(() => ko(new ErreurBanc(`${cause} : délai de ${ms / 1000} s dépassé`)), ms);
    minuterie.unref?.();
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuterie));
}

function decrireCible(c) {
  return `${c.role} « ${c.nom} »${c.dans ? ` dans ${c.dans}` : ''}${c.etendu === undefined ? '' : c.etendu ? ' (déplié)' : ' (replié)'}${c.pres ? ` près de ${decrireCible(c.pres)}` : ''}`;
}

/**
 * L'élément unique et visible que désigne `cible`, ou une ErreurBanc.
 * Avec `pres`, parmi plusieurs candidats, celui dont le plus petit contenant
 * commun avec le repère est le plus profond ; une égalité est une ambiguïté.
 */
async function localiser(page, cible, attenteMs = 0) {
  const contenant = cible.dans ? page.locator(cible.dans).filter({ visible: true }) : page;
  if (cible.dans) {
    if (attenteMs) await contenant.first().waitFor({ state: 'visible', timeout: attenteMs }).catch(() => {});
    const n = await contenant.count();
    if (n !== 1) throw new ErreurBanc(`${decrireCible(cible)} : ${n} contenant(s) visible(s), 1 attendu`);
  }
  const options = { name: cible.nom, exact: true, ...(cible.etendu === undefined ? {} : { expanded: cible.etendu }) };
  const loc = (cible.role === 'repere' ? contenant.locator(cible.nom) : cible.role === 'texte' ? contenant.getByText(cible.nom, { exact: true }) : contenant.getByRole(cible.role, options)).filter({ visible: true });
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
 * Charge un fichier de `tests/fixtures/` par le bouton d'import de l'interface
 * (sélecteur de fichier), puis attend le compte rendu de l'app : « … importés. »
 * Un import refusé n'affiche pas ce compte rendu mais un rapport d'erreurs : on
 * lit alors la cause, plutôt que de mesurer l'écran resté vide.
 */
async function importerFichier(page, cible, fichier, confirme) {
  if (!/^[\w.-]+$/.test(fichier)) throw new ErreurBanc(`importer : nom de fichier invalide (${fichier})`);
  const chemin = fileURLToPath(new URL(`../fixtures/${fichier}`, import.meta.url));
  if (!existsSync(chemin)) throw new ErreurBanc(`importer : fichier absent (tests/fixtures/${fichier})`);
  const bouton = await localiser(page, cible, 5000);
  const [selecteur] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), bouton.click({ timeout: 5000 })]).catch(() => {
    throw new ErreurBanc(`importer ${decrireCible(cible)} : aucun sélecteur de fichier ouvert`);
  });
  await selecteur.setFiles(chemin);
  if (confirme) {
    // Chaque import a son propre compte rendu ; une recette ne dit pas
    // « importés. ». Sans confirmation exacte, l'état reste non atteint.
    try {
      await localiser(page, confirme, 8000);
      return;
    } catch {
      const refus = page.getByText(/^Import refusé/).filter({ visible: true });
      const cause = await refus.first().innerText({ timeout: 1000 }).catch(() => null);
      throw new ErreurBanc(`importer ${decrireCible(cible)} : ${cause ? cause.replace(/\s+/g, ' ').slice(0, 200) : `confirmation absente (${decrireCible(confirme)})`}`);
    }
  }
  const compteRendu = page.getByText(/importés\./).filter({ visible: true });
  const refus = page.getByText(/Import refusé/).filter({ visible: true });
  const issue = await Promise.race([
    compteRendu.first().waitFor({ state: 'visible', timeout: 8000 }).then(() => 'ok'),
    refus.first().waitFor({ state: 'visible', timeout: 8000 }).then(() => 'refus'),
  ]).catch(() => 'rien');
  if (issue === 'ok') return;
  const cause = issue === 'refus' ? String(await refus.first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]').innerText().catch(() => 'rapport illisible')).replace(/\s+/g, ' ').slice(0, 200) : 'aucun compte rendu de l’app';
  throw new ErreurBanc(`importer ${decrireCible(cible)} : import refusé (${cause})`);
}

/**
 * Joue les étapes d'un état. Une cible doit désigner exactement un élément
 * visible : sinon l'état n'est pas atteint, avec la cause.
 */
export async function preparer(page, etapes) {
  const clicsRejoues = [];
  for (const etape of etapes) {
    if ('largeurOptimizer' in etape) {
      for (let essai = 0; essai < 4; essai++) {
        await attendrePose(page);
        const largeur = await page.locator('[data-configuration]').evaluate(el => el.getBoundingClientRect().width);
        const ecart = etape.largeurOptimizer - largeur;
        if (Math.abs(ecart) < 0.5) break;
        const volet = await page.locator('[data-configuration]').evaluate(el => !!el.closest('[data-volet]'));
        const fenetre = page.viewportSize();
        await page.setViewportSize({ ...fenetre, width: Math.round(fenetre.width + ecart * (volet ? 2 : 1)) });
      }
      const largeur = await page.locator('[data-configuration]').evaluate(el => el.getBoundingClientRect().width);
      if (Math.abs(largeur - etape.largeurOptimizer) >= 0.5) throw new ErreurBanc(`conteneur : ${largeur} px au lieu de ${etape.largeurOptimizer}`);
      continue;
    }
    if ('attendre' in etape) {
      await localiser(page, etape.attendre, etape.delaiMs ?? 5000);
      continue;
    }
    if ('saisir' in etape) {
      const champ = await localiser(page, etape.saisir, 5000);
      await champ.fill(etape.texte, { timeout: 5000 });
      continue;
    }
    if ('montrer' in etape) {
      const element = await localiser(page, etape.montrer, 5000);
      await element.scrollIntoViewIfNeeded({ timeout: 5000 });
      continue;
    }
    if ('importer' in etape) {
      await importerFichier(page, etape.importer, etape.fichier, etape.confirme);
      continue;
    }
    // L'élément est pris AVANT le clic : une tentative ratée peut faire
    // défiler la page, et un localisateur filtré sur « visible » ne plus le
    // retrouver.
    if (etape.sinonPresent && await page.getByRole(etape.cliquer.role, { name: etape.cliquer.nom, exact: true }).count() === 0) {
      await localiser(page, etape.sinonPresent, 5000);
      continue;
    }
    const element = await localiser(page, etape.cliquer, 5000);
    const estOnglet = etape.cliquer.role === 'tab';
    if (estOnglet) await element.scrollIntoViewIfNeeded();
    const avantOnglet = estOnglet ? await element.boundingBox() : null;
    if (etape.siPresse !== undefined) {
      const presse = await element.getAttribute('aria-pressed');
      if (presse !== 'true' && presse !== 'false') throw new ErreurBanc(`cliquer ${decrireCible(etape.cliquer)} : aria-pressed absent`);
      if ((presse === 'true') !== etape.siPresse) continue;
    }
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
    if (estOnglet) {
      await attendrePose(page);
      const apres = await element.boundingBox();
      if (!avantOnglet || !apres || Math.abs(avantOnglet.x - apres.x) > 0.5 || Math.abs(avantOnglet.y - apres.y) > 0.5) {
        throw new ErreurBanc(`onglet déplacé au clic : ${decrireCible(etape.cliquer)}`);
      }
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

/** Configuration observée : ni une taille mal visée ni une colonne rognée ne font preuve. */
export async function verifierOptimizer(page, attendu, guidageSet = false) {
  if (!attendu) return null;
  const observe = await page.evaluate(() => {
    const racine = document.querySelector('[data-configuration]');
    if (!racine) return null;
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, droite: r.right, bas: r.bottom, largeur: r.width, hauteur: r.height };
    };
    const fiche = racine.querySelector('[data-fiche-optimizer] > div');
    const stats = rect(fiche?.children[0]), equipement = rect(fiche?.children[1]);
    const onglets = [...racine.querySelectorAll('[role="tablist"][aria-label="Réglages de recherche"] [role="tab"]')];
    const monstre = racine.querySelector('[data-zone="monstre"]');
    const pile = racine.querySelector('[data-zone="pile-droite"]');
    const colonnes = [...racine.querySelectorAll('[data-colonne]')].map(el => ({
      nom: el.dataset.colonne, ...rect(el), contenu: el.scrollWidth, interieur: el.clientWidth,
      // Le premier élément qui dépasse le bord droit : de quoi corriger sans rejouer.
      depasse: (() => {
        const bord = el.getBoundingClientRect().right;
        const fautif = [...el.querySelectorAll('*')].find(e => e.getBoundingClientRect().right > bord + 1);
        return fautif ? `${fautif.tagName.toLowerCase()}.${String(fautif.className).slice(0, 80)} « ${(fautif.textContent ?? '').trim().slice(0, 40)} »` : null;
      })(),
    }));
    const setsVisibles = [...racine.querySelectorAll('[data-set-optimizer]')].filter(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return !el.closest('[aria-hidden="true"], [hidden], [inert]')
        && s.visibility === 'visible' && s.display !== 'none' && r.width > 0 && r.height > 0;
    });
    const set = setsVisibles.length === 1 ? setsVisibles[0] : null;
    const bouton = racine.querySelector('[data-zone="barre"] [role="group"] button:not([aria-hidden="true"])');
    const invalide = !!set?.querySelector('.border-bad');
    // La cible du guidage est la zone surlignée, pas ses copies de mesure.
    const setRect = rect(set?.querySelector('.border-bad') ?? set);
    let surfaceSet = null;
    for (let p = set?.parentElement; p && racine.contains(p); p = p.parentElement) {
      if (['auto', 'scroll'].includes(getComputedStyle(p).overflowY)) { surfaceSet = p; break; }
    }
    // Le client du scroller, rogné par la fenêtre et chaque ancêtre qui
    // masque un axe : le contenu naturel d'une colonne n'est pas sa vue.
    const client = el => {
      const r = el.getBoundingClientRect();
      const x = r.left + el.clientLeft, y = r.top + el.clientTop;
      return { x, y, droite: x + el.clientWidth, bas: y + el.clientHeight };
    };
    let surfaceVisible = null;
    if (surfaceSet) {
      const r = client(surfaceSet);
      surfaceVisible = { x: Math.max(0, r.x), y: Math.max(0, r.y),
        droite: Math.min(window.innerWidth, r.droite), bas: Math.min(window.innerHeight, r.bas) };
      for (let p = surfaceSet.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p), cadre = client(p);
        if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) {
          surfaceVisible.x = Math.max(surfaceVisible.x, cadre.x);
          surfaceVisible.droite = Math.min(surfaceVisible.droite, cadre.droite);
        }
        if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowY)) {
          surfaceVisible.y = Math.max(surfaceVisible.y, cadre.y);
          surfaceVisible.bas = Math.min(surfaceVisible.bas, cadre.bas);
        }
      }
    }
    const scrollers = [...racine.querySelectorAll('[data-zone="monstre"], [data-colonne], [data-zone="resultats"], [data-zone="pile-droite"]')]
      .filter(el => getComputedStyle(el).overflowY === 'auto');
    return {
      largeur: racine.getBoundingClientRect().width, configuration: racine.dataset.configuration,
      groupe: onglets.map(el => el.querySelector('[data-libelle-onglet]').textContent.trim()),
      actif: onglets.find(el => el.getAttribute('aria-selected') === 'true')?.querySelector('[data-libelle-onglet]').textContent.trim() ?? null,
      fiche: stats && equipement ? (equipement.y >= stats.bas - 1 ? 'repliee' : 'depliee') : null,
      exemplaireDansMonstre: !!monstre?.querySelector('[data-zone="exemplaire"]'),
      set: set?.dataset.setOptimizer, nombreSetsVisibles: setsVisibles.length, setInvalide: invalide,
      setRect, surfaceSet: surfaceSet?.dataset.zone ?? surfaceSet?.dataset.colonne ?? null, surfaceVisible,
      setGuideVisible: !invalide || !!(setRect && surfaceVisible
        && setRect.hauteur > 0 && setRect.largeur > 0
        && setRect.y >= surfaceVisible.y - 1 && setRect.bas <= surfaceVisible.bas + 1
        && setRect.x >= surfaceVisible.x - 1 && setRect.droite <= surfaceVisible.droite + 1),
      colonnes, monstre: rect(monstre), pile: rect(pile), bouton: rect(bouton),
      volet: !!racine.closest('[data-volet]'), volets: [...document.querySelectorAll('[data-volet]')].map(rect),
      pageFenetre: racine.hasAttribute('data-page-fenetre'),
      debordement: racine.scrollWidth > racine.clientWidth + 1,
      scrollers: scrollers.map(el => ({ hauteur: el.clientHeight, contenu: el.scrollHeight, confinement: getComputedStyle(el).overscrollBehaviorY })),
      cartes: racine.querySelectorAll('[data-carte-resultat]').length,
    };
  });
  const refuser = cause => { throw new ErreurBanc(`configuration Optimizer : ${cause}`); };
  if (!observe) refuser('racine de bureau absente');
  if (observe.nombreSetsVisibles > 1) refuser('plusieurs sets visibles : cible du guidage ambiguë');
  const [min, max] = attendu.conteneur;
  if (observe.largeur < min - 0.5 || observe.largeur >= max - 0.5) refuser(`conteneur ${observe.largeur} px hors [${min}, ${max}[`);
  if (observe.configuration !== attendu.configuration) refuser(`${observe.configuration} au lieu de ${attendu.configuration}`);
  if (JSON.stringify(observe.groupe) !== JSON.stringify(attendu.groupe)) refuser(`onglets ${JSON.stringify(observe.groupe)} au lieu de ${JSON.stringify(attendu.groupe)}`);
  const { configuration } = attendu;
  // La fiche se lit dépliée, comme une carte de résultat : équipement à côté des stats.
  if (observe.fiche !== 'depliee' || !observe.exemplaireDansMonstre) refuser('Exemplaire doit être déplié dans Monstre');
  if (attendu.set && observe.set && observe.set !== attendu.set) refuser(`set ${observe.set} au lieu de ${attendu.set}`);
  if (!observe.setGuideVisible || (guidageSet && (observe.nombreSetsVisibles !== 1 || !observe.setInvalide))) {
    refuser(`le guidage sans set ne montre pas le set (${JSON.stringify({ nombre: observe.nombreSetsVisibles, surligne: observe.setInvalide, set: observe.setRect, surface: observe.surfaceSet, visible: observe.surfaceVisible })})`);
  }
  if (!observe.pageFenetre || observe.debordement) refuser('page hors hauteur de fenêtre ou débordement horizontal');
  if (observe.scrollers.some(s => s.confinement !== 'contain')) refuser('défilement non confiné');
  if (observe.volet !== !!attendu.volet) refuser('présence du volet différente de celle demandée');
  if (attendu.volet && (observe.volets.length !== 2 || Math.abs(observe.volets[0].largeur - observe.volets[1].largeur) > 1)) refuser('les deux volets ne sont pas à parts égales');
  const noms = observe.colonnes.map(c => c.nom);
  if (new Set(noms).size !== noms.length) refuser('un réglage est monté deux fois');
  const deborde = observe.colonnes.find(c => c.contenu > c.interieur + 1);
  if (deborde) refuser(`une colonne déborde horizontalement (${deborde.nom} : ${deborde.depasse ?? 'élément non trouvé'})`);
  if (configuration === 'colonnes' && JSON.stringify(noms) !== JSON.stringify(['criteres', 'artefacts', 'complements'])) refuser('les trois colonnes de réglages ne sont pas visibles');
  if (configuration === 'deux-piles' && (!observe.pile || !observe.monstre || Math.abs(observe.pile.y - observe.monstre.y) > 1 || observe.pile.x <= observe.monstre.x)) refuser('les deux piles ne sont pas côte à côte');
  return observe;
}

/**
 * Attend que la page se pose, mesure, capture. `detail` : garder `id` et
 * classes dans les descriptions (compte d'exemple seulement). Rend l'image
 * en mémoire : le lanceur l'écrit lui-même, en création exclusive.
 */
export async function mesurerEtCapturer(page, { detail }) {
  const posee = await attendrePose(page);
  const mesure = await borne(page.evaluate(mesurer, { detail }), 30000, 'mesure');
  // ⚠️ La fenêtre seule, pas `fullPage` : Playwright agrandit alors la
  // fenêtre le temps de la capture, la page se recompose (éléments fixes au
  // milieu, panneau flottant repositionné en plein fondu) et l'image ne
  // montre plus ce qui a été mesuré.
  const image = await page.screenshot({ timeout: 15000 });
  return { posee, mesure, image };
}
