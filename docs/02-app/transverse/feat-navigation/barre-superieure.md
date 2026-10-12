# Navigation — barre supérieure

Partie de [Navigation](README.md).

## Barre supérieure

Trois zones : l'identité à gauche, **où l'on est** au centre, ce qui **sort** à
droite.

⚠️ **Sur BUREAU, « où l'on est » est un FIL D'ARIANE à gauche**, plus le
titre centré (refonte graphique, lot 4, 2026-09-24) : le chemin du menu
jusqu'à la page — intitulé de groupe, entrée, sous-section (« Jouer › Siège ›
Défense », « Mon compte › Runes › Liste »), texte 13, les étapes en
`ink-dim`, la dernière en `ink` semi-gras, sans icône. Relevé par le mainteneur :
le titre centré en Cinzel, icône colorée, « n'est pas raccord avec le menu ».
⚠️ Le fil est **tiré de `groupesBureau`** (`filBureau` dans `App.tsx`),
jamais ressaisi : il ne peut pas contredire la barre latérale. Une vue hors
menu (Meules, Gemmes) garde son nom ; une page hors menu (Paramètres), son
titre seul. Gardé par `testRenduAppFil` ([tests/rendu/app.test.tsx](tests/rendu/app.test.tsx)).

⚠️ **Sur TÉLÉPHONE, « où l'on est » est à gauche, sur deux lignes**
(refonte graphique, lot 11a, décision 24, la maquette) : la section en petit
(`ink-dimmer`, le fil sauf son dernier élément joint par « · » : « Jouer ·
RTA », « Mon compte · Runes »), la page dessous en semi-gras (« Ma prépa »,
« Résumé »). **Tiré du MÊME fil** que le bureau ; sans fil, le titre seul.
Il était **centré en absolu, en Cinzel, avec l'icône colorée de la
section** : il ne disait que la page, pas où elle se range. Les attendus de
`testRenduAppRoutes` pour « Mon compte » ont suivi (« Mon compte · Runes
Résumé » au lieu de « Runes · Résumé »).

⚠️ **Le contenu de la zone droite diffère selon le format** — c'est l'un des
endroits où les deux se séparent (voir
[03-developpeur/interface/](../../../03-developpeur/interface/)) :

| | Zone droite |
|---|---|
| **Bureau** | « Sauvegarder », puis « Sauvegarder sous… » (application de bureau) ou « Se déconnecter » (site) |
| **Mobile** | « Sauvegarder » (icône), la loupe, ⚙ **Paramètres** |

- « Sauvegarder » ouvre la zone (`ml-auto`) aux deux formats : c'est la
  sauvegarde de la session, Ctrl+S
  ([feat-sauvegarde-session.md](../feat-sauvegarde-session.md) § Sauvegarder). Au
  téléphone, une icône de 32 px nommée « Sauvegarder la session (Ctrl+S) »,
  du même gabarit que la loupe et le ⚙.
- ⚠️ **Les paramètres et la déconnexion ne sont pas du même côté.** Sur bureau, le
  ⚙ a été retiré : le **pied de la barre latérale** porte déjà « Paramètres »
  (`SidebarParametres`). Deux chemins vers le même écran se lisent comme deux
  réglages différents.
- ⚠️ Sur mobile, à l'inverse, le ⚙ est le **seul accès** aux paramètres : il n'y
  a pas de barre latérale, et aucun des cinq onglets n'y mène. C'est donc la
  déconnexion qui descend, pas lui.
- ⚠️ **Les deux ⚙ BASCULENT** — voir « Le ⚙ ouvre ET referme » plus bas.

- ⚠️ Sur **mobile**, trois cibles dans 48 px de haut, à côté d'un titre centré
  en absolu, ne laissaient à chacune ni la place ni la marge d'erreur qu'un
  doigt réclame — et le bouton ⚙ chevauchait « RTA ». L'import descend dans les
  paramètres, où il côtoie l'état du compte ; la déconnexion aussi, où elle
  côtoie le réglage de conservation. Le titre porte en outre des marges qui
  réservent leur place au bouton restant.
- ⚠️ Sur **bureau**, la déconnexion reste ici : c'est la zone qui porte ce qui
  sort, et la largeur y suffit largement. La descendre n'aurait rien réglé
  là-bas — le problème tenait aux 348 px d'un téléphone, pas au geste lui-même.
- ⚠️ **Un seul chemin de purge** : ce bouton déclenche le même geste que
  « Effacer mes données » des paramètres. Deux chemins auraient divergé à la
  première garde ajoutée (le dialogue de conservation, par exemple).

- ⚠️ **Elle COMMENCE après la barre latérale**, elle ne la surplombe pas
  (`z-20` contre `z-30`). La barre latérale est la navigation principale : la
  couper d'un bandeau horizontal la ferait passer pour un panneau secondaire.
- ⚠️ Le titre était **centré en absolu**, pas dans le flux : centré par la
  disposition, il se serait décalé dès que la zone de droite change de largeur.
  Depuis le lot 11a il est **aligné à gauche**, juste après le logo : le
  problème ne se pose plus, son point de départ ne dépend plus de la droite.
- ⚠️ **Fond opaque, pas de flou** : le contenu qu'on devinait derrière ne disait
  rien d'utile et brouillait le titre par transparence.
- Le titre et son icône sont **dérivés** des constantes de navigation — jamais
  une table de libellés en plus, qui aurait divergé au premier renommage.
- ⚠️ **Le titre nomme la SOUS-SECTION courante** quand la section en a, pas le
  nom de la section : l'**inventaire** sur « Mon compte » (Monstres / Runes /
  Artéfacts), la **vue** sur le « Siège » (Défense / Offense / Recommandations).
  Répéter « Mon compte » ou « Siège » faisait **doublon avec la navigation** —
  l'onglet de la barre du bas au doigt, l'en-tête de section de la barre latérale
  à la souris. Nommer la sous-section apprend **où l'on est** au lieu de répéter
  le niveau au-dessus. (Outils — Optimizer / Speed tuning — suit la même règle.)
- ⚠️ `PageHeader` a disparu avec elle : chaque page portait son titre, et les
  garder aurait fait deux fois le même à 60 px d'écart.
