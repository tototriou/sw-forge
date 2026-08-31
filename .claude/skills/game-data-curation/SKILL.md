---
name: game-data-curation
description: Discipline à suivre pour toute MÉCANIQUE DE JEU modélisée dans SW Forge — tables `*_CONNUS` de damage.ts, règles déduites des données SWARFARM, et tout comportement supposé par ressemblance avec un autre. Les champs de données mentent, la prose n'est pas un discriminant, une liste fournie de mémoire n'est jamais le corpus, et une mécanique voisine ne se déduit jamais par analogie. Contient aussi la recette pour DEMANDER un relevé en jeu exploitable.
---

# Modéliser une mécanique de jeu (SW Forge)

`damage.ts` porte une vingtaine de tables `*_CONNUS`, curées **par nom exact
de compétence**, plus une formule de dégâts en plusieurs termes. Ce skill dit
comment y établir une règle sans se tromper : ne pas faire confiance aux
données brutes plus qu'elles ne le méritent, ne rien déduire d'une mécanique
voisine, et savoir demander la mesure qui tranche.

Né de sept incidents de la même session (chantier artéfacts / bombes /
formule de dégâts).

## Quand ce skill s'applique

- Ajout ou modification d'une table `*_CONNUS` dans `damage.ts`.
- Toute règle de calcul déduite d'un CHAMP des données SWARFARM
  (`coups`, `aoe`, `formule`, le NOM d'un effet, `ameliorations`…).
- Toute règle déduite de la PROSE d'un sort ou d'un effet.
- Reprise d'une liste de monstres/sorts fournie de mémoire (par
  l'utilisateur ou par une session précédente).
- ⚠️ **Tout comportement supposé par RESSEMBLANCE avec un autre** — « cet
  effet est décrit comme celui-là, donc il fait pareil ». Voir §6 ter : deux
  fois sur trois, c'était faux.
- Avant de **demander un relevé en jeu** à l'utilisateur (§6 bis) : une
  mesure mal cadrée revient inexploitable.

## 1. Une liste fournie de mémoire n'est jamais le corpus

⚠️ **Toujours balayer `public/data/skills/*.json` en entier** avant de figer
une règle, même quand une liste explicite vient d'être donnée.

**Incident** : pour distinguer les sorts qui POSENT une bombe de ceux qui
FRAPPENT en plus d'en poser, l'utilisateur a cité trois compétences
(`Bombardment`, `Dancing Star`, `Star of Explosion`). Le balayage du corpus
(8 434 compétences, 48 portant l'effet) en a trouvé **cinq**, puis quatre
après correction : `Firecracker` (Kobold Bomber, Malaka, Zibrolta, Taurus…)
manquait à la liste. S'en tenir aux trois noms aurait marqué « dégâts fixes »
une dizaine de formes de monstres à tort — **un bug plus large que celui
qu'on corrigeait**.

La liste de l'utilisateur est un point de DÉPART précieux (elle dit ce qu'il
faut chercher) et une VÉRIFICATION précieuse (elle doit se retrouver dans le
balayage). Elle n'est pas le résultat.

## 2. Les champs de données mentent, et pas de façon systématique

⚠️ Ne jamais fonder une règle sur un champ sans avoir vérifié le champ
CONTRE la prose, sur tout le corpus concerné.

**Incident** : `Cursed Apple` (Puppeteer, Zima, Smicer, Zenisek) porte
`coups: 1` alors que sa prose ne décrit aucune attaque (« **Installs** a bomb
… and stuns the enemy »). Le `1` compte l'application de son SECOND effet,
l'étourdissement — pas un coup porté.

⚠️ **Et l'explication ne se généralise pas** : `Fate of Destruction` porte lui
aussi deux autres effets (dégâts continus, tour supplémentaire) et reste à
`coups: 0`. Il n'existe donc AUCUN critère dérivable (« a d'autres effets ⇒
coups gonflé » est faux) — seule une curation par nom exact tient.

Même piège déjà documenté ailleurs pour la même raison :
`COUPS_VARIABLES_CONNUS` (« 2 à 3 fois » en prose, un seul nombre en donnée).

## 3. Le NOM d'un effet ne porte pas sa mécanique

⚠️ Une mécanique peut n'être écrite QUE dans la description en prose d'un
effet, jamais dans son nom ni dans un marqueur de formule.

**Incident** : une bombe ignore la défense. Les deux détections en place
échouaient toutes les deux —
- `fixed` lit le marqueur `(Fixed)` de la **formule** : absent (`"5.0*{ATK}"`) ;
- `ignoreDef` compare le **nom** de l'effet à `'Ignore DEF'` : il s'appelle
  `'Bomb'`.

L'information était pourtant dans le dépôt depuis toujours, dans la
description de l'effet : « the bomb explodes to deal damage that **ignores
Defense** ». **Lire la prose des effets, pas seulement leurs noms**, avant de
conclure qu'une mécanique est absente des données.

## 4. …mais la prose n'est pas un discriminant automatisable

⚠️ Lire la prose à la main : oui. En tirer une expression régulière : non.

Contre-exemples relevés sur le seul corpus des bombes :
- `Time Bomb` contient « Attack Bar » **sans frapper** ;
- `Bombardment` frappe **sans jamais commencer par « Attacks »** (« Orders the
  ship to fire a bombardment of 3 rounds to attack random targets »).

Une regex naïve se serait trompée dans les deux sens. Même parti pris que
`artifactSubName()` (effects.ts), qui refuse déjà d'extraire une valeur par
regex parce qu'elle est parfois au milieu du libellé.

## 5. Règle générale + exceptions curées, jamais une liste blanche

⚠️ Préférer **un discriminant dérivable, plus une table d'exceptions** à une
énumération exhaustive des cas.

Motif : le jeu ajoute du contenu. Un discriminant classe correctement un sort
NOUVEAU sans curation ; une liste blanche ne le voit pas du tout.

Appliqué aux bombes : la règle reste `effet 'Bomb' && coups === 0`, et
`BOMBES_SANS_COUP_DIRECT_CONNUS` ne rattrape que les données infidèles
(`Cursed Apple`). Le commentaire du code doit dire lequel des deux rôles
chaque morceau joue, sinon la table se fait « compléter » par erreur au
prochain passage.

## 6. Un relevé EN JEU l'emporte sur une relecture du modèle

⚠️ Un modèle relu par lui-même confirme toujours ce qu'il fait déjà. Le seul
arbitre est une mesure en combat.

Et **une bonne mesure SÉPARE les termes**. Le relevé Shahat (~50 000 PV, S2
sur une cible à ~3 000 DEF) est diagnostique parce que 3 000 de défense
écrasent tout ce qui la subit (`defenseFactor(3000) ≈ 0,0859`) : ce qui
reste debout est forcément brut. Choisir les conditions du relevé fait partie
du travail — demander « une mesure » sans dire laquelle donne souvent un
chiffre inexploitable.

⚠️ **Vérifier que la conclusion ne dépend pas des inconnues du relevé.** Sur
Shahat, l'ATQ n'était pas donnée : elle ne pesait que `1.4*{ATK}` face à un
terme dominant `0.11*{MAX HP}`, donc la conclusion tenait sur toute la plage
plausible. Le dire explicitement, sinon le relevé semble plus fragile qu'il
ne l'est.

### 6 bis. Comment DEMANDER un relevé — la recette qui marche

Six mécaniques ont été tranchées en une session avec toujours le même moule.
Le formuler explicitement à l'utilisateur fait gagner des allers-retours.

**Demander un RAPPORT, jamais un chiffre absolu.** Même monstre, même cible,
même sort, et on ne change **qu'une seule chose**. Le rapport annule tout ce
qu'on ne connaît pas : DEF exacte de la cible, ATQ réelle, variance moyennée,
arrondis d'affichage. C'est ce qui rend un relevé exploitable sans exiger un
banc d'essai.

**Choisir un montage qui SÉPARE les termes.** Le levier récurrent : une cible
à très haute DEF écrase la part mitigée et laisse la part brute dominer — à
3 000 de DEF elle pèse 91 % du total, donc elle devient lisible. Un montage
où les deux parts sont comparables ne tranche rien.

**Prévoir la règle de décision AVANT la mesure**, et l'annoncer : « si le
rapport vaut 1,5 c'est A, s'il vaut ~1 c'est B ». Sans elle, on reçoit un
chiffre qu'on interprète après coup — et on l'interprète dans le sens de ce
qu'on croyait.

**Le système à deux inconnues fait le reste.** Deux mesures qui ne diffèrent
que par un bonus connu (`S + A` et `k·S + A`) donnent séparément la part de
sort et la part brute. Comparer ensuite `A` à ce que le modèle prédit
**valide la formule en même temps que la question posée** : sur Julie, 640
mesurés contre 635 prédits — l'isolement du bucket ET sa formule, d'un seul
relevé.

⚠️ **Dire à quel point le relevé est serré.** Julie tombait à 0,8 %, Jessica à
2 %, Momo à 11 % — ce dernier parce que ses deux mesures étaient arrondies à
la centaine. Présenter les trois avec la même assurance donnerait une fausse
idée de ce qui est établi.

## 6 ter. Une mécanique voisine ne se déduit JAMAIS par analogie

⚠️ **Le piège le plus coûteux de ce dépôt.** Trois fois dans la même session,
un fait confirmé a été étendu « par symétrie » à une famille voisine. **Deux
fois sur trois, c'était faux.**

| Extension tentée | Verdict |
|---|---|
| Les artéfacts −DMG% sont additifs avec Mirinae → donc les +DMG% aussi | ❌ **FAUX** — deux termes différents de la formule, multiplicatifs entre eux |
| Mirinae majore les dégâts subis → donc la Marque se comporte pareil | ❌ **FAUX** — la Marque agit sur les bombes et le bucket Additionnel, Mirinae non |
| Mirinae épargne bombes et Additionnel → donc Dr. Matteo aussi | ✅ vrai, **mais vérifié avant d'être écrit** |

Ce qui rend le piège vicieux : l'analogie est toujours *plausible*, souvent
appuyée sur un libellé de jeu quasi identique (« +X % de dégâts subis » pour
la Marque comme pour Mirinae). Et une fois écrite dans un commentaire — pire,
figée dans un test — elle ne se rejoue plus.

**Règle** : une mécanique voisine se **mesure** ou se **cite** (source
explicite), jamais ne se déduit. En attendant, le dire dans le code ET dans la
spec, avec le chiffre que l'autre hypothèse donnerait — c'est ce qui rend
l'erreur détectable quand la mesure arrive.

**Source de référence pour les dégâts** :
[swcalc.cz/game-mechanics](https://swcalc.cz/game-mechanics), qui donne la
formule terme par terme. ⚠️ Elle a corrigé deux des erreurs ci-dessus — la
consulter AVANT de déduire coûte moins cher que de corriger après.

## 7. « Confirmé par l'utilisateur » n'est pas une preuve

⚠️ Ces annotations sont précieuses mais **datées et faillibles**. Une mesure
en jeu les périme sans discussion.

**Incident** : `damage.ts` et son test portaient tous deux « UNE FOIS par
sort (pas `×coups`, confirmé par l'utilisateur) » pour Sickle Blade / Sand
Blade. C'était une erreur — les dégâts s'appliquent à chaque coup, établi par
le relevé Shahat. **Le test verrouillait donc le bug au lieu de le
détecter.**

⚠️ **Une DÉDUCTION figée dans un test est aussi dangereuse.** Même session :
un test affirmait « Marque + ligne élémentaire : ADDITIF (2 740), pas
multiplicatif (qui donnerait 2 800) ». Le chiffre venait d'une analogie
(§6 ter), pas d'une mesure — mais une fois vert, il avait l'autorité d'un
fait. Quand la vraie valeur est arrivée, le test a échoué *contre elle*.
**Un test qui fige une hypothèse doit le DIRE dans son libellé**, sinon il se
lit comme une vérité établie au prochain passage.

Quand une mesure contredit une annotation de ce type : le signaler
explicitement avant de changer quoi que ce soit (c'est une confirmation
antérieure qu'on renverse, pas un trou qu'on comble), et **retirer
l'annotation en même temps que le calcul** — pas la laisser cohabiter avec le
comportement corrigé.

## 8. Le test est la seule protection d'une curation

Une entrée curée par nom n'est protégée par rien d'autre : ni le typage, ni
le balayage du corpus, ni le comportement observable ailleurs. Supprimez-la
et le sort repart silencieusement dans la branche générale.

Chaque entrée d'une table `*_CONNUS` doit donc avoir **son** test, et ce test
doit dire à quoi il sert. Le cas idéal existe parfois : Kobold Bomber porte
`Firecracker` (frappe) **et** `Time Bomb` (pose) — un seul monstre, deux
résultats opposés, le discriminant est verrouillé par construction.

## Voir aussi

- `spec/outils/degats-reels.md` — le modèle de dégâts et ses corrections,
  avec les relevés en jeu qui les fondent.
- `algo-verify` — discipline de correction ALGORITHMIQUE (recherche
  combinatoire) ; ce skill-ci porte sur la fidélité aux DONNÉES, pas sur
  l'algorithme.
