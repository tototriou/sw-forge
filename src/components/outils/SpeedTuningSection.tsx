import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Plus, Timer, Users, Swords, X, Zap, Gauge, Eye, EyeOff, Download, Check, Scissors, Play, ListOrdered, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { Monster, SiegeTeam } from '../../types';
import { combatSpeed, runeSpeedForTarget, SPEED_LEADS, SIEGE_TICKS } from '../../lib/speed';
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
import { kitVitesse, sortsVitesse, KitVitesse, SortVitesse, KIT_VIDE } from '../../lib/speedTuneKit';
import { passifsVitesse, pointsDeGain, PassifVitesse } from '../../lib/speedTunePassif';
import { chargerDetail } from '../../lib/monsterSkills';
import { teamSummary } from '../../lib/recoFromSiege';
import { formesJouables } from '../../lib/monsterForms';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useStickyState } from '../../hooks/useStickyState';
import MonsterAvatar from '../MonsterAvatar';
import {
  Bouton,
  Champ,
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
  // Le monstre porte le set RAPIDITÉ (Swift). ⚠️ Ce n'est pas un détail : ses
  // 25 % entrent dans la somme des pourcentages (totem + lead + swift) alors que
  // la « SPD runes » saisie les porte déjà à plat — d'où un écart d'UN point sur
  // la vitesse de combat, et un point suffit à rater un tick.
  swift?: boolean;
  // Combien de fois le gain de son PASSIF s'est déclenché (buffs portés, tours
  // adverses passés, attaques…). ⚠️ La VALEUR du gain est lue dans son kit ; ce
  // qui dépend du combat, c'est le nombre de fois — c'est donc la seule chose
  // qu'on demande.
  cumulsPassif?: number | null;
  // Le gain du passif est-il pris en compte ? Actif par défaut (`undefined`) :
  // un passif est toujours en vigueur en jeu.
  passifActif?: boolean;
  // Adversaire de RÉFÉRENCE posé par l'analyse automatique (copie du monstre le
  // plus rapide de l'équipe au moment du clic).
  //
  // ⚠️ **L'analyse est un INSTANTANÉ, pas un abonnement.** Changer de deck
  // l'ARRÊTE : la référence est retirée et il faut recliquer sur « Lancer
  // l'analyse » — un adversaire copié d'une équipe qu'on vient de remplacer ne
  // veut plus rien dire, et le verdict aurait l'air juste sans l'être.
  //
  // Le premier réglage à la main retire aussi le drapeau : la ligne devient un
  // adversaire ordinaire, qu'on garde tel quel.
  reference?: boolean;
  // Masqué : gardé dans la liste (avec sa config) mais retiré des calculs et des
  // tableaux — pour tester une composition sans perdre le réglage d'un monstre.
  masque: boolean;
}

type ChampMod = 'atbMod' | 'speedMod';

const uidDe = (camp: Camp, id: string) => `${camp}:${id}`;

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
  if (e.atbEnnemi) bouts.push(`−${e.atbEnnemi} % barre adv${e.atbEnnemiTous ? ' (tous)' : ''}`);
  if (e.buffEquipe) bouts.push('buff VIT équipe');
  if (e.buffSoi) bouts.push('buff VIT sur soi');
  if (e.ralenti) bouts.push(`ralenti adv${e.ralentiTous ? ' (tous)' : ''}`);
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

export default function SpeedTuningSection({ allMonsters, siegeDefenseTeams, siegeOffenseTeams }: Props) {
  const [lignes, setLignes] = useStickyState<Ligne[]>('speedTune.lignes', []);
  const [leadAllie, setLeadAllie] = useStickyState<number>('speedTune.leadAllie', 0);
  const [leadEnnemi, setLeadEnnemi] = useStickyState<number>('speedTune.leadEnnemi', 0);

  const jouables = useMemo(() => formesJouables(allMonsters), [allMonsters]);

  // Ce que le KIT de chaque monstre pose sur son camp (barre d'attaque de zone,
  // buff de vitesse de zone), lu dans les compétences pré-générées. Sert à
  // pré-remplir les deux champs de la card — l'utilisateur n'a pas à aller
  // chercher lui-même ce que fait le monstre — et à dire d'où vient la valeur.
  const [kits, setKits] = useState<Map<number, KitVitesse>>(new Map());
  // Les sorts de zone de chaque monstre (analyse poussée) : même lecture, même
  // chargement — on ne repasse pas deux fois sur les mêmes fichiers.
  const [sorts, setSorts] = useState<Map<number, SortVitesse[]>>(new Map());
  const [passifs, setPassifs] = useState<Map<number, PassifVitesse[]>>(new Map());

  // Analyse poussée : l'ordre des tours VOULU (uids, du premier au dernier) et,
  // par monstre, le sort qu'il lance à son tour ('' = aucun ; absent = celui que
  // la lecture du kit a retenu).
  // ⚠️ L'analyse AUTOMATIQUE, c'est TOUT ce que l'outil fait de lui-même, et la
  // couper coupe tout : l'adversaire de référence posé en face, les compétences
  // lues dans les kits qui remplissent les deux grilles, et **l'analyse poussée**
  // (ordre imposé + sort désigné), qui en est un raffinement et non un mode à
  // part. Coupée, la simulation n'obéit plus qu'à ce qu'on a saisi — c'est le
  // but : « je regarde ce que ça donne, puis je fais ce que je veux ».
  //
  // ⚠️ **L'analyse ÉCRIT, elle ne recouvre pas.** Elle lit les kits une fois, pose
  // ce qu'ils donnent DANS les grilles — exactement comme si on les avait
  // remplies à la main — et s'arrête là. Ensuite tout est modifiable sans que
  // rien ne repasse dessus. C'est ce qui remplace l'ancien « mode » vivant, où
  // les valeurs affichées n'existaient nulle part et se recalculaient sans
  // arrêt : impossible d'y toucher, et impossible de savoir ce qui venait de
  // l'outil ou de soi.
  //
  // Ce drapeau ne dit qu'une chose : une analyse a déjà été appliquée. Il sert à
  // la REJOUER quand on change un sort — le seul changement qui la rend fausse.
  const [auto, setAuto] = useStickyState<boolean>('speedTune.auto', false);
  const [poussee, setPoussee] = useStickyState<boolean>('speedTune.poussee', false);
  const [ordreVoulu, setOrdreVoulu] = useStickyState<string[]>('speedTune.ordre', []);
  // ⚠️ Tant qu'on n'a rien rangé à la main, l'ordre voulu SUIT les vitesses :
  // c'est le point de départ évident (« voilà l'ordre que tu as aujourd'hui »),
  // et il se recale quand une vitesse change. Le premier ▲▼ le fige — à partir
  // de là c'est un choix, et le réécrire serait une perte.
  const [ordreRange, setOrdreRange] = useStickyState<boolean>('speedTune.ordreRange', false);
  const [sortChoisi, setSortChoisi] = useStickyState<Record<string, string>>('speedTune.sorts', {});
  // Le sort du SECOND tour, pour ceux dont la compétence leur rend leur tour
  // (Kroa) : on ne devine pas ce qu'ils lancent ensuite, c'est à désigner.
  const [sortChoisi2, setSortChoisi2] = useStickyState<Record<string, string>>('speedTune.sorts2', {});

  // ⚠️ Rien n'est écrit dans les lignes : ce qu'un monstre fait se DÉDUIT de son
  // kit à l'affichage. Une valeur recopiée dans l'état aurait vieilli au premier
  // changement de sort, et il aurait fallu la protéger de l'écrasement.
  useEffect(() => {
    const ids = [
      ...new Set(
        lignes.map((l) => l.monster.com2usId).filter((id): id is number => id != null && !kits.has(id))
      ),
    ];
    if (ids.length === 0) return;
    let annule = false;
    Promise.all(
      ids.map(
        (id) => chargerDetail(id).then((d) => [id, kitVitesse(d), sortsVitesse(d), passifsVitesse(d)] as const)
      )
    ).then((paires) => {
      if (annule) return;
      setKits((prev) => new Map([...prev, ...paires.map(([id, kit]) => [id, kit] as const)]));
      setSorts((prev) => new Map([...prev, ...paires.map(([id, , liste]) => [id, liste] as const)]));
      setPassifs((prev) => new Map([...prev, ...paires.map(([id, , , ps]) => [id, ps] as const)]));
    });
    return () => {
      annule = true;
    };
  }, [lignes, kits]);
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
      {
        uid,
        monster,
        runeSpeed: null,
        camp,
        atbMod: {},
        speedMod: {},
        artefactBuff: null,
        masque: false,
      },
    ]);
  }
  // Import d'un deck de siège dans un camp : le deck REMPLACE la composition de
  // ce camp — un deck est une équipe, pas une liste de monstres à empiler. Sans
  // ça, importer une deuxième défense entassait six monstres du même côté.
  //
  // ⚠️ **Ce qui était dans ce camp est perdu** (vitesses corrigées à la main,
  // modificateurs, compétences retouchées). C'est le prix du geste demandé, et
  // il ne touche QUE le camp visé : l'autre garde tout. Le deck reste dans
  // Siège, réimportable à volonté.
  //
  // Les deux camps y ont droit : une défense de siège se joue aussi bien depuis
  // l'autre bord, et c'est même là qu'on la connaît le mieux (on l'a affrontée).
  function importerDeck(camp: Camp, team: SiegeTeam) {
    const { monstres, lead } = deckPourSpeedTune(team, monsterById);
    if (monstres.length === 0) return;
    // ⚠️ Changer de deck COUPE l'analyse automatique. Elle portait sur la compo
    // précédente : la laisser tourner sur la nouvelle donnerait un verdict qui a
    // l'air juste sans l'être, et remplirait les grilles avec les kits d'une
    // équipe qu'on vient de remplacer. On relance quand on veut.
    setAuto(false);
    setPoussee(false);
    setLignes((prev) => [
      // ⚠️ La référence saute AUSSI quand on importe dans l'autre camp : elle
      // copiait une équipe qui vient de changer.
      ...prev.filter((l) => l.camp !== camp && !l.reference),
      ...monstres.map(({ monster, runeSpeed, artefactBuff, swift }) => ({
        uid: uidDe(camp, String(monster.id)),
        monster,
        runeSpeed,
        camp,
        atbMod: {},
        speedMod: {},
        artefactBuff,
        swift,
        // Les compétences se relisent dans le kit (voir l'effet plus haut).
        masque: false,
      })),
    ]);
    // Le lead du leader du deck, s'il vaut pour tout le camp (voir speedTuneDeck.ts).
    if (lead != null) (camp === 'allie' ? setLeadAllie : setLeadEnnemi)(lead);
  }

  // Analyse automatique : quand « En face » est VIDE, on n'a rien à devancer —
  // l'outil se donne alors un adversaire de référence, la copie du monstre le
  // plus rapide de l'équipe (même lead, même vitesse de runes). Autrement dit :
  // « est-ce que toute mon équipe joue avant un monstre aussi rapide que mon
  // plus rapide ? » — le point de départ d'un speed tune quand on ne sait pas
  // encore qui on affronte. Le monstre est AJOUTÉ en face, donc réglable et
  // retirable comme n'importe quel autre.
  // Le monstre le plus rapide de l'équipe (visible, vitesse connue) : le modèle
  // de l'adversaire de référence.
  function plusRapideAllie(): Ligne | null {
    const candidats = lignesVisibles
      .filter((l) => l.camp === 'allie')
      .map((l) => ({ l, combat: combatDe(l) }))
      .filter((x): x is { l: Ligne; combat: number } => x.combat != null && x.combat > 0)
      .sort((a, b) => b.combat - a.combat);
    return candidats[0]?.l ?? null;
  }

  // La ligne « adversaire de référence » construite à partir d'un modèle allié.
  function ligneReference(modele: Ligne): Ligne {
    return {
      uid: uidDe('ennemi', String(modele.monster.id)),
      monster: modele.monster,
      runeSpeed: modele.runeSpeed,
      camp: 'ennemi',
      atbMod: {},
      speedMod: {},
      artefactBuff: modele.artefactBuff,
      swift: modele.swift,
      cumulsPassif: modele.cumulsPassif,
      passifActif: modele.passifActif,
      reference: true,
      masque: false,
    };
  }

  function analyseAuto() {
    const modele = plusRapideAllie();
    if (!modele) return;
    setLeadEnnemi(leadAllie); // même lead : on compare des vitesses comparables
    const ref = ligneReference(modele);
    setLignes((prev) => [...prev.filter((l) => !l.reference && l.uid !== ref.uid), ref]);
  }

  function retirer(uid: string) {
    setLignes((prev) => prev.filter((l) => l.uid !== uid));
  }
  function basculerMasque(uid: string) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...l, masque: !l.masque } : l)));
  }
  // ⚠️ Toute saisie sur une ligne lui retire le drapeau « référence » : à partir
  // du moment où on la règle, elle n'est plus une copie qui suit l'équipe mais un
  // adversaire à part entière — et l'écraser au prochain changement serait une
  // perte de travail silencieuse.
  const aLaMain = (l: Ligne): Ligne => (l.reference ? { ...l, reference: false } : l);

  function setRuneSpeed(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), runeSpeed: v } : l)));
  }
  function basculerPassif(uid: string) {
    setLignes((prev) =>
      prev.map((l) => (l.uid === uid ? { ...aLaMain(l), passifActif: l.passifActif === false } : l))
    );
  }
  function setCumuls(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), cumulsPassif: v } : l)));
  }
  function basculerSwift(uid: string) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), swift: !l.swift } : l)));
  }
  function setArtefact(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), artefactBuff: v } : l)));
  }

  // Écrit une valeur dans la grille `champ`, pour un tick donné.
  //
  // ⚠️ **0 est une VALEUR, pas un effacement.** Une case à 0 annule ce que la
  // compétence pose à ce tick — c'est tout l'intérêt : écarter un effet
  // aléatoire (réduction d'ATB à 70 % de chances) dont un tune ne doit pas
  // dépendre. Seule une case VIDE (`null`) rend la main à la compétence.
  const majMap = (m: ModParTick, tick: number, v: number | null): ModParTick => {
    const next = { ...m };
    if (v == null) delete next[tick];
    else next[tick] = v;
    return next;
  };
  function setMod(champ: ChampMod, uid: string, tick: number, v: number | null) {
    setLignes((prev) =>
      prev.map((l) => (l.uid === uid ? { ...aLaMain(l), [champ]: majMap(l[champ], tick, v) } : l))
    );
  }
  function setModEquipe(champ: ChampMod, camp: Camp, tick: number, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.camp === camp ? { ...l, [champ]: majMap(l[champ], tick, v) } : l)));
  }

  const leadDe = (camp: Camp) => (camp === 'allie' ? leadAllie : leadEnnemi);

  // Vitesse de combat de base (base + runes + totem 15 % + lead) via speed.ts.
  // `null` si la base est inconnue. Les buffs de vitesse sont appliqués PAR TICK
  // dans la simulation, pas ici.
  // Le passif de vitesse du monstre (le premier qui en porte un).
  //
  // ⚠️ **Ce n'est PAS une déduction de l'analyse, mais un réglage de la card** —
  // comme le set Swift. Le bouton est donc là dès que le monstre a un passif qui
  // touche la vitesse, analyse lancée ou non : c'est une propriété du monstre,
  // pas une hypothèse sur le combat.
  const passifDe = (l: Ligne): PassifVitesse | null => {
    if (l.monster.com2usId == null) return null;
    return (passifs.get(l.monster.com2usId) ?? []).find((p) => p.gain || p.inconnu) ?? null;
  };

  // Actif par défaut : un passif est toujours en vigueur en jeu. On peut le
  // couper pour voir ce que vaut le tune sans lui.
  const passifActifDe = (l: Ligne): boolean => l.passifActif !== false;

  const gainPassifDe = (l: Ligne): number => {
    const p = passifDe(l);
    if (!p?.gain || !passifActifDe(l)) return 0;
    return pointsDeGain(p.gain, l.monster.stats.speed, l.cumulsPassif ?? 0);
  };

  const combatDe = (l: Ligne): number | null => {
    const base = combatSpeed(l.monster.stats.speed, l.runeSpeed, leadDe(l.camp), l.swift ?? false);
    return base == null ? null : base + gainPassifDe(l);
  };

  // Monstres visibles (non masqués) : seuls eux entrent dans les calculs et les
  // tableaux. Les masqués restent affichés dans leur camp pour être réaffichés.
  const lignesVisibles = useMemo(() => lignes.filter((l) => !l.masque), [lignes]);

  // Le sort qu'un monstre lance à son tour. Hors analyse poussée (ou sans choix
  // explicite), c'est celui que la lecture du kit a retenu ; en analyse poussée,
  // celui qu'on lui a désigné — '' voulant dire « il ne lance rien de tout ça ».
  const sortsDe = (l: Ligne): SortVitesse[] =>
    (l.monster.com2usId != null ? sorts.get(l.monster.com2usId) : null) ?? [];

  // Le sort effectivement lancé au premier tour. Hors analyse poussée, c'est
  // celui que la lecture du kit a retenu ; en analyse poussée, celui qu'on a
  // désigné — '' voulant dire « il ne lance rien de tout ça ».
  // ⚠️ **Plus rien n'est deviné à la volée** : le sort lancé est celui qui a été
  // ÉCRIT (par l'analyse, ou à la main dans l'ordre des sorts). Sans écriture,
  // le monstre ne lance rien — l'outil ne suppose pas à la place de qui règle.
  const sortActif = (l: Ligne, choix: Record<string, string> = sortChoisi): SortVitesse | null => {
    const nom = choix[l.uid];
    if (!nom) return null;
    return sortsDe(l).find((x) => x.nom === nom) ?? null;
  };

  // Ce que la lecture du kit a retenu pour ce monstre — le « Sort détecté ».
  const sortAuto = (l: Ligne): SortVitesse | null => {
    const kit = l.monster.com2usId != null ? kits.get(l.monster.com2usId) : null;
    const nom = kit?.atbCompetence ?? kit?.buffCompetence ?? null;
    return sortsDe(l).find((x) => x.nom === nom) ?? null;
  };

  const sortSecond = (l: Ligne): SortVitesse | null =>
    sortsDe(l).find((x) => x.nom === sortChoisi2[l.uid]) ?? null;

  // Entrée du moteur : les monstres visibles dont la vitesse est connue.
  // Partagée par la simulation ET par le diagnostic de chaîne.
  const tune = useMemo(() => {
    const out: TuneMonstre[] = [];
    for (const l of lignesVisibles) {
      const c = combatDe(l);
      const actif = sortActif(l);
      if (c != null && c > 0)
        out.push({
          id: l.uid,
          combat: c,
          camp: l.camp,
          atbMod: l.atbMod,
          speedMod: l.speedMod,
          artefactBuff: l.artefactBuff ?? 0,
          // Le rechargement voyage avec l'effet : c'est lui qui dit à quelle
          // fréquence le sort peut repartir (voir speedTune.ts).
          sort: actif ? { ...actif.effet, cooldown: actif.cooldown } : undefined,
          rejoue: actif?.rejoue ?? false,
          sort2: actif?.rejoue
            ? (() => {
                const second = sortSecond(l);
                return second ? { ...second.effet, cooldown: second.cooldown } : undefined;
              })()
            : undefined,
        });
    }
    return out;
  }, [lignes, leadAllie, leadEnnemi, auto, poussee, sortChoisi, sortChoisi2, sorts, kits, passifs]);

  // Simulation multi-tours (40 ticks) avec les modificateurs.
  const sim = useMemo(() => simuler(tune, HORIZON_TICKS), [tune]);

  // ⚠️ La simulation de l'ANALYSE, celle qui fait parler les kits. Elle ne sert
  // qu'à produire ce qu'on va ÉCRIRE dans les grilles — elle n'alimente ni les
  // tableaux ni le verdict, qui obéissent, eux, à l'état de la page.
  function simulerAvecSorts(choix: Record<string, string> = sortChoisi) {
    const avec: TuneMonstre[] = [];
    for (const l of lignesVisibles) {
      const c = combatDe(l);
      if (c == null || c <= 0) continue;
      const actif = sortActif(l, choix);
      const second = sortSecond(l);
      avec.push({
        id: l.uid,
        combat: c,
        camp: l.camp,
        artefactBuff: l.artefactBuff ?? 0,
        sort: actif ? { ...actif.effet, cooldown: actif.cooldown } : undefined,
        rejoue: actif?.rejoue ?? false,
        sort2: actif?.rejoue && second ? { ...second.effet, cooldown: second.cooldown } : undefined,
      });
    }
    return simuler(avec, HORIZON_TICKS);
  }

  // L'ANALYSE : elle lit les kits, puis POSE le résultat dans les grilles, comme
  // si on les avait remplies à la main. Après quoi elle ne repasse plus.
  //
  // ⚠️ **Un effet de sort est écrit au tick SUIVANT celui où il est lancé.** Dans
  // le moteur, ce qu'une compétence pose arrive APRÈS l'arbitrage du tick (le
  // lanceur vient de prendre son tour) ; une case de grille, elle, est posée
  // AVANT. L'écrire sur le même tick aurait laissé un allié boosté voler le tour
  // du lanceur. Décalé d'un tick, il agit exactement au moment où il comptait.
  function analyser() {
    // ⚠️ **L'analyse remplit AUSSI l'ordre des sorts** : elle y pose l'ordre que
    // les vitesses produisent et, pour chacun, le sort que son kit a retenu.
    // Après quoi ces choix sont des choix comme les autres — c'est le même
    // principe que les grilles : l'outil écrit, l'utilisateur corrige.
    const choix: Record<string, string> = { ...sortChoisi };
    for (const l of lignesVisibles) {
      const detecte = sortAuto(l);
      if (detecte) choix[l.uid] = detecte.nom;
      else delete choix[l.uid];
    }
    setSortChoisi(choix);
    setPoussee(true);
    if (!ordreRange) {
      const parVitesse = premiers.filter((a) => a.camp === 'allie').map((a) => a.id);
      const allies = lignesVisibles.filter((l) => l.camp === 'allie').map((l) => l.uid);
      setOrdreVoulu([
        ...parVitesse.filter((id) => allies.includes(id)),
        ...allies.filter((id) => !parVitesse.includes(id)),
      ]);
    }
    // Ce qu'on vient d'écrire ne doit pas déclencher une relance en boucle.
    premiereSignature.current = JSON.stringify([choix, sortChoisi2]);

    const resultat = simulerAvecSorts(choix);
    const parId = new Map(resultat.lignes.map((x) => [x.id, x]));
    setAuto(true);
    setLignes((prev) =>
      prev.map((l) => {
        const sim = parId.get(l.uid);
        if (!sim) return l;
        const atbMod: ModParTick = {};
        for (const [tick, v] of Object.entries(sim.effetAtb)) {
          const suivant = Number(tick) + 1;
          if (v !== 0 && suivant <= HORIZON_TICKS) atbMod[suivant] = v;
        }
        const speedMod: ModParTick = {};
        for (const [tick, v] of Object.entries(sim.effetSpeed)) if (v !== 0) speedMod[Number(tick)] = v;
        return { ...l, atbMod, speedMod };
      })
    );
    // Personne en face : on pose l'adversaire de référence pour avoir un repère.
    if (!aEnnemi) analyseAuto();
  }

  // ⚠️ Le SEUL changement qui rende une analyse fausse : le sort lancé. Tout le
  // reste (vitesses, artéfacts, cases des grilles) est un réglage de
  // l'utilisateur, et l'automatisation n'y revient jamais.
  const sortsSignature = JSON.stringify([sortChoisi, sortChoisi2]);
  const premiereSignature = useRef(sortsSignature);
  useEffect(() => {
    if (!auto || premiereSignature.current === sortsSignature) {
      premiereSignature.current = sortsSignature;
      return;
    }
    premiereSignature.current = sortsSignature;
    analyser();
  }, [sortsSignature, auto]);

  // Chaîne d'ouverture : toute l'équipe joue-t-elle avant le premier adverse ?
  // Et sinon, quelle vitesse de combat faut-il à ceux qui sont coupés.
  const chaine = useMemo(() => diagnostiquerChaine(tune, HORIZON_TICKS), [tune]);
  const requis = useMemo(
    () => (chaine.ok ? [] : vitessesRequises(tune, HORIZON_TICKS)),
    [tune, chaine]
  );
  // L'AUTRE levier quand un buff de vitesse est en jeu : monter l'artéfact
  // « Effet aug. VIT », qui l'amplifie. Vide s'il n'y a rien à en attendre.
  const arteRequis = useMemo(
    () => (chaine.ok ? [] : artefactsRequis(tune, HORIZON_TICKS)),
    [tune, chaine]
  );

  // Premiers tours (ordre de tour) et numéro d'action par (monstre, tick).
  const premiers = useMemo(() => premiersTours(sim), [sim]);
  const numAction = useMemo(() => {
    const m = new Map<string, number>();
    // ⚠️ Un tour RENDU tombe au même tick que celui qui l'a déclenché : on garde
    // le premier, c'est lui que la case du tableau annonce.
    for (const a of sim.actions) {
      const cle = `${a.id}@${a.tick}`;
      if (!m.has(cle)) m.set(cle, a.ordre);
    }
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

  // L'ordre voulu suit la composition : un allié ajouté entre à la fin, un allié
  // retiré en sort. ⚠️ Il n'est PAS réordonné tout seul ensuite — c'est le choix
  // de l'utilisateur, pas un reflet de la simulation.
  const alliesVisibles = useMemo(
    () => lignesVisibles.filter((l) => l.camp === 'allie').map((l) => l.uid),
    [lignesVisibles]
  );
  useEffect(() => {
    if (!ordreRange) {
      // Ordre des vitesses : celui que la simulation produit aujourd'hui, les
      // alliés qui n'agissent pas (vitesse inconnue) à la fin.
      const parVitesse = premiers.filter((a) => a.camp === 'allie').map((a) => a.id);
      const attendu = [
        ...parVitesse.filter((id) => alliesVisibles.includes(id)),
        ...alliesVisibles.filter((id) => !parVitesse.includes(id)),
      ];
      if (attendu.join('|') !== ordreVoulu.join('|')) setOrdreVoulu(attendu);
      return;
    }
    const garde = ordreVoulu.filter((id) => alliesVisibles.includes(id));
    const manquants = alliesVisibles.filter((id) => !garde.includes(id));
    if (manquants.length === 0 && garde.length === ordreVoulu.length) return;
    setOrdreVoulu([...garde, ...manquants]);
  }, [alliesVisibles, ordreVoulu, setOrdreVoulu, ordreRange, premiers]);

  // Verdict de l'analyse poussée : l'ordre est-il tenu, et quelle FENÊTRE de
  // vitesse laisse chaque rang (un rang se rate aussi en étant trop rapide).
  const sequence = useMemo(
    () => diagnostiquerSequence(tune, ordreVoulu, HORIZON_TICKS),
    [tune, ordreVoulu]
  );
  const fenetres = useMemo(
    () => (poussee ? fenetresRequises(tune, ordreVoulu, HORIZON_TICKS) : []),
    [poussee, tune, ordreVoulu]
  );
  // Le même calcul sur l'autre levier : l'artéfact qui amplifie le buff reçu.
  const fenetresArte = useMemo(
    () => (poussee ? fenetresRequises(tune, ordreVoulu, HORIZON_TICKS, 'artefactBuff') : []),
    [poussee, tune, ordreVoulu]
  );
  const fenetreParUid = useMemo(() => new Map(fenetres.map((f) => [f.id, f])), [fenetres]);
  const fenetreArteParUid = useMemo(() => new Map(fenetresArte.map((f) => [f.id, f])), [fenetresArte]);
  const problemeParUid = useMemo(
    () => new Map(sequence.problemes.map((p) => [p.id, p])),
    [sequence]
  );

  // Ce qu'il manque à un monstre, en une pastille : les points de vitesse de
  // runes, ou — si un buff de vitesse court sur son camp — les points d'artéfact
  // « Effet aug. VIT » qui feraient la même chose. Rien d'autre.
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
  function cibleFenetre(f: Fenetre | undefined): number | null | undefined {
    if (!f) return undefined;
    if (f.min == null || f.max == null || f.min > f.max) return undefined;
    if (f.combatActuel < f.min) return f.min;
    if (f.combatActuel > f.max) return f.max;
    return null;
  }

  function choisirSort(uid: string, valeur: string) {
    setSortChoisi((prev) => {
      const next = { ...prev };
      if (valeur === '__auto') delete next[uid];
      else next[uid] = valeur;
      return next;
    });
  }

  function choisirSecond(uid: string, valeur: string) {
    setSortChoisi2((prev) => {
      const next = { ...prev };
      if (valeur === '') delete next[uid];
      else next[uid] = valeur;
      return next;
    });
  }

  function deplacer(uid: string, sens: -1 | 1) {
    setOrdreRange(true); // à partir d'ici, l'ordre est un CHOIX : il ne suit plus les vitesses
    setOrdreVoulu((prev) => {
      const i = prev.indexOf(uid);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const requisParUid = useMemo(() => new Map(requis.map((r) => [r.id, r])), [requis]);
  const arteParUid = useMemo(() => new Map(arteRequis.map((r) => [r.id, r])), [arteRequis]);
  const nomDe = (uid: string) => ligneParUid.get(uid)?.monster.name ?? '?';
  // Vitesse de runes qu'il MANQUE pour atteindre une vitesse de combat cible.
  const runesPour = (l: Ligne, combatCible: number): number | null => {
    const besoin = runeSpeedForTarget(l.monster.stats.speed, leadDe(l.camp), combatCible, false);
    return besoin == null ? null : besoin - (l.runeSpeed ?? 0);
  };

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
          onLead={setLeadEnnemi}
          lignes={lignes.filter((l) => l.camp === 'ennemi')}
          jouables={jouables}
          combatDe={combatDe}
          onAjouter={(id) => ajouter('ennemi', id)}
          onRetirer={retirer}
          onMasquer={basculerMasque}
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
          {/* ⚠️ UNE SEULE card pour tout ce que l'outil fait de lui-même : le
              verdict, ses deux boutons, et l'ordre des sorts. Ils étaient dans
              deux cadres séparés, ce qui laissait croire à deux outils — alors
              que « Cacher » les coupe ensemble. */}
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
                <Bouton
                  icone={<ListOrdered size={14} />}
                  libelle="Ordre des sorts"
                  actif={poussee}
                  disabled={!aAllie}
                  title={
                    !aAllie
                      ? "Ajoute d'abord des monstres à ton équipe."
                      : "Imposer l'ordre des tours et le sort lancé par chacun. ⚠️ Changer un sort est la SEULE chose qui relance l'analyse."
                  }
                  onClick={() => setPoussee((v) => !v)}
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
                          manque », pas un récit. */}
                      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                        {chaine.coupes.map((c) => {
                          const l = ligneParUid.get(c.id);
                          if (!l) return null;
                          const cible = requisParUid.get(c.id)?.combatRequis ?? null;
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

          {/* ⚠️ Une card À PART, pas un sous-bloc : l'analyse se LIT, l'ordre des
              sorts se RÈGLE. Ce sont deux objets, et l'analyse REMPLIT le second
              — elle y écrit l'ordre des vitesses et le sort de chacun, comme
              elle écrit dans les grilles. */}
          {poussee && (
            <section className="rounded-lg border border-border bg-panel">
              <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                Ordre des sorts
                <span className="ml-2 font-normal normal-case tracking-normal text-ink-dimmer">
                  · range tes monstres dans l'ordre voulu et dis ce que chacun lance
                </span>
              </div>
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
                                {/* Ce qu'il LANCE à son tour : la détection propose,
                                    ici on tranche (un sort du kit, ou aucun). */}
                                <ChoixSort
                                  sorts={liste}
                                  valeur={choix ?? ''}
                                  onChoisir={(v) => choisirSort(uid, v)}
                                  nomMonstre={l.monster.name}
                                />
                                {/* ⚠️ Sa compétence lui REND son tour (Kroa) : il
                                    rejoue au même tick, et lance autre chose. On ne
                                    devine pas quoi — à désigner. */}
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
            </section>
          )}

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
                              <span className="block text-micro text-ink-dim">{e.incBase.toFixed(3)} %/tick</span>
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
                              {atb == null ? '' : atb.toFixed(3)}
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
                    {/* ⚠️ Set RAPIDITÉ : ses 25 % entrent dans la somme des
                        pourcentages alors que la « SPD runes » les porte déjà à
                        plat — d'où un point d'écart sur la vitesse de combat, et
                        un point suffit à rater un tick. */}
                    <label className="flex flex-col gap-0.5">
                      <span className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer">
                        Set
                      </span>
                      <Bouton
                        taille="sm"
                        actif={!!l.swift}
                        onClick={() => onSwift(l.uid)}
                        libelle="Swift"
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
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded border border-border-soft bg-panel px-2 py-1.5">
                      <Bouton
                        taille="sm"
                        icone={<Zap size={12} />}
                        libelle="Passif"
                        actif={!!passif.gain && passifActif}
                        disabled={!passif.gain}
                        title={
                          passif.gain
                            ? `${passif.nom} — ${passif.texte}`
                            : `${passif.nom} — son passif touche la vitesse, mais aucune valeur n'est connue : à poser à la main dans les grilles. ${passif.texte}`
                        }
                        onClick={() => onPassif(l.uid)}
                      />
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
                      ) : (
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
      {open && (
        <Flottant
          rembourrage="aucun"
          largeur="w-[290px]"
          className="max-h-[320px] overflow-y-auto"
          role="listbox"
          aria-label={`Sort lancé par ${nomMonstre}`}
        >
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
        </Flottant>
      )}
    </div>
  );
}

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

/* ------------------------------------------------------- Import deck ----- */

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
