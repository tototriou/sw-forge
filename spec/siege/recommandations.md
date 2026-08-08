# Siège · Recommandations (`#/siege/recommandations`)

Troisième sous-onglet du siège. Permet à un joueur de composer une
**recommandation = un ENSEMBLE de decks** (ex. « mes 6 défenses de guilde »),
chaque deck portant 3 monstres avec les **sets** et les **stats à viser** sur
chacun ; de **l'exporter** d'un bloc pour la partager ; et à un autre joueur de
**l'importer** puis de voir **immédiatement quels decks il peut jouer**.

Fichiers :
- [RecoBoard.tsx](src/components/siege/RecoBoard.tsx) — barre d'actions, import/export, liste.
- [RecoCard.tsx](src/components/siege/RecoCard.tsx) — une recommandation (vue & édition).
- [useSiegeRecos.ts](src/hooks/useSiegeRecos.ts) — état + persistance.
- [recoShare.ts](src/lib/recoShare.ts) — export/import JSON + validation.
- [recoMatch.ts](src/lib/recoMatch.ts) — confrontation avec le compte (calcul pur).
- [ownedBuilds.ts](src/lib/ownedBuilds.ts) — collecte de tous les builds du joueur.
- [recoFromSiege.ts](src/lib/recoFromSiege.ts) — deck pré-rempli depuis une équipe d'offense.

## Modèle

```ts
type RecoStatKey = 'hp'|'atk'|'def'|'spd'|'cr'|'cd'|'res'|'acc';

interface RecoSlot {
  com2usId: number | null;                    // null = slot vide
  name: string;                               // repli d'affichage
  stats: Partial<Record<RecoStatKey, number>>;// minimums (absent = non exigé)
  sets: string[];                             // sets recommandés, répétitions possibles
}
interface RecoDeck { name: string; note: string; slots: RecoSlot[] } // 3 slots, index 0 = leader
interface Reco { id: string; origin: 'mine'|'imported'; name: string; author: string; note: string; decks: RecoDeck[] }
type RecoPayload = Omit<Reco, 'id' | 'origin'>; // ce qui voyage dans un export
```

**Une recommandation est un lot de decks**, pas un deck isolé : on partage
« mes défenses de siège » en un seul fichier, et le destinataire voit d'un coup
lesquelles il peut jouer.

- Une recommandation garde **toujours au moins un deck** (supprimer le dernier
  en recrée un vide).
- Un même monstre ne peut pas occuper deux slots **du même deck**, mais peut
  revenir dans **un autre deck** de la recommandation.
- Chaque deck a un **nom facultatif**. **Laissé vide, il reprend les noms de ses
  monstres séparés par un tiret** (« Trevor - Bella - Loren ») ; « Deck N » tant
  qu'aucun monstre n'est choisi.
  - Le nom automatique est **dérivé à l'affichage** (`autoDeckName` /
    `deckLabel` dans [RecoCard.tsx](src/components/siege/RecoCard.tsx)), **jamais
    stocké** : il suit les changements de monstres, et se recalcule chez celui qui
    importe (mêmes `com2usId` → mêmes noms).
  - En édition, il apparaît en **placeholder** du champ : taper quelque chose le
    remplace, vider le champ le rétablit.
  - Si un monstre est absent des données chargées, on retombe sur le nom stocké
    dans le slot au moment du partage.
- Les **decks totalement vides** ne sont ni exportés ni comptés dans les statuts.

## Origine & filtre

Chaque recommandation porte une **origine** :

| Origine | Attribuée quand | Rendu |
|---------|-----------------|-------|
| `mine` | créée via « Créer une recommandation » | — |
| `imported` | reçue via un import | puce **« Importée »** (icône ↓) dans l'en-tête |

⚠️ L'origine est **purement locale** : elle **n'est jamais transportée** dans un
export (d'où `RecoPayload`, qui exclut `id` **et** `origin`). Ce qui est « à moi »
chez l'auteur devient « importée » chez celui qui la reçoit — y compris si je
réimporte mon propre export.

**Filtre** (segmenté, sous la barre d'actions) : **Toutes · Mes recos ·
Importées**, chacun avec son effectif. N'apparaît **que s'il existe au moins une
recommandation**. Persistance via `useStickyState` (survit à la navigation, remis
à « Toutes » au reload).

Garde-fous pour ne jamais « perdre » ce qu'on vient de faire :
- **créer** une recommandation depuis la vue « Importées » bascule le filtre sur
  « Mes recos » ;
- **importer** depuis la vue « Mes recos » bascule sur « Toutes ».

Effet du filtre sur les actions :
- **Export global** : exporte **ce qui est affiché**. Le bouton s'intitule
  « Tout exporter » sans filtre, « Exporter l'affichage » avec un filtre actif.
- **Tout effacer** : efface **tout**, filtre ou non (le `confirm` le dit
  explicitement).
- Filtre sans résultat → message dédié + lien « Voir toutes les recommandations »
  (l'écran d'invite initial n'apparaît que si le stock réel est vide).

## Consignes (deux niveaux)

Une recommandation ne sert pas qu'à donner des chiffres : elle transmet **comment
jouer**. D'où **deux zones de texte libre**, toutes deux **multi-lignes** et
**partagées dans l'export** :

| Niveau | Champ | Max | Rôle |
|--------|-------|-----|------|
| Recommandation | `Reco.note` | **600** car. | **Consignes générales**, valables pour tous les decks (ex. « viser le heal en premier », « pas de def break sur les tanks »). |
| Deck | `RecoDeck.note` | **400** car. | **Consignes du deck** (ex. « ne pas ouvrir sur le leader », « garder le strip pour le tour 2 »). |

- En **édition** : `textarea` redimensionnable + **compteur de caractères
  restants** (affiché seulement dans le dernier quart, rouge à 0). La saisie est
  bornée par `maxLength`, et **re-tronquée** à l'encodage/décodage.
- En **lecture** : encart titré (icône bloc-notes doré) affiché **sous l'en-tête**
  concerné — au-dessus des decks pour les consignes générales, au-dessus des
  3 monstres pour celles du deck. Les **retours à la ligne de l'auteur sont
  conservés** (`whitespace-pre-line`).
- Une consigne **vide n'est ni affichée ni transportée** (clé absente du JSON).
- Longueurs bornées volontairement : le texte voyage **dans** le fichier
  partagé (constantes `NOTE_MAX` / `DECK_NOTE_MAX` dans
  [recoShare.ts](src/lib/recoShare.ts)).

- ⚠️ **On stocke le `com2usId`, pas l'id local** : c'est la **seule clé stable
  d'un joueur à l'autre** (même clé de jointure que les imports SWEX, voir
  [../shared/import-compte.md](../shared/import-compte.md)). Conséquence : un
  **monstre perso** (`com2usId = null`) **ne peut pas** entrer dans une
  recommandation.
- Les **8 stats** proposées sont celles du calcul de stats totales
  (`RECO_STATS` dans [types.ts](src/types.ts)) : PV, ATQ, DEF, VIT, Taux Crit,
  Dmg Crit, RES, Précision. **Chacune est facultative** : une stat vide n'est
  pas exigée.

### Affichage des stats — même grammaire que le panneau d'équipement

Les deux vues (saisie et lecture) reprennent le rendu du tableau de stats de
[MonsterGear.tsx](src/components/MonsterGear.tsx) — celui du détail d'un monstre
en RTA/siège : **table à lignes séparées** (`border-b border-border/40`), libellé
**terne** à gauche, valeurs **mono `tabular-nums`** alignées à droite, apport
**en vert**.

**Saisie** (deck en édition) — une ligne par stat :

```
Stat        base    bonus      total
VIT          107  + [ 105 ]      212
PV        10 050  + [24 950]  35 000
```

- La colonne **base** rappelle la stat du **monstre 6★ nu** (données SWARFARM
  `max_lvl_*`, voir [../shared/donnees-monstres.md](../shared/donnees-monstres.md)).
- On ne saisit que le **bonus à apporter** — c'est ainsi qu'on raisonne quand on
  rune un monstre. Le **total** est affiché à droite.
- **C'est le total qui est stocké et partagé** (`RecoSlot.stats`), pas le bonus :
  une valeur absolue reste juste même si les données de base évoluent, et c'est
  ce qui est comparé à la stat réelle du joueur.
- Base inconnue (monstre absent des données) → base affichée « — » et base
  traitée comme 0 : le champ vaut alors directement le total.

**Lecture** — **mêmes colonnes** que la saisie (`base` / `bonus` / `total`), pour
qu'on lise une recommandation exactement comme on l'écrit. Le **bonus est
recalculé** (`total − base`), il n'est jamais stocké :

```
Stat        base    bonus     total       toi
VIT          107     +105       212       220          ← vert : atteint
PV        10 050  +24 950    35 000   28 400 (−6 600)  ← rouge : écart affiché
```

La colonne **« toi » n'apparaît qu'après une analyse** (sinon la table s'arrête à
`total`), cohérent avec le fait que rien n'est confronté par défaut.

Le champ de saisie du bonus est un **`type="text"` + `inputMode="numeric"`**, et
non un `type="number"` : les boutons `+/-` du navigateur mangeaient la largeur
d'une colonne déjà étroite. La frappe non numérique est ignorée ; vider le champ
retire la stat.
- **Changer le monstre d'un slot remet ses stats ET ses sets à zéro** (ils ne
  valaient que pour le monstre visé).

## Sets de runes recommandés

Un monstre porte **6 runes** ; un set 4 pièces en coûte 4, tous les autres 2
(voir `setPieces` / `FOUR_PIECE_SETS` dans [effects.ts](src/lib/effects.ts)).
D'où les **combinaisons possibles**, toutes gérées :

| Combinaison | Coût | Exemple |
|-------------|------|---------|
| 4 + 2 | 6 | Violent + Will |
| 2 + 2 + 2 | 6 | Will + Focus + Endure |
| 4 seul | 4 | Violent |
| 2 + 2 | 4 | Will + Focus |
| 2 seul | 2 | Will |
| aucun | 0 | — |

- **Un seul set 4 pièces** possible (4 + 4 = 8 > 6) : `canAddSet` l'interdit.
- **Répétitions autorisées** : un set 2 pièces peut être demandé **plusieurs
  fois** (ex. **3× Fight** = 6 runes Fight, bonus cumulé) — d'où une **liste**
  et non un ensemble, et un **retrait par position** (pas par clé).
- Le sélecteur d'édition ne propose que les sets qui **tiennent encore**, et
  affiche le compteur `N/6 runes` ; à saturation il indique « Plus de place ».
- Helpers purs : `setsCost`, `canAddSet`, `missingSets`
  ([recoMatch.ts](src/lib/recoMatch.ts)). La contrainte est **rejouée au
  chargement** du `localStorage` (données potentiellement bricolées à la main).

### Activation côté joueur — logique partagée

`activeSets(keys)` dans [effects.ts](src/lib/effects.ts) calcule les sets
**réellement actifs** d'un build : set 4 pièces à 4 runes, les autres à 2, un set
2 pièces pouvant être actif **plusieurs fois** (6 runes Fight → `['fight',
'fight','fight']`), et une rune **Intangible** servant de **joker** pour compléter
le set auquel il manque le moins de pièces.

> Cette fonction était auparavant privée à `importAccount.ts` (sur les `set_id`
> com2us) ; elle a été **remontée dans `effects.ts`** et l'import la réutilise
> après conversion `set_id → clé`. **Une seule règle d'activation** pour l'import
> de compte et pour les recommandations.

La confrontation compare en **multi-ensemble** : demander 2× Fight exige bien
deux fois le set actif.

## Persistance

`localStorage` `sw-forge-siege-recos-v1` — contrairement à la box (en mémoire),
ce sont des données **créées par l'utilisateur ou reçues d'un ami** : elles
survivent au reload. Effacées par « Supprimer mes données » (préfixe `sw-forge`).

## Partage — un seul format : le JSON

Tout vit dans [recoShare.ts](src/lib/recoShare.ts). **100 % local**, aucun envoi
réseau.

⚠️ **Le JSON est le SEUL format**, à l'export comme à l'import. Un code compact
base64 (`SWF-RECO-1:`) a coexisté un temps ; il a été **retiré** — deux formats
pour la même chose, c'est deux fois plus de surface à valider, pour un contenu
que personne ne peut relire ni corriger.

### Fichier JSON (`format: "sw-forge/recommandations"`, `version: 2`)

```json
{ "format": "sw-forge/recommandations", "version": 2, "exporte_le": "…",
  "recommandations": [
    { "nom": "…", "auteur": "…", "consignes": "…",
      "decks": [ { "nom": "Def 1", "consignes": "…",
        "monstres": [ { "com2usId": 15214, "nom": "Trevor",
                        "sets": ["violent","will"], "stats": { "spd": 212 } }, null, null ] } ] } ] }
```

Clés **en français** comme l'interface ; les clés **anglaises du modèle**
(`name`, `note`, `slots`…) sont aussi acceptées en lecture.

**Export** : le JSON est **téléchargé en `.json`** *et* **copié au presse-papier**
— pièce jointe ou copier/coller, au choix.

**Import** : fichier `.json` ou contenu collé, **rien d'autre**. Un contenu qui ne
commence pas par `{` est refusé avec un message explicite, plutôt qu'une erreur de
parseur incompréhensible.

La **migration `localStorage`** reste en place : un enregistrement à l'ancienne
forme (`reco.slots`, du temps où une reco = un deck) est relu comme une
recommandation à un deck.

## Validation à l'import

`validateRecosImport(text)` renvoie un **rapport** — le contenu vient d'un tiers,
on ne lui fait pas confiance et **on ne corrige pas en silence** :

```ts
interface ImportReport {
  recos: Omit<Reco,'id'>[] | null;   // null = rien n'est importé
  source: 'json' | 'code' | null;
  errors: string[];                  // bloquants
  warnings: string[];                // corrections appliquées
  counts: { recos: number; decks: number; monstres: number };
}
```

**Erreurs bloquantes** (rien n'est importé) : JSON syntaxiquement invalide (le
message du parseur est repris), clé `recommandations` absente, liste vide, aucune
recommandation exploitable, contenu vide ou non reconnu.

**Corrections signalées** (l'import a lieu) : stat inconnue ou valeur ≤ 0, set
inconnu, set qui ferait **dépasser 6 runes**, `com2usId` invalide, deck de plus de
3 monstres, consignes tronquées, deck sans monstre ignoré, recommandation sans
deck ignorée, `format` déclaré différent, ancien format converti. Chaque message
est **localisé** : `« Defs G3 », deck 1 « D1 », monstre 2 : stat inconnue « zzz »
ignorée.` Les doublons sont dédupliqués (une même correction sur 50 decks
n'apparaît qu'une fois).

Un contrôle supplémentaire est fait côté board (il connaît le bestiaire) :
les `com2usId` **absents des données chargées** sont signalés — ces monstres
s'affichent sans portrait et ne sont pas confrontés.

**Rendu** : encart sous la zone d'import, **rouge** si bloquant / **orange** si
corrections, avec la liste des messages (défilante) et le récapitulatif de ce qui
a été retenu. Contrairement au message de succès, il **n'est pas éphémère** — il
y a quelque chose à lire — et se ferme par une croix.

- **Exporter** (icône **Upload ↑**) : une recommandation **avec tous ses decks**,
  **ou** « Tout exporter ». Produit le **fichier `.json`**, dont le contenu est
  aussi **copié au presse-papier**. Une recommandation dont **aucun deck** n'a de
  monstre n'est pas exportable ; le message récapitule
  « N recommandation(s) · M deck(s) ».
- **Importer** (icône **Download ↓**) : zone dépliable où **charger un fichier
  `.json`** ou **coller son contenu**. Le contenu passe par le validateur (voir
  ci-dessous) ; espaces et retours ligne autour du JSON tolérés.
- ⚠️ **Un import AJOUTE toujours à la suite. Il ne remplace jamais.**
  - Aucune option, aucune confirmation : l'import ne peut pas détruire de
    données, donc il n'a rien à demander.
  - Les recommandations sont du **contenu créé à la main**, non re-dérivable d'un
    export de compte : un import ne doit pas pouvoir les effacer.
  - Pour repartir de zéro, **« Tout effacer »** existe — geste explicite, séparé,
    avec confirmation.
  - **Historique à ne pas répéter** : un `confirm` posait
    `OK = remplacer · Annuler = ajouter`. Sur un import, le réflexe est de
    cliquer OK — des recommandations ont été **définitivement perdues**. Un
    `confirm` sert à confirmer une intention déjà exprimée, **jamais** à choisir
    entre deux options dont l'une détruit.
- Message de succès **éphémère** (~5 s) ; le **rapport de validation** reste
  affiché jusqu'à fermeture.

> Convention d'icônes, identique à la comparaison de courbes de runes :
> **Exporter = Upload ↑**, **Importer = Download ↓**.

## Confrontation avec mon compte — bouton « Analyser mes decks »

Calcul pur dans [recoMatch.ts](src/lib/recoMatch.ts) → stats réelles via
`computeStats` ([stats.ts](src/lib/stats.ts)).

### À la demande, pas en continu

⚠️ **Rien n'est confronté par défaut.** Une carte non analysée est neutre : pas
d'aura, pas de pastille, pas de badge sur les monstres. L'analyse se lance **par
recommandation**, via le bouton **« Analyser mes decks »** de son en-tête (il
devient « Réanalyser mes decks » ensuite) — le libellé dit bien que la
confrontation porte sur **l'ensemble des decks**, pas sur un seul.

- Le bouton est **désactivé sans compte importé** (rien à quoi comparer).
- Le résultat est **mémorisé dans le board** avec la reco et les builds qui ont
  servi ; il devient **périmé** dès que l'un des deux change (comparaison par
  **identité d'objet** : toute édition recrée les objets). La carte repasse alors
  à l'état non analysé et le bouton réaffiche « Analyser ».
- Motivation : confronter *toutes* les recos à *tous* les builds à chaque rendu
  était un coût permanent pour une information qu'on ne consulte que ponctuellement.

### Ce que l'analyse affiche

Un **encart de synthèse** sous l'en-tête, visible **même recommandation repliée** :

- tout passe → bandeau vert « Tout est respecté : les N deck(s) sont jouables » ;
- sinon → bandeau orange « N/M deck(s) au niveau · K à corriger », puis **la liste
  des decks qui ne passent pas**, chacun avec son verdict et, s'il y a lieu, le
  détail par monstre :
  - `Trevor - Bella - Tarq` · **aucun deck avec ces monstres — tu peux le composer**
    (pas de détail : sans équipe, il n'y a aucun build à confronter)
  - `Def 2` · **monstre indisponible — deck impossible** → `Tarq — monstre indisponible`
  - `Def 3` · **stats non respectées** → `Bella — VIT 117 au lieu de 212 · set violent manquant`
- aucun deck rempli → « Rien à analyser ».

Une fois analysée, la carte reprend tout le langage visuel décrit plus bas (aura,
pastille, badges de deck et de monstre, comparaison stat par stat).

**Fermer le résultat** : une **croix** efface l'analyse et la carte **redevient
neutre** — halo, pastille, badges et colonne « toi » disparaissent d'un coup.
Utile quand tout est vert : l'information a été lue, le halo n'a plus rien à dire.
Il suffit de relancer « Analyser mes decks » pour la revoir.

La croix est présente **aux deux endroits** où le résultat s'affiche :
- sur l'**encart de synthèse** (ses trois états : vert, orange, « rien à
  analyser ») ;
- **dans la pastille d'en-tête** (« 1/4 decks au niveau ») — c'est le seul repère
  visible quand la carte est repliée, il doit donc être refermable de là aussi.

### ⚠️ Source : TOUS les builds, pas seulement la box

Dans SW, un monstre a **un preset de runes par contexte**. La box ne contient que
l'**équipement actuellement porté** : s'y limiter faisait échouer la confrontation
d'un deck… que le joueur possède exactement tel quel en siège (symptômes observés :
« monstre non trouvé » et « à améliorer » juste après avoir importé son propre deck
d'offense).

`collectOwnedBuilds` ([ownedBuilds.ts](src/lib/ownedBuilds.ts)) rassemble donc
**tous les builds connus**, assemblés dans [App.tsx](src/App.tsx) :

| Source | Origine | Libellé affiché |
|--------|---------|-----------------|
| `box` | équipement porté (`BoxItem.gear`) | « Box » |
| `rta` | preset RTA (`RtaEntry.gear`) | « RTA » |
| `defense` | presets des équipes de défense | « Défense N » |
| `offense` | presets des équipes d'attaque | « Offense N » |

Conséquences :
- un monstre **présent dans un deck est possédé**, même s'il n'est pas dans la
  box 6★ → plus de faux « non possédé » ;
- la comparaison se fait sur le **meilleur build disponible**, pas sur celui qui
  se trouve être équipé au moment de l'export.

- **Plusieurs builds** pour un même monstre (exemplaires multiples × presets) :
  on retient le **meilleur** — celui qui satisfait le plus de critères (**stats
  atteintes + sets portés**, à poids égal), départagé par le **pire ratio
  atteint/exigé** le moins mauvais (le plus proche du build demandé). Ex. une
  reco Swift+Focus choisira le preset runé Swift, pas celui runé Violent.
- Le **build retenu est affiché** sous le monstre (« au niveau · Offense 3 »).
- Statut **par slot** :

| Statut | Sens | Rendu |
|--------|------|-------|
| `empty` | pas de monstre dans la reco | neutre |
| `absent` | **aucun build connu** pour ce monstre | bordure rouge, « monstre non trouvé » |
| `ko` | possédé mais ≥ 1 stat sous le minimum **ou** ≥ 1 set manquant | bordure orange, « à améliorer » |
| `ok` | possédé, **toutes** les stats atteintes **et** tous les sets portés | bordure verte, « au niveau » |

### Trois questions, dans cet ordre

L'analyse d'un deck répond à : **ai-je un deck ? est-il correct ? sinon, puis-je
le faire ?**

1. **Ai-je les monstres ?** Non → `missing` : le deck est **impossible**.
2. **Ai-je une équipe existante qui les réunit** (défense ou offense) ? Non →
   `nodeck` : tu as les monstres, **il reste à composer l'équipe**.
3. **Dans cette équipe, les stats/sets suivent-ils ?** Non → `ko`.

Le point 2 est la nuance qui compte : posséder les monstres ne veut pas dire
avoir le deck. `OwnedTeam` ([ownedBuilds.ts](src/lib/ownedBuilds.ts)) recense les
**équipes réellement composées** ; une équipe « correspond » si elle contient
**tous** les monstres du deck recommandé. À plusieurs candidates, on retient
celle qui satisfait le plus de critères. Les stats sont alors comparées **au
build de cette équipe-là**, pas au meilleur build tous contextes confondus.

| Statut | Couleur | Condition | Badge |
|--------|---------|-----------|-------|
| `missing` | `fire` | au moins un monstre **non possédé** | « monstre indisponible — deck impossible » |
| `ko` | `fire` | l'équipe existe mais **stats/sets insuffisants** | « stats non respectées · Offense 3 » |
| `nodeck` | `amber` | monstres possédés, **aucune équipe ne les réunit** | « aucun deck avec ces monstres — à composer » |
| `ok` | `emerald` | l'équipe existe et tout est au niveau | « jouable · Offense 3 » |
| `unknown` | neutre | deck **vide** | — |

Statut **par slot** : `absent` (rouge, « monstre indisponible ») · `ko` (rouge,
« stats insuffisantes ») · `ok` (vert, « au niveau ») · `unknown` (neutre,
« possédé » — rien à confronter faute d'équipe) · `empty` (slot vide).

**Mise en évidence** : dans un slot `ko`, les **lignes de stats non respectées**
sont surlignées (fond rouge léger, libellé rouge) — on voit ce qui bloque sans
lire les chiffres. Le slot fautif prend une bordure rouge, comme un slot dont le
monstre est indisponible : les deux sont bloquants.

- Statut **de la recommandation** (`matchReco`) = **agrégat de ses decks non
  vides**, aura de la carte + pastille d'en-tête :

| Statut | Couleur | Condition | Pastille |
|--------|---------|-----------|----------|
| `ok` | `emerald` | **tous** les decks jouables | « N decks jouables » |
| `partial` | `amber` | une partie seulement | « N/M decks au niveau » |
| `missing` | `fire` | **aucun** deck jouable, tous bloqués par un monstre manquant | « Aucun deck jouable » |
| `unknown` | neutre | **pas encore analysée**, ou aucun deck rempli | — |

- Sans compte importé : bouton « Analyser » **désactivé**, cartes neutres. Les
  recommandations restent consultables, éditables et exportables.
- Par stat, la vue affiche `minimum` puis **ta valeur** : verte avec ✓ si
  atteinte, rouge avec l'écart `(−X)` sinon.
- Par set, une puce **icône + ×2/×4** : verte avec ✓ si le set est porté, rouge
  avec ✗ sinon. Un set demandé 2× mais actif 1× → la **seconde** puce est rouge.

## Interactions

### Repliée par défaut — bouton « Consulter »

Une recommandation contenant plusieurs decks de 3 monstres, la liste serait
illisible tout déplié. Chaque carte est donc **repliée par défaut** :

- **Repliée** : l'en-tête (nom, puce « Importée », nombre de decks, auteur,
  pastille de statut) **+ un aperçu d'une ligne** — une puce par deck avec son
  **nom** et un **point de couleur** (vert/orange/rouge/neutre) reprenant son
  statut, plus un repère « consignes » si la recommandation en porte. On voit
  donc quoi ouvrir **sans rien déplier**. Cliquer l'aperçu déplie aussi.
- **Bouton « Consulter »** (chevron) dans l'en-tête → déplie et affiche les
  consignes générales puis tous les decks ; devient **« Réduire »**.
- **Plusieurs recommandations peuvent être dépliées** en même temps (état local
  au board, non persisté).
- **Éditer implique déplier** : une carte en édition (recommandation **ou** l'un
  de ses decks) est toujours affichée en entier
  (`expanded = open || editing || editingDeck !== null`) — le bouton
  « Consulter » est donc **masqué en édition** (il n'aurait aucun effet).

### Repli deck par deck

Indépendamment du repli de la carte, **chaque deck a son propre chevron**.

- ⚠️ **Les decks sont repliés par défaut** : déplier une recommandation montre la
  **liste de ses decks**, pas leur contenu. On ouvre ensuite celui qui intéresse.
  Sans ça, une reco de 6 decks déroulait tout l'écran d'un coup.
- **Lead du leader** : l'en-tête de chaque deck porte la **même pastille qu'en
  siège** ([LeadPill.tsx](src/components/siege/LeadPill.tsx)) pour le monstre en
  slot 0 — couronne + icône de vitesse si c'est un lead SPD + icône d'élément si
  la portée est élémentaire. Voir [equipes.md](equipes.md).
- **Deck replié** : chevron + nom (cliquable) + **les 3 monstres en icônes**
  (portrait hexagonal + badge d'élément, **sans nom**) pour s'y retrouver d'un
  coup d'œil, + le badge de statut et le bouton **Éditer**.
- **« Déplier / Replier tous les decks »** : lien en haut à droite de la liste,
  affiché dès **2 decks**.
- Un deck **en édition est toujours déplié**, quel que soit son état de repli.
- État **local à la carte** (`openDecks` = les decks ouverts), réinitialisé quand
  le **nombre de decks change** (les index se décalent à l'ajout/suppression).
  Replier puis rouvrir la recommandation **conserve** les decks qu'on avait
  ouverts.

- **Créer une recommandation** → carte ajoutée en fin de liste **avec un deck
  vide**, **ouverte en édition** (recommandation **et** son deck), et **scroll
  automatique** jusqu'à elle (comme « Ajouter une équipe », voir
  [README.md](README.md)).
### Deux niveaux d'édition, séparés

| Bouton | Où | Ce qu'il ouvre |
|--------|----|----------------|
| ✏️ (en-tête de la carte) | recommandation | **nom, auteur, consignes générales** + **Ajouter un deck vide** / **Importer un deck d'offense** |
| ✏️ (en-tête de chaque deck) | deck | **nom du deck, ses consignes, ses monstres, sets et stats** + 🗑 **Supprimer ce deck** |

**Icônes nues partout** dans les en-têtes — carrés de 24 px, **sans cadre ni
fond**, groupés et resserrés (`gap-0.5`) à droite de la ligne :

- **recommandation** : Exporter ↑, Éditer ✏️, Supprimer 🗑 — la ligne porte déjà
  le nom, la puce « Importée », le compteur de decks, l'auteur, la pastille de
  statut, « Analyser mes decks » et « Consulter ».
- **deck** : Éditer ✏️, puis Supprimer 🗑 (visible seulement en édition).
- Le sens passe par l'**infobulle** et l'`aria-label` (obligatoire : une icône
  seule n'est pas lisible au lecteur d'écran).
- Faute de cadre pour marquer l'état actif, l'**édition en cours** se lit à
  l'icône qui devient un **✓ doré** (`text-star`) + `aria-pressed`.
- Les libellés ne sont conservés que là où la place ne manque pas : « Analyser
  mes decks », « Consulter », et les actions de la barre du haut.

- Éditer la recommandation **ne rend pas les decks modifiables** : les deux
  portées sont indépendantes, on ne touche pas au contenu d'un deck en corrigeant
  un titre.
- **Un seul deck en édition à la fois** (et une seule recommandation) : on
  travaille sur un deck, pas sur six.
- **« Terminer » sur la recommandation termine aussi l'édition de ses decks** :
  un seul geste referme tout, on ne laisse pas un deck en édition derrière soi.
  Vaut également quand le board bascule l'édition vers **une autre**
  recommandation (implémenté par effet sur `editing`, pas dans le `onClick`).
- Un deck **en édition est toujours déplié**, même s'il était replié.
- Le bouton d'édition d'un deck est accessible **dès que la carte est dépliée**,
  sans passer par l'édition de la recommandation.
- **Raccourcis** : créer une recommandation ouvre directement son deck vide en
  édition ; ajouter/importer un deck ouvre le nouveau deck en édition.
- La suppression d'un deck demande une **confirmation**.
- **Disposition** : les recommandations sont **empilées en pleine largeur** (une
  par ligne) — elles contiennent plusieurs decks de 3 monstres, une mise en
  2 colonnes serait illisible. À l'intérieur, les decks sont empilés et chaque
  deck affiche ses 3 slots en ligne (1 colonne sous `sm`).
- **Supprimer** une recommandation (avec `confirm`) · **Tout effacer**.

## Partir d'une équipe d'offense existante

Écrire un deck à la main est fastidieux : en édition, le bouton **« Importer un
deck d'offense »** (avec le nombre d'équipes disponibles) liste les **équipes
d'attaque de siège** du joueur ; en choisir une **ajoute un deck pré-rempli**.

Conversion — [recoFromSiege.ts](src/lib/recoFromSiege.ts), calcul pur :

| Élément | Source | Règle |
|---------|--------|-------|
| Monstres | `SiegeSlot.monsterId` → `Monster` | mêmes positions (slot 0 = leader) |
| Sets | `SiegeSlot.sets` | ce sont déjà les **sets actifs** calculés à l'import ; recopiés, bornés à 6 runes par sécurité |
| Stats | `computeStats(SiegeSlot.gear)` | **valeurs réelles du build** posées comme minimums ; les stats à **0 sont omises** (ex. précision d'un build sans précision) |
| Nom du deck | — | **laissé vide** → prend les noms des monstres (« Trevor - Bella - Loren ») |

- C'est un **point de départ éditable** : l'auteur ajuste ou vide les stats
  qu'il ne veut pas exiger.
- Un slot dont le monstre n'a **pas de `gear`** (ajouté à la main) arrive **sans
  stats** ; un **monstre perso** (`com2usId = null`, non partageable) laisse le
  **slot vide**.
- Seules les équipes contenant **au moins un monstre partageable** sont proposées
  (`isTeamUsable`).
- **Rendu d'une ligne** : le rang (`#N`) puis les **3 monstres en icônes**
  (portrait hexagonal + badge d'élément), **sans nom** — les noms sont bruyants et
  l'icône se reconnaît plus vite. Le résumé texte (`teamSummary`) sert
  d'**infobulle**.
- **Barre de recherche par monstre** en tête de liste (filtre sur les noms des
  3 monstres) : avec ~50 attaques sauvegardées, c'est le seul moyen de retrouver
  une équipe. Message dédié si le filtre ne renvoie rien.
- Sans équipe d'offense, le bouton est **désactivé** avec l'explication (il faut
  avoir **sauvegardé ses attaques en jeu** avant d'exporter son compte, voir
  [../shared/import-compte.md](../shared/import-compte.md)).
- Câblage : l'état d'**offense est passé explicitement** à `RecoBoard`
  (prop `offense` depuis [App.tsx](src/App.tsx) via
  [SiegePage.tsx](src/pages/SiegePage.tsx)) — l'onglet « Recommandations » n'a
  pas de « côté » actif, il lui faut donc l'offense en propre.

## Limites connues / évolutions possibles

- La confrontation ne voit que les builds **présents dans l'export** : un
  monstre au niveau mais déruné (et absent de tout deck) apparaîtra « à
  améliorer ».
- Aucune notion de tolérance : le test est un **`≥` strict** sur chaque stat.
