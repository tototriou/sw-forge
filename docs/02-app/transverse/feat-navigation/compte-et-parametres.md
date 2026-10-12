# Navigation — nom du compte et page Paramètres

Partie de [Navigation](README.md).

## Nom du compte chargé

Une **carte en tête** de la barre (bureau, décision 11) porte l'avatar, le nom
du joueur (`wizard_info.wizard_name`, voir `parseAccountWizardName`), puis la
date de l'EXPORT et le nombre de monstres (« Export du 9 août · 342
monstres »). **Toute la carte importe** : le double chevron dit « changer », et
charger un autre export est changer de compte. Sans compte : « Aucun compte »,
« Importer un export SWEX ». Repliée, l'avatar seul. Paramètres descend en
**pied**, au gabarit des entrées.

- ⚠️ On jongle entre plusieurs exports — le sien, celui d'un ami dont on compare
  les runes — et rien ne disait lequel était affiché. Une date seule ne
  suffit pas : deux comptes exportés le même jour se ressemblent — d'où le nom
  en premier.
- ⚠️ **L'avatar est une INITIALE, pas une image** : l'export SWEX ne porte
  aucune photo de profil. Une initiale distingue deux comptes d'un coup d'œil
  sans rien inventer, là où un pictogramme générique serait le même pour tous.
- ⚠️ Le champ `wizardName` du stockage est **facultatif** : le rendre
  obligatoire aurait imposé d'incrémenter `ACCOUNT_SCHEMA`, donc de **rejeter
  tous les comptes déjà conservés** — un réimport forcé pour un simple libellé.
- ⚠️ **Le nom seulement, jamais `wizard_id`** : c'est un numéro de compte, il
  n'apprend rien à qui lit son propre écran.

### ⚠️ Le ⚙ ouvre ET referme — la même bascule aux deux formats

Cliquer le ⚙ ouvre `#/parametres` ; **le recliquer ramène à l'écran d'où l'on
vient**. Vaut pour le ⚙ de la barre supérieure (mobile) **comme** pour celui du
pied de la barre latérale (bureau).

- ⚠️ **Un lien ne peut pas défaire ce qu'il vient de faire.** Le ⚙ du bureau
  était un simple `<a href="#/parametres">` : une fois dans les paramètres, on
  n'en sortait qu'en **choisissant une autre destination** — or on y était entré
  pour régler une chose et revenir, pas pour partir ailleurs. Le geste qui ouvre
  doit pouvoir refermer, exactement comme un onglet mobile qu'on retouche (voir
  « Un onglet à sous-sections les FAIT CHOISIR »).
- L'écran de retour est **celui qu'on quittait**, mémorisé au moment d'entrer
  (`avantParametres` dans [App.tsx](src/App.tsx)) — jamais un `history.back()`,
  qui rejouerait n'importe quel détour antérieur. Arrivé **directement** sur
  `#/parametres` (lien, rechargement), le retour se fait sur l'accueil : il n'y
  a rien d'autre à proposer.
- ⚠️ **Une seule fonction pour les deux boutons** (`basculerParametres`), pas une
  logique par barre : c'est ce qui les avait laissés diverger — l'un basculait,
  l'autre pas.
- Le bouton porte `aria-pressed`, et quand les paramètres sont ouverts son
  **fond** change (braise sombre dans la barre latérale, `ctx-soft` dans la
  barre du haut) et son libellé devient « Fermer les paramètres ». Il annonce
  ainsi qu'il fera l'**inverse** au prochain clic, sans changer d'icône : une
  croix aurait fait croire à la fermeture de la page entière.
  ⚠️ L'icône était un engrenage qui **pivotait d'un huitième de tour** ; depuis
  le rebranding (décision 28), ce sont les curseurs « Réglages » de la toile
  (l'engrenage est à Mécaniques) — tournés, ils ne diraient rien : la rotation
  est retirée, le fond et le libellé portent l'état.

## Page Paramètres

`#/parametres` — la **même liste** (`SettingsList`) que le popover ⚙, pas une
copie : deux listes auraient divergé au premier réglage ajouté, et personne ne
s'en serait aperçu puisqu'on n'ouvre jamais les deux à la fois.

- ⚠️ **Colonne centrée (620 px)**, contrairement aux autres pages : ce sont des
  lignes « intitulé / contrôle ». Alignées à gauche sur toute la largeur, l'œil
  devait traverser le vide pour relier les deux.
- Le popover reste le geste rapide ; la page est là pour s'y attarder — deux de
  ses réglages portent trois lignes d'explication, illisibles dans 260 px.
- ⚠️ **À la souris** (refonte graphique, lot 10, la maquette) : le titre
  « Paramètres », la carte du compte, puis **deux blocs intitulés** —
  « Réglages » (thème, score, overcap, adversaire de référence) et « Mes
  données » (garder mes données, âge des données, tout supprimer) — chacun
  dans sa carte. Même liste, même ordre (`SettingsList groupes`). **Au doigt
  aussi** depuis le lot 11d (décision 27) : les mêmes blocs intitulés. Le
  popover ⚙ n'est pas groupé.
- **Dans l'application de bureau**, un troisième bloc, « Application » (la
  version, la mise à jour) — page et popover ; absent du site
  (`estBureau()`). Voir [conventions](../../../03-developpeur/), « Réglages ».
- « Importer un JSON » et « Tout supprimer » sont des `Bouton` de la
  librairie (lot 10), « Tout supprimer » au ton `danger` — ils étaient
  dessinés à la main. Vaut pour la page et le popover.
