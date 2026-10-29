# Navigation — nom du compte et page Paramètres

Partie de [Navigation](README.md).

## Nom du compte chargé

Une **carte en tête** de la barre (bureau) porte l'avatar, le nom
du joueur (`wizard_info.wizard_name`, voir `parseAccountWizardName`), puis la
date de l'EXPORT et le nombre de monstres (« Export du 9 août · 342
monstres »). **Toute la carte importe** : le double chevron dit « changer », et
charger un autre export est changer de compte. Sans compte : « Aucun compte »,
« Importer un export SWEX ». Repliée, l'avatar seul. Paramètres est en
**pied**, au gabarit des entrées.

- ⚠️ On jongle entre plusieurs exports — le sien, celui d'un ami dont on compare
  les runes — et la carte dit lequel est affiché. Une date seule ne
  suffit pas : deux comptes exportés le même jour se ressemblent — d'où le nom
  en premier.
- ⚠️ **L'avatar est une INITIALE, pas une image** : l'export SWEX ne porte
  aucune photo de profil. Une initiale distingue deux comptes d'un coup d'œil
  sans rien inventer, là où un pictogramme générique serait le même pour tous.
- ⚠️ Le champ `wizardName` du stockage est **facultatif** : le rendre
  obligatoire imposerait d'incrémenter `ACCOUNT_SCHEMA`, donc de **rejeter
  tous les comptes déjà conservés** — un réimport forcé pour un simple libellé.
- ⚠️ **Le nom seulement, jamais `wizard_id`** : c'est un numéro de compte, il
  n'apprend rien à qui lit son propre écran.

### ⚠️ Le ⚙ ouvre ET referme — la même bascule aux deux formats

Cliquer le ⚙ ouvre `#/parametres` ; **le recliquer ramène à l'écran d'où l'on
vient**. Vaut pour le ⚙ de la barre supérieure (mobile) **comme** pour celui du
pied de la barre latérale (bureau).

- ⚠️ **Un lien ne peut pas défaire ce qu'il vient de faire.** Avec un simple
  `<a href="#/parametres">`, une fois dans les paramètres, on n'en sortirait
  qu'en **choisissant une autre destination** — or on y entre pour régler une
  chose et revenir, pas pour partir ailleurs. Le geste qui ouvre doit pouvoir
  refermer, exactement comme un onglet mobile qu'on retouche (voir
  « Un onglet à sous-sections les FAIT CHOISIR »).
- L'écran de retour est **celui qu'on quittait**, mémorisé au moment d'entrer
  (`avantParametres` dans [App.tsx](src/App.tsx)) — jamais un `history.back()`,
  qui rejouerait n'importe quel détour antérieur. Arrivé **directement** sur
  `#/parametres` (lien, rechargement), le retour se fait sur l'accueil : il n'y
  a rien d'autre à proposer.
- ⚠️ **Une seule fonction pour les deux boutons** (`basculerParametres`), pas une
  logique par barre : deux logiques divergeraient — l'un basculerait, l'autre
  pas.
- Le bouton porte `aria-pressed`, et quand les paramètres sont ouverts son
  **fond** change (braise sombre dans la barre latérale, `ctx-soft` dans la
  barre du haut) et son libellé devient « Fermer les paramètres ». Il annonce
  ainsi qu'il fera l'**inverse** au prochain clic, sans changer d'icône : une
  croix ferait croire à la fermeture de la page entière.
  ⚠️ L'icône — les curseurs « Réglages » (l'engrenage est à Mécaniques) — ne
  pivote pas : tournés, ils ne diraient rien ; le fond et le libellé portent
  l'état.

## Page Paramètres

`#/parametres` — la **même liste** (`SettingsList`) que le popover ⚙, pas une
copie : deux listes auraient divergé au premier réglage ajouté, et personne ne
s'en serait aperçu puisqu'on n'ouvre jamais les deux à la fois.

- ⚠️ **Colonne centrée (620 px)**, contrairement aux autres pages : ce sont des
  lignes « intitulé / contrôle ». Alignées à gauche sur toute la largeur, l'œil
  devrait traverser le vide pour relier les deux.
- Le popover reste le geste rapide ; la page est là pour s'y attarder — deux de
  ses réglages portent trois lignes d'explication, illisibles dans 260 px.
- ⚠️ **À la souris** : le titre
  « Paramètres », la carte du compte, puis **deux blocs intitulés** —
  « Réglages » (thème, score, builds les plus rapides, overcap, adversaire de
  référence) et « Mes
  données » (garder mes données, âge des données, tout supprimer) — chacun
  dans sa carte. Même liste, même ordre (`SettingsList groupes`). **Au doigt
  aussi** : les mêmes blocs intitulés. Le popover ⚙ n'est pas groupé.
- **Dans l'application de bureau**, un troisième bloc, « Application » (la
  version, la mise à jour) — page et popover ; absent du site
  (`estBureau()`). Voir « Les réglages » ci-dessous.
- « Importer un JSON » et « Tout supprimer » sont des `Bouton` de la
  librairie, « Tout supprimer » au ton `danger`. Vaut pour la page et le
  popover.

## Les réglages

Les réglages globaux vivent dans une seule liste
([SettingsMenu.tsx](src/components/SettingsMenu.tsx), `SettingsList`), montrée
par le popover ⚙ et par la page Paramètres. ⚠️ **Un réglage global reste à un
geste**, quelle que soit la largeur : le ⚙ est toujours visible, en pied de la
barre latérale au bureau, dans la barre supérieure au téléphone.

- Règle : un réglage qui s'applique à **plusieurs pages** va ici, **jamais**
  dupliqué en sélecteur sur chaque page.
- **Persistés** dans `localStorage`, contrairement aux filtres et tris de page
  qui sont jetables. Ni un refus de conservation ni « Tout supprimer » ne les
  effacent ([persistance.md](../feat-import-compte/persistance.md)).
- **Structure pensée pour grossir** : un réglage = un `<Setting>` (intitulé à
  gauche, contrôle à droite), avec des contrôles génériques réutilisables
  (`<Segmented>` pour un choix unique, `<Switch>` pour un oui/non — un réglage
  binaire se lit d'un coup d'œil sur un interrupteur, sans lire les libellés).
  Ajouter un paramètre = ajouter un `<Setting>`, rien d'autre.
- ⚠️ `<Segmented>` ([Segmented.tsx](src/ui/Segmented.tsx)) sert partout où
  des choix **s'excluent**, ici comme au filtre de catégorie des artéfacts :
  une rangée de pastilles séparées se lit comme des filtres cumulables, le
  cadre commun dit l'exclusivité sans un mot.
- ⚠️ `<Switch>` ([Switch.tsx](src/components/Switch.tsx)) est partagé de même,
  ici comme pour « Stats de base exclues » de l'Optimizer.
- **Pas de légende** quand l'intitulé et les options se suffisent : le panneau
  reste une liste de lignes courtes. Le `hint` d'un `<Setting>` sert quand le
  réglage a une **conséquence non évidente** — « Garder mes données » en a une
  (les données restent sur la machine), il porte donc un `hint`.

Contenu actuel, dans l'ordre :

- Bloc **« Réglages »** :
  - **Thème** → trois options (`Auto` et les deux thèmes), voir
    [design/reglage-du-theme.md](../../../03-developpeur/interface/design/reglage-du-theme.md) ;
  - **Score** → `Efficience` / `Score SW` (voir
    [compte/feat-runes/mesure.md](../../compte/feat-runes/mesure.md)) ;
  - **Résultats de l'Optimizer** → `Cartes` / `Tableau`, au bureau seulement
    (voir [optimizer/ecran/resultats.md](../../optimizer/ecran/resultats.md#cartes-ou-tableau)) :
    en tableau, la page de l'Optimizer range ses réglages pour lui laisser
    la place, d'où ce réglage ici plutôt qu'au-dessus des résultats ;
  - **Builds les plus rapides** → un bouton « Choisir… », et en `hint` le
    résumé du réglage (« 9 combinaisons · 5 builds par combinaison, au Résumé
    des runes. »). Il ouvre une **fenêtre** (`DialogueBuildsRapides`) : une
    liste de combinaisons ne tient pas dans le popover. La même fenêtre s'ouvre
    depuis le bloc du Résumé (« Choisir les combinaisons »). On y règle le nombre de
    builds par combinaison (1 à 10), on ajoute une combinaison (un set
    4 pièces, puis un set 2 pièces ou « Broken » ; une combinaison déjà là est
    désactivée), on en retire par la croix de son jeton, et « Rétablir le
    défaut » remet la liste de départ. Chaque geste s'applique tout de suite :
    la croix est la seule sortie. L'ajout est AU-DESSUS de la liste : un jeton
    ajouté ne pousse pas les boutons qu'on vient de cliquer. Voir
    [compte/feat-runes/resume.md](../../compte/feat-runes/resume.md).
    ⚠️ **La fenêtre s'ouvre aussi depuis le popover ⚙**, et elle est
    portalisée hors de lui : le popover ignore donc un clic dans une
    `[role="dialog"]`, et Échap ferme la fenêtre sans fermer le popover. Sans
    cela, le premier clic dans la fenêtre fermait le popover, qui la démontait ;
  - **Overcap Taux Crit/RES/Précision** → un interrupteur (`<Switch>`),
    **activé par défaut** (comportement historique non borné). Ces trois
    stats sont plafonnées à 100 % dans le jeu ; désactivé, le TOTAL affiché
    s'arrête à 100 % même si la somme brute des runes dépasse — un réglage
    d'AFFICHAGE seulement, `computeStats` continue de renvoyer le total brut
    (la recherche de l'Optimizer ne doit surtout pas exclure un build dont
    le total brut dépasse 100 %, voir [optimizer/](../../optimizer/README.md)).
    Appliqué partout où un TOTAL de build est affiché (fiche de monstre en
    RTA/Siège/Optimizer, résultats de l'Optimizer) — **pas** aux exigences
    des recommandations de siège, qui restent un objectif à atteindre, pas
    un total déjà calculé ;
  - **Adversaire de référence (speed tuning)** → un interrupteur (`<Switch>`),
    **désactivé par défaut** — l'activer AJOUTE un monstre en face, et rien ne
    doit apparaître dans une composition sans qu'on l'ait demandé. Activé,
    chaque analyse du speed tuning pose en face une **copie du monstre le plus
    rapide de l'équipe** (même lead, vitesse de runes, set et passif) : on tune
    alors contre soi-même. Sans lui, la copie n'est posée que si personne n'est
    en face. Voir [speed-tuning/feat-deux-camps.md](../../speed-tuning/feat-deux-camps.md).
- Bloc **« Mes données »** :
  - **Garder mes données** → la conservation de toute l'app entre deux
    sessions, prépa, équipes, recommandations et compte (voir
    [feat-import-compte/persistance.md](../feat-import-compte/persistance.md)) ;
  - **Date de l'export chargé**, sous le réglage — c'est là qu'on se pose la
    question de la fraîcheur des données ;
  - **Session** → « Sauvegarder » : tout l'état de l'app dans un fichier —
    dans l'**application de bureau seulement** (voir
    [feat-sauvegarde-session.md](../feat-sauvegarde-session.md)) ;
  - **Dossier SW Blacksmith** → « Retirer », « Choisir… » — dans
    l'**application de bureau seulement** : le dossier dont le
    sous-dossier `sessions` reçoit les sessions ;
  - **Mes données** → « Tout supprimer », toujours la dernière ligne du bloc.
- Bloc **« Application »** — dans l'**application de bureau seulement** (absent
  du site) : la version installée et UN bouton qui suit la mise à jour
  (« Rechercher », « Mettre à jour », « Redémarrer »… — toujours
  affiché, désactivé quand il n'y a rien à faire). Une mise à jour remise
  à plus tard s'y fait quand on veut. Voir [bureau/](../../bureau/README.md).
  Puis le **dossier SW Exporter** et l'**invocateur** à suivre : « Mon
  compte » se met à jour à chaque export
  ([feat-import-compte/bouton-import.md](../feat-import-compte/bouton-import.md)).
