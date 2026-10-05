# Preuve — lot 4 de la refonte graphique : barre latérale bureau

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.4.
Décisions appliquées (A.2 bis) : 3 (menu sans couleurs de section), 5
(regroupement), 6 ([retrait #6] : Meules et Gemmes hors du menu).

## Tests écrits AVANT (commit `a68260a`)

`tests/rendu/app.test.tsx` rend l'application ENTIÈRE (`App`) sur ses 23
routes : chaque route s'affiche avec son titre ; le menu bureau atteint
toutes les destinations par un lien (en cumulant ce qu'il montre sur chaque
route) ; chaque section reste nommée au premier niveau ; recherche, import,
Paramètres, repli présents ; onglets mobiles inchangés. **Aucune assertion
modifiée depuis** ; une ajoutée pour fixer le retrait décidé (Meules et
Gemmes absentes du menu bureau).

## Ce qui change

- `App.tsx` : la barre latérale reçoit une structure PROPRE au bureau
  (`groupesBureau`, `sectionOuverteBureau`, sections RTA / Siège / Runes /
  Artéfacts), construite à partir des mêmes constantes que l'existant.
  Premier niveau : Accueil · Jouer (RTA, Siège, Arène) · Mon compte
  (Monstres, Runes, Artéfacts) · Outils (Optimizer, Speed tuning) ·
  Ressources. Icônes monochromes.
- Non touchés : `Sidebar.tsx` (mécanique des niveaux, survol, repli), les
  sections partagées avec le téléphone (`sectionCompte`, `sectionOutils`…),
  les onglets mobiles, le panneau mobile, la barre du haut, la recherche.
- Inventaire : une entrée change de nature — `prop:label:Mon compte`
  (entrée cliquable) devient `prop:titre:Mon compte` (titre de groupe).
  Déclarée dans `deplacements.json` avec le nouveau champ `devient`
  (comparaison et test étendus : accepté si retrouvé, refusé sinon).

## Vérifications

```text
$ npx tsc --noEmit                            → code 0
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node tests/run.mjs rendu navigation refonte → 177 vérifications passées
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built
```

## Second passage — le menu comme la maquette (décision 11)

Demandé par Thomas après le premier passage : « je veux que tu fasses le menu
comme dans la maquette ». Relevé sur la maquette (`sidebar.txt`, `navjs.txt`,
`css.txt` de la toile) puis appliqué :

- repli en tête à côté du logo (BoutonIcone), largeur 248 px ;
- carte du compte en tête : initiale, nom, « Export du … · N monstres »,
  toute la carte importe (double chevron) ;
- recherche : fond de panneau, indication `Ctrl K` ;
- groupes annoncés par leur intitulé en capitales ;
- **sous-sections déroulées sous leur entrée** (filet vertical, retrait
  36 px), au lieu d'un second niveau qui remplaçait la liste ; le clic
  déroule sans naviguer, comme avant ; l'aperçu au survol reste, pour les
  sections refermées ;
- entrée active : voile d'encre (`bg-ink/10`), survol `bg-ink/5` ;
- badge « Bientôt » sur Arène (sa page l'annonce déjà) ;
- Paramètres en pied, au gabarit des entrées, bascule inchangée.

Écart voulu à la maquette : les sous-sections gardent leur **icône**
(demandé par Thomas après essai, vérifié par le test de rendu).

Non repris : le point « nouveau » sur Nouveautés (suivi du « lu » = un ajout,
à décider). Logo : celui de l'app (`favicon.svg`), pas le losange de la
maquette, qui en tenait lieu.

Inventaire : le repli perd son texte visible (« Replier »/« Déplier ») et
passe en `libelle` de BoutonIcone (aria-label + title) — déplacements
`devient` ; le retour « ‹ Section — revenir à toutes les sections »
disparaît avec le second niveau — **[retrait #11]** (A.2 bis) ; l'infobulle
courte de l'import replié devient la longue, désormais unique.

Tests : `tests/rendu/app.test.tsx` — **aucune assertion modifiée** ; l'outil
`barreLaterale` découpe désormais l'`<aside>` (il coupait au bouton de
repli, remonté en tête) ; ajout de 14 vérifications : dans le Siège, ses
trois sous-sections ET toutes les autres sections sont à l'écran, « Siège »
porte `aria-expanded="true"`, RTA reste refermée, Arène porte « Bientôt ».
`tests/navigation.test.ts` : ses deux contrôles de SOURCE suivent le
mécanisme (`cleRouteBarre(sectionRoute, groupes)`, le panneau vide
`bascules`) — même invariant, nouveaux noms.

```text
$ npx tsc --noEmit                            → code 0
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node tests/run.mjs rendu navigation refonte → 191 vérifications passées
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; bg-ink/10,
  hoverable:bg-ink/5, left-[18px], transition-[width] présentes dans le CSS
```

## Ajustements après essai (2026-09-24), validés le 2026-09-25

Chaque demande de Thomas, un commit :

| Demande | Commit | Effet |
|---|---|---|
| « remets les icons sur les sous-sections » | `f285763` | icônes des sous-sections (écart voulu à la maquette) |
| « un peu de couleur… » | `23fbf0b` | teintes de section sur les icônes — **écarté** ensuite |
| précision : couleur principale | `8bb94cd` | icônes neutres ; trait d'accent devant l'entrée courante — **retiré** ensuite (malentendu) |
| « les sections séparées de manière plus visible » | `4a492bc` | filet entre les groupes, intitulé en accent |
| « supprime le popup à droite du menu » | `a09f2d4` | aperçu au survol retiré — [retrait #12] |
| « la recherche n'a pas le rendu du menu » | `4359b9b` | résultats au gabarit exact d'une entrée |
| « lignes des sous-sections et zone de sélection » | `608c91c` | un filet continu à gauche du bloc |
| « le titre de la page pas raccord avec le menu » | `79066a8` | fil d'Ariane bureau tiré du menu (`testRenduAppFil`) |

Dernier état vérifié : `tsc` 0 ; `node tests/run.mjs rendu refonte
navigation` → 204 vérifications passées ; inventaire sans perte ; chemins
interdits vides ; spec-lint propre ; build OK.

**Validé par Thomas le 2026-09-25, sur bureau** (« ok c'est good »). Le
téléphone n'a pas été regardé — il n'a pas changé au lot 4 (onglets et
panneau mobiles inchangés, titre centré gardé en `lg:hidden`), et il a son
propre lot (11), où cette vérification reste à faire.

## À regarder sur le serveur de dev (non testable)

- Le panneau de survol à côté de la barre (RTA, Siège, Runes, Artéfacts
  refermés) : il n'est pas rendu sans survol, aucun test ne le voit.
- Dérouler / refermer une section au clic (l'état vit dans un effet de
  rendu client, hors d'un rendu serveur).
- Barre repliée : avatar, icônes, sous-sections en icônes sous leur entrée.
