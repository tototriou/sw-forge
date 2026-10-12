# Système visuel — réglage du thème

Partie de [Système visuel](README.md).

## Réglage du thème

Dans le menu ⚙ ([SettingsMenu.tsx](../../../../src/components/SettingsMenu.tsx)), un
`<Setting>` « Thème » avec un `<Segmented>` à trois options :

| Option | Comportement |
|--------|--------------|
| **Auto** (défaut) | Suit `prefers-color-scheme`, et **change à chaud** si le système bascule |
| **Clair** | Force Atelier |
| **Sombre** | Force Forge |

⚠️ **Trois états, pas un interrupteur.** Un binaire clair/sombre force à choisir
une valeur qui cesse alors de suivre le système : quelqu'un dont le téléphone
bascule le soir perdrait ce comportement sans l'avoir demandé.

Le thème s'applique par un attribut `data-theme` sur `<html>` (`light` / `dark`),
posé **avant la première peinture** par un script inline dans `index.html` —
sinon la page apparaît dans le mauvais thème le temps d'un frame.
