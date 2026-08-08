// Récupère les données de monstres depuis l'API SWARFARM.
// Exécuté par GitHub Actions (Node, pas de navigateur => pas de CORS).
// En cas d'échec (API down / schéma changé), on retombe sur un jeu de
// démonstration clairement labellisé, pour que le site reste déployable.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://swarfarm.com/api/v2/monsters/?limit=200';
// `fileURLToPath` (et non `.pathname`) : sous Windows, `.pathname` donne
// « /C:/… » que `mkdir` interprète en « C:\C:\… ».
const OUTPUT_PATH = fileURLToPath(new URL('../public/data/monsters.json', import.meta.url));
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

// Normalise un nombre (accepte number ou string numérique), sinon null.
function num(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (typeof c === 'string' && c.trim() !== '' && Number.isFinite(Number(c))) {
      return Number(c);
    }
  }
  return null;
}

// ⚠️ PV/ATQ/DEF : on prend `max_lvl_*`, c'est-à-dire la valeur du monstre
// **6★ niveau max, nu**. `base_*` est la valeur à son GRADE D'INVOCATION
// (ex. Trevor nat4/base5 : base_hp 7380 en 5★ contre max_lvl_hp 10050 en 6★) —
// inutilisable comme base de calcul. Pour un monstre déjà base★6, les deux
// champs sont identiques. Ces valeurs correspondent au `con × 15` des exports
// SWEX, ce qui rend les deux sources cohérentes.
function normalizeStats(raw) {
  return {
    hp: num(raw.max_lvl_hp, raw.base_hp, raw.hp),
    attack: num(raw.max_lvl_attack, raw.base_attack, raw.attack),
    defense: num(raw.max_lvl_defense, raw.base_defense, raw.defense),
    // La vitesse ne dépend pas du niveau/étoiles dans SW : elle est fixe.
    speed: num(raw.speed, raw.base_speed, raw.spd),
    critRate: num(raw.crit_rate, raw.critical_rate, raw.cri_rate),
    critDamage: num(raw.crit_damage, raw.critical_damage, raw.cri_dmg),
    resistance: num(raw.resistance, raw.res),
    accuracy: num(raw.accuracy, raw.acc),
  };
}

// Leader skill : { stat, amount, area, element }. element=null => toutes cibles.
function normalizeLeaderSkill(raw) {
  const ls = raw && raw.leader_skill;
  if (!ls || typeof ls !== 'object') return null;
  const amount = num(ls.amount);
  if (amount === null) return null;
  return {
    stat: ls.attribute ?? null,
    amount,
    area: ls.area ?? 'General',
    element: ls.element ? normalizeElement(ls.element) : null,
  };
}

function normalizeMonster(raw, idx) {
  // `stars` = grade obtenable (base_stars) — conservé tel quel pour le Bestiaire.
  const stars = raw.base_stars ?? raw.natural_stars ?? raw.stars ?? raw.grade ?? null;
  // `naturalStars` = rareté naturelle réelle (nat 1..5), distincte de base_stars
  // pour les monstres à second éveil (ex. Tractor nat3 → base_stars 6).
  const natural = raw.natural_stars ?? raw.base_stars ?? null;
  return {
    id: raw.id ?? raw.com2us_id ?? idx,
    com2usId: num(raw.com2us_id),
    name: raw.name ?? raw.title ?? 'Inconnu',
    element: normalizeElement(raw.element),
    stars: typeof stars === 'number' ? stars : null,
    naturalStars: typeof natural === 'number' ? natural : null,
    secondAwaken: Number(raw.awaken_level) >= 2, // 2ᵉ éveil (double éveil)
    image: buildImageUrl(raw),
    stats: normalizeStats(raw),
    leaderSkill: normalizeLeaderSkill(raw),
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
        // Vitesses de base variées (~90–120) pour rendre l'outil RTA testable
        // en mode démo. Déterministe (pas de Math.random) pour un JSON stable.
        const speed = 90 + ((id * 7 + star * 3 + i * 11) % 31);
        // Quelques leads de vitesse variés pour tester le siège en mode démo.
        const demoLeads = [
          null,
          { stat: 'Speed', amount: 33, area: 'General', element: null },
          { stat: 'Speed', amount: 30, area: 'Element', element: el },
          { stat: 'Speed', amount: 24, area: 'Arena', element: null },
        ];
        out.push({
          id: id++,
          com2usId: null,
          name: `${demoNames[(id + star) % demoNames.length]} ${star}★`,
          element: el,
          stars: star,
          naturalStars: star,
          secondAwaken: false,
          image: null,
          leaderSkill: demoLeads[id % demoLeads.length],
          stats: {
            hp: 6000 + ((id * 137) % 6000),
            attack: 500 + ((id * 31) % 500),
            defense: 400 + ((id * 29) % 400),
            speed,
            critRate: 15 + ((id * 3) % 25),
            critDamage: 50 + ((id * 5) % 40),
            resistance: 15 + ((id * 7) % 40),
            accuracy: (id * 11) % 40,
          },
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

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`📝 Écrit dans ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
