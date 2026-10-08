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
import { MARQUEUR_FILTRE_ACTIF } from '../../ui/Pastille';
import { ACTIF_FILTRE_LG, CADRE_FILTRE_LG, CASE_FILTRE_LG } from './gabaritFiltre';

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
      {/* À la SOURIS, le gabarit du `Segmented` : voir gabaritFiltre.ts. */}
      <div className={`flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-panel p-1 ${CADRE_FILTRE_LG}`}>
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
              className={`w-7 h-7 rounded-md border text-xs font-mono font-semibold transition select-none ${CASE_FILTRE_LG}
                ${
                  active
                    ? // ⚠️ Marqueur d'état UNIQUE des filtres (voir docs/03-developpeur/interface/),
                      // importé de `Pastille` : le même que les filtres de Ma box et
                      // des sets — deux marqueurs différents côte à côte se liraient
                      // comme deux natures de filtre. À la souris, celui du
                      // `Segmented` voisin (gabaritFiltre.ts), pour la même raison.
                      `${MARQUEUR_FILTRE_ACTIF} ${ACTIF_FILTRE_LG}`
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
