# Accueil (`#/`)

Page d'entrée de SW Forge. Rôle : **faire faire le premier geste** (importer son
compte) et **ramener l'habitué là où il s'était arrêté**.

Fichier : [HomePage.tsx](src/pages/HomePage.tsx)

## Contenu

⚠️ **L'accueil est une PAGE D'ENTRÉE, pas un sommaire.** Une grille de cartes
identique pour tout le monde ne retient personne : le visiteur ne sait pas par où
commencer, et l'habitué doit re-naviguer à chaque visite vers l'endroit qu'il ne
quitte jamais. La page répond donc à deux publics, dans cet ordre.

### 1. Héros — promesse à gauche, action à droite

Deux colonnes (`1.1fr / 0.9fr`, empilées sous `lg`).

- **Gauche** : **logo + titre `SW Forge`**, accroche en sous-titre (« La boîte à
  outils pour Summoners War. »), phrase de promesse, puis les **5 éléments qui
  flottent**, centrés sous le texte.
  - ⚠️ **Le logo et le nom du site restent dans le héros.** Sur desktop, la barre
    de nav **ne porte pas la marque** (elle n'apparaît qu'en version repliée) :
    sans eux, on ne sait plus sur quel site on est.
  - ⚠️ **Aucun bouton dans le héros**, et aucun argument commercial répété
    (« Gratuit · Aucune inscription », « Traitement 100 % local… », « sans créer
    de compte »). La **zone de dépôt est juste à côté** : un bouton « Importer
    mon compte » qui fait défiler vers un élément déjà visible n'ajoute rien, et
    la pile d'arguments noyait la promesse au lieu de la servir.
- **Droite** : la **zone de dépôt**.

### 2. ⚠️ Zone de dépôt DANS le héros

C'est le geste qui **débloque tout l'outil** : il était caché dans la barre de
nav. Il est désormais la première chose visible.

- **Glisser-déposer ET clic** : on ne sait pas lequel le visiteur tentera, et
  n'en proposer qu'un en laisse la moitié dehors. Accessible au clavier
  (`Entrée` / `Espace`).
- Elle appelle le **même `importAccount`** que le bouton de la nav — un seul
  chemin d'import, une seule validation, un seul message de résultat.
- La promesse « lu dans la page, jamais envoyé » est écrite **dans la zone** :
  c'est là qu'est l'objection, pas dans le pied de page.

### 3. « Ton espace »

Affiché **dès qu'il y a des données locales** (`HomeStats`, passé par
[App.tsx](src/App.tsx) : mêmes états que les pages outils, **aucun calcul ni
stockage en plus**). Quatre tuiles → prépa RTA, défense, offense,
recommandations.

- ⚠️ **Titre NEUTRE.** Le bloc apparaît **dès le premier import**, pas seulement
  au retour : « Reprends où tu en étais » accueillait un débutant en lui parlant
  d'un passé qu'il n'a pas.
- **Le chiffre d'abord** : c'est lui qu'on vient vérifier. Le lien mène dans la
  **sous-section exacte**, pas sur la page générique.
- Une valeur à 0 est **atténuée, pas masquée** — sinon la rangée saute.
- Une **équipe vide** (créée puis abandonnée) **n'est pas comptée** : annoncer
  12 équipes dont 9 sans monstre serait mensonger.
- ⚠️ **Aucun message sur l'état du compte ici.** Il y en avait un (« ton compte
  n'est pas chargé dans cette session… ») : il expliquait une incohérence au lieu
  de la corriger. La question de la conservation est désormais **posée à la fin
  de l'import** (voir [shared/import-compte.md](shared/import-compte.md)), et
  l'âge du compte vit dans le menu ⚙, à côté du réglage qui le gouverne.

### 4. Comment ça marche

Trois **cartes** numérotées `01 · 02 · 03` : exporter avec
[SW Exporter](https://github.com/Xzandro/sw-exporter), déposer le fichier,
préparer.

⚠️ **Des cartes, pas des colonnes de texte nu** : un numéro posé au-dessus d'un
paragraphe se lisait comme une note de bas de page. Le cadre, le numéro en
pastille et l'icône colorée en font une **séquence qu'on suit du regard**.

### 5. Fonctionnalités

Grille **4 colonnes** de cartes **compactes** (icône, kicker, titre, une phrase).

⚠️ Les anciennes `ToolCard` de 260 px de haut repoussaient tout le reste de la
page hors de l'écran : à 7 entrées, la moitié des sections n'était jamais vue.

| Carte | Route | Accent |
|-------|-------|--------|
| Préparation RTA | `#/rta` | `#A15FE0` |
| Défenses et offenses | `#/siege/defense` | `#E4463A` |
| Recommandations | `#/siege/recommandations` | `#5EDB8F` |
| Analyse de runes | `#/compte/runes` | `#4AD8D8` |
| Optimiseur de runes | `#/outils/optimizer` | `#FFA94D` |
| Bestiaire | `#/bestiary` | `#2FA0E0` |
| Mécaniques | `#/mecaniques` | `#8890B8` |
| Nouveautés | `#/releases` | `#C79BFF` |
| Arène classique | `#/arene` | `#F2C24C` — `soon` |

### 6. Dernier appel + quoi de neuf

Le **seul bouton** de la page (« Importer mon compte ») : en bas, après avoir
tout lu, c'est là qu'il sert.

⚠️ Il **ouvre le sélecteur de fichier**, il ne renvoie pas à la zone de dépôt.
C'était un lien `#depot` : avec le routage par hash il ne faisait rien de
visible. Un appel à l'action qui ne déclenche rien est pire que pas de bouton du
tout. Il appelle le **même `onImport`** que la zone de dépôt et que la nav — un
seul chemin d'import.

Un rappel du bouton d'import, puis un bandeau **version + titre de la dernière
release** ([Nouveautés](releases.md)), tiré de `RELEASES[0]` — **rien à maintenir
en double**. C'est ce qui donne une raison de **revenir**.

## Règles / attendus

- ⚠️ **L'accueil doit rester le miroir de l'app** : **toute page ou section
  ajoutée / renommée / supprimée doit être répercutée ici** (carte de la grille
  « Fonctionnalités », et tuile de reprise si la section a un état local)
  **dans le même commit**.
- La carte Arène est **inactive visuellement** (`soon`) mais reste un lien vers
  `#/arene` (qui affiche le placeholder « Bientôt disponible »).
- Les descriptions et CTA sont figés (validés par l'utilisateur) — notamment le
  Siège : « Compose tes équipes, offense et défense, et vérifie les speed tune
  de tes équipes. »
- Aucune donnée chargée ici : page purement présentationnelle.
