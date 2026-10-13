# Navigation — bandeau petit écran

Partie de [Navigation](README.md). Le bandeau est
[MobileNotice.tsx](src/components/MobileNotice.tsx), monté dans
[App.tsx](src/App.tsx) au-dessus du contenu, sous la barre supérieure : il se
lit avant qu'on se soit fait une idée sur un affichage à l'étroit.

Il tient en une phrase : « Les courbes et l'optimiseur se lisent plus
confortablement sur un grand écran. » La navigation, les grilles et les listes
s'adaptent au téléphone ; seuls les écrans les plus denses (comparaison de
courbes, Optimizer) demandent de la largeur. Sans un mot, on croit à un site
mal fait plutôt qu'à un site consulté dans de mauvaises conditions.

- ⚠️ **Une phrase, pas un paragraphe**, et seulement ce qui est vrai : juste
  sous la barre, trois lignes prendraient un quart de l'écran.
- ⚠️ **Media query CSS (`md:hidden`), jamais de user-agent** : le sniffing se
  trompe (tablettes, mode bureau, navigateurs exotiques) et vieillit mal. Ce
  qui compte n'est pas l'appareil mais **la largeur disponible**.
- ⚠️ **Refermable, oubli volontairement court** : la fermeture vit en mémoire
  (`useStickyState`), donc elle tient pour la session et le bandeau revient à
  la visite suivante. Le persister demanderait le consentement de
  conservation — mettre un bandeau d'information dans la même balance qu'une
  prépa RTA serait disproportionné.
