// Nombres de coups variables, SAISIS — chantier degats-et-aura, lot P5a.
//
// Décisions de l'utilisateur : le nombre de coups variable est SAISI (borné à la
// plage) ; le défaut est le MINIMUM ; un coup supplémentaire vaut les autres
// coups (D30). Les bornes viennent de la prose du sort ou d'un champ de la fiche,
// jamais d'une dérivation depuis les stats : chaque borne attendue ci-dessous est
// écrite à la main, avec sa citation, et jamais relue dans le code qui calcule.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : une entrée par NOM qui s'étend à un
// homonyme JOUABLE d'une autre mécanique (le Whirlpool de Seal n'a aucun coup
// supplémentaire) ; un défaut au maximum (surestimation silencieuse) ; un coup
// supplémentaire qui ne vaudrait pas les autres (la formule est la même par coup,
// l'hypothèse « U1 » du contrôle 13b-coups-variables).

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { StatRow } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { DetailMonstre } from '../src/lib/monsterSkills';
import {
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  type DamageSetup,
  type SkillDamageProfile,
  computeSkillDamage,
  estPrisEnCharge,
  monsterDamageSkills,
  resolvedHits,
} from '../src/lib/damage';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function sortDe(forme: number, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(fiche(forme)).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou refusé sur ${forme}`);
  return p;
}

// Une entrée : le sort (identifiant), ses formes porteuses (balayage du corpus,
// contrôle P5a), la plage ou le nombre fixe attendu, la citation, la clé de la
// curation et, pour une entrée par NOM, les homonymes couverts (même prose).
interface EntreeCoups {
  nom: string;
  id: number;
  formes: number[];
  plage?: { min: number; max: number };
  fixe?: number;
  cle: string;
  citation: string;
  // Homonymes d'un nom curé : [identifiant, forme]. Même plage attendue.
  homonymesCouverts?: [number, number][];
  // Homonymes d'une clé par IDENTIFIANT : autre mécanique, aucune plage.
  homonymesExclus?: [number, number][];
}

const ENTREES: EntreeCoups[] = [
  {
    nom: 'Whirlpool', id: 21311, formes: [31811], plage: { min: 1, max: 3 }, cle: 'identifiant 21311',
    citation: '« Deals additional damage 2 more times to targets with harmful effects » (effet `Additional Attack`, `quantite: 2`) ; `coups: 1`',
    homonymesExclus: [[3463, 12133], [3413, 12113], [3478, 48303]],
  },
];

export function testDegatsCoupsSaisis() {
  const st = stats({ atk: 1000, def: 800, hp: 20000, spd: 200, cr: 25, cd: 100 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 0, enemyHp: 1_000_000, enemyHpPct: 100, critMode: 'normal', summonerSkills: 'combat' };
  const calcul = (p: SkillDamageProfile, n?: number) =>
    computeSkillDamage(p, st, n == null ? base : { ...base, coupsPersonnalises: { [p.skillCom2usId]: n } }, AUCUNE_AURA_PROPRE);

  for (const e of ENTREES) {
    titre(`Lot P5a — ${e.nom} (${e.id}) : clé ${e.cle}`);
    for (const forme of e.formes) {
      const p = sortDe(forme, e.id);
      if (e.plage) {
        const { min, max } = e.plage;
        egal(p.hitsRange, { min, max }, `${e.id} sur ${forme} : plage ${min} à ${max} coups — ${e.citation}`);
        egal(p.hits, min, `${e.id} sur ${forme} : défaut = MINIMUM (${min}), jamais le maximum`);
        egal(resolvedHits(p, base), min, `${e.id} sur ${forme} : sans saisie, ${min} coup(s) retenu(s)`);
        // La saisie est bornée à la plage.
        egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: max + 50 } }), max, `${e.id} sur ${forme} : une saisie au-dessus de la plage retombe sur ${max}`);
        egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: 0 } }), min, `${e.id} sur ${forme} : une saisie sous la plage retombe sur ${min}`);
        // Un coup supplémentaire vaut les autres (D30) : le total est proportionnel au nombre de coups.
        const parCoup = calcul(p, min) / min;
        for (let n = min; n <= max; n++) {
          ok(proche(calcul(p, n), n * parCoup), `${e.id} sur ${forme} : ${n} coup(s) = ${n} × un coup (chaque coup vaut les autres)`);
        }
      } else {
        egal(p.hitsRange, undefined, `${e.id} sur ${forme} : pas une plage`);
        egal(p.hits, e.fixe, `${e.id} sur ${forme} : ${e.fixe} coups fixes — ${e.citation}`);
      }
    }
    for (const [idHom, formeHom] of e.homonymesCouverts ?? []) {
      const p = sortDe(formeHom, idHom);
      egal(p.nom, e.nom, `homonyme ${idHom} sur ${formeHom} : même nom, même prose, couvert par la clé « ${e.cle} »`);
      egal(p.hitsRange ?? p.hits, e.plage ?? e.fixe, `homonyme ${idHom} sur ${formeHom} : même nombre de coups que ${e.id}`);
    }
    for (const [idHom, formeHom] of e.homonymesExclus ?? []) {
      const tous = monsterDamageSkills(fiche(formeHom));
      const p = tous.find((s) => s.skillCom2usId === idHom);
      ok(p == null || !estPrisEnCharge(p) || p.hitsRange == null, `homonyme ${idHom} sur ${formeHom} : aucune plage (autre mécanique, hors de la clé « ${e.cle} »)`);
      if (p && estPrisEnCharge(p)) egal(p.hits, 1, `homonyme ${idHom} sur ${formeHom} : un seul coup, comme avant`);
    }
  }
}
