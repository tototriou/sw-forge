# Recommandations — confrontation avec mon compte

Partie de [Siège · Recommandations](README.md).

## Confrontation avec mon compte — bouton « Analyser mes decks »

Calcul pur dans [recoMatch.ts](src/lib/recoMatch.ts) → stats réelles via
`computeStats` ([stats.ts](src/lib/stats.ts)).

### À la demande, pas en continu

⚠️ **Rien n'est confronté par défaut.** Une carte non analysée est neutre : pas
d'aura, pas de pastille, pas de badge sur les monstres. L'analyse se lance **par
recommandation**, via le bouton **« Analyser mes decks »** de son en-tête — le
libellé dit bien que la confrontation porte sur **l'ensemble des decks**, pas
sur un seul.

⚠️ **Bouton à DEUX ÉTATS** : un clic analyse, un second **masque** le
résultat — le même geste que la croix « Masquer le résultat de l'analyse » de
l'encart. Il est enclenché (`aria-pressed`, fond d'accent) tant qu'une analyse
est affichée, avec « Masquer le résultat de l'analyse » en infobulle. Masquer
reste possible sans compte chargé (rien à calculer). Il n'y a pas de
« Réanalyser » : relancer se fait en deux clics, et relancer sans rien avoir
changé redonnerait le même résultat, puisqu'un résultat périmé est de toute
façon effacé (voir plus bas).

⚠️ **À la SOURIS seulement** (`compact:hidden`), étiqueté, à côté du titre — la
place ne manque pas. Au doigt, il n'est pas sur la carte : choisir SA carte
demanderait d'abord d'y faire défiler — un geste que le panneau « Options »
fait sans quitter le haut de l'écran (voir plus bas). Une icône de plus dans
un coin déjà chargé, pour un geste qui a un meilleur endroit, ne se justifie
pas.

⚠️ **Et seulement à partir de `lg`** (`max-lg:hidden` en plus de
`compact:hidden`) : sous ce seuil la page prend sa disposition téléphone,
panneau « Options » compris — même à la souris, dans une fenêtre étroite. Sans
cette seconde condition, le bouton apparaîtrait aux DEUX endroits, sur la
carte et dans le panneau. Un geste, un endroit : la carte à partir de `lg`, le
panneau en dessous.

- Le bouton est **désactivé sans compte importé** (rien à quoi comparer).
- Le résultat est **mémorisé dans le board** avec la reco et les builds qui ont
  servi ; il devient **périmé** dès que l'un des deux change (comparaison par
  **identité d'objet** : toute édition recrée les objets). La carte repasse alors
  à l'état non analysé et le bouton réaffiche « Analyser ».
- Motivation : confronter *toutes* les recos à *tous* les builds à chaque rendu
  serait un coût permanent pour une information qu'on ne consulte que ponctuellement.

### Analyser depuis le panneau « Options » — LE chemin au doigt

⚠️ Au doigt, analyser n'est plus un bouton sur la carte : c'est le panneau
« Options » qui porte le geste, avec un menu déroulant qui choisit **laquelle**
analyser (aucune carte n'est sous les yeux pour le dire), puis « Analyser » qui
fait le reste.

- Le menu liste les recommandations **affichées** (`list` — recherche déjà
  appliquée), avec le même nom de repli
  (« Recommandation N ») que sur les cartes.
- **Désactivé sans compte importé**, même condition que le bouton de la souris.
- Au clic sur « Analyser » : l'analyse se lance, la carte visée **s'ouvre**
  (elle serait sinon repliée et le résultat invisible au premier défilement),
  le panneau se referme, et un message éphémère confirme sur quelle
  recommandation.

### Ce que l'analyse affiche

Un **encart de synthèse** sous l'en-tête, visible **même recommandation repliée** :

- bandeau vert « Tout est respecté : les N deck(s) sont jouables » si tout passe,
  orange « N/M deck(s) au niveau · K à corriger » sinon ;
- puis **la liste de TOUS les decks analysés**, chacun avec son verdict, sa
  réserve (« réalisable N fois ») et, s'il y a lieu, le détail par monstre :
  - `Def 1` · **jouable · Offense 3** (vert)
  - `Trevor - Bella - Tarq` · **aucun deck avec ces monstres — tu peux le composer**
    (pas de détail : sans équipe, il n'y a aucun build à confronter)
  - `Def 2` · **monstre indisponible — deck impossible** → `Tarq — monstre indisponible`
  - `Def 3` · **runage, artéfacts et stats à revoir** →
    `Bella — set Violent manquant · artéfact d'attribut : Dégâts sur l'Eau +X% absent · VIT 117 au lieu de 212`
- aucun deck rempli → « Rien à analyser ».

#### Ordre de la liste — ⚠️ ROUGE → ORANGE → VERT

Du plus urgent au plus tranquille : **monstre manquant**, **à revoir**, **à
composer**, puis les **bons**. Ce qui demande du travail se lit en premier ; les
decks déjà jouables closent la liste au lieu de la précéder — sinon il faut les
dépasser pour atteindre ce sur quoi on peut agir.

- Des deux rouges, **`missing` passe devant `ko`** : rien de ce qu'on possède ne
  répare un monstre absent, alors qu'un « à revoir » se corrige le soir même
  avec les runes qu'on a déjà.

- ⚠️ **Tri STABLE sur le seul verdict** : à verdict égal, les decks gardent
  l'ordre de la recommandation, qui est celui de son auteur. Trier aussi à
  l'intérieur d'une famille les mélangerait sans que rien à l'écran ne dise
  pourquoi.
- ⚠️ **L'ordre des PASTILLES est l'inverse** (Bon · À composer · À revoir), et
  c'est voulu : une légende ordonne des catégories du meilleur au pire, une
  liste hiérarchise l'urgence. Deux objets, deux logiques.

#### ⚠️ Chaque ligne mène à SON deck

La ligne entière est un **bouton** : le résumé dit ce qui cloche, et le geste
suivant est toujours d'aller voir le deck. Sans ce lien, il faudrait déplier la
carte, retrouver le deck à l'œil parmi six, puis l'ouvrir — alors que la ligne le
désigne déjà.

Un clic **déplie la carte si elle est repliée** (le résumé reste visible carte
fermée — c'est tout son intérêt —, donc on clique souvent depuis une carte où le
deck n'est même pas rendu), **déplie le deck visé**, puis y **fait défiler**
(`scrollIntoView`, `block: 'center'`).

- ⚠️ Le défilement attend **une frame** (`requestAnimationFrame`) : la carte et
  le deck viennent peut-être d'être dépliés dans la même passe, et leur hauteur
  n'est pas encore posée — viser tout de suite calerait sur une position périmée.
- ⚠️ Pendant une **recherche**, seuls les decks trouvés sont rendus : un deck
  masqué n'a **aucune ref**. On ne fait alors rien plutôt que de sauter au
  hasard — le deck est bien déplié et réapparaîtra à sa place dès la recherche
  effacée.
- ⚠️ Le **détail par monstre reste HORS du bouton** : c'est du texte qu'on lit et
  qu'on veut pouvoir sélectionner, pas une cible de clic.

#### ⚠️ Les decks au niveau sont LISTÉS, pas seulement comptés

Les bons decks sont listés aussi, pas résumés en « 4/6 au niveau » :
« **lesquels** puis-je poser » est exactement la question qu'on se pose devant
une défense de guilde à remplir, et il faudrait sinon rouvrir la carte et
parcourir les decks pour y répondre.

- Un deck bon annonce **l'équipe qui le rend jouable** (« jouable · Offense 3 »),
  pas un simple « ok » : c'est elle qu'on va chercher en jeu.
- Le **détail par monstre reste réservé aux decks `ko`** : sur un deck au niveau
  il n'y a rien à corriger, et `nodeck` n'a aucun build à confronter.

#### Filtres de verdict — Bon · À composer · À revoir · Monstre manquant

**Quatre pastilles** sous le bandeau, une par statut réel, avec l'effectif de
chacune :

| Pastille | Couleur | Statut | Point |
|----------|---------|--------|-------|
| **Bon** | vert | `ok` | plein |
| **À composer** | orange | `nodeck` | plein |
| **À revoir** | rouge | `ko` | plein |
| **Monstre manquant** | rouge | `missing` | **creux** |

- ⚠️ **Le rouge est SCINDÉ en deux.** « À revoir » et « monstre manquant »
  partagent la couleur mais **pas le geste** : l'un se répare en rerunant ce
  qu'on possède déjà, l'autre demande d'invoquer et de monter un monstre qu'on
  n'a pas. Ce n'est ni le même horizon, ni la même décision. Fondus, il
  faudrait parcourir toute la liste rouge pour trier à l'œil ce sur quoi on
  peut agir le soir même.
- ⚠️ **Deux filtres, un seul rouge.** Les deux gardent la même couleur, `bad` :
  ils sont bloquants tous les deux, et c'est ce que la couleur dit. On
  n'introduit pas une cinquième couleur qui mentirait sur la gravité.
- ⚠️ **Le point de « Monstre manquant » est CREUX.** Deux pastilles de la même
  couleur côte à côte ne se distinguent plus que par leur texte, qu'on ne relit
  pas une fois la barre connue. Le creux dit « il manque quelque chose ». Il est
  porté aussi par la **ligne** correspondante de la liste, qui reprend donc le
  point du **verdict** et non `DOT[status]` — `DOT` reste la table de l'aperçu
  replié, où le vocabulaire à trois couleurs suffit.
- Le **détail par monstre** est affiché sur **les deux verdicts rouges** : « à
  revoir » dit quoi corriger, « monstre manquant » dit **lequel** manque — sans
  quoi on saurait le deck bloqué sans savoir par qui.
- ⚠️ **Cumulables** : on peut isoler vert **et** rouge à la fois. D'où des
  **pastilles indépendantes** et non un `Segmented`, dont le cadre commun dirait
  que les choix s'excluent.
- ⚠️ **Rien de coché = tout est montré.** Un écran de filtres tous éteints
  n'affichant rien se lirait comme une analyse vide. Cocher **restreint** ; un
  lien « Tout afficher » rétablit dès qu'un filtre est posé.
- Un verdict **sans aucun deck** est **grisé, jamais retiré** : on voit qu'il n'y
  en a aucun au lieu de chercher un bouton disparu. Même règle que les pastilles
  d'attribut de l'inventaire d'artéfacts.
- Le marqueur d'actif est la **bordure** (règle des pastilles de filtre, voir
  [../../03-developpeur/interface/](../../../03-developpeur/interface/)).
- État **local à l'encart** : il vit et meurt avec le résultat d'analyse.

Une fois analysée, la carte reprend tout le langage visuel décrit plus bas (aura,
pastille, badges de deck et de monstre, comparaison stat par stat).

#### Combien de fois le deck est montable — « réalisable N fois »

Chaque deck analysé affiche combien de fois il peut être monté **en parallèle**
avec la réserve du joueur (`deckCopies` dans
[recoMatch.ts](src/lib/recoMatch.ts)). C'est ce qui dit si on peut poser le même
deck sur plusieurs défenses de guilde.

**Affiché à deux endroits** : dans l'en-tête du deck, et sur **chaque ligne du
résumé d'analyse** — c'est là qu'on arbitre entre six défenses de guilde à
remplir, et un deck jouable une seule fois n'en couvre qu'une. Sur **tous les
verdicts**, pas seulement les bons : savoir qu'un deck à revoir n'existe de toute
façon qu'en un exemplaire change ce qu'on décide d'aller corriger.

- ⚠️ **Les 6★ UNIQUEMENT**, et depuis la **box seule**
  (`countCopiesByCom2us` dans [ownedBuilds.ts](src/lib/ownedBuilds.ts)) :
  - `collectOwnedBuilds` **agrège les presets** (RTA, défense, offense) : un
    même monstre y figure une fois par contexte. Compter dessus multiplierait
    les exemplaires par le nombre d'usages ;
  - la box ne retient que `class === 6` (voir
    [../transverse/](../../transverse/)), et chaque entrée
    est un `unit_id` distinct — donc une unité réelle. Un monstre en réserve à
    5★ ne se joue pas tel quel en siège.
- ⚠️ Le deck est limité par son **monstre le plus rare** (`min`, jamais une
  moyenne) : trois exemplaires de l'un ne servent à rien si le second n'existe
  qu'en un seul.
- ⚠️ Un monstre placé **deux fois dans le même deck** consomme **deux**
  exemplaires : les occurrences sont comptées avant division.
- ⚠️ **Rien n'est affiché** faute de compte importé ou sur un deck vide — un
  « 0 fois » affirmerait que le deck est immontable, ce qui est tout autre chose
  que « je ne sais pas ». **Zéro se dit en revanche**, et **en rouge** : c'est
  l'information la plus utile de la pastille.
- La pastille est **distincte du badge de statut** : ce n'est pas un verdict sur
  le deck mais une information de **stock**. Les fondre ferait lire
  « jouable ×2 » comme un degré de conformité.

**Fermer le résultat** : une **croix**, sur l'**encart de synthèse** (ses trois
états : vert, orange, « rien à analyser »), efface l'analyse et la carte
**redevient neutre** — halo, encart et badges disparaissent d'un coup. Utile
quand tout est vert : l'information a été lue, le halo n'a plus rien à dire. Il
suffit de relancer « Analyser mes decks » pour la revoir.

⚠️ **Pas de pastille en-tête redondante.** Une seconde pastille dans l'en-tête
(« 1/4 decks au niveau ») reprendrait, un cran plus haut, exactement ce que
dit déjà l'encart de synthèse juste en dessous, lui-même visible carte repliée
(voir plus haut) : deux endroits pour la même phrase, sur une carte déjà
chargée, sans qu'aucun n'apprenne quoi que ce soit que l'autre ne dise pas.

### ⚠️ Source : TOUS les builds, pas seulement la box

Dans SW, un monstre a **un preset de runes par contexte**. La box ne contient que
l'**équipement actuellement porté** : s'y limiter ferait échouer la
confrontation d'un deck… que le joueur possède exactement tel quel en siège
(« monstre non trouvé » et « à améliorer » juste après avoir importé son
propre deck d'offense).

`collectOwnedBuilds` ([ownedBuilds.ts](src/lib/ownedBuilds.ts)) rassemble donc
**tous les builds connus**, assemblés dans [App.tsx](src/App.tsx) :

| Source | Origine | Libellé affiché |
|--------|---------|-----------------|
| `box` | équipement porté (`BoxItem.gear`) | « Box » |
| `rta` | preset RTA (`RtaEntry.gear`) | « RTA » |
| `defense` | presets des équipes de défense | « Défense N » |
| `offense` | presets des équipes d'attaque | « Offense N » |

Conséquences :
- un monstre **présent dans un deck est possédé**, même s'il n'est pas dans la
  box 6★ → plus de faux « non possédé » ;
- la comparaison se fait sur le **meilleur build disponible**, pas sur celui qui
  se trouve être équipé au moment de l'export.

- **Plusieurs builds** pour un même monstre (exemplaires multiples × presets) :
  on retient le **meilleur** — celui qui satisfait le plus de critères (**stats
  atteintes + sets portés**, à poids égal), départagé par le **pire ratio
  atteint/exigé** le moins mauvais (le plus proche du build demandé). Ex. une
  reco Swift+Focus choisira le preset runé Swift, pas celui runé Violent.
- Le **build retenu est affiché** sous le monstre (« au niveau · Offense 3 »).
- Statut **par slot** :

| Statut | Sens | Rendu |
|--------|------|-------|
| `empty` | pas de monstre dans la reco | neutre |
| `absent` | **aucun build connu** pour ce monstre | bordure rouge, « monstre non trouvé » |
| `ko` | possédé mais ≥ 1 stat sous le minimum **ou** ≥ 1 set manquant | bordure orange, « à améliorer » |
| `ok` | possédé, **toutes** les stats atteintes **et** tous les sets portés | bordure verte, « au niveau » |

### Trois questions, dans cet ordre

L'analyse d'un deck répond à : **ai-je un deck ? est-il correct ? sinon, puis-je
le faire ?**

1. **Ai-je les monstres ?** Non → `missing` : le deck est **impossible**.
2. **Ai-je une équipe existante qui les réunit** (défense ou offense) ? Non →
   `nodeck` : tu as les monstres, **il reste à composer l'équipe**.
3. **Dans cette équipe, les stats/sets suivent-ils ?** Non → `ko`.

Le point 2 est la nuance qui compte : posséder les monstres ne veut pas dire
avoir le deck. `OwnedTeam` ([ownedBuilds.ts](src/lib/ownedBuilds.ts)) recense les
**équipes réellement composées** ; une équipe « correspond » si elle contient
**tous** les monstres du deck recommandé. À plusieurs candidates, on retient
celle qui satisfait le plus de critères. Les stats sont alors comparées **au
build de cette équipe-là**, pas au meilleur build tous contextes confondus.

| Statut | Couleur | Condition | Badge |
|--------|---------|-----------|-------|
| `missing` | `bad` | au moins un monstre **non possédé** | « monstre indisponible — deck impossible » |
| `ko` | `bad` | l'équipe existe mais **stats/sets insuffisants** | selon la cause, voir ci-dessous |
| `nodeck` | `warn` | monstres possédés, **aucune équipe ne les réunit** | « aucun deck avec ces monstres — à composer » |
| `ok` | `good` | l'équipe existe et tout est au niveau | « jouable · Offense 3 » |
| `unknown` | neutre | deck **vide** | — |

Statut **par slot** : `absent` (rouge, « monstre indisponible ») · `ko` (rouge,
libellé selon la cause) · `ok` (vert, « au niveau ») · `unknown` (neutre,
« possédé » — rien à confronter faute d'équipe) · `empty` (slot vide).

### ⚠️ Un `ko` dit LAQUELLE des causes

`slotFaults` / `deckFaults` ([recoMatch.ts](src/lib/recoMatch.ts)) séparent trois
défauts qui ne se réparent pas du tout pareil :

| Cause | Ce qui cloche | Badge du slot | Nom côté deck |
|-------|---------------|---------------|---------------|
| `sets` | pas le **runage demandé** → à reruner | « mauvais set de runes » | runage |
| `artifacts` | pas les **propriétés d'artéfact** demandées → à changer d'artéfact | « mauvaise statistique » | artéfacts |
| `stats` | le reste est bon, les **minimums** ne sont pas atteints → à améliorer | « stats insuffisantes » | stats |

Tout afficher sous « stats insuffisantes » enverrait le joueur optimiser des
sous-stats alors que le set lui-même n'est pas le bon — et, symétriquement, un
monstre bien runé mais trop lent se lirait comme un problème de runage.

⚠️ **Une LISTE de causes, pas une cause unique.** Les trois peuvent coexister ;
n'en annoncer qu'une masquerait le reste du travail. Le slot les joint par
` · ` ; le **deck** prend l'union de celles de ses slots.

⚠️ Côté deck, la formule est **« … à revoir »** et non « … non respectés » :
elle est **invariable**, donc elle se combine sans accord — « runage et stats à
revoir », « runage, artéfacts et stats à revoir » se construisent tout seuls quel
que soit le nombre de causes.

L'ordre est celui du **geste à faire** — runage, artéfacts, puis stats : reruner
change les stats, l'inverse n'est pas vrai. Même ordre dans le détail par
monstre.

**Mise en évidence** : dans un slot `ko`, les **lignes de stats non respectées**
sont surlignées (fond rouge léger, libellé rouge) — on voit ce qui bloque sans
lire les chiffres. Le slot fautif prend une bordure rouge, comme un slot dont le
monstre est indisponible : les deux sont bloquants.

- Statut **de la recommandation** (`matchReco`) = **agrégat de ses decks non
  vides**, aura de la carte SEULE (voir `AURA` dans RecoCard.tsx) — le résumé en
  mots ne vit plus qu'à l'encart de synthèse, voir plus haut :

⚠️ **L'aura se règle sur le MODE CLAIR, pas sur le sombre.** À 5–10 %
d'opacité, elle est lisible sur fond profond et invisible sur blanc — la carte
y paraîtrait neutre alors qu'elle signale un deck bloqué. Les opacités sont de
**20–45 % selon la teinte et la surface** (l'ambre, plus pâle, en demande plus
que le vert et le rouge). Une valeur qui « se voit » en sombre ne prouve
rien : c'est le clair qui fixe le plancher.

| Statut | Couleur | Condition |
|--------|---------|-----------|
| `ok` | `good` | **tous** les decks jouables |
| `partial` | `warn` | une partie seulement |
| `missing` | `bad` | **aucun** deck jouable, tous bloqués par un monstre manquant |
| `unknown` | neutre | **pas encore analysée**, ou aucun deck rempli |

- Sans compte importé : bouton « Analyser » **désactivé**, cartes neutres. Les
  recommandations restent consultables, éditables et exportables.
- Par stat, la vue affiche `minimum` puis **ta valeur** : verte avec ✓ si
  atteinte, rouge avec l'écart `(−X)` sinon.
- Par set, une puce **icône + ×2/×4** : verte avec ✓ si le set est porté, rouge
  avec ✗ sinon. Un set demandé 2× mais actif 1× → la **seconde** puce est rouge.
