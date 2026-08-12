# Référence — calcul artéfacts (score & efficience)

**Document auto-suffisant** : toutes les constantes et formules pour reconstruire
la qualité d'un artéfact sans lire le code. Implémentation :
[artifacts.ts](src/lib/artifacts.ts). Décodage SWEX : voir
[calcul-runes.md §2](calcul-runes.md).

## ⚠️ Pourquoi ce n'est PAS l'efficience des runes

Une rune se mesure sur des stats **commensurables** : +30 VIT vaut mieux que
+15 VIT sur n'importe quel monstre, et VIT/TC/DCC se ramènent à une échelle
commune parce qu'elles alimentent toutes les mêmes 8 stats de base.

Les substats d'artéfact sont **57 effets conditionnels hétérogènes** :
« Dégâts de bombe +17 % », « Vol de vie +33 % », « Dmg crit Compétence 2 +25 % ».
Il n'existe **aucun dénominateur commun** entre « vol de vie » et « dégâts de
contre-attaque » : leur valeur dépend entièrement du monstre et du mode de jeu.

⚠️ **Additionner ces effets sur une échelle unique inventerait une équivalence
qui n'existe pas dans le jeu.** On ne le fait donc pas, et aucune « efficience
d'artéfact » au sens des runes n'est proposée.

Ce qui est mesurable et vrai, en revanche : **à quel point chaque ligne est bien
rollée par rapport à son propre plafond**. Un artéfact dont les 4 substats
frôlent leur maximum est objectivement bien tombé — que ses effets te servent ou
non. C'est cette question, et elle seule, que le score mesure.

> La question « cet effet est-il utile ? » est déjà traitée ailleurs, et
> volontairement **sans note chiffrée** : les recommandations de siège listent
> les lignes voulues (voir [../siege/recommandations.md](../siege/recommandations.md)).

## ⚠️ Aucun potentiel au-delà de l'état actuel

Contrairement aux runes, **il n'existe ni meule ni gemme pour les artéfacts** :
on ne peut pas retoucher une ligne déjà tombée. Les seuls leviers sont le
**niveau** (+0 → +15, qui distribue les rolls) et la **rareté**.

Un artéfact **au +15** a donc épuisé toute sa marge : ce qu'il vaut est
définitif. Le « potentiel » se limite aux artéfacts **pas encore montés** — et
c'est une borne haute théorique (le meilleur roll possible), pas une prévision.

## 1. Rolls — la vraie mesure de qualité

`sec_effects[i] = [code, valeur, rolls, _, enchant]`

⚠️ **`sec_effects[i][2]` est le nombre d'améliorations tombées sur ce substat.**
C'est l'information centrale, et elle n'est documentée nulle part côté com2us :
vérifiée sur 2 120 artéfacts d'un compte réel, la **somme des rolls d'un
artéfact** vaut exactement le nombre d'améliorations que sa rareté distribue.

| Rareté (`natural_rank`) | Rolls distribués au +15 | Vérifié sur |
|---|---|---|
| 3 — Rare | **2** | 22 artéfacts |
| 4 — Héroïque | **3** | 1 371 artéfacts |
| 5 — Légendaire | **4** | 715 artéfacts |

Deux cas passent sous ce compte, et c'est normal :
- l'artéfact n'est **pas encore monté au +15** (les rolls suivent le niveau) ;
- une ligne a été **convertie** — le jeu la remplace et son compteur de rolls
  repart à zéro, sans que l'artéfact les récupère. Relevé sur 12 artéfacts
  (0,6 %) d'un compte réel.

⚠️ En revanche, **aucun artéfact ne dépasse jamais son quota** : c'est ce que
vérifie [artefacts.test.ts](tests/artefacts.test.ts), et un dépassement
signifierait qu'on lit le mauvais index.

⚠️ **`[4]` (`enchant`) n'est PAS un compteur de rolls** — c'est le marqueur de
substat modifié (voir [artefacts.md](artefacts.md)). Les deux index ont été
confondus une fois : `[4]` prend des valeurs jusqu'à 87 et ne veut rien dire
comme quantité de rolls.

## 2. Valeur d'un substat → plafond de sa propriété

Chaque code a **sa propre échelle** : le 218 plafonne à 1,5 quand le 221 monte à
200. Le score rapporte donc chaque ligne au **maximum de son code**, jamais à un
maximum global.

### ⚠️ Le plafond se déduit du PROC, pas des valeurs observées

Une propriété peut être **gemmée**, ce qui rehausse sa valeur. Déduire les
plafonds d'un inventaire réel ferait donc entrer les gemmes dans l'étalon — et
le score de tout le monde changerait selon le fichier importé.

La table `PROC` dans [artifacts.ts](src/lib/artifacts.ts) porte la **fourchette
de proc** de chaque propriété (ce qu'un tirage lui ajoute), relevée dans le jeu.

```
plafond(code) = procMax(code) × 5
```

⚠️ **× 5, pas × 4** : une propriété proc cinq fois — le **proc initial**, puis
les **4 améliorations**. C'est la même mécanique que le quad roll (§1).

C'est la constante qui cale toute la table : avec 4, l'artéfact de référence
donnait **184** au lieu de 147, et 24 lignes d'un compte réel dépassaient leur
plafond. Avec 5 : **147 pile**, et aucun dépassement sur 8 480 lignes.

Quelques repères (`proc max` → plafond) :

| Propriété | proc | Plafond |
|---|---|---|
| Dégâts infligés (élément) | 3-5 | **25** |
| Dégâts reçus (élément), compétences | 4-6 | **30** |
| Vol de vie | 5-8 | **40** |
| ATQ/DEF/VIT + selon PV perdus | 9-14 | **70** |
| Dmg crit si PV ennemi bas | 8-12 | **60** |
| Dégâts add. par % de la VIT | 25-40 | **200** |
| Dégâts add. par % des PV | 0,2-0,3 | **1,5** |

### ⚠️ Cinq propriétés n'ont PAS de plafond, et c'est volontaire

`203` (VIT sous incapacité), `207` (augmentation du taux crit), `211`
(réflexion), `212` (coup dévastateur), `213` (dégâts reçus sous incapacité) :
fourchette de proc inconnue, et absentes de l'inventaire de référence.

Elles comptent **0** au score. Leur inventer un plafond fausserait la note sans
que rien ne le signale — un test verrouille leur absence
([artefacts.test.ts](tests/artefacts.test.ts)).

## 3. Score d'un artéfact — celui du jeu

```
ratio = Σ_substats ( valeur / SUB_MAX[code] )
score = round( ratio × 125 )
```

- **× 125** : le facteur qui reproduit le nombre **affiché par le jeu** sur la
  fiche d'un artéfact. Vérifié à l'unité près (§1 du calage ci-dessus).
- ⚠️ **Un substat non révélé compte 0**, il n'est pas ignoré : l'artéfact vaut
  ce qu'il porte, et il lui manque réellement ces lignes.
- La **stat principale n'entre pas** dans le score : elle est **fixée par la
  rareté et le niveau** (PV/ATQ/DEF plat, voir §4), identique pour tous les
  artéfacts de même rang. Elle ne distingue rien, donc elle ne se note pas.

Sur un inventaire réel de 2 120 artéfacts : médiane **152**, meilleur **196**.

### Efficience — la même somme, sur une échelle en %

```
efficience(%) = ratio / 1,6 × 100
```

Le **1,6** joue le rôle du 2,8 des runes : il place 100 % sur « excellent », pas
sur « parfait ». Un artéfact dont les 4 lignes seraient au plafond vaudrait
250 % — l'échelle garde donc de la marge au-dessus du meilleur drop réel.

Mesuré sur le même inventaire : médiane **76 %**, meilleure pièce **97,9 %**.

⚠️ **Les deux mesures disent la même chose à un facteur près** — c'est
volontaire. Le **score** parle au joueur parce qu'il retrouve le nombre de son
jeu ; l'**efficience** situe la pièce sur une échelle en % comparable à celle
des runes, à laquelle il est déjà habitué.

## 3 bis. ⚠️ L'ordre des propriétés secondaires — une classification, pas un tri

`SUB_ORDER` dans [effects.ts](src/lib/effects.ts) fixe l'ordre des 33 propriétés
que le jeu nomme dans sa **« Recherche détaillée de sous-propriétés »**, relevé
écran par écran. Les 16 autres tombent en fin de liste, sous
**« Autres sous-propriétés »** — comme dans le jeu.

Cet ordre **vaut partout** : filtre de l'inventaire d'artéfacts, sélecteur des
recommandations de siège. Ce n'est ni l'ordre des codes com2us, ni un ordre
alphabétique : c'est la séquence que le joueur connaît, et deux écrans qui
trient différemment l'obligent à réapprendre à chaque fois.

⚠️ **Cette liste servira à l'optimisation d'artéfacts.** Elle regroupe les
propriétés par famille — élémentaires (300-309), par compétence (400-411),
dégâts additionnels proportionnels (218-221), dégâts critiques conditionnels
(222-225) — et c'est exactement le découpage dont un optimiseur a besoin pour
raisonner « quelle ligne vaut quoi pour ce monstre ». La réordonner à la légère
casse donc plus qu'un affichage.

### Les libellés sont ceux du JEU

⚠️ `ARTIFACT_SUB` porte les libellés **du jeu**, pas une reformulation : « Drain
de vie » et non « Vol de vie », « Dgts supp. en prop. de ATQ » et non « Dégâts
add. par X% de l'ATQ », « [Comp.1] Aug. Dgts CRIT » et non « Dmg crit
Compétence 1 ». Un joueur qui lit autre chose dans SW Forge que dans son
inventaire ne fait pas le rapprochement — même règle qu'**Attribut** / **Type**
pour les sortes d'artéfact (voir [artefacts.md](artefacts.md)).

`artifactSubName()` en retire la valeur pour les listes de filtre, où « +X% »
n'apporte rien. ⚠️ Pas par une expression régulière naïve : la valeur est parfois
**au milieu** du libellé (« Dgts supp. en prop. des PV : X% ») ou annoncée par ce
qui la précède (« …, jusqu'à +X% »).

## 4. Stat principale (`pri_effect`)

`[code, valeur]` — 100 PV, 101 ATQ, 102 DEF, **plats**. Elle dépend de la rareté
et du niveau, pas du hasard : elle est **affichée** mais **hors score** (§3).

Elle entre en revanche dans les **stats totales du monstre**, comme aujourd'hui
(voir [calcul-runes.md §5.1](calcul-runes.md)).

## 5. Perf

Même contrainte que les runes : calcul **pur et linéaire**, mémoïsé à l'import,
un seul passage sur l'inventaire (~2 000 artéfacts). Aucun rendu par artéfact
dans le résumé (voir [artefacts.md](artefacts.md)).
