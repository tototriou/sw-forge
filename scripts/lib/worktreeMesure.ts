// Cycle des worktrees de comparaison : docs/03-developpeur/optimizer/harnais/scripts.md.
// La propriété reste dans une fermeture ; un chemin fourni par l’appelant
// n’est jamais, à lui seul, une autorisation de retrait.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, readlinkSync, realpathSync, rmdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

interface Lien { nom: string; cible: string; genre: 'symbolique' | 'physique'; dev: number; ino: number }
export interface WorktreeMesure {
  dossier: string;
  manifeste: string;
  lier(nom: string): 'lie' | 'absent' | 'suivi';
  retirer(): void;
}
const cle = (p: string) => process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p);
const git = (depot: string, ...args: string[]) => execFileSync('git', ['-C', depot, ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
}).trim();
const existe = (p: string) => { try { lstatSync(p); return true; } catch (e) {
  if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
  throw e;
} };
function liensDans(racine: string): string[] {
  const liens: string[] = [];
  for (const nom of readdirSync(racine)) {
    const p = join(racine, nom);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) liens.push(p);
    else if (st.isDirectory()) liens.push(...liensDans(p));
  }
  return liens;
}

export function creerWorktreeMesure(depot: string, revision: string): WorktreeMesure {
  const origine = realpathSync(depot);
  const commit = git(origine, 'rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`);
  const commun = realpathSync(git(origine, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
  const temporaire = realpathSync(tmpdir());
  const racine = mkdtempSync(join(temporaire, 'swblacksmith-mesure-'));
  const dossier = join(racine, 'code');
  const manifeste = join(racine, 'propriete.json');
  const identifiant = randomUUID();
  const liens: Lien[] = [];
  let administration = '';
  let retire = false;
  const contenu = () => JSON.stringify({ identifiant, origine, commun, commit, dossier, administration, liens }, null, 2);
  const enregistrer = () => writeFileSync(manifeste, contenu(), { flag: 'w' });
  enregistrer();
  try {
    git(origine, 'worktree', 'add', '--detach', dossier, commit);
    administration = realpathSync(git(dossier, 'rev-parse', '--absolute-git-dir'));
    writeFileSync(join(administration, 'swblacksmith-mesure'), identifiant, { flag: 'wx' });
    enregistrer();
  } catch (e) {
    throw Object.assign(new Error(`Création interrompue ; examiner ${manifeste} avant tout nettoyage : ${String(e)}`), { cause: e });
  }
  const refuser = (raison: string): never => { throw new Error(`${raison} ; worktree conservé : ${dossier} (manifeste : ${manifeste})`); };
  function verifierPropriete() {
    const rel = relative(temporaire, racine);
    if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)
      || dirname(dossier) !== racine || !rel.startsWith('swblacksmith-mesure-')) refuser('Chemin de mesure inattendu');
    if (lstatSync(racine).isSymbolicLink() || lstatSync(dossier).isSymbolicLink()
      || cle(realpathSync(racine)) !== cle(racine) || cle(realpathSync(dossier)) !== cle(dossier)) refuser('Chemin de mesure remplacé par un lien');
    const st = lstatSync(manifeste);
    if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || readFileSync(manifeste, 'utf8') !== contenu()) refuser('Manifeste modifié');
    if (cle(realpathSync(git(dossier, 'rev-parse', '--path-format=absolute', '--git-common-dir'))) !== cle(commun)
      || cle(realpathSync(git(dossier, 'rev-parse', '--absolute-git-dir'))) !== cle(administration)
      || git(dossier, 'rev-parse', 'HEAD') !== commit) refuser('Identité Git modifiée');
    if (readFileSync(join(administration, 'swblacksmith-mesure'), 'utf8') !== identifiant) refuser('Marqueur de propriété modifié');
    // Une branche ajoutée par l’appelant appartient à son travail : la garder.
    try { git(dossier, 'symbolic-ref', '--quiet', 'HEAD'); } catch (e) {
      if ((e as { status?: number }).status === 1) return;
      refuser('Lecture de la branche impossible');
    }
    refuser('Le worktree de mesure n’est plus détaché');
  }
  function verifierLien(lien: Lien) {
    const p = join(dossier, lien.nom);
    if (!existe(p)) return;
    const st = lstatSync(p);
    if (lien.genre === 'symbolique') {
      if (!st.isSymbolicLink() || cle(resolve(dirname(p), readlinkSync(p))) !== cle(lien.cible)) refuser(`Cible du lien changée : ${lien.nom}`);
    } else if (!st.isFile() || st.isSymbolicLink() || st.dev !== lien.dev || st.ino !== lien.ino) {
      refuser(`Lien physique remplacé : ${lien.nom}`);
    }
  }
  return {
    dossier, manifeste,
    lier(nom) {
      if (retire) throw new Error('Worktree déjà retiré');
      verifierPropriete();
      if (!nom || nom === '.git' || [...nom].some((c) => '\\:*?[]{}'.includes(c)) || isAbsolute(nom)
        || nom.split('/').some((p) => p === '..' || p === '.' || p === '')) refuser(`Nom de lien refusé : ${nom}`);
      if (git(dossier, 'ls-files', '--', nom) !== '') return 'suivi';
      const destination = join(dossier, nom);
      if (existe(destination)) refuser(`Destination déjà présente : ${nom}`);
      // Aucun parent de destination ne peut traverser un lien.
      let parent = dirname(destination);
      while (parent !== dossier) {
        if (existe(parent) && (lstatSync(parent).isSymbolicLink() || !lstatSync(parent).isDirectory())) refuser(`Parent de lien inattendu : ${parent}`);
        parent = dirname(parent);
      }
      const source = join(origine, nom);
      if (!existsSync(source)) return 'absent';
      const cible = realpathSync(source);
      const st = statSync(cible);
      if (!st.isDirectory() && !st.isFile()) refuser(`Source non ordinaire : ${nom}`);
      mkdirSync(dirname(destination), { recursive: true });
      // Le journal précède le lien ; un échec de création laisse une entrée
      // absente, que le retrait accepte sans toucher à une autre destination.
      const lien: Lien = { nom, cible, genre: 'symbolique', dev: st.dev, ino: st.ino };
      liens.push(lien);
      enregistrer();
      if (st.isDirectory()) symlinkSync(cible, destination, 'junction');
      else {
        try { symlinkSync(cible, destination, 'file'); }
        catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'EPERM') throw e;
          lien.genre = 'physique';
          enregistrer();
          linkSync(cible, destination);
        }
      }
      verifierLien(lien);
      return 'lie';
    },
    retirer() {
      if (retire) return;
      verifierPropriete();
      for (const lien of liens) verifierLien(lien);
      const attendus = new Set(liens.filter((l) => l.genre === 'symbolique').map((l) => cle(join(dossier, l.nom))));
      const inconnus = liensDans(dossier).filter((p) => !attendus.has(cle(p)));
      if (inconnus.length) refuser(`Lien inattendu : ${inconnus[0]}`);
      for (const lien of liens) {
        const p = join(dossier, lien.nom);
        if (existe(p)) unlinkSync(p);
        if (existe(p)) refuser(`Déliaison impossible : ${lien.nom}`);
      }
      if (liensDans(dossier).length) refuser('Lien restant avant retrait');
      git(origine, 'worktree', 'remove', '--force', dossier);
      if (existe(dossier)) refuser('Retrait Git incomplet');
      retire = true;
      unlinkSync(manifeste);
      rmdirSync(racine);
    },
  };
}

export async function avecWorktreeMesure<T>(depot: string, revision: string, noms: string[],
  action: (dossier: string) => Promise<T>): Promise<T> {
  const mesure = creerWorktreeMesure(depot, revision);
  try {
    for (const nom of noms) mesure.lier(nom);
    return await action(mesure.dossier);
  } finally {
    mesure.retirer();
  }
}