# Librairie UI — principes et axes

Partie de [Librairie UI](README.md).

Pourquoi une librairie de composants plutôt que des constantes de classes, et
pourquoi des axes plutôt que des variantes nommées :
[librairie-ui-par-axes.md](../../../04-decisions/adr/librairie-ui-par-axes.md).

## La règle qui gouverne tout le reste

> ⚠️ **Un composant dessiné dans `src/ui/` ne se redessine nulle part ailleurs.**
> Si un écran a besoin d'un bouton, il importe `Bouton`. S'il a besoin d'un
> bouton qui n'existe pas, on ajoute **un axe** au bouton — jamais un bouton de
> plus dans un dossier de page.

## Des AXES, pas un catalogue de variantes

C'est la décision structurante de cette librairie. Les axes se **choisissent
séparément et se combinent** :

| Axe | Valeurs | Ce qu'il décide |
|-----|---------|-----------------|
| `ton` | `neutre`, `accent`, `danger` | La **couleur** de l'action |
| `fond` | `vide`, `doux`, `plein` | Le **remplissage** |
| `trait` | `aucun`, `plein`, `pointille` | Le **contour** |
| `forme` | `boite`, `pilule` | Le **rayon des coins** |
| `taille` | `xs`, `sm`, `md`, `carre` | L'**encombrement** |

> ⚠️ **À la souris, le gabarit des boutons** : `md`, **32 px** de haut, 12 px
> de côté, 13 px de texte ; `sm`, **28 px**, 10 px, 12 px ; rayon 8 px. Un
> bouton d'icône est un carré de la même hauteur : `BoutonIcone` = 28 px, le
> « ⋯ » d'en-tête = 32 px. `Segmented` : cadre de 32 px, crans de 26. `min-h`
> et non `h` : un libellé qui passe à la ligne agrandit le bouton au lieu de
> déborder. `xs` et `serre` restent hors échelle — ils vivent DANS un
> contenant plus petit qu'elle. **Le survol peint le fond** : `panel2` (même
> écart au panneau dans les deux thèmes) sur un bouton neutre, `bad-soft` sur
> un `danger` sans fond — ni contour d'accent, ni voile noir. Au doigt :
> tailles en `lg:`, survol en `hoverable:`.

> ⚠️ **Les états du bouton principal** (`accent` + `plein`) : **survol**
> `accent-hover`, **appui** `accent-appui` ; **désactivé**, un aplat gris
> (`panel2`, encre `ink-dimmer`) — une braise à 40 % d'opacité serait boueuse.
> Tout `Bouton` **descend d'1 px** à l'appui (`data-bouton`, voir design/regles-transverses.md § Pression).
> Hauteurs : 28 / 32 au bureau, 40 au doigt.
> Le bouton **« fantôme »** est `ton="accent"` + `fond="vide"` : texte en
> braise lisible, fond braise sombre au survol ; il porte l'action d'une
> notification.
> ⚠️ `active:!bg-accent-appui` et `disabled:!bg-panel2` portent un
> `!important`, à dessein : les variantes du plugin (`hoverable:`) sont émises
> APRÈS `active:` et `disabled:` dans le CSS construit, et le survol
> l'emporterait à spécificité égale — pas d'appui visible à la souris, une
> braise qui se rallumerait sur un bouton désactivé.

> ⚠️ **`fond` décide aussi de la COULEUR DU CONTENU**, pas seulement du
> remplissage. Un bouton sans fond prend une icône qui vire à la teinte de son
> ton au survol — juste sur une surface neutre. Sur un fond peint de cette même
> teinte, cela donnerait une **croix rouge sur fond rouge** : l'icône disparaîtrait
> exactement au moment où on la vise. D'où trois cas de texte (`nu`, `doux`,
> `plein`) et non deux, et d'où un `fond="plein"` **opaque** pour le ton
> `danger` : c'est le cran des actions posées SUR autre chose, où un fond
> translucide laisse passer l'image dessous.
>
> ⚠️ **`ton="accent"` + `fond="plein"` est le BOUTON PRINCIPAL** : un aplat
> d'accent, texte `accent-ink` (blanc en Atelier, fond sombre en Forge —
> mesurés, `../design/tokens-couleurs.md` § Accent). **Un seul par écran** : l'action qu'on vient
> faire, et la seule qui ressorte. `BoutonGroupe` suit la même règle.
>
> ⚠️ Corollaire : **ne jamais peindre un fond en `className`.** Le composant ne
> peut pas le savoir, et choisit alors la couleur de contenu du fond nu.

> ⚠️ **`taille="carre"` n'a aucun rembourrage, dans aucune direction.** Elle
> existe parce qu'un `p-0` posé en `className` par-dessus une taille qui
> rembourre **ne marche pas de façon fiable** : l'ordre des classes dans
> l'attribut ne décide de rien, c'est leur ordre dans la feuille de style qui
> tranche. Les boutons-icônes s'afficheraient vides — colorés, cliquables, sans
> icône — parce que le `py-1` de la taille `sm` mangerait les 20 px de hauteur.
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
> son propre code ne l'explique. La rangée des leads SPD y prendrait deux fois
> la place nécessaire, et le fautif serait un bouton intérieur de 20 px.
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
- **`href`** — un **lien** au dessin de bouton (« Télécharger pour
  Windows ») : rendu en `<a href>`, mêmes classes, même
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
