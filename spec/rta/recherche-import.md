# RTA · Recherche, import & actions globales

La barre haute de la page RTA : ajouter des monstres, importer un compte, créer
un monstre, tout effacer.

Fichiers : [RtaPage.tsx](src/pages/RtaPage.tsx) ·
[RtaSearch.tsx](src/components/rta/RtaSearch.tsx) ·
[CreateMonster.tsx](src/components/CreateMonster.tsx)

## Recherche d'ajout — `RtaSearch`

- Champ « Rechercher un monstre à ajouter à ta prépa RTA… ».
- Filtre par nom (`includes`, insensible à la casse), **max 25 résultats**.
- Dropdown de suggestions : **portrait du monstre**
  ([MonsterAvatar](src/components/MonsterAvatar.tsx), 30 px, pastille d'élément
  incluse), nom, étoiles, SPD de base, état (déjà ajouté = ✓ grisé, sinon +).
- Clic sur une suggestion (`onMouseDown` pour devancer le blur) = ajoute.
- Ajout → le monstre entre en **« Non classé »** (`addMonster`), une seule carte
  par monstre.

### Navigation au clavier

Assurée par [useComboboxNav](src/hooks/useComboboxNav.ts), **partagé avec toutes
les barres de recherche à suggestions**. Voir
[shared/recherche-clavier.md](../shared/recherche-clavier.md) pour les règles.

Spécificité RTA : un monstre déjà en prépa reste **affiché** (l'information est
utile) mais n'est pas sélectionnable — la sélection l'évite, et Entrée dessus
avance au suivant disponible.

## Barre d'actions

- **Compteur** : « N monstre(s) en prépa ».
- **Créer un monstre** : composant `CreateMonster` (voir ci-dessous). Le monstre
  créé est **ajouté directement en « Non classé »** (`handleCreateMonster`).
- **Tout effacer** (si ≥ 1 monstre) : modale de confirmation → `clearAll()` (réinitialise
  sections + entrées).

> L'**import de compte n'est plus sur la page RTA** : il est global (barre de
> nav) et remplit RTA + siège d'un coup. L'état RTA (`rta`) est remonté dans
> [App.tsx](src/App.tsx) et passé en prop. Voir
> [../shared/import-compte.md](../shared/import-compte.md).

## Messages

- Message d'import : vert si succès, rouge si erreur.
- « Chargement des monstres… » tant que les données ne sont pas là.
- Rappel « données 100 % locales » + bouton de suppression : dans le footer
  global (voir [../README.md](../README.md)), pas sur la page.

## Création de monstre — `CreateMonster`

Popup partagée RTA/Siège. Détail complet dans
[../shared/donnees-monstres.md](../shared/donnees-monstres.md).

- Champs : **nom**, **élément**, **SPD base** (requis) ; **lead** optionnel (type
  de stat + montant % + portée Toutes cibles / Même élément).
- Validation : nom non vide + SPD > 0.
- Ferme au clic extérieur / `Échap`.
- Liste des monstres perso existants avec suppression.

## Attendus

- Un monstre déjà en prépa ne peut pas être réajouté (idempotent).
- L'import ne duplique pas : dédup par monstre, meilleur build conservé, choix
  confirmation unique (modale de la page) si une prépa existe déjà ; l'import remplace.
- Réimporter le même fichier est possible (l'input est reset après lecture).
