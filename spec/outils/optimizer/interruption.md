# Interruption — filet de temps, pré-filtrage et arrêt manuel

**Statut :** ÉTAT ACTUEL — décrit l'arrêt d'une recherche avant son terme : filet de temps, pré-filtrage, arrêt manuel et progression
**Lire si :** on modifie le filet de temps, l'arrêt coopératif ou la barre de progression

Trois façons dont une recherche s'arrête **avant** d'avoir tout exploré, en
plus du plafond de candidats collectés :

- **Filet de temps** — 10 minutes par défaut, pas un réglage direct : une
  garde-fou en cas de recherche anormalement longue. Le vrai moyen de
  reprendre la main **avant** reste le bouton « Arrêter ». Peut être retiré
  via « Rechercher jusqu'à épuisement complet » (Réglages avancés, décoché
  par défaut) — la recherche continue alors jusqu'à épuisement des
  combinaisons à examiner (ou du plafond de candidats collectés, voir
  ci-dessous), sans limite de temps automatique.
- **Pré-filtrage par emplacement** — les presets « Réglages avancés »
  (voir ecran/conditions-et-reglages.md § Réglages avancés), calibrés par mesure sur des comptes réels : plus le preset est
  large, plus le pool considéré par emplacement grandit, et plus la
  recherche peut prendre de temps (jusqu'à plusieurs dizaines de secondes au
  preset le plus large sur un très gros compte). Valeurs
  (`SLOT_FILTER_PRESETS`, `runeBuildOptim.ts` — runes gardées par
  emplacement) : **Bas 40 · Moyen 80 (défaut) · Haut 150 · Extrême 300**.
  Bas est trop juste sur un vrai gros compte ; 300 est la valeur mesurée
  nécessaire pour y retrouver un build réel.
- **Bouton « Arrêter »** — l'utilisateur reprend la main quand il l'estime
  suffisant. Pendant l'appariement, l'arrêt est **coopératif** : le
  moteur rend la main régulièrement et renvoie le **meilleur trouvé
  jusque-là** plutôt que de tout jeter. Pendant la construction des
  moitiés, avant qu'aucune paire n'ait été évaluée, il n'y a rien à
  rendre : les Workers enfants sont terminés et le résultat est vide,
  tronqué (voir moteur/pipeline.md § Interruption).

Les cas de troncature se distinguent dans le message affiché : un arrêt
manuel dit « voici le meilleur trouvé jusque-là » (un choix assumé), un
plafond atteint dit « resserre tes critères » (une limite subie).

⚠️ **Sur une grosse recherche (appariement parallèle, au-delà de 100 M de
combinaisons), le plafond de candidats est partagé en quatre** : chaque
tranche en reçoit le quart et s'arrête quand elle l'a rempli. Une tranche
arrêtée ainsi alors qu'il lui restait des combinaisons à examiner rend la
recherche **tronquée**, même si le total reste sous le plafond : l'écran
affiche alors « Recherche interrompue après examen de N combinaisons —
resserre tes critères pour un résultat exhaustif. »
(`OptimizerSection.tsx`), plutôt que de présenter le résultat comme
complet. La troncature ne change que le message : la recherche n'examine
rien de plus. Une tranche qui remplit
son quart sur sa toute dernière combinaison ne laisse rien de côté et ne
déclenche pas le message. Le moteur transmet le motif (`motifTroncature` :
temps, plafond global ou quota de tranche) ; l'écran ne l'affiche pas, il
n'en lit que le booléen `truncated`.

## Barre de progression

Poste des messages de progression **entre** les points de passage internes,
avec le nombre de combinaisons déjà examinées et déjà trouvées. ⚠️
**Approximatif par construction** : le moteur ne consomme pas ses budgets
internes à un rythme constant d'une recherche à l'autre, donc la barre peut
accélérer ou ralentir en cours de route plutôt que progresser régulièrement.

⚠️ Les messages du Worker sont **throttlés au temps écoulé** (au plus un
tous les 150 ms, `PROGRESS_THROTTLE_MS`), pour ne jamais inonder le fil
principal quand l'élagage va vite. Chaque message porte `explored`, `found`
et un `pct` approximatif : le plus avancé des trois budgets qui peuvent
chacun terminer la recherche — et les seuls qui existent (pas de plafond
de nœuds : une borne qui grandit en cours de route ferait RECULER la
barre) :

```
pct = max(explored / totalPairs, found / maxCollected, tempsÉcoulé / maxMs)
```

Le troisième terme vaut 0 quand le filet de temps est retiré
(« Rechercher jusqu'à épuisement complet »). Sous la barre : le compteur
`explored`/`totalPairs`/`found`, puis le message doré (point 12 de
ecran/lancer-la-recherche.md § Lancer la recherche) — et rien d'autre : un second chiffre
« espace de recherche à épuiser (au pire) » doublerait le dénominateur de
la ligne du dessus.

