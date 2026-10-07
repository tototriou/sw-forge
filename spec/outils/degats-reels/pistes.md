# Dégâts réels — pistes futures

**Statut :** ÉTAT ACTUEL — liste les pistes futures du calcul des dégâts réels, chacune avec son constat, l'idée et ce qui la bloque
**Lire si :** on envisage une mécanique de dégâts de plus, un réglage de la modale « Dégâts réels » ou un relevé en jeu, avant de les proposer comme nouveaux
**Ne pas lire si :** on cherche ce que le calcul fait aujourd'hui : la spec du mécanisme le dit (l'index [../degats-reels.md](../degats-reels.md) dit laquelle)
**Voir aussi :** ../degats-reels.md, valeurs-de-jeu-curees.md, formules-et-combat.md, ../optimizer/pistes.md

Une piste est ce qui n'est pas fait : le **constat** (ce que le code fait,
avec sa coordonnée), l'**idée** (la forme du réglage quand elle est déjà
choisie) et ce qui la **bloque**. Les valeurs de jeu fournies sont dans
[valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md). Un relevé en jeu est
un rapport entre deux lancers qui ne diffèrent que d'une chose, avec sa
règle de décision posée d'avance (skill `game-data-curation`, § 6 bis), et
ne vaut que pour le sort mesuré. Un sort dont une part décidée n'est pas
codée porte « Calcul partiel »
([formules-et-combat.md § Calcul partiel — l'étiquette par identifiant](formules-et-combat.md)).

## Vitesse

### Gold Headband : arrondi de la VIT par cumul

- **Constat** : chaque cumul ajoute 12 % de la VIT de base, sans arrondi
  dans les dégâts (`statsDeCombat`, `src/lib/damage.ts` : +13,92 par cumul
  pour la base 116 de Mei Hou Wang), arrondi au supérieur par cumul dans
  le Speed tune (`pointsDeGain`, `src/lib/speedTunePassif.ts` : +14). Pour
  une base de 100, les deux lectures donnent +12 et +120
  ([conditions-et-audit.md § Audit des dégâts conditionnels — partie 2](conditions-et-audit.md)).
- **Idée** : une seule lecture, la même pour les deux outils.
- **Bloque** : un relevé en jeu de la VIT affichée par Mei Hou Wang sans
  cumul puis à dix cumuls. Règle de décision posée d'avance : un écart de
  +139 exclut l'arrondi supérieur par cumul ; un écart de +140 ne le
  distingue pas d'un simple arrondi de l'affichage (139,2 → 140).

## Attaques déclenchées et hors tour

### Attaques conjointes : lignes d'artéfact 209 et 225

- **Constat** : les lignes 209 (« Dégâts d'attaque conjointe ») et 225
  (« Dégâts contre/attaque conjointe ») existent
  (`src/lib/artifacts.ts`), mais le calcul des dégâts n'en lit aucune ; la
  ligne 224 (« Dmg crit mono-cible à ton tour ») est lue, selon la portée
  du sort (`damage.ts`).
- **Idée** : laisser choisir une attaque conjointe pour compter 209 et
  225, avec le rôle du monstre dans le tour pour 224.
- **Bloque** : périmètre et cas sans formule à qualifier : un chantier à
  cadrer.

## Ajouter une piste

1. Vérifier que l'idée n'est ni faite dans le code, ni écartée dans la spec
   du mécanisme, ni fournie dans [valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md).
2. L'ajouter dans la section de son domaine : un titre, puis **Constat**
   (avec sa coordonnée), **Idée** et **Bloque** ; un relevé y porte son
   montage et sa règle de décision.
3. Une piste réalisée sort d'ici dans le commit qui la réalise, avec son
   entrée de `CALCUL_PARTIEL_PAR_ID` s'il y en a une. Une piste essayée puis
   écartée laisse dans la spec du mécanisme une ligne « ne pas… parce
   que… ».
