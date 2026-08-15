# Ressources · Nouveautés (`#/releases`)

Journal des versions, **destiné aux joueurs** : ce qui a changé, version par
version. Rangé sous **Ressources**, à côté du Bestiaire et des Mécaniques.

Fichiers : [ReleasesPage.tsx](src/pages/ReleasesPage.tsx) ·
[releases.ts](src/data/releases.ts) (le contenu) · [App.tsx](src/App.tsx) (route
et pied de page).

## Pourquoi une page dans l'app

Un joueur qui utilise le site ne va pas lire GitHub. S'il ne voit pas ce qui
bouge, une correction de calcul passe inaperçue — or c'est exactement le genre de
changement qu'il doit connaître (« ma vitesse de combat a changé, pourquoi ? »).

## Contenu — tenu à la MAIN, pas dérivé de GitHub

⚠️ `RELEASES` dans [releases.ts](src/data/releases.ts) est la **source de vérité**
de ce qui s'affiche. **Ne pas** appeler l'API GitHub :

- le site est **statique et doit rester lisible hors ligne** ;
- une dépendance réseau à un tiers ajoute quotas, CORS et pannes, pour afficher
  un contenu qui change une fois par version ;
- surtout, un message de commit n'est **pas** une note de version : le journal
  dit ce que ça change **pour le joueur**, pas comment c'est implémenté.

```ts
interface Release {
  version: string | null; // « 1.1.0 » — null = numéro pas encore tranché
  date: string;           // ISO court
  title: string;          // résumé en une ligne
  highlights?: string[];  // 1 à 3 points mis en avant
  changes: { kind: 'feat'|'fix'|'docs'; scope: string; text: string }[];
  tag?: boolean;          // false = aucun tag Git → lien GitHub masqué
}
```

### ⚠️ `version: null` — la version en préparation

Une version se développe **sans savoir** si elle sortira en corrective ou en
mineure : c'est ce qu'elle contient à la fin qui tranche. Écrire un numéro
d'avance obligeait à le corriger en route, dans `package.json`, dans `releases.ts`
**et** dans le nom de la branche.

`version: null` dit « pas encore fixé ». La page affiche alors **« En
préparation »** et une pastille « Pas encore publiée », au lieu du numéro. Le
numéro s'écrit **au moment de publier**, en même temps que `package.json` et le
tag — un seul geste, un seul endroit où se tromper.

`libelleVersion()` ([releases.ts](src/data/releases.ts)) porte le préfixe `v` :
écrit en dur par l'appelant, il donnait « vEn préparation ». Les deux pages qui
affichent une version (**Nouveautés** et l'**accueil**) passent par elle.

⚠️ **Le bandeau « Quoi de neuf » de l'accueil montre la dernière version
PUBLIÉE**, pas `RELEASES[0]`. Il sert à donner une raison de revenir : annoncer
une version en préparation promettrait des nouveautés absentes de l'app.

⚠️ **La pastille « Version actuelle » ne s'affiche pas sur une version en
préparation**, même en tête de liste : elle désigne ce qui **tourne**. La
montrer sur une version non déployée ferait croire au joueur qu'il l'utilise.

### ⚠️ Le lien « GitHub ↗ » n'est pas systématique

Chaque entrée affiche un lien vers `/releases/tag/vX.Y.Z`. Il était écrit
**inconditionnellement** : la **1.0.0**, publiée avant que le dépôt existe, n'a
jamais eu de tag — le lien menait à un **404**.

Le lien est masqué dans deux cas :

| Cas | Marqueur | Pourquoi |
|-----|----------|----------|
| Version antérieure au dépôt | `tag: false` | Aucun tag ne lui correspondra jamais (1.0.0) |
| Version **en préparation** | `version: null` | Pas de numéro → pas d'URL de tag à construire |

Le second **ne demande aucun `tag: false`** : sans numéro il n'y a rien à
pointer, la page le déduit. Écrire le numéro à la publication fait donc
réapparaître le lien tout seul — une chose de moins à ne pas oublier.

Un lien mort est pire que pas de lien : il donne l'impression que le site est
cassé, sur la page même qui sert à montrer qu'il est entretenu.

- **La plus récente en premier** — c'est l'ordre d'affichage, et la première est
  mise en avant (cadre coloré + pastille « Version actuelle »).
- ⚠️ **Style : une phrase courte, lisible par un joueur.** Ce qui change **pour
  lui**, jamais comment c'est fait. Pas de nom de fonction, pas de formule, pas
  de détail d'implémentation — tout ça vit dans les commits et dans `spec/`.
  Repère : au-delà d'une quinzaine de mots, la ligne raconte l'implémentation.
- `scope` en **français**, comme l'interface (« Siège », « Mon compte »…).
- Les changements sont triés **nouveautés → corrections → doc** à l'affichage,
  quel que soit l'ordre de saisie.

## Version affichée

Le **pied de page** montre `v{__APP_VERSION__}`, injecté au build depuis
`package.json` ([vite.config.ts](vite.config.ts)), et **cliquable** vers cette
page. Une seule source de version, celle qu'incrémente la release.

⚠️ `package.json` et l'entrée en tête de `RELEASES` doivent **rester alignés** :
c'est le même geste, dans la même branche de release.

## Voir aussi

Le **modèle de branches et le processus de release** (branche `forge/<sujet>`,
`main` stable, **fusion `--no-ff`**, tag, release GitHub) sont décrits dans le
[README](README.md), section « Versions & releases ».

⚠️ **Une branche porte un sujet, pas un numéro** (`forge/prepa-rta`) : le numéro
n'est décidé qu'à la fusion. C'est le pendant, côté Git, du `version: null`
ci-dessus — on ne nomme pas une version avant de savoir ce qu'elle contient.

⚠️ **`--no-ff`, jamais `--squash`** : un squash recopie le contenu sans
enregistrer la parenté, si bien qu'une branche publiée reste indistinguable
d'une branche oubliée (`git branch --merged` ne la voit pas). Les branches sont
**conservées** après publication, et le point de retour est le **tag**.
