import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Navigation au clavier d'une barre de recherche à suggestions.
//
// ⚠️ **Une seule implémentation pour toutes les barres de recherche.** Elles
// avaient chacune la leur, et la même faute : Entrée agissait sur « le premier
// résultat » sans que rien à l'écran ne dise lequel — on validait à l'aveugle.
// Extrait ici au deuxième usage plutôt que recopié, comme
// [Segmented](../components/Segmented.tsx) et
// [buttonStyles](../components/buttonStyles.ts).
//
// Conventions **combobox** (ARIA), respectées telles quelles :
//   - ↑/↓ déplacent la sélection avec bouclage, Début/Fin vont aux extrémités ;
//   - Entrée valide l'élément ACTIF — celui qui est surligné ;
//   - Échap ferme la liste, une seconde fois vide le champ ;
//   - **Tab n'entre pas dans la liste** : il sort du champ. Avec 25 résultats,
//     l'y piéger imposerait 25 tabulations pour atteindre le contrôle suivant.

export interface ComboboxNav {
  /** Index surligné dans `results`. */
  actif: number;
  setActif: (i: number) => void;
  /** La liste est-elle ouverte (focus + saisie non vide) ? */
  open: boolean;
  /** À poser sur l'`<input>`. */
  inputProps: {
    ref: React.RefObject<HTMLInputElement>;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
    role: 'combobox';
    'aria-expanded': boolean;
    'aria-controls': string | undefined;
    'aria-activedescendant': string | undefined;
    'aria-autocomplete': 'list';
    autoComplete: 'off';
  };
  /** À poser sur le conteneur de la liste. */
  listProps: {
    ref: React.RefObject<HTMLDivElement>;
    id: string;
    role: 'listbox';
  };
  /** À poser sur chaque option, avec son index. */
  optionProps: (i: number) => {
    id: string;
    role: 'option';
    'aria-selected': boolean;
    'data-actif': boolean;
    onMouseEnter: () => void;
  };
  /** Vide la saisie et rend le focus au champ. */
  reinitialiser: () => void;
}

export function useComboboxNav<T>({
  results,
  query,
  setQuery,
  onValider,
  estDesactive,
  idBase,
}: {
  results: T[];
  query: string;
  setQuery: (q: string) => void;
  /** Appelé avec l'élément actif à la validation. */
  onValider: (item: T) => void;
  /** Un élément déjà pris : la sélection l'évite et Entrée passe au suivant. */
  estDesactive?: (item: T) => boolean;
  /** Préfixe des `id` ARIA — unique par instance montée. */
  idBase: string;
}): ComboboxNav {
  const [actif, setActif] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);

  const open = focused && query.trim().length > 0;

  // ⚠️ Les deux callbacks sont gardés dans une ref, PAS dans des dépendances.
  // Les appelants les écrivent en littérales (`estDesactive: (m) => …`), donc
  // recréées à chaque rendu : les mettre en dépendance relançait l'effet de
  // repositionnement en boucle, qui remettait la sélection à zéro juste après
  // chaque flèche — la navigation ne marchait plus du tout.
  const cbs = useRef({ estDesactive, onValider });
  useEffect(() => {
    cbs.current = { estDesactive, onValider };
  });

  const desactive = useCallback(
    (item: T | undefined) =>
      item !== undefined && cbs.current.estDesactive ? cbs.current.estDesactive(item) : false,
    []
  );

  // La sélection se pose sur le premier élément ENCORE disponible quand la
  // LISTE change : garder l'index précédent surlignerait un résultat sans
  // rapport, et se poser sur un élément déjà pris rendrait Entrée muette.
  // ⚠️ `results` seul en dépendance — voir la ref ci-dessus.
  useEffect(() => {
    const i = results.findIndex((r) => !desactive(r));
    setActif(i === -1 ? 0 : i);
  }, [results, desactive]);

  // L'élément actif suit le défilement, sinon les flèches le poussent hors de
  // la zone visible et on navigue à l'aveugle.
  useEffect(() => {
    if (!open) return;
    listeRef.current
      ?.querySelector<HTMLElement>('[data-actif="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [actif, open]);

  const reinitialiser = useCallback(() => {
    setQuery('');
    setActif(0);
    inputRef.current?.focus();
  }, [setQuery]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Sans liste ouverte, seul Échap a un sens (vider le champ).
      if (!open || results.length === 0) {
        if (e.key === 'Escape' && query) {
          e.preventDefault();
          setQuery('');
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActif((i) => (i + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActif((i) => (i - 1 + results.length) % results.length);
          break;
        case 'Home':
          e.preventDefault();
          setActif(0);
          break;
        case 'End':
          e.preventDefault();
          setActif(results.length - 1);
          break;
        case 'Enter': {
          e.preventDefault();
          const item = results[actif];
          if (item === undefined) break;
          // Déjà pris : on avance au suivant disponible plutôt que de rester
          // muet sur une touche qu'on vient de presser.
          if (desactive(item)) {
            const suivant = results.findIndex((r, i) => i > actif && !desactive(r));
            if (suivant !== -1) setActif(suivant);
            break;
          }
          cbs.current.onValider(item);
          // ⚠️ Le champ se vide et reprend le focus APRÈS chaque validation :
          // c'est ce qui permet d'enchaîner les saisies sans toucher la souris.
          // Fait ici plutôt que dans chaque appelant — l'oublier une fois
          // casserait le geste principal.
          setQuery('');
          setActif(0);
          inputRef.current?.focus();
          break;
        }
        case 'Escape':
          e.preventDefault();
          // Première pression : ferme la liste. Seconde : vide le champ.
          if (query) setFocused(false);
          break;
      }
    },
    [open, results, query, setQuery, actif, desactive]
  );

  const idListe = `${idBase}-liste`;

  return useMemo(
    () => ({
      actif,
      setActif,
      open,
      inputProps: {
        ref: inputRef,
        onKeyDown,
        onFocus: () => setFocused(true),
        // ⚠️ Pas de `setTimeout` pour retarder le blur : les options agissent en
        // `onMouseDown`, donc avant lui. Le délai de 150 ms était une course que
        // rien ne garantissait de gagner.
        onBlur: () => setFocused(false),
        role: 'combobox' as const,
        'aria-expanded': open,
        'aria-controls': open ? idListe : undefined,
        'aria-activedescendant': open && results[actif] ? `${idBase}-opt-${actif}` : undefined,
        'aria-autocomplete': 'list' as const,
        autoComplete: 'off' as const,
      },
      listProps: { ref: listeRef, id: idListe, role: 'listbox' as const },
      optionProps: (i: number) => ({
        id: `${idBase}-opt-${i}`,
        role: 'option' as const,
        'aria-selected': i === actif,
        'data-actif': i === actif,
        onMouseEnter: () => setActif(i),
      }),
      reinitialiser,
    }),
    [actif, open, onKeyDown, idListe, idBase, results, reinitialiser]
  );
}
