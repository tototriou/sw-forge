# Écrire la documentation — bonnes pratiques

La documentation se tient seule : aucun outil ne vérifie sa forme, ses
règles se tiennent à l'écriture et en relecture. Les règles sont dans la
charte ([../README.md](../README.md)) ; ce document dit comment les
appliquer. Seuls les liens sont vérifiés automatiquement, par le test des
renvois ([renvois.md](renvois.md)). Pourquoi ce choix :
[documentation-sans-outillage.md](../04-decisions/adr/documentation-sans-outillage.md).

## Public et privé

Le dépôt est public, et tout ce qu'il suit l'est : documentation,
décisions (ADR), cadrages et pilotage. Restent hors du dépôt un export de
compte, des données personnelles, des captures d'écran. Ce qui n'est plus
vrai sort du dépôt (une archive vit dans les notes privées) ; une décision
encore en vigueur, avec sa raison, va en ADR dans
[04-decisions/](../04-decisions/README.md). La documentation ne renvoie
jamais aux notes privées : un lecteur du dépôt ne peut pas les ouvrir.

## Avant d'écrire

- **Chercher où le sujet vit déjà** : la carte, le README de la section,
  puis celui du dossier. Un sujet n'a qu'un endroit (règle 9) : on complète
  le document existant ou on pointe vers lui, jamais on ne recopie.
- **La documentation change dans le même commit que le code** qu'elle
  décrit.

## Écrire un document

- **Un document, un sujet.** Le titre dit lequel ; les premières lignes
  disent ce qu'on y trouve et, s'il y en a, les fichiers de code concernés.
  Aucun en-tête n'est imposé.
- **L'état actuel, pas l'histoire** : ce qui est vrai aujourd'hui et
  pourquoi, sans récit de chantier ni « lot N ». Une date, quand elle sert,
  s'écrit en absolu.
- **Une mise à jour remplace le texte périmé**, elle n'ajoute pas un
  paragraphe « depuis la v… » : l'historique Git garde le texte remplacé.
- **[optimizer/invariants.md](optimizer/invariants.md) est un index** : une
  règle modifiée se modifie dans sa source ET dans l'index, dans le même
  commit.
- **Les libellés du jeu et de l'écran**, tels quels, entre guillemets
  français quand on les cite.
- **Le document entre dans le README de son dossier**, dans le même commit,
  en une ligne : ce qu'on y trouve (règles 6 et 7). Un dossier créé reçoit
  son README dans le même commit, et une ligne dans le README parent.
- **Il entre aussi dans la table « Le changement touche… »** du README quand
  il décrit du code : les fichiers (chemin depuis la racine, `src/…`) ou la
  notion qu'on modifie, et le lien vers lui. Un fichier de code qui change de
  document, ou un nouveau dossier de code, met à jour la table d'AGENTS.md.

## Titres

- **Une hiérarchie sans saut de niveau** (pas de H4 directement sous un
  H2) ; un titre décrit tout le bloc jusqu'au prochain titre de niveau égal
  ou supérieur.
- **Des titres uniques dans un fichier** : l'ancre d'un titre (`#titre`)
  doit désigner une seule section. Trois « Vérification » donnent
  `#verification`, `#verification-1`, `#verification-2`, qu'aucun lien ne
  distingue à la lecture : on ajoute le contexte au titre (« Vérification »
  → « Vérification — artéfacts »), on n'en supprime jamais un.
- **Un bloc trop long** (plus de 80 lignes sous un même titre) se résorbe
  d'abord en posant des sous-titres : on n'ajoute que des lignes de titre,
  aucun mot n'est modifié, déplacé ni supprimé. Une liste numérotée qu'un
  titre couperait en deux reste d'un bloc.

## Liens

- **Relatifs, vers le fichier précis**, avec l'ancre quand on vise une
  section : `[Rayons](interface/design/typographie-et-rayons.md#rayons)`. Un
  lien vers un dossier mène à son README : il convient quand on renvoie au
  sujet entier.
- **Un lien plutôt qu'une mention en texte.** Un lien se vérifie ; une
  mention « `fichier.md` § Titre » ne se vérifie pas et casse sans bruit
  quand le fichier ou le titre change. Les mentions existantes restent
  valables, en particulier les `Source :` de
  [optimizer/invariants.md](optimizer/invariants.md).
- **Depuis le code**, un commentaire cite le chemin depuis la racine
  (`docs/03-developpeur/…`) : le test des renvois le lit alors et le
  vérifie.
- **Jamais vers un cadrage** (règle 11) : il disparaîtra.

## Découper ou regrouper

- **Au-delà de 500 lignes** (règle 12), un document devient un dossier à
  son nom (`feat-x.md` devient le dossier `feat-x`) : un `README.md` qui
  garde l'introduction et liste les parties, puis une partie par sujet,
  coupée aux titres existants.
- **Copier les lignes telles quelles**, sans réécrire : seuls changent les
  liens relatifs (un niveau de plus) et les ancres internes, qui visent la
  partie qui porte le titre. Puis vérifier qu'aucun paragraphe de
  l'original ne manque dans le dossier.
- **Les liens entrants visent la partie** qui porte le sujet cité, pas le
  dossier, quand le sujet est précis.
- **Regrouper une famille** : plusieurs documents d'un même sujet (même
  préfixe, même composant) vont dans un dossier avec son README plutôt que
  de rester à plat.

## Déplacer, renommer, retirer un document

- **`git mv`**, pour que l'historique suive le fichier.
- **Repointer** : chercher le **nom de fichier complet avec extension**
  (`ancien-nom.md`, jamais un préfixe) dans `src/`, `scripts/`, `tests/`,
  `docs/`, `.claude/` et `.agents/`. Lister d'abord les occurrences sans
  rien écrire, réécrire ensuite, puis relire le diff : chaque changement ne
  touche qu'un chemin. Les mentions en texte comptent autant que les liens.
- **Retirer** un document du dépôt : chaque renvoi qui le visait est
  réécrit ou supprimé, jamais laissé vers un fichier absent (le test des
  renvois le refuse).

## Renommer un titre

Renommer un titre change son ancre, et peut décaler les autres : trois
« Vérification » donnent `#verification`, `#verification-1`,
`#verification-2` ; renommer la deuxième fait glisser la troisième vers
`#verification-1` sans qu'on l'ait touchée. Donc :

1. lister les titres du fichier avant et après (`grep -n '^#' fichier.md`),
   pour voir chaque ancre qui change, renommée ou renumérotée ;
2. chercher chaque ancienne ancre (`#ancienne-ancre`) et l'ancien intitulé
   (`fichier.md § Ancien titre`) dans `src/`, `scripts/`, `tests/`,
   `docs/`, `.claude/` et `.agents/` ;
3. repointer ce qui est sans ambiguïté, diff relu ; une référence ambiguë
   reste telle quelle et se signale en revue.

## Relire avant de commiter

- **Le rendu**, qu'aucun contrôle ne voit : un texte en retrait de quatre
  espaces s'affiche comme du code ; une balise écrite nue (`<liste>` sans
  accents graves) disparaît au rendu ; un saut de niveau de titre.
- **Les liens** : `node tests/run.mjs renvois`.
