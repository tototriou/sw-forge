# Dégâts réels — attaque déclenchée après un sort

**Statut :** ÉTAT ACTUEL — décrit le mécanisme générique d’un passif qui frappe après certains sorts, son interrupteur et son choix comme sort (Tempest)
**Lire si :** on ajoute une attaque déclenchée après un sort (un des 81 identifiants de même architecture du lot 1f), ou on modifie `slotsDeclencheurs`, `selectionnableCommeSort`, `passifPeutSuivre` ou le choix d’un passif dans « Compétence utilisée »
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
voisin (skill `game-data-curation`) :

1. **Le profil** : formule (fiche, ou `FORMULES_CUREES_PAR_ID` avec sa
   source), portée, nombre de coups, améliorations. Quand l’attaque est une
   **compétence appelée** (Rolling Punch des Maîtres ivres, Hadoken de
   Shoryuken…), son profil vient de SA fiche, jamais de celle du déclencheur :
   ni ratio ni améliorations transférés (`controle-1c1-amendement.md`).
2. **Les sorts déclencheurs** : la liste des slots, curée.
3. **L’inclusion** : un interrupteur, jamais une probabilité tirée (A.2 ter,
   « Attaques supplémentaires conditionnelles »).
4. **Le choix seul** : décision produit, jamais un défaut.
5. **Les lignes d’artéfact**, à relever pour chaque cas : 411 dépend de ce qui
   précède — après One More Drink, un soin, Rolling Punch est la première
   attaque réelle du tour et reçoit 411 ; la compétence appelée reçoit la
   ligne de SON slot (400 pour une S1 appelée), jamais celle du déclencheur ;
   224 suit sa portée (`controle-1c1-amendement.md`).

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
