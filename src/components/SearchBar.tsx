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
        className="w-full bg-panel border border-border rounded-xl py-3.5 pl-11 pr-4 text-[15px]
                   text-ink placeholder:text-ink-dim outline-none transition
                   focus:border-accent focus:shadow-[0_0_0_3px_rgba(91,99,184,0.2)]"
      />
    </div>
  );
}
