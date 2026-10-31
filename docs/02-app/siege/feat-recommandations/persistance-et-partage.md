# Recommandations — persistance, partage et validation à l'import

Partie de [Siège · Recommandations](README.md).

## Persistance

`localStorage` `swblacksmith-siege-recos-v1` — contrairement à la box (en mémoire),
ce sont des données **créées par l'utilisateur ou reçues d'un ami** : elles
survivent au reload. Effacées par « Supprimer mes données » (préfixe `swblacksmith-`).

## Partage — un seul format : le JSON

Tout vit dans [recoShare.ts](src/lib/recoShare.ts). **100 % local**, aucun envoi
réseau.

⚠️ **Le JSON est le SEUL format**, à l'export comme à l'import. Pas de code
compact base64 (`SWF-RECO-1:`) : deux formats
pour la même chose, c'est deux fois plus de surface à valider, pour un contenu
que personne ne peut relire ni corriger.

### Fichier JSON (`format: "swblacksmith/recommandations"`, `version: 5`)

⚠️ Un fichier à l'identifiant `sw-forge/recommandations` est reconnu à
l'import, sans avertissement ([formatsExport.ts](src/lib/formatsExport.ts)).

```json
{ "format": "swblacksmith/recommandations", "version": 5, "exporte_le": "…",
  "recommandations": [
    { "nom": "…", "auteur": "…", "consignes": "…",
      "decks": [ { "nom": "Def 1", "consignes": "…",
        "fort_contre": [ { "monstres": [ { "com2usId": 19315, "nom": "Chloe" }, null, null ],
                           "note": "si le Chloe est en lead" } ],
        "monstres": [ { "com2usId": 15214, "nom": "Trevor",
                        "sets": [["violent","will"]],
                        "artefacts": {
                          "attribut": [ { "code": 300, "propriete": "Dégâts sur le Feu +X%" } ],
                          "type":     [ { "code": 401, "propriete": "Dmg crit Compétence 2 +X%" } ] },
                        "stats": { "spd": 212 } }, null, null ] } ] } ] }
```

Clés **en français** comme l'interface ; les clés **anglaises du modèle**
(`name`, `note`, `slots`…) sont aussi acceptées en lecture.

⚠️ **Chaque propriété d'artéfact porte son code ET son libellé.** Le code seul
(`300`) ne se relit pas, or le fichier est censé s'ouvrir et se corriger à la
main. **Seul le code est lu** à l'import : un libellé modifié à la main est
ignoré, il ne fait pas foi. Le code nu (`[300, 301]`) reste accepté en lecture.

Les sortes d'artéfact **vides sont omises** : un monstre qui n'exige rien ne
traîne pas deux listes vides dans le fichier.

**Export** : le JSON est **téléchargé en `.json`**. Rien d'autre — pas de copie au
presse-papier.

**Versions du format** (`JSON_VERSION`) :

| Version | Changement |
|---------|-----------|
| 5 | `fort_contre` : **défenses adverses** qu'un deck bat (3 monstres + précision) |
| 4 | `artefacts` : **propriétés secondaires d'artéfact exigées** (attribut / type) |
| 3 | `sets` d'un monstre devient une **liste de possibilités** (`[["violent","nemesis"],["violent","revenge"]]`) |
| 2 | JSON lisible, clés en français |

⚠️ **Rétrocompatibilité garantie en lecture** : un `sets` qui est une simple
liste de clés (v1/v2) est repris comme **possibilité unique**, un monstre sans
clé `artefacts` (≤ v3) n'exige rien, et un deck sans `fort_contre` (≤ v4) ne vise
aucune défense — sans perte. Mais l'import **le signale** — « Fichier au format
v4 (actuel : v5) […] réexporte-le pour le mettre à jour » — sinon un fichier
ancien circule indéfiniment dans la guilde et personne ne sait qu'un format plus
riche existe.

**Import** : **fichier `.json` uniquement**. ⚠️ **Pas de zone de collage** : une
recommandation se transmet comme une pièce jointe, et un champ de texte libre
n'apporterait qu'une seconde voie à valider, à expliquer et à maintenir. Un contenu
qui ne commence pas par `{` est refusé avec un message explicite, plutôt qu'une
erreur de parseur incompréhensible.

La **migration `localStorage`** : un enregistrement à la forme `reco.slots`
(une reco = un deck) est relu comme une recommandation à un deck.

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
  **ou** « Tout exporter ». Produit le **fichier `.json`**. Une recommandation
  dont **aucun deck** n'a de monstre n'est pas exportable ; le message récapitule
  « N recommandation(s) · M deck(s) ».
  - ⚠️ **Se confirme, malgré l'absence de perte locale.** Rien ne disparaît sur
    l'appareil — mais c'est un geste vers l'EXTÉRIEUR : un fichier écrit sur le
    disque, prêt à être partagé. La modale dit CE QUI VA SORTIR (combien de
    recommandations, combien de decks) **avant** que ça parte, plutôt qu'un
    message après coup qu'on ne lit qu'une fois le fichier déjà sur le disque.
    Ton **neutre**, pas `destructif` : ce n'est pas la même nature de geste
    qu'un effacement, même si les deux se confirment.
- **Importer** (icône **Download ↓**) : ouvre **directement le sélecteur de
  fichier** `.json` — pas d'écran intermédiaire, pas de zone de collage. Le
  contenu passe par le validateur (voir ci-dessous) ; espaces et retours ligne
  autour du JSON tolérés.
- ⚠️ **Un import ne remplace jamais.** Il AJOUTE à la suite, ou — quand le
  fichier complète une recommandation qu'on a déjà, et seulement si on le
  choisit — il la **fusionne** dans celle-ci, qui n'y perd rien (voir « Fusion
  d'un import » ci-dessous).
  - Sans correspondance, aucune option, aucune confirmation : l'import ne peut
    pas détruire de données, donc il n'a rien à demander.
  - Les recommandations sont du **contenu créé à la main**, non re-dérivable d'un
    export de compte : un import ne doit pas pouvoir les effacer.
  - Pour repartir de zéro, **« Tout effacer »** existe — geste explicite, séparé,
    avec confirmation.
  - ⚠️ **Jamais une confirmation `OK = remplacer · Annuler = ajouter`** : sur
    un import, le réflexe est de cliquer OK, et des recommandations seraient
    **définitivement perdues**. Une confirmation sert à confirmer une
    intention déjà exprimée, **jamais** à choisir entre deux options dont
    l'une détruit.
- Message de succès **éphémère** (~5 s) ; le **rapport de validation** reste
  affiché jusqu'à fermeture.

> Convention d'icônes, identique à la comparaison de courbes de runes :
> **Exporter = Upload ↑**, **Importer = Download ↓**.

## Fusion d'un import

Logique : [recoFusion.ts](src/lib/recoFusion.ts) (clé d'équipe :
[recoDefenses.ts](../../../../src/lib/recoDefenses.ts)), calcul pur testé par
[tests/reco-fusion.test.ts](tests/reco-fusion.test.ts) ; choix :
[ChoixFusionRecos.tsx](src/components/siege/ChoixFusionRecos.tsx).

Un même auteur — un joueur, ou un fichier produit par un outil externe —
republie de semaine en semaine **la même recommandation, enrichie**. Ajouter
à chaque fois accumulerait les decks en double : une même équipe reviendrait
une fois par fichier. La fusion n'apporte que ce qui manque.

### La correspondance : quelle recommandation un fichier complète

Deux règles, dans cet ordre :

1. **Les deux portent une `source`** (champ facultatif d'une recommandation,
   ci-dessous) : elle seule décide. Elle est faite pour ça — stable malgré un
   renommage par l'utilisateur ou une date dans le nom —, et deux sources
   différentes disent deux provenances, même si les noms se ressemblent.
2. **Sinon : même auteur (non vide) ET même nom de base (non vide).** Le nom de
   base est le nom sans sa date finale (« Défenses — 30/10/2026 »,
   « Offs 2026-10-30 », « Siège (30.10) »), sans casse ni accents. C'est le
   repli d'un fichier partagé par un ami, ou d'une recommandation importée
   avant que son fichier ne porte de source. ⚠️ Un tiret seul ne fait une date
   qu'avec l'année : « Équipe 3-2 » n'est pas daté.

Une correspondance par la source passe avant une correspondance par le nom ; à
égalité, la première de la liste. L'origine ne compte pas : une
recommandation « à moi » se complète comme une importée.

### Le choix proposé

Quand au moins une recommandation du fichier en complète une existante,
l'import **demande** avant d'écrire quoi que ce soit — un dialogue de
**choix** (comme le choix d'export du siège) : les options sont les actions,
la croix ferme sans rien importer (« Import annulé : rien n'a été ajouté »).

- **« Fusionner dans la recommandation existante »** — en premier, avec le
  focus : c'est la raison de la question. Sa description dit d'avance ce qui
  arrivera (« 3 decks nouveaux, à la fin ; 2 decks que tu as déjà gagnent
  5 défenses visées. ») et ce qui est gardé.
- **« Ajouter à part »** — le comportement d'avant : une recommandation de
  plus, à côté.
- Le sous-titre nomme chaque paire (« « Offs — 06/11/2026 » prolonge ta
  recommandation « Mes offs » ») et dit ce qui n'est PAS touché : « Dans les
  deux cas, rien de ce que tu as n'est retiré ni réécrit. »

⚠️ **Le défaut ne perd rien, quelle que soit la réponse** — c'est ce qui
permet de mettre « Fusionner » en avant. La fusion n'enlève et ne réécrit
rien ; ajouter à part ne touche à rien. Ce n'est PAS la confirmation interdite
plus haut (« OK = remplacer ») : aucune des deux options ne détruit.

Le choix vaut pour tout le fichier. Les recommandations du fichier qui ne
correspondent à rien sont ajoutées à part dans les deux cas.

### Les règles de la fusion

- **Nom, auteur, consignes de la recommandation** : ceux de l'existante, tels
  quels — l'utilisateur a pu les retoucher.
- ⚠️ **Un deck et une défense visée se reconnaissent par la même clé
  d'équipe que la vue Défense** ([modele.md](modele.md), « Vue Attaque /
  Défense ») : même **chef** — le premier monstre, s'il a un lead actif en
  siège — et mêmes deux autres monstres dans n'importe quel ordre ; sans chef,
  mêmes trois monstres dans n'importe quel ordre. Solveig-Odin-Adriana se
  reconnaît dans Solveig-Adriana-Odin ; Odin-Adriana-Solveig, au chef
  différent, est une autre équipe ; Windy-Lulu-Kinki se reconnaît dans
  Kinki-Windy-Lulu.
- **Un deck dont l'équipe existe déjà** n'est pas dupliqué. Il gagne
  seulement les **défenses visées** qu'il n'avait pas. Son ordre, ses builds,
  ses consignes, ses défenses et leurs précisions restent les siens. Une
  défense vide n'est jamais ajoutée.
- ⚠️ **Premier monstre au lead inconnu** (saisi à la main, ou absent des
  données chargées) : compté pour chef. C'est le choix sûr, qui ne fusionne
  jamais deux équipes qui pourraient différer en jeu : au pire, le même deck
  revient une fois de plus, à la fin, et se supprime à la main.
- **Un deck nouveau** est ajouté **à la fin**, tel que le fichier le donne. Un
  deck qui revient plus loin dans le même fichier y réunit ses défenses.
- Une recommandation réduite à son deck vide (celui que pose la création) :
  les decks reçus le remplacent.
- La recommandation fusionnée **garde sa place et son origine** : c'est la
  même, complétée, pas une nouvelle reçue.
- **Sa `source`** : la sienne, ou à défaut celle du fichier — la prochaine
  fusion se reconnaîtra sans dépendre du nom.

**Rapport** (message éphémère, comme un import) : « Fusion : 2 decks ajoutés,
1 deck enrichi de 3 défenses · 1 recommandation ajoutée à part. Rien n'a été
retiré ni modifié. » — ou « rien de nouveau » quand le fichier n'apporte
rien. Le rapport de validation reste affiché comme pour tout import.

### Le champ `source`

```json
{ "nom": "…", "auteur": "…", "source": "outil:identifiant-stable", "decks": [ … ] }
```

- **Facultatif**, jamais affiché ni saisi : l'identifiant stable de la
  provenance, posé par celui qui produit le fichier. Un texte de 200
  caractères au plus.
- ⚠️ **Un champ en plus, pas une version de plus** (le format reste en v5) :
  une app qui ne le connaît pas l'ignore en silence, un fichier sans lui se lit
  comme avant. Une version de plus ferait dire « réexporte-le » à chaque
  fichier v5 en circulation, pour rien.
- Pas un texte, ou trop long : **ignoré** et signalé. ⚠️ Pas tronqué : une
  source coupée ne reconnaîtrait plus rien et pourrait en confondre deux.
- **Gardée** dans le stockage et **repartie** à l'export : une recommandation
  reçue puis repartagée garde sa provenance, et se fusionne encore chez celui
  qui la reçoit.
