import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MessageChannel as CanalNode } from 'node:worker_threads';
import { Relance, cederLaMain } from '../src/lib/cession';
import { egal, ok, titre } from './outils';

/** Une cession pilotée par le test : rien ne part tant qu'il ne la libère pas. */
function cessionManuelle() {
  const enAttente: (() => void)[] = [];
  return {
    ceder: () => new Promise<void>((r) => { enAttente.push(r); }),
    liberer: async () => { enAttente.shift()?.(); await Promise.resolve(); await Promise.resolve(); },
    nombre: () => enAttente.length,
  };
}

export async function testClassementCessionOrdre() {
  titre('Classeur — relance par tranches : une seule en attente, annulation, ordre');
  const c = cessionManuelle(), journal: string[] = [];
  let reste = 3;
  const relance = new Relance(() => { journal.push(`tranche ${4 - reste}`); if (--reste > 0) relance.programmer(); }, c.ceder);
  relance.programmer(); relance.programmer(); relance.programmer();
  egal(c.nombre(), 1, 'trois demandes pendant une attente : une seule cession');
  await c.liberer();
  egal(journal, ['tranche 1'], 'la tranche ne part qu’à la cession');
  ok(relance.enAttente && c.nombre() === 1, 'la tranche se reprogramme elle-même, une cession à la fois');
  relance.annuler();
  await c.liberer();
  egal(journal, ['tranche 1'], 'annulée : la cession en vol ne lance plus rien');
  relance.programmer(); await c.liberer(); await c.liberer();
  egal(journal, ['tranche 1', 'tranche 2', 'tranche 3'], 'après annulation, une nouvelle relance reprend dans l’ordre');
  ok(!relance.enAttente && c.nombre() === 0, 'travail fini : plus aucune cession en attente');
}

export async function testClassementCessionSansAffamement() {
  titre('Classeur — une tranche qui se relance sans fin laisse passer les messages reçus');
  // Vrai message de canal de Node : la cession prend son tour derrière les
  // messages déjà arrivés, comme dans le Worker (annulation, crédit, réponse).
  const entrants = new CanalNode(), recus: { message: number; tranche: number }[] = [];
  let tranches = 0, envoyesA = 0;
  const fini = new Promise<void>((accepter) => {
    entrants.port1.on('message', (m: number) => { recus.push({ message: m, tranche: tranches }); });
    const relance = new Relance(() => {
      tranches++;
      // Une tranche occupée, puis des messages envoyés PENDANT elle.
      const fin = Date.now() + 1;
      while (Date.now() < fin) { /* tranche */ }
      if (tranches === 5 || tranches === 40) { envoyesA = tranches; for (let i = 0; i < 3; i++) entrants.port2.postMessage(tranches * 10 + i); }
      if (tranches < 80) relance.programmer(); else accepter();
    });
    for (let i = 0; i < 3; i++) entrants.port2.postMessage(i);
    relance.programmer();
  });
  await fini;
  entrants.port1.close(); entrants.port2.close();
  egal(recus.map((r) => r.message), [0, 1, 2, 50, 51, 52, 400, 401, 402], 'tous les messages reçus, dans leur ordre d’envoi');
  const retards = recus.map((r) => r.tranche - (r.message < 10 ? 0 : Math.floor(r.message / 10)));
  ok(retards.every((t) => t >= 0 && t <= 2), `chaque message passe au plus deux tranches après son arrivée (retards ${JSON.stringify(retards)}, dernier envoi à la tranche ${envoyesA})`);
}

export async function testClassementCessionCanal() {
  titre('Classeur — cession par message de canal, repli sans MessageChannel, coquille sans setTimeout');
  let canaux = 0;
  const Compte = class extends CanalNode { constructor() { super(); canaux++; } } as unknown as new () => MessageChannel;
  await cederLaMain(Compte);
  egal(canaux, 1, 'un message de canal par cession');
  let minuteries = 0;
  const original = globalThis.setTimeout;
  globalThis.setTimeout = ((f: () => void) => { minuteries++; return original(f, 0); }) as typeof setTimeout;
  try { await cederLaMain(null); } finally { globalThis.setTimeout = original; }
  egal(minuteries, 1, 'repli setTimeout seulement sans MessageChannel');
  const coquille = readFileSync(resolve('src/workers/classement.worker.ts'), 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/setTimeout|clearTimeout/.test(coquille) && /new Relance\(/.test(coquille) && /relance\.annuler\(\)/.test(coquille),
    'le Worker de classement relance ses tranches par Relance et l’annule à la libération et en faute');
}
