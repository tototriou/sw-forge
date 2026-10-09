# Optimiseur d'artéfacts — éligibilité, lignes et moteur

**Statut :** ÉTAT ACTUEL — décrit l'optimiseur d'artéfacts tel que le code l'exécute : éligibilité, effet de chaque ligne pour le moteur, focus élémentaire, moteur `artifactOptim.ts`, script CLI et ses deux usages
**Lire si :** on modifie artifactOptim.ts, l'éligibilité d'un artéfact, la prise en compte d'une ligne d'artéfact par le choix de la paire, ou scripts/artifact-search.ts
**Voir aussi :** moteur-artefacts.md, ../../02-app/optimizer/ (feat-ecran-artefacts.md, feat-ecran-meilleurs-artefacts-offensifs.md, feat-ecran-sous-proprietes-verrouillees.md), invariants.md, ../../02-app/degats-reels/ (feat-artefacts-et-degats-bruts.md, feat-artefacts-critique-et-element.md)

Code : `src/lib/artifactOptim.ts` (le moteur), `src/lib/artifacts.ts`
(éligibilité, plafonds des lignes), `src/lib/artifactFiche.ts` (paramètres
et évaluateurs construits pour l'écran et le CLI de l'Optimizer),
`scripts/artifact-search.ts` (script CLI). Ce fichier dit comment la
meilleure paire d'artéfacts est choisie pour un build donné. Quand ce choix
a lieu pendant une recherche de runes, et pourquoi la paire n'est pas figée
avant elle :
[moteur-artefacts.md § Le choix des artéfacts — un second problème, séparé](moteur-artefacts.md).
Ce que chaque ligne fait au calcul des dégâts lui-même : les fichiers de
`../../degats-reels/` cités dans la section des lignes.

## Le build est fixe, les artéfacts se posent ensuite

- Le moteur ne cherche jamais runes et artéfacts ensemble : il reçoit un
  build figé et choisit la paire pour ce build. Un artéfact **amplifie** un
  build, il n'en déplace pas la cible : une ligne « Dgts supp. en prop. de
  DEF » récolte la DEF que le build possède déjà, elle ne justifie pas d'aller
  en chercher. Un monstre qui vise ATQ et Dgts CRIT sur son sort les vise
  avec ou sans cette ligne.
- D'où une règle de la recherche de runes : les lignes 218–221 n'entrent pas
  dans `damageRelevantStats`, qui oriente la rétention. Les y mettre ferait
  chercher de la DEF à un monstre qui n'en a que faire. ⚠️ La dominance des
  runes, élagage sûr, protège en revanche les stats qu'elles lisent :
  [moteur-elagages.md § Dominance — lignes d'artéfact 218–221](moteur-elagages.md).
- Le cas où l'optimiseur sert le plus est un monstre dont l'objectif premier
  n'est **pas** les dégâts (tank, support) : son build est déjà figé par un
  autre objectif, et les lignes 218–221 convertissent ses PV, sa DEF ou sa
  VIT en dégâts. Poser les artéfacts après les runes y est le modèle exact,
  pas un compromis — d'où le bloc « Meilleurs artéfacts offensifs pour ce
  build », valable pour tous les objectifs
  ([moteur-optimiseur-artefacts.md § Deux usages : un build donné, ou les builds d'une recherche](moteur-optimiseur-artefacts.md)).
- Ne pas réunir runes et artéfacts en une recherche jointe : l'espace se
  multiplierait alors qu'un artéfact ne change pas les stats qu'un build
  doit viser.

## Éligibilité et contrainte de paire

- Un monstre porte au plus un artéfact de chaque sorte, et chacun doit lui
  correspondre : l'**Attribut** suit son élément, le **Type** son archétype
  (`artifactFitsMonster`, `eligibleArtifacts`). Règle du jeu, côté compte :
  [02-app/compte/ (feat-calcul-artefacts.md) § 4 bis. Éligibilité — quel monstre peut porter quel artéfact](../../02-app/compte/).
- Un archétype absent ou `null` (monstre de matériau, liste de monstres
  antérieure au champ) n'est éligible à **aucun** artéfact de Type : ne rien
  proposer se voit, proposer une pièce inéquipable non.
- L'**intangible** est un joker : éligible dans les deux sortes et sur tout
  monstre, testé avant l'élément ou l'archétype, dont ses champs n'ont pas de
  sens. Mais **un seul** par monstre : `artifactPairAllowed` refuse la paire
  de deux intangibles. L'emplacement vide (`null`) est toujours permis.
- ⚠️ C'est la **seule** règle qui relie les deux emplacements, et elle rend
  faux le raccourci « filtrer chaque emplacement, puis prendre le meilleur de
  chaque côté » : chaque pièce peut être éligible et la paire interdite. Un
  choix glouton réparé après coup ne retombe pas non plus sur l'optimum. Cas
  écrit dans `tests/artefact-optim.test.ts` : un joker à 50 de chaque côté,
  le meilleur attribut ordinaire à 25 et le meilleur type ordinaire à 12 —
  garder le joker côté Type donne 75, l'inverse 62.
- `'equipped'` vérifie l'éligibilité quand même (`candidatsParSorte`) : une
  pièce portée qui ne correspond plus au monstre (donnée ancienne, import)
  laisse l'emplacement vide plutôt que de proposer une paire inéquipable.
- Ni meet-in-the-middle, ni compartiments, ni plafond de rétention : deux
  emplacements, une seule contrainte croisée, aucun bonus de set entre
  artéfacts. Une fois l'éligibilité appliquée, une double boucle exhaustive
  est exacte et reste peu coûteuse.

## Ce que chaque ligne fait pour le moteur

Libellés : `ARTIFACT_SUB` (effects.ts), ceux du jeu. Plafond d'une ligne sur
UNE pièce : `ARTIFACT_SUB_MAX` (artifacts.ts), le meilleur proc de la ligne
multiplié par cinq procs. Le calcul de dégâts ne lit que les codes que
`artifactDamageProfile` (damage.ts) range dans un `ArtifactDamageProfile` ;
tout autre code vaut 0 aux dégâts.

| Codes | Champ du profil | Effet au calcul | Détail |
| --- | --- | --- | --- |
| 218–221 | `brutPctPv`, `brutPctAtk`, `brutPctDef`, `brutPctVit` | dégâts BRUTS, ni critiques ni mitigés, à chaque coup, proportionnels à une stat du monstre | [02-app/degats-reels/ (feat-artefacts-et-degats-bruts.md) § Dégâts supplémentaires proportionnels à une stat (218-221)](../../02-app/degats-reels/) |
| 204, 205, 206, 226 | `ampliAtkPct`, `ampliDefPct`, `ampliVitPct` | magnitude d'un buff ATQ, DEF ou VIT déjà actif ; 226 compte pour ATQ et DEF | [02-app/degats-reels/ (feat-artefacts-et-degats-bruts.md) § Amplification de buff par artéfact — ATQ, DEF, VIT](../../02-app/degats-reels/) |
| 222, 223 | `cdPointsPvCibleHauts`, `cdPointsPvCibleBas` | points de Dgts CRIT, interpolation linéaire pure sur les PV restants de la cible : 222 plein à 100 % des PV, 223 plein à 0 %, sans palier ni seuil | [02-app/degats-reels/ (feat-artefacts-critique-et-element.md) § Dgts CRIT qui VARIENT d'un coup à l'autre (411, 222, 223)](../../02-app/degats-reels/) |
| 411 | `cdPointsPremiereAttaque` | points de Dgts CRIT sur le premier coup seulement | même section |
| 400–403, 410 | `cdPointsParSlot` | points de Dgts CRIT sur le sort du slot visé ; 410 compte en entier pour les slots 3 et 4 | [02-app/degats-reels/ (feat-artefacts-critique-et-element.md) § Dgts CRIT conditionnels au SORT (400-403, 410, 224)](../../02-app/degats-reels/) |
| 224 | `cdPointsMonoCible` | points de Dgts CRIT sur un sort, ou un groupe de coups, mono-cible | même section |
| 210 | `degatsBombePct` | majoration propre aux bombes | [02-app/degats-reels/ (feat-artefacts-critique-et-element.md) § Dégâts de bombe (210)](../../02-app/degats-reels/) |
| 300–304 | `degatsElementPct` | dégâts infligés à un élément, selon l'élément visé | [moteur-optimiseur-artefacts.md § Focus élémentaire](moteur-optimiseur-artefacts.md) |

- **Hors modèle : 208, 209, 225** (contre-attaque, attaque conjointe,
  contre-attaque ou attaque conjointe). L'application ne modélise aucune
  attaque conjointe ni contre-attaque : ces lignes valent 0 aux dégâts. Ne
  pas les présenter comme « à venir », ni leur inventer un déclencheur saisi
  à la main, entrée de plus pour une mécanique que le reste de l'outil
  ignore.
- **Ignorées : 203, 207, 211, 212, 213.** Sans fourchette de proc connue
  (absentes de `PROC`, artifacts.ts), elles n'ont ni plafond
  (`plafondLigne` rend 0, une ligne verrouillée ne peut donc pas les exiger)
  ni sonde de pertinence, et valent 0. Elles sont décrites comme des
  propriétés que le jeu ne fait plus obtenir ; aucun relevé ne l'atteste
  ici, et le code ne s'appuie que sur l'absence de fourchette. Côté compte :
  [02-app/compte/ (feat-calcul-artefacts.md)](../../02-app/compte/),
  « Cinq propriétés n'ont PAS de plafond ».
- Les autres codes (200–202, 214–217, 305–309, 404–409) n'entrent pas dans le
  profil et valent 0 au score de dégâts ; ils gardent un plafond et restent
  verrouillables.
- Le moteur ne lit **jamais** cette table pour décider qu'une ligne compte :
  il le sonde contre le vrai calcul
  ([moteur-optimiseur-artefacts.md § Pré-filtrage exact — pertinence, obligation, dominance](moteur-optimiseur-artefacts.md)).
  Les termes de dégâts que ces lignes exigent (accumulateur brut par coup
  hors `horsCoup`, terme de Dgts CRIT affine sur les PV de la cible, premier
  coup distingué) sont décrits avec le calcul, dans les sections de
  `../../degats-reels/` que cite le tableau.

## Focus élémentaire

- `DamageSetup.enemyElement` décrit la cible. Un élément visé : les lignes
  300–304 de cet élément comptent pleinement, et l'artéfact d'attribut se
  choisit largement sur elles. `null` (« Ignorer », le défaut) : elles valent
  0 (`artifactElementBonusPct`), et l'artéfact d'attribut se choisit sur ses
  autres lignes, typiquement 204 ou 226.
- C'est un paramètre du **calcul de dégâts**, pas de la recherche : il ne
  coûte rien au moteur. La sonde de pertinence le suit d'elle-même — une
  ligne d'un autre élément, ou toute ligne 300–304 quand l'élément est
  ignoré, ne fait pas bouger le score et n'est pas une dimension de la
  dominance.
- Porté par la recette (`OptimizerRecipe.damageSetup`), validé à l'import
  (`optimizerRecipe.ts`) ; `--element` au script CLI. Le contrôle est
  toujours affiché, il décrit l'adversaire :
  [02-app/degats-reels/ (feat-artefacts-critique-et-element.md) § Dégâts infligés par élément (300-304) — et le choix de la cible](../../02-app/degats-reels/).
- Ces lignes vivent dans le terme DMG% de la formule, la Marque dans les
  Réductions : les deux se multiplient, elles ne s'additionnent pas. Ni sur
  une bombe, ni sur le bucket Additionnel. Détail et provenance dans le même
  fichier de `../../degats-reels/`.

## Le moteur — double boucle exhaustive

`chercherPaires` (artifactOptim.ts) choisit la paire ; les fonctions
voisines lisent la même vue des candidats. Aucune heuristique : le balayage
exhaustif est sa propre référence, et la justesse ne peut se perdre qu'à un
endroit — quels candidats entrent dans la boucle.

### Les candidats d'un emplacement

`candidatsParSorte(params, kind)` part du choix de principale de la sorte
(`principaleParSorte`, `ChoixPrincipale` ; une sorte absente vaut
`'libre'`) :

- `'equipped'` — la seule pièce portée (`equipes`), si elle est éligible,
  sinon l'emplacement vide ; rien n'est cherché ;
- `'libre'` — tous les artéfacts éligibles de la sorte ;
- `100`, `101`, `102` — les éligibles dont la principale est PV, ATQ ou DEF :
  un **filtre** de l'inventaire possédé, jamais une pièce fabriquée ; sans
  aucune, l'emplacement reste vide ;
- toujours, en tête, `null` : l'emplacement vide est une option, et la seule
  quand rien n'est éligible — sans elle, un monstre sans artéfact d'attribut
  éligible ne produirait aucune paire.

Il n'existe pas de choix « laisser vide » : imposer le vide pour une sorte
pendant que l'autre cherche ne correspond à rien en jeu. Désactiver
l'optimisation d'artéfacts ne veut pas dire « sans artéfact » : le monstre
garde les pièces qu'il porte (`'equipped'` des deux côtés, ci-dessous), et
seule la recherche de paires est sautée. Le sélecteur de l'écran (`ArtifactMainChoice`, mêmes valeurs) :
[02-app/optimizer/ (feat-ecran-artefacts.md) § Artéfacts](../../02-app/optimizer/).

`parametresArtefactsFiche` (artifactFiche.ts) construit ces paramètres pour
l'écran, pour le CLI de l'Optimizer et pour le différentiel relique, en une
seule expression : il retire les artéfacts réservés par les autres builds
validés de la liste active ; il impose `'equipped'` des deux côtés quand
l'optimisation d'artéfacts est désactivée ; il vide les lignes verrouillées
sans optimisation ou quand les deux sortes sont figées (une seule paire
possible, qu'un verrou écarterait sans rechange) ; il fournit
`codesAmplification` et `maxStatsActifs`.

`ArtifactDetail.id` porte l'identifiant com2us de la pièce : c'est ce qui
rend une paire mémorisable dans un build validé et ses pièces réservables.
Une pièce synthétique (la sonde de pertinence, la pièce supposée d'un
repli) porte l'identifiant `0`, que l'import donne aussi à une pièce sans
`rid` ; toute réservation ignore un identifiant non strictement positif,
pour ne jamais croire possédée une pièce qui ne l'est pas.

### Pré-filtrage exact — pertinence, obligation, dominance

La boucle parcourt les candidats de `candidatsPourRecherche` : la vue
complète de `candidatsParSorte`, élaguée par `preFiltrerCandidats`. N'est
écarté que ce qui ne peut pas gagner.

- **Pertinence** (`analyserPertinence`), recalculée à chaque `chercherPaires`
  contre le vrai `evaluer` : pour chaque code qui a un plafond, le score d'un
  artéfact synthétique de la sorte qui peut porter la ligne, ne portant que
  cette ligne à son plafond, est comparé au même artéfact sans ligne
  (principale ATQ à 0 des deux côtés). Le score monte : le code est
  `croissants` ; il baisse : `ambigus`. « Dgts CRIT Compétence 2 » ne compte
  donc pas quand on optimise le S3, 224 pas sur une attaque de zone, une
  ligne élémentaire pas contre un autre élément. Ne jamais remplacer la sonde
  par une table de codes : elle suivrait mal le modèle de dégâts au premier
  changement, sans que rien ne le signale.
- **Amplifications** : `codesAmplification` — `codesAmplificationActifs`
  (damage.ts), les codes 204, 205, 206 et 226 dont un buff renforcé est
  actif — entrent dans `croissants` sans sonde. Sondée seule, une
  amplification donne un écart nul, puisqu'elle n'agit qu'avec une ligne
  218–221 de la même stat ; classée non pertinente, elle serait éliminée
  alors qu'elle vaut des dégâts. Les ajouter ne peut que rendre la dominance
  plus stricte.
- **Obligation** : une ligne verrouillée que seule cette sorte peut servir,
  ou qui exige les deux pièces, écarte tout candidat sous son seuil, et
  l'emplacement vide avec eux. Le seuil n'est pas le minimum demandé : il en
  retranche ce que l'autre pièce peut apporter au mieux — rien pour une ligne
  réservée à une sorte, un plafond d'une pièce pour une ligne 200–299
  (`seuilsObligatoires`).
- **Dominance** : un candidat est écarté si un autre est au moins aussi bon
  sur toutes les dimensions et strictement meilleur sur une, ou identique et
  placé avant lui dans l'inventaire (un seul des ex æquo survit, jamais
  aucun). Les dimensions : les codes `croissants`, les codes verrouillés, et
  les trois principales PV, ATQ et DEF, retenues sans condition — un artéfact
  peut n'être là que pour un minimum de stat de la recherche de runes, que ce
  module ne connaît pas.
  - Un intangible n'élimine jamais un artéfact ordinaire : il traîne la
    contrainte de paire, et le substituer rendrait infaisable toute paire
    dont l'autre emplacement est intangible. L'inverse est sûr.
  - Un candidat qui porte un code `ambigus` n'est jamais comparé.
  - Sous un maximum actif sur la stat d'une principale (`maxStatsActifs`),
    deux candidats qui y diffèrent sont incomparables : « plus » n'y est plus
    « au moins aussi bon ». Retirer la principale du vecteur ne suffirait
    pas, le départage des ex æquo éliminerait l'un des deux.
  - L'emplacement vide n'est jamais soumis à la dominance.

Les listes élaguées se mémoïsent d'un build à l'autre d'une même file
(`MemoPreFiltre`) :
[moteur-artefacts.md § Partage entre les builds d'une file](moteur-artefacts.md).

### La double boucle

- `chercherPaires(params, combien, memo)` : pour chaque candidat d'attribut
  et chaque candidat de type, la paire refusée par `artifactPairAllowed` est
  sautée, les autres sont notées par `evaluer`, seules celles qui respectent
  les lignes verrouillées (`paireRespecteLignes`) sont gardées, puis triées
  par score décroissant, tri stable (à score égal, l'ordre de l'inventaire).
  `meilleuresPairesArtefacts(params, combien)` en rend les paires ;
  `pairesParScore` rend le même ordre à la demande.
- Aucune paire ne tient les verrous : un tableau vide, jamais une paire qui
  viole l'exigence.
- `evaluer` est fourni par l'appelant, qui y **recalcule les stats** du
  monstre avec la paire : la principale d'un artéfact entre dans ses stats
  (`computeStats`), et un score qui l'ignorerait comparerait des paires sur
  des stats fausses. Le module reste ainsi sans logique de dégâts (seul le
  code `CODE_AMPLI_VIT` vient de damage.ts) et se teste sans contexte de
  combat.
- Ce que les tests verrouillent (`tests/artefact-optim.test.ts`) : un
  inventaire où les deux meilleurs scores sont inéligibles (un filtrage
  oublié les ferait gagner) ; une pièce portée devenue inéligible qui retombe
  sur le vide ; l'emplacement vide toujours candidat ; jamais deux
  intangibles ; le choix glouton battu ; le seuil d'obligation ; les
  doublons inertes.

### Lignes verrouillées

Le comportement à l'écran :
[02-app/optimizer/ (feat-ecran-sous-proprietes-verrouillees.md) § Sous-propriétés verrouillées](../../02-app/optimizer/).
Côté moteur :

- `LigneVerrouillee` (`code`, `min`) : un minimum **cumulé sur la paire**,
  une même ligne pouvant tomber sur les deux pièces. `paireRespecteLignes`
  compare avec une tolérance (`EPSILON_VALEUR`, 1e-6), parce que l'export
  porte des valeurs bruitées en virgule flottante.
- `plafondLigne` : le plafond d'une pièce, doublé pour les lignes 200–299
  que les deux sortes portent (`artifactSubKinds`), simple pour 300–309
  (attribut seul) et 400–411 (type seul), 0 sans fourchette.
- `budgetEmplacements` : une pièce porte quatre sous-propriétés
  (`MAX_ARTIFACT_SUBS`), en deux moitiés qui ne communiquent pas ; une ligne
  cumulable exigée au-delà du plafond d'une pièce consomme un emplacement de
  chaque côté. `impossible` ne prouve que le dépassement d'emplacements,
  jamais ce que l'inventaire contient.
- Rien ne passe : `meilleurCumulParLigne` rapporte, ligne par ligne, le
  meilleur cumul que l'inventaire atteint réellement, sur la vue complète,
  jamais sur les candidats élagués (qui le sous-estimeraient). Observé,
  jamais déduit ; un diagnostic, pas une preuve de faisabilité conjointe.
- `nombreDePaires` compte les paires que la boucle parcourt (après
  pré-filtrage, contrainte d'intangible comprise), `nombreDePairesRetenues`
  celles qui tiennent les verrous.
- **Coût des verrous** : avec `avecCoutDesVerrous`, le même balayage tient
  `meilleurSansVerrous`, le meilleur score toutes paires confondues ;
  `null` sans verrou ou sans la demande. L'écran le chiffre pour le seul
  build regardé, dans le bloc « Meilleurs artéfacts offensifs » : un coût
  SUR CE BUILD, jamais le contrefactuel d'une recherche sans verrou. ⚠️ Pour
  le chiffrer, l'élagage reçoit une liste de verrous vide : plus
  d'obligation, et les lignes verrouillées cessent d'être des dimensions de
  la dominance. Les `paires` d'un tel appel peuvent donc manquer la meilleure
  paire conforme quand une ligne verrouillée ne fait pas bouger le score ;
  l'écran n'en lit que `meilleurSansVerrous`.
- Ne pas tester les verrous avant `evaluer` pour économiser l'évaluation des
  paires qui les violent : `meilleurSansVerrous` se construit sur ces paires
  mêmes, et le coût affiché tomberait à `null` ou serait sous-estimé sans
  que rien n'échoue. La garde qui l'éviterait dédouble la boucle pour un
  gain nul sans verrou posé, où `paireRespecteLignes` rend vrai aussitôt.

### Paire supposée et revérifications

- `paireRepresentative` : la paire que la recherche de runes suppose, la
  meilleure de `meilleuresPairesArtefacts` pour l'équipement affiché, sous
  les mêmes principales et les mêmes verrous. De vrais artéfacts avec leurs
  lignes, jamais une pièce sans sous-propriété, qui ferait calculer les
  dégâts sans aucune ligne d'effet quand « Garder l'artéfact équipé » les
  compte. Vide si aucune paire ne tient les verrous ; l'écran affiche alors
  le diagnostic de `meilleurCumulParLigne`.
- La paire finale, qui peut porter une autre principale que la paire
  supposée, est revérifiée par le filtre final de la file
  (`respecteConditionsPaireFixe`, `respecteConditionsAvecRelique`) :
  [moteur-artefacts.md](moteur-artefacts.md). `respecteMinimums`, qui ne juge que les
  minimums, n'a plus d'appelant hors des tests.
- `ampliVitMaxAtteignable` : la plus forte amplification de VIT (206) que la
  paire puisse atteindre, par `chercherPaires` avec un évaluateur qui somme
  le 206 des deux pièces — toutes les règles de la paire héritées
  (éligibilité, intangible, principale, verrous). Elle sert à convertir une
  vitesse finale visée en minimum de VIT runée
  (`vitTotalePourVitesseFinale`, damage.ts). Ne pas la recalculer par une
  boucle à côté : prendre le meilleur 206 de chaque sorte indépendamment
  ignore l'intangible et les verrous, et affiche un minimum trop bas.
  Ni elle ni `vitTotalePourVitesseFinale` n'ont d'appelant en production,
  seulement des tests : l'écran n'offre aucune condition de vitesse finale.
  Ne pas en réintroduire une, parce que la vitesse finale ne décide pas de
  l'ordre des tours, qui se joue tick par tick sur la vitesse de combat
  ([02-app/speed-tuning/ (README.md) § Formule (modèle partagé)](../../02-app/speed-tuning/)) :
  viser une vitesse finale ne garantit aucun speed tune.
- Les bornes d'apport par stat (`bornesArtefacts`) et le choix de la paire
  par build : [moteur-artefacts.md](moteur-artefacts.md).

## Le script CLI

`scripts/artifact-search.ts` : la meilleure paire pour le build qu'un
monstre d'un export de compte porte, sans recherche de runes.

```bash
npx esbuild scripts/artifact-search.ts --bundle --platform=node \
  --format=cjs --outfile=<dossier temporaire>/as.cjs && node <dossier temporaire>/as.cjs <export.json> <monstre> [options]
```

| Option | Effet | Absente |
| --- | --- | --- |
| `--sort=<slot>` | sort visé | le sort par défaut de l'écran (`defaultDamageSkill`) |
| `--element=fire\|water\|wind\|light\|dark` | élément visé | ignoré, les lignes 300–304 valent 0 |
| `--def=<n>` | DEF de l'adversaire | celle de `DEFAULT_DAMAGE_SETUP` |
| `--crit=crit\|normal` | mode critique ; `moyenne`, mode supprimé, est lu `crit` avec un avertissement, toute autre valeur arrête le script | celui de `DEFAULT_DAMAGE_SETUP` |
| `--attribut=`, `--type=` | `equipped`, `libre`, `100`, `101`, `102` ; `none` ne correspond à aucune principale et laisse l'emplacement vide | `libre` |
| `--top=<n>` | nombre de paires affichées | 5 |

- **L'inventaire** est celui de `parseAccountInventory` : la réserve ET les
  artéfacts équipés sur les unités, dédupliqués par identifiant. Ce n'est
  pas le seul champ `artifacts` de l'export.
- **Le score** : `computeStats` avec la paire, puis `computeTotalDamage` sur
  le sort retenu avec `artifactDamageProfile` de la paire ; les auras
  propres sont celles des runes portées, les mêmes pour toutes les paires.
- Le script ne pose ni ligne verrouillée ni `codesAmplification` ; les
  buffs de `DEFAULT_DAMAGE_SETUP` sont éteints, une amplification n'y vaut
  donc rien.
- Il affiche le sort, la cible, l'inventaire par sorte, `nombreDePaires`,
  les dégâts avec la paire portée, puis les meilleures paires avec leur gain
  sur elle et le temps de calcul. Un monstre sans archétype connu est
  signalé : aucun artéfact de type ne lui sera proposé.
- C'est le chemin de bout en bout du moteur sur une vraie donnée :
  éligibilité, contrainte de paire et lignes du modèle de dégâts ensemble ;
  `tests/artefact-optim.test.ts` les couvre sur des fixtures.

## Deux usages : un build donné, ou les builds d'une recherche

Une seule primitive, `chercherPaires`, sert deux entrées.

- **Sur un build donné**, sans recherche de runes : le bloc « Meilleurs
  artéfacts offensifs pour ce build », sur l'exemplaire affiché, pour tous
  les objectifs de recherche. Il note les paires avec ses propres
  évaluateurs (`evaluateursArtefactsFiche` : `brut`, les dégâts
  supplémentaires des lignes, et `reel`, les dégâts réels du sort), jamais
  avec `representatif`, qui suit le régime de l'objectif de recherche
  (`regimeArtefacts`) et ne note des dégâts que sous « Dégâts réels ». La
  paire proposée diverge donc de la paire supposée dès que
  l'objectif n'est pas les dégâts, et le libellé le dit (« offensifs »).
  L'écran : [02-app/optimizer/ (feat-ecran-meilleurs-artefacts-offensifs.md) § Deux crans : dégâts supplémentaires ou dégâts réels](../../02-app/optimizer/).
- **Sur les builds d'une recherche** : le moteur de runes tourne inchangé
  avec la paire supposée, puis chaque build de la file reçoit sa propre
  paire (`resoudreEquipementDuBuild`) et le classement suit le score avec
  elle. Valide parce qu'un artéfact ne déplace pas la cible du build : les
  bons builds sont retenus par la recherche, seul l'ordre final bouge. Le
  nombre de builds vérifiés, la priorité de la page affichée et le régime de
  notation de la paire :
  [moteur-artefacts.md § Quand ce choix a lieu](moteur-artefacts.md).
- Le même sélecteur de principale sert les deux : sans optimisation
  d'artéfacts, l'écran impose « Garder l'artéfact équipé » des deux côtés ;
  avec, `'libre'` et les principales deviennent des filtres de candidats.
- Ce qui garde la file légère pour le fil de l'écran : `sortCandidates`
  calcule le score de chaque candidat une fois par tri, jamais dans le
  comparateur ; `cleBuild` est mémoïsée par identité de candidat
  (`WeakMap`, qui laisse ramasser les candidats d'une recherche périmée) ;
  les résultats se publient regroupés (`PUBLICATION_MS`).
- Ne pas remettre `triees.length` dans les dépendances de l'effet de la file
  (`useArtifactOptimQueue`) : il change à chaque message de progression,
  l'effet se démonterait à ce rythme et son nettoyage annulerait la tâche de
  fond avant qu'elle tourne — la file n'avancerait plus pendant la
  recherche.
