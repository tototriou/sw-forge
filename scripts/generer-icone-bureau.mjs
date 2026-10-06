// `node scripts/generer-icone-bureau.mjs` — produit `bureau/icone.ico`, l'icône
// Windows de l'application de bureau, depuis `public/favicon.png` (512 × 512).
// Chantier application-bureau, lot 3. À relancer si le favicon change.
//
// ⚠️ Pourquoi pas la conversion d'electron-builder : elle écrit TOUTES les
// tailles en PNG, que Windows ne sait pas lire en petite taille (bureau, menu
// Démarrer, barre des tâches) : il affiche alors l'icône générique. Ici,
// comme dans `electron.exe` : 16 à 64 px en BMP
// 32 bits (alpha), 256 px en PNG.
//
// Le redimensionnement est celui de Chromium (`nativeImage`, qualité « best ») :
// le script se relance lui-même dans Electron.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(racine, 'public', 'favicon.png');
const SORTIE = join(racine, 'bureau', 'icone.ico');
const BMP = [16, 20, 24, 32, 40, 48, 64];
const PNG = [256];

if (!process.versions.electron) {
  // Sous Node : relance dans Electron (sans ELECTRON_RUN_AS_NODE, voir lib/electron.mjs).
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const electron = createRequire(import.meta.url)('electron');
  const r = spawnSync(electron, [fileURLToPath(import.meta.url)], { stdio: 'inherit', env });
  process.exit(r.status ?? 1);
}

// Une entrée BMP d'icône : BITMAPINFOHEADER, pixels BGRA de bas en haut,
// masque AND vide (la transparence est dans l'alpha).
function entreeBmp(bgra, taille) {
  const ligneMasque = Math.ceil(taille / 32) * 4;
  const pixels = taille * taille * 4;
  const b = Buffer.alloc(40 + pixels + ligneMasque * taille);
  b.writeUInt32LE(40, 0);
  b.writeInt32LE(taille, 4);
  b.writeInt32LE(taille * 2, 8); // image + masque
  b.writeUInt16LE(1, 12);
  b.writeUInt16LE(32, 14);
  b.writeUInt32LE(pixels + ligneMasque * taille, 20);
  // `toBitmap` rend un alpha PRÉMULTIPLIÉ (Skia) ; l'icône veut l'alpha
  // direct. Si une composante dépasse l'alpha, l'image ne l'était pas.
  const premultiplie = !bgra.some((v, i) => i % 4 !== 3 && v > bgra[i - (i % 4) + 3]);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const s = (y * taille + x) * 4;
      const d = 40 + ((taille - 1 - y) * taille + x) * 4;
      const a = bgra[s + 3];
      for (let c = 0; c < 3; c++) {
        const v = bgra[s + c];
        b[d + c] = premultiplie && a > 0 ? Math.min(255, Math.round((v * 255) / a)) : v;
      }
      b[d + 3] = a;
    }
  }
  return b;
}

// ⚠️ Pas de `await app.whenReady()` au niveau du module : Electron ne déclare
// l'app prête qu'une fois le module principal ESM évalué — attendre ici
// bloque pour toujours.
const { app, nativeImage } = await import('electron');
app.whenReady().then(generer);

function generer() {
  try {
    const image = nativeImage.createFromPath(SOURCE);
    if (image.isEmpty()) throw new Error(`illisible : ${SOURCE}`);
    const reduite = (t) => image.resize({ width: t, height: t, quality: 'best' });
    const entrees = [
      ...BMP.map((t) => ({ taille: t, donnees: entreeBmp(reduite(t).toBitmap(), t) })),
      ...PNG.map((t) => ({ taille: t, donnees: reduite(t).toPNG() })),
    ];

    // En-tête ICO, un répertoire de 16 octets par image, puis les images.
    const entete = Buffer.alloc(6 + 16 * entrees.length);
    entete.writeUInt16LE(1, 2);
    entete.writeUInt16LE(entrees.length, 4);
    let decalage = entete.length;
    entrees.forEach(({ taille, donnees }, i) => {
      const o = 6 + 16 * i;
      entete.writeUInt8(taille >= 256 ? 0 : taille, o); // 0 = 256
      entete.writeUInt8(taille >= 256 ? 0 : taille, o + 1);
      entete.writeUInt16LE(1, o + 4);
      entete.writeUInt16LE(32, o + 6);
      entete.writeUInt32LE(donnees.length, o + 8);
      entete.writeUInt32LE(decalage, o + 12);
      decalage += donnees.length;
    });
    writeFileSync(SORTIE, Buffer.concat([entete, ...entrees.map((e) => e.donnees)]));
    console.log(`${SORTIE} : ${entrees.map((e) => `${e.taille}${PNG.includes(e.taille) ? ' (PNG)' : ''}`).join(', ')} — ${decalage} octets`);
    app.exit(0);
  } catch (e) {
    console.error(e);
    app.exit(1);
  }
}
