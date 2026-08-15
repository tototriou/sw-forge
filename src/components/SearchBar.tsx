import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-dim" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher un monstre par nom…"
        // ⚠️ Pas de halo `focus:shadow` en plus de la bordure : il s'ajoutait à
        // l'anneau `:focus-visible` global, ce qui faisait TROIS traits d'accent
        // concentriques autour du champ. La bordure marque le champ actif,
        // l'anneau global dit où est le clavier — voir spec/shared/design.md.
        className="w-full bg-panel border border-border rounded-xl py-3.5 pl-11 pr-4 text-[15px]
                   text-ink placeholder:text-ink-dim transition focus:border-accent"
      />
    </div>
  );
}
