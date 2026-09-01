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

## Cadrer une capture sur un bloc précis

Quand l'utilisateur demande à voir **un bloc** (« montre-moi le nouveau
bloc », « cadre mieux »), une capture pleine page est illisible : le bloc y
occupe un dixième de la hauteur et son chiffre-clé peut être hors champ.

Le driver ne fait pas ça — c'est un script jetable, à supprimer une fois la
capture livrée (ne PAS le committer : il fige un cas de démo qui périmera).
Recette, en 4 points qui se sont TOUS révélés nécessaires :

```js
// 1. Fenêtre LARGE — surtout pas étroite pour « mieux cadrer » (gotcha
//    ci-dessous : sous ~1100 px l'écran bascule en mobile et déplace des
//    contrôles). 2. deviceScaleFactor: 2 — sinon le texte des libellés
//    de l'app est illisible une fois la capture réduite.
const page = await browser.newPage({
  viewport: { width: 1800, height: 1100 },
  deviceScaleFactor: 2,
});

// 3. Capture d'ÉLÉMENT : Playwright fait défiler jusqu'au bloc et le prend
//    ENTIER, même s'il dépasse du viewport. `.first()` obligatoire — voir
//    la gotcha « rendu en double ».
const bloc = page
  .locator('div')
  .filter({ hasText: /^Artéfacts les plus offensifs pour ce build/ })
  .first();
await bloc.screenshot({ path: shot('mode-a.png') });
```

⚠️ **4. Un bloc VIDE ne démontre rien** — et il sort sans erreur. Première
capture des « Lignes verrouillées » livrée à `0 / 8` : le
`selectOption({ label: /regex/ })` n'avait rien matché et l'échec était
avalé. Deux réflexes :

- `selectOption` veut un libellé **exact**. Lire d'abord les options
  réelles, choisir dedans, et **dire** si rien ne matche plutôt que de
  continuer :
  ```js
  const exact = (await menu.locator('option').allTextContents())
    .find((t) => t.includes(libelle));
  if (!exact) { console.log('libellé introuvable :', libelle); continue; }
  await menu.selectOption({ label: exact });
  ```
- **Peupler le bloc avec un cas qui montre la règle**, pas juste « deux
  lignes ». Pour les lignes verrouillées : une sorte exclusive au type
  (plafond simple) ET une portable par les deux (plafond doublé, dont un
  minimum au-delà de la moitié force les DEUX pièces) — c'est là que le
  compteur d'emplacements et les plafonds deviennent lisibles. Deux lignes
  de la même sorte n'auraient rien montré.

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

⚠️ Voir `CLAUDE.md` à la racine : pendant le travail on ne lance QUE la zone
touchée (`node tests/run.mjs <filtre>`), la suite complète uniquement avant
une fusion sur `main`. Ce skill portait un compte de vérifications figé
(« 855 ») périmé depuis longtemps — un tel nombre se démode à chaque
commit et a déjà produit des messages de commit faux. Ne pas le recopier
ici : le lire dans la sortie de `npm test` du jour.

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
- ⚠️ **L'écran Optimizer rend une bonne partie de son contenu DEUX FOIS —
  une copie bureau et une copie téléphone, la seconde masquée par CSS.**
  Pas un accident : bureau et mobile sont deux dispositions de premier rang
  (voir `CLAUDE.md`), écrites en deux blocs `hidden lg:*` / `lg:hidden`
  distincts, pas l'une déclinée de l'autre — le commentaire d'en-tête de
  `OptimizerSection.tsx` (~l. 2138) le dit explicitement. C'est la vraie
  cause du doublon de placeholders, et elle vaut pour **tout** sélecteur sur
  cet écran, pas seulement le champ de recherche :
  - `getByPlaceholder('Rechercher un monstre…')` matche **2 nœuds** — le
    MÊME `MonsterSourcePicker mode="bestiary"`, rendu en
    `OptimizerSection.tsx` l. 2172 (bloc bureau) **et** l. 2251 (bloc
    mobile) — et lève « strict mode violation ». ⚠️ `{ exact: true }` n'y
    change RIEN : c'est deux fois le même littéral, pas un préfixe commun.
  - ⚠️ Ce n'est **PAS** un conflit avec le picker d'exclusion de runes, qui
    porte toujours un placeholder distinct (« Rechercher un monstre à
    exclure… », `RuneExclusionPicker.tsx` l. 103 — vérifié par grep le
    2026-09-01). Deux versions successives de cette gotcha ont attribué le
    doublon à l'exclusion : la première envoyait vers un remède qui ne
    marche pas (`exact: true`), la seconde donnait le bon remède pour une
    mauvaise raison — donc inapplicable au cas suivant, puisque la vraie
    règle (« tout est en double ») ne s'en déduisait pas.
  - **`.first()`, jamais `.last()`** : la copie bureau vient en premier dans
    le DOM. `.last()` vise l'INVISIBLE — `fill`/`click` partent alors en
    timeout, et une capture d'élément sort vide ou tronquée **sans lever
    d'erreur**. Piège vécu sur les captures cadrées ci-dessus.
  - ⚠️ **Un grep du libellé ne révèle PAS le doublon.** Les blocs partagés
    sont écrits une seule fois dans une variable JSX, puis interpolés dans
    les DEUX branches de disposition — `blocArtefactsSeuls` est déclaré en
    `OptimizerSection.tsx` l. 1828 et utilisé l. 2237 (bureau) **et** l. 2304
    (mobile). Chercher « Artéfacts les plus offensifs » ne sort qu'UNE ligne,
    et laisse conclure à tort que le bloc est unique. Pour trancher : grep du
    **nom de la variable**, pas du texte affiché.
  - `.first()` n'est correct que parce qu'on ouvre une fenêtre LARGE (voir
    la gotcha suivante). Pour un sélecteur qui doit tenir aux deux formats,
    viser la visibilité plutôt que la position :
    `page.getByPlaceholder('Rechercher un monstre…').filter({ visible: true })`
    (Playwright ≥ 1.51 ; 1.62.1 installée ici).
- ⚠️ **Fenêtre étroite = disposition mobile, où des contrôles sont
  DÉPLACÉS, pas seulement rétrécis.** Sous ~1 100 px de large, le champ de
  recherche du monstre passe derrière le panneau « Options » et devient
  inatteignable pour le driver. Rétrécir le viewport pour « mieux cadrer »
  une capture est donc contre-productif : ça change l'écran testé. La bonne
  manœuvre est l'inverse — fenêtre large + capture d'ÉLÉMENT (voir
  « Cadrer une capture sur un bloc précis »).
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
