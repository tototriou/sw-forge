// Garde-fou du message de commit (`.githooks/commit-msg`) —
// spec/outillage/qualite-code.md, « Message de commit ».
//
// Le hook source est lancé tel quel sur un fichier de message, comme Git le
// lance une fois installé. Tout se passe dans un dossier temporaire.

import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(RACINE, '.githooks', 'commit-msg');

export function testCommitMsg() {
  titre('commit-msg — forme du sujet, ligne vide, messages écrits par Git');
  const bac = mkdtempSync(join(tmpdir(), 'swblacksmith-commit-msg-'));
  const fichier = join(bac, 'COMMIT_EDITMSG');
  const lancer = (message: string | Buffer) => {
    writeFileSync(fichier, message);
    const r = spawnSync(process.execPath, [HOOK, fichier], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: r.status ?? 1, sortie: (r.stdout ?? '') + (r.stderr ?? '') };
  };
  // Un refus se reconnaît à son diagnostic : un hook qui plante sort aussi en 1.
  const refuse = (message: string | Buffer, motif: RegExp) => {
    const r = lancer(message);
    return r.code === 1 && /REFUSÉ — /.test(r.sortie) && motif.test(r.sortie);
  };
  const passe = (message: string | Buffer) => lancer(message).code === 0;
  const SUJET = /REFUSÉ — sujet hors de la forme/;
  try {
    const acceptes: [string, string][] = [
      ['feat(siege): cherche une équipe par monstre\n', 'type et portée'],
      ['fix: le tri garde la mesure\n', 'sans portée'],
      ['feat(compte)!: nouveau format d’export\n', 'changement incompatible'],
      ['chore(release): v2.0.1\n\nCorps.\n\nCo-Authored-By: X <x@y>\n', 'corps après une ligne vide'],
      ['fix(outils): `code` cité\r\n\r\nCorps.\r\n', 'fins de ligne CRLF'],
      ['\n\nfeat: lignes vides en tête\n', 'lignes vides en tête'],
      ['# Please enter the commit message\nfeat: x\n# commentaire\n', 'commentaires de Git ignorés'],
      ['feat: x\n\n# ------------------------ >8 ------------------------\nNe pas toucher\n', 'coupé à la ligne de ciseaux'],
      ["Merge branch 'forge/x' into release/v2.0.1\n", 'fusion écrite par Git'],
      ['Merge forge/x into release/v2.0.0 — sujet\n', 'fusion écrite à la main'],
      ['Revert "feat: x"\n\nThis reverts commit abc.\n', 'revert écrit par Git'],
      ['fixup! feat: x\n', 'fixup!'],
      ['squash! feat: x\n', 'squash!'],
      ['', 'message vide : Git l’abandonne lui-même'],
      ['# seulement des commentaires\n', 'commentaires seuls'],
    ];
    for (const [message, libelle] of acceptes) ok(passe(message), `${libelle} : accepté`);

    const sujets: [string, string][] = [
      ['Ajout du lint\n', 'sans type'],
      ['feature: x\n', 'type inconnu'],
      ['feat:x\n', 'sans espace après les deux-points'],
      ['feat: \n', 'description vide'],
      ['feat(): x\n', 'portée vide'],
      ['Feat: x\n', 'type en capitales'],
      ['wip\n', 'mot seul'],
    ];
    for (const [message, libelle] of sujets) ok(refuse(message, SUJET), `${libelle} : refusé`);

    ok(refuse('feat: x\nCorps collé.\n', /REFUSÉ — pas de ligne vide/), 'corps collé au sujet : refusé');
    ok(refuse(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('feat: x\n')]), /REFUSÉ — le message commence par une marque/),
      'BOM en tête (here-string PowerShell) : refusé, cause nommée');
    const r = lancer('Ajout du lint\nCorps collé.\n');
    ok(r.code === 1 && SUJET.test(r.sortie) && /pas de ligne vide/.test(r.sortie), 'deux fautes : les deux sont citées');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
