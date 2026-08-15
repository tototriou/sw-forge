// Relie chaque monstre de COLLABORATION à son équivalent Summoners War et
// écrit le lien dans `public/data/monsters.json` (champ `jumeauCollab`).
//
// ⚠️ **Le lien est DONNÉ par l'API**, pas déduit : un monstre dont le
// `skill_group_id` diffère de son `family_id` emprunte les compétences d'un
// autre — Werner (famille 30900) porte le groupe 30300, celui de Satoru Gojo.
// La règle vit dans `src/lib/collabPairs.ts`, vérifiée par
// `tests/collab-paires.test.ts` ; ce script ne fait que l'alimenter et écrire.
//
// ⚠️ **À relancer après `fetch-monsters`**, qui capture les deux champs.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { apparierCollabs } from '../src/lib/collabPairs.ts';

const MONSTERS_JSON = fileURLToPath(new URL('../public/data/monsters.json', import.meta.url));

async function main() {
  const brut = JSON.parse(await readFile(MONSTERS_JSON, 'utf8'));
  const liste = Array.isArray(brut) ? brut : (brut.monsters ?? []);

  // ⚠️ **Les formes ÉVEILLÉES seulement.** Les entrées non éveillées d'une
  // collaboration portent des noms COREENS chez SWARFARM (« 에이보르(물) »
  // pour Eivor eau) : appariées, elles produisaient des cartes titrées
  // « Mercenary Queen, 에이보르(물) ». Et elles ne servent à rien ici — on ne
  // joue que des monstres éveillés, et la box n'en contient aucune (elle filtre
  // sur `class === 6`).
  //
  // L'éveil se lit `stars > naturalStars` : un nat4 éveillé plafonne à 5★, un
  // test sur 6★ écarterait la moitié des candidats.
  const candidats = liste
    .filter((m) => m.com2usId != null)
    .filter((m) => m.stars != null && m.naturalStars != null && m.stars > m.naturalStars)
    .map((m) => ({
      com2usId: m.com2usId,
      familyId: m.familyId ?? null,
      skillGroupId: m.skillGroupId ?? null,
      // Élément + stade d'éveil : `30311` → 11. Deux monstres ne s'apparient
      // qu'à suffixe égal — le Gojo eau avec le Werner eau.
      suffixe: m.com2usId % 100,
      // Ce que le monstre EST : rareté naturelle et stats de base. Un monstre
      // qui EMPRUNTE les compétences d'un autre (Fairy Queen à Fairy) n'a pas
      // les mêmes ; une collab, qui est un reskin, a exactement les mêmes.
      profil: JSON.stringify([m.naturalStars ?? null, m.stats ?? null]),
    }));

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
