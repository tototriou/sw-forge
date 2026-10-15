// Exécution prouvée des vérifications (`main()` de tests/index.ts).
//
// Deux promesses distinctes de celle de la sélection (tests/selection.ts) :
// - tout ce qui est attendu a tourné. La liste attendue est fixée avant le
//   lancement ; chaque entrée est journalisée (invocation, retour, exception,
//   contrôles faits, ignorés), puis comparée à l'attendu. Une entrée attendue
//   jamais invoquée, invoquée sans rendre la main, exécutée sans être attendue,
//   ou rendue sans aucun contrôle, fait échouer le point d'entrée, nommée.
// - un manifeste (`--manifeste <fichier>`) dit ce qui a tourné, sur quel
//   contenu. Il est écrit au fil de l'exécution, marqué incomplet, et ne
//   devient « complet » qu'après la validation finale.
//
// ⚠️ Invariant : `complet` vaut `true` seulement quand la validation finale a
// eu lieu ; toute sortie avant (exception hors des entrées, `process.exit`
// anticipé, boucle d'événements vidée par une promesse jamais réglée, signal)
// laisse un manifeste incomplet et un code non nul.
//
// Sans import relatif : le module se charge aussi seul (Node, types effacés),
// pour qu'un consommateur du manifeste recalcule l'empreinte du contenu par la
// même fonction.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';

export type Verification = [string, () => void | Promise<void>];
export interface Compteurs { total: number; echecs: number; ignores: number; echecsDetail: string[] }

export const FORMAT_MANIFESTE = 'swblacksmith-manifeste-tests';
export const VERSION_MANIFESTE = 1;
// Le manifeste suit l'exécution à cette période au plus près : une écriture
// par entrée coûterait plus d'une seconde sur la suite complète.
const PERIODE_ECRITURE_MS = 250;

export class RefusManifeste extends Error {}

function git(racine: string, args: string[]): string {
  return execFileSync('git', args, { cwd: racine, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
}
const sha256 = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
const liste = (racine: string, args: string[]) => git(racine, args).split('\0').filter(Boolean);

/* --------------------------------------------------------------------------
 * Emplacement du manifeste
 * ----------------------------------------------------------------------- */

// Chemin physique : le plus profond ancêtre existant, résolu (jonctions et
// liens compris), suivi du reste du chemin.
function physique(p: string): string {
  const reste: string[] = [];
  let a = p;
  while (!existsSync(a)) {
    const d = dirname(a);
    if (d === a) break;
    reste.unshift(basename(a));
    a = d;
  }
  return join(realpathSync.native(a), ...reste);
}

// Hors du worktree, ou dans un dossier ignoré par Git : le manifeste n'entre
// alors ni dans la sélection ni dans l'empreinte du contenu. Tout autre chemin
// est refusé. Rend le chemin absolu.
export function emplacementManifeste(racine: string, chemin: string): string {
  const abs = resolve(chemin);
  let haut: string;
  try {
    haut = realpathSync.native(git(racine, ['rev-parse', '--show-toplevel']).trim());
  } catch (e) {
    throw new RefusManifeste(`--manifeste : dépôt Git illisible depuis ${racine} (${String((e as Error).message).split('\n')[0]})`);
  }
  const reel = physique(abs);
  const casse = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const rel = relative(casse(haut), casse(reel));
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) return abs;
  if (rel === '') throw new RefusManifeste(`--manifeste ${chemin} : c'est la racine du worktree`);
  const relGit = relative(haut, reel).split(sep).join('/');
  const dossier = posix.dirname(relGit);
  const refus = `--manifeste ${chemin} : dans le worktree (${haut}), hors d'un dossier ignoré par Git — le placer hors du worktree, ou dans un dossier ignoré (node_modules/…)`;
  // Le plus proche dossier existant : `check-ignore` ne sait pas qu'un chemin
  // absent est un dossier (et « chemin/ » absent donne de faux positifs). Un
  // dossier ignoré l'est avec tout ce qu'il contient, créé ensuite compris.
  let existant = dossier;
  while (existant !== '.' && !existsSync(join(haut, existant))) existant = posix.dirname(existant);
  if (existant === '.') throw new RefusManifeste(refus);
  try {
    git(haut, ['check-ignore', '-q', '--', existant]);
  } catch (e) {
    if ((e as { status?: number }).status === 1) throw new RefusManifeste(refus);
    throw new RefusManifeste(`--manifeste ${chemin} : git check-ignore a échoué (${String((e as Error).message).split('\n')[0]})`);
  }
  if (git(haut, ['ls-files', '--', relGit]).trim()) throw new RefusManifeste(`--manifeste ${chemin} : fichier suivi par Git`);
  return abs;
}

/* --------------------------------------------------------------------------
 * Empreintes
 * ----------------------------------------------------------------------- */

export interface EtatContenu {
  revision: string;
  arbrePropre: boolean;
  // sha256 de : l'index (`git ls-files -s -z`), puis chaque fichier suivi qui
  // diffère de l'index (chemin, sha256 des octets ou « absent »), puis chaque
  // non suivi non ignoré (chemin, sha256 des octets), triés.
  empreinte: string;
  suivisModifies: string[]; // index ou arbre de travail contre HEAD
  indexModifies: string[];
  travailModifies: string[];
  nonSuivis: string[];
}

export function etatContenu(racine: string): EtatContenu {
  const haut = git(racine, ['rev-parse', '--show-toplevel']).trim();
  const revision = git(haut, ['rev-parse', 'HEAD']).trim();
  const indexModifies = liste(haut, ['diff', '--cached', '--name-only', '-z', '--no-renames', 'HEAD']).sort();
  const travailModifies = liste(haut, ['diff', '--name-only', '-z', '--no-renames']).sort();
  const nonSuivis = liste(haut, ['ls-files', '-z', '--others', '--exclude-standard']).sort();
  const octets = (p: string) => {
    const f = join(haut, p);
    if (!existsSync(f)) return 'absent';
    return lstatSync(f).isDirectory() ? 'dossier' : sha256(readFileSync(f));
  };
  const texte = [
    'index', git(haut, ['ls-files', '-s', '-z']),
    'arbre de travail', ...travailModifies.map((p) => `${p}\0${octets(p)}`),
    'non suivis', ...nonSuivis.map((p) => `${p}\0${octets(p)}`),
  ].join('\n');
  return {
    revision,
    arbrePropre: indexModifies.length === 0 && travailModifies.length === 0 && nonSuivis.length === 0,
    empreinte: 'sha256:' + sha256(texte),
    suivisModifies: [...new Set([...indexModifies, ...travailModifies])].sort(),
    indexModifies, travailModifies, nonSuivis,
  };
}

// Les noms du registre, dans son ordre (l'ordre compte : prérequis d'ordre).
export const empreinteRegistre = (noms: string[]) => 'sha256:' + sha256(noms.join('\n'));

/* --------------------------------------------------------------------------
 * Exécution
 * ----------------------------------------------------------------------- */

type EtatEntree = 'attendue' | 'invoquée' | 'rendue' | 'exception';

interface JournalEntree {
  id: string;
  attendue: boolean;
  etat: EtatEntree;
  invocations: number;
  controles: number;
  echecs: number;
  ignores: number;
  dureeMs: number | null;
  exception: string | null;
}

export interface OptionsExecution {
  racine: string;
  manifeste: string | null; // tel que donné en argument ; vérifié ici
  registre: string[];
  bilan: () => Compteurs;
  debutVerification: (nom: string) => void;
}

export class Execution {
  private readonly o: OptionsExecution;
  private readonly chemin: string | null;
  private readonly contenu: EtatContenu | null;
  private readonly debut = Date.now();
  private readonly journal = new Map<string, JournalEntree>();
  private attendues: string[] | null = null;
  private selection: unknown = null;
  private etat: 'préparation' | 'en cours' | 'validée' | 'interrompue' = 'préparation';
  private valide = false;
  private succes: boolean | null = null;
  private cause: string | null = null;
  private constatsFinaux: string[] | null = null;
  private derniereEcriture = 0;
  private minuterie: ReturnType<typeof setTimeout> | null = null;

  // Refuse un emplacement de manifeste interdit (RefusManifeste) et un registre
  // aux noms en double (l'identifiant d'une entrée est son nom).
  constructor(o: OptionsExecution) {
    this.o = o;
    const doubles = o.registre.filter((n, i) => o.registre.indexOf(n) !== i);
    if (doubles.length) throw new Error(`registre : noms en double (${[...new Set(doubles)].join(', ')}) — l'identifiant d'une entrée est son nom`);
    this.chemin = o.manifeste === null ? null : emplacementManifeste(o.racine, o.manifeste);
    this.contenu = this.chemin === null ? null : etatContenu(o.racine);
    if (this.chemin) mkdirSync(dirname(this.chemin), { recursive: true });
    process.on('beforeExit', () => {
      if (!this.valide && !this.cause) this.cause = "boucle d'événements vide avant la validation finale (une promesse jamais réglée)";
    });
    process.on('exit', (code) => this.surSortie(code));
    for (const s of ['SIGINT', 'SIGTERM'] as const) {
      process.on(s, () => {
        if (!this.cause) this.cause = `signal ${s}`;
        process.exit(s === 'SIGINT' ? 130 : 143);
      });
    }
    this.ecrire();
  }

  // La sélection attendue, fixée avant le lancement. `selection` : ce qui l'a
  // produite (mode, filtres, sélection par fichiers modifiés), copié tel quel.
  fixer(attendues: string[], selection: unknown): void {
    if (this.attendues) throw new Error('sélection attendue déjà fixée');
    const doubles = attendues.filter((n, i) => attendues.indexOf(n) !== i);
    if (doubles.length) throw new Error(`sélection attendue : noms en double (${[...new Set(doubles)].join(', ')})`);
    this.attendues = [...attendues];
    this.selection = selection;
    for (const id of attendues) this.journal.set(id, nouvelle(id, true));
    this.etat = 'en cours';
    this.ecrire();
  }

  async lancer(liste: Verification[]): Promise<number> {
    if (!this.attendues) throw new Error('sélection attendue non fixée avant le lancement');
    for (const [nom, fn] of liste) {
      let j = this.journal.get(nom);
      if (!j) { j = nouvelle(nom, false); this.journal.set(nom, j); }
      j.etat = 'invoquée';
      j.invocations++;
      this.planifier();
      const avant = this.o.bilan();
      const t = Date.now();
      this.o.debutVerification(nom);
      try {
        await fn();
        j.etat = 'rendue';
      } catch (err) {
        j.etat = 'exception';
        j.exception = String((err as Error)?.message ?? err).split('\n')[0];
        console.error(`\n\x1b[31mLes vérifications se sont interrompues dans ${nom} :\x1b[0m`, err);
      } finally {
        const apres = this.o.bilan();
        j.controles = apres.total - avant.total;
        j.echecs = apres.echecs - avant.echecs;
        j.ignores = apres.ignores - avant.ignores;
        j.dureeMs = Date.now() - t;
      }
      // Comme avant ce contrôle : une exception arrête la suite (un test levé
      // peut laisser un état global faux) ; les suivantes sont nommées.
      if (j.etat === 'exception') break;
      this.planifier();
    }
    return this.valider();
  }

  // Comparaison attendu / exécuté, une ligne par entrée en défaut.
  private constats(): string[] {
    const c: string[] = [];
    if (!this.attendues) return ['sélection attendue jamais fixée'];
    for (const id of this.attendues) {
      const j = this.journal.get(id)!;
      if (j.etat === 'attendue') c.push(`${id} — attendue, jamais invoquée`);
      else if (j.etat === 'invoquée') c.push(`${id} — invoquée, n'a pas rendu la main`);
      else if (j.etat === 'exception') c.push(`${id} — exception : ${j.exception}`);
      else if (j.controles === 0 && j.ignores === 0) c.push(`${id} — aucun contrôle (ni ok, ni egal, ni ignore)`);
      if (j.invocations > 1) c.push(`${id} — invoquée ${j.invocations} fois`);
    }
    for (const j of this.journal.values()) if (!j.attendue) c.push(`${j.id} — exécutée sans être attendue`);
    return c;
  }

  private valider(): number {
    const constats = this.constats();
    const { total, echecs, ignores, echecsDetail } = this.o.bilan();
    const rendues = [...this.journal.values()].filter((j) => j.etat === 'rendue');
    const controlees = rendues.filter((j) => j.controles > 0);
    const ignorees = rendues.filter((j) => j.controles === 0 && j.ignores > 0);
    if (echecsDetail.length + constats.length > 0) {
      console.log('\n\x1b[31mÉchecs :\x1b[0m');
      for (const ligne of [...echecsDetail, ...constats]) console.log('  \x1b[31mKO\x1b[0m   ' + ligne);
    }
    console.log(
      `\nEntrées : ${this.attendues!.length} attendue(s), ${rendues.length} exécutée(s) — ` +
        `${controlees.length} contrôlée(s), ${ignorees.length} entièrement ignorée(s)` +
        (ignorees.length ? ` (${ignorees.map((j) => j.id).join(', ')})` : ''),
    );
    const code = echecs === 0 && constats.length === 0 ? 0 : 1;
    console.log(
      code === 0
        ? `\x1b[32m${total} vérifications passées\x1b[0m` + (ignores ? `, ${ignores} ignorée(s)` : '')
        : `\x1b[31m${echecs + constats.length} échec(s)\x1b[0m sur ${total} vérifications`,
    );
    this.constatsFinaux = constats;
    this.succes = code === 0;
    this.etat = 'validée';
    // Seul endroit où `complet` devient vrai : après la comparaison.
    this.valide = true;
    this.ecrire();
    if (this.chemin) console.log(`Manifeste : ${this.chemin} (complet)`);
    return code;
  }

  private surSortie(code: number): void {
    if (this.valide) return;
    this.cause ??= `sortie (code ${code}) avant la validation finale`;
    this.etat = 'interrompue';
    this.constatsFinaux = this.constats();
    if (this.attendues || code === 0) {
      console.error(`\n\x1b[31mExécution interrompue avant la validation finale\x1b[0m (${this.cause}) :`);
      for (const l of this.constatsFinaux) console.error('  \x1b[31mKO\x1b[0m   ' + l);
    }
    try { this.ecrire(); } catch (e) { console.error('manifeste non écrit :', e); }
    if (code === 0) process.exitCode = 1;
  }

  private planifier(): void {
    if (!this.chemin || this.minuterie) return;
    if (Date.now() - this.derniereEcriture >= PERIODE_ECRITURE_MS) { this.ecrire(); return; }
    // `unref` : la minuterie ne retient pas le processus, sinon une promesse
    // jamais réglée ne viderait plus la boucle d'événements.
    this.minuterie = setTimeout(() => { this.minuterie = null; this.ecrire(); }, PERIODE_ECRITURE_MS);
    this.minuterie.unref();
  }

  private ecrire(): void {
    if (!this.chemin) return;
    if (this.minuterie) { clearTimeout(this.minuterie); this.minuterie = null; }
    const c = this.contenu!;
    const entrees = [...this.journal.values()];
    const rendues = entrees.filter((j) => j.etat === 'rendue');
    const document = {
      format: FORMAT_MANIFESTE,
      version: VERSION_MANIFESTE,
      complet: this.valide,
      etat: this.etat,
      succes: this.succes,
      cause: this.cause,
      debut: new Date(this.debut).toISOString(),
      dureeMs: Date.now() - this.debut,
      revision: c.revision,
      arbrePropre: c.arbrePropre,
      contenu: { empreinte: c.empreinte, suivisModifies: c.suivisModifies, indexModifies: c.indexModifies, travailModifies: c.travailModifies, nonSuivis: c.nonSuivis },
      registre: { empreinte: empreinteRegistre(this.o.registre), entrees: this.o.registre.length },
      selection: this.selection,
      attendues: this.attendues,
      bilan: {
        attendues: this.attendues?.length ?? null,
        executees: rendues.length,
        controlees: rendues.filter((j) => j.controles > 0).length,
        entierementIgnorees: rendues.filter((j) => j.controles === 0 && j.ignores > 0).map((j) => j.id),
        ...(({ total, echecs, ignores }) => ({ controles: total, echecs, ignores }))(this.o.bilan()),
      },
      echecs: this.constatsFinaux,
      entrees,
    };
    writeFileSync(this.chemin, JSON.stringify(document));
    this.derniereEcriture = Date.now();
  }
}

function nouvelle(id: string, attendue: boolean): JournalEntree {
  return { id, attendue, etat: 'attendue', invocations: 0, controles: 0, echecs: 0, ignores: 0, dureeMs: null, exception: null };
}
