# SW Blacksmith

Une boîte à outils pour Summoners War.

**En ligne : https://sw-forge.vercel.app** — et en application de bureau (Windows, Linux), depuis
la page Télécharger du site.

SW Blacksmith aide à préparer ses contenus compétitifs : composer ses équipes de siège et vérifier
leur speed tuning, classer ses monstres pour la RTA, analyser ses runes et son compte, chercher le
meilleur build d'un monstre, partager des recommandations de decks avec sa guilde.

**Tout reste dans ton navigateur.** Pas de serveur, pas de compte, pas d'authentification : l'export
de compte que tu importes est lu dans la page et n'est jamais envoyé nulle part. Rien n'est conservé
sans ton accord, et « Tout supprimer » efface tout.

## Documentation

- **Ce que fait l'app, comment elle est construite** :
  [docs/01-presentation/](docs/01-presentation/README.md).
- **Toute la documentation**, page par page : [docs/README.md](docs/README.md). C'est la source de
  vérité fonctionnelle : elle dit ce que fait chaque écran et **pourquoi**, y compris les pièges
  déjà rencontrés et les décisions à ne pas défaire.
- **Contribuer au code** (stack, commandes, règles de travail) : [AGENTS.md](AGENTS.md).

## Démarrer

```bash
nvm use              # Node 24, lu dans .nvmrc
npm install          # installe aussi les hooks Git (pre-commit, commit-msg)
npm run fetch-data   # données de monstres et compétences (mode démo si l'API est KO)
npm run dev          # http://localhost:5173
```

## Contribuer

Pas besoin de coder pour aider. Un bug, une donnée fausse, une formule qui ne correspond pas à ce
que le jeu affiche, une idée d'écran : ouvre une **issue**. Pour un désaccord de calcul, le plus
utile est un **cas concret** — le monstre, ses valeurs, et ce que le jeu affiche. C'est comme ça que
la formule de vitesse a été corrigée.

Les pull requests sont bienvenues ; pour un changement de fond, ouvre d'abord une issue pour qu'on
en discute. Avant de coder, lis la documentation de ce que tu touches : [AGENTS.md](AGENTS.md) dit
laquelle.

## Contact

Une question, un retour ou une demande particulière :
[**rejoins le Discord**](https://discord.gg/R2Fe4GJZET).

## Construit avec

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev) — build et serveur de dev
- [Tailwind CSS](https://tailwindcss.com) — styles
- [lucide-react](https://lucide.dev) — icônes d'interface
- [framer-motion](https://www.framer.com/motion/) — animations
- [Electron](https://www.electronjs.org) — application de bureau
- Déployé sur [Vercel](https://vercel.com) : déploiement automatique sur `main`, preview par branche.

## Auteur

**Thomas** — [github.com/tototriou](https://github.com/tototriou) ·
[Discord](https://discord.gg/R2Fe4GJZET)

## Remerciements

- [SWARFARM](https://github.com/swarfarm/swarfarm) — les données de monstres et les icônes du jeu,
  exposées publiquement.
- [SW Exporter](https://github.com/Xzandro/sw-exporter) — le format d'export de compte qui rend
  l'import possible.

Données de jeu et images © Com2uS. Projet non officiel, sans affiliation avec Com2uS.
