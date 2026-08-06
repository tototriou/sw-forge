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

- Poignée de drag (`GripVertical`) : **seule** zone qui déclenche le glisser.
- Cadre hexagonal + image (fallback initiales) + badge élément.
- **Vitesse totale** affichée (`base + runes`, ou `—`), couleur `star`.
- « SPD base X » en indication.
- Champ **« SPD : »** = vitesse apportée par les runes (Swift déjà inclus →
  saisie telle quelle). Vide = `null`.
- **Sélecteur de section** (repli tactile du drag) : liste = `Non classé` + tous
  les sets visibles → `onMove`.
- Croix de retrait (survol) → `removeMonster`.

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
