# Bestiaire — Sky Arena

Interface de recherche et filtrage du bestiaire Summoners War (élément, étoiles naturelles),
hébergeable gratuitement sur **GitHub Pages**, sans jamais rencontrer de blocage CORS.

## Comment ça marche

Le problème initial : l'API de [SWARFARM](https://swarfarm.com) refuse les appels faits
directement depuis un navigateur (CORS). La solution retenue ici :

1. Une **GitHub Action planifiée** (`update-data.yml`) appelle l'API **depuis le serveur de CI**
   (pas de navigateur = pas de CORS possible) et écrit le résultat dans
   `public/data/monsters.json`, puis le committe dans le repo.
2. Une **seconde Action** (`deploy.yml`) build le site avec Vite et le déploie sur GitHub Pages
   chaque fois que le code change *ou* que les données sont actualisées.
3. Le site (React) ne fait donc plus qu'un `fetch()` vers son **propre domaine**
   (`./data/monsters.json`) — plus aucun souci de CORS, jamais.

```
Navigateur → github.io/data/monsters.json   ✅ same-origin, toujours OK
CI (Node)  → swarfarm.com/api/...           ✅ pas de navigateur, pas de CORS
```

## Mise en route (une seule fois)

1. **Crée un repo GitHub vide** et pousse tout le contenu de ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<toi>/<ton-repo>.git
   git push -u origin main
   ```

2. **Active GitHub Pages** :
   `Settings → Pages → Source` → choisir **"GitHub Actions"** (pas "Deploy from a branch").

3. **Autorise les Actions à committer** (nécessaire pour `update-data.yml`) :
   `Settings → Actions → General → Workflow permissions` → cocher
   **"Read and write permissions"**.

4. **Lance le premier fetch de données** :
   `Actions → Actualiser les données (SWARFARM) → Run workflow`
   (sinon il faudra attendre le lundi suivant, ou le site restera en mode démo).

5. Le déploiement se lance automatiquement à la suite (ou lance-le manuellement dans
   `Actions → Build & Deploy`). Ton site est en ligne sur
   `https://<toi>.github.io/<ton-repo>/`.

## Développement local

```bash
npm install
npm run fetch-data   # génère public/data/monsters.json (mode démo si hors-CI, c'est normal)
npm run dev           # http://localhost:5173
```

## Structure

```
├── src/                     Application React (composants, styles, types)
├── scripts/fetch-monsters.mjs   Récupération des données côté serveur
├── public/data/monsters.json    Données consommées par le site (générées)
└── .github/workflows/
    ├── update-data.yml      Cron hebdo + déclenchement manuel : actualise les données
    └── deploy.yml           Build Vite + déploiement GitHub Pages
```

## Limites connues

- Le schéma exact des champs de l'API SWARFARM (`element`, `base_stars`, `image_filename`…)
  n'a pas pu être vérifié en conditions réelles depuis cet environnement (accès réseau sortant
  désactivé côté génération). Le script `fetch-monsters.mjs` normalise plusieurs noms de champs
  possibles par précaution — **vérifie le premier run réel** (`Actions → logs`) et ajuste
  `normalizeElement` / `normalizeMonster` si un champ ne correspond pas.
- Si l'API SWARFARM change de forme ou est indisponible, le site bascule automatiquement sur un
  jeu de démonstration (noms fictifs, clairement indiqué dans le bandeau de statut) plutôt que de
  planter.

## Crédits

Données de jeu et images © Com2uS, exposées publiquement par
[SWARFARM](https://github.com/swarfarm/swarfarm).
