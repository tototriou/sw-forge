// Speed tuning — règle des ticks, ordre « un seul monstre par tick », et
// simulation multi-tours (la barre repart de 0 après chaque tour). Fonctions
// pures de src/lib/speedTune.ts. La formule (combat × 7/100, action à 100) est
// simple, mais la règle « un par tick », les modificateurs et les remises à zéro
// se vérifient à la main.

import {
  speedForTick,
  simuler,
  premiersTours,
  atbParTick,
  diagnostiquerChaine,
  vitessesRequises,
  artefactsRequis,
  diagnostiquerSequence,
  fenetresRequises,
  COMBAT_MAX,
  ARTE_MAX,
  PASSES_MAX,
  HORIZON_TICKS,
  TuneMonstre,
  Simulation,
  VitesseRequise,
  ArtefactRequis,
} from '../src/lib/speedTune';
import { deckPourSpeedTune } from '../src/lib/speedTuneDeck';
import { kitVitesse, sortsVitesse, BUFF_SPD_JEU } from '../src/lib/speedTuneKit';
import { DetailMonstre, Competence, EffetCompetence } from '../src/lib/monsterSkills';
import { Monster, SiegeTeam } from '../src/types';
import { egal, ok, titre } from './outils';

export default function testSpeedTune() {
  titre('Speed tuning');

  // Règle des ticks : vitesse mini pour agir au tick n = ceil(10000/(7n)).
  egal(speedForTick(11), 130, 'tick 11 → 130');
  egal(speedForTick(6), 239, 'tick 6 → 239 (Lent)');
  egal(speedForTick(5), 286, 'tick 5 → 286 (Rapide)');
  egal(speedForTick(3), 477, 'tick 3 → 477');
  egal(atbParTick(129), 9.03, 'combat 129 → 9,03 % par tick');

  const camp = (combat: number, camp: 'allie' | 'ennemi' = 'allie'): TuneMonstre => ({
    id: `${combat}-${camp}`,
    combat,
    camp,
  });
  const trajDe = (sim: Simulation, id: string) => sim.lignes.find((l) => l.id === id)!.trajectoire;

  // Deux vitesses franches, sans collision : chacun agit à son propre tick.
  {
    const pt = premiersTours(simuler([camp(200), camp(100)]));
    egal(pt.length, 2, 'deux monstres → deux premiers tours');
    egal(pt[0].id, '200-allie', 'le plus rapide joue en premier');
    egal(pt[0].tick, 8, 'combat 200 → agit au tick 8 (14 %/tick, 112 %)');
    egal(pt[1].tick, 15, 'combat 100 → agit au tick 15 (7 %/tick, 105 %)');
    egal(pt[0].ordre, 1, 'ordre 1 au plus rapide');
  }

  // ⚠️ LE cas « un seul par tick » : trois pleins au MÊME tick (9) prennent le
  // tour l'un après l'autre (9, 10, 11), pas tous au même.
  {
    const pt = premiersTours(simuler([camp(173), camp(172, 'ennemi'), camp(171)]));
    egal(pt.map((a) => a.id), ['173-allie', '172-ennemi', '171-allie'], 'ordre par vitesse au même tick');
    egal(pt.map((a) => a.tick), [9, 10, 11], 'un seul par tick : 9 / 10 / 11');
    egal(pt[1].camp, 'ennemi', 'le camp est conservé');
  }

  // Égalité parfaite : l'ordre de placement départage, échelonné d'un tick.
  {
    const pt = premiersTours(simuler([camp(150), camp(150, 'ennemi')]));
    egal(pt[0].id, '150-allie', 'à vitesse égale, le premier placé passe');
    egal(pt[0].tick + 1, pt[1].tick, 'un par tick : le second attend le tick suivant');
  }

  // Boost de barre d'attaque : +30 % au tick 3 → agit plus tôt (tick 10 vs 15).
  {
    const sim = simuler([camp(100), { id: 'boost', combat: 100, camp: 'allie', atbMod: { 3: 30 } }]);
    const pt = premiersTours(sim);
    egal(pt[0].id, 'boost', 'le boost d\'ATB fait agir plus tôt');
    egal(pt[0].tick, 10, 'combat 100 + boost 30 % au tick 3 → agit au tick 10');
    egal(trajDe(sim, 'boost')[2], 51, 'la trajectoire montre le saut de barre au tick 3');
  }

  // Réduction de barre : −50 % au tick 2 vide la barre sans passer en négatif.
  {
    const sim = simuler([{ id: 'reduc', combat: 100, camp: 'allie', atbMod: { 2: -50 } }]);
    egal(trajDe(sim, 'reduc')[1], 0, 'la barre tombe à 0 au tick 2, pas en négatif');
    egal(premiersTours(sim)[0].tick, 17, 'après remise à 0 au tick 2, action au tick 17');
  }

  // ⚠️ Buff de vitesse PAR TICK, sans report : marqué au seul tick 1, il ne
  // profite qu'à ce tick (9,1 %) puis retour à la vitesse de base → tick 14.
  // (S'il était soutenu, ce serait le tick 11 : c'est ce qu'on NE veut PAS.)
  {
    const pt = premiersTours(simuler([{ id: 'buff', combat: 100, camp: 'allie', speedMod: { 1: 30 } }]));
    egal(pt[0].tick, 14, 'buff au seul tick 1 → agit au tick 14 (pas de report)');
  }

  // Un buff qui DURE se marque sur chaque tick : +30 % aux ticks 1→5 → tick 13.
  {
    const speedMod = { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30 };
    const pt = premiersTours(simuler([{ id: 'dure', combat: 100, camp: 'allie', speedMod }]));
    egal(pt[0].tick, 13, 'buff marqué sur les ticks 1→5 → agit au tick 13');
  }

  // Artéfact « augmente l'effet du buff de vitesse » : ADDITIF au buff, actif
  // seulement quand un buff est posé ce tick-là.
  {
    // buff +30 % au tick 1 + artéfact +20 % → vitesse ×1,50 → 10,5 %/tick au tick 1.
    const sim = simuler([
      { id: 'arte', combat: 100, camp: 'allie', speedMod: { 1: 30 }, artefactBuff: 20 },
    ]);
    egal(sim.lignes[0].trajectoire[0], 10.5, 'buff +30 % + artéfact +20 % → 10,5 au tick 1');
  }
  {
    // Sans buff ce tick-là, l'artéfact ne fait RIEN (vitesse de base).
    const sim = simuler([{ id: 'sansbuff', combat: 100, camp: 'allie', artefactBuff: 20 }]);
    egal(sim.lignes[0].trajectoire[0], 7, 'artéfact ignoré tant qu\'aucun buff n\'est actif');
  }

  // ⚠️ Multi-tours : après avoir joué, la barre repart de 0 et le monstre rejoue.
  // Sur 40 ticks, combat 300 (inc 21) agit d'abord au tick 5, puis tous les ~5.
  {
    const sim = simuler([camp(300)]);
    egal(sim.lignes[0].trajectoire.length, 40, 'trajectoire calculée sur 40 ticks');
    egal(sim.actions[0].tick, 5, 'combat 300 → premier tour au tick 5');
    ok(sim.actions.length >= 7, 'un monstre rapide rejoue plusieurs fois sur 40 ticks');
    // La barre repart de 0 : au tick juste après le premier tour, elle est basse.
    ok(sim.lignes[0].trajectoire[5] < 100, 'après le tour au tick 5, la barre est repartie de 0');
  }

  // Un seul monstre agit par tick, sur toute la simulation.
  {
    const sim = simuler([camp(300), camp(300, 'ennemi'), camp(200)]);
    const ticks = sim.actions.map((a) => a.tick);
    egal(new Set(ticks).size, ticks.length, 'jamais deux actions sur le même tick');
  }

  // Vitesse nulle → écartée de la simulation.
  {
    const sim = simuler([camp(0), camp(120)]);
    egal(sim.lignes.length, 1, 'un monstre à vitesse nulle est écarté');
    egal(sim.lignes[0].id, '120-allie', 'seul le monstre qui remplit sa barre reste');
  }

  ok(simuler([]).lignes.length === 0, 'aucun monstre → simulation vide, pas d\'erreur');
}

// Import d'un deck de siège dans « Ton équipe » (src/lib/speedTuneDeck.ts) :
// les monstres du deck avec leur vitesse de runes, et le lead du leader quand
// il vaut pour TOUT le camp.
export function testSpeedTuneDeck() {
  titre('Speed tuning — import d\'un deck de siège');

  const monstre = (id: string, name: string, lead?: { amount: number; area: string; element: string | null }) =>
    ({ id, name, stats: { speed: 100 }, leaderSkill: lead ? { stat: 'Attack Speed', ...lead } : undefined }) as unknown as Monster;

  const equipe = (
    slots: { monsterId: string | null; runeSpeed: number | null; arte?: number[] }[]
  ): SiegeTeam =>
    ({
      id: 't',
      lead: 0,
      tickAlertDismissed: false,
      slots: slots.map(({ arte, ...s }) => ({
        ...s,
        tick: 0,
        sets: [],
        // Un artéfact par valeur : la propriété « Effet aug. VIT » porte le
        // code 206 (voir ARTIFACT_SUB dans lib/effects.ts).
        gear: arte
          ? {
              base: {},
              runes: [],
              artifacts: arte.map((v) => ({ subs: [{ code: 206, value: v }] })),
            }
          : undefined,
      })),
    }) as unknown as SiegeTeam;

  const trevor = monstre('1', 'Trevor', { amount: 24, area: 'Guild', element: null });
  const bella = monstre('2', 'Bella');
  const loren = monstre('3', 'Loren');
  const fran = monstre('4', 'Fran', { amount: 33, area: 'Element', element: 'water' });
  const arene = monstre('5', 'Tyron', { amount: 19, area: 'Arena', element: null });
  const parId = new Map([trevor, bella, loren, fran, arene].map((m) => [String(m.id), m]));

  {
    const d = deckPourSpeedTune(
      equipe([
        { monsterId: '1', runeSpeed: 155 },
        { monsterId: '2', runeSpeed: 92 },
        { monsterId: '3', runeSpeed: null },
      ]),
      parId
    );
    egal(d.monstres.length, 3, 'les trois slots remplis sont repris');
    egal(d.monstres[0].monster.name, 'Trevor', 'le leader (slot 0) reste en tête');
    egal(d.monstres[0].runeSpeed, 155, 'la vitesse de runes du slot est reprise');
    egal(d.monstres[2].runeSpeed, null, 'un slot sans vitesse de runes reste vide');
    egal(d.lead, 24, 'un lead de guilde vaut pour tout le camp → appliqué');
  }

  // Slots vides et monstres absents des données : écartés, sans casser le deck.
  {
    const d = deckPourSpeedTune(
      equipe([
        { monsterId: null, runeSpeed: null },
        { monsterId: '404', runeSpeed: 100 },
        { monsterId: '3', runeSpeed: 88 },
      ]),
      parId
    );
    egal(d.monstres.length, 1, 'slot vide et monstre inconnu écartés');
    egal(d.monstres[0].monster.name, 'Loren', 'le slot rempli est bien celui qui reste');
    egal(d.lead, null, 'pas de leader → pas de lead imposé');
  }

  // Artéfact « Effet aug. VIT » : lu sur le gear du slot, pas à ressaisir.
  {
    const d = deckPourSpeedTune(
      equipe([
        { monsterId: '1', runeSpeed: 155, arte: [12] },
        { monsterId: '2', runeSpeed: 92, arte: [8, 5] },
        { monsterId: '3', runeSpeed: 88 },
      ]),
      parId
    );
    egal(d.monstres[0].artefactBuff, 12, "l'artéfact « Effet aug. VIT » est repris");
    egal(d.monstres[1].artefactBuff, 13, 'deux artéfacts porteurs → leurs effets s’additionnent');
    egal(d.monstres[2].artefactBuff, null, 'aucun artéfact porteur → rien à reprendre');
  }

  // ⚠️ Un lead d'ÉLÉMENT ne se transpose pas au modèle « un lead par camp ».
  {
    egal(
      deckPourSpeedTune(equipe([{ monsterId: '4', runeSpeed: 100 }]), parId).lead,
      null,
      'lead d\'élément → le camp garde son lead saisi'
    );
    egal(
      deckPourSpeedTune(equipe([{ monsterId: '5', runeSpeed: 100 }]), parId).lead,
      null,
      'lead d\'arène → inactif en siège, pas appliqué'
    );
    egal(
      deckPourSpeedTune(equipe([{ monsterId: '2', runeSpeed: 100 }]), parId).lead,
      null,
      'leader sans lead de vitesse → rien à appliquer'
    );
  }
}

/* ------------------------------- Chaîne d'ouverture (combo non coupé) ---- */

// PRNG déterministe (mulberry32) — mêmes scénarios d'une exécution à l'autre.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// RÉFÉRENCE DE CONTRÔLE (algo-verify) : même raisonnement que
// `vitessesRequises`, mais la vitesse minimale se cherche par BALAYAGE LINÉAIRE
// exhaustif au lieu d'une dichotomie. Volontairement naïve et lente — elle
// définit « la bonne réponse » pour le test différentiel.
type Axe = 'combat' | 'artefactBuff';

// RÉFÉRENCE DE CONTRÔLE (algo-verify) : même raisonnement que le solveur, mais
// la valeur minimale se cherche par BALAYAGE LINÉAIRE exhaustif au lieu d'une
// dichotomie. Volontairement naïve et lente — elle définit « la bonne réponse »
// pour le test différentiel, sur les DEUX axes.
function resoudreNaif(monstres: TuneMonstre[], axe: Axe, horizon = HORIZON_TICKS) {
  const plafond = axe === 'combat' ? COMBAT_MAX : ARTE_MAX;
  const valeur = (m: TuneMonstre) => (axe === 'combat' ? m.combat : (m.artefactBuff ?? 0));
  const poser = (m: TuneMonstre, v: number) => {
    if (axe === 'combat') m.combat = v;
    else m.artefactBuff = v;
  };
  const courant = monstres.map((m) => ({ ...m }));
  const parId = new Map(courant.map((m) => [m.id, m]));
  const passeAvant = (id: string): boolean => {
    const premiers = premiersTours(simuler(courant, horizon));
    const adverse = premiers.find((a) => a.camp === 'ennemi');
    const mien = premiers.find((a) => a.id === id);
    if (!mien) return false;
    return !adverse || mien.tick < adverse.tick;
  };
  for (let passe = 0; passe < PASSES_MAX; passe++) {
    const diag = diagnostiquerChaine(courant, horizon);
    if (diag.ok || !diag.coupeur) break;
    const aTraiter = diag.coupes
      .map((c) => parId.get(c.id))
      .filter((m): m is (typeof courant)[number] => !!m)
      .sort((a, b) => b.combat - a.combat);
    let progres = false;
    for (const m of aTraiter) {
      if (passeAvant(m.id)) continue;
      const depart = valeur(m);
      let trouve: number | null = null;
      for (let v = depart + 1; v <= plafond; v++) {
        poser(m, v);
        if (passeAvant(m.id)) {
          trouve = v;
          break;
        }
      }
      poser(m, trouve ?? depart);
      if (trouve != null) progres = true;
    }
    if (!progres) break;
  }
  const fin = diagnostiquerChaine(courant, horizon);
  const coupesFin = new Set(fin.coupes.map((c) => c.id));
  const out: { id: string; actuel: number; requis: number | null }[] = [];
  for (const m of monstres) {
    if (m.camp !== 'allie') continue;
    const depart = valeur(m);
    if (coupesFin.has(m.id)) out.push({ id: m.id, actuel: depart, requis: null });
    else {
      const trouve = valeur(parId.get(m.id) ?? m);
      if (trouve > depart) out.push({ id: m.id, actuel: depart, requis: trouve });
    }
  }
  return out;
}

function vitessesRequisesNaif(monstres: TuneMonstre[], horizon = HORIZON_TICKS): VitesseRequise[] {
  return resoudreNaif(monstres, 'combat', horizon).map((r) => ({
    id: r.id,
    combatActuel: r.actuel,
    combatRequis: r.requis,
  }));
}

function artefactsRequisNaif(monstres: TuneMonstre[], horizon = HORIZON_TICKS): ArtefactRequis[] {
  return resoudreNaif(monstres, 'artefactBuff', horizon).map((r) => ({
    id: r.id,
    artefactActuel: r.actuel,
    artefactRequis: r.requis,
  }));
}

export function testSpeedTuneChaine() {
  titre("Speed tuning — chaîne d'ouverture");

  const m = (id: string, combat: number, camp: 'allie' | 'ennemi'): TuneMonstre => ({ id, combat, camp });

  // Aucun adverse : rien ne peut couper le combo.
  {
    const d = diagnostiquerChaine([m('a', 200, 'allie'), m('b', 150, 'allie')]);
    ok(d.ok, 'sans adverse, la chaîne tient');
    egal(d.coupeur, null, 'aucun coupeur désigné');
    egal(vitessesRequises([m('a', 200, 'allie')]).length, 0, 'rien à corriger sans adverse');
  }

  // Eshir (base 115 rapide) s'intercale entre deux alliés → combo coupé.
  {
    const monstres = [m('rapide', 300, 'allie'), m('eshir', 250, 'ennemi'), m('lent', 180, 'allie')];
    const d = diagnostiquerChaine(monstres);
    ok(!d.ok, "un adverse plus rapide qu'un allié coupe la chaîne");
    egal(d.coupeur?.id, 'eshir', 'le coupeur est le premier adverse à agir');
    egal(d.coupes.length, 1, 'un seul allié coupé');
    egal(d.coupes[0].id, 'lent', "c'est le plus lent qui passe après");

    const req = vitessesRequises(monstres);
    egal(req.length, 1, 'une vitesse à trouver');
    egal(req[0].id, 'lent', "la correction porte sur l'allié coupé");
    ok(req[0].combatRequis != null && req[0].combatRequis > 180, 'il lui faut plus que sa vitesse actuelle');

    // La vitesse proposée répare VRAIMENT la chaîne, et un point de moins ne suffit pas.
    const avec = (v: number) => monstres.map((x) => (x.id === 'lent' ? { ...x, combat: v } : x));
    ok(diagnostiquerChaine(avec(req[0].combatRequis!)).ok, 'à la vitesse proposée, la chaîne tient');
    ok(!diagnostiquerChaine(avec(req[0].combatRequis! - 1)).ok, "un point de moins et elle est coupée : c'est bien le minimum");
  }

  // Un boost de barre d'attaque suffit parfois : la vitesse requise en tient compte.
  {
    const base = [m('rapide', 300, 'allie'), m('eshir', 250, 'ennemi'), m('lent', 180, 'allie')];
    const sansBoost = vitessesRequises(base)[0].combatRequis!;
    const boost = base.map((x) => (x.id === 'lent' ? { ...x, atbMod: { 1: 20 } } : x));
    const avecBoost = vitessesRequises(boost)[0].combatRequis!;
    ok(avecBoost < sansBoost, "un boost d'ATB au tick 1 abaisse la vitesse à trouver");
    // Assez de boost et il n'y a plus rien à corriger du tout.
    const gros = base.map((x) => (x.id === 'lent' ? { ...x, atbMod: { 1: 30 } } : x));
    ok(diagnostiquerChaine(gros).ok, 'un boost suffisant répare la chaîne sans toucher aux vitesses');
  }

  // Un seul monstre agit par tick : cinq alliés ne peuvent pas tous passer
  // avant un adverse qui agit au tick 3, même à vitesse maximale.
  {
    const monstres: TuneMonstre[] = [
      m('e', COMBAT_MAX, 'ennemi'),
      ...['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => m(id, 100, 'allie')),
    ];
    const req = vitessesRequises(monstres);
    ok(
      req.some((r) => r.combatRequis === null),
      "trop d'alliés à caser avant l'adverse → au moins un cas déclaré insoluble"
    );
  }

  // Compétences déclenchées par le TOUR : un allié qui remplit la barre de son
  // camp accélère les siens à partir du tick où il joue.
  {
    const sans = premiersTours(simuler([m('boosteur', 300, 'allie'), m('lent', 150, 'allie')]));
    const avec = premiersTours(
      simuler([{ ...m('boosteur', 300, 'allie'), skillAtb: 40 }, m('lent', 150, 'allie')])
    );
    const tickDe = (pt: ReturnType<typeof premiersTours>, id: string) => pt.find((a) => a.id === id)!.tick;
    egal(tickDe(avec, 'boosteur'), tickDe(sans, 'boosteur'), 'le lanceur joue au même tick');
    ok(tickDe(avec, 'lent') < tickDe(sans, 'lent'), 'son allié joue plus tôt grâce au boost de barre');
  }

  // Le boost ne franchit pas les CAMPS : un adverse qui remplit la barre des
  // siens ne remplit pas la nôtre.
  //
  // ⚠️ Ce qu'on vérifie ici est bien la BARRE, pas le tick d'action : la règle
  // « un seul monstre par tick » fait qu'un adverse qui joue plus souvent occupe
  // d'autres ticks, ce qui peut décaler notre tour dans un sens comme dans
  // l'autre — sans que sa compétence ne nous ait jamais touchés.
  {
    const barre = (skill?: number) =>
      simuler([{ ...m('eshir', 300, 'ennemi'), skillAtb: skill }, m('nous', 150, 'allie')]).lignes.find(
        (l) => l.id === 'nous'
      )!.trajectoire;
    const sans = barre();
    const avec = barre(40);
    egal(
      avec.slice(0, 6).map((v) => v.toFixed(2)).join(' '),
      sans.slice(0, 6).map((v) => v.toFixed(2)).join(' '),
      "le boost d'un adverse ne remplit pas la barre de notre camp"
    );
  }

  // Buff de vitesse de compétence : à partir du tick SUIVANT le tour du lanceur.
  {
    const sans = simuler([m('buffeur', 300, 'allie'), m('lent', 150, 'allie')]);
    const avec = simuler([{ ...m('buffeur', 300, 'allie'), skillSpeed: 30 }, m('lent', 150, 'allie')]);
    const traj = (sim: Simulation, id: string) => sim.lignes.find((l) => l.id === id)!.trajectoire;
    const tourBuffeur = premiersTours(sans).find((a) => a.id === 'buffeur')!.tick;
    egal(
      traj(avec, 'lent')[tourBuffeur - 1].toFixed(2),
      traj(sans, 'lent')[tourBuffeur - 1].toFixed(2),
      'au tick du lanceur, rien ne change encore (le gain est déjà acquis)'
    );
    ok(
      traj(avec, 'lent')[tourBuffeur] > traj(sans, 'lent')[tourBuffeur],
      'dès le tick suivant, son allié monte plus vite'
    );
  }

  // Un adverse qui remplit la barre des siens est pris en compte par le
  // solveur : la vitesse à trouver n'est pas la même sans lui.
  {
    const base = [m('a1', 260, 'allie'), m('a2', 170, 'allie'), m('eshir', 250, 'ennemi')];
    const avecSkill = base.map((x) => (x.id === 'a1' ? { ...x, skillAtb: 35 } : x));
    const sans = vitessesRequises(base);
    const avec = vitessesRequises(avecSkill);
    ok(sans.length > 0, 'sans compétence, un allié est coupé');
    ok(
      avec.length === 0 || (avec[0].combatRequis ?? 0) < (sans[0].combatRequis ?? 0),
      "la compétence d'un allié abaisse (ou supprime) la vitesse à trouver"
    );
  }

  // L'AUTRE levier : l'artéfact « Effet aug. VIT », qui amplifie le buff de
  // vitesse reçu. Sans buff, il n'y a rien à en attendre.
  {
    const sansBuff = [m('a1', 260, 'allie'), m('a2', 170, 'allie'), m('eshir', 250, 'ennemi')];
    egal(
      artefactsRequis(sansBuff).every((r) => r.artefactRequis === null),
      true,
      "sans buff de vitesse, l'artéfact ne peut rien : aucune valeur proposée"
    );

    // Un allié rapide qui pose un buff de vitesse sur son camp, un allié lent
    // coupé de peu : l'artéfact qui amplifie ce buff peut suffire à le sauver.
    const avecBuff = [
      { ...m('a1', 250, 'allie'), skillSpeed: 30 },
      m('a2', 105, 'allie'),
      m('eshir', 130, 'ennemi'),
    ];
    const arte = artefactsRequis(avecBuff).find((r) => r.artefactRequis != null);
    ok(!!arte, 'avec un buff de vitesse, un artéfact suffisant est proposé');
    if (arte) {
      const avec = (v: number) =>
        avecBuff.map((x) => (x.id === arte.id ? { ...x, artefactBuff: v } : x));
      ok(diagnostiquerChaine(avec(arte.artefactRequis!)).ok, "à l'artéfact proposé, la chaîne tient");
      ok(
        !diagnostiquerChaine(avec(arte.artefactRequis! - 1)).ok,
        "un point d'artéfact de moins et elle est coupée : c'est bien le minimum"
      );
    }
  }

  // ⚠️ TOUR SUPPLÉMENTAIRE (Kroa : Owl's Hoot buffe toute l'équipe et lui rend
  // son tour). Il tombe AU MÊME TICK : aucune horloge ne tourne entre les deux.
  {
    const kroa = { ...m('kroa', 300, 'allie'), rejoue: true, skillSpeed: 30 };
    const sim = simuler([kroa, m('autre', 150, 'allie')]);
    const aTick = sim.actions.filter((a) => a.id === 'kroa' && a.tick === sim.actions[0].tick);
    egal(aTick.length, 2, 'elle joue deux fois au même tick');
    egal(aTick[1].rejoue, true, 'le second tour est marqué comme rendu par la compétence');
    egal(
      premiersTours(sim).filter((a) => a.id === 'kroa').length,
      1,
      "le tour supplémentaire n'ajoute pas un PREMIER tour de plus"
    );
    // Les autres ne gagnent rien pendant ce tour : aucune horloge n'a tourné.
    const sans = simuler([{ ...kroa, rejoue: false }, m('autre', 150, 'allie')]);
    const traj = (x: Simulation) => x.lignes.find((l) => l.id === 'autre')!.trajectoire.slice(0, 8).join();
    egal(traj(sim), traj(sans), 'la barre des autres est identique, avec ou sans son tour rendu');
  }

  // Le SECOND tour lance une autre compétence, quand on la lui a désignée.
  {
    const base = [{ ...m('kroa', 300, 'allie'), rejoue: true }, m('lent', 150, 'allie')];
    const avecSecond = [{ ...base[0], skillAtb2: 40 }, base[1]];
    const tickDe = (ms: TuneMonstre[]) => premiersTours(simuler(ms)).find((a) => a.id === 'lent')!.tick;
    ok(tickDe(avecSecond) < tickDe(base), 'le boost de son second tour profite bien à son camp');
  }

  // TEST DIFFÉRENTIEL (algo-verify) : la dichotomie retrouve EXACTEMENT ce que
  // trouve le balayage linéaire exhaustif, sur des scénarios aléatoires à seed
  // fixe (alliés/adverses, vitesses, boosts d'ATB et buffs de vitesse).
  {
    let identiques = 0;
    const scenarios = 24;
    for (let s = 0; s < scenarios; s++) {
      const rng = mulberry32(7000 + s * 97);
      const nbAllies = 1 + Math.floor(rng() * 3);
      const nbEnnemis = 1 + Math.floor(rng() * 2);
      const monstres: TuneMonstre[] = [];
      const tirer = (camp: 'allie' | 'ennemi', i: number): TuneMonstre => {
        const combat = 80 + Math.floor(rng() * 320);
        const mm: TuneMonstre = { id: `${camp}${i}`, combat, camp };
        if (rng() < 0.3) mm.atbMod = { [1 + Math.floor(rng() * 4)]: Math.floor(rng() * 60) };
        if (rng() < 0.3) mm.speedMod = { [1 + Math.floor(rng() * 4)]: 30 };
        // Compétences déclenchées par le tour (boost de barre / buff de vitesse
        // sur tout le camp) : c'est exactement ce que le solveur doit suivre.
        if (rng() < 0.35) mm.skillAtb = 10 + Math.floor(rng() * 40);
        if (rng() < 0.25) mm.skillSpeed = 30;
        return mm;
      };
      for (let i = 0; i < nbAllies; i++) monstres.push(tirer('allie', i));
      for (let i = 0; i < nbEnnemis; i++) monstres.push(tirer('ennemi', i));
      const a = JSON.stringify([vitessesRequises(monstres), artefactsRequis(monstres)]);
      const b = JSON.stringify([vitessesRequisesNaif(monstres), artefactsRequisNaif(monstres)]);
      if (a === b) identiques++;
      else ok(false, `scénario ${s} : dichotomie ${a} ≠ balayage exhaustif ${b}`);
    }
    ok(
      identiques === scenarios,
      `dichotomie identique au balayage linéaire exhaustif — vitesse ET artéfact — sur ${scenarios} scénarios aléatoires avec compétences (seed fixe)`
    );
  }
}

/* --------------------------------------- Kit : détection automatique ----- */

// Ce que l'outil lit tout seul dans le kit d'un monstre (public/data/skills) :
// remplissage de barre de ZONE et buff de vitesse de ZONE. L'utilisateur n'a pas
// à aller chercher lui-même — d'où l'importance de ne retenir QUE ce qui touche
// tout le camp.
export function testSpeedTuneKit() {
  titre('Speed tuning — lecture du kit');

  const effet = (nom: string, quantite: number, aoe: boolean, surSoi = false): EffetCompetence =>
    ({
      nom,
      type: 'Neutral',
      bonus: true,
      description: null,
      icone: null,
      chance: 0,
      quantite,
      surSoi,
      aoe,
      surCritique: false,
      surMort: false,
      note: null,
    }) as EffetCompetence;

  const comp = (
    nom: string,
    effets: EffetCompetence[],
    passif = false,
    ameliorations: string[] = []
  ): Competence =>
    ({
      id: 1,
      com2usId: null,
      nom,
      description: null,
      slot: 2,
      passif,
      aoe: true,
      cooldown: null,
      coups: 1,
      niveauMax: 5,
      formule: null,
      scale: [],
      ameliorations,
      icone: null,
      effets,
    }) as Competence;

  const detail = (competences: Competence[]): DetailMonstre =>
    ({
      com2usId: 1,
      archetype: null,
      skillUpsToMax: null,
      awakensFrom: null,
      awakensTo: null,
      source: [],
      competences,
    }) as DetailMonstre;

  egal(kitVitesse(null).atb, 0, 'aucune fiche → rien de détecté');

  // Barre d'attaque de zone : détectée, avec la compétence d'où elle vient.
  {
    const k = kitVitesse(detail([comp('Vent du changement', [effet('Increase ATB', 30, true)])]));
    egal(k.atb, 30, 'remplissage de barre de zone détecté');
    egal(k.atbCompetence, 'Vent du changement', 'la compétence source est nommée');
  }

  // ⚠️ Ce qui ne touche PAS tout le camp est écarté : le modèle applique l'effet
  // à toute l'équipe, un « remplit TA barre » la gonflerait en entier.
  {
    egal(
      kitVitesse(detail([comp('Lames', [effet('Increase ATB', 50, false, true)])])).atb,
      0,
      'un remplissage sur SOI est écarté'
    );
    egal(
      kitVitesse(detail([comp('Purifier', [effet('Increase ATB', 25, false)])])).atb,
      0,
      "un remplissage sur UN allié est écarté"
    );
    egal(
      kitVitesse(detail([comp('Hostilité', [effet('Increase ATB', 30, true)], true)])).atb,
      0,
      'une compétence PASSIVE est écartée (elle ne part pas au tour du monstre)'
    );
  }

  // Plusieurs compétences qui remplissent la barre : la plus forte l'emporte.
  {
    const k = kitVitesse(
      detail([
        comp('Petite', [effet('Increase ATB', 15, true)]),
        comp('Grosse', [effet('Increase ATB', 40, true)]),
      ])
    );
    egal(k.atb, 40, 'la plus forte des deux est retenue');
    egal(k.atbCompetence, 'Grosse', "et c'est bien elle qui est nommée");
  }

  // ⚠️ SKILL-UPS : la valeur de SWARFARM est celle du NIVEAU 1. Le Tailwind de
  // Bernard 2A remplit 30 % au niveau 1 et 45 % maxé (+5 puis +10) — c'est maxé
  // qu'on le joue, et l'écran doit dire que le chiffre le suppose.
  {
    const k = kitVitesse(
      detail([
        comp('Tailwind', [effet('Increase ATB', 30, true)], false, [
          'Attack Bar Recovery +5%',
          'Attack Bar Recovery +10%',
        ]),
      ])
    );
    egal(k.atb, 45, 'Tailwind maxé remplit 45 % de barre, pas 30');
    egal(k.atbNiveau1, 30, 'la valeur du niveau 1 reste lisible');
    egal(k.atbSkillUp, 15, "ce que les skill-ups ajoutent est isolé (pour l'annoncer à l'écran)");
  }

  // Une amélioration qui ne touche pas la barre ne change rien.
  {
    const k = kitVitesse(
      detail([comp('Vent', [effet('Increase ATB', 30, true)], false, ['Cooltime Turn -1', 'Damage +10%'])])
    );
    egal(k.atb, 30, 'les autres skill-ups (rechargement, dégâts) ne gonflent pas la barre');
    egal(k.atbSkillUp, 0, 'et rien à annoncer sur le skill-up');
  }

  // La LISTE des sorts (analyse poussée) : le même filtre, mais sans garder
  // seulement le plus fort — c'est à l'utilisateur de choisir ce qu'il lance.
  {
    const d = detail([
      comp('Petite', [effet('Increase ATB', 15, true)]),
      comp('Grosse', [effet('Increase ATB', 30, true)], false, ['Attack Bar Recovery +5%']),
      comp('Frappe', [effet('Increase ATB', 50, false, true)]),
      comp('Passive', [effet('Increase ATB', 40, true)], true),
      comp('Cri', [effet('Increase ATK SPD', 2, true)]),
    ]);
    const sorts = sortsVitesse(d);
    egal(sorts.map((x) => x.nom).join(', '), 'Petite, Grosse, Cri', 'seuls les sorts de zone non passifs sont proposés');
    egal(sorts[1].atb, 35, 'la valeur proposée est celle de la compétence maxée');
    egal(sorts[2].buff, BUFF_SPD_JEU, 'le buff de vitesse figure dans la liste');
    egal(sortsVitesse(null).length, 0, 'aucune fiche → aucun sort à proposer');
  }

  // Buff de vitesse : les données ne donnent que sa DURÉE, la valeur du jeu vaut.
  {
    const k = kitVitesse(detail([comp('Cri du prédateur', [effet('Increase ATK SPD', 2, true)])]));
    egal(k.buff, BUFF_SPD_JEU, 'buff de vitesse de zone → +30 % (valeur du jeu)');
    egal(k.buffCompetence, 'Cri du prédateur', 'la compétence source est nommée');
  }
}

/* ------------------------------------------ Séquence imposée (analyse+) --- */

// Un combo construit demande un ORDRE précis, pas seulement « tout le monde
// avant l'adverse ». Conséquence : un monstre peut devoir être RALENTI pour
// laisser passer celui qui doit jouer avant lui — d'où des FENÊTRES de vitesse.
export function testSpeedTuneSequence() {
  titre('Speed tuning — ordre imposé');

  const m = (id: string, combat: number, camp: 'allie' | 'ennemi'): TuneMonstre => ({ id, combat, camp });

  // L'ordre voulu est celui que donnent les vitesses : rien à signaler.
  {
    const monstres = [m('a', 300, 'allie'), m('b', 200, 'allie'), m('c', 150, 'allie')];
    const d = diagnostiquerSequence(monstres, ['a', 'b', 'c']);
    ok(d.ok, "l'ordre demandé est celui qui sort de la simulation");
    egal(d.problemes.length, 0, 'aucun problème à signaler');
  }

  // Ordre inversé demandé : les deux fautifs sont nommés, avec le sens de l'erreur.
  {
    const monstres = [m('a', 300, 'allie'), m('b', 200, 'allie')];
    const d = diagnostiquerSequence(monstres, ['b', 'a']);
    ok(!d.ok, 'un ordre que les vitesses ne produisent pas est signalé');
    egal(d.problemes.find((p) => p.id === 'a')?.raison, 'trop-tot', 'le rapide joue trop tôt');
    egal(d.problemes.find((p) => p.id === 'b')?.raison, 'trop-tard', 'le lent joue trop tard');
  }

  // Passer après l'adverse prime sur l'ordre interne : l'ordre ne sert plus.
  {
    const monstres = [m('a', 300, 'allie'), m('lent', 120, 'allie'), m('e', 250, 'ennemi')];
    const d = diagnostiquerSequence(monstres, ['a', 'lent']);
    egal(d.problemes.find((p) => p.id === 'lent')?.raison, 'apres-adverse', "coupé par l'adverse d'abord");
  }

  // ⚠️ Le cas qui n'existait pas dans l'analyse simple : pour tenir le SECOND
  // rang, il faut être assez rapide ET assez lent. La fenêtre le dit.
  {
    const monstres = [m('a', 300, 'allie'), m('b', 200, 'allie'), m('c', 150, 'allie')];
    const f = fenetresRequises(monstres, ['a', 'b', 'c']).find((x) => x.id === 'b')!;
    ok(f.ok, 'à 200, il tient déjà son rang');
    ok(f.min != null && f.max != null, 'sa fenêtre a bien deux bornes');
    ok(f.min! <= 200 && 200 <= f.max!, 'sa vitesse actuelle est dans la fenêtre');
    // Les bornes sont les bonnes : un cran de plus ou de moins casse l'ordre.
    const avec = (v: number) => monstres.map((x) => (x.id === 'b' ? { ...x, combat: v } : x));
    ok(!diagnostiquerSequence(avec(f.max! + 1), ['a', 'b', 'c']).ok, 'un point de plus et il passe devant a');
    ok(!diagnostiquerSequence(avec(f.min! - 1), ['a', 'b', 'c']).ok, 'un point de moins et c le double');
  }

  // TEST DIFFÉRENTIEL (algo-verify) : les deux bornes trouvées par dichotomie
  // valent celles d'un BALAYAGE EXHAUSTIF, et l'ensemble des vitesses valides
  // est bien un INTERVALLE — c'est l'hypothèse qui autorise la dichotomie.
  {
    let identiques = 0;
    let intervalles = 0;
    const scenarios = 12;
    for (let s = 0; s < scenarios; s++) {
      const rng = mulberry32(4200 + s * 61);
      const monstres: TuneMonstre[] = [];
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const mm: TuneMonstre = { id: `a${i}`, combat: 90 + Math.floor(rng() * 260), camp: 'allie' };
        if (rng() < 0.3) mm.skillAtb = 10 + Math.floor(rng() * 30);
        monstres.push(mm);
      }
      if (rng() < 0.7) monstres.push({ id: 'e', combat: 100 + Math.floor(rng() * 250), camp: 'ennemi' });
      // Ordre voulu : un mélange déterministe des alliés.
      const ordre = monstres.filter((x) => x.camp === 'allie').map((x) => x.id);
      for (let i = ordre.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
      }

      for (const f of fenetresRequises(monstres, ordre)) {
        // Balayage exhaustif : toutes les vitesses où CE monstre tient son rang,
        // les autres inchangés. Pas plus fin que la dichotomie, juste bête.
        const valides: number[] = [];
        for (let v = 1; v <= COMBAT_MAX; v++) {
          const essai = monstres.map((x) => (x.id === f.id ? { ...x, combat: v } : x));
          const d = diagnostiquerSequence(essai, ordre);
          if (!d.problemes.some((p) => p.id === f.id)) valides.push(v);
        }
        const contigu = valides.every((v, i) => i === 0 || v === valides[i - 1] + 1);
        if (contigu) intervalles++;
        else ok(false, `scénario ${s} / ${f.id} : les vitesses valides ne forment pas un intervalle`);
        if (valides.length === 0) {
          // Aucune vitesse ne convient : la fenêtre doit être VIDE (bornes
          // croisées ou absentes), jamais un intervalle qu'on proposerait à tort.
          const vide = f.min == null || f.max == null || f.min > f.max;
          if (vide) identiques++;
          else ok(false, `scénario ${s} / ${f.id} : fenêtre proposée alors qu'aucune vitesse ne convient`);
          continue;
        }
        const attendu = [valides[0], valides[valides.length - 1]];
        if (f.min === attendu[0] && f.max === attendu[1]) identiques++;
        else
          ok(
            false,
            `scénario ${s} / ${f.id} : fenêtre ${JSON.stringify([f.min, f.max])} ≠ balayage ${JSON.stringify(attendu)}`
          );
      }
    }
    ok(intervalles > 0 && identiques > 0, `${intervalles} fenêtres contrôlées au balayage exhaustif (seed fixe)`);
  }
}
