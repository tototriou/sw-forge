import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Plus, Timer, Users, Swords, X, Zap, Gauge, Eye, EyeOff, Download, Check, Scissors, Play } from 'lucide-react';
import { Monster, SiegeTeam } from '../../types';
import { combatSpeed, runeSpeedForTarget, SPEED_LEADS, SIEGE_TICKS } from '../../lib/speed';
import {
  simuler,
  premiersTours,
  speedForTick,
  diagnostiquerChaine,
  vitessesRequises,
  HORIZON_TICKS,
  Camp,
  TuneMonstre,
  ModParTick,
} from '../../lib/speedTune';
import { deckPourSpeedTune } from '../../lib/speedTuneDeck';
import { kitVitesse, KitVitesse, KIT_VIDE } from '../../lib/speedTuneKit';
import { chargerDetail } from '../../lib/monsterSkills';
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
  // Compétence de ce monstre, posée sur TOUT SON CAMP quand il joue (voir
  // speedTune.ts) : +% de barre d'attaque au tick de son tour, +% de vitesse à
  // partir du tick suivant. ⚠️ **Lu dans son kit, jamais saisi** — la card n'a
  // pas de champ pour ça (voir speedTuneKit.ts). Pour un cas que la détection ne
  // couvre pas, les deux grilles par tick restent là.
  skillAtb: number | null;
  skillSpeed: number | null;
  // Le kit du monstre a déjà été lu (et les deux champs pré-remplis). Empêche
  // d'écraser une valeur corrigée à la main au retour sur l'écran.
  kitLu?: boolean;
  // Adversaire de RÉFÉRENCE posé par l'analyse automatique (copie du monstre le
  // plus rapide de l'équipe). ⚠️ Tant qu'il porte ce drapeau, il SUIT l'équipe :
  // changer de deck refait l'analyse sur le nouveau plus rapide, au lieu de la
  // laisser tourner sur l'ancien. Le premier réglage à la main le débarrasse du
  // drapeau — il devient un adversaire ordinaire, qu'on garde tel quel.
  reference?: boolean;
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

  // Ce que le KIT de chaque monstre pose sur son camp (barre d'attaque de zone,
  // buff de vitesse de zone), lu dans les compétences pré-générées. Sert à
  // pré-remplir les deux champs de la card — l'utilisateur n'a pas à aller
  // chercher lui-même ce que fait le monstre — et à dire d'où vient la valeur.
  const [kits, setKits] = useState<Map<number, KitVitesse>>(new Map());

  useEffect(() => {
    const aLire = lignes.filter((l) => !l.kitLu);
    if (aLire.length === 0) return;
    let annule = false;
    const ids = [...new Set(aLire.map((l) => l.monster.com2usId).filter((id): id is number => id != null))];
    Promise.all(ids.map((id) => chargerDetail(id).then((d) => [id, kitVitesse(d)] as const))).then((paires) => {
      if (annule) return;
      const trouves = new Map(paires);
      setKits((prev) => new Map([...prev, ...trouves]));
      setLignes((prev) =>
        prev.map((l) => {
          if (l.kitLu) return l;
          const kit = l.monster.com2usId != null ? trouves.get(l.monster.com2usId) : undefined;
          if (!kit) return { ...l, kitLu: true };
          return {
            ...l,
            // On ne remplit que ce qui est VIDE : une valeur saisie l'emporte.
            skillAtb: l.skillAtb ?? (kit.atb > 0 ? kit.atb : null),
            skillSpeed: l.skillSpeed ?? (kit.buff > 0 ? kit.buff : null),
            kitLu: true,
          };
        })
      );
    });
    return () => {
      annule = true;
    };
  }, [lignes, setLignes]);
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
        skillAtb: null,
        skillSpeed: null,
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
    setLignes((prev) => [
      ...prev.filter((l) => l.camp !== camp),
      ...monstres.map(({ monster, runeSpeed, artefactBuff }) => ({
        uid: uidDe(camp, String(monster.id)),
        monster,
        runeSpeed,
        camp,
        atbMod: {},
        speedMod: {},
        artefactBuff,
        // Les compétences se relisent dans le kit (voir l'effet plus haut).
        skillAtb: null,
        skillSpeed: null,
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
      skillAtb: null,
      skillSpeed: null,
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

  // ⚠️ L'adversaire de référence SUIT l'équipe. Sans ça, analyser un deck puis en
  // importer un autre laissait l'analyse tourner sur le monstre le plus rapide de
  // l'ANCIEN deck — le verdict paraissait juste et ne l'était plus.
  useEffect(() => {
    const ref = lignes.find((l) => l.reference);
    if (!ref) return;
    const modele = plusRapideAllie();
    // Plus personne à comparer : la référence n'a plus d'objet.
    if (!modele) {
      setLignes((prev) => prev.filter((l) => !l.reference));
      return;
    }
    const cible = ligneReference(modele);
    if (
      ref.uid === cible.uid &&
      ref.runeSpeed === cible.runeSpeed &&
      ref.artefactBuff === cible.artefactBuff
    ) {
      return;
    }
    // On garde son état masqué : la référence se met à jour, elle ne se
    // réaffiche pas dans le dos de qui l'avait mise de côté.
    setLignes((prev) => [
      ...prev.filter((l) => !l.reference && l.uid !== cible.uid),
      { ...cible, masque: ref.masque },
    ]);
  }, [lignes, leadAllie]);

  // Le lead d'en face suit celui de l'équipe tant qu'on compare à une référence.
  useEffect(() => {
    if (lignes.some((l) => l.reference) && leadEnnemi !== leadAllie) setLeadEnnemi(leadAllie);
  }, [lignes, leadAllie, leadEnnemi]);

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
  function setArtefact(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), artefactBuff: v } : l)));
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
  const combatDe = (l: Ligne): number | null =>
    combatSpeed(l.monster.stats.speed, l.runeSpeed, leadDe(l.camp), false);

  // Monstres visibles (non masqués) : seuls eux entrent dans les calculs et les
  // tableaux. Les masqués restent affichés dans leur camp pour être réaffichés.
  const lignesVisibles = useMemo(() => lignes.filter((l) => !l.masque), [lignes]);

  // Entrée du moteur : les monstres visibles dont la vitesse est connue.
  // Partagée par la simulation ET par le diagnostic de chaîne.
  const tune = useMemo(() => {
    const out: TuneMonstre[] = [];
    for (const l of lignesVisibles) {
      const c = combatDe(l);
      if (c != null && c > 0)
        out.push({
          id: l.uid,
          combat: c,
          camp: l.camp,
          atbMod: l.atbMod,
          speedMod: l.speedMod,
          artefactBuff: l.artefactBuff ?? 0,
          skillAtb: l.skillAtb ?? 0,
          skillSpeed: l.skillSpeed ?? 0,
        });
    }
    return out;
  }, [lignes, leadAllie, leadEnnemi]);

  // Simulation multi-tours (40 ticks) avec les modificateurs.
  const sim = useMemo(() => simuler(tune, HORIZON_TICKS), [tune]);

  // Chaîne d'ouverture : toute l'équipe joue-t-elle avant le premier adverse ?
  // Et sinon, quelle vitesse de combat faut-il à ceux qui sont coupés.
  const chaine = useMemo(() => diagnostiquerChaine(tune, HORIZON_TICKS), [tune]);
  const requis = useMemo(
    () => (chaine.ok ? [] : vitessesRequises(tune, HORIZON_TICKS)),
    [tune, chaine]
  );

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

  // Ce que les COMPÉTENCES posent d'elles-mêmes dans les deux grilles : le boost
  // de barre au tick de chaque tour de son lanceur, le buff de vitesse à partir
  // du tick suivant son premier tour — sur tout son camp. Affiché en clair dans
  // les cellules (en repère, pas en saisie) : on voit OÙ la compétence tombe, et
  // ça suit quand les vitesses changent. Mêmes règles que la simulation.
  const derives = useMemo(() => {
    const atb = new Map<string, ModParTick>();
    const spd = new Map<string, ModParTick>();
    for (const l of lignesVisibles) {
      atb.set(l.uid, {});
      spd.set(l.uid, {});
    }
    for (const a of sim.actions) {
      const source = ligneParUid.get(a.id);
      if (!source?.skillAtb) continue;
      for (const l of lignesVisibles) {
        if (l.camp !== source.camp) continue;
        const m = atb.get(l.uid)!;
        m[a.tick] = (m[a.tick] ?? 0) + source.skillAtb;
      }
    }
    for (const source of lignesVisibles) {
      if (!source.skillSpeed) continue;
      const premier = premiers.find((a) => a.id === source.uid);
      if (!premier) continue;
      for (const l of lignesVisibles) {
        if (l.camp !== source.camp) continue;
        const m = spd.get(l.uid)!;
        for (let t = premier.tick + 1; t <= HORIZON_TICKS; t++) {
          m[t] = Math.max(m[t] ?? 0, source.skillSpeed);
        }
      }
    }
    return { atbMod: atb, speedMod: spd };
  }, [sim, premiers, lignesVisibles, ligneParUid]);
  const requisParUid = useMemo(() => new Map(requis.map((r) => [r.id, r])), [requis]);
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
  // Un adversaire de RÉFÉRENCE ne compte pas comme un vrai adversaire : tant
  // qu'il n'y a que lui en face, « Lancer l'analyse » reste actif — c'est ce qui
  // permet de la relancer après avoir changé d'équipe.
  const aVraiEnnemi = lignesVisibles.some((l) => l.camp === 'ennemi' && !l.reference);

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
          {/* Le combo passe-t-il ? — la question à laquelle sert le speed tune */}
          <section className="rounded-lg border border-border bg-panel">
            <div className="border-b border-border-soft px-4 py-2.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
              Le combo passe-t-il ?
              <span className="ml-2 font-normal normal-case tracking-normal text-ink-dimmer">
                · toute ton équipe doit jouer AVANT le premier adverse
              </span>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5 px-4 py-3.5">
              <div className="min-w-0 flex-1">
              {!aAllie || !chaine.coupeur ? (
                <p className="text-sm text-ink-dim">
                  {aAllie
                    ? "Ajoute un monstre en face pour voir s'il coupe ton combo."
                    : 'Ajoute des monstres à ton équipe pour vérifier que rien ne la coupe.'}
                </p>
              ) : chaine.ok ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-good">
                  <Check size={16} className="flex-none" />
                  Toute ton équipe joue avant {nomDe(chaine.coupeur.id)} (tick {chaine.coupeur.tick}).
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm font-semibold text-bad">
                    <Scissors size={16} className="flex-none" />
                    {nomDe(chaine.coupeur.id)} agit au tick {chaine.coupeur.tick} : il coupe ton combo.
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {chaine.coupes.map((c) => {
                      const l = ligneParUid.get(c.id);
                      if (!l) return null;
                      const r = requisParUid.get(c.id);
                      const cible = r?.combatRequis ?? null;
                      const runes = cible == null ? null : runesPour(l, cible);
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                          <MonsterAvatar monster={l.monster} size={24} element={false} />
                          <span className="font-semibold">{l.monster.name}</span>
                          <span className="font-mono text-xs text-ink-dim">
                            {c.tick == null ? "n'agit pas" : `joue au tick ${c.tick}`}
                          </span>
                          {cible == null ? (
                            <span className="text-xs text-ink-dim">
                              — hors de portée : un seul monstre agit par tick, ils ne tiennent pas tous avant lui.
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="text-ink-dimmer">→</span>
                              <span className="font-mono text-xs">
                                {cible} <span className="text-ink-dim">de vitesse de combat</span>
                              </span>
                              {runes != null && (
                                <span className="rounded border border-accent/50 px-1.5 py-0.5 font-mono text-micro font-bold text-accent">
                                  {runes > 0 ? `+${runes}` : runes} SPD de runes
                                </span>
                              )}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2.5 text-xs text-ink-dim">
                    Les vitesses proposées tiennent compte des compétences, des boosts de barre et des buffs déjà
                    posés, et se lisent ENSEMBLE : un seul monstre agit par tick, corriger l'un change ce qu'il faut
                    aux autres.
                  </p>
                </>
              )}
              </div>
              {/* L'analyse se recalcule seule à chaque changement : ce bouton
                  sert au cas où il n'y a personne à devancer — il pose en face
                  un adversaire de référence. */}
              <Bouton
                icone={<Play size={14} />}
                libelle="Lancer l'analyse"
                disabled={!aAllie || aVraiEnnemi}
                title={
                  !aAllie
                    ? "Ajoute d'abord des monstres à ton équipe."
                    : aVraiEnnemi
                      ? "L'analyse est déjà faite sur les monstres d'en face : elle se recalcule à chaque changement."
                      : 'Pose en face une copie de ton monstre le plus rapide (même lead, même vitesse de runes) et vérifie que toute ton équipe joue avant lui.'
                }
                onClick={analyseAuto}
              />
            </div>
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
            derives={derives.atbMod}
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
            derives={derives.speedMod}
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
                            title="Adversaire de référence : copie de ton monstre le plus rapide. Il SUIT ton équipe — jusqu'au premier réglage à la main, qui en fait un adversaire ordinaire."
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
                    <label className="flex flex-col gap-0.5">
                      <span
                        className="text-micro font-semibold uppercase tracking-wide text-ink-dimmer"
                        title="Bonus d'artéfact « Effet aug. VIT » — s'ajoute au buff de vitesse quand il est actif. Repris tel quel d'un deck importé ou de l'adversaire de référence."
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
                    <div className="ml-auto text-right">
                      <div className={`font-mono text-lg font-black leading-none ${adv ? 'text-bad' : 'text-ink'}`}>
                        {combat ?? '—'}
                      </div>
                      <div className="text-micro uppercase tracking-wide text-ink-dimmer">combat</div>
                    </div>
                  </div>

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
  // Ce que les compétences posent d'elles-mêmes, par monstre et par tick :
  // affiché en repère dans la cellule vide, jamais écrit dans l'état.
  derives: Map<string, ModParTick>;
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
  derives,
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
  const cellule = (
    value: number | null,
    onChange: (v: number | null) => void,
    aria: string,
    derive?: number
  ) =>
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
          placeholder={derive ? `+${derive}` : '·'}
          ariaLabel={`${aria} — valeur`}
          title={derive ? `Posé par une compétence : +${derive} %` : undefined}
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
        placeholder={derive ? `+${derive}` : '·'}
        ariaLabel={aria}
        title={derive ? `Posé par une compétence : +${derive} % de barre` : undefined}
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
                            `${l.monster.name} — tick ${t}`,
                            derives.get(l.uid)?.[t]
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
