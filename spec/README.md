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
| Siège (Défense / Offense) | `#/siege/defense`, `#/siege/offense` | Live | [siege/README.md](siege/README.md) |
| Arène | `#/arene` | À venir | [arene.md](arene.md) |
| Bestiaire | `#/bestiary` | Live | [bestiaire.md](bestiaire.md) |
| Mécaniques | `#/mecaniques` | Live | [mecaniques.md](mecaniques.md) |

Ordre d'importance (nav & cartes d'accueil) : **Accueil → RTA → Siège → Arène → Bestiaire**.
Le Bestiaire est délibérément en dernier (le moins central de l'outil).

## Briques transverses

Concepts partagés par plusieurs pages, documentés une seule fois :

- [shared/calcul-vitesse.md](shared/calcul-vitesse.md) — le modèle de vitesse SW
  (base, runes, totem, lead, ticks). **Source de vérité** pour RTA et Siège.
- [shared/donnees-monstres.md](shared/donnees-monstres.md) — d'où viennent les
  monstres (SWARFARM), leur normalisation, le modèle `Monster`, et les monstres
  perso créés à la main.
- [shared/import-compte.md](shared/import-compte.md) — extraction de la box RTA
  depuis un export de compte SWEX (utilisé par la page RTA).

## Conventions communes (toutes les pages)

- **Persistance navigateur** : chaque page à état (RTA, Siège) sauvegarde tout
  dans `localStorage`. Rien n'est envoyé à un serveur. Aucune authentification.
- **Données 100 % locales** : le footer rappelle que toutes les données restent
  en local. Un lien **« Supprimer mes données »** (dans la barre de nav, à côté de
  l'import) efface les clés `localStorage` `sw-forge*` / `sky-arena*` (prépa RTA,
  équipes de siège, monstres perso) puis recharge. Voir [App.tsx](src/App.tsx).
- **Import de compte global** : un seul bouton invariant « Importer mon compte »
  dans la barre de nav remplit RTA + siège défense + offense d'un coup. Chaque
  import remplace le précédent ; rien n'est persisté sur le disque. Les états
  RTA/siège sont remontés dans [App.tsx](src/App.tsx). Voir
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
- **Responsive** : nav desktop en pilules ; sur mobile (`< sm`), menu hamburger.
  Le drag & drop natif ne fonctionne pas au tactile → chaque zone drag propose
  un **sélecteur de repli** (déplacer une carte / changer une position).
- **Langue** : interface 100 % française.

## Shell applicatif

Le cadre commun (nav, routing par hash, footer) vit dans
[App.tsx](src/App.tsx) :

- Routing par `window.location.hash` (`routeFromHash()`), pas de router externe.
- Nav desktop (pilules) + nav mobile (hamburger qui se referme à la navigation),
  avec le bouton d'import global + lien « Supprimer mes données » à droite / dans le menu.
- **Bestiaire** et **Mécaniques** sont regroupés sous un menu **« Ressources »**
  (dropdown en desktop, section dans le menu mobile).
- Fusion `monstres officiels + monstres perso` (`allMonsters`) passée à RTA & Siège.
- États RTA & siège (défense/offense) **instanciés ici** puis passés en prop, pour
  qu'un import global les alimente tous. `importAccount(text)` orchestre les 3 ;
  `clearAllData()` efface tout.
- Footer : rappel « données 100 % locales » ; crédit Com2uS / source SWARFARM.
