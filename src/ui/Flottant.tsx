import { ReactNode, forwardRef } from 'react';

// Surface qui FLOTTE au-dessus de la page, ancrée à ce qui l'a ouverte : la
// popup d'édition d'une catégorie, le formulaire de création d'un monstre, la
// liste de résultats d'une recherche.
//
// ⚠️ **C'est la seule chose de l'app qui a le droit à une OMBRE.** L'élévation
// dit « je suis au-dessus, et je vais repartir » — c'est faux d'un bouton actif
// ou d'une carte sélectionnée, qui appartiennent à la page. Trois écrans
// recopiaient les mêmes `shadow-glow shadow-black/60`, et le jour où l'un
// d'eux ne l'a pas fait, il a paru collé au contenu qu'il recouvrait.
//
// ⚠️ **Le `z-index` est un ORDRE, pas un nombre libre.** L'échelle de l'app —
// contenu → barre du haut (20) → flottants (30) → onglets mobiles (40) →
// panneau montant (50) → panneau de second niveau (60) → dialogues (70) — se
// règle ici pour tout ce qui flotte au-dessus de la page. Un `z-40` écrit à la
// main « pour que ça passe devant » se retrouve un jour derrière la barre
// d'onglets, et personne ne sait plus quelle valeur est la bonne.
//
// ⚠️ **`origin-top-left` avec l'animation** : une surface qui grandit depuis son
// centre semble arriver de nulle part. Depuis le coin où elle est ancrée, elle
// dit d'où elle vient — donc à quoi elle se rapporte.
//
// Ce composant ne s'occupe PAS du placement (`left`, `top`) : il est posé dans
// un parent `relative`, et le recalage à l'écran reste au hook
// [useRecalageEcran](../hooks/useRecalageEcran.ts), qui a besoin de mesurer.

export interface FlottantProps {
  children: ReactNode;
  // Rembourrage intérieur. `aucun` pour une LISTE, dont les entrées doivent
  // toucher les bords — un rembourrage y laisse une bande morte au survol, et
  // l'entrée surlignée paraît décalée de son cadre.
  rembourrage?: 'aucun' | 'sm' | 'md';
  // Largeur. Par défaut celle du parent (`w-full`), ce qui convient à une liste
  // de résultats posée sous son champ ; une popup ancrée à un bouton étroit
  // fixe la sienne.
  largeur?: string;
  // Ancrage : sous l'élément (défaut) ou collé à son bord haut.
  //
  // ⚠️ Décide AUSSI du sens de l'animation, qui doit partir du point d'ancrage
  // — sans quoi la surface semble arriver du mauvais côté.
  ancrage?: 'dessous' | 'dessus';
  style?: React.CSSProperties;
  className?: string;
  role?: string;
  'aria-label'?: string;
}

const REMBOURRAGES = { aucun: '', sm: 'p-2.5', md: 'p-3' } as const;

const Flottant = forwardRef<HTMLDivElement, FlottantProps>(function Flottant(
  {
    children,
    rembourrage = 'md',
    largeur = 'w-full',
    ancrage = 'dessous',
    style,
    className = '',
    ...reste
  },
  ref,
) {
  return (
    <div
      ref={ref}
      style={style}
      // ⚠️ `left-0` explicite : le recalage à l'écran s'exprime en `left`, qui
      // n'a de sens que si l'ancrage horizontal est posé. Sans lui
      // (`left: auto`), une valeur négative ne décale pas — elle repositionne
      // depuis un bord que le navigateur choisit seul.
      className={`absolute left-0 z-30 rounded-xl border border-border bg-panel
        shadow-glow shadow-black/60 ${largeur} ${REMBOURRAGES[rembourrage]} ${
          ancrage === 'dessous'
            ? 'top-full mt-1.5 origin-top-left'
            : 'bottom-full mb-1.5 origin-bottom-left'
        } animate-[popover_150ms_var(--ease-out)] ${className}`}
      {...reste}
    >
      {children}
    </div>
  );
});

export default Flottant;
