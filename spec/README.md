# SW Forge — Spécifications

Boîte à outils Summoners War (React + TypeScript + Vite + Tailwind). Ce dossier
documente **le comportement attendu de chaque page** : ce que l'utilisateur voit,
ce qu'il peut faire, et les règles de calcul appliquées.

> Ces specs décrivent l'existant. Elles servent de référence pour faire évoluer
> l'outil sans casser les comportements établis.

## Carte des pages

| Page | Route | Statut | Spec |
|------|-------|--------|------|
| Accueil | `#/` | Live | [accueil.md](accueil.md) |
| RTA — Préparation | `#/rta` | Live | [rta/README.md](rta/README.md) |
| Siège (Défense / Offense / Recommandations) | `#/siege/defense`, `#/siege/offense`, `#/siege/recommandations` | Live | [siege/README.md](siege/README.md) |
| Arène | `#/arene` | À venir | [arene.md](arene.md) |
| Mon compte | `#/compte`, `#/compte/runes`, `#/compte/artefacts` | Live | [compte/README.md](compte/README.md) |
| Bestiaire | `#/bestiary` | Live | [bestiaire.md](bestiaire.md) |
| Mécaniques | `#/mecaniques` | Live | [mecaniques.md](mecaniques.md) |
| Nouveautés | `#/releases` | Live | [releases.md](releases.md) |

Ordre d'importance (nav & cartes d'accueil) : **Accueil → RTA → Siège → Arène → Mon compte**.
Bestiaire, Mécaniques et Nouveautés sont regroupés sous « Ressources » (les moins centraux de l'outil).

> ⚠️ **Règle permanente** : toute page ou section **ajoutée, renommée ou
> supprimée** doit être répercutée sur **l'accueil** ([accueil.md](accueil.md) —
> carte + ordre) **et** dans la nav de [App.tsx](src/App.tsx), **dans le même
> commit** que la fonctionnalité.

## Briques transverses

Concepts partagés par plusieurs pages, documentés une seule fois :

- [shared/calcul-vitesse.md](shared/calcul-vitesse.md) — le modèle de vitesse SW
  (base, runes, totem, lead, ticks). **Source de vérité** pour RTA et Siège.
- [shared/donnees-monstres.md](shared/donnees-monstres.md) — d'où viennent les
  monstres (SWARFARM), leur normalisation, le modèle `Monster`, et les monstres
  perso créés à la main.
- [shared/import-compte.md](shared/import-compte.md) — extraction depuis un export
  de compte SWEX : box RTA, équipes de siège, **et** box 6★ + inventaire
  runes/artéfacts (page « Mon compte »).

## Conventions communes (toutes les pages)

- **Persistance navigateur — un SEUL interrupteur pour toute l'app**
  ([usePersistence.ts](src/hooks/usePersistence.ts)). Prépa RTA, équipes de
  siège, recommandations, catégories, monstres perso **et** compte importé sont
  conservés **si et seulement si** l'utilisateur l'a accepté. Rien n'est envoyé à
  un serveur. Aucune authentification.
  - ⚠️ **Un seul régime de mémoire.** RTA et siège étaient persistés d'office
    pendant que le compte disparaissait au rechargement : on revenait avec ses
    équipes mais sans ses runes, sans explication. Deux régimes dans le même
    outil, c'est un bug de conception.
  - ⚠️ **Aucun hook n'appelle `localStorage.setItem` directement** : tout passe
    par `saveLocal`. C'est ce qui garantit qu'un refus vaut pour l'app entière, et
    qu'un futur état persistant n'ouvrira pas une fuite.
  - **Exception** : les clés de **réglage** (choix de conservation, mesure de
    score) restent écrites. Ce ne sont pas les données de l'utilisateur, et le
    refus lui-même doit être mémorisé pour ne pas reposer la question.
  - ⚠️ **Utilisateur déjà installé** : des données déjà présentes sur le disque
    valent **consentement**. Sans cette reprise, la mise à jour retirerait en
    silence une conservation dont il dispose depuis toujours.
- **Statistiques de fréquentation** : **Vercel Web Analytics**
  ([Analytics.tsx](src/components/Analytics.tsx)), sans cookie, limité aux pages
  visitées. ⚠️ Le routage étant **par hash**, un `beforeSend` réécrit l'URL pour
  que la route devienne le chemin — sinon toutes les visites seraient comptées
  sur « / ».
- **Versions & releases** — `main` reste **stable et déployée** ; on développe
  dans une branche **`release/x.y.z`**, qui porte l'incrément de `package.json`
  **et** l'entrée du journal ([releases.md](releases.md)). Processus détaillé
  dans le [README](README.md). ⚠️ **Un changement de calcul se note toujours**
  dans le journal : c'est ce qu'un joueur remarque en premier.
- **Footer** — trois informations, dans cet ordre :
  0. **Version** `vX.Y.Z` (depuis `package.json`), **cliquable** vers `#/releases`.
  1. **Signature** : lien vers le dépôt GitHub (`github.com/tototriou/sw-forge`)
     et **lien vers le serveur Discord** (`discord.gg/R2Fe4GJZET`) pour les
     questions et demandes. ⚠️ Un **lien vers le serveur**, pas un pseudo : un
     pseudo se recopie à la main et ne mène nulle part au clic.
  2. Rappel que les données restent locales.
  3. Crédit Com2uS / SWARFARM.
- **Données 100 % locales** : le footer rappelle que toutes les données restent
  en local. **« Tout supprimer »** efface les clés `localStorage` `sw-forge*` /
  `sky-arena*` (prépa RTA, équipes de siège, recommandations, catégories,
  monstres perso) puis recharge. Voir [App.tsx](src/App.tsx).
  - ⚠️ Cette action vit **dans le menu ⚙**, pas à côté du bouton d'import : une
    action destructrice collée au bouton le plus utilisé finit par être cliquée
    de travers. Dans un menu qu'on ouvre exprès, le geste est délibéré.
- **Import de compte** : le bouton de la nav est **masqué sur l'accueil**, où la
  zone de dépôt occupe déjà le centre de l'écran — deux points d'entrée pour le
  même geste sèment le doute sur celui qui « compte vraiment ».
- **Réglages globaux** — menu **⚙** [SettingsMenu.tsx](src/components/SettingsMenu.tsx),
  **tout à droite** de la barre de nav (après le bouton d'import). ⚠️ **Toujours
  visible** : barre repliée, il passe **à côté du hamburger** (variante `bar`,
  même gabarit 44 px pour former une paire) et **jamais dans le menu** — un
  réglage global doit rester à un geste, quelle que soit la largeur.
  - Règle : un réglage qui s'applique à **plusieurs pages** va ici, **jamais**
    dupliqué en sélecteur sur chaque page.
  - **Persistés** dans `localStorage` (effacés par « Supprimer mes données »),
    contrairement aux filtres et tris de page qui sont jetables.
  - **Structure pensée pour grossir** : un réglage = un `<Setting>` (intitulé à
    gauche, contrôle à droite), avec des contrôles génériques réutilisables
    (`<Segmented>` pour un choix unique, `<Switch>` pour un oui/non — un réglage
    binaire se lit d'un coup d'œil sur un interrupteur, sans lire les libellés).
    Ajouter un paramètre = ajouter un `<Setting>`, rien d'autre.
  - **Pas de légende** quand l'intitulé et les options se suffisent : le panneau
    reste une liste de lignes courtes. Le `hint` d'un `<Setting>` sert quand le
    réglage a une **conséquence non évidente** — « Garder mon compte » en a une
    (le compte reste sur la machine), il porte donc un `hint`.
  - Contenu actuel :
    - **Score** → `Efficience` / `Score SW` (voir [compte/runes.md](compte/runes.md)) ;
    - **Garder mon compte** → conservation de l'import entre deux sessions,
      **désactivée par défaut** (voir [shared/import-compte.md](shared/import-compte.md)) ;
    - **Date de l'export chargé**, sous le réglage — c'est là qu'on se pose la
      question de la fraîcheur des données ;
    - **Mes données** → « Tout supprimer ».
- **Import de compte global** : un seul bouton invariant « Importer mon compte »
  dans la barre de nav remplit RTA + siège défense + offense **+ « Mon compte »**
  (box 6★ et inventaire runes/artéfacts) d'un coup. Chaque import remplace le
  précédent. RTA/siège sont dans `localStorage` ; **« Mon compte » reste en
  mémoire par défaut** (ré-import à chaque session), sauf si l'utilisateur active
  **« Garder mon compte »** dans le menu ⚙ — le compte est alors conservé dans
  **IndexedDB**, pas dans `localStorage` (2,2 Mo pour un quota de 5 Mo partagé
  avec des données irremplaçables). Réglage **désactivé par défaut** : sur un
  ordinateur partagé, l'oubli au rechargement est une propriété. Les états sont
  remontés dans [App.tsx](src/App.tsx). Voir
  [shared/import-compte.md](shared/import-compte.md).
- **Pas de titre/intro sur les pages outils** : RTA, Siège, Arène et Bestiaire
  démarrent directement sur leur contenu (pas d'en-tête `<h1>` + paragraphe).
  L'Accueil garde son hero ; la page **Mécaniques** garde son titre (c'est une doc).
- **Éléments & couleurs** : Feu = rouge, Eau = bleu, Vent = jaune, Lumière =
  blanc, Ténèbres = violet. Icônes officielles servies en local depuis
  `public/elements/`. Voir [ElementIcon.tsx](src/components/ElementIcon.tsx).
- **Icônes d'inventaire** : les trois sous-onglets de « Mon compte » (Monstres,
  Runes, Artéfacts) portent les **icônes du jeu**, servies en local depuis
  `public/icons/` — voir [GameIcon.tsx](src/components/GameIcon.tsx). Le bouton
  de nav « Mon compte », lui, garde une icône de **profil** : il ouvre le compte
  entier, pas un inventaire en particulier.
- **Monstres perso** : sur RTA et Siège, l'utilisateur peut créer un monstre
  absent des données (nom, élément, SPD base, lead optionnel). Voir
  [shared/donnees-monstres.md](shared/donnees-monstres.md).
- **Champs numériques** — [NumberField.tsx](src/components/NumberField.tsx),
  **partout dans l'app**. ⚠️ **Jamais `type="number"`** : les flèches natives du
  navigateur sont deux triangles gris minuscules, hors charte, impossibles à
  styler et pénibles à viser (surtout au tactile). Le composant dessine ses
  propres boutons **− à gauche, + à droite**, autour d'un `type="text"` +
  `inputMode="numeric"` (qui fait remonter le pavé numérique sur mobile). La
  frappe non numérique est **ignorée** : plus prévisible qu'un champ qui se vide
  ou se corrige pendant qu'on tape.
- **Titre de page** : `font-display` en dégradé (`title-gradient`), taille
  `clamp(28px,4vw,42px)`, suivi d'un paragraphe d'intro `text-ink-dim`.
- **Responsive** : nav desktop en pilules ; menu hamburger sur mobile (`< sm`)
  **et dès que la barre ne tient plus sur une ligne** (voir « Shell applicatif »).
  Le drag & drop natif ne fonctionne pas au tactile → chaque zone drag propose
  un **sélecteur de repli** (déplacer une carte / changer une position).
- **Langue** : interface 100 % française.

## Shell applicatif

Le cadre commun (nav, routing par hash, footer) vit dans
[App.tsx](src/App.tsx) :

- Routing par `window.location.hash` (`routeFromHash()`), pas de router externe.
- Nav desktop (pilules) + nav repliée (hamburger qui se referme à la navigation),
  avec le bouton d'import global + lien « Supprimer mes données » à droite / dans le menu.
- **Repli de la barre du haut — mesuré, pas fixé à un breakpoint.** ⚠️ La barre
  ne doit **jamais passer à deux lignes** : si les onglets + import + réglages ne
  tiennent pas sur une ligne, on bascule sur le **hamburger**, à n'importe quelle
  largeur d'écran. Un seuil en dur serait périmé au prochain onglet ajouté — or
  on en ajoute à chaque section.
  - La nav est en **`flex-nowrap`** : c'est son débordement qui doit déclencher
    le repli, pas un retour à la ligne silencieux.
  - La rangée desktop **reste montée même repliée** (hauteur nulle) : c'est elle
    qui mesure la largeur disponible. La largeur nécessaire est **mémorisée**
    (`neededRef`) pendant qu'on est déplié — une fois replié, la nav n'est plus
    là pour être mesurée, et sans cette mémoire on ne saurait jamais redéployer.
  - Mesure en **`useLayoutEffect` + `ResizeObserver`** (sur la rangée *et* sur la
    nav, dont le contenu peut s'élargir sans que la rangée bouge : police chargée
    après coup). Décidé avant peinture → pas d'image de barre débordante.
- **Bestiaire**, **Mécaniques** et **Nouveautés** sont regroupés sous un menu **« Ressources »**
  (dropdown en desktop, section dans le menu mobile).
- **« Mon compte »** est lui aussi un **dropdown de nav** (mêmes mécaniques que
  Ressources) : sous-liens **Monstres / Runes / Artéfacts** → routes `#/compte`,
  `#/compte/runes`, `#/compte/artefacts`. Le bouton reste actif sur toute
  sous-section.
- Fusion `monstres officiels + monstres perso` (`allMonsters`) passée à RTA & Siège.
- États RTA & siège (défense/offense) **instanciés ici** puis passés en prop, pour
  qu'un import global les alimente tous. `importAccount(text)` orchestre les 3 ;
  `clearAllData()` efface tout.
- Footer : rappel « données 100 % locales » ; crédit Com2uS / source SWARFARM.
