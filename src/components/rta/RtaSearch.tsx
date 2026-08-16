import { useId, useMemo, useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { Monster } from '../../types';
import MonsterAvatar from '../MonsterAvatar';
import { formesJouables } from '../../lib/monsterForms';
import { useComboboxNav } from '../../hooks/useComboboxNav';

interface Props {
  monsters: Monster[];
  addedIds: Set<string>;
  onAdd: (id: string) => void;
}

const MAX_RESULTS = 25;

// Recherche d'un monstre à ajouter à la prépa RTA.
//
// ⚠️ **Enchaîner les ajouts est le geste principal.** On monte une prépa en
// tapant dix noms d'affilée : chaque ajout vide le champ et rend le focus, prêt
// pour le suivant, sans jamais toucher la souris.
//
// La navigation au clavier vit dans
// [useComboboxNav](src/hooks/useComboboxNav.ts), partagé avec
// [MonsterPicker](src/components/MonsterPicker.tsx).
export default function RtaSearch({ monsters, addedIds, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const idBase = useId();

  // Seules les formes JOUABLES (voir lib/monsterForms.ts) : pas de forme non
  // éveillée, et la 2A remplace l'éveillée simple là où elle existe.
  const jouables = useMemo(() => formesJouables(monsters), [monsters]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Monster[] = [];
    for (const m of jouables) {
      if (m.name.toLowerCase().includes(q)) {
        out.push(m);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [jouables, query]);

  const nav = useComboboxNav<Monster>({
    results,
    query,
    setQuery,
    idBase,
    // Un monstre déjà en prépa reste affiché (l'information est utile) mais
    // n'est pas sélectionnable.
    estDesactive: (m) => addedIds.has(String(m.id)),
    // Le hook vide le champ et rend le focus après validation.
    onValider: (m) => onAdd(String(m.id)),
  });

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-dim sm:left-4 sm:w-[18px] sm:h-[18px]" />
      <input
        {...nav.inputProps}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un monstre à ajouter à ta prépa RTA…"
        // Bordure seule au focus, sans halo : voir spec/shared/design.md.
        // ⚠️ Plus BASSE sous `sm` (40 px contre 56) : à `py-3.5` et `text-base`
        // elle mangeait un sixième de la hauteur utile d'un téléphone, avant
        // même le premier monstre. 40 px reste la cible tactile pleine — c'est
        // le rembourrage décoratif qui tombe, pas la zone touchable.
        className="w-full bg-panel border border-border rounded-xl py-2 pl-9 pr-3 text-sm
                   sm:py-3.5 sm:pl-11 sm:pr-4 sm:text-base
                   text-ink placeholder:text-ink-dim transition focus:border-accent"
      />

      {nav.open && (
        <div
          {...nav.listProps}
          aria-label="Résultats de la recherche"
          className="absolute z-20 mt-2 w-full max-h-[360px] overflow-y-auto rounded-xl border border-border
                     bg-panel shadow-glow shadow-black/60"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-ink-dim text-sm">Aucun monstre trouvé.</div>
          ) : (
            results.map((m, i) => {
              const added = addedIds.has(String(m.id));
              const estActif = i === nav.actif;
              return (
                <div
                  key={m.id}
                  {...nav.optionProps(i)}
                  aria-disabled={added}
                  // onMouseDown (pas onClick) pour agir avant le blur de l'input
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (added) return;
                    onAdd(String(m.id));
                    nav.reinitialiser();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition
                    ${added ? 'opacity-50 cursor-default' : 'cursor-pointer'}
                    ${estActif && !added ? 'bg-accent-soft' : ''}`}
                >
                  {/* Portrait : le nom ne suffit pas à distinguer les formes
                      d'un même monstre (voir MonsterAvatar). */}
                  <MonsterAvatar monster={m} size={30} />
                  <span className="text-sm font-medium truncate flex-1">{m.name}</span>
                  {m.stars ? (
                    <span className="font-mono text-micro text-star">{m.stars}★</span>
                  ) : null}
                  <span className="font-mono text-micro text-ink-dim w-16 text-right">
                    SPD {m.stats.speed ?? '—'}
                  </span>
                  {added ? (
                    <Check size={15} className="text-good flex-none" />
                  ) : (
                    <Plus size={15} className={`flex-none ${estActif ? 'text-accent' : 'text-ink-dim'}`} />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
