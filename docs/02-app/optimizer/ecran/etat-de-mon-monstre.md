# État de mon monstre

6 bis. **État de mon monstre** — ⚠️ **une carte à part**, jamais le bas de la
   carte « Artéfacts et relique » séparé par un simple trait : ça
   laisserait croire que ces réglages servent les artéfacts, alors qu'ils
   décrivent le **monstre** et valent pour tout calcul. Le trait ne suffit
   pas à dire « autre métier » — une carte, si.
   Contenu : **buff ATQ**, **buff DEF**, **buff
   VIT**, **leader skill** d'équipe (type puis valeur, icône officielle du
   jeu) et les
   **sets d'aura des autres monstres** de l'équipe. Ce qui rend le monstre
   plus fort, quel que soit l'adversaire.

   **Au téléphone**, la carte suit « Artéfacts et relique » et porte tout
   ce contenu, sets d'aura compris. **Au bureau**, elle est réduite aux
   buffs et au lead, section des essentiels dans la sous-colonne de 177 px,
   sous la statistique principale imposée (`EtatMonstreEssentiels`) : les
   trois vignettes de buff **sur une rangée** (56 px chacune), puis le lead :
   « Lead », l'icône, la liste de la stat
   et, sous elle, celle du pourcentage, sans boîte autour, la liste de la
   stat entière ; le motif d'un lead inactif (seulement s'il existe) et les
   rappels. Son aide ne nomme ni les sets d'aura ni ce qui décrit le
   combat. Les sets d'aura des autres monstres ont leur propre carte, en
   tête de la colonne « Aura, exclusion, avancés »
   ([Sets d'aura des autres monstres](#sets-daura-des-autres-monstres)).
   ⚠️ **Aucune phrase sur l'amplification d'un buff par un artéfact**
   (« l'artéfact … amplifie ce buff de N % »), aux deux formats (décision de
   l'utilisateur) : elle portait sur la paire d'artéfacts représentative de
   la recherche, que le joueur ne connaît pas, et non sur ses artéfacts. Le
   calcul en tient toujours compte.

   **Rappel des buffs posés par un passif** (rappel à l'écran, réglage manuel
   conservé) — quand le
   monstre choisi porte un passif qui se pose un buff standard, une ligne
   s'affiche sous la rangée des deux groupes (texte `xs` atténué) : le
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
   dont le sélecteur et la liste vivent au-dessus de la carte (liste de
   travail au bureau, « Monstre & équipement » au téléphone) — rien de ce
   qu'on vient de cliquer ne bouge. Il lit la fiche du monstre **choisi**
   (garde d'identité : la fiche précédente, encore en mémoire pendant le
   chargement, n'en donne aucun).

   Au téléphone, les groupes tiennent sur **une seule rangée** quand la
   largeur le permet :
   empilés, ils donneraient à la carte une hauteur sans rapport avec le peu
   qu'elle contient. ⚠️ En `flex-wrap`, pas en rangée rigide — au doigt,
   ils repassent à la ligne plutôt que de comprimer les contrôles sous leur
   taille de cible.

   Les **compétences d’invocateur** sont dérivées du contenu de la liste
   active : Guilde → « Contenu de guilde », Arène et Donjon → « Contenu normal ».
   Sans liste active ou sans contenu, elles valent « Contenu normal ». Elles restent
   supposées au maximum, selon l’élément du monstre. Aucun choix ne figure
   dans cette carte, au bureau comme au téléphone. L’écran, la recherche et
   la recette lisent ce même mode effectif ; une valeur mémorisée ou importée
   différente reste conservée, mais le contenu décide de son application.

   **Au téléphone, chaque groupe porte son contour.** ⚠️ **Des boîtes et non des barres**, alors
   qu'une barre serait
   plus légère et que c'est le patron des deux colonnes de « Critères de
   recherche » : ces groupes-ci peuvent passer à la ligne, et une barre
   verticale se retrouverait alors à pendre dans le vide au bout d'une rangée.
   Un contour ferme le groupe où qu'il aille. Un **seul** contour, jamais deux
   superposés ([03-developpeur/interface/design/README.md](../../../03-developpeur/interface/design/README.md)) — ces boîtes vivent à
   l'intérieur de la carte, elles ne longent pas son bord. `items-stretch` les
   met à la hauteur de la plus haute, sinon une boîte d'une rangée flotterait
   au milieu d'une boîte de deux et l'œil lirait un décalage. Au bureau,
   buffs et lead sont sans cadre dans les essentiels, et les auras forment
   une section sans cadre de leur colonne.

   Dans le groupe **Lead**, au bureau, les deux menus (type et valeur) ont la
   **même largeur** : la valeur se pose sous le type, dans la même colonne de
   grille, en `w-full`. La largeur se déduit donc du plus large des deux —
   aucune valeur en dur à tenir à jour quand un libellé change. Au téléphone,
   la valeur se pose à droite du type, sur la même rangée, pour tenir moins de
   hauteur ; sa place reste réservée avant le choix d'un lead.

   Pour un membre lié, le menu montre le **lead effectif**, ou « Aucun » avec
   son motif si le lead n’agit pas sur lui. Le type et la valeur changent le
   lead partagé ; portée et élément se règlent dans le dialogue d’équipe. Au
   téléphone, le motif a une place réservée sous les deux groupes ; au
   bureau, il ne paraît que s’il existe, sous le lead, sans place réservée
   (décision de l’utilisateur) : le lead ne bouge pas, seuls les rappels
   dessous descendent. ⚠️ **Aucune phrase d’explication du lead d’équipe, et jamais le
   motif « contenu de combat de la liste non défini »** (décision de
   l’utilisateur : « Je ne veux jamais le voir ») : la carte filtre ce motif
   (`motifLeadAffiche`, equipesOptimizer.ts), que le repère ⚠ de la liste et
   le rapport d’import gardent. Le lead effectif écrase le lead personnel du membre, dans ses
   critères et sa mémoire, et lui reste quand il quitte l’équipe. Voir
   ../feat-listes-equipes-et-sauvegarde.md § Lead effectif d’un membre.

   Hors équipe, changer le lead depuis cette carte efface aussi l’ancien
   champ de VIT (`leaderSpeedPct`) des critères personnels : choisir
   « Aucun » ne doit pas réactiver ce lead ancien. Si les critères ont un
   propriétaire valide, sa mémoire reçoit ce changement. Pour un membre
   lié, le même geste change le lead partagé, que chaque membre reçoit
   ensuite comme lead personnel, ancien champ de VIT effacé.

## Sets d'aura des autres monstres

   **Sets d'aura des autres monstres** — au téléphone, une troisième
   boîte d'« État de mon monstre », sous les groupes pour éviter le
   débordement ; au bureau, une section de 294 px, en tête de la
   colonne repliable « Aura, exclusion, avancés » (`SetsAuraBureau`), avec la
   même saisie (`AurasExternesSaisie`). Elle saisit `DamageSetup.setsAuraExternes` : les sets Fight,
   Determination, Enhance, Accuracy et Tolerance portés par les **autres**
   monstres de l'équipe (voir
   [effets d'équipe](../../degats-reels/)). En tête,
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
   ../feat-listes-et-reservation.md § Zone C — Monstres de la liste) — autre espèce, ou autre exemplaire de la même espèce —
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
   ../feat-listes-et-reservation.md § Zone C — Monstres de la liste). Au
   bureau, la carte des sets d'aura n'est montée que colonne ouverte : elle
   affiche le rappel sans l'annoncer, et l'annonce aux lecteurs d'écran vit
   dans la page, toujours montée, hors de la colonne.

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
   - **Au format bureau, quel que soit le pointeur** — la colonne repliable « Aura, exclusion, avancés »
     s'ouvre (jeton `guideComplements`, que `PageBureau` applique à l'état
     des onglets par `ouvrirColonne`), **puis** l'interrupteur, rendu dès
     que la colonne est ouverte, est amené à l'écran du strict nécessaire
     (`nearest`) ; l'effet se rejoue quand l'état des onglets change. En
     A3, c'est la colonne repliable qui défile, seule.
   - **Au format téléphone** — le panneau « Options de recherche » s'ouvre par-dessus
     la carte ; il reste piloté par la barre de navigation, l'écran le
     demande par la prop `onOuvrirMenu` (`App.tsx`, relayée par
     `OutilsPage.tsx`). Son contenu défile jusqu'à l'interrupteur, dernier
     réglage du panneau, sous « Exclusion de runes ».

   Dans les deux cas, l'interrupteur est surligné **3 s**, au même token que
   le rappel (contour `warn`, fond `warn-soft`). ⚠️ Il reste toujours rendu
   dans sa surface (`ReglagesAvancesContenu`, commun aux deux formats) :
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
   mon monstre » DOIT faire bouger le « +X / coup ». ⚠️ **Sauf les auras
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
   changer, il ferme. Le sous-titre dit d'abord « Décris le coup à évaluer :
   le sort, l'adversaire, et comment traiter le critique. », puis l'écho :
   « État du monstre : » suivi des buffs actifs (« buff ATQ », « buff DEF »,
   « buff VIT »), du lead (`lead <stat> +<valeur> %`, la stat nommée comme
   dans le jeu, `LEADER_SKILL_STATS`) et du cran d'invocateur (« Contenu normal » ou
   « Contenu de guilde »), séparés par « · » (`echoEtatMonstre`,
   OptimizerSection.tsx). L'écho ne nomme aucun sort : le sort se choisit
   dans la fenêtre elle-même (« Compétence utilisée »). L'écho **nomme les auras
   externes** par set, avec leur nombre (« auras externes : 2 sets Fight,
   1 set Accuracy »), ou « aucune aura externe », et dit que les sets
   d'aura du build s'y ajoutent sur chaque résultat — **sans nombre** : la
   fenêtre ne connaît aucun candidat, ces activations se résolvent par
   build (`echoAurasExternes`, `src/lib/aurasExternes.ts`).

