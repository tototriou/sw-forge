# Preuve — lot R2 du rebranding : le nom et le logo

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R2 ;
décisions 2, 14, 15 et 16 (A.8). Scripts du scratchpad : `r2-mesure-nom.mjs`,
`r2-images.mjs`, `r2-barre.mjs`, 2026-09-29.

## 1. Le nom, écrit une fois

`src/marque.ts` : `NOM_APP = 'SW Blacksmith'` et `PREFIXE_FICHIER =
'swblacksmith'`. Lus par les composants, par `src/lib/` (messages d'import) et
par `index.html` au build : un plugin de `vite.config.ts` y remplace
`%NOM_APP%` (titre de l'onglet, `og:site_name`, `og:title`, `twitter:title`).

Relevé de départ : 30 fichiers mentionnent le nom. Renommés :

| Où | Quoi |
|---|---|
| `index.html` | titre de l'onglet, trois balises de partage |
| `Sidebar.tsx` (via `Logo.tsx`) | le logo : symbole et nom |
| `HomePage.tsx` | titre du héros (espace ordinaire : il peut passer sur deux lignes au téléphone) |
| `App.tsx` | titre de page par défaut ; infobulles GitHub et Discord (décision 15) |
| `SiegeBoard.tsx` | infobulle « Importer » (deux rendus, bureau et téléphone) |
| `MechanicsPage.tsx`, `ReleasesPage.tsx` | une phrase chacune |
| `rtaShare.ts`, `recoShare.ts`, `siegeShare.ts` | messages d'import (permis, nommés avant le code) |
| `RunesCompare.tsx`, `RtaBackupBar.tsx`, `RecoBoard.tsx`, `siegeShare.ts` | fichiers téléchargés `swforge-…` → `swblacksmith-…` (décision 14) |

**Ne bougent pas** : clés de stockage `sw-forge-*`, base IndexedDB `sw-forge`,
identifiants de format (`sw-forge/prepa-rta`, `…/recommandations`,
`…/siege-equipes`, `…/courbe-runes`), URLs GitHub et Vercel, historique des
versions (`data/releases.ts`). **Différé** : `swforge-optimizer-…`
(`OptimizerSection.tsx`), avec les lots 9a / 11e de la refonte — Thomas attend
une livraison sur l'Optimizer.

Preuve du contrat (`grep -rnE "SW ?Forge" src index.html`, hors
`releases.ts`) : **6 lignes, toutes des commentaires** — `Logo.tsx:39`,
`MobileNotice.tsx:4` et `:25`, `RtaAmiSection.tsx:39`, `accountStore.ts:12`,
`ui/index.ts:1`.

## 2. Le logo

`src/components/Logo.tsx` : `SymboleLogo` (l'enclume, le marteau, les
étincelles, tracés repris tels quels de la charte) et `Logo` (symbole + nom,
ou symbole seul si la barre est repliée). ⚠️ Couleurs en **jetons** : enclume
`ink`, marteau `star`, étincelles `accent`. La charte dessine l'enclume en
parchemin sur fond sombre et en noir en monochrome ; `ink` vaut l'un en Forge
et l'autre en Atelier. Il remplace les trois `<img src="favicon.svg">` de
l'app : barre latérale, barre du haut au téléphone, héros de l'accueil.

**Le nom dans la barre latérale** — mesuré en Cinzel (`r2-mesure-nom.mjs`) :
« SW Blacksmith » fait 139,8 px en `text-lg`, pour environ 130 disponibles —
tronqué. Retenu : `text-base` gras (la charte est en Cinzel 700), et le bouton
de repli poussé par `ml-auto` plutôt que par un espaceur (un écart de 10 px
de moins). Sur l'app CONSTRUITE (`vite preview`, `r2-barre.mjs`, 1440 px) :

```text
dark  : « SW Blacksmith » 127 px pour 127 px — tient (police Cinzel, serif)
  titre de l'onglet : SW Blacksmith — Boîte à outils Summoners War
light : « SW Blacksmith » 127 px pour 127 px — tient (police Cinzel, serif)
  titre de l'onglet : SW Blacksmith — Boîte à outils Summoners War
```

**Fichiers `public/`** (permis, nommés avant le code) :
- `favicon.svg` : la variante **16 px** de la charte, l'enclume seule en
  braise sur fond Fer, rayon 25 %. L'onglet l'affiche en 16 px ; la variante
  32 (enclume et marteau) y serait illisible.
- `favicon.png` (512, aussi `apple-touch-icon`) : l'« icône d'app » de la
  charte — fond Fer, rayon 25 %, symbole complet à deux étincelles, rendue
  par Playwright depuis les tracés (`r2-images.mjs`).
- `og-image.png` : voir § 4.

## 3. L'inventaire ne perd pas le nom

⚠️ En sortant le nom du texte, R2 le rendait **invisible** à l'inventaire de
l'interface, qui lisait `{NOM_APP}` comme rien et `${NOM_APP}` comme `{…}`.
L'extracteur (`scripts/inventaire-ui.mjs`) lit désormais les constantes de
`src/marque.ts` par leur **valeur**, seules ou dans un gabarit. La fixture le
vérifie (`texte:SW Blacksmith`, `attr:title:Le code de SW Blacksmith`), et une
variable ordinaire reste `{…}`. Les deux phrases qui contiennent le nom
(Mécaniques, Nouveautés) passent par un gabarit, pour que l'inventaire relève
la phrase entière.

Six textes renommés, déclarés dans `deplacements.json` avec leur nouvelle forme
(`devient`) ; le logo de la barre latérale, de `Sidebar.tsx` vers `Logo.tsx`.

**Nouveau test** `tests/marque.test.ts` : les quatre identifiants de format
figés en toutes lettres — les autres tests comparaient le format à sa
CONSTANTE, et n'auraient rien vu si quelqu'un l'avait renommée « pour finir le
rebranding » —, et `index.html` qui lit `%NOM_APP%` quatre fois, sans le nom
écrit en dur.

Attentes mises à jour (le nom affiché) : `accueil`, `ressources` (×2),
`telephone-accueil-rta`, `telephone-outils-ressources`, `telephone-siege`,
`siege-partage` (nom du fichier).

## 4. L'image de partage (décision 16)

Rendue par Playwright (`r2-images.mjs`) : fond Forge, surtitre « Summoners War
· Boîte à outils », logo horizontal de la charte (symbole et « SW Blacksmith »
en Cinzel 700), « RTA · Siège · Arène · Bestiaire », filet de braise en pied.
Même contenu que l'ancienne, sans les losanges d'élément violets. **Commitée à
part, après l'accord de Thomas.**

## 5. Vérifications

```text
npx tsc --noEmit                                        → 0
node tests/run.mjs rendu refonte partage ui             → 980 vérifications passées
node tests/run.mjs marque siege-partage refonte-inventaire → 68 passées
node scripts/inventaire-ui.mjs --verifier               → aucune perte
node scripts/chemins-interdits.mjs 6110609              → aucun modifié
npm run build ; dist/index.html                         → titre et balises « SW Blacksmith », 0 « %NOM_APP% »
```

⚠️ En cours de lot, la suite complète a été lancée une fois par erreur (sans
filtre) : 15 échecs, tous des renommages attendus, traités ci-dessus.

## 6. À regarder sur le serveur de dev

- barre latérale dépliée et repliée, dans les deux thèmes ;
- l'onglet du navigateur (favicon) ;
- le héros de l'accueil : « SW Blacksmith » est plus long que « SW Forge »,
  il peut passer sur deux lignes à la souris (le héros entier est le lot R5) ;
- au téléphone : le symbole dans la barre du haut.

## 7. Ce que je n'ai pas pu prouver

- Le **favicon** dans un vrai onglet : un onglet ne se capture pas en headless.
- L'**aperçu Discord** : il lit `og-image.png` sur le domaine déployé, donc
  après la fusion ; Discord le garde aussi en cache un moment.
- Le **héros de l'accueil** à toutes les largeurs : seule la barre latérale a
  été mesurée.
