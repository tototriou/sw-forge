# Sous-propriétés verrouillées

**Statut :** ÉTAT ACTUEL — décrit les sous-propriétés verrouillées
**Lire si :** on modifie les sous-propriétés exigées avec un minimum

   **Sous-propriétés verrouillées** — sous les deux listes, jusqu'à **8**
   sous-propriétés exigées avec un minimum chacune (« Précision Compétence 3
   ≥ 15 % »). Sert à obtenir un build qui maximise les dégâts *tout en*
   garantissant une propriété qui n'y contribue pas.

   ⚠️ **Un verrou n'a de sens que sur un emplacement CHERCHÉ.** Sur une sorte
   laissée sur « Garder l'artéfact équipé », la pièce est déjà décidée :
   exiger une sous-propriété n'en fait pas apparaître une meilleure — soit
   celle qui est portée la porte déjà, soit plus aucune paire ne passe et la
   recherche refuse de partir. Donc :
   - les sous-propriétés **exclusives** à une sorte figée disparaissent du
     menu (une ligne portable par les deux reste proposée tant qu'un
     emplacement cherche) ;
   - les **deux** emplacements figés — ce qui est le **défaut** — rendent la
     section entièrement inerte, et elle **dit pourquoi** plutôt que de
     présenter un menu vide ;
   - une ligne déjà posée qui devient sans effet est **barrée et grisée**,
     avec la raison et la conduite à tenir ; sa **croix reste active**, parce
     que la retirer est le seul geste qui serve encore.

   ⚠️ **Le minimum vaut 1 % à la pose, et ne peut pas descendre à 0**.
   Un verrou à 0 est **inerte** — `paireRespecteLignes`
   passe les lignes à `min <= 0` : la ligne s'afficherait donc comme une
   contrainte tout en n'en étant pas une, et occuperait pour rien l'un des 8
   emplacements de l'écran. Pour retirer une exigence, on retire la ligne —
   la croix est là pour ça.

   Vocabulaire de cette section, **aligné sur celui du jeu** :
   on parle d'**artéfact**, jamais de « pièce », et de
   **sous-propriété**, jamais de « ligne » ni d'« emplacement » — d'où
   « + Sous-propriété… » pour ajouter (**au singulier** : le menu en ajoute
   une à la fois), un compteur préfixé `sous-propriétés :`, et le même mot
   dans les deux diagnostics d'échec. Les commentaires de code et les
   libellés de test gardent « pièce »/« ligne », qui n'atteignent aucun
   joueur.

   - ⚠️ **Un verrou somme STRICTEMENT par code — d'où un avertissement.** Le
     jeu a **deux familles** où une forme GROUPÉE recouvre des formes simples :

     | Forme groupée | Recouvre |
     |---|---|
     | Dgts CRIT [compétence 3/4] | [Comp.3] Aug. Dgts CRIT · [Comp.4] Aug. Dgts CRIT |
     | Effet renforcement ATQ/DEF | Effet renforcement ATQ · Effet renforcement DEF |

     Au **calcul des dégâts**, elles font la même chose (sur un S3 pour la
     première, sur le buff concerné pour la seconde). Au **verrouillage**,
     non : exiger l'une ignore l'autre. Sur un inventaire mixte, le verrou
     écarterait donc une partie des pièces sans rien dire. Une ligne
     d'avertissement le signale sous la sous-propriété concernée, en nommant
     la ou les formes équivalentes.
     - La relation est **symétrique** : verrouiller la forme groupée avertit
       aussi qu'elle ignore les formes simples.
     - ⚠️ **Comp.1, Comp.2 et le renforcement de VIT n'ont aucun voisin**, et
       n'affichent donc rien : aucune forme groupée ne les recouvre. La
       relation est **déduite** de ce que chaque code couvre — les sorts pour
       les Dgts CRIT, les buffs pour les renforcements
       (`codesEquivalentsAuVerrou`, [damage.ts](src/lib/damage.ts)) — jamais
       d'une liste écrite à la main qui divergerait.
     - ⚠️ Choix **assumé de ne PAS cumuler** les formes : un verrou groupé
       serait la première ligne dont la valeur ne se lit plus sur un seul
       code, avec un plafond et une arithmétique d'emplacements à repenser.
       Dire vaut mieux que compliquer.
   - ⚠️ **Le minimum porte sur la PAIRE, pas sur un artéfact** : une même ligne
     peut tomber sur les deux artéfacts et ses valeurs s'additionnent. Le
     plafond affiché double donc pour une ligne que les deux sortes peuvent
     porter (200-299), et reste simple pour une ligne réservée à l'attribut
     (300-309) ou au type (400-411). Le champ est **borné** à ce plafond :
     au-delà, aucun inventaire ne pourrait satisfaire l'exigence.
   - ⚠️ **8 = 4 + 4, en deux moitiés qui ne se prêtent rien.** Un artéfact
     porte 4 sous-propriétés. Verrouiller 5 lignes réservées au type est donc
     impossible d'avance : un compteur `sous-propriétés : attribut x/4 ·
     type x/4` le montre
     pendant la saisie. Et au-delà du plafond d'UNE pièce, une ligne
     cumulable exige les DEUX, donc un emplacement de chaque côté.
   - Quand aucune paire ne satisfait les verrous, l'écran rapporte le
     **meilleur cumul réellement atteignable** ligne par ligne (« 35 % exigé ·
     28 % au mieux »). ⚠️ **Observé, jamais déduit** : un pré-contrôle
     théorique pourrait annoncer « impossible » sur une combinaison en fait
     réalisable, ce qui serait pire que de se taire. Chaque maximum étant pris
     ligne par ligne, deux lignes atteignables séparément peuvent ne l'être
     par aucune paire à la fois — l'écran le dit.
