#!/usr/bin/env node
// Adaptateur Codex. Aucun report, commit ou changement de droits ici.
// Les contrôles métier sont exécutés par l'outil chantier installé à côté.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const outil = join(dirname(fileURLToPath(import.meta.url)), 'chantier.mjs');
const nettoyer = s => String(s || '').replace(/\x1b\[[0-9;]*m/g, '').slice(-5000);
const normaliser = p => process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p);
function appeler(cwd, args) {
  const r = spawnSync(process.execPath, [outil, ...args], { cwd, encoding: 'utf8', timeout: 20000 });
  if (r.status !== 0) throw new Error(nettoyer(r.stderr || r.stdout || r.error?.message));
  return r.stdout;
}
function enregistrer(chemin, etat) {
  mkdirSync(dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.${randomUUID()}.tmp`;
  writeFileSync(temporaire, JSON.stringify(etat) + '\n');
  renameSync(temporaire, chemin);
}
function contexte(cwd) { return JSON.parse(appeler(cwd, ['contexte-hooks'])); }

// Équivalent Codex du hook `Read` de Claude Code (CADRAGE-rangement-specs.md,
// B.9) : Codex n'a pas d'outil `Read` distinct, il lit via des commandes
// shell — seule la forme la PLUS COURANTE d'une lecture entière (`cat`/`type`/
// `Get-Content` sans plage) est couverte ; niveau 2, garde-fou, pas invariant.
// Exception : `invariants.md`, comme côté Claude Code.
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
  if (!entree.cwd || !entree.session_id) throw new Error('Événement Codex sans cwd ou session_id.');
  const evenement = entree.hook_event_name;
  const communGit = spawnSync('git', ['-C', entree.cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
    { encoding: 'utf8', timeout: 5000 });
  // Installation personnelle : aucun effet dans les autres dépôts ou hors Git.
  if (communGit.status !== 0) return {};
  const commun = communGit.stdout.trim();
  const attendu = join(commun, 'forge', 'installation', 'scripts', 'hooks-codex.mjs');
  if (normaliser(attendu) !== normaliser(fileURLToPath(import.meta.url))) return {};
  const c = contexte(entree.cwd);
  if (!c.actif) return {};
  const cle = createHash('sha256').update(entree.session_id).digest('hex');
  const chemin = join(commun, 'forge', 'etat', 'sessions-codex', `${cle}.json`);
  let etat = existsSync(chemin) ? JSON.parse(readFileSync(chemin, 'utf8')) : null;
  if (etat && etat.nom !== c.nom) throw new Error('La session Codex a changé de chantier. Ouvrir une nouvelle session.');
  if (!etat || evenement === 'UserPromptSubmit') {
    etat = { nom: c.nom, base: c.empreinte, pause: false };
    enregistrer(chemin, etat);
  }
  const commande = `node "${outil}"`;
  if (evenement === 'SessionStart') return { hookSpecificOutput: { hookEventName: evenement,
    additionalContext: `Chantier ${c.nom}, branche ${c.branche}, worktree ${c.depotCode}. ` +
      `Après les modifications : ${commande} livrer --chantier ${c.nom}, puis verifier. ` +
      `Dès qu’un lot de notes est validé, lancer integrer --chantier ${c.nom} pour avancer et sauvegarder le main documentaire, sans attendre le main du code. ` +
      `Respecter les responsabilités et le créneau de benchmark convenus. ` +
      `Pour une pause ou un blocage réel : node "${fileURLToPath(import.meta.url)}" pause ${entree.session_id} "motif".`,
  } };
  if (evenement === 'PreToolUse') {
    // Détection conservatrice des formes Git usuelles, pas un analyseur de shell.
    // Les commandes indirectes/alias ne sont pas une frontière de sécurité.
    const texte = String(entree.tool_input?.command ?? entree.tool_input?.cmd ?? '');
    const refusLecture = refusLectureSpecEntiere(entree.cwd, texte);
    if (refusLecture) {
      return { hookSpecificOutput: { hookEventName: evenement, permissionDecision: 'deny', permissionDecisionReason: refusLecture } };
    }
    if (/\bgit(?:\.exe)?\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+)?(?:merge|rebase|cherry-pick)\b/.test(texte)) {
      for (const contribution of c.contributions) {
        appeler(contribution.depotCode, ['verifier', '--chantier', contribution.nom]);
      }
    }
    return {};
  }
  if (evenement === 'Stop') {
    if (etat.pause || etat.base === c.empreinte) return {};
    try { appeler(entree.cwd, ['verifier', '--chantier', c.nom]); return {}; }
    catch (e) {
      if (entree.stop_hook_active || etat.relance) return { systemMessage:
        `Chantier ${c.nom} encore ouvert : livraison non validée. ${e.message}` };
      etat.relance = true;
      enregistrer(chemin, etat);
      return { decision: 'block', reason: `Le chantier ${c.nom} a changé pendant ce tour et sa livraison n’est pas valide. ` +
        `Terminer les vérifications et la livraison autorisées (${commande} livrer --chantier ${c.nom}, puis verifier). ` +
        `Pour un lot de notes validé, lancer ensuite integrer --chantier ${c.nom}. ` +
        `Ne pas committer de travail étranger pour satisfaire le hook. Si une pause ou une intervention est nécessaire, ` +
        `l’annoncer explicitement et utiliser la commande pause du hook.\n${e.message}` };
    }
  }
  return {};
}

try {
  if (process.argv[2] === 'pause') {
    const [session, ...motif] = process.argv.slice(3);
    if (!session || !motif.join(' ').trim()) throw new Error('pause exige un identifiant de session et un motif.');
    const c = contexte(process.cwd());
    if (!c.actif) throw new Error('Aucun chantier actif.');
    const cle = createHash('sha256').update(session).digest('hex');
    const chemin = join(c.commun, 'forge', 'etat', 'sessions-codex', `${cle}.json`);
    const etat = JSON.parse(readFileSync(chemin, 'utf8'));
    if (etat.nom !== c.nom) throw new Error('La session appartient à un autre chantier.');
    enregistrer(chemin, { ...etat, pause: true, motif: motif.join(' ') });
    console.log('Pause enregistrée pour ce tour ; le chantier reste ouvert.');
  } else {
    const entree = JSON.parse(readFileSync(0, 'utf8'));
    try { console.log(JSON.stringify(executer(entree))); }
    catch (e) {
      const message = `Contrôle du chantier impossible : ${nettoyer(e.message)}. Ce n’est pas une preuve de livraison invalide.`;
      console.log(JSON.stringify(entree.hook_event_name === 'PreToolUse'
        ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message } }
        : { systemMessage: message }));
    }
  }
} catch (e) { console.error(nettoyer(e.message)); process.exitCode = 1; }
