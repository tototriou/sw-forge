# Recommandations — partir d'une équipe d'offense

Partie de [Siège · Recommandations](README.md).

## Partir d'une équipe d'offense existante

Écrire un deck à la main est fastidieux : en édition, le bouton **« Importer un
deck d'offense »** (avec le nombre d'équipes disponibles) liste les **équipes
d'attaque de siège** du joueur ; en choisir une **ajoute un deck pré-rempli**.

Conversion — [recoFromSiege.ts](src/lib/recoFromSiege.ts), calcul pur :

| Élément | Source | Règle |
|---------|--------|-------|
| Monstres | `SiegeSlot.monsterId` → `Monster` | mêmes positions (slot 0 = leader) |
| Sets | `SiegeSlot.sets` | ce sont déjà les **sets actifs** calculés à l'import ; recopiés, bornés à 6 runes par sécurité |
| Artéfacts | `SiegeSlot.gear.artifacts` | les **propriétés réellement portées**, 4 max par sorte. Pré-remplir puis élaguer demande moins de travail que retrouver huit lignes dans une liste de 45 |
| Stats | `computeStats(SiegeSlot.gear)` | **valeurs réelles du build** posées comme minimums ; les stats à **0 sont omises** (ex. précision d'un build sans précision) |
| Nom du deck | — | **laissé vide** → prend les noms des monstres (« Trevor - Bella - Loren ») |

- C'est un **point de départ éditable** : l'auteur ajuste ou vide les stats et
  les propriétés d'artéfact qu'il ne veut pas exiger.
- Un slot dont le monstre n'a **pas de `gear`** (ajouté à la main) arrive **sans
  stats** ; un **monstre perso** (`com2usId = null`, non partageable) laisse le
  **slot vide**.
- Seules les équipes contenant **au moins un monstre partageable** sont proposées
  (`isTeamUsable`).
- **Rendu d'une ligne** : le rang (`#N`) puis les **3 monstres en icônes**
  (portrait hexagonal + badge d'élément), **sans nom** — les noms sont bruyants et
  l'icône se reconnaît plus vite. Le résumé texte (`teamSummary`) sert
  d'**infobulle**.
- **Barre de recherche par monstre** en tête de liste (filtre sur les noms des
  3 monstres) : avec ~50 attaques sauvegardées, c'est le seul moyen de retrouver
  une équipe. Message dédié si le filtre ne renvoie rien.
- Sans équipe d'offense, le bouton est **désactivé** avec l'explication (il faut
  avoir **sauvegardé ses attaques en jeu** avant d'exporter son compte, voir
  [../transverse/](../../transverse/)).
- Câblage : l'état d'**offense est passé explicitement** à `RecoBoard`
  (prop `offense` depuis [App.tsx](src/App.tsx) via
  [SiegePage.tsx](src/pages/SiegePage.tsx)) — l'onglet « Recommandations » n'a
  pas de « côté » actif, il lui faut donc l'offense en propre.
