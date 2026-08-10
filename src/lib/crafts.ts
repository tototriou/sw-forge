// « Est-ce que je peux le faire MAINTENANT ? » — confrontation d'un plan
// d'optimisation à la réserve de meules et de gemmes du compte.
//
// Un potentiel de +20 d'efficience n'a aucune valeur si la meule qui l'apporte
// n'est pas dans le sac. Ce module répond à la seule question qui décide de
// l'action du jour. Calcul pur — aucune dépendance React.

import { CraftKind, CraftLine } from '../types';
import { RUNE_EFFECT } from './effects';
import { RunePlan } from './runeOptim';

// Un consommable qu'un plan réclame. Pas de quantité : un plan ne demande
// jamais deux fois le même (une gemme par rune, une meule par substat).
export interface CraftNeed {
  kind: CraftKind;
  stat: number;
}

// Réserve indexée pour la question « me reste-t-il un X ? ».
//
// ⚠️ Les **quantités** sont suivies, pas seulement le meilleur grade possédé.
// Tant que la réserve venait uniquement de l'export elle était figée, et
// connaître le meilleur grade suffisait ; depuis qu'on peut **déclarer ce qu'on
// a dépensé** (voir `useCraftLedger`), un lot peut tomber à zéro et il faut
// alors se rabattre sur le grade au-dessus — ou constater qu'il n'y a plus rien.
export interface CraftStock {
  // `kind|set|stat|ancient` → lots restants, **par grade croissant**.
  lots: Map<string, { grade: number; reste: number }[]>;
  lignes: CraftLine[]; // la réserve telle qu'importée, avant dépenses
  total: number; // consommables restants, tous types confondus
}

const cle = (kind: CraftKind, setKey: string | null, stat: number, ancient: boolean) =>
  `${kind}|${setKey ?? '*'}|${stat}|${ancient ? 'a' : 'n'}`;

// `depenses` : quantités déjà utilisées en jeu, indexées par
// `kind|set|stat|grade|ancient` (voir `ledgerKey`). Une dépense qui dépasse le
// stock connu est simplement bornée à zéro — mieux vaut annoncer « plus rien »
// qu'un reste négatif.
export function buildCraftStock(
  lignes: CraftLine[],
  depenses: Record<string, number> = {}
): CraftStock {
  const lots = new Map<string, { grade: number; reste: number }[]>();
  let total = 0;
  for (const l of lignes) {
    const dep = depenses[`${l.kind}|${l.setKey ?? '*'}|${l.stat}|${l.grade}|${l.ancient ? 'a' : 'n'}`] ?? 0;
    const reste = Math.max(0, l.amount - dep);
    if (reste === 0) continue;
    total += reste;
    const k = cle(l.kind, l.setKey, l.stat, l.ancient);
    if (!lots.has(k)) lots.set(k, []);
    lots.get(k)!.push({ grade: l.grade, reste });
  }
  // ⚠️ Grades croissants : on sert un besoin héroïque avec un consommable
  // héroïque avant d'y brûler un légendaire.
  for (const v of lots.values()) v.sort((a, b) => a.grade - b.grade);
  return { lots, lignes, total };
}

export const EMPTY_STOCK: CraftStock = { lots: new Map(), lignes: [], total: 0 };

// Possède-t-on de quoi appliquer ce consommable sur cette rune, au grade
// demandé ou mieux ?
//
// ⚠️ Deux réserves à consulter, pas une : celle du set de la rune **et** les
// **immémoriaux**, qui vont sur n'importe quel set. Les oublier ferait passer
// pour infaisable un plan que le joueur peut lancer tout de suite.
//
// ⚠️ Les consommables antiques et normaux ne se mélangent pas : une rune
// antique n'accepte que de l'antique, et une rune normale n'accepte pas de
// l'antique. Aucun immémorial antique n'existe dans les données observées, donc
// une rune antique ne peut compter que sur les consommables de son set.
export function ownsCraft(
  stock: CraftStock,
  q: { kind: CraftKind; setKey: string; stat: number; grade: number; ancient: boolean }
): boolean {
  return pickCraft(stock, q) !== null;
}

// Le lot qui SERAIT utilisé pour ce besoin : le grade suffisant le plus bas, du
// stock propre au set d'abord, des immémoriaux ensuite. `null` = rien de
// disponible.
//
// ⚠️ C'est la MÊME règle qui décide de la faisabilité et de ce qu'on décompte
// quand l'utilisateur déclare avoir appliqué un plan. Deux règles distinctes
// finiraient par diverger : l'app annoncerait faisable en s'appuyant sur un lot,
// puis en retirerait un autre.
export function pickCraft(
  stock: CraftStock,
  q: { kind: CraftKind; setKey: string; stat: number; grade: number; ancient: boolean }
): { setKey: string | null; grade: number } | null {
  const dans = (setKey: string | null) => {
    for (const lot of stock.lots.get(cle(q.kind, setKey, q.stat, q.ancient)) ?? []) {
      if (lot.grade >= q.grade && lot.reste > 0) return { setKey, grade: lot.grade };
    }
    return null;
  };
  return dans(q.setKey) ?? (q.ancient ? null : dans(null));
}

// Ce qui manque pour appliquer le plan, dans l'ordre où le plan le demande.
// Liste vide = réalisable dès maintenant.
//
// ⚠️ Vérification **rune par rune, sans réserver le stock** : deux runes qui
// réclament la même unique meule VIT sont toutes deux annoncées faisables, ce
// qui est vrai de chacune. C'est en déclarant la première appliquée que la
// seconde disparaît.
export function missingCrafts(
  needs: CraftNeed[],
  rune: { set: string; rank: number },
  grade: number,
  stock: CraftStock
): CraftNeed[] {
  const ancient = rune.rank > 10;
  return needs.filter(
    (n) => !ownsCraft(stock, { kind: n.kind, setKey: rune.set, stat: n.stat, grade, ancient })
  );
}

// Grade de consommable exigé par un scénario : héroïque → 4, légendaire → 5.
export const GRADE_SCENARIO: Record<RunePlan['scenario'], number> = { hero: 4, legend: 5 };

// Les lots qui seraient consommés en appliquant ce plan, sous forme de clés de
// registre — c'est exactement ce qu'on décompte quand l'utilisateur déclare
// l'avoir fait en jeu. `null` si un besoin n'est pas couvert : dans ce cas le
// plan n'était pas applicable, on ne décompte rien du tout plutôt que la moitié.
export function craftsToSpend(
  needs: CraftNeed[],
  rune: { set: string; rank: number },
  grade: number,
  stock: CraftStock
): string[] | null {
  const ancient = rune.rank > 10;
  const out: string[] = [];
  for (const n of needs) {
    const lot = pickCraft(stock, { kind: n.kind, setKey: rune.set, stat: n.stat, grade, ancient });
    if (!lot) return null;
    out.push(`${n.kind}|${lot.setKey ?? '*'}|${n.stat}|${lot.grade}|${ancient ? 'a' : 'n'}`);
  }
  return out;
}

// « meule VIT », « gemme ATQ% » — de quoi lire ce qui manque sans décoder un code.
export function craftLabel(need: CraftNeed): string {
  const def = RUNE_EFFECT[need.stat];
  return `${need.kind === 'grind' ? 'meule' : 'gemme'} ${def?.label ?? `#${need.stat}`}`;
}
