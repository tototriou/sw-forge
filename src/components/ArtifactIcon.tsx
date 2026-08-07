import { ArtifactDetail } from '../types';

// Icônes officielles d'artéfacts (SWARFARM, servies en local).
// Élément → fire/water/wind/light/dark · Archétype → attack/defense/hp/support.
interface Props {
  artifact: ArtifactDetail;
  size?: number;
  className?: string;
}

export default function ArtifactIcon({ artifact, size = 22, className = '' }: Props) {
  const name =
    artifact.kind === 'element'
      ? artifact.element && artifact.element !== 'unknown'
        ? artifact.element
        : null
      : artifact.archetype ?? null;
  if (!name) return null;
  return (
    <img
      src={`${import.meta.env.BASE_URL}artifacts/${name}.png`}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
