# Preuve — lot 1 bis, l'habillage de la fenêtre

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lot 1 bis,
décision 7. Mené le 2026-10-05 sur `forge/application-bureau`, depuis
`23da11c3`, sous Windows 11, Electron 44.5.1.

## Ce qui a été construit

- **Barre de titre intégrée** : `titleBarStyle: 'hidden'` +
  `titleBarOverlay` (47 px) ; la barre du haut et la rangée du logo sont la
  zone de déplacement (`index.css`, sous `html[data-bureau]` seulement),
  leurs contrôles restent cliquables ; marge droite = largeur des boutons de
  Windows (`env(titlebar-area-*)`).
- **Couleurs du thème** : lues dans les jetons calculés de la page
  (`--bg`, `--bar`, `--ink`) et envoyées au processus principal au
  chargement et à chaque changement de thème (`src/lib/bureau.ts`,
  `habillerBureau`) ; avant le chargement, celles du dernier thème vu, sinon
  celles du thème du système, LUES dans `src/index.css` à la compilation
  (`__COULEURS_THEMES__`) — aucune couleur recopiée.
- **État mémorisé** (`bureau/fenetre.ts`, pur) : taille, position, agrandie,
  couleurs ; relu avec méfiance (hors écran → recentrée, sous le minimum →
  relevée).
- **Pas de menu** (`Menu.setApplicationMenu(null)`), largeur minimale
  1024 px (jamais le format téléphone).
- Le mode preuve a ses propres données (`<dossier>/donnees`) : il ne touche
  plus celles de l'utilisateur.

## Preuve 1 — l'app se contrôle elle-même

```
npx vite build && node scripts/construire-bureau.mjs && node scripts/bureau-preuve.mjs
```

| Contrôle | Lu |
|----------|----|
| `html[data-bureau]` posé | `win32` |
| Barre du haut = zone de déplacement | `drag` |
| Son bouton reste cliquable | `no-drag` |
| Marge réservée aux boutons de Windows | `137px` |
| Premier lancement | 1440 × 900, centrée, non agrandie |
| Menu | aucun |
| Lot 1 rejoué (origine, stockage, Node absent, données, hors build 404, worker, Bestiaire) | inchangé |

Captures de la **fenêtre entière**, cadre compris (`desktopCapturer`) :
[lot-1bis-forge.png](lot-1bis-forge.png), [lot-1bis-atelier.png](lot-1bis-atelier.png).

## Preuve 2 — tests

- `node tests/run.mjs bureau` → **38 passées** (dont 19 de `bureau-fenetre` :
  premier lancement, fichier corrompu, second écran débranché, hors écran,
  sous le minimum, couleurs douteuses, `tripletVersHex`, `estBureau()` faux
  sur le site).
- Le site inchangé : `node tests/run.mjs rendu refonteinventaire` → **977
  passées** (les 70 tests de rendu et l'inventaire).
- `app-region` émis dans le CSS construit (`grep -c` → 1 fichier).

## Écarts, et ce qui n'est pas prouvé

- **47 px, pas 48** : à 48, la zone des boutons recouvrait le filet du bas de
  la barre, qui s'interrompait sous eux (vu sur la première capture).
- **Un lancement s'est ouvert agrandi** (1936 × 1048, à -8,-8) au premier
  essai ; non reproduit sur les suivants (1440 × 900, état relevé au
  chargement, après attente et à la fin). Cause non établie.
- **Non prouvé automatiquement**, à vérifier à l'écran : déplacer la fenêtre
  par la barre, double-clic pour agrandir, changer de thème dans ⚙ (les
  boutons suivent), fermer puis rouvrir (taille et position reprises).
