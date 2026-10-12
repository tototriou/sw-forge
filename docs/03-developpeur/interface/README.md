# Interface

Comment un écran se dessine, sur les deux formats. ⚠️ La règle de cadre prime sur tout arbitrage
d'interface : lire [deux-formats.md](deux-formats.md) **avant** de modifier un écran.

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| un écran, au téléphone ou à l'ordinateur | [deux-formats.md](deux-formats.md), d'abord |
| une couleur, une taille de texte, un rayon, une animation, `src/index.css`, `tailwind.config.js` | [design/](design/README.md) |
| un contrôle de `src/ui/`, ou un contrôle à ajouter | [librairie-ui/](librairie-ui/README.md) |
| `src/ui/Selecteur.tsx` et un champ obligatoire | [selecteur.md](selecteur.md) |

## Documents

| Document | Contenu |
| --- | --- |
| [deux-formats.md](deux-formats.md) | **Mobile et bureau, deux formats de premier rang** : où passe la frontière, comment l'écrire, ce qui reste global, ce qu'on vérifie avant de livrer. Prime en cas de doute. |
| [design/](design/README.md) | Le **système visuel** : les deux thèmes (Forge sombre / Atelier clair), les tokens de couleur, l'échelle typographique, le contraste, les règles de focus, de survol et de mouvement. **Source de vérité** pour toute décision d'apparence : une valeur qui n'y est pas n'a pas à être écrite en dur dans un composant. |
| [librairie-ui/](librairie-ui/README.md) | Les **composants partagés** (`src/ui/`) : bouton, pastille, champ, sélecteur, interrupteur, option, vignette. **Quels composants existent** et **comment choisir entre eux**, là où `design/` dit quelles valeurs ils emploient. ⚠️ Un composant dessiné là ne se redessine nulle part ailleurs — c'est ce qui permet de changer un bouton une fois pour toute l'app. |
| [selecteur.md](selecteur.md) | Le ton du menu déroulant partagé quand un champ obligatoire attend un choix. |
