// Relie chaque monstre de COLLABORATION à son équivalent Summoners War et
// écrit le lien dans `public/data/monsters.json` (champ `jumeauCollab`).
//
// ⚠️ **À relancer après `fetch-monsters` + `fetch-skills`**, dans cet ordre :
// l'appariement a besoin des stats (monsters.json) ET des compétences
// (data/skills/), donc des deux sorties à la fois.
//
// ⚠️ **Le lien est calculé ICI, pas dans l'app.** Le déduire au rendu
// supposerait de charger les 3 000 fiches de compétences à l'ouverture d'une
// page, alors qu'elles sont justement découpées pour n'être lues qu'à
// l'ouverture d'une fiche. La règle vit dans `src/lib/collabPairs.ts` et est
// vérifiée par `tests/collab-paires.test.ts` ; ce script ne fait que
// l'alimenter et écrire le résultat.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apparierCollabs } from '../src/lib/collabPairs.ts';

const MONSTERS_JSON = fileURLToPath(new URL('../public/data/monsters.json', import.meta.url));
const SKILLS_DIR = fileURLToPath(new URL('../public/data/skills/', import.meta.url));

// Signature de ce qu'un monstre EST et FAIT : élément, stats, lead, rareté, et
// le détail de ses compétences. Deux monstres qui la partagent sont le même
// monstre sous deux habillages.
//
// ⚠️ Les compétences comptent pour leur FORME (coefficient, rechargement,
// passif, effets), pas pour leur nom ni leur description — ceux-là suivent la
// licence : la compétence de Gojo ne s'appelle pas comme celle de Werner.
function signature(m) {
  const f = `${SKILLS_DIR}${m.com2usId}.json`;
  if (!existsSync(f)) return null;
  const fiche = JSON.parse(readFileSync(f, 'utf8'));
  const comps = (fiche.competences ?? [])
    .map((c) =>
      [
        c.formule,
        c.cooldown,
        c.passif,
        c.aoe,
        c.coups,
        (c.effets ?? []).map((e) => e.nom).join(','),
      ].join('|')
    )
    .join(';');
  return JSON.stringify([m.element, m.stats, m.leaderSkill, m.naturalStars, comps]);
}

async function main() {
  const brut = JSON.parse(await readFile(MONSTERS_JSON, 'utf8'));
  const liste = Array.isArray(brut) ? brut : (brut.monsters ?? []);

  // ⚠️ On n'apparie que les formes ÉVEILLÉES et JOUABLES (nat4+, suffixe 11..15).
  // Les formes non éveillées partagent la même signature que leur éveillée et
  // pollueraient les groupes ; les entrées techniques (tours, cristaux, boss)
  // n'ont ni collab ni intérêt ici.
  const candidats = [];
  for (const m of liste) {
    if (m.com2usId == null || m.stars !== 6 || (m.naturalStars ?? 0) < 4) continue;
    const suffixe = m.com2usId % 100;
    if (suffixe < 11 || suffixe > 15) continue;
    const sig = signature(m);
    if (sig == null) continue;
    candidats.push({ com2usId: m.com2usId, name: m.name, image: m.image ?? null, signature: sig });
  }

  const paires = apparierCollabs(candidats);

  // Le lien est écrit des DEUX côtés : on ouvre aussi bien la carte de Werner
  // que celle de Gojo, et l'affichage doit valoir dans les deux sens.
  const jumeau = new Map();
  for (const p of paires) {
    jumeau.set(p.a, p.b);
    jumeau.set(p.b, p.a);
  }

  let poses = 0;
  for (const m of liste) {
    const j = m.com2usId != null ? jumeau.get(m.com2usId) : undefined;
    if (j != null) {
      m.jumeauCollab = j;
      poses++;
    } else if ('jumeauCollab' in m) {
      // Une paire qui disparaît doit disparaître du fichier : sinon l'app
      // continuerait d'afficher un lien que la règle ne produit plus.
      delete m.jumeauCollab;
    }
  }

  const sortie = Array.isArray(brut) ? liste : { ...brut, monsters: liste };
  // ⚠️ Même mise en forme que `fetch-monsters` (indentation 2) : sans elle, le
  // fichier repasse sur une seule ligne et le moindre changement produit un diff
  // de 76 000 lignes, illisible en revue.
  await writeFile(MONSTERS_JSON, JSON.stringify(sortie, null, 2), 'utf8');

  console.log(`${paires.length} paires de collaboration · ${poses} monstres liés.`);
  const apercu = paires.slice(0, 5).map((p) => {
    const a = liste.find((m) => m.com2usId === p.a);
    const b = liste.find((m) => m.com2usId === p.b);
    return `${a?.name} = ${b?.name}`;
  });
  if (apercu.length) console.log('  ex. ' + apercu.join(' · '));
}

main().catch((e) => {
  console.error('Échec :', e.message);
  process.exit(1);
});
