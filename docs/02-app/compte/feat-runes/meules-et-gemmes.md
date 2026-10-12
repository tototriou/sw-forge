# Runes — onglets Meules et Gemmes

Partie de [Mon compte — Runes](README.md).

## Onglets Meules & Gemmes — **en construction**

⚠️ **Ces onglets ne refont pas l'Optimisation.** « Quelles runes puis-je
améliorer avec ce que j'ai » est un **filtre**, pas une vue : il vit dans
l'Optimisation (bouton « Faisable avec ma réserve », voir plus haut). L'en
extraire obligerait à y réimplémenter potentiel héroïque, potentiel légendaire
et les deux gains — tout ce qui fait l'intérêt de la liste.

Ils porteront la question **inverse**, que rien ne couvre aujourd'hui :

- ce qui **manque** en meules / en gemmes pour un **top paramétrable** (10, 50,
  100…) classé par potentiel ou par gain ;
- et donc **où aller le chercher** : quelle faille élémentaire, quel raid.

⚠️ Le second point demande une table **set de rune → donjon qui le fait tomber**,
qui **n'est pas dans l'export** et qui ne doit pas être devinée : envoyer
quelqu'un farmer le mauvais donjon est une erreur silencieuse et coûteuse. La
source reste à choisir avant d'implémenter.

Placeholder : [ComingSoon.tsx](src/pages/ComingSoon.tsx), le même que les pages
d'outils à venir.

> La lecture de la réserve, elle, est **déjà en place** : `parseCrafts`,
> `CraftLine`, la persistance (`ACCOUNT_SCHEMA` 3) et
> [crafts.ts](src/lib/crafts.ts) servent déjà le filtre de l'Optimisation.
