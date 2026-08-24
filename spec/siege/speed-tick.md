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
> d'actions, éteint par défaut — voir [README.md](README.md)). Tant qu'il est
> éteint, le statut de **toute** équipe est forcé à `neutral`.
> ⚠️ **Mais une fois allumé, rien ne se demande** : statut, message et ordre
> d'une équipe Swift sont calculés d'office. Une équipe sans monstre, ou avec
> **Leo**, reste `neutral`.

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
| Orange | `amber` | Équipe avec **≥1 Swift** qui **n'est PAS speed tune** | ce qui manque, monstre par monstre |
| Rouge | `fire` | (Sans Swift) un monstre **pas au tick** (anneau rouge sur le slot fautif) | une phrase par monstre fautif, voir ci-dessous |
| Vert | `emerald` | (Sans Swift) **tous au tick** · **ou** équipe Swift **speed tune** · **ou** recommandation ignorée | « ✓ Équipe speed : elle est speed tune » pour le cas Swift |
| — | neutre | Équipe **vide** ou avec **Leo** | — |

### ⚠️ Une équipe Swift ne se juge pas au tick : elle se SPEED TUNE

Elle n'a aucun tick à viser. Ce qui compte pour elle, c'est que **toute l'équipe
joue avant que l'adversaire ne s'intercale** — la question de l'outil, pas celle
des ticks. Afficher « Vérifier le speed tuning » et s'arrêter là renvoyait
l'utilisateur faire à la main un calcul que l'app sait faire.

La card affiche donc le **verdict**, et sa couleur le suit :
- **verte** quand l'équipe est speed tune — ⚠️ c'est sa façon d'être « au tick » à
  elle ; la laisser orange signalait un problème qui n'existe pas. Le vert **se
  dit** (« ✓ Équipe speed : elle est speed tune »), sans quoi on ne sait pas si
  la vérification a tourné ou si l'app n'avait rien à dire ;
- **orange** sinon, avec ce qui manque monstre par monstre (« Bella +71 VIT »).

⚠️ **Et les MÊMES ENTRÉES** : l'équipe est passée à l'analyse par
`deckPourSpeedTune` — la fonction que l'outil utilise lui-même pour importer une
équipe de siège (vitesse de runes, artéfact « Effet aug. VIT » lu sur le gear,
Swift, sets) — avec le **lead de la même règle** (celui du leader s'il vaut pour
tout le monde). Reconstruire ces entrées à la main aurait fait répondre le siège
sur une équipe légèrement différente : un artéfact oublié, et le verdict change.

⚠️ **C'est le MÊME code que l'outil** — `analyseAutomatique`
([speedTuneAuto.ts](src/lib/speedTuneAuto.ts)), partagé par les deux écrans : la
réponse du siège est **exactement** celle qu'on obtiendrait en ouvrant le speed
tuning et en cliquant sur « Analyser ». Deux implémentations auraient donné deux
verdicts sur la même équipe, et c'est le genre d'écart qu'on ne voit qu'en le
cherchant. La suite d'étapes (vitesse Swift + passif → amplification d'équipe →
sort du kit → adversaire de référence → écriture des effets décalée d'un tick →
verdict) est **testée** dans [tests/speed-tune.test.ts](tests/speed-tune.test.ts).

### Le PIED de card

⚠️ **Un seul bloc**, pas trois empilés. La card portait successivement un encadré
d'alerte teinté, une ligne verte et un bouton flottant à droite — trois objets
pour une seule idée : *où en est cette équipe, et qu'est-ce que j'en fais*.
Réunis, ils se lisent d'un coup : **l'état à gauche, les actions à droite**.

- Le pied **prend la teinte du statut** (rouge / orange) et se cale sur les bords
  de la card (marges négatives, coins bas arrondis) : ⚠️ c'est une **bande**, pas
  une boîte dans une boîte — un cadre de plus à l'intérieur d'un cadre faisait
  deux contours concentriques, ce que la charte interdit.
- `flex-wrap` : le message peut nommer deux monstres ; sur un écran étroit il
  passe **au-dessus** des boutons plutôt que de se comprimer.
- **« Voir le speed tune » y est TOUJOURS**, quel que soit le statut. ⚠️ Ce n'est
  pas une réponse à une alerte : c'est une question qu'on se pose sur n'importe
  quel deck — y compris celui qui va bien, pour voir **de combien** il passe. En
  retrait (`fond="vide"`) : c'est une sortie vers un autre écran, pas une action
  sur l'équipe.

Il pose l'équipe dans
[speedTuneHandoff.ts](src/lib/speedTuneHandoff.ts) et ouvre
`#/outils/speed-tuning`, où elle arrive **déjà chargée** dans « Ton équipe ».
⚠️ Le message passe par `sessionStorage` et n'est lu **qu'une fois** : c'est un
message d'un écran à l'autre, pas un état — durable, il serait revenu à chaque
visite de l'outil. Il ne porte que l'**identifiant** de l'équipe, jamais ses
monstres : l'équipe vit dans `useSiegeState`, une copie en aurait fait une
deuxième source de vérité. ⚠️ L'arrivée **ne lance pas** l'analyse : c'est un
geste, et on vient peut-être régler autre chose d'abord.

**« Ignorer la recommandation »** →
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

### ⚠️ Le message NOMME chaque monstre fautif

`tickTeamMessage` ([speed.ts](src/lib/speed.ts)) — logique de tick, pas
d'affichage, et vérifiée à ce titre dans [tests/](tests/vitesse.test.ts).

« Ton équipe n'est pas au tick » décrivait le symptôme sans dire s'il faut
**accélérer** ou **libérer de la vitesse**, ni **qui** est en cause. Pire : un
message d'équipe ne pouvait pas décrire trois situations différentes — il disait
« un monstre est en dessous, un autre au-dessus » et **laissait le troisième dans
l'ombre**.

Une phrase par monstre fautif, énumérées naturellement :

> Tesarion n'atteint pas le tick 286, Camille dépasse le tick 286 et Riley
> n'atteint pas le tick 286.

| Situation du monstre | Formulation |
|---|---|
| Sous un tick | « X n'atteint pas le tick 286 » |
| Au-dessus d'un tick, avec un tick plus haut | « X dépasse le tick 239 sans atteindre le 286 » |
| Au-dessus du tick le plus haut | « X dépasse le tick 286 » |

> ⚠️ **Formulations sans accord de genre** — « n'atteint pas », « dépasse ». Les
> noms de monstres sont de tous genres et l'information n'existe pas dans les
> données : « Camille est trop lent » serait fautif une fois sur deux.
>
> ⚠️ **Nommer les deux ticks** quand le monstre est entre les deux n'est pas du
> bavardage : ne citer que le tick franchi laisse croire qu'il faut ralentir,
> alors qu'**accélérer jusqu'au tick du dessus** est souvent le bon geste.
>
> ⚠️ **Aucun décompte de points manquants** : le détail par monstre est déjà
> lisible sur les cartes, et la phrase doit se lire d'un coup d'œil.

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
