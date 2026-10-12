# Librairie UI — principes et axes

Partie de [Librairie UI](README.md).

## Le problème que ce dossier résout

Avant lui, chaque écran redessinait ses boutons. Un même bouton d'action existait
en une quarantaine d'exemplaires, chacun avec ses classes recopiées puis
divaguées : rembourrages différents à deux pixels près, deux rayons de coin,
trois façons de dire « désactivé ».

La conséquence n'était pas esthétique mais **économique** : demander « réduis les
boutons sur téléphone » voulait dire refaire le même travail dans dix-sept
fichiers, et en oublier trois.

Une tentative avait déjà eu lieu, sous forme d'un fichier de **constantes de
classes** (`buttonStyles.ts`). Elle a échoué, et il faut savoir pourquoi :

> ⚠️ **Une constante de classes se contourne, un composant non.** Sept fichiers
> importaient `BOUTON_PRIMAIRE`, quarante dessinaient des boutons à la main. Rien
> ne s'opposait à recopier la chaîne en y ajoutant « juste un `px-2` pour ce
> cas » — et la divergence repartait. Un composant impose sa structure : la
> hauteur tactile, la pression au clic, l'état désactivé ne sont plus négociables
> au point d'appel.

## La règle qui gouverne tout le reste

> ⚠️ **Un composant dessiné dans `src/ui/` ne se redessine nulle part ailleurs.**
> Si un écran a besoin d'un bouton, il importe `Bouton`. S'il a besoin d'un
> bouton qui n'existe pas, on ajoute **un axe** au bouton — jamais un bouton de
> plus dans un dossier de page.

## Des AXES, pas un catalogue de variantes

C'est la décision structurante de cette librairie, et elle a été prise **contre**
un premier jet qui nommait ses styles par intention (`principal`, `discret`,
`destructeur`…).

Ce premier jet ne tient pas : dès qu'un écran veut un bouton d'ajout **en
pointillés**, il faut une cinquième entrée. Puis une sixième pour la même chose
en rouge. Puis une septième pour la version sans fond. Le catalogue grossit d'une
ligne à chaque écran neuf, et les combinaisons manquantes se règlent en
`className` — c'est-à-dire par le contournement qu'on cherchait à empêcher.

Les axes se **choisissent séparément et se combinent** :

| Axe | Valeurs | Ce qu'il décide |
|-----|---------|-----------------|
| `ton` | `neutre`, `accent`, `danger` | La **couleur** de l'action |
| `fond` | `vide`, `doux`, `plein` | Le **remplissage** |
| `trait` | `aucun`, `plein`, `pointille` | Le **contour** |
| `forme` | `boite`, `pilule` | Le **rayon des coins** |
| `taille` | `xs`, `sm`, `md`, `carre` | L'**encombrement** |

> ⚠️ **À la souris, le gabarit des boutons de la maquette** (refonte
> graphique, décision 16 — « le même rendu que sur la maquette au niveau des
> boutons ») : `md` = `.btn`, **32 px** de haut, 12 px de côté, 13 px de
> texte ; `sm` = `.btn-sm`, **28 px**, 10 px, 12 px ; rayon 8 px. Un bouton
> d'icône est un carré de la même hauteur : `BoutonIcone` = 28 px
> (`.btn-icon.btn-sm`), le « ⋯ » d'en-tête = 32 px (`.btn-icon`).
> `Segmented` = `.seg` : cadre de 32 px, crans de 26. `min-h` et non `h` :
> un libellé qui passe à la ligne agrandit le bouton au lieu de déborder.
> `xs` et `serre` restent hors échelle — ils vivent DANS un contenant plus
> petit qu'elle. **Le survol peint le fond** : `panel2` (l'équivalent du
> `--hover` de la maquette, même écart au panneau dans les deux thèmes) sur
> un bouton neutre, `bad-soft` sur un `danger` sans fond — et plus le contour
> d'accent, ni le voile noir propre à `BoutonIcone`. Au doigt, rien ne change
> (lot 11) : tailles en `lg:`, survol en `hoverable:`.

> ⚠️ **Les états de la toile, sans ses hauteurs** (rebranding, R3a — décisions
> 17 et 21). Le bouton principal (`accent` + `plein`) prend le **survol**
> `accent-hover` et l'**appui** `accent-appui` (le filtre `brightness-110`
> disparaît) ; **désactivé**, il devient un aplat gris (`panel2`, encre
> `ink-dimmer`) au lieu d'une braise à 40 % d'opacité, boueuse. Tout `Bouton`
> **descend d'1 px** à l'appui (`data-bouton`, voir design/regles-transverses.md § Pression).
> Les hauteurs restent les nôtres (28 / 32 au bureau, 40 au doigt), pas les
> 36 / 44 / 52 de la toile : notre densité est gardée.
> Le **« fantôme »** de la toile est `ton="accent"` + `fond="vide"` : texte en
> braise lisible, fond braise sombre au survol (R3c). Personne n'employait
> cette combinaison avant ; elle porte l'action d'une notification.
> ⚠️ `active:!bg-accent-appui` et `disabled:!bg-panel2` portent un
> `!important`, à dessein : les variantes du plugin (`hoverable:`) sont émises
> APRÈS `active:` et `disabled:` dans le CSS construit, et le survol
> l'emportait à spécificité égale — pas d'appui visible à la souris, une
> braise qui se rallumait sur un bouton désactivé.

> ⚠️ **`fond` décide aussi de la COULEUR DU CONTENU**, pas seulement du
> remplissage. Un bouton sans fond prend une icône qui vire à la teinte de son
> ton au survol — juste sur une surface neutre. Sur un fond peint de cette même
> teinte, cela donnait une **croix rouge sur fond rouge** : l'icône disparaissait
> exactement au moment où on la vise. D'où trois cas de texte (`nu`, `doux`,
> `plein`) et non deux, et d'où un `fond="plein"` **opaque** pour le ton
> `danger` : c'est le cran des actions posées SUR autre chose, où un fond
> translucide laisse passer l'image dessous.
>
> ⚠️ **`ton="accent"` + `fond="plein"` est le BOUTON PRINCIPAL** : un aplat
> d'accent, texte `accent-ink` (blanc en Atelier, fond sombre en Forge —
> mesurés, `../design/tokens-couleurs.md` § Accent). **Un seul par écran** : l'action qu'on vient
> faire. Il valait `accent-soft` comme `doux` jusqu'à la refonte graphique
> (décision 4 du mainteneur, 2026-09-24) — l'app n'avait aucun bouton principal
> qui ressorte. `BoutonGroupe` suit la même règle.
>
> ⚠️ Corollaire : **ne jamais peindre un fond en `className`.** Le composant ne
> peut pas le savoir, et choisit alors la couleur de contenu du fond nu.

> ⚠️ **`taille="carre"` n'a aucun rembourrage, dans aucune direction.** Elle
> existe parce qu'un `p-0` posé en `className` par-dessus une taille qui
> rembourre **ne marche pas de façon fiable** : l'ordre des classes dans
> l'attribut ne décide de rien, c'est leur ordre dans la feuille de style qui
> tranche. Les boutons-icônes s'affichaient vides — colorés, cliquables, sans
> icône — parce que le `py-1` de la taille `sm` mangeait les 20 px de hauteur.
> Une annulation après coup marche ou ne marche pas selon ce que Tailwind a émis
> en premier ; une taille à part ne peut pas entrer en conflit.

Trois axes de couleur × trois de fond × trois de trait couvrent ce que douze
variantes nommées n'auraient pas couvert. Et surtout :

> ⚠️ **La librairie ne grossit que si un AXE manque**, jamais parce qu'un écran
> de plus a un besoin de plus. « Bouton d'ajout » n'est pas une variante : c'est
> `trait="pointille"`, et le pointillé dit « contenant pas encore rempli » dans
> toute l'app, pas seulement là où on l'a écrit.

### Le piège de la règle tactile

> ⚠️ **Un bouton natif POSÉ DANS un contenant y impose sa hauteur.** La règle
> globale porte tout `<button>` à 40 px au doigt (voir `index.css`). Sur un
> bouton qui vit dans une pilule, une carte ou une rangée dense, ce n'est pas lui
> qui grandit : c'est **son contenant**, qui double de hauteur sans que rien dans
> son propre code ne l'explique. La rangée des leads SPD y prenait deux fois la
> place nécessaire, et le fautif était un bouton intérieur de 20 px.
>
> La sortie est `data-cible-fine`, et elle se justifie à chaque fois : elle ne
> s'emploie que si **la cible reste atteignable autrement** — parce que le
> contenant entier est touchable, ou parce que rien d'autre n'est cliquable
> autour. Les composants de la librairie la posent déjà (`BoutonIcone`
> `taille="serre"`, `Selecteur` `taille="dense"`, `Pastille` via
> `data-hauteur-fixe`) ; **un `<button>` écrit à la main ne la pose pas**, et
> c'est exactement là que le bug revient.

### Axes de comportement

Quatre axes ne touchent pas à l'apparence au repos mais à ce que le bouton fait
selon le contexte, ou à ce qu'il est :

- **`nuAuDoigt`** — le bouton se déshabille au tactile : plus de cadre, plus de
  fond, plus de rembourrage, il ne reste que l'icône. ⚠️ **Réservé aux barres où
  le même geste se répète cinq ou six fois.** Six boutons encadrés font six
  carrés dans une barre qu'on cherche à compacter, et le cadre n'apprend rien :
  l'icône dit l'action, sa présence dit qu'on peut la toucher. Il pose
  `cible-tactile`, qui rend 44 px touchables **sans qu'un pixel du dessin ne
  bouge** — sinon la règle des 40 px regonflerait ce qu'on vient de déshabiller.
- **`libelleAuDoigt`** — le libellé tombe et ne reste que l'icône. ⚠️ Sans effet
  s'il n'y a pas d'icône : un bouton muet n'est plus un bouton.
- **`actif`** — bouton à **deux états**. Il prend le fond de son ton et pose
  `aria-pressed` : sans quoi un lecteur d'écran annonce « bouton » là où
  l'utilisateur voit un interrupteur.
- **`href`** — un **lien** au dessin de bouton (application de bureau, lot 6 :
  « Télécharger pour Windows ») : rendu en `<a href>`, mêmes classes, même
  appui (`[data-bouton]` d'`index.css`). Un téléchargement, une page externe
  sont des liens — on peut en copier l'adresse, le lecteur d'écran dit
  « lien ». ⚠️ Jamais un `<button onClick={() => location.href = …}>` : il
  ressemblerait au lien sans en être un.

> ⚠️ **Le libellé se masque, il ne DISPARAÎT pas.** C'est pourquoi l'API est
> `icone` + `libelle` et non un `children` libre : le panneau d'actions mobile
> **rend les mots** quand la place existe (règle `[data-tiroir]` dans
> `index.css`), et il ne peut le faire que si le libellé est dans un `<span>`
> repérable. Un texte écrit en dur dans `children` n'est plus rattrapable, et la
> rangée d'icônes nues du panneau redevient un rébus.
