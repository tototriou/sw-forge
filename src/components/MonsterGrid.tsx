import { AnimatePresence } from 'framer-motion';
import { ElementDef, Monster } from '../types';
import MonsterCard from './MonsterCard';
import ElementIcon from './ElementIcon';

interface Props {
  elementDef: ElementDef;
  monsters: Monster[];
}

export default function MonsterGrid({ elementDef, monsters }: Props) {
  if (monsters.length === 0) return null;

  return (
    <section className="mt-9">
      <div className="flex items-center gap-3 pb-2.5 mb-4 border-b border-border">
        <ElementIcon element={elementDef.key} size={22} />
        <h2 className="font-display text-[19px] tracking-wide">{elementDef.label}</h2>
        <span className="font-mono text-ink-dim text-xs ml-auto">
          {monsters.length} monstre{monsters.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4">
        <AnimatePresence mode="popLayout">
          {monsters.map((m) => (
            <MonsterCard key={m.id} monster={m} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
