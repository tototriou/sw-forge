# Système visuel — flottants et défilement

Partie de [Système visuel](README.md).

### Notification « Annuler »

`src/ui/Notification.tsx` — un fournisseur monté une fois par `App.tsx`, et
`useNotifier()` pour annoncer un geste qui se défait (tableau plus haut).

- **À la souris, en bas à droite** ; **au téléphone, en bas,
  centrée, au-dessus de la barre d'onglets et du bouton « Options »**,
  jamais dessous. Fond `panel2`, un cran au-dessus des cartes qu'elle
  survole. `role="status"` : un lecteur d'écran l'annonce sans voler le focus.
- **Le message, « Annuler », et une croix** pour la fermer. « Annuler » est
  un bouton fantôme : texte braise, sans cadre. **6 secondes**,
  puis elle s'en va ; le survol et le focus la retiennent tant qu'on y est.
- **Une seule à la fois** : la suivante remplace la précédente, dont le
  geste devient alors définitif — deux notifications empilées se liraient
  comme deux choses à décider.
- « Annuler » **restaure l'élément à sa place** (fonctions `restaurer*` des
  hooks, qui réinsèrent à l'index d'origine) puis ferme la notification.
- **Deux axes servent l'application de bureau** (voir
  [02-app/bureau/](../../../02-app/bureau/)) :
  - **le libellé de l'action** (`libelleAction`, « Annuler » par défaut ; le
    rappel s'appelle `action`) — « Nouvelle version 2.0.1 disponible ·
    **Mettre à jour** », « Mise à jour prête · **Redémarrer** ». Une seule
    action, jamais « Annuler » et une autre côte à côte ;
  - **la durée** (`persistante`) : une **question** reste jusqu'à l'action
    ou la croix, au lieu de 6 secondes — elle ne s'efface pas avant qu'on
    l'ait lue. Défaut : 6 secondes, comme les gestes qui se défont.
- ⚠️ « Une seule à la fois » vaut aussi pour elle : un geste qui se défait
  pendant qu'une question est affichée la remplace (pour la mise à jour,
  elle revient au lancement suivant).
- Même gabarit que les flottants de l'app : fond `panel`, contour 1 px,
  ombre des panneaux.

### Bloquer le défilement derrière un flottant

⚠️ **Par `useScrollBloque`, jamais à la main.** Un composant qui mémorise la
valeur d'`overflow` à son ouverture pour la restaurer à sa fermeture marche
seul ; imbriqués, non :

1. le panneau d'actions s'ouvre, mémorise `''`, pose `hidden` ;
2. une confirmation s'ouvre par-dessus, mémorise `hidden`, repose `hidden` ;
3. on confirme — le panneau se ferme d'abord et restaure `''` ;
4. le dialogue se ferme ensuite et restaure… `hidden`.

La page resterait bloquée, **sans qu'aucun flottant ne soit visible pour
l'expliquer**. Le hook tient un compteur : le blocage tombe quand le dernier
verrou est relâché, jamais avant, jamais après — et le résultat ne dépend pas
de l'ordre de démontage.

### L'échelle des plans

⚠️ Deux éléments au **même `z-index`** se départagent par leur ordre dans le
DOM — celui monté en dernier passe devant. Une confirmation ouverte depuis le
panneau d'actions, tous deux à `z-50`, se retrouverait **derrière lui** : on
cliquerait « Supprimer », rien ne semblerait se produire, et le geste
paraîtrait dépourvu de confirmation.

| Plan | Niveau | Qui |
|------|--------|-----|
| Contenu | — | La page |
| Barre supérieure | `z-20` | Elle passe sous la barre latérale |
| Barre latérale, bouton « Options » | `z-30` | La navigation |
| Barre d'onglets | `z-40` | Sous le panneau qui la recouvre |
| Panneau d'actions | `z-50` | Recouvre la navigation |
| Panneau de second niveau | `z-60` | Recouvre le panneau d'où il sort |
| **Dialogues** | **`z-70`** | **Au-dessus de tout** |

⚠️ **Une confirmation est le dernier mot de l'interface : rien ne se met devant
elle.** Tout dialogue modal — `Modale`, `ConfirmDialog`, et les voiles écrits à
la main comme celui de l'export RTA — porte `z-[70]`.

### Un flottant ne sort jamais de l'écran, ni de sa boîte

⚠️ **`max-width` ne suffit pas.** Il borne la LARGEUR ; un panneau ancré à gauche
d'un déclencheur déjà proche du bord droit sort quand même, parce que c'est sa
POSITION qui dépasse. Le cas se produit dès que la place du déclencheur varie :
une pilule de catégorie au bout d'une rangée, un bouton qui a bougé parce qu'un
libellé s'est allongé, une vignette en fin de ligne. Aucune règle CSS statique ne
peut savoir où ce déclencheur-là se trouve.

⚠️ **Et une boîte qui défile rogne ce qui est posé dedans.** Une surface en
`absolute` ne sort pas d'un ancêtre `overflow: auto` : la carte « Importer une
équipe » d'une colonne de l'Optimizer, la liste de suggestions de « Fort
contre » dans la carte d'un deck du Siège, coupées par la boîte et passées
sous sa barre de défilement.

Les deux se règlent dans `Flottant` (`src/ui/`), pour toute l'app, sans rien
écrire dans l'écran :

- **Couche supérieure du navigateur** (`popover="manual"`) : la surface échappe
  aux `overflow`, `clip-path`, `transform` et contextes d'empilement de tous ses
  ancêtres, et passe devant tout. Elle reste à sa place dans le DOM : clic
  extérieur, focus et clavier ne changent pas.
- **Position mesurée, pas déduite** : calculée sur l'ancre (le parent
  `relative`, ou l'élément passé en `ancre` — le `<select>` d'un `Selecteur`,
  dont la liste ouverte est ce `Flottant`, seule couche ouverte) avant
  peinture (`useLayoutEffect`), puis à chaque défilement de
  n'importe quelle boîte et à chaque redimensionnement — une rotation de
  téléphone change la largeur sous un flottant déjà ouvert.
- **Bornée à l'écran** horizontalement, barre de défilement de la page exclue ;
  **basculée** de l'autre côté de l'ancre quand elle ne tient pas du sien, et
  **bornée en hauteur** avec défilement quand elle ne tient d'aucun.
- **Masquée** quand l'ancre sort de ce qui la montre.

Le hook `useRecalageEcran`, qui tirait après coup une surface débordante vers
l'intérieur, a disparu avec ce placement.

### Jamais de défilement latéral

`html` et `body` portent `overflow-x: hidden` (`index.css`) — **les deux**, car
le navigateur propage le débordement de `body` à `html` quand `body` est seul à
le masquer. Mais ce n'est **qu'un filet de sécurité** : le contenu déborde
toujours, il est simplement coupé, donc inatteignable.

Les quatre causes rencontrées, par ordre de fréquence :

| Cause | Correctif |
|-------|-----------|
| `min-w-[Npx]` rigide | S'écrit `min-w-[min(Npx,100%)]` |
| `minmax(Npx, 1fr)` dans une grille | S'écrit `minmax(min(100%,Npx), 1fr)` |
| Enfant flex qui refuse de se réduire | `min-w-0` — la valeur par défaut est `auto`, qui interdit de passer sous la largeur du contenu |
| Flottant de largeur fixe ancré à gauche | Borné par `Flottant` lui-même (voir plus haut) |
| Marge négative qui reprend le rembourrage du parent (la page de bureau de l'Optimizer, `-mx-3`) | L'empiètement se mesure : jamais plus que le rembourrage réellement laissé jusqu'au bord de ce qui défile ou de la fenêtre |

⚠️ Le symptôme apparaît **loin de sa cause** : un `min-width` calibré pour une
carte fait défiler la page entière, et on le constate sur un écran qui n'a rien à
voir avec le composant fautif. C'est ce qui rend ces bugs coûteux à chercher — et
pourquoi ils reviennent.

### Le zoom iOS se règle sur le `viewport`, pas sur la taille du texte

⚠️ **`maximum-scale=1` sur la balise `viewport`** ([index.html](../../../../index.html)).
C'est là qu'est sa place, et deux tentatives précédentes ont montré pourquoi :

| Autre réglage | Ce qu'il donnerait |
|-----------|--------------------|
| 16 px sur tous les champs, en permanence | Une barre de recherche qui écrit plus gros que le menu déroulant posé à côté — un même écran à deux échelles |
| 16 px en `:focus` seulement | Le champ **change de taille sous le doigt** en s'activant, texte et cadre compris : ça se lit comme un défaut, pas comme une protection |

Un seuil de 16 px en CSS mêle une décision d'interface (la taille du texte) à
une contrainte de plateforme. Traité hors du CSS, il laisse les champs de
saisie à **13 px** — la taille des menus déroulants voisins, un champ ne
devant écrire ni plus gros ni plus petit qu'eux.

⚠️ **Le zoom à deux doigts reste possible.** Depuis iOS 10, Safari ignore cette
restriction pour un geste de l'utilisateur et ne l'applique qu'au zoom qu'il
déclenche lui-même. C'est ce qui rend la valeur acceptable, là où un
`user-scalable=no` — qui bloque vraiment — ne le serait pas.

### Les trois pièges d'iOS

⚠️ **`overflow-x: hidden` ne retient PAS un élément `fixed`.** Safari laisse la
page défiler latéralement dès qu'un flottant dépasse la largeur du viewport : la
règle ne borne que le flux normal, pas ce qui en est sorti. `body` porte donc
`position: relative` et `width: 100%`, et un dernier filet plafonne les `.fixed`
et `.sticky`.

⚠️ **`100vh` inclut la barre d'adresse**, qui se replie au défilement : la page
deviendrait alors plus haute que l'écran, d'où un saut de mise en page à chaque
changement de sens. Toutes les hauteurs de viewport sont en **`dvh`**, avec
`vh` en repli pour les navigateurs qui l'ignorent.

⚠️ **`viewport-fit=cover` est obligatoire** dans le `<meta viewport>`. Sans lui,
`env(safe-area-inset-*)` vaut **zéro** : toutes les gardes posées sur l'encoche
ou sur la barre de geste sont alors inertes, sans que rien ne le signale. La
barre supérieure passerait sous l'encoche, et l'on ne pourrait pas remonter
jusqu'aux premiers éléments de la page.

⚠️ La barre supérieure **descend sous l'encoche** (`height: calc(3rem +
env(safe-area-inset-top))` + `padding-top`), et le dégagement du contenu suit.
Une valeur fixe laisserait le haut de la page sous la barre.



⚠️ **Le « tirer pour recharger » est CONSERVÉ** — c'est un geste attendu sur un
téléphone. Le bloquer parce qu'il se déclenche *avant* que le contenu n'ait
atteint le haut, ce serait traiter le symptôme.

⚠️ Deux causes le déclencheraient trop tôt.

**Une hauteur de `body` en `dvh`** : cette unité suit la hauteur courante du
viewport, donc elle **change** quand la barre d'adresse se replie ou se déplie.
En remontant, la barre se déplie, `dvh` diminue et la page raccourcit sous le
doigt — le défilement se retrouve poussé au-delà du haut.

**La page doit pouvoir défiler sous la barre supérieure.** Quand son contenu
tient dans l'écran, il n'y a rien à faire défiler : le navigateur est « en haut »
dès le départ, et le moindre geste vers le bas déclencherait le rechargement —
avant même qu'on ait vu le premier bloc, qui se trouve pourtant **derrière la barre**.
La hauteur minimale de `body` ajoute donc celle de la barre : il reste toujours
de quoi remonter, et « en haut » signifie bien « je vois le début du contenu ».

`svh` est la hauteur du plus **petit** état (barre dépliée) et ne bouge jamais.
C'est la bonne unité pour une hauteur de page. `dvh` reste correct sur les
**plafonds** d'éléments fixes (`max-h` d'un panneau, d'un dialogue), qui doivent
au contraire suivre la hauteur visible.

⚠️ **`overflow-x: hidden` vit sur `html`, jamais sur `body`.** C'est `html` qui
défile ; sur `body`, la propriété en fait un **second conteneur de défilement**
dont la hauteur se borne au viewport — la molette n'a alors plus rien à faire
défiler sur un écran de bureau.

| Propriété | Sur `html` | Sur `body` |
|-----------|-----------|------------|
| `overflow-x: hidden` | ✅ la garde | ❌ immobilise la page |
| `min-height: 100svh` | — | ✅ hauteur de page |
| `position: relative` + `width: 100%` | — | ✅ largeur de référence des `fixed` |

⚠️ **Safari grossit les polices en paysage** (« text autosizing ») si rien ne
l'en empêche : les tailles calculées ne valent alors plus rien et un bloc dessiné
pour tenir déborde. `html` porte `-webkit-text-size-adjust: 100%`.

⚠️ **Un détecteur nomme le coupable en développement**
(`src/lib/detecteurDebordement.ts`). Il parcourt le DOM après chaque changement,
ne retient que l'élément **le plus profond** qui dépasse — un enfant trop large
déborde tous ses parents, les signaler tous noierait le vrai coupable — et
l'écrit dans la console avec le nombre de pixels en cause. Il est éliminé du
bundle de production (`import.meta.env.DEV`).

⚠️ Il compare à `documentElement.clientWidth`, **jamais** à `window.innerWidth` :
le second inclut la barre de défilement verticale, et tout paraîtrait déborder de
~15 px sur desktop. C'est aussi pourquoi `100vw` est trompeur dans un `calc()`.

⚠️ Le **panneau d'actions mobile** reçoit une garde supplémentaire : ses enfants
flex et grid ont `min-width: 0` d'office. Il accueille des contrôles dessinés
pour une rangée desktop de 900 px, où un `min-width` calibré là-bas déborde
systématiquement.
- ⚠️ **Jamais depuis `scale(0)`** : rien n'apparaît de nulle part. `.96` au
  minimum.
- ⚠️ **Pas de `scale` sur du texte** (`apparition`) : la mise à l'échelle
  déforme les lettres pendant l'animation, et rien ne « grandit » — le message
  se pose, il n'arrive pas de loin.
- La boîte d'un dialogue est **plus lente que son voile** (200 vs 150 ms) : elle
  doit finir après le fond qu'elle recouvre, sinon elle semble le précéder.
