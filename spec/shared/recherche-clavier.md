# Barres de recherche — navigation au clavier

> **Source de vérité** pour toute barre de recherche à suggestions.
> Implémentation unique : [useComboboxNav](../../src/hooks/useComboboxNav.ts).

⚠️ **Une seule implémentation, jamais une par composant.** Chaque barre avait la
sienne, et toutes la même faute : Entrée agissait sur « le premier résultat »
sans que rien à l'écran ne dise lequel — on validait à l'aveugle. Le hook a été
extrait au deuxième usage plutôt que recopié, comme
[Segmented](../../src/components/Segmented.tsx) et
[buttonStyles](../../src/components/buttonStyles.ts).

## Le geste principal : enchaîner

On monte une prépa RTA en tapant dix noms d'affilée. **Chaque validation vide le
champ et rend le focus**, prêt pour le suivant, sans jamais toucher la souris.

⚠️ C'est le hook qui s'en charge, pas l'appelant : l'oublier une seule fois
casserait le geste.

## Les touches

| Touche | Effet |
|--------|-------|
| **↑ / ↓** | Déplacent la sélection, avec bouclage aux extrémités |
| **Début / Fin** | Premier / dernier résultat |
| **Entrée** | Valide **l'élément actif**, vide le champ, garde le focus |
| **Échap** | Ferme la liste ; une 2ᵉ fois vide le champ |
| **Tab** | **Sort du champ** — n'entre pas dans la liste |

⚠️ **Entrée agit sur l'élément SURLIGNÉ**, jamais sur « le premier de la liste ».
Agir sur un élément que rien ne désigne à l'écran est le défaut d'origine.

⚠️ **Tab n'entre pas dans la liste** — c'est la convention combobox. Avec 25
résultats, l'y piéger imposerait 25 tabulations pour atteindre le contrôle
suivant. Ce n'est pas un oubli : c'est la règle.

## Les règles qui évitent une touche muette

- La sélection se pose sur le **premier élément encore disponible** à chaque
  frappe. Garder l'index précédent surlignerait un résultat sans rapport ; se
  poser sur un élément déjà pris rendrait Entrée silencieuse.
- Entrée sur un élément déjà pris **avance au suivant disponible** plutôt que de
  ne rien faire. ⚠️ Une touche pressée produit toujours un effet visible.
- Le **survol déplace la sélection** : souris et clavier désignent le même
  élément, jamais deux à la fois.
- L'élément actif **suit le défilement** (`scrollIntoView({ block: 'nearest' })`),
  sinon les flèches le poussent hors de vue et on navigue à l'aveugle.

## Accessibilité

`role="combobox"` + `aria-expanded` + `aria-activedescendant` sur le champ ;
`role="listbox"` sur la liste, `role="option"` + `aria-selected` sur chaque
option.

⚠️ Les `id` ARIA sont dérivés de `useId()`, jamais d'une constante : plusieurs
pickers coexistent (un par slot d'équipe de siège), et des `id` partagés feraient
pointer `aria-activedescendant` sur l'option d'un autre champ.

⚠️ **Aucun `setTimeout` pour retarder le blur.** Les options agissent en
`onMouseDown`, donc **avant** le blur. Le délai de 150 ms qui traînait était une
course que rien ne garantissait de gagner.

## Où c'est utilisé

| Composant | Écran | Note |
|-----------|-------|------|
| [RtaSearch](../../src/components/rta/RtaSearch.tsx) | RTA | Un monstre déjà en prépa reste affiché mais non sélectionnable |
| [MonsterPicker](../../src/components/MonsterPicker.tsx) | Siège, recommandations | Les monstres pris sont filtrés en amont (`excludeIds`) |

[SearchBar](../../src/components/SearchBar.tsx) n'est **pas** concerné : c'est un
filtre de liste sans suggestions, il n'y a rien à sélectionner.
