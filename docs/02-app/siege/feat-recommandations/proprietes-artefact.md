# Recommandations — propriétés d'artéfact recommandées

Partie de [Siège · Recommandations](README.md).

## Propriétés d'artéfact recommandées

Un monstre porte **deux artéfacts** : celui d'**attribut** (lié à son élément) et
celui de **type** (lié à son archétype). Chacun a **4 emplacements** de propriété
secondaire — d'où **4 + 4 exigences possibles par monstre**
(`MAX_ARTIFACT_SUBS`).

`RecoSlot.artifacts` stocke des **codes** (`ARTIFACT_SUB` d'[effects.ts](src/lib/effects.ts)),
pas des libellés : c'est ce que porte l'export du compte, donc la confrontation
est exacte, et renommer un libellé ne casse pas les recommandations déjà
partagées.

### ⚠️ Aucune valeur minimale — la PRÉSENCE seule est exigée

Contrairement aux stats, une propriété d'artéfact ne porte **pas de seuil**. Ces
substats sont conditionnels (« dégâts sur le Feu », « VIT sous effet
d'incapacité ») : exiger un chiffre sur un effet qui ne s'applique qu'en
situation donnerait une fausse précision, alors que ce qui se joue en pratique
est **« as-tu la bonne ligne »**.

### ⚠️ Quelle propriété sur quelle sorte d'artéfact

Les codes com2us sont rangés par **plages**, et `artifactSubKinds` s'en sert :

| Plage | Sorte | Exemples |
|-------|-------|----------|
| 200–299 | les deux | vol de vie, dégâts de contre-attaque |
| 300–399 | **attribut** seul | dégâts sur le Feu, dégâts reçus de l'Eau |
| 400–499 | **type** seul | dmg crit Compétence 2, récupération Compétence 3 |

Vérifié sur les **2 120 artéfacts** d'un compte réel : aucune plage ne déborde.
Les propriétés impossibles ne sont **jamais proposées** dans la liste, et sont
**écartées à l'import** — exiger « Dégâts sur le Feu » sur un artéfact de type
donnerait un critère que rien ne pourrait jamais satisfaire.

### Choix — **par liste déroulante**, contrairement aux sets

Une quarantaine de propriétés, toutes textuelles, **aucune n'a de symbole dans le
jeu** : une grille d'icônes comme celle des sets serait un mur de texte. Un
`<select>` natif se filtre au clavier et se manipule au doigt.

- Une liste **par sorte d'artéfact**, avec son compteur `N/4`.
- Les propriétés **déjà exigées** disparaissent du menu ; à 4, le menu se
  désactive et annonce « Les 4 propriétés sont prises ».
- Le menu reste sur `value=""` : il sert à **ajouter**, il ne porte pas de
  sélection courante. Chaque exigence devient une **chip avec ×**.
- En lecture, le bloc **disparaît si rien n'est exigé** — la plupart des
  recommandations ne portent que sur les runes et les stats.
- Le bloc est **le dernier du slot**, sous la table de stats : c'est le critère
  le plus rarement renseigné, et la table reste ainsi à la même hauteur d'un slot
  à l'autre.

> L'ordre d'AFFICHAGE (sets → stats → artéfacts) est celui de la lecture ;
> l'ordre des **causes de rejet** (sets → artéfacts → stats) est celui du geste à
> faire. Les deux n'ont pas à coïncider.

### Confrontation

`artifactChecksFor` ([recoMatch.ts](src/lib/recoMatch.ts)) compare les codes
exigés aux `subs` de l'artéfact **de la même sorte** dans le build retenu.

⚠️ **Artéfact absent = propriété absente.** Un monstre sans artéfact de type ne
satisfait aucune exigence de type ; le traiter comme « rien à vérifier » l'aurait
fait passer pour conforme.

Les propriétés satisfaites comptent aussi dans le **départage entre équipes
candidates** : les ignorer ferait retenir une équipe moins bonne quand seuls les
artéfacts les séparent.
