# SW Forge

Une boîte à outils pour Summoners War.

**En ligne : https://sw-forge.vercel.app**

SW Forge aide à préparer ses contenus compétitifs : composer ses équipes de
siège et vérifier leur speed tuning, classer ses monstres pour la RTA, analyser
ses runes et son compte, partager des recommandations de decks avec sa guilde.

**Tout reste dans ton navigateur.** Il n'y a pas de serveur, pas de compte, pas
d'authentification : les données que tu importes vivent dans le `localStorage`
et ne sont jamais envoyées nulle part. Un bouton « Supprimer mes données »
efface tout.

## Ce qu'on y trouve

- **Siège** — équipes de 3, leader et lead déduits automatiquement de la leader
  skill, **vérification des ticks ATB** (vitesse de combat cible), défense et
  offense séparées.
- **Recommandations de siège** — un auteur décrit ses decks (monstres, sets,
  stats minimales, consignes), les exporte en JSON ; les autres joueurs les
  importent et **confrontent leur compte** : monstres manquants, deck à
  composer, stats qui ne suivent pas.
- **RTA** — préparation Real Time Arena : classement des monstres par section en
  **glisser-déposer**, saisie des vitesses, **ordre de tour** recalculé avec les
  leads.
- **Mon compte** — résumé global, box de monstres, **runes** (efficience ou
  score SW officiel, optimisation gemme/meule, courbes de potentiel) et
  artéfacts, alimentés par un export de compte.
- **Bestiaire** — recherche et filtres sur les données de monstres.
- **Mécaniques** — aide-mémoire des règles de jeu.
- **Nouveautés** — journal des versions : ce qui change à chaque release.

## Import de compte

L'application lit les exports JSON produits par
[SW Exporter](https://github.com/Xzandro/sw-exporter). Le fichier est lu **en
local, dans la page** : il n'est pas téléversé. La jointure avec les données de
monstres se fait sur `com2us_id`.


## Données de monstres

Elles proviennent de [SWARFARM](https://swarfarm.com), via son API publique
`/api/v2/`. Elles sont récupérées **côté CI** (Node, donc pas de CORS) par
`scripts/fetch-monsters.mjs`, écrites dans `public/data/monsters.json`, puis
servies avec le site. Un workflow GitHub Actions (`update-data.yml`) les
rafraîchit chaque semaine et commite le résultat.

Si l'API est indisponible au moment du build, un jeu de démonstration
déterministe est généré à la place, et le bandeau de statut le dit clairement —
le site reste déployable et testable.

Les icônes (éléments, runes, stats, artéfacts, leader skills) sont **servies en
local** depuis `public/` : aucun lien direct vers les serveurs de SWARFARM.

## Versions & releases

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
qu'il y a dedans.

Si le sujet lui-même dérive au point que le nom ment (la branche « filtres »
finit par refondre le bestiaire), renommer reste possible — mais c'est rare,
alors qu'un numéro devenait faux au premier `feat`.

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
   ⚠️ **Le message de merge fait le lien** entre le sujet et le numéro : c'est
   la seule trace qui relie `forge/prepa-rta` à `v1.5.0`. Sans lui, retrouver la
   branche d'une version demande de fouiller les dates.

   ⚠️ **`--no-ff`, jamais `--squash`.** Un squash **recopie le contenu sans
   enregistrer la parenté** : Git ignore alors que la branche a été fusionnée.
   Elle n'apparaît pas dans `git branch --merged`, et
   `git log main..forge/<sujet>` ressort ses commits comme s'ils manquaient —
   alors que tout est bien dans `main`. On ne peut plus distinguer une branche
   publiée d'une branche oubliée. Le merge classique enregistre ce lien : c'est
   ce qui rend l'état vérifiable.

   **Les branches sont conservées** — elles montrent d'un coup d'œil ce qui a
   été livré, sujet par sujet, et le détail des commits reste accessible sans
   dérouler l'historique de `main`.

   Les branches `release/1.3.0`, `release/1.4.0` et `release/1.5.0` gardent leur
   ancien nom : les deux premières sont publiées et taguées, la troisième était
   commencée quand la convention a changé. La renommer n'aurait rien appris à
   personne — `forge/<sujet>` vaut pour les branches **créées ensuite**.

**Numérotation** (semver, lue du point de vue du joueur) — **choisie à l'étape
4**, une fois la branche terminée, en regardant ce qu'elle contient
(`git log main..forge/<sujet>`) :

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

## Développement

```bash
npm install
npm run fetch-data   # génère public/data/monsters.json (mode démo si l'API est KO)
npm run dev          # http://localhost:5173
```

Avant d'ouvrir une PR :

```bash
npx tsc --noEmit     # le projet est en TypeScript strict
npm test             # vérifications sur les calculs et la conservation
npm run build
```

`npm test` ne couvre **pas** l'interface, volontairement : elle se vérifie à
l'œil. Il cible les quatre endroits où une erreur serait à la fois grave et
invisible — vitesse de combat, lecture d'un export, stockage du compte,
conservation des données. Voir [tests/README.md](tests/README.md).

### Structure

```
├── spec/                  LA référence : ce que fait l'app et pourquoi
├── tests/                 vérifications des calculs et de la conservation
├── src/
│   ├── pages/             Accueil, Bestiaire, RTA, Siège, Mon compte, Outils, Mécaniques
│   ├── components/        cartes, filtres, icônes, composants RTA & Siège
│   ├── hooks/             état persisté (RTA, siège, recos, réglages globaux)
│   ├── lib/               calculs purs : vitesse, stats, runes, import, matching
│   └── workers/           calculs lourds (recherche de builds), hors thread principal
├── scripts/fetch-monsters.mjs         récupération des données (CI)
├── public/data/monsters.json          données consommées par le site (générées)
└── .github/workflows/update-data.yml  cron hebdo + manuel
```

### Lis la spec d'abord

Le dossier [`spec/`](spec/) n'est pas de la documentation d'après-coup : c'est la
**source de vérité fonctionnelle**. Il explique non seulement ce que fait chaque
écran, mais **pourquoi** — y compris les pièges déjà rencontrés et les décisions
qu'il ne faut pas défaire. Quelques exemples de ce qu'on n'a pas envie de
redécouvrir à ses dépens :

- [`shared/calcul-vitesse.md`](spec/shared/calcul-vitesse.md) — le totem et le
  lead s'appliquent **séparément et chacun arrondi**, pas en somme de
  pourcentages. Cas de contrôle à l'appui.
- [`shared/donnees-monstres.md`](spec/shared/donnees-monstres.md) — les stats de
  base viennent de `max_lvl_*`, **jamais** de `base_*` (qui est le grade
  d'invocation). Et le nom d'un monstre **ne l'identifie pas** : plusieurs
  entrées partagent nom et élément.
- [`compte/calcul-runes.md`](spec/compte/calcul-runes.md) — efficience, score SW
  officiel, optimisation gemme/meule.

Toute modification de comportement met la spec à jour dans le même commit.

### Conventions

- Interface, spec et messages de commit **en français**.
- Commits conventionnels : `feat(scope): …`, `fix(scope): …`, `docs(spec): …`.
- Les calculs de jeu vivent dans `src/lib/` en **fonctions pures**, sans React :
  ils sont vérifiables isolément.
- Toute nouvelle section est ajoutée **aussi sur la page d'accueil**, dans le
  même commit.

## Contribuer

Pas besoin de coder pour aider. Un bug, une donnée fausse, une formule qui ne
correspond pas à ce que le jeu affiche, une idée d'écran : ouvre une **issue**.
Pour un désaccord de calcul, le plus utile est un **cas concret** — le monstre,
ses valeurs, et ce que le jeu affiche. C'est comme ça que la formule de vitesse
a été corrigée.

Les pull requests sont bienvenues ; pour un changement de fond, ouvre d'abord
une issue pour qu'on en discute.

## Contact

Une question, un retour ou une demande particulière :
[**rejoins le Discord**](https://discord.gg/R2Fe4GJZET).

## Construit avec

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev) — build et serveur de dev
- [Tailwind CSS](https://tailwindcss.com) — styles
- [lucide-react](https://lucide.dev) — icônes d'interface
- [framer-motion](https://www.framer.com/motion/) — animations
- Déployé sur [Vercel](https://vercel.com) (preset Vite, sortie `dist`) :
  déploiement automatique sur `main`, preview par branche.

## Auteur

**Thomas** — [github.com/tototriou](https://github.com/tototriou) ·
[Discord](https://discord.gg/R2Fe4GJZET)

## Remerciements

- [SWARFARM](https://github.com/swarfarm/swarfarm) — les données de monstres et
  les icônes du jeu, exposées publiquement.
- [SW Exporter](https://github.com/Xzandro/sw-exporter) — le format d'export de
  compte qui rend l'import possible.

Données de jeu et images © Com2uS. Projet non officiel, sans affiliation avec
Com2uS.
