# Vérifications automatiques

```bash
npm test
```

Affiche une ligne par vérification et sort en code 1 si l'une échoue. Les
échecs sont répétés à la fin, avec le nom de leur vérification : un journal
tronqué (celui de la CI) les montre quand même.

`node tests/run.mjs <filtre>` ne lance que les vérifications dont le nom
correspond (voir [index.ts](index.ts)).

## Ce qui est couvert

| Nature | Où | Ce qui est vérifié |
|---|---|---|
| Calculs | la plupart des `*.test.ts` | fonctions pures de `src/lib/` : dégâts, optimiseur, speed tuning, tris, filtres |
| Intégration | import, stockage, persistance, session, workers… | plusieurs modules ensemble : un export d'exemple importé, IndexedDB (`fake-indexeddb`), vrais `worker_threads` |
| Rendu | [rendu/](rendu/) | un composant affiché avec `react-dom/server` : présence d'un bouton, d'un libellé, d'un état désactivé — le sens, jamais la forme ([rendu/outils-rendu.tsx](rendu/outils-rendu.tsx)) |
| Outillage | hooks, `spec-lint`, `spec-toc`, renvois | les garde-fous du dépôt, dans des dépôts jetables |
| Bureau | `bureau-*.test.ts` | les modules purs de l'application de bureau |

**Ce qui ne l'est pas** : aucune vérification de `npm test` ne pilote un
navigateur ni ne simule une interaction (clic, saisie) — le banc
d'affichage, plus bas, le fait hors de la suite. Un rendu serveur n'exécute ni effet ni
gestionnaire d'évènement : ce qui se passe *après* un clic ne se vérifie
qu'à l'écran.

Les premières vérifications ciblaient les endroits où une erreur est à la
fois **grave et invisible** — ils restent le cœur de la suite :

| Fichier | Ce qui casserait sans bruit |
|---|---|
| [vitesse.test.ts](vitesse.test.ts) | Un arrondi de travers = un speed tune faux d'un point. Le joueur perd son combat et croit à un mauvais RNG. |
| [import.test.ts](import.test.ts) | Un export lu différemment selon qu'il arrive en texte ou en objet ; une date d'import affichée à la place de la date d'export. |
| [stockage.test.ts](stockage.test.ts) | Une écriture en retard qui ressuscite un compte effacé ; un enregistrement périmé lu comme s'il était complet. |
| [persistance.test.ts](persistance.test.ts) | Écrire alors que l'utilisateur a refusé ; ou cesser d'écrire pour quelqu'un d'installé depuis des mois. |

Aucun de ces symptômes n'est reproductible à la demande, et aucun ne sera
remonté correctement par un utilisateur. C'est ce qui justifie de les figer ici.

## Le banc d'affichage

[banc/](banc/) — **hors de `npm test` et de la CI**, lancé à la main :

```bash
node tests/banc/run.mjs --tous --compte tests/fixtures/compte-miniature.json
node tests/banc/run.mjs --ecrans optimizer      # un seul écran
node tests/banc/run.mjs --depuis origin/main    # les écrans que touchent les fichiers modifiés
node tests/banc/run.mjs --plage <a>..<b>        # idem, entre deux révisions
node tests/banc/cas.mjs                         # la règle sur ses pages de cas
```

Il construit l'app (`vite build` dans un dossier temporaire), la sert
(`vite preview`), l'ouvre dans Chromium sans fenêtre (Playwright) au
téléphone (360 × 800, tactile) et à l'ordinateur (1400 × 1000), amène chaque
écran dans chacun de ses états ([banc/ecrans.ts](banc/ecrans.ts)) et vérifie
un **invariant** : rien ne déborde à l'horizontale. La règle, ses définitions
et ses exclusions sont écrites en tête de [banc/mesure.ts](banc/mesure.ts) ;
chaque règle et chaque exclusion a une page de [banc/cas/](banc/cas/), un cas
signalé et un cas non signalé, que vérifie [banc/cas.mjs](banc/cas.mjs).

- **Sélection par fichiers** : `--depuis` et `--plage` passent les fichiers
  modifiés (`git diff --name-only`) à [banc/selection.ts](banc/selection.ts),
  qui les rapproche des motifs de chemins de chaque écran
  ([banc/ecrans.ts](banc/ecrans.ts)). `src/ui/`, `src/index.css` et
  `tailwind.config.js` sélectionnent tous les écrans ; un fichier qu'aucun
  motif ne couvre ne sélectionne rien et est signalé « hors table ». La
  vérification `banc-selection` (sans navigateur, dans `npm test`) garde la
  correspondance.
- **Ce qu'il ne fait pas** : comparer des captures. Il en prend une par
  écran, état et format, pour qu'on voie ce qui a été mesuré ; aucune n'est
  une référence.
- **Codes** : 0 rien ne déborde, 1 un débordement, 2 le banc n'a pas pu
  mesurer (Chromium absent, construction ou serveur en échec, état
  inatteignable, compte ou sortie refusés). Il ferme son navigateur et son
  serveur dans tous les cas, puis vérifie que le port est rendu.
- **Sortie** : chaque exécution crée son propre sous-dossier, neuf
  (`banc-…`), dans `--sortie <dossier>` (ou `SWB_BANC_SORTIE`), sinon dans
  le dossier temporaire du système ; une destination liée (lien, jonction)
  est refusée, et aucun fichier n'est écrit par-dessus un autre. Il reçoit
  les captures et `manifeste.json` (révision et empreinte de
  l'état de travail de l'arbre construit, révision du banc, formats et
  médias du pointeur, résultats, ce qui n'a pas été exercé, empreinte du
  compte).
- **Compte** : `--compte <fichier>` seulement, jamais une variable
  d'environnement ; sans lui, le compte d'exemple. Un fichier hors de
  `tests/fixtures/` est traité comme un **compte réel** : sortie obligatoirement
  hors de tout dépôt Git, et aucun message de la page sur la sortie standard
  (seulement leur nombre).
- `--racine <dossier>` mesure un autre arbre (un worktree, un vieux commit) ;
  ses dépendances doivent être installées.
- Ses fichiers passent par `tsc` et ESLint comme le reste de `tests/`, CI
  comprise : seul son lancement est manuel.

## Choix d'outillage

- **Pas de framework de test.** Les assertions sont celles de
  [outils.ts](outils.ts) (`ok`, `egal`, `ignore`) ; toutes les vérifications
  tournent à la suite, dans un seul processus, dans l'ordre de
  [index.ts](index.ts). ⚠️ `egal` compare par `JSON.stringify` : deux `Map` ou
  deux `Set` différents s'y écrivent `{}` et passent pour égaux — comparer
  leur contenu converti en tableau.
- **esbuild**, déjà présent comme dépendance de Vite, bundle `index.ts` ; Node
  exécute le résultat. C'est tout ce que fait [run.mjs](run.mjs), qui reprend à
  la main ce que Vite injecte (`import.meta.env`, `__APP_VERSION__`).
- ✅ **Les tests passent par `tsc`** : `tsconfig.json` couvre `src`, `scripts`
  ET `tests`. Ça n'a pas toujours été le cas — l'élargissement a révélé d'un
  coup une vingtaine d'appels de test périmés. ⚠️ Ce filet reste partiel :
  `tsc` ne voit jamais un champ OPTIONNEL oublié dans l'un des constructeurs
  d'un type partagé (l'accès reste valide), seulement un champ dont le type
  change ou qui devient obligatoire. Voir CLAUDE.md.
- ⚠️ **Le pool de runes synthétique est PARTAGÉ**, dans
  [../scripts/lib/randomPool.ts](../scripts/lib/randomPool.ts) — il vivait
  auparavant en 13 copies. Sa séquence de tirage est un **contrat** : la
  changer décalerait silencieusement tous les scénarios à seed fixe, sans
  qu'un seul test n'échoue de façon lisible. [random-pool.test.ts](random-pool.test.ts)
  fige pour cette raison des empreintes relevées AVANT la consolidation.
- **`fake-indexeddb`** en dépendance de développement : les vraies sémantiques
  d'IndexedDB (transactions, ordre, structured clone), pas un faux maison qui
  validerait ce qu'on croit avoir écrit.

## Les fichiers d'exemple

- [fixtures/compte-miniature.json](fixtures/compte-miniature.json) — un
  export SWEX **miniature écrit à la main**, commité, sans la moindre donnée
  réelle, mais qui exerce **chaque chemin** des extracteurs (box 6★,
  inventaire, favoris RTA, défense, attaque).
  [fixtures/compte-exemplaires-multiples.json](fixtures/compte-exemplaires-multiples.json)
  y ajoute deux exemplaires d'un même monstre.
- L'**export réel** du développeur (`tototriou-*.json`) est **gitignoré**. Les
  quelques vérifications qui s'en servent s'affichent en `--` (ignorées) quand il
  est absent, au lieu d'échouer sur les autres machines.

## Ajouter une vérification

1. Un fichier `nom.test.ts`, ou `nom.test.tsx` dans [rendu/](rendu/), qui
   exporte une fonction de vérification.
2. L'inscrire dans `VERIFICATIONS` de [index.ts](index.ts) : son nom sert de
   filtre à `node tests/run.mjs <filtre>`.
3. **Vérifier qu'elle sait échouer** : casser volontairement le code testé,
   constater le `KO`, puis restaurer. Un test qui ne peut pas échouer est pire
   qu'aucun test — il rassure à tort.
