import { useId } from 'react';
import type { Langue } from '../i18n';

// Le drapeau d'une langue de l'interface, devant son nom dans le réglage
// « Langue » (docs/02-app/transverse/feat-langues.md).
//
// ⚠️ **En SVG, pas en émoji** : Windows n'affiche pas les émojis drapeaux, il
// montre les deux lettres du pays (« FR », « GB »).
// ⚠️ **Ses propres couleurs**, pas `currentColor` ni les tokens : un drapeau se
// reconnaît à ses couleurs, comme un rendu du jeu. Toujours au format 3:2 ; le
// drapeau britannique, en 2:1, est recadré au centre.
// ⚠️ L'anglais porte le drapeau du Royaume-Uni.

type Props = { langue: Langue; className?: string };

export default function DrapeauLangue({ langue, className = '' }: Props) {
  const id = useId();
  return (
    <svg
      width={18}
      height={12}
      viewBox={langue === 'fr' ? '0 0 3 2' : '0 0 60 30'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      data-drapeau={langue}
      className={`flex-none rounded-[2px] ring-1 ring-border ${className}`}
    >
      {langue === 'fr' ? (
        <>
          <rect width="1" height="2" fill="#002654" />
          <rect x="1" width="1" height="2" fill="#FFFFFF" />
          <rect x="2" width="1" height="2" fill="#CE1126" />
        </>
      ) : (
        <>
          <clipPath id={`${id}-croix`}>
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
          </clipPath>
          <rect width="60" height="30" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}-croix)`} stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </>
      )}
    </svg>
  );
}
