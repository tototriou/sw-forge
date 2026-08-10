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
  version: string;        // « 1.1.0 »
  date: string;           // ISO court
  title: string;          // résumé en une ligne
  highlights?: string[];  // 1 à 3 points mis en avant
  changes: { kind: 'feat'|'fix'|'docs'; scope: string; text: string }[];
}
```

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

Le **modèle de branches et le processus de release** (branche `release/x.y.z`,
`main` stable, **fusion en squash**, tag, release GitHub, **suppression de la
branche**) sont décrits dans le [README](README.md), section « Versions &
releases ».

⚠️ `main` porte **un commit par version** : le détail du travail vit dans les
commits de la branche, et le point de retour est le **tag**.
