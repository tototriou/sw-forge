import type { GearSet } from '../types';
import { aurasPropresParRunes, optionsDeClassement, type SearchParams, type RealDamageContext } from './runeBuildOptim';
import { PreparationReglage, artifactDamageProfile, type DamageSetup } from './damage';
import { regimeArtefacts, regimeEquipementDe } from './artifactEvaluation';
import { cleBuild, type ResultatArtefacts } from './artifactQueue';
import { etatReliqueDuBuild } from './relicQueue';
import { entreesSerialisables, type EntreesResolutionSerialisables } from '../workers/resolutionBody';
import type { OptimMetric } from './runeOptim';

/** Copie de données seules : même contrat dans Node et dans les Workers. */
export function copierDonnees<T>(valeur: T, vues = new Map<object, unknown>()): T {
  if (typeof valeur === 'function' || typeof valeur === 'symbol') throw new Error('Contexte de résultat non clonable');
  if (valeur === null || typeof valeur !== 'object') return valeur;
  const connu = vues.get(valeur);
  if (connu) return connu as T;
  const prototype = Object.getPrototypeOf(valeur);
  // Le harnais peut fournir des objets simples issus d'un autre contexte JS.
  const objetSimple = prototype === null || (Object.getPrototypeOf(prototype) === null
    && Object.prototype.hasOwnProperty.call(prototype, 'constructor')
    && Function.prototype.toString.call(prototype.constructor) === Function.prototype.toString.call(Object));
  if (!Array.isArray(valeur) && !objetSimple) throw new Error('Instance dans le contexte de résultat');
  const copie: Record<string, unknown> | unknown[] = Array.isArray(valeur) ? [] : {};
  vues.set(valeur, copie);
  for (const cle of Object.keys(valeur)) {
    const descripteur = Object.getOwnPropertyDescriptor(valeur, cle)!;
    if (descripteur.get || descripteur.set) throw new Error('Accesseur dans le contexte de résultat');
    (copie as Record<string, unknown>)[cle] = copierDonnees(descripteur.value, vues);
  }
  return Object.freeze(copie) as T;
}

export interface ContexteResultat {
  readonly versionSchema: 1;
  readonly idInventaire: number;
  readonly idEspece: number | null;
  readonly signature: string;
  readonly recherche: SearchParams;
  readonly fiche: GearSet;
  readonly resolution: EntreesResolutionSerialisables | null;
  readonly realDamage: RealDamageContext | null;
  readonly damageSetup: DamageSetup;
  readonly exclusive: EntreesResolutionSerialisables['exclusive'];
  /** « Vérifier toutes les combinaisons trouvées », figé au lancement : le changer après coup ne résout rien. */
  readonly toutVerifier: boolean;
}

/** Seul producteur de la photographie, jamais une liste parallèle dans l'écran. */
export function contexteResultat(e: {
  params: SearchParams;
  fiche: GearSet;
  resolution: Parameters<typeof entreesSerialisables>[0] | null;
  realDamage: RealDamageContext | null;
  damageSetup: DamageSetup;
  exclusive: EntreesResolutionSerialisables['exclusive'];
  signature: string;
  idInventaire: number;
  idEspece: number | null;
  toutVerifier: boolean;
}): ContexteResultat {
  if (!Number.isSafeInteger(e.idInventaire) || e.idInventaire < 0) throw new Error('Identité d’inventaire invalide');
  if (e.idEspece !== null && !Number.isSafeInteger(e.idEspece)) throw new Error('Identité d’espèce invalide');
  return copierDonnees({ versionSchema: 1 as const, idInventaire: e.idInventaire, idEspece: e.idEspece,
    signature: e.signature, recherche: e.params, fiche: e.fiche,
    resolution: e.resolution ? entreesSerialisables({ ...e.resolution, requirement: e.params.requirement, relicContext: e.params.relicContext }) : null,
    realDamage: e.realDamage, damageSetup: e.damageSetup, exclusive: e.exclusive, toutVerifier: e.toutVerifier === true });
}

/** L'équipement se résout pour l'objectif lancé, jamais pour le tri affiché. */
export function resolutionDuContexte(c: ContexteResultat): EntreesResolutionSerialisables | null {
  if (!c.resolution) return null;
  const regime = regimeEquipementDe(regimeArtefacts(c.recherche.objective ?? 'efficience'), c.resolution.degats !== null);
  return { ...c.resolution, regime };
}

const RUNES = new WeakMap<ContexteResultat, Map<number, SearchParams['pool'][number]>>();
export function runesDuContexte(c: ContexteResultat) {
  let runes = RUNES.get(c);
  if (!runes) { runes = new Map(c.recherche.pool.map((r) => [r.id, r])); RUNES.set(c, runes); }
  return runes;
}

// La préparation du réglage d'un contexte (`PreparationReglage`) : ses notes
// « Dégâts réels » lisent toutes le même `c.realDamage`, gelé par
// `copierDonnees` — la précondition de la préparation (entrées jamais
// modifiées) tient par construction ; une par contexte, partagée par toutes
// ses options, comme les runes.
const PREPARATIONS = new WeakMap<ContexteResultat, PreparationReglage>();
function preparationDuContexte(c: ContexteResultat) {
  let p = PREPARATIONS.get(c);
  if (!p) { p = new PreparationReglage(); PREPARATIONS.set(c, p); }
  return p;
}

export function optionsDuContexte(c: ContexteResultat, cache: ReadonlyMap<string, ResultatArtefacts> | null, metric: OptimMetric) {
  const runeById = runesDuContexte(c);
  return optionsDeClassement({ realDamage: c.realDamage, damageSetup: c.damageSetup, runeById, metric, reglage: preparationDuContexte(c),
    aurasPropresDe: aurasPropresParRunes(runeById),
    artefactsDuBuild: (b) => { const r = cache?.get(cleBuild(b)); return r ? artifactDamageProfile(r.artefacts) : null; },
    etatReliqueDe: (b) => etatReliqueDuBuild(cache?.get(cleBuild(b)), c.recherche.relicContext, c.fiche.relic),
    contexteExclusive: c.exclusive });
}
