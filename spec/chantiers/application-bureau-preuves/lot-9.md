# Preuve — lot 9, le dossier SW Exporter

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lot 9,
décision 15. Mené le 2026-10-06 sur `forge/application-bureau`.

## Relevé

- Un vrai dossier SW Exporter (celui de Thomas, noms et dates seulement) :
  cinq exports `<invocateur>-<id>.json` à la racine (`tototriou-12889591.json`,
  `Killian26~-738882.json`, `✨Vincent✨-1321384.json`…, 4,7 à 7,7 Mo), et
  `live/` (des centaines de fichiers écrits pendant les parties), `plugins/`,
  `cert/`.
- L'import REMPLACE la prépa RTA (classement compris) et le siège (leads et
  ticks à zéro) — `spec/shared/import-compte.md` l. 37–39, 167, 232–236 :
  un import automatique complet effacerait le travail à chaque connexion.
  D'où le choix de Thomas : « Mon compte » seulement.

## Ce qui a été construit

- `bureau/swexPur.ts` (pur) : reconnaître un export, la liste du dossier,
  relire le réglage avec méfiance (un nom de fichier, jamais un chemin),
  décider de donner l'export (`aDonner`).
- `bureau/swex.ts` : réglage `swex.json` (dossier des données), boîte de
  choix du dossier, surveillance non récursive avec 1,5 s de calme, texte
  donné à la page ; « lu » seulement sur confirmation de la page ; état
  diffusé après chaque choix.
- `src/App.tsx` : `appliquerImport` découpé — `preparerCompte` /
  `appliquerCompte` (la moitié « Mon compte », partagée), `rafraichirCompte`
  (le dossier) ; `src/components/SuiviSwex.tsx` (prêt après le chargement
  des monstres et la relecture du compte conservé ; notification).
- Réglages, bloc « Application » : « Dossier SW Exporter » (Retirer,
  Choisir…) et « Invocateur » ; `presentationSwex` pure.
- **Carte du compte** (`SidebarCompte`, demande de Thomas pendant le lot) :
  avec un dossier, un menu — les invocateurs (suivi coché), « Importer un
  fichier… ». `Menu` gagne deux axes, `declencheur` et `cote`.
- `src/hooks/useEtatSwex.ts` : un état, deux accès.

## Preuve 1 — `npm run bureau:preuve -- --swex`

Fixtures : `Testeur-1.json`, `Autre-2.json` (tirés de `compte-miniature.json`)
et `live/`. Le dossier est « choisi » sans boîte de dialogue (mode preuve).

```text
ok  import manuel : prépa RTA et siège remplis
ok  deux invocateurs proposés, live/ ignoré
ok  carte du compte : menu des invocateurs, puis l'import
ok  invocateur choisi au menu : son compte, annoncé
ok  les Réglages suivent le même choix
ok  export réécrit : relu, annoncé
ok  rechargement : rien de réannoncé, compte gardé
ok  écriture dans live/ : ignorée
ok  prépa RTA et siège INCHANGÉS à chaque étape
ok  réglage retenu (dossier, invocateur, dernier lu)
ok  aucune erreur
```

« Prépa RTA et siège inchangés » : les trois clés `swblacksmith-rta-v1`,
`-siege-defense-v1`, `-siege-offense-v1` comparées à l'octet près, avant
et après chaque étape. Notifications relevées : « Compte de Autre mis à jour
depuis SW Exporter », puis « Compte de Autre-bis … ». Captures :
[lot-9-menu-compte.png](lot-9-menu-compte.png) (le menu ouvert),
[lot-9-reglages.png](lot-9-reglages.png) (le bloc).

Défauts trouvés en route, corrigés :
- la question « Garder mes données » attendue après un délai FIXE manquée
  une fois sur deux → la preuve attend le bouton (`cliquerQuandPret`),
  aussi dans la preuve de conservation ;
- la carte du compte restait sans menu après le choix du dossier dans les
  Réglages : le processus principal ne diffusait l'état qu'à la
  surveillance → diffusé après chaque choix ;
- le sélecteur d'invocateur s'étirait sur toute la ligne
  (`pleineLargeur={false}`).

## Preuve 2 — tests et non-régression

- `tests/bureau-swex.test.ts` (28) : les noms du vrai dossier (`~`, emojis,
  tiret dans le nom), ce qui n'est pas un export, le réglage abîmé ou qui
  porte un chemin, `aDonner`, ce que montre le bloc (homonymes, lu / en
  cours, dossier disparu).
- `testRenduUiMenu` : déclencheur fourni, pas de « ⋯ », entrée cochée.
- `node tests/run.mjs bureau rendubureautextes renduaccueil rendutelecharger
  renduapp renduparametres renduui refonteinventaire telephoneoutilsressources
  navigationadresses palette rendurta` → **592 passées** ; `tsc`, build.
- `npm run bureau:preuve` (lots 1 à 6) et `--conservation` (6/6) : inchangés
  après le découpage de l'import.

## Ce qui n'est pas prouvé

- **Le vrai dossier de Thomas** et un vrai export de SW Exporter pendant
  une connexion au jeu : à l'écran.
- La vraie boîte « choisir un dossier » de Windows (contournée en preuve).
- Un dossier débranché pendant que l'app tourne (`introuvable`).
- Un export à moitié écrit : le cas est traité (non marqué lu, redonné),
  jamais provoqué.
