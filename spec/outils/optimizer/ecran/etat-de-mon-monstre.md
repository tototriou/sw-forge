# État de mon monstre

**Statut :** ÉTAT ACTUEL — décrit la carte « État de mon monstre »
**Lire si :** on modifie les effets, auras et états saisis pour le monstre à optimiser

6 bis. **État de mon monstre** — ⚠️ **une carte à part**, colonne 2 rangée 3,
   juste sous « Artéfacts et reliques ». Pas en bas de cette carte, séparée
   par un simple trait : ça laisserait croire que ces réglages servent les
   artéfacts, alors qu'ils décrivent le **monstre** et valent pour tout calcul.
   Le trait ne suffit pas à dire « autre métier » — une carte, si.
   Contenu : **buff ATQ**, **buff DEF**, **buff
   VIT**, **leader skill** d'équipe (type puis valeur, icône officielle du
   jeu), **compétences d'invocateur** et les
   **sets d'aura des autres monstres** de l'équipe. Ce qui rend le monstre
   plus fort, quel que soit l'adversaire.
   Si un buff actif est amplifié par une ligne d'artéfact, le pourcentage
   apparaît sous ces contrôles, auprès du buff correspondant (ATQ, DEF ou
   VIT), jamais sous la VIT de l'adversaire.

   **Rappel des buffs posés par un passif** (rappel à l'écran, réglage manuel
   conservé) — quand le
   monstre choisi porte un passif qui se pose un buff standard, une ligne
   s'affiche sous la rangée des trois groupes, avant les lignes
   d'amplification et dans la même grammaire (texte `xs` atténué) : le
   passif nommé comme dans « Stats acquises en combat » (`Jeton` en lecture
   seule, icône et nom du jeu sans « (Passive) »), puis « pose Buff ATQ —
   « when you attack on your turn » ». La condition est un **extrait
   littéral** de la prose du jeu, jamais reformulé ; plusieurs buffs se
   joignent par « et », ou par « ou » quand le jeu en tire un seul (« grants
   one of the following », Caffeine et Mind and Body Rest). Le Taux Crit de
   Transcendence (Antares) est nommé, bien qu'aucune vignette ne le règle.
   **Un rappel, jamais un réglage** : aucun buff ne s'allume d'office, et
   aucun calcul ne lit la table — elle n'est importée que par l'écran et la
   carte. La table est curée **par identifiant de compétence**
   (`BUFFS_POSES_PAR_PASSIF_CONNUS`, `src/lib/buffsDePassif.ts`) : 21
   passifs « buff standard », chacun relu dans sa prose ;
   un passif absent de la table n'a pas de rappel, et les buffs qu'un sort
   actif se pose lui-même n'en ont pas non plus. Le rappel dépend du
   monstre, jamais d'un clic dans la carte : il paraît au choix du monstre,
   dont le sélecteur et la liste vivent dans la carte du haut — rien de ce
   qu'on vient de cliquer ne bouge. Il lit la fiche du monstre **choisi**
   (garde d'identité : la fiche précédente, encore en mémoire pendant le
   chargement, n'en donne aucun).

   Les trois groupes tiennent sur **une seule rangée** :
   empilés, ils donneraient à la carte une hauteur sans rapport avec le peu
   qu'elle contient. ⚠️ En `flex-wrap`, pas en rangée rigide — au doigt ou
   dans une colonne étroite, ils repassent à la ligne plutôt que de comprimer
   les contrôles sous leur taille de cible.

   Dans le groupe **Invocateur**, le libellé et son aide sont **au-dessus**
   des deux crans, pas à leur gauche : côte à côte, ils
   formeraient le groupe le plus large des trois et feraient replier la rangée
   plus tôt. ⚠️ **Sans changer la hauteur de la carte** — le groupe passe à
   deux rangées, mais « Lead » en fait déjà deux et `items-stretch` aligne les
   trois boîtes sur la plus haute : l'invocateur ne fait que remplir une place
   qui existait déjà.

   Chacun porte son **contour**. ⚠️ **Des boîtes et non des barres**, alors
   qu'une barre serait
   plus légère et que c'est le patron des deux colonnes de « Critères de
   recherche » : ces groupes-ci peuvent passer à la ligne, et une barre
   verticale se retrouverait alors à pendre dans le vide au bout d'une rangée.
   Un contour ferme le groupe où qu'il aille. Un **seul** contour, jamais deux
   superposés ([shared/design.md](../../../shared/design.md)) — ces boîtes vivent à
   l'intérieur de la carte, elles ne longent pas son bord. `items-stretch` les
   met à la hauteur de la plus haute, sinon une boîte d'une rangée flotterait
   au milieu d'une boîte de deux et l'œil lirait un décalage.

   Dans le groupe **Lead**, les deux menus (type et valeur) ont la **même
   largeur** : ils occupent la même colonne de grille, en `w-full`. La largeur
   se déduit donc du plus large des deux — aucune valeur en dur à tenir à jour
   quand un libellé change.

## Sets d'aura des autres monstres

   **Sets d'aura des autres monstres** — une quatrième
   boîte, **sous** la rangée des trois groupes et **en dernier** dans la
   carte, qui saisit `DamageSetup.setsAuraExternes` : les sets Fight,
   Determination, Enhance, Accuracy et Tolerance portés par les **autres**
   monstres de l'équipe (voir
   [effets d'équipe](../../degats-reels/effets-equipe-et-leaders.md)). En tête,
   le libellé « Sets d'aura des autres monstres », son aide — les sets du
   monstre optimisé sont comptés automatiquement sur chaque build, même
   s'ils ne sont pas recherchés — et le total « X / 15 ». Dessous, le bouton
   pointillé **« Ajouter un set d'aura »**, **fixe** : les lignes s'ajoutent
   SOUS lui, avec le premier set absent et le nombre 1 ;
   ajouter ne pousse donc que vers le bas. Une ligne = le set (`Selecteur` :
   le sien et ceux qu'aucune autre ligne ne porte — une seule ligne par
   set), le nombre (`NumberField`) et une corbeille (`BoutonIcone`) ; sous
   ces contrôles, le libellé explicite « Nombre de sets Fight des autres
   monstres de l'équipe », même patron pour les cinq sets. ⚠️ **Dessous et
   non dessus** : il change de longueur avec le set et peut passer à la
   ligne — au-dessus, il ferait descendre le menu qu'on vient de cliquer.
   Le menu occupe la colonne restante de sa ligne : sa largeur vient de la
   boîte, jamais de l'option choisie. Même disposition aux deux formats.

   ⚠️ **Les bornes sont celles de la fonction pure d'écriture**
   (`src/lib/aurasExternes.ts`), pas seulement du contrôle, qui ne borne
   qu'à la sortie du champ et à ses boutons : le nombre va de 1 à
   `15 − somme des autres lignes`, et une frappe au-delà est ramenée au
   maximum, jamais écrite. À somme 15, ou quand les cinq sets ont leur
   ligne, le bouton d'ajout se désactive (raison en infobulle) sans toucher
   aux lignes existantes. Un champ du nombre **vidé revient à 1** à la
   sortie du champ ; **seule la corbeille retire une ligne**. Toute liste
   écrite passe la validation de la recette — la même fonction,
   `erreurAurasExternes`. Choisir, changer ou retirer un set recherché ne
   crée, ne relève et ne supprime aucune aura externe : les deux sources
   sont indépendantes.

   **Rappel au changement de monstre** — choisir un
   autre monstre **depuis la liste de travail** (voir
   ../listes-et-reservation.md § Zone C — Monstres de la liste) — autre espèce, ou autre exemplaire de la même espèce —
   alors que des auras externes sont renseignées passe leur boîte au token
   d'attention : contour `warn` et fond `warn-soft` à la place de ses
   couleurs, toujours un seul contour de 1 px, et l'en-tête de la boîte
   laisse la place à « Pense à vérifier les sets d'aura externes. »,
   **effacé après 3 s**. Un rappel, jamais un
   blocage : les nombres restent ceux saisis — conservés au changement de
   monstre comme le contexte —, l'app ne les réécrit pas : c'est
   l'identité du monstre optimisé qui change ce qui est « externe ».
   ⚠️ **Sa place est réservée** : le message occupe la même case de grille
   que l'en-tête (libellé, aide, total), invisible le reste du temps ; la
   case a donc déjà la hauteur du plus haut des deux et rien ne bouge quand
   il paraît. ⚠️ **Aucune autre voie** : ni le bestiaire, ni une puce de
   source ou la zone D (le rappel reste limité à la liste de
   travail), ni l'import d'une recette ou d'un compte, ni un simple rendu ;
   recliquer l'exemplaire affiché ne rappelle rien. La décision est la
   fonction pure `doitRappeler` (`src/lib/aurasExternes.ts`), appelée dans
   le seul `onClick` d'un membre de la zone C — jamais dans `resetSearch`
   ni dans un effet sur le monstre sélectionné, que l'import pose aussi.
   Le même message paraît aussi sous la liste de la zone C, du même état et
   pour la même durée (voir
   ../listes-et-reservation.md § Zone C — Monstres de la liste).

## Ouverture guidée vers l'interrupteur des auras RES/PRE

   **Ouverture guidée vers l'interrupteur des auras RES/PRE**
   — ajouter **Accuracy** ou **Tolerance** aux auras
   externes (nouvelle ligne, ou ligne passée à ce set), ou le choisir comme
   **set recherché** (sans toucher aux auras externes), guide vers « Compter
   les effets d'auras Tolerance et Précision dans les conditions » (point 9,
   voir conditions-et-reglages.md § Réglages avancés). Fight, Determination et Enhance n'ouvrent
   rien : leurs auras n'entrent dans aucune condition, aucun réglage ne leur
   est associé. Un nombre changé sur une ligne déjà présente, une seconde
   activation du même set ou un retrait ne guident pas non plus ; le
   guidage n'est jamais rejoué à l'import d'une recette ou d'un compte, ni
   au changement de monstre. La décision est la fonction pure
   `guideVersResPre` (`src/lib/aurasExternes.ts`), appelée au seul geste :
   l'écriture des auras externes (`ecrire`, point de passage de tous les
   contrôles de leur boîte) et le choix d'un set recherché. Deux formes,
   une par format, choisies par `SOUS_LG` comme le panneau lui-même :
   - **À la souris** — la page défile jusqu'à la carte « Réglages avancés »,
     l'ancre du flottant (même défilement que « Set de runes recherché » :
     doux, centré), **puis** le flottant s'ouvre : il choisit son côté en
     mesurant l'ancre à l'ouverture, ouvert pendant le défilement il
     mesurerait une position périmée. Ancre déjà entièrement visible : pas
     de défilement, ouverture directe. Le défilement peut déplacer la carte
     cliquée et le flottant se referme au clic suivant hors de lui — deux
     effets admis. Si le bas du flottant dépasse de
     l'écran, la page défile encore du strict nécessaire pour montrer
     l'interrupteur.
   - **Au doigt** — le panneau « Options de recherche » s'ouvre par-dessus
     la carte ; il reste piloté par la barre de navigation, l'écran le
     demande par la prop `onOuvrirMenu` (`App.tsx`, relayée par
     `OutilsPage.tsx`). Son contenu défile jusqu'à l'interrupteur, dernier
     réglage du panneau, sous « Exclusion de runes ».

   Dans les deux cas, l'interrupteur est surligné **3 s**, au même token que
   le rappel (contour `warn`, fond `warn-soft`). ⚠️ Il reste toujours rendu
   dans sa surface (`reglagesAvancesInner`, commun aux deux formats) :
   guider ne le monte jamais sous condition et ne le masque jamais ensuite.
   Son cadre de surlignage existe en permanence, transparent hors guidage,
   et se pose À L'INTÉRIEUR de la rangée, dont le trait du haut sépare les
   réglages : posé sur la rangée elle-même, il ferait deux contours
   superposés.

   ⚠️ **Ces cinq réglages ne vivent pas dans la fenêtre « Dégâts réels »** :
   ils n'y seraient atteignables que sous ce seul objectif — alors qu'ils
   changent les
   statistiques du monstre, donc les **dégâts supplémentaires** que lui
   apportent les artéfacts proportionnels aux PV/ATQ/DEF/VIT, affichés quel
   que soit l'objectif. Qui optimise l'efficience les subirait sans
   pouvoir ni les voir ni les régler. Aucun réglage n'est dupliqué : c'est
   le même état, montré à un endroit toujours visible.

   ⚠️ **La coupe se vérifie, elle ne s'interprète pas.** Restent hors de la
   fenêtre EXACTEMENT les réglages qui modifient les statistiques propres du
   monstre ; ce qui y reste (cible, sort, critique, réduction de DEF, marque,
   effets d'alliés) n'y touche pas. Test : changer un réglage d'« État de
   mon monstre » DOIT faire bouger le « +X / coup ». Mesuré sur Lushen —
   buff ATQ activé : **+737 → +1 068 / coup**. ⚠️ **Sauf les auras
   Accuracy et Tolerance** : elles modifient bien des
   statistiques propres du monstre, la Précision et la RES, mais aucune
   n'entre dans les dégâts bruts — pour elles, ce qui bouge est la
   condition RES/PRE (minimum ou maximum), quand `compterAurasResPre` est
   activé.

   ⚠️ **Rendus sans condition**, même quand la formule du sort ne lit pas la
   statistique : un buff change les stats du monstre même sans sort du tout.

   ⚠️ **La fenêtre « Dégâts réels » en garde un écho en lecture seule**,
   dans son sous-titre — jamais les contrôles eux-mêmes, qui feraient deux
   exemplaires vivants du même interrupteur visibles en même temps. Qui
   ouvre la fenêtre voit sous quelles hypothèses il travaille ; pour les
   changer, il ferme. L'écho **nomme les auras
   externes** par set, avec leur nombre (« auras externes : 2 sets Fight,
   1 set Accuracy »), ou « aucune aura externe », et dit que les sets
   d'aura du build s'y ajoutent sur chaque résultat — **sans nombre** : la
   fenêtre ne connaît aucun candidat, ces activations se résolvent par
   build (`echoAurasExternes`, `src/lib/aurasExternes.ts`).

   ⚠️ **Le sélecteur FILTRE l'inventaire, il n'hypothèque pas.** Choisir
   « ATQ +100 » restreint la recherche aux artéfacts qu'on POSSÈDE portant
   cette principale, avec leurs sous-propriétés. Sans aucun, l'emplacement
   reste vide — on ne peut pas équiper ce qu'on n'a pas. Ne pas fabriquer de
   pièce fictive (« et si j'avais un artéfact PV+1500 ? ») : sans aucune
   sous-propriété, elle ferait calculer les « Dégâts réels » sans aucune
   ligne d'effet, quand « Garder l'artéfact équipé » les compte — deux
   réglages voisins, deux modèles de dégâts, sans que rien ne le signale.

