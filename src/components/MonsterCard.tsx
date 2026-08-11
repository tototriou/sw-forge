import { useState } from 'react';
import { motion } from 'framer-motion';
import { Monster } from '../types';
import ElementIcon from './ElementIcon';

const BORDER: Record<string, string> = {
  fire: 'hoverable:border-fire hoverable:shadow-lg hoverable:shadow-fire-glow/40',
  water: 'hoverable:border-water hoverable:shadow-lg hoverable:shadow-water-glow/40',
  wind: 'hoverable:border-wind hoverable:shadow-lg hoverable:shadow-wind-glow/40',
  light: 'hoverable:border-light hoverable:shadow-lg hoverable:shadow-light-glow/40',
  dark: 'hoverable:border-dark hoverable:shadow-lg hoverable:shadow-dark-glow/40',
  unknown: 'hoverable:border-unknown hoverable:shadow-lg hoverable:shadow-unknown-glow/40',
};

const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};

const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function MonsterCard({ monster }: { monster: Monster }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = monster.image && !imgFailed;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -4 }}
      className={`group relative rounded-2xl border border-border bg-panel px-2.5 pt-3.5 pb-3 text-center
        transition-colors shadow-none ${BORDER[monster.element]}`}
    >
      <div className="relative w-[84px] mx-auto mb-2.5">
        <div
          className={`hex-frame w-[84px] h-[84px] p-[3px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
        >
          <div className="hex-frame w-full h-full bg-panel2 flex items-center justify-center overflow-hidden">
            {showImage ? (
              <img
                src={monster.image!}
                alt={monster.name}
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={`font-display font-bold text-2xl ${TEXT[monster.element]}`}>
                {initials(monster.name)}
              </span>
            )}
          </div>
        </div>
        <ElementIcon
          element={monster.element}
          size={22}
          className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        />
      </div>

      <div className="text-star text-[11px] tracking-[-1px] mb-1.5">
        {monster.stars ? '★'.repeat(monster.stars) : '—'}
      </div>
      <div className="text-[13px] font-semibold leading-tight">{monster.name}</div>
    </motion.div>
  );
}
