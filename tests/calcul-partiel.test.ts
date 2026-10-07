// L'étiquette « Calcul partiel » de « Compétence utilisée »
// (`calculPartielDuSort`, damage.ts ; DamageSetupCard.tsx).
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : un sort dont le total omet une
// part connue (une perte de PV, un ignore DEF compté en permanence) affiché
// sans rien dire — l'Optimizer classerait des builds sur un nombre que rien ne
// signale comme incomplet. Une entrée curée n'est protégée que par son test
// (skill game-data-curation § 8) : la liste attendue est écrite À PART de la
// table, avec sa source, pour qu'un retrait comme un ajout se voie. Une part
// livrée par un lot ultérieur doit faire sortir l'identifiant de la table ET
// de cette liste, dans le même commit.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { egal, monstersJson, ok, titre } from './outils';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { estEveille, formesJouables } from '../src/lib/monsterForms';
import {
  SkillDamageUnsupported,
  calculPartielDuSort,
  estPrisEnCharge,
  idsCalculPartiel,
  monsterDamageSkills,
} from '../src/lib/damage';

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

// [identifiant, nom du sort, source : le code qui dit pourquoi le calcul est partiel].
const ATTENDUS: [number, string, 'ignore-def' | 'pas-encore-codee' | 'non-calculee' | 'non-modelisee'][] = [
  [13406, 'Madness Judgement', 'ignore-def'],
  [13410, 'Madness Judgement', 'ignore-def'],
  [15511, 'Unlimited Power', 'ignore-def'],
  [13611, 'Start of Attacking', 'ignore-def'],
  [7713, 'Thunder Strike', 'ignore-def'],
  [6013, 'Sword of Discharge', 'ignore-def'],
  [11912, 'Hellfire', 'pas-encore-codee'],
  [6015, 'Ragnarok', 'pas-encore-codee'],
  [15114, 'Time of Destruction', 'pas-encore-codee'],
  [20413, 'Dragon Bombardment', 'pas-encore-codee'],
  [13401, 'Sword of Destruction', 'pas-encore-codee'],
  [13402, 'Sword of Destruction', 'pas-encore-codee'],
  [13403, 'Sword of Destruction', 'pas-encore-codee'],
  [13404, 'Sword of Destruction', 'pas-encore-codee'],
  [13405, 'Sword of Destruction', 'pas-encore-codee'],
  [12615, 'Moonlight Blow', 'pas-encore-codee'],
  [15437, 'Volcanic Tribe Totem', 'pas-encore-codee'],
  [15440, 'Half Moon Tribe Totem', 'pas-encore-codee'],
  [8912, 'Meteor Bomb', 'pas-encore-codee'],
  [7113, 'Promised Time', 'pas-encore-codee'],
  [10222, 'Detonation Shot', 'pas-encore-codee'],
  [15214, 'Quantum Explosion', 'non-calculee'],
  [16307, 'Extraction', 'non-calculee'],
  [16309, 'Extraction', 'non-calculee'],
  [16807, 'Dancing Teacup', 'non-calculee'],
  [16809, 'Dancing Teacup', 'non-calculee'],
  [16315, 'Blending', 'non-calculee'],
  [16815, 'Midnight Teatime', 'non-calculee'],
  [12520, 'Justice Strike', 'non-modelisee'],
  [12510, 'Fury of Punishment', 'non-modelisee'],
  [23515, 'Summary Justice', 'non-modelisee'],
];

// Lignes « calculé » écartées : total complet par décision.
const ECARTES: [number, string][] = [
  [13407, "Devil's Bargain — part non calculée, la prose se trompe"],
  [13408, "Devil's Bargain — part non calculée"],
  [13409, "Devil's Bargain — part non calculée"],
  [1362, 'Incinerate — détonation de DoT hors total'],
  [17513, 'Rage of Helheim — détonation de DoT hors total'],
  [18013, 'Stormy Axe — détonation de DoT hors total'],
  [8901, 'Firecracker — bombe à retardement hors total'],
  [8902, 'Firecracker'],
  [8903, 'Firecracker'],
  [8904, 'Firecracker'],
  [8905, 'Firecracker'],
  [10217, 'Bombardment — bombe à retardement hors total'],
  [10220, 'Bombardment'],
];

// Thunder Strike 7713 : porté par Copper éveillé (16513), que le second éveil
// (16533, Thunder Strike 7763, déjà neutralisé) remplace dans le bestiaire de
// l'Optimizer. Il reste choisissable depuis un compte qui possède un Copper
// sans second éveil : forme éveillée, mais hors de `formesJouables(catalogue)`.
const PORTE_PAR_UNE_FORME_DU_COMPTE_SEULE: Record<number, number> = { 7713: 16513 };

function porteurs(id: number) {
  return fiches().flatMap((d) => d.competences.filter((c) => c.com2usId === id).map((c) => ({ d, c })));
}

export function testCalculPartielTable() {
  titre('Calcul partiel — la table par identifiant : six ignore DEF comptés, parts décidées pas encore codées, parts non calculées, parts non modélisées');

  const ids = idsCalculPartiel();
  egal(ids.length, 31, '31 entrées : 6 (ignore DEF compté) + 15 (part décidée, pas encore codée) + 7 (part non calculée) + 3 (part non modélisée)');
  egal([...ids].sort((a, b) => a - b), ATTENDUS.map(([id]) => id).sort((a, b) => a - b), 'exactement les identifiants attendus');
  egal(ATTENDUS.filter(([, , s]) => s === 'ignore-def').length, 6, 'six ignore DEF permanents');
  egal(ATTENDUS.filter(([, , s]) => s === 'non-modelisee').length, 3, 'trois parts non modélisées (Leona ×2, Theonia)');
  for (const [id, raison] of ECARTES) ok(!ids.includes(id), `${id} écarté de la table : ${raison}`);

  const catalogue = monstersJson();
  const parId = new Map<number, any>();
  for (const m of catalogue) if (m.com2usId != null) parId.set(m.com2usId, m);
  const jouables = new Set<number>();
  for (const m of formesJouables(catalogue)) if (m.com2usId != null) jouables.add(m.com2usId);
  ok(jouables.size > 0, 'témoin : le filtre des formes jouables en laisse');

  for (const [id, nom, source] of ATTENDUS) {
    const p = porteurs(id);
    ok(p.length > 0 && p.every(({ c }) => c.nom === nom), `${id} : identifiant du corpus, nommé « ${nom} » sur chaque fiche`);
    // La phrase : ce qui n'est pas compté, en français, une phrase.
    const sorts = p.flatMap(({ d }) => monsterDamageSkills(d).filter((s) => s.skillCom2usId === id));
    const phrase = sorts.length > 0 ? calculPartielDuSort(sorts[0]) : null;
    ok(phrase != null && /^[A-ZL].*\.$/.test(phrase) && /n’est pas (encore )?(compté|comptée|calculée|modélisée)/.test(phrase),
      `${id} (${source}) : une phrase qui dit ce qui n’est pas compté — « ${phrase} »`);
    if (source === 'non-calculee') ok(phrase != null && /n’est pas calculée\.$/.test(phrase), `${id} : part non calculée par décision, sans « encore »`);
    if (source === 'pas-encore-codee') ok(phrase != null && /pas encore comptée?\.$/.test(phrase), `${id} : part décidée comptée, pas encore codée (« pas encore »)`);
    if (source === 'non-modelisee') ok(phrase != null && /n’est pas encore compté\.$/.test(phrase), `${id} : part non modélisée, reportée — « pas encore compté »`);
    if (source === 'ignore-def') ok(phrase != null && phrase.startsWith('L’ignore DEF est compté'), `${id} : la phrase dit que l’ignore DEF est compté`);

    // Chaque clé est portée par une forme jouable, où le sort est calculé.
    const formeDuCompte = PORTE_PAR_UNE_FORME_DU_COMPTE_SEULE[id];
    if (formeDuCompte != null) {
      const m = parId.get(formeDuCompte);
      ok(m != null && estEveille(m) && !m.secondAwaken && !jouables.has(formeDuCompte),
        `${id} : porté par la forme éveillée ${formeDuCompte} (sans second éveil), choisissable depuis un compte, hors du bestiaire`);
      ok(p.some(({ d }) => d.com2usId === formeDuCompte), `${id} : la fiche ${formeDuCompte} porte le sort`);
    } else {
      ok(p.some(({ d }) => jouables.has(d.com2usId)), `${id} : porté par au moins une forme jouable`);
    }
    for (const { d } of p) {
      const s = monsterDamageSkills(d).find((x) => x.skillCom2usId === id);
      ok(s != null && estPrisEnCharge(s), `${id} (forme ${d.com2usId}) : sort calculé, donc l’étiquette s’affiche`);
      // D63 : l'ignore DEF est compté en permanence ; le jour où il est
      // conditionné, ce contrôle échoue et l'entrée doit sortir.
      if (source === 'ignore-def' && s && estPrisEnCharge(s)) ok(s.ignoreDef, `${id} (forme ${d.com2usId}) : ignore DEF compté en permanence`);
    }
  }
}

export function testCalculPartielAffichage() {
  titre('Calcul partiel — l’étiquette paraît pour un sort calculé de la table, jamais pour un autre');

  const ids = new Set(idsCalculPartiel());
  let avec = 0;
  let sans = 0;
  let ecarts = 0;
  const vus = new Set<number>();
  for (const d of fiches()) {
    for (const s of monsterDamageSkills(d)) {
      const attendu = estPrisEnCharge(s) && ids.has(s.skillCom2usId);
      const recu = calculPartielDuSort(s) != null;
      if (recu) {
        avec++;
        vus.add(s.skillCom2usId);
      } else sans++;
      if (recu !== attendu) {
        ecarts++;
        ok(false, `forme ${d.com2usId}, sort ${s.skillCom2usId} : étiquette ${recu ? 'présente' : 'absente'} à tort`);
      }
    }
  }
  egal(ecarts, 0, `corpus entier : étiquette sur les seuls sorts calculés de la table (${avec} cases avec, ${sans} sans)`);
  egal([...vus].sort((a, b) => a - b), [...ids].sort((a, b) => a - b), 'chaque entrée de la table s’affiche sur au moins une fiche');

  const refuse: SkillDamageUnsupported = { skillCom2usId: 13406, slot: 2, nom: 'Madness Judgement', description: null, raison: 'refusé' };
  egal(calculPartielDuSort(refuse), null, 'un sort refusé ne porte jamais l’étiquette, même si son identifiant est dans la table');
}

const lire = (f: string) => readFileSync(resolve(racine, f), 'utf8').replace(/\r\n/g, '\n');
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

export function testCalculPartielEcran() {
  titre('Calcul partiel — « Compétence utilisée » : étiquette et « ? » hors du bouton de la case, rien ailleurs');

  const carte = sansCommentaires(lire('src/components/outils/DamageSetupCard.tsx'));
  const debut = carte.indexOf('{skills.map((s) => {');
  const fin = carte.indexOf('{champCoupsVariables(', debut);
  const sorts = debut >= 0 && fin > debut ? carte.slice(debut, fin) : '';
  ok(sorts.length > 0, 'précondition : la liste des cases de sort');
  ok(/const partiel = calculPartielDuSort\(s\);/.test(sorts), 'la phrase vient de `calculPartielDuSort`, jamais écrite dans l’écran');
  const action = sorts.slice(sorts.indexOf('actionTitre={'), sorts.indexOf('description={', sorts.indexOf('actionTitre={')));
  ok(/\{partiel && \(\s*<>\s*<Jeton libelle="Calcul partiel" \/>\s*<HelpPopover title="Calcul partiel" ariaLabel=\{`Ce que le calcul de \$\{s\.nom\} ne compte pas`\}>\s*\{partiel\}\s*<\/HelpPopover>\s*<\/>\s*\)\}/.test(action),
    'étiquette : un `Jeton` (src/ui) « Calcul partiel » suivi de SON « ? » (`HelpPopover`), dans l’axe `actionTitre`');
  ok(action.indexOf('Description de') >= 0 && action.indexOf('Description de') < action.indexOf('Calcul partiel'),
    'le « ? » de la prose reste juste à droite du nom ; l’étiquette vient après');
  const titreDeLaCase = sorts.slice(sorts.indexOf('titre={'), sorts.indexOf('actionTitre={'));
  ok(titreDeLaCase.length > 0 && !/partiel/i.test(titreDeLaCase), 'jamais dans `titre`, qui est dans le bouton de la case');
  ok(!/actif|resolved/.test(action.replace(/aria-?\w*/g, '')), 'l’étiquette ne dépend pas du sort choisi : elle ne naît ni ne disparaît au clic');

  // Aucune mention sur les cartes de résultats (forme écartée par l'utilisateur).
  const fichiers = ['src/components/outils/OptimizerSection.tsx', 'src/components/outils/DamageSetupModale.tsx', 'src/components/outils/EtatMonstre.tsx'];
  for (const f of fichiers) ok(!/Calcul partiel|calculPartielDuSort/.test(sansCommentaires(lire(f))), `${f} : aucune mention « Calcul partiel »`);
  egal((carte.match(/Calcul partiel/g) ?? []).length, 2, 'DamageSetupCard : « Calcul partiel » deux fois — l’étiquette et le titre de sa bulle');

  // Aucun calcul ne lit la table.
  const damage = sansCommentaires(lire('src/lib/damage.ts'));
  egal((damage.match(/CALCUL_PARTIEL_PAR_ID/g) ?? []).length, 3, 'damage.ts : la table n’est lue que par `idsCalculPartiel` et `calculPartielDuSort`');
  egal((damage.match(/calculPartielDuSort\(/g) ?? []).length, 1, 'damage.ts : `calculPartielDuSort` n’est appelé par aucun calcul');
}
