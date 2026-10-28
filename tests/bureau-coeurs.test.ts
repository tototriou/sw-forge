// Le nombre de cœurs physiques de l'application de bureau
// (bureau/coeursPur.ts, bureau/coeurs.ts, bureau/preload.ts, src/lib/bureau.ts).
//
// ⚠️ Une lecture fausse donnerait trop ou trop peu de Workers d'appariement ;
// une lecture en échec qui ne retomberait pas sur `null` ferait lever la page,
// ou inventerait un nombre. Les sorties des commandes sont simulées : la
// vraie lecture n'est exercée que par l'application elle-même.

import { readFileSync } from 'node:fs';
import {
  COEURS_PHYSIQUES_MAX, COMMANDE_LSCPU, COMMANDE_WINDOWS, CPUINFO, coeursDeCpuinfo, coeursDeLscpu, coeursDeWindows,
  lireCoeursPhysiques, type LecturesSysteme,
} from '../bureau/coeursPur';
import { coeursPhysiques } from '../src/lib/bureau';
import { egal, ok, titre } from './outils';

const sansCommentaires = (source: string) =>
  source.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// Un `/proc/cpuinfo` réduit à ce que la lecture regarde : deux sockets de
// deux cœurs, deux fils par cœur (8 processeurs logiques, 4 cœurs).
function cpuinfo(blocs: { physique?: string; coeur?: string }[]): string {
  return blocs
    .map((b, i) => [
      `processor\t: ${i}`, 'vendor_id\t: AuthenticAMD', 'model name\t: AMD Ryzen 7 5800X 8-Core Processor',
      ...(b.physique === undefined ? [] : [`physical id\t: ${b.physique}`]), 'siblings\t: 4',
      ...(b.coeur === undefined ? [] : [`core id\t\t: ${b.coeur}`]), 'cpu cores\t: 2', 'flags\t\t: fpu vme',
    ].join('\n'))
    .join('\n\n') + '\n\n';
}
const deuxSockets = [0, 0, 0, 0, 1, 1, 1, 1].map((p, i) => ({ physique: String(p), coeur: String(i % 2) }));

const POWERSHELL = 'D:\\Systeme Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
function lectures(sorties: { commandes?: Record<string, string | Error>; fichiers?: Record<string, string | Error> }, dossierWindows: string | undefined = 'D:\\Systeme Windows') {
  const appels: string[] = [];
  const l: LecturesSysteme = {
    dossierWindows: () => dossierWindows,
    executer: async (commande, args) => {
      appels.push(`${commande} ${args.join(' ')}`);
      const s = sorties.commandes?.[commande];
      if (s === undefined || s instanceof Error) throw s ?? new Error(`${commande} : introuvable`);
      return s;
    },
    lireFichier: async (chemin) => {
      appels.push(`lire ${chemin}`);
      const s = sorties.fichiers?.[chemin];
      if (s === undefined || s instanceof Error) throw s ?? new Error(`${chemin} : introuvable`);
      return s;
    },
  };
  return { l, appels };
}

export default async function testBureauCoeurs() {
  titre('bureau · cœurs physiques — Windows (CIM Win32_Processor.NumberOfCores)');
  egal(coeursDeWindows('8\r\n'), 8, 'un processeur de 8 cœurs');
  egal(coeursDeWindows('8\r\n8\r\n'), 16, 'deux processeurs : leurs cœurs sommés');
  egal(coeursDeWindows('\r\n  12  \r\n\r\n'), 12, 'lignes vides et espaces ignorés');
  for (const illisible of ['', '\r\n', 'huit', '8\r\nx', '-4', '4.5', '0'])
    egal(coeursDeWindows(illisible), null, `sortie illisible : ${JSON.stringify(illisible)} → null`);
  egal(coeursDeWindows(`${COEURS_PHYSIQUES_MAX + 1}`), null, `au-delà de ${COEURS_PHYSIQUES_MAX} cœurs : lecture jugée fausse`);
  ok(COMMANDE_WINDOWS.args.includes('-NoProfile')
    && COMMANDE_WINDOWS.args.some((a) => /Get-CimInstance\s+-ClassName\s+Win32_Processor\)\.NumberOfCores/.test(a)),
    'la commande : PowerShell sans profil, CIM Win32_Processor.NumberOfCores');

  titre('bureau · cœurs physiques — Linux (/proc/cpuinfo, puis lscpu)');
  egal(coeursDeCpuinfo(cpuinfo(deuxSockets)), 4, 'deux sockets × deux cœurs, deux fils par cœur : 4 paires (physical id, core id)');
  egal(coeursDeCpuinfo(cpuinfo([0, 1, 2, 3, 0, 1, 2, 3].map((c) => ({ physique: '0', coeur: String(c) })))), 4, 'un socket, 4 cœurs, 8 fils : 4');
  egal(coeursDeCpuinfo(cpuinfo([0, 1, 2].map((c) => ({ physique: '0', coeur: String(c) })))), 3, 'sans hyperthreading : un cœur par processeur logique');
  egal(coeursDeCpuinfo(cpuinfo([{ physique: '0', coeur: '0' }, { physique: '0' }])), null, 'un processeur sans « core id » : illisible (lscpu prendra le relais)');
  egal(coeursDeCpuinfo(cpuinfo([{ coeur: '0' }, { coeur: '1' }])), null, 'sans « physical id » (ARM, machine virtuelle) : illisible');
  egal(coeursDeCpuinfo(''), null, 'fichier vide : illisible');
  egal(coeursDeCpuinfo('Hardware\t: BCM2835\nSerial\t: 0000\n'), null, 'aucun bloc de processeur : illisible');
  const lscpu = '# The following is the parsable format, which can be fed to other\n# programs.\n# Core,Socket\n0,0\n1,0\n0,0\n1,0\n0,1\n1,1\n';
  egal(coeursDeLscpu(lscpu), 4, 'lscpu : 4 paires (cœur, socket) distinctes sur 6 processeurs logiques');
  egal(coeursDeLscpu('# Core,Socket\n0,0\n1,0\n2,0\n3,0\n'), 4, 'lscpu sans hyperthreading : 4');
  for (const illisible of ['', '# Core,Socket\n', '# Core,Socket\n0,\n', '# Core,Socket\n,0\n', '# Core,Socket\n0\n', '# Core,Socket\na,0\n'])
    egal(coeursDeLscpu(illisible), null, `lscpu illisible : ${JSON.stringify(illisible)} → null`);
  egal(COMMANDE_LSCPU, { commande: 'lscpu', args: ['--parse=CORE,SOCKET'] }, 'la commande : lscpu --parse=CORE,SOCKET');

  titre('bureau · cœurs physiques — la lecture par plateforme, et ses replis');
  {
    const { l, appels } = lectures({ commandes: { [POWERSHELL]: '8\r\n' } });
    egal(await lireCoeursPhysiques('win32', l), 8, 'Windows : la sortie de la commande, lue');
    egal(appels, [`${POWERSHELL} ${COMMANDE_WINDOWS.args.join(' ')}`], 'Windows : chemin absolu sous le dossier système fourni, espaces conservés');
  }
  {
    const { l } = lectures({ commandes: { [POWERSHELL]: new Error('Accès refusé') } });
    egal(await lireCoeursPhysiques('win32', l), null, 'Windows : commande en échec → null (la règle du site)');
  }
  {
    const { l } = lectures({ commandes: { [POWERSHELL]: 'Get-CimInstance : la classe est introuvable\r\n' } });
    egal(await lireCoeursPhysiques('win32', l), null, 'Windows : sortie qui n’est pas un nombre → null');
  }
  for (const dossier of ['', 'Windows', 'C:Windows']) {
    const { l, appels } = lectures({}, dossier);
    egal(await lireCoeursPhysiques('win32', l), null, 'Windows : dossier système absent ou relatif → null');
    egal(appels, [], 'Windows : aucun lancement sans chemin absolu');
  }
  {
    const { l, appels } = lectures({ commandes: { [POWERSHELL]: '8' } });
    l.dossierWindows = () => undefined;
    egal(await lireCoeursPhysiques('win32', l), null, 'Windows : SystemRoot absent → null');
    egal(appels, [], 'Windows : aucun repli sur le PATH');
  }
  {
    const { l, appels } = lectures({ fichiers: { [CPUINFO]: cpuinfo(deuxSockets) } });
    egal(await lireCoeursPhysiques('linux', l), 4, 'Linux : /proc/cpuinfo lu');
    egal(appels, [`lire ${CPUINFO}`], 'Linux : /proc/cpuinfo suffit, lscpu n’est pas lancé');
  }
  {
    const { l, appels } = lectures({ fichiers: { [CPUINFO]: cpuinfo([{ coeur: '0' }, { coeur: '1' }]) }, commandes: { lscpu } });
    egal(await lireCoeursPhysiques('linux', l), 4, 'Linux : /proc/cpuinfo illisible → lscpu');
    egal(appels, [`lire ${CPUINFO}`, 'lscpu --parse=CORE,SOCKET'], 'Linux : lscpu en second, avec ses colonnes');
  }
  {
    const { l } = lectures({ fichiers: { [CPUINFO]: new Error('ENOENT') }, commandes: { lscpu } });
    egal(await lireCoeursPhysiques('linux', l), 4, 'Linux : /proc/cpuinfo absent → lscpu');
  }
  {
    const { l } = lectures({ fichiers: { [CPUINFO]: new Error('ENOENT') }, commandes: { lscpu: new Error('lscpu introuvable') } });
    egal(await lireCoeursPhysiques('linux', l), null, 'Linux : les deux lectures en échec → null');
  }
  {
    const { l, appels } = lectures({ commandes: { 'powershell.exe': '8' } });
    egal(await lireCoeursPhysiques('darwin', l), null, 'macOS (pas une cible) : null, sans rien lancer');
    egal(appels, [], 'macOS : aucune commande, aucun fichier');
  }

  titre('bureau · cœurs physiques — côté page (src/lib/bureau.ts)');
  const g = globalThis as { swblacksmithBureau?: unknown };
  const avant = g.swblacksmithBureau;
  try {
    delete g.swblacksmithBureau;
    egal(await coeursPhysiques(), null, 'site, sans pont : null');
    const pont = (rendu: () => Promise<unknown>) => ({ bureau: true, plateforme: 'win32', coeursPhysiques: rendu });
    g.swblacksmithBureau = pont(async () => 8);
    egal(await coeursPhysiques(), 8, 'bureau : le nombre lu par le processus principal');
    for (const illisible of [null, 0, -2, 7.5, '8', Number.NaN, {}]) {
      g.swblacksmithBureau = pont(async () => illisible);
      egal(await coeursPhysiques(), null, `bureau, réponse ${JSON.stringify(illisible)} : null`);
    }
    g.swblacksmithBureau = pont(() => Promise.reject(new Error('aucun gestionnaire pour bureau:coeurs-physiques')));
    egal(await coeursPhysiques(), null, 'bureau, demande rejetée : null, sans rejet');
    g.swblacksmithBureau = { bureau: true, plateforme: 'win32' };
    egal(await coeursPhysiques(), null, 'bureau d’une version sans le canal : null, sans rejet');
  } finally {
    if (avant === undefined) delete g.swblacksmithBureau;
    else g.swblacksmithBureau = avant;
  }

  titre('bureau · cœurs physiques — le pont, contrôlé sur la source');
  const preload = sansCommentaires(readFileSync('bureau/preload.ts', 'utf8'));
  ok(/coeursPhysiques:\s*\(\):\s*Promise<number \| null>\s*=>\s*ipcRenderer\.invoke\('bureau:coeurs-physiques'\)/.test(preload),
    'préchargement : `coeursPhysiques()` demande `bureau:coeurs-physiques` (invoke), rien d’autre');
  const coeurs = sansCommentaires(readFileSync('bureau/coeurs.ts', 'utf8'));
  ok(/ipcMain\.handle\('bureau:coeurs-physiques',\s*\(e\)\s*=>\s*\{\s*if \(!deLaPage\(e\)\) return null;/.test(coeurs)
    && /e\.sender === fenetre\.webContents/.test(coeurs),
    'processus principal : le canal ne répond qu’à la page de SA fenêtre');
  ok(/lecture \?\?= lireCoeursPhysiques\(process\.platform, lecturesDuSysteme\);\s*return lecture;/.test(coeurs),
    'processus principal : lu une fois, à la première demande, puis gardé');
  ok(/execFile\(commande, \[\.\.\.args\], \{ windowsHide: true, timeout: DELAI_COMMANDE_MS/.test(coeurs),
    'processus principal : la commande, sans fenêtre et bornée dans le temps');
  ok(/dossierWindows: \(\) => process\.env\.SystemRoot/.test(coeurs),
    'processus principal : dossier système lu à l’exécution dans SystemRoot');
  const main = sansCommentaires(readFileSync('bureau/main.ts', 'utf8'));
  ok(/brancherCoeurs\(fenetre\);/.test(main), 'processus principal : le canal est branché sur la fenêtre');
  // La suite — le hook qui pose les cœurs dans la demande au Worker — se
  // vérifie sur le vrai hook, au navigateur : tests/rendu/recherche-coeurs.test.ts.
}
