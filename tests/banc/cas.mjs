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

// Exécutée dans la page : les attentes déclarées.
function lireAttentes() {
  const html = globalThis.document.documentElement;
  return {
    page: html.getAttribute('data-attendu-page'),
    elements: Array.from(globalThis.document.querySelectorAll('[data-attendu]')).map((el) => ({
      id: el.id,
      regles: el.getAttribute('data-attendu').split(',').map((s) => s.trim()).filter(Boolean).sort(),
    })),
  };
}

let code = 0;
let navigateur;
try {
  navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext(optionsFormat('telephone'));
  const page = await contexte.newPage();
  for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith('.html')).sort()) {
    await page.goto(pathToFileURL(join(DOSSIER, fichier)).href);
    const attentes = await page.evaluate(lireAttentes);
    const mesure = await page.evaluate(mesurer);
    const ecarts = [];
    if (attentes.page === 'oui' || attentes.page === 'non') {
      const attendu = attentes.page === 'oui';
      if (mesure.page.deborde !== attendu) ecarts.push(`page : ${mesure.page.deborde ? 'signalée' : 'non signalée'}, attendu ${attentes.page}`);
    }
    const lignes = [];
    for (const { id, regles } of attentes.elements) {
      if (!id) {
        ecarts.push('un élément porte data-attendu sans id');
        continue;
      }
      const vues = [...new Set(mesure.signalements.filter((s) => s.element.id === id).map((s) => s.regle))].sort();
      const conforme = vues.join(',') === regles.join(',');
      lignes.push(`    ${conforme ? 'ok' : 'KO'}  #${id} : attendu [${regles.join(', ') || 'aucune'}], signalé [${vues.join(', ') || 'aucune'}]`);
      if (!conforme) ecarts.push(`#${id}`);
    }
    console.log(
      `${ecarts.length ? 'KO' : 'ok'}  ${fichier} — page ${mesure.page.scrollWidth} / L ${mesure.largeur} (innerWidth ${mesure.innerWidth})` +
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
