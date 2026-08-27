// Ce qu'un PASSIF fait à la vitesse ou à la barre d'action.
//
// ⚠️ Un passif ne part pas au tour du monstre : la simulation du speed tuning
// l'écarte (voir speedTuneKit.ts). Or certains décident du tune — Shumar gagne
// 15 de vitesse en permanence, Elsharion 5 par buff allié. Ce module les LIT,
// pour qu'on puisse les appliquer au lieu de les découvrir en combat.
//
// ⚠️ **UN SEUL endroit pour ces règles de lecture.** Le script d'inventaire
// (scripts/passifs-vitesse.ts) importe ce module : les deux ne peuvent donc pas
// diverger. Une copie des regex dans le script avait déjà commencé à mentir.

import { Competence, DetailMonstre } from './monsterSkills';

// ⚠️ **Deux choses très différentes se cachent derrière « attack speed »** dans
// les textes, et les confondre fausse tout :
//
//   - « Increases your Attack Speed **for 2 turns** » (Juno) → le monstre gagne
//     le BUFF du jeu : +30 %, dispellable, **amplifié par le spd buff effect**.
//   - « increases your Attack Speed **by 5** for each… » (Elsharion) → un gain
//     PROPRE : ni dispellable, ni amplifié par l'artéfact.
//
// Le discriminant est dans le texte : un MONTANT (« by N ») = gain propre, une
// DURÉE seule (« for N turns ») = buff.
const MONTANT = /attack speed(?:\s+(?:is\s+)?(?:increased|increases))?\s+by\s+(\d+)\s*(%?)/i;
const CONDITION =
  /whenever|each time|every time|for each|for every|accumulat|according to|as the|per |up to \d+|when (you|the|an|your)|if (you|the)|after attack|while /i;

// ⚠️ Ce qu'on ne connaît QUE par relevé en jeu : les données ne le chiffrent pas.
// Mieux vaut une valeur assumée « relevée à la main » qu'un trou silencieux.
const RELEVE_EN_JEU: Record<string, { valeur: number; pourcent: boolean; plafond: number | null }> = {
  // Chilling / Jack-o'-lantern : « Your Attack Speed increases according to the
  // number of beneficial effects currently on you » — mesuré à +20 par buff.
  'The Cunning (Passive)': { valeur: 20, pourcent: false, plafond: null },
};

// ⚠️ Trous DÉFINITIFS : aucune valeur, ni dans les fiches ni en jeu (vérifié le
// 2026-08-24). Les marquer évite de repartir les chercher à chaque passe.
export const SANS_DONNEE = new Set([
  'Atrocity (Passive)',
  'Beast Man (Passive)',
  'Sugar Booster (Passive)',
  'The Bravest Cookie (Passive)',
]);

export interface GainVitesse {
  valeur: number; // le montant unitaire
  pourcent: boolean; // en % de la vitesse de base, sinon en points
  plafond: number | null; // ce que le gain ne peut pas dépasser
  parCumul: boolean; // il se répète (par buff, par tour adverse, par attaque…)
  releve: boolean; // valeur absente des données, relevée à la main
}

export interface PassifVitesse {
  nom: string;
  texte: string;
  // ⚠️ **Amplification des BUFFS reçus** — « Increases the increasing effects of
  // Attack Power, Defense and Attack Speed that allies receive by 35% » (Miriam).
  // C'est le même levier que l'artéfact « spd buff effect », mais porté par un
  // monstre et appliqué à TOUT SON CAMP. `equipe` dit s'il vaut pour les alliés
  // ou seulement pour lui.
  amplifieBuff: { valeur: number; equipe: boolean } | null;
  // Gain de vitesse PROPRE, le seul qu'on puisse appliquer soi-même.
  gain: GainVitesse | null;
  // Le passif pose le BUFF de vitesse du jeu (+30 %), sous condition.
  buff: boolean;
  // Barre d'action gagnée ou retirée HORS de son tour (`null` = montant inconnu).
  barre: { sens: 'gagnee' | 'retiree'; valeur: number | null } | null;
  // Tour supplémentaire pris hors de son tour.
  tourSupp: boolean;
  // Un effet est là, mais son montant est introuvable : à poser à la main.
  inconnu: boolean;
}

const phrases = (t: string) => t.split(/(?<=\.)\s+/).filter(Boolean);

// ⚠️ Le mot qui compte est le DERNIER avant « attack speed », pas n'importe
// lequel de la phrase. Chez Ciri, « damage that increases as the target's HP
// status DECREASES and increases your Attack Speed by 50 » : le « decreases »
// parle des PV de la cible, pas de la vitesse.
function pourSoi(phrase: string, index: number): boolean {
  const avant = phrase.slice(Math.max(0, index - 40), index).toLowerCase();
  const dernier = (re: RegExp) => {
    let pos = -1;
    for (const m of avant.matchAll(re)) pos = m.index ?? pos;
    return pos;
  };
  if (dernier(/decreas|reduc/g) > dernier(/increas|gain/g)) return false;
  return !/(enem(y|ies)'?s?|all(y|ies)'?)\s*$/i.test(avant.slice(-20));
}

// « up to 150% », « up to 100 » : le plafond du gain. ⚠️ « up to 10 TIMES » est
// un nombre de CUMULS, pas un plafond de vitesse.
function plafondDe(ph: string, valeur: number): number | null {
  const m = /up to (\d+)\s*(%?)(\s*times)?/i.exec(ph);
  if (!m) return null;
  const n = Number(m[1]);
  return m[3] ? n * valeur : n;
}

function quantite(c: Competence, nom: string): number | null {
  const e = c.effets.find((x) => x.nom === nom && typeof x.quantite === 'number' && x.quantite > 0);
  return e ? e.quantite : null;
}

function lirePassif(c: Competence): PassifVitesse | null {
  const texte = (c.description ?? '').replace(/\s+/g, ' ');
  const effets = c.effets.map((e) => e.nom);
  const a = (n: string) => effets.includes(n);

  let gain: GainVitesse | null = null;
  let gainFlou = false;
  let buff = false;

  for (const ph of phrases(texte)) {
    if (!/attack speed/i.test(ph)) continue;
    const m = MONTANT.exec(ph);
    if (m && pourSoi(ph, m.index)) {
      const valeur = Number(m[1]);
      gain = gain ?? {
        valeur,
        pourcent: m[2] === '%',
        plafond: plafondDe(ph, valeur),
        parCumul: CONDITION.test(ph),
        releve: false,
      };
      continue;
    }
    const i = ph.toLowerCase().indexOf('attack speed');
    if (!pourSoi(ph, i)) continue;
    if (/your attack speed (increases|is increased)/i.test(ph)) gainFlou = true;
    else if (/increases? (your|the) attack speed/i.test(ph)) buff = true;
  }

  if (!gain && (gainFlou || a('Accumulate SPD'))) {
    const releve = RELEVE_EN_JEU[c.nom];
    if (releve) gain = { ...releve, parCumul: true, releve: true };
  }
  if (!gain && !gainFlou && !buff && a('Increase ATK SPD')) buff = true;

  const barre: PassifVitesse['barre'] =
    a('Increase ATB') || a('Absorb ATB') || /fills? (up )?(your|the|its) attack bar/i.test(texte)
      ? { sens: 'gagnee', valeur: quantite(c, 'Increase ATB') ?? quantite(c, 'Absorb ATB') ?? null }
      : a('Decrease ATB')
        ? { sens: 'retiree', valeur: quantite(c, 'Decrease ATB') }
        : null;

  // ⚠️ « increasing effectS » (le pluriel) et « the effect of » se disent tous
  // les deux : on accepte les deux tournures, sans quoi le passif de Miriam
  // passait inaperçu — et c'est un des rares qui change un tune d'équipe.
  const ampli = /increases? the (?:increasing effects?|effects? of)[^.]*attack speed[^.]*?by (\d+)\s*%/i.exec(texte);
  const amplifieBuff = ampli
    ? { valeur: Number(ampli[1]), equipe: /all(y|ies)|team/i.test(ampli[0]) }
    : null;

  const tourSupp = a('Additional Turn') || /another turn|gains? a turn/i.test(texte);
  const inconnu = (gainFlou && !gain) || (barre != null && barre.valeur == null);

  if (!gain && !buff && !barre && !tourSupp && !inconnu && !amplifieBuff) return null;
  return { nom: c.nom, texte, amplifieBuff, gain, buff, barre, tourSupp, inconnu };
}

// Les passifs d'un monstre qui pèsent sur un speed tune. Vide s'il n'en a aucun.
export function passifsVitesse(detail: DetailMonstre | null): PassifVitesse[] {
  if (!detail) return [];
  const out: PassifVitesse[] = [];
  for (const c of detail.competences) {
    if (!c.passif) continue;
    const lu = lirePassif(c);
    if (lu) out.push(lu);
  }
  return out;
}

// Les points de vitesse qu'un gain apporte, pour `cumuls` déclenchements.
//
// ⚠️ Un gain en POURCENTAGE se compte sur la vitesse de BASE, comme le totem et
// le lead (voir speed.ts) — pas sur la vitesse déjà runée.
export function pointsDeGain(gain: GainVitesse | null, base: number | null, cumuls: number): number {
  if (!gain || base == null) return 0;
  const fois = gain.parCumul ? Math.max(0, cumuls) : 1;
  const brut = gain.pourcent ? Math.ceil((base * gain.valeur) / 100) * fois : gain.valeur * fois;
  if (gain.plafond == null) return brut;
  const plafond = gain.pourcent ? Math.ceil((base * gain.plafond) / 100) : gain.plafond;
  return Math.min(brut, plafond);
}
