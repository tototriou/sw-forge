import { Monster } from '../types';
import ElementIcon from './ElementIcon';

// Portrait hexagonal d'un monstre + pastille d'élément.
//
// Pourquoi un composant partagé : le nom NE SUFFIT PAS à identifier un monstre.
// Plusieurs entrées portent le même nom et le même élément (formes 2A, variantes
// d'un même monstre) — chercher « Tarq » en renvoie trois. Seul le portrait
// permet de choisir la bonne, donc toute liste où l'on sélectionne un monstre
// doit l'afficher. Voir ../../spec/shared/donnees-monstres.md.

const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};
const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function MonsterAvatar({
  monster,
  fallback,
  size = 30,
  element = true,
  className = '',
  children,
}: {
  monster: Monster | null;
  fallback?: string; // nom de repli quand le monstre est absent des données
  size?: number;
  element?: boolean; // pastille d'élément (on la coupe si l'élément est déjà lisible ailleurs)
  className?: string;
  children?: React.ReactNode; // badges supplémentaires posés sur le portrait (lead…)
}) {
  const nom = monster?.name || fallback || '?';
  const el = monster?.element ?? 'unknown';
  return (
    <span
      className={`relative flex-none ${className}`}
      style={{ width: size, height: size }}
      title={nom}
    >
      <span className={`hex-frame block w-full h-full p-[2px] bg-gradient-to-br ${GRADIENT[el]}`}>
        <span className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
          {monster?.image ? (
            <img src={monster.image} alt={nom} className="w-full h-full object-cover" />
          ) : (
            <span
              className={`font-display font-bold ${TEXT[el]}`}
              style={{ fontSize: Math.max(7, size * 0.3) }}
            >
              {initials(nom)}
            </span>
          )}
        </span>
      </span>
      {element && monster && (
        <ElementIcon
          element={monster.element}
          size={Math.round(size * 0.42)}
          className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        />
      )}
      {children}
    </span>
  );
}
