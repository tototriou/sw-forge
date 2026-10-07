# Preuve — lot 10 de la refonte graphique : Ressources, Paramètres, Bientôt

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à
B.10. Décision appliquée (A.2 bis) : **23** — ajouts de la maquette au lot
13 ; repris sans nouvelle question et annoncé : filtres du bestiaire
visibles (décision 20), barre au gabarit de « Ma box » (lot 8b), libellés de
l'app gardés.

## Tests écrits AVANT (commit `96b74e97`)

`tests/rendu/ressources.test.tsx`, rendu bureau, 81 vérifications. Aucun
chiffre qui bouge avec les données : nombre de monstres et versions sont
déduits de `monsters.json` et de `data/releases.ts`.

- **Bestiaire** : recherche, filtres élément et étoiles, trois tris, compte
  et pagination (haut et bas, saisie directe), groupes par élément, fiche au
  clic, cartes de collaboration.
- **Mécaniques** : titre et réserve, sommaire cliquable, formules, ce qui
  n'est pas modélisé.
- **Nouveautés** : lien GitHub, chaque version (numéro, titre, statut), un
  lien par version taguée, nature des changements.
- **Paramètres** : compte chargé ou non, import, thème, score, les trois
  interrupteurs, chaque explication, « Tout supprimer ».
- **Bientôt** : le message d'attente.

## Le lot

| Commit | Quoi |
|---|---|
| `6f90edd5` | décision 23 écrite dans le cadrage, avant le code |
| `cf112094` | Bestiaire : en-tête ; recherche, filtres, tri + compte + pagination (barre de « Ma box ») ; filtres sur `Pastille` et `Selecteur` (aux deux formats) |
| `97793799` | Mécaniques : sommaire fixe à gauche, article à droite, sections à filet |
| `c99c99c0` | Nouveautés : une version par rangée à deux colonnes, filets au lieu de cartes |
| `9c7da0ce` | Paramètres : titre, « Réglages » et « Mes données » en deux blocs ; « Importer un JSON » et « Tout supprimer » sur `Bouton` (aux deux formats) ; « Tout supprimer » déclaré (texte → libellé) |

« Bientôt disponible » ne change pas : la maquette est déjà l'écran, hormis
« Voir les nouveautés », reporté au lot 13.

Rien n'est retiré. **Deux assertions d'avant le lot sont assouplies**,
signalées au mainteneur : les filtres du bestiaire et l'introduction des
Paramètres étaient attendus EN TÊTE du texte ; le titre de page les précède
désormais. Leur suite est vérifiée à l'identique (« contient »).

Relevés en passant, hors refonte (contenu), reportés par le mainteneur (« on le
fera plus tard ») et écrits dans `spec/mecaniques.md` : la formule de
défense affichée (`1140 + 3.5` au lieu de `1142 + 3.572`) et « 7 % par
tick » sans la réserve raid / RTA.

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu                    → 659 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; classes lg: émises
```

**Lot 10 clos le 2026-09-28** sur « continue » du mainteneur, sans retour
visuel propre à ces pages. Téléphone non regardé (lot 11).
