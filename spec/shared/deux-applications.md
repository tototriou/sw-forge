# Deux formats de premier rang

SW Forge est **une seule application responsive** — une base de code, un
déploiement. Mais elle vise **deux plateformes** : le téléphone et
l'ordinateur, et **aucune des deux n'est le cas dégradé de l'autre**.

⚠️ La différence avec un site responsive ordinaire tient là : on ne dessine pas
un écran pour le bureau qu'on rétrécit ensuite. Chaque format a ses gestes, ses
contraintes et ses habitudes, et le même écran peut s'y présenter différemment
quand ces contraintes divergent.

C'est la règle de cadre : **elle prime sur tout arbitrage d'interface**, et toute
spec de page se lit avec elle en tête.

## La conséquence pratique

> **Une correction destinée à un format ne touche pas l'autre.**

Une seule base de code, donc, mais deux intentions distinctes à l'intérieur.

Quand on refait un écran pour le téléphone, le bureau garde le sien — et
réciproquement. Ce n'est pas de la prudence : c'est que les deux problèmes ne
sont pas les mêmes.

⚠️ **« L'autre format en profiterait aussi » est le raisonnement à éviter.** Il
paraît généreux et coûte cher : il déplace les repères d'un utilisateur qui ne
demandait rien, sur un écran qui ne souffrait de rien. Un changement ne se
justifie que par un défaut CONSTATÉ sur le format qu'on touche.

### Ce qui est global malgré tout

Trois catégories seulement, et elles se reconnaissent au fait qu'aucun des deux
formats ne les voudrait autrement :

| Catégorie | Exemple |
|-----------|---------|
| **Correction de bug** | Une popup qui sort de l'écran, un débordement horizontal, un calcul faux |
| **Donnée et logique métier** | Les vitesses, les paires de collaboration, les scores de rune |
| **Vocabulaire du jeu** | Les libellés viennent du jeu, dans les deux formats |

Tout le reste — disposition, densité, taille, ordre, choix d'un contrôle — est
**par format**.

## Où passe la frontière

Le seuil est `lg` (1024 px), celui de la barre latérale.

| | Sous `lg` — format MOBILE | Au-dessus — format BUREAU |
|---|---|---|
| Navigation | Barre d'onglets en bas (5 max) | Barre latérale repliable |
| Actions de page | Panneau montant « Options » | Barre d'outils en tête de page |
| Formulaire court | Panneau centré par-dessus | Popup ancrée à son déclencheur |
| Pointeur | Doigt : cibles à 40 px, pas de survol | Souris : cibles à 26-32 px, survol disponible |
| Largeur utile | ~348 px | 900 px et plus |

⚠️ **`lg` et non `sm`.** Une tablette en portrait fait 768 px : elle a la place
d'un bureau mais les gestes d'un mobile. C'est le mode d'interaction qui décide,
et à cette largeur c'est encore un doigt qui touche l'écran.

## Comment l'écrire

Trois outils, du plus simple au plus lourd. **Prendre toujours le plus simple qui
suffise.**

### 1. Les variantes Tailwind — le cas ordinaire

```tsx
className="gap-0.5 sm:gap-1"        // resserré au doigt
className="hidden lg:flex"          // bureau seulement
className="lg:hidden"               // mobile seulement
```

Aucun rendu supplémentaire, aucun état. C'est la réponse à « le même élément,
d'une taille ou d'un écart différent ».

### 2. `useMediaQuery(SOUS_LG)` — quand une VALEUR change

Pour ce que le CSS ne peut pas exprimer : la taille d'un dessin calculée en
pixels, le nombre d'éléments d'une liste, **le choix d'un composant**.

```tsx
const surMobile = useMediaQuery(SOUS_LG);
if (surMobile) return <MobileSheet …>{formulaire}</MobileSheet>;
return <Popover …>{formulaire}</Popover>;
```

⚠️ **Jamais pour masquer un bloc** : `lg:hidden` reste la bonne réponse à
« cacher sur mobile », et ne coûte pas de rendu.

### 3. Deux composants — en dernier recours

Seulement quand les deux formats n'ont plus rien de commun à partager. C'est
rare, et c'est un coût : deux fichiers à faire évoluer ensemble, dont l'un se
teste moins souvent que l'autre.

⚠️ **Le contenu ne se duplique jamais.** Le motif à suivre est *un seul JSX, deux
contenants* :

```tsx
const filtres = (<>…</>);                       // écrit UNE fois

<div className="hidden lg:flex">{filtres}</div> // dans la page, sur bureau
<MobileSheet …>{filtres}</MobileSheet>          // dans le panneau, sur mobile
```

Deux copies divergent au premier champ ajouté — et c'est le genre de divergence
qu'on ne voit pas, puisqu'on ne regarde jamais les deux largeurs en même temps.

## À vérifier avant de livrer

1. **Le format que je n'ai pas touché est-il identique à avant ?** Si le diff
   contient une classe sans préfixe (`gap-0` plutôt que `gap-0 sm:gap-1`), il
   s'applique aux deux — était-ce voulu ?
2. **Un contrôle a-t-il changé de nature ?** (popup → panneau, icône → puce) Si
   oui, l'autre format garde le sien, sauf défaut constaté là-bas aussi.
3. **Le contenu est-il écrit une seule fois ?**
4. **Les deux rendus sont-ils documentés** dans la spec de la page, avec la
   raison de leur différence ?

## Ce que cela prépare

L'objectif est de **servir les deux plateformes également bien** — un jour peut-
être empaquetées séparément (application mobile installable, application de
bureau), mais la base reste commune et responsive.

D'où l'exigence : chaque format doit pouvoir évoluer sans que l'autre bouge, et
chaque écran doit être **pensé deux fois** plutôt qu'une fois puis étiré. C'est
un travail supplémentaire assumé, pas une redondance à éliminer.
