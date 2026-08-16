import { useState } from 'react';
import { X } from 'lucide-react';
import { RUNE_SETS } from '../../types';
import { canAddSet, setsCost } from '../../lib/effects';
import RuneIcon from '../RuneIcon';

interface Props {
  sets: string[]; // combo courant (une entrée par activation, ex. ['violent','will'])
  onChange: (sets: string[]) => void;
}

// Sélecteur du combo de sets recherché — UN SEUL combo (contrairement aux
// recommandations de siège, qui proposent plusieurs possibilités au choix).
// Même comportement que le picker de RecoCard.tsx (grille d'icônes, jamais un
// menu déroulant — on reconnaît un set à son symbole), réécrit en plus simple
// pour ne pas toucher au code du siège.
export default function SetComboPicker({ sets, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const used = setsCost(sets);
  const full = !RUNE_SETS.some((s) => canAddSet(sets, s.key));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {sets.map((key, i) => {
          const def = RUNE_SETS.find((s) => s.key === key);
          return (
            <span
              key={`${key}-${i}`}
              className="flex items-center gap-1 rounded-full border border-border bg-panel2 pl-1.5 pr-1 py-0.5 text-micro font-semibold"
            >
              <RuneIcon setKey={key} size={14} />
              {def?.label ?? key}
              <button
                type="button"
                onClick={() => onChange(sets.filter((_, j) => j !== i))}
                aria-label={`Retirer ${def?.label ?? key}`}
                className="rounded-full p-0.5 text-ink-dim transition hoverable:text-bad"
              >
                <X size={11} />
              </button>
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={full}
          className="rounded-full border border-border bg-panel px-2 py-1 text-micro font-semibold text-ink-dim
                     transition hoverable:text-ink hoverable:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {full ? 'Plus de place (6 runes)' : '+ Set'}
        </button>
        <span className="font-mono text-micro text-ink-dim">{used}/6 runes</span>
      </div>

      {open && !full && (
        <div className="mt-1.5 rounded-lg border border-border bg-panel p-1.5">
          <div className="flex flex-wrap gap-1">
            {RUNE_SETS.map((s) => {
              const fits = canAddSet(sets, s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={!fits}
                  onClick={() => {
                    const next = [...sets, s.key];
                    onChange(next);
                    if (!RUNE_SETS.some((st) => canAddSet(next, st.key))) setOpen(false);
                  }}
                  title={s.label}
                  // ⚠️ `data-cible-fine` : grille serrée d'icônes de set, où
                  // une cible de 44 px déborderait sur la voisine. L'icône reste
                  // reconnaissable à 32 px, c'est ce qui compte.
                  data-cible-fine
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-panel2
                             transition hoverable:border-accent disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  <RuneIcon setKey={s.key} size={20} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
