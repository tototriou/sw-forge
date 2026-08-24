// Inventaire des PASSIFS qui peuvent peser sur un speed tune.
//
// ⚠️ Un passif ne part pas au tour du monstre : la simulation du speed tuning ne
// le voit donc pas (voir spec/outils/speed-tuning.md, « Compétences »). Or
// certains changent tout — Shumar gagne 15 de vitesse en permanence, Chilling en
// gagne selon ses buffs, d'autres remplissent leur barre quand on les frappe.
// Ce script les recense pour qu'on sache CE QU'ON NE MODÉLISE PAS, et lesquels
// méritent de l'être.
//
// Sortie : spec/outils/passifs-vitesse.md (regénérable à chaque patch).
//   node scripts/passifs-vitesse.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DOSSIER = fileURLToPath(new URL('../public/data/skills/', import.meta.url));
const MONSTRES = fileURLToPath(new URL('../public/data/monsters.json', import.meta.url));
const SORTIE = fileURLToPath(new URL('../spec/outils/passifs-vitesse.md', import.meta.url));

const monstres = new Map(
  JSON.parse(readFileSync(MONSTRES, 'utf8'))
    .monsters.filter((m) => m.com2usId != null)
    .map((m) => [m.com2usId, m])
);

// Effets SWARFARM qui touchent la vitesse ou la barre d'action.
const EFFETS = new Set([
  'Increase ATK SPD',
  'Decrease ATK SPD',
  'Accumulate SPD',
  'Increase ATB',
  'Decrease ATB',
  'Absorb ATB',
  'Additional Turn',
]);

// Le texte, lui, dit ce que les effets taggés ne disent pas (Shumar : « Increases
// the attack speed by 15 » sans aucun effet listé).
const TEXTE = /attack speed|atk spd|attack bar|another turn|additional turn|gains? a turn/i;

// Classement. ⚠️ **Deux choses très différentes se cachent derrière « attack
// speed » dans les textes**, et les confondre fausse tout :
//
//   - « Increases your Attack Speed **for 2 turns** » (Juno) → le monstre gagne
//     le BUFF de vitesse du jeu : +30 %, dispellable, et **amplifié par
//     l'artéfact « spd buff effect »**.
//   - « increases your Attack Speed **by 5** for each… » (Elsharion), « Your
//     Attack Speed increases according to… » (Chilling) → un gain PROPRE, qui
//     n'est pas un buff : ni dispellable, ni amplifié par l'artéfact.
//
// Le discriminant est dans le texte : un MONTANT (« by N », « by N% ») = gain
// propre ; une DURÉE seule (« for N turns ») ou rien = buff.
const CONDITION =
  /whenever|each time|every time|for each|for every|accumulat|according to|as the|per |up to \d+|when (you|the|an|your)|if (you|the)|after attack|while /i;

// ⚠️ Le mot qui compte est le DERNIER avant « attack speed », pas n'importe
// lequel de la phrase. Chez Ciri, « …damage that increases as the target's HP
// status DECREASES and increases your Attack Speed by 50 » : le « decreases »
// parle des PV de la cible, pas de la vitesse. Chercher le mot le plus proche
// règle les deux cas d'un coup.
function pourSoi(phrase, index) {
  const avant = phrase.slice(Math.max(0, index - 40), index).toLowerCase();
  const dernier = (re) => {
    let pos = -1;
    for (const m of avant.matchAll(re)) pos = m.index ?? pos;
    return pos;
  };
  const baisse = dernier(/decreas|reduc/g);
  const hausse = dernier(/increas|gain/g);
  if (baisse > hausse) return false;
  // Une cible explicite juste avant : ce n'est pas SA vitesse.
  return !/(enem(y|ies)'?s?|all(y|ies)'?)\s*$/i.test(avant.slice(-20));
}

function phrases(t) {
  return t.split(/(?<=\.)\s+/).filter(Boolean);
}

// « up to 150% », « up to 100 » : le plafond du gain. ⚠️ « up to 10 TIMES » n'est
// pas un plafond de vitesse mais un nombre de CUMULS — les confondre annonçait
// « plafonné à 10 » sur un passif qui monte à 120 %.
function plafond(ph) {
  const m = /up to (\d+)\s*(%?)(\s*times)?/i.exec(ph);
  if (!m) return '';
  if (m[3]) return `, jusqu'à ${m[1]} cumuls`;
  return `, plafonné à ${m[1]}${m[2] ? ' %' : ''}`;
}

// ⚠️ Ce que les données ne disent PAS mais qui se relève en jeu. Une table
// explicite, avec sa source : mieux vaut une valeur assumée « relevée à la main »
// qu'un trou silencieux. À compléter au fil des vérifications.
const RELEVE_EN_JEU = {
  'The Cunning (Passive)': '+20 de vitesse par buff porté (relevé en jeu)',
};

// ⚠️ Ceux-là n'ont **aucune donnée**, ni dans les fiches ni en jeu — vérifié avec
// l'utilisateur le 2026-08-24. Les marquer évite de repartir les chercher à
// chaque passe : ce sont des trous DÉFINITIFS, pas des trous à combler.
const SANS_DONNEE = new Set([
  'Atrocity (Passive)', // Contaminated Dragon
  'Beast Man (Passive)', // Grotau, Minotauros
  'Sugar Booster (Passive)', // Lollipop Warrior, Thomas
  'The Bravest Cookie (Passive)', // GingerBrave
]);

function classer(c) {
  const t = (c.description ?? '').replace(/\s+/g, ' ');
  const effets = c.effets.map((e) => e.nom);
  const a = (n) => effets.includes(n);
  const quantite = (nom) => {
    const e = c.effets.find((x) => x.nom === nom && typeof x.quantite === 'number' && x.quantite > 0);
    return e ? e.quantite : null;
  };

  // 1. La VITESSE, phrase par phrase.
  let gain = null; // gain propre, chiffré
  let gainFlou = false; // gain propre, sans montant (« increases according to… »)
  let buff = null; // buff de vitesse du jeu
  for (const ph of phrases(t)) {
    if (!/attack speed/i.test(ph)) continue;
    // ⚠️ Le montant se dit dans les DEUX SENS : « increases your Attack Speed by
    // 50 » et « Your Attack Speed is increased by 15% ». Ne reconnaître que le
    // premier faisait passer Misty et Ciri pour des montants inconnus.
    const m = /attack speed(?:\s+(?:is\s+)?(?:increased|increases))?\s+by\s+(\d+)\s*(%?)/i.exec(ph);
    if (m && pourSoi(ph, m.index)) {
      const cond = CONDITION.test(ph) ? ' (sous condition)' : ' (en permanence)';
      gain = gain ?? `+${m[1]}${m[2] ? ' %' : ''} de vitesse, gain propre${plafond(ph)}${cond}`;
      continue;
    }
    // Pas de montant : soit un buff (« for N turns »), soit un gain propre flou.
    const i = ph.toLowerCase().indexOf('attack speed');
    if (!pourSoi(ph, i)) continue;
    if (/your attack speed (increases|is increased)/i.test(ph)) gainFlou = true;
    else if (/increases? (your|the) attack speed/i.test(ph) || a('Increase ATK SPD')) {
      const tours = /for (\d+) turns?/i.exec(ph);
      buff = buff ?? `buff de vitesse du jeu (+30 %)${tours ? `, ${tours[1]} tours` : ''}`;
    }
  }
  if (gain) return ['gain-spd', gain, true];
  if (gainFlou) {
    const releve = RELEVE_EN_JEU[c.nom];
    if (releve) return ['gain-spd', `${releve} — absent des données, relevé à la main`, true];
    return [
      'gain-spd-inconnu',
      SANS_DONNEE.has(c.nom)
        ? 'gain de vitesse PROPRE — AUCUNE donnée, ni fiche ni relevé (vérifié)'
        : 'gain de vitesse PROPRE, montant absent des données',
      false,
    ];
  }
  if (buff) return ['buff-spd', buff, true];
  if (a('Accumulate SPD')) return ['gain-spd-inconnu', 'gain de vitesse PROPRE, montant absent des données', false];

  // 2. Le TOUR supplémentaire.
  if (a('Additional Turn') || /another turn|gains? a turn/i.test(t))
    return ['tour-supplementaire', 'tour supplémentaire hors de son tour', true];

  // 3. La BARRE d'action. ⚠️ « fills the Attack Bar » = 100 %, le texte ne le
  // chiffre pas parce que remplir, c'est remplir.
  const remplit = /fills? (up )?(your|the|its|his|her) attack bar/i.test(t);
  if (a('Increase ATB') || a('Absorb ATB') || remplit) {
    const v = quantite('Increase ATB') ?? quantite('Absorb ATB') ?? (remplit ? 100 : null);
    return [
      'barre-gagnee',
      v != null ? `+${v} % de barre, hors de son tour` : 'remplit une barre hors de son tour, montant NON chiffré',
      v != null,
    ];
  }
  if (a('Decrease ATB')) {
    const v = quantite('Decrease ATB');
    return [
      'barre-retiree',
      v != null ? `−${v} % de barre adverse, hors de son tour` : 'vide une barre adverse, montant NON chiffré',
      v != null,
    ];
  }
  if (/attack speed/i.test(t)) return ['autre', t.slice(0, 110), false];
  return null;
}

const LIBELLE = {
  'gain-spd': "Gain de vitesse PROPRE (pas un buff : ni dispellable, ni amplifié par l'artéfact)",
  'gain-spd-inconnu': 'Gain de vitesse propre, montant absent des données',
  'buff-spd': 'BUFF de vitesse du jeu (+30 %, amplifié par le spd buff effect)',
  'tour-supplementaire': 'Tour supplémentaire',
  'barre-gagnee': "Barre d'attaque gagnée hors de son tour",
  'barre-retiree': "Barre d'attaque retirée hors de son tour",
  autre: 'Autre mention de la vitesse (souvent des dégâts qui en dépendent)',
};

const parCategorie = new Map();
// ⚠️ Les passives dont on ne connaît PAS le montant : ni le texte ni les données
// ne le donnent. Ce sont celles qu'aucun calcul ne pourra reprendre — elles se
// posent à la main, tick par tick.
const sansValeur = new Map();
for (const fichier of readdirSync(DOSSIER)) {
  if (!fichier.endsWith('.json')) continue;
  const detail = JSON.parse(readFileSync(DOSSIER + fichier, 'utf8'));
  const monstre = monstres.get(detail.com2usId);
  if (!monstre) continue;
  for (const c of detail.competences ?? []) {
    if (!c.passif) continue;
    const pertinent = c.effets.some((e) => EFFETS.has(e.nom)) || TEXTE.test(c.description ?? '');
    if (!pertinent) continue;
    const classe = classer(c);
    if (!classe) continue;
    const [cat, quoi, valeurConnue] = classe;
    if (!valeurConnue && cat !== 'autre') {
      const cle = `${c.nom} — ${quoi}`;
      if (!sansValeur.has(cle)) sansValeur.set(cle, []);
      sansValeur.get(cle).push(monstre.name);
    }
    if (!parCategorie.has(cat)) parCategorie.set(cat, new Map());
    // Une même passive porte souvent le même nom sur les cinq éléments : on
    // regroupe par (nom de passive + effet), en listant les monstres.
    const cle = `${c.nom} — ${quoi}`;
    const groupe = parCategorie.get(cat);
    if (!groupe.has(cle)) groupe.set(cle, []);
    groupe.get(cle).push(monstre.name);
  }
}

const ordre = [
  'gain-spd',
  'gain-spd-inconnu',
  'buff-spd',
  'tour-supplementaire',
  'barre-gagnee',
  'barre-retiree',
  'autre',
];

let total = 0;
let md = `# Outils · Passifs qui pèsent sur un speed tune (inventaire)

⚠️ **Fichier GÉNÉRÉ** par \`node scripts/passifs-vitesse.mjs\` — ne pas l'éditer à
la main, le regénérer après chaque mise à jour de \`public/data/skills\`.

Un passif ne part pas au tour du monstre : la simulation ne le voit donc pas
(voir [speed-tuning.md](speed-tuning.md), « Compétences »). Cet inventaire dit
**ce qui n'est pas modélisé**, pour qu'on sache où l'outil s'arrête et ce qui
mérite de l'être. Les monstres sont regroupés par passive : les cinq éléments
d'une même famille la partagent.

⚠️ Les noms viennent des données brutes : quelques monstres récents n'y figurent
qu'en coréen, et le classement est fait à partir du TEXTE anglais des
compétences — une formulation inhabituelle peut donc tomber dans « Autre ».

`;

for (const cat of ordre) {
  const groupe = parCategorie.get(cat);
  if (!groupe) continue;
  const entrees = [...groupe.entries()].sort();
  const compte = entrees.reduce((n, [, ms]) => n + ms.length, 0);
  total += compte;
  md += `\n## ${LIBELLE[cat]} — ${compte} monstre(s)\n\n`;
  for (const [cle, ms] of entrees) {
    const noms = [...new Set(ms)].sort();
    md += `- **${cle}**\n  - ${noms.join(', ')}\n`;
  }
}

md += `\n---\n\nTotal : **${total}** entrées de monstre, ${[...parCategorie.values()].reduce((n, g) => n + g.size, 0)} passives distinctes.\n`;
// ⚠️ La liste qui compte le plus : les passives dont on ne connaît PAS le
// montant. Ni le texte ni les données d'effet ne le chiffrent — aucun calcul ne
// peut les reprendre, elles se posent à la main dans les grilles.
const entreesSansValeur = [...sansValeur.entries()].sort();
const compteSansValeur = entreesSansValeur.reduce((n, [, ms]) => n + ms.length, 0);
md += `
## ⚠️ Montant INCONNU — ${compteSansValeur} monstre(s)

`;
md += `Ni le texte de la compétence ni les données d'effet ne chiffrent la modification :
`;
md += `aucun calcul ne peut la reprendre telle quelle, elle se pose à la main dans les
`;
md += `grilles. C'est la liste à connaître avant de faire confiance à un verdict sur une
`;
md += `équipe qui en contient un.

`;
md += `⚠️ Celles marquées **AUCUNE donnée (vérifié)** sont des trous DÉFINITIFS : la
`;
md += `valeur n'existe ni dans les fiches ni en jeu. Inutile de repartir les chercher.

`;
for (const [cle, ms] of entreesSansValeur) {
  const noms = [...new Set(ms)].sort();
  md += `- **${cle}**
  - ${noms.join(', ')}
`;
}

md += `
---

Total : **${total}** entrées, dont **${compteSansValeur}** au montant inconnu.
`;

writeFileSync(SORTIE, md, 'utf8');
console.log(`spec/outils/passifs-vitesse.md écrit — ${total} entrées.`);
for (const cat of ordre) {
  const g = parCategorie.get(cat);
  if (g) console.log(`  ${LIBELLE[cat]} : ${[...g.values()].reduce((n, m) => n + m.length, 0)}`);
}
console.log(`  ⚠️ montant inconnu : ${compteSansValeur}`);
