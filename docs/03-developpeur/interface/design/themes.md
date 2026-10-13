# Système visuel — deux thèmes

Partie de [Système visuel](README.md).

## Deux thèmes, jamais trois

| Thème | Nom | Quand |
|-------|-----|-------|
| Sombre | **Forge** | `prefers-color-scheme: dark` |
| Clair | **Atelier** | `prefers-color-scheme: light`, et défaut si non exprimé |

Le thème suit le navigateur **par défaut**, et se force depuis le menu ⚙
(`Auto` / `Clair` / `Sombre`, voir [Réglage](reglage-du-theme.md#réglage-du-thème)).

⚠️ **Le choix se stocke comme un réglage, pas comme une donnée.** Il s'écrit
toujours dans `localStorage`, même persistance refusée — comme le choix de
conservation lui-même et la mesure de score (voir
[conventions](../../conventions.md#conventions-communes) (« Conventions communes »)). Un thème oublié à
chaque visite serait un bug, pas une protection.

### Pourquoi deux directions nommées et pas une palette inversée

Une inversion mécanique produit un thème clair délavé : les gris qui portaient la
profondeur en sombre deviennent des gris sales sur blanc. Forge et Atelier sont
**deux systèmes cohérents chacun**, qui partagent leur structure de tokens mais
pas leurs valeurs.

Depuis le rebranding « SW Blacksmith », les deux thèmes sont ceux
de la toile :

- **Forge** — charbon brun presque noir, **braise** (`#FF7A1A`) en accent
  unique, laiton pour les étoiles, données chiffrées en mono. La braise reste à
  distance du rouge de l'élément Feu : ΔE 9,7 (OKLab ×100).
- **Atelier** — papier chaud, encre de l'atelier, la même braise en aplat, et
  une **braise foncée** (`#A64F11`) pour tout ce qui se lit ou se trace : la
  vive tombe sous 2,6 sur fond clair (voir « Deux braises » plus bas).

Avant : Forge bleu nuit et cuivre, Atelier gris neutre et indigo.
