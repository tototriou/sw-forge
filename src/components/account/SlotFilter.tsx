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
      <span className="label mr-1">{label}</span>
      <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-panel p-1">
        {SLOTS.map((n) => {
          const active = value.has(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              aria-pressed={active}
              // ⚠️ `data-cible-fine`, sans zone étendue : six pastilles alignées
              // à `gap-0.5`. Des cibles de 44 px se chevaucheraient et on
              // filtrerait le mauvais emplacement. C'est l'ESPACEMENT du groupe
              // qui protège du ratage — même choix que SetFilter juste à côté.
              data-cible-fine
              className={`w-7 h-7 rounded-md border text-xs font-mono font-semibold transition select-none
                ${
                  active
                    ? // ⚠️ Bordure seule (voir spec/shared/design.md) : ces
                      // numéros sont dans la MÊME rangée que le bouton
                      // « Antiques ». Deux marqueurs différents côte à côte se
                      // liraient comme deux natures de filtre.
                      'bg-panel border-accent text-ink'
                    : 'border-transparent text-ink-dim hoverable:text-ink hoverable:bg-panel2'
                }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {value.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          title="Effacer le filtre de slots"
          className="ml-1 flex h-8 items-center gap-1 rounded-md border border-border bg-panel px-2.5
                     text-micro font-semibold text-ink-dim transition
                     hoverable:border-fire/60 hoverable:text-fire"
        >
          <X size={12} className="flex-none" /> tout
        </button>
      )}
    </div>
  );
}
