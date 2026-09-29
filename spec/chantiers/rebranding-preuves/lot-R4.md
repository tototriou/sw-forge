# Preuve — lot R4 du rebranding : la coquille

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R4 ;
décisions 9, 27 à 30. Scripts du scratchpad : `r4-icones.mjs`,
`r4-icones-v2.mjs`, `r4-icones-v3.mjs`, `r4-verif.mjs`, `r4-pied-tel.mjs`,
2026-09-29.

## 1. Les icônes (décisions 9 et 27)

La toile dessine neuf icônes de navigation et huit notions (grille 24,
trait 2). Croisées avec notre nav : douze entrées prennent une icône de la
toile telle quelle ; sept n'en avaient pas.

Trois planches montrées à Thomas avant la pose :
1. [lot-R4-icones.png](lot-R4-icones.png) — première proposition pour les
   sept. Deux jets refaits avant de la montrer (une griffure qui lisait comme
   des ondes, une longue-vue qui lisait comme un fusil). Réponse : les sept à
   retoucher.
2. [lot-R4-icones-v2.png](lot-R4-icones-v2.png) — deux pistes par icône.
   Retenues : coupe, tenailles, compas, œuf, compagnons ; « Autre » pour Speed
   tuning et Artéfacts.
3. [lot-R4-icones-v3.png](lot-R4-icones-v3.png) — quatre pistes pour ces deux.
   Retenues : chronomètre, médaillon (l'icône actuelle).

Posées dans `src/components/IconesAtelier.tsx`, au contrat de lucide (`size`,
`color`, `className`) : barre latérale, onglets du téléphone, panneau de
navigation, fil d'Ariane, page Arène (`ComingSoon`), pied de page (version).
Les ACTIONS gardent lucide (la toile : « des symboles standards pour les
actions »).

⚠️ **Écart rattrapé en cours de lot** : j'avais d'abord modifié
`InventaireIcon.tsx` (œuf, pierre runique). `chemins-interdits` l'a refusé —
la refonte l'a rangé parmi les rendus du jeu à l'identique. Changements
annulés (`git checkout` du seul fichier, qui ne portait que les miens) ; la
nav a ses propres icônes des trois inventaires, les écrans du compte gardent
les silhouettes du jeu.

## 2. Paramètres, entrée active, pied de page (décisions 28 à 30)

- **Paramètres** : les curseurs « Réglages » de la toile, dans la barre
  latérale (`SidebarCompte`), la barre du haut et `SettingsMenu`. L'engrenage
  pivotait d'un huitième de tour à l'ouverture ; retiré — l'état ouvert se lit
  au fond et au libellé (« Fermer les paramètres »), inchangés.
- **Entrée active** (`Sidebar.tsx`, `FOND_ACTIF`) : `bg-accent-soft
  text-accent`. Le bouton Paramètres ouvert suit.
- **Pied de page** (`App.tsx`) : le logo (symbole + nom en Saira) en tête, et
  « Projet non officiel, sans affiliation avec Com2uS. » en dernière ligne. La
  ligne « Données et images © Com2uS · Source : swarfarm.com » est gardée.

## 3. Vérifications

```text
npx tsc --noEmit                                                  → 0
node tests/run.mjs rendu ui refonte navigation palette marque     → 881 vérifications passées
node scripts/inventaire-ui.mjs --verifier                         → aucune perte
node scripts/chemins-interdits.mjs 6110609                        → aucun modifié
npm run build                                                     → built
```

Sur l'app construite (`vite preview`) :

```text
dark bureau : entrée active Bestiaire — rgb(58, 36, 21) / rgb(255, 122, 26)
light bureau : entrée active Bestiaire — rgb(255, 237, 221) / rgb(166, 79, 17)
#/siege/defense : dernière ligne 692-728 px ; recouverte par : rien
#/bestiary : dernière ligne 692-728 px ; recouverte par : rien
#/ : dernière ligne 692-728 px ; recouverte par : rien
```

(La dernière ligne du pied de page, au téléphone, défilé jusqu'en bas : ni la
barre d'onglets ni le bouton « Options » ne la recouvrent. En cours de
défilement, le bouton flottant passe par-dessus, comme tout contenu.)

## 4. Retour de Thomas — « le pied de page commence à être vraiment gros »

Il empilait cinq lignes centrées en police à chasse fixe (logo, liens,
trois mentions). Question posée, réponse : « une rangée, comme la toile ».
- Bureau : grille `auto / 1fr / auto` — logo, mentions sur deux lignes au
  centre, liens à droite. **61 px de haut.**
- Téléphone : d'abord logo et liens côte à côte — les liens s'empilaient en
  trois lignes (153 px) ; repris en colonne centrée, liens sur UNE ligne en
  libellés courts (« GitHub », « Discord », ceux de la toile) : **145 px**.
  Les libellés longs restent au bureau, l'infobulle garde la phrase entière.
- Police du texte au lieu de la mono ; filet `border-soft` au-dessus.
- Mêmes phrases, mêmes liens : inventaire sans perte.
- Puis, Thomas : « met sur une colonne le github la version et le
  discord » — au bureau, les trois liens en colonne, alignés à droite
  (`lg:flex-col lg:items-end`) : **79 px**. Téléphone inchangé (145 px),
  la demande visant la rangée du bureau.

Vérifié : `tsc` ; `node tests/run.mjs rendu refonte` → 829 ; inventaire ;
build ; app construite à 1440, 390 et 360 px, sans débordement.

## 5. Ce que je n'ai pas pu prouver

- La **lisibilité des icônes** au-delà des planches : 17 px dans la barre
  latérale, avec la couleur de section au téléphone.
- Les icônes posées **dans les écrans** (état vide, en-têtes) restent lucide :
  elles vont aux lots R5 à R9.
