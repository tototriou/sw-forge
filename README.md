# Sky Arena — Outils Summoners War

Application web multi-pages, hébergeable gratuitement sur **GitHub Pages** sans jamais
rencontrer de blocage CORS. Deux pages :

- **Bestiaire** — recherche et filtrage des monstres (élément, étoiles naturelles).
- **RTA** — préparation Real Time Arena : sélection des monstres à runer, classement par set
  de runes (Swift / Violent / Despair / Autre + sections personnalisables) en **drag & drop**,
  saisie de la vitesse apportée par les runes et **ordre de tour** recalculé en direct par
  vitesse totale. La prépa est sauvegardée dans le navigateur (localStorage).

## Comment ça marche

Le problème initial : l'API de [SWARFARM](https://swarfarm.com) refuse les appels faits
directement depuis un navigateur (CORS). La solution retenue ici :

1. Une **GitHub Action** (`refresh-and-deploy.yml`) appelle l'API **depuis le serveur de CI**
   (pas de navigateur = pas de CORS possible), écrit le résultat dans
   `public/data/monsters.json`, le committe, puis **rebuild et redéploie** le site dans la
   foulée. Lançable à la main (`Run workflow`) ou automatiquement chaque lundi.
2. Une **seconde Action** (`deploy.yml`) build le site avec Vite et le déploie sur GitHub Pages
   à chaque changement de code (push sur `main`).
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

4. **Lance le premier fetch + déploiement** :
   `Actions → Actualiser les données puis déployer → Run workflow`
   (sinon il faudra attendre le lundi suivant, ou le site restera en mode démo).
   Ton site est ensuite en ligne sur `https://<toi>.github.io/<ton-repo>/`.

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
    ├── refresh-and-deploy.yml   Manuel + cron hebdo : actualise les données PUIS redéploie
    └── deploy.yml               Build Vite + déploiement GitHub Pages (sur push de code)
```

## Limites connues

- Le script `fetch-monsters.mjs` récupère aussi les **stats de base** (vitesse, HP, ATK, DEF,
  crit, résistance, précision) nécessaires à la page RTA. La vitesse (`speed`) ne dépend ni du
  niveau ni des étoiles dans SW : c'est bien la valeur de base attendue. Les noms de champs sont
  normalisés avec plusieurs fallbacks par précaution ; ajuste `normalizeStats` si l'API évolue.
- Si l'API SWARFARM change de forme ou est indisponible, le site bascule automatiquement sur un
  jeu de démonstration (noms fictifs, clairement indiqué dans le bandeau de statut) plutôt que de
  planter.

## Crédits

Données de jeu et images © Com2uS, exposées publiquement par
[SWARFARM](https://github.com/swarfarm/swarfarm).
