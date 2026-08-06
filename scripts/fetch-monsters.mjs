// Récupère les données de monstres depuis l'API SWARFARM.
// Exécuté par GitHub Actions (Node, pas de navigateur => pas de CORS).
// En cas d'échec (API down / schéma changé), on retombe sur un jeu de
// démonstration clairement labellisé, pour que le site reste déployable.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const API_BASE = 'https://swarfarm.com/api/v2/monsters/?limit=200';
const OUTPUT_PATH = new URL('../public/data/monsters.json', import.meta.url);
const MAX_PAGES = 30;

function normalizeElement(raw) {
  if (raw === undefined || raw === null) return 'unknown';
  const s = String(raw).toLowerCase();
  if (s.includes('fire')) return 'fire';
  if (s.includes('water')) return 'water';
  if (s.includes('wind')) return 'wind';
  if (s.includes('light')) return 'light';
  if (s.includes('dark')) return 'dark';
  return 'unknown';
}

function buildImageUrl(raw) {
  if (raw.image_filename) {
    return `https://swarfarm.com/static/herders/images/monsters/${raw.image_filename}`;
  }
  if (raw.image) return raw.image;
  if (raw.icon) return raw.icon;
  return null;
}

function normalizeMonster(raw, idx) {
  const stars = raw.base_stars ?? raw.natural_stars ?? raw.stars ?? raw.grade ?? null;
  return {
    id: raw.id ?? raw.com2us_id ?? idx,
    name: raw.name ?? raw.title ?? 'Inconnu',
    element: normalizeElement(raw.element),
    stars: typeof stars === 'number' ? stars : null,
    image: buildImageUrl(raw),
  };
}

async function fetchLive() {
  let url = API_BASE;
  let all = [];
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    console.log(`Fetch page ${pages + 1}: ${url}`);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'sky-arena-bestiary-ci' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    const json = await res.json();
    const arr = Array.isArray(json) ? json : json.results ?? [];
    all = all.concat(arr);
    url = json.next ?? null;
    pages++;
  }

  if (all.length === 0) throw new Error('Réponse vide de l\'API');
  return all.map(normalizeMonster);
}

function buildDemoData() {
  const demoNames = ['Voyageur', 'Gardien', 'Murmure', 'Éclat', 'Vagabond', 'Sentinelle', 'Écho', 'Fragment'];
  const out = [];
  let id = 1;
  for (const el of ['fire', 'water', 'wind', 'light', 'dark']) {
    for (let star = 1; star <= 5; star++) {
      const count = star >= 4 ? 2 : 3;
      for (let i = 0; i < count; i++) {
        out.push({
          id: id++,
          name: `${demoNames[(id + star) % demoNames.length]} ${star}★`,
          element: el,
          stars: star,
          image: null,
        });
      }
    }
  }
  return out;
}

async function main() {
  let monsters;
  let source = 'live';

  try {
    monsters = await fetchLive();
    console.log(`✅ ${monsters.length} monstres récupérés depuis SWARFARM.`);
  } catch (err) {
    console.error('⚠️  Échec de la récupération live, bascule en mode démo :', err.message);
    monsters = buildDemoData();
    source = 'demo';
  }

  const payload = {
    meta: {
      generated_at: new Date().toISOString(),
      source,
      count: monsters.length,
    },
    monsters,
  };

  await mkdir(dirname(OUTPUT_PATH.pathname), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`📝 Écrit dans ${OUTPUT_PATH.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
