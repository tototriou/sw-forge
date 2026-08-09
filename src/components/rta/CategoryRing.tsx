// Anneau de catégories autour d'une carte de monstre.
//
// Une seule catégorie → anneau plein. Plusieurs → l'anneau est **découpé en
// autant de segments égaux** (2, 3 ou 4), pour qu'on voie d'un coup d'œil qu'un
// monstre cumule les rôles. Au-delà de 4, les segments deviendraient trop courts
// pour être distingués : c'est la raison du plafond (voir `useRtaCategories`).
//
// Technique : `conic-gradient` + masque « anneau » (deux calques composés en
// `exclude`), donc **aucun changement de structure** de la carte — pas de
// wrapper à intercaler, pas de bordure à repeindre, et le contour épouse les
// coins arrondis.
export default function CategoryRing({
  colors,
  radius = 'rounded-lg',
  width = 2,
}: {
  colors: string[];
  radius?: string;
  width?: number;
}) {
  if (colors.length === 0) return null;

  const step = 360 / colors.length;
  const background =
    colors.length === 1
      ? colors[0]
      : `conic-gradient(${colors
          .map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`)
          .join(', ')})`;

  const mask = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';

  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -inset-px ${radius}`}
      style={{
        background,
        padding: width,
        WebkitMask: mask,
        mask,
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    />
  );
}
