# Speed tuning — importer un deck de siège

Partie de [Outils · Speed tuning](README.md).

## Importer un deck de siège

⚠️ **L'autre sens existe aussi** : depuis un deck de siège, « Voir le speed
tune » ouvre **cet outil en modale** par-dessus la page du siège, équipe déjà
chargée dans « Ton équipe » (`deckInitial`, `entete={false}` — la modale porte
déjà le titre) **et l'analyse lancée d'office** (une fois les kits chargés).
⚠️ Ne pas confondre avec le bouton « Importer un deck » ci-dessous, qui lui ne
relance rien. Voir [../siege/](../siege/).

⚠️ **Bandes `compactes` et AUCUN pied** : c'est une modale de consultation — on
n'y valide rien, on lit un outil. Un « Fermer » en bas ferait doublon avec la
croix et coûterait ~50 px, soit deux lignes du tableau de ticks sur une modale
qui prend déjà 90 % de la hauteur. Voir [../../03-developpeur/interface/](../../03-developpeur/interface/),
« Les deux bandes d'une modale ».

Reprendre une composition déjà réglée plutôt que retaper trois monstres et
trois vitesses de runes. Calcul pur dans
[speedTuneDeck.ts](src/lib/speedTuneDeck.ts), **testé**
([tests/speed-tune.test.ts](tests/speed-tune.test.ts)).

- **Les deux camps** ont le bouton, sur la même liste : à gauche on reprend sa
  propre composition, à droite la **défense qu'on affronte** — c'est là qu'une
  équipe de siège enregistrée sert le plus (on l'a déjà rencontrée). Il ouvre un
  **flottant** listant les équipes de **Défense** puis d'**Offense** du siège
  (portraits + noms des monstres, `teamSummary`) — une équipe sans aucun monstre
  connu n'y figure pas.
- **Toujours affiché, désactivé** sans compte chargé (aucune équipe) : son
  `title` dit pourquoi.
- ⚠️ **Le lead du camp est un LEAD DE JEU, pas un pourcentage.** Il porte sa
  **portée**. L'encart « Lead » a **un seul menu**, en deux groupes — « Tous les
  alliés » et « Par élément » —, plus la **pastille des decks** (`LeadPill`,
  icône officielle du jeu comprise) dès qu'un lead est posé.

  Sa liste est **lue dans les données** (`leadsDeVitesse`), jamais écrite à la
  main : le jeu a des +10, +15, +16, +17 et des leads d'élément à +23 et +30
  qu'aucune constante ne contiendrait. Les portées **Arène** et **Donjon** en sont
  écartées — elles ne comptent pas en siège.

  ⚠️ **Un seul menu, pas deux** (montant × portée) : « +23 % alliés Eau » n'est
  pas « +23 % » plus « Eau ». Séparés, les deux sélecteurs laisseraient composer
  des leads qui n'existent pas dans le jeu.

- ⚠️ **Le lead se devine à partir de l'équipe.** Un monstre du camp porte un lead
  de vitesse ? Il se pose tout seul dans l'encart (le plus fort si plusieurs — un
  seul leader agit). Aller le redire à la main serait une saisie pour rien.
  Dès qu'on touche au menu **ou** qu'on importe un deck, ce défaut ne repasse
  jamais : « Sans » est un choix comme un autre, et un réglage qu'on ne peut
  pas poser vaut moins que pas de défaut du tout.

  > ⚠️ **Deux détours, tous deux faux.** Ne garder que le montant
  > perdrait les leads d'élément : le speed tune calculerait plus lent que la
  > card de siège, qui les compte — un « il manque X de VIT » portant sur une
  > vitesse que personne n'a sous les yeux. Les recopier sur chaque monstre
  > (`Ligne.lead`) rendrait le sélecteur du camp décoratif et obligerait à
  > trafiquer les lignes une par une. Le camp porte le lead entier ; chaque
  > monstre en reçoit ce qui lui revient, via le `siegeLeadFor` du siège.

- ⚠️ **En lançant l'analyse, le camp d'en face prend le lead du tien**, portée
  comprise. L'adversaire de référence est une **copie** de ton monstre le plus
  rapide : un repère qui court moins vite que son modèle déclarerait tuné
  n'importe quoi. C'est un point de départ, pas un verrou — les deux encarts
  restent modifiables. ⚠️ **Sauf si une vraie composition est en face** : elle a
  son propre lead, et l'écraser recalculerait de vrais adversaires avec le tien.

  > ⚠️ Ce lead hérité est marqué comme **CHOISI**. Simplement écrit, le défaut
  > « lead présent dans l'équipe » le reprendrait au rendu suivant : la référence
  > retomberait au lead de son camp d'accueil — souvent aucun —, deviendrait plus
  > lente que le monstre qu'elle copie, et l'outil déclarerait tuné à peu près
  > n'importe quoi.

- **L'artéfact « Effet aug. VIT » est repris** du `gear` du slot (code `206`
  dans `ARTIFACT_SUB`, sommé sur les deux artéfacts) : c'est lui qui amplifie le
  buff de vitesse, il n'a pas à être ressaisi.
- ⚠️ **Les sorts choisis du camp sont OUBLIÉS** : ils sont rangés par monstre
  (`camp:id`) et survivraient sinon à un import — on rejouerait le choix fait pour
  l'équipe précédente, et l'outil compterait un effet que le siège écarte. Deux
  verdicts sur la même équipe.
- ⚠️ **Importer dans « Ton équipe » rend l'ordre des sorts aux VITESSES**
  (`ordreApresImport`) : l'ordre voulu est vidé et n'est plus « rangé ». Sans
  ça, un ordre figé par un ▲▼ — même sur une équipe d'il y a longtemps, il est
  conservé — ne suivait plus que la composition : le deck y entrait dans
  l'ordre de ses slots, leader en tête, et un monstre lent passait « premier »,
  l'analyse poussée jugeant un ordre que personne n'a choisi. Un import **en
  face** n'y touche pas : l'ordre ne range que des alliés.
- ⚠️ **Le deck REMPLACE la composition du camp** où l'on a cliqué : un deck est
  une équipe, pas une liste de monstres à empiler — sans ça, importer une
  deuxième défense entasserait six monstres du même côté. Ce qui est dans **ce
  camp** est donc perdu (vitesses corrigées, modificateurs) ; **l'autre camp
  garde tout**, et le deck reste dans Siège, réimportable à volonté. Le même deck
  peut être importé **des deux côtés** (`uid = camp:id`), pour se comparer à
  soi-même.
- **Lead** : celui du **leader du deck** (slot 0, convention du siège), écrit sur
  le camp qui reçoit l'import — ⚠️ **toujours, « Sans » compris** : un deck sans
  lead de vitesse laisserait en place celui du deck précédent, et l'on calculerait la
  nouvelle équipe avec un bonus qui n'existe plus (le siège, lui, lit `lead ?? 0`,
  d'où deux réponses sur la même compo). Sa **portée est conservée** :
  `General` / `Guild` valent pour tout le camp ; un lead d'**élément** ne vaut
  que pour les monstres de cet élément (`siegeLeadFor`). Un lead Arène ou Donjon,
  inactif en Siège, devient « Sans ». Un lead absent des raccourcis de
  `SPEED_LEADS` est **ajouté au menu** du camp, sinon il s'afficherait vide.
- **Le set Rapidité est repris** du slot (`sets` contient `swift`) : la vitesse
  de combat importée est alors identique à celle qu'affiche le siège.
