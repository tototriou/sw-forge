# Dégâts réels — critique et élément

**Statut :** ÉTAT ACTUEL — décrit les lignes d’artéfact de critique et de dégâts élémentaires
**Lire si :** on modifie les lignes 210, 222–224, 300–304, 400–411 ou leur ordre d’application
**Ne pas lire si :** on travaille sur les dégâts bruts additionnels ou la détection et la formule des bombes
**Voir aussi :** feat-artefacts-et-degats-bruts.md, [../optimizer/](../optimizer/) (carte « Artéfacts »)

## Dgts CRIT qui VARIENT d'un coup à l'autre (411, 222, 223)

Trois lignes d'artéfact ne valent pas la même chose sur tous les coups d'un
même sort — les seules dans ce cas.

| Code | Libellé du jeu | Variation |
|---|---|---|
| 411 | `Dgts CRIT 1re attaque` | **premier coup seulement** |
| 222 | `D.CRIT+ selon bon état PV enn.` | **rampe linéaire** : plein à 100 % des PV de la cible, rien à 0 % |
| 223 | `D.CRIT+ sel. mauv. étt PV enn.` | **rampe inverse** : rien à 100 %, plein à 0 % |

Aucun palier : à 50 % de PV, chaque rampe vaut exactement la moitié. Un test
le vérifie explicitement, parce que c'est le seul point qui distingue une
rampe d'un seuil.


## Rien n'est « recalculé » — le terme est AFFINE

On pourrait croire qu'il faut refaire tout `horsCoup` à chaque coup, puisque
ces lignes changent les Dgts Crit et que les PV de la cible baissent en cours
de sort. **Non** : `cr`, `cd` et `partCrit` sont calculés une seule fois, seul
`pvFrac` varie. D'où :

```
horsCoup(coup i) = horsCoup + coefCdParCoup × deltaCdPoints(i, pvFrac)
      avec  coefCdParCoup = partCrit × K / 100     (K invariant)
```

Deux constantes précalculées, puis une multiplication-addition par coup.

⚠️ **Le vrai coût n'est donc pas là**, mais dans le fait de **forcer le chemin
séquentiel** sur des sorts qui prenaient le chemin court. Deux garde-fous :

- **`partCrit === 0` court-circuite tout** (sort `fixed`, ou mode « jamais
  critique ») : ces lignes ne peuvent alors rien changer, et le chemin court
  est conservé. Un build non-critique ne paie rien.
- **Le multiplicateur de la formule est évalué UNE fois** quand elle ne lit
  pas les PV de la cible. Sans ça, un sort poussé dans la boucle par les
  seules lignes d'artéfact paierait `coups` évaluations d'arbre pour rien.

**Mesuré** (`computeTotalDamage` seul, 1 M d'évaluations, Lushen S3) :

| Coups | Chemin court | Séquentiel forcé | Surcoût |
|---|---|---|---|
| 1 | 213 ns | 250 ns | ×1,17 |
| 3 | 235 ns | 281 ns | ×1,20 |
| 6 | 200 ns | 270 ns | ×1,35 |

⚠️ C'est le coût de `computeTotalDamage` **seul** — une fraction de
l'évaluation d'un candidat dans l'optimiseur, qui construit aussi les stats et
vérifie les contraintes. Et il n'est payé que si les artéfacts portent
réellement une de ces trois lignes ET que le build peut critiquer.


## ⚠️ 411 vaut pour la première attaque DU TOUR, pas de chaque contribution

`computeTotalDamage` calcule le sort actif, puis chaque passif offensif. Le
sort a déjà consommé « la première attaque » : les passifs reçoivent donc un
profil dont `cdPointsPremiereAttaque` est remis à zéro. Sans ça, un monstre à
trois passifs encaisserait le bonus quatre fois.

Un passif choisi lui-même comme sort (Tempest seul, `SkillDamageProfile.passif`)
garde ce profil sans 411 : il frappe toujours après le S1 ou le S2 qui le
déclenche ([valeurs curées](valeurs-de-jeu-curees.md), « Artéfact 411 » : « jamais sur Tempest, même
sélectionné seul ») — voir [attaque après un sort](feat-attaque-apres-un-sort.md).

Même règle pour un sort à séquence de coups (Blade Surge) : 411 ne vaut que
pour le premier coup de la séquence, jamais pour le coup de zone, et le cran
« autres ennemis » ne rouvre pas ce compteur — voir
[séquences de coups](feat-sequences-de-coups.md).


## Dgts CRIT conditionnels au SORT (400-403, 410, 224)

Ces lignes ajoutent des **POINTS** de Dgts Crit — comme les compétences
d'invocateur ou Euldong, jamais un pourcentage de la stat — mais **seulement
quand le sort calculé est celui qu'elles visent**.

| Code | Libellé du jeu | S'applique à |
|---|---|---|
| 400 / 401 / 402 / 403 | `[Comp.N] Aug. Dgts CRIT` | le sort du slot N |
| 410 | `Dgts CRIT [compétence 3/4]` | les slots **3 ET 4** |
| 224 | `D.CRIT+ comp cib uniq pdt tour` | les sorts **mono-cible** (`aoe === false`) |

⚠️ **410 compte EN ENTIER pour les deux slots**, ce n'est pas un partage —
même logique que le code 226 pour ATQ/DEF.

⚠️ **402/403 existent mais ne sont pas dans la recherche détaillée du jeu**,
qui ne propose que 400, 401, 410 et 411 (voir `SUB_ORDER`, effects.ts) : les
deux formes sont gérées, un inventaire ancien pouvant porter les secondes.

Tout est **déduit du profil du sort** (`slot`, `aoe`), rien n'est saisi —
`artifactCritDamagePoints()` est la seule porte d'entrée.

⚠️ **`aoe` du profil n'est pas toujours `aoe` de la donnée.** Quand la prose du
sort contredit la donnée, `PORTEE_CORRIGEE_PAR_ID` la remplace : Hollow Purple,
Explosion and Blaze, God's Weapon, Bullet Assassination, Shining Butterfly et
Incinerate sont de zone (la 224 ne s'y applique plus) ; Ramon est mono-cible.
Liste et proses : [conditions et audit](feat-conditions-et-audit.md). Crush de Taor
reste en `aoe: true` : sa 224 en jeu est à relever.

⚠️ **Un sort à séquence de coups reçoit 224 coup par coup.** Pour Blade
Surge, le calcul passe à cette fonction le profil de chaque groupe de coups,
dont `aoe` est la portée du groupe : 224 porte sur les coups 1 et 2
(mono-cible), jamais sur le coup de zone ; 400 porte sur les trois. Voir
[séquences de coups](feat-sequences-de-coups.md).


## Dégâts de bombe (210)

⚠️ **`SkillDamageProfile.bombe` est DISTINCT de `fixed`.** Toute bombe est
fixe, mais un sort ordinaire marqué `(Fixed)` est fixe **sans être une
bombe** — et ne doit donc pas profiter de cette ligne. Les confondre
majorerait des sorts qui n'ont rien d'une bombe.

Le relevé Seara le vérifie dans les deux sens : +24 % appliqués à
`Fate of Destruction` (ce qui recale le second relevé, ~34 000), et
strictement aucun effet sur un sort fixe ordinaire.


## Dégâts infligés par élément (300-304) — et le choix de la cible

`Aug. des dgts infl. au Feu / à l'Eau / au Vent / à la Lum. / aux Tén.`
(plafond 25) : un artéfact d'**attribut** majore les dégâts infligés à UN
élément précis.

⚠️ **Ces lignes ne comptent que si l'utilisateur dit contre quel élément il
optimise** — `DamageSetup.enemyElement`. Deux modes, tous deux légitimes :

- **viser un élément** — la ligne correspondante s'applique pleinement, et
  l'artéfact d'attribut se juge largement dessus ;
- **ignorer l'élément** (`null`, le défaut) — ces lignes comptent **0**, et
  l'artéfact d'attribut se juge sur ses autres propriétés (typiquement
  204/226).

⚠️ « Ignorer » est un **choix**, pas un repli dégradé : optimiser « contre
n'importe qui » est un cas d'usage à part entière. L'écran l'expose donc comme
une option du contrôle à cran, jamais comme une absence de sélection.

⚠️ **Une recette exportée AVANT ce champ n'en porte aucun** → `undefined` →
« ignorer l'élément », soit exactement le comportement qu'elle avait à
l'export. Aucune traduction spéciale n'est nécessaire.

⚠️ **Ne pas confondre avec le paramètre `element` de
`computeSkillDamageDetail`**, qui est celui de l'**attaquant** (il décide des
compétences d'invocateur). `enemyElement` décrit la **cible**.


## ⚠️ MULTIPLICATIF avec la Marque — deux brackets distincts

Ces lignes vivent dans le terme **DMG%**, la Marque dans **Réductions**. Les
deux brackets sont additifs *en interne* et **multiplicatifs entre eux** :
`× 1,12 × 1,25`, et non `× (1 + 0,12 + 0,25)`.

> ⚠️ **Ne pas les compter dans `reductions`** par symétrie avec Mirinae, qui
> « stacks additively with **-DMG%** artifacts » (utilisateur) : les artéfacts
> −DMG% (codes 305-309, dégâts *subis*) sont bien dans Réductions, mais la
> famille +DMG% *infligés* est un terme entièrement différent
> ([swcalc.cz/game-mechanics](https://swcalc.cz/game-mechanics)). Additives
> avec la Marque, elles donneraient 2 740 au lieu de 2 800 sur le cas du test.


## ⚠️ Jamais sur une bombe, jamais sur le bucket Additionnel

**Mesuré en jeu par l'utilisateur** :

| | Bombe | Passif de Shahat (bucket Additionnel) |
|---|---|---|
| Artéfact élémentaire | ❌ | ❌ |
| Mirinae | ❌ | ❌ |
| Dr. Matteo (Transmission) | ❌ | ❌ |
| **Marque** | ✅ | ✅ |

⚠️ **Dr. Matteo a été MESURÉ, pas déduit de Mirinae.** Sa formulation en jeu
est quasi identique, et il aurait été tentant de reconduire l'analogie — mais
les deux analogies précédentes de ce fichier (les artéfacts −DMG%, puis le
placement des lignes élémentaires) se sont révélées **fausses**. Celle-ci a
donc été vérifiée avant d'être écrite.

⚠️ **La Marque et Mirinae ne sont donc PAS de la même famille**, malgré des
libellés quasi identiques (« +X % de dégâts subis »). Les traiter ensemble —
ce que faisait le terme `reductions` — majorait à tort les bombes et tout le
bucket Additionnel. D'où `reductionsUniverselles` (la Marque seule, valable
partout) distinct de `reductions` (Mirinae en plus, hors bombe et hors
`fixed`).

⚠️ Un sort ordinaire marqué `(Fixed)` profite en revanche du DMG%
(swcalc : « skill-based fixed damage … is still multiplied by (1 + DMG%) ») —
c'est exactement ce que le drapeau `bombe`, **distinct de `fixed`**, permet
d'exprimer.


## ⚠️ Le réglage est TOUJOURS affiché — il décrit l'adversaire

« Élément visé » se pose au même titre que les PV et la DEF de la cible, sans
condition.

⚠️ **Ne pas le conditionner à la présence d'une ligne 300-304 sur les
artéfacts pris en compte**, pour deux raisons dont la seconde est décisive :

1. **La chronologie** — on configure l'adversaire AVANT toute recherche, à un
   moment où rien ne dit encore quels artéfacts seront retenus (et en
   pratique, il y en aura presque toujours un qui porte la ligne : un tel
   filtre ne filtrerait quasiment rien, il clignoterait).
2. **Le sens de la dépendance** — ce réglage est une **entrée** du choix
   d'artéfact, pas une conséquence. Le choix « Libre » des artéfacts, qui
   cherche le meilleur artéfact ([optimizer/](../optimizer/)),
   sert précisément à trancher entre un artéfact élémentaire et un autre :
   masquer le réglage tant qu'aucun
   artéfact équipé ne porte la ligne reviendrait à cacher ce qui décide du
   choix en attendant que le choix soit fait.

C'est la différence de fond avec `montreDefEnnemie` ou « PV restants » : ces
deux-là sont pilotés par ce que le **sort** consomme — connu d'avance,
immuable, et indépendant de tout ce que la recherche pourrait décider. La
règle « n'afficher que ce que le calcul consomme » vaut pour les entrées
DÉDUITES du sort, pas pour celles qui orientent la recherche.
