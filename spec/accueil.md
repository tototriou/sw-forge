# Accueil (`#/`)

Page d'entrée de SW Blacksmith. Rôle : **faire faire le premier geste** (importer son
compte) et **ramener l'habitué là où il s'était arrêté**.

Fichier : [HomePage.tsx](src/pages/HomePage.tsx)

## Contenu

⚠️ **L'accueil est une PAGE D'ENTRÉE, pas un sommaire.** Une grille de cartes
identique pour tout le monde ne retient personne : le visiteur ne sait pas par où
commencer, et l'habitué doit re-naviguer à chaque visite vers l'endroit qu'il ne
quitte jamais. La page répond donc à deux publics, dans cet ordre.

### 1. Héros — promesse à gauche, action à droite

Deux colonnes (`1.1fr / 0.9fr`, empilées sous `lg`).

- **Gauche** : **logo + titre `SW Blacksmith`** (rebranding : le symbole de
  l'identité, le nom en Saira, capitales espacées, `clamp(32px, 5vw, 56px)`,
  qui passe sur deux lignes quand la colonne est étroite — R2 bis), accroche
  en sous-titre (« La boîte à outils pour Summoners War. »), phrase de
  promesse, puis les **5 éléments qui flottent**, centrés sous le texte.
  - ⚠️ **Le logo et le nom du site restent dans le héros.** C'est la page
    d'entrée : le nom s'y lit en grand, même si la barre latérale du bureau
    porte aussi le logo (depuis la refonte — cette spec disait l'inverse,
    corrigé au rebranding R2 bis) ; au téléphone, la barre du haut ne montre
    que le symbole.
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

⚠️ **Une carte, pas des colonnes de texte nu** : un numéro posé au-dessus d'un
paragraphe se lisait comme une note de bas de page. Depuis la refonte
graphique (lot 5), les trois étapes vivent dans **une seule carte**,
séparées par des filets (à gauche en colonnes, en haut une fois empilées) :
une séquence qu'on lit de gauche à droite. Chaque étape : son numéro en
chiffres de code, sa tuile d'icône, son titre, sa phrase.

### 5. Fonctionnalités

Grille **4 colonnes** de cartes **compactes** (icône, kicker, titre, une phrase).

⚠️ Les anciennes `ToolCard` de 260 px de haut repoussaient tout le reste de la
page hors de l'écran : à 7 entrées, la moitié des sections n'était jamais vue.

| Carte | Route | Teinte (`couleursSection.ts`) |
|-------|-------|--------|
| Préparation RTA | `#/rta` | `COULEUR_SECTION.rta` |
| Prépa d'un ami | `#/rta/ami` | `COULEUR_RTA_SUB.ami` |
| Défenses et offenses | `#/siege/defense` | `COULEUR_SECTION.siege` |
| Recommandations | `#/siege/recommandations` | `COULEUR_SIEGE_SUB.recos` |
| Analyse de runes | `#/compte/runes` | `COULEUR_COMPTE_SUB.runes` |
| Analyse d'artéfacts | `#/compte/artefacts` | `COULEUR_COMPTE_SUB.artefacts` |
| Optimiseur de runes | `#/outils/optimizer` | `COULEUR_SECTION.outils` |
| Speed tuning | `#/outils/speed-tuning` | `COULEUR_SECTION.outils` |
| Bestiaire | `#/bestiary` | `COULEUR_SECTION.bestiary` |
| Mécaniques | `#/mecaniques` | `COULEUR_SECTION.mecaniques` |
| Nouveautés | `#/releases` | `COULEUR_SECTION.releases` |
| Arène classique | `#/arene` — `soon` | `COULEUR_SECTION.arene` |

(La table avait oublié Analyse d'artéfacts et Speed tuning, présents dans la
page ; relevé par le test de rendu du lot 5, `tests/rendu/accueil.test.tsx`,
qui fixe désormais les douze cartes et leur ordre.)

### Le style — refonte graphique, lot 5

La structure ci-dessus est **gardée** (décision 10 de Thomas) ; seul le
style change :

- **Cartes de la refonte** : fond de panneau, contour discret
  (`border-soft`), rayon 12 ; au survol, le fond s'appuie (`panel2`) et le
  contour se précise. Plus de soulèvement.
- ⚠️ **Les COULEURS restent** : l'icône de chaque carte est dans une tuile
  (32 px, rayon 8) **à la teinte de sa section** — icône à la teinte, fond à
  14 %, contour à 32 % (`color-mix`) — et les cartes de fonctionnalités
  gardent leur **halo** flouté dans le coin, plus marqué au survol. Les
  étapes gardent leurs trois couleurs propres (bleu, vert, or), numéro
  compris. Le premier passage du lot 5 les avait retirées (décision 3 lue
  comme « neutre partout ») ; Thomas les a fait remettre le 2026-09-25 :
  « j'aimais bien les couleurs sur la page d'accueil ». **L'accueil est
  coloré, le menu neutre.**
- ⚠️ **En thème CLAIR, chaque teinte a sa variante assombrie**
  (`TEINTE_CLAIRE`, [couleursSection.ts](../src/data/couleursSection.ts) —
  refonte graphique, lot 14 ; Thomas, sur une capture de l'accueil en clair :
  « effectivement pas très lisible »). Les couleurs de section sont pensées
  pour le fond sombre : en clair, l'icône sur sa tuile tombait jusqu'à 1,40:1
  (arène), neuf sur douze sous 3:1. Chaque variante garde la teinte,
  assombrie juste assez pour 3,2:1 sur la carte comme au survol. Le sombre
  est inchangé. Mécanique : la tuile, le halo et le numéro d'étape posent en
  ligne les deux valeurs (`--teinte-sombre`, `--teinte-clair`), et la règle
  `.teinte-section` d'index.css choisit selon le thème, avec les deux
  déclencheurs du sombre. Numéros d'étape : 4,23 à 4,37 sur la carte — des
  repères de séquence, pas du texte courant.
- **Le bouton du dernier appel est le `Bouton` principal plein** de la
  librairie (décision 4).
- Pastille de version : fond d'accent à 15 %, texte à l'**encre** — l'accent
  sur ce fond tombait à 4,4:1 en Forge.
- ⚠️ **Au doigt, la même structure, resserrée** (lot 11a, décision 24 —
  Thomas a écarté la liste groupée de la maquette téléphone, qui retirait la
  zone de dépôt, « Comment ça marche », les descriptions, « Prépa d'un ami »,
  l'Arène et la dernière version) : marges verticales entre blocs réduites
  (`max-lg:py-6`), zone de dépôt moins haute (170 px au lieu de 260), cartes
  de fonctionnalités moins rembourrées. Le bureau ne bouge pas.

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
