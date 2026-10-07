---
name: optimizer-field-propagation
description: "Checklist pour tout ajout, renommage ou changement de type, de défaut ou de sens d'un champ TRAVERSANT de l'Optimizer (OptimizerState, OptimizerRecipe, SearchParams, RealDamageContext, entrée de résolution…) — d'abord un producteur pur unique, appelé par l'écran, la recette, les scripts et les Workers ; là où plusieurs constructeurs subsistent, chacun se vérifie, parce qu'un champ optionnel oublié dans l'un d'eux passe tsc et fait diverger un script de l'écran sans bruit."
---

# Adaptateur Codex

Lire intégralement les [instructions canoniques du skill](../../../.claude/skills/optimizer-field-propagation/SKILL.md),
puis les appliquer avant toute action couverte par ce skill. Le fichier sous
`.claude/skills/` est l'unique source de vérité.
