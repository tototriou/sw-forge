import { useState } from 'react';
import { RTA_OTHER, RTA_UNASSIGNED } from '../types';

// Sections spéciales sans set de runes associé → pas d'icône.
const NO_ICON = new Set<string>([RTA_OTHER, RTA_UNASSIGNED]);

interface Props {
  setKey: string;
  size?: number;
  className?: string;
  tintColor?: string; // si défini, le symbole est teinté de cette couleur (mask CSS)
  filter?: string; // filtre CSS appliqué à l'image (ex. colorisation orange)
}

// Icônes officielles des sets de runes (récupérées de SWARFARM, servies en local).
export default function RuneIcon({ setKey, size = 20, className = '', tintColor, filter }: Props) {
  const [failed, setFailed] = useState(false);
  if (NO_ICON.has(setKey)) return null;

  // Teinte : on utilise l'alpha du PNG comme masque, rempli de la couleur voulue.
  if (tintColor) {
    const url = `${import.meta.env.BASE_URL}runes/${setKey}.png`;
    return (
      <span
        aria-label={setKey}
        title={setKey}
        className={className}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          backgroundColor: tintColor,
          WebkitMaskImage: `url(${url})`,
          maskImage: `url(${url})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    );
  }

  // Repli si l'image n'existe pas (set inconnu) : petit losange avec l'initiale.
  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded bg-panel2 border border-border text-ink-dim font-mono ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.4) }}
        title={setKey}
      >
        {setKey.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`${import.meta.env.BASE_URL}runes/${setKey}.png`}
      alt={setKey}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
      style={{ width: size, height: size, filter }}
    />
  );
}
