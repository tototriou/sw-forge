// La session en cours — ce qui se décide sans Electron (testé par
// tests/bureau-session.test.ts). Les boîtes de dialogue et les messages :
// bureau/session.ts. Spec : spec/shared/sauvegarde-session.md.

import { open, rename, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';

// Le format des fichiers de session. ⚠️ Recopié de `FORMAT_SESSION`
// (src/lib/session.ts) plutôt qu'importé : le processus principal n'embarque
// pas le code de la page. Le test vérifie que les deux concordent.
export const FORMAT_FICHIER_SESSION = 'swblacksmith/session';

// Au-delà, ce n'est plus une session : un vrai compte en fait moins de 3 Mo.
const TAILLE_MAX = 64 * 1024 * 1024;

// Ce que la page voit : la session en cours, et le dossier SW Blacksmith
// (réglage) dont le sous-dossier `sessions` reçoit les sessions.
export interface EtatSession {
  chemin: string | null;
  nom: string | null;
  dossier: string | null;
}

export function etatDe(chemin: string | null, dossier: string | null): EtatSession {
  return { chemin, nom: chemin ? basename(chemin) : null, dossier };
}

// `dossier-swblacksmith.json` (dossier des données de l'app), relu avec
// méfiance : un chemin absolu, sans octet nul, ou rien.
export function lireDossierRetenu(brut: unknown): string | null {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  const d = o.dossier;
  return typeof d === 'string' && isAbsolute(d) && !d.includes('\0') ? d : null;
}

// Les sessions vivent dans le sous-dossier `sessions` du dossier SW Blacksmith.
export function dossierSessions(dossier: string): string {
  return join(dossier, 'sessions');
}

// Le premier chemin libre pour `nom` dans `dossier` : `nom.json`, sinon
// `nom (2).json`, `nom (3).json`… Deux sauvegardes dans la même minute
// portent le même nom daté : la seconde n'écrase jamais la première.
export function cheminLibre(dossier: string, nom: string, existe: (chemin: string) => boolean): string {
  const base = nom.replace(/\.json$/i, '');
  for (let n = 1; ; n++) {
    const chemin = join(dossier, n === 1 ? `${base}.json` : `${base} (${n}).json`);
    if (!existe(chemin)) return chemin;
  }
}

// Un chemin de session : absolu, en `.json`, sans octet nul.
export function cheminSessionValide(v: unknown): v is string {
  return typeof v === 'string' && isAbsolute(v) && /\.json$/i.test(v) && !v.includes('\0');
}

// `session.json` (dossier des données de l'app), relu avec méfiance : un
// fichier abîmé ne doit ni planter l'app ni inventer un chemin.
export function lireSessionRetenue(brut: unknown): string | null {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  return cheminSessionValide(o.chemin) ? o.chemin : null;
}

// Le nom que la page propose : un nom de fichier, jamais un chemin.
export function nomProposeValide(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 200 && /^[^\\/:*?"<>|\0]+\.json$/i.test(v) && !/^\.+\.json$/i.test(v);
}

// Le texte que la page demande d'écrire : une session, rien d'autre.
export function texteSessionValide(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > TAILLE_MAX) return false;
  try {
    const o = JSON.parse(v) as unknown;
    return !!o && typeof o === 'object' && (o as { format?: unknown }).format === FORMAT_FICHIER_SESSION;
  } catch {
    return false;
  }
}

// La boîte peut rendre un nom sans extension : on l'ajoute.
export function avecExtension(chemin: string): string {
  return /\.json$/i.test(chemin) ? chemin : `${chemin}.json`;
}

// ⚠️ La boîte « Sauvegarder sous » ne confirme l'écrasement que du nom TAPÉ.
// Sous Linux, elle n'ajoute pas l'extension du filtre : « ancienne » ne
// rencontre aucun conflit, puis `avecExtension` écrit `ancienne.json`. Ce cas
// demande donc une seconde confirmation, sur le nom réellement écrit.
export function confirmationApresExtension(rendu: string, existe: (chemin: string) => boolean): boolean {
  return !/\.json$/i.test(rendu) && existe(avecExtension(rendu));
}

// Le message montré quand l'écriture échoue, selon le code d'erreur du
// système.
export function messageEchec(code: unknown): string {
  switch (code) {
    case 'ENOENT':
      return 'Le dossier de la session n’existe plus. « Sauvegarder sous… » permet d’en choisir un autre.';
    case 'EACCES':
    case 'EPERM':
      return 'Ce dossier refuse l’écriture, ou le fichier est ouvert ailleurs.';
    case 'EBUSY':
      return 'Le fichier est ouvert par un autre programme.';
    case 'ENOSPC':
      return 'Le disque est plein.';
    case 'EROFS':
      return 'Ce disque est en lecture seule.';
    default:
      return `L’écriture a échoué${typeof code === 'string' ? ` (${code})` : ''}.`;
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Écrit `texte` dans `chemin` sans jamais laisser un fichier à moitié écrit :
// un fichier temporaire dans le MÊME dossier (un renommage ne traverse pas les
// disques), vidé sur le disque, puis renommé par-dessus l'ancien. Un échec
// laisse l'ancien fichier intact et retire le temporaire.
// ⚠️ Sous Windows, un antivirus ou l'indexation tiennent parfois le fichier
// un instant : le renommage est retenté avant d'abandonner.
export async function ecrireSansRisque(chemin: string, texte: string): Promise<void> {
  const temporaire = join(dirname(chemin), `.${basename(chemin)}.${process.pid}-${Date.now()}.tmp`);
  try {
    const f = await open(temporaire, 'w');
    try {
      await f.writeFile(texte, 'utf8');
      await f.sync();
    } finally {
      await f.close();
    }
    for (let essai = 0; ; essai++) {
      try {
        await rename(temporaire, chemin);
        return;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (essai >= 4 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e;
        await attendre(100);
      }
    }
  } catch (e) {
    await rm(temporaire, { force: true }).catch(() => {});
    throw e;
  }
}
