# Dégâts réels — attaque déclenchée après un sort

**Statut :** ÉTAT ACTUEL — décrit le mécanisme générique d’une attaque qui frappe après certains sorts — passif (Tempest) ou compétence active appelée —, son interrupteur et son choix comme sort
**Lire si :** on ajoute une attaque déclenchée après un sort (un des 81 identifiants de même architecture du lot 1f), ou on modifie `slotsDeclencheurs`, `selectionnableCommeSort`, `ATTAQUES_APPELEES_PAR_DECLENCHEUR`, `passifPeutSuivre` ou le choix d’un passif dans « Compétence utilisée »
**Ne pas lire si :** on travaille sur un passif qui suit n’importe quel sort (Feng Yan, Sia…) ou sur les coups d’un même sort
**Voir aussi :** spec/outils/degats-reels/passifs-offensifs.md, spec/outils/degats-reels/artefacts-critique-et-element.md, spec/outils/degats-reels/sequences-de-coups.md

## Le mécanisme

Certaines compétences ajoutent une attaque **après** un sort : Tempest
(`3213`, Teshar vent `14513` et Phoenix vent `14503`) frappe tous les ennemis
« once more … after you attack the enemy on your turn ». Le mécanisme est
générique (cadrage `spec/chantiers/degats-et-aura.md`, lot 9) : une
compétence supplémentaire **à profil propre**, déclenchée **après certains
sorts**, **activée par un interrupteur**, et **sélectionnable seule** quand le
produit le demande. Elle vit dans la liste curée des passifs offensifs
(`PASSIFS_OFFENSIFS_CONNUS`, [damage.ts](../../../src/lib/damage.ts)) et passe
par le même calcul que tout passif — voir
[passifs offensifs](passifs-offensifs.md).

L’attaque peut aussi être une compétence **active** de la fiche : la S2 de
RYU (Shoryuken) enchaîne sa S1, « [Hadoken] will be activated in
succession ». Elle ne peut pas vivre dans la liste des passifs, qui ne lit
que des passifs et les reconnaît par leur nom : une table frère,
`ATTAQUES_APPELEES_PAR_DECLENCHEUR`, la décrit par son sort déclencheur, et
`monsterOffensivePassives` la rend au même format, en fin de liste — même
porte (`passifCompte`), même calcul (degats-et-aura 9c, voir
« Ce qu’il faudra fournir »). Cette table est **vide** : aucun cas n’est
encore curé.

| Paramètre | Champ curé | Tempest | Source |
| --- | --- | --- | --- |
| Profil : ratio, portée, coups, améliorations | formule de la fiche, ou `FORMULES_CUREES_PAR_ID` si elle manque | `3.7 × ATQ`, zone, une instance, +30 % | utilisateur et audit (A.2 ter) |
| Sorts déclencheurs | `slotsDeclencheurs` | S1, S2 | utilisateur (A.2 ter) |
| Inclusion | catégorie `conditionnel` : interrupteur désactivé par défaut | recharge non simulée | décision produit (A.2 ter) |
| Choix seul | `selectionnableCommeSort` | oui | décision produit (lot 9) |

Les valeurs de Tempest sont celles du cadrage (A.2 ter, utilisateur le
2026-09-23) ; les lignes d’artéfact viennent de `controle-1c1-amendement.md`
(preuve privée du lot 1c1, réponses de l’utilisateur du 2026-09-23).

## Après le sort — l’interrupteur

- `passifCompte(passif, sort, réglage)` décide si l’attaque compte, pour
  `computeTotalDamage` ET `damageRelevantStats` — une seule porte, jamais
  deux copies. Elle exige `passifPeutSuivre` : le passif n’est pas lui-même
  le sort choisi, et le slot du sort RETENU figure dans `slotsDeclencheurs`
  (jamais `setup.skillCom2usId`, qui vaut `null` pour « le sort par
  défaut ») ; puis l’interrupteur (`passifsOffensifs`, clé = identifiant du
  passif).
- L’attaque frappe après le sort, sur une cible déjà entamée. Ses lignes
  222/223 lisent les PV que le sort laisse ; 411 ne la touche jamais, le sort
  ayant été la première attaque du tour ; 402/410 la touchent une fois, par
  son slot (3) ; elle n’hérite jamais de la ligne du sort déclencheur (400
  pour S1, 401 pour S2) ; 224 l’ignore, elle est en zone.
- À l’écran, son interrupteur dit ce que l’utilisateur suppose pour le
  calcul : « **Tempest (S3) se déclenche après ce sort** », désactivé par
  défaut (réponse n° 11 de l’utilisateur, 2026-10-02). Le libellé est
  construit, `<nom> (S<slot>) se déclenche après ce sort`, pour tout passif
  `conditionnel` à slots déclencheurs. Il remplace la phrase « Se déclenche
  si … » des autres interrupteurs ; la condition curée reste au survol, la
  description du jeu en dessous.
- L’interrupteur n’est affiché que si le passif **peut suivre** le sort
  choisi (`passifPeutSuivre`) : il est **masqué** quand le passif est
  lui-même la compétence choisie (réponse n° 10). Même règle pour un futur
  cas dont le sort choisi ne serait pas un déclencheur : un bouton sans effet
  possible n’est jamais montré.

## Choisi seul — « Compétence utilisée »

Un passif `selectionnableCommeSort` s’ajoute à la liste des sorts
(`monsterDamageSkills`) avec le profil EXACT que `monsterOffensivePassives`
construit pour lui (`SkillDamageProfile.passif` vrai) — jamais par
`skillDamageProfile`, qui écarte toujours les passifs. Une seule source :
Tempest choisi seul vaut ce qu’il ajoute après le S1 ou le S2, à l’état de la
cible près (PV et réduction de Défense saisis, au lieu de ceux que le sort
laisse).

| Règle | Tempest seul | Source |
| --- | --- | --- |
| Sort par défaut | jamais : `defaultDamageSkill` ne retient que les sorts actifs, Teshar reste sur S2 | réponse n° 9 de l’utilisateur (2026-10-02) |
| Contribution | une seule : le passif n’est jamais ajouté à lui-même, même interrupteur resté allumé | A.2 ter, « Tempest seul » |
| 411 | jamais : il frappe toujours après le S1 ou le S2 qui le déclenche | A.2 ter, « Artéfact 411 » |
| 402/410 | une fois (slot 3) | `controle-1c1-amendement.md` |
| 400/401 | jamais (lignes du S1 et du S2) | slot du profil |
| 224 | jamais (zone) | portée du profil |
| PV de la cible | ceux saisis : l’état avant Tempest | cadrage, lot 9 |
| Recette | `skillCom2usId` = `3213`, l’identifiant d’un passif, se résout en Tempest (`resolveDamageSkill`), à l’écran comme au CLI | cadrage, recalage du lot 9 |

Le CLI (`scripts/optimizer-search.ts`) affiche l’état de chaque passif par
`passifCompte`, avec le sort retenu, et annonce « choisi comme sort : compté
une seule fois » plutôt qu’un « désactivé ».

⚠️ **Réservé à un passif sans ajustement propre à la boucle des passifs** :
`critique` à `'suit'`, ni `coupsDuSortActif`, ni `bonusPvCible`, catégorie
`conditionnel`. Choisi seul, il est calculé comme un sort, où ces ajustements
n’existent pas ; le test vérifie le corpus entier. De même, le profil d’un
passif porte `appliqueDefBreak: false` : exact pour Tempest (`Reduce
Cooltime`, `Stun`), à relire sur les effets d’un futur cas qui poserait une
réduction de Défense.

## Ce qu’il faudra fournir pour un autre cas

Le lot 1f a classé **81 identifiants de même architecture**, qu’aucun calcul
ne couvre encore (lot 13) : 58 de la famille `tempest`, les S2 des Kung Fu
Girls `8216`, `8217` et `8219`, et les vingt compétences des Samouraïs `8021`
à `8040` (cadrage, lot 9). Pour en ajouter un, sans rien déduire d’un cas
voisin (skill `game-data-curation`), il faut d’abord savoir de quelle
**nature** est l’attaque — deux tables, deux clés :

| Nature | Table | Clé | Profil | Déclencheurs |
| --- | --- | --- | --- | --- |
| **Passif** (Tempest) | `PASSIFS_OFFENSIFS_CONNUS` | le NOM exact du passif (`Competence.nom`) : l’identifiant d’un passif change d’une fiche à l’autre | sa formule (fiche, ou `FORMULES_CUREES_PAR_ID`), marqueur `passif` vrai | `slotsDeclencheurs`, curé |
| **Compétence active appelée** (Hadoken de Shoryuken, Rolling Punch de Drunken Kick) | `ATTAQUES_APPELEES_PAR_DECLENCHEUR` | l’identifiant du **sort déclencheur**, avec le **slot appelé** — jamais un nom : « Hadoken » est porté par 12 formes, dont 6 sans Shoryuken, « Energy Punch » par 20 | celui de la compétence active de ce slot dans la MÊME fiche (`skillDamageProfile`, comme dans « Compétence utilisée »), marqueur `passif` absent | le seul slot du déclencheur, retenu s’il est seul à ce slot dans la fiche |

Pour une compétence appelée, la ligne de table suffit : le sort par défaut,
la neutralisation de 411 (toute la boucle des passifs) et l’exclusion par
identifiant de `passifPeutSuivre` (la S1 choisie seule ne se compte qu’une
fois) ne dépendent pas du marqueur. Deux déclencheurs qui appellent le même
slot (Drunken Kick et Snake Punch de Wei Shin) donnent **un** profil, **un**
interrupteur, aux slots déclencheurs réunis. Toute garde non tenue
(déclencheur passif, slot appelé vide, occupé par un passif ou par deux
compétences, compétence appelée non calculable) écarte l’entrée, jamais un
nombre inventé. L’interrupteur a pour clé l’identifiant de la compétence
appelée : aucun autre réglage ne doit lire cette clé de `passifsOffensifs`
(conditions « manuel » ou « effet néfaste présent » du sort, bonus
conditionnel propre, bonus par effet binaire, réglages du monstre) — vrai
pour les douze compétences appelées par les 17 amorces, gardé sur tout le
corpus par `testAttaqueAppeleeEspaceDeCles`.

Puis, pour l’une comme pour l’autre :

1. **Le profil** : formule (fiche, ou `FORMULES_CUREES_PAR_ID` avec sa
   source), portée, nombre de coups, améliorations. Quand l’attaque est une
   **compétence appelée** (Rolling Punch des Maîtres ivres, Hadoken de
   Shoryuken…), son profil vient de SA fiche, jamais de celle du déclencheur :
   ni ratio ni améliorations transférés (`controle-1c1-amendement.md`).
2. **Les sorts déclencheurs** : la liste des slots, curée (passif), ou
   l’identifiant de chaque déclencheur (compétence appelée).
3. **L’inclusion** : un interrupteur, jamais une probabilité tirée (A.2 ter,
   « Attaques supplémentaires conditionnelles »).
4. **Le choix seul** : décision produit, jamais un défaut.
5. **Les lignes d’artéfact**, à relever pour chaque cas : 411 dépend de ce qui
   précède — après One More Drink, un soin, Rolling Punch est la première
   attaque réelle du tour et reçoit 411 ; la compétence appelée reçoit la
   ligne de SON slot (400 pour une S1 appelée), jamais celle du déclencheur ;
   224 suit sa portée (`controle-1c1-amendement.md`).
6. **Ce que le déclencheur pose avant elle.** L’attaque frappe avec l’état
   saisi (buffs, Marque) et la réduction de Défense « après » ; aucun autre
   effet posé par le déclencheur n’est modélisé. Un effet dont le jeu dit
   qu’il est déjà actif et que le calcul lit fait classer le cas, jamais
   accepter : buff d’ATQ de Tiger Punch, buff de VIT de Seal Punch (lu par la
   ligne 221, dégâts selon la VIT buffée). ⚠️ **La Marque** que Shoryuken et
   Iron Uppercut posent (`Brand`, 100 %) n’est ni modélisée ni relevée pour
   la S1 enchaînée : **à relever avant de curer** le constat 178 — un
   rapport, un seul changement : Hadoken déclenché avec et sans Marque
   préexistante, sur une cible à forte DEF (skill `game-data-curation`,
   § 6 bis).

### Les 17 amorces des constats 168, 178 et 179 (lot 9c)

Examinées une par une (`testAttaqueAppeleeCouverture`) ; aucune n’est
curée en production.

| Amorces | Verdict | Raison |
| --- | --- | --- |
| `13907`, `13908`, `13910`, `14407`, `14408`, `14410` (178, RYU et Striker) | acceptables, une entrée chacune | même total que le profil construit à la main du lot 12 ; la Marque reste à relever (point 6) |
| `8107`, `8110` (Drunken Kick), `8113` (Phoenix Kick), `8114` (Stork Kick), `8115` (Snake Punch) (179) | acceptables, une entrée chacune | rien de ce qu’ils posent n’est lu par Rolling Punch (il ignore la DEF ; le soin ne porte que sur Stork Kick) ; Snake Punch : sa hausse de TC ne compte qu’en mode Moyenne, « pas le calcul visé » selon l’utilisateur (amendement 1c1) |
| `8106`, `8108`, `8109` (One More Drink, 179) | classées | le déclencheur est un soin, sans profil de dégâts, jamais « Compétence utilisée » ; Rolling Punch y est la première attaque du tour et reçoit 411, que la boucle neutralise |
| `8111` (Seal Punch), `8112` (Tiger Punch) (179) | classées | buff de VIT ou d’ATQ posé avant Rolling Punch, lu par le calcul (point 6) |
| `6161` (Head to Head, Mina 2A, 168) | classée | un passif qui appelle Energy Punch après **tout coup critique** de son tour, S1 comprise : la S1 s’appellerait elle-même, ce que l’exclusion par identifiant interdit ; condition liée au critique ; déclencheurs et récursion non curés |

⚠️ **Les Samouraïs ne relèvent pas de « activée par un interrupteur »** :
après S1, l’utilisateur CHOISIT S1, S2, S3 ou S4 ; après S2, S1, S3 ou S4 ;
après S3, S1, S2 ou S4 ; une S4 seule ne déclenche rien, et la compétence
suivante garde son propre profil et son slot (A.2 ter, « Samouraïs — tour
supplémentaire »). C’est un sélecteur de suite, pas un passif à bouton : il
demandera son propre réglage.

Hors de cette architecture : les deux lignes du constat 313, le stock de
dégâts de Jin et Kai ténèbres (A.2 ter).

## Vérification

`tests/degats-tempest.test.ts` (`node tests/run.mjs tempest`) : formule
curée et déclenchement après S1 ou S2 (lot 9a) ; Tempest dans la liste des
sorts, jamais par défaut, une seule contribution — aussi pour un passif
générique sans slots déclencheurs —, lignes 411, 402, 410, 400, 401, 224,
222 et 223 du cran « Tempest seul », garde du corpus
(`testDegatsTempestCommeSort`) ; aller-retour de recette avec `3213` relu par
le CLI (`testDegatsTempestRecette`) ; interrupteur à l’écran, lu sur la
source (`testDegatsTempestEcran`).

`tests/degats-attaque-appelee.test.ts` (`node tests/run.mjs attaqueappelee`),
entrées injectées puis retirées, table de production vide vérifiée :
approvisionnement par une ligne, profil identique à celui de « Compétence
utilisée », sort par défaut et liste des sorts inchangés, 411, jamais par
nom, gardes du chemin frère (`testAttaqueAppeleeApprovisionnement`) ; les 17
amorces et la raison de chaque classement (`testAttaqueAppeleeCouverture`) ;
clé de l’interrupteur libre, au score complet et sur tout le corpus
(`testAttaqueAppeleeEspaceDeCles`).
