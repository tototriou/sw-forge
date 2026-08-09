import { useMemo } from 'react';
import { X } from 'lucide-react';
import { RuneDetail, RUNE_SETS } from '../../types';
import RuneIcon from '../RuneIcon';

// Filtre multi-sélection par set de runes, **icônes seules**.
//
// Règle d'interface (voir ../../spec/compte/runes.md) : partout où l'on filtre
// sur les sets, on montre **l'icône du jeu sans le nom**. Les icônes sont
// reconnues d'un coup d'œil par n'importe quel joueur, alors que les libellés
// alignés sur une ligne font un mur de texte et limitent le nombre de sets
// visibles sans défilement. Le nom reste en infobulle et en `aria-label`.
export default function SetFilter({
  runes,
  value,
  onChange,
  label = 'Sets',
}: {
  runes: RuneDetail[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
}) {
  // Seulement les sets réellement présents dans l'inventaire : proposer un
  // filtre qui ne peut rien renvoyer n'aide personne.
  const present = useMemo(() => {
    const s = new Set(runes.map((r) => r.set));
    return RUNE_SETS.filter((rs) => s.has(rs.key));
  }, [runes]);

  const toggle = (key: string) => {
    const next = new Set(value);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">{label}</span>
      {present.map((s) => {
        const active = value.has(s.key);
        return (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            title={s.label}
            aria-label={s.label}
            aria-pressed={active}
            className={`flex items-center justify-center w-8 h-8 rounded-md border transition select-none
              ${
                active
                  ? 'bg-[#2b3170] border-[#4a52a0] shadow'
                  : 'bg-panel border-border opacity-55 hover:opacity-100 hover:border-[#4a52a0]'
              }`}
          >
            <RuneIcon setKey={s.key} size={18} />
          </button>
        );
      })}
      {/* Réinitialisation : même gabarit que les pastilles de set (32 px, même
          rayon, même bordure) pour ne pas casser la rangée, mais sans fond actif
          et virant au rouge au survol — c'est une action, pas un set de plus. */}
      {value.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          title="Effacer le filtre de sets"
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
