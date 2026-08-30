---
name: game-data-curation
description: Discipline à suivre pour toute table curée à partir des données de jeu SWARFARM (les ~20 tables `*_CONNUS` de damage.ts, les kits de speedTuneKit.ts, les libellés d'effects.ts) — les champs de données mentent, la prose n'est pas un discriminant, et une liste fournie de mémoire n'est jamais le corpus. Balayer, puis curer les exceptions, jamais l'inverse.
---

# Curation d'une table à partir des données de jeu (SW Forge)

`damage.ts` porte une vingtaine de tables `*_CONNUS`, curées **par nom exact
de compétence**, qui décident de mécaniques de calcul. Ce skill dit comment
en établir une sans se tromper, et comment ne pas faire confiance aux
données brutes plus qu'elles ne le méritent.

Né de quatre incidents de la même session (chantier artéfacts / bombes).

## Quand ce skill s'applique

- Ajout ou modification d'une table `*_CONNUS` dans `damage.ts`.
- Toute règle de calcul déduite d'un CHAMP des données SWARFARM
  (`coups`, `aoe`, `formule`, le NOM d'un effet, `ameliorations`…).
- Toute règle déduite de la PROSE d'un sort ou d'un effet.
- Reprise d'une liste de monstres/sorts fournie de mémoire (par
  l'utilisateur ou par une session précédente).

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

## 7. « Confirmé par l'utilisateur » n'est pas une preuve

⚠️ Ces annotations sont précieuses mais **datées et faillibles**. Une mesure
en jeu les périme sans discussion.

**Incident** : `damage.ts` et son test portaient tous deux « UNE FOIS par
sort (pas `×coups`, confirmé par l'utilisateur) » pour Sickle Blade / Sand
Blade. C'était une erreur — les dégâts s'appliquent à chaque coup, établi par
le relevé Shahat. **Le test verrouillait donc le bug au lieu de le
détecter.**

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
