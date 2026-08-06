import { ElementKey } from '../types';

// Icônes officielles des éléments (récupérées de SWARFARM, servies en local).
const HAS_ICON = new Set<ElementKey>(['fire', 'water', 'wind', 'light', 'dark']);

interface Props {
  element: ElementKey;
  size?: number;
  className?: string;
}

export default function ElementIcon({ element, size = 18, className = '' }: Props) {
  if (!HAS_ICON.has(element)) return null;
  return (
    <img
      src={`${import.meta.env.BASE_URL}elements/${element}.png`}
      alt={element}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
