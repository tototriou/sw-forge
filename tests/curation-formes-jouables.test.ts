// Les tables curées par identifiant ne visent que des formes JOUABLES.
//
// Règle de curation (docs/02-app/degats-reels/valeurs-de-jeu-curees.md) : une
// forme non éveillée ou non obtenable (boss, ancien doublon, placeholder) ne
// se curate pas. Une clé posée sur elle seule n'échouait nulle part — elle
// coûtait une curation pour un sort que personne ne peut lancer.
//
// « Jouable » est pris au sens du Bestiaire, pas des sélecteurs : obtenable ET
// éveillée. La forme éveillée qu'une 2A remplace en fait partie (Copper
// `16513`, Thunder Strike `7713`) — on la possède avant le second éveil, et un
// compte peut l'amener jusqu'à l'Optimizer.
//
// Ce test garde des IDENTIFIANTS ; il ne dit rien des valeurs.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import { clesDesTablesParId, idsCalculPartiel } from '../src/lib/damage';
import { BUFFS_POSES_PAR_PASSIF_CONNUS } from '../src/lib/buffsDePassif';
import { estEveille, estObtenable } from '../src/lib/monsterForms';
import type { Monster } from '../src/types';
import { egal, monstersJson, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

export default function testCurationFormesJouables() {
  titre('Curation — chaque clé des tables par identifiant est portée par une forme obtenable et éveillée');

  const jouables = new Set<number>();
  for (const m of monstersJson() as Monster[]) if (m.com2usId != null && estObtenable(m) && estEveille(m)) jouables.add(m.com2usId);
  ok(jouables.size > 0, 'témoin : le filtre des formes jouables en laisse');

  const formesParSort = new Map<number, number[]>();
  for (const f of readdirSync(DOSSIER_SORTS)) {
    if (!f.endsWith('.json')) continue;
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    for (const c of d.competences) {
      if (c.com2usId != null) formesParSort.set(c.com2usId, [...(formesParSort.get(c.com2usId) ?? []), d.com2usId]);
    }
  }

  // `CALCUL_PARTIEL_PAR_ID` passe par sa propre lecture : la table n'est lue
  // que pour l'affichage, et son test le vérifie. ⚠️ Une table par identifiant
  // ajoutée à damage.ts se déclare dans `clesDesTablesParId`, sinon elle
  // échappe à cette garde.
  const tables = { ...clesDesTablesParId(), CALCUL_PARTIEL_PAR_ID: idsCalculPartiel() };
  egal(Object.keys(tables).length, 25, 'témoin : les 25 tables par identifiant de damage.ts');

  const toutes: [string, number[]][] = [
    ...Object.entries(tables),
    ['BUFFS_POSES_PAR_PASSIF_CONNUS', Object.keys(BUFFS_POSES_PAR_PASSIF_CONNUS).map(Number)],
  ];
  for (const [table, ids] of toutes) {
    const horsJouables = ids.filter((id) => !(formesParSort.get(id) ?? []).some((f) => jouables.has(f)));
    egal(
      horsJouables.map((id) => `${id} (porté par ${(formesParSort.get(id) ?? []).join(', ') || 'aucune forme'})`),
      [],
      `${table} : ${ids.length} clé(s), toutes portées par une forme jouable`
    );
  }
}
