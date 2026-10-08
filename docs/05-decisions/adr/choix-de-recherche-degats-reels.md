# Choix de recherche pour les dégâts réels

**Statut :** DÉCISION — isole les choix qui n’influent pas sur le classement des builds
**Remplace :** les sections de décision de spec/outils/degats-reels.md
**Lire si :** on modifie les statistiques pertinentes ou une majoration uniforme pour la recherche

## ⚠️ Ces lignes n'entrent PAS dans `damageRelevantStats`

Elles ajoutent pourtant de vrais dégâts proportionnels aux PV, à la DEF et à
la VIT — de quoi croire qu'il faut désormais chercher ces stats-là. **C'est
faux, et c'est une décision, pas un oubli.**

Un artéfact **amplifie** un build, il n'en déplace pas la cible : un Lushen
qui cherche des dégâts vise toujours ATQ et Dgts CRIT, qu'il porte ou non une
ligne proportionnelle à la DEF. Ces lignes **récoltent** les stats que le
build possède déjà, elles ne justifient jamais d'aller en chercher d'autres.

Les y mettre ferait travailler la rétention de l'optimiseur (`retentionKeys`,
runeBuildOptim.ts) sur des stats hors-sujet et sortirait des builds que
personne ne veut.

> Le cas où ces lignes comptent vraiment est l'INVERSE : un monstre dont
> l'objectif premier n'est pas les dégâts (tank, support) porte déjà de gros
> PV/DEF/VIT, que ces lignes convertissent en dégâts. Là, le build est déjà
> figé par un autre objectif — il n'y a rien à réorienter.


## Uniforme, donc sans effet sur le choix des runes

Contrairement aux lignes conditionnelles, une majoration élémentaire multiplie
**tous les builds à l'identique**. C'est la seule famille dont on soit certain
qu'elle ne peut jamais changer le classement d'une recherche.
