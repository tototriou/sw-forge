# Historique du modèle de dégâts réels

**Statut :** ARCHIVE — déplacé le 2026-09-24 depuis spec/outils/degats-reels.md ; conclusions reprises dans les fichiers actifs du dossier
**Chercher ici pour :** retrouver une ancienne limite, erreur ou description remplacée du modèle

## Anciennes exclusions générales devenues fausses
- les lignes de **dégâts d'artéfact** (par élément, coopératif) et le
  **DMG%** en général ;
- les **réductions** autres que la marque (passifs, reflect, Mirinae S3) ;
- les **mécaniques propres à certains monstres** (Deborah, Herteit…) ;
- les sorts qui dépendent de l'**état de combat** au-delà des PV de la cible
  (`{Relative SPD}`, `{Alive Enemies}`, PV courants de l'attaquant…) — ces
  sorts-là sont refusés, pas approchés.


## ⚠️ Incident — faux sur DEUX axes, sur la foi d'une confirmation erronée

Ce terme s'appelait `ajoutUneFois` et était doublement faux : multiplié par
`horsCoup` (donc critique **et** mitigé) et compté **une seule fois par
sort**.

Le « une fois par sort » s'appuyait sur un commentaire « confirmé par
l'utilisateur », recopié tel quel dans le test — qui verrouillait donc le bug
au lieu de le détecter. C'était une **erreur**, levée par un relevé en jeu.

**Relevé — Shahat.** ~50 000 PV, S2 sur une cible à ~3 000 DEF → **~4 500
dégâts par coup**. Le cas est *diagnostique* : à 3 000 de DEF la mitigation
écrase tout ce qui la subit (`defenseFactor(3000) ≈ 0,0859`), ce qui sépare
nettement le terme brut du terme mitigé. `Control Sand` (S2) =
`1.4*{ATK} + 0.11*{MAX HP}`, 2 coups ; `Sand Blade` = 7 % des PV max.

| | Part du sort (mitigée) | Sand Blade | Total par coup |
|---|---|---|---|
| Corrigé, sans critique | ≈ 600 | **3 500** (brut) | **≈ 4 100** |
| Corrigé, avec critique | ≈ 1 400 | **3 500** (brut) | **≈ 4 900** |
| Ancien calcul | — | — | ≈ 770 à 1 760 |

Le relevé tombe **entre les deux lignes du modèle corrigé**, ce qui est
exactement attendu : Sand Blade ne critant pas, seule la part du sort oscille.
⚠️ **Le résultat ne dépend pas de l'ATQ**, absente du relevé : le terme
dominant du sort est `0.11*{MAX HP}` (5 500), pas `1.4*{ATK}` — faire varier
l'ATQ de 1 000 à 1 500 déplace le total de 4 093 à 5 002.

⚠️ **Les deux familles partagent le même accumulateur, et c'est voulu.** Ce
partage avait d'abord été pris pour un obstacle (« impossible de corriger
l'une sans changer l'autre en silence ») ; elles ont en réalité exactement le
même comportement. Ne pas le scinder.


## Ancienne lacune de typage des scripts et tests
⚠️ **`tsconfig.json` fait `include: ["src"]`** — `npx tsc --noEmit` ne voit
**ni `scripts/`, ni `tests/`**. Un champ oublié là-bas ne se détecte qu'à la
main ; c'est la raison d'être de la discipline
`optimizer-field-propagation`.

> **Incident, immédiatement après l'introduction du profil** : une vingtaine
> d'appels de `tests/degats.test.ts` passaient encore `0` (l'ancien
> `ampliVitPct`) à la place de l'objet. Rien n'a bronché — `(0).ampliVitPct`
> vaut `undefined`, qui retombait sur le défaut. La suite est restée verte
> jusqu'à ce que le profil gagne les champs 218-221 : `undefined / 100`
> donne alors `NaN`, et 42 vérifications ont viré au rouge d'un coup.
> **Un argument de mauvais TYPE a donc survécu à un commit complet**, parce
> que ni `tsc` ni les tests ne pouvaient le voir. Corrigé en passant
> `ARTIFACT_DAMAGE_NEUTRE` partout.


## Deuxième vague — points 16 à 25

Trois entrées de plus tenaient dans les mécanismes déjà en place, sans
nouveau code (voir `BONUS_DEGATS_STACKABLE_CONNUS` plus haut) — Fermion
(point 16), Ludo (point 23), Martina (point 24). Deux autres ont demandé un
CINQUIÈME/SIXIÈME effet d'équipe — Dr. Matteo (point 20, « Transmission »)
et Velaska (point 18, « Price of Pain », le seul à porter une DEUXIÈME
donnée en plus du toggle — voir « Effets d'équipe » plus bas).

⚠️ **Point 17 (Trasar, « Weight of Death ») — BLOQUÉ, pas seulement
différé.** Le texte confirme +15 %/mort jusqu'à +30 %, mais cette
augmentation ne porte que sur UN sort précis (« Atlas Stone », S2), dont la
formule (`{MAX HP}/{Alive Enemies} (Fixed)`) utilise `{Alive Enemies}` — une
variable qu'`analyser` (damage.ts) ne reconnaît PAS
(`DamageVariable` ne la liste pas). Ce sort est donc déjà REJETÉ par le
parseur (« tout ou rien »), avant même de songer à lui appliquer un bonus :
implémenter la table de stack serait sans effet tant que la formule
elle-même reste hors modèle. À reprendre seulement si `{Alive Enemies}`
est un jour ajouté à la grammaire.


## Ancienne application de Sickle Blade et Sand Blade une fois par sort
- **Sickle Blade/Bayek (Vent)** et **Sand Blade/Desert Warrior (Vent),
  Shahat** (point 35) : « additional damage that's 7% of your MAX HP when
  you attack on your turn » — confirmé (`quantite: 7`). ⚠️ **UNE SEULE
  FOIS par sort, pas par coup** (confirmé par l'utilisateur) — ajouté
  APRÈS le `×coups`, contrairement à Spear of Tenacity/Martial Arts
  Specialist.

## Ancienne modélisation manuelle de Fiery Breath
**Zaiross (« Fiery Breath »)** — demande explicite. « Attacks all enemies
and puts their skills on MAX cooldown. [...] Additionally, if the enemy's
Attack Power is half or less than your Attack Power, the attack always
lands as a Critical Hit and increases the damage dealt against the enemy
by 50%. » L'ATQ de l'adversaire n'est pas une donnée que l'app connaît —
condition non déductible, bouton RESTREINT À CE SORT
(`SkillDamageProfile.bonusConditionnelPropre`, même mécanisme que Touch of
Mercy/Emergency Drive), `+50 %` sur les dégâts. ⚠️ **Seule la clause de
DÉGÂTS est modélisée** (demande explicite) — la clause « critique garanti
sous la même condition » reste HORS MODÈLE : aucun mécanisme dans ce
fichier pour un crit garanti conditionné à l'ATQ adverse (`critSiPlusRapide`
compare la VIT, pas l'ATQ). Skill partagé tel quel (même `com2usId`) par le
Dragon Feu 5★ pré-éveillé — le bouton s'applique aux deux formes sans code
séparé.


## Ancienne exclusion absolue du Taux Crit
⚠️ **Le Taux Crit n'y figure jamais**, même en mode Moyenne — même règle que
l'objectif « Dégâts » : plafonné à 100 % en jeu, c'est une **condition** à
atteindre (via un minimum posé), pas une cible à maximiser indéfiniment. L'y
mettre pousserait la rétention à garder des demi-builds pour un potentiel de
crit qui ne sert plus à rien.
