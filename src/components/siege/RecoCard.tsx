import {
  Crown,
  Trash2,
  Pencil,
  Upload,
  X,
  Check,
  AlertTriangle,
  HelpCircle,
  Plus,
  StickyNote,
  Download,
  ChevronDown,
  Swords,
  Search,
  Gauge,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ARTIFACT_KINDS,
  ArtifactKind,
  LeaderSkill,
  MAX_ARTIFACT_SUBS,
  Monster,
  Reco,
  RecoCounter,
  RecoDeck,
  RECO_STATS,
  RecoSlot,
  RecoStatKey,
  RUNE_SETS,
  SiegeTeam,
} from '../../types';
import { DeckMatch, FaultCause, RecoMatch, SlotMatch, deckFaults, fmtStat, slotFaults } from '../../lib/recoMatch';
import { ConfirmDialog } from '../Dialogs';
import { NOTE_MAX, DECK_NOTE_MAX, COUNTER_NOTE_MAX } from '../../lib/recoShare';
import { deckFromSiegeTeam } from '../../lib/recoFromSiege';
import {
  artifactSubLabel,
  artifactSubsFor,
  setPieces,
  setsCost,
  canAddSet,
  MAX_SET_PIECES,
} from '../../lib/effects';
import { UseRecoState } from '../../hooks/useSiegeRecos';
import RuneIcon from '../RuneIcon';
import MonsterPicker from '../MonsterPicker';
import MonsterAvatar from '../MonsterAvatar';
import LeadPill, { LeadBadge } from './LeadPill';
import { LeadInfo, pctSpeedBonus, siegeLeadFor, speedLeadOf, swiftFlat } from '../../lib/speed';


// ⚠️ La VIT stockée dans une reco est la vitesse du BUILD (base + runes), et
// c'est bien elle qui sert de minimum et qui s'édite. Le bonus en % du siège
// — totem de guilde + lead du slot 0 — n'entre QUE dans la colonne « total »,
// pour qu'on y lise la vitesse de combat affichée sur les cartes d'équipe.
// Ne pas l'injecter dans la base ni dans le bonus saisi : ce sont les valeurs
// visibles du build. Voir ../../spec/siege/recommandations.md.
// En infobulle seulement : pas de note de bas de table, elle alourdissait la
// carte pour une précision qu'on ne lit qu'une fois.
const SPD_HINT = 'Total = VIT de combat en siège : totem de guilde (+15 %) et lead du deck inclus';

// Points de vitesse apportés par le siège à CE monstre : totem + lead du deck,
// nul si le lead est élémentaire et ne le concerne pas.
function spdLeadBonus(
  monster: Monster | null,
  lead: LeadInfo | null,
  sets: string[] = []
): number {
  const base = monster?.stats.speed;
  if (base == null) return 0; // base inconnue → on ne peut rien ajouter
  // Le Swift est déjà compté à plat dans la VIT stockée : on le retire pour le
  // remettre dans la somme des % (voir `swiftFlat` dans speed.ts).
  const swift = sets.includes('swift');
  return pctSpeedBonus(base, siegeLeadFor(lead, monster!.element), swift) - (swift ? swiftFlat(base) : 0);
}


// Nom AUTOMATIQUE d'un deck : les noms de ses monstres séparés par un tiret
// (« Trevor - Bella - Loren »), sinon « Deck N » tant qu'il est vide. On se rabat
// sur le nom stocké dans le slot si le monstre est absent des données chargées.
function autoDeckName(deck: RecoDeck, byCom2us: Map<number, Monster>, index: number): string {
  const noms = deck.slots
    .map((s) => (s.com2usId != null ? byCom2us.get(s.com2usId)?.name ?? s.name : ''))
    .filter(Boolean);
  return noms.length ? noms.join(' - ') : `Deck ${index + 1}`;
}

// Nom affiché : celui saisi par l'auteur s'il en a mis un, sinon l'automatique.
function deckLabel(deck: RecoDeck, byCom2us: Map<number, Monster>, index: number): string {
  return deck.name.trim() || autoDeckName(deck, byCom2us, index);
}

// Une équipe d'offense proposée à l'import : son rang, ses 3 monstres résolus
// (pour les icônes) et un résumé texte (recherche + infobulle).
export interface OffenseChoice {
  team: SiegeTeam;
  index: number;
  summary: string;
  monsters: (Monster | null)[];
}

interface Props {
  reco: Reco;
  index: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  monsterById: Map<string, Monster>; // par id local (slots de siège)
  offenseTeams: OffenseChoice[]; // équipes d'offense proposables à l'import
  match: RecoMatch | null; // null = pas (ou plus) analysée
  canAnalyze: boolean; // un compte est chargé
  onAnalyze: () => void;
  onClearAnalysis: () => void; // efface le résultat → carte de nouveau neutre
  open: boolean; // dépliée (« Consulter ») — repliée par défaut
  onToggleOpen: (id: string) => void;
  editing: boolean;
  onToggleEdit: (id: string) => void;
  onExport: (reco: Reco) => void;
  recos: UseRecoState;
}

// Aura selon la confrontation avec la box (même langage visuel que les équipes
// de siège) : vert = OK, orange = partiel, rouge = bloqué, neutre = pas de compte.
// ⚠️ Fonds à /10 et non /5 : sur fond clair, un aplat à 5 % ne se distingue pas
// du panneau. Même langage visuel que SiegeTeam.
const AURA: Record<string, string> = {
  ok: 'border-good/70 bg-good/10 ring-1 ring-good/40',
  partial: 'border-warn bg-warn/10 ring-2 ring-warn/50',
  missing: 'border-fire bg-fire/10 ring-2 ring-fire/50',
  unknown: 'border-border bg-panel/50',
};

export default function RecoCard({
  reco,
  index,
  monsters,
  monsterByCom2us,
  monsterById,
  offenseTeams,
  match,
  canAnalyze,
  onAnalyze,
  onClearAnalysis,
  open,
  onToggleOpen,
  editing,
  onToggleEdit,
  onExport,
  recos,
}: Props) {
  const status = match?.status ?? 'unknown';

  // Deux niveaux d'édition distincts :
  //  - `editing` (reco) : titre, auteur, consignes générales, ajout de decks ;
  //  - `editingDeck` (deck) : son nom, ses consignes, ses monstres/sets/stats.
  // Une reco tout juste créée (un seul deck, vide) ouvre directement ce deck.
  const [editingDeck, setEditingDeck] = useState<number | null>(() =>
    editing && reco.decks.length === 1 && reco.decks[0].slots.every((s) => s.com2usId == null)
      ? 0
      : null
  );
  // « Terminer » sur la recommandation termine AUSSI l'édition de ses decks :
  // un effet (et non le onClick) pour couvrir tous les chemins — y compris quand
  // le board bascule l'édition vers une autre recommandation.
  useEffect(() => {
    if (!editing) setEditingDeck(null);
  }, [editing]);

  // Éditer (à l'un ou l'autre niveau) implique de voir le contenu.
  const expanded = open || editing || editingDeck !== null;
  const [pickOffense, setPickOffense] = useState(false);
  const [offenseQuery, setOffenseQuery] = useState('');
  const q = offenseQuery.trim().toLowerCase();
  const filteredOffense = q
    ? offenseTeams.filter((t) => t.summary.toLowerCase().includes(q))
    : offenseTeams;

  // Decks DÉPLIÉS (par index) : par défaut aucun, donc déplier la recommandation
  // montre la liste de ses decks sans dérouler leur contenu — on ouvre ensuite
  // celui qui nous intéresse. Réinitialisé si le nombre de decks change (les
  // index se décalent à l'ajout/suppression).
  const [openDecks, setOpenDecks] = useState<Set<number>>(new Set());
  const [suppressionAConfirmer, setSuppressionAConfirmer] = useState(false);
  const deckCount = reco.decks.length;
  useEffect(() => {
    setOpenDecks(new Set());
    setEditingDeck((cur) => (cur != null && cur >= deckCount ? null : cur));
  }, [deckCount]);
  const toggleDeck = (i: number) =>
    setOpenDecks((s) => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <section className={`rounded-2xl border p-4 transition-colors ${AURA[status]}`}>
      {/* En-tête de la recommandation */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {editing ? (
          <input
            value={reco.name}
            onChange={(e) => recos.setMeta(reco.id, { name: e.target.value })}
            placeholder={`Recommandation ${index + 1}`}
            className="flex-1 min-w-[160px] bg-panel border border-border rounded-lg px-2.5 py-1 text-[15px]
                       font-semibold text-ink outline-none focus:border-accent"
          />
        ) : (
          <h3 className="font-display text-[17px] tracking-wide">
            {reco.name || `Recommandation ${index + 1}`}
          </h3>
        )}

        {reco.origin === 'imported' && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-accent bg-panel2 px-2 py-0.5
                       label"
            title="Recommandation reçue d'un autre joueur"
          >
            <Download size={10} /> Importée
          </span>
        )}
        <span className="font-mono text-[11px] text-ink-dim">
          {reco.decks.length} deck{reco.decks.length > 1 ? 's' : ''}
        </span>
        {!editing && reco.author && (
          <span className="font-mono text-[11px] text-ink-dim">· par {reco.author}</span>
        )}
        {!editing && match && <StatusPill match={match} onClear={onClearAnalysis} />}

        {!editing && (
          <button
            onClick={onAnalyze}
            disabled={!canAnalyze}
            title={
              canAnalyze
                ? 'Confronter toute la recommandation à tes monstres'
                : 'Importe ton compte pour analyser'
            }
            className="flex items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 py-1
                       text-[12px] font-semibold text-ink-dim hoverable:text-ink hoverable:border-accent
                       transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Gauge size={13} /> {match ? 'Réanalyser mes decks' : 'Analyser mes decks'}
          </button>
        )}

        {/* En édition, la carte est forcément dépliée → le bouton n'a pas de sens. */}
        {!editing && (
          <button
            onClick={() => onToggleOpen(reco.id)}
            aria-expanded={expanded}
            className={`ml-auto flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-semibold transition ${
              open
                ? 'border-accent bg-panel2 text-ink'
                : 'border-border bg-panel text-ink hoverable:border-accent'
            }`}
            title={open ? 'Replier' : `Voir les ${reco.decks.length} deck(s)`}
          >
            <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {open ? 'Réduire' : 'Consulter'}
          </button>
        )}
        {/* Exporter / Éditer / Supprimer : icônes nues (ni cadre ni fond), comme
            la corbeille — l'en-tête est déjà chargé. Groupées et resserrées pour
            se lire comme UNE barre d'outils, pas comme trois actions éparses.
            Le sens passe par l'infobulle et l'`aria-label` ; l'édition active se
            lit au ✓ doré. */}
        <div className={`${editing ? 'ml-auto ' : ''}flex items-center gap-0.5 -mr-1`}>
          <button
            onClick={() => onExport(reco)}
            className="flex items-center justify-center w-6 h-6 text-ink-dim hoverable:text-ink transition"
            title="Exporter cette recommandation (tous ses decks)"
            aria-label="Exporter cette recommandation"
          >
            <Upload size={13} />
          </button>
          <button
            onClick={() => onToggleEdit(reco.id)}
            className={`flex items-center justify-center w-6 h-6 transition ${
              editing ? 'text-star' : 'text-ink-dim hoverable:text-ink'
            }`}
            title={editing ? "Terminer l'édition" : 'Éditer la recommandation'}
            aria-label={editing ? "Terminer l'édition" : 'Éditer la recommandation'}
            aria-pressed={editing}
          >
            {editing ? <Check size={14} /> : <Pencil size={13} />}
          </button>
          <button
            onClick={() => setSuppressionAConfirmer(true)}
            className="flex items-center justify-center w-6 h-6 text-ink-dim hoverable:text-fire transition"
            title="Supprimer cette recommandation"
            aria-label="Supprimer cette recommandation"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {suppressionAConfirmer && (
        <ConfirmDialog
          titre="Supprimer cette recommandation ?"
          message="Elle sera retirée avec tous ses decks et ses consignes."
          libelleAction="Supprimer"
          destructif
          onCancel={() => setSuppressionAConfirmer(false)}
          onConfirm={() => {
            setSuppressionAConfirmer(false);
            recos.removeReco(reco.id);
          }}
        />
      )}

      {editing && (
        <div className="flex flex-col gap-2 mb-3">
          <input
            value={reco.author}
            onChange={(e) => recos.setMeta(reco.id, { author: e.target.value })}
            placeholder="Ton pseudo (auteur)"
            className="bg-panel border border-border rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink
                       outline-none focus:border-accent"
          />
          <NoteEditor
            value={reco.note}
            max={NOTE_MAX}
            rows={3}
            label="Consignes générales"
            placeholder="Consignes valables pour tous les decks (ex. « toujours viser le heal en premier », « pas de def break sur les tanks »)…"
            onChange={(v) => recos.setMeta(reco.id, { note: v })}
          />
        </div>
      )}

      {/* Résultat d'analyse : ce qui ne passe pas, deck par deck */}
      {!editing && match && (
        <AnalysisSummary
          reco={reco}
          match={match}
          monsterByCom2us={monsterByCom2us}
          onClear={onClearAnalysis}
        />
      )}

      {!editing && expanded && reco.note && <NoteBlock text={reco.note} label="Consignes générales" />}

      {/* Repliée : un aperçu d'une ligne — le nom de chaque deck et sa pastille
          de statut, pour savoir quoi ouvrir sans tout déplier. */}
      {!expanded && (
        <button
          onClick={() => onToggleOpen(reco.id)}
          className="w-full flex flex-wrap items-center gap-1.5 text-left"
          title="Consulter cette recommandation"
        >
          {reco.decks.map((deck, di) => {
            const st = match?.decks[di]?.status ?? 'unknown';
            return (
              <span
                key={di}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel2/60
                           px-2 py-0.5 text-[11.5px] text-ink-dim"
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-none ${DOT[st]}`} />
                {deckLabel(deck, monsterByCom2us, di)}
              </span>
            );
          })}
          {reco.note && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-dim">
              <StickyNote size={11} className="text-star" /> consignes
            </span>
          )}
        </button>
      )}

      {/* Les decks de la recommandation */}
      {expanded && (
        <>
          {reco.decks.length > 1 && (
            <div className="flex justify-end mb-1.5">
              <button
                onClick={() =>
                  setOpenDecks((s) =>
                    s.size === reco.decks.length ? new Set() : new Set(reco.decks.map((_, i) => i))
                  )
                }
                className="font-mono text-[11px] text-ink-dim hoverable:text-ink transition underline"
              >
                {openDecks.size === reco.decks.length ? 'Replier tous les decks' : 'Déplier tous les decks'}
              </button>
            </div>
          )}
          {/* Les decks se posent au dépliage plutôt que d'apparaître d'un bloc.
              ⚠️ L'animation est sur CE conteneur, déjà présent, et non sur un
              `<div>` ajouté autour du fragment : un wrapper de plus casserait
              l'espacement du parent pour un simple effet. */}
          <div className="flex flex-col gap-2.5 animate-[apparition_180ms_var(--ease-out)]">
            {reco.decks.map((deck, di) => (
              <DeckBlock
                key={di}
                reco={reco}
                deck={deck}
                deckIndex={di}
                monsters={monsters}
                monsterByCom2us={monsterByCom2us}
                match={match?.decks[di] ?? null}
                editing={editingDeck === di}
                onToggleEdit={() => setEditingDeck((cur) => (cur === di ? null : di))}
                folded={!openDecks.has(di) && editingDeck !== di}
                onToggleFold={() => toggleDeck(di)}
                recos={recos}
              />
            ))}
          </div>
        </>
      )}

      {editing && (
        <div className="mt-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                recos.addDeck(reco.id);
                setEditingDeck(reco.decks.length); // le nouveau deck s'ouvre en édition
              }}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-panel/50
                         px-3 py-1.5 text-[12.5px] text-ink-dim hoverable:text-ink hoverable:border-accent transition"
            >
              <Plus size={14} /> Ajouter un deck vide
            </button>
            <button
              onClick={() => setPickOffense((v) => !v)}
              disabled={offenseTeams.length === 0}
              title={
                offenseTeams.length === 0
                  ? "Aucune équipe d'offense : importe ton compte (barre du haut) après avoir sauvegardé tes attaques en jeu."
                  : "Partir d'une de tes équipes d'offense (monstres, sets, artéfacts et stats réels pré-remplis)"
              }
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] transition
                disabled:opacity-40 disabled:cursor-not-allowed ${
                  // Fond seul — voir spec/shared/design.md.
                  pickOffense
                    ? 'border-border bg-accent-soft text-ink'
                    : 'border-dashed border-border bg-panel/50 text-ink-dim hoverable:text-ink hoverable:border-accent'
                }`}
            >
              <Swords size={14} /> Importer un deck d'offense
              <span className="font-mono text-[11px] opacity-70">{offenseTeams.length}</span>
            </button>
          </div>

          {pickOffense && offenseTeams.length > 0 && (
            <div className="mt-2 rounded-xl border border-border bg-panel/60 p-2">
              <p className="label mb-1.5">
                Tes équipes d'offense — les stats du build sont reprises comme minimums
              </p>

              {/* Recherche par monstre : avec ~50 attaques sauvegardées, c'est
                  le seul moyen de retrouver une équipe. */}
              <div className="relative mb-1.5">
                <Search
                  size={13}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none"
                />
                <input
                  value={offenseQuery}
                  onChange={(e) => setOffenseQuery(e.target.value)}
                  placeholder="Filtrer par monstre…"
                  className="w-full bg-panel border border-border rounded-lg pl-7 pr-2 py-1 text-[12px]
                             text-ink placeholder:text-ink-dim outline-none focus:border-accent"
                />
              </div>

              <div className="max-h-[240px] overflow-y-auto flex flex-col gap-1">
                {filteredOffense.map(({ team, index, summary, monsters: trio }) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      // Nom laissé vide → il reprend les noms des monstres.
                      recos.addDeckWith(reco.id, deckFromSiegeTeam(team, monsterById));
                      setEditingDeck(reco.decks.length); // prêt à ajuster
                      setPickOffense(false);
                      setOffenseQuery('');
                    }}
                    title={summary}
                    className="flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-1.5
                               hoverable:border-accent transition"
                  >
                    <span className="font-mono text-[11px] text-ink-dim flex-none">#{index + 1}</span>
                    <span className="flex items-center gap-1.5 flex-1">
                      {trio.map((m, i) => (
                        <MiniMonster key={i} monster={m} size={30} />
                      ))}
                    </span>
                    <Plus size={13} className="flex-none text-ink-dim" />
                  </button>
                ))}
                {filteredOffense.length === 0 && (
                  <p className="px-1 py-2 text-[12px] text-ink-dim">Aucune équipe avec ce monstre.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Nom de chaque sorte d'artéfact, tel que le jeu les appelle.
const LIBELLE_KIND: Record<ArtifactKind, string> = { element: "d'attribut", archetype: 'de type' };

/* ---- Rapport d'analyse -------------------------------------------------- */

// Pourquoi un slot ne passe pas, en une ligne lisible.
function slotProblem(
  slot: RecoSlot,
  sm: SlotMatch,
  byCom2us: Map<number, Monster>
): string | null {
  if (sm.status === 'ok' || sm.status === 'empty' || sm.status === 'unknown') return null;
  const nom = (slot.com2usId != null ? byCom2us.get(slot.com2usId)?.name : null) ?? slot.name ?? '?';
  if (sm.status === 'absent') return `${nom} — monstre indisponible`;

  const bouts: string[] = [];
  // Le runage d'abord : reruner change les stats, l'inverse n'est pas vrai.
  if (sm.missingSets.length) bouts.push(`set ${sm.missingSets.join(' + ')} manquant`);
  for (const c of sm.artifactChecks) {
    if (!c.ok) bouts.push(`artéfact ${LIBELLE_KIND[c.kind]} : ${c.label} absent`);
  }
  for (const c of sm.checks) {
    if (!c.ok && c.actual !== null) {
      bouts.push(`${c.label} ${fmtStat(c.actual)}${c.suffix} au lieu de ${fmtStat(c.required)}${c.suffix}`);
    }
  }
  return `${nom} — ${bouts.join(' · ')}`;
}

// Verdict d'un deck qui ne passe pas. On dit toujours si c'est **faisable** ou
// non : « à composer » (tu as les monstres) vs « impossible » (il t'en manque).
// ⚠️ `ko` n'a pas de libellé fixe : la cause dépend du deck (runage, stats, ou
// les deux) — voir `deckFault`.
function deckProblem(dm: DeckMatch): string {
  if (dm.status === 'missing') return 'monstre indisponible — deck impossible';
  if (dm.status === 'nodeck') return 'aucun deck avec ces monstres — tu peux le composer';
  if (dm.status === 'ko') return libelleCausesDeck(deckFaults(dm.slots)) || 'critères non respectés';
  return '';
}

// Synthèse après « Analyser » : combien de decks passent, et le détail de ceux
// qui ne passent pas. C'est le livrable de l'analyse — il reste visible même
// recommandation repliée.
function AnalysisSummary({
  reco,
  match,
  monsterByCom2us,
  onClear,
}: {
  reco: Reco;
  match: RecoMatch;
  monsterByCom2us: Map<number, Monster>;
  onClear: () => void;
}) {
  const rates = reco.decks
    .map((deck, i) => ({ deck, i, dm: match.decks[i] }))
    .filter(({ dm }) => dm && dm.status !== 'ok' && dm.status !== 'unknown');

  // Referme le résultat : la carte redevient neutre (halo et pastille compris).
  const closeBtn = (
    <button
      onClick={onClear}
      className="ml-auto flex-none text-ink-dim hoverable:text-ink transition"
      title="Masquer le résultat de l'analyse"
      aria-label="Masquer le résultat de l'analyse"
    >
      <X size={14} />
    </button>
  );

  if (match.totalDecks === 0) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-panel/60 px-3 py-2">
        <p className="text-[12.5px] text-ink-dim">Rien à analyser : aucun deck rempli.</p>
        {closeBtn}
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-good/40 bg-good/10 px-3 py-2">
        <Check size={15} className="flex-none text-good" />
        <p className="text-[12.5px] text-good">
          Tout est respecté : les <b>{match.totalDecks}</b> deck(s) sont jouables avec tes monstres.
        </p>
        {closeBtn}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-warn/40 bg-warn/5 px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle size={15} className="flex-none text-warn" />
        <p className="text-[12.5px] font-semibold text-warn">
          {match.okDecks}/{match.totalDecks} deck(s) au niveau · {rates.length} à corriger
        </p>
        {closeBtn}
      </div>
      <ul className="space-y-1.5">
        {rates.map(({ deck, i, dm }) => (
          <li key={i}>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={`w-1.5 h-1.5 rounded-full flex-none self-center ${DOT[dm.status]}`} />
              <span className="text-[12px] font-semibold text-ink">
                {deckLabel(deck, monsterByCom2us, i)}
              </span>
              <span
                className={`font-mono text-[10.5px] ${
                  dm.status === 'nodeck' ? 'text-warn' : 'text-fire'
                }`}
              >
                {deckProblem(dm)}
              </span>
            </div>
            {/* « nodeck » : le détail par monstre n'apporte rien, il n'y a pas
                de build à confronter — le message du deck suffit. */}
            {dm.status !== 'nodeck' && (
              <ul className="ml-3 mt-0.5 space-y-0.5">
                {deck.slots.map((slot, si) => {
                  const txt = dm.slots[si] ? slotProblem(slot, dm.slots[si], monsterByCom2us) : null;
                  return txt ? (
                    <li key={si} className="text-[11.5px] text-ink-dim leading-snug">
                      • {txt}
                    </li>
                  ) : null;
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Un deck (3 monstres) ---------------------------------------------- */

// Pastille de statut d'un deck dans l'aperçu replié.
// `nodeck` = orange (à composer) ; `ko` et `missing` = rouge (bloquant).
const DOT: Record<string, string> = {
  ok: 'bg-good',
  nodeck: 'bg-warn',
  ko: 'bg-fire',
  missing: 'bg-fire',
  partial: 'bg-warn',
  unknown: 'bg-unknown',
};

const DECK_AURA: Record<string, string> = {
  ok: 'border-good/40 bg-good/[0.04]',
  nodeck: 'border-warn/50 bg-warn/[0.04]',
  ko: 'border-fire/50 bg-fire/[0.04]',
  missing: 'border-fire/50 bg-fire/[0.04]',
  partial: 'border-warn/50 bg-warn/[0.04]',
  unknown: 'border-border bg-panel2/40',
};

function DeckBlock({
  reco,
  deck,
  deckIndex,
  monsters,
  monsterByCom2us,
  match,
  editing,
  onToggleEdit,
  folded,
  onToggleFold,
  recos,
}: {
  reco: Reco;
  deck: RecoDeck;
  deckIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  match: DeckMatch | null;
  editing: boolean; // édition de CE deck (indépendante de celle de la reco)
  onToggleEdit: () => void;
  folded: boolean;
  onToggleFold: () => void;
  recos: UseRecoState;
}) {
  const [deckAConfirmer, setDeckAConfirmer] = useState(false);

  // Un monstre ne peut pas occuper deux slots du MÊME deck (il peut revenir
  // dans un autre deck de la recommandation).
  const usedIds = new Set(
    deck.slots
      .map((s) => (s.com2usId != null ? monsterByCom2us.get(s.com2usId) : null))
      .filter((m): m is Monster => !!m)
      .map((m) => String(m.id))
  );
  const status = match?.status ?? 'unknown';
  const empty = deck.slots.every((s) => s.com2usId == null);
  // Lead porté par le slot 0 du deck recommandé.
  const leaderId = deck.slots[0]?.com2usId;
  const leaderLead = leaderId != null ? monsterByCom2us.get(leaderId)?.leaderSkill ?? null : null;
  // Lead de VITESSE du deck (slot 0), pour le total de VIT des monstres.
  const leadInfo = leaderId != null ? speedLeadOf(monsterByCom2us.get(leaderId)) : null;

  return (
    <div className={`rounded-xl border p-2.5 ${DECK_AURA[empty ? 'unknown' : status]}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Chevron de repli : indispensable en édition avec plusieurs decks */}
        <button
          onClick={onToggleFold}
          aria-expanded={!folded}
          className="flex-none text-ink-dim hoverable:text-ink transition"
          title={folded ? 'Déplier ce deck' : 'Replier ce deck'}
        >
          <ChevronDown size={14} className={`transition-transform ${folded ? '-rotate-90' : ''}`} />
        </button>

        {editing && !folded ? (
          // Vide = nom automatique (visible en placeholder) ; on ne stocke que
          // ce que l'auteur choisit explicitement.
          <input
            value={deck.name}
            onChange={(e) => recos.setDeckMeta(reco.id, deckIndex, { name: e.target.value })}
            placeholder={autoDeckName(deck, monsterByCom2us, deckIndex)}
            title="Laisse vide pour reprendre les noms des monstres"
            className="min-w-[180px] flex-1 bg-panel border border-border rounded px-2 py-0.5 text-[12px]
                       text-ink outline-none focus:border-accent"
          />
        ) : (
          <button
            onClick={onToggleFold}
            className="label hoverable:text-ink transition text-left"
          >
            {deckLabel(deck, monsterByCom2us, deckIndex)}
          </button>
        )}
        {!editing && match && !empty && <DeckBadge match={match} />}
        {/* Le lead n'est pas dans l'en-tête : il est posé sur le leader lui-même
            (aperçu replié ci-dessous, ou slot 0 déplié) — comme en siège. */}

        {/* Replié : aperçu des 3 monstres en icônes, pour s'y retrouver */}
        {folded && (
          <button
            onClick={onToggleFold}
            className="flex items-center gap-1 flex-1 min-w-0"
            title="Déplier ce deck"
          >
            {deck.slots.map((sl, i) => (
              <MiniMonster
                key={i}
                monster={sl.com2usId != null ? monsterByCom2us.get(sl.com2usId) ?? null : null}
                fallback={sl.name}
                size={26}
                lead={i === 0 ? leaderLead : null}
              />
            ))}
          </button>
        )}

        {/* Édition PROPRE au deck (monstres, sets, stats, consignes) : icônes
            nues et resserrées, comme dans l'en-tête de la recommandation. */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={onToggleEdit}
            className={`flex items-center justify-center w-6 h-6 transition ${
              editing ? 'text-star' : 'text-ink-dim hoverable:text-ink'
            }`}
            title={editing ? "Terminer l'édition de ce deck" : 'Éditer ce deck'}
            aria-label={editing ? "Terminer l'édition de ce deck" : 'Éditer ce deck'}
            aria-pressed={editing}
          >
            {editing ? <Check size={13} /> : <Pencil size={12} />}
          </button>
          {editing && (
            <button
              onClick={() => setDeckAConfirmer(true)}
              className="flex items-center justify-center w-6 h-6 text-ink-dim hoverable:text-fire transition"
              title="Supprimer ce deck"
              aria-label="Supprimer ce deck"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {deckAConfirmer && (
        <ConfirmDialog
          titre="Supprimer ce deck ?"
          message="Ses trois slots et ses consignes seront perdus. Les autres decks de la recommandation restent en place."
          libelleAction="Supprimer"
          destructif
          onCancel={() => setDeckAConfirmer(false)}
          onConfirm={() => {
            setDeckAConfirmer(false);
            recos.removeDeck(reco.id, deckIndex);
          }}
        />
      )}

      {!folded && (
      <>

      {/* Consignes propres à ce deck */}
      {editing ? (
        <div className="mb-2">
          <NoteEditor
            value={deck.note}
            max={DECK_NOTE_MAX}
            rows={2}
            label="Consignes du deck"
            placeholder="Consignes pour ce deck (ex. « ne pas ouvrir sur le leader », « garder le strip pour le tour 2 »)…"
            onChange={(v) => recos.setDeckMeta(reco.id, deckIndex, { note: v })}
          />
        </div>
      ) : (
        deck.note && <NoteBlock text={deck.note} label="Consignes du deck" compact />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {deck.slots.map((slot, idx) => {
          const monster = slot.com2usId != null ? monsterByCom2us.get(slot.com2usId) ?? null : null;
          const sm = match?.slots[idx] ?? null;
          return (
            <div
              key={idx}
              // `min-w-0` : sans lui une cellule de grille refuse de descendre
              // sous la largeur de son contenu, et la carte déborde sur sa
              // voisine au lieu de laisser la table défiler à l'intérieur.
              className={`min-w-0 rounded-xl border p-2.5 ${
                // Indisponible ET stats insuffisantes sont tous deux bloquants → rouge.
                sm?.status === 'absent' || sm?.status === 'ko'
                  ? 'border-fire/70 ring-1 ring-fire/40 bg-fire/5'
                  : sm?.status === 'ok'
                    ? 'border-good/50 bg-good/[0.04]'
                    : 'border-border bg-panel2/60'
              }`}
            >
              {slot.com2usId == null ? (
                editing ? (
                  <div>
                    <div className="label mb-1.5">
                      {idx === 0 ? 'Leader' : `Slot ${idx + 1}`}
                    </div>
                    <MonsterPicker
                      monsters={monsters}
                      excludeIds={usedIds}
                      placeholder="Choisir un monstre…"
                      onPick={(id) => {
                        const m = monsters.find((x) => String(x.id) === id);
                        if (m && m.com2usId != null)
                          recos.setSlotMonster(reco.id, deckIndex, idx, m.com2usId, m.name);
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-[12px] text-ink-dim py-4 text-center">
                    {idx === 0 ? 'Leader' : 'Slot'} vide
                  </p>
                )
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <MonsterAvatar monster={monster} fallback={slot.name} size={40}>
                      {idx === 0 &&
                        (leaderLead ? (
                          <LeadBadge ls={leaderLead} size={20} />
                        ) : (
                          <Crown
                            size={13}
                            className="absolute -top-2 -left-1 text-star drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                          />
                        ))}
                    </MonsterAvatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold leading-tight truncate">
                        {monster?.name ?? slot.name ?? '—'}
                      </div>
                      {/* Pastille complète sous le nom du leader : ici on a la
                          place de montrer le montant, pas juste le badge. */}
                      {idx === 0 && leaderLead && (
                        <div className="mt-1">
                          <LeadPill ls={leaderLead} />
                        </div>
                      )}
                      {sm && <SlotBadge sm={sm} />}
                      {!monster && <div className="font-mono text-[10px] text-ink-dim">monstre inconnu</div>}
                    </div>
                    {editing && (
                      <button
                        onClick={() => recos.setSlotMonster(reco.id, deckIndex, idx, null, '')}
                        className="flex-none text-ink-dim hoverable:text-fire transition"
                        title="Vider le slot"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Sets de runes recommandés */}
                  <div className="mt-2 pt-2 border-t border-border/50">
                    {editing ? (
                      <SetEditor
                        options={slot.setOptions}
                        onAdd={(opt, k) => recos.addSlotSet(reco.id, deckIndex, idx, opt, k)}
                        onRemove={(opt, pos) =>
                          recos.removeSlotSet(reco.id, deckIndex, idx, opt, pos)
                        }
                        onAddOption={() => recos.addSetOption(reco.id, deckIndex, idx)}
                        onRemoveOption={(opt) => recos.removeSetOption(reco.id, deckIndex, idx, opt)}
                      />
                    ) : (
                      <SetList options={slot.setOptions} sm={sm} />
                    )}
                  </div>

                  {/* Stats recommandées */}
                  <div className="mt-2 pt-2 border-t border-border/50">
                    {editing ? (
                      <StatEditor
                        slot={slot}
                        monster={monster}
                        spdLead={spdLeadBonus(monster, leadInfo, slot.setOptions[0])}
                        onSet={(key, total) =>
                          recos.setSlotStat(reco.id, deckIndex, idx, key, total)
                        }
                      />
                    ) : (
                      <StatList
                        slot={slot}
                        monster={monster}
                        sm={sm}
                        spdLead={spdLeadBonus(monster, leadInfo, slot.setOptions[0])}
                      />
                    )}
                  </div>

                  {/* Propriétés d'artéfact recommandées, EN DERNIER : c'est le
                      critère le plus rarement renseigné, et la table de stats
                      reste ainsi à la même hauteur d'un slot à l'autre.
                      En lecture, le bloc disparaît si rien n'est exigé — en
                      édition il reste, sinon il n'y aurait aucun moyen d'en
                      ajouter. */}
                  {editing ? (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <ArtifactEditor
                        artifacts={slot.artifacts}
                        onAdd={(kind, code) =>
                          recos.addSlotArtifact(reco.id, deckIndex, idx, kind, code)
                        }
                        onRemove={(kind, code) =>
                          recos.removeSlotArtifact(reco.id, deckIndex, idx, kind, code)
                        }
                      />
                    </div>
                  ) : (
                    ARTIFACT_KINDS.some(({ key }) => (slot.artifacts?.[key] ?? []).length > 0) && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <ArtifactList artifacts={slot.artifacts} sm={sm} />
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Défenses adverses que ce deck bat. Sous les 3 monstres : c'est une
          information sur le DECK ENTIER, pas sur un slot — et le deck garde sa
          structure habituelle au-dessus. */}
      <CounterBlock
        deck={deck}
        reco={reco}
        deckIndex={deckIndex}
        monsters={monsters}
        monsterByCom2us={monsterByCom2us}
        recos={recos}
        editing={editing}
      />
      </>
      )}
    </div>
  );
}

// « Fort contre » — les défenses adverses face auxquelles ce deck fonctionne.
//
// ⚠️ **Purement informatif : rien n'est confronté au compte.** L'app ne connaît
// que MES équipes, pas celles des adversaires — il n'y a rien à quoi comparer.
// C'est un message de l'auteur vers le lecteur, comme une consigne, et il ne
// porte donc ni statut, ni badge, ni couleur de résultat.
//
// ⚠️ **En lecture, le bloc disparaît s'il est vide** : la plupart des decks n'en
// portent aucune, et un intitulé suivi de rien se lit comme une donnée manquante.
function CounterBlock({
  deck,
  reco,
  deckIndex,
  monsters,
  monsterByCom2us,
  recos,
  editing,
}: {
  deck: RecoDeck;
  reco: Reco;
  deckIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  recos: UseRecoState;
  editing: boolean;
}) {
  if (!editing && deck.counters.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-border/50">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Swords size={13} className="flex-none text-ink-dim" />
        <span className="label">Fort contre</span>
        {!editing && deck.counters.length > 1 && (
          <span className="font-mono text-[10.5px] text-ink-dim">{deck.counters.length}</span>
        )}
      </div>

      {editing && deck.counters.length === 0 && (
        <p className="mb-1.5 text-[11.5px] text-ink-dim">
          Les défenses que ce deck bat. Facultatif, et surtout utile à qui reçoit la
          recommandation.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {deck.counters.map((counter, ci) => (
          <CounterRow
            key={ci}
            counter={counter}
            reco={reco}
            deckIndex={deckIndex}
            counterIndex={ci}
            monsters={monsters}
            monsterByCom2us={monsterByCom2us}
            recos={recos}
            editing={editing}
          />
        ))}
      </div>

      {editing && (
        <button
          onClick={() => recos.addCounter(reco.id, deckIndex)}
          className="mt-1.5 rounded border border-border px-2 py-0.5 text-[10.5px] font-semibold
                     text-ink-dim transition hoverable:text-ink hoverable:border-accent"
        >
          + Défense
        </button>
      )}
    </div>
  );
}

// Une défense adverse : ses 3 monstres, et la condition éventuelle.
function CounterRow({
  counter,
  reco,
  deckIndex,
  counterIndex,
  monsters,
  monsterByCom2us,
  recos,
  editing,
}: {
  counter: RecoCounter;
  reco: Reco;
  deckIndex: number;
  counterIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  recos: UseRecoState;
  editing: boolean;
}) {
  // Un même monstre ne peut pas occuper deux emplacements de LA MÊME défense —
  // même règle que les slots d'un deck. Il peut revenir dans une autre défense.
  const usedIds = new Set(
    counter.monsters
      .map((m) => (m.com2usId != null ? monsterByCom2us.get(m.com2usId)?.id : null))
      .filter((id): id is string => id != null)
      .map(String)
  );

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-panel2/50 px-2 py-1.5">
        <div className="flex flex-none items-center gap-1">
          {counter.monsters.map((m, i) =>
            m.com2usId == null ? null : (
              <MiniMonster
                key={i}
                monster={monsterByCom2us.get(m.com2usId) ?? null}
                fallback={m.name}
                size={30}
              />
            )
          )}
        </div>
        {counter.note && (
          <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-dim">
            {counter.note}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-panel2/50 p-2">
      <div className="flex items-start gap-1.5">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
          {counter.monsters.map((m, i) => {
            const monster = m.com2usId != null ? monsterByCom2us.get(m.com2usId) ?? null : null;
            return (
              <div key={i} className="min-w-0">
                {m.com2usId == null ? (
                  <MonsterPicker
                    monsters={monsters}
                    excludeIds={usedIds}
                    placeholder={`Monstre ${i + 1}…`}
                    onPick={(id) => {
                      const mon = monsters.find((x) => String(x.id) === id);
                      // ⚠️ Même clé stable que partout : un monstre perso
                      // (`com2usId` nul) n'est pas partageable, donc pas retenu.
                      if (mon && mon.com2usId != null)
                        recos.setCounterMonster(
                          reco.id,
                          deckIndex,
                          counterIndex,
                          i,
                          mon.com2usId,
                          mon.name
                        );
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 rounded border border-border bg-panel px-1.5 py-1">
                    <MiniMonster monster={monster} fallback={m.name} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">
                      {monster?.name ?? m.name}
                    </span>
                    <button
                      onClick={() =>
                        recos.setCounterMonster(reco.id, deckIndex, counterIndex, i, null, '')
                      }
                      className="flex-none text-ink-dim transition hoverable:text-fire"
                      title="Retirer ce monstre"
                      aria-label="Retirer ce monstre"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button
          onClick={() => recos.removeCounter(reco.id, deckIndex, counterIndex)}
          className="mt-1 flex-none text-ink-dim transition hoverable:text-fire"
          title="Retirer cette défense"
          aria-label="Retirer cette défense"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Condition éventuelle — une ligne, pas un pavé : elle précise QUAND ça
          marche, elle ne redit pas comment jouer (c'est la consigne du deck). */}
      <input
        type="text"
        value={counter.note}
        maxLength={COUNTER_NOTE_MAX}
        onChange={(e) =>
          recos.setCounterNote(reco.id, deckIndex, counterIndex, e.target.value)
        }
        placeholder="Précision (ex. « si le Chloe est en lead »)…"
        className="mt-1.5 w-full rounded border border-border bg-panel px-1.5 py-1 text-[11.5px]
                   text-ink placeholder:text-ink-dim transition focus:border-accent"
      />
    </div>
  );
}

// Petit portrait hexagonal, sans nom — pour les aperçus compacts. Le portrait
// lui-même vient du composant partagé ; on n'ajoute ici que le badge de lead.
function MiniMonster({
  monster,
  fallback,
  size,
  lead,
}: {
  monster: Monster | null;
  fallback?: string;
  size: number;
  lead?: LeaderSkill | null;
}) {
  return (
    <MonsterAvatar monster={monster} fallback={fallback} size={size}>
      {lead && <LeadBadge ls={lead} size={Math.round(size * 0.62)} />}
    </MonsterAvatar>
  );
}

/* ---- Stats recommandées (édition) --------------------------------------- */

// Stat de recommandation → champ correspondant dans les données SWARFARM.
const BASE_OF: Record<RecoStatKey, keyof Monster['stats']> = {
  hp: 'hp',
  atk: 'attack',
  def: 'defense',
  spd: 'speed',
  cr: 'critRate',
  cd: 'critDamage',
  res: 'resistance',
  acc: 'accuracy',
};

// Base d'un monstre **6★ nu** (voir ../shared/donnees-monstres.md : les données
// portent les stats `max_lvl_*`, cohérentes avec le `con × 15` des exports SWEX).
// null = donnée absente (monstre perso) → le champ vaut alors le total.
function baseFor(key: RecoStatKey, monster: Monster | null): number | null {
  const raw = monster?.stats?.[BASE_OF[key]];
  return typeof raw === 'number' ? raw : null;
}

// Saisie des stats : **une seule colonne**, avec la stat de BASE du monstre
// rappelée, et un champ où l'on ne met que le **bonus à ajouter**. Le total
// (base + bonus) est affiché à droite — c'est lui qui est stocké et comparé,
// pour rester une valeur absolue même si les données de base évoluent.
function StatEditor({
  slot,
  monster,
  spdLead,
  onSet,
}: {
  slot: RecoSlot;
  monster: Monster | null;
  spdLead: number; // points de VIT ajoutés par le siège, au TOTAL seulement
  onSet: (key: RecoStatKey, total: number | null) => void;
}) {
  // ⚠️ La table ne doit JAMAIS se comprimer : en dessous de sa largeur mini elle
  // fait défiler DANS la carte, au lieu d'écraser les colonnes (le champ de
  // bonus finissait masqué) ou de déborder sur la carte voisine.
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[236px] text-[11.5px]">
      <thead>
        <tr className="label">
          <th className="pb-1 pr-2 text-left font-normal">Stat</th>
          <th className="pb-1 pr-2 text-right font-normal" title="Stat du monstre 6★ nu, sans runes">
            base
          </th>
          <th className="pb-1 pr-2 text-left font-normal">bonus</th>
          <th className="pb-1 text-right font-normal">total</th>
        </tr>
      </thead>
      <tbody>
        {RECO_STATS.map((st) => {
          const known = baseFor(st.key, monster);
          const base = known ?? 0; // base inconnue → le champ vaut le total
          const total = slot.stats[st.key];
          const bonus = total != null ? total - base : null;
          return (
            <tr key={st.key} className="border-b border-border/40 last:border-0">
              <td
                className="py-0.5 pr-2 text-ink-dim"
                title={st.key === 'spd' && spdLead > 0 ? SPD_HINT : undefined}
              >
                {st.label}
              </td>
              <td className="py-0.5 pr-2 text-right font-mono text-ink-dim tabular-nums">
                {known != null ? fmtStat(known) : '—'}
              </td>
              <td className="py-0.5 pr-2">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-good/70">+</span>
                  {/* Champ texte (et non `type=number`) : pas de boutons +/- à
                      droite, qui mangent la largeur d'une colonne déjà étroite.
                      `inputMode=numeric` garde le pavé numérique sur mobile.
                      `min-w-[5ch]` : 5 chiffres visibles au minimum — la plupart
                      des stats en ont autant (PV ~35 000), et sans ce plancher la
                      colonne se refermait jusqu'à masquer la valeur saisie. */}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bonus ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === '' || raw === '-') return onSet(st.key, null);
                      if (!/^-?\d+$/.test(raw)) return; // on ignore la frappe invalide
                      onSet(st.key, base + Number(raw));
                    }}
                    placeholder="—"
                    className="w-full min-w-[5ch] bg-panel border border-border rounded px-1 py-0.5
                               text-[11px] font-mono tabular-nums text-good
                               outline-none focus:border-accent"
                  />
                </div>
              </td>
              <td
                className={`py-0.5 text-right font-mono tabular-nums ${
                  total != null ? 'font-semibold text-ink' : 'text-ink-dim'
                }`}
              >
                {total != null
                  ? `${fmtStat(total + (st.key === 'spd' ? spdLead : 0))}${st.suffix}`
                  : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

/* ---- Consignes ---------------------------------------------------------- */

// Saisie d'une consigne : multi-lignes, avec compteur de caractères (le texte
// voyage dans le code partagé, d'où une longueur bornée).
function NoteEditor({
  value,
  onChange,
  label,
  placeholder,
  max,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  max: number;
  rows: number;
}) {
  const left = max - value.length;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="label">{label}</span>
        {left < max / 4 && (
          <span className={`font-mono text-[10px] ${left <= 0 ? 'text-fire' : 'text-ink-dim'}`}>
            {left} car.
          </span>
        )}
      </div>
      <textarea
        value={value}
        maxLength={max}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-panel border border-border rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink
                   outline-none focus:border-accent resize-y"
      />
    </div>
  );
}

// Affichage d'une consigne (les retours à la ligne de l'auteur sont conservés).
function NoteBlock({ text, label, compact }: { text: string; label: string; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-border bg-panel/60 px-2.5 py-1.5 ${compact ? 'mb-2' : 'mb-3'}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <StickyNote size={11} className="flex-none text-star" />
        <span className="label">{label}</span>
      </div>
      <p className="text-[12.5px] text-ink leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}

/* ---- Sets de runes recommandés ----------------------------------------- */

// Édition des runages recommandés : **plusieurs possibilités au choix**
// (« Violent/Némésis | Violent/Vengeance »). La confrontation n'en exige
// qu'UNE, d'où le séparateur « | » entre les combinaisons.
//
// Les sets ajoutés vont toujours dans la DERNIÈRE possibilité : on construit
// une combinaison, on clique « + Possibilité », et les clics suivants
// alimentent la nouvelle. Pas de notion de « possibilité sélectionnée » à gérer.
function SetEditor({
  options,
  onAdd,
  onRemove,
  onAddOption,
}: {
  options: string[][];
  onAdd: (option: number, key: string) => void;
  onRemove: (option: number, position: number) => void;
  onAddOption: () => void;
  onRemoveOption: (option: number) => void;
}) {
  // Possibilité VISÉE par les ajouts. Par défaut la dernière — on construit la
  // combinaison en cours. Cliquer une chip d'une autre possibilité la vise, ce
  // qui permet de revenir compléter une combinaison laissée incomplète
  // (« Violent » seul à côté d'un « Violent | Will » terminé).
  const [focus, setFocus] = useState<number | null>(null);
  const last = options.length - 1;
  const target = focus != null && focus <= last ? focus : last;
  const current = options[target] ?? [];
  const used = setsCost(current);
  const full = !RUNE_SETS.some((st) => canAddSet(current, st.key)); // plus rien ne rentre
  const [open, setOpen] = useState(false);

  // Le panneau se referme dès qu'il n'y a plus de set possible, sinon on
  // laisserait une grille entièrement grisée à l'écran.
  useEffect(() => {
    if (full) setOpen(false);
  }, [full]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="label">
          Runage{options.length > 1 ? ` · ${options.length} possibilités` : ''}
        </span>
        <span className="font-mono text-[10px] text-ink-dim">
          {used}/{MAX_SET_PIECES} runes
        </span>
      </div>

      {options.some((o) => o.length > 0) && (
        <div className="flex flex-wrap items-center gap-1 mb-1">
          {options.map((sets, oi) => {
            const vise = oi === target && options.length > 1;
            return (
              <span key={oi} className="flex flex-wrap items-center gap-1">
                {oi > 0 && <span className="px-0.5 font-mono text-[12px] text-ink-dim">|</span>}
                <span
                  className={`flex flex-wrap items-center gap-1 rounded-md ${
                    vise ? 'ring-1 ring-accent px-1 py-0.5' : ''
                  }`}
                >
                  {sets.length === 0 ? (
                    <span className="font-mono text-[10px] text-ink-dim italic">vide</span>
                  ) : (
                    sets.map((key, pos) => (
                      <span
                        key={pos}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-panel pl-1 pr-1.5 py-0.5"
                      >
                        {/* Cliquer la chip VISE sa possibilité : c'est ainsi
                            qu'on revient compléter une combinaison laissée
                            incomplète. Bouton distinct du ✕ (pas de bouton
                            imbriqué). */}
                        <button
                          onClick={() => setFocus(oi)}
                          title={
                            oi === target
                              ? 'Les sets ajoutés vont dans cette possibilité'
                              : 'Éditer cette possibilité'
                          }
                          className="inline-flex items-center gap-1"
                        >
                          <RuneIcon setKey={key} size={14} />
                          <span className="text-[10.5px] text-ink">×{setPieces(key)}</span>
                        </button>
                        <button
                          onClick={() => onRemove(oi, pos)}
                          className="text-ink-dim hoverable:text-fire transition"
                          title="Retirer ce set"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Les deux actions sur la MÊME ligne : ajouter un set à la combinaison en
          cours, ou en ouvrir une nouvelle. */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={full}
          aria-expanded={open}
          className="flex-1 flex items-center justify-center gap-1 rounded border border-border bg-panel
                     px-1.5 py-1 text-[11px] font-semibold text-ink-dim transition
                     hoverable:text-ink hoverable:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {full ? 'Plus de place (6 runes)' : '+ Set'}
        </button>
        <button
          onClick={() => {
            onAddOption();
            setFocus(null); // la nouvelle possibilité (la dernière) devient la cible
            setOpen(true); // on enchaîne directement sur le choix des sets
          }}
          disabled={(options[last] ?? []).length === 0}
          title={
            (options[last] ?? []).length === 0
              ? 'Complète la combinaison en cours avant d’en proposer une autre'
              : 'Proposer un autre runage possible — un seul suffira'
          }
          className="flex items-center justify-center gap-0.5 rounded border border-border bg-panel
                     px-2 py-1 text-[11px] font-semibold text-ink-dim transition
                     hoverable:text-ink hoverable:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={11} /> Possibilité
        </button>
      </div>

      {/* Choix par ICÔNES plutôt que par menu déroulant : on reconnaît un set du
          jeu à son symbole, pas à son nom dans une liste. Le panneau reste
          ouvert pour enchaîner les ajouts, et se referme tout seul dès que les
          6 runes sont prises — il n'y a alors plus rien à cliquer. */}
      {open && !full && (
        <div className="mt-1 rounded-lg border border-border bg-panel p-1.5">
          <div className="flex flex-wrap gap-1">
            {RUNE_SETS.map((st) => {
              const fits = canAddSet(current, st.key);
              return (
                <button
                  key={st.key}
                  onClick={() => onAdd(target, st.key)}
                  disabled={!fits}
                  title={
                    fits
                      ? `${st.label} — ${setPieces(st.key)} runes`
                      : `${st.label} — ${setPieces(st.key)} runes : il ne reste pas la place`
                  }
                  aria-label={st.label}
                  className={`flex items-center justify-center w-8 h-8 rounded-md border transition
                    ${
                      fits
                        ? 'bg-panel2 border-border hoverable:border-accent'
                        : 'bg-panel border-border opacity-25 cursor-not-allowed'
                    }`}
                >
                  <RuneIcon setKey={st.key} size={20} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Artéfacts ---------------------------------------------------------- */

// Édition des propriétés secondaires exigées, **une liste par sorte
// d'artéfact** (attribut, type), 4 au plus chacune — les 4 emplacements du jeu.
//
// ⚠️ Liste DÉROULANTE et non grille d'icônes comme les sets : il y a une
// quarantaine de propriétés, toutes textuelles, et aucune n'a de symbole dans
// le jeu. Une grille serait un mur de texte ; un `<select>` natif se filtre au
// clavier et se manipule au doigt.
//
// ⚠️ Les propriétés déjà exigées sont retirées de la liste, et celles qui
// n'existent pas sur cette sorte d'artéfact n'y ont jamais figuré
// (`artifactSubsFor`) : on ne propose pas « Dégâts sur le Feu » sur un artéfact
// de type, où il ne pourrait jamais être satisfait.
function ArtifactEditor({
  artifacts,
  onAdd,
  onRemove,
}: {
  artifacts: Record<ArtifactKind, number[]>;
  onAdd: (kind: ArtifactKind, code: number) => void;
  onRemove: (kind: ArtifactKind, code: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="label">Artéfacts</span>
      {ARTIFACT_KINDS.map(({ key, label }) => {
        const choisis = artifacts?.[key] ?? [];
        const plein = choisis.length >= MAX_ARTIFACT_SUBS;
        const dispo = artifactSubsFor(key).filter((o) => !choisis.includes(o.code));
        return (
          <div key={key}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-ink-dim">{label}</span>
              <span className="font-mono text-[10px] text-ink-dim">
                {choisis.length}/{MAX_ARTIFACT_SUBS}
              </span>
            </div>

            {choisis.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 my-1">
                {choisis.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-panel pl-1.5 pr-1 py-0.5"
                  >
                    <span className="text-[10.5px] text-ink">{artifactSubLabel(code)}</span>
                    <button
                      onClick={() => onRemove(key, code)}
                      className="text-ink-dim hoverable:text-fire transition"
                      title="Retirer cette propriété"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* `value=""` en permanence : le menu sert à AJOUTER, pas à porter
                une sélection courante — sinon le dernier ajout resterait
                affiché comme s'il était encore modifiable là. */}
            <select
              value=""
              disabled={plein || dispo.length === 0}
              onChange={(e) => {
                const code = Number(e.target.value);
                if (code) onAdd(key, code);
              }}
              className="mt-0.5 w-full rounded border border-border bg-panel px-1.5 py-1 text-[11px]
                         text-ink-dim transition hoverable:text-ink hoverable:border-accent
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">
                {plein ? `Les ${MAX_ARTIFACT_SUBS} propriétés sont prises` : '+ Propriété…'}
              </option>
              {/* `artifactSubsFor` les rend déjà dans l'ordre du JEU — le même
                  que le filtre de l'inventaire d'artéfacts. */}
              {dispo.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

// Vue : les propriétés d'artéfact exigées, marquées ✓/✗ après analyse. Rien
// n'est affiché si aucune n'est exigée — la majorité des recommandations ne
// portent que sur les runes et les stats, ce bloc ne doit pas les alourdir.
function ArtifactList({
  artifacts,
  sm,
}: {
  artifacts: Record<ArtifactKind, number[]>;
  sm: SlotMatch | null;
}) {
  const rien = ARTIFACT_KINDS.every(({ key }) => (artifacts?.[key] ?? []).length === 0);
  if (rien) return null;
  // Après analyse seulement : sans build confronté, un ✗ sur chaque ligne
  // ferait croire à un manque alors que rien n'a été vérifié.
  const analyse = !!sm && sm.status !== 'empty' && sm.status !== 'unknown' && !!sm.owned;
  const etat = new Map(sm?.artifactChecks.map((c) => [`${c.kind}:${c.code}`, c.ok]) ?? []);

  return (
    <div className="space-y-1">
      <span className="label">Artéfacts</span>
      {ARTIFACT_KINDS.map(({ key, label }) => {
        const codes = artifacts?.[key] ?? [];
        if (codes.length === 0) return null;
        return (
          <div key={key} className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[10px] text-ink-dim">{label}</span>
            {codes.map((code) => {
              const ok = analyse ? etat.get(`${key}:${code}`) ?? false : null;
              return (
                <span
                  key={code}
                  title={
                    ok === null
                      ? undefined
                      : ok
                        ? 'Propriété présente sur son artéfact'
                        : `Propriété absente de l'artéfact ${LIBELLE_KIND[key]} de ton exemplaire`
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
                    ok === null
                      ? 'border-border bg-panel'
                      : ok
                        ? 'border-good/50 bg-good/10'
                        : 'border-fire/50 bg-fire/10'
                  }`}
                >
                  <span className={`text-[10.5px] ${ok === false ? 'text-fire' : 'text-ink'}`}>
                    {artifactSubLabel(code)}
                  </span>
                  {ok === true && <Check size={10} className="text-good" />}
                  {ok === false && <X size={10} className="text-fire" />}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Vue : les runages recommandés. Plusieurs possibilités sont séparées par
// « ou » — **une seule suffit**. Après analyse, seule la possibilité RETENUE
// (`matchedOption`, la plus proche d'être satisfaite) est marquée ✓/✗ ; les
// autres restent neutres, sinon on afficherait des manques sur un runage que le
// joueur n'a pas choisi.
function SetList({ options, sm }: { options: string[][]; sm: SlotMatch | null }) {
  const opts = options?.length ? options : [[]];
  if (opts.every((o) => o.length === 0)) {
    return <p className="font-mono text-[10.5px] text-ink-dim">Aucun set recommandé</p>;
  }
  const analysed = !!sm && sm.status !== 'empty';
  const retenue = sm?.matchedOption ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {opts.map((sets, oi) => {
        // On consomme la liste des manquants pour marquer les bonnes occurrences.
        const pool = analysed && oi === retenue ? [...(sm?.missingSets ?? [])] : null;
        return (
          <span key={oi} className="flex flex-wrap items-center gap-1">
            {oi > 0 && <span className="px-0.5 font-mono text-[12px] text-ink-dim">|</span>}
            {sets.length === 0 ? (
              <span className="font-mono text-[10.5px] text-ink-dim italic">aucun set</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1">
                {sets.map((key, i) => {
                  let ok: boolean | null = null;
                  if (pool) {
                    const j = pool.indexOf(key);
                    if (j >= 0) {
                      pool.splice(j, 1);
                      ok = false; // manquant
                    } else ok = true; // porté
                  }
                  return (
                    <span
                      key={i}
                      title={
                        ok === null ? undefined : ok ? 'Set porté' : `Set ${key} manquant sur ton exemplaire`
                      }
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
                        ok === null
                          ? 'border-border bg-panel'
                          : ok
                            ? 'border-good/50 bg-good/10'
                            : 'border-fire/50 bg-fire/10'
                      }`}
                    >
                      <RuneIcon setKey={key} size={14} />
                      <span className={`text-[10.5px] ${ok === false ? 'text-fire' : 'text-ink'}`}>
                        ×{setPieces(key)}
                      </span>
                      {ok === true && <Check size={10} className="text-good" />}
                      {ok === false && <X size={10} className="text-fire" />}
                    </span>
                  );
                })}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ---- Badges de statut --------------------------------------------------- */

// Pastille globale de la recommandation : combien de decks sont jouables.
// Porte elle aussi une croix : c'est le repère le plus visible une fois la carte
// repliée, on doit pouvoir effacer l'analyse depuis là.
function StatusPill({ match, onClear }: { match: RecoMatch; onClear: () => void }) {
  const map = {
    ok: {
      text: `${match.totalDecks} deck${match.totalDecks > 1 ? 's' : ''} jouable${match.totalDecks > 1 ? 's' : ''}`,
      cls: 'border-good/50 text-good bg-good/10',
      Icon: Check,
    },
    partial: {
      text: `${match.okDecks}/${match.totalDecks} deck${match.totalDecks > 1 ? 's' : ''} au niveau`,
      cls: 'border-warn/50 text-warn bg-warn/10',
      Icon: AlertTriangle,
    },
    missing: { text: 'Aucun deck jouable', cls: 'border-fire/50 text-fire bg-fire/10', Icon: X },
    unknown: { text: '—', cls: 'border-border text-ink-dim', Icon: HelpCircle },
  }[match.status];
  const Icon = map.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border pl-2 pr-1 py-0.5 text-[11px] font-semibold ${map.cls}`}
    >
      <Icon size={11} /> {map.text}
      <button
        onClick={onClear}
        className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full opacity-60 hoverable:opacity-100 transition"
        title="Masquer le résultat de l'analyse"
        aria-label="Masquer le résultat de l'analyse"
      >
        <X size={11} />
      </button>
    </span>
  );
}

// Badge d'un deck : le verdict en trois mots, + l'équipe retenue si trouvée.
function DeckBadge({ match }: { match: DeckMatch }) {
  const map: Record<string, { cls: string; text: string }> = {
    ok: { cls: 'text-good', text: `jouable${match.team ? ` · ${match.team}` : ''}` },
    nodeck: { cls: 'text-warn', text: 'aucun deck avec ces monstres — à composer' },
    ko: {
      cls: 'text-fire',
      text: `${libelleCausesDeck(deckFaults(match.slots)) || 'critères non respectés'}${match.team ? ` · ${match.team}` : ''}`,
    },
    missing: { cls: 'text-fire', text: 'monstre indisponible — deck impossible' },
  };
  const m = map[match.status];
  if (!m) return null;
  return <span className={`font-mono text-[10.5px] ${m.cls}`}>· {m.text}</span>;
}

// Libellés courts d'une cause de rejet — voir `slotFaults` dans recoMatch.ts.
// Les causes sont déjà rendues dans l'ordre du geste à faire (runage, artéfacts,
// puis stats) ; il n'y a plus qu'à les joindre.
const LIBELLE_CAUSE_SLOT: Record<FaultCause, string> = {
  sets: 'mauvais set de runes',
  artifacts: 'mauvaise statistique',
  stats: 'stats insuffisantes',
};

// ⚠️ Côté deck, un NOM suivi de « à revoir » plutôt que « non respecté(e)s » :
// la formule est invariable, donc elle se combine sans accord — « runage,
// artéfacts et stats à revoir » se construit tout seul, quel que soit le
// nombre de causes.
const NOM_CAUSE_DECK: Record<FaultCause, string> = {
  sets: 'runage',
  artifacts: 'artéfacts',
  stats: 'stats',
};

function enumerer(morceaux: string[]): string {
  if (morceaux.length <= 1) return morceaux[0] ?? '';
  return `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}`;
}

function libelleCausesSlot(causes: FaultCause[]): string {
  return causes.map((c) => LIBELLE_CAUSE_SLOT[c]).join(' · ');
}

function libelleCausesDeck(causes: FaultCause[]): string {
  return causes.length ? `${enumerer(causes.map((c) => NOM_CAUSE_DECK[c]))} à revoir` : '';
}

// Badge sous le nom du monstre : possédé ? au niveau ? et d'après quel build
// (box, RTA, défense/offense de siège) — utile quand plusieurs presets existent.
function SlotBadge({ sm }: { sm: SlotMatch }) {
  if (sm.status === 'absent')
    return <div className="font-mono text-[10px] text-fire">monstre indisponible</div>;
  if (sm.status === 'unknown')
    // Possédé, mais aucun deck existant ne le réunit aux autres → rien à comparer.
    return <div className="font-mono text-[10px] text-ink-dim">possédé</div>;
  if (sm.status === 'ok')
    return (
      <div className="font-mono text-[10px] text-good" title={`Deck retenu : ${sm.owned?.label}`}>
        au niveau
      </div>
    );
  if (sm.status === 'ko')
    return (
      <div className="font-mono text-[10px] text-fire" title={`Deck retenu : ${sm.owned?.label}`}>
        {libelleCausesSlot(slotFaults(sm)) || 'critères non respectés'}
      </div>
    );
  return null;
}

// Liste « stat : minimum » avec, si un compte est chargé, la valeur réelle et
// l'écart (vert = atteint, rouge = il manque X).
function StatList({
  slot,
  monster,
  sm,
  spdLead,
}: {
  slot: RecoSlot;
  monster: Monster | null;
  sm: SlotMatch | null;
  spdLead: number; // points de VIT ajoutés par le siège, au TOTAL seulement
}) {
  const entries = RECO_STATS.filter((st) => (slot.stats[st.key] ?? 0) > 0);
  if (entries.length === 0) {
    return <p className="font-mono text-[10.5px] text-ink-dim">Aucune stat recommandée</p>;
  }
  const checkOf = (key: RecoStatKey) => sm?.checks.find((c) => c.key === key) ?? null;
  // La colonne « toi » n'a de sens qu'après une analyse.
  const analyse = !!sm && sm.checks.some((c) => c.actual !== null);

  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[236px] text-[11px]">
      <thead>
        <tr className="label">
          <th className="pb-1 pr-1.5 text-left font-normal">Stat</th>
          <th className="pb-1 pr-1.5 text-right font-normal" title="Stat du monstre 6★ nu">
            base
          </th>
          <th className="pb-1 pr-1.5 text-right font-normal">bonus</th>
          <th className="pb-1 text-right font-normal">total</th>
          {analyse && <th className="pb-1 pl-1.5 text-right font-normal">toi</th>}
        </tr>
      </thead>
      <tbody>
        {entries.map((st) => {
          const req = slot.stats[st.key]!;
          const known = baseFor(st.key, monster);
          const bonus = known != null ? req - known : null;
          const c = checkOf(st.key);
          // Stat non respectée → ligne mise en évidence (fond rouge léger), pour
          // qu'on voie d'un coup CE qui bloque sans lire les chiffres.
          const rate = analyse && c && c.actual !== null && !c.ok;
          // Le bonus du siege (totem + lead) n'entre que dans les TOTAUX : la base
          // et le bonus affiches restent les valeurs visibles du build.
          const add = st.key === 'spd' ? spdLead : 0;
          return (
            <tr
              key={st.key}
              className={`border-b border-border/40 last:border-0 ${rate ? 'bg-fire/10' : ''}`}
            >
              <td
                className={`py-0.5 pr-1.5 ${rate ? 'text-fire font-semibold' : 'text-ink-dim'}`}
                title={add > 0 ? SPD_HINT : undefined}
              >
                {st.label}
              </td>
              <td className="py-0.5 pr-1.5 text-right font-mono text-ink-dim tabular-nums">
                {known != null ? fmtStat(known) : '—'}
              </td>
              <td className="py-0.5 pr-1.5 text-right font-mono text-good tabular-nums">
                {bonus != null ? `+${fmtStat(bonus)}` : '—'}
              </td>
              <td className="py-0.5 text-right font-mono font-semibold text-ink tabular-nums">
                {fmtStat(req + add)}
                {st.suffix}
              </td>
              {analyse && (
                <td
                  className={`py-0.5 pl-1.5 text-right font-mono font-semibold tabular-nums ${
                    c ? (c.ok ? 'text-good' : 'text-fire') : 'text-ink-dim'
                  }`}
                  title={
                    c && c.actual !== null && !c.ok
                      ? `Il te manque ${fmtStat(-c.diff)}${st.suffix}`
                      : undefined
                  }
                >
                  {c && c.actual !== null ? (
                    <>
                      {fmtStat(c.actual + add)}
                      {st.suffix}
                      {!c.ok && <span className="text-fire/70"> (−{fmtStat(-c.diff)})</span>}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
