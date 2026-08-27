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
  Camp,
  Coupure,
  EffetSort,
  HORIZON_TICKS,
  ModParTick,
  TuneMonstre,
  VitesseRequise,
  artefactsRequis,
  cleOccurrence,
  litOccurrence,
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
  // ⚠️ **LE CAMP, et il compte pour le CALCUL.** L'analyse ne voyait que les
  // alliés : elle plaçait donc leurs tours sur un plateau où personne n'occupait
  // de tick en face. Dès qu'un adverse en prend un — c'est-à-dire dès qu'il
  // COUPE — tous les tours alliés glissaient d'un cran à l'écran, et ce que
  // l'analyse avait écrit dans les grilles ne tombait plus au tick suivant le
  // lanceur. Absent = allié.
  camp?: Camp;
  // Ce que l'utilisateur a posé À LA MAIN dans les grilles. ⚠️ **Lu pour le camp
  // d'EN FACE seulement** : l'analyse ÉCRIT les grilles de ton camp, les lui
  // redonner en entrée compterait deux fois ce que les sorts posent. Celles d'en
  // face, elle n'y touche jamais — et les ignorer déplaçait le tour de l'adverse.
  atbMod?: ModParTick;
  speedMod?: ModParTick;
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
  // ⚠️ **Le verdict repose sur une CIBLE que l'app a choisie à ta place.** Au
  // moins un sort retenu ne touche qu'UN allié (`atbAllie` / `buffAllie`) et
  // personne ne lui a désigné de cible : l'analyse retombe alors sur « la barre
  // la plus basse », un défaut raisonnable — mais viser quelqu'un d'autre change
  // le résultat, et ce choix-là n'appartient qu'au joueur.
  //
  // ⚠️ Le siège s'en sert pour ne PAS trancher (voir siegeStatut.ts). L'outil,
  // lui, l'ignore : on y désigne la cible, donc la question ne se pose plus.
  cibleIndecise: boolean;
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
  // Un sort qui ne touche QU'UN allié — sa barre, sa vitesse, ou les deux.
  if (e.atbAllie || e.buffAllie) return 2;
  return 0;
}

// ⚠️ **À RANG ÉGAL, ce que le sort DÉLIVRE.** Le rang dit QUI est touché (tout
// le camp, un allié, soi) ; il ne dit pas COMBIEN. Racuni porte deux sorts « sur
// un allié » : *Breeze* (+15 % de barre) et *Rabbit's Agility* (barre PLEINE +
// 30 % de vitesse). Les deux valant 2, c'est le premier RENCONTRÉ qui gagnait —
// donc le S1, et l'analyse retenait le plus faible des deux. Le monstre visé
// n'avait alors ni sa barre remplie ni son buff de vitesse.
function poidsDansLeRang(x: SortVitesse): number {
  const e = x.effet;
  // Une seule de ces trois cases est remplie : le rang a déjà tranché la cible.
  const barre = e.atbEquipe ?? e.atbAllie ?? e.atbSoi ?? 0;
  // Un buff de vitesse EN PLUS vaut mieux que le même remplissage sans lui.
  const buff = e.buffEquipe ?? e.buffSoi ?? e.buffAllie ?? 0;
  return barre + buff;
}

function meilleurSort(liste: SortVitesse[], exclu?: string): SortVitesse | null {
  let meilleur: SortVitesse | null = null;
  let rang = 0;
  let poids = 0;
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
    if (v === 0) continue;
    const p = poidsDansLeRang(x);
    // ⚠️ Le rang PRIME toujours : un boost d'équipe reste au-dessus d'un boost
    // sur un allié, quels que soient les montants. Le poids ne départage QU'À
    // rang égal — il ne fait pas remonter un sort d'un cran.
    if (v > rang || (v === rang && p > poids)) {
      rang = v;
      poids = p;
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
  // ⚠️ **Le sort d'un tour SUPPLÉMENTAIRE se désigne, il ne se devine pas.** Un
  // combo fait jouer le même monstre deux fois avant l'adverse (Racuni se vise
  // au S2, sa barre se remplit, il rejoue et enchaîne son S1). Les tours au-delà
  // du premier portent une clé d'occurrence (`id#2`) dans les mêmes Records —
  // la 1ʳᵉ occurrence garde l'identifiant nu, donc rien ne change pour un
  // monstre qui ne joue qu'une fois.
  const sortDOccurrence = (e: EntreeAuto, n: number): SortVitesse | null => {
    if (n <= 1) return sortDe(e);
    const nom = choix?.sort?.[cleOccurrence(e.id, n)];
    if (!nom || e.monster.com2usId == null) return null;
    return (donnees.sorts.get(e.monster.com2usId) ?? []).find((x) => x.nom === nom) ?? null;
  };
  // Le plus grand rang d'occurrence désigné pour ce monstre.
  const derniereOccurrence = (e: EntreeAuto): number => {
    let max = 1;
    for (const cle of Object.keys(choix?.sort ?? {})) {
      const { id, n } = litOccurrence(cle);
      if (id === e.id && n > max) max = n;
    }
    return max;
  };
  const secondDe = (e: EntreeAuto): SortVitesse | null => {
    const nom = choix?.sort2?.[e.id];
    if (nom === '') return null;
    if (nom != null && e.monster.com2usId != null)
      return (donnees.sorts.get(e.monster.com2usId) ?? []).find((x) => x.nom === nom) ?? null;
    return sortSecondRetenu(e, donnees);
  };
  // ⚠️ **LES DEUX CAMPS, dans l'ordre où ils sont donnés.** `equipe` est le
  // PLATEAU, pas seulement ton côté : un adverse occupe des ticks, et un seul
  // monstre agit par tick. L'analyse ne voyait que les alliés — elle les plaçait
  // donc sur un plateau vide en face, et dès qu'un adverse coupait, tous les
  // tours alliés glissaient d'un cran à l'écran. Ce qu'elle avait écrit dans les
  // grilles ne tombait alors plus au tick suivant le lanceur, mais sur son tour
  // même, ou plus loin.
  //
  // ⚠️ **L'ordre du tableau est CONSERVÉ** : c'est lui qui départage deux barres
  // pleines à vitesse égale (`placement`, voir `simuler`). Trier par camp ici
  // aurait fait diverger l'analyse et l'écran sur les égalités exactes — le cas
  // même que le réglage d'équipe produit à longueur de temps.
  const campDe = (e: EntreeAuto): Camp => e.camp ?? 'allie';
  const allies = equipe.filter((e) => campDe(e) === 'allie');
  const adverses = equipe.filter((e) => campDe(e) === 'ennemi');

  const combats = new Map<string, number>();
  for (const e of equipe) {
    // ⚠️ Chaque monstre est compté DANS SON CAMP : les buffs qu'on estime pour
    // son passif (Chilling) sont ceux que son propre camp lui donne.
    const c = combatAuto(e, lead, donnees, campDe(e) === 'allie' ? allies : adverses);
    if (c != null && c > 0) combats.set(e.id, c);
  }

  // L'amplification de buff est une affaire de camp, elle aussi.
  const ampli = ampliCamp(allies, donnees);
  const ampliAdverse = ampliCamp(adverses, donnees);
  const vus = allies.filter((e) => combats.has(e.id));

  // 4. L'adversaire de référence : une copie du plus rapide. ⚠️ Il ne reçoit PAS
  // l'amplification de l'équipe — il est en face.
  const modele = vus.reduce<EntreeAuto | null>(
    (a, b) => (a == null || combats.get(b.id)! > combats.get(a.id)! ? b : a),
    null
  );

  // ⚠️ **Le PLATEAU, dans l'ordre donné** — allié ou adverse, chacun à sa place :
  // c'est cet ordre qui départage deux barres pleines à vitesse égale.
  let indecise = false;
  const avecSorts: TuneMonstre[] = equipe
    .filter((e) => combats.has(e.id))
    .map((e) => {
      // ⚠️ **Les adverses réels entrent dans la simulation, mais ne lancent
      // rien.** Ce sont leurs TICKS qui comptent : un tour pris en face décale
      // tous les suivants. Leur kit reste hors du calcul — un speed tune est ce
      // qui tient sans rien attendre de ce que fait l'autre (voir « Ce qu'on
      // retire à l'adverse »). Ce que l'utilisateur a posé À LA MAIN sur eux est
      // repris, en revanche : c'est une saisie, pas une déduction, et l'ignorer
      // déplaçait leur tour.
      if (campDe(e) === 'ennemi') {
        return {
          id: e.id,
          combat: combats.get(e.id)!,
          camp: 'ennemi' as Camp,
          artefactBuff: (e.artefactBuff ?? 0) + ampliAdverse,
          atbMod: e.atbMod,
          speedMod: e.speedMod,
        };
      }
      const sort = sortDe(e);
      const second = sortDe(e)?.rejoue ? secondDe(e) : null;
      const cible = choix?.cible?.[e.id] || undefined;
      // ⚠️ **La clé de rechargement est le NOM du sort.** Tant qu'un monstre
      // relançait toujours le même, l'horloge par tour suffisait ; dès qu'il en
      // lance deux, les deux la partageraient et le second serait bloqué.
      const enEffet = (x: SortVitesse | null, n: number): EffetSort | undefined =>
        x
          ? {
              ...sansReductionAdverse(x.effet),
              cooldown: x.cooldown,
              cle: x.nom,
              // ⚠️ **La cible appartient au couple (tour, sort), pas au
              // monstre.** Un tour supplémentaire ne reprend PAS la cible du
              // premier : enchaîner Breeze après un Rabbit's Agility visé sur
              // soi aurait visé le lanceur une seconde fois, sans qu'on l'ait
              // demandé. Chaque tour part du défaut et se désigne à part.
              cibleAllie: choix?.cible?.[cleOccurrence(e.id, n)] || (n === 1 ? cible : undefined),
            }
          : undefined;
      // Rien tant qu'aucun tour supplémentaire n'est désigné : le moteur
      // retombe alors sur `sort`, exactement comme avant.
      // Un sort mono-cible SANS cible désignée : le verdict dépend alors d'un
      // choix que l'app a fait à la place du joueur.
      if ((sort?.effet.atbAllie || sort?.effet.buffAllie) && !cible) indecise = true;
      const dernier = derniereOccurrence(e);
      const sortsParTour =
        dernier > 1
          ? Array.from({ length: dernier }, (_, i) => enEffet(sortDOccurrence(e, i + 1), i + 1))
          : undefined;
      return {
        id: e.id,
        combat: combats.get(e.id)!,
        camp: 'allie' as Camp,
        artefactBuff: (e.artefactBuff ?? 0) + ampli,
        sort: enEffet(sort, 1),
        rejoue: sort?.rejoue ?? false,
        sort2: second
          ? { ...sansReductionAdverse(second.effet), cooldown: second.cooldown, cle: second.nom, cibleAllie: cible }
          : undefined,
        sortsParTour,
      };
    });
  // L'adversaire de RÉFÉRENCE ne s'ajoute que s'il n'y a personne en face :
  // c'est un repère faute d'adversaire, pas un adversaire de plus.
  if (modele && adverses.length === 0) {
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
  // ⚠️ **Aucune grille n'est écrite sur un adverse RÉEL.** L'analyse n'y pose
  // rien (il ne lance pas son kit) : lui renvoyer une grille vide effacerait ce
  // que l'utilisateur y a saisi à la main. L'adversaire de RÉFÉRENCE, lui, en
  // reçoit une — il est là pour être vérifié comme les autres.
  // ⚠️ La RÉFÉRENCE n'est pas un adverse réel : elle vit dans le camp d'en face
  // mais c'est l'outil qui la pose, et elle doit rester vérifiable comme les
  // autres. Elle garde donc sa grille.
  const reels = new Set(adverses.filter((e) => e.id !== idReference).map((e) => e.id));
  const mods = new Map(
    final
      .filter((m) => !reels.has(m.id))
      .map((m) => [m.id, { atbMod: m.atbMod ?? {}, speedMod: m.speedMod ?? {} }])
  );
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
    cibleIndecise: indecise,
  };
}
