import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Plus, Timer, Users, Swords, X, Zap, Gauge, Eye, EyeOff, Download, Check, Scissors, Play, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { ELEMENTS, Monster, SiegeTeam } from '../../types';
import { LeadInfo, combatSpeed, leadsDeVitesse, runeSpeedForTarget, SIEGE_TICKS } from '../../lib/speed';
import {
  simuler,
  premiersTours,
  speedForTick,
  diagnostiquerChaine,
  vitessesRequises,
  artefactsRequis,
  diagnostiquerSequence,
  fenetresRequises,
  RaisonOrdre,
  Fenetre,
  HORIZON_TICKS,
  Camp,
  TuneMonstre,
  ModParTick,
} from '../../lib/speedTune';
import { deckPourSpeedTune } from '../../lib/speedTuneDeck';
import {
  Ligne,
  Leads,
  aLaMain,
  ampliDe as ampliDeLignes,
  appliquerMods,
  combatDe as combatDeLigne,
  duCamp,
  entreeDe as entreeDeLigne,
  estimerCumuls,
  gainPassifDe as gainPassifDeLigne,
  leadDe as leadDeCamp,
  ligneReference as ligneReferenceDe,
  ligneVierge,
  lignesDeDeck,
  majMod,
  oublierCamp,
  passifActifDe as passifActifDeLigne,
  passifDe as passifDeLigne,
  plusRapideAllie as plusRapideAllieDe,
  sortActif as sortActifDe,
  sortSecondDe,
  sortsDe as sortsDeLigne,
  tuneDe,
  uidDe,
  visibles,
} from '../../lib/speedTuneLignes';
import { kitVitesse, sortsVitesse, KitVitesse, SortVitesse, KIT_VIDE } from '../../lib/speedTuneKit';
import { passifsVitesse, pointsDeGain, PassifVitesse } from '../../lib/speedTunePassif';
import { analyseAutomatique, cumulsEstimes, sortRetenu, sortSecondRetenu, EntreeAuto } from '../../lib/speedTuneAuto';
import { chargerDetail } from '../../lib/monsterSkills';
import { teamSummary } from '../../lib/recoFromSiege';
import { formesJouables } from '../../lib/monsterForms';
import LeadPill from '../siege/LeadPill';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useSpeedTune, DeckDispo, ChampMod, DeckInitial } from '../../hooks/useSpeedTune';

import { useAdversaireReference } from '../../hooks/useAdversaireReference';
import { useStickyState } from '../../hooks/useStickyState';
import MonsterAvatar from '../MonsterAvatar';
import RuneIcon from '../RuneIcon';
import { runeSetIconFilter } from '../../lib/effects';
import {
  Bouton,
  Champ,
  FlottantAuto,
  Interrupteur,
  Flottant,
  NumberField,
  Selecteur,
  BoutonIcone,
  Jeton,
  ZoneCliquable,
} from '../../ui';

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
  // Équipe chargée d'office à l'ouverture — l'outil ouvert DEPUIS un deck (voir
  // SpeedTuneModale). Absent sur la page d'outil, qui s'ouvre sur ce qu'on y a
  // laissé.
  deckInitial?: DeckInitial | null;
  // L'en-tête de la page (titre + rappel de la règle des ticks). ⚠️ Coupé en
  // modale, qui porte déjà les deux : deux titres « Speed tuning » l'un sous
  // l'autre, et on cherche lequel des deux se ferme.
  entete?: boolean;
}

// Le rappel de la règle, en une phrase. ⚠️ Écrit UNE fois : la page le met sous
// son titre, la modale sous le sien — il ne doit pas exister deux versions qui
// se mettent à diverger.
export const REGLE_TICKS = (
  <>
    À chaque tick, la barre d'action monte de <span className="text-ink">vitesse × 7 %</span> ; un seul monstre
    agit par tick. Ajoute tes monstres et ceux d'en face pour voir qui joue avant qui.
  </>
);



// Un modificateur signé, tel qu'il se lit dans une grille : « +45 », « −50 ».
// ⚠️ Les effets posés par les compétences peuvent être NÉGATIFS (une barre
// vidée, un ralenti) — « +-50 » serait illisible.
const signe = (v: number) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);

// Ce qu'un sort fait, en une ligne, pour le menu de l'analyse poussée. Un sort
// sans effet sur la vitesse reste proposable — c'est un tour où l'on ne fait
// rien pour le tune, et c'est une information.
function libelleSort(x: SortVitesse): string {
  const bouts: string[] = [];
  const e = x.effet;
  if (e.atbEquipe) bouts.push(`+${e.atbEquipe} % barre équipe`);
  if (e.atbAllie) bouts.push(`+${e.atbAllie} % barre 1 allié`);
  if (e.atbSoi) bouts.push(`+${e.atbSoi} % sa barre`);
  // ⚠️ Annoncé, mais annoncé comme NON COMPTÉ : le tune se juge sans ce qu'on
  // retire à l'adverse (voir `sansReductionAdverse`). Le taire laisserait croire
  // que le calcul en tient compte.
  if (e.atbEnnemi)
    bouts.push(`−${e.atbEnnemi} % barre adv${e.atbEnnemiTous ? ' (tous)' : ''} (non compté)`);
  if (e.buffEquipe) bouts.push('buff VIT équipe');
  if (e.buffSoi) bouts.push('buff VIT sur soi');
  if (e.ralenti) bouts.push(`ralenti adv${e.ralentiTous ? ' (tous)' : ''} (non compté)`);
  if (x.rejoue) bouts.push('rejoue');
  if (x.cooldown > 0) bouts.push(`recharge ${x.cooldown} tours`);
  if (x.chance != null) bouts.push(`${x.chance} %`);
  const quoi = bouts.length ? bouts.join(' · ') : 'sans effet sur la vitesse';
  return `${x.slot ? `S${x.slot} ` : ''}${x.nom} — ${quoi}`;
}

// Ce qui cloche pour un monstre dans l'ordre demandé, dit en clair.
const LIBELLE_RAISON: Record<RaisonOrdre, string> = {
  'nagit-pas': "n'agit pas",
  'apres-adverse': "joue après l'adverse",
  'trop-tot': 'joue trop tôt',
  'trop-tard': 'joue trop tard',
};

// Repère des ticks en tête : vitesse de combat minimale pour agir à chaque tick.
// Plage utile en jeu (11→3), les deux ticks siège (239/286) marqués en couleur.
const RULER_TICKS = [11, 10, 9, 8, 7, 6, 5, 4, 3];
const TICKS_SIEGE = new Set(SIEGE_TICKS.map((t) => t.value));

// ⚠️ **Les barres se lisent à TROIS décimales.** À deux, une barre à 99,996 %
// s'affichait « 100.00 » sans que le monstre agisse : on cherchait un bug là où
// il n'y en avait pas. Le tick se joue à un millième près, l'affichage doit le
// montrer.
//
// ⚠️ **Les trois tableaux (barres, boost, buff) partagent EXACTEMENT la même
// grille de colonnes** — même largeur de colonne « cible », même largeur de
// tick, mêmes 40 ticks — et leur défilement horizontal est synchronisé. Sans
// ça, tick 12 du boost ne tombait pas sous tick 12 des barres : on se perdait.
const LARGEUR_CIBLE = 210; // colonne de gauche (portrait + nom)
const LARGEUR_TICK = 92; // chaque colonne de tick (3 décimales, voir plus bas)
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

export default function SpeedTuningSection({
  allMonsters,
  siegeDefenseTeams,
  siegeOffenseTeams,
  deckInitial,
  entete = true,
}: Props) {
  // ⚠️ **Ce composant NE CALCULE RIEN.** Tout le métier — vitesses, sorts,
  // analyse, adversaire de référence — vit dans `useSpeedTune` et les libs
  // qu'il appelle. Ne restent ici que le rendu et ce qui n'a de sens qu'à
  // l'écran : le défilement synchronisé des tableaux et les pastilles.
  const {
    aAllie,
    aEnnemi,
    nomDe,
    parTick,
    rien,
    rienVisible,
    runesPour,
    ajouter,
    alliesVisibles,
    ampliDe,
    analyseAuto,
    analyser,
    arrivee,
    arteParUid,
    arteRequis,
    auto,
    basculerMasque,
    basculerPassif,
    basculerSwift,
    chaine,
    choisirCible,
    choisirSecond,
    choisirSort,
    choixSorts,
    cibleFenetre,
    cibleSort,
    combatDe,
    decks,
    deplacer,
    donneesKit,
    entreeDe,
    fenetreArteParUid,
    fenetreParUid,
    fenetres,
    fenetresArte,
    gainPassifDe,
    importerDeck,
    jouables,
    kits,
    leadAllie,
    leadDe,
    leadEnnemi,
    poserLead,
    leads,
    ligneParUid,
    ligneReference,
    lignes,
    lignesTableau,
    lignesVisibles,
    monsterById,
    montrerAnalyse,
    numAction,
    ordreRange,
    ordreVoulu,
    passifActifDe,
    passifDe,
    passifs,
    plusRapideAllie,
    poussee,
    premiereSignature,
    premiers,
    problemeParUid,
    requis,
    deplacerLigne,
    retirer,
    sequence,
    setArtefact,
    setAuto,
    setCibleSort,
    setCumuls,
    setKits,
    setLeadAllie,
    setLeadEnnemi,
    setLignes,
    setMod,
    setModEquipe,
    setMontrerAnalyse,
    setOrdreRange,
    setOrdreVoulu,
    setPassifs,
    setPoussee,
    setRuneSpeed,
    setSortChoisi,
    setSortChoisi2,
    setSorts,
    sim,
    sortActif,
    sortAuto,
    sortChoisi,
    sortChoisi2,
    sortSecond,
    sorts,
    sortsDe,
    sortsSignature,
    toujoursReference,
    tune,
  } = useSpeedTune({ allMonsters, siegeDefenseTeams, siegeOffenseTeams, deckInitial });

  function besoin(l: Ligne, combatCible: number | null, arteCible: number | null, arteActuel: number) {
    const runes = combatCible == null ? null : runesPour(l, combatCible);
    const arte = arteCible == null ? null : arteCible - arteActuel;
    if (runes == null && arte == null) {
      return <span className="text-xs text-ink-dim">hors de portée</span>;
    }
    return (
      <span className="flex items-center gap-1.5">
        {runes != null && (
          <span className="rounded border border-accent/50 px-1.5 py-0.5 font-mono text-micro font-bold text-accent">
            {signe(runes)} SPD
          </span>
        )}
        {runes != null && arte != null && <span className="text-micro text-ink-dim">ou</span>}
        {arte != null && (
          <span
            className="rounded border border-accent/50 px-1.5 py-0.5 font-mono text-micro font-bold text-accent"
            title="Artéfact « Effet aug. VIT » : il amplifie le buff de vitesse reçu"
          >
            {signe(arte)} spd buff effect
          </span>
        )}
      </span>
    );
  }

  // La borne à viser sur une fenêtre, ou `null` si la vitesse actuelle la tient
  // déjà — et `undefined` si la fenêtre est VIDE (les bornes se croisent : on ne
  // s'en sortira pas sans toucher aux autres).
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


  return (
    <div className="space-y-4">
      {entete && (
        <header className="flex items-start gap-3">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded bg-accent-soft text-accent">
            <Timer size={18} />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Speed tuning</h1>
            <p className="mt-0.5 text-sm text-ink-dim">{REGLE_TICKS}</p>
          </div>
        </header>
      )}

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
          onLead={poserLead('allie')}
          lignes={lignes.filter((l) => l.camp === 'allie')}
          jouables={jouables}
          combatDe={combatDe}
          onAjouter={(id) => ajouter('allie', id)}
          onRetirer={retirer}
          onMasquer={basculerMasque}
          onDeplacer={deplacerLigne}
          onRuneSpeed={setRuneSpeed}
          onSwift={basculerSwift}
          onCumuls={setCumuls}
          onPassif={basculerPassif}
          passifDe={passifDe}
          passifActifDe={passifActifDe}
          gainPassifDe={gainPassifDe}
          kits={kits}
          onArtefact={setArtefact}
          decks={decks}
          onImporterDeck={(team) => importerDeck('allie', team)}
        />
        <CampPanneau
          camp="ennemi"
          titre="En face"
          icone={<Swords size={15} />}
          lead={leadEnnemi}
          onLead={poserLead('ennemi')}
          lignes={lignes.filter((l) => l.camp === 'ennemi')}
          jouables={jouables}
          combatDe={combatDe}
          onAjouter={(id) => ajouter('ennemi', id)}
          onRetirer={retirer}
          onMasquer={basculerMasque}
          onDeplacer={deplacerLigne}
          onRuneSpeed={setRuneSpeed}
          onSwift={basculerSwift}
          onCumuls={setCumuls}
          onPassif={basculerPassif}
          passifDe={passifDe}
          passifActifDe={passifActifDe}
          gainPassifDe={gainPassifDe}
          kits={kits}
          onArtefact={setArtefact}
          decks={decks}
          onImporterDeck={(team) => importerDeck('ennemi', team)}
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
            {/* ⚠️ Une card INDÉPENDANTE : elle ne s'ouvre ni ne se ferme depuis
                l'analyse, elle est là comme les grilles. L'analyse la REMPLIT — elle
                y écrit l'ordre des vitesses et le sort de chacun — mais les deux
                se lisent et se règlent séparément.
                ⚠️ **Et elle passe EN PREMIER** : c'est ici qu'on désigne ce que
                chacun lance, et le verdict de l'analyse en découle. */}
          <section className="rounded-lg border border-border bg-panel">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-soft px-4 py-2.5">
                  <span className="text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                    Ordre des sorts
                  </span>
                  <span className="ml-auto">
                    <Interrupteur
                      actif={poussee}
                      onChange={setPoussee}
                      libelle={<span className="text-xs font-semibold">Afficher</span>}
                      title="Replie la liste pour gagner de la place. ⚠️ Les sorts déjà choisis continuent de compter : refermer ne défait rien."
                    />
                  </span>
                </div>
                {poussee && (
                <div className="px-4 py-3.5">
                      {ordreVoulu.length === 0 ? (
                        <p className="text-sm text-ink-dim">Ajoute des monstres à ton équipe pour composer un ordre.</p>
                      ) : (
                        <>
                          <p
                            className={`flex items-center gap-2 text-sm font-semibold ${
                              sequence.ok ? 'text-good' : 'text-bad'
                            }`}
                          >
                            {sequence.ok ? <Check size={16} /> : <Scissors size={16} />}
                            {sequence.ok
                              ? "L'ordre demandé est bien celui que produisent tes vitesses."
                              : "Tes vitesses ne produisent pas cet ordre."}
                          </p>
                          <ul className="mt-3 space-y-2">
                            {ordreVoulu.map((uid, i) => {
                              const l = ligneParUid.get(uid);
                              if (!l) return null;
                              const p = problemeParUid.get(uid);
                              const f = fenetreParUid.get(uid);
                              const liste = sortsDe(l);
                              const choix = sortChoisi[uid];
                              return (
                                <li
                                  key={uid}
                                  className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border border-border bg-panel2 px-2.5 py-2"
                                >
                                  <span className="flex flex-none items-center gap-1">
                                    <BoutonIcone
                                      taille="serre"
                                      onClick={() => deplacer(uid, -1)}
                                      disabled={i === 0}
                                      libelle={`Monter ${l.monster.name}`}
                                      icone={<ChevronUp size={13} />}
                                    />
                                    <BoutonIcone
                                      taille="serre"
                                      onClick={() => deplacer(uid, 1)}
                                      disabled={i === ordreVoulu.length - 1}
                                      libelle={`Descendre ${l.monster.name}`}
                                      icone={<ChevronDown size={13} />}
                                    />
                                  </span>
                                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-micro font-bold text-bg">
                                    {i + 1}
                                  </span>
                                  <MonsterAvatar monster={l.monster} size={24} element={false} />
                                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.monster.name}</span>
                                  {/* Ce qu'il LANCE à son tour, dans un menu à
                                      icônes : la ligne reste lisible d'un coup
                                      d'œil, et le détail s'ouvre à la demande. */}
                                  <ChoixSort
                                    sorts={liste}
                                    valeur={choix ?? ''}
                                    onChoisir={(v) => choisirSort(uid, v)}
                                    nomMonstre={l.monster.name}
                                  />
                                  {/* ⚠️ Certains sorts ne touchent QU'UN allié et
                                      laissent le joueur viser (S3 de Sapsaree :
                                      « the target ally »). La barre la plus basse
                                      est un défaut raisonnable, pas une règle du
                                      jeu : on doit pouvoir désigner. */}
                                  {sortActif(l)?.effet.atbAllie && (
                                    <label className="flex items-center gap-1.5">
                                      <span className="text-micro uppercase tracking-wide text-ink-dimmer">sur</span>
                                      <Selecteur
                                        taille="sm"
                                        pleineLargeur={false}
                                        value={cibleSort[uid] ?? ''}
                                        onChange={(e) => choisirCible(uid, e.target.value)}
                                        aria-label={`Allié visé par le sort de ${l.monster.name}`}
                                      >
                                        <option value="">barre la plus basse</option>
                                        {lignesVisibles
                                          .filter((x) => x.camp === l.camp && x.uid !== uid)
                                          .map((x) => (
                                            <option key={x.uid} value={x.uid}>
                                              {x.monster.name}
                                            </option>
                                          ))}
                                      </Selecteur>
                                    </label>
                                  )}
                                  {/* ⚠️ Sa compétence lui REND son tour (Kroa) : il
                                      rejoue au même tick, et lance autre chose. */}
                                  {sortActif(l)?.rejoue && (
                                    <span className="flex items-center gap-1.5">
                                      <span
                                        className="flex-none rounded border border-accent/50 px-1 text-micro font-bold uppercase tracking-wide text-accent"
                                        title="Cette compétence lui rend son tour : il rejoue aussitôt, au même tick."
                                      >
                                        rejoue
                                      </span>
                                      <ChoixSort
                                        sorts={liste.filter((x) => x.nom !== sortActif(l)?.nom)}
                                        valeur={sortChoisi2[uid] ?? ''}
                                        onChoisir={(v) => choisirSecond(uid, v)}
                                        prefixe="puis : "
                                        nomMonstre={l.monster.name}
                                      />
                                    </span>
                                  )}
                                  <span className="w-full sm:w-auto sm:flex-none">
                                    {p ? (
                                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                        <span className="font-semibold text-bad">{LIBELLE_RAISON[p.raison]}</span>
                                        {(() => {
                                          const cible = cibleFenetre(f);
                                          const arte = cibleFenetre(fenetreArteParUid.get(uid));
                                          return besoin(
                                            l,
                                            cible ?? null,
                                            arte ?? null,
                                            fenetreArteParUid.get(uid)?.combatActuel ?? 0
                                          );
                                        })()}
                                      </span>
                                    ) : (
                                      <Check size={13} className="text-good" />
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          <p className="mt-2.5 text-xs text-ink-dim">
                            ⚠️ Une fenêtre se lit <span className="text-ink">les autres inchangés</span> : elle dit ce que
                            ce rang laisse à CE monstre aujourd'hui. Corriger un monstre déplace celles des voisins — on
                            règle un ordre un monstre à la fois.
                          </p>
                        </>
                      )}
              </div>
              )}
            </section>

            {/* ⚠️ **L'analyse vient APRÈS l'ordre des sorts**, parce que c'est
                l'ordre de la CAUSE et de l'effet : on désigne ce que chacun
                lance, et le verdict en découle. Changer un sort est d'ailleurs
                le seul geste qui relance l'écriture des grilles. Lire le verdict
                d'abord obligeait à remonter pour comprendre d'où il sortait. */}
          <section className="rounded-lg border border-border bg-panel">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-soft px-4 py-2.5">
                <span className="text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                  Analyse automatique
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {/* ⚠️ Une ACTION, pas un mode : l'analyse ÉCRIT dans les grilles
                      puis s'arrête. Un interrupteur laissait croire à une couche
                      qui tourne en fond et qui repasserait sur ce qu'on règle. */}
                  <Bouton
                    icone={<Play size={14} />}
                    libelle={auto ? 'Relancer' : 'Analyser'}
                    disabled={!aAllie}
                    title={
                      !aAllie
                        ? "Ajoute d'abord des monstres à ton équipe."
                        : "Lit les kits et POSE le résultat dans les grilles, comme si tu les remplissais à la main. Ensuite tout est modifiable : l'analyse ne repasse plus, sauf si tu changes un sort."
                    }
                    onClick={analyser}
                  />
                </span>
              </div>
              {/* ⚠️ Sans adversaire, il n'y a pas de verdict — et rien à dire :
                  le corps ne s'affiche pas du tout plutôt que de porter une phrase
                  qui explique l'évidence. */}
              {(!aAllie || chaine.coupeur) && (
                <div className="px-4 py-3.5">
                    {!aAllie ? (
                      <p className="text-sm text-ink-dim">
                        Ajoute des monstres à ton équipe pour vérifier que rien ne la coupe.
                      </p>
                    ) : chaine.ok ? (
                      <p className="flex items-center gap-2 text-sm font-semibold text-good">
                        <Check size={16} className="flex-none" />
                        Ta team est speed tune.
                      </p>
                    ) : (
                      <>
                        <p className="flex items-center gap-2 text-sm font-semibold text-bad">
                          <Scissors size={16} className="flex-none" />
                          {chaine.coupeur ? nomDe(chaine.coupeur.id) : 'Un adverse'} coupe ton combo.
                        </p>
                        {/* ⚠️ Une ligne = un nom et le chiffre à trouver, rien de
                            plus : ce qu'on vient chercher ici, c'est « combien il me
                            manque », pas un récit.
                            ⚠️ **On liste ce que le solveur DEMANDE, pas ce qui est
                            coupé.** Le réglage est un jeu de vitesses cohérent : il
                            demande parfois des points à un monstre qui passe déjà
                            (celui qui remplit la barre, à accélérer pour qu'il
                            achète un tick au suivant), et il ne demande rien à un
                            monstre coupé que la correction d'un autre suffit à
                            sauver. Lister `chaine.coupes` masquait la moitié de la
                            solution — appliquée telle quelle, elle ne tenait pas. */}
                        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                          {requis.map((c) => {
                            const l = ligneParUid.get(c.id);
                            if (!l) return null;
                            const cible = c.combatRequis;
                            const a = arteParUid.get(c.id);
                            const arte = a?.artefactRequis ?? null;
                            return (
                              <li key={c.id} className="flex items-center gap-2 text-sm">
                                <MonsterAvatar monster={l.monster} size={22} element={false} />
                                <span className="font-semibold">{l.monster.name}</span>
                                {besoin(l, cible, arte, a?.artefactActuel ?? 0)}
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                </div>
              )}
            </section>

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
                        {/* ⚠️ **La colonne des noms porte le camp.** C'est la
                            seule qui reste à l'écran quand on défile les 40
                            ticks : sans elle, on lit une ligne de chiffres sans
                            savoir si elle est à soi ou en face. Fond SOLIDE
                            (`-soft`), jamais une transparence — la colonne est
                            collante et passe par-dessus le tableau qui défile
                            dessous. */}
                        <th
                          className={`sticky left-0 z-[2] border-r border-border-soft px-3 py-1.5 text-left font-normal ${
                            adv ? 'bg-bad-soft' : 'bg-good-soft'
                          }`}
                        >
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
                              <span className="block text-micro text-ink-dim">{e.incBase.toFixed(3)} %/tick</span>
                            </span>
                          </span>
                        </th>
                        {TICKS.map((t) => {
                          const num = numAction.get(`${e.id}@${t}`);
                          const estAction = num != null;
                          const atb = e.trajectoire[t - 1];
                          // Les DEUX camps par une transparence de leur couleur : `accent-soft` était
                        // un fond opaque d'un côté et un voile de l'autre, deux
                        // intensités pour un même repère.
                        const fond = estAction ? (adv ? 'bg-bad/15' : 'bg-good/15') : '';
                          const encre = estAction
                            ? 'font-bold text-ink'
                            : atb != null && atb >= 100
                              ? 'text-ink' // barre pleine en attente de son tour
                              : 'text-ink-dim';
                          return (
                            <td key={t} className={`relative py-1.5 text-center ${fond} ${encre}`}>
                              {atb == null ? '' : atb.toFixed(3)}
                              {estAction && (
                                <span
                                  className={`absolute -right-0.5 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-micro font-bold text-bg ${
                                    adv ? 'bg-bad' : 'bg-good'
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
                <span className="inline-block h-3 w-3 rounded bg-good/25" /> Ton équipe agit
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
            sousTitre="à un tick précis : +% pour remplir, −% pour vider la barre (jamais sous 0) — l'analyse écrit ici, tu corriges par-dessus"
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
            sousTitre="icône SPD = buff +30 % d'un clic, ou saisis une valeur — l'analyse écrit ici, tu corriges par-dessus"
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
                              adv ? 'bg-bad' : 'bg-good'
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
  lead: LeadInfo | null;
  onLead: (v: LeadInfo | null) => void;
  lignes: Ligne[];
  jouables: Monster[];
  combatDe: (l: Ligne) => number | null;
  onAjouter: (id: string) => void;
  onRetirer: (uid: string) => void;
  onMasquer: (uid: string) => void;
  onDeplacer: (uid: string, sens: -1 | 1) => void;
  onRuneSpeed: (uid: string, v: number | null) => void;
  onSwift: (uid: string) => void;
  onCumuls: (uid: string, v: number | null) => void;
  onPassif: (uid: string) => void;
  passifActifDe: (l: Ligne) => boolean;
  // Le passif de vitesse d'une ligne, et ce qu'il ajoute — lus par le parent,
  // qui seul connaît l'état de l'analyse.
  passifDe: (l: Ligne) => PassifVitesse | null;
  gainPassifDe: (l: Ligne) => number;
  // Ce que le kit de chaque monstre pose (par com2usId) : sert à dire d'OÙ vient
  // la valeur pré-remplie.
  kits: Map<number, KitVitesse>;
  // Saisie « bonus d'artéfact au buff de vitesse », dans les DEUX camps.
  //
  // ⚠️ Il fut un temps réservé aux alliés (« on ne connaît pas les artéfacts
  // d'en face ») : ça ne tient plus, puisqu'un deck importé ou l'adversaire de
  // référence y POSENT une valeur lue sur nos propres artéfacts. Un chiffre qui
  // compte dans le calcul doit se voir et se corriger là où il est.
  onArtefact: (uid: string, v: number | null) => void;
  // Le bouton d'import d'un deck de siège, dans les DEUX camps : on reprend sa
  // propre compo d'un côté, la défense qu'on affronte de l'autre.
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
  onDeplacer,
  onRuneSpeed,
  onSwift,
  onCumuls,
  onPassif,
  passifDe,
  passifActifDe,
  gainPassifDe,
  kits,
  onArtefact,
  decks,
  onImporterDeck,
}: CampProps) {
  const adv = camp === 'ennemi';
  const dejaAjoutes = useMemo(() => new Set(lignes.map((l) => String(l.monster.id))), [lignes]);

  // ⚠️ **Tous les leads du jeu**, lus dans les données (`leadsDeVitesse`) et non
  // dans une liste écrite à la main : le jeu a des +10, +15, +16, +17, et des
  // leads d'ÉLÉMENT à +23 et +30 qu'aucun pourcentage seul ne sait dire.
  // Choisir le lead qu'on a vraiment ne doit pas dépendre de ce qu'on a pensé à
  // recopier.
  const leads = useMemo(() => leadsDeVitesse(jouables), [jouables]);
  // Un lead importé d'un deck figure forcément dans la liste (elle vient des
  // mêmes données) — mais on ne PARIE pas là-dessus : une valeur absente du menu
  // s'y afficherait vide, sans que rien ne dise pourquoi.
  const cleDe = (l: LeadInfo | null) => (l ? `${l.amount}|${l.element ?? ''}` : '');
  const tous = useMemo(
    () => (lead && !leads.some((l) => cleDe(l) === cleDe(lead)) ? [...leads, lead] : leads),
    [leads, lead]
  );

  return (
    // ⚠️ **Le contour REMPLACE celui du panneau, il ne s'y ajoute pas** : un
    // cadre de camp par-dessus le cadre neutre ferait deux contours
    // concentriques, ce que la charte interdit. Même règle pour le bandeau, qui
    // teinte une bande existante au lieu d'en ajouter une.
    <section
      className={`min-w-[280px] flex-1 rounded-lg border bg-panel ${
        adv ? 'border-bad/45' : 'border-good/45'
      }`}
    >
      <div
        // ⚠️ `rounded-t-lg-inner` : le fond du bandeau débordait dans l'arrondi
        // du panneau et lui redonnait des coins carrés. Le rayon intérieur vaut
        // celui du panneau MOINS son contour d'un pixel (voir tailwind.config).
        className={`flex items-center gap-2 rounded-t-lg-inner border-b px-3.5 py-2.5 ${
          adv ? 'border-bad/30 bg-bad-soft' : 'border-good/30 bg-good-soft'
        }`}
      >
        <span className={`flex items-center gap-1.5 text-sm font-bold ${adv ? 'text-bad' : 'text-ink'}`}>
          <span className={adv ? 'text-bad' : 'text-good'}>{icone}</span>
          {titre}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer">Lead</span>
          {/* ⚠️ **Un lead d'ÉLÉMENT s'affiche ICI, pas sur chaque monstre.** Le
              sélecteur n'a qu'une valeur : il ne sait pas dire « +33 % pour les
              alliés Eau seulement ». Il cède donc sa place — deux contrôles de
              lead côte à côte laisseraient croire qu'ils s'additionnent. Le
              calcul, lui, passe par le lead que chaque monstre porte. */}
          {/* ⚠️ **La MÊME pastille que dans les decks** (`LeadPill`) : icône
              officielle du jeu, montant, icône d'élément. En redessiner une ici
              aurait donné deux façons d'afficher un lead dans la même app, pour
              la même donnée. Elle ne s'affiche que s'il y a un lead — un
              emplacement vide n'apprend rien. */}
          {lead && <LeadPill ls={{ stat: 'Attack Speed', ...lead }} />}
          {/* ⚠️ **UN seul menu.** Un lead est une chose — « +23 % alliés Eau »
              n'est pas « +23 % » plus « Eau » : séparer le montant de la portée
              laissait composer des leads qui n'existent pas dans le jeu. Les
              deux groupes suffisent à s'y retrouver. */}
          <Selecteur
            taille="sm"
            pleineLargeur={false}
            value={cleDe(lead)}
            onChange={(e) => onLead(tous.find((l) => cleDe(l) === e.target.value) ?? null)}
            aria-label={`Lead de vitesse — ${titre}`}
          >
            <option value="">Sans</option>
            <optgroup label="Tous les alliés">
              {tous
                .filter((l) => !l.element)
                .map((l) => (
                  <option key={cleDe(l)} value={cleDe(l)}>
                    +{l.amount}%
                  </option>
                ))}
            </optgroup>
            <optgroup label="Par élément">
              {tous
                .filter((l) => l.element)
                .map((l) => (
                  <option key={cleDe(l)} value={cleDe(l)}>
                    +{l.amount}% · {ELEMENTS.find((e) => e.key === l.element)?.label ?? '—'}
                  </option>
                ))}
            </optgroup>
          </Selecteur>
        </span>
      </div>

      {lignes.length > 0 && (
        <div className="space-y-2 p-2.5 pb-0">
          {lignes.map((l, index) => {
            const combat = combatDe(l);
            const masque = l.masque;
            // ⚠️ Ce que le monstre pose sur son camp (barre d'attaque, buff de
            // vitesse) ne se SAISIT PAS : c'est lu dans son kit. La card ne
            // montre que ce qui reste à décider — vitesse de runes et artéfact —
            // plus l'avertissement de skill-up quand le chiffre le suppose.
            const kit = (l.monster.com2usId != null ? kits.get(l.monster.com2usId) : null) ?? KIT_VIDE;
            const passif = passifDe(l);
            const passifActif = passifActifDe(l);
            const gainPassif = gainPassifDe(l);
            return (
              <div
                key={l.uid}
                className="relative rounded-lg border border-border bg-panel2 px-3 py-2 pr-24"
              >
                {/* Cluster en haut à droite de la card : monter/descendre,
                    masquer, supprimer — la croix à sa place habituelle dans
                    l'app.
                    ⚠️ **L'ordre de l'équipe n'est pas décoratif** : deux monstres
                    à la même vitesse de combat sont départagés par leur place
                    dans la liste, le premier joue le premier. C'est le levier
                    qu'on cherche quand un tune fait finir deux monstres à la même
                    vitesse.
                    ⚠️ Les flèches restent AFFICHÉES aux extrémités, désactivées :
                    un bouton qui disparaît selon les données fait sauter le
                    cluster d'une card à l'autre. */}
                <div className="absolute right-1 top-1 flex items-center gap-0.5">
                  <BoutonIcone
                    taille="serre"
                    disabled={index === 0}
                    onClick={() => onDeplacer(l.uid, -1)}
                    libelle={
                      index === 0
                        ? `${l.monster.name} joue déjà en premier à vitesse égale`
                        : `Monter ${l.monster.name} : à vitesse égale, il jouera avant`
                    }
                    icone={<ChevronUp size={13} />}
                  />
                  <BoutonIcone
                    taille="serre"
                    disabled={index === lignes.length - 1}
                    onClick={() => onDeplacer(l.uid, 1)}
                    libelle={
                      index === lignes.length - 1
                        ? `${l.monster.name} joue déjà en dernier à vitesse égale`
                        : `Descendre ${l.monster.name} : à vitesse égale, il jouera après`
                    }
                    icone={<ChevronDown size={13} />}
                  />
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
                  {/* ⚠️ **UNE SEULE RANGÉE**, portrait compris. Le nom et les
                      trois réglages tenaient sur deux lignes empilées alors que
                      la card est large : l'en-tête laissait toute sa droite vide
                      et coûtait 44 px par monstre, soit une ligne du tableau de
                      ticks par card. `flex-wrap` rend l'empilement au format
                      étroit — le mobile retrouve exactement la mise en page
                      d'avant, il n'y perd rien.
                      ⚠️ `items-end` : tout s'aligne sur le BAS des champs. Les
                      libellés des réglages sont au-dessus de leur champ, le nom
                      n'en a pas — les aligner par le haut décalerait le nom d'une
                      ligne au-dessus du portrait. */}
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <MonsterAvatar monster={l.monster} size={30} />
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{l.monster.name}</span>
                          {l.reference && (
                            <span
                              className="flex-none rounded border border-border px-1 text-micro font-bold uppercase tracking-wide text-ink-dim"
                              title="Adversaire de référence : copie de ton monstre le plus rapide au moment de l'analyse. Changer de deck l'arrête — il faut relancer l'analyse. Un réglage à la main en fait un adversaire ordinaire."
                            >
                              réf
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-micro leading-tight text-ink-dim">
                          base {l.monster.stats.speed ?? '—'}
                        </div>
                      </div>
                    </div>
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
                    {/* ⚠️ Set RAPIDITÉ : ses 25 % entrent dans la somme des
                        pourcentages alors que la « SPD runes » les porte déjà à
                        plat — d'où un point d'écart sur la vitesse de combat, et
                        un point suffit à rater un tick. */}
                    <label className="flex flex-col gap-0.5">
                      <span className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer">
                        Set
                      </span>
                      {/* ⚠️ **L'ICÔNE DU SET, pas le mot.** C'est comme ça qu'un
                          joueur reconnaît Rapidité — instantanément, comme dans
                          le jeu et comme partout ailleurs dans l'app (filtre de
                          sets, choix de combo). Le mot « Swift » demandait de
                          lire là où un dessin suffit, et prenait trois fois la
                          largeur sur une rangée qu'on cherche justement à
                          resserrer. Le libellé de la colonne (« Set ») reste
                          au-dessus, et l'infobulle dit ce que ça change. */}
                      <Bouton
                        taille="sm"
                        actif={!!l.swift}
                        onClick={() => onSwift(l.uid)}
                        icone={<RuneIcon setKey="swift" size={16} filter={runeSetIconFilter(!!l.swift)} />}
                        aria-label={`Set Rapidité porté par ${l.monster.name}`}
                        title="Le monstre porte le set Rapidité (VIT +25 %) — sa vitesse de combat se calcule alors autrement (d'un point près)."
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span
                        className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer"
                        title="Bonus d'artéfact « Effet aug. VIT » — s'ajoute au buff de vitesse quand il est actif. Repris tel quel d'un deck importé ou de l'adversaire de référence."
                      >
                        SPD buff effect
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
                    {/* ⚠️ La vitesse de combat est le CHIFFRE de la card : elle
                        garde sa taille et sa place à droite. On gagne de la
                        hauteur en resserrant ce qui l'entoure, pas en rendant
                        illisible ce qu'on vient lire. */}
                    <div className="ml-auto text-right">
                      <div className={`font-mono text-lg font-black leading-none ${adv ? 'text-bad' : 'text-ink'}`}>
                        {combat ?? '—'}
                      </div>
                      <div className="text-micro uppercase tracking-wide text-ink-dimmer">combat</div>
                    </div>
                  </div>

                  {/* Passif de vitesse — une RANGÉE à part, sous les réglages :
                      c'est une propriété du monstre, pas une saisie de plus.
                      ⚠️ Le bouton est TOUJOURS là dès qu'un passif touche la
                      vitesse : on doit pouvoir l'appliquer, ou l'écarter pour
                      voir ce que vaut le tune sans lui. */}
                  {passif && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded border border-border-soft bg-panel px-2 py-1">
                      <Bouton
                        taille="sm"
                        icone={<Zap size={12} />}
                        libelle="Passif"
                        actif={(!!passif.gain || !!passif.amplifieBuff) && passifActif}
                        disabled={!passif.gain && !passif.amplifieBuff}
                        title={
                          passif.gain
                            ? `${passif.nom} — ${passif.texte}`
                            : `${passif.nom} — son passif touche la vitesse, mais aucune valeur n'est connue : à poser à la main dans les grilles. ${passif.texte}`
                        }
                        onClick={() => onPassif(l.uid)}
                      />
                      {passif.amplifieBuff && (
                        <span className="font-mono text-micro text-ink-dim">
                          +{passif.amplifieBuff.valeur} % d'effet de buff
                          {passif.amplifieBuff.equipe ? " sur l'équipe" : ' sur lui'}
                        </span>
                      )}
                      {passif.gain ? (
                        <>
                          <span className="font-mono text-micro text-ink-dim">
                            +{passif.gain.valeur}
                            {passif.gain.pourcent ? ' %' : ''}
                            {passif.gain.parCumul ? ' ×' : ''}
                          </span>
                          {passif.gain.parCumul && passifActif && (
                            <NumberField
                              value={l.cumulsPassif ?? null}
                              onChange={(v) => onCumuls(l.uid, v)}
                              min={0}
                              max={99}
                              allowEmpty
                              width="w-12"
                              placeholder="0"
                              ariaLabel={`Déclenchements du passif de ${l.monster.name}`}
                            />
                          )}
                          <span
                            className={`ml-auto font-mono text-micro font-bold ${
                              gainPassif > 0 ? 'text-accent' : 'text-ink-dimmer'
                            }`}
                          >
                            {gainPassif > 0 ? `+${gainPassif} VIT` : '—'}
                          </span>
                        </>
                      ) : passif.amplifieBuff ? null : (
                        <span className="min-w-0 flex-1 text-micro leading-snug text-warn">
                          valeur inconnue — à poser à la main dans les grilles
                        </span>
                      )}
                    </div>
                  )}

                  {/* ⚠️ Le gain de barre retenu suppose la compétence MONTÉE
                      (Tailwind de Bernard : 30 % au niveau 1, 45 % maxé). On le
                      dit à l'écran : autrement on règle sa vitesse sur un gain
                      qu'on n'a pas encore. */}
                  {kit.atbSkillUp > 0 && (
                    <p className="mt-1.5 text-micro leading-snug text-warn">
                      ⚠ « {kit.atbCompetence} » compte MAXÉE : {kit.atb} % de barre, dont +{kit.atbSkillUp} % de
                      skill-up — sans les skill-up, {kit.atbNiveau1} %.
                    </p>
                  )}
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
        {decks && onImporterDeck && <ImportDeck decks={decks} onImporter={onImporterDeck} adv={adv} />}
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
    // ⚠️ `undefined` (case vide, la compétence décide) et `0` (compétence
    // annulée) sont DEUX états distincts : les confondre effaçait l'annulation.
    const vals = lignes.filter((l) => l.camp === camp).map((l) => l[champ][tick]);
    if (vals.length === 0) return null;
    return vals.every((v) => v === vals[0]) ? (vals[0] ?? null) : null;
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
      <div className="mx-auto flex w-[86px] items-center gap-1">
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
          boxWidth="w-14"
          suffix="%"
          placeholder="·"
          // Un buff est un gain, un ralenti une perte : même lecture que la
          // grille des barres.
          ton={value == null || value === 0 ? 'neutre' : value > 0 ? 'good' : 'bad'}
          ariaLabel={`${aria} — valeur`}
        />
      </div>
    ) : (
      // Boost d'ATB : positif pour remplir, négatif pour vider (la barre ne
      // descend jamais sous 0, garanti par la simulation). Bornes ±100.
      //
      // ⚠️ La cellule porte le TON de sa valeur : une grille mêle des gains et
      // des pertes, et le signe seul — en mono 12 px, au milieu de quarante
      // colonnes — ne saute pas aux yeux.
      <NumberField
        sansBoutons
        value={value}
        onChange={onChange}
        allowEmpty
        min={-100}
        max={100}
        // ⚠️ Élargi d'un cran avec le suffixe : « −100 % » doit tenir sans que
        // le champ ne rétrécisse le chiffre. La colonne fait 92 px, on y est.
        boxWidth="w-16"
        suffix="%"
        placeholder="·"
        ton={value == null || value === 0 ? 'neutre' : value > 0 ? 'good' : 'bad'}
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
      {/* ⚠️ Même arrondi intérieur qu'en haut du panneau : la colonne des noms a
          un fond SOLIDE et c'est elle qui touche le coin bas-gauche de la card.
          Sans ça, le coin redevient carré sous l'arrondi du contour. */}
      <div
        className="overflow-x-auto rounded-b-lg-inner"
        ref={refConteneur}
        onScroll={onScrollSync}
      >
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
                    <th
                      className={`sticky left-0 z-[2] border-r border-border-soft px-3 py-1.5 text-left ${
                        adv ? 'bg-bad-soft' : 'bg-good-soft'
                      }`}
                    >
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${adv ? 'text-bad' : 'text-good'}`}>
                        <span className={`h-2 w-2 rounded-full ${adv ? 'bg-bad' : 'bg-good'}`} />
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
                      {/* Même repère que dans le tableau des barres : la colonne
                          collante dit à quel camp la ligne appartient. */}
                      <th
                        className={`sticky left-0 z-[2] border-r border-border-soft px-3 py-1.5 text-left font-normal ${
                          adv ? 'bg-bad-soft' : 'bg-good-soft'
                        }`}
                      >
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

/* ------------------------------------------------------- Choix du sort --- */

// Choisir le sort qu'un monstre lance, AVEC son icône — un joueur reconnaît une
// compétence à son icône avant d'en lire le nom.
//
// ⚠️ Pas un `Selecteur` : un `<select>` natif ne montre que du texte. D'où la
// même grammaire que l'import de deck (Bouton + Flottant + `Option`), qui est
// déjà celle de l'app pour une liste ancrée à ce qui l'ouvre.
function ChoixSort({
  sorts,
  valeur,
  onChoisir,
  prefixe,
  nomMonstre,
}: {
  sorts: SortVitesse[];
  // '' = aucun sort, sinon le nom du sort lancé.
  valeur: string;
  onChoisir: (v: string) => void;
  prefixe?: string;
  nomMonstre: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

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

  const choisi = valeur === '' ? null : (sorts.find((x) => x.nom === valeur) ?? null);
  // ⚠️ « Sort détecté » ne veut rien dire quand RIEN n'a été détecté : ce qui
  // compte, c'est ce que le monstre lance — et il ne lance rien.
  const libelle = choisi?.nom ?? 'Aucun sort';

  const icone = (x: SortVitesse | null, taille: number) =>
    x?.icone ? (
      <img src={x.icone} alt="" width={taille} height={taille} className="rounded-sm" loading="lazy" />
    ) : (
      <Sparkles size={taille} className="text-ink-dimmer" />
    );

  return (
    <div ref={ref} className="relative">
      <Bouton
        taille="sm"
        icone={icone(choisi, 16)}
        libelle={`${prefixe ?? ''}${libelle}`}
        aria-expanded={open}
        title={choisi ? libelleSort(choisi) : `Sort lancé par ${nomMonstre}`}
        onClick={() => setOpen((v) => !v)}
      />
      {/* ⚠️ **FlottantAuto**, pas `Flottant` : ce menu est ancré à un bouton qui
          se promène dans une rangée — au bout d'une ligne, un flottant posé
          toujours du même côté sortait de la page par la droite. Celui-ci mesure
          la place autour de son ancre et choisit son côté. */}
      <FlottantAuto
        ouvert={open}
        ancre={ref}
        largeur={290}
        hauteur={320}
        rembourrage="aucun"
        className="max-h-[320px] overflow-y-auto"
      >
        <div role="listbox" aria-label={`Sort lancé par ${nomMonstre}`}>
          {/* ⚠️ Des RANGÉES à plat, pas des cartes : `Option` porte son propre
              cadre arrondi, fait pour un choix empilé dans un dialogue. Dans une
              surface flottante, l'app pose des rangées qui touchent les bords —
              même grammaire que l'import de deck et la recherche de monstre. */}
          <Rangee
            icone={<Sparkles size={22} className="text-ink-dimmer" />}
            titre="Aucun sort"
            detail="Il joue, mais rien qui touche la vitesse"
            actif={valeur === ''}
            onClick={() => {
              onChoisir('');
              setOpen(false);
            }}
          />
          {sorts.map((x) => (
            <Rangee
              key={x.nom}
              icone={icone(x, 22)}
              titre={`${x.slot ? `S${x.slot} · ` : ''}${x.nom}`}
              detail={libelleSort(x).split(' — ')[1]}
              actif={valeur === x.nom}
              onClick={() => {
                onChoisir(x.nom);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </FlottantAuto>
    </div>
  );
}

/* ------------------------------------------------------- Import deck ----- */

// Une rangée de liste flottante : icône, titre, et ce que ça fait en dessous.
// Sans cadre ni coins arrondis — c'est la surface flottante qui porte la forme,
// les rangées la remplissent bord à bord.
function Rangee({
  icone,
  titre,
  detail,
  actif,
  onClick,
}: {
  icone: React.ReactNode;
  titre: string;
  detail?: string;
  actif?: boolean;
  onClick: () => void;
}) {
  return (
    <ZoneCliquable
      role="option"
      aria-selected={actif}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 border-b border-border-soft px-3 py-2 text-left last:border-b-0 hoverable:bg-accent-soft ${
        actif ? 'bg-accent-soft' : ''
      }`}
    >
      <span className="flex-none">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${actif ? 'font-semibold text-accent' : 'font-medium'}`}>
          {titre}
        </span>
        {detail && <span className="block truncate text-micro text-ink-dim">{detail}</span>}
      </span>
    </ZoneCliquable>
  );
}

const LIBELLE_SOURCE: Record<DeckDispo['source'], string> = {
  defense: 'Défense',
  offense: 'Offense',
};

// Reprendre une équipe de siège telle quelle plutôt que de retaper trois
// monstres et trois vitesses de runes. Le bouton reste TOUJOURS affiché, même
// sans compte chargé : désactivé, il dit que la possibilité existe (voir
// spec/shared/design.md).
function ImportDeck({
  decks,
  onImporter,
  adv,
}: {
  decks: DeckDispo[];
  onImporter: (team: SiegeTeam) => void;
  adv: boolean;
}) {
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
            : adv
              ? 'Reprendre une de tes équipes de siège comme composition adverse — elle REMPLACE ce qui est en face'
              : 'Reprendre une de tes équipes de siège dans ton équipe — elle REMPLACE ta composition actuelle'
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
