# Preuve — lot 7a de la refonte graphique : Siège · Défense et Offense

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à B.10.
Le lot 7 est **scindé** (règle du cadrage : l'intrant en lignes) — la zone
compte ~5 200 lignes, dont 3 600 pour les Recommandations :

- **7a** : Défense et Offense — `SiegeBoard.tsx`, `SiegeTeam.tsx` (ce lot) ;
- **7b** : Recommandations — `RecoBoard.tsx`, `RecoCard.tsx`, ensuite.

Décisions appliquées (A.2 bis) :
- 8 (pastille de statut écrite) ;
- 13 précisée (en-tête et `BarreActions`, comme la RTA) ;
- 4 précisée (pas d'action mise en avant dans un en-tête) ;
- 1 (Cinzel pour les titres).

## Tests écrits AVANT

`tests/rendu/siege.test.tsx` (Défense et Offense, écrits au lot 0 sur le code
d'avant la refonte) :
- les actions de la page ;
- chaque équipe : son titre, ses actions, ses monstres avec leur vitesse, le
  speed tune ;
- le bonus du leader ;
- les emplacements vides.

**Aucune assertion modifiée.**

## Réponses de Thomas pendant le lot

| Question | Réponse |
|---|---|
| Textes de la pastille de statut | **courts, tirés des phrases de l'app** — Tous au tick, Speed tune, Tick validé, Speed tune validé, À vérifier, Pas au tick, Runes incomplètes (+ Artéfacts incomplets quand il ne manque que des artéfacts) |
| « met plutôt en avant la vérification des speed plutôt que l'ajout d'une équipe » | « Vérifier mes speed » en premier, en aplat d'accent |
| « ne met pas d'action en avant en fait ça rend pas bien » | **aucun aplat dans l'en-tête** — « Vérifier mes speed » reste en premier, bouton normal (fond doux allumé) ; axe `principal` retiré de la librairie ; décision 4 précisée |

Fonctions nouvelles de la maquette (recherche d'équipe par monstre, pastilles
de filtre par statut, vue liste) : **non faites**, comme pour la RTA (« on
verra plus tard ») — elles restent des propositions.

## Ce qui change

| Commit | Quoi |
|---|---|
| `553a709` | pastille de statut écrite à côté de « Équipe N » (`components/siege/pastilleStatut.ts`, hors `lib/`, testé cas par cas : `tests/siege-pastille.test.ts`) ; plus de fond coloré en thème clair (tokens `--siege-card-*` retirés) ; carte au gabarit de la refonte |
| `f637bba` | `BarreActions` / `Menu` : axes `principal` et `actif` |
| `a39c836` | en-tête bureau (titre, compteur, `BarreActions`) ; « Créer un monstre » depuis le menu (mode piloté) ; test `testRenduSiegeEnTete` |

## Ajustements après essai (2026-09-26), puis validation

Chaque demande de Thomas, un commit :

| Demande | Commit | Effet |
|---|---|---|
| « ne met pas d'action en avant, ça rend pas bien » | `7587749` | aucun aplat dans l'en-tête ; axe `principal` retiré ; décision 4 précisée |
| « revois un peu les cards pour optimiser l'espace » | `8355ead` | carte resserrée ; grille en colonnes d'au moins 480 px, selon la place |
| « revois surtout la partie d'édition » | `a51b5dd` | deux lignes de moins par slot ; `testRenduSiegeEdition` (passe à l'identique avant et après) |
| « remplacer l'encart position par des flèches » | `57e42d9` | ← → à la souris, désactivées aux bords, annonce du leader |
| « les mettre en haut de la card » | `56a90ce` | flèches sur la ligne du monstre, à côté de la croix |
| « les éléments alignés dans la card » | `751b0c3` | lignes des trois slots alignées (`grid-rows-subgrid`) |
| capture : « ce n'est pas aligné » | `a0e4b4d` | tout centré sur sa ligne ; écart au tick après la vitesse |
| « la spd et la conclusion en bas » | `8dcbb70` | ordre : monstre, saisie (SPD + ticks), conclusion |
| « supprime le bouton off, reclic = enlève le tick » | `d00b3b0` | « Off » masqué à la souris, reclic sur le tick actif = 0 |
| « pas besoin de séparateur dans la card » | `e3e00cf` | plus de filet au-dessus de la conclusion |

**Validé par Thomas le 2026-09-26, sur bureau** (« et on est bon »). Le
téléphone n'a pas été regardé : il garde « Off », le sélecteur de position et
sa disposition — à voir au lot 11 (les flèches et le reclic y seraient aussi
pratiques).

## Vérifications

```text
$ npx tsc --noEmit                                  → code 0
$ node tests/run.mjs rendu refonte navigation siege → 343 vérifications passées
$ node tests/run.mjs siege rendu-ui rendu-rta       → 164 vérifications passées (dernier état)
$ node scripts/inventaire-ui.mjs --verifier         → aucune perte
$ node scripts/chemins-interdits.mjs 6110609        → aucun modifié
$ node scripts/spec-lint.mjs                        → aucune erreur
$ npm run build                                     → built ; bg-good-soft, bg-warn-soft,
  bg-bad-soft, border-good/40, border-warn/40, border-bad/40 présentes
```

## À regarder sur le serveur de dev (non testable)

- **La pastille** dans les deux thèmes, pour une équipe verte, orange, rouge et
  une équipe à l'équipement incomplet.
- **« Vérifier mes speed »** : plein quand il est éteint, fond doux d'accent
  quand il est allumé.
- **Le passage des boutons au menu « ⋯ »** selon la largeur de la fenêtre et
  l'état de la barre latérale.
- **Téléphone** : non regardé. Le panneau est inchangé, mais la pastille et la
  carte sont communes aux deux formats (lot 11).
