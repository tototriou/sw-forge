# Le choix des artéfacts — un second problème, séparé

**Statut :** ÉTAT ACTUEL — décrit le choix des artéfacts, un second problème séparé de la recherche des runes
**Lire si :** on modifie artifactOptim.ts ou la sélection d'artéfacts

⚠️ **Rien à voir avec la recherche de runes, et c'est voulu.** Toute la
machinerie ci-dessus existe parce que les runes forment un espace de 6
emplacements sous contraintes de sets. Les artéfacts, eux, sont **deux**
emplacements, et la règle d'éligibilité (l'attribut suit l'élément du monstre,
le type suit son archétype) ramène chacun à ~200 candidats sur un inventaire
réel : une **double boucle exhaustive** suffit, elle est exacte, et il n'y a
donc aucune heuristique à valider — voir
[artifactOptim.ts](src/lib/artifactOptim.ts).

- **Le build de runes est FIXE** pendant ce choix. Un artéfact amplifie un
  build, il n'en déplace pas la cible : chercher les deux ensemble multiplierait
  l'espace pour un gain que la mesure ne montre pas.
- ⚠️ **La contrainte de PAIRE n'est pas un détail** : on ne peut pas porter
  deux artéfacts **intangibles** à la fois, alors que chacun est éligible seul.
  Choisir le meilleur de chaque côté indépendamment produirait une paire
  inéquipable.
- **Élagage exact, jamais heuristique** — vérifié par différentiel contre le
  balayage complet, optimum identique :
  - **Pertinence** : une ligne qui ne fait pas bouger les dégâts POUR CE
    RÉGLAGE n'entre pas en compte. ⚠️ Elle est **sondée contre le vrai calcul**,
    jamais lue dans une table de codes : « Dgts CRIT Compétence 2 » ne sert à
    rien quand on optimise le S3, « D.CRIT+ cible unique » ne sert à rien sur
    une attaque de zone, et les lignes élémentaires ne servent à rien quand
    l'élément visé est ignoré — ou quand il ne correspond pas.
  - **Dominance** : un artéfact au moins aussi bon qu'un autre sur toutes les
    dimensions qui comptent est le seul retenu. ⚠️ Un **intangible** ne peut
    jamais en éliminer un ordinaire : il traîne la contrainte de paire, et le
    substituer rendrait infaisable toute paire dont l'autre emplacement est
    déjà intangible.
  - **Obligation** : quand une ligne verrouillée ne peut être servie que par
    une sorte, tout candidat sous son seuil est écarté. ⚠️ Le seuil n'est pas
    le minimum demandé : il en retranche ce que l'AUTRE pièce peut apporter.

## Quand ce choix a lieu

**Quand ce choix a lieu.** La recherche de runes a besoin d'une paire pour
noter les candidats, avant qu'aucun build n'existe : elle en **suppose** une
(la meilleure pour l'équipement affiché, sous les mêmes contraintes). Puis,
**pendant que la recherche tourne**, les meilleurs builds reçoivent chacun
leur vraie paire, hors du fil de l'écran, dans un Worker dédié — la page
affichée d'abord, puis les autres ; sur le fil principal seulement en repli
(voir plus bas) — l'ordre d'appariement étant
piloté par l'objectif, les bons builds sortent en quelques secondes là où la
recherche s'écoule sur plusieurs minutes.

⚠️ **Ce travail concurrent ne ralentissait pas la recherche** à la première
mesure — mesuré, pas supposé, mais voir la réserve de 6bis-b8 ci-dessous : +0,3 % sur une recherche de 25 secondes et −1,6 % sur une de 8, les
deux sous le plancher de bruit de la mesure. Seule une recherche d'environ une
seconde montre ~3 %, dont une charge de calcul *pure* explique la
quasi-totalité : c'est du partage de cœurs, pas un coût propre à ce calcul.
⚠️ Cette mesure date d'une file de cent builds, avec une charge sans fin
(`chercherPaires` en boucle) et l'appariement seul chronométré. En mode
relique « recherche », la file en traite trois cents depuis degats-et-aura
6bis-b8 (voir le paragraphe suivant). Mesuré alors sur une recette réelle
(mode « recherche », 4 reliques éligibles, artéfacts « Libre », appariement
parallèle), la vraie boucle de la file et sa vraie résolution, six
répétitions à ordre tourné : **trois cents contre cent ne se distingue pas
du bruit** (+2,3 % au minimum, +1,3 % en médiane, dispersion 7,5 %). En
revanche, **la file elle-même — cent comme trois cents — allonge la
recherche d'environ 8 à 10 %** par rapport à une recherche sans file, dans
toutes les répétitions de deux campagnes. Ce montage Node est pessimiste
(la file n'y cède jamais la main comme `requestIdleCallback`, et le
coordinateur de la recherche partage son fil) ; l'écart n'a pas été
vérifié au navigateur, et reste une piste ouverte. Au navigateur, depuis le
Worker de résolution (6bis-b13bis-b, plus bas) : ~+3,6 % en « Dégâts
réels », systématique mais sous la dispersion des séries.

**La page que vous consultez passe en premier.** L'avance de fond vise cent
combinaisons **confirmées** — **trois cents en mode relique « recherche »** —,
mais c'est la page affichée qui est servie d'abord — sans quoi aucune page
au-delà de ces positions n'aurait jamais sa paire. **Des confirmées, plus des
rangs** (degats-et-aura 6bis-b18, décision de l'utilisateur du 2026-10-02) :
l'avance de fond parcourt l'ordre de base et continue au-delà des builds
écartés à la résolution, jusqu'à ce nombre de builds résolus ET conformes, ou
jusqu'au dernier build trouvé. Sans écarté, c'est exactement « les cent (trois
cents) premiers », la règle d'avant ; sur une recherche aux minimums serrés
(Kinki : 100 conformes sur 1 112 trouvées, mesuré au navigateur en 6bis-b18),
la file vérifie tout — dès la fin de la recherche sur cette recette. Une
seule fonction pure, `prochainsATraiter`, en décide, sur le cache lui-même
(la conformité de chaque résultat), à l'écran comme au CLI. L'interrupteur
« Vérifier toutes les combinaisons trouvées » (Réglages avancés, désactivé
par défaut) rend la cible infinie — `cibleDeLaFile`, lu en direct : tous les
builds trouvés sont vérifiés. La cible de la
file (`kDeLaFile`, artifactQueue.ts) est fixée dès le lancement par le contexte
relique de la recherche LANCÉE, jamais par les réglages courants : les
changer après coup ne la modifie pas. Pourquoi trois cents : en mode
« recherche », l'ordre de base note sans relique, et un build classé au-delà
du centième peut remonter dans la première page une fois sa relique
résolue (constaté sur le vrai compte, en PV effectifs). Trois cents réduit
ce manque sans l'annuler ; « Équipée » garde cent, inchangé, et sans
optimisation d'artéfacts il n'y a pas de file.
Changer de page ou de tri repriorise immédiatement, sans rien recalculer de ce
qui est déjà connu. Depuis 6bis-b16, la « page » que la file sert d'abord est
l'ensemble des builds qui rempliront ses places « Vérification… » (voir
« Résultats ») : vide quand elle est complète.

## Recalcul quand la paire peut changer

**Ce qui est déjà calculé se refait quand la paire peut changer.** Le cache
de la file (paires et reliques déjà résolues) se vide à chaque changement de
la signature des réglages (`signatureArtefacts`, artifactQueue.ts) : monstre,
réglage de dégâts entier, régime effectif, optimisation coupée ou non,
principales et lignes verrouillées, relique portée, taille de l'inventaire,
contexte relique de la recherche lancée, conditions — et, depuis
degats-et-aura 6bis-b17, les **artéfacts réservés** par les autres builds
validés de la liste active, lus comme un ensemble (l'ordre de la liste est
sans effet ; sans réservation, la signature est celle d'avant). « Libérer les
artéfacts » sur la ligne d'un autre monstre de la liste, ou changer de liste
active, refait donc les paires déjà calculées : jusque-là, elles gardaient
l'ancien inventaire, même après une nouvelle recherche aux mêmes réglages. De
même pour la **pièce d'un emplacement figé** sur « Garder l'artéfact équipé »,
seul candidat de cet emplacement : valider un build du monstre recherché,
« Voir le runage réellement porté » ou changer d'exemplaire de la même espèce
la remplacent, et les paires déjà calculées se refont. La pièce portée d'un
emplacement libre, jamais lue, n'y entre pas. Enfin, depuis 6bis-b19,
l'**identité de l'import du compte** (`importDuCompte`, useOptimizerState.ts)
y entre : son numéro dans la session, avancé par chaque
`resetSearch('compte')` — donc par chaque import réel, jamais par la
relecture du compte conservé ; 0 avant tout import (composant omis,
signature d'avant). Le cache est indexé par les identifiants de runes et ne
voyait de l'inventaire que le nombre d'artéfacts : un réimport qui changeait
le contenu d'une rune ou d'un artéfact à nombre et identifiants égaux
gardait les paires de l'ancien compte. C'est une identité, pas une empreinte
du contenu : tout réimport vide le cache, même celui d'un fichier identique.
Le Worker de résolution reçoit alors le nouveau contexte (voir plus bas).

**La page affichée n'attend pas l'inactivité** (degats-et-aura 6bis-b11).
Pendant une recherche, l'écran reçoit la progression toutes les 150 ms et
retrie l'aperçu : il est rarement inactif, et chaque build de la page
pouvait attendre jusqu'à une seconde son créneau. La file a donc deux voies,
décidées par une seule fonction pure, `voieDeLaFile` (artifactQueue.ts), à
partir de la page affichée et du cache : tant que la page contient un build
non résolu, la tranche suivante part par une tâche immédiate
(`MessageChannel`, jamais `requestIdleCallback`) ; sinon, l'avance de fond
attend l'inactivité, comme avant ; rien à traiter, rien n'est programmé.
Toujours un seul build par tâche, la main rendue au navigateur entre deux,
et une seule tâche en attente à la fois : si une tranche de fond attend son
créneau quand la page acquiert des builds non résolus (changement de page,
nouveaux candidats), elle est annulée et replanifiée en voie prioritaire.
La voie ne change ni les builds traités ni leur ordre (`prochainsATraiter`) :
le travail total est le même, la voie prioritaire est bornée à la page. Les
résultats se publient toujours au plus toutes les 400 ms, et tout de suite
quand le dernier build non résolu de la page vient de l'être. La recherche
elle-même tourne dans des Workers ; sur ce chemin, la file reste sur le fil
principal, où la voie de la page accepte le coût de ses tranches pour une
page au plus. Mesuré au navigateur depuis (6bis-b12, puis 6bis-b13) : la
résolution y saturait le fil de l'écran — chaque build une tâche de 35 à
100 ms. **Ces deux voies sont devenues le chemin de REPLI** du Worker de
résolution (paragraphe suivant), inchangées.

## Résolution hors du fil de l'écran

**La résolution tourne hors du fil de l'écran** (degats-et-aura
6bis-b13bis-b, décision de l'utilisateur du 2026-10-02 : « Dégâts réels »
restait trop lent après 6bis-b13). La file confie chaque build à un Worker
dédié (`resolution.worker.ts`, corps `CorpsResolution`), qui exécute la
MÊME résolution (`entreeResolutionDuBuild` puis
`resoudreEquipementDuBuild`) ; le fil de l'écran ne résout plus rien.

- **La priorité reste sur le fil de l'écran** : la file choisit toujours le
  build suivant par `prochainsATraiter` (page affichée d'abord, puis les K
  premiers) et n'envoie au Worker qu'**au plus deux demandes sans
  réponse** ; le Worker les traite dans l'ordre reçu, une à la fois. Un
  changement de page **annule** les demandes pas encore commencées (jamais
  la plus ancienne en vol, sans doute commencée, dont le résultat reste bon
  à prendre). Ni les builds traités, ni leur ordre, ni K, ni le compte
  affiché ne changent.
- **Le contexte** (fiche, inventaire d'artéfacts et réglages de paires sans
  leur fonction de note, régime, contexte de dégâts, assiette des effets
  uniques, conditions, contexte relique de la recherche lancée) part à
  chaque nouvelle IDENTITÉ de ses entrées (l'objet mémoïsé par l'écran),
  donc au moins une fois par recherche — le contexte relique de la
  recherche lancée en fait partie —, et à chaque changement de la
  signature des réglages ; seulement quand il y a des builds à résoudre :
  changer un réglage sans recherche n'envoie rien. Il est construit par
  `entreesSerialisables`, à partir des mêmes arguments que la résolution du
  fil de l'écran. Chaque demande porte les runes de son build, produites par
  `runesDuBuild` (relicQueue.ts), le producteur que la résolution du fil de
  l'écran appelle aussi : jamais une seconde expression (6bis-b13bis-c).
  Un nouveau contexte ne vide pas le cache de la file : seul un changement
  de signature le vide, comme sur le chemin direct.
- **Une réponse périmée n'est jamais écrite dans le cache** : celle d'un
  contexte remplacé — reconnue à son identifiant de contexte, et, entre le
  rendu qui change un réglage et le renvoi du contexte, à l'identité des
  entrées et de la signature — ou d'une demande annulée. Elle libère
  seulement sa place en vol.
- **Publication** : même cadence que le chemin direct (au plus toutes les
  400 ms, tout de suite quand le dernier build non résolu de la page ou de
  la file vient de l'être). **Rien d'écrit ne reste hors de l'écran**
  (6bis-b13bis-c) : une écriture que la cadence a retenue est publiée de
  force quand la file se vide sans nouvelle écriture (réponse ignorée,
  changement de page, nouvelle recherche) et au repli — une publication de
  plus par file, au plus.
- **Repli** : un Worker impossible à créer, qui lève, dont une réponse est
  illisible, ou dont la résolution a levé, est journalisé dans la console
  (jamais en silence ; une résolution qui a levé l'est avec son nom, son
  message et, pour un pool de reliques vide, son motif `vide` —
  6bis-b13bis-c), terminé, et la file reprend sur le fil principal par
  les deux voies ci-dessus, avec le cache tel qu'il est — rien de déjà
  résolu n'est perdu. Le repli dure jusqu'au démontage de l'écran.
- **Un seul Worker pour la vie de l'écran Optimizer**, créé au premier
  besoin et terminé au démontage — jamais un par recherche ni par rendu.

Toute cette logique du côté de l'écran (quoi envoyer, annuler, ignorer,
quand renoncer, quand publier) vit dans un module pur testé en Node,
`ResolutionDistante` (resolutionDistante.ts) ; le hook de la file ne fait
que le brancher. Preuve : une file simulée — ce module, le corps derrière
`structuredClone`, des entrelacements aléatoires de messages, de pages, de
candidats et de contextes — remplit un cache identique à la résolution
directe, sur les fixtures (`tests/resolution-distante.test.ts`) et sur
trois recettes gelées (preuve du lot), dont une seule exerce une vraie
résolution : « Dégâts réels » ; en « PV effectifs », les artéfacts gardés
équipés laissent une paire par relique, et la troisième n'a qu'un
candidat ; depuis
6bis-b13bis-c, elle suit aussi la publication, avec la cadence du hook :
sur toute file vide et à la fin, l'écran a reçu le cache entier. Elle
couvre un repli en cours de route (réponse d'erreur, envoi qui lève, repli
du hook : cache intact, plus rien d'envoyé ni d'écrit ensuite) et des
entrées changées à signature égale (nouveau contexte, cache gardé). Le
branchement du hook (refs relues au rendu, gestionnaire des messages,
rebranchement par effet, réveil, port de repli) et les runes envoyées par
l'écran, qu'aucun test d'exécution n'exerce, sont gardés par des contrôles
de source précis : chacune des cinq mutations relevées par la revue du
Worker en fait échouer au moins un.

## Mesures au navigateur

**Mesuré au navigateur** (6bis-b13bis-b ; version construite, Chromium
sans affichage, 8 cœurs, passages entrelacés ; A-après contre A-avant —
le code de 6bis-b13 — et C, sans optimisation d'artéfacts) :

- **Le fil de l'écran se libère** en « Dégâts réels » : tâches longues
  4 % du fil pendant la recherche (médiane, contre 28 % avant, 2 % sans
  file), plus longue tâche 82 ms (101), page 1 résolue en 1,3 s (1,9 s),
  page 2 en 0,9 s (1,6 s). En « PV effectifs » (artéfacts gardés équipés,
  résolution déjà légère), rien de lisible : 4 % de part dans les deux cas.
- **La recherche ralentit en « Dégâts réels »**, d'après deux campagnes :
  celle du lot, plus lente dans 11 passages appariés sur 12, médiane des
  écarts +3,6 % (test du signe, p = 0,006), sous la dispersion des séries
  (6,6 et 8,4 %) ; celle du pilote (6 paires), +7,2 % (6 sur 6,
  p = 0,031), sans cause identifiée à l'écart entre les deux — soit +4 à
  +7 %, 0,35 à 0,6 s sur une recherche de 9 s. Hypothèse, non isolée : le
  Worker calcule à plein pendant la recherche, sur une machine dont la
  recherche occupe déjà cinq fils. En « PV effectifs », +2,0 % sur 4
  paires, non concluant.
- **Le résultat complet arrive plus tôt** (campagne du pilote : recherche
  finie ET 300 premiers résolus, « Dégâts réels ») : 15,2 s contre 20,7 s,
  −27 % (6 paires sur 6). Le Worker résout 162 builds pendant la recherche
  (85 avant) ; le chemin direct finissait l'essentiel APRÈS elle, sur le
  fil de l'écran, par tranches d'environ 36 ms.
- **Écart accepté par l'utilisateur** (décision du 2026-10-02) : la
  garantie du lot était « la recherche ne ralentit pas » ; le Worker est
  gardé, ce ralentissement contre un résultat complet plus tôt et un fil de
  l'écran libéré.
- **Processeur bridé ×4** (fil de l'écran seulement, la recherche dans ses
  Workers ne l'est pas) : en « Dégâts réels », page 1 en 3,4 s contre
  10,4 s, et avant cela elle n'était jamais résolue avant la fin de la
  recherche ; résultat complet 24,5 s contre 113,5 s (−80 %, pilote,
  3 paires) ; durée de la recherche bridée NON CONCLUANTE (−1,3 % dans la
  campagne du lot, −11 % dans celle du pilote, où seul le passage bridé
  sans Worker diffère ; n = 3). Le fil reste occupé à 70 % en tâches
  longues (76 % avant) ; hypothèse, non mesurée tâche par tâche : par la
  publication, le reclassement et le rendu, la résolution n'y tournant
  plus. En « PV effectifs » (29 367 builds), 70 % contre 61 %, plus longue
  tâche ~1,2 s dans les deux cas ; hypothèse, non vérifiée : le Worker
  résout plus vite, donc publie plus souvent.
- **L'envoi du contexte** coûte 4 ms sur le fil de l'écran (médiane ;
  ~19 ms bridé ×4) pour ~800 Ko (2 518 artéfacts), une fois par
  recherche.

## Partage entre les builds d'une file

**Les builds d'une file partagent ce qui ne dépend pas d'eux**
(degats-et-aura 6bis-b13). Mesuré sur la recette « Dégâts réels » de
référence : résoudre un build essaie ~7 800 paires pour chacune des quatre
reliques éligibles, mais 300 builds ne parcourent en tout que 7 727 paires
distinctes. Trois mémoires et un tri différé, sans changer aucun résultat :

- le **profil de dégâts d'une paire** ne lit que ses deux pièces : il se
  calcule une fois par paire (`CacheProfilsParPaire`, clé = identifiants des
  pièces dans l'ordre reçu, emplacement vide compris ; une pièce
  d'identifiant ≤ 0 n'est pas une pièce et n'y entre jamais) ;
- les **candidats élagués de chaque sorte** se recalculent seulement si
  leurs entrées changent (`MemoPreFiltre`) : la pertinence reste sondée
  contre le vrai calcul à chaque build et à chaque relique, et la liste
  n'est réutilisée que pour la même pertinence, le même inventaire et les
  mêmes réglages de paires ;
- les **stats d'une paire** ne dépendent que de la somme de ses
  principales : `statsParPaire` rend le même tableau aux paires de mêmes
  principales, et l'effet unique de la relique essayée n'est calculé qu'une
  fois par tableau ;
- la résolution ne lit, d'ordinaire, que la **meilleure paire** (la
  première conforme, le premier couple faisable) : `pairesParScore` la
  trouve par un seul parcours — plus grand score, premier dans l'ordre de
  l'inventaire en cas d'égalité, comme le tri stable — et ne trie toutes les
  paires que si l'on lit plus loin (ou si un score vaut NaN). L'ordre rendu
  est exactement celui de `chercherPaires`.

Chaque mémoire est bornée (16 384 profils, 64 listes, 256 tableaux, 64
apports) et se vide d'un coup à sa borne. Leur durée de vie est celle d'une
file : l'écran les recrée avec la signature des réglages et les paramètres
de paires (donc l'inventaire), le Worker de résolution à chaque contexte
reçu, le CLI une fois par recette — jamais un état
global qu'un nouvel inventaire laisserait périmé. Ce qu'elles rendent est
partagé : à lire, jamais à modifier.

Une carte n'est affichée qu'une fois sa paire calculée (6bis-b16, voir
« Résultats ») : avant, sa place dit « Vérification… », à la hauteur d'une
carte, plutôt que de montrer un résultat provisoire. La mention « artéfacts pas
encore optimisés », qui disait jusque-là qu'une carte affichée attendait encore
sa paire, a disparu avec la carte provisoire, et sa rangée réservée avec elle.

⚠️ **Un build optimisé peut alors passer devant dans le classement**, et la
boucle « trier → optimiser → retrier » ne s'emballe pas : optimiser un build ne
peut que faire MONTER son score (la paire supposée fait partie des paires
candidates, le maximum lui est toujours ≥). Un build non optimisé ne peut donc
qu'être repoussé vers le bas, jamais entrer dans les premiers de ce fait —
l'ensemble à traiter rétrécit.

⚠️ **Les stats de la carte sont recalculées avec sa vraie paire**, pas seulement
son total : la stat principale d'un artéfact entre dans les stats du monstre.
Sans ce recalcul, la carte afficherait des stats qui ne correspondent pas aux
artéfacts montrés juste à côté, et un tri par ATQ porterait sur une valeur
périmée.

