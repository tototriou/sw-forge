// Cas de la règle de mesure : chaque page de tests/banc/cas/ déclare ce que la
// règle (tête de mesure.ts) doit y signaler, et ce script le vérifie au format
// téléphone (360 px, tactile — celui où un débordement se produit).
//
//   node tests/banc/cas.mjs
//
// Dans une page : `data-attendu="contenu,geometrie"` sur un élément nomme les
// règles qui doivent le signaler, ni plus ni moins (`""` : aucune) ;
// `data-attendu-page="oui|non"` sur `<html>` dit si la règle « page » doit
// conclure au débordement. Un élément sans `data-attendu` n'est pas vérifié.
// `data-attendu-depassement="<px>"` exige en plus que son signalement
// « contenu » retienne exactement ce dépassement (`depassement`, mesure.ts).
// `data-attendu-avec="<id>,…"` exige que ses signalements « chevauchement » et
// « voisins » (ceux qui portent `avec`) nomment exactement ces éléments coupés,
// ni plus ni moins ; `data-attendu-aire="<px²>,…"`, dans le même ordre, l'aire
// coupée de chacun. Une paire « voisins » se déclare sur le premier frère dans
// l'ordre du document (celui qui la porte), l'autre dans `data-attendu-avec`.
//
// Sur chaque page, sans attribut : la mesure rend la page telle quelle —
// l'attribut `style` de chaque élément identique, présence comprise, et
// aucune animation (transition comprise) de plus qu'avant (mesure.ts, second
// passage).
//
// Codes : 0 tous les cas conformes ; 1 un cas non conforme ; 2 le script n'a
// pas pu mesurer.

import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { lancerNavigateur, optionsFormat } from './session.mjs';
import { mesurer } from './mesure.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const DOSSIER = join(ICI, 'cas');

// Ces attentes sont obligatoires : un attribut retiré de ces cas ne doit
// pas transformer la vérification de l'exception en page sans contrôle.
const ATTENDUS_ROUE = {
  'roue-cadre-pivote.html': { roue: [], case: [], cible: [], cadre: [], icone: [] },
  'roue-transformation-sortante.html': {
    'roue-sortante': ['contenu'], 'case-sortante': ['contenu'], 'cible-sortante': ['contenu'],
    'roue-mixte': [], 'case-mixte': ['contenu'], 'cible-mixte': ['contenu'],
  },
};

// Exécutée dans la page : les attentes déclarées.
function lireAttentes() {
  const html = globalThis.document.documentElement;
  return {
    page: html.getAttribute('data-attendu-page'),
    elements: Array.from(globalThis.document.querySelectorAll('[data-attendu]')).map((el) => ({
      id: el.id,
      regles: el.getAttribute('data-attendu').split(',').map((s) => s.trim()).filter(Boolean).sort(),
      depassement: el.getAttribute('data-attendu-depassement'),
      avec: el.getAttribute('data-attendu-avec'),
      aire: el.getAttribute('data-attendu-aire'),
    })),
  };
}

// Exécutée dans la page : ce que la mesure doit rendre tel quel.
function lireEtat() {
  return {
    styles: Array.from(globalThis.document.querySelectorAll('*')).map((el) => [
      el.id || `${el.tagName.toLowerCase()}#${Array.prototype.indexOf.call(el.parentElement?.children ?? [], el)}`,
      el.getAttribute('style'),
    ]),
    animations: globalThis.document.getAnimations().length,
  };
}

let code = 0;
let navigateur;
try {
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.html')).sort();
  for (const fichier of Object.keys(ATTENDUS_ROUE)) {
    if (!fichiers.includes(fichier)) throw new Error(`cas obligatoire absent : ${fichier}`);
  }
  navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext(optionsFormat('telephone'));
  const page = await contexte.newPage();
  for (const fichier of fichiers) {
    await page.goto(pathToFileURL(join(DOSSIER, fichier)).href);
    const attentes = await page.evaluate(lireAttentes);
    const avant = await page.evaluate(lireEtat);
    const mesure = await page.evaluate(mesurer, { detail: true });
    const apres = await page.evaluate(lireEtat);
    const ecarts = [];
    for (const [id, regles] of Object.entries(ATTENDUS_ROUE[fichier] ?? {})) {
      const declare = attentes.elements.find((e) => e.id === id);
      if (!declare || declare.regles.join(',') !== regles.join(',')) ecarts.push(`attente obligatoire absente ou modifiée : #${id}`);
    }
    if (avant.styles.length !== apres.styles.length) ecarts.push(`état rendu : ${avant.styles.length} éléments avant, ${apres.styles.length} après`);
    avant.styles.forEach(([qui, s], i) => {
      const t = apres.styles[i]?.[1];
      if (t !== s) ecarts.push(`état rendu : style de ${qui} ${JSON.stringify(s)} → ${JSON.stringify(t ?? null)}`);
    });
    if (apres.animations > avant.animations) ecarts.push(`état rendu : ${apres.animations - avant.animations} animation(s) lancée(s) par la mesure`);
    if (attentes.page === 'oui' || attentes.page === 'non') {
      const attendu = attentes.page === 'oui';
      if (mesure.page.deborde !== attendu) ecarts.push(`page : ${mesure.page.deborde ? 'signalée' : 'non signalée'}, attendu ${attentes.page}`);
    }
    const lignes = [];
    for (const { id, regles, depassement, avec, aire } of attentes.elements) {
      if (!id) {
        ecarts.push('un élément porte data-attendu sans id');
        continue;
      }
      const siens = mesure.signalements.filter((s) => s.element.id === id);
      const vues = [...new Set(siens.map((s) => s.regle))].sort();
      let conforme = vues.join(',') === regles.join(',');
      let px = '';
      if (depassement !== null) {
        const vu = siens.find((s) => s.regle === 'contenu')?.depassement;
        conforme &&= vu === Number(depassement);
        px = ` ; dépassement attendu ${depassement} px, retenu ${vu ?? 'aucun'}`;
      }
      if (avec !== null) {
        const ids = avec.split(',').map((s) => s.trim()).filter(Boolean);
        const aires = aire === null ? null : aire.split(',').map((s) => Number(s.trim()));
        const attendus = ids.map((i, k) => `${i}${aires ? ` ${aires[k]}` : ''}`).sort();
        const coupes = siens.filter((s) => s.regle === 'chevauchement' || s.regle === 'voisins');
        const vus = coupes.map((s) => `${s.avec?.id ?? '?'}${aires ? ` ${s.aire}` : ''}`).sort();
        conforme &&= vus.join(',') === attendus.join(',');
        px += ` ; coupe attendue [${attendus.join(', ')}], vue [${coupes.map((s) => `${s.avec?.id ?? '?'} ${s.aire} px²`).join(', ')}]`;
      }
      lignes.push(`    ${conforme ? 'ok' : 'KO'}  #${id} : attendu [${regles.join(', ') || 'aucune'}], signalé [${vues.join(', ') || 'aucune'}]${px}`);
      if (!conforme) ecarts.push(`#${id}`);
    }
    console.log(
      `${ecarts.length ? 'KO' : 'ok'}  ${fichier} — page ${mesure.page.scrollWidth}` +
        `${mesure.page.relue !== undefined ? ` (relue ${mesure.page.relue})` : ''} / L ${mesure.largeur} (innerWidth ${mesure.innerWidth})` +
        ` (attendu ${attentes.page ?? 'non vérifié'}) ; ${mesure.signalements.length} signalement(s) en tout`,
    );
    for (const l of lignes) console.log(l);
    for (const e of ecarts.filter((e) => !e.startsWith('#'))) console.log(`    KO  ${e}`);
    if (ecarts.length) code = 1;
  }
  await contexte.close();
} catch (err) {
  console.error(`cas : impossible de mesurer — ${err?.message ?? err}`);
  code = 2;
} finally {
  if (navigateur) await navigateur.close().catch(() => {});
}
console.log(`code ${code}`);
process.exitCode = code;
