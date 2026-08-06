import { useEffect, useRef, useState } from 'react';
import { Plus, X, Wand2 } from 'lucide-react';
import { ELEMENTS, ElementKey, Monster } from '../types';
import ElementIcon from './ElementIcon';

const ELEMENT_CHOICES = ELEMENTS.filter((e) => e.key !== 'unknown');

interface Props {
  onCreate: (name: string, element: ElementKey, speed: number) => void;
  customMonsters: Monster[];
  onDelete: (id: string) => void;
}

// Bouton + formulaire pour créer un monstre perso (nom, élément, SPD de base).
export default function CreateMonster({ onCreate, customMonsters, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [element, setElement] = useState<ElementKey>('fire');
  const [speed, setSpeed] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Ferme la popup au clic à l'extérieur ou sur Échap.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const speedNum = Number(speed);
  const valid = name.trim().length > 0 && speed !== '' && Number.isFinite(speedNum) && speedNum > 0;

  function submit() {
    if (!valid) return;
    onCreate(name, element, speedNum);
    setName('');
    setSpeed('');
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[12.5px]
                   text-ink-dim hover:text-ink hover:border-[#4a52a0] transition"
      >
        <Wand2 size={13} /> Créer un monstre
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-panel p-3 shadow-glow shadow-black/60">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
              Nouveau monstre
            </span>
            <button onClick={() => setOpen(false)} className="text-ink-dim hover:text-ink" aria-label="Fermer">
              <X size={14} />
            </button>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du monstre"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-[13px] text-ink
                       placeholder:text-ink-dim outline-none focus:border-[#5b63b8] mb-2"
          />

          <div className="flex gap-2 mb-2.5">
            <select
              value={element}
              onChange={(e) => setElement(e.target.value as ElementKey)}
              className="flex-1 bg-panel2 border border-border rounded-lg px-2.5 py-2 text-[13px] text-ink outline-none"
            >
              {ELEMENT_CHOICES.map((el) => (
                <option key={el.key} value={el.key}>
                  {el.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              placeholder="SPD base"
              className="w-24 bg-panel2 border border-border rounded-lg px-2.5 py-2 text-[13px] text-ink
                         placeholder:text-ink-dim outline-none focus:border-[#5b63b8]"
            />
          </div>

          <button
            onClick={submit}
            disabled={!valid}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#3a4270] to-[#272e52]
                       px-3 py-2 text-[13px] font-semibold text-ink disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Créer
          </button>

          {customMonsters.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">
                Mes monstres perso
              </span>
              <ul className="mt-1.5 flex flex-col gap-1 max-h-40 overflow-y-auto">
                {customMonsters.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-[12.5px]">
                    <ElementIcon element={m.element} size={15} className="flex-none" />
                    <span className="truncate flex-1">{m.name}</span>
                    <span className="font-mono text-ink-dim">SPD {m.stats.speed ?? '—'}</span>
                    <button
                      onClick={() => onDelete(String(m.id))}
                      className="text-ink-dim hover:text-fire flex-none"
                      title="Supprimer"
                      aria-label="Supprimer"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
