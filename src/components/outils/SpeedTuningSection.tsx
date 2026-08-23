import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Plus, Timer, Users, Swords, X, Zap, Gauge, Eye, EyeOff, Download } from 'lucide-react';
import { Monster, SiegeTeam } from '../../types';
import { combatSpeed, SPEED_LEADS, SIEGE_TICKS } from '../../lib/speed';
import {
  simuler,
  premiersTours,
  speedForTick,
  HORIZON_TICKS,
  Camp,
  TuneMonstre,
  ModParTick,
} from '../../lib/speedTune';
import { deckPourSpeedTune } from '../../lib/speedTuneDeck';
import { teamSummary } from '../../lib/recoFromSiege';
import { formesJouables } from '../../lib/monsterForms';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useStickyState } from '../../hooks/useStickyState';
import MonsterAvatar from '../MonsterAvatar';
import { Bouton, Champ, Flottant, NumberField, Selecteur, BoutonIcone, Jeton, ZoneCliquable } from '../../ui';

// Icône de vitesse du jeu, celle des cartes RTA/Siège. Sert de repère au buff
// de vitesse dans la grille dédiée.
const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`;
// Valeur du buff de vitesse du jeu (+30 %), posée d'un clic.
const BUFF_SPD = 30;

// Outils › Speed tuning — voir spec/outils/speed-tuning.md.
//
// À chaque tick, la barre d'action monte de `vitesse × 7 %` ; un seul monstre
// agit par tick (règle du jeu). L'écran répond à « est-ce que je joue AVANT tel
// monstre ? » — d'où les deux camps (ton équipe / en face) et l'ordre de tour
// qui les entrelace. Deux grilles éditables (même rendu que la barre d'action)
// posent, par monstre/par tick ou pour toute une équipe, un BOOST de barre
// d'attaque (ponctuel) et un BUFF de vitesse (soutenu). Tout le calcul vit dans
// lib/speedTune.ts (pur, testé) ; ce composant assemble saisie et affichage.

interface Props {
  allMonsters: Monster[];
  // Équipes de siège du compte : elles s'importent dans « Ton équipe » (voir
  // DECKS plus bas). Vides tant qu'aucun compte n'est chargé — le reste de
  // l'outil marche sans.
  siegeDefenseTeams: SiegeTeam[];
  siegeOffenseTeams: SiegeTeam[];
}

// Un deck proposé à l'import : une équipe de siège et le camp d'où elle vient.
interface DeckDispo {
  cle: string;
  source: 'defense' | 'offense';
  team: SiegeTeam;
  libelle: string;
  monstres: Monster[];
}

// Une ligne : un monstre ajouté, sa vitesse de runes, son camp, et ses deux
// grilles de modificateurs indexées par tick. `uid = camp:id` → un même monstre
// peut figurer des DEUX côtés, pas deux fois dans le même camp.
interface Ligne {
  uid: string;
  monster: Monster;
  runeSpeed: number | null;
  camp: Camp;
  atbMod: ModParTick;
  speedMod: ModParTick;
  // Bonus d'artéfact « augmente l'effet du buff de vitesse » (%). Renseigné pour
  // les alliés seulement (on ne connaît pas les artéfacts d'en face).
  artefactBuff: number | null;
  // Masqué : gardé dans la liste (avec sa config) mais retiré des calculs et des
  // tableaux — pour tester une composition sans perdre le réglage d'un monstre.
  masque: boolean;
}

type ChampMod = 'atbMod' | 'speedMod';

const uidDe = (camp: Camp, id: string) => `${camp}:${id}`;

// Repère des ticks en tête : vitesse de combat minimale pour agir à chaque tick.
// Plage utile en jeu (11→3), les deux ticks siège (239/286) marqués en couleur.
const RULER_TICKS = [11, 10, 9, 8, 7, 6, 5, 4, 3];
const TICKS_SIEGE = new Set(SIEGE_TICKS.map((t) => t.value));

// ⚠️ **Les trois tableaux (barres, boost, buff) partagent EXACTEMENT la même
// grille de colonnes** — même largeur de colonne « cible », même largeur de
// tick, mêmes 40 ticks — et leur défilement horizontal est synchronisé. Sans
// ça, tick 12 du boost ne tombait pas sous tick 12 des barres : on se perdait.
const LARGEUR_CIBLE = 210; // colonne de gauche (portrait + nom)
const LARGEUR_TICK = 86; // chaque colonne de tick
const TICKS = Array.from({ length: HORIZON_TICKS }, (_, i) => i + 1);
const LARGEUR_TABLE = LARGEUR_CIBLE + HORIZON_TICKS * LARGEUR_TICK;

// Colonnes fixes communes, posées à l'identique dans chaque tableau.
function Colonnes() {
  return (
    <colgroup>
      <col style={{ width: LARGEUR_CIBLE }} />
      {TICKS.map((t) => (
        <col key={t} style={{ width: LARGEUR_TICK }} />
      ))}
    </colgroup>
  );
}

// En-tête de ticks commun (numéros 1 → 40).
function TeteTicks({ premiere }: { premiere: string }) {
  return (
    <thead>
      <tr className="border-b border-border text-ink-dimmer">
        <th className="sticky left-0 z-[2] border-r border-border-soft bg-panel px-3 py-2 text-left text-xs font-semibold">
          {premiere}
        </th>
        {TICKS.map((t) => (
          <th key={t} className="px-1 py-2 text-center font-mono text-xs font-semibold">
            {t}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export default function SpeedTuningSection({ allMonsters, siegeDefenseTeams, siegeOffenseTeams }: Props) {
  const [lignes, setLignes] = useStickyState<Ligne[]>('speedTune.lignes', []);
  const [leadAllie, setLeadAllie] = useStickyState<number>('speedTune.leadAllie', 0);
  const [leadEnnemi, setLeadEnnemi] = useStickyState<number>('speedTune.leadEnnemi', 0);

  const jouables = useMemo(() => formesJouables(allMonsters), [allMonsters]);
  const monsterById = useMemo(
    () => new Map(allMonsters.map((m) => [String(m.id), m])),
    [allMonsters]
  );

  // Decks importables : les équipes de siège du compte qui portent au moins un
  // monstre connu. `cle` porte la source, jamais `team.id` seul — deux équipes
  // de listes différentes peuvent partager un id (voir OptimizerSection.tsx).
  const decks = useMemo<DeckDispo[]>(() => {
    const out: DeckDispo[] = [];
    const ajouter = (source: 'defense' | 'offense', teams: SiegeTeam[]) => {
      teams.forEach((team, i) => {
        const monstres = team.slots
          .map((sl) => (sl.monsterId ? monsterById.get(sl.monsterId) : null))
          .filter((m): m is Monster => !!m);
        if (monstres.length === 0) return;
        out.push({ cle: `${source}:${i}`, source, team, libelle: teamSummary(team, monsterById), monstres });
      });
    };
    ajouter('defense', siegeDefenseTeams);
    ajouter('offense', siegeOffenseTeams);
    return out;
  }, [siegeDefenseTeams, siegeOffenseTeams, monsterById]);

  function ajouter(camp: Camp, id: string) {
    const uid = uidDe(camp, id);
    if (lignes.some((l) => l.uid === uid)) return;
    const monster = allMonsters.find((m) => String(m.id) === id);
    if (!monster) return;
    setLignes((prev) => [
      ...prev,
      { uid, monster, runeSpeed: null, camp, atbMod: {}, speedMod: {}, artefactBuff: null, masque: false },
    ]);
  }
  // Import d'un deck de siège dans « Ton équipe » : les monstres du deck
  // rejoignent le camp allié avec LEUR vitesse de runes — celle du deck fait
  // foi, un monstre déjà présent voit donc la sienne remplacée (et réapparaît
  // s'il était masqué). Rien n'est retiré : ce qui est déjà là reste.
  function importerDeck(team: SiegeTeam) {
    const { monstres, lead } = deckPourSpeedTune(team, monsterById);
    if (monstres.length === 0) return;
    setLignes((prev) => {
      const next = [...prev];
      for (const { monster, runeSpeed } of monstres) {
        const uid = uidDe('allie', String(monster.id));
        const i = next.findIndex((l) => l.uid === uid);
        if (i >= 0) next[i] = { ...next[i], runeSpeed, masque: false };
        else
          next.push({
            uid,
            monster,
            runeSpeed,
            camp: 'allie',
            atbMod: {},
            speedMod: {},
            artefactBuff: null,
            masque: false,
          });
      }
      return next;
    });
    // Le lead du leader du deck, s'il vaut pour tout le camp (voir speedTuneDeck.ts).
    if (lead != null) setLeadAllie(lead);
  }

  function retirer(uid: string) {
    setLignes((prev) => prev.filter((l) => l.uid !== uid));
  }
  function basculerMasque(uid: string) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...l, masque: !l.masque } : l)));
  }
  function setRuneSpeed(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...l, runeSpeed: v } : l)));
  }
  function setArtefact(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...l, artefactBuff: v } : l)));
  }

  // Écrit une valeur de modificateur dans la grille `champ`, pour un tick donné.
  // 0/null efface l'entrée (une case vide = pas de modificateur).
  const majMap = (m: ModParTick, tick: number, v: number | null): ModParTick => {
    const next = { ...m };
    if (v == null || v === 0) delete next[tick];
    else next[tick] = v;
    return next;
  };
  function setMod(champ: ChampMod, uid: string, tick: number, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...l, [champ]: majMap(l[champ], tick, v) } : l)));
  }
  function setModEquipe(champ: ChampMod, camp: Camp, tick: number, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.camp === camp ? { ...l, [champ]: majMap(l[champ], tick, v) } : l)));
  }

  const leadDe = (camp: Camp) => (camp === 'allie' ? leadAllie : leadEnnemi);

  // Vitesse de combat de base (base + runes + totem 15 % + lead) via speed.ts.
  // `null` si la base est inconnue. Les buffs de vitesse sont appliqués PAR TICK
  // dans la simulation, pas ici.
  const combatDe = (l: Ligne): number | null =>
    combatSpeed(l.monster.stats.speed, l.runeSpeed, leadDe(l.camp), false);

  // Monstres visibles (non masqués) : seuls eux entrent dans les calculs et les
  // tableaux. Les masqués restent affichés dans leur camp pour être réaffichés.
  const lignesVisibles = useMemo(() => lignes.filter((l) => !l.masque), [lignes]);

  // Simulation multi-tours (40 ticks) avec les modificateurs.
  const sim = useMemo(() => {
    const tune: TuneMonstre[] = [];
    for (const l of lignesVisibles) {
      const c = combatDe(l);
      if (c != null && c > 0)
        tune.push({
          id: l.uid,
          combat: c,
          camp: l.camp,
          atbMod: l.atbMod,
          speedMod: l.speedMod,
          artefactBuff: l.artefactBuff ?? 0,
        });
    }
    return simuler(tune, HORIZON_TICKS);
  }, [lignes, leadAllie, leadEnnemi]);

  // Premiers tours (ordre de tour) et numéro d'action par (monstre, tick).
  const premiers = useMemo(() => premiersTours(sim), [sim]);
  const numAction = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of sim.actions) m.set(`${a.id}@${a.tick}`, a.ordre);
    return m;
  }, [sim]);

  // Lignes du tableau des barres, triées par ordre de PREMIER tour (celles qui
  // n'agissent jamais en fin de liste), pour lire l'enchaînement de haut en bas.
  const lignesTableau = useMemo(() => {
    const rang = new Map(premiers.map((a, i) => [a.id, i]));
    return [...sim.lignes].sort(
      (a, b) => (rang.get(a.id) ?? Infinity) - (rang.get(b.id) ?? Infinity)
    );
  }, [sim, premiers]);

  const ligneParUid = useMemo(() => new Map(lignes.map((l) => [l.uid, l])), [lignes]);

  // Défilement horizontal SYNCHRONISÉ entre les trois tableaux : bouger l'un
  // aligne les deux autres, pour que la colonne d'un tick reste sous la même.
  const conteneurs = useRef<HTMLDivElement[]>([]);
  const enregistrer = (i: number) => (el: HTMLDivElement | null) => {
    if (el) conteneurs.current[i] = el;
  };
  const synchro = (e: React.UIEvent<HTMLDivElement>) => {
    const x = e.currentTarget.scrollLeft;
    for (const el of conteneurs.current) {
      if (el && el !== e.currentTarget && el.scrollLeft !== x) el.scrollLeft = x;
    }
  };

  // Regroupement par tick NATUREL (vitesse seule, sans modificateur) pour poser
  // le portrait dans la case du repère qui correspond à la vitesse du monstre.
  const parTick = useMemo(() => {
    const map = new Map<number, Ligne[]>();
    for (const l of lignesVisibles) {
      const c = combatDe(l);
      if (c == null || c <= 0) continue;
      const n = Math.ceil(10000 / (7 * c));
      (map.get(n) ?? map.set(n, []).get(n)!).push(l);
    }
    return map;
  }, [lignes, leadAllie, leadEnnemi]);

  const rien = lignes.length === 0;
  const rienVisible = lignesVisibles.length === 0;
  // Grilles et repère ne comptent que les visibles.
  const aAllie = lignesVisibles.some((l) => l.camp === 'allie');
  const aEnnemi = lignesVisibles.some((l) => l.camp === 'ennemi');

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded bg-accent-soft text-accent">
          <Timer size={18} />
        </span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Speed tuning</h1>
          <p className="mt-0.5 text-sm text-ink-dim">
            À chaque tick, la barre d'action monte de <span className="text-ink">vitesse × 7 %</span> ; un seul
            monstre agit par tick. Ajoute tes monstres et ceux d'en face pour voir qui joue avant qui.
          </p>
        </div>
      </header>

      {/* Repère des ticks */}
      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
          Vitesse de combat pour agir au tick
          <span className="ml-2 font-normal normal-case tracking-normal text-ink-dimmer">· repère de speed tune</span>
        </div>
        <div className="flex overflow-x-auto">
          {RULER_TICKS.map((n, i) => {
            const sp = speedForTick(n);
            const siege = TICKS_SIEGE.has(sp);
            const ici = parTick.get(n) ?? [];
            return (
              <div
                key={n}
                className={`flex-1 basis-[74px] px-2 py-2.5 text-center ${i > 0 ? 'border-l border-border-soft' : ''} ${
                  siege ? 'bg-accent-soft' : ''
                }`}
              >
                {/* Ticks siège (239 / 286) : couleur seule, sans libellé. */}
                <div className={`font-mono text-sm font-bold ${siege ? 'text-accent' : 'text-ink'}`}>{n}</div>
                <div className={`font-mono text-micro ${siege ? 'text-accent' : 'text-ink-dim'}`}>{sp}</div>
                {ici.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                    {ici.map((l) => (
                      <MonsterAvatar
                        key={l.uid}
                        monster={l.monster}
                        size={22}
                        element={false}
                        className={l.camp === 'ennemi' ? 'rounded-sm ring-1 ring-bad' : ''}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Camps — flex-wrap : côte à côte quand il y a la place, empilés sinon. */}
      <div className="flex flex-wrap gap-4">
        <CampPanneau
          camp="allie"
          titre="Ton équipe"
          icone={<Users size={15} />}
          lead={leadAllie}
          onLead={setLeadAllie}
          lignes={lignes.filter((l) => l.camp === 'allie')}
          jouables={jouables}
          combatDe={combatDe}
          onAjouter={(id) => ajouter('allie', id)}
          onRetirer={retirer}
          onMasquer={basculerMasque}
          onRuneSpeed={setRuneSpeed}
          onArtefact={setArtefact}
          decks={decks}
          onImporterDeck={importerDeck}
        />
        <CampPanneau
          camp="ennemi"
          titre="En face"
          icone={<Swords size={15} />}
          lead={leadEnnemi}
          onLead={setLeadEnnemi}
          lignes={lignes.filter((l) => l.camp === 'ennemi')}
          jouables={jouables}
          combatDe={combatDe}
          onAjouter={(id) => ajouter('ennemi', id)}
          onRetirer={retirer}
          onMasquer={basculerMasque}
          onRuneSpeed={setRuneSpeed}
        />
      </div>

      {rien ? (
        <div className="rounded-lg border border-dashed border-border/70 py-10 text-center text-sm text-ink-dim">
          Ajoute au moins un monstre pour visualiser le remplissage des barres et l'ordre de tour.
        </div>
      ) : rienVisible ? (
        <div className="rounded-lg border border-dashed border-border/70 py-10 text-center text-sm text-ink-dim">
          Tous les monstres sont masqués — réaffiche-en un (icône œil) pour voir les barres.
        </div>
      ) : (
        <>
          {/* Barre d'action par tick (résultat, lecture seule) */}
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
              Barre d'action par tick
              <span className="ml-2 font-normal normal-case tracking-normal text-ink-dimmer">
                · % rempli sur {HORIZON_TICKS} ticks — la case surlignée = ce monstre prend le tour (la barre repart de 0)
              </span>
            </div>
            <div className="overflow-x-auto" ref={enregistrer(0)} onScroll={synchro}>
              <table
                className="table-fixed border-collapse font-mono text-xs [font-variant-numeric:tabular-nums]"
                style={{ width: LARGEUR_TABLE }}
              >
                <Colonnes />
                <TeteTicks premiere="Monstre" />
                <tbody>
                  {lignesTableau.map((e) => {
                    const l = ligneParUid.get(e.id);
                    if (!l) return null;
                    const adv = e.camp === 'ennemi';
                    return (
                      <tr key={e.id} className="border-b border-border-soft">
                        <th className="sticky left-0 z-[2] border-r border-border-soft bg-panel px-3 py-1.5 text-left font-normal">
                          <span className="flex items-center gap-2">
                            <MonsterAvatar monster={l.monster} size={24} element={false} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate font-sans text-sm">{l.monster.name}</span>
                                {adv && (
                                  <span className="flex-none rounded border border-bad/50 px-1 text-micro font-bold uppercase tracking-wide text-bad">
                                    adv
                                  </span>
                                )}
                              </span>
                              <span className="block text-micro text-ink-dim">{e.incBase.toFixed(2)} %/tick</span>
                            </span>
                          </span>
                        </th>
                        {TICKS.map((t) => {
                          const num = numAction.get(`${e.id}@${t}`);
                          const estAction = num != null;
                          const atb = e.trajectoire[t - 1];
                          const fond = estAction ? (adv ? 'bg-bad/15' : 'bg-accent-soft') : '';
                          const encre = estAction
                            ? 'font-bold text-ink'
                            : atb != null && atb >= 100
                              ? 'text-ink' // barre pleine en attente de son tour
                              : 'text-ink-dim';
                          return (
                            <td key={t} className={`relative py-1.5 text-center ${fond} ${encre}`}>
                              {atb == null ? '' : atb.toFixed(2)}
                              {estAction && (
                                <span
                                  className={`absolute -right-0.5 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-micro font-bold text-bg ${
                                    adv ? 'bg-bad' : 'bg-accent'
                                  }`}
                                >
                                  {num}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border-soft px-4 py-2.5 text-xs text-ink-dim">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-accent-soft" /> Ton équipe agit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-bad/25" /> Adversaire agit
              </span>
              <span>Un seul monstre par tick ; le numéro donne l'ordre des tours.</span>
            </div>
          </section>

          {/* Grille éditable : boost de barre d'attaque (ponctuel) */}
          <GrilleMod
            champ="atbMod"
            mode="nombre"
            titre="Modification de barre d'attaque"
            sousTitre="à un tick précis : +% pour remplir, −% pour vider la barre (jamais sous 0)"
            icone={<Zap size={15} />}
            lignes={lignesVisibles}
            aAllie={aAllie}
            aEnnemi={aEnnemi}
            onSet={setMod}
            onSetEquipe={setModEquipe}
            refConteneur={enregistrer(1)}
            onScrollSync={synchro}
          />

          {/* Grille éditable : buff de vitesse (soutenu à partir du tick) */}
          <GrilleMod
            champ="speedMod"
            mode="buff"
            titre="Buff de vitesse"
            sousTitre="icône SPD = buff +30 % d'un clic, ou saisis une valeur — appliqué seulement aux ticks marqués (la vitesse, pas la barre)"
            icone={<Gauge size={15} />}
            lignes={lignesVisibles}
            aAllie={aAllie}
            aEnnemi={aEnnemi}
            onSet={setMod}
            onSetEquipe={setModEquipe}
            refConteneur={enregistrer(2)}
            onScrollSync={synchro}
          />

          {/* Ordre de tour */}
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
              Ordre de tour
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
              {premiers.map((a, i) => {
                const l = ligneParUid.get(a.id);
                if (!l) return null;
                const adv = a.camp === 'ennemi';
                return (
                  <span key={a.id} className="flex items-center gap-2">
                    {i > 0 && <span className="text-ink-dimmer">→</span>}
                    <Jeton
                      icone={
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-micro font-bold text-bg ${
                              adv ? 'bg-bad' : 'bg-accent'
                            }`}
                          >
                            {a.ordre}
                          </span>
                          <MonsterAvatar monster={l.monster} size={20} element={false} />
                        </span>
                      }
                      libelle={l.monster.name}
                      detail={<span className="font-mono">tick {a.tick}</span>}
                    />
                  </span>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Camp ---- */

interface CampProps {
  camp: Camp;
  titre: string;
  icone: React.ReactNode;
  lead: number;
  onLead: (v: number) => void;
  lignes: Ligne[];
  jouables: Monster[];
  combatDe: (l: Ligne) => number | null;
  onAjouter: (id: string) => void;
  onRetirer: (uid: string) => void;
  onMasquer: (uid: string) => void;
  onRuneSpeed: (uid: string, v: number | null) => void;
  // Présent (alliés) = une saisie « bonus d'artéfact au buff de vitesse » par
  // monstre. Absent (en face) = pas de champ : on ignore les artéfacts adverses.
  onArtefact?: (uid: string, v: number | null) => void;
  // Présents (alliés) = le bouton d'import d'un deck de siège. Absents (en
  // face) = pas de bouton : on n'importe que SA propre composition.
  decks?: DeckDispo[];
  onImporterDeck?: (team: SiegeTeam) => void;
}

function CampPanneau({
  camp,
  titre,
  icone,
  lead,
  onLead,
  lignes,
  jouables,
  combatDe,
  onAjouter,
  onRetirer,
  onMasquer,
  onRuneSpeed,
  onArtefact,
  decks,
  onImporterDeck,
}: CampProps) {
  const adv = camp === 'ennemi';
  const dejaAjoutes = useMemo(() => new Set(lignes.map((l) => String(l.monster.id))), [lignes]);

  // Le lead importé d'un deck peut ne pas figurer dans les raccourcis
  // (SPEED_LEADS n'est pas exhaustive, voir speed.ts) : on l'ajoute à la liste,
  // sinon le menu afficherait une valeur qu'il ne contient pas.
  const leads = useMemo(
    () => (lead > 0 && !SPEED_LEADS.includes(lead) ? [...SPEED_LEADS, lead].sort((a, b) => b - a) : SPEED_LEADS),
    [lead]
  );

  return (
    <section className="min-w-[280px] flex-1 rounded-lg border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border-soft px-3.5 py-2.5">
        <span className={`flex items-center gap-1.5 text-sm font-bold ${adv ? 'text-bad' : 'text-ink'}`}>
          <span className={adv ? 'text-bad' : 'text-accent'}>{icone}</span>
          {titre}
        </span>
        <label className="ml-auto flex items-center gap-1.5">
          <span className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer">Lead</span>
          <Selecteur
            taille="sm"
            pleineLargeur={false}
            value={lead}
            onChange={(e) => onLead(Number(e.target.value))}
            aria-label={`Lead de vitesse — ${titre}`}
          >
            <option value={0}>Sans</option>
            {leads.map((v) => (
              <option key={v} value={v}>
                +{v}%
              </option>
            ))}
          </Selecteur>
        </label>
      </div>

      {lignes.length > 0 && (
        <div className="space-y-2 p-2.5 pb-0">
          {lignes.map((l) => {
            const combat = combatDe(l);
            const masque = l.masque;
            return (
              <div
                key={l.uid}
                className="relative rounded-lg border border-border bg-panel2 px-3 py-2.5 pr-12"
              >
                {/* Cluster en haut à droite de la card : masquer + supprimer,
                    la croix à sa place habituelle dans l'app. */}
                <div className="absolute right-1 top-1 flex items-center gap-0.5">
                  <BoutonIcone
                    taille="serre"
                    actif={masque}
                    onClick={() => onMasquer(l.uid)}
                    libelle={masque ? `Afficher ${l.monster.name}` : `Masquer ${l.monster.name}`}
                    icone={masque ? <Eye size={13} /> : <EyeOff size={13} />}
                  />
                  <BoutonIcone
                    taille="serre"
                    onClick={() => onRetirer(l.uid)}
                    libelle={`Retirer ${l.monster.name}`}
                    icone={<X size={13} />}
                    className="hoverable:text-bad"
                  />
                </div>

                <div className={masque ? 'opacity-45' : ''}>
                  {/* En-tête : portrait + nom + base. */}
                  <div className="flex items-center gap-2.5">
                    <MonsterAvatar monster={l.monster} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{l.monster.name}</div>
                      <div className="font-mono text-micro text-ink-dim">base {l.monster.stats.speed ?? '—'}</div>
                    </div>
                  </div>

                  {/* Réglages + vitesse de combat, alignée à droite. */}
                  <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer">Runes</span>
                      <NumberField
                        value={l.runeSpeed}
                        onChange={(v) => onRuneSpeed(l.uid, v)}
                        min={0}
                        allowEmpty
                        width="w-12"
                        placeholder="+"
                        ariaLabel={`Vitesse des runes de ${l.monster.name}`}
                      />
                    </label>
                    {onArtefact && (
                      <label className="flex flex-col gap-0.5">
                        <span
                          className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer"
                          title="Bonus d'artéfact « augmente l'effet du buff de vitesse » — s'ajoute au buff quand il est actif"
                        >
                          Arté buff
                        </span>
                        <NumberField
                          value={l.artefactBuff}
                          onChange={(v) => onArtefact(l.uid, v)}
                          min={0}
                          max={99}
                          allowEmpty
                          width="w-12"
                          placeholder="+%"
                          ariaLabel={`Bonus d'artéfact au buff de vitesse de ${l.monster.name}`}
                        />
                      </label>
                    )}
                    <div className="ml-auto text-right">
                      <div className={`font-mono text-lg font-black leading-none ${adv ? 'text-bad' : 'text-ink'}`}>
                        {combat ?? '—'}
                      </div>
                      <div className="text-micro uppercase tracking-wide text-ink-dimmer">combat</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2 p-2.5">
        <RechercheMonstre
          monsters={jouables}
          dejaAjoutes={dejaAjoutes}
          onAdd={onAjouter}
          placeholder={adv ? 'Ajouter un monstre adverse…' : 'Ajouter un monstre à ton équipe…'}
        />
        {decks && onImporterDeck && <ImportDeck decks={decks} onImporter={onImporterDeck} />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Grille de mods -- */

interface GrilleModProps {
  champ: ChampMod;
  // 'nombre' : cellule NumberField (boost d'ATB, valeurs variables).
  // 'buff'   : cellule cliquable qui pose/retire un buff de vitesse (+30 %).
  mode: 'nombre' | 'buff';
  titre: string;
  sousTitre: string;
  icone: React.ReactNode;
  lignes: Ligne[];
  aAllie: boolean;
  aEnnemi: boolean;
  onSet: (champ: ChampMod, uid: string, tick: number, v: number | null) => void;
  onSetEquipe: (champ: ChampMod, camp: Camp, tick: number, v: number | null) => void;
  refConteneur: (el: HTMLDivElement | null) => void;
  onScrollSync: (e: React.UIEvent<HTMLDivElement>) => void;
}

// Grille éditable au MÊME rendu que la barre d'action : lignes = monstres,
// colonnes = ticks. Chaque camp présent ouvre sur une ligne « Toute l'équipe »
// qui écrit la même valeur sur tous ses monstres au tick visé.
function GrilleMod({
  champ,
  mode,
  titre,
  sousTitre,
  icone,
  lignes,
  aAllie,
  aEnnemi,
  onSet,
  onSetEquipe,
  refConteneur,
  onScrollSync,
}: GrilleModProps) {
  // Valeur commune d'un camp à un tick (pour la ligne « Toute l'équipe ») :
  // la valeur partagée si tous l'ont, sinon null (mélange).
  const valeurEquipe = (camp: Camp, tick: number): number | null => {
    const vals = lignes.filter((l) => l.camp === camp).map((l) => l[champ][tick] ?? 0);
    if (vals.length === 0) return null;
    return vals.every((v) => v === vals[0]) ? vals[0] || null : null;
  };

  const camps: { camp: Camp; label: string; present: boolean }[] = [
    { camp: 'allie', label: 'Toute ton équipe', present: aAllie },
    { camp: 'ennemi', label: 'Tout en face', present: aEnnemi },
  ];

  // Une cellule. Boost d'ATB : simple champ numérique. Buff de vitesse : le
  // raccourci (icône SPD, pose/retire +30 % d'un clic) ET le champ pour saisir
  // une autre valeur (33 %, un ralenti −30 %…).
  const cellule = (value: number | null, onChange: (v: number | null) => void, aria: string) =>
    mode === 'buff' ? (
      <div className="mx-auto flex w-[78px] items-center gap-1">
        <BoutonIcone
          cadre
          actif={!!value}
          onClick={() => onChange(value ? null : BUFF_SPD)}
          libelle={`${aria} — buff +30 %`}
          icone={
            <img src={SPD_ICON} alt="" width={13} height={13} className={value ? '' : 'opacity-40'} />
          }
        />
        <NumberField
          sansBoutons
          value={value}
          onChange={onChange}
          allowEmpty
          boxWidth="w-11"
          placeholder="·"
          ariaLabel={`${aria} — valeur`}
        />
      </div>
    ) : (
      // Boost d'ATB : positif pour remplir, négatif pour vider (la barre ne
      // descend jamais sous 0, garanti par la simulation). Bornes ±100.
      <NumberField
        sansBoutons
        value={value}
        onChange={onChange}
        allowEmpty
        min={-100}
        max={100}
        boxWidth="w-14"
        placeholder="·"
        ariaLabel={aria}
      />
    );

  return (
    <section className="rounded-lg border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border-soft px-4 py-2.5">
        <span className="text-accent">{icone}</span>
        <span className="text-micro font-semibold uppercase tracking-wider text-ink-dimmer">{titre}</span>
        <span className="text-xs font-normal text-ink-dimmer">· {sousTitre}</span>
      </div>
      <div className="overflow-x-auto" ref={refConteneur} onScroll={onScrollSync}>
        <table
          className="table-fixed border-collapse [font-variant-numeric:tabular-nums]"
          style={{ width: LARGEUR_TABLE }}
        >
          <Colonnes />
          <TeteTicks premiere="Cible" />
          <tbody>
            {camps.map(({ camp, label, present }) => {
              if (!present) return null;
              const adv = camp === 'ennemi';
              const monstres = lignes.filter((l) => l.camp === camp);
              return (
                <FragmentCamp key={camp}>
                  {/* Ligne équipe */}
                  <tr className="border-b border-border-soft bg-panel2/40">
                    <th className="sticky left-0 z-[2] border-r border-border-soft bg-panel2 px-3 py-1.5 text-left">
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${adv ? 'text-bad' : 'text-accent'}`}>
                        <span className={`h-2 w-2 rounded-full ${adv ? 'bg-bad' : 'bg-accent'}`} />
                        {label}
                      </span>
                    </th>
                    {TICKS.map((t) => (
                      <td key={t} className="py-1 text-center">
                        {cellule(
                          valeurEquipe(camp, t),
                          (v) => onSetEquipe(champ, camp, t, v),
                          `${label} — tick ${t}`
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* Lignes monstres */}
                  {monstres.map((l) => (
                    <tr key={l.uid} className="border-b border-border-soft">
                      <th className="sticky left-0 z-[2] border-r border-border-soft bg-panel px-3 py-1.5 text-left font-normal">
                        <span className="flex items-center gap-2">
                          <MonsterAvatar monster={l.monster} size={22} element={false} />
                          <span className="text-sm">{l.monster.name}</span>
                        </span>
                      </th>
                      {TICKS.map((t) => (
                        <td key={t} className="py-1 text-center">
                          {cellule(
                            l[champ][t] ?? null,
                            (v) => onSet(champ, l.uid, t, v),
                            `${l.monster.name} — tick ${t}`
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </FragmentCamp>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Regroupe la ligne équipe et ses monstres sans nœud DOM (un <tbody> par camp
// romprait la grille visuelle).
function FragmentCamp({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ------------------------------------------------------- Import deck ----- */

const LIBELLE_SOURCE: Record<DeckDispo['source'], string> = {
  defense: 'Défense',
  offense: 'Offense',
};

// Reprendre une équipe de siège telle quelle plutôt que de retaper trois
// monstres et trois vitesses de runes. Le bouton reste TOUJOURS affiché, même
// sans compte chargé : désactivé, il dit que la possibilité existe (voir
// spec/shared/design.md).
function ImportDeck({ decks, onImporter }: { decks: DeckDispo[]; onImporter: (team: SiegeTeam) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Fermeture au clic ailleurs et à Échap — même patron que les autres
  // flottants de l'app (DesyncBadge, SettingsMenu).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const vide = decks.length === 0;

  return (
    <div ref={ref} className="relative">
      <Bouton
        pleineLargeur
        icone={<Download size={14} />}
        libelle="Importer un deck de siège"
        disabled={vide}
        title={
          vide
            ? "Aucune équipe de siège enregistrée — importe ton compte, ou compose une défense / offense dans Siège."
            : 'Reprendre une de tes équipes de siège dans ton équipe'
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && !vide && (
        <Flottant
          rembourrage="aucun"
          className="max-h-[320px] overflow-y-auto"
          role="listbox"
          aria-label="Decks de siège"
        >
          {decks.map((d, i) => {
            const nouvelleSource = i === 0 || decks[i - 1].source !== d.source;
            return (
              <div key={d.cle}>
                {nouvelleSource && (
                  <div className="border-b border-border-soft bg-panel2 px-3 py-1.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                    {LIBELLE_SOURCE[d.source]}
                  </div>
                )}
                <ZoneCliquable
                  role="option"
                  onClick={() => {
                    onImporter(d.team);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hoverable:bg-accent-soft"
                >
                  <span className="flex flex-none items-center gap-1">
                    {d.monstres.map((m, j) => (
                      <MonsterAvatar key={`${m.id}-${j}`} monster={m} size={26} element={false} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{d.libelle}</span>
                  <Plus size={14} className="flex-none text-ink-dim" />
                </ZoneCliquable>
              </div>
            );
          })}
        </Flottant>
      )}
    </div>
  );
}

/* ------------------------------------------------------- Recherche ------- */

const MAX_RESULTS = 25;

// Combobox d'ajout — même grammaire que RtaSearch/MonsterGearPicker
// (Champ + Flottant + useComboboxNav), voir spec/shared/recherche-clavier.md.
function RechercheMonstre({
  monsters,
  dejaAjoutes,
  onAdd,
  placeholder,
}: {
  monsters: Monster[];
  dejaAjoutes: Set<string>;
  onAdd: (id: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const idBase = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Monster[] = [];
    for (const m of monsters) {
      if (m.name.toLowerCase().includes(q)) {
        out.push(m);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [monsters, query]);

  const nav = useComboboxNav<Monster>({
    results,
    query,
    setQuery,
    idBase,
    estDesactive: (m) => dejaAjoutes.has(String(m.id)),
    onValider: (m) => onAdd(String(m.id)),
  });

  return (
    <div className="relative">
      <Champ
        {...nav.inputProps}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        icone={<Search className="h-4 w-4" />}
      />
      {nav.open && (
        <Flottant
          {...nav.listProps}
          aria-label="Résultats de la recherche"
          rembourrage="aucun"
          className="max-h-[300px] overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-ink-dim">Aucun monstre trouvé.</div>
          ) : (
            results.map((m, i) => {
              const added = dejaAjoutes.has(String(m.id));
              const estActif = i === nav.actif;
              return (
                <div
                  key={m.id}
                  {...nav.optionProps(i)}
                  aria-disabled={added}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (added) return;
                    onAdd(String(m.id));
                    nav.reinitialiser();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition ${
                    added ? 'cursor-default opacity-50' : 'cursor-pointer'
                  } ${estActif && !added ? 'bg-accent-soft' : ''}`}
                >
                  <MonsterAvatar monster={m} size={26} />
                  <span className="flex-1 truncate text-sm font-medium">{m.name}</span>
                  <span className="font-mono text-micro text-ink-dim">SPD {m.stats.speed ?? '—'}</span>
                  {!added && <Plus size={14} className={estActif ? 'text-accent' : 'text-ink-dim'} />}
                </div>
              );
            })
          )}
        </Flottant>
      )}
    </div>
  );
}
