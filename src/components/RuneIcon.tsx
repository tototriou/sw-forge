import { RTA_OTHER, RTA_UNASSIGNED } from '../types';

// Sections spéciales sans set de runes associé → pas d'icône.
const NO_ICON = new Set<string>([RTA_OTHER, RTA_UNASSIGNED]);

interface Props {
  setKey: string;
  size?: number;
  className?: string;
}

// Icônes officielles des sets de runes (récupérées de SWARFARM, servies en local).
export default function RuneIcon({ setKey, size = 20, className = '' }: Props) {
  if (NO_ICON.has(setKey)) return null;
  return (
    <img
      src={`${import.meta.env.BASE_URL}runes/${setKey}.png`}
      alt={setKey}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
