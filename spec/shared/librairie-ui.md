# Librairie UI — le vocabulaire visuel commun

> **Source de vérité** pour la façon dont un contrôle se dessine. Les VALEURS
> (couleurs, échelle de texte, rayons) restent dans
> [design.md](design.md) ; ce document dit **quels composants existent** et
> **comment on choisit entre eux**.
>
> Code : [`src/ui/`](../../src/ui/), point d'entrée unique
> [`src/ui/index.ts`](../../src/ui/index.ts).

## Le problème que ce dossier résout

Avant lui, chaque écran redessinait ses boutons. Un même bouton d'action existait
en une quarantaine d'exemplaires, chacun avec ses classes recopiées puis
divaguées : rembourrages différents à deux pixels près, deux rayons de coin,
trois façons de dire « désactivé ».

La conséquence n'était pas esthétique mais **économique** : demander « réduis les
boutons sur téléphone » voulait dire refaire le même travail dans dix-sept
fichiers, et en oublier trois.

Une tentative avait déjà eu lieu, sous forme d'un fichier de **constantes de
classes** (`buttonStyles.ts`). Elle a échoué, et il faut savoir pourquoi :

> ⚠️ **Une constante de classes se contourne, un composant non.** Sept fichiers
> importaient `BOUTON_PRIMAIRE`, quarante dessinaient des boutons à la main. Rien
> ne s'opposait à recopier la chaîne en y ajoutant « juste un `px-2` pour ce
> cas » — et la divergence repartait. Un composant impose sa structure : la
> hauteur tactile, la pression au clic, l'état désactivé ne sont plus négociables
> au point d'appel.

## La règle qui gouverne tout le reste

> ⚠️ **Un composant dessiné dans `src/ui/` ne se redessine nulle part ailleurs.**
> Si un écran a besoin d'un bouton, il importe `Bouton`. S'il a besoin d'un
> bouton qui n'existe pas, on ajoute **un axe** au bouton — jamais un bouton de
> plus dans un dossier de page.

## Des AXES, pas un catalogue de variantes

C'est la décision structurante de cette librairie, et elle a été prise **contre**
un premier jet qui nommait ses styles par intention (`principal`, `discret`,
`destructeur`…).

Ce premier jet ne tient pas : dès qu'un écran veut un bouton d'ajout **en
pointillés**, il faut une cinquième entrée. Puis une sixième pour la même chose
en rouge. Puis une septième pour la version sans fond. Le catalogue grossit d'une
ligne à chaque écran neuf, et les combinaisons manquantes se règlent en
`className` — c'est-à-dire par le contournement qu'on cherchait à empêcher.

Les axes se **choisissent séparément et se combinent** :

| Axe | Valeurs | Ce qu'il décide |
|-----|---------|-----------------|
| `ton` | `neutre`, `accent`, `danger` | La **couleur** de l'action |
| `fond` | `vide`, `doux`, `plein` | Le **remplissage** |
| `trait` | `aucun`, `plein`, `pointille` | Le **contour** |
| `forme` | `boite`, `pilule` | Le **rayon des coins** |
| `taille` | `xs`, `sm`, `md`, `carre` | L'**encombrement** |

> ⚠️ **`fond` décide aussi de la COULEUR DU CONTENU**, pas seulement du
> remplissage. Un bouton sans fond prend une icône qui vire à la teinte de son
> ton au survol — juste sur une surface neutre. Sur un fond peint de cette même
> teinte, cela donnait une **croix rouge sur fond rouge** : l'icône disparaissait
> exactement au moment où on la vise. D'où trois cas de texte (`nu`, `doux`,
> `plein`) et non deux, et d'où un `fond="plein"` **opaque** pour le ton
> `danger` : c'est le cran des actions posées SUR autre chose, où un fond
> translucide laisse passer l'image dessous.
>
> ⚠️ Corollaire : **ne jamais peindre un fond en `className`.** Le composant ne
> peut pas le savoir, et choisit alors la couleur de contenu du fond nu.

> ⚠️ **`taille="carre"` n'a aucun rembourrage, dans aucune direction.** Elle
> existe parce qu'un `p-0` posé en `className` par-dessus une taille qui
> rembourre **ne marche pas de façon fiable** : l'ordre des classes dans
> l'attribut ne décide de rien, c'est leur ordre dans la feuille de style qui
> tranche. Les boutons-icônes s'affichaient vides — colorés, cliquables, sans
> icône — parce que le `py-1` de la taille `sm` mangeait les 20 px de hauteur.
> Une annulation après coup marche ou ne marche pas selon ce que Tailwind a émis
> en premier ; une taille à part ne peut pas entrer en conflit.

Trois axes de couleur × trois de fond × trois de trait couvrent ce que douze
variantes nommées n'auraient pas couvert. Et surtout :

> ⚠️ **La librairie ne grossit que si un AXE manque**, jamais parce qu'un écran
> de plus a un besoin de plus. « Bouton d'ajout » n'est pas une variante : c'est
> `trait="pointille"`, et le pointillé dit « contenant pas encore rempli » dans
> toute l'app, pas seulement là où on l'a écrit.

### Le piège de la règle tactile

> ⚠️ **Un bouton natif POSÉ DANS un contenant y impose sa hauteur.** La règle
> globale porte tout `<button>` à 40 px au doigt (voir `index.css`). Sur un
> bouton qui vit dans une pilule, une carte ou une rangée dense, ce n'est pas lui
> qui grandit : c'est **son contenant**, qui double de hauteur sans que rien dans
> son propre code ne l'explique. La rangée des leads SPD y prenait deux fois la
> place nécessaire, et le fautif était un bouton intérieur de 20 px.
>
> La sortie est `data-cible-fine`, et elle se justifie à chaque fois : elle ne
> s'emploie que si **la cible reste atteignable autrement** — parce que le
> contenant entier est touchable, ou parce que rien d'autre n'est cliquable
> autour. Les composants de la librairie la posent déjà (`BoutonIcone`
> `taille="serre"`, `Selecteur` `taille="dense"`, `Pastille` via
> `data-hauteur-fixe`) ; **un `<button>` écrit à la main ne la pose pas**, et
> c'est exactement là que le bug revient.

### Axes de comportement

Trois axes ne touchent pas à l'apparence au repos mais à ce que le bouton fait
selon le contexte :

- **`nuAuDoigt`** — le bouton se déshabille au tactile : plus de cadre, plus de
  fond, plus de rembourrage, il ne reste que l'icône. ⚠️ **Réservé aux barres où
  le même geste se répète cinq ou six fois.** Six boutons encadrés font six
  carrés dans une barre qu'on cherche à compacter, et le cadre n'apprend rien :
  l'icône dit l'action, sa présence dit qu'on peut la toucher. Il pose
  `cible-tactile`, qui rend 44 px touchables **sans qu'un pixel du dessin ne
  bouge** — sinon la règle des 40 px regonflerait ce qu'on vient de déshabiller.
- **`libelleAuDoigt`** — le libellé tombe et ne reste que l'icône. ⚠️ Sans effet
  s'il n'y a pas d'icône : un bouton muet n'est plus un bouton.
- **`actif`** — bouton à **deux états**. Il prend le fond de son ton et pose
  `aria-pressed` : sans quoi un lecteur d'écran annonce « bouton » là où
  l'utilisateur voit un interrupteur.

> ⚠️ **Le libellé se masque, il ne DISPARAÎT pas.** C'est pourquoi l'API est
> `icone` + `libelle` et non un `children` libre : le panneau d'actions mobile
> **rend les mots** quand la place existe (règle `[data-tiroir]` dans
> `index.css`), et il ne peut le faire que si le libellé est dans un `<span>`
> repérable. Un texte écrit en dur dans `children` n'est plus rattrapable, et la
> rangée d'icônes nues du panneau redevient un rébus.

## Les composants

### Fondation

**`Bouton`** — toute pression qui n'est pas une pastille de filtre. Porte les
cinq axes ci-dessus.

### Préréglages

Ils n'ont **pas de style propre** : ce sont des `Bouton` dont certains axes sont
fixés. Un changement dans `Bouton` les traverse tous sans qu'on y touche.

**`BoutonGroupe`** — **le** bouton des rangées : un libellé, une icône
**optionnelle** à gauche, des actions **optionnelles** accolées à droite. Une
pilule de catégorie (puce + nom + éditer + supprimer), une pilule de lead
(pourcentage + retirer), un filtre (« Sans lead »), un interrupteur d'affichage
(« Vitesses »), un bouton d'ajout en pointillés.

> ⚠️ **Un seul composant pour ces cinq-là**, alors qu'ils étaient cinq écritures
> différentes. Ce qui les distingue n'est pas leur nature — ce sont tous des
> boutons d'une même rangée, à la même hauteur — mais la seule présence ou
> absence de décorations. Cela se dit avec deux props facultatives, pas avec cinq
> composants. Et une rangée qui les mélange ne fait plus de **dents de scie**,
> puisque la hauteur est écrite à un seul endroit.

> ⚠️ **Le cadre porte le style, les boutons sont transparents dedans.** C'est une
> contrainte du HTML avant d'être un choix : un `<button>` dans un `<button>` est
> invalide. Le conteneur n'est donc pas un bouton — il dessine, ses enfants
> agissent. Bénéfice au passage : aucune couture entre le bouton principal et ses
> actions, là où trois boutons côte à côte laissent deux traits.

> ⚠️ **UN SEUL MARQUEUR d'état : le fond.** Il cumulait fond + bordure teintée +
> ombre — trois signaux pour dire une seule chose. Le bouton se surlignait deux
> fois et bavait sur ses voisins. L'ombre part aussi : un bouton actif ne
> **décolle** pas de la page, l'élévation est réservée à ce qui flotte.

> ⚠️ Il pose `data-cible-fine` sur son bouton principal, et **c'est son cœur** :
> sans lui, la règle tactile ne gonflerait pas ce bouton mais le **cadre** qui
> l'enveloppe. Rien n'est perdu — le bouton occupe toute la surface du groupe
> sauf les actions.

**`BoutonIcone`** — réduit à son icône. ⚠️ `libelle` est **obligatoire et jamais
dessiné** : il alimente `aria-label` et `title` à la fois. L'app comptait une
dizaine de boutons muets pour un lecteur d'écran ; le rendre obligatoire dans le
type est la seule façon de ne plus avoir à y penser.

- `taille="serre"` n'est **pas « plus petit »**, c'est une **exemption tactile** :
  un bouton posé DANS un contenant plus petit que la cible de 40 px (les deux
  boutons d'une pilule de 28 px). Portés à 40 px ils la débordent ; dotés en plus
  d'une zone étendue de 44 px ils se chevauchent, et **on supprime la catégorie
  en voulant l'éditer**.
- `zoneEtendue` — **le dessin reste petit, la cible fait 44 px.** C'est
  l'INVERSE de `serre`, et les deux ne se confondent pas :

  | | `serre` | `zoneEtendue` |
  |---|---|---|
  | Pour | un bouton **dans** un contenant plus petit que 40 px | un bouton **isolé**, posé sur une surface |
  | Dessin | 20 px | inchangé (28 px) |
  | Zone touchable | celle du dessin | **44 px** |
  | Pourquoi pas l'autre | une zone étendue chevaucherait le voisin | sans zone étendue, on vise 28 px au pouce |

  ⚠️ Il pose `data-cible-fine` **et** `cible-tactile` **ensemble**, et c'est
  tout l'intérêt d'en faire un seul axe : le premier seul laisse la cible sous
  les 44 px réglementaires, le second seul laisse la règle globale étirer le
  bouton en **ovale de 28 × 40**. Les séparer casse soit la visée, soit la forme
  — c'est arrivé deux fois avant que l'axe existe.
- `forme` — **transmise, alors qu'elle était seulement annoncée.** L'en-tête du
  composant dit depuis toujours que les axes du bouton restent ouverts, `forme`
  comprise ; elle ne l'était pas, et se déduisait de `taille`. Un bouton d'icône
  **rond de taille normale** était donc impossible sans réécrire son rayon
  par-dessus. Défaut inchangé : `pilule` quand `serre`, `boite` sinon.
- `auSurvol` — n'apparaît qu'au survol du conteneur (qui porte `group`).
  ⚠️ **JAMAIS `hidden group-hover:flex`** : l'élément sortirait du flux, donc ne
  serait ni focusable au clavier ni atteignable au doigt — on ne pouvait plus
  retirer un monstre sur téléphone. On joue sur l'**opacité**, et il est visible
  d'office là où il n'y a pas de survol.

### Composants à part entière

**`Champ`** — saisie texte. ⚠️ `compact:text-base` n'est **pas un choix de
taille, c'est un correctif** : sous 16 px, iOS **zoome** sur le champ à la mise
au point, et la page ne revient pas seule de ce zoom. C'est la seule raison pour
laquelle un champ grossit au doigt alors que tout le reste rétrécit. Écrit une
fois ici, ce piège ne peut plus être oublié dans un formulaire neuf.

**`Selecteur`** — liste déroulante. ⚠️ `appearance-none` + notre propre chevron :
le contrôle natif dessine sa flèche avec les couleurs du **système**, qui ne
suivent aucun des deux thèmes — sur fond sombre, une flèche noire disparaît. La
**liste ouverte** reste celle du système : c'est le seul morceau de l'app qu'on
ne dessine pas, et le remplacer coûterait un menu flottant complet à claviériser.

**`Interrupteur`** — glissière avec libellé. ⚠️ `role="switch"` et non `button` :
un lecteur d'écran annonce « interrupteur, activé » plutôt que « bouton » — la
différence entre savoir dans quel état on est et devoir l'essayer pour le
découvrir.

> ⚠️ **Interrupteur ou Pastille ?** Ils ont le même rôle logique, et le choix
> n'est pas affaire de goût. La **pastille** vit dans une RANGÉE de ses
> semblables, où seul le fond peut porter l'état sans que trois voisines se
> disputent le regard. La **glissière** vit SEULE, avec une phrase à côté : elle
> a la place de dessiner son état, et le mouvement du curseur dit dans quel sens
> on va.

**`Pastille`** — pilule de filtre à deux états, posée en RANGÉE de critères :
l'élément, la rareté naturelle, les doublons de la box (les mêmes au Bestiaire).
On l'enclenche pour restreindre une liste, et plusieurs le sont souvent à la
fois.

> ⚠️ **Distincte d'un `Bouton actif`.** Un bouton à état signale un MODE ou une
> option et se lit seul ; une pastille POSE UN FILTRE et se lit en rangée. La
> forme serrée (pilule `text-xs`) et l'usage (une grille de critères) en font une
> brique à part — c'est celle que `Bouton` annonçait en tête (« toute pression
> qui n'est pas une pastille de filtre passe par ici ») avant qu'elle existe.

> ⚠️ **Un seul marqueur d'état, deux schémas jamais mêlés dans une rangée.** Sans
> `couleurs`, l'état actif prend l'**accent** de l'app — c'est le cas de filtres
> qui n'ont pas de couleur propre (Nat, Doublons, 2A) : un seul style les
> rassemble, là où trois surbrillances se liraient comme trois natures de filtre.
> Avec `couleurs`, l'**appelant porte la teinte** (l'élément a la sienne, un
> token partagé avec le Bestiaire via `elementStyles.ts`), exactement comme la
> `teinte` d'une `Vignette` : la couleur est une DONNÉE de l'appelant, jamais une
> valeur en dur dans la librairie. La bordure colorée reste visible au repos, le
> fond teinté ne fait que confirmer l'état posé.

**`Option`** — choix riche : icône, titre, description. ⚠️ Distinct de `Bouton`
parce qu'il **ne se lit pas pareil** : un bouton s'identifie d'un coup d'œil, une
option se LIT. D'où le texte aligné à gauche et l'icône calée en haut — sur deux
lignes de description, une icône centrée verticalement flotte en face de rien.

> ⚠️ **La description n'est pas décorative.** Ces choix engagent ce qu'on ne peut
> pas défaire d'un clic (ce qu'on publie de son compte, ce qu'on écrase). Un
> titre seul oblige à deviner, et c'est précisément là qu'on se trompe. Voir la
> règle du [README](../README.md) : le défaut ne perd jamais rien, et ce qui perd
> s'explique avant.

**`Flottant`** — surface posée au-dessus de la page, ancrée à ce qui l'a ouverte :
popup d'édition, formulaire ancré, liste de résultats d'une recherche.

> ⚠️ **C'est la seule chose de l'app qui ait droit à une OMBRE.** L'élévation dit
> « je suis au-dessus, et je vais repartir » — ce qui est faux d'un bouton actif
> ou d'une carte sélectionnée, qui appartiennent à la page. Trois écrans
> recopiaient les mêmes `shadow-glow shadow-black/60`.

> ⚠️ **Le `z-index` est un ORDRE, pas un nombre libre.** L'échelle de l'app —
> contenu → barre du haut (20) → **flottants (30)** → onglets mobiles (40) →
> panneau montant (50) → panneau de second niveau (60) → dialogues (70) — se
> règle ici pour tout ce qui flotte. Un `z-40` écrit à la main « pour que ça
> passe devant » se retrouve un jour derrière la barre d'onglets. La liste de
> résultats de la recherche RTA était d'ailleurs à `z-20`, à égalité avec la
> barre du haut.

> ⚠️ Il ne s'occupe **pas du placement** : le recalage à l'écran reste au hook
> `useRecalageEcran`, qui a besoin de mesurer. Mais il pose `left-0`, sans quoi
> une valeur négative de recalage ne décale pas — elle repositionne depuis un
> bord que le navigateur choisit seul.

> ⚠️ `rembourrage="aucun"` pour une **liste** : ses entrées doivent toucher les
> bords, sinon le survol laisse une bande morte et l'entrée surlignée paraît
> décalée de son propre cadre. C'est pourquoi le flottant porte
> `overflow-hidden` — sans lui, les coins carrés du contenu dépassent de
> l'arrondi du cadre, en quatre petits ergots aux angles.

**`FlottantAuto`** — le même, mais qui **choisit son côté** en mesurant la place
autour de son ancre : vers la gauche si l'ancre est près du bord droit, vers le
haut si elle est près du bas.

> ⚠️ Pour ce qui est ancré à un élément **dont la position varie** : une tuile
> dans une grille, une carte de monstre, un badge au bout d'une ligne. Ces ancres
> vont jusqu'aux bords de la page, et un flottant posé toujours du même côté s'y
> trouvait coupé — exactement là où l'on venait de cliquer pour lire quelque
> chose.

> ⚠️ **Distinct de `useRecalageEcran`**, qui *tire* une surface débordante vers
> l'intérieur après coup. Ici on choisit le bon côté **avant** de peindre : pas
> de saut visible, et la surface reste alignée sur son ancre au lieu de flotter à
> une position corrigée. Le recalage reste utile quand la surface doit garder son
> côté (le formulaire de catégorie, ancré à sa pilule).

> ⚠️ `useLayoutEffect` et non `useEffect` : la mesure doit précéder la peinture.
> Avec `useEffect`, la surface apparaissait un instant du mauvais côté puis
> sautait — un scintillement d'une frame, mais visible.

**`Modale`** — la coquille de **toute** boîte modale : voile, centrage, fermeture
au clic extérieur et à Échap. `ConfirmDialog`, `PromptDialog` et
`KeepAccountDialog` en dérivent.

> ⚠️ **Elle est montée dans `<body>` par un portail, jamais là où elle est
> écrite.** C'est ce qui manquait, et le bug était instructif : sur téléphone, une
> modale s'ouvre souvent depuis le panneau « Options », dont le contenu porte
> `data-tiroir`. La règle `[data-tiroir] .flex-col { align-items: flex-start }`,
> écrite pour aligner les boutons empilés du panneau, tombait donc sur la boîte de
> la modale — son en-tête, son corps et son pied se rétrécissaient sur leur
> contenu. La croix se collait au titre, les champs n'atteignaient plus le bord,
> les boutons restaient à gauche.
>
> **Trois symptômes, une cause, et rien dans le code de la modale ne pouvait
> l'expliquer** puisque la règle venait d'un ancêtre. `position: fixed` ne protège
> pas de cela : il détache la **position**, pas l'héritage des sélecteurs
> descendants. Seul un portail sort du sous-arbre.
>
> Le portail règle deux autres pièges au passage : plus de contexte d'empilement
> parent qui puisse coincer le `z-index`, et plus de découpage par un
> `overflow: hidden` d'ancêtre.

### Une seule grammaire, trois bandes

Toutes les modales de l'app ont la même structure, et l'appelant ne la compose
pas — il remplit trois emplacements :

| Bande | Contenu | Rendue par |
|-------|---------|------------|
| **En-tête** | icône, `titre` à gauche, `sousTitre`, croix à **droite** | la coquille |
| **Corps** | `children` — le seul à défiler | l'appelant |
| **Pied** | `actions` — les boutons, toujours en bas | la coquille |

> ⚠️ **Le titre est rendu PAR la coquille**, pas écrit dans le contenu. Chaque
> dialogue posait son propre `<h2>` avec sa taille et sa marge : quatre écrans,
> quatre en-têtes légèrement différents. Il porte aussi l'`id` de `labelledBy`,
> donc un lecteur d'écran annonce le bon titre sans que l'appelant ait à faire
> correspondre les deux à la main.

> ⚠️ **La croix est toujours en haut à droite.** On cherche la sortie d'une
> fenêtre au même endroit à chaque fois ; une croix qui se déplace d'un écran à
> l'autre se cherche.

> ⚠️ **Les actions sont toujours en bas, et le pied ne défile pas.** C'est
> l'objet de la structure en trois bandes : sur une fiche longue, des boutons
> écrits dans le corps se retrouvaient au bout du défilement, là où personne ne
> les cherche.

> ⚠️ **Rangée taquée à droite par défaut ; empilée quand les libellés sont des
> PHRASES.** « Non, ne rien garder de mes informations » face à « Garder mes
> données (recommandé) » : deux phrases ne tiennent pas sur une ligne.
>
> ⚠️ **Une rangée qui se replie ne vaut jamais mieux qu'une colonne assumée.**
> Repliés, les boutons gardent chacun sa largeur propre et s'alignent à droite —
> on obtient un escalier de boutons de tailles différentes. `actionsEmpilees` les
> met donc en colonne **à toutes les largeurs**, chacun occupant toute la boîte.
> Un « Valider » ou un « Créer », lui, n'a rien à gagner à s'étaler d'un bord à
> l'autre : il reste en rangée.
>
> ⚠️ `flex-col` et non `flex-col-reverse` : les enfants s'écrivent secondaire
> d'abord, mis en avant ensuite. En colonne simple, le mis en avant tombe donc en
> bas — sous le pouce, et au même rang que le « à droite » d'une rangée.

> ⚠️ **`noteFinale` se pose SOUS les boutons**, centrée. Sa place fait son rôle :
> elle désamorce l'engagement une fois les choix sous les yeux (« tu pourras
> changer d'avis »). Remontée dans le corps, elle devient une consigne de plus à
> lire avant de décider — je l'avais déplacée, la fenêtre y a perdu.

> ⚠️ **Le corps prend TOUTE la largeur de la boîte** (`[&>*]:w-full` sur ses
> enfants directs). C'est la règle qui manquait : dans un conteneur flex en
> colonne, un `<form>` ou un `<div>` ne prend que la largeur de son contenu — les
> formulaires flottaient donc à gauche avec du vide à droite. Un contenu qui ne
> *peut* pas s'étirer sans devenir laid (une image, une grille à pas fixe) passe
> `corpsCentre` et se centre au lieu de s'étirer.

### La croix : une seule exception

`croix` est posée partout **sauf sur les confirmations** (`ConfirmDialog`,
`KeepAccountDialog`).

> ⚠️ Sur une confirmation, **« Annuler » EST la sortie**. Une croix à côté ferait
> deux portes pour un choix qui n'en a qu'une, et l'on hésiterait sur ce qu'elle
> ferme — annuler, ou fermer sans répondre ? Échap et le clic à côté restent
> disponibles, comme partout.
>
> À l'inverse, un dialogue de **choix** (l'export RTA, dont les options *sont*
> les actions) n'a aucun bouton d'annulation : la croix y est la seule porte
> visible, et c'est exactement le cas où elle est nécessaire.

> ⚠️ **Elle porte quatre choses invisibles**, et c'est pour elles qu'elle
> existe : le **piège à focus** (Tab boucle dans la boîte au lieu de tabuler dans
> la page derrière, invisible et toujours cliquable), le **retour du focus** à
> l'élément qui a ouvert la modale, la **fermeture à Échap**, et le **blocage du
> défilement** de la page.
>
> Deux écrans la recopiaient au lieu de l'importer — le dialogue d'export RTA et
> la question de conservation des données. Ils perdaient donc ces quatre-là
> **en silence** : rien ne le signalait à l'écran, et sur la seule fenêtre de
> l'app qui demande si l'on conserve ses données, c'est la pire des fenêtres à
> pouvoir contourner par accident.

> ⚠️ **`z-[70]` : au-dessus de tout, panneaux mobiles compris.** À `z-50`, une
> confirmation ouverte depuis le panneau d'actions se retrouvait *derrière* lui —
> on cliquait, rien ne semblait se produire, et le geste paraissait sans
> confirmation. Une confirmation est le dernier mot de l'interface : rien ne se
> met devant elle.

> ⚠️ Le voile est un **fondu seul**, sans flou. `KeepAccountDialog` portait un
> `backdrop-blur-sm` que les autres n'avaient pas ; écart abandonné à la
> migration — un seul dialogue floutant le fond se lisait comme un objet d'une
> autre nature.

**`MobileSheet`** — panneau montant du téléphone. ⚠️ **Ce n'est pas une modale** :
il coexiste avec la page, monte du bas, et se pose **sous** les dialogues dans
l'échelle des `z-index`. Il porte son propre voile pour cette raison.

**`Case`** — case à cocher avec son libellé. ⚠️ **La case native est là, seulement
invisible** (`sr-only`) — jamais remplacée par un `<div>` cliquable. C'est elle
qui porte l'état, le focus clavier, la barre d'espace et l'annonce du lecteur
d'écran ; le carré dessiné n'est qu'une peinture posée dessus. Une fausse case en
`div` oblige à réimplémenter tout cela, et on n'en réimplémente jamais que la
moitié. Le tout est enveloppé dans un `<label>`, ce qui rend le **texte**
cliquable : viser un carré de 15 px au doigt est un exercice, viser une phrase
ne l'est pas.

**`PiedDeDialogue`** — rangée d'actions au bas d'un dialogue.
⚠️ `flex-col-reverse` sous `sm`, et **l'inversion n'est pas un détail** : les
enfants s'écrivent dans l'ordre de lecture (secondaire, puis mis en avant), ce
qui place le bouton attendu à droite sur écran large. Sur téléphone l'ordre
s'inverse pour que la mise en avant tombe **en bas, sous le pouce**. Empilés dans
l'ordre d'écriture, on aurait « Annuler » sous le pouce — l'inverse exact de ce
qu'on veut. C'est un composant plutôt qu'une classe recopiée parce que le bug ne
se voit **que** sur un téléphone, donc jamais pendant qu'on écrit le code.

**`Vignette`** — case sélectionnable d'une grille (les monstres d'une catégorie).
⚠️ **La teinte vient de l'appelant.** C'est ce qui la distingue d'un bouton à
état : la couleur de sélection est ici une **donnée** (la couleur de la catégorie
qu'on remplit), pas une décision d'apparence. Trois écrans la recalculaient à la
main, avec trois opacités différentes.

- Elle porte **le liseré ET le fond**, contrairement à la règle du marqueur
  unique : celle-ci vaut pour un état d'**interface**, alors qu'ici la teinte est
  l'identité de ce qu'on coche — et le fond seul ne se voit pas sur une case qui
  porte déjà une image.
- `bloque` n'est pas `disabled` au sens visuel : une case refusée reste
  **affichée** et très estompée plutôt que cachée. Disparue on la cherche ;
  grisée on comprend qu'un plafond est atteint — à condition que le `title` le
  dise.

## Les contours : 1 px, et UN SEUL

> ⚠️ **Aucun contour d'INTERFACE ne dépasse 1 px, et jamais deux superposés.** Un
> contour cerne ce qu'il désigne, il ne l'encadre pas.

> ⚠️ **La règle ne vaut PAS pour l'équipement** — runes, artéfacts, reliques. Ces
> objets-là appartiennent au jeu, pas à l'interface : sélectionnés, ils se
> mettent en valeur **comme dans le jeu**, avec halo doré, éclat et liseré
> appuyé. C'est ce qui les distingue d'un bouton au milieu de la même page. La
> roue de runes et les emplacements d'artéfacts font de même, et il ne faut pas
> les « corriger ».
>
> La frontière est celle-ci : un composant de `src/ui/` suit la règle ; un objet
> que le joueur reconnaît de sa partie ne la suit pas. Aucun ton de la librairie
> ne porte le doré du jeu — j'en avais ajouté un (`precieux`), il n'a jamais
> servi et invitait à ramener ces objets dans le système d'interface.

Le piège n'est presque jamais l'épaisseur d'un trait : c'est le **cumul**. Une
bordure *et* un anneau, une bordure *et* une ombre portée — l'épaisseur réelle
n'est alors celle d'aucun des deux, et les traits concentriques se lisent comme
un contour flou plutôt que comme deux informations.

| Où | Avant | Épaisseur réelle |
|----|-------|------------------|
| Palette de couleurs | `ring-2` + `ring-offset-2` | **4 px** autour d'une case de 24 |
| Recommandations, équipes de siège | `border-X` + `ring-2 ring-X/50` | 3 px, en deux traits |
| Doublon de l'Optimiseur | `border-2` + `ring-4` | **6 px** |
| Relique, lead | `border-star` + `ring-1` | 2 px, en deux traits |
| Section, au survol du dépôt | `borderColor` + ombre 2 px | 3 px |
| Puce de légende | `border-2` sur un disque de 10 px | le trait mangeait la moitié |

> ⚠️ **Avant d'ajouter un trait, vérifier que celui d'en dessous n'est pas déjà
> teinté.** C'est l'erreur qui revient : on colore une bordure existante, puis on
> ajoute un anneau pour « que ça se voie mieux ».

⚠️ **Un `Flottant` posant déjà un cadre, ce qu'il contient n'en pose pas un
second.** Une carte qui a SON PROPRE cadre (`PieceDetailBox`, `OptimPlanBox` —
bord + fond + coins arrondis) ouverte dans un `Flottant`/`FlottantAuto` donnait
une carte dans une carte : deux bords à un pixel l'un de l'autre, à des rayons
de coin différents (`rounded-xl` du flottant contre `rounded-lg` de la carte),
qui se lisent comme un contour flou plutôt que comme deux informations.
`DesyncBadge` a posé la règle en premier ; `PieceDetailBox` la porte comme un
axe (`encadre`, `false` dans un flottant) plutôt que par une copie retouchée. Le
rembourrage passe alors au flottant (`rembourrage="md"`) : sans cadre, la carte
n'a plus de bord à en tenir éloigné.

**Deux exceptions, et elles ne sont pas des contours :**

- Le **`ring-offset`** de la palette est un *écart*, pas un second trait : sans
  lui, l'anneau d'encre touche l'aplat de couleur et devient illisible sur les
  teintes sombres.
- L'**anneau de focus clavier** (`outline: 2px`, dans `index.css`) reste à 2 px.
  Il n'apparaît qu'en tabulant — jamais à la souris ni au doigt — et sa taille
  est ce qui le rend repérable quand on ne sait plus où l'on est dans la page.
  Voir la règle de focus dans [design.md](design.md).

## Quand ajouter quelque chose

> ⚠️ **Un composant monte ici au DEUXIÈME usage, jamais au premier.** Remonter
> trop tôt fabrique une abstraction taillée pour un seul appelant, que le second
> fait éclater en options. C'est le trajet qu'ont suivi `Segmented` et
> `elementStyles` avant ce dossier.

Et l'inverse est vrai : **tout ne monte pas**. Restent délibérément hors
librairie —

- **Rien.** Cette liste a compté jusqu'à six entrées ; elle est vide. Chacune se
  ramenait à un manque de la librairie, pas à une singularité de l'écran :
  l'interrupteur d'affichage voulait un accent inversé (`actif={!actif}`), la
  pilule de lead une teinte du jeu (`classNameActif`), la palette un marqueur en
  anneau (`Vignette aplat`), le badge de désync et la relique des tons qui
  n'existaient pas (`alerte`, `precieux`), les surfaces de carte un composant
  volontairement nu (`ZoneCliquable`).
- **Sauf ce qui n'est pas un contrôle** : un `<input type="file">` masqué, qui
  n'est jamais dessiné — c'est un déclencheur technique, pas un bouton. C'est le
  dernier élément natif de la page RTA.
- **Les cases de la palette de couleurs** : un aplat sans contenu ni libellé, dont
  le marqueur est un anneau et non une teinte. Un seul usage.
- **Les entrées de la barre latérale** : ce sont des liens de NAVIGATION, pas des
  actions — pleine largeur, alignées à gauche, fond au survol seul, sans pression
  au clic. Les faire passer par `Bouton` (centré, `flex-none`, pressé au clic)
  demanderait d'annuler la moitié de ses axes au point d'appel.
- **La case de relique** (`MonsterGear`) et **la pilule de lead** : leur marqueur
  est la couleur `star`, un code du JEU et non un ton d'interface.

Et **les contrôles qui ne sont pas des contrôles** ne comptent pas : un
`<input type="file">` masqué (déclencheur technique jamais dessiné), une poignée
qui porte `draggable`, une surface de carte rendue cliquable. Ce sont des
mécanismes, pas des boutons.

> ⚠️ **Ces exceptions doivent rester rares et JUSTIFIÉES ici.** Une exception non
> écrite est une divergence qui recommence.

## Ce qui n'est pas dans cette librairie

**Les composants de JEU.** Une roue de runes, un portrait de monstre, la fiche
d'une pièce équipée ne sont pas du vocabulaire d'interface : ils rendent des
données Summoners War et suivent les codes du jeu, pas la règle du contour unique
de 1 px. Ils vivent dans `src/components/`.

Ils obéissent en revanche à la **même exigence d'unicité** : un rendu se dessine
une fois. ⚠️ La fiche d'une **rune** et celle d'un **artéfact** étaient deux
composants indépendants, écrits à six mois d'écart, et cela se voyait dès qu'on
les ouvrait l'une après l'autre au même endroit — rareté en colonne d'un côté, en
bandeau au-dessus de l'autre ; « Efficience 98,4 % » ici, une jauge et un nombre
nu là ; deux largeurs, deux hauteurs, pour la même question. Elles partagent
désormais une coquille unique
([PieceDetail.tsx](../../src/components/PieceDetail.tsx)) : cadre, en-tête
(image, stat principale, rareté, mesure), bloc de lignes, pied. Ne reste propre à
chaque pièce que **ce qu'elle a de différent** — la meule et la gemme d'un côté,
les procs de l'autre ; le bonus de set d'un côté, l'attribut ou le type de
l'autre. **La rune est la référence** : sa disposition est celle du jeu.

**Aucune dépendance externe.** La question d'adopter Radix UI s'est posée pour
`Dialog`, `Popover`, `Select` et `Switch`. Elle reste **ouverte** et concerne le
comportement (piège de focus, empilement, clavier), pas l'apparence — ces
composants-ci sont à nous et le resteraient. Voir
[navigation.md](navigation.md) pour ce qui flotte au-dessus de la page.
