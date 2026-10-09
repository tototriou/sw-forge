# Meilleurs artéfacts offensifs pour ce build

**Statut :** ÉTAT ACTUEL — décrit le bloc « Meilleurs artéfacts offensifs pour ce build »
**Lire si :** on modifie la proposition d'artéfacts offensifs, ses deux crans ou son affichage

2 bis. **« Meilleurs artéfacts offensifs pour ce build »** — dans la carte
   **Artéfacts**, juste sous les **sous-propriétés verrouillées** : le
   résultat suit immédiatement les réglages qui le produisent, sans qu'un
   autre sujet ne s'intercale. La meilleure paire pour l'équipement
   **affiché**, avec ce
   qu'elle apporte face à celle qui est portée. Optimise les artéfacts
   **seuls**, sans lancer de recherche de runes : le cas visé est un monstre
   runé pour un autre objectif (un tank fait pour survivre) à qui les artéfacts
   ajoutent des dégâts par-dessus.

## Emplacements figés

⚠️ **Ce bloc RESPECTE les réglages de la carte, et le DIT** — il ne cherche
pas dans son coin. La question « quels sont mes meilleurs artéfacts » et la
question « quelle paire supposer pendant la recherche de runes » partagent
donc une seule réponse : deux blocs qui se contrediraient à l'écran
coûteraient plus cher qu'un bloc parfois muet. Concrètement :
- **un** emplacement sur « Garder l'artéfact équipé » → la proposition
  reste faite, et **deux signaux** disent qu’une moitié est imposée :
  un **bandeau au-dessus de la paire** (« Emplacement attribut figé — il
  est gardé tel que porté, pas optimisé ») et un **marqueur « figé » sur
  la pièce concernée**. Les deux répondent à des questions différentes —
  le bandeau dit *ce qui se passe*, le marqueur dit *laquelle* — et sans
  le second il fallait retraduire « attribut » en « celle de gauche ».
  La pièce figée est en outre **légèrement atténuée** (80 %), pour que
  l’œil tombe d’abord sur la moitié réellement cherchée.
  La question garde tout son sens : « à artéfact d'attribut donné, quel
  type ? » ;

  ⚠️ **80 %, et surtout pas moins.** Le vocabulaire « désactivé » de
  l’application vit à 30-40 % : descendre là ferait lire
  « indisponible » une pièce qui est justement celle qu’on portera.
  L’atténuation établit une hiérarchie, elle ne retire rien.

  ⚠️ **Le bandeau est NEUTRE APPUYÉ, pas ambre.**
  Un réglage que l’utilisateur a lui-même posé n’est pas un
  avertissement : l’ambre reste réservé à ce qui réclame une action
  (« Valider les artéfacts »), et deux ambres de sens différents dans la
  même carte auraient dévalué les deux. Le contraste vient du contour
  (plein, là où le bloc porte un contour atténué) et de l’encre pleine.
  Une mention en petit texte grisé sous le titre, loin du regard,
  laisserait lire la paire comme deux propositions.
- **les deux** figés → le bloc explique qu'il n'y a rien à chercher, au
  lieu d'annoncer « tu portes déjà la meilleure paire » — ce qui serait
  vrai, mais uniquement parce qu'on lui a interdit de chercher.

⚠️ **Le bloc ne DISPARAÎT jamais en silence.** Quand la paire retenue
n'apporte aucun dégât brut, il affiche la raison, et aucun chiffre :
un « 0 / coup » se lirait comme un résultat alors que rien n'a été cherché.
Un bloc qui s'effacerait irait et viendrait : avec un emplacement figé il
n'y a qu'une paire candidate, qui porte ou non ces lignes.

⚠️ **L’écart s’affiche dans les DEUX sens.** Ne l’afficher que positif
cacherait exactement l’information défavorable, en laissant un absolu
qui a l’air d’un gain. Un écart négatif n’est pas
une anomalie — la paire portée sort des candidates dès qu’une contrainte
l’exclut (principale imposée, ligne verrouillée, ou pièce déjà réservée
par un autre monstre de la liste). Le nombre dit alors ce que cette
contrainte coûte, ce qui est précisément ce qu’on veut savoir.

⚠️ **La proposition est ACTIONNABLE.** Un bouton en pied de bloc réserve
la paire proposée — sans lui, il faudrait la retrouver à la main dans
l’inventaire. Deux gestes derrière un seul bouton, que le libellé
distingue :
- sur un exemplaire **déjà validé** — « Valider ces artéfacts » : seule la
  paire change, les runes réservées ne bougent pas ;
- sur un exemplaire **pas encore validé** — « Valider ce build avec ces
  artéfacts » : réserver une paire seule fabriquerait une entrée sans
  runage, que tout le reste lit comme « 6 runes ». Le bouton annonce donc
  ce qu’il réserve en plus.

Une fois la paire réservée, le bouton passe à **« Artéfacts validés »**,
désactivé — même grammaire que « Valider ce build ». Il n’apparaît
qu’avec une **liste active** : une réservation appartient toujours à une
liste.

## Deux crans : dégâts supplémentaires ou dégâts réels

**Deux crans**, à choisir — un `Segmented`, jamais un bouton qui déclenche :
- **Dégâts supplémentaires** (défaut) — les dégâts bruts par coup des
  sous-propriétés 218-221. **Calculé en permanence** : la qualité première
  de ce bloc est d'apparaître sans qu'on l'ait demandé, et ce calcul est
  bon marché (ni sort, ni cible, ni critique).

  ⚠️ **Deux nombres, pas un** : ce que la paire retenue
  apporte **en absolu** (`2 145 / coup`), puis l'**écart** avec la paire
  portée (`+737`). Ils répondent à des questions différentes — « combien
  cette paire me rapporte-t-elle ? » contre « combien j'y gagne par rapport à
  maintenant ? » — et l'écart seul laisserait la première sans réponse : un gros
  gain sur une base nulle et un petit gain sur une grosse base afficheraient le
  même nombre.
  - L'**absolu s'affiche toujours**, y compris quand on porte déjà la
    meilleure paire — c'est justement là qu'il est seul à dire quelque chose,
    l'écart valant zéro.
  - L'**écart** s'affiche dès qu'il est **non nul à l'arrondi, dans les
    deux sens** (voir « L'écart s'affiche dans les DEUX sens » plus haut)
    — jamais quand la paire proposée est celle déjà portée.
  - La phrase qui NOMME le chiffre suit la même règle : présente dès qu'un
    nombre l'est — un nombre sans sa légende ne dit pas ce qu'il mesure.
    En dégâts réels, elle nomme le sort que le calcul a RÉELLEMENT retenu
    (`resolvedSkill`, issu de `resolveDamageSkill`), jamais l'identifiant
    stocké : « Dégâts totaux de « … » contre l’adversaire décrit », comme
    le résumé sous l'objectif (voir feat-ecran-objectif-de-recherche.md § Les quatre objectifs disponibles).
- **Dégâts réels** — les dégâts **totaux** du sort visé contre l'adversaire
  décrit. ⚠️ **Le moteur choisit une AUTRE paire**, il ne réaffiche pas la
  même autrement : une paire chargée en Dgts CRIT bat une paire chargée en
  218-221 sur le total, et perd sur le brut. Affiché `+X dégâts`.

⚠️ **Choisir « Dégâts réels » ouvre la fenêtre du combat**, comme le cran
homonyme de l'objectif de recherche. C'est ce qui rend ce cran légitime :
sans elle, il reposerait sur un sort, une cible et un mode de critique
jamais choisis. La fenêtre les rend vus et posés.

⚠️ Si **aucun sort du monstre n'est calculable**, le cran retombe sur les
dégâts supplémentaires **en le disant** — jamais un bloc vide ni un chiffre
brut sous un libellé « Dégâts réels ».

**Relique de la fiche.** Les deux crans comptent son effet
unique, recalculé pour chaque paire essayée, dans la valeur et dans
l'écart à la paire portée. Les points de Bravoure, Éternité et Origine
augmentent les statistiques lues par les lignes 218–221 ; Conquête
n'augmente jamais ces dégâts supplémentaires. En dégâts réels, Conquête
entre dans le terme DMG% ; Ténacité reste sans effet sur les dégâts
infligés. La principale n'est jamais comptée deux fois, les conditions
min/max restent hors combat et aucun arrondi de points n'est ajouté.
La paire représentative utilisée pour lancer la recherche compte aussi
l'effet unique en dégâts réels, comme elle le faisait en PV effectifs.
Les bornes explicites de faisabilité restent indépendantes de cette note ;
sans elles, le repli fige toujours les principales de la représentative.
Le script CLI note sa représentative par le même producteur
(`evaluateursArtefactsFiche`, via `artefactsDuCli`) : sans lui, il
lancerait la recherche avec une autre paire que l'écran. Son repli
diffère : sans sort calculable en « Dégâts réels », il garde la
paire portée au lieu de noter en régime « aucun » comme l'écran.
Les paramètres de choix des paires (inventaire, pièces portées,
principales, verrous, amplifications de buff, maximums actifs) viennent
eux aussi d'un seul producteur, `parametresArtefactsFiche`, que l'écran
appelle dans son mémo, le script CLI et le différentiel relique aussi.
Le script neutralise donc les verrous de sous-propriété comme l'écran
quand les deux emplacements sont sur « Garder l'artéfact équipé » :
sinon il chercherait une paire qui les tienne, n'en trouverait aucune et
rejetterait chaque build d'une recette que l'écran résout. Seul écart : le script
n'a pas de liste de travail, donc aucun artéfact réservé n'est retiré de
son inventaire.

## Affichage et emplacement de la proposition

**Chaque artéfact proposé s'affiche comme dans le jeu** : sa statistique
principale en tête, puis **une ligne par sous-propriété** avec le nombre de
procs à gauche, la valeur en gras et le marqueur des propriétés modifiées.
⚠️ Le rendu est **partagé avec la tuile d'inventaire**
([ArtifactSubLigne.tsx](src/components/ArtifactSubLigne.tsx)) : jamais un
rendu propre à ce bloc — un rendu qui aplatit les quatre propriétés sur
une seule ligne séparée par des « · » se replie n'importe où et ne
ressemble pas au jeu.

⚠️ **Jamais à la place des artéfacts de la fiche** : celle-ci montre
l'équipement RÉEL, et y substituer une proposition ferait croire à un
équipement qu'on ne porte pas. Le bloc vit dans la carte **voisine**,
sous « Exemplaire » — la fiche dit ce qu'on
PORTE, la carte Artéfacts ce qu'on DEVRAIT porter, et elles se touchent.
Le bloc est ainsi avec les réglages qui le pilotent, au lieu d'en être
séparé par une carte entière.

⚠️ **Encadré à part dans la carte** (contour atténué, fond `panel2`),
sous les sous-propriétés verrouillées : la carte porte deux métiers.
Attribut, Type et les verrous au-dessus sont des critères de la
recherche de runes, appliqués à tous les builds qu'elle examine ; le bloc
ne parle que du build affiché.

Quand la paire portée est déjà la meilleure, l'écran le **dit** au lieu
d'afficher « +0,0 % » — un zéro ressemble à une panne, la phrase est une
réponse. Et si des lignes sont verrouillées, ce qu'elles coûtent est chiffré
là aussi (« vos lignes verrouillées coûtent −3,6 % **sur ce build** »).
⚠️ « sur ce build » n'est pas une précaution de langage : la recherche de
runes tourne elle aussi sous le modèle contraint, donc sans les verrous
d'AUTRES builds auraient pu émerger. Le chiffrer exigerait de relancer toute
la recherche.

⚠️ **Il vaut pour TOUS les objectifs de recherche, et c'est son cas
principal.** Un monstre optimisé en efficience, en PV effectifs ou en
vitesse porte de gros PV/DEF/VIT — que les lignes « Dégâts supp. en
proportion de… » convertissent en dégâts. Son build de runes est déjà figé
par un autre objectif, et les artéfacts se posent par-dessus sans y toucher.
C'est exactement la situation que cette fonctionnalité vise.

Le titre le dit alors : « Meilleurs artéfacts **offensifs** pour ce build »
— sur une recherche d'efficience, « meilleurs artéfacts » tout court
laisserait croire qu'ils servent cet objectif-là. Ne pas l'intituler
« Optimiser mon build actuel » : les runes ne bougent pas, et sur un écran
qui optimise des runes ce titre se lirait « lance la recherche à partir de
ce que je porte ».

⚠️ La paire proposée n'est donc PAS celle que la recherche de runes suppose :
celle-là maximise l'objectif de recherche, celle-ci maximise les dégâts. Les
deux coïncident en « Dégâts réels » et divergent partout ailleurs.

La statistique principale exigée et les lignes verrouillées sont respectées
dans les deux cas — une contrainte posée reste une contrainte.

