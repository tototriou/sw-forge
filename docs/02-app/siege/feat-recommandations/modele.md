# Recommandations — modèle, origine et vue

Partie de [Siège · Recommandations](README.md).

## Modèle

```ts
type RecoStatKey = 'hp'|'atk'|'def'|'spd'|'cr'|'cd'|'res'|'acc';

interface RecoSlot {
  com2usId: number | null;                    // null = slot vide
  name: string;                               // repli d'affichage
  stats: Partial<Record<RecoStatKey, number>>;// minimums (absent = non exigé)
  setOptions: string[][];                     // POSSIBILITÉS de runage, une seule suffit
  artifacts: Record<'element'|'archetype', number[]>; // propriétés d'artéfact exigées, 4 max chacune
}
interface RecoCounter {                        // une défense adverse que le deck bat
  monsters: { com2usId: number|null; name: string }[]; // toujours 3
  note: string;                                // « si le Chloe est en lead »
}
interface RecoDeck { name: string; note: string; slots: RecoSlot[]; counters: RecoCounter[] } // 3 slots, index 0 = leader
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
- Chaque deck se nomme par **les noms de ses monstres, séparés par un tiret**
  (« Trevor - Bella - Loren ») ; « Deck N » tant qu'aucun monstre n'est choisi.
  **Pas de titre libre à saisir** — `deckLabel` (dans
  [RecoCard.tsx](src/components/siege/RecoCard.tsx)) calcule toujours ce nom,
  **dérivé à l'affichage, jamais stocké** : il suit les changements de
  monstres, et se recalcule chez celui qui importe (mêmes `com2usId` → mêmes
  noms).
  - Si un monstre est absent des données chargées, on retombe sur le nom stocké
    dans le slot au moment du partage.
  - ⚠️ **Ce nom calculé sert de TEXTE** dans l'aperçu replié de la
    recommandation et la ligne « aller au deck » de l'encart de synthèse — pas
    dans l'en-tête du deck lui-même (voir plus bas, « Repli deck par deck ») :
    aux deux formats, l'en-tête montre les **portraits des monstres**, jamais
    de texte.
  - ⚠️ **`RecoDeck.name` existe dans le type et le stockage, pour la
    RÉTROCOMPATIBILITÉ d'un import** : une recommandation reçue d'une app qui
    n'est pas à jour peut porter un titre dans ce champ. Il n'est **jamais
    rejeté** par le validateur d'import ([recoShare.ts](src/lib/recoShare.ts)),
    simplement **ni lu ni affiché** : `deckLabel` ne le consulte pas. Un titre
    libre peut dater une fois le deck modifié, redoubler ce que les portraits
    montrent déjà, ou rester vide et donc identique au nom automatique — trois
    façons de ne rien apporter.
- Les **decks totalement vides** ne sont ni exportés ni comptés dans les statuts.

## Origine

Chaque recommandation porte une **origine** :

| Origine | Attribuée quand | Rendu |
|---------|-----------------|-------|
| `mine` | créée via « Créer une recommandation » | — |
| `imported` | reçue via un import | puce **« Importée »** (icône ↓) dans l'en-tête |

⚠️ L'origine est **purement locale** : elle **n'est jamais transportée** dans un
export (d'où `RecoPayload`, qui exclut `id` **et** `origin`). Ce qui est « à moi »
chez l'auteur devient « importée » chez celui qui la reçoit — y compris si je
réimporte mon propre export.

⚠️ **Pas de filtre par origine.** L'origine reste une donnée de la carte : la
puce « Importée » dit ce qu'on a reçu.

## Vue Attaque / Défense

Les mêmes recommandations, lues dans les deux sens :

| Vue | Une ligne par… | Puis | Rôle |
|-----|----------------|------|------|
| **Attaque** (défaut) | deck (offense) | les défenses contre lesquelles il est fort (« Fort contre ») | **c'est là qu'on modifie** |
| **Défense** | défense visée | les offenses de la recommandation fortes contre elle | **lecture seule** |

⚠️ **La vue ne touche pas au format exporté.** La vue Défense est **calculée**
à partir des `counters` de chaque deck
([recoDefenses.ts](../../../../src/lib/recoDefenses.ts), calcul pur, testé :
`reco-defenses`) — rien n'est stocké en plus, un fichier de n'importe quelle
version s'affiche dans les deux vues sans conversion.

Règles de la vue Défense :
- **Dans chaque recommandation** : la carte garde son en-tête (titre, auteur,
  analyse, export) ; à l'intérieur, une ligne par défense visée, avec les
  decks de CETTE recommandation qui la battent. Rien ne se mélange entre
  recommandations de joueurs différents.
- **Même défense = même leader et mêmes deux autres monstres**, dans
  n'importe quel ordre : un leader différent change la défense en jeu (son
  lead). Un monstre saisi à la main se reconnaît à son nom, sans casse.
  Défense entièrement vide : ignorée. Les monstres affichés sont ceux de sa
  première saisie ; les lignes suivent l'ordre de première apparition (celui
  de la vue Attaque).
- **Lecture seule** : on consulte « contre cette défense, j'ai ces
  offenses ». Dès qu'on édite — la recommandation ou l'un de ses decks —, la
  carte reprend la vue Attaque, où sont les formulaires : changer de vue ne
  fait jamais disparaître une édition en cours.

Affichage :
- **Repliée** : une puce par défense (« Galleon - Belladeon · 2 » — le nombre
  d'offenses), dont le point prend le **meilleur** verdict de ses offenses
  après analyse — une seule jouable suffit à la taper — ; puis « N deck(s)
  sans défense visée ».
- **Dépliée** : même cadre et même rangée d'intitulés que le tableau des decks
  (« Défense » · « Offenses fortes contre elle »). Chaque offense : le point
  de son verdict, ses trois portraits (le leader porte son lead), son nom, et
  la **précision** que CE deck donne sur la défense (« — si Galleon est en
  lead »). Un deck qui vise deux fois la même défense n'y figure qu'une fois.
- **Les decks sans défense visée** ne disparaissent pas : ils sont listés à la
  fin, sous « Aucune défense visée ».
- **Recherche** : une offense reste si son deck JOUE le monstre cherché, ou si
  CETTE défense le contient ; une défense sans offense restante disparaît.
- L'encart d'analyse reste ; ses lignes (« Voir le deck… ») sont
  **désactivées** en vue Défense, où les decks ne sont pas affichés —
  infobulle « Passe en vue Attaque pour ouvrir ce deck ».

La vue est **mémorisée** (`useStickyState`, clé `recos.vue`).
