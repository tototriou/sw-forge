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

Ordre d'importance (nav & cartes d'accueil) : **Accueil → RTA → Siège → Arène → Mon compte**.
Bestiaire et Mécaniques sont regroupés sous « Ressources » (les moins centraux de l'outil).

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

- **Persistance navigateur** : chaque page à état (RTA, Siège) sauvegarde tout
  dans `localStorage`. Rien n'est envoyé à un serveur. Aucune authentification.
- **Données 100 % locales** : le footer rappelle que toutes les données restent
  en local. Un lien **« Supprimer mes données »** (dans la barre de nav, à côté de
  l'import) efface les clés `localStorage` `sw-forge*` / `sky-arena*` (prépa RTA,
  équipes de siège, monstres perso) puis recharge. Voir [App.tsx](src/App.tsx).
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
    (`<Segmented>` pour un choix unique). Ajouter un paramètre = ajouter un
    `<Setting>`, rien d'autre.
  - **Pas de légende** quand l'intitulé et les options se suffisent : le panneau
    reste une liste de lignes courtes. Le `hint` d'un `<Setting>` est facultatif,
    réservé à un futur réglage réellement ambigu.
  - Contenu actuel : **Score** → `Efficience` / `Score SW` (voir
    [compte/runes.md](compte/runes.md)).
- **Import de compte global** : un seul bouton invariant « Importer mon compte »
  dans la barre de nav remplit RTA + siège défense + offense **+ « Mon compte »**
  (box 6★ et inventaire runes/artéfacts) d'un coup. Chaque import remplace le
  précédent ; rien n'est persisté sur le disque. RTA/siège sont dans
  `localStorage` ; **« Mon compte » reste en mémoire** (ré-import à chaque
  session). Les états sont remontés dans [App.tsx](src/App.tsx). Voir
  [shared/import-compte.md](shared/import-compte.md).
- **Pas de titre/intro sur les pages outils** : RTA, Siège, Arène et Bestiaire
  démarrent directement sur leur contenu (pas d'en-tête `<h1>` + paragraphe).
  L'Accueil garde son hero ; la page **Mécaniques** garde son titre (c'est une doc).
- **Éléments & couleurs** : Feu = rouge, Eau = bleu, Vent = jaune, Lumière =
  blanc, Ténèbres = violet. Icônes officielles servies en local depuis
  `public/elements/`. Voir [ElementIcon.tsx](src/components/ElementIcon.tsx).
- **Monstres perso** : sur RTA et Siège, l'utilisateur peut créer un monstre
  absent des données (nom, élément, SPD base, lead optionnel). Voir
  [shared/donnees-monstres.md](shared/donnees-monstres.md).
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
- **Bestiaire** et **Mécaniques** sont regroupés sous un menu **« Ressources »**
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
