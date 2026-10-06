# Instructions Codex — SW Blacksmith

Avant toute action dans ce dépôt, lire intégralement [`CLAUDE.md`](CLAUDE.md)
à la racine, puis appliquer ses consignes au même titre que celles de ce
fichier.

Lire aussi `CLAUDE.local.md` s'il existe à la racine (consignes locales, non
suivies par Git) : intégralement, juste après `CLAUDE.md`, et l'appliquer de
même.

`CLAUDE.md` est la source canonique des règles communes à Claude Code et à
Codex. Ne pas recopier ces règles ici : toute évolution doit rester centralisée
dans ce fichier source.

Les adaptateurs de `.agents/skills/` rendent les skills du dépôt découvrables
par Codex. Lorsqu'un adaptateur s'applique, lire intégralement le `SKILL.md`
canonique qu'il référence sous `.claude/skills/` avant d'agir.
