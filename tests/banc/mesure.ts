// Règle de mesure du banc d'affichage — « rien ne déborde », axe horizontal
// seul, tolérance de 1 px partout.
//
// Un écran DÉBORDE si l'une de ces quatre conditions est vraie :
//
// - page : `documentElement.scrollWidth > L` ;
// - contenu : un élément visible dont `scrollWidth` dépasse `clientWidth`,
//   sauf si l'élément est lui-même un défilement voulu ;
// - géométrie : un élément visible dont le rectangle sort de la fenêtre, à
//   droite (`right > L`) ou à gauche (`left < 0`), sauf s'il est dans un
//   défilement voulu ou dans un ancêtre qui le coupe ;
// - chevauchement : réservée aux éléments qui bénéficient des exceptions
//   « pastille du portrait » et « bouton en coin » (plus bas), leur
//   contrepartie.
//
// Définitions :
//
// - L, la largeur de la fenêtre : `documentElement.clientWidth`, et NON
//   `innerWidth`. Au téléphone (contexte `isMobile`), Chromium élargit la
//   fenêtre de mise en page jusqu'au contenu qui déborde : une page de 508 px
//   dans 360 px y donne `innerWidth = 508 = scrollWidth`, et le débordement
//   disparaît de la mesure qui devait le voir. `documentElement.clientWidth`
//   reste à 360 (relevé : tests/banc/cas/page-oui.html). À l'ordinateur, les
//   deux valeurs coïncident (barres de défilement superposées) ;
// - élément mesuré : `body` et chacun de ses descendants (`html` relève de
//   la règle « page ») ;
// - visible : l'élément a une boîte (`getClientRects()` non vide — un
//   élément sous `display: none`, ou en `display: contents`, n'en a pas) ;
// - défilement voulu : `overflow-x` calculé `auto` ou `scroll`, ET une classe
//   qui le déclare sur l'axe x (`overflow-x-auto`, `overflow-x-scroll`,
//   variantes à préfixe comprises, ex. `sm:overflow-x-auto`). Une boîte
//   `overflow-y-auto` seule n'en est pas une : son `overflow-x` calculé vaut
//   aussi `auto` (une valeur `visible` face à une valeur non `visible` sur
//   l'autre axe devient `auto`), sans que personne ait voulu un défilement
//   horizontal ;
// - ancêtre qui le coupe : `overflow-x` calculé `hidden` ou `clip`. Seuls
//   comptent les ancêtres de la CHAÎNE DES BLOCS CONTENANTS, comme pour le
//   navigateur : un élément `position: fixed` n'est coupé par aucun ancêtre
//   (sauf un ancêtre qui lui sert de bloc contenant : `transform`,
//   `perspective`, `filter`, `backdrop-filter`, `contain` paint/layout,
//   `will-change` correspondant) ; un élément `position: absolute` saute les
//   ancêtres statiques jusqu'à son bloc contenant. Un défilement voulu se
//   cherche sur la même chaîne. Sans cela, un élément fixe qui sort de
//   l'écran passerait pour coupé par un `overflow-hidden` qui ne le coupe
//   pas.
//   ⚠️ `html` n'en est jamais un, ni `body` quand le navigateur lui emprunte
//   son `overflow` pour la fenêtre (celui de `html` est `visible`) : le
//   navigateur applique cet `overflow` à la FENÊTRE, pas à une boîte. Ce
//   qu'il coupe est ce qui sort de l'écran — exactement ce que la règle doit
//   voir. L'app pose `overflow-x: hidden` sur `html` comme « filet de
//   sécurité » (src/index.css : « le masquer rend le contenu coupé
//   inatteignable ») ; compté comme ancêtre qui coupe, il abriterait tout
//   élément en flux, et la règle ne signalerait plus rien.
//
// Ce qui est dessiné, et non la boîte : là où ce que Chromium rend par
// `scrollWidth` ne décrit pas un dessin, la règle « contenu » lit le dessin.
// Chaque cause est générale, et un vrai dépassement de même nature reste
// signalé (tests/banc/cas/, un cas positif et un négatif par cause) :
//
// - texte SVG (`<text>`, `<tspan>`, `<textPath>` : `SVGTextContentElement`) :
//   pas de boîte CSS, et Chromium y rend par `scrollWidth`/`clientWidth`
//   l'avance du texte NON transformé (une légende pivotée de −90° de 14 px de
//   large y lisait 88 / 57). Le dépassement lu est le bord droit de son
//   dessin (`getBoundingClientRect`, transformées comprises) moins le bord
//   droit intérieur de son graphe — le `<svg>` le plus extérieur —, arrondi
//   au pixel ; signalé au-delà de la tolérance, comme tout « contenu ». Les
//   champs `scrollWidth`/`clientWidth` du signalement restent ceux de
//   Chromium, sans valeur ; `depassement` porte la mesure. Côté droit seul,
//   comme partout. ⚠️ Limites nommées : un `<svg>` imbriqué n'est pas un
//   graphe (seul le plus extérieur compte), et un texte coupé à gauche, ou en
//   haut et en bas, n'est pas vu (tests/banc/cas/svg-texte.html).
// - espacement final (`letter-spacing`) : Chromium ajoute l'espacement après
//   CHAQUE lettre, la dernière comprise ; ce dernier espacement entre dans
//   la largeur du texte (`scrollWidth`) sans que rien y soit dessiné (un
//   libellé `label` de 52 px lisait 54 pour 53 dessinés). Pour un élément
//   HTML dont le SEUL contenu est un nœud texte (aucun élément enfant), qui
//   n'est pas `inline` (son texte a ses lignes à lui), `ltr`, d'espacement
//   calculé positif, et dont le texte finit par une lettre (pas un blanc) :
//   au second passage, la dernière lettre passe dans un `span` à
//   `letter-spacing: 0`, et l'élément et ses ancêtres se relisent ainsi.
//   Retrait gardé seulement s'il est EXACT : la boîte de l'élément ne bouge
//   pas (tolérance 0,5 px — un libellé de largeur automatique qui
//   rétrécirait déplacerait ses voisins, que cet espacement place
//   réellement), et son texte garde sa hauteur et son haut et perd
//   exactement l'espacement en largeur (0,05 px ; un crénage perdu à la
//   coupure fait échouer le contrôle). Sinon rien ne se retire. Le texte est
//   remis à l'identique (même nœud, même valeur) avant la fin de `mesurer`.
//   ⚠️ Limites nommées : seule la fin de la DERNIÈRE ligne est retirée (un
//   texte sur plusieurs lignes garde l'espacement de fin des autres) ; un
//   texte suivi d'un élément, ou dans un `inline`, se mesure comme avant
//   (tests/banc/cas/espacement-final.html).
//
// Exclusions, chacune LOCALE (l'élément exclu n'est signalé par aucune règle ;
// ses ancêtres restent mesurés, et sont signalés s'il les élargit) :
//
// - texte EFFECTIVEMENT coupé par ellipsis : `text-overflow: ellipsis` avec
//   `overflow-x` calculé `hidden` ou `clip`, ET `scrollWidth > clientWidth`
//   sur l'élément — la coupe est voulue et se voit. Les propriétés sans
//   texte coupé n'excluent rien ;
// - `visibility: hidden` (ou `collapse`) : une copie invisible sert à
//   réserver une place, elle ne se voit pas ;
// - `display: none` : aucune boîte, rien à mesurer.
//
// `aria-hidden` SEUL n'est PAS une exclusion : un élément caché aux lecteurs
// d'écran reste visible à l'œil. Toute autre exclusion s'écrit ici, avec son
// motif.
//
// Exceptions décidées, qui portent AUSSI sur les ancêtres (chacune est
// étroite : s'il manque une de ses conditions, rien n'est exclu) :
//
// - décoratif coupé (le halo des cartes de l'accueil) : un élément à la fois
//   `aria-hidden="true"` (l'attribut, valeur `true`), `pointer-events: none`
//   CALCULÉ (hérité compris) et coupé par un ancêtre. « Coupé » : sur sa
//   chaîne de blocs contenants, le premier ancêtre dont l'`overflow-x`
//   calculé n'est pas `visible` vaut `hidden` ou `clip` — un `auto` ou un
//   `scroll` le laisse atteignable au défilement, il n'est pas coupé ; `html`
//   et `body` propagé ne coupent pas (voir plus haut). Le décoratif n'est
//   signalé par aucune règle, et ses ancêtres, jusqu'à celui qui le coupe
//   compris, ne le sont pas AU TITRE DE CE SEUL ÉLÉMENT : leur règle
//   « contenu » se relit au second passage, décoratifs retirés, et ne reste
//   que si un dépassement subsiste. Ses descendants se mesurent comme les
//   autres. Le retrait (`display: none`) n'est fait que s'il est EXACT, ce
//   que vérifie un essai sur la page intacte, décoratif par décoratif : tout
//   son sous-arbre est non cliquable (`pointer-events: none` calculé —
//   `aria-hidden` vaut pour le sous-arbre), et le retirer ne déplace ni ne
//   redimensionne aucune autre boîte de son coupeur (tolérance 0,5 px). Sinon
//   il reste en place à la relecture : un frère qu'il retiendrait dans une
//   rangée flex, ou un descendant cliquable qui partirait avec lui, aurait
//   son dépassement levé à tort (relecture Codex n° 1 et 2 ;
//   tests/banc/cas/decoratif-flux.html, decoratif-descendant.html). Le
//   signalement de ses ancêtres est alors celui du premier passage, son
//   propre dépassement compris : du côté prudent, jamais exact au pixel ;
// - zone de toucher agrandie : le pseudo-élément `::after` d'un élément de
//   classe `cible-tactile` (src/index.css : 44 px touchables, centrés sur
//   l'élément, sans un pixel de dessin) ne compte ni dans la mesure de son
//   élément ni dans celle de ses ancêtres hors `html`. La règle « page », elle,
//   le COMPTE : un `::after` qui élargit la page laisse un défilement latéral
//   au téléphone (décision D9 de l'utilisateur ; relevé
//   tests/banc/cas/zone-tactile-page.html : `isMobile` élargit la fenêtre de
//   mise en page à 373 px pour 360). Au second passage, sa règle « contenu »
//   et celle de ses ancêtres se relisent ce pseudo-élément retiré ; la page,
//   jamais. Aucun autre pseudo-élément
//   n'est exclu : un `::before` de la même classe, ou le `::after` d'une
//   autre, compte. Le pseudo est absolu : le retirer ne déplace rien. La
//   géométrie n'en dépend pas (un pseudo-élément n'a pas de rectangle) ;
// - marge négative (`-mx-1` et voisines) : pour un élément dont la marge
//   droite calculée (`getComputedStyle`, en px) est négative, le dépassement
//   qu'il impose à son parent — et, par lui, à chaque ancêtre qui le
//   contient, `html` compris — est diminué EXACTEMENT de cette marge ; ce
//   qui dépasse encore est signalé avec la tolérance commune de 1 px, sans
//   autre seuil (une exception « ≤ 4 px » laisserait passer un vrai
//   débordement porté par le même élément). Au second passage, l'élément est
//   décalé vers la gauche de la valeur de sa marge en reportant celle-ci de
//   droite à gauche (`margin-left` diminuée de la marge, `margin-right: 0`) :
//   sa largeur et son encombrement (marge gauche + largeur + marge droite) ne
//   changent pas, aucune autre boîte ne bouge, et son bord droit, avec tout ce
//   qu'il porte, revient au bord de sa boîte de marge. Pas `translate` : il
//   ferait de l'élément le bloc contenant de ses descendants `absolute` et
//   `fixed`, qui se replaceraient contre lui (relecture Codex n° 3 ;
//   tests/banc/cas/marge-negative-bloc.html), et il excluait un élément qui
//   portait déjà un `translate`, même nul (n° 11 ;
//   marge-negative-translate.html). Côté par côté : document
//   LTR, seul le côté droit entre dans `scrollWidth` (un dépassement à
//   gauche n'est pas atteignable au défilement), donc seule la marge droite
//   s'y soustrait ; une marge gauche négative ne diminue rien. Relevé :
//   Chromium rend par `getComputedStyle` la marge déclarée (−4 px) même
//   quand la boîte est trop large et que la marge utilisée diffère
//   (tests/banc/cas/marge-negative.html, ligne « large »). L'élément garde
//   sa géométrie : sortir de la fenêtre reste signalé. Rien ne se soustrait
//   en `direction: rtl`. Un `translate` que l'élément porte déjà reste en
//   place et compte (un décalage de 2 px au-delà de la marge reste signalé) ;
// - pastille du portrait (`MonsterAvatar` : icône d'élément, badge « lead »,
//   nombre d'exemplaires) : son contact avec SON portrait est permis, jamais
//   avec le reste — ni un ancêtre au-delà du portrait, ni une autre pastille,
//   ni la couronne, ni rien d'autre que ce qui est dessiné dans le cadre du
//   portrait. Décisions D11 et D15 de l'utilisateur ; aucune généralisation à
//   un autre élément absolu à décalage négatif (halo, superposition
//   `-inset-px`, bouton en coin hors de sa liste — exception suivante), qui
//   se mesure comme les autres.
//   · Qui en bénéficie : un élément qui porte le repère `data-pastille` posé
//     par `src/` (MonsterAvatar.tsx, ElementIcon.tsx, siege/LeadPill.tsx),
//     sur l'élément positionné lui-même, avec une valeur de la liste
//     explicite PASTILLES_RECONNUES : `element`, `lead`, `exemplaires`. PAS
//     `couronne` (D15 : la couronne n'est pas posée sur le portrait) : elle
//     se mesure comme tout élément, son dépassement compte, et elle est « le
//     reste » pour les pastilles. Rien n'est reconnu par son image ni par sa
//     forme : une icône d'élément sans repère se mesure comme les autres (son
//     dépassement compte), et un repère retiré de `src/` rend ses
//     signalements — la panne va du côté prudent.
//   · Son portrait : l'ancêtre `[data-portrait]` le plus proche. Il doit être
//     AUSSI son bloc contenant (la chaîne des blocs contenants, plus haut) ;
//     sinon, rien ne s'applique : une pastille enveloppée dans un cadre
//     positionné se mesure comme les autres.
//   · Conditions : la pastille est en `position: absolute`, avec au moins un
//     décalage horizontal (`left` ou `right`) DÉCLARÉ négatif — valeur
//     calculée qui n'est pas le mot-clé `auto` (`computedStyleMap`) ; sa
//     valeur en px est celle de `getComputedStyle`. Relevé (sonde du lot 5,
//     Chromium du banc) : un `right: auto` dont la valeur utilisée est
//     négative (`left: 0` et une largeur trop grande) rend `-6px` par
//     `getComputedStyle` mais `auto` par `computedStyleMap` — ce n'est pas
//     un décalage voulu, son dépassement reste entier. Son portrait est de
//     direction `ltr`, et ne coupe ni ne défile sur AUCUN des deux axes
//     (`overflow-x` et `overflow-y` calculés `visible` ; `overflow-y: clip`
//     seul rogne le haut de l'icône — relecture Codex n° 6,
//     tests/banc/cas/coin-rogne-y.html) : une pastille rognée par son
//     portrait est un vrai défaut, il reste signalé (décision de
//     l'utilisateur). Sinon, rien ne se soustrait et la règle
//     « chevauchement » ne s'applique pas.
//   · Côté par côté : document LTR, seul le côté droit entre dans
//     `scrollWidth`. Seul un décalage `right` déclaré négatif se soustrait ;
//     un `left` négatif (le badge « lead », `-left-1.5`) ne diminue rien —
//     le dépassement à gauche n'est pas compté — mais suffit à faire de
//     l'élément une pastille, soumise au chevauchement ; `top`/`bottom` sont
//     hors de l'axe mesuré.
//   · Contact : le dépassement que la pastille impose à son portrait est
//     diminué EXACTEMENT de son décalage droit ; ce qui dépasse encore est
//     signalé (tolérance de 1 px). Au second passage, pour la seule relecture
//     de son portrait, son décalage est ramené à 0 (`right: 0`, avec
//     `transition: none`, et sa largeur figée à sa valeur calculée quand
//     `left` vaut `auto`, pour qu'une largeur `auto` ne prenne pas la place
//     rendue). `translate` ne convient pas ici : relevé (sonde du lot 5),
//     quand plusieurs icônes en reçoivent un ensemble, Chromium ne recalcule
//     pas le `scrollWidth` du bloc de celle qui porte déjà un `transform`
//     (47 px au lieu de 43) ; `right: 0` donne 43. Valeur surcontrainte (`left`,
//     `right` et `width` déclarés) : le navigateur ignore `right` en LTR, le
//     ramener à 0 ne change rien, et rien ne se soustrait — ce dépassement
//     ne vient pas du décalage.
//   · Jamais avec le reste : aucun ancêtre AU-DELÀ du portrait, `html`
//     compris, n'en profite — son dépassement se compte en entier ; la
//     géométrie de la pastille ne change pas. Et la règle « chevauchement » :
//     la boîte de la pastille (`getBoundingClientRect`, premier passage) ne
//     coupe celle d'aucun élément visible (au sens plus haut, `visibility`
//     visible) DU MÊME PLAN qui n'est ni un de ses ancêtres, ni un de ses
//     descendants, ni le contenu de son portrait — coupe : intersection de
//     plus de 1 px de large ET de haut. Contenu du portrait (D14 : ce qui est
//     dessiné dans le cadre du portrait en fait partie) : le CADRE — premier
//     élément enfant du portrait, en flux (ni `absolute` ni `fixed`), sans
//     `data-pastille` : la structure fixe de MonsterAvatar, dont les deux
//     gabarits posent le cadre hexagonal en premier et les pastilles après —
//     et ses descendants, sauf une pastille (toute valeur de `data-pastille`,
//     couronne comprise) et ce qu'elle contient. La seconde moitié du
//     portrait d'un jumeau collab (`absolute inset-0` dans le cadre,
//     `CollabPortrait.tsx`) en fait donc partie. Tout autre descendant du
//     portrait est « le reste » et se compare : une autre pastille (deux
//     pastilles d'un même portrait ne se touchent pas, D15), la couronne,
//     un élément sans repère, enveloppé ou non dans un cadre positionné
//     (relectures Codex n° 5 et 17, tests/banc/cas/coin-pastille.html,
//     pastille-*.html). Sans cadre reconnu, le portrait n'a pas de contenu :
//     tout se compare. Même plan : le même ancêtre (l'élément compris) le plus
//     proche en `position: fixed` ou `sticky`, ou aucun pour les deux. Une
//     barre ou un en-tête fixe ou collant, une modale, passent au-dessus du
//     contenu qui défile sous eux : leurs boîtes se coupent sans que la
//     pastille y soit pour rien (relevé du lot 5 : 81 coupes de ce genre dans l'app,
//     barre basse du bestiaire, en-tête, modales de « Dégâts réels »).
//     ⚠️ Limite acceptée (relecture Codex n° 12) : un bloc `sticky` est un
//     plan à part même quand il n'est pas collé et reste à sa place normale,
//     et deux blocs `sticky` distincts sont deux plans ; une collision réelle
//     entre eux, ou avec le contenu ordinaire, n'est pas comparée. Le banc ne
//     lit pas quelle boîte passe au-dessus.
//     Signalé sur l'élément, avec l'autre élément (`avec`) et l'aire coupée
//     (`aire`, px²) ; parmi les éléments coupés, seuls les plus profonds (un
//     élément coupé dont un descendant est coupé aussi n'est pas repris).
//     Elle ne porte pas sur un élément exclu (`visibility: hidden`,
//     décoratif coupé, ellipsis), et un décoratif coupé n'est jamais l'autre
//     élément. Les boîtes comparées sont les boîtes VISIBLES : la boîte de
//     mise en page (`getBoundingClientRect`, premier passage) coupée, axe par
//     axe, par la boîte de remplissage de chaque ancêtre de sa chaîne de blocs
//     contenants qui coupe ou défile sur cet axe (`overflow` calculé autre que
//     `visible`, ou `contain: paint`) — une boîte entièrement coupée ne touche
//     rien, l'aire retenue est celle de la partie visible (relecture Codex
//     n° 7, tests/banc/cas/coin-coupe.html). ⚠️ Limites nommées : dans un même
//     plan, l'ordre d'empilement n'est pas lu (`z-index`, `absolute`), ni
//     `clip-path` ni un masque ; une boîte dans un défilement est comparée à
//     sa position défilée du moment.
// - bouton en coin (la croix « Retirer » de la carte RTA, posée sur son coin) :
//   son contact avec SA CARTE est permis, jamais avec le reste. Décision de
//   l'utilisateur du 2026-10-13, calquée sur la pastille du portrait ; un
//   seul membre.
//   · Qui en bénéficie : un élément qui porte le repère `data-bouton-coin`
//     posé par `src/` (rta/RtaCard.tsx, transmis par BoutonIcone et Bouton
//     jusqu'au `<button>` positionné), avec une valeur de la liste explicite
//     BOUTONS_EN_COIN : `retirer-rta`, et rien d'autre. Un autre bouton en
//     coin (le crayon d'une vignette de défense) n'y est pas : il se mesure
//     comme les autres. Un repère retiré de `src/`, ou un nom retiré de la
//     liste, rend ses signalements.
//   · Sa carte : son bloc contenant, quel qu'il soit (ni `html`, ni `body`
//     propagé) ; aucun repère de carte n'est exigé — un bouton enveloppé dans
//     un cadre positionné voit son exception portée par ce cadre, et la carte
//     compte alors son dépassement en entier.
//   · Conditions, contact, et « jamais avec le reste » : celles de la
//     pastille (`position: absolute`, décalage déclaré négatif, carte `ltr`
//     qui ne coupe ni ne défile sur aucun axe ; dépassement imposé à la carte
//     diminué EXACTEMENT de son décalage droit ; aucun ancêtre au-delà de la
//     carte n'en profite ; relecture par `right: 0`). Une différence, voulue :
//     la carte n'a pas de « contenu » permis. Tout élément du même plan qui
//     n'est ni un ancêtre ni un descendant du bouton se compare, y compris ce
//     que la carte porte (icônes, texte, rangées) — la croix ne couvre rien
//     (tests/banc/cas/bouton-coin.html). La carte elle-même, ancêtre, n'est
//     jamais coupée.
//
// Second passage : chaque signalement « contenu » d'un élément concerné par
// une exception (et la page, si elle déborde et qu'une marge négative y
// porte) se relit une fois, puis tout est rendu tel quel avant la fin de
// `mesurer` (la capture suit la mesure). Trois temps, chacun ne posant que
// les neutralisations qui valent pour ce qu'il relit : (1) marges négatives
// seules, la page ; (2) en plus décoratifs coupés, zones de toucher et
// espacements finals (aucun ne vaut pour la page : l'espacement final, s'il
// n'est pas dessiné, élargit réellement ce qu'on peut faire défiler), les
// éléments qui ne sont le portrait d'aucune pastille à décalage droit ; (3) en
// plus ces pastilles, chacun de leurs portraits — avec les seules pastilles
// dont il est le portrait (relu à part s'il contient une pastille d'un autre
// portrait) ; un bouton en coin y est une pastille, sa carte un portrait.
// Neutralisations : décoratif coupé, `display: none` posé en ligne
// avec `!important` ; zone de toucher, une feuille de style ajoutée le temps
// de la lecture (`.cible-tactile::after { display: none !important }`) ;
// marge négative, `margin-left`/`margin-right` en ligne avec `!important` ;
// espacement final, un `span` ajouté et le nœud texte raccourci, défaits
// avant les poses ;
// pastille, `right: 0` en ligne avec `!important` (voir plus haut). Le
// signalement garde ses valeurs du premier passage ;
// `depassement` porte celui qui reste, `page.relue` la largeur de page relue.
// Remise en état : chaque neutralisation en ligne pose aussi `transition:
// none !important` — une transition sur la propriété neutralisée (`transition:
// translate 1s`) ferait lire une valeur intermédiaire. Chaque élément touché
// garde son attribut `style` d'avant (présence comprise) et le retrouve à
// l'identique : rendre propriété par propriété perdait des déclarations
// (`transition-duration` seule, effacée avec le raccourci `transition`) et
// laissait un `style=""` neuf. Le rendu se fait en deux temps — l'attribut
// d'avant avec les transitions coupées, un rendu forcé, puis l'attribut
// d'avant seul — sinon rendre ensemble la valeur et sa transition relance
// celle-ci depuis la valeur neutralisée (relecture Codex n° 8 à 10 ;
// tests/banc/cas/restauration.html, et `cas.mjs` vérifie chaque page).
// ⚠️ Limite nommée : chaque décoratif est essayé seul ; deux décoratifs dont
// chacun, retiré seul, ne déplace rien sont supposés ne rien déplacer
// ensemble.
//
// Limites connues : des cas où le banc peut se TAIRE à tort. Ils viennent de
// la relecture du code, ne sont pas reproduits, et sont rares ou absents
// dans l'app. Le banc est un outil de mesure, pas une garde : un écran sans
// signalement n'est pas une preuve.
// - Décoratif : le contrôle « son retrait ne déplace aucune boîte » ne voit
//   ni le texte nu ni les pseudo-éléments ; retirer le décoratif peut faire
//   tenir un texte voisin qui débordait.
// - Pastille du portrait : le cadre est reconnu par sa place (premier enfant
//   du portrait), faute de repère qui lui soit propre ; un élément posé avant
//   lui dans le portrait deviendrait le cadre, et le vrai cadre « le reste ».
//   Un rognage par `contain: paint` n'exclut pas l'exception.
// - Chevauchement : sous `transform: scale`, les zones de coupe sont
//   calculées en dimensions de mise en page et non transformées ; un bloc
//   `sticky` non collé forme un plan à part (aucune comparaison avec ses
//   voisins ordinaires).
// - Marge négative : le report de la marge déplace la forme d'exclusion d'un
//   flottant à `shape-outside`, donc le texte qui l'entoure.
// - Remise en état : une transition ou une animation déjà en cours peut être
//   annulée ou relancée ; seul le nombre d'animations est contrôlé.
//
// ⚠️ `mesurer` est exécutée DANS la page (`page.evaluate`) : Playwright en
// envoie le texte. Elle ne référence donc rien hors d'elle-même — pas une
// constante du module, pas un import.

export type Regle = 'contenu' | 'geometrie' | 'chevauchement';

export interface DescriptionElement {
  /**
   * Chemin depuis `body`, par rang parmi les frères (`div:nth-child(2)`),
   * tronqué à gauche ; l'`id` n'y figure qu'avec `detail`.
   */
  chemin: string;
  balise: string;
  id: string | null;
  /**
   * Attribut `class`, tronqué ; vide sans `detail` (compte réel). Jamais le
   * texte de l'élément : il peut venir du compte.
   */
  classes: string;
  profondeur: number;
}

export interface Signalement {
  regle: Regle;
  element: DescriptionElement;
  gauche: number;
  droite: number;
  largeur: number;
  scrollWidth: number;
  clientWidth: number;
  /**
   * Règle « contenu » : le dépassement retenu, en px — `scrollWidth −
   * clientWidth`, ou sa relecture au second passage (voir la tête).
   */
  depassement?: number;
  /**
   * Règle « contenu » : les descendants les plus hauts qui sortent de la
   * boîte de l'élément (3 au plus). Vide : le dépassement vient d'un
   * pseudo-élément ou de texte. Aide à la lecture, sans effet sur le verdict.
   */
  causes?: DescriptionElement[];
  /** Règle « chevauchement » : l'élément dont la boîte est coupée (voir la tête). */
  avec?: DescriptionElement;
  /** Règle « chevauchement » : l'aire de l'intersection des deux boîtes, en px². */
  aire?: number;
}

export interface Mesure {
  /** L, la largeur de référence (`documentElement.clientWidth`). */
  largeur: number;
  /** Relevée pour le manifeste, jamais comparée (voir la tête). */
  innerWidth: number;
  largeurVisuelle: number | null;
  /**
   * `scrollWidth` : premier passage ; `relue` : relecture au second passage,
   * quand une exception porte sur la page (voir la tête) — c'est elle qui
   * décide alors de `deborde`.
   */
  page: { scrollWidth: number; relue?: number; deborde: boolean };
  signalements: Signalement[];
  elementsMesures: number;
  /**
   * `decoratifs` : éléments exclus comme décoratif coupé, dont
   * `decoratifsEnPlace` laissés en place à la relecture ; `leves` :
   * signalements « contenu » levés au second passage ; `coins` : éléments
   * qui bénéficient des exceptions « pastille du portrait » et « bouton en
   * coin » (voir la tête).
   */
  exclus: { ellipsis: number; invisibles: number; decoratifs: number; decoratifsEnPlace: number; leves: number; coins: number };
  deborde: boolean;
}

/**
 * `detail` : décrire les éléments par `id` et classes (compte d'exemple). Sans
 * lui, le chemin n'est que structurel (balise et rang) : avec un compte réel,
 * un `id` ou une classe peut porter une donnée du compte.
 */
export function mesurer(options: { detail: boolean }): Mesure {
  const TOLERANCE = 1;
  const detail = options.detail;
  const largeur = document.documentElement.clientWidth;
  const styles = new Map<Element, CSSStyleDeclaration>();
  const style = (el: Element) => {
    let s = styles.get(el);
    if (!s) {
      s = getComputedStyle(el);
      styles.set(el, s);
    }
    return s;
  };
  const coupe = (s: CSSStyleDeclaration) => s.overflowX === 'hidden' || s.overflowX === 'clip';
  const classesDe = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  const defilementVoulu = (el: Element) => {
    const s = style(el);
    if (s.overflowX !== 'auto' && s.overflowX !== 'scroll') return false;
    return classesDe(el).some((c) => /(^|:)overflow-x-(auto|scroll)$/.test(c));
  };
  // Ce ancêtre sert-il de bloc contenant à un élément `fixed` ?
  const contientFixe = (s: CSSStyleDeclaration) =>
    s.transform !== 'none' ||
    s.perspective !== 'none' ||
    s.filter !== 'none' ||
    (s.backdropFilter ?? 'none') !== 'none' ||
    /paint|layout|strict|content/.test(s.contain) ||
    /transform|perspective|filter/.test(s.willChange);
  const mode = (s: CSSStyleDeclaration) =>
    s.position === 'fixed' ? 'fixe' : s.position === 'absolute' ? 'absolu' : 'flux';

  // `abrite(a)` : `a` ou un ancêtre de sa chaîne de blocs contenants coupe ou
  // défile volontairement — un descendant de `a` qui sort de la fenêtre est
  // alors dans une boîte qui le retient.
  const abris = new Map<Element, boolean>();
  const suivant = (el: Element): Element | null => {
    const m = mode(style(el));
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = style(a);
      if (m === 'fixe' && !contientFixe(s)) continue;
      if (m === 'absolu' && s.position === 'static' && !contientFixe(s)) continue;
      return a;
    }
    return null;
  };
  // `html`, et `body` quand son `overflow` passe à la fenêtre : voir la tête.
  const racine = document.documentElement;
  const sR = style(racine);
  const fenetre = (a: Element) =>
    a === racine || (a === document.body && sR.overflowX === 'visible' && sR.overflowY === 'visible');
  const abrite = (a: Element | null): boolean => {
    if (!a) return false;
    const connu = abris.get(a);
    if (connu !== undefined) return connu;
    const r = (!fenetre(a) && (coupe(style(a)) || defilementVoulu(a))) || abrite(suivant(a));
    abris.set(a, r);
    return r;
  };

  // Décoratif coupé (tête) : rend l'ancêtre qui le coupe, `null` si
  // l'élément n'en est pas un.
  const decoratifs = new Map<Element, Element | null>();
  const coupeurDecoratif = (el: Element): Element | null => {
    const connu = decoratifs.get(el);
    if (connu !== undefined) return connu;
    let coupeur: Element | null = null;
    if (el.getAttribute('aria-hidden') === 'true' && style(el).pointerEvents === 'none') {
      for (let a = suivant(el); a; a = suivant(a)) {
        if (fenetre(a)) continue;
        const s = style(a);
        if (coupe(s)) coupeur = a;
        if (s.overflowX !== 'visible') break;
      }
    }
    decoratifs.set(el, coupeur);
    return coupeur;
  };

  // Pastille du portrait (tête) : la liste explicite des repères reconnus —
  // pas `couronne` (D15).
  const PASTILLES_RECONNUES = new Set(['element', 'lead', 'exemplaires']);
  // Bouton en coin (tête) : la liste explicite de ses membres, un seul.
  const BOUTONS_EN_COIN = new Set(['retirer-rta']);
  // Rend le bloc de la pastille ou du bouton en coin (son bloc contenant :
  // le portrait, la carte), si son décalage droit déclaré négatif se
  // soustrait, et la largeur à figer pendant la relecture (`left` `auto`) ;
  // `null` si l'élément n'en bénéficie pas.
  const decalageDeclare = (carte: StylePropertyMapReadOnly, cote: 'left' | 'right', px: string) => {
    const valeur = carte.get(cote);
    return Boolean(valeur) && !(valeur instanceof CSSKeywordValue) && parseFloat(px) < 0;
  };
  const coinDe = (
    el: Element,
    s: CSSStyleDeclaration,
  ): { bloc: Element; soustrait: boolean; largeurFigee: string | null; pastille: boolean } | null => {
    const pastille = PASTILLES_RECONNUES.has(el.getAttribute('data-pastille') ?? '');
    if (!pastille && !BOUTONS_EN_COIN.has(el.getAttribute('data-bouton-coin') ?? '')) return null;
    if (s.position !== 'absolute' || typeof el.computedStyleMap !== 'function') return null;
    const carte = el.computedStyleMap();
    const droite = decalageDeclare(carte, 'right', s.right);
    if (!droite && !decalageDeclare(carte, 'left', s.left)) return null;
    const bloc = suivant(el);
    if (!bloc || fenetre(bloc)) return null;
    if (pastille && bloc !== el.parentElement?.closest('[data-portrait]')) return null;
    const sB = style(bloc);
    if (sB.direction !== 'ltr' || sB.overflowX !== 'visible' || sB.overflowY !== 'visible') return null;
    return { bloc, soustrait: droite, largeurFigee: carte.get('left') instanceof CSSKeywordValue ? s.width : null, pastille };
  };
  // Le contenu du portrait (tête) : son cadre — premier élément enfant, en
  // flux, sans repère de pastille — et ce qu'il contient, hors pastilles.
  const cadres = new Map<Element, Element | null>();
  const cadreDe = (portrait: Element): Element | null => {
    const connu = cadres.get(portrait);
    if (connu !== undefined) return connu;
    const c = portrait.firstElementChild;
    const cadre = c && !c.hasAttribute('data-pastille') && mode(style(c)) === 'flux' ? c : null;
    cadres.set(portrait, cadre);
    return cadre;
  };
  const contenuDe = (e: Element, portrait: Element) => {
    const cadre = cadreDe(portrait);
    if (!cadre || !cadre.contains(e)) return false;
    for (let a: Element | null = e; a && a !== portrait; a = a.parentElement) {
      if (a.hasAttribute('data-pastille')) return false;
    }
    return true;
  };

  const decrire = (el: Element): DescriptionElement => {
    const segments: string[] = [];
    let profondeur = 0;
    for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
      profondeur++;
      const parent = e.parentElement;
      const rang = parent ? Array.prototype.indexOf.call(parent.children, e) + 1 : 1;
      const balise = e.tagName.toLowerCase();
      segments.unshift(e === document.body ? 'body' : `${balise}${detail && e.id ? `#${e.id}` : ''}:nth-child(${rang})`);
    }
    const chemin = segments.length > 8 ? `… > ${segments.slice(-8).join(' > ')}` : segments.join(' > ');
    const classes = detail ? (el.getAttribute('class') ?? '').replace(/\s+/g, ' ').trim() : '';
    return {
      chemin,
      balise: el.tagName.toLowerCase(),
      id: detail ? el.id || null : null,
      classes: classes.length > 160 ? `${classes.slice(0, 160)}…` : classes,
      profondeur,
    };
  };

  // Le dépassement que la règle « contenu » lit sur un élément. Texte SVG
  // (tête) : le bord droit de son dessin face au bord droit de son graphe —
  // `scrollWidth`/`clientWidth` n'y décrivent aucune boîte dessinée.
  const depasse = (el: Element) => {
    if (!(el instanceof SVGTextContentElement)) return el.scrollWidth - el.clientWidth;
    let graphe = el.ownerSVGElement;
    while (graphe?.ownerSVGElement) graphe = graphe.ownerSVGElement;
    if (!graphe) return 0;
    const g = graphe.getBoundingClientRect();
    return Math.round(el.getBoundingClientRect().right - (g.left + graphe.clientLeft + graphe.clientWidth));
  };

  // Espacement final (tête) : un élément dont le seul contenu est un texte, à
  // lui seul sur ses lignes, qui finit par une lettre suivie d'un espacement
  // positif ; `null` sinon.
  type Espacement = { el: Element; texte: Text; ls: number };
  const espacements: Espacement[] = [];
  const espacementFinal = (el: Element, s: CSSStyleDeclaration): Espacement | null => {
    const texte = el.firstChild;
    if (!(el instanceof HTMLElement) || el.childNodes.length !== 1 || !(texte instanceof Text)) return null;
    const ls = parseFloat(s.letterSpacing);
    if (!(ls > 0) || s.display === 'inline' || s.direction !== 'ltr') return null;
    const lettres = Array.from(texte.data);
    if (lettres.length === 0 || /\s/.test(lettres[lettres.length - 1])) return null;
    return { el, texte, ls };
  };

  const signalements: Signalement[] = [];
  const elementDe = new Map<Signalement, Element>();
  const decoratifsVus: Element[] = [];
  // Marge négative (tête) : l'élément, la valeur absolue de sa marge droite et
  // sa marge gauche calculée.
  const margesNegatives: { el: Element; marge: number; gauche: number }[] = [];
  // Pastille du portrait et bouton en coin (tête) : l'élément et son bloc.
  const coins: { el: Element; bloc: Element; soustrait: boolean; largeurFigee: string | null; pastille: boolean }[] = [];
  // Règle « chevauchement » : les éléments visibles, leur boîte au premier
  // passage, et ceux qui ont passé les exclusions.
  const visibles: Element[] = [];
  const boites = new Map<Element, DOMRect>();
  const mesures = new Set<Element>();
  let elementsMesures = 0;
  let ellipsis = 0;
  let invisibles = 0;
  const releve = (el: Element, r: DOMRect, regle: Regle): Signalement => ({
    regle,
    element: decrire(el),
    gauche: Math.round(r.left * 10) / 10,
    droite: Math.round(r.right * 10) / 10,
    largeur: Math.round(r.width * 10) / 10,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  });
  // `body` compris : un dépassement qu'il porte lui-même (marge négative…)
  // ne se voit sur aucun de ses descendants.
  for (const el of [document.body, ...Array.from(document.body.querySelectorAll('*'))]) {
    if (el.getClientRects().length === 0) continue; // display: none, display: contents
    const s = style(el);
    // Avant toute exclusion : un élément exclu impose quand même son
    // dépassement à ses ancêtres.
    const margeDroite = parseFloat(s.marginRight);
    if (margeDroite < 0 && s.direction === 'ltr') margesNegatives.push({ el, marge: -margeDroite, gauche: parseFloat(s.marginLeft) || 0 });
    const coin = coinDe(el, s);
    if (coin) coins.push({ el, ...coin });
    const espacement = espacementFinal(el, s);
    if (espacement) espacements.push(espacement);
    if (s.visibility === 'hidden' || s.visibility === 'collapse') {
      invisibles++;
      continue;
    }
    const r = el.getBoundingClientRect();
    visibles.push(el);
    boites.set(el, r);
    if (coupeurDecoratif(el)) {
      decoratifsVus.push(el);
      continue;
    }
    // Ellipsis EFFECTIVE seulement : une boîte qui a les propriétés sans
    // texte coupé n'a rien de voulu à excuser, elle se mesure comme les autres.
    if (s.textOverflow === 'ellipsis' && coupe(s) && el.scrollWidth - el.clientWidth > TOLERANCE) {
      ellipsis++;
      continue;
    }
    elementsMesures++;
    mesures.add(el);
    const depassement = depasse(el);
    if (depassement > TOLERANCE && !defilementVoulu(el)) {
      // Pour lire le signalement, pas pour le décider : les descendants les
      // plus hauts dont la boîte sort de celle de l'élément. Aucun : ce qui
      // dépasse est un pseudo-élément (`::after`…) ou du texte.
      const interieurGauche = r.left + el.clientLeft;
      const interieurDroite = interieurGauche + el.clientWidth;
      const sort = (d: Element) => {
        const q = d.getBoundingClientRect();
        return (
          d.getClientRects().length > 0 &&
          !coupeurDecoratif(d) &&
          (q.right > interieurDroite + TOLERANCE || q.left < interieurGauche - TOLERANCE)
        );
      };
      const causes: DescriptionElement[] = [];
      for (const d of Array.from(el.querySelectorAll('*'))) {
        if (causes.length >= 3) break;
        if (!sort(d)) continue;
        let parent = d.parentElement;
        while (parent && parent !== el && !sort(parent)) parent = parent.parentElement;
        if (parent === el) causes.push(decrire(d));
      }
      const signalement: Signalement = { ...releve(el, r, 'contenu'), depassement, causes };
      signalements.push(signalement);
      elementDe.set(signalement, el);
    }
    const sort = r.right > largeur + TOLERANCE || r.left < -TOLERANCE;
    if (sort && !abrite(suivant(el))) signalements.push(releve(el, r, 'geometrie'));
  }

  // Règle « chevauchement » (tête) : contrepartie de la pastille du portrait
  // et du bouton en coin.
  // Le plan d'un élément : lui-même ou son ancêtre le plus proche en `fixed`
  // ou `sticky`, `null` s'il n'en a aucun.
  const plans = new Map<Element, Element | null>();
  const planDe = (e: Element): Element | null => {
    const connu = plans.get(e);
    if (connu !== undefined) return connu;
    const p = style(e).position;
    const plan = p === 'fixed' || p === 'sticky' ? e : e.parentElement ? planDe(e.parentElement) : null;
    plans.set(e, plan);
    return plan;
  };
  // La boîte visible : la boîte coupée, axe par axe, par la boîte de
  // remplissage de chaque ancêtre de sa chaîne de blocs contenants qui coupe
  // ou défile sur cet axe (`contain: paint` sur les deux) ; `html` et `body`
  // propagé ne coupent pas une boîte (voir plus haut).
  type Zone = { gauche: number; haut: number; droite: number; bas: number };
  const zones = new Map<Element, Zone>();
  const visibleDe = (e: Element): Zone => {
    const connue = zones.get(e);
    if (connue) return connue;
    const q = boites.get(e) ?? e.getBoundingClientRect();
    const z = { gauche: q.left, haut: q.top, droite: q.right, bas: q.bottom };
    for (let a = suivant(e); a; a = suivant(a)) {
      if (fenetre(a)) continue;
      const s = style(a);
      const peint = /paint|strict|content/.test(s.contain);
      const x = peint || s.overflowX !== 'visible';
      const y = peint || s.overflowY !== 'visible';
      if (!x && !y) continue;
      const p = boites.get(a) ?? a.getBoundingClientRect();
      // Un élément SVG intérieur n'a pas de `clientWidth` : sa boîte entière.
      const svg = a instanceof SVGElement && !(a instanceof SVGSVGElement);
      const gauche = svg ? p.left : p.left + a.clientLeft;
      const haut = svg ? p.top : p.top + a.clientTop;
      if (x) {
        z.gauche = Math.max(z.gauche, gauche);
        z.droite = Math.min(z.droite, svg ? p.right : gauche + a.clientWidth);
      }
      if (y) {
        z.haut = Math.max(z.haut, haut);
        z.bas = Math.min(z.bas, svg ? p.bottom : haut + a.clientHeight);
      }
    }
    zones.set(e, z);
    return z;
  };
  const exclusD8 = new Set(decoratifsVus);
  for (const { el, bloc, pastille } of coins) {
    if (!mesures.has(el)) continue;
    const r = boites.get(el) as DOMRect;
    const v = visibleDe(el);
    const plan = planDe(el);
    const aires = new Map<Element, number>();
    for (const autre of visibles) {
      // Le bouton en coin n'a pas de « contenu » permis : tout ce que porte
      // la carte se compare, la carte elle-même (un ancêtre) exceptée.
      if (autre.contains(el) || el.contains(autre) || (pastille && contenuDe(autre, bloc))) continue;
      if (exclusD8.has(autre) || planDe(autre) !== plan) continue;
      const q = visibleDe(autre);
      const l = Math.min(v.droite, q.droite) - Math.max(v.gauche, q.gauche);
      const h = Math.min(v.bas, q.bas) - Math.max(v.haut, q.haut);
      if (l > TOLERANCE && h > TOLERANCE) aires.set(autre, l * h);
    }
    const coupes = Array.from(aires.keys());
    for (const autre of coupes) {
      if (coupes.some((d) => d !== autre && autre.contains(d))) continue;
      signalements.push({
        ...releve(el, r, 'chevauchement'),
        avec: decrire(autre),
        aire: Math.round((aires.get(autre) as number) * 10) / 10,
      });
    }
  }

  // Second passage (tête) : les ancêtres concernés par une exception.
  const scrollWidth = document.documentElement.scrollWidth;
  let pageRelue: number | undefined;
  // `body` compris : `querySelector` ne cherche que dans ses descendants.
  const ciblesTactiles =
    document.body.classList.contains('cible-tactile') || document.body.querySelector('.cible-tactile') !== null;
  // Pastille à décalage droit : ses portraits, et ceux qui contiennent en
  // plus la pastille d'un autre portrait (relus à part : celle-là ne leur est
  // pas soustraite). Une pastille sans décalage droit ne soustrait rien.
  const decales = coins.filter((c) => c.soustrait);
  const blocsCoins = new Set(decales.map((c) => c.bloc));
  const estBlocCoin = (a: Element) => blocsCoins.has(a);
  const blocMele = (a: Element) => decales.some((c) => c.bloc !== a && a.contains(c.el));
  const concerne = (a: Element) =>
    (ciblesTactiles && (a.classList.contains('cible-tactile') || a.querySelector('.cible-tactile') !== null)) ||
    decoratifsVus.some((d) => d !== a && a.contains(d) && (coupeurDecoratif(d) as Element).contains(a)) ||
    margesNegatives.some(({ el }) => el !== a && a.contains(el)) ||
    espacements.some(({ el }) => a.contains(el)) ||
    estBlocCoin(a);
  const aRelire = signalements.filter((s) => s.regle === 'contenu' && concerne(elementDe.get(s) as Element));
  const relirePage = scrollWidth > largeur + TOLERANCE && margesNegatives.length > 0;
  const leves = new Set<Signalement>();
  let decoratifsEnPlace = 0;
  if (aRelire.length > 0 || relirePage) {
    const restaurer: (() => void)[] = [];
    // Remise en état (tête) : une pose garde l'attribut `style` d'avant, tel
    // quel, et coupe les transitions de l'élément le temps de la relecture.
    type Pose = { el: Element; avant: string | null };
    const poses: Pose[] = [];
    const poser = (el: Element, declarations: Record<string, string>): Pose => {
      const pose = { el, avant: el.getAttribute('style') };
      const st = (el as HTMLElement).style;
      for (const [propriete, valeur] of Object.entries(declarations)) st.setProperty(propriete, valeur, 'important');
      st.setProperty('transition', 'none', 'important');
      return pose;
    };
    // Rend les poses, la plus récente d'abord : l'attribut d'avant avec les
    // transitions encore coupées, un rendu forcé, puis l'attribut d'avant à
    // l'identique — seule `transition` change alors, aucune ne part.
    const rendre = (liste: Pose[]) => {
      const ordre = [...liste].reverse();
      for (const { el, avant } of ordre) el.setAttribute('style', `${avant ?? ''};transition:none !important`);
      void document.documentElement.offsetWidth;
      for (const { el, avant } of ordre) {
        if (avant === null) el.removeAttribute('style');
        else el.setAttribute('style', avant);
      }
    };
    const relire = (s: Signalement) => {
      const el = elementDe.get(s) as Element;
      const reste = depasse(el);
      if (reste > TOLERANCE) s.depassement = reste;
      else leves.add(s);
    };
    // Ramène le décalage droit des pastilles données à 0 ; rend de quoi les remettre.
    const decalerCoins = (liste: typeof decales) => {
      const siennes = liste.map((c) =>
        poser(c.el, c.largeurFigee !== null ? { width: c.largeurFigee, right: '0px' } : { right: '0px' }),
      );
      return () => rendre(siennes);
    };
    // Décoratif coupé (tête) : retiré à la relecture seulement si son retrait
    // est exact — tout son sous-arbre non cliquable, et aucune autre boîte de
    // son coupeur déplacée par son retrait (essayé seul, sur la page intacte).
    const bouge = (a: DOMRect, b: DOMRect) =>
      Math.abs(a.left - b.left) > 0.5 ||
      Math.abs(a.top - b.top) > 0.5 ||
      Math.abs(a.width - b.width) > 0.5 ||
      Math.abs(a.height - b.height) > 0.5;
    const retirable = (d: Element) => {
      for (const x of Array.from(d.querySelectorAll('*'))) {
        if (x.getClientRects().length > 0 && style(x).pointerEvents !== 'none') return false;
      }
      const coupeur = coupeurDecoratif(d) as Element;
      const essai = poser(d, { display: 'none' });
      try {
        for (const e of [coupeur, ...Array.from(coupeur.querySelectorAll('*'))]) {
          const avant = boites.get(e);
          if (avant && !d.contains(e) && bouge(avant, e.getBoundingClientRect())) return false;
        }
        return true;
      } finally {
        rendre([essai]);
      }
    };
    const retirables = decoratifsVus.filter(retirable);
    decoratifsEnPlace = decoratifsVus.length - retirables.length;
    try {
      // (1) La page : marges négatives seules (D9 ne vaut pas pour elle, un
      // décoratif est coupé avant `html`, une pastille s'arrête à son portrait).
      for (const { el, marge, gauche } of margesNegatives) {
        poses.push(poser(el, { 'margin-left': `${gauche - marge}px`, 'margin-right': '0px' }));
      }
      if (relirePage) pageRelue = document.documentElement.scrollWidth;
      // (2) Les éléments qui ne sont le portrait d'aucune pastille à décalage droit.
      for (const d of retirables) poses.push(poser(d, { display: 'none' }));
      if (ciblesTactiles) {
        const zones = document.createElement('style');
        zones.textContent = '.cible-tactile::after { display: none !important; }';
        (document.head ?? document.documentElement).appendChild(zones);
        restaurer.push(() => zones.remove());
      }
      // Espacement final (tête) : la dernière lettre passe dans un `span` sans
      // espacement ; gardé seulement si le retrait est exact — la boîte de
      // l'élément ne bouge pas, et son texte, sur les mêmes lignes, perd
      // exactement l'espacement.
      for (const { el, texte, ls } of espacements) {
        if (!aRelire.some((s) => (elementDe.get(s) as Element).contains(el))) continue;
        const contenu = document.createRange();
        contenu.selectNodeContents(el);
        const boite = el.getBoundingClientRect();
        const avant = contenu.getBoundingClientRect();
        const data = texte.data;
        const lettres = Array.from(data);
        const derniere = lettres.pop() as string;
        const enveloppe = document.createElement('span');
        enveloppe.style.setProperty('letter-spacing', '0px', 'important');
        enveloppe.textContent = derniere;
        texte.data = lettres.join('');
        el.appendChild(enveloppe);
        const remettre = () => {
          enveloppe.remove();
          texte.data = data;
        };
        contenu.selectNodeContents(el);
        const apres = contenu.getBoundingClientRect();
        const exact =
          !bouge(boite, el.getBoundingClientRect()) &&
          Math.abs(apres.top - avant.top) <= 0.05 &&
          Math.abs(apres.height - avant.height) <= 0.05 &&
          Math.abs(avant.width - apres.width - ls) <= 0.05;
        if (exact) restaurer.push(remettre);
        else remettre();
      }
      for (const s of aRelire) if (!estBlocCoin(elementDe.get(s) as Element)) relire(s);
      // (3) Les portraits de ces pastilles : toutes ensemble pour un portrait
      // qui ne contient que les siennes (décaler une pastille hors d'un bloc
      // ne change pas son `scrollWidth`), les siennes seules pour les autres.
      const blocs = aRelire.filter((s) => estBlocCoin(elementDe.get(s) as Element));
      const purs = blocs.filter((s) => !blocMele(elementDe.get(s) as Element));
      if (purs.length > 0) {
        const remettre = decalerCoins(decales);
        try {
          for (const s of purs) relire(s);
        } finally {
          remettre();
        }
      }
      for (const s of blocs.filter((b) => !purs.includes(b))) {
        const bloc = elementDe.get(s) as Element;
        const remettre = decalerCoins(decales.filter((c) => c.bloc === bloc));
        try {
          relire(s);
        } finally {
          remettre();
        }
      }
    } finally {
      for (const r of restaurer.reverse()) r();
      rendre(poses);
    }
  }
  const retenus = signalements.filter((s) => !leves.has(s));
  // Ordre de lecture, sans effet sur le verdict : la géométrie d'abord (ce
  // qui sort de l'écran se voit), puis le chevauchement, puis le contenu ; le
  // plus profond d'abord — c'est le plus souvent la cause, ses ancêtres n'en
  // sont que la conséquence.
  const rang: Record<Regle, number> = { geometrie: 0, chevauchement: 1, contenu: 2 };
  retenus.sort((a, b) => rang[a.regle] - rang[b.regle] || b.element.profondeur - a.element.profondeur);

  const pageDeborde = (pageRelue ?? scrollWidth) > largeur + TOLERANCE;
  return {
    largeur,
    innerWidth: window.innerWidth,
    largeurVisuelle: window.visualViewport ? window.visualViewport.width : null,
    page: { scrollWidth, ...(pageRelue !== undefined ? { relue: pageRelue } : {}), deborde: pageDeborde },
    signalements: retenus,
    elementsMesures,
    exclus: { ellipsis, invisibles, decoratifs: decoratifsVus.length, decoratifsEnPlace, leves: leves.size, coins: coins.length },
    deborde: pageDeborde || retenus.length > 0,
  };
}

/** Les médias du pointeur, tels que la page les voit (manifeste). Exécutée dans la page. */
export function medias(): { pointeurGrossier: boolean; sansSurvol: boolean } {
  return {
    pointeurGrossier: matchMedia('(pointer: coarse)').matches,
    sansSurvol: matchMedia('(hover: none)').matches,
  };
}

/**
 * Attend que la page ne bouge plus : polices chargées, puis une empreinte de
 * la disposition (position de chaque boîte) identique pendant `calmeMs`.
 * Les animations de l'app (framer-motion) tournent en JavaScript, hors de
 * `document.getAnimations()` : seule la disposition dit qu'elles ont fini.
 * Rend `false` si les polices ne sont pas chargées après `policesMs`, ou si
 * la page bouge encore après `maxMs`. Exécutée dans la page.
 */
export async function stabiliser(bornes: { calmeMs: number; maxMs: number; policesMs: number }): Promise<boolean> {
  const polices = await Promise.race([
    document.fonts.ready.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), bornes.policesMs)),
  ]);
  const empreinte = () => {
    let somme = 0;
    let n = 0;
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      somme += r.left * 3 + r.top * 5 + r.width * 7 + r.height * 11;
      n++;
    }
    return `${n}:${Math.round(somme)}:${document.documentElement.scrollWidth}`;
  };
  const debut = performance.now();
  let precedente = empreinte();
  let calmeDepuis = performance.now();
  while (performance.now() - debut < bornes.maxMs) {
    await new Promise((r) => setTimeout(r, 100));
    const e = empreinte();
    if (e !== precedente) {
      precedente = e;
      calmeDepuis = performance.now();
    } else if (performance.now() - calmeDepuis >= bornes.calmeMs) {
      return polices;
    }
  }
  return false;
}
