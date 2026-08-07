# RTA · Sections de runes (classement drag & drop)

Classer les monstres de la prépa par **set de runes visé**, et saisir la vitesse
de leurs runes.

Fichiers : [RtaSection.tsx](src/components/rta/RtaSection.tsx) ·
[RtaCard.tsx](src/components/rta/RtaCard.tsx) ·
[RtaPage.tsx](src/pages/RtaPage.tsx)

## Zones

- **« Non classé » (`unassigned`)** : zone tampon. Tout monstre ajouté / importé y
  arrive. Toujours présente, non supprimable.
- **Sections par set de runes** : `swift`, `violent`, `despair`, **`other`
  (Autre)** par défaut ; d'autres sets ajoutables. Chaque section a son **icône de
  rune** (SWARFARM, servie en local — voir [RuneIcon.tsx](src/components/RuneIcon.tsx))
  et sa **couleur d'accent** (`sectionAccent`).
- « Autre » et « Non classé » utilisent un losange coloré au lieu d'une icône de rune.

## Section — `RtaSection`

- En-tête : icône/losange + label + compteur de cartes + (si supprimable) croix.
- Vide → « Glisse des monstres ici ». Sinon grille de cartes responsive.
- **Cible de drop** : surbrillance + halo à la couleur d'accent au survol d'un
  drag (compteur enter/leave pour éviter le scintillement). Drop → `moveMonster`.
- **Suppression de section** : disponible pour tous les sets **sauf « Autre »**.
  Les monstres de la section supprimée **repartent en « Non classé »**.

## Carte monstre — `RtaCard`

Rendu **compact** et uniforme avec le siège :
- Poignée de drag (`GripVertical`) : **seule** zone qui déclenche le glisser.
- Portrait hexagonal agrandi + image (fallback initiales) + badge élément.
- Ligne 1 : nom · **icône vitesse + vitesse totale (blanc)** · **icônes de sets**
  (4 pièces en premier).
- Ligne 2 : **sélecteur de section** compact (repli tactile du drag) : `Non classé`
  + sets visibles → `onMove`.
- **Pas de champ de saisie de vitesse ici** (l'édition SPD runes se fait dans
  l'ordre de tour) ; « base » retiré.
- Croix de retrait (survol) → `removeMonster`.

## Pré-classement à l'import

À l'import d'un compte, chaque monstre **avec un build complet (6 runes)** est
placé dans la section de son **set principal** (4 pièces prioritaire ; sinon
« Autre ») ; les sections manquantes sont **créées automatiquement** (avant
« Autre »). Les monstres à **moins de 6 runes** restent en **« Non classé »**.
Voir [../shared/import-compte.md](../shared/import-compte.md).

## Ajouter une section

Sous les sections : « Ajouter une section » + `select` des sets **non déjà
visibles** (`availableSets`) + bouton **Créer**. `addSection` **insère avant
« Autre »** pour garder le fourre-tout en dernier.

## Tri interne d'une section

Chaque section est triée **plus rapide en premier**, par **vitesse totale sans
lead** (`base + runes`) ; les entrées sans vitesse finissent en dernier, départage
par nom. (Le tri ne dépend pas des leads.)

## Attendus

- Déplacer un monstre ne change que sa `section` (garde sa SPD runes).
- La SPD runes est partagée avec l'affichage de l'ordre de tour (même `entry`).
- Ajouter une section déjà visible est sans effet (idempotent).
