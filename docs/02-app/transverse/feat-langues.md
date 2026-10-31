# Langues de l'interface

L'app s'affiche en français ou en anglais. Ce document dit comment la langue se choisit, d'où
viennent les textes, et comment écrire un texte nouveau. Pourquoi des dictionnaires typés et pas
une bibliothèque : [traductions-par-dictionnaires.md](../../04-decisions/adr/traductions-par-dictionnaires.md).

Fichiers : [src/i18n/](../../../src/i18n/index.ts) (`fr.ts`, `en.ts`, `langue.ts`, `format.ts`),
[useLangue.ts](../../../src/hooks/useLangue.ts), le réglage dans
[SettingsMenu.tsx](../../../src/components/SettingsMenu.tsx) et ses drapeaux dans
[DrapeauLangue.tsx](../../../src/components/DrapeauLangue.tsx), la règle ESLint dans
[regleTexteEnDur.mjs](../../../scripts/lib/regleTexteEnDur.mjs).

## Le réglage « Langue »

Le premier réglage des Paramètres, avant « Thème » ([compte-et-parametres.md](feat-navigation/compte-et-parametres.md#les-réglages)) :
un `Segmented` à trois choix.

| Choix | Langue affichée |
| --- | --- |
| **Auto** (défaut) | la première des langues préférées du navigateur que l'app sait afficher (« de-DE, fr-FR » donne le français), sinon l'anglais ; elle **change à chaud** si le navigateur change de langue (`languagechange`) |
| **Français** | le français |
| **English** | l'anglais |

- Une étiquette se compare par son sous-tag principal : « fr-CA », « fr-BE » et « fr » sont du
  français (`resoudreLangue`, [langue.ts](../../../src/i18n/langue.ts)).
- « Français » et « English » s'écrivent dans leur propre langue, quelle que soit la langue
  affichée (`NOM_LANGUE`), précédés de leur drapeau — la France, le Royaume-Uni pour l'anglais
  ([DrapeauLangue.tsx](../../../src/components/DrapeauLangue.tsx)) ; « Auto » n'en a pas. Le drapeau
  est un SVG à ses propres couleurs, pas un émoji, que Windows affiche en lettres (« FR »). L'infobulle d'« Auto » dit « ton navigateur » sur le site et « ton
  système » dans l'application de bureau (`selonSupport`).
- La palette Ctrl K propose aussi « Langue : Français » et « Langue : English », avec leur drapeau.
- **`<html lang>`** suit la langue affichée : lecteurs d'écran, césure et correcteur du navigateur
  la lisent.
- **Un réglage, pas une donnée** : `swblacksmith-langue-v1` (`auto`, `fr` ou `en`), écrit même
  quand la conservation est refusée, gardé par « Tout supprimer », repris par la session
  ([persistance.md](feat-import-compte/persistance.md),
  [feat-sauvegarde-session.md](feat-sauvegarde-session.md)).

## D'où viennent les textes

- **Un dictionnaire par langue** : `fr.ts`, la langue source, dont la forme fait le type
  `Dictionnaire`, et `en.ts`, typé par lui. Ils sont rangés par zone de l'écran (`navigation`,
  `barreHaut`, `parametres`, `palette`…).
- **Un composant** lit ses textes par `useTraduction()` (le dictionnaire de la langue affichée) et
  la langue par `useLangue()`, pour un nombre ou une date. Les deux suivent un changement de langue
  sans rechargement, composants mémoïsés compris.
- **Un texte qui dépend d'une valeur** est une fonction : `exportDu(date)`, `monstres(n)`,
  `resumeBuildsRapides(combinaisons, builds)` — le pluriel et l'ordre des mots se décident dans la
  langue.
- **Les nombres et les dates** passent par `formatNombre`, `formatDate` et `formatDateHeure`
  ([format.ts](../../../src/i18n/format.ts)), qui reçoivent la langue : « 12 345 » et « 9 août
  2026 » en français, « 12,345 » et « August 9, 2026 » en anglais.
- **Une constante de navigation** (destinations, vues du compte) porte la CLÉ de son libellé
  (`texte: 'resume'`), pas le libellé : `VUES_INVENTAIRE`, et dans [App.tsx](../../../src/App.tsx)
  `NAV`, `RTA_SUBS`, `SIEGE_SUBS`, `ACCOUNT_SUBS`, `OUTILS_SUBS`, `RESOURCES`. Les choix du thème
  et de la mesure se construisent avec leurs textes (`choixTheme(t)`, `choixMesure(t)`).
- **Le vocabulaire du jeu** est celui du client du jeu dans chaque langue. Les noms de monstres et
  les compétences viennent de SWARFARM, en anglais, et le restent dans toutes les langues.

## Ce qui est traduit

Les fichiers traduits sont ceux de `FICHIERS_TRADUITS` (`eslint.config.js`) : la navigation
(barre latérale, carte du compte, recherche, onglets du bas, panneau de navigation mobile), la
barre du haut, la palette Ctrl K, l'écran partagé, la page et le popover des Paramètres, la date de
l'export chargé. Dans [App.tsx](../../../src/App.tsx), les destinations de la navigation, le titre
et le fil d'Ariane de la barre du haut, les actions de la palette et le sélecteur de page d'un
volet vide.

Les autres écrans s'affichent encore en français, quelle que soit la langue choisie.

## Écrire un texte nouveau

1. L'ajouter à `fr.ts`, dans la zone de son écran, puis à `en.ts` : `tsc` refuse tant qu'une
   langue n'a pas la clé.
2. L'afficher par `useTraduction()`. Dans un fichier traduit, un texte en dur est refusé par la
   règle ESLint `swblacksmith/texte-en-dur` : texte entre balises, chaîne en enfant
   (`{ok ? 'Oui' : 'Non'}`), ou dans un attribut qui s'affiche (`title`, `aria-label`,
   `placeholder`, `alt`, `libelle`, `label`, `hint`, `titre`, `invite`, `aide`). Un symbole, un
   nombre, une classe passent. Détail : [qualite-code.md](../../03-developpeur/qualite-code.md).
3. Un terme du jeu reprend le libellé officiel du client dans chaque langue, jamais une traduction.

Un écran qu'on traduit entre dans `FICHIERS_TRADUITS` dans le même commit.

## Tests

- [langue.test.ts](../../../tests/langue.test.ts) : la règle du premier lancement, les mêmes clés
  dans chaque langue (natures et paramètres compris), les formats, la clé de réglage et la
  session, la règle ESLint lancée sur la vraie configuration.
- [rendu/langue.test.tsx](../../../tests/rendu/langue.test.tsx) : le réglage, les Paramètres et
  l'app entière (`#/parametres`) en anglais, puis de retour en français.
- Le rendu serveur n'a pas de navigateur : « Auto » y donne le français, langue des tests
  existants. Un test qui vérifie l'anglais choisit la langue, puis revient à « Auto ».
- ⚠️ **Un vrai navigateur, lui, a une langue** : tout Chromium piloté par les tests, le banc
  d'affichage ou le skill `run-swblacksmith` s'ouvre avec `locale: 'fr-FR'`. Sans elle, celui de
  la CI, en anglais, afficherait l'app en anglais, et les libellés français cherchés
  n'existeraient plus (`optimizer-navigable-banc.ts`, `tests/banc/session.mjs`,
  `.claude/skills/run-swblacksmith/session.mjs`).
