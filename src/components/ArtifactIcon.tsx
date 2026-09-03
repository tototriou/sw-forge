import { ArtifactDetail } from '../types';

// Icônes officielles d'artéfacts (SWARFARM, servies en local).
// Attribut (`element`) → fire/water/wind/light/dark ·
// Type (`archetype`) → attack/defense/hp/support.
interface Props {
  artifact: ArtifactDetail;
  size?: number;
  className?: string;
}

export default function ArtifactIcon({ artifact, size = 22, className = '' }: Props) {
  // ⚠️ L'INTANGIBLE passe AVANT `element`/`archetype`, qui ne veulent rien dire
  // sur lui (com2us y met 98) : les lire d'abord donnait `null`, donc AUCUNE
  // icône — 34 artéfacts blancs dans un inventaire réel. Même ordre de test
  // que `artifactFitsMonster` (lib/artifacts.ts), et pour la même raison.
  //
  // Le glyphe est celui du set de runes INTANGIBLE — le jeu emploie le même
  // symbole pour les deux (voir `DOSSIER_GLYPHE`). La gemme (orange en
  // légendaire, violette en héroïque) et le cadre appartiennent à la tuile et
  // à la rareté, pas au symbole, comme pour les neuf autres icônes.
  const name = artifact.intangible
    ? 'intangible'
    : artifact.kind === 'element'
      ? artifact.element && artifact.element !== 'unknown'
        ? artifact.element
        : null
      : (artifact.archetype ?? null);
  if (!name) return null;
  return <ArtifactGlyph name={name} size={size} className={className} />;
}

// L'image seule, sans artéfact autour : les **filtres** doivent afficher la
// même icône que les tuiles alors qu'ils ne désignent qu'une valeur, pas un
// exemplaire. Fabriquer un `ArtifactDetail` factice juste pour ça donnerait un
// objet qui ne correspond à rien.
// ⚠️ **L'intangible n'a pas d'icône propre aux artéfacts** : c'est LE MÊME
// symbole que le set de runes du même nom. On pointe donc l'asset des runes
// plutôt que d'en déposer une copie sous `artifacts/` — deux fichiers
// pourraient diverger le jour où l'image est remplacée, alors que le jeu n'en
// a qu'une.
const DOSSIER_GLYPHE: Record<string, string> = { intangible: 'runes' };

export function ArtifactGlyph({
  name,
  size = 18,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}${DOSSIER_GLYPHE[name] ?? 'artifacts'}/${name}.png`}
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
