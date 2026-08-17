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
| Mon compte | `#/compte`, `#/compte/runes`, `#/compte/artefacts` | Live | [compte/README.md](compte/README.md) |
| Outils | `#/outils/optimizer` | Live | [outils/README.md](outils/README.md) |
| Arène | `#/arene` | À venir | [arene.md](arene.md) |
| Bestiaire | `#/bestiary` | Live | [bestiaire.md](bestiaire.md) |
| Mécaniques | `#/mecaniques` | Live | [mecaniques.md](mecaniques.md) |
| Nouveautés | `#/releases` | Live | [releases.md](releases.md) |

Ordre d'importance (nav & cartes d'accueil) : **Accueil → RTA → Siège → Mon
compte → Outils → Arène**. Arène se positionne dans la barre entre le
dropdown Outils et le dropdown Ressources — pas dans le groupe des onglets
directs (Accueil/RTA/Siège), pour ne pas allonger cette rangée-là. Bestiaire,
Mécaniques et Nouveautés sont regroupés sous « Ressources » (les moins
centraux de l'outil).

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
- [compte/calcul-runes.md](compte/calcul-runes.md) §6 — anticipait déjà le
  moteur de recherche de builds (branch-and-bound, Web Worker) qu'utilise
  [outils/optimizer.md](outils/optimizer.md).
- [shared/recherche-clavier.md](shared/recherche-clavier.md) — la navigation au
  clavier des **barres de recherche à suggestions** (↑/↓, Entrée sur l'élément
  surligné, Échap). Implémentation unique dans
  [useComboboxNav.ts](src/hooks/useComboboxNav.ts), partagée par tous les champs
  de recherche.
- [shared/design.md](shared/design.md) — le **système visuel** : les deux thèmes
  (Forge sombre / Atelier clair), les tokens de couleur, l'échelle typographique,
  les règles de focus, de survol et de mouvement. **Source de vérité** pour toute
  décision d'apparence : une valeur qui n'y est pas n'a pas à être écrite en dur
  dans un composant.

## Conventions communes (toutes les pages)

- ⚠️ **Un texte saisi est TRIMÉ à la sortie du champ**, jamais à la frappe.
  Les espaces de tête et de queue ne veulent rien dire — mais « Defs G3 » et
  « Defs G3&nbsp;&nbsp;» se lisent pareil à l'écran tout en étant deux chaînes
  différentes partout ailleurs : dans un nom de fichier exporté, dans une
  comparaison, dans un tri.
  - ⚠️ **À `onBlur`, jamais à `onChange`** : trimer pendant la frappe empêche
    d'écrire une espace entre deux mots.
  - Les espaces et retours à la ligne **intérieurs sont conservés** : ils font
    partie de la mise en forme voulue par l'auteur (voir les consignes des
    recommandations, rendues en `whitespace-pre-line`).
  - Le trim est **rejoué à l'écriture et à la lecture** d'un fichier partagé
    (`texteSortant` / `cleanText` dans
    [recoShare.ts](src/lib/recoShare.ts)) : un fichier peut avoir été bricolé à
    la main, et la saisie d'une version antérieure a pu laisser passer des
    espaces.
  - ⚠️ **Un champ numérique s'écrit `type="text"` + `inputMode="numeric"`,
    jamais `type="number"`.** Outre les flèches natives inutilisables (voir
    [NumberField.tsx](src/components/NumberField.tsx)), un champ `number` garde
    le **texte tapé tel quel** : saisir « 015 » donne bien `15` dans l'état, mais
    la valeur ne changeant plus au caractère suivant, React ne réécrit pas le DOM
    et le **zéro de tête reste affiché**. En `text`, la valeur rendue est
    toujours celle de l'état, donc le zéro disparaît à la frappe.
  - ⚠️ Un champ à **brouillon** (saisie séparée de la valeur, comme
    [Pager.tsx](src/components/account/Pager.tsx)) doit **remettre le brouillon
    en forme lui-même** à la validation : un effet de resynchronisation ne se
    déclenche que si la valeur CHANGE, donc « 007 » sur la page 7 restait affiché
    tel quel.
  - Les champs de **recherche** ne sont pas trimés à la frappe non plus —
    l'espace y est un caractère de saisie comme un autre.

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
- **Vérifications automatiques** — `npm test`
  ([tests/README.md](tests/README.md)). Volontairement limitées aux endroits où
  une erreur serait **grave et invisible** : vitesse de combat, lecture d'un
  export, stockage du compte, conservation des données. ⚠️ **Pas de test
  d'interface** : elle se vérifie à l'œil, et des tests d'affichage se
  contenteraient de figer le rendu du jour.
- **Un type partagé entre l'écran et un script (recette exportable, etc.) a
  PLUSIEURS constructeurs — un champ ajouté doit être répercuté dans TOUS.**
  ⚠️ **Incident vécu** : `exhaustiveSearch`, ajouté à `OptimizerRecipe`
  ([optimizerRecipe.ts](src/lib/optimizerRecipe.ts)), a été branché dans
  `OptimizerSection.tsx` (l'écran) mais oublié dans
  `recipeToSearchParams.ts` (le seul autre constructeur, utilisé par
  `scripts/optimizer-search.ts`) — un script rejouant une recette exportée
  avec ce réglage activé se serait tu, sans jamais l'appliquer, sans la
  moindre erreur `tsc` (le champ manquant reste un type optionnel valide).
  Repéré seulement parce que l'utilisateur a posé la question, pas par une
  vérification systématique. **Avant de considérer un champ ajouté comme
  terminé** : chercher tous les fichiers qui construisent ou consomment ce
  type (`grep -rn NomDuType`), pas seulement celui qu'on vient d'éditer —
  un `tsc` propre ne le détecte jamais, puisque l'appel reste valide, juste
  incomplet.
- **Versions & releases** — `main` reste **stable et déployée** ; on développe
  dans une branche **`forge/<sujet>`**, qui porte l'entrée du journal
  ([releases.md](releases.md)) puis, à la fin, l'incrément de `package.json`.
  ⚠️ **Une branche porte un sujet, pas un numéro** : le numéro se décide à la
  fusion, quand on voit ce que la version contient — d'ici là l'entrée du
  journal a `version: null`. Processus détaillé dans
  [releases.md](releases.md#modèle-de-branches-et-processus-de-release).
  ⚠️ **Un changement de calcul se note toujours** dans le journal : c'est ce
  qu'un joueur remarque en premier.
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
  - ⚠️ `<Segmented>` a été **remonté** dans
    [Segmented.tsx](src/components/Segmented.tsx) à son deuxième usage (filtre de
    catégorie des artéfacts) plutôt que recopié. Il sert partout où des choix
    **s'excluent** : une rangée de pastilles séparées se lit comme des filtres
    cumulables, le cadre commun dit l'exclusivité sans un mot.
  - ⚠️ `<Switch>` a été **remonté** dans [Switch.tsx](src/components/Switch.tsx)
    à son deuxième usage (« Stats de base exclues » de l'Optimizer — voir
    [outils/optimizer.md](outils/optimizer.md)) plutôt que recopié, même
    principe que `<Segmented>` ci-dessus.
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
    - **Overcap Taux Crit/RES/Précision** → un interrupteur (`<Switch>`),
      **activé par défaut** (comportement historique non borné). Ces trois
      stats sont plafonnées à 100 % dans le jeu ; désactivé, le TOTAL affiché
      s'arrête à 100 % même si la somme brute des runes dépasse — un réglage
      d'AFFICHAGE seulement, `computeStats` continue de renvoyer le total brut
      (la recherche de l'Optimizer ne doit surtout pas exclure un build dont
      le total brut dépasse 100 %, voir [outils/optimizer.md](outils/optimizer.md)).
      Appliqué partout où un TOTAL de build est affiché (fiche de monstre en
      RTA/Siège/Optimizer, résultats de l'Optimizer) — **pas** aux exigences
      des recommandations de siège, qui restent un objectif à atteindre, pas
      un total déjà calculé ;
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
- **Fenêtres modales** — [Dialogs.tsx](src/components/Dialogs.tsx) :
  `ConfirmDialog` (confirmation) et `PromptDialog` (saisie).
  - ⚠️ **Aucun `confirm()` ni `prompt()` du navigateur.** La boîte native
    s'affiche hors de la page, sans sa typographie ni ses couleurs, colle le nom
    du site en titre, et rien n'y est habillable — au moment précis où il faut
    distinguer une action destructrice d'une action anodine. Sa variante
    `prompt` est pire encore, surtout au tactile.
  - ⚠️ **Le défaut ne perd jamais rien** : « Annuler » est le bouton mis en
    avant et reçoit le focus, Échap et le clic à côté annulent, et l'action
    destructrice porte la couleur d'alerte (`destructif`).
  - **Dire ce qui n'est PAS touché**, pas seulement ce qui part : « tes
    recommandations ne sont pas touchées » évite d'annuler par précaution une
    action qu'on voulait faire.
- **Avertissement petit écran** — [MobileNotice.tsx](src/components/MobileNotice.tsx),
  au-dessus du contenu, sous la barre de nav. SW Forge manipule des listes de
  runes, des équipes de trois monstres et des ordres de tour : tout cela demande
  de la largeur. Sans un mot, on croit à un site mal fait plutôt qu'à un site
  consulté dans de mauvaises conditions.
  - ⚠️ **Media query CSS (`md:hidden`), jamais de user-agent** : le sniffing se
    trompe (tablettes, mode bureau) et vieillit mal. Ce qui compte n'est pas
    l'appareil mais **la largeur disponible**.
  - ⚠️ **Refermable, oubli volontairement court** : la fermeture vit en mémoire,
    donc elle tient pour la session et le bandeau revient à la visite suivante.
    Le persister demanderait le consentement de conservation — mettre un bandeau
    d'information dans la même balance qu'une prépa RTA serait disproportionné.
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
  - ⚠️ **`min`/`max` ne sont appliqués qu'à la SORTIE du champ** (`onBlur`) et
    sur les boutons ± — jamais à chaque frappe. Border chaque frappe casse la
    saisie dès qu'un `min` positif dépasse un chiffre isolé : avec `min={15}`
    `max={100}`, taper « 5 » sautait à 15, puis « 0 » (lu comme « 150 »)
    sautait à 100 — impossible d'écrire 50. Repéré sur les conditions minimum
    de l'Optimizer (voir [outils/optimizer.md](outils/optimizer.md)), premier
    endroit de l'app à passer un `min` positif non trivial (tous les usages
    précédents étaient à 0 ou 1, jamais heurtés par ce piège).
- **Titre de page** : `font-display` en dégradé (`title-gradient`), taille
  `clamp(28px,4vw,42px)`, suivi d'un paragraphe d'intro `text-ink-dim`.
- **Responsive** : nav desktop en pilules ; menu hamburger sur mobile (`< sm`)
  **et dès que la barre ne tient plus sur une ligne** (voir « Shell applicatif »).
  Le drag & drop natif ne fonctionne pas au tactile → chaque zone drag propose
  un **sélecteur de repli** (déplacer une carte / changer une position).
  - ⚠️ **Chantier connu, assumé** : sur petit écran, les barres de filtres et les
    tables denses (inventaires, recommandations) tiennent mal. Une passe UI/UX
    dédiée au responsive est prévue ; d'ici là un
    [bandeau](src/components/MobileNotice.tsx) prévient que l'app est pensée pour
    un grand écran. Ne pas bricoler écran par écran en attendant — les rustines
    locales seraient à défaire.
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
