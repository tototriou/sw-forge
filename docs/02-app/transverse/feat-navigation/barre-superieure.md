# Navigation — barre supérieure

Partie de [Navigation](README.md).

## Barre supérieure

Trois zones : l'identité à gauche, **où l'on est** au centre, ce qui **sort** à
droite.

⚠️ **Sur BUREAU, « où l'on est » est un FIL D'ARIANE à gauche**, pas un titre
centré : le chemin du menu
jusqu'à la page — intitulé de groupe, entrée, sous-section (« Jouer › Siège ›
Défense », « Mon compte › Runes › Liste »), texte 13, les étapes en
`ink-dim`, la dernière en `ink` semi-gras, sans icône — raccord avec le menu.
⚠️ Le fil est **tiré de `groupesBureau`** (`filBureau` dans `App.tsx`),
jamais ressaisi : il ne peut pas contredire la barre latérale. Une vue hors
menu (Meules, Gemmes) garde son nom ; une page hors menu (Paramètres), son
titre seul. Gardé par `testRenduAppFil` ([tests/rendu/app.test.tsx](tests/rendu/app.test.tsx)).

⚠️ **Sur TÉLÉPHONE, « où l'on est » est à gauche, sur deux lignes** : la
section en petit (`ink-dimmer`, le fil sauf son dernier élément joint par
« · » : « Jouer · RTA », « Mon compte · Runes »), la page dessous en semi-gras
(« Ma prépa », « Résumé »). **Tiré du MÊME fil** que le bureau ; sans fil, le
titre seul. Il dit ainsi la page et où elle se range.

⚠️ **Le contenu de la zone droite diffère selon le format** — c'est l'un des
endroits où les deux se séparent (voir
[03-developpeur/interface/](../../../03-developpeur/interface/)) :

| | Zone droite |
|---|---|
| **Bureau** | « Écran partagé », puis « Sauvegarder » et « Sauvegarder sous… » (application de bureau) ou « Se déconnecter » (site) |
| **Mobile** | « Sauvegarder » (icône, application de bureau), la loupe, ⚙ **Paramètres** |

- Un espace vide (`ml-auto`) ouvre la zone, aux deux formats : « Sauvegarder »
  n'existant que dans l'application de bureau, aucun bouton ne s'en charge
  partout. Au bureau, « Écran partagé » vient en premier
  ([ecran-partage.md](ecran-partage.md) : enfoncé en écran partagé, désactivé
  avec sa raison quand la fenêtre est trop étroite). « Sauvegarder » est la
  sauvegarde de la session, Ctrl+S
  ([feat-sauvegarde-session.md](../feat-sauvegarde-session.md) § Sauvegarder) ;
  **absent du site**, aux deux formats. Au téléphone, une icône de 32 px
  nommée « Sauvegarder la session (Ctrl+S) », du même gabarit que la loupe et
  le ⚙.
- ⚠️ **En écran partagé, le fil d'Ariane du bureau se tait** : chaque volet
  porte le sien dans son en-tête ([ecran-partage.md](ecran-partage.md#le-volet-actif)).
- ⚠️ **Les paramètres et la déconnexion ne sont pas du même côté.** Sur bureau,
  pas de ⚙ : le **pied de la barre latérale** porte déjà « Paramètres »
  (`SidebarParametres`). Deux chemins vers le même écran se lisent comme deux
  réglages différents.
- ⚠️ Sur mobile, à l'inverse, le ⚙ est le **seul accès** aux paramètres : il n'y
  a pas de barre latérale, et aucun des cinq onglets n'y mène. C'est donc la
  déconnexion qui descend, pas lui.
- ⚠️ **Les deux ⚙ BASCULENT** — voir « Le ⚙ ouvre ET referme » plus bas.

- ⚠️ Sur **mobile**, trois cibles dans 48 px de haut ne laisseraient à chacune
  ni la place ni la marge d'erreur qu'un doigt réclame. L'import est dans les
  paramètres, où il côtoie l'état du compte ; la déconnexion aussi, où elle
  côtoie le réglage de conservation. Le titre porte en outre des marges qui
  réservent leur place au bouton restant.
- ⚠️ Sur **bureau**, la déconnexion est ici : c'est la zone qui porte ce qui
  sort, et la largeur y suffit largement — la contrainte tient aux 348 px d'un
  téléphone, pas au geste lui-même.
- ⚠️ **Un seul chemin de purge** : ce bouton déclenche le même geste que
  « Effacer mes données » des paramètres. Deux chemins divergeraient à la
  première garde ajoutée (le dialogue de conservation, par exemple).

- ⚠️ **Elle COMMENCE après la barre latérale**, elle ne la surplombe pas
  (`z-20` contre `z-30`). La barre latérale est la navigation principale : la
  couper d'un bandeau horizontal la ferait passer pour un panneau secondaire.
- ⚠️ Le titre est **aligné à gauche**, juste après le logo : son point de
  départ ne dépend pas de la largeur de la zone de droite.
- ⚠️ **Fond opaque, pas de flou** : le contenu qu'on devinerait derrière ne
  dirait rien d'utile et brouillerait le titre par transparence.
- Le titre et son icône sont **dérivés** des constantes de navigation — jamais
  une table de libellés en plus, qui divergerait au premier renommage.
- ⚠️ **Le titre nomme la SOUS-SECTION courante** quand la section en a, pas le
  nom de la section : l'**inventaire** sur « Mon compte » (Monstres / Runes /
  Artéfacts), la **vue** sur le « Siège » (Défense / Offense / Recommandations).
  Répéter « Mon compte » ou « Siège » ferait **doublon avec la navigation** —
  l'onglet de la barre du bas au doigt, l'en-tête de section de la barre latérale
  à la souris. Nommer la sous-section apprend **où l'on est** au lieu de répéter
  le niveau au-dessus. (Outils — Optimizer / Speed tuning — suit la même règle.)
- ⚠️ Pas de `PageHeader` dans les pages : la barre porte le titre, et le
  répéter ferait deux fois le même à 60 px d'écart.
