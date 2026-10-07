# Preuve — lot R7 du rebranding : la RTA

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R7 ;
décision 47 (affichage seulement, pas de classement). Script du scratchpad :
`r7-captures.mjs`, 2026-09-30.

## 1. Avant de toucher

```text
node tests/run.mjs RenduRta RenduTelephoneRta RtaPartage → 166 vérifications passées
```

Captures de « Ma prépa » sur l'app construite, compte réel importé (45
monstres), 1440 px et téléphone tactile 390 px, deux thèmes.

## 2. Relevé : la planche `BsRTA` contre notre écran

⚠️ La planche dessine un **classement** (rangées S / A / B / Non classés) ;
nos sections sont des **sets de runes**. Le classement n'est pas repris
(décision 47) : seul l'affichage se compare.

| Zone | Toile | Notre écran |
|---|---|---|
| En-tête | surtitre, grand titre, une phrase ; « Réinitialiser » seul | « Ma prépa » + compteur + « Sauvegardé » ; Exporter et « ⋯ » |
| Section | un CADRE par section, bandeau coloré de 96 px à gauche portant le nom | titre (icône du set, nom, compteur, filet, croix), cartes dessous, sans cadre |
| Carte d'un monstre | portrait 48 + nom | portrait, nom, VIT, sets, sélecteur de section, poignée |
| Glisser-déposer | carte soulevée (bord braise, ombre, inclinée) ; emplacement « Déposer ici » en pointillés | fantôme du navigateur ; la section survolée prend un fond et le contour de son set |
| « Non classés » | en DERNIER, rangée en pointillés, « Tous tes monstres sont classés. » | en PREMIER (les ajouts y atterrissent, sous la recherche) |
| Ordre des tours | panneau de 440 px à droite : rang, nom, VIT saisie, jauge d'ATB, pastille du lead | pleine largeur sous les sections : grille de cartes (rang, portrait, VIT, sets, ±), leads en pastilles |
| Téléphone | — (pas de planche) | inchangé |

Non proposé (décision 47, une fonction absente de l'app) : la jauge « où en
est chaque monstre quand le premier joue ».

## 3. Déjà décidé, appliqué sans question

- **Couleurs d'état (43)** : `text-fire` sémantique → `bad` dans
  `DesyncBadge` (la vitesse demandée), `RtaValidationReport`,
  `RtaAmiSection`, `RtaBackupBar` (erreurs), et la cible de VIT de
  `StatPanel` que `DesyncBadge` annonce « en rouge ». Les tables d'éléments
  (`RtaCard`, `TurnOrder`, `RtaFriendView`) ne bougent pas.
- **Icônes (44)** : `Users` de lucide → `IconeAmi` (compagnons) dans
  l'onglet et l'état vide « Ami », et dans la vue d'une prépa partagée.

## 4. Décisions du mainteneur

Sections (48), ordre des tours (49) et glisser-déposer (50) : gardés, les
trois recommandations retenues. En-tête et « Non classé » gardés sans
question, par la décision 38 du Siège — dit au mainteneur avec le code.

## 5. Le changement et sa validation

Commit `2f4fc0c5`, montré AVANT d'être commité (décision 47), captures sur
l'app construite, deux thèmes (`r7-verif.mjs`) : état vide « Ami » et son
icône ; rapport « Fichier refusé » en rouge d'état ; Ethna passée de 224 à
236 dans l'ordre des tours — badge sur sa carte, « → 236 » en rouge d'état
sur la ligne VIT de la fiche. Le mainteneur : « Validé, commite ».

```text
npx tsc --noEmit                                       → 0
node tests/run.mjs RenduRta RenduTelephoneRta RtaPartage navigation → 231 passées
node scripts/inventaire-ui.mjs --verifier              → aucune perte
node scripts/chemins-interdits.mjs 6110609             → aucun modifié
npm run build                                          → built
```

## 6. Ce que je n'ai pas pu prouver

- Le **téléphone** à l'œil pour ces changements : les captures sont au bureau.
  Mêmes classes aux deux formats, aucun `compact:` ni `lg:` touché.
- Les messages d'erreur de **sauvegarde** (`RtaBackupBar`) : même
  remplacement que les autres, non déclenchés en capture.
