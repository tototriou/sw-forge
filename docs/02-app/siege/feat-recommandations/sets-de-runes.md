# Recommandations — sets de runes recommandés

Partie de [Siège · Recommandations](README.md).

## Sets de runes recommandés

Un monstre porte **6 runes** ; un set 4 pièces en coûte 4, tous les autres 2
(voir `setPieces` / `FOUR_PIECE_SETS` dans [effects.ts](src/lib/effects.ts)).
D'où les **combinaisons possibles**, toutes gérées :

| Combinaison | Coût | Exemple |
|-------------|------|---------|
| 4 + 2 | 6 | Violent + Will |
| 2 + 2 + 2 | 6 | Will + Focus + Endure |
| 4 seul | 4 | Violent |
| 2 + 2 | 4 | Will + Focus |
| 2 seul | 2 | Will |
| aucun | 0 | — |

- **Un seul set 4 pièces** possible (4 + 4 = 8 > 6) : `canAddSet` l'interdit.
- **Répétitions autorisées** : un set 2 pièces peut être demandé **plusieurs
  fois** (ex. **3× Fight** = 6 runes Fight, bonus cumulé) — d'où une **liste**
  et non un ensemble, et un **retrait par position** (pas par clé).
#### Plusieurs runages au choix — **une seule possibilité suffit**

Un monstre se joue rarement d'une seule façon : « **Violent/Némésis OU
Violent/Vengeance** ». `RecoSlot.setOptions` est donc une **liste de
combinaisons**, jamais une seule.

- Il y a **toujours au moins une possibilité** (éventuellement vide = « aucun
  set exigé ») ; supprimer la dernière la vide au lieu de la retirer.
- ⚠️ **La confrontation est satisfaite dès qu'UNE SEULE possibilité l'est.**
- L'analyse retient la **meilleure** possibilité (le moins de sets manquants) et
  ne marque ✓/✗ **qu'elle** (`SlotMatch.matchedOption`) : annoncer « il te manque
  X » sur un runage que le joueur n'a pas choisi n'aiderait pas.
- Les doublons sont écartés à la lecture : deux fois la même combinaison
  n'apporte rien et brouillerait l'affichage « A ou B ».
- En édition, chaque possibilité est un bloc avec ses chips, son compteur
  `N/6 runes` et son bouton **« + Set »** ; **« + Possibilité »** en ajoute une,
  et les blocs sont séparés par un **« ou »**.

#### Choix d'un set — **par icônes, pas par menu déroulant**

Un bouton **« + Set »** ouvre une **grille des symboles de sets du jeu** ; un
clic ajoute la chip correspondante. On reconnaît un set à son symbole, pas à son
nom dans une liste — même règle que les filtres de runes (voir
[../compte/](../../compte/)).

- Le panneau **reste ouvert** pour enchaîner les ajouts (2 + 2 + 2 se pose en
  trois clics sans rouvrir).
- **Tous** les sets sont affichés ; ceux qui **ne tiennent plus** dans les
  6 runes sont **grisés et non cliquables** plutôt que retirés — on voit ce qui
  existe et pourquoi c'est refusé.
- ⚠️ **Sauf l'Intangible**, absent de la grille. C'est un **joker à une pièce**
  qui complète n'importe quel set : on recommande « Violent + Will », jamais
  « Intangible », et le proposer reviendrait à réclamer un set de 2 pièces qui
  n'existe pas. Même règle que le picker jumeau de l'Optimizer
  ([../optimizer/](../../optimizer/), « Set de runes recherché »). Une reco
  enregistrée qui en contiendrait un reste affichée et retirable.
- Compteur `N/6 runes` en permanence ; à saturation le bouton devient
  « Plus de place (6 runes) » et **le panneau se referme tout seul**, sinon on
  laisserait une grille entièrement grisée à l'écran.
- Helpers purs : `setsCost`, `canAddSet`, `missingSets`
  ([recoMatch.ts](src/lib/recoMatch.ts)). La contrainte est **rejouée au
  chargement** du `localStorage` (données potentiellement bricolées à la main).

### Activation côté joueur — logique partagée

`activeSets(keys)` dans [effects.ts](src/lib/effects.ts) calcule les sets
**réellement actifs** d'un build : set 4 pièces à 4 runes, les autres à 2, un set
2 pièces pouvant être actif **plusieurs fois** (6 runes Fight → `['fight',
'fight','fight']`), et une rune **Intangible** servant de **joker** —
⚠️ **uniquement s'il y a EXACTEMENT un set incomplet** parmi les runes
réellement portées (règle du jeu, voir
[compte/feat-calcul-runes.md § 5.2](../../compte/feat-calcul-runes.md#52-bonus-de-set--à-ne-pas-oublier)) : deux sets
incomplets ou plus, même si l'un des deux n'est pas celui recherché, et le
joker ne complète plus rien.

> Cette fonction vit dans `effects.ts` ; l'import de compte la réutilise après
> conversion `set_id → clé`. **Une seule règle d'activation** pour l'import de
> compte et pour les recommandations.

La confrontation compare en **multi-ensemble** : demander 2× Fight exige bien
deux fois le set actif.
