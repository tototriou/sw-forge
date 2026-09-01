import { RotateCw } from 'lucide-react';
import { EffectLine } from '../types';
import { splitArtifactSub } from '../lib/effects';

// Une sous-propriété d'artéfact, rendue comme dans le jeu : le nombre de procs
// à gauche, le libellé avec sa VALEUR EN GRAS, et le marqueur des propriétés
// modifiées.
//
// ⚠️ **Extrait de `account/ArtifactsList.tsx`, où il était écrit en ligne.**
// Le bloc « Meilleurs artéfacts pour ce build » de l'Optimizer aplatissait les
// quatre propriétés sur UNE ligne séparée par des « · », avec son propre
// formatage (`artifactSubLabel(...).replace('X', …)`) — deux rendus de la même
// donnée, dont un seul ressemblait au jeu. Un seul composant désormais : c'est
// la règle du dépôt (« deux tables de libellés auraient divergé »).
export default function ArtifactSubLigne({
  sub,
  vise = false,
}: {
  sub: EffectLine;
  /**
   * Ligne RECHERCHÉE (écho d'un filtre) — un liseré d'accent et un fond à
   * 8 %, rien de plus. Propre à l'inventaire, où l'œil balaie 60 tuiles de 4
   * lignes et doit savoir OÙ regarder sans que la ligne se mette à crier.
   * Colorer le texte lui-même le rendrait moins lisible que les trois autres,
   * alors que ce n'est pas un état de la donnée mais un écho du filtre.
   */
  vise?: boolean;
}) {
  const procs = sub.rolls ?? 0;
  const { avant, valeur, apres } = splitArtifactSub(sub);
  return (
    <div
      // ⚠️ Marges négatives + `pl-[2px]`, et AUCUNE marge verticale : le liseré
      // de 2 px et le fond débordent dans la gouttière de la tuile, la pastille
      // de procs reste sur LA MÊME colonne, et les 4 lignes gardent leur
      // `space-y-[3px]`. Toute compensation oubliée — largeur ou hauteur —
      // décale la ligne visée par rapport aux trois autres, et c'est ce
      // décalage qu'on voit en premier au lieu de la propriété.
      className={`flex items-start gap-1.5 text-micro leading-tight ${
        vise ? '-mx-1 rounded border-l-2 border-accent bg-accent/[0.08] pl-[2px] pr-1' : ''
      }`}
    >
      {/* ⚠️ Largeur FIXE : sans elle, la pastille se dimensionnait sur son
          contenu et les libellés démarraient à deux colonnes différentes selon
          que la ligne portait 0 ou 4 procs. */}
      <span
        className={`mt-px w-[14px] flex-none rounded text-center font-mono text-micro font-bold tabular-nums ${
          procs > 0 ? 'bg-good/20 text-good' : 'bg-ink-dim/15 text-ink-dim'
        }`}
      >
        {procs}
      </span>
      {/* Deux lignes au plus : les libellés longs (« Dgts supp. en prop. de
          ATQ ») ne doivent pas faire grandir la tuile au point de casser
          l'alignement de la grille. */}
      <span className="flex-1 text-ink-dim line-clamp-2">
        {avant}
        <b className="text-ink">{valeur}</b>
        {apres}
      </span>
      {/* Substat MODIFIÉ (converti dans le jeu). */}
      {sub.enchant && (
        <span className="mt-0.5 flex-none" title="Propriété modifiée">
          <RotateCw size={9} className="text-orange-400" />
        </span>
      )}
    </div>
  );
}
