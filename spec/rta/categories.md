# RTA · Catégories de monstres

Étiquettes **libres**, créées par le joueur (« Striper », « Lead SPD », « AoE »,
« Anti-Chasun »…), avec une couleur, et appliquées aux monstres de sa prépa.
Les cartes concernées portent un **anneau de cette couleur**.

Fichiers : [CategoryBar.tsx](src/components/rta/CategoryBar.tsx) ·
[CategoryRing.tsx](src/components/rta/CategoryRing.tsx) ·
[useRtaCategories.ts](src/hooks/useRtaCategories.ts)

## Pourquoi

Une box RTA se lit par **rôle**, pas seulement par set de runes. Les sections
existantes classent par set (Violent, Swift…) ; les catégories offrent une
**seconde lecture, transversale**, que chacun définit comme il veut. Les deux
coexistent : un monstre reste dans sa section et porte ses couleurs.

## Catégorie « Lead SPD » proposée d'office

À la **première prépa non vide**, une catégorie **« Lead SPD »** est créée et
pré-remplie. C'est le classement que tout le monde fait de tête en RTA : autant
le donner déjà fait.

⚠️ **Seuls comptent les leads de vitesse qui s'appliquent en RTA sans condition**
— portée **`General`** ou **`Arena`**. Sont exclus :

| Portée | Pourquoi |
|---|---|
| `Guild`, `Dungeon` | mauvais contenu, le lead ne s'applique pas en RTA |
| `Element` | il ne profite qu'aux alliés du **bon élément** : le ranger avec les leads inconditionnels induirait en erreur au moment de composer une équipe |

Sur les données actuelles : **114 monstres retenus sur 183** qui ont un lead de
vitesse.

- ⚠️ **Pas au tout premier chargement** : la prépa y est souvent vide (compte pas
  encore importé), et une catégorie créée à ce moment-là resterait éternellement
  sans personne. Le drapeau `seeded` n'est posé qu'**après un amorçage réussi**
  (prépa non vide *et* au moins un monstre à lead VIT), sinon on la perdrait sans
  l'avoir jamais montrée.
- ⚠️ Un enregistrement à **l'ancienne forme** (simple tableau) est migré avec
  `seeded` **à faux** : un joueur qui avait déjà créé des catégories avant
  l'arrivée de « Lead SPD » doit lui aussi se la voir proposer.
- Ensuite elle **vit sa vie** : renommée, vidée ou supprimée comme les autres.
  Elle n'est pas recréée.

## Interrupteurs d'affichage

Trois boutons **sur leur propre rangée**, sous les catégories : **Vitesses**,
**Modifiés** et **Catégories**.

⚠️ Ils étaient poussés à droite de la rangée des pastilles. Ils ne créent ni ne
classent rien — ils coupent du bruit à l'écran, ce que ni « + Catégorie » ni les
pastilles ne font. Mêlés à elles, ils passaient à la ligne dès qu'une catégorie
de plus existait, et se retrouvaient un coup à droite, un coup en dessous, selon
le nombre de catégories. Sur téléphone la rangée en comptait déjà quatre éléments
avant eux. Ils coupent le bruit **sans rien perdre** — les données restent,
seul le rendu disparaît. Les trois états sont **persistés**.

- ⚠️ **Les trois sont TOUJOURS affichés**, même quand ils ne servent à rien (pas
  encore de catégorie, aucun monstre modifié) : ils forment un groupe fixe. Un
  bouton qui apparaît et disparaît fait sauter la rangée et donne l'impression
  d'un réglage qu'on aurait perdu.
- Le libellé nomme **ce qu'on affiche**, pas l'état du réglage — « Couleurs
  masquées » obligeait à relire le bouton pour savoir ce qu'il pilote. C'est
  l'**icône œil barré** qui porte l'état.
- **Vitesses** — masque la vitesse sur les cartes de classement. Utile quand on
  range sa box par rôle et que les chiffres n'apportent rien à ce moment-là.
- **Modifiés** — écrit en **orange le nom et la vitesse** des monstres dont les
  runes ne suivent plus la vitesse demandée dans l'ordre de tour (voir
  [ordre-de-tour.md](ordre-de-tour.md)). On repère ainsi ceux à re-runer **sans
  ouvrir chaque fiche**. ⚠️ Sous `sm` le nom n'est pas affiché (voir plus bas) :
  seule la vitesse porte l'orange, ce qui suffit — c'est elle qui est en cause.
- **Catégories** — masque les anneaux de couleur.

Le bouton **Catégories** coupe les anneaux **sans rien perdre** : les catégories,
leurs membres et leurs couleurs restent, seul le rendu disparaît (cartes, ordre
de tour et légende). Avec plusieurs catégories, l'écran se charge vite — il faut
pouvoir revenir à une lecture nette en un clic.

### ⚠️ Catégorie par catégorie — depuis la LÉGENDE

Le bouton ci-dessus est un tout-ou-rien. Or le geste courant est « montre-moi
seulement mes strippers » : sur six catégories, les anneaux se marchent dessus et
l'ordre de tour devient illisible — c'est justement là qu'on veut n'en garder
qu'une ou deux.

**Cliquer une entrée de la légende masque sa catégorie**, exactement comme la
légende des courbes de runes ([../compte/runes.md](../compte/runes.md)) : on
éteint ce qu'on ne veut pas voir, **là où on le voit**.

- ⚠️ **Dans la légende, pas un bouton de plus dans la barre.** La barre en porte
  déjà trois ; le réglage appartient à l'endroit où la couleur apparaît.
- ⚠️ **Une entrée éteinte reste en place**, barrée et estompée, sa pastille
  passant du plein au **creux** (la couleur reste reconnaissable). La retirer
  supprimerait le seul endroit où la rallumer.
- Le masquage vaut pour les **cartes ET l'ordre de tour** : `categoriesOf` ne
  renvoie que les catégories visibles. Le **panneau d'affectation** lit
  `categories` directement — on doit pouvoir ranger un monstre dans une
  catégorie qu'on a masquée.
- **Deux niveaux qui se composent** : `visible` coupe tout, `masquees` éteint
  l'une d'elles. Le premier reste utile pour un écran net d'un coup.
- On stocke les **masquées** et non les visibles : une catégorie qu'on vient de
  créer s'affiche sans qu'on ait à la cocher. Son id sort de la liste à la
  suppression, et `replaceAll` la vide (les ids changent, les anciennes ne
  désignent plus rien).
- La prépa d'un **ami** ne reçoit pas ces props : rien n'y est réglable, les
  entrées de sa légende ne sont donc pas cliquables.

## Modèle & persistance

```ts
interface RtaCategory { id: string; label: string; color: string; members: string[] }
```

- `members` = **`monsterId`** (id local), la même clé que les entrées RTA.
- Persistance `localStorage` sous `sw-forge-rta-categories-v1` :
  `{ categories, seeded, visible }`, relue en **validant** (couleur `#rrggbb`,
  libellé non vide) — un enregistrement bricolé à la main ne doit pas casser la
  page. L'ancienne forme (un simple tableau) est encore lue.
- Libellé borné à **24 caractères** (il tient dans une pastille).

## ⚠️ Maximum 4 catégories par monstre

`MAX_CATEGORIES_PER_MONSTER = 4`. C'est une **limite d'affichage assumée**, pas
une limite de modèle : au-delà, les segments de l'anneau deviennent trop courts
pour qu'on distingue les couleurs sur une carte de cette taille.

- Le plafond est vérifié **à l'ajout uniquement**. **Retirer marche toujours**,
  y compris sur un monstre qui l'aurait dépassé — sinon des données bricolées
  deviendraient impossibles à corriger depuis l'interface.
- Un monstre au plafond reste **visible** dans le panneau, grisé, avec
  l'infobulle qui dit pourquoi. Le cacher laisserait croire à un bug.

## Anneau — `CategoryRing`

- **1 catégorie** → anneau plein. **2, 3 ou 4** → anneau **découpé en segments
  égaux** (180°, 120°, 90°), pour qu'on voie d'un coup d'œil qu'un monstre cumule
  les rôles.
- Technique : `conic-gradient` + **masque anneau** (deux calques composés en
  `exclude`). Conséquence importante : **aucun changement de structure** de la
  carte — pas de wrapper à intercaler, pas de bordure à repeindre, et le contour
  épouse les coins arrondis. C'est un `<span>` en `absolute` par-dessus.
- L'ordre des segments suit **l'ordre de création** des catégories : stable d'une
  carte à l'autre et d'un rendu à l'autre.
- Les libellés passent en **infobulle** de la carte (« Striper · Lead SPD »).

## Barre de catégories

Sous la barre d'actions de la page, avant les sections.

- ⚠️ **Tous les éléments de la barre font la même hauteur** (`h-7`) : pastilles,
  bouton d'ajout, interrupteur. Des hauteurs différentes donnaient une rangée en
  dents de scie.
- La **création et l'édition** se font dans une **popup flottante** (`absolute`,
  fermée au clic extérieur et à Échap).
  ⚠️ **Jamais un formulaire dans le flux** : inséré dans la rangée, il poussait
  les pilules suivantes et **décalait toute la page** à chaque ouverture — et on
  perdait de vue la pilule qu'on éditait.
- Une **pastille par catégorie**, **teintée de sa propre couleur** (fond dilué,
  bordure moyenne) : c'est la couleur qui porte l'information, pas un point gris
  posé à côté d'un libellé.
  - ⚠️ **Une seule pilule**, dont le style vit sur le conteneur ; les deux
    boutons (ouvrir / éditer) sont **transparents à l'intérieur**. Deux boutons
    bordés côte à côte laissaient une couture visible — et un bouton dans un
    bouton est du HTML invalide.
  - Le **crayon** n'apparaît **qu'au survol** (et au focus clavier) : il ne sert
    qu'occasionnellement et alourdissait la barre en permanence.
  - L'**effectif** ne s'affiche **que s'il est > 0** : un « 0 » collé au libellé
    d'une catégorie qu'on vient de créer n'est que du bruit.
- ⚠️ **L'effectif compte les membres RÉELLEMENT présents dans la prépa.** Un
  monstre retiré de la page garde son appartenance (il peut revenir), mais le
  compter afficherait un nombre qui ne correspond à rien à l'écran.
- **« + Catégorie »** ouvre la saisie : titre + **palette de 12 couleurs**.
  - ⚠️ **Pas de `<input type="color">`.** Le sélecteur natif est un contrôle du
    système : il ne suit ni la charte sombre ni les arrondis de l'app, et il jure
    au milieu du reste.
  - La palette est **fermée**, et c'est voulu : un choix libre laisse composer
    deux teintes trop proches, **indistinguables sur l'anneau**. Les douze
    couleurs sont franches et se séparent bien sur fond sombre.
  - La couleur proposée par défaut est **la première non utilisée**, pour ne pas
    créer deux catégories de la même couleur par inadvertance.

## Panneau d'affectation

**Cliquer une catégorie** déplie, juste en dessous, **tous les monstres de la
page en petites icônes** ([MonsterAvatar](src/components/MonsterAvatar.tsx),
36 px) ; un clic ajoute ou retire. Les membres portent un liseré de la couleur,
un fond teinté et une pastille ✓ ; les non-membres sont atténués.

Le panneau reprend la **teinte de la catégorie ouverte** : on sait toujours dans
laquelle on est en train de cocher.

C'est le sens de lecture naturel : on part du rôle (« qui sont mes stripers ? »)
et on coche, plutôt que d'ouvrir chaque monstre pour lui attribuer des rôles.

Un bouton **« Tout décocher »** vide la catégorie **sans la supprimer** — on
garde le libellé et la couleur pour repartir de zéro. Il n'apparaît que s'il y a
quelque chose à décocher.

## ⚠️ L'ordre de tour porte les mêmes couleurs

Les cartes de l'**ordre de tour** ([TurnOrder.tsx](src/components/rta/TurnOrder.tsx))
portent **le même anneau** que les cartes de sections. C'est là que le repère
sert le plus — on lit la séquence des tours en cherchant « qui strip en
premier ? » — et un code couleur qui s'arrête en route ne sert à rien.

L'**interrupteur des couleurs est répété** dans l'en-tête de l'ordre de tour :
il est en bas de page, et remonter tout en haut juste pour couper les anneaux
serait absurde.

⚠️ La mise en avant des **changements de place** (lead actif) se fait par le
**fond orange de la carte, et rien d'autre**. Repeindre la bordure entrait en
concurrence avec l'anneau de catégories : deux informations au même endroit, on
ne lisait plus ni l'une ni l'autre.

Une **légende** est affichée au-dessus : pastille de couleur + libellé, pour
**les seules catégories réellement représentées** dans l'ordre de tour. Sans
elle, un anneau coloré ne veut rien dire pour qui n'a pas la barre de catégories
sous les yeux ; et rappeler des couleurs absentes de l'écran serait du bruit.

Chaque entrée est **cliquable** et masque sa catégorie — voir « Catégorie par
catégorie » plus haut.

## Attendus

- Supprimer une catégorie retire l'anneau correspondant partout, sans toucher
  aux autres.
- « Tout effacer » de la prépa **ne supprime pas les catégories** : ce sont des
  définitions du joueur, pas des données de compte.
- Aucune catégorie créée → la barre n'affiche que « + Catégorie », et aucune
  carte n'a d'anneau.

## La carte sur téléphone

⚠️ **Le nom du monstre n'est pas affiché sous `sm`.** Sur deux colonnes de
150 px, la ligne porte déjà la vitesse, le badge de désynchronisation et trois
icônes de set : il ne restait au nom qu'une quarantaine de pixels, de quoi
afficher « Sath… » — qui ne distingue rien.

Le **portrait** identifie le monstre bien mieux qu'un nom tronqué, et il est déjà
là. La **vitesse** prend la place libérée, calée à gauche : c'est la donnée qu'on
vient lire sur cet écran, la prépa RTA se réglant au point de vitesse.

⚠️ Le nom complet passe dans l'**infobulle de la carte**, en tête des catégories.
Sans cela il n'existerait plus nulle part sur téléphone.

⚠️ Les icônes de set sont **collées** (`gap-0`) et la ligne entière resserrée
(`gap-0.5` sous `sm`). À trois sets — le maximum — les écarts suffisaient à
faire déborder la dernière icône de la carte. Elles restent lisibles au
contact : ce sont des pastilles rondes cerclées, chacune se détache de sa
voisine sans qu'il faille un blanc entre elles.

⚠️ Les icônes de set réservent `pr-3` sous `sm`. La croix de suppression est
posée **sur** le coin haut-droit, hors du flux : rien ne la repousse, et la
dernière icône passait dessous dès que le nom masqué eut libéré assez de place
pour que les trois atteignent le bord.
