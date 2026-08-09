import { X } from 'lucide-react';

// Filtre multi-sélection par emplacement de rune (1 → 6).
//
// Partagé par Liste, Courbes et Optimisation, comme
// [SetFilter](SetFilter.tsx) : même grammaire visuelle (hauteur 32 px, même
// bordure, même bouton « ✕ tout »), pour que les deux filtres se lisent comme
// une seule barre. Les slots sont **toujours les six** — contrairement aux sets,
// où l'on ne propose que ceux présents dans l'inventaire : un slot vide reste
// une information utile (« je n'ai rien en 2 »).
const SLOTS = [1, 2, 3, 4, 5, 6];

export default function SlotFilter({
  value,
  onChange,
  label = 'Slot',
}: {
  value: Set<number>;
  onChange: (next: Set<number>) => void;
  label?: string;
}) {
  const toggle = (n: number) => {
    const next = new Set(value);
    next.has(n) ? next.delete(n) : next.add(n);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">{label}</span>
      {SLOTS.map((n) => {
        const active = value.has(n);
        return (
          <button
            key={n}
            onClick={() => toggle(n)}
            aria-pressed={active}
            className={`w-8 h-8 rounded-md border text-[12.5px] font-mono font-semibold transition select-none
              ${
                active
                  ? 'bg-[#2b3170] border-[#4a52a0] text-ink shadow'
                  : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
              }`}
          >
            {n}
          </button>
        );
      })}
      {value.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          title="Effacer le filtre de slots"
          className="ml-1 flex h-8 items-center gap-1 rounded-md border border-border bg-panel px-2.5
                     text-[11px] font-semibold text-ink-dim transition
                     hover:border-fire/60 hover:text-fire"
        >
          <X size={12} className="flex-none" /> tout
        </button>
      )}
    </div>
  );
}
