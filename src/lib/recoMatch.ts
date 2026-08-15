// Confrontation d'une recommandation avec le compte du joueur : est-ce que je
// possède ces monstres, et est-ce qu'un de leurs builds atteint les minimums ?
//
// Source de vérité : TOUS les builds connus (`OwnedBuild` — box, RTA, défense et
// offense de siège), et non la seule box : un monstre a un preset de runes par
// contexte, et un build de siège ne se voit pas dans l'équipement porté.
// Calcul pur — aucune dépendance React.

import { ARTIFACT_KINDS, ArtifactKind, Reco, RecoDeck, RecoSlot, RecoStatKey, RECO_STATS } from '../types';
import { OwnedBuild, OwnedTeam } from './ownedBuilds';
import { computeStats } from './stats';
import { activeSets, artifactSubLabel } from './effects';

// Les règles de composition de sets (coût, combinaisons possibles) vivent dans
// effects.ts, avec le reste des règles de sets — voir `canAddSet` / `setsCost`.

// Les sets recommandés sont-ils tous portés ? Comparaison en MULTI-ENSEMBLE :
// demander 2× Fight exige bien deux fois le set actif. Renvoie les manquants.
export function missingSets(required: string[], owned: string[]): string[] {
  const pool = [...owned];
  const missing: string[] = [];
  for (const key of required) {
    const i = pool.indexOf(key);
    if (i >= 0) pool.splice(i, 1);
    else missing.push(key);
  }
  return missing;
}

export interface StatCheck {
  key: RecoStatKey;
  label: string;
  suffix: string;
  required: number;
  actual: number | null; // null = monstre non possédé
  ok: boolean;
  diff: number; // actual - required (négatif = il manque)
}

export type SlotStatus =
  | 'empty' // aucun monstre dans la recommandation
  | 'absent' // monstre INDISPONIBLE : introuvable dans le compte
  | 'ko' // dans le deck retenu, ce monstre n'atteint pas les minimums
  | 'ok' // au niveau
  | 'unknown'; // monstre possédé, mais aucun deck à confronter

// Une propriété secondaire d'artéfact exigée, confrontée à l'artéfact
// correspondant du build. `ok` est faux aussi bien si la propriété manque que si
// l'artéfact n'est pas équipé du tout — dans les deux cas la ligne demandée
// n'est pas là.
export interface ArtifactCheck {
  kind: ArtifactKind;
  code: number;
  label: string;
  ok: boolean;
}

export interface SlotMatch {
  status: SlotStatus;
  owned: OwnedBuild | null; // build retenu (celui du deck correspondant)
  copies: number; // nombre de builds connus (exemplaires × presets)
  checks: StatCheck[];
  artifactChecks: ArtifactCheck[]; // propriétés d'artéfact exigées
  ownedSets: string[]; // sets actifs du build retenu
  missingSets: string[]; // sets manquants de la MEILLEURE possibilité
  matchedOption?: number; // index de cette possibilité dans `slot.setOptions`
}

// Un slot `ko` peut l'être pour trois raisons **indépendantes**, qui ne se
// réparent pas du tout pareil :
//  - `sets`      : pas le runage demandé → il faut **reruner** ;
//  - `artifacts` : pas les propriétés d'artéfact demandées → il faut **changer
//    d'artéfact** (aucun réglage de runes n'y changera rien) ;
//  - `stats`     : le reste est bon mais les minimums ne sont pas atteints → il
//    faut **améliorer les runes** en place.
//
// ⚠️ Les confondre sous « stats insuffisantes » envoyait le joueur optimiser des
// sous-stats alors que le set lui-même n'était pas le bon (et inversement, un
// monstre au bon set mais trop lent se lisait comme un problème de runage).
//
// ⚠️ Une LISTE de causes, pas une cause unique : les trois peuvent coexister, et
// n'en annoncer qu'une masquerait le reste du travail. L'ordre est celui du
// geste à faire — reruner change les stats, l'inverse n'est pas vrai.
export type FaultCause = 'sets' | 'artifacts' | 'stats';

const ORDRE_CAUSES: FaultCause[] = ['sets', 'artifacts', 'stats'];

export function slotFaults(sm: SlotMatch): FaultCause[] {
  if (sm.status !== 'ko') return [];
  const causes: FaultCause[] = [];
  if (sm.missingSets.length > 0) causes.push('sets');
  if (sm.artifactChecks.some((c) => !c.ok)) causes.push('artifacts');
  if (sm.checks.some((c) => !c.ok)) causes.push('stats');
  return causes;
}

// Causes d'un deck : l'union de celles de ses slots. Deux monstres aux défauts
// différents doivent produire les deux causes.
export function deckFaults(slots: SlotMatch[]): FaultCause[] {
  const vues = new Set(slots.flatMap(slotFaults));
  return ORDRE_CAUSES.filter((c) => vues.has(c));
}

export type RecoStatus = 'unknown' | 'ok' | 'partial' | 'missing';

// Statut d'un deck de la recommandation, du plus bloquant au meilleur :
//  - `missing` (rouge)  : au moins un monstre **indisponible** dans le compte ;
//  - `nodeck`  (orange) : tous les monstres sont là, mais **aucune équipe
//                         existante ne les réunit** — il reste à la composer ;
//  - `ko`      (rouge)  : l'équipe existe mais **des stats/sets ne suivent pas** ;
//  - `ok`      (vert)   : l'équipe existe et tout est au niveau.
export type DeckStatus = 'unknown' | 'ok' | 'ko' | 'nodeck' | 'missing';

// Confrontation d'UN deck de la recommandation.
export interface DeckMatch {
  status: DeckStatus;
  slots: SlotMatch[];
  okCount: number; // slots satisfaits
  filled: number; // slots renseignés dans le deck
  team: string | null; // équipe existante retenue (« Offense 3 »), si trouvée
  // Combien de fois le deck est montable EN PARALLÈLE avec les 6★ en réserve.
  // `null` = pas de compte importé, ou deck vide (voir `deckCopies`).
  copies: number | null;
}

// Confrontation d'une recommandation ENTIÈRE (plusieurs decks).
export interface RecoMatch {
  status: RecoStatus;
  decks: DeckMatch[];
  okDecks: number; // decks entièrement jouables
  totalDecks: number; // decks non vides
}

// Stats totales d'un build (PV/ATQ/DEF/VIT/TC/DCC/RES/PRE).
function totalsOf(build: OwnedBuild): Record<RecoStatKey, number> {
  const out = {} as Record<RecoStatKey, number>;
  for (const row of computeStats(build.gear)) out[row.key as RecoStatKey] = row.total;
  return out;
}

function checksFor(
  stats: Partial<Record<RecoStatKey, number>>,
  totals: Record<RecoStatKey, number> | null
): StatCheck[] {
  const out: StatCheck[] = [];
  for (const def of RECO_STATS) {
    const required = stats[def.key];
    if (required == null || !(required > 0)) continue; // stat non exigée
    const actual = totals ? totals[def.key] : null;
    out.push({
      key: def.key,
      label: def.label,
      suffix: def.suffix,
      required,
      actual,
      ok: actual !== null && actual >= required,
      diff: actual !== null ? actual - required : 0,
    });
  }
  return out;
}

// Propriétés secondaires réellement portées par l'artéfact d'une sorte donnée.
// `null` = artéfact absent du build ; une propriété exigée ne peut alors être
// que manquante.
function subsPortes(build: OwnedBuild, kind: ArtifactKind): Set<number> | null {
  const art = build.gear.artifacts.find((a) => a.kind === kind);
  return art ? new Set(art.subs.map((s) => s.code)) : null;
}

// Confronte les propriétés d'artéfact exigées par le slot. Sans build, tout est
// simplement listé comme non satisfait : l'affichage montre alors ce qui est
// demandé, sans prétendre l'avoir vérifié (le slot n'est de toute façon pas
// `ko` dans ce cas, voir `slotFaults`).
function artifactChecksFor(slot: RecoSlot, build: OwnedBuild | null): ArtifactCheck[] {
  const out: ArtifactCheck[] = [];
  for (const { key } of ARTIFACT_KINDS) {
    const codes = slot.artifacts?.[key] ?? [];
    if (codes.length === 0) continue;
    const portes = build ? subsPortes(build, key) : null;
    for (const code of codes) {
      out.push({ kind: key, code, label: artifactSubLabel(code), ok: portes?.has(code) ?? false });
    }
  }
  return out;
}

// Confronte un slot au build qu'il a DANS une équipe donnée (ou à rien).
function checkSlot(slot: RecoSlot, build: OwnedBuild | null, copies: number): SlotMatch {
  const options = slot.setOptions?.length ? slot.setOptions : [[]];
  // Slot sans monstre : rien à confronter (ne surtout pas le dire « absent »).
  if (slot.com2usId == null) {
    return {
      status: 'empty',
      owned: null,
      copies: 0,
      checks: [],
      artifactChecks: [],
      ownedSets: [],
      missingSets: [],
    };
  }
  if (!build) {
    return {
      status: copies > 0 ? 'unknown' : 'absent',
      owned: null,
      copies,
      checks: checksFor(slot.stats, null),
      artifactChecks: artifactChecksFor(slot, null),
      ownedSets: [],
      // Monstre non confronté : on montre les manques de la 1re possibilité.
      missingSets: options[0],
    };
  }
  const checks = checksFor(slot.stats, totalsOf(build));
  const artifactChecks = artifactChecksFor(slot, build);
  const sets = activeSets(build.gear.runes.map((r) => r.set));
  // ⚠️ Plusieurs runages peuvent être recommandés (« Violent/Némésis OU
  // Violent/Vengeance ») : le slot est satisfait dès qu'**UNE SEULE**
  // possibilité l'est. On retient la MEILLEURE (le moins de sets manquants),
  // qui est aussi celle qu'on affiche — annoncer « il te manque X » sur une
  // possibilité que le joueur n'a pas prise n'aiderait pas.
  const best = options
    .map((opt, i) => ({ option: i, missing: missingSets(opt, sets) }))
    .sort((a, b) => a.missing.length - b.missing.length)[0];
  return {
    status:
      checks.every((c) => c.ok) && artifactChecks.every((c) => c.ok) && best.missing.length === 0
        ? 'ok'
        : 'ko',
    owned: build,
    copies,
    checks,
    artifactChecks,
    ownedSets: sets,
    missingSets: best.missing,
    matchedOption: best.option,
  };
}

export interface MatchContext {
  builds: Map<number, OwnedBuild[]>; // tous les builds connus → « je possède ce monstre »
  teams: OwnedTeam[]; // équipes réellement composées → « j'ai un deck avec ces monstres »
  // Exemplaires 6★ réellement possédés (box seule) → « combien de fois puis-je
  // monter ce deck en parallèle ». Absent = information indisponible.
  copies6?: Map<number, number>;
}

// Combien de fois ce deck peut être monté EN PARALLÈLE avec la réserve 6★.
//
// ⚠️ Le deck est limité par son monstre le PLUS RARE : trois exemplaires de l'un
// ne servent à rien si le second n'existe qu'en un exemplaire. D'où un `min` sur
// les slots, et non une moyenne ni un total.
//
// ⚠️ Un monstre placé DEUX FOIS dans le même deck consomme deux exemplaires : on
// compte donc les occurrences par `com2usId` avant de diviser. Sans ça, un deck
// demandant deux Chloé passerait pour montable avec une seule.
//
// Renvoie `null` quand l'information n'est pas disponible (aucune box importée)
// ou que le deck est vide — un « 0 » se lirait « tu ne peux pas le monter »,
// ce qui est une tout autre affirmation que « je ne sais pas ».
export function deckCopies(deck: RecoDeck, copies6: Map<number, number> | undefined): number | null {
  if (!copies6) return null;
  const besoins = new Map<number, number>();
  for (const slot of deck.slots) {
    if (slot.com2usId == null) continue;
    besoins.set(slot.com2usId, (besoins.get(slot.com2usId) ?? 0) + 1);
  }
  if (besoins.size === 0) return null;
  let min = Infinity;
  for (const [id, requis] of besoins) {
    min = Math.min(min, Math.floor((copies6.get(id) ?? 0) / requis));
  }
  return min === Infinity ? null : min;
}

// Confronte un deck de recommandation au compte, en trois questions dans l'ordre :
//  1. **Ai-je les monstres ?** Non → `missing`, le(s) fautif(s) en `absent`.
//  2. **Ai-je une équipe qui les réunit ?** Non → `nodeck` (il reste à la composer).
//  3. **Dans cette équipe, les stats suivent-elles ?** Non → `ko`.
export function matchDeck(deck: RecoDeck, ctx: MatchContext): DeckMatch {
  const filledSlots = deck.slots.filter((s) => s.com2usId != null);
  if (filledSlots.length === 0) {
    return {
      status: 'unknown',
      slots: deck.slots.map((s) => checkSlot(s, null, 0)),
      okCount: 0,
      filled: 0,
      team: null,
      copies: null, // deck vide : rien à monter
    };
  }

  const copiesOf = (id: number | null) => (id == null ? 0 : (ctx.builds.get(id) ?? []).length);
  // Combien de fois ce deck est montable en parallèle avec la réserve 6★.
  // ⚠️ Calculé une fois pour les trois sorties ci-dessous : il ne dépend pas du
  // statut. Savoir qu'on peut monter un deck trois fois reste utile même s'il
  // faut le reruner.
  const copies = deckCopies(deck, ctx.copies6);

  // 1. Monstres indisponibles → bloquant, on n'ira pas plus loin.
  if (filledSlots.some((s) => copiesOf(s.com2usId) === 0)) {
    const slots = deck.slots.map((s) => checkSlot(s, null, copiesOf(s.com2usId)));
    return { status: 'missing', slots, okCount: 0, filled: filledSlots.length, team: null, copies };
  }

  // 2. Équipes existantes qui réunissent TOUS les monstres du deck.
  const candidates = ctx.teams.filter((t) => filledSlots.every((s) => t.builds.has(s.com2usId!)));
  if (candidates.length === 0) {
    const slots = deck.slots.map((s) => checkSlot(s, null, copiesOf(s.com2usId)));
    return { status: 'nodeck', slots, okCount: 0, filled: filledSlots.length, team: null, copies };
  }

  // 3. La MEILLEURE de ces équipes : celle qui satisfait le plus de critères.
  let best: { slots: SlotMatch[]; okCount: number; team: string; score: number } | null = null;
  for (const team of candidates) {
    const slots = deck.slots.map((s) =>
      checkSlot(s, s.com2usId != null ? team.builds.get(s.com2usId) ?? null : null, copiesOf(s.com2usId))
    );
    const okCount = slots.filter((x) => x.status === 'ok').length;
    // Départage fin : nombre de critères atteints (stats ET propriétés
    // d'artéfact), tous slots confondus. Ignorer les artéfacts ferait retenir
    // une équipe moins bonne quand seuls eux départagent.
    const score =
      okCount * 100 +
      slots.reduce(
        (n, x) => n + x.checks.filter((c) => c.ok).length + x.artifactChecks.filter((c) => c.ok).length,
        0
      );
    if (!best || score > best.score) best = { slots, okCount, team: team.label, score };
  }

  const { slots, okCount, team } = best!;
  return {
    status: okCount === filledSlots.length ? 'ok' : 'ko',
    slots,
    okCount,
    filled: filledSlots.length,
    copies,
    team,
  };
}

// Statut d'une recommandation = agrégat de ses decks (les decks totalement
// vides sont ignorés) :
//  - `ok`      : TOUS les decks sont jouables
//  - `missing` : AUCUN deck jouable et tous bloqués par un monstre indisponible
//  - `partial` : le reste (une partie des decks est jouable)
export function matchReco(reco: Reco, ctx: MatchContext): RecoMatch {
  const decks = reco.decks.map((d) => matchDeck(d, ctx));
  const real = decks.filter((d) => d.filled > 0);
  const okDecks = real.filter((d) => d.status === 'ok').length;
  const status: RecoStatus =
    real.length === 0
      ? 'unknown'
      : okDecks === real.length
        ? 'ok'
        : real.every((d) => d.status === 'missing')
          ? 'missing'
          : 'partial';
  return { status, decks, okDecks, totalDecks: real.length };
}

// Nombre compact (39051 → « 39 051 »).
export function fmtStat(n: number): string {
  return n.toLocaleString('fr-FR');
}
