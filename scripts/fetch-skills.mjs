// Récupère le DÉTAIL des compétences depuis l'API SWARFARM et le range en
// **un fichier par monstre** : `public/data/skills/<com2usId>.json`.
//
// ⚠️ **Un fichier par monstre, et non un gros fichier.** Le détail complet des
// ~3 000 monstres pèse une vingtaine de mégaoctets : tout embarquer ferait
// télécharger 20 Mo à qui vient consulter UN monstre. Découpé, la fiche ne
// charge que le sien (~6 Ko), et une fois vu il reste en cache — donc lisible
// hors ligne, ce à quoi le projet tient (voir docs/03-developpeur/).
//
// ⚠️ **Pré-généré en CI, jamais appelé depuis le navigateur.** Interroger
// SWARFARM à l'exécution ajouterait une dépendance réseau, du CORS et une panne
// possible sur un contenu qui change une fois par patch. Même raisonnement que
// `fetch-monsters.mjs` et que le journal des versions.
//
// > À terme ces données vivront en base ; la lecture côté app passe donc par un
// > seul point d'entrée (`src/lib/monsterSkills.ts`) pour que le remplacement
// > reste local.

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SKILLS_API = 'https://swarfarm.com/api/v2/skills/?limit=500';
const MONSTERS_JSON = fileURLToPath(new URL('../public/data/monsters.json', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../public/data/skills/', import.meta.url));
const MAX_PAGES = 60;

// Icône d'effet / de compétence, servie par SWARFARM.
const skillIcon = (f) => (f ? `https://swarfarm.com/static/herders/images/skills/${f}` : null);
const effectIcon = (f) => (f ? `https://swarfarm.com/static/herders/images/buffs/${f}` : null);

// Un effet appliqué par la compétence : ce qu'il fait, sur qui, avec quelle
// probabilité. ⚠️ On garde `chance` même à null : « pas de taux » (effet
// garanti) et « taux inconnu » ne se distinguent pas autrement.
function normalizeEffect(e) {
  const def = e?.effect ?? {};
  return {
    nom: def.name ?? null,
    type: def.type ?? null, // « Buff », « Debuff », « Other »…
    bonus: def.is_buff === true,
    description: def.description ?? null,
    icone: effectIcon(def.icon_filename),
    chance: typeof e?.chance === 'number' ? e.chance : null,
    quantite: typeof e?.quantity === 'number' ? e.quantity : null,
    surSoi: e?.self_effect === true,
    aoe: e?.aoe === true,
    surCritique: e?.on_crit === true,
    surMort: e?.on_death === true,
    note: e?.note || null,
  };
}

function normalizeSkill(raw) {
  return {
    id: raw.id,
    com2usId: raw.com2us_id ?? null,
    nom: raw.name ?? 'Inconnu',
    description: raw.description ?? null,
    // 1, 2, 3… l'emplacement de la compétence sur le monstre.
    slot: typeof raw.slot === 'number' ? raw.slot : null,
    passif: raw.passive === true,
    aoe: raw.aoe === true,
    // Tours de rechargement. `null` = aucun (compétence de base).
    cooldown: typeof raw.cooltime === 'number' ? raw.cooltime : null,
    coups: typeof raw.hits === 'number' ? raw.hits : null,
    niveauMax: typeof raw.max_level === 'number' ? raw.max_level : null,
    // ⚠️ LE coefficient — « 3.6*{ATK} ». C'est la donnée que personne ne trouve
    // ailleurs et qui décide d'un build : on la garde telle que SWARFARM
    // l'écrit, sans la réinterpréter.
    formule: raw.multiplier_formula ?? null,
    // Les stats sur lesquelles la compétence s'appuie (ATK, DEF, HP…).
    scale: Array.isArray(raw.scales_with) ? raw.scales_with : [],
    // Ce que chaque amélioration apporte, dans l'ordre des niveaux.
    ameliorations: Array.isArray(raw.level_progress_description)
      ? raw.level_progress_description
      : [],
    icone: skillIcon(raw.icon_filename),
    effets: Array.isArray(raw.effects) ? raw.effects.map(normalizeEffect) : [],
  };
}

// Les « compétences auxiliaires » d'un sort : celles que SWARFARM relie à lui
// par `other_skill`, sans les lister sur aucun monstre. Elles portent le ratio
// d'une seconde phase, d'un coup en plus, d'une riposte, de l'autre forme d'un
// monstre à deux formes — que la fiche du sort principal tait (`formule: ""`
// ou un seul ratio pour deux phases).
//
// ⚠️ **Le sens du lien est gardé tel quel** : `versCeSort` quand l'auxiliaire
// désigne le sort (le cas courant : le coup en plus de Hammer Punch),
// `depuisCeSort` quand c'est le sort qui la désigne, `mutuel` quand chacun
// désigne l'autre (les « Horn of… » des anges jumeaux et les tirs de leur
// forme archer). Ce que vaut l'auxiliaire pour le calcul ne se déduit pas du
// lien : `src/lib/damage.ts`.
//
// ⚠️ Une compétence déjà listée sur le monstre n'est pas son propre
// auxiliaire : elle est dans `competences`, pas ici.
function auxiliairesDe(id, autreDe, rattachees, parId, listees) {
  const appelee = autreDe.get(id);
  const out = [];
  for (const aux of rattachees.get(id) ?? []) {
    if (!listees.has(aux.id)) out.push({ sens: aux.id === appelee ? 'mutuel' : 'versCeSort', competence: aux });
  }
  if (appelee != null && !listees.has(appelee) && parId.has(appelee) && !out.some((a) => a.competence.id === appelee)) {
    out.push({ sens: 'depuisCeSort', competence: parId.get(appelee) });
  }
  return out;
}

async function fetchAllSkills() {
  let url = SKILLS_API;
  const parId = new Map();
  // `other_skill` de chaque compétence, pour relier les auxiliaires.
  const autreDe = new Map();
  let pages = 0;
  while (url && pages < MAX_PAGES) {
    process.stdout.write(`\rCompétences — page ${pages + 1}…`);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'swblacksmith-ci' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    const json = await res.json();
    for (const s of json.results ?? []) {
      parId.set(s.id, normalizeSkill(s));
      if (typeof s.other_skill === 'number') autreDe.set(s.id, s.other_skill);
    }
    url = json.next ?? null;
    pages++;
  }
  process.stdout.write('\n');
  if (parId.size === 0) throw new Error("Réponse vide de l'API des compétences");
  return { parId, autreDe };
}

// Les monstres portent la LISTE DES IDS de leurs compétences. Il faut donc
// repasser par l'API des monstres : `monsters.json` ne les conserve pas (elles
// n'y servaient à rien jusqu'ici).
async function fetchMonsterSkillIds() {
  let url = 'https://swarfarm.com/api/v2/monsters/?limit=200';
  const parCom2us = new Map();
  let pages = 0;
  while (url && pages < MAX_PAGES) {
    process.stdout.write(`\rMonstres — page ${pages + 1}…`);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'swblacksmith-ci' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    const json = await res.json();
    for (const m of json.results ?? []) {
      if (m.com2us_id == null) continue;
      parCom2us.set(m.com2us_id, {
        skills: Array.isArray(m.skills) ? m.skills : [],
        leaderSkill: m.leader_skill ?? null,
        skillUps: typeof m.skill_ups_to_max === 'number' ? m.skill_ups_to_max : null,
        archetype: m.archetype ?? null,
        // Chaînes d'éveil : d'où il vient, ce qu'il devient.
        awakensFrom: m.awakens_from ?? null,
        awakensTo: m.awakens_to ?? null,
        source: Array.isArray(m.source) ? m.source : [],
      });
    }
    url = json.next ?? null;
    pages++;
  }
  process.stdout.write('\n');
  return parCom2us;
}

async function main() {
  // On ne génère que pour les monstres réellement présents dans nos données :
  // inutile d'écrire 3 000 fichiers dont l'app ne connaît pas la moitié.
  const connus = JSON.parse(await readFile(MONSTERS_JSON, 'utf8'));
  const liste = Array.isArray(connus) ? connus : (connus.monsters ?? []);
  const idsConnus = new Set(liste.map((m) => m.com2usId).filter((x) => x != null));

  const { parId: skills, autreDe } = await fetchAllSkills();
  const monstres = await fetchMonsterSkillIds();
  // Sens `versCeSort` : les compétences qui désignent chaque sort.
  const rattachees = new Map();
  for (const [id, cible] of autreDe) {
    const aux = skills.get(id);
    if (!aux) continue;
    const l = rattachees.get(cible) ?? [];
    l.push(aux);
    rattachees.set(cible, l);
  }

  // ⚠️ Répertoire VIDÉ avant écriture : un monstre retiré de SWARFARM laisserait
  // sinon son fichier derrière lui, et l'app servirait indéfiniment des données
  // qui n'existent plus.
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  let ecrits = 0;
  let sansSkill = 0;
  for (const [com2usId, info] of monstres) {
    if (!idsConnus.has(com2usId)) continue;
    const listees = new Set(info.skills);
    const detail = info.skills
      .map((id) => skills.get(id))
      .filter(Boolean)
      .map((c) => {
        const auxiliaires = auxiliairesDe(c.id, autreDe, rattachees, skills, listees);
        // Champ absent plutôt que vide : la plupart des sorts n'en ont pas.
        return auxiliaires.length > 0 ? { ...c, auxiliaires } : c;
      });
    if (detail.length === 0) {
      sansSkill++;
      continue; // rien à montrer : pas de fichier plutôt qu'un fichier vide
    }
    const payload = {
      com2usId,
      archetype: info.archetype,
      skillUpsToMax: info.skillUps,
      awakensFrom: info.awakensFrom,
      awakensTo: info.awakensTo,
      source: info.source,
      competences: detail.sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99)),
    };
    await writeFile(`${OUT_DIR}${com2usId}.json`, JSON.stringify(payload), 'utf8');
    ecrits++;
  }

  console.log(`${ecrits} fiches écrites · ${sansSkill} monstres sans compétence connue.`);
}

main().catch((e) => {
  console.error('Échec :', e.message);
  process.exit(1);
});
