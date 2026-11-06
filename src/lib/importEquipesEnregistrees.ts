// L'ALLER-RETOUR entre « Mes équipes » et l'Optimizer.
//
// Spec : docs/02-app/compte/feat-equipes.md, « Aller-retour avec
// l'Optimizer ». L'export est un producteur de l'import commun de l'Optimizer
// (importEquipes.ts), le seul qui propose des builds à valider ; le retour est
// une fonction pure qui rend l'équipe mise à jour et ce que la confirmation
// doit nommer, sans rien écrire.

import type { ArtifactDetail, GearSet, Monster, RelicDetail, RuneDetail } from '../types';
import type { Dictionnaire } from '../i18n/fr';
import type { BuildAValiderImport, ImportOptimizer, RapportImportOptimizer } from './importEquipes';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';
import type { StockageOptimizer } from './optimizerMemberStorage';
import type { SpeedTuneEquipe } from './speedTuneEquipe';
import {
  CONTENU_OPTIMIZER_ONGLET, comparerPiece, creerEquipe,
  type CorrespondanceOptimizer, type EquipeEnregistree, type LienOptimizerEquipe, type InventaireCompte, type LienLigneEnregistre,
  type MonstreEnregistre, type OngletEquipes, type SpeedTuneEnregistre, type TirerId,
} from './equipesEnregistrees';

function monstreDeLEspece(com2usId: number, data: ExclusionSourceData): Monster | undefined {
  for (const m of data.monsterById.values()) if (m.com2usId === com2usId) return m;
  return undefined;
}

/* --------------------------------------------------------------------------
 * Exporter vers l'Optimizer
 * ----------------------------------------------------------------------- */

export interface ExportEquipeOptimizer {
  proposition: ImportOptimizer;
  correspondance: CorrespondanceOptimizer[];
}

// Un build validé n'est posé que sur 6 runes réelles, distinctes, une par
// emplacement ; la paire, au plus une pièce par sorte.
function buildAValider(m: MonstreEnregistre, selector: ExclusionSelector, libelle: string, inv: InventaireCompte, t: Dictionnaire, messages: string[]): BuildAValiderImport | null {
  const eq = m.equipement;
  if (!eq) return null;
  const runes = eq.runes.filter((r) => r.id > 0);
  const slots = new Set(runes.map((r) => r.slot));
  if (runes.length !== 6 || new Set(runes.map((r) => r.id)).size !== 6 || slots.size !== 6) return null;
  const e = t.equipes.export;
  const arts = eq.artifacts.filter((a) => a.id > 0);
  const sortes = new Set(arts.map((a) => a.kind));
  const pairePropre = sortes.size === arts.length;
  if (!pairePropre) messages.push(e.paireIncoherente(libelle));
  const artifactIds = pairePropre ? arts.map((a) => a.id) : [];
  const modifiees = [
    ...runes.filter((r) => inv.runes.has(r.id) && !comparerPiece(r, inv.runes.get(r.id))),
    ...arts.filter((a) => artifactIds.includes(a.id) && inv.artefacts.has(a.id) && !comparerPiece(a, inv.artefacts.get(a.id))),
  ];
  if (modifiees.length) messages.push(e.piecesModifiees(libelle, modifiees.length));
  return {
    selector, libelle,
    runeIds: runes.map((r) => r.id),
    runesManquantes: runes.filter((r) => !inv.runes.has(r.id)).map((r) => r.id),
    artifactIds,
    artefactsManquants: artifactIds.filter((id) => !inv.artefacts.has(id)),
    ...(eq.relic && eq.relic.id > 0 ? { reliqueId: eq.relic.id } : {}),
  };
}

export function preparerExportEquipeOptimizer(
  equipe: EquipeEnregistree, data: ExclusionSourceData, inv: InventaireCompte, t: Dictionnaire
): ExportEquipeOptimizer {
  const e = t.equipes.export;
  const proposition: ImportOptimizer = { nomListe: equipe.nom, contenu: CONTENU_OPTIMIZER_ONGLET[equipe.onglet],
    membres: [], equipes: [], ignores: [], messages: [], buildsAValider: [] };
  const correspondance: CorrespondanceOptimizer[] = [];
  const unitesPrises = new Set<string>();
  const copies = new Map<string, number>();
  for (const m of equipe.monstres) {
    const monstre = monstreDeLEspece(m.com2usId, data);
    const libelle = monstre?.name ?? String(m.com2usId);
    if (!monstre) {
      proposition.ignores.push({ selector: { source: 'unowned', monsterId: String(m.com2usId) }, libelle, raison: t.optimizer.importsEquipe.monstreInconnu });
      continue;
    }
    let selector: ExclusionSelector;
    const unitKey = m.unitId === null ? null : String(m.unitId);
    const dansLaBox = unitKey !== null && data.box.some((b) => b.key === unitKey && b.monster.com2usId === m.com2usId);
    if (dansLaBox) {
      if (unitesPrises.has(unitKey!)) {
        proposition.ignores.push({ selector: { source: 'box', unitKey: unitKey! }, libelle, raison: e.memeExemplaire });
        continue;
      }
      unitesPrises.add(unitKey!);
      selector = { source: 'box', unitKey: unitKey! };
    } else {
      const n = (copies.get(String(monstre.id)) ?? 0) + 1;
      copies.set(String(monstre.id), n);
      selector = { source: 'unowned', monsterId: String(monstre.id), ...(n > 1 ? { copie: n } : {}) };
      proposition.messages.push(e.nonPossede(libelle));
    }
    proposition.membres.push({ selector, com2usId: m.com2usId, libelle, criteres: {} });
    correspondance.push({ uid: m.uid, selecteur: selector });
    const build = buildAValider(m, selector, libelle, inv, t, proposition.messages);
    if (build) proposition.buildsAValider!.push(build);
  }
  const selecteurDe = new Map(correspondance.map((c) => [c.uid, c.selecteur]));
  const members = correspondance.map((c) => c.selecteur);
  const leaderSel = equipe.leader ? selecteurDe.get(equipe.leader) : undefined;
  const leaderMonstre = equipe.leader ? equipe.monstres.find((m) => m.uid === equipe.leader) : undefined;
  const lead = leaderMonstre ? monstreDeLEspece(leaderMonstre.com2usId, data)?.leaderSkill ?? null : null;
  let speedTune: SpeedTuneEquipe | undefined;
  if (equipe.speedTune) {
    speedTune = { plan: equipe.speedTune.plan === null ? null : structuredClone(equipe.speedTune.plan),
      membres: equipe.speedTune.liens.filter((l) => selecteurDe.has(l.monstre))
        .map((l) => ({ uid: l.uid, selector: { ...selecteurDe.get(l.monstre)! }, attache: l.attache, repli: { ...l.repli } })) };
  }
  proposition.equipes.push({ libelle: equipe.nom, members, ...(leaderSel ? { leader: leaderSel } : {}),
    lead: structuredClone(lead), ...(speedTune ? { speedTune } : {}) });
  return { proposition, correspondance };
}

// Le lien posé sur l'équipe après un export accepté : la liste créée, son
// équipe, et les membres que le consommateur a gardés. `null` : export refusé,
// ou aucune équipe créée (moins de deux membres gardés), rien n'est lié.
// ⚠️ Le rapport commence par les ignorés du PRODUCTEUR, déjà absents de la
// correspondance : un doublon d'exemplaire y porte le sélecteur du membre
// gardé, et le compter retirerait ce membre du lien.
export function lienApresExportOptimizer(export_: ExportEquipeOptimizer, rapport: RapportImportOptimizer): LienOptimizerEquipe | null {
  const equipeId = rapport.equipesCreeesIds?.[0];
  if (!rapport.listeCreee || !equipeId) return null;
  const { correspondance, proposition } = export_;
  const ignores = new Set(rapport.ignores.slice(proposition.ignores.length).map((i) => exclusionSelectorKey(i.selector)));
  return { listId: rapport.listeCreee.id, equipeId,
    correspondance: correspondance.filter((c) => !ignores.has(exclusionSelectorKey(c.selecteur))).map((c) => ({ uid: c.uid, selecteur: { ...c.selecteur } })) };
}

/* --------------------------------------------------------------------------
 * Mettre à jour depuis l'Optimizer
 * ----------------------------------------------------------------------- */

export type RefusRetourOptimizer = 'sansLien' | 'listeAbsente' | 'equipeAbsente' | 'membresIntrouvables';

export interface PieceManquante {
  libelle: string; // le monstre
  type: 'rune' | 'artefact' | 'relique';
  id: number;
}

export interface RetourOptimizer {
  equipe: EquipeEnregistree;
  monstresChanges: number;
  piecesChangees: number;
  manquantes: PieceManquante[];
  reliquesGardees: string[];
  artefactsGardes: string[];
  copiesAmbigues: { type: 'rune' | 'artefact' | 'relique'; id: number }[];
  retires: string[];
}

// ⚠️ Un membre qui ne se résout pas (compte pas encore relu, exemplaire
// disparu) refuse tout : le reprendre comme absent retirerait son monstre de
// l'équipe. L'équipe de l'Optimizer a 2 à 6 membres, comme une équipe enregistrée.
export function disponibiliteRetourOptimizer(equipe: EquipeEnregistree, stockage: StockageOptimizer, data: ExclusionSourceData): RefusRetourOptimizer | null {
  const lien = equipe.lienOptimizer;
  if (!lien) return 'sansLien';
  if (!stockage.lists.some((l) => l.id === lien.listId)) return 'listeAbsente';
  if (!stockage.teams.some((e) => e.id === lien.equipeId && e.listId === lien.listId)) return 'equipeAbsente';
  const source = membresSource(equipe, stockage);
  if (source.some((s) => { const r = resolveExclusionEntry(s, data); return !r?.monster || r.monster.com2usId === null; })) return 'membresIntrouvables';
  return null;
}

function membresSource(equipe: EquipeEnregistree, stockage: StockageOptimizer): ExclusionSelector[] {
  const lien = equipe.lienOptimizer!;
  return stockage.teams.find((e) => e.id === lien.equipeId)?.members ?? [];
}

type Piece = RuneDetail | ArtifactDetail | RelicDetail;

export function preparerRetourOptimizer(
  equipe: EquipeEnregistree, stockage: StockageOptimizer, data: ExclusionSourceData, inv: InventaireCompte,
  tirerUid: TirerId, maintenant: Date
): RetourOptimizer | RefusRetourOptimizer {
  const refus = disponibiliteRetourOptimizer(equipe, stockage, data);
  if (refus) return refus;
  const lien = equipe.lienOptimizer!;
  const parCle = new Map(lien.correspondance.map((c) => [exclusionSelectorKey(c.selecteur), c.uid]));
  const anciens = new Map(equipe.monstres.map((m) => [m.uid, m]));
  const res: RetourOptimizer = { equipe, monstresChanges: 0, piecesChangees: 0, manquantes: [], reliquesGardees: [], artefactsGardes: [], copiesAmbigues: [], retires: [] };

  // Les copies de secours : toute l'équipe enregistrée, par type et identifiant.
  const copiesDe = (type: 'rune' | 'artefact' | 'relique', id: number, uid: string | undefined): Piece | null => {
    const trouvees: { uid: string; p: Piece }[] = [];
    for (const m of equipe.monstres) {
      const eq = m.equipement;
      if (!eq) continue;
      const pieces: Piece[] = type === 'rune' ? eq.runes : type === 'artefact' ? eq.artifacts : eq.relic ? [eq.relic] : [];
      for (const p of pieces) if (p.id === id) trouvees.push({ uid: m.uid, p });
    }
    if (!trouvees.length) return null;
    const choisie = trouvees.find((x) => x.uid === uid) ?? trouvees[0];
    if (trouvees.some((x) => !comparerPiece(x.p, choisie.p))) { if (!res.copiesAmbigues.some((c) => c.type === type && c.id === id)) res.copiesAmbigues.push({ type, id }); }
    return structuredClone(choisie.p);
  };
  const resoudre = <T extends Piece>(type: 'rune' | 'artefact' | 'relique', id: number, uid: string | undefined, libelle: string): T | null => {
    const actuelle = type === 'rune' ? inv.runes.get(id) : type === 'artefact' ? inv.artefacts.get(id) : inv.reliques.get(id);
    if (actuelle) return structuredClone(actuelle) as T;
    const copie = copiesDe(type, id, uid);
    if (copie) return copie as T;
    res.manquantes.push({ libelle, type, id });
    return null;
  };

  const vus = new Set<string>();
  const monstres: MonstreEnregistre[] = [];
  const uidDe = new Map<string, string>();
  for (const selector of membresSource(equipe, stockage)) {
    const cle = exclusionSelectorKey(selector);
    const resolu = resolveExclusionEntry(selector, data);
    if (!resolu || resolu.monster.com2usId === null) continue;
    const ancienUid = parCle.get(cle);
    const ancien = ancienUid ? anciens.get(ancienUid) : undefined;
    const uid = ancien ? ancien.uid : tirerUid();
    vus.add(uid);
    uidDe.set(cle, uid);
    const libelle = resolu.monster.name;
    const build = stockage.validated.find((v) => v.listId === lien.listId && exclusionSelectorKey(v.selector) === cle);
    let equipement: GearSet;
    const base = selector.source === 'box' ? resolu.gear.base : ancien?.equipement?.base ?? resolu.gear.base;
    if (build) {
      const runes = build.runeIds.map((id) => resoudre<RuneDetail>('rune', id, ancien?.uid, libelle)).filter((r): r is RuneDetail => r !== null).sort((a, b) => a.slot - b.slot);
      let artifacts: ArtifactDetail[];
      if (build.artifactIds === undefined) {
        artifacts = structuredClone(ancien?.equipement?.artifacts ?? []);
        res.artefactsGardes.push(libelle);
      } else artifacts = build.artifactIds.map((id) => resoudre<ArtifactDetail>('artefact', id, ancien?.uid, libelle)).filter((a): a is ArtifactDetail => a !== null);
      let relic: RelicDetail | undefined;
      if (build.reliqueId === undefined) {
        relic = ancien?.equipement?.relic ? structuredClone(ancien.equipement.relic) : undefined;
        if (relic) res.reliquesGardees.push(libelle);
      } else relic = resoudre<RelicDetail>('relique', build.reliqueId, ancien?.uid, libelle) ?? undefined;
      equipement = { base: structuredClone(base), runes, artifacts, ...(relic ? { relic } : {}) };
    } else {
      equipement = { ...structuredClone(resolu.gear), base: structuredClone(base) };
    }
    const unitId = selector.source === 'box' && /^\d+$/.test(selector.unitKey) ? Number(selector.unitKey) : ancien?.unitId ?? null;
    const m: MonstreEnregistre = { uid, com2usId: resolu.monster.com2usId, unitId, provenance: 'optimizer', equipement };
    if (!ancien || ancien.com2usId !== m.com2usId || !memeCopie(ancien.equipement, equipement)) res.monstresChanges++;
    res.piecesChangees += piecesDifferentes(ancien?.equipement ?? null, equipement);
    monstres.push(m);
  }
  for (const m of equipe.monstres) if (!vus.has(m.uid)) {
    res.retires.push(monstreDeLEspece(m.com2usId, data)?.name ?? String(m.com2usId));
    res.monstresChanges++;
    // Son équipement quitte l'équipe avec lui.
    res.piecesChangees += piecesDe(m.equipement).size;
  }

  let speedTune: SpeedTuneEnregistre | undefined;
  const source = stockage.teams.find((e) => e.id === lien.equipeId)!;
  const leader = source.leader ? uidDe.get(exclusionSelectorKey(source.leader)) ?? null : null;
  if (source.speedTune) {
    const liens: LienLigneEnregistre[] = [];
    for (const l of source.speedTune.membres) {
      const uid = uidDe.get(exclusionSelectorKey(l.selector));
      if (uid) liens.push({ uid: l.uid, monstre: uid, attache: l.attache, repli: { ...l.repli } });
    }
    speedTune = { plan: source.speedTune.plan === null ? null : structuredClone(source.speedTune.plan), liens };
  }
  const correspondance: CorrespondanceOptimizer[] = [...uidDe].map(([cle, uid]) => {
    const selecteur = membresSource(equipe, stockage).find((s) => exclusionSelectorKey(s) === cle)!;
    return { uid, selecteur: { ...selecteur } };
  });
  const { speedTune: _ancien, ...sansSpeedTune } = equipe;
  res.equipe = { ...sansSpeedTune, monstres, leader, ...(speedTune ? { speedTune } : {}),
    lienOptimizer: { ...lien, correspondance }, modifieLe: maintenant.toISOString() };
  return res;
}

// « Enregistrer dans Mes équipes » sur une équipe de l'Optimizer qu'aucune
// équipe enregistrée ne suit : une NOUVELLE équipe, déjà liée à elle, pour
// que le geste suivant la mette à jour au lieu d'en créer une autre. Même
// reconstruction que la mise à jour, depuis une équipe vide.
export function creerDepuisEquipeOptimizer(
  source: { listId: string; equipeId: string; nom: string; onglet: OngletEquipes },
  stockage: StockageOptimizer, data: ExclusionSourceData, inv: InventaireCompte,
  id: string, tirerUid: TirerId, maintenant: Date
): RetourOptimizer | RefusRetourOptimizer {
  const vide: EquipeEnregistree = { ...creerEquipe(id, source.onglet, source.nom, maintenant),
    lienOptimizer: { listId: source.listId, equipeId: source.equipeId, correspondance: [] } };
  return preparerRetourOptimizer(vide, stockage, data, inv, tirerUid, maintenant);
}

// Une équipe de l'Optimizer désignée par « Enregistrer dans Mes équipes ».
export interface DemandeEquipeOptimizer { listId: string; equipeId: string }

// L'équipe enregistrée qui suit une équipe de l'Optimizer, s'il y en a une.
export function equipeLieeA(equipes: readonly EquipeEnregistree[], listId: string, equipeId: string): EquipeEnregistree | undefined {
  return equipes.find((e) => e.lienOptimizer?.listId === listId && e.lienOptimizer.equipeId === equipeId);
}

function piecesDe(eq: GearSet | null): Map<string, Piece> {
  const m = new Map<string, Piece>();
  if (!eq) return m;
  for (const r of eq.runes) m.set(`r${r.id}`, r);
  for (const a of eq.artifacts) m.set(`a${a.id}`, a);
  if (eq.relic) m.set(`l${eq.relic.id}`, eq.relic);
  return m;
}

function piecesDifferentes(avant: GearSet | null, apres: GearSet): number {
  const a = piecesDe(avant), b = piecesDe(apres);
  let n = 0;
  for (const [k, p] of b) { const q = a.get(k); if (!q || !comparerPiece(p, q)) n++; }
  for (const k of a.keys()) if (!b.has(k)) n++;
  return n;
}

function memeCopie(a: GearSet | null, b: GearSet): boolean {
  return a !== null && piecesDifferentes(a, b) === 0;
}
