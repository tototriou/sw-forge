#!/usr/bin/env node
// Ce que la moisson SWARFARM a CHANGÉ, en Markdown, pour le corps de la PR
// ouverte par le cron (voir .github/workflows/update-data.yml).
//
// ⚠️ **Une PR « les données ont changé » n'est pas relisable.** Le diff fait des
// milliers de lignes de JSON : personne n'y voit qu'une collaboration est
// arrivée, ni qu'une vitesse de base a bougé. Or c'est exactement ce qu'il faut
// traquer — un monstre neuf qu'un compte possède déjà, et surtout une VITESSE
// modifiée, qui déplace des ticks et peut casser un speed tune réglé au point
// près.
//
// Compare la version COMMITÉE de public/data/monsters.json à celle du disque.
// Sans argument, écrit le rapport sur la sortie standard ; avec, dans le fichier
// donné. `REF_AVANT` change la référence de comparaison (`HEAD` par défaut) —
// c'est ce qui permet de vérifier le rapport sur un changement déjà commité.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CHEMIN = 'public/data/monsters.json';
const ABSOLU = fileURLToPath(new URL('../public/data/monsters.json', import.meta.url));

function parId(json) {
  const m = new Map();
  for (const x of json.monsters ?? []) if (x.com2usId != null) m.set(x.com2usId, x);
  return m;
}

function ancien() {
  try {
    const ref = process.env.REF_AVANT || 'HEAD';
    return JSON.parse(
      execFileSync('git', ['show', `${ref}:${CHEMIN}`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    );
  } catch {
    // Premier passage, ou fichier absent de HEAD : tout est nouveau.
    return { monsters: [] };
  }
}

const avant = parId(ancien());
const apres = parId(JSON.parse(readFileSync(ABSOLU, 'utf8')));

const nom = (m) => `${m.name}${m.element ? ` (${m.element})` : ''}`;
const nouveaux = [...apres.values()].filter((m) => !avant.has(m.com2usId));
const disparus = [...avant.values()].filter((m) => !apres.has(m.com2usId));
// ⚠️ La VITESSE d'abord : c'est la seule stat dont un changement se répercute
// sur les ticks, donc sur des équipes déjà réglées.
const vitesses = [];
for (const [id, m] of apres) {
  const a = avant.get(id);
  if (!a) continue;
  const va = a.stats?.speed;
  const vb = m.stats?.speed;
  if (va != null && vb != null && va !== vb) vitesses.push({ m, va, vb });
}

const lignes = [];
lignes.push(
  'Rafraîchissement automatique de `public/data/` (monstres, compétences, liens de collaboration),',
  'par le cron hebdomadaire — voir `.github/workflows/update-data.yml`.',
  ''
);

if (vitesses.length > 0) {
  lignes.push(`## ⚠️ ${vitesses.length} vitesse(s) de base modifiée(s)`, '');
  lignes.push('Une vitesse qui bouge déplace des ticks : des équipes réglées au point près peuvent se décaler.', '');
  for (const { m, va, vb } of vitesses) lignes.push(`- **${nom(m)}** : ${va} → **${vb}**`);
  lignes.push('');
}

if (nouveaux.length > 0) {
  lignes.push(`## ${nouveaux.length} nouveau(x) monstre(s)`, '');
  for (const m of nouveaux) lignes.push(`- ${nom(m)} — VIT ${m.stats?.speed ?? '?'}`);
  lignes.push('');
}

if (disparus.length > 0) {
  // ⚠️ Un monstre qui DISPARAÎT est suspect : SWARFARM n'en retire pas, c'est
  // plus vraisemblablement une moisson partielle qui a franchi les gardes.
  lignes.push(`## ⚠️ ${disparus.length} monstre(s) disparu(s) — à vérifier`, '');
  for (const m of disparus) lignes.push(`- ${nom(m)}`);
  lignes.push('');
}

if (vitesses.length === 0 && nouveaux.length === 0 && disparus.length === 0) {
  lignes.push('Aucun monstre ajouté ni retiré, aucune vitesse de base modifiée — le reste des données a bougé (compétences, stats hors vitesse).', '');
}

lignes.push(`_${apres.size} monstres au total._`);

const sortie = lignes.join('\n');
const cible = process.argv[2];
if (cible) writeFileSync(cible, sortie);
else console.log(sortie);
