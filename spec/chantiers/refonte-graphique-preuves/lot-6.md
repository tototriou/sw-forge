# Preuve — lot 6 de la refonte graphique : RTA

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à B.10.
Décisions appliquées (A.2 bis) : 13 (choix de Thomas pour la RTA), 1
(Cinzel pour les titres), 4 (bouton principal), 9 et le reste du
vocabulaire des lots 2 et 3.

## Décision 13, prise avant de coder

Quatre questions posées à Thomas (la maquette changeait la structure) :

| Question | Réponse |
|---|---|
| Ordre de tour : en bas ou panneau à droite ? | **en bas**, comme aujourd'hui |
| Actions : menu « ⋯ » ou toutes visibles ? | **menu « ⋯ »** (maquette) |
| Ajout d'un monstre : champ permanent ou bouton ? | **champ permanent** |
| Fonctions nouvelles de la maquette | **« on verra plus tard »** — aucune retenue |

## Tests écrits AVANT (commit `ef35074`)

`tests/rendu/rta.test.tsx`, rendu bureau, 47 vérifications :

- **prépa de trois monstres** :
  - recherche d'ajout, compteur ;
  - « Créer un monstre » et « Tout effacer » ;
  - les cinq actions de sauvegarde, avec leur état et leur infobulle ;
  - les catégories ;
  - les sections et leur suppression (« Autre » exclu) ;
  - les cartes : retrait et sélecteur de section ;
  - « Ajouter une section » ;
  - l'ordre de tour : leads, champs « + runes », surlignage.
- **prépa vide** : les désactivations et leurs raisons ;
- **point de sauvegarde et import** : « Reprendre » actif, « Réinitialiser »
  présent ;
- **Ami** : l'invite et son bouton.

**Aucune assertion modifiée depuis.**

## Ce qui change

| Commit | Quoi |
|---|---|
| `20324e4` | décision 13 dans le cadrage |
| `1ef4103` | `src/ui/Menu` : bouton « ⋯ » et liste d'actions (`role="menu"`, clavier, entrées gardées dans le DOM menu fermé, `danger` séparé) — monté à son premier usage, justifié dans `librairie-ui.md` ; test `testRenduUiMenu` |
| `501699a` | en-tête bureau : titre, compteur, « Exporter », menu « Plus d'actions » (Sauvegarder, Reprendre, Importer une prépa, Créer un monstre ; séparés : Réinitialiser, Tout effacer). `RtaBackupBar` gagne la disposition `menu` (la `barre` du panneau mobile est inchangée) ; `CreateMonster` un mode piloté. Test `testRenduRtaMenu` |
| `ca0d435` | sections sans cadre au repos (en-tête + filet ; cadre 1 px à la couleur du set pendant un glisser), cartes au gabarit de la refonte, même chose pour la prépa d'un ami ; « Ma prépa » en Cinzel |

Inventaire : **aucune perte, aucun déplacement à déclarer**. La disposition
`barre` garde tous les libellés d'origine ; le menu en AJOUTE (« Importer une
prépa », « Plus d'actions », « Ma prépa »).

## Vérifications

```text
$ npx tsc --noEmit                                  → code 0
$ node tests/run.mjs rendu refonte navigation       → 301 vérifications passées
$ node tests/run.mjs rendu-rta rendu-app            → 145 vérifications passées (dernier état)
$ node scripts/inventaire-ui.mjs --verifier         → aucune perte
$ node scripts/chemins-interdits.mjs 6110609        → aucun modifié
$ node scripts/spec-lint.mjs                        → aucune erreur
$ npm run build                                     → built ; hoverable:enabled:bg-panel2,
  hoverable:enabled:bg-bad/10, focus-visible:bg-panel2, basis-full présentes
```

## À regarder sur le serveur de dev (non testable)

- **Le menu « ⋯ »** :
  - ouverture et fermeture : clic, clic dehors, Échap ;
  - les flèches du clavier ;
  - les entrées qui ouvrent un dialogue : Créer un monstre, Réinitialiser, Tout effacer.
- **Le glisser d'une carte** : le cadre à la couleur du set doit apparaître
  sur la section survolée.
- **Sous l'en-tête** : la ligne « Point de sauvegarde · … » et les messages
  (export, reprise) doivent y apparaître.
- **Téléphone** : non regardé. Le panneau « Options » est inchangé, mais les
  sections et les cartes (communes aux deux formats) ont changé d'aspect. Il
  sera vérifié au lot 11.
