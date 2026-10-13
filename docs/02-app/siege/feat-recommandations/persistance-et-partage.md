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
- ⚠️ **Un import AJOUTE toujours à la suite. Il ne remplace jamais.**
  - Aucune option, aucune confirmation : l'import ne peut pas détruire de
    données, donc il n'a rien à demander.
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
