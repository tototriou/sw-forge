// Import qui FUSIONNE un fichier de recommandations dans la recommandation
// existante qu'il complète, au lieu d'en ajouter une de plus à côté. Spec :
// docs/02-app/siege/feat-recommandations/persistance-et-partage.md § Fusion.
//
// Cas d'usage : un même auteur (un joueur, un outil externe) republie de
// semaine en semaine la même recommandation, enrichie. Ajouter à chaque fois
// accumule des decks en double ; fusionner n'apporte que ce qui manque.
//
// ⚠️ **La fusion n'enlève et ne réécrit rien** de la recommandation existante :
// ni son nom, ni son auteur, ni ses consignes, ni un deck, ni un build, ni une
// défense visée. Elle AJOUTE seulement : les decks qu'elle n'a pas, à la fin,
// et à un deck qu'elle a déjà, les défenses qu'il ne visait pas. C'est ce qui
// permet de la proposer sans risque : rien de ce que l'utilisateur a retouché
// ne se perd.

import type { Reco, RecoCounter, RecoDeck, RecoPayload } from '../types';
import { cleEquipe, type MonstresConnus } from './recoDefenses';

/* --------------------------------------------------------------------------
 * Correspondance : quelle recommandation un fichier complète-t-il ?
 * ----------------------------------------------------------------------- */

// Comparaison des textes : sans casse, sans accents, espaces resserrés.
function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Une date en fin de nom (« Défenses — 30/10/2026 », « Offs 2026-10-30 »,
// « Siège (30.10) ») et les séparateurs qui la précèdent. Une recommandation
// datée par son auteur reste la même d'une date à l'autre.
// ⚠️ Le tiret seul ne fait une date qu'avec l'année (« 30-10-2026 ») : « Équipe
// 3-2 » n'est pas daté.
const DATE_FINALE =
  /[\s—–\-·|,:(]*(\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?|\d{1,2}-\d{1,2}-\d{4}|\d{4}-\d{1,2}-\d{1,2})\)?\s*$/;

// Le nom sans sa date finale, normalisé.
export function nomDeBase(nom: string): string {
  return normaliser(nom.replace(DATE_FINALE, ''));
}

// ⚠️ **Deux règles, dans cet ordre** :
//  1. les DEUX portent une `source` : elle seule décide. Elle est faite pour
//     ça — stable malgré un renommage par l'utilisateur ou une date dans le
//     nom —, et deux sources différentes disent deux provenances, même si
//     les noms se ressemblent ;
//  2. sinon : même auteur (non vide) ET même nom de base (non vide). C'est le
//     repli des fichiers sans source — une recommandation partagée par un
//     ami, ou importée avant que son fichier ne porte de source.
export function correspond(existante: Reco, entrante: RecoPayload): boolean {
  if (existante.source && entrante.source) return existante.source === entrante.source;
  const auteur = normaliser(existante.author);
  const nom = nomDeBase(existante.name);
  return !!auteur && !!nom && auteur === normaliser(entrante.author) && nom === nomDeBase(entrante.name);
}

// Pour chaque recommandation du fichier, celle qu'il complète (ou `null`).
// Une correspondance par la source passe avant une correspondance par le nom ;
// à égalité, la première de la liste — la plus ancienne.
export function trouverCorrespondances(existantes: Reco[], entrantes: RecoPayload[]): (Reco | null)[] {
  return entrantes.map((e) => {
    const parSource = e.source ? existantes.find((r) => r.source === e.source) : undefined;
    return parSource ?? existantes.find((r) => correspond(r, e)) ?? null;
  });
}

/* --------------------------------------------------------------------------
 * Fusion d'une recommandation dans une autre
 * ----------------------------------------------------------------------- */

// ⚠️ **Un deck et une défense visée se reconnaissent par la même clé**, celle
// de la vue Défense (`cleEquipe`, recoDefenses.ts) : même chef — le premier
// monstre, quand son lead est actif en siège — et mêmes autres monstres dans
// n'importe quel ordre ; sans chef, mêmes trois monstres dans n'importe quel
// ordre. Seul le chef change l'équipe en jeu : Solveig-Adriana-Odin et
// Solveig-Odin-Adriana sont un seul deck, Odin-Adriana-Solveig un autre.
// Un deck reconnu garde son ordre à lui.
//
// Deck entièrement vide (clé `null`) : il se reconnaît dans un autre deck vide.
const cleDeck = (deck: RecoDeck, connus: MonstresConnus): string => cleEquipe(deck.slots, connus) ?? '';

const deckVide = (d: RecoDeck) =>
  !d.note && d.counters.length === 0 && d.slots.every((s) => s.com2usId == null && !s.name);

const copieDeck = (d: RecoDeck): RecoDeck => structuredClone(d);

export interface BilanFusion {
  decksAjoutes: number; // decks nouveaux, posés à la fin
  decksEnrichis: number; // decks déjà là, qui gagnent au moins une défense
  defensesAjoutees: number; // défenses ajoutées à ces decks
  decksInchanges: number; // decks déjà là, sans rien de nouveau
}

const bilanVide = (): BilanFusion => ({ decksAjoutes: 0, decksEnrichis: 0, defensesAjoutees: 0, decksInchanges: 0 });

// Fusionne `entrante` dans `existante`. Pure : renvoie une nouvelle
// recommandation, `existante` n'est pas touchée.
//
// - Nom, auteur, consignes : ceux de l'existante, tels quels.
// - Un deck dont l'équipe existe déjà (même clé) n'est pas dupliqué : il gagne
//   seulement les défenses qu'il ne visait pas (même clé). Son ordre, ses
//   builds, ses consignes, ses défenses et leurs précisions restent les siens.
// - Un deck nouveau est ajouté à la fin, tel que le fichier le donne.
// - La `source` : celle de l'existante, ou à défaut celle du fichier — la
//   prochaine fusion se reconnaîtra ainsi sans dépendre du nom.
// `connus` : les monstres des données chargées, pour reconnaître le chef.
export function fusionnerReco(
  existante: Reco,
  entrante: RecoPayload,
  connus: MonstresConnus,
): { reco: Reco; bilan: BilanFusion } {
  const bilan = bilanVide();
  // Une recommandation réduite à son deck vide (celui que pose la création) :
  // les decks reçus le remplacent, comme une restauration (useSiegeRecos).
  const decks =
    existante.decks.length === 1 && deckVide(existante.decks[0]) ? [] : existante.decks.map((d) => d);
  const nbAvant = decks.length;
  const enrichis = new Set<number>();
  const vusAvant = new Set<number>();

  for (const recu of entrante.decks) {
    const cle = cleDeck(recu, connus);
    const i = decks.findIndex((d) => cleDeck(d, connus) === cle);
    if (i < 0) {
      decks.push(copieDeck(recu));
      bilan.decksAjoutes++;
      continue;
    }
    // Un deck ajouté par CE fichier puis revu plus loin dans le même fichier
    // n'est pas compté comme « déjà là ».
    const dejaLa = i < nbAvant;
    if (dejaLa) vusAvant.add(i);
    // Une défense vide (clé `null`) n'est jamais ajoutée.
    const connues = new Set(decks[i].counters.map((c) => cleEquipe(c.monsters, connus)));
    const nouvelles: RecoCounter[] = [];
    for (const c of recu.counters) {
      const k = cleEquipe(c.monsters, connus);
      if (k == null || connues.has(k)) continue;
      connues.add(k);
      nouvelles.push(structuredClone(c));
    }
    if (nouvelles.length === 0) continue;
    decks[i] = { ...decks[i], counters: [...decks[i].counters, ...nouvelles] };
    // Le bilan ne compte que l'enrichissement des decks DÉJÀ LÀ : un deck neuf
    // revu plus loin est un deck ajouté, avec toutes ses défenses.
    if (dejaLa) {
      bilan.defensesAjoutees += nouvelles.length;
      enrichis.add(i);
    }
  }
  bilan.decksEnrichis = enrichis.size;
  bilan.decksInchanges = [...vusAvant].filter((i) => !enrichis.has(i)).length;

  const source = existante.source ?? entrante.source;
  return { reco: { ...existante, decks, ...(source ? { source } : {}) }, bilan };
}

/* --------------------------------------------------------------------------
 * Import complet
 * ----------------------------------------------------------------------- */

export interface BilanImport extends BilanFusion {
  recosAjoutees: number; // recommandations ajoutées à part
  recosFusionnees: number; // recommandations existantes complétées
}

// Applique un import : avec `fusionner`, chaque recommandation du fichier qui
// en complète une existante y est fusionnée ; les autres (et toutes, sans
// `fusionner`) sont ajoutées à la fin, marquées « importée ». Pure.
//
// ⚠️ Une recommandation fusionnée garde sa PLACE dans la liste et son origine :
// c'est la même, complétée — pas une nouvelle reçue.
export function appliquerImport(
  existantes: Reco[],
  entrantes: RecoPayload[],
  fusionner: boolean,
  newId: () => string,
  connus: MonstresConnus,
): { recos: Reco[]; bilan: BilanImport } {
  const bilan: BilanImport = { ...bilanVide(), recosAjoutees: 0, recosFusionnees: 0 };
  const recos = [...existantes];
  const fusionnees = new Set<string>();
  for (const e of entrantes) {
    const cible = fusionner ? trouverCorrespondances(recos, [e])[0] : null;
    if (!cible) {
      recos.push({ ...structuredClone(e), id: newId(), origin: 'imported' });
      bilan.recosAjoutees++;
      continue;
    }
    const { reco, bilan: b } = fusionnerReco(cible, e, connus);
    recos[recos.indexOf(cible)] = reco;
    fusionnees.add(reco.id);
    bilan.decksAjoutes += b.decksAjoutes;
    bilan.decksEnrichis += b.decksEnrichis;
    bilan.defensesAjoutees += b.defensesAjoutees;
    bilan.decksInchanges += b.decksInchanges;
  }
  bilan.recosFusionnees = fusionnees.size;
  return { recos, bilan };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Ce que ferait la fusion, dit AVANT de choisir (dialogue de l'import).
export function apercuFusion(b: BilanFusion): string {
  const s = (n: number, sing: string, plur: string) => (n > 1 ? plur : sing);
  const parties = [
    b.decksAjoutes ? `${pluriel(b.decksAjoutes, 'deck')} ${s(b.decksAjoutes, 'nouveau', 'nouveaux')}, à la fin` : '',
    b.decksEnrichis
      ? `${pluriel(b.decksEnrichis, 'deck')} que tu as déjà ${s(b.decksEnrichis, 'gagne', 'gagnent')} ${pluriel(b.defensesAjoutees, 'défense')} ${s(b.defensesAjoutees, 'visée', 'visées')}`
      : '',
  ].filter(Boolean);
  return parties.length
    ? `${parties.join(' ; ')}.`.replace(/^./, (c) => c.toUpperCase())
    : 'Rien de nouveau : tous ses decks et leurs défenses y sont déjà.';
}

// Le message rendu après une fusion : ce qui est arrivé, puis ce qui n'est PAS
// touché — c'est la question qu'on se pose après coup.
export function messageFusion(b: BilanImport): string {
  const parties: string[] = [];
  if (b.decksAjoutes) parties.push(`${pluriel(b.decksAjoutes, 'deck')} ajouté${b.decksAjoutes > 1 ? 's' : ''}`);
  if (b.decksEnrichis)
    parties.push(
      `${pluriel(b.decksEnrichis, 'deck')} enrichi${b.decksEnrichis > 1 ? 's' : ''} de ${pluriel(b.defensesAjoutees, 'défense')}`,
    );
  if (!parties.length) parties.push('rien de nouveau, tous ses decks et leurs défenses étaient déjà là');
  const aPart = b.recosAjoutees ? ` · ${pluriel(b.recosAjoutees, 'recommandation')} ajoutée${b.recosAjoutees > 1 ? 's' : ''} à part` : '';
  return `Fusion : ${parties.join(', ')}${aPart}. Rien n'a été retiré ni modifié.`;
}
