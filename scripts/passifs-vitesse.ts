// Inventaire des PASSIFS qui pèsent sur un speed tune, à partir de la MÊME
// lecture que l'outil (src/lib/speedTunePassif.ts) : les deux ne peuvent donc
// pas diverger. C'est tout l'intérêt de faire passer le script par la lib.
//
//   node scripts/passifs-vitesse.mjs   → spec/outils/passifs-vitesse.md

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { passifsVitesse, PassifVitesse, SANS_DONNEE } from '../src/lib/speedTunePassif';
import { DetailMonstre } from '../src/lib/monsterSkills';

const DOSSIER = fileURLToPath(new URL('../public/data/skills/', import.meta.url));
const MONSTRES = fileURLToPath(new URL('../public/data/monsters.json', import.meta.url));
const SORTIE = fileURLToPath(new URL('../spec/outils/passifs-vitesse.md', import.meta.url));

const monstres = new Map<number, { name: string }>(
  JSON.parse(readFileSync(MONSTRES, 'utf8'))
    .monsters.filter((m: { com2usId: number | null }) => m.com2usId != null)
    .map((m: { com2usId: number; name: string }) => [m.com2usId, m])
);

type Categorie =
  | 'ampli'
  | 'gain'
  | 'gain-inconnu'
  | 'buff'
  | 'tour'
  | 'barre-gagnee'
  | 'barre-retiree';

const LIBELLE: Record<Categorie, string> = {
  ampli: "AMPLIFIE les buffs reçus (même levier que le spd buff effect)",
  gain: "Gain de vitesse PROPRE (ni dispellable, ni amplifié par le spd buff effect)",
  'gain-inconnu': 'Gain de vitesse propre, montant introuvable',
  buff: 'BUFF de vitesse du jeu (+30 %, amplifié par le spd buff effect)',
  tour: 'Tour supplémentaire hors de son tour',
  'barre-gagnee': "Barre d'attaque gagnée hors de son tour",
  'barre-retiree': "Barre d'attaque retirée hors de son tour",
};

const ORDRE: Categorie[] = ['ampli', 'gain', 'gain-inconnu', 'buff', 'tour', 'barre-gagnee', 'barre-retiree'];

// Comment se lit un passif, en une ligne.
function resume(p: PassifVitesse): [Categorie, string] {
  // ⚠️ En PREMIER : amplifier un buff n'est ni un gain de vitesse ni un buff.
  // Sans ce test, Miriam tombait dans « tour supplémentaire » par défaut.
  if (p.amplifieBuff)
    return [
      'ampli',
      `+${p.amplifieBuff.valeur} % d'effet de buff ${p.amplifieBuff.equipe ? 'sur tout son camp' : 'sur lui'}`,
    ];
  if (p.gain) {
    const g = p.gain;
    const unite = g.pourcent ? ' %' : '';
    const quand = g.parCumul ? ' par déclenchement' : ', en permanence';
    const cap = g.plafond != null ? `, plafonné à ${g.plafond}${unite}` : '';
    const src = g.releve ? ' — relevé en jeu, absent des données' : '';
    return ['gain', `+${g.valeur}${unite} de vitesse${quand}${cap}${src}`];
  }
  if (p.inconnu && !p.barre)
    return [
      'gain-inconnu',
      SANS_DONNEE.has(p.nom)
        ? 'gain de vitesse — AUCUNE donnée, ni fiche ni relevé (vérifié)'
        : 'gain de vitesse, montant introuvable',
    ];
  if (p.buff) return ['buff', 'pose le buff de vitesse du jeu (+30 %)'];
  if (p.barre)
    return [
      p.barre.sens === 'gagnee' ? 'barre-gagnee' : 'barre-retiree',
      p.barre.valeur != null
        ? `${p.barre.sens === 'gagnee' ? '+' : '−'}${p.barre.valeur} % de barre, hors de son tour`
        : `${p.barre.sens === 'gagnee' ? 'remplit' : 'vide'} une barre hors de son tour, montant introuvable`,
    ];
  return ['tour', 'tour supplémentaire hors de son tour'];
}

const parCategorie = new Map<Categorie, Map<string, string[]>>();
const inconnus = new Map<string, string[]>();

for (const fichier of readdirSync(DOSSIER)) {
  if (!fichier.endsWith('.json')) continue;
  const detail = JSON.parse(readFileSync(DOSSIER + fichier, 'utf8')) as DetailMonstre;
  const monstre = monstres.get(detail.com2usId);
  if (!monstre) continue;
  for (const p of passifsVitesse(detail)) {
    const [cat, quoi] = resume(p);
    const cle = `${p.nom} — ${quoi}`;
    if (!parCategorie.has(cat)) parCategorie.set(cat, new Map());
    const groupe = parCategorie.get(cat)!;
    if (!groupe.has(cle)) groupe.set(cle, []);
    groupe.get(cle)!.push(monstre.name);
    if (/introuvable|AUCUNE/.test(quoi)) {
      if (!inconnus.has(cle)) inconnus.set(cle, []);
      inconnus.get(cle)!.push(monstre.name);
    }
  }
}

let total = 0;
let md = `# Outils · Passifs qui pèsent sur un speed tune (inventaire)

⚠️ **Fichier GÉNÉRÉ** par \`node scripts/passifs-vitesse.mjs\` — ne pas l'éditer à
la main, le regénérer après chaque mise à jour de \`public/data/skills\`.

Il sort de la **même lecture que l'outil** ([speedTunePassif.ts](src/lib/speedTunePassif.ts)) :
ce que ce document dit, c'est exactement ce que l'écran applique. Les monstres
sont regroupés par passive — les cinq éléments d'une même famille la partagent.

⚠️ Les noms viennent des données brutes : quelques monstres récents n'y figurent
qu'en coréen.
`;

for (const cat of ORDRE) {
  const groupe = parCategorie.get(cat);
  if (!groupe) continue;
  const entrees = [...groupe.entries()].sort();
  const compte = entrees.reduce((n, [, ms]) => n + ms.length, 0);
  total += compte;
  md += `\n## ${LIBELLE[cat]} — ${compte} monstre(s)\n\n`;
  for (const [cle, ms] of entrees) md += `- **${cle}**\n  - ${[...new Set(ms)].sort().join(', ')}\n`;
}

const entreesInconnues = [...inconnus.entries()].sort();
const compteInconnu = entreesInconnues.reduce((n, [, ms]) => n + ms.length, 0);
md += `\n## ⚠️ Montant introuvable — ${compteInconnu} monstre(s)\n\n`;
md += `Ni le texte ni les données d'effet ne le chiffrent : l'outil ne peut rien en\n`;
md += `faire, ça se pose à la main dans les grilles. Les entrées **AUCUNE donnée\n`;
md += `(vérifié)** sont des trous DÉFINITIFS — inutile de repartir les chercher.\n\n`;
for (const [cle, ms] of entreesInconnues) md += `- **${cle}**\n  - ${[...new Set(ms)].sort().join(', ')}\n`;

md += `\n---\n\nTotal : **${total}** entrées, dont **${compteInconnu}** au montant introuvable.\n`;
writeFileSync(SORTIE, md, 'utf8');
console.log(`spec/outils/passifs-vitesse.md écrit — ${total} entrées, ${compteInconnu} sans montant.`);
for (const cat of ORDRE) {
  const g = parCategorie.get(cat);
  if (g) console.log(`  ${LIBELLE[cat]} : ${[...g.values()].reduce((n, m) => n + m.length, 0)}`);
}
