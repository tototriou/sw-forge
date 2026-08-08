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
substats d'artéfact = effets conditionnels, codes 200+, hors périmètre efficience.)

## 2. Décodage d'un export SWEX (gear)

### Rune (objet dans `data.runes` ou `unit.runes`)

| Champ SWEX | Sens |
|------------|------|
| `slot_no` | slot 1..6 |
| `set_id` | id du set (voir table §2.1) |
| `class` | nombre d'étoiles ; **> 10 ⇒ rune antique** (`rank` dans le modèle = `class`) |
| `extra` | **rareté** (1 Commun … 5 Légendaire) ; **+10 si antique** ⇒ `rarity = extra > 10 ? extra-10 : extra` |
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
| `type` | `1` = artéfact **d'élément**, `2` = **d'archétype** |
| `attribute` (si type 1) | 1 eau · 2 feu · 3 vent · 4 lumière · 5 ténèbres |
| `unit_style` (si type 2) | 1 attaque · 2 défense · 3 PV · 4 support |

### Relique (`unit.relics[0]`)

`pri_effect` : 100 PV% / 101 ATQ% / 102 DEF% (pourcentages).

### Unité / monstre

- 6★ ⇔ `class === 6`. `unit_master_id` = `com2usId` (jointure avec le monstre).
- Stats de base (naked) : **PV = `con` × 15**, `atk`, `def`, `spd`,
  `critical_rate`, `critical_damage`, `resist`, `accuracy`.
- Presets de runes séparés : RTA = `world_arena_rune_equip_list` (par `occupied_id`) ;
  siège = `equip[].rune_id_list` / `artifact_id_list`. Voir
  [../shared/import-compte.md](../shared/import-compte.md).

### Données monstre (SWARFARM, pas SWEX)

`stars` = `base_stars` (grade obtenable) ; `naturalStars` = `natural_stars` (vraie
rareté nat 1..5) ; `secondAwaken` = `awaken_level ≥ 2`. Voir
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

## 5. Stats totales d'un monstre (info)

[stats.ts](src/lib/stats.ts) : `total = floor(base × (1 + Σ%/100) + Σplat)` pour
PV/ATQ/DEF ; additif pour VIT/TC/DCC/RES/PRE. Runes (main+innée+subs) + artéfacts
(main plate) + relique (main %).

## 6. Perf (contrainte forte, à respecter)

- Calculs runes = **purs & linéaires**, mémoïsés à l'import ; pagination bornée
  (60/page) + `React.memo` ⇒ fluide à ~2000 runes.
- **Futur optimiseur de builds** (combinatoire 6 slots × N runes) : **jamais de
  brute-force** → **Web Worker** (UI non bloquée, annulable), tableaux typés,
  **branch-and-bound** + pré-filtrage par slot. `runeOptim.ts` est déjà pur pour
  être réutilisé dans un worker.
