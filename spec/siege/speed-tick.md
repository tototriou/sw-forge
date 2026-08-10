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
- **Par défaut à l'import** : chaque monstre reçoit le **tick le plus proche** de sa
  vitesse de combat (`nearestTick` dans [applyAccount.ts](src/lib/applyAccount.ts)),
  **sauf** si l'équipe contient **au moins un Swift** (équipe speed → pas de tick)
  ou **Leo** → tick 0. Un monstre ajouté à la main démarre à Off.
- **But : informer**, pas modifier. Le tick ne change aucune vitesse ; il sert de
  cible pour le retour manque/surplus de **ce** monstre.
- Réglé via `setSlotTick(teamId, idx, tick)` ([useSiegeState.ts](src/hooks/useSiegeState.ts)).
- Migration : l'ancien tick d'équipe est repris comme tick par défaut de chaque
  slot au chargement.

## Aura de statut (au tick / à corriger)

> ⚠️ **Conditionnée au mode « Vérifier mes tick ATB »** (bouton de la barre
> d'actions, voir [README.md](README.md)). Tant qu'il est **désactivé** — l'état
> par défaut — le statut de **toute** équipe est forcé à `neutral` : pas d'aura,
> pas de point, pas d'anneau rouge, pas de message. Tout ce qui suit ne
> s'applique donc qu'en mode vérification.

Détection « mal calé sur un tick » par monstre, via `tickDanger(combat)`
([speed.ts](src/lib/speed.ts)) :

- **« below »** : combat à **1–10 sous** un tick (raté de peu). Ex. 278 → 8 sous 286.
- **« above »** : combat qui **dépasse de plus de 15** le tick franchi le plus haut
  (overshoot / dead-zone). Ex. 302 → 16 au-dessus de 286 ; 260 → 21 au-dessus de 239.
- Tune propre = **pile sur un tick ou 0–15 au-dessus**, ou volontairement **sous
  tous les ticks** → pas d'alerte.

Chaque équipe a un **statut coloré** (aura = bordure + halo, + point dans l'en-tête) :

**Tous les sets doivent viser un tick, SAUF si l'équipe contient au moins un
Swift** (équipe speed) — dans ce cas toute l'équipe est exemptée (orange). Statut
par équipe (aura = bordure + halo, + point dans l'en-tête) :

| Statut | Couleur | Condition | Message sous les monstres |
|--------|---------|-----------|---------------------------|
| Orange | `amber` | Équipe avec **≥1 Swift** (pas de tick à viser) | « Vérifier le speed tuning » |
| Rouge | `fire` | (Sans Swift) un monstre **pas au tick** (anneau rouge sur le slot fautif) | « Ton équipe n'est pas au tick. », ou le message de dépassement ci-dessous |
| Vert | `emerald` | (Sans Swift) **tous au tick**, **ou** recommandation ignorée | — |
| — | neutre | **Mode vérification désactivé**, équipe vide **ou avec Leo** | — |

**Bouton « Ignorer la recommandation »** (sur orange/rouge) →
`dismissTickAlert(teamId, true)` : l'équipe passe au **vert**
(`SiegeTeam.tickAlertDismissed`), et affiche « ✓ Recommandation ignorée ·
rétablir ». **Réinitialisé automatiquement** dès qu'un slot change (rune,
monstre, position…) : le conseil écarté portait sur l'ancienne composition.

> ⚠️ **Le libellé dit « ignorer », pas « valider ».** L'app n'a aucun moyen de
> savoir si un tune est bon — elle constate seulement qu'il s'écarte des ticks
> connus. « Valider l'équipe » laissait croire à une approbation de l'outil,
> alors que c'est l'utilisateur qui écarte un conseil et en assume la
> responsabilité. Le vert qui suit ne dit pas « c'est juste », il dit « tu as
> tranché ».

### ⚠️ Le message dit dans quel SENS corriger

`tickTeamMessage` ([speed.ts](src/lib/speed.ts)) — logique de tick, pas
d'affichage, et vérifiée à ce titre dans [tests/](tests/vitesse.test.ts).

« Ton équipe n'est pas au tick » décrivait le symptôme sans dire s'il faut
**accélérer** ou **libérer de la vitesse** pour la mettre ailleurs. Les deux
situations se réparent à l'opposé l'une de l'autre.

| Situation des monstres fautifs | Message |
|---|---|
| Tous **sous** un même tick | « Ton équipe est trop lente pour le tick 286. » |
| Tous **au-dessus** de 239 | « Ton équipe est trop rapide par rapport au tick 239, ou trop lente pour le tick 286. » |
| Tous au-dessus de **286** (le plus haut) | « Ton équipe est trop rapide par rapport au tick 286. » |
| Au-dessus de **ticks différents** | « Ton équipe est trop rapide par rapport aux ticks. » |
| Un dessous **et** un dessus | « Ton équipe n'est pas au tick : un monstre est en dessous, un autre au-dessus. » |

> ⚠️ **Nommer les deux ticks n'est pas du bavardage.** Ne citer que le tick
> franchi laisse croire qu'il faut ralentir, alors qu'**accélérer jusqu'au tick
> du dessus** est souvent le bon geste. L'app ne peut pas trancher à la place du
> joueur : elle lui donne les bornes.
>
> ⚠️ **Aucun décompte de points manquants** : le détail par monstre est déjà
> lisible sur les cartes, et une phrase courte se lit d'un coup d'œil.
>
> ⚠️ **Aucun nom de monstre** : le slot fautif porte déjà un anneau rouge.
>
> Quand **plusieurs ticks** sont en cause, aucune valeur n'est citée — elle
> désignerait le mauvais repère pour une partie de l'équipe.

Sets déterminés depuis `slot.sets` (renseigné à l'import).
Marges : `TICK_BELOW_MARGIN = 10`, `TICK_ABOVE_MARGIN = 15`.

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
