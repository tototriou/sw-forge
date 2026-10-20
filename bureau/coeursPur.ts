// Le nombre de cœurs PHYSIQUES de la machine, lu par le processus principal
// de l'application de bureau (bureau/coeurs.ts) et donné à la page, qui le
// passe au Worker de recherche : le nombre de Workers d'appariement en
// dérive (`nombreDeTravailleurs`, src/workers/parallelPairing.ts).
//
// Pourquoi le bureau le lit : le navigateur n'annonce que des fils logiques
// (`navigator.hardwareConcurrency`), et `os.cpus()` de Node aussi ; la règle
// du site suppose deux fils par cœur, ce qui est faux sur une machine sans
// hyperthreading. Aucune API de Node ne donne les cœurs physiques, et aucun
// module natif n'est ajouté pour cela : une commande du système, lue ici.
//
// Ce module est PUR (aucun import d'Electron ni de Node) : les lectures du
// système lui sont passées, `tests/bureau-coeurs.test.ts` les simule.
//
// ⚠️ Toute lecture qui échoue, ou qui rend quelque chose d'illisible, rend
// `null` : la page retombe alors sur la règle du site, jamais sur un nombre
// supposé.

/** Au-delà, la lecture est jugée fausse (aucune machine de bureau n'en a autant). */
export const COEURS_PHYSIQUES_MAX = 1024;

const valide = (n: number): number | null => (Number.isInteger(n) && n >= 1 && n <= COEURS_PHYSIQUES_MAX ? n : null);

/**
 * Windows : la sortie de `(Get-CimInstance -ClassName Win32_Processor).NumberOfCores`,
 * une ligne par processeur (plusieurs sur une machine à plusieurs sockets),
 * sommées. Une ligne qui n'est pas un entier positif rend toute la lecture
 * illisible.
 */
export function coeursDeWindows(sortie: string): number | null {
  const lignes = sortie.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  if (lignes.length === 0 || !lignes.every((l) => /^\d+$/.test(l))) return null;
  return valide(lignes.reduce((somme, l) => somme + Number(l), 0));
}

/**
 * Linux : `/proc/cpuinfo`, un bloc par processeur logique ; un cœur physique
 * est une paire (`physical id`, `core id`) distincte. Un bloc de processeur
 * sans l'une ou l'autre (processeurs ARM, certaines machines virtuelles) rend
 * la lecture illisible : `lscpu` prend alors le relais.
 */
export function coeursDeCpuinfo(texte: string): number | null {
  const paires = new Set<string>();
  let processeurs = 0;
  for (const bloc of texte.split(/\r?\n\s*\r?\n/)) {
    const champs = new Map<string, string>();
    for (const ligne of bloc.split(/\r?\n/)) {
      const i = ligne.indexOf(':');
      if (i > 0) champs.set(ligne.slice(0, i).trim(), ligne.slice(i + 1).trim());
    }
    if (!champs.has('processor')) continue;
    processeurs++;
    const physique = champs.get('physical id');
    const coeur = champs.get('core id');
    if (physique === undefined || coeur === undefined || physique === '' || coeur === '') return null;
    paires.add(`${physique}:${coeur}`);
  }
  return processeurs === 0 ? null : valide(paires.size);
}

/**
 * Linux, second essai : la sortie de `lscpu --parse=CORE,SOCKET`, une ligne
 * `cœur,socket` par processeur logique (les lignes `#` sont des
 * commentaires) ; un cœur physique est une paire distincte. Un champ vide
 * rend la lecture illisible.
 */
export function coeursDeLscpu(sortie: string): number | null {
  const paires = new Set<string>();
  for (const brute of sortie.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (ligne === '' || ligne.startsWith('#')) continue;
    const [coeur, socket] = ligne.split(',').map((c) => c.trim());
    if (coeur === undefined || socket === undefined || !/^\d+$/.test(coeur) || !/^\d+$/.test(socket)) return null;
    paires.add(`${socket}:${coeur}`);
  }
  return paires.size === 0 ? null : valide(paires.size);
}

/** Les lectures du système, passées par bureau/coeurs.ts (simulées par les tests). */
export interface LecturesSysteme {
  /** Lance une commande, rend sa sortie standard ; rejette si elle échoue. */
  executer: (commande: string, args: readonly string[]) => Promise<string>;
  /** Lit un fichier texte ; rejette s'il manque. */
  lireFichier: (chemin: string) => Promise<string>;
}

// La commande Windows : PowerShell, présent sur toute version prise en
// charge ; sans profil ni interaction, pour une sortie nue.
export const COMMANDE_WINDOWS = {
  commande: 'powershell.exe',
  args: ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance -ClassName Win32_Processor).NumberOfCores'],
} as const;
export const CPUINFO = '/proc/cpuinfo';
export const COMMANDE_LSCPU = { commande: 'lscpu', args: ['--parse=CORE,SOCKET'] } as const;

const ouNull = async (lecture: () => Promise<number | null>): Promise<number | null> => {
  try {
    return await lecture();
  } catch {
    return null;
  }
};

/**
 * Le nombre de cœurs physiques sur `plateforme` (`process.platform`), ou
 * `null` : plateforme sans lecture (macOS n'est pas une cible), commande ou
 * fichier en échec, sortie illisible. Ne rejette jamais.
 */
export async function lireCoeursPhysiques(plateforme: string, lectures: LecturesSysteme): Promise<number | null> {
  if (plateforme === 'win32') {
    return ouNull(async () => coeursDeWindows(await lectures.executer(COMMANDE_WINDOWS.commande, COMMANDE_WINDOWS.args)));
  }
  if (plateforme === 'linux') {
    const parCpuinfo = await ouNull(async () => coeursDeCpuinfo(await lectures.lireFichier(CPUINFO)));
    if (parCpuinfo !== null) return parCpuinfo;
    return ouNull(async () => coeursDeLscpu(await lectures.executer(COMMANDE_LSCPU.commande, COMMANDE_LSCPU.args)));
  }
  return null;
}
