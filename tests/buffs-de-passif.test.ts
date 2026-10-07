// Le rappel « tel passif pose tel buff » d'« État de mon
// monstre » (rappel à l'écran, réglage manuel
// conservé).
//
// Trois vérifications :
// 1. `testBuffsDePassifTable` — la table curée `BUFFS_POSES_PAR_PASSIF_CONNUS`
//    (src/lib/buffsDePassif.ts) : exactement les 21 identifiants des passifs de stats encore jouables (24 moins les trois passifs de boss)
//    (cases D × E et Dp × E), chacun passif, porté par une forme jouable, et
//    dont la condition est un extrait LITTÉRAL de la prose de CHAQUE fiche
//    qui le porte. Chaque buff noté est nommé dans la prose (recoupement, pas
//    discriminant : skill game-data-curation § 4).
// 2. `testBuffsDePassifRappel` — `rappelsBuffsDePassif` sur tout le corpus :
//    un rappel pour une forme qui porte un passif de la table, jamais pour une
//    autre ; libellés et texte sur trois cas.
// 3. `testBuffsDePassifEcran` — la source (le dépôt n'a pas d'infrastructure
//    de test React, voir tests/run.mjs) : la carte rend la liste reçue sous
//    les vignettes des buffs ; l'écran la calcule avec la garde d'identité
//    de la fiche ; aucun fichier de calcul n'importe la table — elle ne
//    change aucun total (mesuré avant / après).

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BUFFS_POSES_PAR_PASSIF_CONNUS,
  LIBELLE_BUFF_DE_PASSIF,
  rappelsBuffsDePassif,
} from '../src/lib/buffsDePassif';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { formesJouables } from '../src/lib/monsterForms';
import { egal, monstersJson, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dossierSorts = resolve(racine, 'public/data/skills');

let corpus: DetailMonstre[] | null = null;
function fiches(): DetailMonstre[] {
  if (!corpus) {
    corpus = readdirSync(dossierSorts)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(resolve(dossierSorts, f), 'utf8')) as DetailMonstre);
  }
  return corpus;
}
const fiche = (com2usId: number) => fiches().find((d) => d.com2usId === com2usId)!;

// Les 24 du tri des passifs de stats (comptes
// « D × E » puis « Dp × E »), moins les trois passifs de boss (20021103,
// 20021203, 20021303) dont la forme n'est plus jouable :
// 21, recopiés ici pour que la table ne puisse ni perdre ni gagner une entrée
// sans que ce test le dise.
const TRI_13B = [
  2061, 3212, 7112, 7512, 10012, 11713, 12311, 13012, 13214, 13911, 14411, 16313, 16813, 20011, 20414, 20611,
  21613, 22213, 23611, 24111, 13213,
];
const PASSIFS_DE_BOSS_RETIRES = [20021103, 20021203, 20021303];

// Le mot de la prose qui nomme chaque buff (recoupement seulement).
const MOT_DU_BUFF = { atk: 'Attack Power', def: 'Defense', spd: 'Attack Speed', cr: 'Critical Rate' } as const;

export function testBuffsDePassifTable() {
  titre('Buffs posés par un passif — la table par identifiant : les 21 du tri 13b qui ont une forme jouable, prose citée (degats-et-aura P2, D56)');

  const cles = Object.keys(BUFFS_POSES_PAR_PASSIF_CONNUS).map(Number);
  egal(cles.length, 21, '21 entrées : les 24 « J » buff standard du tri 13b, moins les trois passifs de boss (D56)');
  egal([...cles].sort((a, b) => a - b), [...TRI_13B].sort((a, b) => a - b), 'exactement les identifiants du tri 13b encore jouables');
  for (const id of PASSIFS_DE_BOSS_RETIRES) ok(!(id in BUFFS_POSES_PAR_PASSIF_CONNUS), `${id} : passif de boss, retiré de la table (D56)`);

  const jouables = new Set<number>();
  for (const m of formesJouables(monstersJson())) if (m.com2usId != null) jouables.add(m.com2usId);
  ok(jouables.size > 0, 'témoin : le filtre des formes jouables en laisse');
  for (const id of [2003503, 2003601, 2003705, 2004003, 2004103]) {
    ok(monstersJson().some((m) => m.com2usId === id), `${id} : forme de boss présente dans le corpus (D56)`);
    ok(!jouables.has(id), `${id} : forme de boss écartée de formesJouables (D56)`);
  }

  for (const id of cles) {
    const entree = BUFFS_POSES_PAR_PASSIF_CONNUS[id];
    const porteurs = fiches().flatMap((d) => d.competences.filter((c) => c.com2usId === id).map((c) => ({ forme: d.com2usId, c })));
    ok(porteurs.length > 0, `${id} : identifiant du corpus`);
    ok(porteurs.some((p) => jouables.has(p.forme)), `${id} : porté par au moins une forme jouable`);
    ok(porteurs.every((p) => p.c.passif), `${id} : compétence passive sur chaque fiche`);
    ok(entree.buffs.length > 0, `${id} : au moins un buff`);
    ok(entree.mode === 'tous' || entree.buffs.length > 1, `${id} : « un parmi » suppose plusieurs buffs`);
    for (const { forme, c } of porteurs) {
      const prose = c.description ?? '';
      ok(prose.includes(entree.condition), `${id} (forme ${forme}) : la condition « ${entree.condition} » est un extrait littéral de la prose`);
      for (const b of entree.buffs) {
        ok(prose.includes(MOT_DU_BUFF[b]), `${id} (forme ${forme}) : la prose nomme le buff ${b} (« ${MOT_DU_BUFF[b]} »)`);
      }
    }
  }
  egal(BUFFS_POSES_PAR_PASSIF_CONNUS[16313].mode, 'unParmi', 'Caffeine : un seul buff tiré parmi trois (« grants one of the following »)');
  egal([...BUFFS_POSES_PAR_PASSIF_CONNUS[7512].buffs], ['atk', 'cr'], 'Transcendence : ATQ et Taux Crit (prose « Attack Power and Critical Rate »)');
}

export function testBuffsDePassifRappel() {
  titre('Buffs posés par un passif — le rappel paraît pour un passif de la table, jamais pour un autre (degats-et-aura P2)');

  egal(rappelsBuffsDePassif(null), [], 'sans fiche, aucun rappel');

  let avec = 0;
  let sans = 0;
  for (const d of fiches()) {
    const porte = d.competences.filter((c) => c.com2usId != null && BUFFS_POSES_PAR_PASSIF_CONNUS[c.com2usId] != null).map((c) => c.com2usId);
    const rendus = rappelsBuffsDePassif(d).map((r) => r.skillCom2usId);
    if (porte.length > 0) avec++;
    else sans++;
    if (JSON.stringify(rendus) !== JSON.stringify(porte)) {
      ok(false, `forme ${d.com2usId} : rappels ${JSON.stringify(rendus)} au lieu de ${JSON.stringify(porte)}`);
    }
  }
  ok(avec >= 21, `au moins 21 fiches portent un passif de la table (${avec})`);
  ok(sans > 1000, `les autres fiches (${sans}) n'ont aucun rappel`);
  egal(rappelsBuffsDePassif(fiche(14412)), [], 'Zaiross (passif hors table) : aucun rappel');

  egal(rappelsBuffsDePassif(fiche(11031)), [{
    skillCom2usId: 2061,
    nom: 'Counterattack',
    icone: fiche(11031).competences.find((c) => c.com2usId === 2061)!.icone,
    buffs: 'Buff ATQ',
    condition: 'when you attack on your turn',
  }], 'Icaru : nom du jeu sans « (Passive) », Buff ATQ, condition de la prose');
  egal(rappelsBuffsDePassif(fiche(16312)).map((r) => r.buffs), ['Buff ATQ et Buff Taux Crit'], 'Antares : deux buffs, « et »');
  egal(rappelsBuffsDePassif(fiche(26513)).map((r) => r.buffs), ['Buff ATQ, Buff DEF ou Buff VIT'], 'Espresso Cookie : un parmi trois, « ou »');
  egal(rappelsBuffsDePassif(fiche(20913)).map((r) => r.nom), ['Evasive Maneuver'], 'Erwin : « Evasive Maneuver(Passive) » sans espace, suffixe retiré');
}

// Le code seul : un commentaire qui cite un motif ne doit ni faire échouer ni
// faire passer un contrôle.
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
const source = (chemin: string) => sansCommentaires(readFileSync(resolve(racine, chemin), 'utf8').replace(/\r\n/g, '\n'));

function fichiersTs(dossier: string): string[] {
  const sortie: string[] = [];
  for (const e of readdirSync(resolve(racine, dossier), { withFileTypes: true })) {
    const chemin = `${dossier}/${e.name}`;
    if (e.isDirectory()) sortie.push(...fichiersTs(chemin));
    else if (/\.tsx?$/.test(e.name)) sortie.push(chemin);
  }
  return sortie;
}

export function testBuffsDePassifEcran() {
  titre('Buffs posés par un passif — la carte rend le rappel, aucun calcul ne lit la table (degats-et-aura P2)');

  const carte = source('src/components/outils/EtatMonstre.tsx');
  const vignettes = carte.indexOf('libelle="Buff VIT"');
  const rappel = carte.indexOf('{rappelsBuffs.length > 0 && (');
  const amplification = carte.indexOf('(setup.atkBuff && artefacts.ampliAtkPct > 0) ||');
  ok(vignettes > 0 && rappel > vignettes && amplification > rappel,
    'le rappel est rendu sous les vignettes des buffs, avant les lignes d’amplification');
  ok(/\{rappelsBuffs\.length > 0 && \(\s*<div className="space-y-0\.5 text-xs text-ink-dim">\s*\{rappelsBuffs\.map\(\(r\) => \(/.test(carte),
    'même grammaire que les lignes d’amplification : texte xs atténué, une ligne par passif');
  ok(/<Jeton\s+icone=\{r\.icone \? <img src=\{r\.icone\} alt="" className="h-4 w-4 rounded" loading="lazy" \/> : undefined\}\s+libelle=\{r\.nom\}\s+\/>/.test(carte),
    'le passif est nommé par un Jeton en lecture seule (icône, nom du jeu), comme au lot 11');
  ok(carte.includes('pose {r.buffs} — « {r.condition} »'), 'le texte : buffs posés, puis la condition citée');
  for (const libelle of [LIBELLE_BUFF_DE_PASSIF.atk, LIBELLE_BUFF_DE_PASSIF.def, LIBELLE_BUFF_DE_PASSIF.spd]) {
    ok(carte.includes(`libelle="${libelle}"`), `« ${libelle} » est bien le libellé d’une vignette de la carte`);
  }
  ok(!/rappelsBuffs[^\n]*(onClick|maj\()/.test(carte), 'le rappel n’allume aucun buff');

  const ecran = source('src/components/outils/OptimizerSection.tsx');
  ok(/skillDetail\?\.com2usId === selectedCom2usId \? rappelsBuffsDePassif\(skillDetail\) : \[\]/.test(ecran),
    'l’écran calcule les rappels sur la fiche du monstre CHOISI (garde d’identité pendant le chargement)');
  egal((ecran.match(/rappelsBuffs=\{rappelsBuffs\}/g) ?? []).length, 1, 'la carte « État de mon monstre » reçoit les rappels, une fois');

  const lecteurs = [...fichiersTs('src'), ...fichiersTs('scripts')].filter((f) =>
    /from '[^']*buffsDePassif'/.test(readFileSync(resolve(racine, f), 'utf8'))
  );
  egal(lecteurs.sort(), ['src/components/outils/EtatMonstre.tsx', 'src/components/outils/OptimizerSection.tsx'],
    'seuls l’écran et la carte importent la table : aucun calcul, recette ni script ne la lit');
}
