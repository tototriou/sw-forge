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

// Classement : ce qui compte pour un tune, c'est CE QUE ça change et QUAND.
//
// ⚠️ **Phrase par phrase, et la CONDITION prime sur le chiffre.** Le passif de
// Mei Hou Wang dit « +12 % de vitesse chaque fois que… (jusqu'à 10 fois) » : lu
// d'un bloc, le nombre le faisait passer pour un bonus permanent. Shumar, lui,
// cumule les deux — « +15 de vitesse. » dans une phrase, « augmente quand les PV
// baissent » dans la suivante : c'est la phrase SANS condition qui donne la
// valeur sûre.
const CONDITION =
  /whenever|each time|every time|for each|for every|accumulat|according to|as the|per |up to \d+|when (you|the|an|your)|if (you|the)|after attack|while /i;

// ⚠️ Une phrase peut parler de la vitesse de QUELQU'UN D'AUTRE, ou la faire
// BAISSER : « Decreases the stunned enemy's Attack Speed by 90% » n'est pas un
// gain pour le passif qui le porte.
//
// ⚠️ On ne regarde que les ~40 caractères qui PRÉCÈDENT « attack speed », pas la
// phrase entière : « +12 % de vitesse chaque fois que le tour de l'ENNEMI se
// termine » est bien un gain pour soi, et rejeter la phrase parce qu'elle
// contient « enemy » perdait le montant.
const PAS_UN_GAIN = /decreas|reduc|enem(y|ies)'?s?|all(y|ies)'?/i;

function pourSoi(phrase, index) {
  return !PAS_UN_GAIN.test(phrase.slice(Math.max(0, index - 40), index));
}

function phrases(t) {
  return t.split(/(?<=\.)\s+/).filter(Boolean);
}

function classer(c) {
  const t = (c.description ?? '').replace(/\s+/g, ' ');
  const effets = c.effets.map((e) => e.nom);
  const a = (n) => effets.includes(n);

  let plat = null;
  let pourcent = null;
  let conditionnel = null;
  for (const ph of phrases(t)) {
    const pct = /attack speed by (\d+)\s*%/i.exec(ph);
    const brut = /attack speed by (\d+)(?!\s*%)/i.exec(ph);
    if (!pct && !brut) continue;
    const m = pct ?? brut;
    if (!pourSoi(ph, m.index)) continue;
    const valeur = pct ? `+${pct[1]} % de vitesse` : `+${brut[1]} de vitesse, en dur`;
    if (CONDITION.test(ph)) conditionnel = conditionnel ?? `${valeur}, mais SOUS CONDITION`;
    else if (pct) pourcent = pourcent ?? `${valeur}, en permanence`;
    else plat = plat ?? `${valeur}, en permanence`;
  }

  // La quantité que SWARFARM attache à l'effet, quand elle en attache une : pour
  // les barres d'action, c'est le pourcentage ; là où elle vaut 0, la valeur
  // n'est nulle part et il faudra la saisir à la main.
  const quantite = (nom) => {
    const e = c.effets.find((x) => x.nom === nom && typeof x.quantite === 'number' && x.quantite > 0);
    return e ? e.quantite : null;
  };

  // Une valeur sûre l'emporte : c'est celle sur laquelle on peut régler un tune.
  if (plat) return ['vitesse-plate', plat + (conditionnel ? ' (+ une part conditionnelle)' : ''), true];
  if (pourcent) return ['vitesse-pourcent', pourcent + (conditionnel ? ' (+ une part conditionnelle)' : ''), true];
  if (conditionnel) return ['vitesse-conditionnelle', conditionnel, true];
  if (a('Accumulate SPD') || a('Increase ATK SPD'))
    return [
      CONDITION.test(t) ? 'vitesse-conditionnelle' : 'vitesse-declenchee',
      'vitesse gagnée, montant NON chiffré dans les données',
      false,
    ];
  if (a('Additional Turn') || /another turn|gains? a turn/i.test(t))
    return ['tour-supplementaire', 'tour supplémentaire hors de son tour', true];
  if (a('Increase ATB') || a('Absorb ATB')) {
    const v = quantite('Increase ATB') ?? quantite('Absorb ATB');
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
  'vitesse-plate': 'Vitesse en dur (permanente)',
  'vitesse-pourcent': 'Vitesse en pourcentage (permanente)',
  'vitesse-conditionnelle': 'Vitesse qui monte selon une condition',
  'vitesse-declenchee': 'Buff de vitesse déclenché',
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
  'vitesse-plate',
  'vitesse-pourcent',
  'vitesse-conditionnelle',
  'vitesse-declenchee',
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
