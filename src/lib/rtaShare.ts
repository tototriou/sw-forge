// Partage d'une prépa RTA entre joueurs, et instantané local de restauration.
// 100 % local : aucun envoi réseau, le contenu est téléchargé en fichier.
//
// ⚠️ **Deux usages, un seul modèle** (`RtaSnapshot`) :
//   - le **point de restauration** (« Sauvegarder » / « Reprendre ») vit dans le
//     `localStorage` du joueur ;
//   - le **fichier partagé** est le même contenu, sérialisé en JSON lisible.
// Un seul format évite qu'une prépa restaurée et une prépa importée ne suivent
// pas les mêmes règles — c'est la même chose vue de deux endroits.
//
// Conventions reprises telles quelles de [recoShare.ts](recoShare.ts), le
// précédent en la matière : clés françaises, validation qui REMONTE ses
// corrections au lieu de les taire, un seul format (JSON), un seul support
// (fichier `.json`).

import {
  RtaState,
  RtaEntry,
  RUNE_SETS,
  RTA_OTHER,
  RTA_UNASSIGNED,
  ELEMENTS,
  ElementKey,
  Monster,
  GearSet,
  RelicUnique,
} from '../types';
import { RtaCategory } from '../hooks/useRtaCategories';

const SET_KEYS = new Set<string>(RUNE_SETS.map((s) => s.key));
// Sections acceptées : les sets de runes + les deux sections spéciales.
const isSectionKey = (k: string) => SET_KEYS.has(k) || k === RTA_OTHER || k === RTA_UNASSIGNED;

export const LABEL_MAX = 24; // libellé d'une catégorie (même borne que le hook)
export const NOM_MAX = 60; // nom de la prépa partagée
export const AUTEUR_MAX = 40;

/* --------------------------------------------------------------------------
 * Le modèle transporté
 * ----------------------------------------------------------------------- */

// Une entrée partagée. ⚠️ **`com2usId` et non l'id local** : c'est la seule clé
// stable d'un joueur à l'autre (même règle que les recommandations, voir
// ../../spec/siege/recommandations.md). Le `nom` sert de repli d'affichage si le
// monstre est absent des données chargées chez celui qui importe.
// Un monstre PERSO, décrit en entier dans le fichier.
//
// ⚠️ Il n'a pas de `com2usId` : rien ne permet de le RETROUVER chez le lecteur.
// Mais il se décrit entièrement — nom, élément, vitesse de base, lead — et c'est
// tout ce qu'il faut pour l'AFFICHER. Une première version l'écartait purement
// et simplement : une prépa contenant une sortie récente arrivait amputée, et
// son ordre de tour était faux d'un monstre.
export interface RtaSharePerso {
  nom: string;
  element: ElementKey;
  vitesse: number;
  lead?: { stat: string; amount: number; area: string };
}

export interface RtaShareEntry {
  /** `null` pour un monstre perso, qui est alors décrit par `perso`. */
  com2usId: number | null;
  /** Description complète, pour les monstres absents du bestiaire. */
  perso?: RtaSharePerso;
  nom: string;
  section: string;
  runeSpeed: number | null;
  /**
   * Position dans l'ordre de tour (1 = le plus rapide). Présent **uniquement au
   * niveau `ordre`**, où les vitesses ne sont pas transmises : le lecteur ne
   * pourrait pas le recalculer, et c'est justement le seul renseignement que
   * l'auteur accepte de donner.
   */
  rang?: number;
  sets?: string[]; // sets actifs, tels que calculés à l'import de compte
  // ⚠️ Présent SEULEMENT si l'auteur a choisi de partager son équipement.
  // C'est tout l'intérêt de consulter la prépa d'un ami : voir COMMENT il rune,
  // pas seulement quelle vitesse il vise.
  gear?: GearSet;
}

// Une catégorie partagée : l'appartenance est exprimée en `com2usId`, jamais en
// id local — sinon les anneaux atterriraient sur les mauvais monstres.
export interface RtaShareCategory {
  label: string;
  color: string;
  membres: number[]; // com2usId
  /** Positions (index dans `monstres`) des membres PERSO, qui n'ont pas d'id. */
  membresPerso?: number[];
}

// ⚠️ **L'équipement se partage, mais sur DÉCISION de l'auteur.** Consulter la
// prépa d'un ami sans voir comment il rune n'a pas grand intérêt — c'est
// justement ce qu'on vient y chercher. Mais son équipement dit aussi ce qu'il
// possède : certains ne veulent pas l'exposer. D'où un choix explicite à
// l'export (`niveau`), et non une règle imposée dans un sens ou l'autre.
//
// ⚠️ Ce qui est reçu n'est JAMAIS mélangé à ce qu'on possède : une prépa
// consultée s'ouvre à côté de la sienne (voir
// ../../spec/rta/sauvegarde-partage.md). Elle ne remplace rien et ne se compare
// à rien.
// ⚠️ **Un NIVEAU ordonné, pas des drapeaux indépendants.** Chaque palier retire
// une couche de plus, et chaque couche retirée l'est parce qu'elle **révèle le
// runage** — pas par principe :
//
// | Niveau | Ce qui part | Ce qui reste caché |
// |--------|-------------|--------------------|
// | `complet` | équipement, sets, vitesses, sections, catégories | rien |
// | `vitesses` | vitesses **et sets** — de quoi lire l'ordre de tour | le **détail** des runes, les sections, les catégories |
// | `ordre` | l'ordre des monstres | tout le reste, vitesses et sets compris |
//
// ⚠️ Le niveau `vitesses` correspond exactement à ce qu'affiche l'ordre de tour :
// vitesse finale + icônes de set. On voit COMMENT l'autre joue (« Trevor Swift à
// 227 ») sans voir ses substats — c'est le partage de speed tune, le cas le plus
// courant entre amis.
//
// Deux booléens indépendants auraient laissé composer « runes sans vitesses »,
// qui n'a aucun sens : les runes PORTENT la vitesse.
export type NiveauPartage = 'complet' | 'vitesses' | 'ordre';

export interface RtaSnapshot {
  nom: string;
  auteur: string;
  sections: string[];
  entries: RtaShareEntry[];
  categories: RtaShareCategory[];
  /** Ce que l'auteur a choisi de laisser voir. Annoncé en consultation. */
  niveau: NiveauPartage;
}

/* --------------------------------------------------------------------------
 * Conversion depuis / vers l'état de l'application
 * ----------------------------------------------------------------------- */

// Combien de monstres partent, et combien sont des monstres perso ? Le second
// chiffre sert à l'annoncer : le lecteur les verra sans portrait.
export function comptePartageable(
  state: RtaState,
  monsterById: Map<string, Monster>
): { partageables: number; perso: number } {
  let partageables = 0;
  let perso = 0;
  for (const id of Object.keys(state.entries)) {
    const m = monsterById.get(id);
    if (!m) continue; // absent des données chargées : rien à décrire
    partageables++;
    if (m.com2usId == null) perso++;
  }
  return { partageables, perso };
}

// État de l'app → instantané transportable.
//
// ⚠️ Les **monstres perso** (`com2usId = null`) sont **écartés** : ils n'existent
// que dans le navigateur de leur auteur, rien ne permettrait de les retrouver
// ailleurs. C'est signalé à l'export, jamais silencieux.
export function toSnapshot(
  state: RtaState,
  categories: RtaCategory[],
  monsterById: Map<string, Monster>,
  meta: { nom?: string; auteur?: string; niveau?: NiveauPartage } = {}
): RtaSnapshot {
  const niveau = meta.niveau ?? 'complet';
  const avecEquipement = niveau === 'complet';
  // ⚠️ Les SETS partent dès le niveau `vitesses` : c'est ce que montre l'ordre
  // de tour (icônes de set sur chaque vignette), et ce qui rend le partage utile
  // — « Trevor Swift à 227 » se lit, « Trevor à 227 » beaucoup moins. Le DÉTAIL
  // des runes (substats, meules) reste, lui, réservé au niveau complet.
  const avecSets = niveau !== 'ordre';
  // ⚠️ La vitesse de BASE d'un monstre est publique : donner sa vitesse totale,
  // c'est donner l'écart, donc **exactement** la vitesse apportée par ses runes.
  // Au niveau `ordre`, elles ne partent donc pas — seul le RANG est transmis.
  const avecVitesses = niveau !== 'ordre';

  // ⚠️ **Les SECTIONS partent avec les sets.** Une section EST un set de runes :
  // ranger un monstre dans « Swift » annonce qu'il est runé Swift, aussi
  // sûrement que l'icône. Les retirer des sets en gardant le classement par
  // section n'aurait rien caché du tout.
  const avecSections = niveau === 'complet';

  const entries: RtaShareEntry[] = [];
  // id local → com2usId, pour traduire l'appartenance aux catégories.
  const com2usParId = new Map<string, number>();
  // id local → position dans `entries`, seule clé possible pour un monstre perso.
  const indexParId = new Map<string, number>();

  // Au niveau `ordre`, ce qui est transmis est le RANG et rien d'autre. Il est
  // calculé ici, à l'export : le lecteur ne peut pas le recalculer sans les
  // vitesses, et l'auteur ne veut justement pas les donner.
  const rangs = new Map<string, number>();
  if (niveau === 'ordre') {
    const tri = Object.values(state.entries)
      .map((e) => {
        const m = monsterById.get(e.monsterId);
        const base = m?.stats.speed ?? null;
        const total = base !== null || e.runeSpeed !== null ? (base ?? 0) + (e.runeSpeed ?? 0) : null;
        return { e, m, total };
      })
      .filter((x) => x.m)
      .sort((a, b) => {
        if (a.total === null && b.total === null) return a.m!.name.localeCompare(b.m!.name);
        if (a.total === null) return 1;
        if (b.total === null) return -1;
        return b.total - a.total || a.m!.name.localeCompare(b.m!.name);
      });
    tri.forEach((x, i) => rangs.set(x.e.monsterId, i + 1));
  }

  for (const e of Object.values(state.entries)) {
    const m = monsterById.get(e.monsterId);
    if (!m) continue; // absent des données chargées : rien à décrire
    if (m.com2usId != null) com2usParId.set(e.monsterId, m.com2usId);
    else indexParId.set(e.monsterId, entries.length);
    entries.push({
      com2usId: m.com2usId,
      // Un monstre perso emporte sa description : c'est la seule façon de
      // l'afficher chez quelqu'un qui ne l'a pas créé.
      perso:
        m.com2usId == null
          ? {
              nom: m.name.slice(0, 40),
              element: m.element,
              vitesse: m.stats.speed ?? 0,
              ...(m.leaderSkill && m.leaderSkill.stat
                ? {
                    lead: {
                      stat: m.leaderSkill.stat,
                      amount: m.leaderSkill.amount,
                      area: m.leaderSkill.area,
                    },
                  }
                : {}),
            }
          : undefined,
      nom: m.name.slice(0, 40),
      // Sans sections partagées, tout le monde arrive en « Non classé » : la
      // consultation n'affiche alors que l'ordre de tour.
      section: avecSections && isSectionKey(e.section) ? e.section : RTA_UNASSIGNED,
      runeSpeed:
        avecVitesses && typeof e.runeSpeed === 'number' && Number.isFinite(e.runeSpeed)
          ? e.runeSpeed
          : null,
      rang: rangs.get(e.monsterId),
      sets: avecSets ? e.sets : undefined,
      gear: avecEquipement ? e.gear : undefined,
    });
  }

  return {
    nom: (meta.nom ?? '').slice(0, NOM_MAX),
    auteur: (meta.auteur ?? '').slice(0, AUTEUR_MAX),
    sections: avecSections ? state.sections.filter(isSectionKey) : [],
    entries,
    niveau,
    // ⚠️ Les CATÉGORIES ne partent qu'au niveau complet : elles sont libres, et
    // le joueur les nomme souvent d'après son runage (« Swift lead »,
    // « Violent »). Les transmettre rendrait vaine la dissimulation des sets.
    // Une catégorie dont aucun membre n'est partageable est conservée quand même
    // (libellé + couleur ont une valeur en soi), mais vidée de fait.
    categories: (avecEquipement ? categories : []).map((c) => ({
      label: c.label.slice(0, LABEL_MAX),
      color: c.color,
      membres: c.members
        .map((id) => com2usParId.get(id))
        .filter((v): v is number => typeof v === 'number'),
      // ⚠️ Les monstres PERSO n'ont pas de `com2usId` : leur appartenance passe
      // par leur POSITION dans `monstres`. Sans ça, une catégorie appliquée à un
      // monstre perso se perdait à l'export.
      membresPerso: c.members
        .map((id) => indexParId.get(id))
        .filter((v): v is number => typeof v === 'number'),
    })),
  };
}

// Une prépa reçue, prête à être AFFICHÉE — jamais fusionnée avec la sienne.
//
// ⚠️ **Rien n'est comparé à ce que je possède.** Les monstres et les runes
// affichés sont ceux de l'auteur, tels quels. Confronter à ma box répondrait à
// une autre question (« puis-je jouer ça ? ») — c'est le rôle des
// [recommandations de siège](../../spec/siege/recommandations.md), qui existent
// précisément pour ça. Ici on regarde la prépa d'un ami comme on regarderait
// son écran par-dessus son épaule.
export interface RtaVueAmi {
  nom: string;
  auteur: string;
  niveau: NiveauPartage;
  sections: string[];
  /**
   * Monstres résolus dans le bestiaire local (le portrait, le nom, les stats).
   * `rang` n'est renseigné qu'au niveau `ordre` : ailleurs, l'ordre de tour est
   * recalculé depuis les vitesses, comme sur sa propre prépa.
   */
  entries: { monster: Monster; entry: RtaEntry; rang?: number }[];
  categories: { label: string; color: string; members: Set<string> }[];
  /** `com2usId` absents des données chargées : annoncés, jamais avalés. */
  inconnus: number[];
}

// Instantané → état de l'app, pour REPRENDRE une prépa à soi (archive, autre
// navigateur, sauvegarde d'il y a six mois).
//
// ⚠️ **Deux lectures d'un même fichier, deux fonctions.** `versVueAmi` affiche
// la prépa de quelqu'un d'autre sans y toucher ; `appliquer` la fait sienne. Le
// fichier est le même — c'est l'INTENTION qui diffère, et elle ne se devine pas :
// l'utilisateur la déclare en choisissant son bouton.
//
// ⚠️ **Le `gear` local prime.** Un monstre déjà présent garde l'équipement venu
// de MON import de compte : c'est l'état réel de mes runes aujourd'hui, plus
// juste que celui figé dans un fichier ancien. L'équipement du fichier ne sert
// qu'à combler les monstres que je n'ai pas encore.
// ⚠️ `creerPerso` **recrée** les monstres perso du fichier chez le lecteur : ils
// n'existent nulle part ailleurs, donc reprendre une sauvegarde sans eux
// amputerait la prépa. L'appelant fournit la fabrique (le hook des monstres
// perso), ce module restant sans dépendance à React.
export function appliquer(
  snap: RtaSnapshot,
  monsterByCom2us: Map<number, Monster>,
  actuel: RtaState,
  creerPerso?: (p: RtaSharePerso) => Monster
): {
  state: RtaState;
  categories: { label: string; color: string; members: string[] }[];
  inconnus: number[];
} {
  const entries: Record<string, RtaEntry> = {};
  const idParCom2us = new Map<number, string>();
  const idParIndex = new Map<number, string>();
  const inconnus: number[] = [];

  snap.entries.forEach((e, index) => {
    let id: string;

    if (e.com2usId != null) {
      const m = monsterByCom2us.get(e.com2usId);
      if (!m) {
        if (!inconnus.includes(e.com2usId)) inconnus.push(e.com2usId);
        return;
      }
      id = String(m.id);
      idParCom2us.set(e.com2usId, id);
    } else if (e.perso && creerPerso) {
      id = String(creerPerso(e.perso).id);
      idParIndex.set(index, id);
    } else {
      return; // pas de fabrique fournie : on n'invente pas de monstre
    }

    const precedent = actuel.entries[id];
    entries[id] = {
      monsterId: id,
      section: e.section,
      runeSpeed: e.runeSpeed,
      sets: precedent?.sets ?? e.sets,
      gear: precedent?.gear ?? e.gear,
    };
  });

  const sections = [...snap.sections];
  if (!sections.includes(RTA_OTHER)) sections.push(RTA_OTHER); // « Autre » est permanente

  return {
    state: { sections, entries },
    categories: snap.categories.map((c) => ({
      label: c.label,
      color: c.color,
      members: [
        ...c.membres.map((cid) => idParCom2us.get(cid)),
        ...(c.membresPerso ?? []).map((i) => idParIndex.get(i)),
      ].filter((v): v is string => typeof v === 'string'),
    })),
    inconnus,
  };
}

// Instantané → vue consultable. Les entrées portent les runes de L'AUTEUR : ce
// sont des données d'affichage, elles n'entrent jamais dans l'état de l'app.
export function versVueAmi(snap: RtaSnapshot, monsterByCom2us: Map<number, Monster>): RtaVueAmi {
  const entries: { monster: Monster; entry: RtaEntry; rang?: number }[] = [];
  const idParCom2us = new Map<number, string>();
  // Position dans `snap.entries` → id d'affichage, pour les catégories des perso.
  const idParIndex = new Map<number, string>();
  const inconnus: number[] = [];

  snap.entries.forEach((e, index) => {
    let m: Monster | undefined;
    let id: string;

    if (e.com2usId != null) {
      m = monsterByCom2us.get(e.com2usId);
      if (!m) {
        if (!inconnus.includes(e.com2usId)) inconnus.push(e.com2usId);
        return; // monstre absent des données : rien à afficher
      }
      id = String(m.id);
      idParCom2us.set(e.com2usId, id);
    } else if (e.perso) {
      // ⚠️ Monstre PERSO reconstitué depuis le fichier. Son id est **local à
      // cette consultation** (`ami-perso-N`) : il ne désigne rien chez le
      // lecteur et n'a pas à le faire — il ne sert qu'à câbler l'affichage.
      id = `ami-perso-${index}`;
      m = {
        id,
        com2usId: null,
        name: e.perso.nom || 'Monstre perso',
        element: e.perso.element,
        stars: null,
        naturalStars: null,
        secondAwaken: false,
        image: null,
        stats: {
          hp: null,
          attack: null,
          defense: null,
          speed: e.perso.vitesse,
          critRate: null,
          critDamage: null,
          resistance: null,
          accuracy: null,
        },
        leaderSkill: e.perso.lead
          ? {
              stat: e.perso.lead.stat,
              amount: e.perso.lead.amount,
              area: e.perso.lead.area,
              element: e.perso.lead.area === 'Element' ? e.perso.element : null,
            }
          : null,
      };
      idParIndex.set(index, id);
    } else {
      return; // ni id ni description : rien à afficher
    }

    entries.push({
      monster: m,
      rang: e.rang,
      entry: {
        monsterId: id,
        section: e.section,
        runeSpeed: e.runeSpeed,
        sets: e.sets ?? [],
        gear: e.gear,
      },
    });
  });

  const sections = [...snap.sections];
  if (!sections.includes(RTA_OTHER)) sections.push(RTA_OTHER); // « Autre » est permanente

  return {
    nom: snap.nom,
    auteur: snap.auteur,
    niveau: snap.niveau,
    sections,
    entries,
    categories: snap.categories.map((c) => ({
      label: c.label,
      color: c.color,
      members: new Set(
        [
          ...c.membres.map((cid) => idParCom2us.get(cid)),
          // Les perso sont désignés par leur position, faute d'identifiant.
          ...(c.membresPerso ?? []).map((i) => idParIndex.get(i)),
        ].filter((v): v is string => typeof v === 'string')
      ),
    })),
    inconnus,
  };
}

/* --------------------------------------------------------------------------
 * Validation — le contenu vient d'un tiers, on ne lui fait pas confiance
 * ----------------------------------------------------------------------- */

export interface Issues {
  errors: string[]; // bloquants : rien n'est importé
  warnings: string[]; // corrections appliquées : l'import a lieu quand même
}

const noIssues = (): Issues => ({ errors: [], warnings: [] });

// Une même correction peut se répéter sur 80 monstres : on ne l'écrit qu'une fois.
function warn(ctx: Issues, msg: string) {
  if (!ctx.warnings.includes(msg)) ctx.warnings.push(msg);
}

// L'équipement reçu d'un tiers. Il n'est utilisé QU'À L'AFFICHAGE (roue de
// runes, stats totales de l'auteur) : il n'entre jamais dans la prépa locale, ne
// se compare à rien et n'est jamais réexporté comme s'il était à nous.
//
// ⚠️ Validation structurelle seulement — types et bornes. On ne juge pas la
// **plausibilité** des valeurs : un socle de rune inhabituel peut venir d'une
// nouveauté du jeu que cette version ne connaît pas encore, et refuser
// l'affichage serait pire que montrer un chiffre surprenant.
function cleanEffect(raw: unknown): { code: number; value: number; grind?: number; enchant?: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const code = Number(o.code);
  const value = Number(o.value);
  if (!Number.isFinite(code) || !Number.isFinite(value)) return null;
  const grind = Number(o.grind);
  return {
    code,
    value,
    ...(Number.isFinite(grind) && grind !== 0 ? { grind } : {}),
    ...(o.enchant === true ? { enchant: true } : {}),
  };
}

// Propriété unique d'une relique reçue d'un tiers.
//
// ⚠️ **Deux formes acceptées.** Les fichiers exportés jusqu'ici portaient
// `relic.sub = { code, value }` — où `code` était en réalité le TYPE de la
// relique et `value` la TRANCHE de stat, le pourcentage étant perdu à
// l'extraction. On les lit encore, sans pourcentage : la tranche seule
// s'affiche, plutôt qu'un « +0 % » faux. Les fichiers récents portent
// `relic.unique = { type, tranche, percent }`.
function cleanRelicUnique(relic: Record<string, unknown> | undefined): RelicUnique | null {
  if (!relic) return null;
  const u = relic.unique as Record<string, unknown> | undefined;
  if (u && typeof u === 'object') {
    const type = Number(u.type);
    const tranche = Number(u.tranche);
    if (!Number.isFinite(type) || !Number.isFinite(tranche) || type <= 0 || tranche <= 0) return null;
    const percent = Number(u.percent);
    return { type, tranche, ...(Number.isFinite(percent) && percent > 0 ? { percent } : {}) };
  }
  const ancien = cleanEffect(relic.sub);
  if (!ancien || ancien.code <= 0 || ancien.value <= 0) return null;
  return { type: ancien.code, tranche: ancien.value };
}

const nombre = (v: unknown, defaut = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : defaut;
};

function cleanGear(raw: unknown): GearSet | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;

  const b = (o.base ?? {}) as Record<string, unknown>;
  const base = {
    hp: nombre(b.hp),
    atk: nombre(b.atk),
    def: nombre(b.def),
    spd: nombre(b.spd),
    cr: nombre(b.cr),
    cd: nombre(b.cd),
    res: nombre(b.res),
    acc: nombre(b.acc),
  };

  const runes = (Array.isArray(o.runes) ? o.runes : [])
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const ro = r as Record<string, unknown>;
      const main = cleanEffect(ro.main);
      if (!main) return null; // une rune sans stat principale n'est pas affichable
      const slot = nombre(ro.slot);
      const set = typeof ro.set === 'string' && SET_KEYS.has(ro.set) ? ro.set : null;
      if (slot < 1 || slot > 6 || !set) return null;
      const innate = cleanEffect(ro.innate);
      return {
        id: nombre(ro.id),
        slot: Math.round(slot),
        set,
        rank: nombre(ro.rank),
        rarity: nombre(ro.rarity, 1),
        level: nombre(ro.level),
        main,
        ...(innate ? { innate } : {}),
        subs: (Array.isArray(ro.subs) ? ro.subs : [])
          .map(cleanEffect)
          .filter((s): s is NonNullable<ReturnType<typeof cleanEffect>> => !!s),
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);

  const artifacts = (Array.isArray(o.artifacts) ? o.artifacts : [])
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const ao = a as Record<string, unknown>;
      const main = cleanEffect(ao.main);
      const kind = ao.kind === 'element' || ao.kind === 'archetype' ? ao.kind : null;
      if (!main || !kind) return null;
      return {
        kind,
        ...(typeof ao.element === 'string' ? { element: ao.element as GearSet['artifacts'][number]['element'] } : {}),
        ...(typeof ao.archetype === 'string'
          ? { archetype: ao.archetype as GearSet['artifacts'][number]['archetype'] }
          : {}),
        level: nombre(ao.level),
        rarity: nombre(ao.rarity, 1),
        main,
        subs: (Array.isArray(ao.subs) ? ao.subs : [])
          .map(cleanEffect)
          .filter((s): s is NonNullable<ReturnType<typeof cleanEffect>> => !!s),
      };
    })
    .filter((a): a is NonNullable<typeof a> => !!a);

  const relicMain = cleanEffect((o.relic as Record<string, unknown>)?.main);
  const relicUnique = cleanRelicUnique(o.relic as Record<string, unknown> | undefined);

  // Un équipement entièrement vide ne vaut pas la peine d'être transporté :
  // il ferait apparaître un chevron « voir le détail » qui n'ouvre rien.
  if (runes.length === 0 && artifacts.length === 0 && !relicMain) return undefined;

  return {
    base,
    runes,
    artifacts,
    ...(relicMain ? { relic: { main: relicMain, ...(relicUnique ? { unique: relicUnique } : {}) } } : {}),
  } as GearSet;
}

const ELEMENT_KEYS = new Set<string>(ELEMENTS.map((e) => e.key));

// Description d'un monstre perso reçue d'un tiers. Un nom et une vitesse
// suffisent : le reste a des valeurs de repli raisonnables. Sans vitesse, le
// monstre fausserait l'ordre de tour — on préfère alors l'ignorer.
function cleanPerso(raw: unknown): RtaSharePerso | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const nom = typeof o.nom === 'string' ? o.nom.trim().slice(0, 40) : '';
  const vitesse = Number(o.vitesse);
  if (!nom || !Number.isFinite(vitesse) || vitesse <= 0) return undefined;

  const element =
    typeof o.element === 'string' && ELEMENT_KEYS.has(o.element)
      ? (o.element as ElementKey)
      : 'unknown';

  const l = o.lead as Record<string, unknown> | undefined;
  const montant = Number(l?.amount);
  const lead =
    l && typeof l.stat === 'string' && Number.isFinite(montant) && montant > 0
      ? {
          stat: l.stat.slice(0, 40),
          amount: montant,
          area: typeof l.area === 'string' ? l.area.slice(0, 20) : 'General',
        }
      : undefined;

  return { nom, element, vitesse: Math.round(vitesse), ...(lead ? { lead } : {}) };
}

function cleanEntry(raw: unknown, ctx: Issues, where: string): RtaShareEntry | null {
  if (!raw || typeof raw !== 'object') {
    warn(ctx, `${where} : entrée invalide — ignorée.`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = Number(o.com2usId);
  const aUnId = Number.isFinite(id) && id > 0;

  // Monstre PERSO : pas d'identifiant, mais une description complète. Les deux
  // sont acceptés ; ce qui n'a NI l'un NI l'autre est ignoré.
  const perso = cleanPerso(o.perso);
  if (!aUnId && !perso) {
    warn(
      ctx,
      `${where} : ni « com2usId » valide (${String(o.com2usId)}) ni description de monstre perso — ignoré.`
    );
    return null;
  }

  const nom = o.nom ?? o.name;
  const brutSection = o.section;
  let section = typeof brutSection === 'string' ? brutSection : RTA_UNASSIGNED;
  if (!isSectionKey(section)) {
    warn(ctx, `${where} : section inconnue « ${String(brutSection)} » — rangé en « Non classé ».`);
    section = RTA_UNASSIGNED;
  }

  // Vitesse : `null` est une valeur légitime (« pas encore saisie »), à ne pas
  // confondre avec une valeur aberrante.
  const brutVitesse = o.runeSpeed ?? o.vitesse;
  let runeSpeed: number | null = null;
  if (brutVitesse != null) {
    const n = Number(brutVitesse);
    if (!Number.isFinite(n) || n < 0) {
      warn(ctx, `${where} : vitesse invalide (${String(brutVitesse)}) — laissée vide.`);
    } else {
      runeSpeed = Math.round(n);
    }
  }

  const sets = (Array.isArray(o.sets) ? o.sets : []).filter(
    (s): s is string => typeof s === 'string' && SET_KEYS.has(s)
  );

  // Rang dans l'ordre de tour, transmis quand les vitesses ne le sont pas.
  const brutRang = Number(o.rang);
  const rang = Number.isFinite(brutRang) && brutRang > 0 ? Math.round(brutRang) : undefined;

  return {
    com2usId: aUnId ? Math.round(id) : null,
    ...(perso ? { perso } : {}),
    nom: typeof nom === 'string' ? nom.slice(0, 40) : perso?.nom ?? '',
    section,
    runeSpeed,
    ...(rang !== undefined ? { rang } : {}),
    ...(sets.length ? { sets } : {}),
    ...(() => {
      const gear = cleanGear(o.equipement ?? o.gear);
      return gear ? { gear } : {};
    })(),
  };
}

function cleanCategory(raw: unknown, ctx: Issues, where: string): RtaShareCategory | null {
  if (!raw || typeof raw !== 'object') {
    warn(ctx, `${where} : catégorie invalide — ignorée.`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.trim().slice(0, LABEL_MAX) : '';
  const color = typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : null;
  if (!label || !color) {
    warn(ctx, `${where} : catégorie sans libellé ou sans couleur valide — ignorée.`);
    return null;
  }
  const brut = o.membres ?? o.members;
  const membres: number[] = [];
  if (Array.isArray(brut)) {
    for (const v of brut) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0 && !membres.includes(Math.round(n))) membres.push(Math.round(n));
    }
  }

  // Membres PERSO, désignés par leur position dans `monstres` — donc `0` est un
  // index légitime, contrairement aux `com2usId` ci-dessus.
  const membresPerso: number[] = [];
  if (Array.isArray(o.membresPerso)) {
    for (const v of o.membresPerso) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && !membresPerso.includes(Math.round(n))) {
        membresPerso.push(Math.round(n));
      }
    }
  }

  return { label, color, membres, ...(membresPerso.length ? { membresPerso } : {}) };
}

/* --------------------------------------------------------------------------
 * Format JSON — celui des FICHIERS échangés
 * ----------------------------------------------------------------------- */

export const JSON_FORMAT = 'sw-forge/prepa-rta';
// v2 : l'**équipement** (runes, artéfacts, relique) peut accompagner chaque
// monstre — c'est ce qu'on vient voir dans la prépa d'un ami. Il reste
// facultatif : l'auteur choisit à l'export. Un fichier v1 se lit sans perte, il
// n'a simplement rien à montrer côté runes.
export const JSON_VERSION = 2;

// Clés en clair (français, comme l'interface) : un joueur peut ouvrir le
// fichier, le relire et le corriger sans décodeur.
export function encodeSnapshot(snap: RtaSnapshot): string {
  return JSON.stringify(
    {
      format: JSON_FORMAT,
      version: JSON_VERSION,
      exporte_le: new Date().toISOString(),
      nom: snap.nom,
      auteur: snap.auteur,
      // Annoncé dans le fichier : le lecteur sait si l'absence de runes est un
      // choix de l'auteur ou un fichier d'une version antérieure.
      // Informatif : la consultation déduit le niveau de ce qu'elle lit
      // réellement, jamais de cette clé (voir `validateRtaImport`).
      niveau: snap.niveau,
      sections: snap.sections,
      monstres: snap.entries.map((e) => ({
        com2usId: e.com2usId ?? undefined,
        // Description complète d'un monstre perso : sans elle, il serait
        // impossible de l'afficher chez qui ne l'a pas créé.
        perso: e.perso,
        nom: e.nom,
        section: e.section,
        // `undefined` disparaît du JSON ; `null` y resterait comme une clé vide,
        // qui se lit comme « vitesse non saisie » et non « vitesse masquée ».
        vitesse: e.runeSpeed ?? undefined,
        rang: e.rang,
        sets: e.sets?.length ? e.sets : undefined,
        equipement: e.gear,
      })),
      // Omises si vides : une prépa sans catégorie ne traîne pas une liste vide.
      categories: snap.categories.length
        ? snap.categories.map((c) => ({
            label: c.label,
            color: c.color,
            membres: c.membres,
            membresPerso: c.membresPerso?.length ? c.membresPerso : undefined,
          }))
        : undefined,
    },
    null,
    2
  );
}

export interface ImportReport extends Issues {
  snapshot: RtaSnapshot | null; // null = rien d'importable
  counts: { monstres: number; sections: number; categories: number; avecRunes: number };
}

// **Validateur d'import** — JSON uniquement. Rend compte de ce qu'il a lu :
// erreurs bloquantes ET corrections appliquées.
export function validateRtaImport(text: string): ImportReport {
  const ctx = noIssues();
  const vide: ImportReport = {
    ...ctx,
    snapshot: null,
    counts: { monstres: 0, sections: 0, categories: 0, avecRunes: 0 },
  };

  const t = text.trim();
  if (!t) {
    ctx.errors.push('Contenu vide.');
    return { ...vide, ...ctx };
  }
  // Message explicite plutôt qu'une erreur de parseur cryptique.
  if (!t.startsWith('{')) {
    ctx.errors.push("Attendu un JSON de prépa RTA (fichier .json d'export SW Forge).");
    return { ...vide, ...ctx };
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(t) as Record<string, unknown>;
  } catch (e) {
    ctx.errors.push(`JSON invalide : ${(e as Error).message}`);
    return { ...vide, ...ctx };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    ctx.errors.push('Le JSON doit être un objet contenant une clé « monstres ».');
    return { ...vide, ...ctx };
  }

  if (typeof obj.format === 'string' && obj.format !== JSON_FORMAT) {
    // Erreur BLOQUANTE et non simple avertissement : importer une prépa
    // REMPLACE la prépa en cours. Se tromper de fichier (une recommandation de
    // siège, par exemple) coûterait le classement en place.
    ctx.errors.push(
      `Ce fichier est un export « ${obj.format} », pas une prépa RTA (« ${JSON_FORMAT} »).`
    );
    return { ...vide, ...ctx };
  }

  const version = Number(obj.version);
  if (Number.isFinite(version) && version > JSON_VERSION) {
    warn(
      ctx,
      `Fichier au format v${version}, plus récent que cette version de SW Forge (v${JSON_VERSION}) — ` +
        `ce qui n'est pas reconnu a été ignoré.`
    );
  } else if (Number.isFinite(version) && version < JSON_VERSION) {
    // Lu sans perte, mais signalé : sinon un fichier ancien circule
    // indéfiniment dans la guilde et personne ne sait qu'il peut désormais
    // porter les runes (même raisonnement que pour les recommandations).
    warn(
      ctx,
      `Fichier au format v${version} (actuel : v${JSON_VERSION}) : il ne contient pas les runes. ` +
        `Demande à son auteur de le réexporter pour les voir.`
    );
  }

  const brutMonstres = Array.isArray(obj.monstres)
    ? obj.monstres
    : Array.isArray(obj.entries)
      ? obj.entries
      : null;
  if (!brutMonstres) {
    ctx.errors.push("Clé « monstres » absente ou invalide : ce n'est pas un export de prépa RTA.");
    return { ...vide, ...ctx };
  }

  const entries: RtaShareEntry[] = [];
  const vus = new Set<number>();
  brutMonstres.forEach((raw, i) => {
    const e = cleanEntry(raw, ctx, `Monstre ${i + 1}`);
    if (!e) return;
    // Une seule carte par monstre, comme dans l'app : le doublon est écarté.
    // ⚠️ La dédup ne porte QUE sur les monstres identifiés : deux monstres perso
    // ont tous deux `com2usId: null` sans être le même monstre, et les traiter
    // comme des doublons n'en aurait laissé passer qu'un seul.
    if (e.com2usId != null) {
      if (vus.has(e.com2usId)) {
        warn(
          ctx,
          `« ${e.nom || e.com2usId} » apparaît plusieurs fois — seule la première entrée est gardée.`
        );
        return;
      }
      vus.add(e.com2usId);
    }
    entries.push(e);
  });

  if (entries.length === 0) {
    ctx.errors.push('Aucun monstre exploitable dans ce fichier.');
    return { ...vide, ...ctx };
  }

  // Sections : celles du fichier, plus celles qu'exigent les monstres reçus —
  // un monstre rangé dans une section absente de la liste deviendrait invisible.
  const sections: string[] = [];
  const brutSections = Array.isArray(obj.sections) ? obj.sections : [];
  for (const s of brutSections) {
    if (typeof s !== 'string' || !isSectionKey(s) || s === RTA_UNASSIGNED) continue;
    if (!sections.includes(s)) sections.push(s);
  }
  for (const e of entries) {
    if (e.section !== RTA_UNASSIGNED && !sections.includes(e.section)) sections.push(e.section);
  }
  if (!sections.includes(RTA_OTHER)) sections.push(RTA_OTHER);

  const categories: RtaShareCategory[] = [];
  const brutCats = Array.isArray(obj.categories) ? obj.categories : [];
  brutCats.forEach((raw, i) => {
    const c = cleanCategory(raw, ctx, `Catégorie ${i + 1}`);
    if (c) categories.push(c);
  });

  const nom = typeof obj.nom === 'string' ? obj.nom.slice(0, NOM_MAX) : '';
  const auteur = typeof obj.auteur === 'string' ? obj.auteur.slice(0, AUTEUR_MAX) : '';

  // ⚠️ Le niveau est déduit de **ce qu'on a RÉELLEMENT lu**, jamais de la clé
  // `niveau` du fichier : un `"complet"` sans la moindre rune afficherait
  // « runes incluses » sur une prépa qui n'en montre aucune.
  const niveau: NiveauPartage = entries.some((e) => e.gear)
    ? 'complet'
    : entries.some((e) => e.runeSpeed !== null)
      ? 'vitesses'
      : 'ordre';

  return {
    ...ctx,
    snapshot: { nom, auteur, sections, entries, categories, niveau },
    counts: {
      monstres: entries.length,
      sections: sections.length,
      categories: categories.length,
      avecRunes: entries.filter((e) => e.gear).length,
    },
  };
}
