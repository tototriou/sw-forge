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
  // Ancrage VERTICAL : sous l'élément (défaut) ou au-dessus.
  //
  // ⚠️ Décide AUSSI du sens de l'animation, qui doit partir du point d'ancrage
  // — sans quoi la surface semble arriver du mauvais côté.
  ancrage?: 'dessous' | 'dessus';
  // Ancrage HORIZONTAL : aligné à gauche de l'ancre (défaut) ou à droite.
  //
  // ⚠️ `droite` sert quand l'ancre est près du bord de l'écran : la surface
  // s'ouvre alors vers l'intérieur. Voir [FlottantAuto](FlottantAuto.tsx), qui
  // choisit ce côté tout seul en mesurant.
  cote?: 'gauche' | 'droite';
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
    cote = 'gauche',
    style,
    className = '',
    ...reste
  },
  ref,
) {
  // ⚠️ L'ORIGINE de l'animation suit le point d'ancrage : la surface grandit du
  // coin d'où elle sort, jamais depuis son centre — sinon elle paraît arriver de
  // nulle part. Et jamais depuis `scale(0)`, voir spec/shared/design.md.
  //
  // ⚠️ Les quatre classes sont écrites EN TOUTES LETTRES : Tailwind lit le code
  // source comme du texte, il ne l'exécute pas. Une classe assemblée à la volée
  // (`origin-${x}-${y}`) n'apparaît nulle part dans le fichier, donc la règle
  // correspondante n'est jamais émise — et l'animation part du centre sans que
  // rien ne le signale.
  const origine =
    ancrage === 'dessous'
      ? cote === 'gauche'
        ? 'origin-top-left'
        : 'origin-top-right'
      : cote === 'gauche'
        ? 'origin-bottom-left'
        : 'origin-bottom-right';

  return (
    <div
      ref={ref}
      style={style}
      // ⚠️ L'ancrage horizontal est TOUJOURS posé (`left-0` ou `right-0`) : le
      // recalage à l'écran s'exprime en `left`, qui n'a de sens que si le côté
      // est fixé. Sans lui (`left: auto`), une valeur négative ne décale pas —
      // elle repositionne depuis un bord que le navigateur choisit seul.
      // ⚠️ `overflow-hidden` : sans rembourrage, le contenu touche les bords et
      // ses coins carrés dépassaient de l'arrondi du cadre — quatre petits
      // ergots aux angles. C'est le cas de toute LISTE (`rembourrage="aucun"`),
      // dont les entrées doivent atteindre le bord pour que le survol ne laisse
      // pas de bande morte.
      className={`absolute z-30 overflow-hidden rounded-xl border border-border bg-panel
        shadow-glow shadow-black/60 ${largeur} ${REMBOURRAGES[rembourrage]} ${
          cote === 'gauche' ? 'left-0' : 'right-0'
        } ${
          ancrage === 'dessous' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
        } ${origine} animate-[popover_150ms_var(--ease-out)] ${className}`}
      {...reste}
    >
      {children}
    </div>
  );
});

export default Flottant;
