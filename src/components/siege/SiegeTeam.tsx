import { useRef, useState } from 'react';
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

  // Statut de l'équipe vis-à-vis des ticks. ⚠️ **Calculé TOUJOURS**, sans mode à
  // activer : une équipe mal calée l'est qu'on ait cliqué ou non, et le bouton
  // « Vérifier mes tick ATB » ne faisait que retarder la réponse — il fallait
  // savoir que l'outil existait pour voir un problème qu'on ne cherchait pas.
  //  - vert   : au tick (aucun monstre mal calé) OU recommandation ignorée
  //  - orange : pas au tick mais les monstres hors-tick sont en Swift (on veut du speed)
  //  - rouge  : pas au tick et pas en Swift → à corriger
  const slotInfos = team.slots.map((slot) => {
    const m = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
    // Le Swift entre dans la SOMME des %, il ne s'ajoute pas à côté (voir speed.ts).
    const swift = (slot.sets ?? []).includes('swift');
    const combat = m
      ? combatSpeed(m.stats.speed, slot.runeSpeed, siegeLeadFor(leadInfo, m.element), swift)
      : null;
    return { monster: m, combat };
  });
  const slotDangers = slotInfos.map(({ combat }) => tickDanger(combat));
  const hasMonsters = slotInfos.some((s) => s.monster);
  // Tick à vérifier pour tous les sets — SAUF si l'équipe a au moins un Swift
  // (équipe speed, on vise la vitesse max) ou contient Leo.
  const teamHasSwift = team.slots.some((s) => (s.sets ?? []).includes('swift'));
  const hasLeo = slotInfos.some(({ monster }) => monster?.name === 'Leo');
  const anyOffTick = slotDangers.some(Boolean);

  const validated = team.tickAlertDismissed; // recommandation écartée par l'utilisateur

  // Message d'alerte, construit dans speed.ts : c'est de la logique de tick, pas
  // de l'affichage — et elle mérite d'être vérifiable.
  const messageTick = tickTeamMessage(
    slotInfos.map(({ monster }, i) => ({ nom: monster?.name ?? 'Ce monstre', danger: slotDangers[i] }))
  );

  const status: 'neutral' | 'green' | 'orange' | 'red' =
    !hasMonsters || hasLeo
      ? 'neutral'
      : validated
        ? 'green'
        : teamHasSwift
          ? 'orange' // au moins un Swift → équipe speed, pas de tick à viser
          : anyOffTick
            ? 'red' // un monstre pas au tick
            : 'green'; // tous au tick

  function handleDrop(to: number) {
    if (dragFrom !== null && dragFrom !== to) onSwap(team.id, dragFrom, to);
    setDragFrom(null);
    setOverIdx(null);
  }

  // Nommer ce qui va partir : « supprimer l'équipe 3 » ne dit rien, la liste
  // des monstres si.
  const monstresDeLEquipe = slotInfos.map(({ monster }) => monster?.name).filter(Boolean) as string[];

  // ⚠️ Les halos passent par `shadow-<token>` + `shadow-color` plutôt que par un
  // `rgba()` figé : un halo orange vif sur fond clair était criard et ne suivait
  // pas le thème. Le fond monte à /10 en compensation — sur clair, un /5 ne se
  // voit pas.
  const sectionClass =
    status === 'red'
      ? 'border-fire bg-fire/10'
      : status === 'orange'
        ? 'border-warn bg-warn/10'
        : status === 'green'
          ? 'border-good/70 bg-good/10'
          : 'border-border bg-panel/50';
  const dotClass =
    status === 'red' ? 'bg-fire' : status === 'orange' ? 'bg-warn' : status === 'green' ? 'bg-good' : '';

  return (
    // ⚠️ `p-2.5` sous `sm` : la page empile jusqu'à huit équipes, et chaque
    // `p-4` coûte 32 px de haut multipliés par ce nombre — deux écrans de vide
    // sur un téléphone.
    <section className={`rounded-2xl border p-4 compact:p-2.5 transition-colors ${sectionClass}`}>
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
          const slotDanger = status === 'red' ? slotDangers[idx] : null;
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
                    ? 'border-fire/70 bg-fire/5'
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
            const danger = status === 'red' ? slotDangers[idx] : null;
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
                      ? 'border-fire/70 bg-fire/5'
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

      {/* Message sous les monstres : l'équipe n'est pas au tick.
          ⚠️ Le bouton dit « Ignorer la recommandation », et non « Valider
          l'équipe » : l'app n'a aucun moyen de savoir si le tune est bon, elle
          constate seulement qu'il s'écarte des ticks. « Valider » laissait
          croire à une approbation de l'outil, alors que c'est l'utilisateur qui
          écarte un conseil dont il assume la responsabilité. */}
      {(status === 'orange' || status === 'red') && (
        // ⚠️ **Empilé au DOIGT, en ligne à la souris.** Le message peut nommer
        // deux monstres (« Morris dépasse le tick 286 et ROBO-F29 dépasse le
        // tick 286 ») : sur une seule ligne étroite, il se compressait contre
        // le bouton et les deux se lisaient de travers. Empilé, le texte prend
        // toute la largeur pour se plier proprement, et le bouton — seul, en
        // dessous — se tasse à droite plutôt que de rester centré au milieu
        // d'une ligne vide.
        <div
          className={`mt-3 flex flex-col gap-2 rounded-lg border px-3 py-2
            sm:flex-row sm:items-center ${
            status === 'red' ? 'border-fire/40 bg-fire/10' : 'border-warn/40 bg-warn/10'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={15}
              className={`mt-px flex-none ${status === 'red' ? 'text-fire' : 'text-warn'}`}
            />
            <span className={`text-xs ${status === 'red' ? 'text-fire' : 'text-warn'}`}>
              {status === 'red'
                ? messageTick ?? "Ton équipe n'est pas au tick."
                : 'Vérifier le speed tuning'}
            </span>
          </div>
          {/* ⚠️ DEUX sorties, pas une : écarter le conseil, ou aller le vérifier.
              Ne proposer que « Ignorer » revenait à ne laisser que la porte de
              sortie — alors que l'outil qui répond à la question existe, et que
              l'équipe s'y ouvre déjà chargée. */}
          <span className="flex flex-none flex-wrap items-center gap-2 self-end sm:ml-auto sm:self-auto">
            <Bouton
              onClick={() => onDismissAlert(team.id, true)}
              taille="sm"
              libelle="Ignorer la recommandation"
            />
            <Bouton
              onClick={() => onVoirSpeedTune(team.id)}
              taille="sm"
              ton="accent"
              icone={<Timer size={14} />}
              libelle="Voir le speed tune"
              title="Ouvre le speed tuning avec cette équipe déjà chargée"
            />
          </span>
        </div>
      )}
      {/* ⚠️ Pas un `Bouton` de la librairie : le vert ici est SÉMANTIQUE (l'état
          « recommandation écartée »), pas un ton d'action — même distinction que
          les pastilles manque/surplus plus bas, en `text-fire`/`text-water`. Un
          ton de la librairie (accent, neutre…) dirait autre chose.
          ⚠️ **Le SOULIGNEMENT se pose sur « rétablir » seul**, pas sur la
          ligne entière : « Recommandation ignorée » est un ÉTAT, à lire ; c'est
          « rétablir » qui est l'ACTION, à cliquer. Toute la phrase reste dans
          le même `<button>` — cible et infobulle ne changent pas —, mais le
          trait dit où regarder pour comprendre que ça se clique. Même
          convention que les liens de RecoBoard/RecoCard. */}
      {status === 'green' && validated && (
        <button
          onClick={() => onDismissAlert(team.id, false)}
          className="mt-3 text-micro text-good hoverable:text-ink transition"
          title="Réafficher la recommandation"
        >
          ✓ Recommandation ignorée · <span className="underline underline-offset-2">rétablir</span>
        </button>
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
  const combat = combatSpeed(base, slot.runeSpeed, lead, (slot.sets ?? []).includes('swift'));
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
