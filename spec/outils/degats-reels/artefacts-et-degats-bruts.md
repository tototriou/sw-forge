# Dégâts réels — artéfacts et dégâts bruts

**Statut :** ÉTAT ACTUEL — décrit les dégâts additionnels bruts et les amplifications d’artéfact
**Lire si :** on modifie une ligne d’artéfact ou un bucket de dégâts additionnels
**Ne pas lire si :** on travaille sur le critique conditionnel, les bombes ou les passifs offensifs
**Voir aussi :** spec/outils/degats-reels/artefacts-critique-et-element.md, spec/outils/optimizer/ecran/artefacts.md

## Dégâts BRUTS d'un passif — ni critiques, ni mitigés, à chaque coup

Trois passifs infligent des dégâts **plats dérivés d'une stat**, en plus du
sort actif : `Sickle Blade` (**Bayek Vent**), `Sand Blade` (**Desert Warrior
Vent**, **Shahat**) et `Calculated Sacrifice` (**Onimusha**, **Fuuki**).

⚠️ **Ils sont BRUTS et s'appliquent À CHAQUE COUP** : ni critiques, ni mitigés
par la défense adverse. Ils passent donc par `horsCoupBrut`, jamais par
`horsCoup`.

`horsCoupBrut` conserve délibérément les amplificateurs **côté cible**
(marque, Mirinae, « Increase Damage ») : ce sont des majorations des dégâts
subis, quelle qu'en soit la nature — c'est exactement le traitement déjà
réservé à un sort `profile.fixed`, plutôt qu'une seconde convention
parallèle. Il exclut en revanche `skillupDamagePct` : les améliorations du
sort **actif** n'ont aucune raison de majorer le bonus plat d'un **passif**,
qui n'appartient pas à sa formule.



- **Sickle Blade/Bayek (Vent)** et **Sand Blade/Desert Warrior (Vent), Shahat** : « additional damage that's 7% of your MAX HP when you attack on your turn » — confirmé (`quantite: 7`).

## Creusement des PV et contrôle des deux axes
⚠️ **Le terme est creusé de `pvCourant` DANS la boucle**, avec le coup qui le
porte. L'ancien `ajoutUneFois`, appliqué en bloc après la boucle, avait déjà
valu un bug de `pvRestantsPct` surestimé (un seuil de passif « si PV restants
≤ X % », Final Strike/Benedict, pouvait manquer sa cible). Par coup, cette
classe de bug ne peut plus se reformer.

⚠️ **Le test couvre les DEUX axes**, et le second exige un sort ORDINAIRE : la
compétence neutre des tests porte `(Fixed)`, donc `horsCoup` y vaut 1 — un
terme mitigé y serait indiscernable d'un terme brut. Sans cette précaution, on
ne teste que la cadence.


## Le voisinage, lui, est correct

L'inventaire des autres termes de dégâts plats a été passé en revue et n'a
**rien à corriger** — `ajoutParCoup` traverse `horsCoup` à juste titre :

| Terme | Passif | Monstres | Critique / mitigé | Cadence |
|---|---|---|---|---|
| `ajoutCompteur` | `Rage Charge` (sur `Hammer Punch` S1) | Crawler, Frankenstein | **oui** ✅ | par coup ✅ |
| `ajoutCiblePvMax` | `Spear of Tenacity` | Centaur Knight, Pholus | **oui** ✅ | par coup ✅ |
| `ajoutEcartDef` | `Martial Arts Specialist` | Martial Artist, Sin | **oui** ✅ | par coup ✅ |

⚠️ **Ce tableau vaut d'être conservé bien qu'il ne déclenche aucun travail** :
c'est la trace que ces trois-là ont été **vérifiés**, et non pas seulement
supposés corrects — exactement la distinction qui manquait à `ajoutUneFois`.


## Amplification de buff par artéfact — ATQ, DEF, VIT

Quatre lignes d'artéfact amplifient la **magnitude** d'un buff **déjà actif**,
jamais la stat plate elle-même, et jamais un buff absent (sans buff, il n'y a
rien à amplifier) :

| Code | Libellé du jeu | Buff amplifié |
|---|---|---|
| 204 | `Effet renforcement ATQ +X%` | `ATK_BUFF_PCT` (50) |
| 205 | `Effet renforcement DEF +X%` | `DEF_BUFF_PCT` (70) |
| 206 | `Effet aug. VIT +X%` | `SPD_BUFF_PCT` (30) |
| 226 | `Effet renforcement ATQ/DEF +X%` | **les deux** |

⚠️ **226 est UNE ligne du jeu qui porte sur deux stats** — elle compte donc
en entier des deux côtés, ce n'est pas un partage.

Plusieurs lignes identiques sur des artéfacts différents **se cumulent**,
comme en jeu. Et l'amplification d'artéfact **s'additionne** à celle de
Miriam avant de multiplier la potence de base :
`potence × (1 + (artéfact + Miriam) / 100)`. Les traiter multiplicativement
l'un envers l'autre inventerait un empilement que le jeu ne fait pas.


## Dégâts supplémentaires proportionnels à une stat (218-221)

Quatre lignes d'artéfact ajoutent des dégâts **BRUTS** — ni critiques, ni
mitigés par la défense adverse — **à chaque coup**, proportionnels à une stat
de l'attaquant :

| Code | Libellé du jeu | Plafond |
|---|---|---|
| 218 | `Dgts supp. en prop. des PV : X%` | 1,5 |
| 219 | `Dgts supp. en prop. de ATQ : X%` | 20 |
| 220 | `Dgts supp. en prop. de DEF : X%` | 20 |
| 221 | `Dgts supp. en prop. de VIT : X%` | 200 |

⚠️ **Les échelles n'ont rien à voir entre elles, et c'est normal** : 1,5 % de
40 000 PV, 20 % de 2 000 ATQ et 200 % de 200 VIT donnent des ordres de
grandeur comparables (≈ 600, 400, 400). Ne jamais « normaliser » ces valeurs
l'une par rapport à l'autre. Les quatre cumulées au plafond valent **≈ 1 600
par coup** — d'où leur intérêt sur les sorts qui frappent beaucoup de fois.

Elles rejoignent le **même accumulateur** que les dégâts bruts de passif
(voir plus haut) : même nature, même traitement, pas un second mécanisme.

⚠️ **Les stats lues sont BUFFÉES** (buff d'ATQ, lead et invocateur déjà
appliqués), pas les stats nues — c'est la même source que le reste de la
formule. Faire lire des stats nues à ces seules lignes créerait deux notions
d'« ATQ » dans le même calcul.



- **Rétention de recherche.** Les lignes 218–221 n’entrent jamais dans `damageRelevantStats` : elles récoltent les statistiques déjà présentes sur le build sans réorienter les statistiques recherchées.
- **Dominance des runes.** Elle, en revanche, les compte : un bonus de set dont la stat nourrit une de ces lignes
  (Energy pour la ligne 218, Guard pour la 220, Fight, Determination…) n’est
  pas « inutile », et la dominance, élagage **sûr**, ne doit pas le remplacer
  par un set aux mêmes stats de rune. Les stats protégées sont celles des
  lignes de la paire supposée et, en « Libre », de tout artéfact éligible que
  le choix de la paire peut retenir (`statsLignesArtefactsEquipables`), en
  « Dégâts réels » seulement. Voir
  [../optimizer/moteur/elagages.md § Dominance — lignes d'artéfact 218–221](../optimizer/moteur/elagages.md).

## ⚠️ Le bucket Additionnel ne reçoit AUCUN bonus de type DMG%

Ni les lignes élémentaires, ni Mirinae, ni les bonus « +X % par effet » d'un
sort. **Seule la Marque le majore.**

**Relevé Julie — il tranche et il calibre en même temps.** S3 « Thousand
Shots » : +50 % par effet **bénéfique** sur la cible. Julie montée en DEF/PV
(2 139 DEF, 26 545 PV) avec deux lignes d'artéfact (21 % de la DEF, 0,7 % des
PV), contre un Feng Yan très défensif — la haute DEF écrase la part du sort et
laisse la part brute dominer :

| Cible | Buffs sur elle | Dégâts / coup |
|---|---|---|
| Feng Yan **sans** Will | 0 | ~700 |
| Feng Yan **en** Will (Immunité) | 1 → +50 % | ~730 |

Si le +50 % touchait tout, on lirait **1 050**. En le réservant à la part du
sort, le système `S + A = 700` / `1,5·S + A = 730` donne **S = 60, A = 640**.

⚠️ **Et le modèle prédit A = 635** (`0,21 × 2 139 + 0,007 × 26 545`) — moins de
1 % d'écart. Le même relevé confirme donc **l'isolement** du bucket ET la
**formule** des lignes 218-221 (par coup, brutes, sur les stats buffées).

**Relevé Jessica — le même verdict par l'autre porte.** « Blessing of Curse »
majore de +20 % par effet **néfaste sur les alliés, soi compris** (« allies
(including yourself) »), jusqu'à +200 % — pas seulement ceux qui sont sur
Jessica : les débuffs de chacun de ses alliés comptent aussi. Julie, elle,
compte les buffs de la **cible** : deux membres différents de la famille,
tous deux mesurés. Jessica à 53 050 PV / 827 DEF / 163 VIT, artéfacts 2 % PV
+ 6 % DEF + 102 % VIT, contre un Xiong Fei très défensif, **en coup
critique** :

| Débuffs comptés (tous sur Jessica) | Bonus au sort | Dégâts |
|---|---|---|
| 0 | — | ~2 250 |
| 1 | +20 % | ~2 450 |
| 2 | +40 % | ~2 600 |

Les débuffs du relevé étaient tous sur Jessica elle-même : c'est un cas
particulier de la règle (elle fait partie des alliés), loin du plafond. Un
débuff sur un allié aurait compté de la même façon ; le relevé ne le mesure
pas, mais ne change pas pour autant.

Si le +20 % touchait tout, 2 débuffs donneraient **3 150**. Le modèle prédit
un additionnel de **1 277** (`0,02 × 53 050 + 0,06 × 827 + 1,02 × 163`) ; la
résolution du système en donne **1 250**.

⚠️ **Et ce relevé prouve, indépendamment, que le bucket ne CRITE pas.** Les
trois mesures sont des critiques : un additionnel critique (×2,5) vaudrait à
lui seul 3 192, soit plus que le total observé de 2 250. Impossible.

> Les trois paires de mesures donnent des parts de sort un peu différentes
> (1 000 / 875 / 750) : c'est la variance (±2,8 %) plus l'arrondi des
> « environ », sur des totaux de ~2 500. La part ADDITIONNELLE, elle, reste
> serrée autour de la prédiction.

> ⚠️ **Le plafond de 1,5 vaut PAR ARTÉFACT, pas par monstre.** Un monstre en
> porte deux (attribut + type), qui peuvent chacun avoir la ligne : les
> valeurs de relevé au-delà du plafond (2 % chez Jessica, 2,3 % chez Momo)
> sont des **cumuls des deux pièces**, pas des lignes gemmées.
> `artifactDamageProfile` somme bien sur l'ensemble des artéfacts — c'est ce
> qui rend ces relevés cohérents.
>
> Au passage : la ligne du relevé Julie vaut **0,7 %**, pas 7 % comme annoncé
> d'abord. À 7 % elle donnerait 2 307 par coup, plus du triple du total
> observé ; le calcul l'avait déduit avant confirmation.


## Les modificateurs appliqués APRÈS coup ne le touchent pas non plus

Sonia, Momo, Zenitsu, Gideon, Brita, Velaska… : ces bonus multiplient le total
dans `computeTotalDamage`, après l'accumulation du sort et des passifs. Ils
sont de type DMG%, donc **le bucket Additionnel leur échappe**.

**Relevé Momo.** 53 545 PV, ligne « Dgts supp. en prop. des PV » à **2,3 %**
(le cumul des DEUX artéfacts), **sans critique**, contre un Feng Yan très
défensif :

| Stack | Bonus au sort | Dégâts / coup |
|---|---|---|
| aucun | — | ~1 300 |
| plein | +200 % (×3) | ~1 700 |

Si le stack touchait tout, on lirait **3 900**. En le réservant à la part du
sort : part du sort ≈ 200, additionnel ≈ 1 100 — le modèle en prédit **1 232**.
L'écart (~11 %) est plus large que sur Julie ou Jessica : les deux mesures
sont arrondies à la centaine, ce qui déplace la résolution de plusieurs
dizaines dans chaque sens.

⚠️ **Ce que ça a coûté en structure** : `computeSkillDamageDetail` remonte
sa part additionnelle (`additionnel`), et `computeTotalDamage`
l'accumule — **sur le sort ET sur chaque passif** — puis la met de côté avant
toute la chaîne de multiplicateurs, pour ne la rendre qu'à la fin. Les
majorations propres à un passif (`bonusPvCible`, `bonus`) sont traitées pareil,
sur sa seule part de sort.


## `ArtifactDamageProfile` — un objet, pas une liste de nombres

`artifactDamageProfile(artifacts)` réduit une paire d'artéfacts à ce qu'elle
apporte au calcul. Il **remplace** l'ancien paramètre `ampliVitPct: number`,
qui ne portait que la VIT.

⚠️ **Un objet plutôt qu'un scalaire de plus, délibérément.** Cette donnée
traverse **six emplacements** — `damage.ts`, `runeBuildOptim.ts`
(`RealDamageContext`), `OptimizerSection.tsx`, `DamageSetupCard.tsx`, et les
deux scripts CLI `optimizer-search.ts` / `optimizer-search-analyze.ts`.
Ajouter chaque ligne d'artéfact comme un paramètre positionnel de plus aurait
obligé à repasser sur les six à chaque fois ; un champ ajouté à l'objet
n'oblige plus à toucher aucune signature.


## Extracteur de l’amplification du buff VIT
`speedBuffAmpliPct` survit comme extracteur de la seule VIT : `maVitCombat`
n'a besoin que de celle-là, et la vitesse de combat se calcule dans des
contextes qui n'ont rien à voir avec les dégâts.
