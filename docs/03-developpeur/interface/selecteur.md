# Ton du sélecteur

`Selecteur` vient de `src/ui/`. Son axe `ton` vaut `neutre` par défaut,
ou `accent` pour attirer l’attention sur une valeur encore manquante.
Le ton colore la bordure existante de 1 px, sans anneau ni ombre supplémentaire.
Le focus garde le comportement commun. L’appelant revient au ton neutre
dès que le choix obligatoire est renseigné ; il ne redessine pas le contrôle.
