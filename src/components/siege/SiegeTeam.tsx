import { useMemo, useRef, useState } from 'react';
import { Crown, X, GripVertical, Trash2, AlertTriangle, Pencil, Timer } from 'lucide-react';

const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`; // icône vitesse du jeu (SWARFARM)
import { Monster, SiegeTeam as SiegeTeamType } from '../../types';
import {
  SIEGE_TICKS,
  combatSpeed,
  speedLeadOf,
  siegeLeadFor,
  tickDanger,
  tickTeamMessage,
  LeadInfo,
} from '../../lib/speed';
import MonsterPicker from '../MonsterPicker';
import ElementIcon from '../ElementIcon';
import RuneIcon from '../RuneIcon';
import MonsterGear from '../MonsterGear';
import { statutEquipe, raisonSansVerdict } from '../../lib/siegeStatut';
import { analyseAutomatique, combatAuto, EntreeAuto } from '../../lib/speedTuneAuto';
import { deckPourSpeedTune } from '../../lib/speedTuneDeck';
import { useDonneesKit } from '../../hooks/useDonneesKit';
import NumberField from '../../ui/NumberField';
import LeadPill, { LeadBadge } from './LeadPill';
import { ConfirmDialog } from '../../ui/Dialogs';
import { Bouton, BoutonIcone, Selecteur, ZoneCliquable } from '../../ui';
import { useMediaQuery, COMPACT } from '../../hooks/useMediaQuery';

const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};
const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

interface Props {
  team: SiegeTeamType;
  index: number;
  monsters: Monster[];
  monsterById: Map<string, Monster>;
  expanded: boolean; // vue détaillée (édition) — piloté par le board (pleine largeur)
  onToggleExpand: (teamId: string) => void;
  onRemoveTeam: (id: string) => void;
  onPickMonster: (teamId: string, idx: number, monsterId: string) => void;
  onClearSlot: (teamId: string, idx: number) => void;
  onSlotRune: (teamId: string, idx: number, value: number | null) => void;
  onSlotTick: (teamId: string, idx: number, tick: number) => void;
  // Mode « Vérifier mes speed » (bouton de la barre d'actions, éteint par
  // défaut) : sans lui, toutes les équipes restent neutres.
  checkTicks: boolean;
  onDismissAlert: (teamId: string, dismissed: boolean) => void;
  onVoirSpeedTune: (teamId: string) => void;
  onSwap: (teamId: string, from: number, to: number) => void;
}

export default function SiegeTeam({
  team,
  index,
  monsters,
  monsterById,
  expanded,
  onToggleExpand,
  onRemoveTeam,
  onPickMonster,
  onClearSlot,
  onSlotRune,
  onSlotTick,
  checkTicks,
  onDismissAlert,
  onVoirSpeedTune,
  onSwap,
}: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [detailIdx, setDetailIdx] = useState<number | null>(null); // slot dont on montre le détail
  const [suppressionAConfirmer, setSuppressionAConfirmer] = useState(false);
  // ⚠️ Le budget de la ligne « vitesse + sets » est COMPTÉ. Sur 348 px, une
  // carte compacte fait (348 − 2×4) ÷ 3 ≈ 113 px ; moins le rembourrage et le
  // portrait de 30, il reste ~73 px. Trois icônes à 17 px n'y tiennent pas à
  // côté d'un nombre à trois chiffres. `RuneIcon` dimensionne en pixels — il
  // faut donc la valeur, pas une classe.
  const petitEcran = useMediaQuery(COMPACT);
  const tailleSet = petitEcran ? 14 : 17;

  const usedIds = new Set(
    team.slots.map((s) => s.monsterId).filter((id): id is string => id !== null)
  );

  // Lead déduit automatiquement du leader (slot 0).
  const leaderId = team.slots[0].monsterId;
  const leaderMonster = leaderId ? monsterById.get(leaderId) ?? null : null;
  const leadInfo = speedLeadOf(leaderMonster);

  // Statut de l'équipe vis-à-vis de sa vitesse — calculé en mode
  // « Vérifier mes speed » (sinon `neutral` : équipes affichées telles quelles).
  // ⚠️ Une fois ce mode allumé, TOUT est automatique : statut, message nommant
  // les monstres fautifs, et l'ordre de tours d'une équipe Swift. Le bouton dit
  // quand on veut voir, il ne demande pas de calculer soi-même.
  //  - vert   : au tick (aucun monstre mal calé) OU recommandation ignorée
  //  - orange : pas au tick mais les monstres hors-tick sont en Swift (on veut du speed)
  //  - rouge  : pas au tick et pas en Swift → à corriger
  const donneesKitSlots = useDonneesKit(
    team.slots.map((sl) => (sl.monsterId ? (monsterById.get(sl.monsterId) ?? null) : null))
  );

  // ⚠️ **La MÊME vitesse de combat que l'outil**, `combatAuto` : elle ajoute au
  // calcul de base (runes + lead + Swift) le **gain du passif** du monstre —
  // Shumar +15 en permanence, Chilling +20 par buff porté. Le siège les ignorait,
  // et affichait donc une vitesse que l'outil corrigeait aussitôt : deux nombres
  // pour un même monstre, sur deux écrans.
  const slotInfos = team.slots.map((slot, i) => {
    const m = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
    if (!m) return { monster: null, combat: null };
    const entree: EntreeAuto = {
      id: `${i}`,
      monster: m,
      runeSpeed: slot.runeSpeed,
      // Le Swift entre dans la SOMME des %, il ne s'ajoute pas à côté (voir speed.ts).
      swift: (slot.sets ?? []).includes('swift'),
      sets: slot.sets ?? [],
      // ⚠️ **Le lead de CE monstre**, lead d'élément compris — et c'est la même
      // valeur que celle qui part au verdict (`deckPourSpeedTune` appelle le
      // même `siegeLeadFor`). Auparavant la card affichait la vitesse avec le
      // lead d'élément et le speed tune la recalculait sans : deux nombres pour
      // un même monstre, et un « il manque X de VIT » sur une vitesse invisible.
      lead: siegeLeadFor(leadInfo, m.element),
    };
    const equipe = team.slots.flatMap((sl, j) => {
      const autre = sl.monsterId ? monsterById.get(sl.monsterId) : null;
      return autre
        ? [
            {
              id: `${j}`,
              monster: autre,
              runeSpeed: sl.runeSpeed,
              swift: (sl.sets ?? []).includes('swift'),
              sets: sl.sets ?? [],
              lead: siegeLeadFor(leadInfo, autre.element),
            } as EntreeAuto,
          ]
        : [];
    });
    return {
      monster: m,
      // Le lead voyage DANS l'entrée (`entree.lead`) : le second argument n'est
      // que le repli pour un monstre qui n'en porte pas.
      combat: combatAuto(entree, 0, donneesKitSlots, equipe),
    };
  });
  const slotDangers = slotInfos.map(({ combat }) => tickDanger(combat));
  const hasMonsters = slotInfos.some((s) => s.monster);
  // Tick à vérifier pour tous les sets — SAUF si l'équipe a au moins un Swift
  // (équipe speed, on vise la vitesse max) ou contient Leo.
  const teamHasSwift = team.slots.some((s) => (s.sets ?? []).includes('swift'));
  const hasLeo = slotInfos.some(({ monster }) => monster?.name === 'Leo');
  const anyOffTick = slotDangers.some(Boolean);

  // ⚠️ **Une équipe Swift ne se juge pas au tick, elle se SPEED TUNE.** Elle n'a
  // aucun tick à viser : ce qui compte, c'est que toute l'équipe joue avant que
  // l'adversaire ne s'intercale. Dire « Vérifier le speed tuning » et s'arrêter
  // là renvoyait l'utilisateur faire à la main un calcul que l'app sait faire.
  //
  // ⚠️ **Même code que l'outil** (`analyseAutomatique`, lib/speedTuneAuto.ts) :
  // la réponse ici doit être EXACTEMENT celle qu'on obtiendrait en ouvrant le
  // speed tuning et en cliquant sur « Analyser ». Deux implémentations auraient
  // donné deux verdicts sur la même équipe.
  const donneesKit = donneesKitSlots;

  // ⚠️ **Les mêmes ENTRÉES que l'outil**, pas des entrées reconstruites : on
  // passe par `deckPourSpeedTune`, la fonction qu'il utilise lui-même pour
  // importer une équipe de siège (vitesse de runes, artéfact « Effet aug. VIT »
  // lu sur le gear, Swift, sets). Sinon le siège aurait répondu sur une équipe
  // légèrement différente — un artéfact oublié, et le verdict change.
  //
  // Le LEAD suit la même règle que l'import : celui du leader s'il vaut pour
  // tout le monde (General/Guild), sinon aucun — un lead d'élément ne se
  // transpose pas au modèle « un lead par camp » de l'outil.
  const deck = useMemo(
    () => deckPourSpeedTune(team, monsterById),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(team.slots.map((sl) => [sl.monsterId, sl.runeSpeed, sl.sets, !!sl.gear]))]
  );
  const equipeAuto = useMemo<EntreeAuto[]>(
    () =>
      deck.monstres.map((m, i) => ({
        id: `${i}`,
        monster: m.monster,
        runeSpeed: m.runeSpeed,
        swift: m.swift,
        sets: m.sets,
        artefactBuff: m.artefactBuff,
        // ⚠️ Le lead d'ÉLÉMENT entre ici : le verdict se prononce sur la vitesse
        // que la card affiche, pas sur une autre.
        lead: m.lead,
      })),
    [deck]
  );
  const speedTune = useMemo(
    () =>
      equipeAuto.length >= 2 && teamHasSwift
        ? // Le lead voyage dans chaque entrée (`EntreeAuto.lead`, calculé par
          // `siegeLeadFor`) : un lead d'ÉLÉMENT ne se dit pas avec un seul
          // nombre. Le second argument n'est que le repli.
          analyseAutomatique(equipeAuto, 0, donneesKit)
        : null,
    [equipeAuto, deck.lead, teamHasSwift, donneesKit]
  );

  const validated = team.tickAlertDismissed; // recommandation écartée par l'utilisateur

  // Message d'alerte, construit dans speed.ts : c'est de la logique de tick, pas
  // de l'affichage — et elle mérite d'être vérifiable.
  // ⚠️ **Dans l'ordre où les monstres JOUENT**, pas dans celui des slots : ici
  // aucun effet de barre n'entre en jeu, donc le plus rapide joue le premier —
  // un tri sur la vitesse de combat suffit, et un monstre sans vitesse connue
  // passe en dernier. Même règle que pour les vitesses requises du speed tune
  // (`ordreDeJeu`) : une liste de problèmes se lit dans la chronologie.
  const messageTick = tickTeamMessage(
    slotInfos
      .map(({ monster, combat }, i) => ({
        nom: monster?.name ?? 'Ce monstre',
        danger: slotDangers[i],
        combat,
      }))
      .sort((a, b) => (b.combat ?? -Infinity) - (a.combat ?? -Infinity))
  );

  // ⚠️ **La décision n'est plus écrite ici** : elle vit dans
  // `lib/siegeStatut.ts`, où chaque cas est testé. En ternaires imbriqués dans
  // ce composant, elle n'était vérifiable qu'à l'œil, sur ses propres équipes.
  const entreeStatut = {
    verifier: checkTicks,
    desMonstres: hasMonsters,
    leo: hasLeo,
    ignoree: validated,
    swift: teamHasSwift,
    speedTune,
    horsTick: anyOffTick,
    // ⚠️ Les slots REMPLIS d'un côté, les monstres RECONNUS de l'autre
    // (`deckPourSpeedTune` écarte un slot dont le monstre n'est pas encore dans
    // le catalogue). Les deux diffèrent le temps du chargement, et c'est
    // exactement ce que la card doit savoir pour ne pas accuser à tort.
    slotsRemplis: team.slots.filter((sl) => sl?.monsterId).length,
    monstresConnus: equipeAuto.length,
  };
  const statut = statutEquipe(entreeStatut);
  // Ce qu'on dit quand le mode est allumé mais qu'il n'y a pas de verdict : sans
  // ça, la card ne bouge pas et le bouton semble ne rien faire.
  const sansVerdict = raisonSansVerdict(entreeStatut);

  // Validation d'équipement — indépendante du mode « Vérifier mes speed ».
  // Seuls les slots AVEC données importées (`gear` présent) sont contrôlés :
  // l'absence de gear signifie que le compte n'a pas été importé, pas que le
  // monstre n'est pas équipé.
  const gearIncomplet = team.slots.flatMap((slot) => {
    const monster = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
    if (!monster || !slot.gear) return [];
    const manqueRunes = slot.gear.runes.length < 6;
    const manqueArtes = slot.gear.artifacts.length < 2;
    if (!manqueRunes && !manqueArtes) return [];
    return [{ id: slot.monsterId!, monster, manqueRunes, manqueArtes }];
  });
  const aGearIncomplet = gearIncomplet.length > 0;

  function handleDrop(to: number) {
    if (dragFrom !== null && dragFrom !== to) onSwap(team.id, dragFrom, to);
    setDragFrom(null);
    setOverIdx(null);
  }

  // Nommer ce qui va partir : « supprimer l'équipe 3 » ne dit rien, la liste
  // des monstres si.
  const monstresDeLEquipe = slotInfos.map(({ monster }) => monster?.name).filter(Boolean) as string[];

  // ⚠️ **Le statut se dit par le CONTOUR et la PASTILLE.** En mode sombre, un
  // contour coloré lumineux sur fond profond suffit. En mode clair, le fond
  // blanc rend un contour d'un pixel difficile à voir : les tokens
  // `--siege-card-*` apportent un fond coloré EN CLAIR SEULEMENT — les deux
  // déclencheurs dark de `index.css` les ramènent à la couleur du panel, ce
  // qui les rend invisibles (= contour seul en sombre, contour + fond en clair).
  const sectionClass = aGearIncomplet || statut === 'rouge'
    ? 'border-fire'
    : statut === 'orange'
      ? 'border-warn'
      : statut === 'vert'
        ? 'border-good'
        : 'border-border';
  const sectionBg =
    aGearIncomplet || statut === 'rouge' ? { backgroundColor: 'var(--siege-card-rouge)' } :
    statut === 'orange' ? { backgroundColor: 'var(--siege-card-orange)' } :
    statut === 'vert' ? { backgroundColor: 'var(--siege-card-vert)' } :
    undefined;
  const dotClass =
    aGearIncomplet || statut === 'rouge' ? 'bg-fire'
    : statut === 'orange' ? 'bg-warn'
    : statut === 'vert' ? 'bg-good'
    : '';

  return (
    // ⚠️ `p-2.5` sous `sm` : la page empile jusqu'à huit équipes, et chaque
    // `p-4` coûte 32 px de haut multipliés par ce nombre — deux écrans de vide
    // sur un téléphone.
    <section className={`rounded-2xl border bg-panel/50 p-4 compact:p-2.5 transition-colors ${sectionClass}`} style={sectionBg}>
      {/* ⚠️ `gap-3` sous `sm` autour des deux icônes nues : sans cadre, elles se
          distinguent par l'espace. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 compact:mb-2 compact:gap-3">
        <h3 className="font-display text-lg tracking-wide compact:text-base">Équipe {index + 1}</h3>
        {dotClass && <span className={`w-2 h-2 rounded-full ${dotClass}`} />}
        {/* Lead à côté du nom de l'équipe : la VALEUR doit être lisible sans
            déplier. Le badge posé sur le portrait du leader reste, lui : il dit
            de quel monstre vient le lead — les deux répondent à deux questions
            différentes, ce n'est pas un doublon. */}
        {leaderMonster?.leaderSkill && <LeadPill ls={leaderMonster.leaderSkill} />}

        {/* ⚠️ **Icône nue au doigt** (`nuAuDoigt`) — ni cadre, ni bordure, ni
            fond. L'en-tête d'équipe porte déjà le titre, la pastille d'état et
            celle du lead ; deux boutons encadrés par-dessus en faisaient une
            barre d'outils, alors que ce sont deux gestes ponctuels. À la
            souris, où la place ne manque pas, ils reprennent leur cadre. */}
        <Bouton
          onClick={() => {
            onToggleExpand(team.id);
            setDetailIdx(null);
          }}
          actif={expanded}
          nuAuDoigt
          libelleAuDoigt={false}
          taille="sm"
          icone={<Pencil size={13} />}
          libelle={expanded ? 'Terminer' : 'Éditer'}
          aria-expanded={expanded}
          title={expanded ? "Terminer l'édition" : "Éditer l'équipe"}
          aria-label={expanded ? "Terminer l'édition" : "Éditer l'équipe"}
          className="ml-auto"
        />
        <Bouton
          onClick={() => setSuppressionAConfirmer(true)}
          ton="danger"
          fond="vide"
          trait="aucun"
          nuAuDoigt
          libelleAuDoigt={false}
          taille="sm"
          icone={<Trash2 size={13} />}
          libelle="Supprimer"
          title="Supprimer l'équipe"
          aria-label="Supprimer l'équipe"
        />
      </div>

      {/* ⚠️ Une équipe se supprime en un clic, juste à côté du bouton « Éditer »
          qu'on utilise sans arrêt — et rien ne permet de la retrouver ensuite :
          ni annulation, ni corbeille. Trois monstres et leurs vitesses partent
          avec elle. */}
      {suppressionAConfirmer && (
        <ConfirmDialog
          titre={`Supprimer l'équipe ${index + 1} ?`}
          message={
            monstresDeLEquipe.length > 0
              ? `${monstresDeLEquipe.join(', ')} — ainsi que leurs vitesses saisies. Les autres équipes ne sont pas touchées.`
              : 'Cette équipe est vide. Les autres ne sont pas touchées.'
          }
          libelleAction="Supprimer"
          destructif
          onCancel={() => setSuppressionAConfirmer(false)}
          onConfirm={() => {
            setSuppressionAConfirmer(false);
            onRemoveTeam(team.id);
          }}
        />
      )}

      {expanded ? (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {team.slots.map((slot, idx) => {
          const monster = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
          const slotDanger = statut === 'rouge' ? slotDangers[idx] : null;
          return (
            <div
              key={idx}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(idx);
              }}
              onDragLeave={() => setOverIdx((o) => (o === idx ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(idx);
              }}
              className={`rounded-xl border transition-colors ${
                overIdx === idx
                  ? 'border-accent bg-panel2'
                  : slotDanger
                    ? 'border-fire bg-fire/20'
                    : 'border-border bg-panel2/60'
              }`}
              title={
                slotDanger
                  ? slotDanger.kind === 'below'
                    ? `À ${slotDanger.diff} sous le tick ${slotDanger.tick}`
                    : `${slotDanger.diff} au-dessus du tick ${slotDanger.tick} (overshoot)`
                  : undefined
              }
            >
              <SlotContent
                monster={monster}
                slot={slot}
                idx={idx}
                isLeader={idx === 0}
                leadInfo={leadInfo}
                combat={slotInfos[idx].combat}
                monsters={monsters}
                usedIds={usedIds}
                onPick={(id) => onPickMonster(team.id, idx, id)}
                onClear={() => onClearSlot(team.id, idx)}
                onRune={(v) => onSlotRune(team.id, idx, v)}
                onTick={(t) => onSlotTick(team.id, idx, t)}
                onMoveTo={(to) => onSwap(team.id, idx, to)}
                onDragStart={() => setDragFrom(idx)}
                onDragEnd={() => setDragFrom(null)}
              />
            </div>
          );
        })}
      </div>
      ) : (
        /* Vue compacte : cards des 3 monstres, clic = déplier le détail dessous.
           ⚠️ **En RANGÉE dès le plus petit écran.** Elles s'empilaient sous
           `sm` : trois cartes de 52 px plus les écarts, soit 170 px par équipe
           avant même l'en-tête — on voyait une équipe et demie sur un
           téléphone, là où le siège en compte huit à comparer. Une équipe EST
           une rangée de trois, l'empiler défait ce qu'on vient lire.
           Le portrait descend à 30 px et le nom passe en `text-micro` pour que
           les trois tiennent sur 348 px. */
        <div className="flex flex-row gap-1.5 compact:gap-1">
          {slotInfos.map(({ monster, combat }, idx) => {
            const danger = statut === 'rouge' ? slotDangers[idx] : null;
            const sets = team.slots[idx].sets ?? [];
            const slotGear = team.slots[idx].gear;
            const canDetail = !!slotGear && slotGear.runes.length > 0;
            const active = detailIdx === idx;
            return (
              <ZoneCliquable
                key={idx}
                onClick={() => {
                  if (canDetail) setDetailIdx((d) => (d === idx ? null : idx));
                  else onToggleExpand(team.id);
                }}
                title={
                  danger
                    ? danger.kind === 'below'
                      ? `À ${danger.diff} sous le tick ${danger.tick}`
                      : `${danger.diff} au-dessus du tick ${danger.tick} (overshoot)`
                    : canDetail
                      ? 'Voir le détail des runes'
                      : 'Modifier'
                }
                className={`flex-1 min-w-0 flex items-center gap-2 rounded-lg border
                  px-2 py-1.5 compact:gap-1 compact:px-1 compact:py-1 transition hoverable:border-accent ${
                  active
                    ? // Bordure seule, sans anneau superposé — voir design.md.
                      'border-accent bg-panel2'
                    : danger
                      ? 'border-fire bg-fire/20'
                      : 'border-border bg-panel2/60'
                }`}
              >
                {monster ? (
                  <>
                    <div className="relative flex-none">
                      <div
                        className={`hex-frame w-[36px] h-[36px] compact:w-[30px] compact:h-[30px] p-[2px]
                          bg-gradient-to-br ${GRADIENT[monster.element]}`}
                      >
                        <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
                          {monster.image ? (
                            <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className={`font-display font-bold text-micro ${TEXT[monster.element]}`}>
                              {initials(monster.name)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ElementIcon
                        element={monster.element}
                        size={13}
                        className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                      />
                      {/* Lead sur le portrait du leader : la carte compacte n'a
                          pas la place d'une pastille (voir spec), et le badge
                          dit à la fois « c'est lui le leader » et quel lead. */}
                      {/* ⚠️ Réduit avec le portrait : à 22 px sur un portrait
                          de 30, il en couvrait les deux tiers et l'on ne
                          reconnaissait plus le monstre. */}
                      {idx === 0 && monster.leaderSkill && (
                        <LeadBadge ls={monster.leaderSkill} size={petitEcran ? 17 : 22} />
                      )}
                    </div>
                    {/* Le nom occupe SA ligne : nom, vitesse et sets se
                        disputaient la même, et le gros chiffre (non réductible)
                        finissait sous les icônes de set. Ligne 2 = vitesse à
                        gauche, sets poussés à droite. */}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight truncate compact:text-micro">
                        {monster.name}
                      </div>
                      {/* ⚠️ Le budget de cette ligne est COMPTÉ. Sur 348 px,
                          une carte fait (348 − 2×4) ÷ 3 ≈ 113 px ; moins le
                          rembourrage et le portrait de 30, il reste ~73 px. Une
                          icône de vitesse (12) + un nombre à trois chiffres
                          (~22) + trois icônes de set (3×14) = 76 — et l'icône de
                          vitesse est celle qui apporte le moins : le gros
                          chiffre en gras se lit comme une vitesse sans elle,
                          c'est la seule de la carte. Elle tombe donc sous `sm`,
                          et les sets descendent à 14 px. */}
                      <div className="mt-0.5 flex items-center gap-1 compact:gap-0.5">
                        <img
                          src={SPD_ICON}
                          alt="SPD"
                          width={14}
                          height={14}
                          className="flex-none compact:hidden"
                        />
                        <span
                          className={`font-mono text-base font-black leading-none flex-none compact:text-sm ${
                            danger ? 'text-fire' : 'text-ink'
                          }`}
                        >
                          {combat ?? '—'}
                        </span>
                        {sets.length > 0 && (
                          <span className="ml-auto flex flex-none items-center gap-0.5">
                            {sets.slice(0, 3).map((s, i) => (
                              <RuneIcon key={i} setKey={s} size={tailleSet} className="flex-none" />
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  // ⚠️ Le carré vide suit EXACTEMENT le portrait rempli (30 px
                  // sous `sm`, 36 au-dessus). À 34 px fixes, une carte vide était
                  // plus haute qu'une carte pleine et la rangée de trois partait
                  // en dents de scie.
                  <div className="flex items-center gap-2 text-ink-dim compact:gap-1">
                    <span
                      className="flex h-[36px] w-[36px] flex-none items-center justify-center rounded-lg
                                 border border-dashed border-border text-lg compact:h-[30px] compact:w-[30px] compact:text-base"
                    >
                      +
                    </span>
                    <span className="min-w-0 truncate text-micro">
                      {idx === 0 ? 'Leader' : 'vide'}
                    </span>
                  </div>
                )}
              </ZoneCliquable>
            );
          })}
        </div>
      )}

      {/* Panneau de détail du monstre sélectionné (vue compacte) */}
      {!expanded && detailIdx !== null && team.slots[detailIdx]?.gear && (
        <div className="mt-2 rounded-xl border border-border bg-panel/40 p-3">
          <MonsterGear gear={team.slots[detailIdx].gear!} />
        </div>
      )}

      {/* ⚠️ **UN SEUL pied de card**, pas trois blocs empilés. Il portait
          successivement : un encadré d'alerte teinté, une ligne verte, un
          bouton flottant à droite — trois objets pour une seule idée (« où en
          est cette équipe, et que puis-je en faire »). Réunis, ils se lisent
          d'un coup : l'état à gauche, les actions à droite.

          ⚠️ **Le pied ne prend PAS la teinte du statut.** Comme la card
          elle-même : la couleur se dit par le contour et la pastille. Un
          bandeau ambré pleine largeur sous chaque équipe repeignait la page à
          la place du contenu, et faisait passer une simple correction de
          vitesse pour une avarie. Il se cale sur les bords de la card (marges
          négatives) : c'est une BANDE, pas une boîte dans une boîte — un cadre
          de plus à l'intérieur d'un cadre faisait deux contours concentriques,
          ce que la charte interdit.

          ⚠️ `flex-wrap` : le message peut nommer deux monstres. Sur un écran
          étroit, il passe au-dessus des boutons plutôt que de se comprimer. */}
      {(hasMonsters || statut !== 'neutre' || aGearIncomplet) && (
        <div
          className="-mx-4 -mb-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-b-2xl border-t border-border-soft px-4 py-2.5
            compact:-mx-2.5 compact:-mb-2.5 compact:px-2.5"
        >
          <span className="flex min-w-0 flex-1 items-start gap-2">
            {(aGearIncomplet || statut === 'rouge' || statut === 'orange') && (
              <AlertTriangle
                size={15}
                className={`mt-px flex-none ${aGearIncomplet || statut === 'rouge' ? 'text-fire' : 'text-warn'}`}
              />
            )}
            {/* ⚠️ Le TEXTE reste neutre lui aussi : ce qu'il dit est déjà porté
                par le pictogramme d'alerte à sa gauche, et le chiffre à
                trouver, lui, est en gras — c'est lui qu'on vient lire. */}
            <span className="text-xs text-ink-dim">
              {aGearIncomplet ? (
                // L'équipement est incomplet — plus urgent que les vitesses.
                // Pas de bouton « Valider » : ce n'est pas un écart à accepter.
                <span className="space-y-0.5">
                  {gearIncomplet.map(({ id, monster, manqueRunes, manqueArtes }) => (
                    <span key={id} className="block">
                      <span className="font-semibold">{monster.name}</span>
                      {' '}
                      {manqueRunes && manqueArtes
                        ? "n'a pas toutes ses runes ni tous ses artefacts"
                        : manqueRunes
                          ? "n'a pas toutes ses runes"
                          : "n'a pas tous ses artefacts"}
                    </span>
                  ))}
                </span>
              ) : statut === 'rouge' ? (
                (messageTick ?? "Ton équipe n'est pas au tick.")
              ) : statut === 'orange' ? (
                speedTune ? (
                  // ⚠️ **Rien que ce qui ne va pas.** « Équipe speed : » ouvrait
                  // la phrase et ne disait rien de plus que le pictogramme et le
                  // contour : on le relisait à chaque équipe pour arriver au
                  // seul morceau utile, le nom et le chiffre qui manque.
                  <span className="font-semibold text-ink">
                    {speedTune.requis.length === 0
                      ? 'Elle ne passe pas devant un monstre aussi rapide que le tien'
                      : speedTune.requis
                          .map((r) => {
                            // ⚠️ Les identifiants de l'analyse indexent
                            // l'ÉQUIPE (slots vides écartés), pas les 3 slots.
                            const nom = equipeAuto[Number(r.id)]?.monster.name ?? 'Ce monstre';
                            return r.combatRequis == null
                              ? `${nom} (hors de portée)`
                              : `${nom} +${r.combatRequis - r.combatActuel} VIT`;
                          })
                          .join(', ')}
                  </span>
                ) : null
              ) : statut === 'vert' && validated ? (
                <button
                  onClick={() => onDismissAlert(team.id, false)}
                  className="text-good hoverable:text-ink transition"
                  title="Revenir sur cette validation et réafficher la recommandation"
                >
                  ✓ {teamHasSwift ? 'Speed tune validé' : 'Tick validé'} ·{' '}
                  <span className="underline underline-offset-2">rétablir</span>
                </button>
              ) : statut === 'vert' ? (
                <span className="text-good">
                  ✓ {speedTune?.verdict.ok ? 'Équipe speed : elle est speed tune' : 'Tous au tick'}
                </span>
              ) : (
                sansVerdict
              )}
            </span>
          </span>

          <span className="flex flex-none flex-wrap items-center gap-2">
            {!aGearIncomplet && (statut === 'rouge' || statut === 'orange') && (
              <Bouton
                onClick={() => onDismissAlert(team.id, true)}
                taille="sm"
                libelle={teamHasSwift ? 'Valider le speed tune' : 'Valider le tick'}
                libelleCourt="Valider"
                title={
                  teamHasSwift
                    ? "Tu prends la responsabilité de ce speed tune : l'équipe passe au vert."
                    : "Tu prends la responsabilité de ce calage : l'équipe passe au vert."
                }
              />
            )}
            {/* ⚠️ TOUJOURS là, quelle que soit l'équipe : le speed tune n'est pas
                une réponse à une alerte, c'est une question qu'on se pose sur
                n'importe quel deck — y compris celui qui va bien, pour voir de
                combien il passe. */}
            {hasMonsters && (
              <Bouton
                onClick={() => onVoirSpeedTune(team.id)}
                taille="sm"
                fond="vide"
                trait="aucun"
                icone={<Timer size={14} />}
                libelle="Voir le speed tune"
                libelleCourt="Speed tune"
                title="Ouvre le speed tuning avec cette équipe déjà chargée"
              />
            )}
          </span>
        </div>
      )}
    </section>
  );
}

// Préréglage de `Bouton` : le marqueur d'état unique de l'app (contour
// d'accent + fond léger, voir spec/shared/design.md) vient du composant via
// `actif`. Ne reste ici que ce qui est propre à ces pastilles-là : le mono, et
// le resserrement à trois crans au doigt (cinq pastilles côte à côte dans un
// slot qui en fait 110).
function TickBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <Bouton
      onClick={onClick}
      actif={active}
      forme="pilule"
      taille="xs"
      libelle={label}
      // ⚠️ `data-cible-fine`, sans zone étendue : ces pastilles forment une
      // rangée serrée de cinq. Portées à 40 px par la règle tactile, elles
      // occupaient deux lignes dans un slot qui en fait 110 ; dotées d'une cible
      // de 44, elles se chevaucheraient et l'on choisirait le mauvais tick.
      // C'est l'espacement du groupe qui protège du ratage.
      data-cible-fine
      className="font-mono select-none compact:px-1.5 compact:py-0 compact:text-nano"
    />
  );
}

interface SlotProps {
  monster: Monster | null;
  slot: { monsterId: string | null; runeSpeed: number | null; tick: number; sets?: string[] };
  idx: number;
  isLeader: boolean;
  leadInfo: LeadInfo | null;
  // ⚠️ La vitesse de combat vient du PARENT, qui la calcule comme l'outil
  // (`combatAuto`, passif compris). La recalculer ici en repartait sans le
  // passif : la carte dépliée affichait un autre nombre que la carte compacte.
  combat: number | null;
  monsters: Monster[];
  usedIds: Set<string>;
  onPick: (id: string) => void;
  onClear: () => void;
  onRune: (v: number | null) => void;
  onTick: (tick: number) => void;
  onMoveTo: (to: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function SlotContent({
  monster,
  slot,
  idx,
  isLeader,
  leadInfo,
  combat,
  monsters,
  usedIds,
  onPick,
  onClear,
  onRune,
  onTick,
  onMoveTo,
  onDragStart,
  onDragEnd,
}: SlotProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // ⚠️ Le retrait passe par une CONFIRMATION, comme sur une carte de prépa RTA
  // (voir RtaCard) : la vitesse saisie et le tick visé partent avec le monstre,
  // et rien ne permet de les retrouver.
  const [retraitAConfirmer, setRetraitAConfirmer] = useState(false);

  if (!monster) {
    return (
      // ⚠️ `min-h` abaissée au doigt : trois slots empilés à 150 px font
      // 450 px d'édition avant même le reste de la page.
      <div className="flex min-h-[150px] flex-col justify-center p-3 compact:min-h-[110px] compact:p-2">
        <div className="flex items-center gap-1.5 mb-2">
          {isLeader && <Crown size={13} className="text-star" />}
          <span className="label">
            {isLeader ? 'Leader' : 'Slot'}
          </span>
        </div>
        <MonsterPicker
          monsters={monsters}
          onPick={onPick}
          excludeIds={usedIds}
          placeholder="Choisir un monstre…"
        />
      </div>
    );
  }

  const base = monster.stats.speed;
  const lead = siegeLeadFor(leadInfo, monster.element);
  const tick = slot.tick;

  // Écart au tick : négatif = il manque de la vitesse, positif = surplus.
  const diff = tick > 0 && combat !== null ? combat - tick : null;

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', monster!.name);
    if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 24, 24);
    onDragStart();
  }

  return (
    <div
      ref={cardRef}
      className="relative flex min-h-[150px] flex-col p-3 compact:min-h-[110px] compact:p-2"
    >
      <div className="mb-2 flex items-center gap-1.5 compact:mb-1">
        <ZoneCliquable
          poignee
          draggable
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          // ⚠️ **Masquée au DOIGT** (`coarse:hidden`) : le glisser-déposer HTML5
          // n'y fonctionne pas, et le sélecteur « Position » en bas du slot fait
          // déjà le travail. Elle prenait 15 px de large sur une ligne qui porte
          // aussi le portrait, le nom, les sets et la croix.
          // Même traitement que la poignée d'une carte RTA (voir RtaCard).
          className="text-ink-dim hoverable:text-ink coarse:hidden"
          title="Glisser pour intervertir"
          aria-label="Déplacer"
        >
          <GripVertical size={15} />
        </ZoneCliquable>
        {isLeader && !monster.leaderSkill && <Crown size={13} className="text-star flex-none" />}
        <div className="relative flex-none">
          <div
            className={`hex-frame w-[38px] h-[38px] p-[2px] bg-gradient-to-br
              compact:w-[32px] compact:h-[32px] ${GRADIENT[monster.element]}`}
          >
            <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
              {monster.image ? (
                <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" />
              ) : (
                <span className={`font-display font-bold text-xs ${TEXT[monster.element]}`}>
                  {initials(monster.name)}
                </span>
              )}
            </div>
          </div>
          {isLeader && monster.leaderSkill && <LeadBadge ls={monster.leaderSkill} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold leading-tight compact:text-xs">
              {monster.name}
            </span>
            {slot.sets && slot.sets.length > 0 && (
              <span className="flex items-center gap-1 flex-none">
                {slot.sets.slice(0, 3).map((s, i) => (
                  <RuneIcon key={i} setKey={s} size={18} />
                ))}
              </span>
            )}
          </div>
          {/* Pastille complète (icône + montant) sous le nom du leader : ici il
              y a la place, donc on montre le chiffre, pas seulement le badge. */}
          {isLeader && monster.leaderSkill && (
            <div className="mt-1">
              <LeadPill ls={monster.leaderSkill} />
            </div>
          )}
        </div>
        {/* ⚠️ `taille="serre"` : cette croix n'a aucune dimension propre, et la
            règle tactile la portait à 40 px de haut — elle décalait alors la
            ligne du nom qu'elle borde. `serre` reste à 20 px dessinés, avec sa
            propre zone étendue à 44 px (le pseudo-élément de `data-cible-fine`) :
            elle est seule dans son coin, rien à rater autour. */}
        <BoutonIcone
          onClick={() => setRetraitAConfirmer(true)}
          libelle="Retirer"
          taille="serre"
          ton="danger"
          icone={<X size={14} />}
          className="self-start"
        />
      </div>

      {/* Vitesse de combat, mise en avant */}
      <div className="mt-1 flex items-end justify-between compact:mt-0.5">
        <div>
          {/* ⚠️ 16 px au doigt contre 26 à la souris. Le nom du monstre est la
              RÉFÉRENCE de ce bloc : la vitesse doit rester au-dessus de lui sans
              l'écraser — un rapport de 1,3 suffit à dire « c'est la valeur
              principale », là où 2,2 en faisait le seul élément lisible. */}
          <div className="font-mono text-[26px] font-black leading-none text-star compact:text-[16px]">
            {combat ?? '—'}
          </div>
          <div className="mt-1 font-mono text-micro text-ink-dim compact:mt-0.5 compact:text-nano">
            base {base ?? '—'}
          </div>
        </div>
        <label className="flex items-center gap-1.5">
          <span className="label">SPD :</span>
          <NumberField
            value={slot.runeSpeed}
            allowEmpty
            min={0}
            width="w-12"
            ariaLabel="SPD des runes"
            onChange={onRune}
          />
        </label>
      </div>

      {/* Tick cible, propre à ce monstre */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 compact:mt-1 compact:gap-1">
        <TickBtn active={tick === 0} onClick={() => onTick(0)} label="Off" />
        {SIEGE_TICKS.map((t) => (
          <TickBtn
            key={t.key}
            active={tick === t.value}
            onClick={() => onTick(t.value)}
            label={`${t.label} ${t.value}`}
          />
        ))}
      </div>

      {/* Retour tick : manque / surplus */}
      {diff !== null && (
        <div className="mt-2 compact:mt-1">
          {diff < 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-fire/15 text-fire px-2 py-0.5 text-micro font-mono font-semibold">
              manque {-diff} pour {tick}
            </span>
          ) : diff > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-water/15 text-water px-2 py-0.5 text-micro font-mono font-semibold">
              +{diff} au-dessus de {tick}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-wind/15 text-wind px-2 py-0.5 text-micro font-mono font-semibold">
              pile au tick {tick} ✓
            </span>
          )}
        </div>
      )}

      {/* Position dans l'équipe (repli tactile du drag & drop) */}
      <div className="mt-2 flex items-center gap-1.5 border-t border-border/60 pt-2 compact:mt-1 compact:pt-1">
        <span className="label">Position</span>
        <Selecteur
          value={idx}
          onChange={(e) => onMoveTo(Number(e.target.value))}
          title="Changer la position (intervertir les monstres)"
          taille="dense"
          surface="panel"
          // ⚠️ `data-cible-fine` : la règle tactile portait ce sélecteur à 40 px
          // de haut, dans un slot qui en fait 110 — il y pesait autant que la
          // vitesse qu'on vient régler. Il occupe toute la largeur restante de
          // sa ligne : rien d'autre à toucher autour, donc rien à rater.
          data-cible-fine
        >
          <option value={0}>1 · Leader</option>
          <option value={1}>2</option>
          <option value={2}>3</option>
        </Selecteur>
      </div>

      {retraitAConfirmer && (
        <ConfirmDialog
          titre={`Retirer ${monster.name} de cette équipe ?`}
          message={
            <>
              Sa vitesse saisie et son tick visé partent avec lui. L'emplacement
              redevient libre, les deux autres monstres ne sont pas touchés.
            </>
          }
          libelleAction="Retirer"
          destructif
          onCancel={() => setRetraitAConfirmer(false)}
          onConfirm={() => {
            setRetraitAConfirmer(false);
            onClear();
          }}
        />
      )}
    </div>
  );
}
