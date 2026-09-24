# Preuve — lot 2 de la refonte graphique : tokens

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.2.
Décisions appliquées (A.2 bis) : 2 (arrondis) ; préparation de 4 (bouton
principal plein : token de texte sur aplat d'accent). Polices et couleurs de
la palette **inchangées** (décision 1 ; la palette ne faisait pas partie des
décisions).

## Ce qui change

| Token | Avant | Après |
|---|---|---|
| `radius` (`rounded`) | 5 px Atelier / 4 px Forge | 6 px, les deux thèmes |
| `radius-lg` (`rounded-lg`) | 7 px / 6 px | 8 px |
| `radius-xl` (`rounded-xl`) | 12 px figé Tailwind, hors tokens | 12 px, token |
| `radius-2xl` (`rounded-2xl`) | 16 px figé Tailwind, hors tokens | 14 px, token |
| `accent-ink` | — | `255 255 255` Atelier, `18 19 28` Forge |

Mêmes **noms** de classes : aucun `.tsx` touché. Usages mesurés
(`grep -rhoE` sur `src/`) : 103 `rounded-lg`, 56 `rounded`, 52 `rounded-xl`,
17 `rounded-2xl` (+ 2 `rounded-t-2xl`, 1 `rounded-b-2xl`), 3 `rounded-*-lg-inner`.
Placer le bon cran sur chaque composant (une carte encore en `rounded-lg`)
revient aux lots 3 et suivants.

## Contraste — mesuré (WCAG 2.x)

```text
  9.66  Atelier : blanc sur accent
  9.66  Atelier : accent sur panel (contour du bouton)
  7.52  Atelier : accent sur bg
  5.81  Forge : forge-bg sur accent
  3.18  Forge : blanc sur accent (écarté ?)
  5.43  Forge : accent sur panel
  5.81  Forge : accent sur bg
```

Seuils : 4.5 pour le texte, 3.0 pour un élément d'interface. D'où
`accent-ink` = blanc en Atelier, fond sombre en Forge (le blanc y échoue à
3.18).

## Vérifications

```text
$ npx tsc --noEmit                       → code 0
$ npm run build                          → built in 13.98s
CSS émis (dist/assets/*.css) :
  --radius: 6px / --radius-lg: 8px / --radius-xl: 12px / --radius-2xl: 14px
  (une déclaration chacune : plus de surcharge Forge)
  border-radius:var(--radius-xl), var(--radius-2xl) — les classes redéfinies sont émises
  --accent-ink: 255 255 255 ; --accent-ink: var(--forge-accent-ink) ×2
$ node scripts/chemins-interdits.mjs 6110609 → aucun modifié
$ node scripts/spec-lint.mjs             → aucune erreur
$ node tests/run.mjs refonte rendu       → 71 vérifications passées
```

## À regarder sur le serveur de dev (non testable)

Les arrondis sont une pure apparence : aucun test ne les voit, c'est voulu.
Rien d'autre ne change à l'écran que la courbure des coins, identique dans
les deux thèmes.
