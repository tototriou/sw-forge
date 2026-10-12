# Transverse

Les fonctionnalités partagées par plusieurs pages, documentées une seule fois ; chaque page y
renvoie au lieu de les redécrire.

| Document | Contenu |
| --- | --- |
| [feat-calcul-vitesse.md](feat-calcul-vitesse.md) | Le modèle de vitesse SW (base, runes, totem, lead, ticks) et son API `speed.ts`. **Source de vérité** pour RTA et Siège. |
| [feat-donnees-monstres.md](feat-donnees-monstres.md) | D'où viennent les monstres (SWARFARM), leur normalisation, le modèle `Monster`, les portraits et les monstres perso créés à la main. |
| [feat-import-compte.md](feat-import-compte.md) | L'import d'un export de compte SWEX : box RTA, équipes de siège, **et** box 6★ + inventaire runes/artéfacts (page « Mon compte ») ; la persistance optionnelle du compte. |
| [feat-navigation/](feat-navigation/README.md) | La **barre latérale**, la barre supérieure, les **onglets mobiles**, la palette Ctrl K, la page Paramètres et l'**accent contextuel** (`--ctx`) qui prend la couleur de l'élément du monstre consulté. |
| [feat-recherche-clavier.md](feat-recherche-clavier.md) | La navigation au clavier des **barres de recherche à suggestions** (↑/↓, Entrée sur l'élément surligné, Échap). Implémentation unique dans [useComboboxNav.ts](../../../src/hooks/useComboboxNav.ts), partagée par tous les champs de recherche. |
| [feat-sauvegarde-session.md](feat-sauvegarde-session.md) | La **sauvegarde de session** : ses accès (barre du haut, Ctrl+S, Paramètres, palette), la session en cours de l'application de bureau, le format `swblacksmith/session` (compte, travail, réglages, état des outils), ce qu'il refuse à la relecture, et où déclarer une clé nouvelle. |

Voir aussi, hors de ce dossier :

- [../bureau/](../bureau/README.md) — l'**application de bureau** (Electron, Windows et Linux) :
  ce qui diffère du site, la fenêtre, l'installeur, la publication au tag, la mise à jour, les
  données — et comment la vérifier (`bureau:preuve`).
- [../compte/feat-calcul-runes.md](../compte/feat-calcul-runes.md) §6 — anticipait déjà le
  moteur de recherche de builds (branch-and-bound, Web Worker) qu'utilise
  [../optimizer/](../optimizer/README.md).
- [03-developpeur/interface/](../../03-developpeur/interface/README.md) — mobile et bureau, le
  système visuel et les composants partagés.
