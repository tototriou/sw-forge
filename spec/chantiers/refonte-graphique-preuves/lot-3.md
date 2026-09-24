# Preuve — lot 3 de la refonte graphique : bibliothèque `src/ui/`

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.3.
Décisions appliquées (A.2 bis) : 4 (bouton principal plein), 9 (pastille de
filtre active en couleur inversée).

> **Amendement (2026-09-24)** — le marqueur « couleur inversée » décrit
> ci-dessous (`border-ink bg-ink text-bg`) a été essayé puis **écarté par
> Thomas** (aplat blanc en thème sombre). Remplacé par la couleur de l'app
> teintée : `border-accent bg-accent/25 text-ink`. Contraste mesuré (fond
> translucide calculé sur la surface réelle) : texte 10.61 / 8.52 (Atelier,
> sur panneau / sur page), 9.73 / 10.49 (Forge) ; contour 9.66 / 7.52
> (Atelier), 5.43 / 5.81 (Forge). Même constante, mêmes importateurs.

## Tests écrits AVANT (commit `837efc0`)

`tests/rendu/ui.test.tsx` — 30 vérifications sur le code d'avant : nom
accessible, infobulle, désactivé avec sa raison, `aria-pressed`,
`aria-checked`, case cochée, option unique de `Segmented`, retrait de
`Jeton`, `Selecteur`. Aucune assertion modifiée depuis.

## Ce qui change

- `Bouton` / `BoutonGroupe` : `ton="accent"` + `fond="plein"` devient un
  aplat `bg-accent` + `text-accent-ink`. **Usage actuel de cette
  combinaison : 0** (`grep`, 5 `ton="accent"` tous en `doux`) — aucun écran
  ne change ; le bouton principal apparaîtra là où les lots de zone le
  poseront, un par écran.
- `Pastille` : marqueur actif = `MARQUEUR_FILTRE_ACTIF` (`border-ink bg-ink
  text-bg`), constante exportée. Importée par `SetFilter`, `SlotFilter`,
  `FilterBar` (étoiles du Bestiaire), pour que les filtres voisins portent
  le même marqueur (règle du marqueur unique de `design.md`).
- Non touchés, et pourquoi : `Segmented` (choix unique dans un cadre, pas
  un filtre en rangée — le filtre « Antiques » en est un) ; `SubSearchBar`
  (un champ de critère qui ouvre une fenêtre) ; l'étiquette « attribut /
  type » d'`ArtifactLinesEditor` (pas un état).

## Contraste — mesuré

```text
 12.93  Atelier : bg sur ink (texte de la pastille active)
 16.61  Atelier : ink sur panel
 12.93  Atelier : ink sur bg
 15.10  Forge : forge-bg sur forge-ink (texte de la pastille active)
 14.09  Forge : ink sur panel
 15.10  Forge : ink sur bg
```

Bouton plein : mesures du lot 2 (9.66 Atelier, 5.81 Forge).

## Vérifications

```text
$ npx tsc --noEmit                         → code 0
$ node tests/run.mjs rendu refonte         → 100 vérifications passées
$ node scripts/chemins-interdits.mjs 6110609 → aucun modifié
$ npm run build                            → built ; .bg-accent, .bg-ink,
                                             .text-accent-ink, .text-bg émis
Comptes d'appels (grep '<Nom\b'), avant = après :
Bouton:73 BoutonIcone:46 NumberField:42 ZoneCliquable:26 Segmented:23
Selecteur:19 Champ:16 Interrupteur:16 Jeton:15 Flottant:12 FlottantAuto:11
MobileSheet:11 Pastille:7 Case:6
```

## À regarder sur le serveur de dev (non testable)

- **Icônes de set dans `SetFilter`**, surtout en thème sombre : elles sont
  teintées par `runeSetIconFilter` pour un fond de panneau, et reposent
  maintenant, une fois actives, sur l'aplat d'encre presque blanc. Tous les
  sets étant actifs par défaut (liste blanche), c'est la rangée entière qui
  change d'aspect.
- Les pastilles de Ma box (Nat, Doublons, 2A), les numéros d'emplacement et
  les étoiles du Bestiaire, actifs, dans les deux thèmes.
