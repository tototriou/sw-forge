import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { egal, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

function nomsDesSkills(dossier: string, racine = RACINE): string[] {
  return readdirSync(join(racine, dossier), { withFileTypes: true })
    .filter((entree) => entree.isDirectory() && existsSync(join(racine, dossier, entree.name, 'SKILL.md')))
    .map((entree) => entree.name)
    .sort();
}

// `.claude/agents/` est facultatif : un dépôt sans agents n'a aucun en-tête
// d'agent à contrôler.
function agentsDeclares(racine: string): string[] {
  const dossier = join(racine, '.claude/agents');
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier).filter((nom) => nom.endsWith('.md')).map((nom) => `.claude/agents/${nom}`);
}

// Une valeur YAML nue qui contient « : » ou « # » n'est pas lisible : le
// skill ou l'agent est alors annoncé sans sa description, ou pas du tout.
function valeurYamlLisible(valeur: string): boolean {
  if (valeur.startsWith('"')) return /^"(?:[^"\\]|\\.)*"$/.test(valeur);
  if (valeur.startsWith("'")) return /^'(?:[^']|'')*'$/.test(valeur);
  return !/^[\-?:,[\]{}#&*!|>%@`]/.test(valeur) && !/: | #/.test(valeur) && !valeur.endsWith(':');
}

function enTetesDeclares(racine = RACINE): string[] {
  const fichiers = [
    ...nomsDesSkills('.claude/skills', racine).map((nom) => `.claude/skills/${nom}/SKILL.md`),
    ...nomsDesSkills('.agents/skills', racine).map((nom) => `.agents/skills/${nom}/SKILL.md`),
    ...agentsDeclares(racine),
  ];
  return fichiers.sort();
}

export default function testSkillAdapters() {
  titre('Skills et agents — dépôt sans .claude/agents/');
  const bac = mkdtempSync(join(tmpdir(), 'sw-forge-skills-'));
  try {
    for (const dossier of ['.claude/skills/essai', '.agents/skills/essai']) {
      mkdirSync(join(bac, dossier), { recursive: true });
      writeFileSync(join(bac, dossier, 'SKILL.md'), '---\nname: essai\n---\n');
    }
    let fichiers: string[] = [];
    let erreur = '';
    try { fichiers = enTetesDeclares(bac); } catch (e) { erreur = String(e); }
    egal([erreur, fichiers], ['', ['.agents/skills/essai/SKILL.md', '.claude/skills/essai/SKILL.md']],
      'sans .claude/agents/ : les skills sont listés, sans erreur');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }

  titre('Skills et agents du dépôt — en-têtes YAML lisibles');
  for (const fichier of enTetesDeclares()) {
    const enTete = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(RACINE, fichier), 'utf8'))?.[1];
    ok(enTete !== undefined, `${fichier} : en-tête présent`);
    for (const ligne of (enTete ?? '').split(/\r?\n/)) {
      const champ = /^([a-z-]+): (.+)$/.exec(ligne);
      if (champ) ok(valeurYamlLisible(champ[2]), `${fichier} : « ${champ[1]} » est une valeur YAML lisible`);
    }
  }


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
