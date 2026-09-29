# Preuve — lot R2 bis du rebranding : le logo de la nouvelle identité

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R2 bis ;
décisions 24 à 26 (A.8). Scripts du scratchpad : `r2bis-planche.mjs`,
`r2bis-mesure-nom.mjs`, `r2bis-images.mjs`, `r2bis-verif.mjs`, 2026-09-29.

## 1. L'intrant

Une image envoyée par Thomas pendant le R3a : l'enclume blanche surmontée d'un
cristal de braise à deux facettes et de deux éclats, le nom en linéale large
et capitales espacées, la devise « Analyse · Optimise · Progresse », des
variantes sombre, claire et monochrome, favicon 512 et 32. Elle n'existe qu'en
RENDU : pas de tracés à reprendre.

## 2. Le symbole, redessiné (décision 25)

Tracés SVG sur une grille de 120, relevés sur l'image : plateau épais aux deux
pointes (il rejoint le cou vers y = 77), cou court, pied large ; cristal en
losange étiré à deux facettes ; deux éclats en pointe vers l'extérieur.
Premier jet trop fin (plateau en lame), corrigé avant de le montrer.

Planche montrée à Thomas AVANT la pose :
[lot-R2bis-planche.png](lot-R2bis-planche.png) — le symbole en Forge et en
Atelier, en icône, en 32 et 16 px, et le nom dans six linéales. Réponses :
**« Oui, pose-le »** ; police du nom **Saira 700**.

## 3. La pose

- `src/components/Logo.tsx` : `SymboleLogo` (nouveaux tracés, `TRACES_LOGO`),
  `Logo`, `CLASSE_NOM` (`font-marque font-bold uppercase tracking-widest`).
  Couleurs en jetons : enclume et éclats `ink` (blanc en Forge, noir en
  Atelier — les variantes sombre et claire de l'identité), cristal sur deux
  jetons nouveaux, `logo-cristal` / `logo-cristal-clair` (Forge : #FF7A1A /
  #FF9A4D ; Atelier : #E0620A / #FF7A1A). Aucun jeton existant ne donnait
  cette paire dans les deux thèmes. Le marteau et le laiton de la toile
  disparaissent du logo.
- **Nom en Saira** (`tailwind.config.js` : `font-marque` ; `index.html` :
  Saira 700). Seulement le nom : les titres restent en Cinzel (décision 24).
- **Barre latérale** : `text-sm` — mesuré en Saira, capitales espacées,
  « SW BLACKSMITH » fait 122,7 px en 13 px, 132,2 en 14 px, pour ~130
  disponibles.
- **Héros de l'accueil** : le nom en Saira, encre pleine (plus le dégradé de
  Cinzel), `clamp(32px, 5vw, 56px)` — « BLACKSMITH » seul faisait 291 px à
  40 px et débordait d'un téléphone de 360 px.
- `public/favicon.svg` : le symbole complet, cadré au plus près sur fond
  Fer. À 16 px (aperçu agrandi, `r2bis-favicon-apercu.png`), l'enclume et le
  cristal restent lisibles ; les éclats se devinent. À 32 px, tout se lit.
- `public/favicon.png` (icône d'app 512) et `public/og-image.png` : rendus
  par Playwright. L'image de partage : surtitre « Summoners War · Boîte à
  outils », symbole, nom en Saira, **devise** (décision 26) avec des points de
  braise — elle remplace « RTA · Siège · Arène · Bestiaire ».

**Écartés** (décision 24) : le fond #0E1116, l'accent #FF7A32 et le blanc
#E8E6E3 de l'image — la palette de l'app reste celle de la toile.

## 4. Vérifications

```text
npx tsc --noEmit                              → 0
node tests/run.mjs rendu refonte marque ui    → 858 vérifications passées
node scripts/inventaire-ui.mjs --verifier     → aucune perte
node scripts/chemins-interdits.mjs 6110609    → aucun modifié
npm run build                                 → .font-marque{font-family:Saira,sans-serif}, --logo-cristal émis
```

Sur l'app construite (`vite preview`, `r2bis-verif.mjs`) :

```text
dark 1440 px : héros 2 ligne(s), tient ; page sans défilement latéral ; barre : 123 px pour 123 px (Saira, sans-serif)
dark 390 px : héros 1 ligne(s), tient ; page sans défilement latéral
dark 360 px : héros 2 ligne(s), tient ; page sans défilement latéral
light 1440 px : héros 2 ligne(s), tient ; page sans défilement latéral ; barre : 123 px pour 123 px (Saira, sans-serif)
light 390 px : héros 1 ligne(s), tient ; page sans défilement latéral
light 360 px : héros 2 ligne(s), tient ; page sans défilement latéral
```

## 5. Ce que je n'ai pas pu prouver

- La **fidélité du dessin** au-delà de l'œil : les tracés sont relevés sur un
  rendu, pas repris d'une source.
- Le favicon dans un **vrai onglet**, et l'aperçu Discord (après déploiement).
- Le héros à la souris passe sur **deux lignes** (« SW » / « BLACKSMITH ») :
  il tient, mais sa composition est le lot R5.
