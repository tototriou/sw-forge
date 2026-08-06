# Siège · Vitesse de combat, lead auto & ticks

Comment la vitesse de combat est calculée par slot, et comment les ticks guident
l'utilisateur (« speed tune »).

Fichiers : [SiegeTeam.tsx](src/components/siege/SiegeTeam.tsx) ·
[speed.ts](src/lib/speed.ts)

## Lead automatique (déduit du leader)

- Le lead **n'est pas saisi** : il est **déduit du leader** (slot 0) via
  `speedLeadOf(leaderMonster)`.
- Il est appliqué **par monstre** selon son élément via
  `siegeLeadFor(leadInfo, monster.element)` :
  - `General` / `Guild` → tous les alliés bénéficient du lead.
  - `Element` → seuls les alliés du **même élément** que le leader.
  - `Arena` / `Dungeon` → **inactif** en siège (contenu de guilde).
- Seul un lead **`Attack Speed`** compte comme lead de vitesse.

## Vitesse de combat (par slot rempli)

Modèle partagé — [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md) :

```
combat = base + runes + ceil( base × (15 + lead) / 100 )
```

- `base` = SPD de base du monstre.
- `runes` = champ « SPD : » (Swift déjà inclus).
- `15` = totem toujours actif ; `lead` = lead auto effectif **pour ce monstre**.
- Affichée en **gros chiffre** (`star`) ; « base X » en dessous. `—` si pas de base.

## Ticks (speed tune) — **par monstre**

- Boutons dans **chaque slot** : **Off**, **Rapide 286**, **Lent 239**
  (`SIEGE_TICKS`). Un tick **par monstre** (`slot.tick`, 0 = Off), pas par équipe
  → on peut viser 2 monstres en tick rapide et 1 en tick lent dans la même équipe.
- **But : informer**, pas modifier. Le tick ne change aucune vitesse ; il sert de
  cible pour le retour manque/surplus de **ce** monstre.
- Réglé via `setSlotTick(teamId, idx, tick)` ([useSiegeState.ts](src/hooks/useSiegeState.ts)).
- Migration : l'ancien tick d'équipe est repris comme tick par défaut de chaque
  slot au chargement.

### Retour par slot (si le tick du slot est actif)
`diff = combat − slot.tick` :

| Cas | Affichage |
|-----|-----------|
| `diff < 0` | « manque `-diff` pour `tick` » (rouge / `fire`) |
| `diff > 0` | « +`diff` au-dessus de `tick` » (bleu / `water`) |
| `diff = 0` | « pile au tick `tick` ✓ » (vert / `wind`) |

## Attendus

- Changer le **leader** (interversion vers le slot 0) recalcule le lead auto, donc
  toutes les vitesses de combat de l'équipe.
- Un lead d'élément ne booste que les monstres du bon élément → deux slots peuvent
  avoir des vitesses de combat différentes à SPD runes égale.
- Le totem +15 % est **toujours** compté, même sans lead.
- Arrondi **au supérieur** sur le bonus %.
- `runeSpeedForTarget(base, lead, tick)` existe dans `speed.ts` pour calculer la
  SPD de runes nécessaire à un tick (brique disponible, utile pour évolutions).
