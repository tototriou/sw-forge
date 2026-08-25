// L'ANALYSE AUTOMATIQUE d'une équipe, telle que l'outil la produit — mais
// utilisable ailleurs.
//
// ⚠️ **UN SEUL endroit pour cette suite d'étapes.** Le siège doit répondre
// EXACTEMENT ce que répondrait l'outil si on l'ouvrait et qu'on cliquait sur
// « Analyser » : deux implémentations donneraient deux verdicts sur la même
// équipe, et c'est le genre d'écart qu'on ne voit qu'en le cherchant.
//
// Les étapes, dans l'ordre — chacune compte, changer l'ordre change le résultat :
//   1. vitesse de combat de chacun (runes + lead + Swift + gain de passif) ;
//   2. amplification des buffs apportée par un allié (Miriam) ;
//   3. sort retenu dans le kit de chacun, avec son rechargement ;
//   4. adversaire de RÉFÉRENCE : une copie du plus rapide, en face ;
//   5. simulation, puis RÉÉCRITURE des effets dans les grilles (décalés d'un
//      tick, voir plus bas), puis SECONDE simulation — c'est celle-là qui donne
//      le verdict, exactement comme à l'écran.

import { Monster } from '../types';
import { combatSpeed } from './speed';
import {
  ArtefactRequis,
  Coupure,
  HORIZON_TICKS,
  ModParTick,
  TuneMonstre,
  VitesseRequise,
  artefactsRequis,
  diagnostiquerChaine,
  premiersTours,
  sansReductionAdverse,
  simuler,
  vitessesRequises,
} from './speedTune';
import { KitVitesse, SortVitesse } from './speedTuneKit';
import { PassifVitesse, pointsDeGain } from './speedTunePassif';

// Un monstre de l'équipe, tel que l'écran le connaît.
export interface EntreeAuto {
  id: string;
  monster: Monster;
  runeSpeed: number | null;
  swift?: boolean;
  artefactBuff?: number | null;
  // Déclenchements du gain de passif (buffs portés, tours adverses…).
  // ⚠️ `null`/absent = on ESTIME (voir `cumulsEstimes`) ; un nombre = c'est le
  // chiffre de l'utilisateur, on n'y touche pas.
  cumulsPassif?: number | null;
  // Les sets de runes du monstre. Sert au comptage des buffs : la **Volonté**
  // (`will`) en pose un dès le début du combat (Immunité 1 tour).
  sets?: string[];
  passifActif?: boolean;
  // Le lead PROPRE à ce monstre (lead d'ÉLÉMENT), quand le lead de camp ne sait
  // pas le dire. Absent = il suit celui du camp. ⚠️ Sans lui, la vitesse
  // affichée sur la card de siège et celle du verdict n'étaient pas la même.
  lead?: number | null;
}

// Ce que les kits pré-générés donnent, déjà chargé par l'appelant.
export interface DonneesKit {
  kits: Map<number, KitVitesse>;
  sorts: Map<number, SortVitesse[]>;
  passifs: Map<number, PassifVitesse[]>;
}

export interface ResultatAuto {
  // Vitesse de combat retenue pour chacun (passif compris).
  combats: Map<string, number>;
  // L'allié copié en face comme repère, `null` si l'équipe est vide.
  reference: EntreeAuto | null;
  verdict: Coupure;
  requis: VitesseRequise[];
  arte: ArtefactRequis[];
  // L'ordre des premiers tours, alliés seulement.
  ordre: { id: string; tick: number }[];
  // Ce que les sorts posent, prêt à être ÉCRIT dans les grilles de l'écran
  // (déjà décalé d'un tick, voir plus bas). L'outil s'en sert pour remplir ses
  // cases : c'est la MÊME source que le verdict, donc les deux ne peuvent pas
  // se contredire.
  mods: Map<string, { atbMod: ModParTick; speedMod: ModParTick }>;
}

const kitDe = (e: EntreeAuto, d: DonneesKit) =>
  e.monster.com2usId != null ? (d.kits.get(e.monster.com2usId) ?? null) : null;

const passifDe = (e: EntreeAuto, d: DonneesKit): PassifVitesse | null => {
  if (e.monster.com2usId == null || e.passifActif === false) return null;
  return (d.passifs.get(e.monster.com2usId) ?? []).find((p) => p.gain || p.amplifieBuff) ?? null;
};

// Le sort qu'un monstre lance par défaut, choisi dans son kit.
//
// ⚠️ **Une priorité explicite, pas un score pondéré.** Ce qui pèse sur un tune
// se classe naturellement, du plus large au plus étroit — et un ordre se
// discute, alors que des coefficients inventés ne se vérifient nulle part :
//
//   1. remplir la barre de TOUT le camp ;
//   2. buffer la vitesse de TOUT le camp ;
//   3. se rendre son propre tour (Power of Mirkwood, Legolas) ;
//   4. se buffer / se remplir soi-même ;
//   5. remplir la barre d'UN allié.
//
// ⚠️ **Vider la barre de l'adverse n'y figure PAS**, et c'est délibéré : une
// équipe doit jouer d'affilée SANS ça. Compter un retrait d'ATB revient à
// déclarer un tune bon parce qu'on aura ralenti l'autre — alors que le tune,
// c'est précisément ce qui tient quand on n'a rien ralenti. Le sort reste
// choisissable à la main, en connaissance de cause.
//
// ⚠️ Une version précédente ne regardait que les effets **de ZONE** : un monstre
// dont le meilleur sort se buffe lui-même et REJOUE — le cas de Legolas — était
// alors réputé ne rien lancer. Le siège le déclarait « pas speed tune » là où
// l'outil, où l'on avait choisi le sort à la main, disait l'inverse.
function valeurPourLeTune(x: SortVitesse): number {
  const e = x.effet;
  if (e.atbEquipe) return 6;
  if (e.buffEquipe) return 5;
  if (x.rejoue) return 4;
  if (e.buffSoi || e.atbSoi) return 3;
  if (e.atbAllie) return 2;
  return 0;
}

function meilleurSort(liste: SortVitesse[], exclu?: string): SortVitesse | null {
  let meilleur: SortVitesse | null = null;
  let rang = 0;
  for (const x of liste) {
    if (x.nom === exclu) continue;
    // ⚠️ **Un sort à TAUX DE RÉUSSITE n'est jamais retenu d'office.** Un tune ne
    // doit pas dépendre d'un effet qui peut se louper : le Glorious Attack de
    // Madeleine vide la barre adverse « avec 30 % de chances » — le compter par
    // défaut déclarait l'équipe speed tune sur un coup de dé. On peut toujours
    // le choisir à la main dans l'ordre des sorts, en connaissance de cause (le
    // menu affiche le taux).
    if (x.chance != null) continue;
    const v = valeurPourLeTune(x);
    if (v > rang) {
      rang = v;
      meilleur = x;
    }
  }
  return meilleur;
}

export function sortRetenu(e: EntreeAuto, d: DonneesKit): SortVitesse | null {
  if (e.monster.com2usId == null) return null;
  return meilleurSort(d.sorts.get(e.monster.com2usId) ?? []);
}

// Le sort du SECOND tour, quand le premier rend son tour au lanceur : le
// meilleur de ce qui reste. ⚠️ Sans lui, un monstre qui rejoue passait son tour
// supplémentaire à ne rien faire — alors que c'est justement ce tour-là qu'on
// lui donne pour agir.
export function sortSecondRetenu(e: EntreeAuto, d: DonneesKit): SortVitesse | null {
  if (e.monster.com2usId == null) return null;
  const premier = sortRetenu(e, d);
  if (!premier?.rejoue) return null;
  return meilleurSort(d.sorts.get(e.monster.com2usId) ?? [], premier.nom);
}

// Vitesse de combat d'un monstre, gain de passif compris.
export function combatAuto(
  e: EntreeAuto,
  lead: number,
  d: DonneesKit,
  equipe: EntreeAuto[] = [e]
): number | null {
  const base = combatSpeed(e.monster.stats.speed, e.runeSpeed, e.lead ?? lead, e.swift ?? false);
  if (base == null) return null;
  const p = passifDe(e, d);
  const cumuls = e.cumulsPassif ?? cumulsEstimes(e, equipe, d);
  return base + pointsDeGain(p?.gain ?? null, e.monster.stats.speed, cumuls);
}

// ⚠️ **Combien de BUFFS ce monstre porte**, quand son passif les compte
// (Chilling : +20 de vitesse par buff). On ne peut pas le deviner en général —
// mais deux sources sont connues d'avance et suffisent au cas courant :
//
//   - la **Volonté** (`will`) : elle pose une Immunité dès le premier tour ;
//   - les **buffs de zone que ses alliés lancent** (bouclier, immunité, ATQ/DEF,
//     buff de vitesse), comptés sur le sort que chacun a retenu.
//
// ⚠️ C'est une ESTIMATION, pas une vérité : elle suppose que ces buffs sont bien
// posés au moment où le passif compte. Le chiffre reste modifiable — un nombre
// saisi n'est jamais écrasé.
export function cumulsEstimes(e: EntreeAuto, equipe: EntreeAuto[], d: DonneesKit): number {
  // ⚠️ La **Volonté** est personnelle (elle protège CELUI qui la porte), le
  // **Bouclier** ne l'est pas : un seul monstre en Bouclier dans l'équipe, et
  // TOUT LE MONDE porte un bouclier au premier tour. Les traiter pareil aurait
  // sous-compté les buffs de toute l'équipe sauf un.
  const bouclierEquipe = equipe.some((m) => (m.sets ?? []).includes('shield'));
  let n = ((e.sets ?? []).includes('will') ? 1 : 0) + (bouclierEquipe ? 1 : 0);
  for (const autre of equipe) {
    if (autre.id === e.id) continue;
    n += sortRetenu(autre, d)?.buffsEquipe ?? 0;
  }
  return n;
}

// L'amplification des buffs apportée à TOUT le camp (Miriam). Ne s'empile pas :
// on garde la plus forte.
export function ampliCamp(equipe: EntreeAuto[], d: DonneesKit): number {
  let max = 0;
  for (const e of equipe) {
    const a = passifDe(e, d)?.amplifieBuff;
    if (a?.equipe && a.valeur > max) max = a.valeur;
  }
  return max;
}

// Les sorts DÉSIGNÉS par l'utilisateur, quand il y en a : ils l'emportent sur ce
// que le kit retiendrait. ⚠️ Sans ça, l'écran affichait un ordre des sorts dont
// personne ne tenait compte — on choisissait un sort, et le verdict n'en savait
// rien.
// ⚠️ **« Aucun sort » est un CHOIX, l'absence de choix en est un autre.** Les
// deux se sont longtemps écrits pareil, et c'est ce qui a produit le bug : la
// chaîne rendait le boost de barre d'un monstre à qui on venait justement de
// dire de ne rien lancer.
//
//   - `''`      → « Aucun sort » : il joue, mais rien qui touche la vitesse.
//                 C'est une VALEUR, elle s'enregistre.
//   - `AUTO`    → « laisser le kit décider » : on RETIRE l'entrée, et le sort du
//                 kit reprend la main.
//
// ⚠️ **Une seule fonction pour les deux sorts.** Le premier réservait la
// suppression à `AUTO` (juste), le second supprimait sur `''` (faux) : deux
// conventions pour la même chose, écrites à deux endroits. Choisir « Aucun sort »
// en second tour effaçait donc le choix, et le kit rappliquait son sort — le
// +15 % de barre de Kroa revenait alors qu'on venait de l'écarter.
export const AUTO = '__auto';

export function noterChoix(
  prev: Record<string, string>,
  uid: string,
  valeur: string
): Record<string, string> {
  const next = { ...prev };
  if (valeur === AUTO) delete next[uid];
  else next[uid] = valeur;
  return next;
}

export interface ChoixSorts {
  sort?: Record<string, string>;
  sort2?: Record<string, string>;
  cible?: Record<string, string>;
}

export interface OptionsAuto {
  horizon?: number;
  choix?: ChoixSorts;
  // L'identifiant à donner à l'adversaire de référence. Par défaut `ref:<id du
  // modèle>` ; l'écran y met l'identifiant de SA ligne, pour pouvoir y reporter
  // ce que l'analyse écrit — un monstre dont on ne voit pas les modificateurs
  // est un monstre dont on ne peut pas vérifier le calcul.
  idReference?: string;
}

export function analyseAutomatique(
  equipe: EntreeAuto[],
  lead: number,
  donnees: DonneesKit,
  options: OptionsAuto = {}
): ResultatAuto {
  const { horizon = HORIZON_TICKS, choix, idReference } = options;

  // Le sort effectivement lancé : celui qu'on a désigné, sinon celui du kit.
  const sortDe = (e: EntreeAuto): SortVitesse | null => {
    const nom = choix?.sort?.[e.id];
    if (nom === '') return null;
    if (nom != null && e.monster.com2usId != null)
      return (donnees.sorts.get(e.monster.com2usId) ?? []).find((x) => x.nom === nom) ?? null;
    return sortRetenu(e, donnees);
  };
  const secondDe = (e: EntreeAuto): SortVitesse | null => {
    const nom = choix?.sort2?.[e.id];
    if (nom === '') return null;
    if (nom != null && e.monster.com2usId != null)
      return (donnees.sorts.get(e.monster.com2usId) ?? []).find((x) => x.nom === nom) ?? null;
    return sortSecondRetenu(e, donnees);
  };
  const combats = new Map<string, number>();
  for (const e of equipe) {
    const c = combatAuto(e, lead, donnees, equipe);
    if (c != null && c > 0) combats.set(e.id, c);
  }

  const ampli = ampliCamp(equipe, donnees);
  const vus = equipe.filter((e) => combats.has(e.id));

  // 4. L'adversaire de référence : une copie du plus rapide. ⚠️ Il ne reçoit PAS
  // l'amplification de l'équipe — il est en face.
  const modele = vus.reduce<EntreeAuto | null>(
    (a, b) => (a == null || combats.get(b.id)! > combats.get(a.id)! ? b : a),
    null
  );

  const avecSorts: TuneMonstre[] = vus.map((e) => {
    const sort = sortDe(e);
    const second = sortDe(e)?.rejoue ? secondDe(e) : null;
    const cible = choix?.cible?.[e.id] || undefined;
    return {
      id: e.id,
      combat: combats.get(e.id)!,
      camp: 'allie',
      artefactBuff: (e.artefactBuff ?? 0) + ampli,
      sort: sort
        ? { ...sansReductionAdverse(sort.effet), cooldown: sort.cooldown, cibleAllie: cible }
        : undefined,
      rejoue: sort?.rejoue ?? false,
      sort2: second
        ? { ...sansReductionAdverse(second.effet), cooldown: second.cooldown, cibleAllie: cible }
        : undefined,
    };
  });
  if (modele) {
    avecSorts.push({
      id: idReference ?? `ref:${modele.id}`,
      combat: combats.get(modele.id)!,
      camp: 'ennemi',
      artefactBuff: modele.artefactBuff ?? 0,
    });
  }

  // 5. Ce que les sorts posent est ÉCRIT dans les grilles, puis rejoué.
  //
  // ⚠️ **Décalé d'un tick.** Dans le moteur, ce qu'une compétence pose arrive
  // APRÈS l'arbitrage du tick (le lanceur vient de jouer) ; une case de grille,
  // elle, est posée AVANT. Sur le même tick, un allié boosté volerait le tour du
  // lanceur. C'est exactement ce que fait l'écran — les deux doivent coïncider.
  const pose = simuler(avecSorts, horizon);
  const parId = new Map(pose.lignes.map((l) => [l.id, l]));
  const final: TuneMonstre[] = avecSorts.map((m) => {
    const l = parId.get(m.id);
    const atbMod: ModParTick = {};
    const speedMod: ModParTick = {};
    if (l) {
      for (const [tick, v] of Object.entries(l.effetAtb)) {
        const suivant = Number(tick) + 1;
        if (v !== 0 && suivant <= horizon) atbMod[suivant] = v;
      }
      for (const [tick, v] of Object.entries(l.effetSpeed)) if (v !== 0) speedMod[Number(tick)] = v;
    }
    return {
      id: m.id,
      combat: m.combat,
      camp: m.camp,
      artefactBuff: m.artefactBuff,
      rejoue: m.rejoue,
      atbMod,
      speedMod,
    };
  });

  const verdict = diagnostiquerChaine(final, horizon);
  const mods = new Map(final.map((m) => [m.id, { atbMod: m.atbMod ?? {}, speedMod: m.speedMod ?? {} }]));
  return {
    mods,
    combats,
    reference: modele,
    verdict,
    requis: verdict.ok ? [] : vitessesRequises(final, horizon),
    arte: verdict.ok ? [] : artefactsRequis(final, horizon),
    ordre: premiersTours(simuler(final, horizon))
      .filter((a) => a.camp === 'allie')
      .map((a) => ({ id: a.id, tick: a.tick })),
  };
}
