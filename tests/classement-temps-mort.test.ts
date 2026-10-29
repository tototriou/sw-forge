// Le temps mort du classeur ne passe jamais devant les NOTES de la file :
// la vraie tranche du Worker (`CorpsClassement.tranche`) et un résolveur
// séparé, sur une horloge virtuelle. Une réponse qui arrive pendant une
// tranche attend la fin de cette tranche ; aucune tranche ne doit alors
// contenir de temps mort, ni pendant qu'une note est en vol, qu'une réponse
// notée attend ou que la file a encore à noter. La confirmation en fond
// (verdict sans note), au plus bas niveau, ne le retient pas : sa réponse
// attend au plus une tranche de temps mort (1 ms).
import { CorpsClassement, type VueClassement } from '../src/lib/classementCompact';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import type { ContexteResultat } from '../src/lib/contexteResultat';
import type { BuildCandidate } from '../src/lib/runeBuildOptim';
import { CorpsResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import { population } from './classement-notes-de-base.test';
import { egal, ok, titre } from './outils';

interface Bilan {
  /** Pas de temps mort faits pendant que la file avait des notes à faire. */
  pasPendantLaFile: number;
  /** Confirmations demandées, et leurs réponses retenues derrière du temps mort, au plus longtemps (ms). */
  confirmations: number;
  confirmationsRetenues: number;
  attenteMaxConfirmation: number;
  /** Pas de temps mort faits en tout. */
  pasDeTempsMort: number;
  /** Réponses arrivées pendant une tranche qui a fait du temps mort après leur arrivée. */
  reponsesRetenues: number;
  /** Temps virtuel (ms) que ces réponses ont attendu derrière du temps mort. */
  attenteDerriereLeTempsMort: number;
  reponses: number;
  fin: number;
}

/**
 * `duree` : ms de résolution par build ; `pas` : ms par lecture d'horloge
 * (un pas de tâche ou de temps mort). Le résolveur traite ses demandes une à
 * une, en parallèle du classeur ; une réponse arrive au classeur entre deux
 * tranches, comme un message.
 */
function simuler(photo: ContexteResultat, candidats: readonly BuildCandidate[], vue: VueClassement, e: { duree: number; pas: number }): Bilan {
  const resolution = new CorpsResolution();
  const versClasseur: { pret: number; r: ReponseResolution }[] = [];
  const confirmations = new Set<number>();
  const estConfirmation = (r: ReponseResolution) => confirmations.has(r.idDemande);
  let t = 0, resolveurLibre = 0, tranchePrevue = true;
  const corps = new CorpsClassement({ publier: () => {},
    resoudre: (m) => {
      if (m.type === 'confirmer') confirmations.add(m.idDemande);
      for (const r of resolution.recevoir(m)) versClasseur.push({ pret: t, r });
    },
    incident: (raison) => { throw new Error(raison); } }, true, 'distante');
  const pilote = () => (corps as unknown as { pilote: { demandesEnVol: number; demandesDeNoteEnVol: number } }).pilote;
  const notesEnAttente = () => (corps as unknown as { reponsesEnAttente: ReponseResolution[] }).reponsesEnAttente.filter((r) => !estConfirmation(r)).length;
  const bilan: Bilan = { pasPendantLaFile: 0, confirmations: 0, confirmationsRetenues: 0, attenteMaxConfirmation: 0,
    pasDeTempsMort: 0, reponsesRetenues: 0, attenteDerriereLeTempsMort: 0, reponses: 0, fin: 0 };
  // Le compte des pas de temps mort, sur la méthode même que la tranche appelle.
  const avancerAuRepos = corps.avancerAuRepos.bind(corps);
  let reposDeLaTranche: number[] = [];
  corps.avancerAuRepos = () => {
    const fait = avancerAuRepos();
    if (fait) {
      bilan.pasDeTempsMort++; reposDeLaTranche.push(t);
      if (pilote().demandesDeNoteEnVol > 0 || notesEnAttente() > 0 || versClasseur.some((x) => !estConfirmation(x.r))) bilan.pasPendantLaFile++;
    }
    return fait;
  };
  corps.ouvrir(photo, 1, vue, 1);
  const colonnes = creerColonnesCandidats(); candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
  corps.sceller(1, candidats.length, lots.length - 1, { explored: 1, truncated: false, nearMissByCondition: [], globalNearMiss: null });
  // Le résolveur, libre, prend sa demande suivante : sa réponse part `duree` ms plus tard.
  const resolveur = () => {
    if (t < resolveurLibre) return;
    const r = resolution.etape();
    if (r) { resolveurLibre = t + e.duree; versClasseur.push({ pret: resolveurLibre, r }); }
  };
  for (let garde = 0; garde < 2_000_000; garde++) {
    resolveur();
    if (tranchePrevue) {
      const debut = t;
      reposDeLaTranche = [];
      tranchePrevue = corps.tranche(() => (t += e.pas));
      // Les réponses arrivées pendant la tranche ont attendu sa fin ; derrière son temps mort, s'il en a fait après elles.
      for (const { pret, r } of versClasseur) {
        if (pret <= debut || pret > t) continue;
        const apres = reposDeLaTranche.filter((x) => x > pret);
        if (!apres.length) continue;
        const attente = t - Math.max(pret, apres[0] - e.pas);
        if (estConfirmation(r)) { bilan.confirmationsRetenues++; bilan.attenteMaxConfirmation = Math.max(bilan.attenteMaxConfirmation, attente); }
        else { bilan.reponsesRetenues++; bilan.attenteDerriereLeTempsMort += attente; }
      }
    }
    // Les demandes envoyées pendant la tranche : le résolveur libre s'y met aussitôt.
    resolveur();
    // Les messages arrivés : chacun traité par `onmessage`, qui programme une tranche.
    versClasseur.sort((a, b) => a.pret - b.pret);
    let livre = false;
    while (versClasseur.length && versClasseur[0].pret <= t) {
      corps.recevoirResolution(versClasseur.shift()!.r, t); bilan.reponses++; livre = tranchePrevue = true;
    }
    if (livre || tranchePrevue) continue;
    // Rien à faire au classeur : le temps passe jusqu'au prochain message.
    if (!versClasseur.length) break;
    t = Math.max(t, versClasseur[0].pret);
  }
  bilan.fin = t;
  bilan.confirmations = confirmations.size;
  ok(!corps.travailEnCours && pilote().demandesEnVol === 0, `simulation finie à ${t.toFixed(0)} ms virtuelles, ${bilan.reponses} réponses reçues`);
  return bilan;
}

export function testClassementTempsMortApresLaFile() {
  titre('Classeur — temps mort : jamais devant une réponse du résolveur, ni tant que la file a du travail (vraie tranche, horloge virtuelle)');
  const { photo, candidats, vue } = population({ nombre: 1200, avecFile: true });
  const b = simuler(photo, candidats, vue, { duree: 3, pas: 0.01 });
  // Un groupe de doublons se résout une fois : moins de réponses que de builds vérifiés.
  ok(b.reponses >= 250, `${b.reponses} réponses : la file a vérifié ses builds jusqu'à K`);
  ok(b.pasDeTempsMort > 0, `${b.pasDeTempsMort} pas de temps mort une fois la file finie`);
  egal({ pendantLaFile: b.pasPendantLaFile, retenues: b.reponsesRetenues, attente: Math.round(b.attenteDerriereLeTempsMort) }, { pendantLaFile: 0, retenues: 0, attente: 0 },
    'aucun pas de temps mort pendant les notes de la file, aucune réponse notée retenue derrière lui');
  ok(b.confirmations > 0 && b.attenteMaxConfirmation <= 1 + 0.01,
    `confirmation en fond : ${b.confirmations} demandes, ${b.confirmationsRetenues} réponse(s) derrière du temps mort, ${b.attenteMaxConfirmation.toFixed(2)} ms au plus (une tranche de temps mort, 1 ms)`);
}
