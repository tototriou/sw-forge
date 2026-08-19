---
name: run-sw-forge
description: Compile, démarre et pilote SW Forge (app web React/Vite) via un Chromium headless Playwright. RÉSERVÉ au remote-access (utilisateur sans le serveur de dev sous les yeux) ET seulement sur demande explicite — jamais le réflexe par défaut pour vérifier un changement d'UI. Demander l'autorisation avant de lancer le driver si l'agent pense en avoir besoin.
---

SW Forge est une app web Vite/React à un seul binaire (pas de backend séparé).
Un agent en conteneur ne peut pas ouvrir de fenêtre de navigateur — piloter
l'app veut dire : démarrer le serveur de dev, piloter un Chromium headless
(Playwright) contre lui, et produire une VRAIE capture d'écran. Le
driver vit dans `.claude/skills/run-sw-forge/driver.mjs`, à côté de ce
fichier. Tous les chemins ci-dessous sont relatifs à la racine du dépôt.

⚠️ **Ne PAS piloter Chromium par défaut à chaque changement d'UI.**
L'utilisateur travaille normalement avec le serveur de dev sous les yeux et
vérifie lui-même à l'œil — ce skill est réservé au cas où il est en
**remote-access**, sans le serveur de dev sous les yeux à ce moment-là, et
seulement quand il le demande **explicitement** pour ce tour. Si l'agent
pense avoir besoin d'une vérification visuelle réelle (pas seulement
`tsc`/`npm test`/`npm run build`), il doit **demander l'autorisation avant**
de lancer le driver plutôt que de l'invoquer directement.

⚠️ Environnement observé pendant l'écriture de ce skill : **Windows local**
(pas un conteneur Linux) — donc pas de `apt-get`/`xvfb-run` : Playwright
Chromium tourne headless nativement sous Windows sans display virtuel. Sur
Linux, `npx playwright install --with-deps chromium` couvre l'équivalent
(dépendances système + navigateur en une commande).

## Prérequis

```bash
npm install -D playwright
npx playwright install chromium
```

Vérifié : ~115 Mo téléchargés (Chromium + Chrome Headless Shell), aucune
dépendance système supplémentaire nécessaire sous Windows.

## Serveur de dev

```bash
npm run dev &
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/   # attendre 200, pas de sleep fixe
```

Pour arrêter/libérer le port avant de relancer (Windows — `TaskStop` seul
ne tue pas le vrai process, voir CLAUDE.md à la racine) :

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -ExpandProperty OwningProcess
Stop-Process -Id <pid> -Force
```

## Run (chemin agent)

```bash
node .claude/skills/run-sw-forge/driver.mjs [compte.json] [monstre] [set]
```

Sans argument, le driver cherche un export de compte réel à la racine
(`tototriou-12889591.json`, `ß☆Enzo-6399149.json` — voir « Comptes réels »
ci-dessous), sélectionne **Lora** et le set **Fatal** dans l'Optimizer,
lance une recherche, et pilote la pagination des résultats (page
suivante, puis saisie directe d'un numéro de page). Capture à chaque étape
clé.

Captures écrites dans `.claude/skills/run-sw-forge/screenshots/` :

| fichier | contenu |
|---|---|
| `01-optimizer.png` | Écran Optimizer juste après l'import, avant sélection |
| `02-monster-and-set.png` | Monstre + set choisis, avant de lancer la recherche |
| `03-results.png` | Page complète des résultats (pleine page) |
| `04-pagination-page1.png` | Barre de pagination seule, page 1 |
| `05-pagination-page2.png` | Après clic sur « suivant » |
| `06-pagination-page3.png` | Après saisie directe « 3 » + Entrée |

Pour un autre monstre/set (adapter la démonstration à un changement
précis) :

```bash
node .claude/skills/run-sw-forge/driver.mjs tototriou-12889591.json Veromos Violent
```

## Invocation directe (changements côté moteur, pas côté écran)

La plupart des changements dans `src/lib/runeBuildOptim.ts` (l'algorithme
de recherche lui-même) n'ont **pas besoin** du navigateur — `scripts/
optimizer-search.ts` rejoue une recherche exportée depuis l'écran
directement en Node, plus rapide et plus ciblé :

```bash
npx tsx scripts/optimizer-search.ts <export.json> <recette.json>
```

Voir les skills `algo-verify`/`optimizer-perf-testing` pour la discipline
de vérification de CE chemin-là (référence brute-force, test différentiel,
budget réaliste…) — ce skill-ci (`run-sw-forge`) couvre la couche ÉCRAN,
pas l'algorithme.

## Run (chemin humain)

```bash
npm run dev
```

Ouvre `http://localhost:5173/` dans un vrai navigateur. Sans intérêt en
headless — c'est le chemin agent (`driver.mjs`) qui s'applique ici.

## Test

```bash
npx tsc --noEmit && npm test && npm run build
```

796 vérifications passées au moment de l'écriture de ce skill (voir
`CLAUDE.md` à la racine — triade de vérification standard).

---

## Gotchas

- **Comptes réels, pas de fixture synthétique utilisable pour une vraie
  démo.** `tests/fixtures/compte-miniature.json` (committé, sûr) ne
  contient que 3 monstres/2 runes — assez pour les tests unitaires, pas
  pour dépasser 20 résultats et démontrer la pagination. Un VRAI export
  (gitignoré, `tototriou-*.json`/`*Enzo-*.json`/`*account*.json`, présent
  uniquement sur les machines des développeurs) est nécessaire pour une
  démonstration réaliste — sans lui, le driver s'arrête avec un message
  explicite plutôt que d'échouer en silence.
- **Boîte de dialogue « Garder tes données sur cet appareil ? »** apparaît
  après le TOUT PREMIER import de la session navigateur (persistance
  IndexedDB, voir `usePersistence`). Le driver clique « Garder mes données »
  automatiquement — sans ça, toute navigation suivante re-déclenche l'état
  vide.
- **Un clic sur un set = TOUT le set d'un coup, pas une pièce.** Le tableau
  `sets` de `SetComboPicker.tsx` contient des CLÉS de set (`'fatal'`), pas
  des pièces individuelles — `setsCost`/`canAddSet`
  (`src/lib/effects.ts`) somment le coût du set ENTIER par clé présente.
  Cliquer 4 fois sur « Fatal » en pensant ajouter 4 pièces bloque le
  driver au 2ᵉ clic (bouton désactivé, `canAddSet` refuse un second set de
  4 pièces sur 6 emplacements). Un seul clic suffit.
- **Champs Min/Max de "Conditions" en mode BONUS par défaut.** « Stats de
  base exclues » est coché par défaut (voir `OptimizerSection.tsx`) : un
  nombre saisi dans un champ Min/Max est un **bonus au-dessus de la base**
  du monstre, pas un total — `250` tapé dans VIT minimum pour Lora (base
  120) devient en réalité un minimum TOTAL de 370 une fois converti. Piège
  vécu en construisant ce driver (recherche jugée « impossible » alors que
  la vraie intention était atteignable). Pour viser un TOTAL précis,
  décocher d'abord « Stats de base exclues », ou calculer le bonus
  attendu = total voulu − base du monstre (visible sur sa fiche stats).
- **Placeholder avec un vrai caractère ellipse (`…`), pas trois points.**
  `getByPlaceholder('Rechercher un monstre...')` (trois points ASCII) ne
  matche RIEN — le composant utilise `'Rechercher un monstre…'` (U+2026).
  Pareil pour tout texte de l'app affichant une ellipse.
- **Deux champs "Rechercher un monstre" sur l'écran Optimizer.** Le
  sélecteur du monstre à optimiser ET le picker d'exclusion de runes («
  Rechercher un monstre à exclure… ») partagent un placeholder qui
  commence pareil — `getByPlaceholder(..., { exact: true })` obligatoire,
  un match approximatif lève une erreur « strict mode violation ».
- **La recherche prend plusieurs secondes une fois lancée** (~4-10 s sur un
  compte de plusieurs milliers de runes, budget adaptatif — voir
  `algo-verify`/`optimizer-perf-testing`). Attendre le texte
  `combinaison(s) trouvée(s)` PUIS que le bouton redevienne littéralement
  « Rechercher » (pas « Recherche… ») — le texte peut apparaître pendant
  l'aperçu EN DIRECT, avant la fin réelle de la recherche.

## Troubleshooting

- **`Cannot find package 'playwright'` en lançant le driver** : le script
  a été exécuté depuis un répertoire hors du dépôt (ex. un scratchpad
  temporaire) — la résolution de module Node remonte les répertoires
  parents à la recherche de `node_modules`, qui n'existe que sous la
  racine du dépôt. Lancer `node .claude/skills/run-sw-forge/driver.mjs`
  depuis la racine (ou tout sous-dossier du dépôt), jamais depuis un
  chemin extérieur.
- **`locator.click: Timeout … element is not enabled`** sur un bouton de
  set dans `SetComboPicker` : très probablement le piège « un clic = tout
  le set » ci-dessus (clic répété sur un set déjà complet).
- **`getByPlaceholder(...)` timeout alors que le champ est visible à
  l'écran** : vérifier le caractère ellipse (`…` vs `...`) et l'unicité
  du placeholder (voir Gotchas).
