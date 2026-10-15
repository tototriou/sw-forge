# Navigation — niveaux et repli de la barre

Partie de [Navigation](README.md).

## Trois niveaux — « Mon compte »

⚠️ **Sur bureau, ce niveau n'existe pas** : Monstres, Runes et Artéfacts sont
au premier niveau, et Runes / Artéfacts déroulent directement leurs vues
(Résumé · Liste · Courbes · Comparaison · Optimisation). **Meules et Gemmes
n'y figurent pas** tant qu'elles sont « Bientôt » ; leurs routes et leur page
existent. Ce qui suit décrit le **panneau mobile**, qui a les trois niveaux
(choisir l'inventaire, puis sa vue).

Le second niveau porte des **groupes**, pas une liste plate :

```
‹ Mon compte
─────────────
MONSTRES     → Ma box
RUNES        → Résumé · Liste · Courbes · Comparaison · Optimisation · Meules · Gemmes
ARTÉFACTS    → Résumé · Liste
```

- ⚠️ **Onze destinations, toutes visibles.** Dans une rangée d'onglets en haut
  de page, les vues (Résumé, Courbes, Comparaison…) seraient invisibles tant
  qu'on n'est pas déjà sur la bonne page.
- ⚠️ **Les vues sont dans l'URL** (`#/compte/runes/courbes`). Dans un
  `useStickyState` local, elles seraient impossibles à porter dans la barre :
  rien ne dirait laquelle est active, et un lien direct n'existerait pas.
- ⚠️ **Une source unique** ([accountViews.ts](src/lib/accountViews.ts)) partagée
  par la barre, les onglets mobiles et les sections : une liste d'onglets par
  section ferait deux listes à tenir d'accord.
- ⚠️ **`vueValide`** gère le changement d'inventaire : passer des Runes (sur
  « Courbes ») aux Artéfacts, qui n'en ont pas, laisserait un écran blanc.
- Le nom de l'inventaire est un **titre de groupe**, comme « Ressources » : il
  annonce, il ne mène nulle part. C'est la vue qu'on choisit.

### ⚠️ Un filet entre les groupes

Onze entrées en trois blocs que seule une marge distinguerait : à cette
densité, l'œil ne verrait qu'une longue liste. Le filet n'apparaît qu'à
partir du **deuxième** groupe — en tête, il séparerait le premier de rien.

Repliée, le filet **remplace** l'intitulé : « Artéfacts » n'a pas de version en
trois lettres qui veuille dire quelque chose.

⚠️ **Barre latérale bureau** : les groupes (Jouer, Mon compte, Outils,
Ressources) sont séparés par un **filet pleine largeur** (`bg-border`) et
annoncés par leur **intitulé en capitales à la couleur principale**
(`.label text-accent` — 5,4 à 9,7:1 sur le fond). Avec un intitulé gris, sans
filet, les quatre groupes se liraient comme une seule liste. Le reste du menu
est neutre. Repliée, l'intitulé disparaît et le filet raccourcit.

## Repli — deux états, jamais trois

- La **largeur s'anime** (248 → 56 px), pas un `translateX` : la barre se replie
  **sur elle-même** et rend sa place au contenu, dont la marge suit à la même
  courbe. 248 px : à 224, la carte du compte tronquerait sa seconde ligne.
- Le bouton de repli vit **en tête**, à côté du logo : un réglage
  de la barre elle-même, pas une destination. Icône seule, son nom dans
  l'infobulle. Repliée, logo et bouton s'empilent.
- ⚠️ **Pas de déploiement au survol** : la barre serait incohérente avec
  elle-même — repliée dans le Siège on voit les icônes des *sections*, au
  survol elle basculerait sur les *sous-sections*, donc d'autres icônes aux
  mêmes places. Le contenu changerait sous le curseur.
- Repliée, les libellés cèdent la place aux `title` : neuf icônes ne se
  distinguent pas toutes au premier regard.
- Le repli tient pour la **session** (`useStickyState`), sans être persisté :
  une préférence d'affichage ne justifie pas de passer par le consentement de
  conservation — même règle que le
  [bandeau petit écran](bandeau-petit-ecran.md).

## Pas d'aperçu au survol (bureau)

Survoler une section refermée (RTA, Siège, Runes, Artéfacts) n'ouvre aucun
panneau flottant : les sous-sections se déroulent sous leur entrée, un panneau
doublerait ce geste et surgirait dès qu'on traverse la barre. Toutes sont
atteignables en déroulant la section, au clic comme au clavier.
[tests/navigation.test.ts](tests/navigation.test.ts) vérifie qu'il ne revient
pas.
