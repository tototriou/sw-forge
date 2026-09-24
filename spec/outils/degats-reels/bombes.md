# Dégâts réels — bombes

**Statut :** ÉTAT ACTUEL — décrit la détection et le calcul des bombes
**Lire si :** on modifie la détection, la formule ou les skillups d’une bombe
**Ne pas lire si :** on travaille sur un sort offensif ordinaire ou un passif
**Voir aussi :** spec/outils/degats-reels/formules-et-combat.md, spec/outils/degats-reels/artefacts-critique-et-element.md

## Les bombes — des dégâts fixes, via une TROISIÈME détection

Une bombe **ne peut pas être critique** et **ignore la défense adverse** :
c'est exactement la sémantique de `SkillDamageProfile.fixed`. Le mécanisme
existait donc déjà — il manquait seulement de quoi le déclencher.

⚠️ **Les deux détections habituelles passent à côté**, chacune pour sa propre
raison. La donnée dit pourtant la vérité : `public/data/skills/15713.json`,
effet de `Fate of Destruction` — `"nom": "Bomb"`, « the bomb explodes to deal
damage that **ignores Defense** ».

| Drapeau | Détection | Pourquoi ça rate |
|---|---|---|
| `fixed` | `RE_FIXED` sur la **formule** (marqueur `(Fixed)`) | la formule est `"5.0*{ATK}"`, sans marqueur |
| `ignoreDef` | un effet **nommé exactement** `'Ignore DEF'` | l'effet s'appelle `'Bomb'` — l'ignore-défense n'est écrit que dans sa **PROSE** |

D'où `estBombeSansCoupDirect` : un effet nommé `Bomb` **et** `coups === 0`.


## ⚠️ Le discriminant `coups === 0` — et pourquoi il est indispensable

Marquer fixe *tout* sort portant un effet `Bomb` aurait été faux. Quatre
familles **frappent en plus de poser** leur bombe : leur formule décrit le
**coup direct**, qui crite et se fait mitiger normalement.

Vérifié par un **balayage du corpus complet** (8 434 compétences, 48 portant
l'effet) plutôt que sur le seul cas Seara — les deux familles s'y séparent
nettement :

| | Compétence | Monstres |
|---|---|---|
| **Pose seule** → **fixe** | `Fate of Destruction` | Seara, Oracle, Giana |
| | `Surprise Bomb` | Joker, Sian, Jojo, Liebli |
| | `Time Bomb` | Kobold Bomber, Malaka, Taurus, Dover |
| | `Cursed Apple` ⚠️ | Puppeteer, Zima, Smicer, Zenisek |
| **Frappe ET pose** → **pas fixe** | `Firecracker` | Kobold Bomber, Malaka, Zibrolta, Taurus… |
| | `Bombardment` | Frigate, Pirate Captain, Carrack |
| | `Dancing Star` | Geralt |
| | `Star of Explosion` | Valdemar, Henrik, Magic Order Guardian |

(`Camouflage (Passive)` et `Plasma Bomb` portent l'effet sans formule : aucun
profil n'est construit pour eux, ils ne passent jamais par cette règle.)

⚠️ **Le balayage a élargi la liste connue** : elle était estimée à trois
compétences qui frappent (`Bombardment`, `Dancing Star`, `Star of
Explosion`) — `Firecracker` s'y ajoute, sur une dizaine de formes de
monstres. Cas d'école du corpus balayé plutôt que supposé.


## ⚠️ `Cursed Apple` — quand `coups` ment

`Cursed Apple` porte `coups: 1` mais ne frappe pas : sa prose ne décrit
aucune attaque (« **Installs** a bomb that detonates after 2 turns on the
enemy target and stuns the enemy for 1 turn »). Le `1` compte l'application
de son second effet, l'**étourdissement** — pas un coup porté. Sa formule est
bien celle de l'explosion.

C'est le même piège que `COUPS_VARIABLES_CONNUS` : `Competence.coups` n'est
pas toujours fidèle au texte du jeu. D'où `BOMBES_SANS_COUP_DIRECT_CONNUS`,
curé par nom exact.

⚠️ **Ce n'est PAS généralisable en « d'autres effets ⇒ coups gonflé »** :
`Fate of Destruction` porte lui aussi deux autres effets (dégâts continus,
tour supplémentaire) et reste pourtant à `coups: 0`. La donnée est
incohérente d'un sort à l'autre, donc irréductible à un critère — seule la
curation tient.

⚠️ **La prose non plus ne ferait pas un discriminant fiable** : `Time Bomb`
contient « Attack Bar » sans frapper, et `Bombardment` frappe sans jamais
commencer par « Attacks ». Une expression régulière naïve se tromperait dans
les deux sens.

⚠️ **La règle générale reste `coups === 0`**, pas une liste blanche de noms :
c'est elle qui classera correctement un sort de bombe NOUVEAU sans qu'on ait
à le curer. La table ne rattrape que les données infidèles.

⚠️ **Kobold Bomber porte LES DEUX** (`Firecracker` qui frappe, `Time Bomb` qui
pose) : c'est le cas de test le plus net du discriminant, et il est verrouillé
comme tel.

⚠️ **Les dégâts de l'explosion différée des quatre familles « frappe et pose »
ne sont NULLE PART dans les données** — aucune formule ne les porte. Ils
restent donc hors modèle, comme le reste de ce qui ne se calcule pas.


## `skillupDamagePct` continue de s'appliquer

Une bombe profite bien des améliorations de compétence. C'est ce qui fait
tomber le relevé en jeu au bon endroit, et c'est verrouillé par un test.

**Relevé — Seara.** Bombes à **~27 000** ; avec **+24 %** de dégâts de bombe
venant des artéfacts, **~34 000**. Le rapport confirme au passage la nature
**multiplicative** de ce bonus d'artéfact (code 210) : `27 000 × 1,24 =
33 480`. La magnitude se recale en lisant le relevé correctement — le +2 800
d'ATQ est un **bonus d'équipement**, à additionner à la base et à la
compétence d'invocateur :

| | |
|---|---|
| ATQ de base (Seara) | 801 |
| + équipement | +2 800 → **3 601** |
| + compétence d'invocateur (~15 %) | ≈ **4 150** |
| `5,0 × 4 150 × 1,30` (3 × `Damage +10%`) | **26 975** ✅ |
