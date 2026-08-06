# SW Forge — Outils Summoners War

**Démo en ligne : https://sw-forge.vercel.app**

Application web (React + Vite) déployée sur **Vercel**, sans jamais rencontrer de blocage CORS.

Pages :

- **Accueil** — landing.
- **Bestiaire** — recherche et filtre des monstres (élément, étoiles naturelles).
- **RTA** — préparation Real Time Arena : sélection des monstres, classement par set de runes en
  **drag & drop**, saisie des vitesses, **ordre de tour** recalculé avec les leads SPD, et
  **import d'un export de compte SWEX** pour préremplir tes favoris RTA.
- **Siège** — équipes de 3 (leader + lead auto déduit de la leader skill, ticks de vitesse).
- **Arène** — à venir.

## Données

Les données de monstres proviennent de [SWARFARM](https://swarfarm.com). Elles sont récupérées côté CI
par `update-data.yml`, écrites dans `public/data/monsters.json` et consommées par le site.

## Déploiement (Vercel)

Le repo est importé sur Vercel (preset **Vite**, output `dist`) : déploiement automatique à chaque push
sur `main`, et preview par branche/PR. Rien à configurer côté hébergeur.

## Développement local

```bash
npm install
npm run fetch-data   # génère public/data/monsters.json (mode démo si l'API est indisponible)
npm run dev          # http://localhost:5173
```

## Structure

```
├── src/
│   ├── pages/        Accueil, Bestiaire, RTA, Siège, ComingSoon
│   ├── components/   cartes, filtres, icônes, composants RTA & Siège
│   ├── hooks/        useMonsters, useRtaState, useSiegeState
│   └── lib/          speed.ts (calcul de vitesse), importAccount.ts (import SWEX)
├── scripts/fetch-monsters.mjs        récupération des données côté serveur (CI)
├── public/data/monsters.json         données consommées par le site (générées)
├── public/{elements,runes}/          icônes officielles (SWARFARM)
└── .github/workflows/update-data.yml cron hebdo + manuel : actualise les données
```

## Limites connues

- Le script normalise plusieurs noms de champs SWARFARM par précaution (stats de base, leader skills,
  `com2us_id`). Ajuste `normalizeStats` / `normalizeLeaderSkill` si l'API évolue.
- Si l'API SWARFARM est indisponible, un jeu de démonstration est généré à la place (clairement
  labellisé dans le bandeau de statut).

## Crédits

Données de jeu et images © Com2uS, exposées publiquement par
[SWARFARM](https://github.com/swarfarm/swarfarm).
