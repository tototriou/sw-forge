# Librairie UI — quand ajouter quelque chose

Partie de [Librairie UI](README.md).

## Quand ajouter quelque chose

> ⚠️ **Un composant monte ici au DEUXIÈME usage, jamais au premier.** Remonter
> trop tôt fabrique une abstraction taillée pour un seul appelant, que le second
> fait éclater en options. C'est le trajet qu'ont suivi `Segmented` et
> `elementStyles` avant ce dossier.

Et l'inverse est vrai : **tout ne monte pas**. Restent délibérément hors
librairie —

- **Rien.** Cette liste a compté jusqu'à six entrées ; elle est vide. Chacune se
  ramenait à un manque de la librairie, pas à une singularité de l'écran :
  l'interrupteur d'affichage voulait un accent inversé (`actif={!actif}`), la
  pilule de lead une teinte du jeu (`classNameActif`), la palette un marqueur en
  anneau (`Vignette aplat`), le badge de désync et la relique des tons qui
  n'existaient pas (`alerte`, `precieux`), les surfaces de carte un composant
  volontairement nu (`ZoneCliquable`).
- **Sauf ce qui n'est pas un contrôle** : un `<input type="file">` masqué, qui
  n'est jamais dessiné — c'est un déclencheur technique, pas un bouton. C'est le
  dernier élément natif de la page RTA.
- **Les cases de la palette de couleurs** : un aplat sans contenu ni libellé, dont
  le marqueur est un anneau et non une teinte. Un seul usage.
- **Les entrées de la barre latérale** : ce sont des liens de NAVIGATION, pas des
  actions — pleine largeur, alignées à gauche, fond au survol seul, sans pression
  au clic. Les faire passer par `Bouton` (centré, `flex-none`, pressé au clic)
  demanderait d'annuler la moitié de ses axes au point d'appel.
- **La case de relique** (`MonsterGear`) et **la pilule de lead** : leur marqueur
  est la couleur `star`, un code du JEU et non un ton d'interface.

Et **les contrôles qui ne sont pas des contrôles** ne comptent pas : un
`<input type="file">` masqué (déclencheur technique jamais dessiné), une poignée
qui porte `draggable`, une surface de carte rendue cliquable. Ce sont des
mécanismes, pas des boutons.

> ⚠️ **Ces exceptions doivent rester rares et JUSTIFIÉES ici.** Une exception non
> écrite est une divergence qui recommence.
