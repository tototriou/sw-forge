# Speed tuning — compétences déclenchées par le tour

Partie de [Outils · Speed tuning](README.md).

## Compétences (déclenchées par le tour)

⚠️ **C'est ce qui rend l'outil automatique.** Un Eshir (grosse vitesse de base,
compétence qui remplit la barre des siens) n'a plus à être posé à la main dans
la grille, tick par tick : on déclare sa compétence **sur sa card**, elle frappe
là où sa vitesse le fait jouer, et **suit** quand les vitesses changent. Saisie
dans les **deux camps** — l'adverse qui remplit la barre des siens est justement
celui qu'on cherche à devancer.

### Lues automatiquement dans le kit

⚠️ **Rien ne se saisit : l'utilisateur n'a pas à aller chercher ce que fait le
monstre, et la card n'a AUCUN champ pour ça.** Les deux valeurs sont lues dans
les compétences pré-générées (`public/data/skills/<com2usId>.json`, un seul point
d'entrée `chargerDetail`) — lecture pure dans
[speedTuneKit.ts](src/lib/speedTuneKit.ts), **testée**
([tests/speed-tune.test.ts](tests/speed-tune.test.ts)).

⚠️ **Pas de champs de saisie « Boost ATB » ni « Buff SPD » sur la card** : avec
la détection automatique, ils ne serviraient à rien. Un cas que la détection
ne couvre pas (effet sur un seul
allié, passive, compétence qu'on ne jouera pas) se pose **dans les deux grilles
par tick**, qui restent la porte de sortie manuelle.

- **Seuls les effets DE ZONE** (`aoe`) sont retenus : `Increase ATB` → boost,
  `Increase ATK SPD` → buff (+30 %, la valeur du jeu — les données ne donnent
  que sa **durée**). ⚠️ Un « remplit **TA** barre » (`surSoi`) ou un boost sur
  **un** allié est **écarté** : le modèle applique l'effet à tout le camp, les y
  verser gonflerait l'équipe entière.
- **Les compétences PASSIVES sont écartées** : elles partent sur une condition
  (quand il est attaqué, à la mort d'un allié…), pas au tour du monstre.
- **La plus forte l'emporte** quand plusieurs compétences remplissent la barre :
  c'est celle qu'on joue pour lancer le combo.
- ⚠️ **SKILL-UPS : la compétence compte MAXÉE.** La valeur de SWARFARM est celle
  du **niveau 1** ; les améliorations « Attack Bar Recovery +N% » la
  **MULTIPLIENT**, elles ne s'y ajoutent pas (comme pour les soins) — le
  **Trade de Conrad** remplit **20 %** au niveau 1 et **23 %** maxé (20 × 1,15),
  le **Tailwind de Bernard 2A** **30 %** et **34,5 %** (+5 puis +10). Même
  convention que les rechargements (`paliersCooldown`) : on joue maxé. **L'écran
  le DIT** — une ligne d'avertissement sur la card (« Tailwind compte MAXÉE :
  34,5 %, dont +4,5 % de skill-up »), au dixième — sans quoi on règlerait sa
  vitesse sur un gain qu'on n'a pas encore.

  > ⚠️ **Règle donnée par l'utilisateur, pas encore relevée en jeu.** Les
  > additionner surestimait chaque boost monté (Conrad à 35 %, Bernard à 45 %).
  > Hypothèse retenue : les améliorations se **somment**, puis multiplient une
  > fois ; composées une à une, elles donneraient 23,15 % et 34,65 %. La
  > simulation garde la valeur exacte, seul l'affichage arrondit
  > (`pourcentBarre`).
- Une valeur déjà posée n'est **jamais** réécrite par une relecture (`kitLu`).

### Ce qu'un sort fait, CIBLE par cible

⚠️ **La cible compte autant que la valeur.** *Breeze* (Kroa) remplit la barre
d'**UN** allié — celui qui l'a la plus basse — pas de toute l'équipe : les
confondre triplerait son effet. *Wood Vine* **vide** la barre d'un adverse, ce qui
aide tout autant à passer devant lui. D'où `EffetSort`
([speedTune.ts](src/lib/speedTune.ts)), appliqué au tick où le lanceur joue :

| Champ | Ce que ça fait |
|---|---|
| `atbEquipe` | +% de barre à **tout son camp**, lui compris |
| `atbAllie` | +% de barre à **UN** allié : celui dont la barre est la plus basse |
| `atbSoi` | +% sur **sa** barre |
| `atbEnnemi` / `atbEnnemiTous` | −% de barre à l'adverse (le plus avancé), ou à tous |
| `buffEquipe` / `buffSoi` | +30 % de vitesse, à partir du tick **suivant** |
| `buffAllie` | +30 % de vitesse à l'allié **visé** — la même cible qu'`atbAllie` |
| `ralenti` / `ralentiTous` | −30 % de vitesse sur l'adverse (le plus avancé, ou tous) |

- ⚠️⚠️ **`aoe` ET `surSoi` NE S'EXCLUENT PAS**, dans les données du jeu. `aoe +
  surSoi` veut dire « **tout le camp, lui compris** » — c'est la forme NORMALE
  d'un boost d'équipe, pas un boost sur soi. Tester `surSoi` en
  premier ferait tomber le S3 de **Jeogun** (*Blossom Painting* — « increases the Attack Power
  of all allies for 2 turns and their Attack Bar by 10% ») dans « lui
  seul », et le reste de l'équipe ne recevrait rien. La règle, dans cet ordre :

  | drapeaux | cible |
  |---|---|
  | `aoe` | **tout le camp**, `surSoi` ou non |
  | `surSoi` sans `aoe` | lui seul |
  | ni l'un ni l'autre | **UN** allié (la barre la plus basse) |

  ⚠️ Cette dernière ligne vaut aussi pour le **buff de vitesse** : `aoe=false,
  surSoi=false` sur un *Increase ATK SPD*, c'est un buff sur l'allié VISÉ, donc
  `buffAllie` — ni rangé dans `buffSoi` (le lanceur hériterait d'un buff qu'il
  **donne**), ni ignoré.

  Même règle pour le buff de vitesse et pour le **comptage des buffs d'équipe**
  (`buffsEquipe`, qui nourrit l'estimation des passifs à cumuls) : un effet
  **bénéfique** de zone va sur les alliés, que le lanceur en profite ou non.
- ⚠️ **La cible se DÉSIGNE** (`cibleAllie`) quand le sort laisse viser — « increases
  the Attack Bar of **the target ally** », le S3 de Sapsaree. La barre la plus
  basse n'est qu'un **défaut raisonnable**, pas une règle du jeu : l'ordre des
  sorts porte donc un « sur : … » à côté du sort, listant les alliés du lanceur.
  Il s'affiche dès que le sort porte `atbAllie` **ou** `buffAllie` : un sort qui
  ne fait que buffer vise lui aussi.
- ⚠️ **UNE cible pour le sort, pas une par effet.** `atbAllie` et `buffAllie`
  sortent du même sort : ils sont résolus **une seule fois**, ensemble. Les
  résoudre séparément aurait rempli la barre de l'un et buffé l'autre.
- ⚠️ **Le lanceur PEUT se viser lui-même** — le jeu l'autorise, et c'est le geste
  recherché quand le sort porte un buff de vitesse : *Rabbit's Agility* (Racuni,
  Harg, Dova) rend son tour au lanceur **et** l'accélère de 30 %. Il figure donc
  dans la liste des cibles, marqué « (lui-même) ».
- ⚠️ **Mais jamais PAR DÉFAUT** : sa barre vient de retomber à 0, il serait
  systématiquement « celui qui l'a la plus basse » et se rendrait à lui-même un
  boost dont personne ne compte. Se viser soi-même est un **geste**, pas le
  défaut.
- ⚠️ **Un retrait de barre et un ralenti ne sont JAMAIS appliqués
  automatiquement** — voir « Ce qu'on retire à l'adverse » ci-dessous. Le moteur
  sait les jouer (`atbEnnemi`, `ralenti`, sur l'adverse le plus AVANCÉ, celui
  qu'un joueur vise), mais l'analyse les coupe du sort avant de le lui donner
  (`sansReductionAdverse`).
- ⚠️ **Buffs et ralentis ne s'empilent pas** (le jeu n'en garde qu'un de chaque) :
  on retient le plus fort de chaque côté. Mais ils **se compensent** — +30 sur
  une cible ralentie de 30 la ramène à sa vitesse de base, comme en jeu.
- ⚠️ **Le taux de réussite est affiché, pas simulé** : un effet à 70 % est
  appliqué **comme s'il passait**. Un speed tune se règle sur le cas où le sort
  fait ce qu'on attend ; le taux figure dans le menu pour qu'on sache sur quoi
  l'on parie.

### Tour supplémentaire (« rejoue »)

⚠️ **Un tour rendu tombe AU MÊME TICK.** Aucune horloge ne tourne entre les deux :
les autres ne gagnent **rien** — c'est ce qui fait que « un seul monstre par
tick » n'est pas violé, c'est le **même** monstre qui joue deux fois d'affilée.
Détecté dans le kit par l'effet `Additional Turn` (`rejoue` sur `SortVitesse`).

- Le second tour lance **une autre compétence**, désignée dans l'analyse poussée
  (`sort2`). ⚠️ **Rien par défaut** : reprendre la même
  compétence gonflerait le boost d'un facteur deux sans qu'on l'ait demandé.
- Il n'ajoute **pas** un premier tour de plus : `premiersTours` continue de ne
  retenir que le premier de chaque monstre, donc l'ordre et le verdict de chaîne
  ne bougent pas.
- Dans le tableau des barres, la case du tick garde le badge du **premier** tour.

### Passifs de vitesse

Un passif ne part pas au tour du monstre : la simulation l'écarte (voir plus
haut). Mais certains décident du tune — **Shumar** gagne **+15 de vitesse en
permanence**, **Elsharion +5 par buff allié**, **Misty +15 % par tour adverse**.
L'outil les **lit et les applique** : [speedTunePassif.ts](src/lib/speedTunePassif.ts),
**testé** sur les cas relevés en jeu.

- ⚠️ **La VALEUR est lue, le NOMBRE DE FOIS se saisit.** Un gain permanent
  (Shumar) entre tout seul dans la vitesse de combat ; un gain « par
  déclenchement » (buffs portés, tours adverses, attaques) demande un chiffre —
  c'est la seule chose que les données ne peuvent pas savoir.
- ⚠️ **Sauf pour les BUFFS PORTÉS, qui s'estiment** (`cumulsEstimes`) : trois
  sources se connaissent d'avance — la **Volonté** (elle pose une Immunité dès le
  premier tour), le **Bouclier** et les **buffs de zone que les alliés lancent**
  (immunité, ATQ/DEF, buff de vitesse), comptés sur le sort retenu de chacun.
  ⚠️ **Volonté et Bouclier ne se comptent pas pareil** : la Volonté est
  personnelle (elle protège son porteur), le Bouclier ne l'est pas — un seul
  monstre en Bouclier dans l'équipe, et **tout le monde** en porte un.
  Chilling avec la Volonté dans une équipe qui pose un bouclier et un buff de
  vitesse porte donc **3 buffs → +60 de vitesse**.
- ⚠️ **SUR QUI les buffs se comptent dépend du passif**, et le jeu le dit mot
  pour mot :

  | Monstre | Texte du jeu | Ce qu'on compte |
  |---|---|---|
  | Chilling | « … according to the number of beneficial effects currently **on you** » | les buffs de **ce monstre** |
  | Elsharion | « increases your Attack Speed by 5 for each beneficial effect granted **on the allies** » | les buffs de **toute l'équipe** |

  Le gain reste **propre** au monstre dans les deux cas — c'est sa vitesse à lui
  qui monte. Ce qui change, c'est le périmètre de ce qu'on compte, porté par
  `GainVitesse.cumulEquipe` et lu dans le texte du passif. Confondre les deux
  sous-compterait Elsharion de tous les buffs de ses alliés.

  Et c'est là que la différence Volonté / Bouclier se voit vraiment : une équipe
  de 3 avec **un** set Bouclier et **deux** sets Volonté porte
  **3 + 2 = 5 buffs** — un bouclier sur chacun, plus deux immunités —, soit
  **+25 de vitesse** pour Elsharion. Compté comme pour Chilling, on en trouverait
  2, et il manquerait 15 de vitesse.
- ⚠️ **L'outil le pose tout seul** dans la case « cumuls » d'une ligne jamais touchée — sans quoi une
  équipe arrivée du siège afficherait une vitesse ici et une autre là-bas. C'est une **estimation**, pas
  une vérité : elle suppose ces buffs posés au moment où le passif compte, et un
  chiffre **saisi n'est jamais écrasé**.

#### Le passif sur la card, et l'adversaire de référence

- **Une rangée à part sur la card**, sous les réglages : bouton **« Passif »**,
  le gain unitaire, le champ de cumuls s'il y a lieu, et **ce qui est appliqué**
  (« +30 VIT ») aligné à droite.
  ⚠️ **Le bouton est TOUJOURS là** dès qu'un passif touche la vitesse, analyse
  lancée ou non : c'est une **propriété du monstre**, comme le set Swift, pas une
  hypothèse de l'analyse. Actif par défaut — un passif est toujours en vigueur en
  jeu — et on le coupe pour voir ce que vaut le tune sans lui.
- ⚠️ **Un passif change QUI est le plus rapide** : c'est pour ça que « Analyser »
  repose l'adversaire de référence sur le plus rapide du moment, en recopiant son
  set, son artéfact et son passif.
- ⚠️⚠️ **ELLE EST REPOSÉE AVANT L'ANALYSE, PAS APRÈS.** Posée à la fin
  d'`analyser()`, elle laisserait l'analyse tourner contre la référence de la
  fois **précédente**, et le verdict aurait systématiquement **une analyse de
  retard**.
  - Cas de contrôle : Chilling à **+220** des deux côtés, speed tune. On
    monte à **+221** et on analyse — la référence suit et coupe. On redescend à
    +220 : l'écran replace nos tours **en direct**, et la référence doit
    redescendre avec eux. Restée à +221, « Relancer » calculerait un adverse à
    +221 contre un allié à +220, le placerait au tick 4 devant nous au 5, et
    écrirait le buff de vitesse **un tick trop loin**.
  - ⚠️ **La PLACE compte autant que la vitesse** : à vitesse égale, c'est l'ordre
    du tableau qui départage (`placement`, voir `simuler`) — et ce cas est
    précisément une égalité. La référence est donc posée **en fin de liste**,
    exactement comme le fait `analyseAuto` ; sinon les deux chemins
    trancheraient l'égalité dans deux sens.
- ⚠️⚠️ **LA RÉFÉRENCE A SON PROPRE ESPACE DE NOMS** (`uidReference`,
  [speedTuneLignes.ts](src/lib/speedTuneLignes.ts) → `ennemi:ref:<id>`), pas
  l'uid ordinaire de son monstre — exactement celui qu'aurait une VRAIE
  ligne adverse pour ce même monstre. Quand le plus rapide de ton équipe se
  retrouve aussi en face (un **miroir**, cas courant en siège), poser la
  référence **supprimerait la ligne du vrai adverse** et la remplacerait par
  une copie de ton allié : le verdict porterait alors sur un plateau qui n'est
  pas le tien, **sans un mot à l'écran**.
  - **Un seul constructeur**, utilisé par `ligneReference` ET par l'écran qui
    passe `idReference` à l'analyse. Écrits séparément, les deux divergeraient et
    ce que l'analyse écrit n'atterrirait nulle part — un modificateur appliqué
    mais invisible, la faute que cette page interdit partout ailleurs.
- **Plafonds respectés** (`up to 100`, `up to 150 %`) ; ⚠️ « up to 10 **times** »
  est un nombre de cumuls, pas un plafond de vitesse.
- Un gain en **pourcentage** se compte sur la vitesse de **base**, comme le totem
  et le lead.
- **Aucune valeur connue** → la card le dit en clair plutôt que d'appliquer 0 en
  silence : « son passif touche la vitesse, mais aucune valeur n'est connue ».

#### « Attack speed » : gain propre ou buff

⚠️ **Deux choses très différentes se cachent derrière « attack speed »** dans les
textes, et les confondre fausse tout :
- « Increases your Attack Speed **for 2 turns** » (Juno, Oracle) → le monstre
  gagne le **BUFF** du jeu : +30 %, dispellable, **amplifié par le spd buff
  effect** ;
- « increases your Attack Speed **by 5** for each… » (Elsharion), « Your Attack
  Speed **is increased by 15 %** » (Misty) → un **gain propre**, ni dispellable
  ni amplifié par l'artéfact.

Le discriminant est dans le texte : un **montant** (« by N ») = gain propre, une
**durée** seule (« for N turns ») = buff.

L'inventaire complet — **généré par la même lecture**, donc jamais divergent —
vit dans [feat-passifs-vitesse.md](feat-passifs-vitesse.md) (`node scripts/passifs-vitesse.mjs`).
Il classe aussi ce que l'outil **n'applique pas** : tours supplémentaires, barres
remplies ou vidées hors de son tour (⚠️ une barre « remplie » vaut **100 %**),
et les montants introuvables — dont quatre passives marquées **AUCUNE donnée
(vérifié)**, trous définitifs qu'il est inutile de rechercher.

### Quel sort chacun lance par défaut

⚠️ **Une priorité explicite, pas un score pondéré** (`sortRetenu`,
[speedTuneAuto.ts](src/lib/speedTuneAuto.ts)) — un ordre se discute, des
coefficients inventés ne se vérifient nulle part. Du plus large au plus étroit :

1. remplir la barre de **tout le camp** ;
2. **buffer la vitesse** de tout le camp ;
3. **se rendre son propre tour** (*Power of Mirkwood*, Legolas) ;
4. se buffer / se remplir **soi-même** ;
5. remplir la barre d'**un** allié — ou seulement **buffer sa vitesse**.

⚠️ **À rang ÉGAL, c'est le montant qui départage** — pas l'ordre des slots. Le
rang dit QUI est touché, jamais COMBIEN : Racuni porte deux sorts « sur un
allié », *Breeze* (+15 % de barre) et *Rabbit's Agility* (barre **pleine** +
30 % de vitesse). Les deux valant 5, retenir le **premier rencontré**
donnerait le S1 : l'analyse retiendrait le plus faible des deux, et le monstre
visé n'aurait ni sa barre remplie ni son buff. Le départage additionne le remplissage
et le buff de vitesse — à remplissage égal, celui qui buffe **en plus** l'emporte
(*Clear Blue Sky* de Tanjiro vent contre *Dancing Flash* : 50 % tous les deux,
seul le premier buffe).

⚠️ **Le rang PRIME toujours** : le montant ne fait pas remonter un sort d'un
cran. Un boost d'équipe minuscule reste au-dessus d'un gros boost sur un seul
allié — sans quoi la priorité ne serait plus une priorité, mais le score pondéré
qu'on a refusé.

⚠️ Ce départage change le sort retenu de **14 monstres sur 2411**, et chaque
bascule va vers le sort strictement plus fort : Racuni / Harg (feu et lumière) /
Dova (15 % → barre pleine + buff), Twin Angels et Jaduel et Aepiah (10 % →
100 %), Dr. Plasma / Dr. Felix (10 % → 20 %), Fern (30 % → 35 %), Azure Dragon
Swordsman et Tanjiro vent (50 % → 50 % **plus** le buff).

Et **deux exclusions**, qui ont chacune fait mentir un verdict :

- ⚠️ **Vider la barre de l'adverse n'est JAMAIS retenu** — et va plus loin que le
  choix du sort : voir « Ce qu'on retire à l'adverse ».
- ⚠️ **Un sort à TAUX DE RÉUSSITE n'est jamais retenu.** Le *Glorious Attack* de
  Madeleine vide la barre adverse « avec 30 % de chances » : le compter déclarait
  l'équipe speed tune **sur un coup de dé**.

Les deux restent **choisissables à la main** dans l'ordre des sorts, en
connaissance de cause — le menu affiche l'effet et le taux.

⚠️ **« Aucun sort » est un CHOIX, pas l'absence de choix.** Les deux se disent
dans le même Record, et les confondre a fait mentir l'écran :

| valeur | sens | effet sur le Record |
|--------|------|---------------------|
| `''` | **Aucun sort** — il joue, mais rien qui touche la vitesse | **enregistrée** |
| `AUTO` | laisser le **kit** décider | l'entrée est **retirée** |

⚠️ **Une seule fonction pour les deux sorts** (`noterChoix`,
[speedTuneAuto.ts](src/lib/speedTuneAuto.ts)). Écrites séparément, elles
divergeraient : si le premier sort réservait la suppression à `AUTO` (juste)
et que le second supprimait sur `''` (faux), dire « Aucun sort » au **second
tour** effacerait le choix, et le kit rappliquerait son sort — le +15 % de
barre de Kroa reviendrait alors qu'on vient précisément de l'écarter, tick
après tick.

### Ce qu'on retire à l'adverse

⚠️ **Aucun retrait de barre ni ralenti n'entre dans le calcul du tune, jamais,
et même quand le sort est DÉSIGNÉ à la main.** Un speed tune, c'est ce qui tient
quand on n'a rien enlevé à l'autre : les monstres doivent jouer les uns après
les autres **sans ça**. Compter le −30 % de barre d'une Madeleine Cookie revient
à déclarer l'équipe tunée parce qu'elle aura freiné l'adverse — et le jour où le
frein rate, se voit résisté, ou tombe sur un monstre déjà passé, l'équipe se
coupe.

Concrètement : `sansReductionAdverse` (dans `src/lib/speedTune.ts`) retire
`atbEnnemi`, `atbEnnemiTous`, `ralenti` et `ralentiTous` du sort avant que
l'analyse ne le donne au moteur. Un sort qui fait **les deux** — remplir la
barre du camp ET vider celle d'en face — garde la moitié qui nous fait jouer et
perd l'autre. Les grilles n'en portent donc **aucune trace**, ce qui est cohérent
avec la règle « on affiche exactement ce qui est calculé » ; le menu de l'ordre
des sorts, lui, annonce l'effet suivi de **« (non compté) »**, pour qu'on ne
croie pas qu'il pèse.

⚠️ **La seule réduction qui compte est celle que l'utilisateur ÉCRIT lui-même**
dans la grille du modificateur de barre d'attaque : c'est une saisie, pas une
déduction, et le moteur l'applique telle quelle.

⚠️ **Le SECOND sort** (quand le premier rend le tour) suit la même règle sur ce
qui reste : sans lui, un monstre qui rejoue passerait son tour supplémentaire à ne
rien faire.

### Rechargement des compétences

⚠️ **Un sort ne repart pas à chaque tour.** Le rechargement (`cooldown` sur
`EffetSort`) se compte en **tours du lanceur** : un sort à 3 tours lancé à son
premier tour ne revient qu'au quatrième — entre les deux, le monstre joue autre
chose (son S1, dont on ne sait rien, donc rien du tout). Sans ça, la simulation
relancerait le S3 à **chaque** tour et l'équipe monterait bien plus vite qu'en jeu.

- La valeur retenue est celle de la compétence **MAXÉE** (`paliersRechargement`,
  dernier palier) : même convention que le gain de barre, on joue maxé.
- Le premier tour n'est jamais bloqué : c'est le tour qui compte pour l'ouverture,
  et c'est celui que le verdict regarde.
- Le menu de l'analyse poussée annonce le rechargement (« recharge 3 tours »).
- Le **second sort** d'un monstre qui rejoue a son propre rechargement.
