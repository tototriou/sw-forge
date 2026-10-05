import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { egal, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

function nomsDesSkills(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier), { withFileTypes: true })
    .filter((entree) => entree.isDirectory() && existsSync(join(RACINE, dossier, entree.name, 'SKILL.md')))
    .map((entree) => entree.name)
    .sort();
}

export default function testSkillAdapters() {
  titre('Skills du dépôt — adaptateurs Codex');
  const canoniques = nomsDesSkills('.claude/skills');
  const adaptateurs = nomsDesSkills('.agents/skills');
  egal(adaptateurs, canoniques, 'chaque skill canonique possède un adaptateur homonyme, sans adaptateur orphelin');
  for (const nom of adaptateurs) {
    const contenu = readFileSync(join(RACINE, '.agents/skills', nom, 'SKILL.md'), 'utf8');
    ok(new RegExp(`^name: ${nom}$`, 'm').test(contenu), `${nom} : le nom déclaré correspond au dossier`);
    ok(/^description: .+$/m.test(contenu), `${nom} : la description de découverte est présente`);
    if (contenu.includes('# Adaptateur Codex')) {
      egal(
        /\[instructions canoniques du skill\]\(([^)]+)\)/.exec(contenu)?.[1],
        `../../../.claude/skills/${nom}/SKILL.md`,
        `${nom} : l'adaptateur pointe vers le skill canonique`,
      );
    }
  }
}
