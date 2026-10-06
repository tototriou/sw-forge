# Limites connues

**Statut :** ÉTAT ACTUEL — décrit les limites connues de l'Optimizer
**Lire si :** on s'étonne d'un résultat de l'Optimizer ou on cherche ce qu'il ne couvre pas

- **L'objectif de recherche n'affecte QUE le pré-filtrage**, jamais le
  classement pendant la recherche elle-même — voir « Écran », étape 3.
- **Pré-filtrage heuristique par emplacement** : au-delà du budget de
  recherche, le résultat est « le meilleur trouvé », pas une preuve
  d'optimalité globale absolue sur l'inventaire entier. Sur une recherche à
  beaucoup de conditions simultanées (au-delà de 5-6 à la fois), le moteur
  peut manquer un build qui existe réellement — un cas connu et documenté,
  pas retouché depuis.
- Artéfacts et relique du monstre restent fixes ; l'outil ne travaille que
  sur les runes.
- **L'ajout à une liste de travail se fait UN monstre à la fois** (« Ajouter
  à la liste », voir « Listes de travail et réservation de runes ») —
  l'import en masse depuis un deck de siège/une prépa RTA entière n'est pas
  construit, ni un workflow qui enchaîne automatiquement au monstre suivant
  après validation. « Ajouter un autre exemplaire de … » (voir
  « Zone C ») n'y change rien : chaque clic ajoute un seul exemplaire.
- Le preset de pré-filtrage par emplacement et le filet de temps (« Réglages
  avancés ») sont réglables ; le plafond de candidats collectés reste un
  paramètre interne du moteur, non exposé dans l'UI — **« Rechercher
  jusqu'à épuisement complet » ne le retire pas**. Sur une recherche assez
  large pour atteindre le plafond de
  candidats collectés avant d'avoir tout exploré, la recherche s'arrête
  quand même — en pratique sans conséquence sur la qualité du résultat, ce
  plafond étant largement au-delà de ce qu'affiche l'écran.
- **L'estimation du nombre de builds** est un ordre de grandeur, pas le
  nombre réellement exploré par le meet-in-the-middle — et la barre de
  progression est elle-même approximative (voir « Interruption »).
- **Le joker (rune Intangible) n'est pas toujours crédité, dans le
  classement de rétention, de la valeur qu'il débloque en complétant un
  set** — un demi-build à joker médiocre en sous-stats brutes mais qui
  complète un set précieux peut ne pas recevoir l'avantage de classement
  qu'il mériterait. Piste connue, pas encore corrigée dans tous les cas.
- **« Dégâts réels » est une formule communautaire prédictive**, comme
  celles de la page Mécaniques — vraie formule du sort, vrai adversaire,
  mais pas une simulation de combat réel. Restent **hors modèle**, et
  jamais approximés en silence : variance, avantage élémentaire et glancing,
  lignes de dégâts d'artéfact, réductions autres que la marque, mécaniques
  propres à certains monstres. Environ **200 sorts du corpus** (sur ~6 000)
  ont une formule hors modèle et sont refusés explicitement plutôt que
  calculés de travers — détail dans [degats-reels/formules-et-combat.md#lecture-des-formules--tout-ou-rien](../degats-reels/formules-et-combat.md#lecture-des-formules--tout-ou-rien).
