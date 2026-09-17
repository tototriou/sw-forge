---
name: cadrage-chantier
description: Comment produire un document de cadrage de chantier (un fichier, jamais un plan dans la conversation) pour tout travail de plus d'une session ou confié à des sessions fraîches, et comment le faire vivre pendant le chantier — gabarit Partie A / Partie B, règles apprises sur spec-rangement avec leur incident, forme fixe du brief d'un lot, boucle de validation côté pilote, emplacement dans spec/chantiers/. Modèle : spec/chantiers/spec-rangement.md.
---

# Cadrage d'un chantier (SW Forge)

## A. Déclencheur

Ce skill s'applique à **tout travail qui dépasse une session**, ou qui sera
**exécuté par des sessions fraîches** (Sonnet, Opus, une session qui n'a
pas eu la conversation d'origine) : un rangement, une migration, une
fonctionnalité en plusieurs lots, un audit suivi de corrections.

**Il n'est JAMAIS satisfait par « un plan dans la conversation ».** La
conversation qui a produit le plan ne se recharge pas : la session
suivante démarre sans elle, et ce qu'elle ne trouve pas dans un fichier,
elle le réinvente — souvent autrement. Un cadrage est **un fichier**, lu par
chaque lot, mis à jour à chaque lot, commité à chaque amendement
(`git log --oneline -- spec/chantiers/spec-rangement.md` : 31 commits
`docs(cadrage)` pour 16 lots).

Ne s'applique pas : une tâche qui tient dans une session et que la même
session termine. Là, un plan de travail ordinaire suffit.

Modèle à imiter, forme avant fond : `spec/chantiers/spec-rangement.md`
(Partie A relue par chaque lot, Partie B = un contrat par lot, « Résultat
(date) » ajoutés au fil des lots, tableau A.7). Ouvrir par `node
scripts/spec-toc.mjs spec/chantiers/spec-rangement.md`, jamais en entier.

## B. Gabarit du document

Deux parties. **La Partie A est le brief commun de tous les lots** (≈ 150–
200 lignes, relue en entier par chaque session) ; **la Partie B a une
section par lot**, et un lot ne lit que la sienne. Chaque section ci-dessous
dit pourquoi elle existe ; l'exemple est celui de spec-rangement.

**Partie A — préambule commun**

- **A.1 Pourquoi** — le constat chiffré qui motive le chantier, pour qu'une
  session qui hésite entre deux lectures choisisse celle qui sert le
  problème réel. *« 41 400 lignes ; le coût n'est pas la profondeur de
  l'arborescence, c'est la granularité interne : une section de 1 000
  lignes sans sous-titre ne peut être lue qu'en entier. »*
- **A.2 Cible et périmètre** — l'état final en termes vérifiables, et ce qui
  est hors périmètre, pour qu'un lot ne « profite » pas d'être là pour
  traiter la zone voisine. *Trois natures de documents (état actuel /
  décision / archive), périmètre du lint `spec/outils/**` ; `shared/`,
  `compte/`, `rta/` entrent « par un lot M ultérieur chacune, pas par ce
  cadrage ».*
- **A.3 Hiérarchie des priorités**, explicite et ordonnée — c'est ce qui
  tranche quand deux consignes du cadrage se contredisent dans un cas que
  personne n'avait prévu. *1 ne rien perdre · 2 traçabilité · 3 erreurs
  observables · 4 volume lu · 5 coût du modèle — « si lire 500 lignes de
  plus évite une omission plausible, on les lit ».*
- **A.4 Catégories de lots → modèle et effort** — la difficulté d'un lot est
  durable, l'affectation d'un modèle ne l'est pas ; séparer les deux
  tables évite de réécrire le cadrage à chaque changement de modèle.
  *M mécanique (diff relu, grep vide) · C classification (sortie structurée
  avec coordonnées) · J jugement (une décision par élément, citation
  source) ; puis « M → Sonnet effort bas, C → Sonnet moyen, J → Opus élevé ».*
- **A.5 Branche, chantier, fichiers transverses** — d'où part la branche et
  pourquoi, quels fichiers transverses ce chantier porte, quels chantiers
  voisins sont ouverts et ce qu'on ne touche pas chez eux. *« depuis
  `forge/audit-degats-…` : partir d'un état antérieur rendrait le travail
  des lots 2, 4, 5, 6a faux à la fusion » ; « `reliques.md` ne bouge pas,
  à une exception près : son en-tête ».*
- **A.6 Si une vérification échoue, si un cas est ambigu** — la conduite
  par défaut, écrite AVANT que le cas arrive, pour qu'une session seule
  ne tranche pas au jugé. *« Vérification échouée → pas de commit » ;
  « ambiguïté → conserver, `<!-- À trancher -->`, ligne dans `pistes.md` ».*
- **A.6 bis Preuves — où elles vivent, sous quelle forme** — voir C ; sans
  un lieu et une forme fixés, chaque lot invente les siens.
  *`spec/outils/optimizer/archive/controles-rangement-2026-09/`, H1 puis
  en-tête ARCHIVE de preuve, livrées par `chantier livrer`.*
- **A.7 Dépendances, ordre, suivi** — graphe en notation **`A → B : B
  requiert A`** (prérequis à gauche, la notation est écrite dans le
  cadrage), ordre d'exécution = ordre des numéros, et un tableau
  `Lot | Cat. | Statut | Commit / date` qu'un lot met à jour dans le commit
  qui le termine. *`3 → 4 (4 ne teste que des fixtures : pas de dépendance
  à 1)` — la parenthèse dit pourquoi, pour qu'une revue puisse contredire.*

**Partie B — un contrat par lot**

- **Intrant nommé et borné en lignes** — ce que la session lit, et rien
  d'autre ; la borne dit si le lot tient dans une session (voir C).
  *« la section “Écran (de haut en bas)” (l. 268–1246) ».*
- **Sortie nommée** — fichier, commande ou état observable.
  *`invariants-<source>.md`, « objectif ≤ 40 lignes ».*
- **Contrat exact** — définitions au mot près quand un outil ou un critère
  naît dans le lot. *B.4 : « bloc terminal = lignes entre un titre exclu et
  le prochain titre de n'importe quel niveau exclu… ».*
- **Preuve matérialisée** — fichier, commande, sortie attendue. *B.2 : cinq
  commandes dont `git diff … | grep -c '^-[^-]'` → 0.*
- **Ce que le lot NE fait PAS** — la frontière avec le lot voisin. *7c :
  « six corrections locales, pas une relecture » ; 5 : « `reliques.md`
  reçoit son en-tête et rien d'autre ».*

## C. Règles de fond, avec l'incident qui les a produites

- **Un outil ne s'utilise pas dans un lot antérieur à celui qui le crée.**
  Dans les révisions 2–6, `spec-lint` était le lot 8a alors que 5, 6b et
  7b s'en servaient comme preuve ; la révision 7 l'a scindé en **4**
  (infrastructure, fixtures) et **9** (enforcement), et renuméroté tous les
  lots. Vérifier le graphe A.7 contre chaque « Preuve : … » de la Partie B.
- **Un inventaire se MESURE, il ne s'estime pas.** La révision 3 supposait
  **3** exceptions au lint ; le `wc -l` du lot 4 en a donné **7**, et le
  cadrage dit maintenant « les sept exceptions initiales sont donc
  celles-ci, pas les trois de la révision 3 ». Un chiffre écrit sans
  commande à côté est une estimation.
- **Un chiffre est un objectif de compacité, jamais une consigne de
  coupe.** A.3 : « un plafond (≤ 40, ≤ 60…) n'est jamais une autorisation
  d'omettre : on dépasse ou on scinde, on ne tronque pas ». Lot 8
  (`5f05b3c`) : pas de plafond chiffré d'`invariants.md` dans `CLAUDE.md`,
  « un chiffre écrit là serait lu comme une consigne de coupe ». Cas
  ambigu → conserver, `<!-- À trancher -->`, ligne dans le ledger.
- **Une preuve est un artefact relu** — citation, diff, `grep` vide, test
  négatif qui refuse — **rangé dans le dossier de preuves, avec H1 et
  en-tête**, jamais « jointe au commit ». Lot 6a : 15 fichiers de preuve
  livrés sans H1, invisibles du lint (`a4d7785` « un H1 sur chaque
  preuve »). « Le message de commit cite le fichier de preuve ; il ne le
  remplace pas. »
- **Un lot qui ne touche que des notes privées n'a pas de commit de code**
  (`06844e9`, acté au lot 0) : `spec/outils/optimizer/` est gitignoré,
  `livrer` commite avec un message générique. Sa preuve = son fichier de
  preuve **et** le commit `docs(cadrage): lot <n> terminé` qui embarque
  commandes et sorties.
- **Une comparaison de textes est un diff séquentiel** (`git diff
  --no-index -U0`), **jamais un ensemble de lignes** (`comm`, tri) : l'ordre
  et les doublons comptent, et une normalisation au-delà de CRLF/espaces de
  fin perd une donnée dans un bloc de code (7a). « Aucun seuil de
  similarité ne décide de rien. »
- **Un seuil d'alarme n'est pas le mécanisme.** 7b disait « > 300 lignes
  supprimées → demander avant » ; l'alarme a été levée, relue et acceptée,
  et ce qui a protégé le contenu est **la décision par bloc avec preuve
  après migration** (première ligne retrouvée textuellement dans la
  destination, 244 citations vérifiées par script). Écrire le mécanisme ;
  l'alarme est un complément.
- **Tout point différé s'écrit dans le cadrage AU MOMENT où on le
  diffère.** Six phrases fausses d'`optimizer.md` trouvées « en passant »
  par 6b, 7b-1, 7b-2, laissées dans `pistes.md` en se disant qu'on y
  reviendrait : sans le lot **7c** créé après coup (`f9ded53`), elles
  seraient restées dans la source de vérité. Un « plus tard » sans numéro
  de lot est un oubli programmé.
- **Un lot trop gros pour une session se scinde AVANT, sur un critère :
  l'intrant en lignes.** 7b → 7b-1 / 7b-2 (« 2 111 lignes à lire, ~60
  décisions dépassent ce qu'une session tient sans dégrader les
  dernières ») ; 9 → 9a / 9b (`87da78d`) ; 6a : « une session par fichier
  > 800 lignes ». La scission s'écrit dans la section du lot, avec ce que
  chaque moitié fait et l'ordre entre elles.

## D. Le brief d'un lot — forme fixe

Le brief est le message qui ouvre la session du lot. Il ne remplace pas le
cadrage, il dit **où lire** dedans. Forme fixe, dans cet ordre :

1. **Contexte** — worktree, branche, dernier commit (hash), lot et
   catégorie (M/C/J), modèle et effort demandés.
2. **« À LIRE, dans cet ordre, et rien d'autre »** — `CLAUDE.md` (chargé),
   Partie A du cadrage (plage de lignes), section du lot (plage), les
   intrants du lot (fichier + plage). **Les numéros de lignes sont relevés
   AU MOMENT du brief** (`grep -n '^#'` ou `spec-toc`), pas recopiés d'un
   brief précédent : un amendement du cadrage les a décalés.
3. **Périmètre, et ce qui n'en est pas** — recopié de la section du lot,
   avec les fichiers voisins qu'on ne touche pas.
4. **Déroulé** — les étapes, dans l'ordre du contrat.
5. **Vérifications** — commandes exactes et sortie attendue, la zone
   touchée seulement (`node tests/run.mjs <filtre>`, `spec-lint`, `grep`).
6. **Livraison** — un commit par raison, message par `-F -` + heredoc
   (jamais `-m`) ; si des notes privées bougent : `chantier livrer` →
   `verifier` → `integrer`, depuis l'installation
   (`node "$(git rev-parse --git-common-dir)/forge/installation/scripts/chantier.mjs" …`).
7. **« Ne touche pas le cadrage. »** Le lot exécute, le pilote amende
   (E). Un défaut du cadrage découvert par le lot va dans le rapport.
8. **Rapport attendu, borné en lignes** (≤ 20–30) : ce qui a été fait,
   hashes, preuves (fichier + commande + sortie), écarts au contrat, et
   la ligne obligatoire **« ce que tu n'as pas pu prouver, tu le dis »** —
   un rapport sans cette rubrique est relu comme incomplet, pas comme
   parfait.

Le brief tient en 40–60 lignes. Plus long, c'est que le cadrage manque
quelque chose : l'y mettre, pas le mettre dans le brief.

## E. La boucle de validation, côté pilote

À la fin de chaque lot, dans cet ordre :

1. **Rejouer les preuves, pas lire le rapport.** Lancer les commandes de
   preuve de la section du lot, ouvrir le fichier de preuve, relire le
   diff. Le rapport sert à savoir *où* regarder, jamais *si* c'est bon.
2. **Corriger le cadrage si le retour révèle un défaut du brief** — un
   critère ambigu, une dépendance manquante, un chiffre estimé : la
   correction va dans la Partie A ou dans la section du lot suivant, en
   son propre commit `docs(cadrage): …` (ex. `b1a2dfe` « le critère de
   détection d'une décision inclut le H1 », né du retour du lot 1).
3. **Écrire « Résultat (date) »** dans la section du lot — chiffres
   mesurés, hashes, ce qui a dévié et pourquoi — **et** la ligne du lot
   dans le tableau A.7 (statut, commits, notes, date).
4. **Commit `docs(cadrage): lot <n> terminé — <fait saillant>`**, séparé
   des commits du lot, qui embarque les sorties d'observation quand le lot
   n'a pas de commit de code (C).
5. **Brief suivant**, avec des lignes relevées à l'instant (D.2).

**Avant le premier lot : la revue adversariale.** Au moins **deux tours**,
par une session qui **n'a pas écrit** le document, munie de la checklist C
et de trois questions par lot : *l'intrant est-il borné ? la preuve est-elle
un artefact ? l'outil qu'il utilise existe-t-il déjà à ce numéro ?*
spec-rangement a intégré cinq revues (révision 7) avant son lot 0 ; c'est là
que 8a est devenu 4 et que les lots ont été renumérotés dans l'ordre
d'exécution. Une revue qui ne trouve rien au premier tour n'a pas lu le
graphe.

## F. Où vit un cadrage

- **Public** : `spec/chantiers/<sujet>.md` — le cas général.
- **Privé seulement si son CONTENU l'est** (données du jeu non publiées,
  calibrage, compte réel) : `spec/outils/optimizer/chantiers/<sujet>.md`,
  livré par `chantier livrer` comme toute note. Il est alors **dans le
  périmètre du lint** (`spec/spec-lint.json`) : en-tête reconnu — le
  `Statut :` commence par `DÉCISION` (A.2 : un cadrage est une décision),
  blocs terminaux ≤ 100 lignes, fichier ≤ 500 sans exception possible
  (réservée aux fichiers préexistants au lint) — au-delà, Partie B dans
  un second fichier `<sujet>-lots.md`.
- **Dans les deux cas, une ligne dans `spec/README.md` § Chantiers**
  (fichier, statut, branche), ajoutée dans le commit qui crée le cadrage.
- **En tête du fichier** : un H1, une ligne vide, puis
  `**Statut :** chantier en cours | terminé le <date> — branche forge/<sujet>`
  (précédée de `DÉCISION <date> — ` pour un cadrage privé), pour que
  `spec-toc` le résume en une ligne. Le hook `Read` s'applique à lui comme
  à toute spec : au-delà de 300 lignes, `spec-toc` puis la section utile.
- **Le cadrage ne sort pas de `spec/` quand le chantier finit** : son
  statut passe à « terminé le <date> », la ligne du README suit, et il
  reste la référence citée par le code, les tests et les skills nés du
  chantier (`spec-hygiene` cite B.1, B.4, B.5, B.6, B.9).

## Voir aussi

- `spec/chantiers/spec-rangement.md` — le modèle, 16 lots, 31 amendements.
- `spec/chantiers/orchestration-parallele.md` § 1, § 2.2, § 4 — chantier,
  worktree, livraison des notes.
- `spec-hygiene` — les recettes que les lots M et C de ce modèle appliquent
  (déplacer, découper, extraire des invariants).
