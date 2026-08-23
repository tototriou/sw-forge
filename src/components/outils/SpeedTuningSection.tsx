import { useId, useMemo, useState } from 'react';
import { Search, Plus, Timer, Users, Swords, X, Zap, Gauge } from 'lucide-react';
import { Monster } from '../../types';
import { combatSpeed, SPEED_LEADS, SIEGE_TICKS } from '../../lib/speed';
import { simulerOrdre, speedForTick, Camp, TuneMonstre, ModParTick } from '../../lib/speedTune';
import { formesJouables } from '../../lib/monsterForms';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useStickyState } from '../../hooks/useStickyState';
import MonsterAvatar from '../MonsterAvatar';
import { Champ, Flottant, NumberField, Selecteur, BoutonIcone } from '../../ui';

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
}

type ChampMod = 'atbMod' | 'speedMod';

const uidDe = (camp: Camp, id: string) => `${camp}:${id}`;

// Repère des ticks en tête : vitesse de combat minimale pour agir à chaque tick.
// Plage utile en jeu (11→3), les deux ticks siège (239/286) marqués en couleur.
const RULER_TICKS = [11, 10, 9, 8, 7, 6, 5, 4, 3];
const TICKS_SIEGE = new Set(SIEGE_TICKS.map((t) => t.value));

export default function SpeedTuningSection({ allMonsters }: Props) {
  const [lignes, setLignes] = useStickyState<Ligne[]>('speedTune.lignes', []);
  const [leadAllie, setLeadAllie] = useStickyState<number>('speedTune.leadAllie', 0);
  const [leadEnnemi, setLeadEnnemi] = useStickyState<number>('speedTune.leadEnnemi', 0);

  const jouables = useMemo(() => formesJouables(allMonsters), [allMonsters]);

  function ajouter(camp: Camp, id: string) {
    const uid = uidDe(camp, id);
    if (lignes.some((l) => l.uid === uid)) return;
    const monster = allMonsters.find((m) => String(m.id) === id);
    if (!monster) return;
    setLignes((prev) => [...prev, { uid, monster, runeSpeed: null, camp, atbMod: {}, speedMod: {} }]);
  }
  function retirer(uid: string) {
    setLignes((prev) => prev.filter((l) => l.uid !== uid));
  }
  function setRuneSpeed(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...l, runeSpeed: v } : l)));
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

  // Simulation « un seul par tick » avec les modificateurs.
  const ordre = useMemo(() => {
    const tune: TuneMonstre[] = [];
    for (const l of lignes) {
      const c = combatDe(l);
      if (c != null && c > 0)
        tune.push({ id: l.uid, combat: c, camp: l.camp, atbMod: l.atbMod, speedMod: l.speedMod });
    }
    return simulerOrdre(tune);
  }, [lignes, leadAllie, leadEnnemi]);

  const ligneParUid = useMemo(() => new Map(lignes.map((l) => [l.uid, l])), [lignes]);

  // Regroupement par tick NATUREL (vitesse seule, sans modificateur) pour poser
  // le portrait dans la case du repère qui correspond à la vitesse du monstre.
  const parTick = useMemo(() => {
    const map = new Map<number, Ligne[]>();
    for (const l of lignes) {
      const c = combatDe(l);
      if (c == null || c <= 0) continue;
      const n = Math.ceil(10000 / (7 * c));
      (map.get(n) ?? map.set(n, []).get(n)!).push(l);
    }
    return map;
  }, [lignes, leadAllie, leadEnnemi]);

  const dernierTick = ordre.length ? Math.max(...ordre.map((e) => e.actTick)) : 0;
  // Colonnes partagées par les trois tableaux. Au moins 12 pour laisser de la
  // place où poser un modificateur avant l'action ; plafonné pour rester lisible.
  const nbTicks = Math.min(40, Math.max(dernierTick + 1, 12));
  const ticks = useMemo(() => Array.from({ length: nbTicks }, (_, i) => i + 1), [nbTicks]);

  const rien = lignes.length === 0;
  const aAllie = lignes.some((l) => l.camp === 'allie');
  const aEnnemi = lignes.some((l) => l.camp === 'ennemi');

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
          onRuneSpeed={setRuneSpeed}
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
          onRuneSpeed={setRuneSpeed}
        />
      </div>

      {rien ? (
        <div className="rounded-lg border border-dashed border-border/70 py-10 text-center text-sm text-ink-dim">
          Ajoute au moins un monstre pour visualiser le remplissage des barres et l'ordre de tour.
        </div>
      ) : (
        <>
          {/* Barre d'action par tick (résultat, lecture seule) */}
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
              Barre d'action par tick
              <span className="ml-2 font-normal normal-case tracking-normal text-ink-dimmer">
                · % rempli — la case surlignée = ce monstre prend le tour
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right font-mono text-xs [font-variant-numeric:tabular-nums]">
                <thead>
                  <tr className="border-b border-border text-ink-dimmer">
                    <th className="sticky left-0 z-[2] border-r border-border-soft bg-panel px-3 py-2 text-left font-sans font-semibold">
                      Monstre
                    </th>
                    <th className="px-2.5 py-2 font-sans font-semibold">%/tick</th>
                    {ticks.map((t) => (
                      <th key={t} className="px-2.5 py-2 text-center font-sans font-semibold">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordre.map((e) => {
                    const l = ligneParUid.get(e.id);
                    if (!l) return null;
                    const adv = e.camp === 'ennemi';
                    return (
                      <tr key={e.id} className="border-b border-border-soft">
                        <th className="sticky left-0 z-[2] border-r border-border-soft bg-panel px-3 py-1.5 text-left font-normal">
                          <span className="flex items-center gap-2">
                            <MonsterAvatar monster={l.monster} size={24} element={false} />
                            <span className="font-sans text-sm">{l.monster.name}</span>
                            {adv && (
                              <span className="rounded border border-bad/50 px-1 text-micro font-bold uppercase tracking-wide text-bad">
                                adv
                              </span>
                            )}
                          </span>
                        </th>
                        <td className="px-2.5 py-1.5 text-ink-dim">{e.incBase.toFixed(2)}</td>
                        {ticks.map((t) => {
                          const estAction = t === e.actTick;
                          const passe = t > e.actTick;
                          const atb = passe ? null : e.trajectoire[t - 1];
                          const fond = estAction ? (adv ? 'bg-bad/15' : 'bg-accent-soft') : '';
                          const encre = estAction ? 'font-bold text-ink' : 'text-ink-dim';
                          return (
                            <td key={t} className={`relative px-2.5 py-1.5 text-center ${fond} ${encre}`}>
                              {atb == null ? '' : atb.toFixed(1)}
                              {estAction && (
                                <span
                                  className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-micro font-bold text-bg ${
                                    adv ? 'bg-bad' : 'bg-accent'
                                  }`}
                                >
                                  {e.rang}
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
              <span>Un seul monstre par tick — le suivant attend le tick d'après.</span>
            </div>
          </section>

          {/* Grille éditable : boost de barre d'attaque (ponctuel) */}
          <GrilleMod
            champ="atbMod"
            mode="nombre"
            titre="Boost de barre d'attaque"
            sousTitre="+% d'ATB donné à un tick précis (compétence, artéfact…)"
            icone={<Zap size={15} />}
            lignes={lignes}
            ticks={ticks}
            aAllie={aAllie}
            aEnnemi={aEnnemi}
            onSet={setMod}
            onSetEquipe={setModEquipe}
          />

          {/* Grille éditable : buff de vitesse (soutenu à partir du tick) */}
          <GrilleMod
            champ="speedMod"
            mode="buff"
            titre="Buff de vitesse"
            sousTitre="icône SPD = buff +30 % d'un clic, ou saisis une valeur — actif à partir du tick posé (la vitesse, pas la barre)"
            icone={<Gauge size={15} />}
            lignes={lignes}
            ticks={ticks}
            aAllie={aAllie}
            aEnnemi={aEnnemi}
            onSet={setMod}
            onSetEquipe={setModEquipe}
          />

          {/* Ordre de tour */}
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
              Ordre de tour
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
              {ordre.map((e, i) => {
                const l = ligneParUid.get(e.id);
                if (!l) return null;
                const adv = e.camp === 'ennemi';
                return (
                  <span key={e.id} className="flex items-center gap-2">
                    {i > 0 && <span className="text-ink-dimmer">→</span>}
                    <span
                      className={`flex items-center gap-2 rounded-full border bg-panel2 py-1 pl-1 pr-3 text-sm font-semibold ${
                        adv ? 'border-bad/55' : 'border-border'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-micro font-bold text-bg ${
                          adv ? 'bg-bad' : 'bg-accent'
                        }`}
                      >
                        {e.rang}
                      </span>
                      <MonsterAvatar monster={l.monster} size={20} element={false} />
                      {l.monster.name}
                      <span className="font-mono text-micro text-ink-dim">tick {e.actTick}</span>
                    </span>
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
  onRuneSpeed: (uid: string, v: number | null) => void;
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
  onRuneSpeed,
}: CampProps) {
  const adv = camp === 'ennemi';
  const dejaAjoutes = useMemo(() => new Set(lignes.map((l) => String(l.monster.id))), [lignes]);

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
            {SPEED_LEADS.map((v) => (
              <option key={v} value={v}>
                +{v}%
              </option>
            ))}
          </Selecteur>
        </label>
      </div>

      {lignes.length > 0 && (
        <div>
          {lignes.map((l) => {
            const combat = combatDe(l);
            return (
              <div
                key={l.uid}
                className="flex items-center gap-2.5 border-b border-border-soft px-3.5 py-2 last:border-b-0"
              >
                <MonsterAvatar monster={l.monster} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{l.monster.name}</div>
                  <div className="font-mono text-micro text-ink-dim">base {l.monster.stats.speed ?? '—'}</div>
                </div>
                <label className="flex flex-col items-end gap-0.5">
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
                <div className="w-12 text-right">
                  <div className={`font-mono text-base font-black leading-none ${adv ? 'text-bad' : 'text-ink'}`}>
                    {combat ?? '—'}
                  </div>
                  <div className="text-micro uppercase tracking-wide text-ink-dimmer">combat</div>
                </div>
                <BoutonIcone
                  onClick={() => onRetirer(l.uid)}
                  libelle={`Retirer ${l.monster.name}`}
                  taille="serre"
                  icone={<X size={14} />}
                  className="hoverable:text-bad"
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="p-2.5">
        <RechercheMonstre
          monsters={jouables}
          dejaAjoutes={dejaAjoutes}
          onAdd={onAjouter}
          placeholder={adv ? 'Ajouter un monstre adverse…' : 'Ajouter un monstre à ton équipe…'}
        />
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
  ticks: number[];
  aAllie: boolean;
  aEnnemi: boolean;
  onSet: (champ: ChampMod, uid: string, tick: number, v: number | null) => void;
  onSetEquipe: (champ: ChampMod, camp: Camp, tick: number, v: number | null) => void;
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
  ticks,
  aAllie,
  aEnnemi,
  onSet,
  onSetEquipe,
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
      <NumberField
        sansBoutons
        value={value}
        onChange={onChange}
        allowEmpty
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse [font-variant-numeric:tabular-nums]">
          <thead>
            <tr className="border-b border-border text-ink-dimmer">
              <th className="sticky left-0 z-[2] border-r border-border-soft bg-panel px-3 py-2 text-left text-xs font-semibold">
                Cible
              </th>
              {ticks.map((t) => (
                <th key={t} className="px-1.5 py-2 text-center font-mono text-xs font-semibold">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
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
                    {ticks.map((t) => (
                      <td key={t} className="px-1 py-1 text-center">
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
                      {ticks.map((t) => (
                        <td key={t} className="px-1 py-1 text-center">
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
