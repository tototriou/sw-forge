# Système visuel — thèmes, tokens, échelles

> ⚠️ **Ce document décrit le système visuel COMMUN aux deux formats** (couleurs,
> échelle typographique, animations). La façon dont chaque écran l'emploie, elle,
> diffère entre mobile et bureau — voir
> [deux-formats.md](../deux-formats.md), qui prime en cas de doute.

> **Source de vérité** pour toute décision d'apparence. Une valeur qui n'est pas
> ici n'a pas à être écrite en dur dans un composant.

Ce document est né d'un constat : il n'existait aucune spec de design, et
l'interface le montrait — **248 couleurs en dur** dans le TSX, **21 tailles de
texte** de 9 px à 76 px, **aucune règle de focus**. Chaque composant réarbitrait
au pixel ce qu'aucun document ne fixait.

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `data-theme`, Forge ou Atelier | [themes.md](themes.md) |
| une variable de couleur de `src/index.css`, les `colors` de `tailwind.config.js`, la sélection, une couleur d'élément | [tokens-couleurs.md](tokens-couleurs.md) |
| `fontSize`, `fontFamily`, `borderRadius` de `tailwind.config.js`, le titre d'une page | [typographie-et-rayons.md](typographie-et-rayons.md) |
| une transition ou une animation, ce qui s'ouvre au clic, un bouton désactivé, une confirmation | [mouvement-et-gestes.md](mouvement-et-gestes.md) |
| `src/ui/Notification.tsx`, un flottant, un `z-index`, le défilement, iOS | [flottants-et-defilement.md](flottants-et-defilement.md) |
| une valeur de couleur nouvelle ou changée (ratio de contraste), `RARITY_META` | [contraste.md](contraste.md) |
| le focus, le survol, la pression, la croix ou les bandes d'une modale, une cible tactile, l'icône d'export ou d'import | [regles-transverses.md](regles-transverses.md) |
| le réglage du thème dans `src/components/SettingsMenu.tsx` | [reglage-du-theme.md](reglage-du-theme.md) |

## Parties

| Document | Contenu |
| --- | --- |
| [themes.md](themes.md) | Deux thèmes, jamais trois (Forge sombre / Atelier clair), suivis du navigateur ou forcés, et pourquoi deux directions nommées plutôt qu'une palette inversée. |
| [tokens-couleurs.md](tokens-couleurs.md) | Les tokens de couleur : surfaces et encre, accent et sémantique, rayon intérieur, un seul marqueur de sélection, couleurs d'élément. |
| [typographie-et-rayons.md](typographie-et-rayons.md) | Les trois familles de polices, le libellé en capitales, l'échelle typographique (plancher à 11 px), les deux gabarits du titre de page, les rayons. |
| [mouvement-et-gestes.md](mouvement-et-gestes.md) | Le mouvement (courbes, durées), un clic ne déplace jamais ce qu'on vient de cliquer, un bouton se désactive au lieu de disparaître, ce qui se confirme et ce qui ne se confirme pas. |
| [flottants-et-defilement.md](flottants-et-defilement.md) | La notification « Annuler », le défilement bloqué derrière un flottant, l'échelle des plans (`z-index`), un flottant qui ne sort jamais de l'écran, pas de défilement latéral, le zoom et les pièges d'iOS. |
| [contraste.md](contraste.md) | Le contraste mesuré au ratio WCAG, la saturation, les trois surfaces distinctes deux à deux, les deux couleurs des raretés, une seule source par thème. |
| [regles-transverses.md](regles-transverses.md) | Les règles transverses : tokens en triplets, aucune couleur Tailwind native, `autoFocus`, croix de fermeture, bandes d'une modale, cibles tactiles de 40 px, focus, survol, pression, rien qui dépende du survol, flèches d'export et d'import. |
| [reglage-du-theme.md](reglage-du-theme.md) | Le réglage du thème dans le menu ⚙ (`Auto` / Forge / Atelier). |

## Ce que ce document ne couvre pas

- **Le responsive.** Chantier séparé et assumé (voir
  [conventions](../../conventions.md#conventions-communes) (« Conventions communes »)). Les tokens ci-dessus
  sont indépendants de la largeur.
- **Les icônes du jeu** (`public/elements/`, `public/icons/`,
  `public/leader-skills/`) : ce sont des ressources Com2uS, hors système visuel.
- **Les couleurs de rareté de rune** (`RARITY_META` dans
  [effects.ts](../../../../src/lib/effects.ts)) : vocabulaire du jeu, comme les
  éléments. Elles suivront la même logique deux-valeurs si un besoin apparaît.
