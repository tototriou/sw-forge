import { exclusionSelectorKey, type ExclusionSelector, type ExclusionSourceData, type OptimizerList, type OptimizerListMember, type ValidatedBuild } from './optimizerExclusion';
import { ecrireMembresOptimizer, lireMembresOptimizer, reverifierStockageOptimizer, selecteurValide, type StockageOptimizer } from './optimizerMemberStorage';

export const OPTIMIZER_BACKUP_STORAGE_KEY = 'swblacksmith-optimizer-backup-v1';
export interface SelectionPointOptimizer { listId: string; selector: ExclusionSelector }
export interface HistoriquePointOptimizer {
  lists: OptimizerList[];
  members: OptimizerListMember[];
  validated: ValidatedBuild[];
  activeListId: string | null;
}
export interface PointOptimizer {
  version: 1;
  date: string;
  historique: HistoriquePointOptimizer;
  /** Texte du stockage indépendant : ses rejets et champs inconnus restent dans la photo. */
  membres: string;
  selection: SelectionPointOptimizer | null;
}
const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const idsValides = (v: unknown): v is number[] => Array.isArray(v) && v.every(id => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);

/** La photo est détachée : une mutation ultérieure ne change jamais le point. */
export function photographierPointOptimizer(stockage: StockageOptimizer & { activeListId: string | null },
  selection: SelectionPointOptimizer | null, date: Date, brutMembres?: string | null): PointOptimizer {
  return structuredClone({ version: 1, date: date.toISOString(), historique: {
    lists: stockage.lists, members: stockage.members, validated: stockage.validated, activeListId: stockage.activeListId,
  }, membres: brutMembres ?? ecrireMembresOptimizer(stockage), selection });
}

export type LecturePointOptimizer = { point: PointOptimizer | null; rapport: string[] };
/** Refuser une photo historique abîmée évite de remplacer le travail par une lecture partielle. */
export function lirePointOptimizer(brut: string | null): LecturePointOptimizer {
  if (brut === null) return { point: null, rapport: [] };
  const refus = { point: null, rapport: ['Point de sauvegarde illisible : conservé sans reprise. Tu peux le remplacer après confirmation.'] };
  let v: unknown;
  try { v = JSON.parse(brut); } catch { return refus; }
  if (!objet(v) || v.version !== 1 || typeof v.date !== 'string' || !Number.isFinite(Date.parse(v.date))
    || !objet(v.historique) || typeof v.membres !== 'string') return refus;
  const h = v.historique;
  if (!Array.isArray(h.lists) || !Array.isArray(h.members) || !Array.isArray(h.validated)) return refus;
  const listes = new Set<string>(), membres = new Set<string>(), builds = new Set<string>();
  for (const l of h.lists) {
    if (!objet(l) || typeof l.id !== 'string' || !l.id || typeof l.name !== 'string' || listes.has(l.id)) return refus;
    listes.add(l.id);
  }
  const cibleValide = (m: unknown): m is OptimizerListMember => objet(m) && typeof m.listId === 'string'
    && listes.has(m.listId) && selecteurValide(m.selector);
  for (const m of h.members) {
    if (!cibleValide(m)) return refus;
    const cle = `${m.listId}|${exclusionSelectorKey(m.selector)}`;
    if (membres.has(cle)) return refus;
    membres.add(cle);
  }
  for (const b of h.validated) {
    if (!cibleValide(b) || !objet(b) || !idsValides(b.runeIds) || (b.artifactIds !== undefined && !idsValides(b.artifactIds))) return refus;
    const cle = `${b.listId}|${exclusionSelectorKey(b.selector)}`;
    if (!membres.has(cle) || builds.has(cle)) return refus;
    builds.add(cle);
    for (const [marque, inventaire] of [['runesManquantes', b.runeIds], ['artefactsManquants', b.artifactIds ?? []]] as const) {
      if (b[marque] !== undefined && (!idsValides(b[marque]) || !(b[marque] as number[]).every(id => (inventaire as number[]).includes(id)))) return refus;
    }
  }
  if (h.activeListId !== null && (typeof h.activeListId !== 'string' || !listes.has(h.activeListId))) return refus;
  try { if (!objet(JSON.parse(v.membres))) return refus; } catch { return refus; }
  // Une sélection absente ou périmée ne change jamais l'identité d'un membre.
  const selection = cibleValide(v.selection) && v.selection.listId === h.activeListId
    && membres.has(`${v.selection.listId}|${exclusionSelectorKey(v.selection.selector)}`) ? v.selection : null;
  return { point: { version: 1, date: v.date, historique: h as unknown as HistoriquePointOptimizer, membres: v.membres, selection }, rapport: [] };
}

/** Tout préparer avant de publier : lecture, rattachement et sélection utilisent la même photo. */
export function preparerRepriseOptimizer(point: PointOptimizer, data: ExclusionSourceData, runeIds: Set<number>, artifactIds: Set<number>) {
  const lu = lireMembresOptimizer(point.membres);
  const resultat = reverifierStockageOptimizer({ ...lu, ...point.historique }, data, runeIds, artifactIds);
  const selection = point.selection ? { ...point.selection, selector: resultat.rapport.rattachements.find(r =>
    r.listId === point.selection!.listId && exclusionSelectorKey(r.avant) === exclusionSelectorKey(point.selection!.selector))?.apres ?? point.selection.selector } : null;
  return { ...resultat, activeListId: point.historique.activeListId, selection, brutMembres: resultat.stockage.memories === lu.memories
    && resultat.stockage.identities === lu.identities && resultat.stockage.teams === lu.teams && resultat.stockage.rejets === lu.rejets ? point.membres : null,
    messages: [...lu.rapport, ...(resultat.rapport.compteVide ? ['Compte vide : les données du point sont reprises sans revérification.'] : resultat.rapport.messages)] };
}
