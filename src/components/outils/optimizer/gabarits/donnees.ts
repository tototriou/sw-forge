import type { ContexteGabarits } from './types';
import type { GearSet, Monster } from '../../../../types';

// L'exemplaire montré par les gabarits des colonnes et de la colonne de
// droite : celui de l'Optimizer s'il y en a un, sinon le premier monstre
// équipé de la Box (un navigateur neuf n'a pas de monstre choisi). Toujours un
// exemplaire RÉEL du compte importé, jamais fabriqué.
export function exemplaireDuCompte(ctx: ContexteGabarits): { monster: Monster; gear: GearSet; unitKey: string } | null {
  const id = ctx.optimizer.selectedId;
  const item = (id ? ctx.box.find((b) => String(b.monster.id) === id && b.gear) : undefined) ?? ctx.box.find((b) => b.gear);
  return item?.gear ? { monster: item.monster, gear: item.gear, unitKey: item.key } : null;
}
