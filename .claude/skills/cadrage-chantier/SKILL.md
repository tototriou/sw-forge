---
name: cadrage-chantier
description: "Comment écrire le document de cadrage d'un chantier (un fichier, jamais un plan dans la conversation) pour tout travail de plus d'une session ou confié à des sessions fraîches — gabarit Partie A / Partie B, règles de fond de son contenu, emplacement (public ou privé, au choix du responsable du chantier), en-tête et clôture."
---

# Cadrage d'un chantier (SW Blacksmith)

## A. Déclencheur

Ce skill s'applique à **tout travail qui dépasse une session**, ou qui sera
**exécuté par des sessions fraîches** (Sonnet, Opus, une session qui n'a
pas eu la conversation d'origine) : un rangement, une migration, une
fonctionnalité en plusieurs lots, un audit suivi de corrections.

**Il n'est JAMAIS satisfait par « un plan dans la conversation ».** La
conversation qui a produit le plan ne se recharge pas : la session
suivante démarre sans elle, et ce qu'elle ne trouve pas dans un fichier,
elle le réinvente — souvent autrement. Un cadrage est **un fichier**, lu par
chaque lot, mis à jour à chaque lot, enregistré à chaque amendement.

Ne s'applique pas : une tâche qui tient dans une session et que la même
session termine. Là, un plan de travail ordinaire suffit.

Forme à suivre : Partie A relue par chaque lot, Partie B = un contrat par
lot, « Résultat (date) » ajoutés au fil des lots, tableau de suivi A.7.
Un cadrage s'ouvre par `node scripts/spec-toc.mjs <fichier>`, jamais en
entier.

Ce skill couvre **le document**. La façon de faire tourner les lots
(sessions, agents, validation) appartient au responsable du chantier ; le
cadrage l'écrit dans sa Partie A.

## B. Gabarit du document

Deux parties. **La Partie A est le brief commun de tous les lots** (≈ 150–
200 lignes, relue en entier par chaque session) ; **la Partie B a une
section par lot**, et un lot ne lit que la sienne. Chaque section ci-dessous
dit pourquoi elle existe.

**Partie A — préambule commun**

- **A.1 Pourquoi** — le constat chiffré qui motive le chantier, pour qu'une
  session qui hésite entre deux lectures choisisse celle qui sert le
  problème réel.
- **A.2 Cible et périmètre** — l'état final en termes vérifiables, et ce qui
  est hors périmètre, pour qu'un lot ne « profite » pas d'être là pour
  traiter la zone voisine.
- **A.3 Hiérarchie des priorités**, explicite et ordonnée — c'est ce qui
  tranche quand deux consignes du cadrage se contredisent dans un cas que
  personne n'avait prévu.
- **A.4 Catégories de lots → modèle et effort** — la difficulté d'un lot est
  durable, l'affectation d'un modèle ne l'est pas ; séparer les deux
  tables évite de réécrire le cadrage à chaque changement de modèle.
  *M mécanique (diff relu, grep vide) · C classification (sortie structurée
  avec coordonnées) · J jugement (une décision par élément, citation
  source) ; puis « M → Sonnet effort bas, C → Sonnet moyen, J → Opus élevé ».*
- **A.5 Branche, chantier, fichiers transverses** — d'où part la branche et
  pourquoi, quels fichiers transverses ce chantier porte, quels chantiers
  voisins sont ouverts et ce qu'on ne touche pas chez eux.
- **A.6 Si une vérification échoue, si un cas est ambigu** — la conduite
  par défaut, écrite AVANT que le cas arrive, pour qu'une session seule
  ne tranche pas au jugé.
- **A.6 bis Preuves — où elles vivent, sous quelle forme** — voir C ; sans
  un lieu et une forme fixés, chaque lot invente les siens.
- **A.7 Dépendances, ordre, suivi** — graphe en notation **`A → B : B
  requiert A`** (prérequis à gauche, la notation est écrite dans le
  cadrage), ordre d'exécution = ordre des numéros, et un tableau
  `Lot | Cat. | Statut | Commit / date` que le responsable du chantier met
  à jour à la validation de chaque lot. Chaque flèche porte sa raison entre
  parenthèses, parce qu'une revue doit pouvoir la contredire.

**Partie B — un contrat par lot**

- **Intrant nommé et borné en lignes** — ce que la session lit, et rien
  d'autre ; la borne dit si le lot tient dans une session (voir C).
- **Sortie nommée** — fichier, commande ou état observable.
- **Contrat exact** — définitions au mot près quand un outil ou un critère
  naît dans le lot.
- **Preuve matérialisée** — fichier, commande, sortie attendue.
- **Ce que le lot NE fait PAS** — la frontière avec le lot voisin.

## C. Règles de fond

- **Un outil ne s'utilise pas dans un lot antérieur à celui qui le crée.**
  Vérifier le graphe A.7 contre chaque « Preuve : … » de la Partie B.
- **Un inventaire se MESURE, il ne s'estime pas.** Un chiffre écrit sans
  commande à côté est une estimation.
- **Un chiffre est un objectif de compacité, jamais une consigne de
  coupe.** Un plafond (≤ 40, ≤ 60…) n'est jamais une autorisation
  d'omettre : on dépasse ou on scinde, on ne tronque pas ; et on n'écrit
  pas de plafond là où il serait lu comme une consigne de coupe. Cas
  ambigu → conserver, `<!-- À trancher -->`, ligne dans le ledger.
- **Une preuve est un artefact relu** — citation, diff, `grep` vide, test
  négatif qui refuse — **rangé dans le dossier de preuves, avec H1 et
  en-tête**, jamais « jointe au commit », parce qu'une preuve sans H1 est
  invisible du lint. « Le message de commit cite le fichier de preuve ; il
  ne le remplace pas. »
- **Un lot qui ne touche que des fichiers non suivis par Git** (notes
  privées) **n'a pas de commit de code** : sa preuve = son fichier de
  preuve **et** l'enregistrement de ces fichiers, dont le message embarque
  commandes et sorties.
- **Une comparaison de textes est un diff séquentiel** (`git diff
  --no-index -U0`), **jamais un ensemble de lignes** (`comm`, tri) : l'ordre
  et les doublons comptent, et une normalisation au-delà de CRLF/espaces de
  fin perd une donnée dans un bloc de code. « Aucun seuil de
  similarité ne décide de rien. »
- **Un seuil d'alarme n'est pas le mécanisme**, parce qu'une alarme se
  lève, se relit et s'accepte : ce qui protège le contenu est un mécanisme
  vérifiable, comme la décision par bloc avec preuve après migration
  (première ligne retrouvée textuellement dans la destination, vérifiée par
  script). Écrire le mécanisme ; l'alarme est un complément.
- **Tout point différé s'écrit dans le cadrage AU MOMENT où on le
  diffère**, parce qu'un point laissé dans un ledger « pour plus tard »
  reste faux dans la source de vérité. Un « plus tard » sans numéro de lot
  est un oubli programmé.
- **Un lot trop gros pour une session se scinde AVANT, sur un critère :
  l'intrant en lignes**, parce qu'au-delà de ce qu'une session tient, les
  dernières décisions se dégradent. La scission s'écrit dans la section du
  lot, avec ce que chaque moitié fait et l'ordre entre elles.

## F. Où vit un cadrage

- **Public ou privé, au choix du responsable du chantier.** Public :
  `spec/chantiers/<sujet>.md`, avec une ligne dans `spec/README.md`
  § Chantiers (fichier, statut, branche), ajoutée dans le commit qui crée
  le cadrage. Privé : dans les notes privées du projet
  (`spec/outils/optimizer/chantiers/<sujet>.md`, non suivies), sans ligne
  dans `spec/README.md`.
- **Public ou privé, il est dans le périmètre du lint**
  (`spec/spec-lint.json`) — même contrat pour les deux
  (`spec/outillage/spec.md`, ex-B.4, amendement C6) : un cadrage est une **quatrième nature**, ni état
  actuel, ni décision, ni archive — `Statut :` reconnu seulement sous
  deux formes exactes, `CHANTIER en cours` ou `CHANTIER terminé le
  AAAA-MM-JJ` ; blocs terminaux ≤ 100 lignes toujours exigés ; **fichier
  ≤ 500 : exemption inconditionnelle** pour tout fichier sous un dossier
  `chantiers/` (codée dans le lint, pas une entrée de
  `spec/spec-lint.json`) — un cadrage grossit avec les résultats de ses
  lots et ne se lit jamais entier (A, une section B, `spec-toc`, hook
  `Read`) ; au-delà d'une taille qui gêne malgré tout, Partie B dans un
  second fichier `<sujet>-lots.md`.
- **En tête du fichier** : un H1, une ligne vide, puis
  `**Statut :** CHANTIER en cours — branche forge/<sujet>` ou
  `**Statut :** CHANTIER terminé le <date> — branche forge/<sujet>`
  (même forme, public ou privé), pour que `spec-toc` le résume en une
  ligne. Les autres champs d'en-tête (Lire si, Ne pas lire si, Voir
  aussi) sont facultatifs pour cette nature. Le hook `Read` s'applique à
  lui comme à toute spec : au-delà de 300 lignes, `spec-toc` puis la
  section utile.
- **Quand le chantier finit**, son statut passe à « terminé le <date> ».
  Un cadrage public reste en place, ou, si son responsable le décide, est
  archivé dans les notes privées et remplacé, au même chemin, par une
  fiche publique : ce que le chantier a livré, et une table « section
  citée → place publique ». Ses contrats encore en vigueur passent alors
  d'abord dans une référence publique (`spec/outillage/`, `spec/outils/…`)
  dont les titres gardent l'identifiant d'origine (« ex-B.4 »), pour que
  les renvois du code, des tests et des skills restent résolus.

## Voir aussi

- `spec-hygiene` — les recettes que les lots M et C d'un chantier sur
  `spec/` appliquent (déplacer, découper, extraire des invariants).
