# Preuve — lot R3 du rebranding : la librairie aux planches « Composants »

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R3. Intrant :
les six planches « Composants » de la toile (version 1790664107-7102 ; les
planches du R0 à R2 y sont identiques octet pour octet), `src/ui/`,
`spec/shared/librairie-ui.md`, `spec/shared/design.md`.

## 1. Ce que couvre chaque planche

| Planche | Consommée par | Pourquoi |
|---|---|---|
| 1 · Actions et sélection | **R3** | `Bouton`, `BoutonIcone`, `BoutonGroupe`, `Segmented`, `Pastille`, `Jeton` |
| 2 · Formulaires | **R3** | `Champ`, `NumberField`, `Selecteur`, `Option`, `Interrupteur`, `Case` |
| 6 · Retours et fenêtres | **R3** | `Modale` et dialogues, `Notification`, `Menu`, `Flottant`, `MobileSheet` |
| 3 · Navigation et structure | R4 | barre, en-tête de page, pied de page : la coquille |
| 4 · Composants de jeu | R6, R7 | carte d'équipe (Siège), rangs S/A/B/C (RTA), jauge d'ATB — des écrans |
| 5 · Données | R8, R9 | tuiles de chiffres, tableau, barres — des composants de `components/` |

## 2. Écarts qui suivent déjà les jetons

Couleurs, rayons, police : les composants lisent les jetons du R1, ils ont
déjà la braise, les surfaces et les arrondis 6 / 10 / 14 / 20. Reste à
reprendre les ÉTATS que la toile dessine et que nos composants n'ont pas ou
dessinent autrement :

| Composant | Toile | Aujourd'hui |
|---|---|---|
| Bouton primaire | survol `accent-hover` (#FF9A4D), appui plus foncé (#E0620A) + 1 px vers le bas, désactivé gris | survol `brightness-110`, appui `scale 0,97` |
| Bouton secondaire | contour `border`, survol fond `panel` + contour plus clair | `neutre` + `trait plein`, survol fond `panel2` |
| Bouton « fantôme » | texte braise, survol fond braise sombre | `accent` + `fond vide` |
| Bouton danger | contour rouge sombre, texte rouge, survol fond `bad-soft` | `danger`, survol `bad-soft` |
| Bouton « chargement » | spinner + « En cours » | n'existe pas |
| Hauteurs | sm 36 / md 44 / lg 52, « 44 minimum » | bureau 28 / 32, doigt 40 |
| Focus clavier | double anneau 2 px (2 px de fond, 2 px clair) | contour 1 px `accent-lisible` |
| Champ au focus | contour braise + halo de 3 px | contour braise seul, « sans halo » |
| `Segmented` actif | APLAT braise, texte sombre | fond `accent-soft`, texte `ink` |
| Pastille active | contour braise, fond braise sombre, **coche** ✓, gras | contour braise, fond braise 25 %, sans coche |
| Case à cocher | 22 px, rayon 6 | 15 px |
| Interrupteur | 46 × 26, piste braise | 36 × 20, piste `accent` |
| Confirmation destructive | « Garder » (contour) + « Tout supprimer » en APLAT rouge | « Annuler » accent doux (focus) + action `danger doux` |
| Notification | bas à droite, 5 s, pile de 3 | bas au centre, 6 s, une à la fois |
| Zone d'import | pointillés **2 px** | pointillés 1 px |

## 3. Ce qui contredit une règle posée par Thomas

- **« Contours : 1 px, et un seul »** (CLAUDE.md, librairie-ui.md) : le
  double anneau de focus, le halo du champ, les pointillés de 2 px.
- **« Un clic ne déplace jamais ce qu'on vient de cliquer »** : la coche
  d'une pastille active apparaît au clic et élargit la pastille — ses voisines
  bougent.
- **La densité** (décision 7 : « notre échelle gardée ») : « 44 px minimum »
  élargirait chaque rangée de boutons au bureau.
- **« Un seul marqueur de sélection »** (design.md) : le `Segmented` en aplat
  n'en contredit pas le principe, seulement la valeur retenue au lot 9 de la
  refonte (fond doux).

## 4. Questions pour Thomas avant le code

Posées le 2026-09-29, en deux séries ; Thomas retient la recommandation sur
les sept. Inscrites comme décisions 17 à 23 du cadrage (A.8) :

| Question | Réponse | Décision |
|---|---|---|
| Hauteurs de la toile (44 minimum) ? | garder notre densité | 17 |
| Focus : double anneau, halo ? | garder la règle du 1 px | 18 |
| `Segmented` actif ? | aplat braise | 19 |
| Pastille active : coche ? | couleurs de la toile, sans coche | 20 |
| Appui ? | fonce et descend d'1 px (boutons) | 21 |
| Confirmation destructive ? | aplat rouge | 22 |
| Notification ? | bas à droite, le reste inchangé | 23 |

⚠️ **Étendu par moi, à valider à l'œil** : la décision 17 vaut aussi pour la
case à cocher (15 px, la toile en dessine 22) et l'interrupteur (36 × 20,
toile 46 × 26), et la décision 18 pour les pointillés de la zone d'import
(1 px, toile 2 px). Même raison : la densité et le contour unique.
