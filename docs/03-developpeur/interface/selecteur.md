# Ton du sélecteur

**Statut :** ÉTAT ACTUEL — décrit le ton du menu déroulant partagé
**Lire si :** un champ obligatoire doit signaler qu’il attend un choix

`Selecteur` vient de `src/ui/`. Son axe `ton` vaut `neutre` par défaut,
ou `accent` pour attirer l’attention sur une valeur encore manquante.
Le ton colore la bordure existante de 1 px, sans anneau ni ombre supplémentaire.
Le focus garde le comportement commun. L’appelant revient au ton neutre
dès que le choix obligatoire est renseigné ; il ne redessine pas le contrôle.
