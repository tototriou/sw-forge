# Preuve — lots 7 et 8 (première partie) : données, textes, conservation, documentation

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lots 7 et 8.
Mené le 2026-10-06. ⚠️ **La clôture n'est pas faite** (Thomas : « j'aurai
d'autres travaux à proposer avant de conclure et fusionner ») : ni `npm
test` complet, ni fusion dans `release/v2.0.0`, ni cadrage « terminé ».

## Lot 7 — les données du jeu

`spec/shared/donnees-monstres.md` § « Chargement côté app » : dans l'app,
les données sont celles de l'installeur (décision 1), servies par
`app://swblacksmith/` ; une actualisation SWARFARM atteint le site à sa
fusion, l'app à la version suivante.

## Les textes qui parlent du navigateur (propositions acceptées par Thomas)

`selonSupport(site, app)` (`src/lib/bureau.ts`) : le site garde son texte,
l'app affiche la variante.

| | Où | Dans l'app |
|-|----|-----------|
| A | Pied de page (`App.tsx`) | Toutes tes données restent en local, sur ta machine. |
| B | Garder mes données (`SettingsMenu.tsx`) | …en fermant l'application — … Tout reste sur cette machine… |
| C, D | Question du premier import (`ui/Dialogs.tsx`) | …à la prochaine ouverture de l'application… / …en fermant l'application. |
| E, F | Accueil, promesse et étape 02 | …sur ta machine. |
| G | Thème « Auto » (`useTheme.ts`, accesseur) | Suit le thème de ton système |
| H | Importer une prépa (`RtaBackupBar.tsx`, deux infobulles) | …ou celle d'un autre appareil. |

- `tests/rendu/bureau-textes.test.tsx` (12) : sur le site, A à G inchangés ;
  avec le pont simulé, les variantes, et plus un mot de « navigateur » sur
  l'accueil ni de « navigateur »/« onglet » dans les Réglages.
- **Garde d'inventaire de la refonte** : premier passage, 6 textes du site
  « perdus » — passés dans `selonSupport(…)`, que l'extracteur ne lisait
  pas. `scripts/inventaire-ui.mjs` traite désormais l'appel comme une
  branche (comme un ternaire) : les deux textes sont relevés. Fixture et
  assertion ajoutées (`texte:Sur le site`, `texte:Dans l'app`).

## Notes de la 2.0.0 (`src/data/releases.ts`)

Titre « SW Forge devient SW Blacksmith, et s'installe sur ton ordinateur » ;
point fort « SW Blacksmith existe en application pour Windows et Linux » ;
trois lignes « Application ». ⚠️ Écart : la règle est **1 à 3 points
forts** (`releases.ts` l. 30, `spec/releases.md` l. 32) — le point
« Siège » a cédé sa place (il reste dans les changements).

## La conservation des données (demande de Thomas)

`npm run bureau:preuve -- --conservation` : deux lancements sur un dossier
de données neuf. `ecrire` dépose `tests/fixtures/compte-miniature.json`
dans le champ fichier de l'accueil, répond « Garder mes données
(recommandé) », l'app se ferme (fermeture ordinaire) ; `relire` relance.

```text
ecrit : compteAffiche true, conservation "1",
  cles : custom-monsters (2), optimizer-lists (60), persist (1), rta (1844),
         siege-defense (2164), siege-offense (1165), siege-recos (12)
  bases : ["swblacksmith"]
relu : identique
ok  import puis « Garder »
ok  compte affiché après import
ok  compte affiché après réouverture
ok  conservation activée, et retenue
ok  mêmes clés de stockage, même taille
ok  mêmes bases IndexedDB
```

## Documentation

- `spec/shared/application-bureau.md` (état actuel) et sa ligne dans
  `spec/README.md` ; `ARCHITECTURE.md` (lien, `--conservation`) ;
  `CLAUDE.md` § Vérifier (`bureau:preuve` puis `bureau:local` après un
  changement du bureau).

## Vérifications

- `node tests/run.mjs rendubureautextes renduaccueil rendutelecharger
  renduapp renduparametres releases nouveautes bureau refonteinventaire
  telephoneaccueil telephoneoutilsressources navigationadresses palette
  rendurta` → **568 passées** ; `tsc`, `npm run build` sans erreur.
- `npm run bureau:preuve` : tous les contrôles des lots 1 à 6 passent.

## Ce qui n'est pas prouvé

- **Refuser « Garder mes données »** puis rouvrir : rien ne devrait
  rester — pas lancé (mutation prévue après commit).
- La conservation dans l'app **installée** (`--exe`) : lancée sur le build
  seulement.
- Les variantes de texte **à l'écran dans l'app** : prouvées par le rendu
  avec le pont simulé, pas regardées.
