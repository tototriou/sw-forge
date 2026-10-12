# Système visuel — typographie et rayons

Partie de [Système visuel](README.md).

### Trois familles, trois rôles stricts

| Famille | Police | Rôle | Usages |
|---------|--------|------|--------|
| `font-display` | **Cinzel** | Titres et héros | ~26 |
| `font-body` | **Source Sans 3** | Tout le texte, **libellés compris** | défaut |
| `font-mono` | **JetBrains Mono** | **Chiffres uniquement** | ~96 |

Source Sans 3 remplace Inter au rebranding (R1), comme dans la toile ; les
**tailles** ne bougent pas (décision 7 : le corps de 17 px de la charte vaut
pour elle, pas pour la densité de nos listes).

⚠️ **Une quatrième police, hors de ce système : `font-marque` (Saira 700)**,
le NOM de l'app et rien d'autre — dans le logo (`Logo.tsx`, `CLASSE_NOM` :
capitales espacées) et le héros de l'accueil. Choisie par le mainteneur avec la
nouvelle identité de logo (rebranding R2 bis, décision 24). Les titres restent
en Cinzel : Saira n'est pas une police de titre, c'est la signature.

⚠️ **La mono ne sert qu'à ce qui s'aligne.** Efficiences, vitesses, ticks,
compteurs — des colonnes qu'on compare d'une ligne à l'autre. `tabular-nums` est
posé d'office sur `.font-mono` : sans lui, un « 1 » plus étroit décale toute une
colonne.

⚠️ **JetBrains Mono, pas Space Mono.** Space Mono a des chiffres larges et mous,
illisibles en 11 px — or c'est la taille à laquelle on lit une efficience dans
une liste de 60 tuiles. JetBrains Mono est dessinée pour le petit corps :
hauteur d'x haute, zéro barré, `1` à empattement.

### Le libellé en capitales : une classe, pas un motif

Le motif `font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim` était
répété **55 fois**, à sept tailles différentes. Il devient la classe `.label`.

⚠️ **Dans la police du texte, pas en mono.** Une mono en capitales espacées
est large et molle à 11 px — c'est ce qui donnait cette impression de flou dans
les zones denses. Une linéale en demi-gras est plus nette et plus compacte à
taille égale. `.label` lit `theme('fontFamily.body')` : Inter jusqu'au
rebranding, Source Sans 3 depuis, sans rien réécrire.

### Échelle typographique — plancher à 11 px

| Token | Taille | Usage |
|-------|--------|-------|
| `micro` | 11 px | Libellés mono en capitales, sous-titres de KPI |
| `xs` | 12 px | Texte secondaire, corps de tuile |
| `sm` | 13 px | Texte courant dense (tables, cartes) |
| `md` | 14 px | **Navigation seulement** — voir ci-dessous |
| `base` | 15 px | Texte courant |
| `lg` | 17 px | Titre de section |
| `xl` | `clamp(22px, 3vw, 30px)` | Titre de page |

⚠️ **`md` n'est pas un cran de l'échelle générale.** Il existe pour une seule
raison : la barre latérale du **bureau** se lisait serrée à 13 et trop appuyée à
15 — une colonne de neuf entrées qu'on parcourt du regard, pas du texte de
lecture. Il a été **ajouté à l'échelle** plutôt que posé en `text-[14px]` sur
place : une valeur en dur aurait été hors système, et la première d'une série,
puisque le cran manquant le serait resté.

⚠️ **Ne pas s'en servir pour du corps de texte.** Entre `sm` et `base`, il cale
une densité, il ne marque pas un niveau d'information : deux blocs voisins en
`sm` et `md` se liraient comme une hésitation, pas comme une hiérarchie.

⚠️ **Plancher à 11 px, sans exception.** Les `text-[9px]` et `text-[10px]`
existants remontent à 11 px. En dessous, l'écart ne crée pas de hiérarchie : il
crée du flou.

⚠️ **Pas de demi-pixel.** Les paliers 10.5, 11.5, 12.5, 13.5 et 14.5 px
disparaissent. Un écart de 0,5 px entre deux libellés voisins ne se lit pas comme
une intention, il se ressent comme un défaut d'alignement.

Le héros de l'accueil garde son `clamp()` propre : c'est un titre d'affiche, pas
un palier de l'échelle.

### Rayons

| Token | Classe | Valeur | Rôle |
|-------|--------|--------|------|
| `radius` | `rounded` | 6 px | Petit élément : pastille, badge, touche |
| `radius-lg` | `rounded-lg` | 10 px | Bouton, champ, liste déroulante |
| `radius-xl` | `rounded-xl` | 14 px | Carte, panneau |
| `radius-2xl` | `rounded-2xl` | 20 px | Fenêtre : dialogue, panneau mobile |

**Les mêmes dans les deux thèmes** (refonte graphique). Forge assumait
jusque-là l'angle vif (4 / 6 px) ; il l'abandonne pour un rendu d'application
plus doux, commun aux deux thèmes. Les valeurs sont celles de la toile depuis
le rebranding (R1) ; elles valaient 6 / 8 / 12 / 14.

⚠️ **`rounded-xl` et `rounded-2xl` sont REDÉFINIS** dans `tailwind.config.js`.
C'étaient les valeurs figées de Tailwind (12 et 16 px), hors tokens : une
classe qui ne suit pas le système se change partout d'un coup ou nulle part.
`rounded-md` (6 px) et `rounded-sm` (2 px) restent ceux de Tailwind ;
`rounded-full` n'a pas de token (un cercle ou une pilule).
