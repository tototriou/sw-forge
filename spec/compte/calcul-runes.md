# Référence — calcul runes, gear & optimisation

**Document auto-suffisant** : toutes les constantes, formules et algorithmes pour
reconstruire l'efficience des runes, le décodage du gear SWEX et l'optimisation
(gemme + grind), sans lire le code. Implémentation : [effects.ts](src/lib/effects.ts),
[importAccount.ts](src/lib/importAccount.ts), [runeOptim.ts](src/lib/runeOptim.ts),
[stats.ts](src/lib/stats.ts).

## 1. Codes d'effet (com2us)

Identiques pour main / innée / substats de rune.

| Code | Stat | % ? |
|------|------|-----|
| 1 | PV (plat) | non |
| 2 | PV % | oui |
| 3 | ATQ (plat) | non |
| 4 | ATQ % | oui |
| 5 | DEF (plat) | non |
| 6 | DEF % | oui |
| 8 | Vitesse (VIT) | non |
| 9 | Taux Critique % | oui |
| 10 | Dégâts Critiques % | oui |
| 11 | Résistance % | oui |
| 12 | Précision % | oui |

(7 = inutilisé. Artéfacts : `pri_effect` 100 = PV, 101 = ATQ, 102 = DEF plats ;
substats d'artéfact = effets conditionnels, codes 200+ — ils ont **leur propre
mesure de qualité**, voir [calcul-artefacts.md](calcul-artefacts.md), et n'entrent
pas dans l'efficience de rune.)

## 2. Décodage d'un export SWEX (gear)

### Rune (objet dans `data.runes` ou `unit.runes`)

| Champ SWEX | Sens |
|------------|------|
| `slot_no` | slot 1..6 |
| `set_id` | id du set (voir table §2.1) |
| `class` | nombre d'étoiles ; **> 10 ⇒ rune antique** (`rank` dans le modèle = `class`) |
| `extra` | **rareté** (1 Commun … 5 Légendaire) ; **+10 si antique** ⇒ `rarity = extra > 10 ? extra-10 : extra` |

⚠️ **Couleurs de rareté** (`RARITY_META` / `RARITY_FILTER` dans
[effects.ts](src/lib/effects.ts)) — l'ordre du jeu est **Commun blanc →
Magique VERT → Rare BLEU → Héroïque violet → Légendaire orange**. Le vert et le
bleu ont déjà été intervertis une fois : Magique est la rareté *inférieure* à
Rare, donc la plus terne des deux.

Le **rare** a pour teinte de référence **#154c79** — un bleu posé,
volontairement **pas électrique**. Elle sert de **fond** ; la couleur de
**texte** en reprend la teinte éclaircie, #154c79 étant trop sombre pour rester
lisible sur le panneau. La colorisation des icônes de set (`RARITY_FILTER`)
descend à `saturate(4.5)` sur cette rareté pour s'y accorder — à 7,5 le bleu
virait au néon.

L'**héroïque garde son violet** : un magenta profond (#691d42) a été essayé et
écarté, le rendu ne passait pas.

| `upgrade_curr` | niveau d'amélioration (+0..+15) |
| `pri_eff` | `[code, valeur]` — stat principale |
| `prefix_eff` | `[code, valeur]` — stat innée (immuable : ni grind ni gemme) |
| `sec_eff` | liste de substats, chacun `[code, valeur, enchant, grind]` |

**Substat** : `[code, valeur, enchant, grind]`
- valeur **totale** utilisée partout = `valeur + grind` (la meule est incluse) ;
- `enchant` (0/1) = ce substat est **gemmé** (une seule gemme possible par rune) ;
- `grind` = part apportée par la meule.

### set_id → clé de set

`1 energy · 2 guard · 3 swift · 4 blade · 5 rage · 6 focus · 7 endure · 8 fatal ·
10 despair · 11 vampire · 13 violent · 14 nemesis · 15 will · 16 shield ·
17 revenge · 18 destroy · 19 fight · 20 determination · 21 enhance · 22 accuracy ·
23 tolerance · 24 seal · 25 intangible`.
Sets **4 pièces** : Swift(3), Rage(5), Fatal(8), Despair(10), Vampire(11),
Violent(13). Tous les autres : 2 pièces. Intangible(25) = joker.

### Artéfact (`data.artifacts` ou `unit.artifacts`, clé `rid`)

| Champ | Sens |
|-------|------|
| `pri_effect` | `[code, valeur]` — 100 PV / 101 ATQ / 102 DEF (plats) |
| `sec_effects` | liste `[code, valeur, i2, i3, i4]` ; substat **modifié** ⇔ **`i4 > 0`** |
| `natural_rank` | **rareté** (3..5) — ⚠️ le champ `rank` vaut toujours 5, inutilisable |
| `type` | `1` = artéfact **d'attribut** (`element` en interne), `2` = **de type** (`archetype`) |
| `attribute` (si type 1) | 1 eau · 2 feu · 3 vent · 4 lumière · 5 ténèbres |
| `unit_style` (si type 2) | 1 attaque · 2 défense · 3 PV · 4 support |

### Meules & gemmes (`data.rune_craft_item_list`)

| Champ | Sens |
|-------|------|
| `craft_type` | 1/2 gemme/meule · 3/4 **immémoriale** (tous sets) · 5/6 **antique** |
| `craft_type_id` | `<set><stat><grade>` — deux chiffres chacun pour stat et grade |
| `amount` | quantité possédée (les lots à 0 sont écartés) |

`251204` → set 25 (Intangible), stat 12 (Précision), grade 4 (Héroïque). Le set
`99` des immémoriaux ne correspond à aucun set réel : il vaut « n'importe
lequel ».

⚠️ **Grade des consommables antiques décalé de 10** (13/14/15), exactement comme
le `rank` d'une rune antique — ramené sur l'échelle 1-5 à la lecture.

⚠️ **Impair = gemme, pair = meule.** Vérifié sur les 1 161 lots d'un compte
réel : les types pairs ne portent que des stats **meulables**
(1/2/3/4/5/6/8), les impairs portent en plus 9/10/11/12 (TC, DCC, RES,
Précision) — soit exactement la différence entre les deux objets du jeu.

### Relique (`unit.relics[0]`)

`pri_effect` : 100 PV% / 101 ATQ% / 102 DEF% (pourcentages). C'est la seule part
de la relique qui entre dans le **calcul des stats** (voir `computeStats`).

#### La propriété unique (`sec_effect`) n'est PAS une substat

`sec_effect` = **`[type, tranche, pourcentage]`**. Elle n'ajoute aucune valeur à
une stat : elle déclenche un effet **proportionnel à une stat du monstre**, de la
forme « **+2 % par tranche de 27 000** ».

Relevé sur un compte réel (15 reliques) :

- le **premier nombre vaut toujours le `type` de la relique** — ce n'est donc pas
  un code d'effet parmi d'autres, c'est **la** propriété unique de la pièce,
  fixée à l'obtention ;
- le **deuxième est une tranche de stat**, et il **diminue quand la relique
  monte** (un type 12 passe de 45 000 à +0 à 27 000 à +8) : plus la relique est
  forte, plus la tranche est petite, donc plus l'effet se déclenche ;
- le **troisième est le pourcentage** accordé par tranche (1 ou 2 sur les pièces
  observées).

⚠️ **Ce que l'effet FAIT n'est nulle part dans l'export** : `type` est un numéro,
sans table qui dise « type 12 = … ». On affiche donc la **formule seule** —
« +2 % par tranche de 27 000 PV », le numéro de type en infobulle — et **jamais
un libellé deviné** : une description fausse sur un effet de combat est l'erreur
silencieuse type, du même ordre qu'envoyer farmer le mauvais donjon. Pas
d'intitulé « Propriété unique » non plus : la phrase se suffit, et la tuile n'a
que deux lignes.

⚠️ **L'unité de la tranche est déduite de l'ORDRE DE GRANDEUR**, seul argument
disponible (`RELIC_UNIQUE_STAT` dans [effects.ts](src/lib/effects.ts)) :

| Types | Tranches observées | Stat |
|---|---|---|
| 3, 6, 12, 16 | 45 000 → 36 000 → 27 000 | **PV** — aucune autre stat n'approche ces valeurs |
| 1, 2, 5, 15 | 2 500 → 2 000 → 1 000 | ATQ **ou** DEF : ambigu, **laissé sans unité** |
| 7, 11, 14 | 250 → 200 | DEF **ou** VIT : ambigu, **laissé sans unité** |

Une tranche sans unité est incomplète mais **vraie** ; une unité devinée serait
fausse une fois sur deux. La table se complète type par type, à mesure qu'un
exemple lu en jeu tranche.

⚠️ **Bug corrigé** : elle était lue comme un `{ code, value }` de substat et
affichée « Effet secondaire · 27000 ». Le pourcentage était purement perdu, et
le nombre montré n'était pas une valeur mais un **diviseur** — le lecteur ne
pouvait qu'en tirer une conclusion fausse.

### Unité / monstre

- 6★ ⇔ `class === 6`. `unit_master_id` = `com2usId` (jointure avec le monstre).
- Stats de base (naked) : **PV = `con` × 15**, `atk`, `def`, `spd`,
  `critical_rate`, `critical_damage`, `resist`, `accuracy`.
- Presets de runes séparés : RTA = `world_arena_rune_equip_list` (par `occupied_id`) ;
  siège = `equip[].rune_id_list` / `artifact_id_list`. Voir
  [../shared/import-compte.md](../shared/import-compte.md).

### Données monstre (SWARFARM, pas SWEX)

`stars` = `base_stars` (grade obtenable) ; `naturalStars` = `natural_stars` (vraie
rareté nat 1..5) ; `secondAwaken` = `awaken_level ≥ 2`. **PV/ATQ/DEF = `max_lvl_*`**
(monstre **6★ nu**, cohérent avec le `con × 15` ci-dessus) — surtout pas `base_*`,
qui vaut au grade d'invocation. Voir
[../shared/donnees-monstres.md](../shared/donnees-monstres.md).

## 3. Efficience d'une rune

```
eff(%) = ( min(main/MAINSTAT_MAX[main.code], 1)
           + Σ_substats  sub.total / SUBSTAT_MAX[sub.code]
           + (innée ? innée.val / SUBSTAT_MAX[innée.code] : 0) ) / 2.8 × 100
```

- `sub.total` = valeur **meule incluse**. La main est **plafonnée à 1** ; les
  substats **non** (⇒ une rune antique peut dépasser 100 %).
- Seuls les codes présents dans les tables comptent (les codes absents → 0).

### MAINSTAT_MAX (rune 6★, non antique)

| Code (stat) | 1 PV | 2 PV% | 3 ATQ | 4 ATQ% | 5 DEF | 6 DEF% | 8 VIT | 9 TC% | 10 DCC% | 11 RES% | 12 PRE% |
|------|---|---|---|---|---|---|---|---|----|----|----|
| Max | 2448 | 63 | 160 | 63 | 160 | 63 | 42 | 58 | 80 | 64 | 64 |

### SUBSTAT_MAX

⚠️ **Les stats plates sont DOUBLÉES** par rapport à sw-exporter (convention
scoringsw) — c'est calibré : meilleure rune du compte de réf = 140,18 %,
moyenne top-10 = 125,80 %.

| Code (stat) | 1 PV | 2 PV% | 3 ATQ | 4 ATQ% | 5 DEF | 6 DEF% | 8 VIT | 9 TC% | 10 DCC% | 11 RES% | 12 PRE% |
|------|--------|---|---------|---|---------|---|---|---|----|----|----|
| Max | 3750 | 40 | 200 | 40 | 200 | 40 | 30 | 30 | 35 | 40 | 40 |

Ces mêmes maxes (non antiques) servent **toujours** de dénominateur, y compris
pour une rune antique (⇒ potentiels/efficiences > 100 % normaux).

## 3 bis. Score SW (celui affiché dans le jeu)

Deuxième mesure, proposée **au choix** à côté de l'efficience (voir
[runes.md](runes.md)). Deux différences avec l'efficience :

1. **La stat principale ne compte pas** — le score ne mesure que les stats
   **secondaires** (innée + substats, meule incluse) ;
2. **pas de division par 2,8** : on exprime la somme en centièmes.

```
score = round( ( (PV%+ATQ%+DEF%+PRÉ%+RES%)/40 + (VIT+TC)/30 + DCC/35
                 + PV/1875 × 0,35 + (ATQ+DEF)/100 × 0,35 ) × 100 )
```

### La seule vraie divergence : le poids des stats PLATES

Les dénominateurs des % / VIT / crit sont **identiques** dans les deux formules.
Seules les stats plates changent, le jeu les pondérant à **0,35** :

| Stat plate | Score (jeu) | Efficience (scoringsw) |
|------------|-------------|------------------------|
| PV | `/1875 × 0,35` ⇔ **/5357,14** | **/3750** |
| ATQ, DEF | `/100 × 0,35` ⇔ **/285,71** | **/200** |

Une stat plate pèse donc **~1,43× moins** dans le score que dans notre
efficience. Table `SCORE_MAX` dans [effects.ts](src/lib/effects.ts) ; l'efficience
garde `SUBSTAT_MAX` inchangée.

Repères de contrôle (une seule stat secondaire) : `PV% 40` → **100** ·
`DCC 35` → **100** · `PV plat 1875` → **35** · `ATQ plat 100` → **35**.

## 4. Potentiel d'optimisation (gemme + grind)

Objectif : efficience **maximale atteignable** d'une rune, et le **plan** pour y
arriver. Deux scénarios : **héroïque** et **légendaire**. Ordre : **gemme d'abord,
puis grind**.

### 4.1 Grind max (valeur AJOUTÉE par la meule, par code)

RES(11)/Précision(12)/Taux Crit(9)/Dmg Crit(10) : **non grindables**.

| | 1 (PV) | 2 (PV%) | 3 (ATQ) | 4 (ATQ%) | 5 (DEF) | 6 (DEF%) | 8 (VIT) |
|---|---|---|---|---|---|---|---|
| **Héro classique** | 450 | 7 | 22 | 7 | 22 | 7 | 4 |
| **Légend classique** | 550 | 10 | 30 | 10 | 30 | 10 | 5 |
| **Héro antique** | 510 | 9 | 26 | 9 | 26 | 9 | 5 |
| **Légend antique** | 610 | 12 | 34 | 12 | 34 | 12 | 6 |

### 4.2 Gemme — valeur de BASE max (avant grind, par code)

Stats gemmables candidates (ordre de préférence, on maximise l'efficience) :
`PV% (2), ATQ% (4), DEF% (6), VIT (8)`, puis flats `PV (1), ATQ (3), DEF (5)`.

| | 2/4/6 (%) | 8 (VIT) | 1 (PV) | 3 (ATQ) | 5 (DEF) |
|---|---|---|---|---|---|
| **Héro classique** | 11 | 8 | 420 | 30 | 30 |
| **Légend classique** | 13 | 10 | 580 | 40 | 40 |
| **Héro antique** | 13 | 9 | 480 | 34 | 34 |
| **Légend antique** | 15 | 11 | 640 | 44 | 44 |

Total d'une stat gemmée = **`gemMax + grindMax`** (même code).

### 4.3 Algorithme `best(rune, scénario)` → efficience max + choix

1. **Base (grind seul)** : porter **chaque substat grindable** à son grind max
   (les non grindables inchangés). Calculer l'efficience. Une meule déjà au-delà
   du max cible est **ramenée** au max (delta négatif possible en héroïque).
2. Si mode **« Meule seule »** → renvoyer cette efficience (pas de gemme).
3. **Gemme** :
   - Rune **déjà gemmée** (un substat a `enchant`) : la stat est **figée** (on ne
     peut pas en gemmer une autre). Seule option = **proc max** : base du gemmé =
     `max(base actuelle, gemMax[code])`, puis grind. On garde si l'efficience
     augmente ; **si la gemme est déjà à sa base max, aucun gain gemme** (on reste
     sur le grind seul).
   - Rune **non gemmée** : pour chaque substat *slot* et chaque stat candidate `Y` :
     - exclure `Y` déjà présente (principale, innée, autres substats) et `Y` = stat
       du slot (la gemme **remplace** par une autre stat) ;
     - **contraintes d'emplacement** : **slot 1 → pas de DEF (5/6)**, **slot 3 →
       pas d'ATQ (3/4)** ;
     - construire la rune avec slot ← `Y` à `gemMax[Y] + grindMax[Y]`, les autres
       substats grindés au max ; calculer l'efficience et garder le meilleur.
4. Renvoyer la meilleure efficience et le couple (slot remplacé, stat gemmée) pour
   reconstruire le plan.

`heroEff` / `legendEff` = `best` avec les tables héro / légend (variante antique si
`class > 10`). **Gain** = potentiel − efficience actuelle (peut être négatif : ex.
rune déjà grindée légendaire, en scénario héroïque).

### 4.4 Plan « avant / après »

À partir du choix gagnant : pour chaque substat, valeur actuelle vs cible
(base + grind). Le substat gemmé prend `code = Y`, `base = gemMax` (ou
`max(base, gemMax)` pour un re-proc de la même stat). Affichage : seul **ce qui
change** est mis en évidence (grind posé ou gemme).

## 5. Stats totales d'un monstre

### 5.0 Règle d'arrondi — **transverse à toute l'app**

⚠️ **Dès qu'un calcul produit une décimale, on arrondit immédiatement à l'entier
SUPÉRIEUR** (`Math.ceil`). Jamais de `floor` ni de `round`, et jamais d'arrondi
repoussé en fin de chaîne. C'est la règle déjà posée pour la vitesse (voir
[../shared/calcul-vitesse.md](../shared/calcul-vitesse.md)) ; elle vaut pour
**tous** les bonus en % de l'application.

```
stat = base + ceil(base × Σ% / 100) + Σplat
```

Les pourcentages d'une même stat sont **d'abord sommés** (runes + relique + sets),
puis **un seul `ceil`** est appliqué — exactement comme
`ceil(base × (totem + lead) / 100)`. Exemples : 45 % de 10 050 PV = 4 522,5 →
**4 523** ; 25 % de 107 VIT = 26,75 → **27** ; 63 % de 10 050 = 6 331,5 → **6 332**.

Sites concernés : [stats.ts](src/lib/stats.ts) (stats totales),
[speed.ts](src/lib/speed.ts) (totem + lead), [applyAccount.ts](src/lib/applyAccount.ts)
(bonus Swift à l'import). Un résultat déjà entier n'est **pas** réarrondi ailleurs
(pas de double arrondi).

### 5.1 Contributions

Runes (main + innée + substats, meule incluse) + **bonus de set** + artéfacts
(main plate) + relique (main %). Les stats sans % (crit, RES, précision) sont
purement additives.

### 5.2 Bonus de set — **à ne pas oublier**

⚠️ Un build ne vaut pas que la somme de ses runes : les **sets actifs** ajoutent
leur effet aux stats (`SET_STAT_BONUS` dans [effects.ts](src/lib/effects.ts)).
Deux natures, à ne pas confondre :

| Set | Effet | Nature |
|-----|-------|--------|
| Energy (2) | PV **+15 %** | % de la **base** |
| Guard (2) | DEF **+15 %** | % de la base |
| Swift (4) | VIT **+25 %** | % de la base |
| Fatal (4) | ATQ **+35 %** | % de la base |
| Blade (2) | Taux crit **+12** | **points** (15 → 27), pas 12 % de 15 |
| Rage (4) | Dégâts crit **+40** | points |
| Focus (2) | Précision **+20** | points |
| Endure (2) | Résistance **+20** | points |

- Les **répétitions comptent** : 6 runes Energy = **3×** le set 2 pièces = +45 %
  PV. C'est `activeSets` (§2.1) qui renvoie les occurrences, joker **Intangible**
  compris.
- ⚠️ **Règle du joker Intangible, texte du jeu** : « Seule 1 de ces runes peut
  être sertie par monstre. Quand une rune Intangible est sertie, elle remplace
  automatiquement une rune manquante pour l'activation d'un set de runes
  incomplet. Elle ne peut compléter qu'un seul set de rune et ne fonctionne pas
  quand il y a deux sets incomplets ou plus. » `activeSets` applique donc DEUX
  conditions, pas une seule : (1) un seul joker compte jamais, même si la
  fonction en reçoit plusieurs (le jeu empêche d'en équiper deux sur le même
  monstre, mais l'Optimizer peut proposer une combinaison qui en utiliserait
  plusieurs avant son propre garde-fou — voir
  [outils/optimizer.md](../outils/optimizer.md)) ; (2) le joker ne complète
  RIEN dès que **deux sets ou plus** sont incomplets parmi les runes
  RÉELLEMENT portées — **même un set non demandé par l'utilisateur compte**.
  Bug corrigé : la fonction complétait auparavant silencieusement le set le
  plus proche de l'activation sans regarder si un autre set, même hors du
  combo recherché, était lui aussi incomplet — un set annoncé actif (et sa
  stat bonus affichée) alors qu'il ne l'est pas réellement en jeu. Couvert par
  [tests/sets-intangible.test.ts](tests/sets-intangible.test.ts).
- Les % PV/ATQ/DEF entrent dans le `Σ%` (un seul `ceil`, voir §5.0) ; la VIT est
  ajoutée à plat, `ceil(base × 25 / 100)` — **même arrondi qu'à l'import Swift**
  (voir [../shared/import-compte.md](../shared/import-compte.md)), les deux
  chemins concordent.
- **Exclus volontairement** : les sets **d'alliés** (Fight, Determination,
  Enhance, Accuracy, Tolerance) — dans SW ils buffent l'équipe en combat et
  n'apparaissent pas sur la fiche de stats du monstre. Les autres sets (Violent,
  Despair, Vampire, Will, Nemesis, Shield, Revenge, Destroy, Seal, Intangible)
  n'ont aucun effet de stat.

Vaut pour **tous** les usages de `computeStats` : détail d'équipement (RTA/siège),
pré-remplissage d'une recommandation depuis un deck d'offense, et confrontation
d'une recommandation aux builds du joueur.

## 6. Perf (contrainte forte, à respecter)

- Calculs runes = **purs & linéaires**, mémoïsés à l'import ; pagination bornée
  (60/page) + `React.memo` ⇒ fluide à ~2000 runes.
- **Futur optimiseur de builds** (combinatoire 6 slots × N runes) : **jamais de
  brute-force** → **Web Worker** (UI non bloquée, annulable), tableaux typés,
  **branch-and-bound** + pré-filtrage par slot. `runeOptim.ts` est déjà pur pour
  être réutilisé dans un worker.
