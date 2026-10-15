# Librairie UI — le vocabulaire visuel commun

> **Source de vérité** pour la façon dont un contrôle se dessine. Les VALEURS
> (couleurs, échelle de texte, rayons) restent dans
> [design/](../design/README.md) ; ce document dit **quels composants existent** et
> **comment on choisit entre eux**.
>
> Code : [`src/ui/`](../../../../src/ui/), point d'entrée unique
> [`src/ui/index.ts`](../../../../src/ui/index.ts).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| un axe d'un contrôle, la règle tactile, un nouveau contrôle à imaginer | [principes-et-axes.md](principes-et-axes.md) |
| `src/ui/Bouton.tsx`, `src/ui/BoutonGroupe.tsx`, `src/ui/BoutonIcone.tsx` | [fondation-et-prereglages.md](fondation-et-prereglages.md) |
| `src/ui/BarreActions.tsx`, `src/ui/Menu.tsx`, `src/ui/Champ.tsx`, `src/ui/NumberField.tsx`, `src/ui/Selecteur.tsx`, `src/ui/Interrupteur.tsx`, `src/ui/Segmented.tsx`, `src/ui/Pastille.tsx`, `src/ui/Jeton.tsx`, `src/ui/Option.tsx`, `src/ui/Flottant.tsx`, `src/ui/FlottantAuto.tsx` | [composants.md](composants.md) |
| `src/ui/Dialogs.tsx`, `src/ui/MobileSheet.tsx`, `src/ui/Case.tsx`, `src/ui/PiedDeDialogue.tsx`, `src/ui/Vignette.tsx` | [modales-et-panneaux.md](modales-et-panneaux.md) |
| un contour, une bordure | [contours.md](contours.md) |
| un composant à faire monter dans `src/ui/` | [quand-ajouter.md](quand-ajouter.md) |

## Parties

| Document | Contenu |
| --- | --- |
| [principes-et-axes.md](principes-et-axes.md) | La règle qui gouverne tout le reste, des axes plutôt qu'un catalogue de variantes, le piège de la règle tactile, les axes de comportement. |
| [fondation-et-prereglages.md](fondation-et-prereglages.md) | `Bouton`, la fondation, et ses préréglages `BoutonGroupe` et `BoutonIcone`. |
| [composants.md](composants.md) | `BarreActions`, `Menu`, `Champ`, `NumberField`, `Selecteur`, `Interrupteur`, `Segmented`, `Pastille`, `Jeton`, `Option`, `Flottant`, `FlottantAuto`, `Modale`. |
| [modales-et-panneaux.md](modales-et-panneaux.md) | Une seule grammaire de modale en trois bandes, confirmer et saisir sans les boîtes du navigateur, la croix et sa seule exception, puis `MobileSheet`, `Case`, `PiedDeDialogue` et `Vignette`. |
| [contours.md](contours.md) | Les contours d'interface : 1 px, et un seul. |
| [quand-ajouter.md](quand-ajouter.md) | Quand un composant monte dans la librairie : au deuxième usage, jamais au premier, et seulement quand un axe manque. |

## Ce qui n'est pas dans cette librairie

**Les composants de JEU.** Une roue de runes, un portrait de monstre, la fiche
d'une pièce équipée ne sont pas du vocabulaire d'interface : ils rendent des
données Summoners War et suivent les codes du jeu, pas la règle du contour unique
de 1 px. Ils vivent dans `src/components/`.

Ils obéissent en revanche à la **même exigence d'unicité** : un rendu se dessine
une fois. ⚠️ La fiche d'une **rune** et celle d'un **artéfact** partagent une
coquille unique
([PieceDetail.tsx](../../../../src/components/PieceDetail.tsx)) : cadre, en-tête
(image, stat principale, rareté, mesure), bloc de lignes, pied. Ne reste propre à
chaque pièce que **ce qu'elle a de différent** — la meule et la gemme d'un côté,
les procs de l'autre ; le bonus de set d'un côté, l'attribut ou le type de
l'autre. **La rune est la référence** : sa disposition est celle du jeu.

**Aucune dépendance externe.** La question d'adopter Radix UI s'est posée pour
`Dialog`, `Popover`, `Select` et `Switch`. Elle reste **ouverte** et concerne le
comportement (piège de focus, empilement, clavier), pas l'apparence — ces
composants-ci sont à nous et le resteraient. Voir
[02-app/transverse/](../../../02-app/transverse/) pour ce qui flotte au-dessus de la page.
