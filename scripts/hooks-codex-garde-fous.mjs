#!/usr/bin/env node
// Garde-fou Codex public, autonome : équivalent du hook `Read` de Claude Code
// (spec/outillage/spec.md, ex-B.9). Codex n'a pas d'outil `Read` distinct, il
// lit via des commandes shell — seule la forme la PLUS COURANTE d'une lecture
// entière (`cat`/`type`/`Get-Content` sans plage) est couverte ; niveau 2,
// garde-fou, pas invariant. Exception : `invariants.md`, comme côté Claude Code.
//
// Actif dans CE dépôt, avec ou sans chantier ouvert ; sans effet hors Git,
// dans un autre dépôt, ou lancé depuis une copie non installée. Ne dépend
// d'aucun autre script. Installé par `scripts/installer-hooks.mjs`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const normaliser = p => process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p);

function refusLectureSpecEntiere(cwd, commande) {
  const m = commande.match(/(?:^|&&|\|\||;)\s*(?:cat|type|Get-Content)\s+"?([^"\s|;&]+\.md)"?\s*(?:$|&&|\|\||;)/i);
  if (!m) return null;
  const racine = cwd || process.cwd();
  const cheminAbsolu = resolve(racine, m[1]);
  const relatif = relative(racine, cheminAbsolu).replace(/\\/g, '/');
  if (!/^spec\/.*\.md$/.test(relatif)) return null;
  if (relatif === 'spec/outils/optimizer/invariants.md') return null;
  if (!existsSync(cheminAbsolu)) return null;
  let nbLignes = 0;
  try { nbLignes = readFileSync(cheminAbsolu, 'utf8').split(/\r\n|\n/).length; } catch { return null; }
  if (nbLignes <= 300) return null;
  return `REFUSÉ — lecture entière de ${relatif} (${nbLignes} lignes, > 300) sans offset. ` +
    `Ouvrir le sommaire : node scripts/spec-toc.mjs ${relatif}`;
}

function executer(entree) {
  if (entree.hook_event_name !== 'PreToolUse' || !entree.cwd) return {};
  const communGit = spawnSync('git', ['-C', entree.cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
    { encoding: 'utf8', timeout: 5000 });
  // Installation personnelle : aucun effet dans les autres dépôts ou hors Git.
  if (communGit.status !== 0) return {};
  const attendu = join(communGit.stdout.trim(), 'forge', 'installation', 'scripts', 'hooks-codex-garde-fous.mjs');
  if (normaliser(attendu) !== normaliser(fileURLToPath(import.meta.url))) return {};
  const texte = String(entree.tool_input?.command ?? entree.tool_input?.cmd ?? '');
  const refus = refusLectureSpecEntiere(entree.cwd, texte);
  if (!refus) return {};
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: refus } };
}

// Garde-fou ergonomique : une erreur interne ne bloque jamais l'outil.
try {
  console.log(JSON.stringify(executer(JSON.parse(readFileSync(0, 'utf8')))));
} catch (e) {
  console.log(JSON.stringify({ systemMessage: `Garde-fou SW Forge inactif : ${String(e?.message ?? e).slice(0, 500)}` }));
}
