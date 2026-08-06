# SW Forge — Outils Summoners War

Application web (React + Vite) déployée sur **Vercel**, sans jamais rencontrer de blocage CORS.

Pages :

- **Accueil** — landing.
- **Bestiaire** — recherche et filtre des monstres (élément, étoiles naturelles).
- **RTA** — préparation Real Time Arena : sélection des monstres, classement par set de runes en
  **drag & drop**, saisie des vitesses, **ordre de tour** recalculé avec les leads SPD, et
  **import d'un export de compte SWEX** pour préremplir tes favoris RTA.
- **Siège** — équipes de 3 (leader + lead auto déduit de la leader skill, ticks de vitesse).
- **Arène** — à venir.

## Données SWARFARM (sans CORS)

L'API [SWARFARM](https://swarfarm.com) refuse les appels faits depuis un navigateur (CORS). La parade :

1. Une **GitHub Action** (`update-data.yml`) appelle l'API **depuis le CI Node** (pas de navigateur =
   pas de CORS), écrit le résultat dans `public/data/monsters.json` et le committe (cron hebdo + manuel).
2. Ce commit déclenche automatiquement un **déploiement Vercel**.
3. Le site (React) ne fait plus qu'un `fetch()` vers son **propre domaine** (`/data/monsters.json`) —
   plus aucun souci de CORS.

```
Navigateur → <app>.vercel.app/data/monsters.json   ✅ same-origin, toujours OK
CI (Node)  → swarfarm.com/api/...                   ✅ pas de navigateur, pas de CORS
```

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

## Import d'un compte (page RTA)

La page RTA peut importer un export **SWEX** (`.json`) — traité **100% dans le navigateur, rien n'est
envoyé**. Elle repère tes monstres « utilisés souvent » (favoris World Arena :
`favorite_unit_list` ou `world_arena_favorite_unit_id_list`) et calcule leur vitesse à partir des
**runes RTA** (`world_arena_rune_equip_list`, set Swift inclus).

> ⚠️ Les exports de compte contiennent des données personnelles : ils sont ignorés par git
> (voir `.gitignore`) et ne doivent jamais être committés.

## Limites connues

- Le script normalise plusieurs noms de champs SWARFARM par précaution (stats de base, leader skills,
  `com2us_id`). Ajuste `normalizeStats` / `normalizeLeaderSkill` si l'API évolue.
- Si l'API SWARFARM est indisponible, un jeu de démonstration est généré à la place (clairement
  labellisé dans le bandeau de statut).

## Crédits

Données de jeu et images © Com2uS, exposées publiquement par
[SWARFARM](https://github.com/swarfarm/swarfarm).
