// Filtre multi-sélection par emplacement de rune (1 → 6).
//
// Partagé par Liste, Courbes et Optimisation, même grammaire visuelle que
// [SetFilter](SetFilter.tsx) (hauteur 32 px, même bordure) pour que les deux
// filtres se lisent comme une seule barre. Les slots sont **toujours les six** —
// contrairement aux sets, où l'on ne propose que ceux présents dans l'inventaire :
// un slot vide reste une information utile (« je n'ai rien en 2 »).
//
// ⚠️ **Pas de bouton « ✕ tout ».** Six cases se décochent d'un geste, une par
// une ; un raccourci de remise à zéro n'y gagnait rien et alourdissait la barre
// (là où il reste utile côté SETS, qui en aligne vingt-cinq).
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
    // `data-filtre-slots` : dans le panneau mobile, les six emplacements se
    // répartissent sur toute la largeur (voir index.css). Ailleurs, sans effet.
    <div data-filtre-slots className="flex flex-wrap items-center gap-1">
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
                    ? // ⚠️ Marqueur d'état UNIQUE de l'app (voir spec/shared/design.md) :
                      // contour d'accent + fond très léger. Le même que la pastille
                      // « Antiques » de la même rangée et que les filtres de Ma box —
                      // deux marqueurs différents côte à côte se liraient comme deux
                      // natures de filtre.
                      'bg-accent-soft border-accent text-ink'
                    : 'border-transparent text-ink-dim hoverable:text-ink hoverable:bg-panel2'
                }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
