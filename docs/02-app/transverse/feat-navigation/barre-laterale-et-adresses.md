# Navigation — barre latérale et adresses

Partie de [Navigation](README.md).

## Pourquoi une barre latérale

L'ancienne navigation était une **rangée horizontale** avec deux menus
déroulants (« Mon compte », « Ressources ») et un bouton hamburger de repli.

- ⚠️ **Le problème n'était pas esthétique : la rangée ne tenait plus.** Neuf
  destinations, dont **six enfouies** derrière les deux menus — qu'il fallait
  ouvrir pour savoir ce qu'ils contenaient.
- ⚠️ **Un intitulé de groupe n'est PAS un lien.** « Ressources » annonce ce qui
  suit, il ne mène nulle part. Le menu déroulant confondait les deux.
- La **mécanique de mesure** de l'ancienne barre a disparu avec elle : trois
  `ref`, un `ResizeObserver` et un `useLayoutEffect` décidaient quand replier la
  rangée en hamburger. Une barre verticale ne déborde pas.

### ⚠️ L'ordre d'importance ne change pas

**Accueil → RTA → Siège → Mon compte → Outils → Arène**, puis les ressources.
C'est celui de [02-app/README.md](../../README.md) (« Ordre des pages »), issu de l'usage : la refonte change la
**forme** de la navigation, pas la hiérarchie.

**Sur bureau, le premier niveau est REGROUPÉ** (refonte graphique) :

```
Accueil
JOUER        RTA ›  Siège ›  Arène
MON COMPTE   Monstres  Runes ›  Artéfacts ›
OUTILS       Optimizer  Speed tuning
RESSOURCES   Bestiaire  Mécaniques  Nouveautés  Télécharger
```

« Télécharger » (application de bureau, décision 14) n'existe que sur le
**site** : `RESOURCES` d'App.tsx l'omet dans l'app de bureau (`estBureau()`),
et la barre latérale, le panneau mobile, la palette et le titre, qui en
dérivent tous, le perdent d'un coup. Voir [telecharger/](../../telecharger/).

L'ordre est gardé, à une exception près : **Arène rejoint « Jouer »**, à côté
du siège — c'est un mode de jeu. Les inventaires et les outils deviennent des
entrées DIRECTES : Monstres (une seule vue) et les deux outils mènent à leur
page ; Runes et Artéfacts (plusieurs vues) ouvrent leur niveau, comme RTA et
Siège. Aucune destination ne disparaît — vérifié par
`tests/rendu/app.test.tsx`. Les onglets mobiles gardent leurs cinq entrées
(le téléphone a son propre lot).

## Adresses — ce que lit la barre d'adresse

Routage par hash, sans routeur : `parseHash` ([App.tsx](src/App.tsx)) lit
l'adresse et en déduit la page et ses sous-niveaux.

| Adresse | Page |
| --- | --- |
| `#/` | Accueil |
| `#/rta`, `#/rta/ami` | RTA · Ma prépa, Ami |
| `#/siege/defense`, `/offense`, `/recommandations` | Siège |
| `#/compte/<inventaire>/<vue>` | Mon compte — vues de [accountViews.ts](src/lib/accountViews.ts) |
| `#/outils/optimizer`, `/speed-tuning` | Outils |
| `#/arene`, `#/bestiary`, `#/mecaniques`, `#/releases`, `#/parametres` | une page chacune |
| `#/telecharger` | Télécharger — **site seulement** ; dans l'app de bureau, l'accueil |

- ⚠️ **Une adresse tronquée mène au défaut de sa section**, jamais à un écran
  vide : `#/siege` → Défense, `#/compte` → Monstres, `#/compte/runes` →
  Résumé, `#/outils` → Optimizer. L'accueil s'en sert (`#/compte/runes`).
- ⚠️ **Une sous-page inconnue retombe sur le défaut de SA section**
  (`#/compte/artefacts/courbes` → Artéfacts · Résumé, par `vueValide`) ; une
  **section inconnue** retombe sur l'accueil. Jamais d'exception.
- ⚠️ **Garde-fou** (le mainteneur, 2026-10-01) : `tests/navigation-adresses.test.ts`
  tient la table de toutes les adresses et de leur page. Tout lien `#/…`
  affiché par l'app doit y figurer — un lien ajouté sans y être inscrit, ou qui
  ne mène plus où la table le dit, fait échouer `npm test`.
