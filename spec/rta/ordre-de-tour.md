# RTA · Ordre de tour & simulation de leads

En bas de la page RTA : **toutes** les cartes de la prépa, triées par vitesse, du
**plus rapide à gauche**, avec des boutons pour simuler différents leads SPD.

Fichier : [TurnOrder.tsx](src/components/rta/TurnOrder.tsx) ·
monté par [RtaPage.tsx](src/pages/RtaPage.tsx) (`allItems` = toutes sections
confondues).

## ⚠️ Vitesse modifiée à la main → détail désynchronisé

Le champ « SPD runes » de l'ordre de tour est **modifiable**, alors que le détail
d'équipement affiché sous la carte reste **celui de l'import**. Dès que les deux
divergent, le panneau montre des runes qui ne produisent plus la vitesse
annoncée.

Un **triangle orange** apparaît donc **sur la carte** et **dans la fiche**, et le
message s'ouvre **AU CLIC** ([DesyncBadge.tsx](src/components/rta/DesyncBadge.tsx)) :

> ⚠️ Une infobulle native ne s'ouvre qu'après un temps d'arrêt, disparaît dès
> qu'on bouge, et **n'existe pas au tactile**. Or le message compte : il dit que
> les runes affichées ne correspondent plus à la vitesse demandée, et renvoie à
> la valeur en rouge de la fiche.

Le panneau passe par **`DetailPopover`** (placement automatique) : les cartes
vont jusqu'au bord droit de la page, et un panneau ancré en dur **sortait de
l'écran**.

Dans la fiche, la **ligne VIT** porte une **flèche rouge suivie de la vitesse
demandée** (`spdCible` de [MonsterGear.tsx](src/components/MonsterGear.tsx)), à
côté du `+X` réellement apporté par les runes. Signaler l'écart **sans donner la
cible** obligerait à faire le calcul soi-même.

Le **nom et la vitesse** du monstre passent aussi **en orange** sur sa carte de
classement — bouton **« Modifiés »** ([categories.md](categories.md)) pour couper
ce signalement.

**Une seule source de vitesse.** Le champ de l'ordre de tour écrit dans
`rta.state.entries`, exactement là où les cartes de classement lisent : modifier
une vitesse en bas met donc **immédiatement** à jour la carte correspondante.
Rien à synchroniser, rien à dupliquer.

> Rappel : la carte affiche `base + runes`, l'ordre de tour y ajoute le **totem**
> (et le lead simulé). Les deux nombres diffèrent donc volontairement.

- Détection par **recalcul**, pas par un drapeau « modifié » stocké
  ([gearSync.ts](src/lib/gearSync.ts)) : on compare la saisie à la vitesse que
  donneraient les runes. L'avertissement reste donc juste après un rechargement
  ou un réimport, et **s'efface tout seul** si le joueur remet la valeur d'origine.
- La vitesse déduite des runes **inclut le bonus de set** (Swift), comme le champ
  lui-même — voir [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md).

## Objectif

Vérifier si l'ordre de passage change selon le lead de vitesse appliqué en jeu.

## Boutons de lead

### ⚠️ Les boutons viennent de la PRÉPA, pas d'une liste figée

Un bouton par lead de vitesse **réellement porté par un monstre de la prépa**, du
plus gros au plus petit, + **« Sans lead »**.

Simuler un +33 % quand aucun monstre de sa box ne le porte n'apprend rien ; à
l'inverse, une liste en dur oublie les leads des sorties récentes. Sur un compte
réel de 40 monstres en prépa, on passe de **6 boutons figés** à **3 boutons
utiles** (+33 % Vanessa, +28 % Megumi, +24 % Moore/Chandra/Xing Zhe).

⚠️ **Seuls les leads inconditionnels en RTA** (`General`, `Arena`). Un lead
d'élément ne profite qu'aux alliés du bon élément, or la simulation applique la
valeur à **tout le monde** : le proposer induirait en erreur. Même règle que pour
la catégorie « Lead SPD » (voir [categories.md](categories.md)).

**Repli** : prépa vide ou sans lead VIT → les valeurs classiques (`SPEED_LEADS`
dans [speed.ts](src/lib/speed.ts)), sinon la rangée serait vide et l'outil
inutilisable avant tout import.

### Ajouter, retirer

- **Champ + « Ajouter »** : la valeur **rejoint la rangée** au lieu de vivre dans
  un champ à part — une fois ajoutée, elle se clique comme les autres et se
  retire pareil. Elle est appliquée aussitôt : on ne l'a pas saisie pour rien.
- **×** sur chaque pilule, **toujours visible** (atténué, net au survol).
  ⚠️ Ne l'afficher qu'au survol laissait un **vide à droite du pourcentage**,
  qu'on lit comme un défaut d'alignement — et un bouton qui apparaît sous le
  curseur se clique par accident. Retirer le lead actif remet « Sans lead » :
  laisser un lead appliqué sans bouton pour l'annuler serait un piège.
- ⚠️ **Le retrait demande une CONFIRMATION**, alors qu'il ne détruit rien
  d'irremplaçable — le pourcentage se retape dans le champ « Ajouter ». Ce qu'on
  protège est plus discret : la rangée **se réordonne** au retrait, et le bouton
  voisin vient prendre la place de celui qu'on visait. Un clic légèrement à côté
  enlève donc le mauvais lead, et on ne s'en aperçoit qu'après.
- ⚠️ **`data-cible-fine` sur le bouton du pourcentage.** Sans lui, la règle
  tactile globale le portait à 40 px — et avec lui **toute la pilule**, qui
  doublait de hauteur au doigt. La cible reste petite mais rien n'est perdu : ce
  bouton occupe toute la surface de la pilule sauf la croix. Voir le piège décrit
  dans [librairie-ui.md](../shared/librairie-ui.md).
- ⚠️ **Deux listes** (`leadsAjoutes`, `leadsRetires`) plutôt qu'une liste
  modifiable : la prépa change (import, ajout d'un monstre) et les boutons
  doivent suivre — sans effacer les ajouts, ni faire réapparaître ce qui a été
  retiré. Mémoire de session (`useStickyState`), comme les autres préférences de
  vue.
- Le lead choisi est **appliqué à tous** les monstres (simulation), toggle
  (re-cliquer désactive).
- **Interrupteur « Surligner les changements »** : quand il est actif ET qu'un
  lead est sélectionné, les monstres dont la **position change** par rapport à
  l'ordre sans lead sont mis en **surbrillance** (bordure/halo dorés). Comparaison
  via un `baselineRank` (ordre à lead 0).

## Calcul (identique au modèle partagé)

Voir [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md).

```
vitesse_effective = (base + runes) + ceil( base × (15 + lead) / 100 )
```

- Le bonus % (**totem 15 % + lead**) porte **uniquement sur la base**, arrondi
  **au supérieur**.
- « Sans lead » = lead 0 → le totem +15 % reste appliqué.
- `TOTEM = 15` local au composant, cohérent avec `speed.ts`. La liste de leads,
  elle, n'est plus dupliquée ici : elle est **déduite de la prépa** (voir plus
  haut), avec `SPEED_LEADS` en repli.

## Tri

- Trié par **vitesse effective décroissante** (le plus rapide à gauche),
  départage par nom. Les monstres sans vitesse finissent en dernier.
- Le rang `#1, #2, …` se recalcule à chaque changement de lead.

## Rendu des cartes

- Disposition **multi-lignes** (`flex flex-wrap`), **jamais de défilement
  latéral** — y compris sous `lg` : le numéro d'ordre porte déjà la séquence,
  quel que soit le rang de la carte dans la grille.
- **Deux gabarits selon le POINTEUR** (`compact:`, pas une largeur d'écran) —
  voir [shared/deux-applications.md](../shared/deux-applications.md) :
  - **Souris** — carte **horizontale** (~168 px), style uniforme avec le siège.
    Badge de rang superposé en haut à gauche, portrait hexagonal + badge élément,
    **nom**, puis icône vitesse + vitesse effective (blanc) et les icônes de sets
    de runes (4 pièces en premier). Champ SPD runes éditable en bas
    (placeholder « + runes »).
  - **Doigt** — carte **verticale et resserrée** (~104 px), portrait **centré**.
    ⚠️ Pas plus resserrée : le champ SPD runes doit garder la place d'au moins
    trois chiffres (la valeur va jusqu'à ~180) — un champ qui ne montre pas ce
    qu'on y tape est pire qu'une carte un peu plus large.
    ⚠️ **Le nom n'a plus sa propre ligne** : douze cartes par écran avec un nom
    tronqué chacune faisaient une grille dense et illisible, là où le portrait
    seul se reconnaît d'un coup d'œil — comme le choix des monstres d'une
    catégorie (voir [categories.md](categories.md)). Le nom reste dans le
    `title` de la carte (combiné aux catégories), pour l'appui long et le
    lecteur d'écran.
- Pas d'icône éclair ; « base X » retiré pour épurer.

## Attendus

- Le champ SPD runes de l'ordre de tour édite **la même donnée** que les cartes
  de section (`onRuneSpeed` → `setRuneSpeed`) : modifier ici met à jour partout.
- Change de lead ⇒ le tri et les rangs se réordonnent en direct.
- Vide ⇒ « Ajoute des monstres pour visualiser l'ordre de tour. »

## Interrupteurs d'affichage

⚠️ « Vitesses » et « Catégories » sont le **même composant** que les trois de la
barre de catégories (`InterrupteurAffichage`, voir
[categories.md](categories.md)). Ils portaient auparavant leur propre style :
l'accent y marquait l'état *masqué* et l'œil barré demandait d'être décodé —
deux défauts déjà corrigés à côté, mais pas ici, si bien que le même geste se
lisait différemment d'un bloc à l'autre.
