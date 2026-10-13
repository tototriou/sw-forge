# Librairie UI — modales et panneaux

Partie de [Librairie UI](README.md).

### Une seule grammaire, trois bandes

Toutes les modales de l'app ont la même structure, et l'appelant ne la compose
pas — il remplit trois emplacements :

| Bande | Contenu | Rendue par |
|-------|---------|------------|
| **En-tête** | icône, `titre` à gauche, `sousTitre`, croix à **droite** | la coquille |
| **Corps** | `children` — la bande qui défile (avec `corpsFixeBas`, voir plus bas) | l'appelant |
| **Pied** | `actions` — les boutons, toujours en bas | la coquille |

`corpsFixeBas` est un axe facultatif : il place des champs fixes entre le
corps défilant et les actions, avec le même rembourrage horizontal. L’appelant
choisit les formats qui l’utilisent ; sans cet emplacement, la disposition
reste identique. Avec lui, l’épaisseur des séparations est réservée même quand
le trait est transparent, et les rembourrages ne varient pas au défilement :
l’en-tête, les champs fixes et les actions gardent leur position. Le trait
visible reste conditionné au contenu masqué ; celui du bas se pose avant les
champs fixes, sans second trait au-dessus des actions.
Quand la hauteur manque, ces champs occupent au plus la moitié de la hauteur
disponible après l’en-tête et le pied ; leur zone défile alors elle-même.
La limite se recalcule au redimensionnement et au changement de taille des
bandes. La liste reste accessible, et les actions restent visibles et utilisables
tant que la boîte peut contenir l’en-tête et le pied (fenêtre de 400 px de haut
et plus, vérifiée à 400 et 600 px) ; en deçà, l’en-tête et le pied, qui ne se
compriment pas, peuvent dépasser la boîte.

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

### Confirmer et saisir — [Dialogs.tsx](src/ui/Dialogs.tsx)

`ConfirmDialog` (confirmation) et `PromptDialog` (saisie), dans toutes les
pages.

- ⚠️ **Aucun `confirm()` ni `prompt()` du navigateur.** La boîte native
  s'affiche hors de la page, sans sa typographie ni ses couleurs, colle le nom
  du site en titre, et rien n'y est habillable — au moment précis où il faut
  distinguer une action destructrice d'une action anodine. Sa variante
  `prompt` est pire encore, surtout au tactile.
- ⚠️ **Le défaut ne perd jamais rien** : « Annuler » est le bouton mis en
  avant et reçoit le focus, Échap et le clic à côté annulent, et l'action
  destructrice porte la couleur d'alerte (`destructif`).
- **Dire ce qui n'est PAS touché**, pas seulement ce qui part : « tes
  recommandations ne sont pas touchées » évite d'annuler par précaution une
  action qu'on voulait faire.

### La croix : une seule exception

`croix` est posée partout **sauf sur les confirmations** (`ConfirmDialog`,
`KeepAccountDialog`).

> ⚠️ **Confirmation DESTRUCTIVE : l'action en aplat rouge, « Annuler » à
> contour** (`ConfirmDialog` `destructif` ; rebranding, décision 22 — la
> planche « Retours et fenêtres »). L'action était un `danger` doux et
> « Annuler » une braise douce. Le focus initial reste sur « Annuler » : le
> défaut ne perd jamais rien, l'aplat dit seulement ce que l'action coûte.
> Encre sur l'aplat : `bad-ink`. Une confirmation NON destructive ne change
> pas (action neutre pleine, « Annuler » en braise douce).

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
l'échelle des `z-index`. Il porte son propre voile pour cette raison. Seul un
panneau **feuille**, qui n'ouvre rien lui-même, passe devant les dialogues
(`devantLesDialogues`, `z-[80]`) : l'aide « ? », ouverte depuis une `Modale`,
restait sinon invisible derrière elle.

> ⚠️ **Portalisé dans `<body>`, comme la `Modale`.** Un MobileSheet peut s'ouvrir
> DEPUIS un autre — l'aide « ? » ou le formulaire de catégorie, ouverts depuis le
> panneau « Options ». Rendu en place, il hériterait des règles descendantes de
> `[data-tiroir]` du panneau parent (`align-items: flex-start` rabotait son
> en-tête : barrette décentrée, croix collée au titre au lieu d'être poussée à
> droite), et son `position: fixed` se calerait sur le `transform` du parent
> plutôt que sur le viewport. Le portail le détache des deux — transparent pour
> les usages non imbriqués, le panneau étant déjà `fixed`.

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
