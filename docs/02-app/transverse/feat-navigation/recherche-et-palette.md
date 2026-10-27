# Navigation — recherche et palette Ctrl K

Partie de [Navigation](README.md).

## Recherche de navigation

Un champ en tête de la barre, `⌘K` depuis n'importe où.

⚠️ **Ce champ OUVRE LA PALETTE** (section suivante) : toucher le champ ou
`Ctrl K` ouvre la même palette, qui cherche pages, monstres et actions. Il
n'existe qu'**une** recherche.

- ⚠️ **Des groupes intitulés** (Pages, Monstres, Actions) : un champ répondant
  à plusieurs natures de résultats sans les séparer obligerait à les trier du
  regard.
- ⚠️ **Dérivée des mêmes constantes que la barre**, pas ressaisie : une seconde
  liste divergerait au premier écran ajouté, et le manque passerait
  inaperçu — on ne cherche pas ce dont on ignore l'existence.
- La navigation au clavier vient de `useComboboxNav`, comme toute barre à
  suggestions — voir [feat-recherche-clavier.md](../feat-recherche-clavier.md).
- Comparaison **insensible aux accents** : « arene » doit trouver « Arène ».
- L'indication **`Ctrl K`** à droite du champ. Le raccourci marche avec Ctrl
  comme avec ⌘.
- ⚠️ **Un résultat a le rendu exact d'une entrée du menu** : 32 px, icône
  NEUTRE de 16, texte 14, rayon 8, voile d'encre pour le résultat choisi
  (`bg-ink/10`) et au survol (`bg-ink/5`) ; la section en contexte à droite,
  en petit. Avec un autre gabarit, les résultats se liraient comme une autre
  sorte de liste.

## Palette Ctrl K

Composant `src/components/Palette.tsx`, monté une fois par `App.tsx`.

- **S'ouvre** par `Ctrl K` / `⌘K` de n'importe où, par le champ de recherche
  de la barre latérale (bureau), et au téléphone par une **loupe** dans la
  barre du haut, à côté du ⚙ — sans clavier, c'est son seul accès.
- **Une modale centrée en haut** (bureau), plein écran au téléphone : un
  champ « Rechercher une page, un monstre, une action… », puis les résultats
  en **trois groupes intitulés** — **Pages** (les destinations du menu, comme
  avant, dérivées des mêmes constantes), **Monstres** (le bestiaire ; choisir
  ouvre la **fiche** du monstre, sans changer de page), **Actions**.
- **Actions** — aucune destructrice : **Importer mon compte**
  (le choix de fichier des Paramètres) ; **Sauvegarder la session** (le
  bouton des Paramètres, [feat-sauvegarde-session.md](../feat-sauvegarde-session.md))
  et **Sauvegarder sous…**, dans l'application de bureau seulement ;
  **Thème auto / clair / sombre** ;
  **Créer une recommandation** (ouvre les Recommandations et en crée une) ;
  **Mesure : efficience / score SW** (le réglage du menu ⚙) ; **Speed tuning
  d'une équipe** (les équipes de siège dont un monstre correspond à la
  recherche ; choisir ouvre leur speed tuning en modale).
- **Vide, elle propose** les pages (comme le menu) et les actions ; les
  monstres n'apparaissent qu'à partir de deux lettres tapées — 3 000 fiches
  ne se parcourent pas.
- Clavier : `↑` `↓` naviguent sur toute la liste, groupes compris, `Entrée`
  ouvre, `Échap` ferme. ⚠️ **Géré par la palette elle-même, pas par
  `useComboboxNav`** : ce hook n'ouvre sa liste qu'une fois quelque chose
  tapé, alors que la palette montre déjà pages et actions quand le champ est
  vide — les flèches doivent y marcher aussi.
  Comparaison **insensible aux accents**. Au plus **8 monstres** et **8
  équipes** affichés : la palette mène quelque part, elle ne remplace pas le
  Bestiaire.
- Chaque groupe affiche au plus ce qui tient ; « Aucun résultat pour « … » »
  et « Essaie un nom de monstre, de page ou d'action. » quand rien ne répond.
