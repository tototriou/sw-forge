// Icônes officielles du jeu pour les trois inventaires : monstres, runes,
// artéfacts. Servies **en local** depuis `public/icons/` (récupérées une fois
// chez SWARFARM), comme les éléments, les sets et les leader skills — jamais de
// lien direct vers un serveur tiers.
//
// Pourquoi remplacer les pictogrammes génériques : un joueur reconnaît ses trois
// inventaires **instantanément** à leurs icônes du jeu. Un cube, un disque et une
// gemme dessinés par une bibliothèque d'icônes demandent, eux, de lire le
// libellé à côté.

export type GameIconKey = 'monster' | 'rune' | 'artifact';

const LABEL: Record<GameIconKey, string> = {
  monster: 'Monstres',
  rune: 'Runes',
  artifact: 'Artéfacts',
};

export default function GameIcon({
  name,
  size = 16,
  className = '',
}: {
  name: GameIconKey;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/${name}.png`}
      alt=""
      aria-label={LABEL[name]}
      width={size}
      height={size}
      draggable={false}
      // `flex-none` : ces icônes vivent dans des rangées en flex (nav, onglets),
      // où elles se feraient écraser à la première contrainte de largeur.
      className={`flex-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
