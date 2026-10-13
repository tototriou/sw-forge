# Conventions communes

Les règles qui valent pour toutes les pages : la règle de cadre et les conventions communes. La
carte des pages et leur ordre sont dans [02-app/](../02-app/README.md) ; les fonctionnalités
partagées, dont la navigation et le pied de page, dans
[02-app/transverse/](../02-app/transverse/README.md) ; l'interface dans
[interface/](interface/README.md).

## Règle de cadre

> ⚠️ **Une application responsive, mais DEUX plateformes de premier rang** :
> téléphone et ordinateur, dont aucune n'est le cas dégradé de l'autre. On ne
> dessine pas pour le bureau avant de rétrécir. **Une correction destinée à un
> format ne touche pas l'autre.** Cette règle prime sur tout arbitrage
> d'interface : lire [interface/](interface/)
> **avant** de modifier un écran.

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
    [NumberField.tsx](src/ui/NumberField.tsx)), un champ `number` garde
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
  - ⚠️ **Toute nouvelle clé prend le préfixe `swblacksmith-`** ; un test refuse
    un littéral de l'ancien nom (`sw-forge-…`, `sky-arena-…`) hors du module de
    migration. La migration des clés et « Tout supprimer » :
    [persistance.md](../02-app/transverse/feat-import-compte/persistance.md).
- **Aucune statistique de fréquentation.** La mesure d'audience Vercel Web
  Analytics a été **retirée, du site comme de l'application de bureau** :
  rien ne quitte le navigateur, ce que dit le « 100 % local ». ⚠️ Ne pas la réintroduire sans
  décision : elle n'aurait de toute façon aucun sens dans l'app de bureau.
- **Un type partagé entre l'écran et un script (recette exportable, etc.) a
  PLUSIEURS constructeurs — un champ ajouté doit être répercuté dans TOUS.**
  ⚠️ **Écueil** : un champ optionnel ajouté à `OptimizerRecipe`
  ([optimizerRecipe.ts](src/lib/optimizerRecipe.ts)), branché dans
  `OptimizerSection.tsx` (l'écran) mais oublié dans
  `scripts/lib/recipeToSearchParams.ts` (utilisé par
  `scripts/optimizer-search.ts`), fait taire le réglage pour tout script
  qui rejoue une recette exportée, sans la moindre erreur `tsc` (le champ
  manquant reste un type optionnel valide). **Avant de considérer un champ
  ajouté comme terminé** : chercher tous les fichiers qui construisent ou
  consomment ce type (`grep -rn NomDuType`), pas seulement celui qu'on
  vient d'éditer ; un `tsc` propre ne le détecte jamais, puisque l'appel
  reste valide, juste incomplet. Les constructeurs connus : skill
  `optimizer-field-propagation`.
- **Fenêtres modales** — [Dialogs.tsx](src/ui/Dialogs.tsx) :
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
  au-dessus du contenu, sous la barre de nav. SW Blacksmith manipule des listes de
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
  Runes, Artéfacts) portent des **icônes au trait** dans le style de la librairie
  (lucide) — les silhouettes du jeu (tête de monstre, hexagone de rune, médaillon
  d'artéfact) redessinées au contour monochrome (`currentColor`), pour ne pas
  jurer à côté des icônes de la nav. Voir
  [InventaireIcon.tsx](src/components/InventaireIcon.tsx). Le bouton de nav « Mon
  compte », lui, garde une icône de **profil** : il ouvre le compte entier, pas
  un inventaire en particulier.
- **Monstres perso** : sur RTA et Siège, l'utilisateur peut créer un monstre
  absent des données (nom, élément, SPD base, lead optionnel). Voir
  [02-app/transverse/](../02-app/transverse/).
- **Champs numériques** — [NumberField.tsx](src/ui/NumberField.tsx),
  **partout dans l'app**. ⚠️ **Jamais `type="number"`** : les flèches natives du
  navigateur sont deux triangles gris minuscules, hors charte, impossibles à
  styler et pénibles à viser (surtout au tactile). Le composant dessine ses
  propres boutons **− à gauche, + à droite**, autour d'un `type="text"` +
  `inputMode="numeric"` (qui fait remonter le pavé numérique sur mobile). La
  frappe non numérique est **ignorée** : plus prévisible qu'un champ qui se vide
  ou se corrige pendant qu'on tape.
  - ⚠️ **Un appui PROLONGÉ sur − ou + fait défiler la valeur en continu**, et la
    cadence **accélère**. Ces champs portent des valeurs qui varient sur des
    dizaines d'unités (une vitesse de 180 à 240, un minimum de crit de 15 à 85) :
    un pas par clic imposait soixante clics, ou de repasser par le clavier alors
    qu'on avait déjà le doigt sur le bouton. À cadence fixe, il fallait choisir
    entre trop lent pour traverser 60 unités et si vif qu'on dépassait toujours
    sa cible.
    - Le défilement démarre après **400 ms** — assez pour qu'un clic ordinaire,
      même mou, n'en déclenche jamais un et ne fasse pas sauter la valeur de deux.
    - Il **s'arrête à la butée** (`min`/`max`), au relâchement **même hors du
      bouton** (on glisse souvent le doigt à côté), et si l'on quitte l'onglet.
  - ⚠️ **`min`/`max` ne sont appliqués qu'à la SORTIE du champ** (`onBlur`) et
    sur les boutons ± — jamais à chaque frappe. Border chaque frappe casse la
    saisie dès qu'un `min` positif dépasse un chiffre isolé : avec `min={15}`
    `max={100}`, taper « 5 » sautait à 15, puis « 0 » (lu comme « 150 »)
    sautait à 100 — impossible d'écrire 50. Repéré sur les conditions minimum
    de l'Optimizer (voir [02-app/optimizer/](../02-app/optimizer/)), premier
    endroit de l'app à passer un `min` positif non trivial (tous les usages
    précédents étaient à 0 ou 1, jamais heurtés par ce piège).
- **Titre de page** : `font-display` à l'**encre unie** (`text-ink`). Les
  pages de lecture (Mécaniques, Nouveautés) gardent le grand titre
  (`clamp(28px,4vw,42px)`, suivi d'un paragraphe d'intro `text-ink-dim`) ; les
  écrans d'outil (Siège, RTA, Bestiaire…) un titre `text-xl` dans leur ligne
  d'en-tête. Le dégradé encre → braise (`title-gradient`) a été retiré au
  rebranding (décision 57), comme la toile.
- **Responsive** : nav desktop en pilules ; menu hamburger sur mobile (`< sm`)
  **et dès que la barre ne tient plus sur une ligne**.
  Le drag & drop natif ne fonctionne pas au tactile → chaque zone drag propose
  un **sélecteur de repli** (déplacer une carte / changer une position).
  - ⚠️ **Chantier connu, assumé** : sur petit écran, les barres de filtres et les
    tables denses (inventaires, recommandations) tiennent mal. Une passe UI/UX
    dédiée au responsive est prévue ; d'ici là un
    [bandeau](src/components/MobileNotice.tsx) prévient que l'app est pensée pour
    un grand écran. Ne pas bricoler écran par écran en attendant — les rustines
    locales seraient à défaire.
- **Langue** : interface 100 % française.
- **Rétention.** Une mise à jour de spec **remplace** la section obsolète,
  elle n'ajoute pas un paragraphe « depuis la v… ». Tout `docs/` est
  public, et ne renvoie jamais aux notes privées du projet : l'ancien
  texte, l'historique, les preuves et les récits quittent le public, et
  vont dans ces notes s'il faut les garder ; l'historique Git garde de
  toute façon le texte remplacé. Une conclusion encore en vigueur qu'un
  chantier peut devoir rouvrir va en ADR dans `04-decisions`, avec sa
  raison. Taille, titres, découpage et liens : la charte
  ([../README.md](../README.md)) et ses bonnes pratiques
  ([documentation.md](documentation.md)). `invariants.md` est un index :
  une règle modifiée se modifie dans sa source ET dans l'index, dans le
  même commit.
