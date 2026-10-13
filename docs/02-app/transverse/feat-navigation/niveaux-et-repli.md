# Navigation — niveaux et repli de la barre

Partie de [Navigation](README.md).

## Trois niveaux — « Mon compte »

⚠️ **Sur bureau, ce niveau n'existe plus** depuis la refonte graphique
(décision 5) : Monstres, Runes et Artéfacts sont au premier niveau, et Runes /
Artéfacts déroulent directement leurs vues (Résumé · Liste · Courbes ·
Comparaison · Optimisation). **Meules et Gemmes n'y figurent plus** tant
qu'elles sont « Bientôt » — [retrait #6] décidé par le mainteneur ; leurs routes et
leur page restent. Ce qui suit décrit le **panneau mobile**, qui garde les
trois niveaux (choisir l'inventaire, puis sa vue).

Le second niveau porte des **groupes**, pas une liste plate :

```
‹ Mon compte
─────────────
MONSTRES     → Ma box
RUNES        → Résumé · Liste · Courbes · Comparaison · Optimisation · Meules · Gemmes
ARTÉFACTS    → Résumé · Liste
```

- ⚠️ **Onze destinations, dont huit étaient cachées.** Les vues (Résumé,
  Courbes, Comparaison…) vivaient dans une rangée d'onglets en haut de page,
  invisible tant qu'on n'était pas déjà sur la bonne page.
- ⚠️ **Les vues sont passées dans l'URL** (`#/compte/runes/courbes`). Elles
  vivaient dans un `useStickyState` local, ce qui les rendait impossibles à
  porter dans la barre : rien n'aurait dit laquelle est active, et un lien
  direct n'existait pas.
- ⚠️ **Une source unique** ([accountViews.ts](src/lib/accountViews.ts)) partagée
  par la barre, les onglets mobiles et les sections. Chaque section portait sa
  propre liste d'onglets ; les remonter sans les unifier aurait fait deux listes
  à tenir d'accord.
- ⚠️ **`vueValide`** gère le changement d'inventaire : passer des Runes (sur
  « Courbes ») aux Artéfacts, qui n'en ont pas, laissait un écran blanc.
- Le nom de l'inventaire est un **titre de groupe**, comme « Ressources » : il
  annonce, il ne mène nulle part. C'est la vue qu'on choisit.

### ⚠️ Un filet entre les groupes

Les onze entrées se suivaient en trois blocs que seule une marge distinguait :
à cette densité, l'œil ne voyait qu'une longue liste. Le filet n'apparaît qu'à
partir du **deuxième** groupe — en tête, il séparerait le premier de rien.

Repliée, le filet **remplace** l'intitulé : « Artéfacts » n'a pas de version en
trois lettres qui veuille dire quelque chose.

⚠️ **Barre latérale bureau** : les groupes (Jouer, Mon compte, Outils,
Ressources) sont séparés par un **filet pleine largeur** (`bg-border`) et
annoncés par leur **intitulé en capitales à la couleur principale**
(`.label text-accent` — 5,4 à 9,7:1 sur le fond, mesuré au lot 3). La
maquette ne portait qu'un intitulé gris, sans filet : les quatre groupes se
lisaient comme une seule liste, et le mainteneur a demandé (2026-09-24) qu'ils se
séparent « d'une manière plus visible ». Le reste du menu reste neutre.
Repliée, l'intitulé disparaît et le filet raccourcit.

## Repli — deux états, jamais trois

- La **largeur s'anime** (248 → 56 px), pas un `translateX` : la barre se replie
  **sur elle-même** et rend sa place au contenu, dont la marge suit à la même
  courbe. 248 et non plus 224 depuis la décision 11 : la carte du compte
  tronquait sa seconde ligne.
- Le bouton de repli vit **en tête**, à côté du logo (décision 11) : un réglage
  de la barre elle-même, pas une destination. Icône seule, son nom dans
  l'infobulle. Repliée, logo et bouton s'empilent.
- ⚠️ **Pas de déploiement au survol.** Il a été essayé et retiré : la barre
  devenait incohérente avec elle-même — repliée dans le Siège on voyait les
  icônes des *sections*, au survol elle basculait sur les *sous-sections*, donc
  d'autres icônes aux mêmes places. Le contenu changeait sous le curseur.
- Repliée, les libellés cèdent la place aux `title` : neuf icônes ne se
  distinguent pas toutes au premier regard.
- Le repli tient pour la **session** (`useStickyState`), sans être persisté :
  une préférence d'affichage ne justifie pas de passer par le consentement de
  conservation — même règle que le
  [bandeau petit écran](bandeau-petit-ecran.md).

## Pas d'aperçu au survol (bureau)

Survoler une section refermée (RTA, Siège, Runes, Artéfacts) ouvrait un
panneau flottant à droite de la barre, qui en listait les sous-sections.
**Retiré** par le mainteneur le 2026-09-24 — [retrait #12] du cadrage de la
refonte graphique : les sous-sections se déroulent désormais sous leur
entrée, le panneau doublait ce geste et surgissait dès qu'on traversait la
barre. Toutes restent atteignables en déroulant la section, au clic comme
au clavier. [tests/navigation.test.ts](tests/navigation.test.ts) vérifie
qu'il ne revient pas.
