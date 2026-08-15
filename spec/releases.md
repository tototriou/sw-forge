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

## Modèle de branches et processus de release

> Ce processus vivait dans le [README](README.md) ; il a été **déplacé ici**.
> Le README s'adresse à qui **découvre** le projet — le détail d'une procédure
> interne n'y a pas sa place, et le maintenir à deux endroits garantissait d'en
> laisser un se périmer.

`main` est **toujours la version stable en ligne**. On n'y développe pas
directement.

```
main ──●─────────────────────────●──────────► (stable, déployée sur Vercel)
        \                       /
         └── forge/<sujet> ────┘   (développement d'une version)
```

### ⚠️ Une branche porte un SUJET, pas un numéro

`release/1.3.1` devenait faux dès qu'on y ajoutait une fonctionnalité : il
fallait renommer la branche **et** supprimer l'ancien nom sur le dépôt, sinon
elle y figurait deux fois. On nommait la version avant de savoir ce qu'elle
serait.

Une branche s'appelle donc **`forge/<sujet>`** — ce qu'elle contient, en deux ou
trois mots, en français : `forge/prepa-rta`, `forge/import-artefacts`,
`forge/bestiaire-filtres`. **Le numéro se décide à la fusion**, quand on voit ce
qu'il y a dedans. C'est le pendant, côté Git, du `version: null` ci-dessus.

Si le sujet lui-même dérive au point que le nom ment (la branche « filtres »
finit par refondre le bestiaire), renommer reste possible — mais c'est rare,
alors qu'un numéro devenait faux au premier `feat`.

### Les cinq étapes

1. **Créer la branche** sur son sujet : `git switch -c forge/prepa-rta`
2. **Développer dessus**, commits conventionnels (`feat(scope):`, `fix(scope):`,
   `docs(spec):`).
3. **Dès le début**, ajouter l'entrée **en tête** de
   [`src/data/releases.ts`](src/data/releases.ts) — c'est ce que les joueurs
   liront sur la page **Nouveautés** — avec **`version: null`** : le numéro
   n'est pas encore tranché, la page affiche « En préparation » et masque le
   lien « GitHub ↗ » qui mènerait à un **404**.
4. **Avant de fermer la version**, dans la même branche :
   - **choisir le numéro** d'après ce que contient la branche (voir la table de
     numérotation ci-dessous) ;
   - l'écrire dans `version` de [`package.json`](package.json) **et** dans
     l'entrée de `releases.ts`, à la place du `null` ;
   - vérifier `npx tsc --noEmit`, `npm test` et `npm run build`.
5. **Fusionner dans `main` en `--no-ff`**, taguer, publier :
   ```bash
   git switch main && git merge --no-ff forge/prepa-rta -m "Merge forge/prepa-rta — v1.5.0 …"
   git tag -a v1.5.0 -m "…" && git push origin main --tags
   gh release create v1.5.0 --title "v1.5.0 — …" --notes "…"
   git push origin forge/prepa-rta   # la branche est conservée
   ```

⚠️ **Le message de merge fait le lien** entre le sujet et le numéro : c'est la
seule trace qui relie `forge/prepa-rta` à `v1.5.0`. Sans lui, retrouver la
branche d'une version demande de fouiller les dates.

⚠️ **`--no-ff`, jamais `--squash`.** Un squash **recopie le contenu sans
enregistrer la parenté** : Git ignore alors que la branche a été fusionnée. Elle
n'apparaît pas dans `git branch --merged`, et `git log main..forge/<sujet>`
ressort ses commits comme s'ils manquaient — alors que tout est bien dans `main`.
On ne peut plus distinguer une branche publiée d'une branche oubliée. Le merge
classique enregistre ce lien : c'est ce qui rend l'état vérifiable.

**Les branches sont conservées** — elles montrent d'un coup d'œil ce qui a été
livré, sujet par sujet, et le détail des commits reste accessible sans dérouler
l'historique de `main`. Le point de retour est le **tag**.

Les branches `release/1.3.0`, `release/1.4.0` et `release/1.5.0` gardent leur
ancien nom : les deux premières sont publiées et taguées, la troisième était
commencée quand la convention a changé. La renommer n'aurait rien appris à
personne — `forge/<sujet>` vaut pour les branches **créées ensuite**.

### Numérotation

SemVer, lue **du point de vue du joueur** — choisie à l'**étape 4**, une fois la
branche terminée, en regardant ce qu'elle contient (`git log main..forge/<sujet>`) :

| Incrément | Quand |
|---|---|
| **majeure** `2.0.0` | refonte, ou changement qui casse un format d'export |
| **mineure** `1.2.0` | nouvelle section, nouvelle fonctionnalité |
| **corrective** `1.1.1` | correction seule, aucune nouveauté |

⚠️ **`package.json`, l'entrée de `releases.ts` et le tag portent le même
numéro.** Le pied de page affiche la version de `package.json` et pointe vers la
page Nouveautés : trois valeurs désalignées, et le joueur lit un journal qui ne
correspond pas à ce qu'il utilise.

⚠️ **Un changement de calcul se note toujours** dans `releases.ts`, même minime.
C'est ce qu'un joueur remarque en premier (« ma vitesse a changé ») et ce qu'il
ne peut deviner nulle part ailleurs.
