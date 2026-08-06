import { useState } from 'react';
import { motion } from 'framer-motion';
import { Monster } from '../types';

const BORDER: Record<string, string> = {
  fire: 'hover:border-fire hover:shadow-lg hover:shadow-fire-glow/40',
  water: 'hover:border-water hover:shadow-lg hover:shadow-water-glow/40',
  wind: 'hover:border-wind hover:shadow-lg hover:shadow-wind-glow/40',
  light: 'hover:border-light hover:shadow-lg hover:shadow-light-glow/40',
  dark: 'hover:border-dark hover:shadow-lg hover:shadow-dark-glow/40',
  unknown: 'hover:border-unknown hover:shadow-lg hover:shadow-unknown-glow/40',
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
      <div
        className={`hex-frame w-[84px] h-[84px] mx-auto mb-2.5 p-[3px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
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

      <div className="text-star text-[11px] tracking-[-1px] mb-1.5">
        {monster.stars ? '★'.repeat(monster.stars) : '—'}
      </div>
      <div className="text-[13px] font-semibold leading-tight mb-0.5">{monster.name}</div>
      <div className={`font-mono text-[10px] tracking-[0.08em] uppercase ${TEXT[monster.element]}`}>
        {monster.element}
      </div>
    </motion.div>
  );
}
