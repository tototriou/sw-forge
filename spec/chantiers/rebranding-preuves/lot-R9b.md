# Preuve — lot R9b du rebranding : Mécaniques et Nouveautés

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R9b ;
décision 47 (affichage seulement). Script du scratchpad : `r9b-captures.mjs`,
2026-09-30.

## 1. Avant de toucher

```text
node tests/run.mjs RenduMecaniques RenduNouveautes → 39 vérifications passées
```

Captures sur l'app construite, 1440 px dans les deux thèmes (écran et page
entière), téléphone tactile 390 px.

## 2. Relevé : les planches contre nos pages

| Zone | Toile | Nos pages |
|---|---|---|
| Titre (les deux pages) | surtitre (« Antisèche », « Journal de la forge »), titre en ENCRE unie | titre en DÉGRADÉ encre → braise (`title-gradient`) ; les autres écrans (Siège, RTA, Bestiaire) sont passés à l'encre unie à la refonte |
| Sommaire des Mécaniques | panneau encadré ; l'entrée de la section lue surlignée (fond, trait braise) | liste de liens sans cadre, rien de surligné |
| Contenu des Mécaniques | cartes : formule dans un encart, un paragraphe ; grilles des sets et des effets | sections longues, formules dans des encarts, listes ; ni grille de sets ni d'effets |
| Nouveautés | frise verticale, un point par version (la dernière en braise) ; version, date, titre, un paragraphe | deux colonnes : version, date et lien GitHub à gauche ; titre, points forts, puis chaque changement étiqueté (NOUVEAU / CORRECTION, section) |
| Téléphone | — (pas de planche) | inchangé |

Non proposés (décision 47) :
- l'entrée surlignée du sommaire au fil de la lecture — il faudrait suivre le
  défilement, une fonction que la page n'a pas ;
- les grilles des sets de runes et des effets courants — du contenu nouveau,
  pas de l'affichage.

La spec générale ([spec/README.md](../../README.md), « Titre de page ») décrit
encore le dégradé comme la règle : elle suit la décision sur le titre.

## 3. Déjà décidé

- **Couleurs d'état (43)** : rien — aucun rouge ni vert d'état.
- **Icônes (44)** : rien — l'étiquette de version (`Tag`) et le lien
  (`ExternalLink`) sont des symboles, pas des sections.

## 4. Décisions et validation

Titres (57) : encre unie, grand titre gardé ; sommaire (58) et Nouveautés
(59) : gardés — les trois recommandations retenues. Code montré avant commit,
deux pages à vérifier données à Thomas ; réponse : « ok ». Commit `e8e65c92`.

Piège de vérification : la première capture montrait encore le dégradé. Un
ancien `vite preview`, resté à l'écoute sur le port, servait l'ANCIEN build
(ses fichiers sont lus au démarrage). Port libéré, serveur relancé, style
calculé relu dans la page : `color: rgb(237, 227, 209)`, `background-image:
none` ; titres recapturés agrandis (`r9b-titre.mjs`), deux thèmes.

```text
npx tsc --noEmit                                  → 0
node tests/run.mjs RenduMecaniques RenduNouveautes → 39 passées
node scripts/inventaire-ui.mjs --verifier         → aucune perte
node scripts/chemins-interdits.mjs 6110609        → aucun modifié
npm run build                                     → built, `title-gradient` absent du CSS
```

## 5. Ce que je n'ai pas pu prouver

- Le téléphone à l'œil : même titre, aucune classe `compact:` ni `lg:`
  touchée.
