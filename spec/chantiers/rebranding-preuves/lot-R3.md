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

## 5. R3a — Actions et sélection (2026-09-29)

Commencé, mis de côté par `git stash` le temps du R2 bis (nouvelle identité
de logo), repris ensuite : la fusion du stash a gardé les deux travaux (`tsc`
vert, jetons du logo et de la braise présents).

| Composant | Changement | Décision |
|---|---|---|
| `Bouton` principal | survol `accent-hover`, appui `accent-appui` (plus de `brightness-110`) ; désactivé = aplat `panel2`, encre `ink-dimmer` | 17, 21 |
| `Bouton` (tous) | `data-bouton` : descend d'1 px à l'appui (`index.css`) ; les autres surfaces gardent `scale(0.97)` | 21 |
| `Segmented` | option enfoncée en aplat `bg-accent text-accent-ink` | 19 |
| `Pastille` | `MARQUEUR_FILTRE_ACTIF` = `border-accent bg-accent-soft text-ink`, sans coche | 20 |
| Filtres de runes (`gabaritFiltre`) | à la souris, suivent `Segmented` : `lg:bg-accent lg:text-accent-ink` | 19 |
| Jetons | `accent-hover`, `accent-appui` (deux thèmes) ; `accent-soft` de Forge = `#3A2415`, le « braise sombre » que la toile emploie partout | — |

Mesures (`r3a-mesures.mjs`) : encre sur survol 8,26 (Forge), sur appui 4,90 ;
encre sur `accent-soft` Forge 11,44, braise 5,58 ; `Segmented` 6,66 ; encre
d'un principal désactivé 5,05 / 4,82.

**Piège trouvé dans le CSS construit** (`ordre-classes.mjs` sur `dist/`) :
`hoverable:bg-accent-hover` (octet 67 434) était émis APRÈS
`active:bg-accent-appui` (63 570) et `disabled:bg-panel2` (63 968) — les
variantes du plugin passent après les variantes de base. Conséquence : pas
d'appui visible à la souris, braise rallumée au survol d'un bouton
désactivé. Corrigé par `active:!bg-accent-appui` et `disabled:!bg-panel2`,
vérifiés émis avec `!important`.

Vérifié : `tsc` ; `node tests/run.mjs ui rendu refonte` → 850 ; inventaire
sans perte ; chemins interdits ; build ; spec-lint. Specs : `design.md`
(jetons, marqueurs, pression), `librairie-ui.md` (états du bouton,
`Segmented`, `Pastille`), `compte/runes.md` (marqueur des filtres).

**Non prouvé** : l'appui et le survol à l'œil (aucun navigateur piloté sur
un vrai clic) ; le rendu des icônes de sets sur l'aplat de braise.

## 6. R3b — Formulaires (2026-09-29)

Relevé : nos champs suivent déjà la logique de la planche — fond un cran
plus clair que la surface qui les porte (`panel2` sur une carte `panel`,
comme #232120 sur #1B1A19 dans la toile), contour `border`, focus en braise
lisible sans halo (décision 18), tailles gardées (décision 17). Deux écarts
repris :

| Composant | Changement | Pourquoi |
|---|---|---|
| `Case` cochée | coche en `accent-ink` au lieu de `text-bg` | en Atelier, la coche était CLAIRE sur braise : 2,3 de contraste depuis le R1 ; la toile la dessine en encre sombre (6,66) |
| `NumberField` | séparateurs des flèches en `border-soft` | trait intérieur plus discret que le cadre, comme le champ « Nombre » de la planche |

**Écarté, à dessein** : l'interrupteur éteint de la toile (piste `border-soft`
sans contour). En Atelier, le curseur blanc sur `#E4D9C6` tomberait à ~1,4 :
invisible. La toile ne dessine que Forge. Le nôtre garde son contour et son
fond `panel2`. `Selecteur` reste une liste native (la liste personnalisée de
la toile est un changement de COMPORTEMENT, pas de style).

Vérifié : `tsc` ; `node tests/run.mjs ui rendu` → 811 ; build.

## 7. R3c — Retours et fenêtres (2026-09-29)

| Composant | Changement | Décision |
|---|---|---|
| `ConfirmDialog` destructif | action `danger` + `plein` (aplat `bad`, encre `bad-ink` 6,53 / 6,91) ; « Annuler » à contour, focus conservé | 22 |
| `ConfirmDialog` non destructif | inchangé | — |
| `Notification` | à la souris en bas à droite (`lg:inset-x-auto lg:right-6 lg:mx-0`) ; téléphone inchangé ; fond `panel2` ; « Annuler » en fantôme | 23 |
| `Bouton` `accent` + `vide` | devient le « fantôme » de la toile : `text-accent`, survol `bg-accent-soft` | — |

Le fantôme n'avait aucun appelant : vérifié en relisant les cinq boutons à ton
dynamique (`BuildCandidateCard` ×2, `OptimizerSection` ×2, `BarreActions`) —
tous passent `fond="doux"`, `plein` ou `actif`, jamais `vide` avec l'accent.

`Modale` et `Menu` suivaient déjà la planche : panneau `panel` à contour
`border`, rayon 20 px ; entrées au survol `panel2`, « Supprimer » en rouge.

Ordre dans le CSS construit : `lg:inset-x-auto`, `lg:mx-0`, `lg:right-6` après
`inset-x-0` et `mx-auto` ; `hoverable:bg-accent-soft` après `bg-transparent`.

Vérifié : `tsc` ; `node tests/run.mjs ui rendu refonte` → 850 ; inventaire ;
build.

**Non prouvé** : la notification à l'œil au bureau (pile de dialogues,
recouvrement d'un contenu en bas à droite).
