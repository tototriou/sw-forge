import {
  Crown,
  Trash2,
  Pencil,
  Upload,
  X,
  Check,
  AlertTriangle,
  Plus,
  StickyNote,
  Download,
  ChevronDown,
  Swords,
  Search,
  Gauge,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRecalageEcran } from '../../hooks/useRecalageEcran';
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
import { DeckHit, RecoHit } from '../../lib/recoSearch';
import { ConfirmDialog } from '../../ui/Dialogs';
import { Bouton, BoutonIcone, Champ, Selecteur, ZoneCliquable } from '../../ui';
import { NOTE_MAX, DECK_NOTE_MAX, COUNTER_NOTE_MAX } from '../../lib/recoShare';
import { deckFromSiegeTeam } from '../../lib/recoFromSiege';
import {
  artifactSubLabel,
  artifactSubsFor,
  setPieces,
  setsCost,
  canAddSet,
  INTANGIBLE_SET,
  MAX_SET_PIECES,
} from '../../lib/effects';
import { UseRecoState } from '../../hooks/useSiegeRecos';
import RuneIcon from '../RuneIcon';
import MonsterPicker from '../MonsterPicker';
import MonsterAvatar from '../MonsterAvatar';
import LeadPill, { LeadBadge } from './LeadPill';


// ⚠️ **UNE reco affiche des stats de FICHE** : celles que le jeu montre sur la
// carte du monstre, runes posées, AVANT le combat. Rien d'autre n'y entre.
//
// La colonne « total » de la VIT ajoutait le bonus de siège (totem de guilde
// +15 % et lead du deck), pour y lire la vitesse de combat des cartes d'équipe.
// Trois conséquences, toutes mauvaises :
//
//  - le total ne valait plus base + bonus — « 107 + 105 » s'affichait « 245 »,
//    et la ligne se lisait comme une erreur de calcul ;
//  - la colonne « actuel » recevait le même bonus, alors que le VERDICT
//    (`ok`/`ko`, voir recoMatch.ts) se calcule sur la stat de fiche : on
//    pouvait lire deux nombres égaux sur une ligne marquée en rouge ;
//  - c'est la stat de fiche qu'on relève dans le jeu quand on rune un monstre,
//    et c'est elle que l'Optimiseur cherche à atteindre.
//
// La vitesse de COMBAT reste affichée là où elle décide de quelque chose : sur
// les cartes d'équipe de siège et dans le speed tuning, où l'ordre de tour se
// joue. Voir ../../spec/siege/recommandations.md.


// Nom d'un deck : les noms de ses monstres séparés par un tiret
// (« Trevor - Bella - Loren »), sinon « Deck N » tant qu'il est vide. On se
// rabat sur le nom stocké dans le slot si le monstre est absent des données
// chargées.
//
// ⚠️ **Plus de titre saisi par l'auteur.** `deck.name` existait pour un titre
// libre (« Def anti-Chloé ») ; il pouvait dater une fois le deck modifié,
// redoubler ce que les portraits montrent déjà, ou rester vide et donc
// identique à ce nom automatique. `deckLabel` calcule toujours ce nom, sans
// jamais lire `deck.name` — le champ reste dans le TYPE et le stockage pour
// la rétrocompatibilité d'un import, mais n'est plus affiché.
function deckLabel(deck: RecoDeck, byCom2us: Map<number, Monster>, index: number): string {
  const noms = deck.slots
    .map((s) => (s.com2usId != null ? byCom2us.get(s.com2usId)?.name ?? s.name : ''))
    .filter(Boolean);
  return noms.length ? noms.join(' - ') : `Deck ${index + 1}`;
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
  // Où le monstre cherché se trouve dans CETTE recommandation, `null` hors
  // recherche. Sert à déplier les bons decks et à surligner les bons portraits.
  hit?: RecoHit | null;
}

// Aura selon la confrontation avec la box (même langage visuel que les équipes
// de siège) : vert = OK, orange = partiel, rouge = bloqué, neutre = pas de compte.
// ⚠️ Fonds à /10 et non /5 : sur fond clair, un aplat à 5 % ne se distingue pas
// du panneau. Même langage visuel que SiegeTeam.
const AURA: Record<string, string> = {
  ok: 'border-good bg-good/30',
  partial: 'border-warn bg-warn/45',
  missing: 'border-fire bg-fire/25',
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
  hit,
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

  // Decks contenant le monstre cherché : dépliés d'office pendant la recherche.
  //
  // ⚠️ Calculé à côté de `openDecks`, jamais fusionné dedans : c'est un état de
  // CONSULTATION, pas un choix de l'utilisateur. Effacer la recherche rend à la
  // carte exactement le repli qu'elle avait avant — sans ça, on se retrouverait
  // avec six decks ouverts sans les avoir ouverts.
  const decksTrouves = useMemo(
    () => new Set((hit?.decks ?? []).map((d) => d.deckIndex)),
    [hit]
  );
  // Une recherche est en cours sur CETTE carte → on masque les decks qui n'y
  // répondent pas. `hit` vaut `null` hors recherche : rien n'est alors masqué.
  const decksFiltres = hit != null;
  // Positions du monstre dans un deck donné, pour le surlignage.
  const hitDeDeck = (di: number) => hit?.decks.find((d) => d.deckIndex === di) ?? null;

  // ── Aller d'une ligne du résumé au deck correspondant ────────────────────
  //
  // Le résumé dit ce qui cloche ; le geste suivant est toujours d'aller voir le
  // deck. Sans ce lien, il fallait déplier la carte, retrouver le deck à l'œil
  // parmi six, puis l'ouvrir — alors que la ligne le désigne déjà.
  const deckRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Deck vers lequel défiler une fois qu'il est monté ET déplié. Le scroll ne
  // peut pas se faire dans le `onClick` : la carte ou le deck viennent peut-être
  // d'être dépliés dans la même passe, et leur hauteur n'est pas encore posée.
  const [deckAViser, setDeckAViser] = useState<number | null>(null);

  const allerAuDeck = (di: number) => {
    // ⚠️ Déplier la CARTE aussi : le résumé reste visible carte repliée (c'est
    // tout son intérêt), donc on clique souvent depuis une carte fermée où le
    // deck visé n'est pas rendu du tout.
    if (!expanded) onToggleOpen(reco.id);
    setOpenDecks((s) => new Set(s).add(di));
    setDeckAViser(di);
  };

  useEffect(() => {
    if (deckAViser == null) return;
    // ⚠️ Une frame d'attente avant de viser : la carte et le deck viennent
    // peut-être d'être dépliés dans la même passe, et leur hauteur n'est pas
    // encore posée — `scrollIntoView` calerait sur une position périmée.
    const t = requestAnimationFrame(() => {
      // ⚠️ Un deck peut n'avoir AUCUNE ref : pendant une recherche, seuls les
      // decks trouvés sont rendus. On ne fait alors rien plutôt que de sauter
      // au hasard — le deck est bien déplié, il réapparaîtra à sa place dès que
      // la recherche sera effacée.
      deckRefs.current.get(deckAViser)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setDeckAViser(null);
    });
    return () => cancelAnimationFrame(t);
  }, [deckAViser]);

  return (
    // ⚠️ `compact:p-2.5` : même resserrement qu'une équipe de siège
    // (SiegeTeam.tsx) — au doigt, la page empile plusieurs recommandations,
    // et chaque `p-4` coûte 32 px de haut multipliés par leur nombre.
    <section className={`rounded-2xl border p-4 compact:p-2.5 transition-colors ${AURA[status]}`}>
      {/* En-tête de la recommandation.
          ⚠️ **TROIS zones, pas deux.** Le titre et les icônes d'action
          vivaient chacun dans leur propre bloc (titre + badges à gauche,
          actions à droite), alignés `items-start` — mais dès que les badges
          poussaient le titre à occuper toute sa ligne à lui, l'alignement ne
          répondait plus qu'à une COÏNCIDENCE de hauteurs entre deux éléments
          sans rapport (la boîte de ligne du texte, la boîte de l'icône).
          Le titre et les icônes sont maintenant sur LEUR PROPRE rangée
          (`items-center`), toujours à deux, jamais perturbée par la longueur
          des badges — qui passent en dessous, sur une deuxième rangée qui
          leur est propre et peut s'enrouler librement. */}
      <div className="mb-1.5 flex items-center gap-2">
        {editing ? (
          <Champ
            value={reco.name}
            onChange={(e) => recos.setMeta(reco.id, { name: e.target.value })}
            // ⚠️ Trim à la SORTIE du champ, jamais à la frappe : trimer pendant
            // qu'on tape empêche d'écrire une espace entre deux mots.
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t !== reco.name) recos.setMeta(reco.id, { name: t });
            }}
            placeholder={`Recommandation ${index + 1}`}
            pleineLargeur={false}
            className="min-w-[min(160px,100%)] flex-1 bg-panel py-1 text-base font-semibold"
          />
        ) : (
          // ⚠️ **Le TITRE bascule la carte**, comme le bouton « Consulter » qui
          // reste à côté : deux cibles pour le même geste, pas deux gestes
          // différents. Sur une liste de recommandations qu'on parcourt au
          // pouce, le titre est la cible la plus large et la plus naturelle —
          // on ne vise plus le petit bouton du coin.
          <ZoneCliquable
            onClick={() => onToggleOpen(reco.id)}
            aria-expanded={expanded}
            title={open ? 'Replier' : `Voir les ${reco.decks.length} deck(s)`}
            // ⚠️ `p-0` explicite : un `<button>` porte un rembourrage par
            // défaut du navigateur, invisible à l'œil mais qui élargit sa
            // boîte au-delà du texte.
            className="min-w-0 flex-1 truncate p-0 text-left transition hoverable:text-ctx"
          >
            {/* ⚠️ `compact:text-base` : même resserrement que le titre d'une
                équipe de siège (SiegeTeam.tsx) — au doigt, `text-lg` pesait
                trop lourd. `leading-none` : sans lui, la boîte de ligne du
                texte (interligne 1,6 de l'échelle) dépassait la hauteur des
                icônes juste à côté, et l'écart se lisait comme un défaut. */}
            <h3 className="truncate font-display text-lg leading-none tracking-wide compact:text-base">
              {reco.name || `Recommandation ${index + 1}`}
            </h3>
          </ZoneCliquable>
        )}

        {/* Actions — sur la MÊME rangée que le titre, à sa hauteur. */}
        <div className="flex flex-none items-center gap-1.5">
          {/* En édition, la carte est forcément dépliée → le bouton n'a pas de sens.
              ⚠️ **Masqué au DOIGT** (`compact:hidden`) : le titre bascule
              désormais la carte lui-même (voir plus haut), et ce petit bouton
              du coin devenait une seconde cible pour le même geste — sur un
              écran qu'on parcourt au pouce, la plus petite des deux. Il reste
              à la SOURIS, où viser un bouton précis ne coûte rien et où le
              chevron confirme l'état d'un coup d'œil. */}
          {!editing && (
            <Bouton
              onClick={() => onToggleOpen(reco.id)}
              actif={open}
              aria-expanded={expanded}
              taille="sm"
              icone={
                <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              }
              libelle={open ? 'Réduire' : 'Consulter'}
              title={open ? 'Replier' : `Voir les ${reco.decks.length} deck(s)`}
              className="compact:hidden"
            />
          )}
          {/* Exporter / Éditer / Supprimer : icônes nues (ni cadre ni fond), comme
              la corbeille — l'en-tête est déjà chargé. Groupées pour se lire
              comme UNE barre d'outils, pas comme trois actions éparses. Le sens
              passe par l'infobulle et l'`aria-label`.
              ⚠️ `taille="serre"` sur les quatre (garde `data-cible-fine`, donc
              l'exemption de la règle tactile des 40 px) — mais la BOÎTE est
              élargie à 24 px (`h-6 w-6`, contre 20 par défaut) pour leur
              redonner un peu d'air autour de l'icône. `h-6` gagne sur le `h-5`
              du composant car il est plus loin dans la feuille de style
              (valeurs Tailwind rangées par ordre croissant) — vérifié dans le
              CSS construit, pas supposé. */}
          <div className="flex items-center gap-1 -mr-1">
            <BoutonIcone
              onClick={() => onExport(reco)}
              taille="serre"
              icone={<Upload size={13} />}
              libelle="Exporter cette recommandation (tous ses decks)"
              className="h-6 w-6"
            />
            {/* ⚠️ Pas `actif` (le marqueur d'état standard) : le ✓ DORÉ
                (`text-star`) est la convention DOCUMENTÉE de l'édition en
                cours sur cette page entière (voir spec/siege/recommandations.md
                §« icônes d'action »), reprise plus bas sur chaque deck et
                chaque défense — la changer ici la briserait partout ailleurs. */}
            <button
              onClick={() => onToggleEdit(reco.id)}
              data-cible-fine
              className={`flex h-6 w-6 items-center justify-center transition ${
                editing ? 'text-star' : 'text-ink-dim hoverable:text-ink'
              }`}
              title={editing ? "Terminer l'édition" : 'Éditer la recommandation'}
              aria-label={editing ? "Terminer l'édition" : 'Éditer la recommandation'}
              aria-pressed={editing}
            >
              {editing ? <Check size={14} /> : <Pencil size={13} />}
            </button>
            <BoutonIcone
              onClick={() => setSuppressionAConfirmer(true)}
              ton="danger"
              taille="serre"
              icone={<Trash2 size={13} />}
              libelle="Supprimer cette recommandation"
              className="h-6 w-6"
            />
          </div>
        </div>
      </div>

      {/* Métadonnées — SOUS le titre, sur leur propre rangée qui s'enroule
          librement sans jamais perturber l'alignement titre/icônes. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {reco.origin === 'imported' && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-accent bg-panel2 px-2 py-0.5
                       label"
            title="Recommandation reçue d'un autre joueur"
          >
            <Download size={10} /> Importée
          </span>
        )}
        {/* ⚠️ Pendant une recherche, le compteur dit « N sur M » : afficher le
            total alors qu'un seul deck est à l'écran se lit comme un bug
            d'affichage — on cherche les cinq autres. Même règle que le compteur
            filtré de l'inventaire d'artéfacts. */}
        <span className="font-mono text-micro text-ink-dim">
          {decksFiltres
            ? `${decksTrouves.size} sur ${reco.decks.length} deck${reco.decks.length > 1 ? 's' : ''}`
            : `${reco.decks.length} deck${reco.decks.length > 1 ? 's' : ''}`}
        </span>
        {!editing && reco.author && (
          <span className="font-mono text-micro text-ink-dim">· par {reco.author}</span>
        )}

        {/* ⚠️ **À la SOURIS seulement** (`compact:hidden`) : au doigt, ce bouton
            étiqueté crowdait le titre sur une carte étroite, à côté d'une
            pastille qui redisait déjà ce que l'encart d'analyse affiche juste
            en dessous (voir plus bas — `StatusPill` a été retiré pour ça). Sa
            version au doigt vit désormais en icône, groupée avec Exporter /
            Éditer / Supprimer — voir plus bas. */}
        {!editing && (
          <Bouton
            onClick={onAnalyze}
            disabled={!canAnalyze}
            title={
              canAnalyze
                ? 'Confronter toute la recommandation à tes monstres'
                : 'Importe ton compte pour analyser'
            }
            taille="sm"
            icone={<Gauge size={13} />}
            libelle={match ? 'Réanalyser mes decks' : 'Analyser mes decks'}
            className="compact:hidden"
          />
        )}
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
          <Champ
            value={reco.author}
            onChange={(e) => recos.setMeta(reco.id, { author: e.target.value })}
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t !== reco.author) recos.setMeta(reco.id, { author: t });
            }}
            placeholder="Ton pseudo (auteur)"
            className="bg-panel py-1.5 text-xs"
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
          onGoToDeck={allerAuDeck}
        />
      )}

      {!editing && expanded && reco.note && <NoteBlock text={reco.note} label="Consignes générales" />}

      {/* Repliée : un aperçu d'une ligne — le nom de chaque deck et sa pastille
          de statut, pour savoir quoi ouvrir sans tout déplier. */}
      {!expanded && (
        <ZoneCliquable
          onClick={() => onToggleOpen(reco.id)}
          className="w-full flex flex-wrap items-center gap-1.5"
          title="Consulter cette recommandation"
        >
          {reco.decks.map((deck, di) => {
            const st = match?.decks[di]?.status ?? 'unknown';
            return (
              <span
                key={di}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel2/60
                           px-2 py-0.5 text-micro text-ink-dim"
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-none ${DOT[st]}`} />
                {deckLabel(deck, monsterByCom2us, di)}
              </span>
            );
          })}
          {reco.note && (
            <span className="inline-flex items-center gap-1 text-micro text-ink-dim">
              <StickyNote size={11} className="text-star" /> consignes
            </span>
          )}
        </ZoneCliquable>
      )}

      {/* Les decks de la recommandation */}
      {expanded && (
        <>
          {/* ⚠️ Masqué pendant une recherche : les decks trouvés sont déjà
              dépliés d'office, et « Déplier tous les decks » désignerait des
              decks qui ne sont plus à l'écran. */}
          {reco.decks.length > 1 && !decksFiltres && (
            <div className="flex justify-end mb-1.5">
              <button
                onClick={() =>
                  setOpenDecks((s) =>
                    s.size === reco.decks.length ? new Set() : new Set(reco.decks.map((_, i) => i))
                  )
                }
                className="font-mono text-micro text-ink-dim hoverable:text-ink transition underline"
              >
                {openDecks.size === reco.decks.length ? 'Replier tous les decks' : 'Déplier tous les decks'}
              </button>
            </div>
          )}
          {/* Les decks se posent au dépliage plutôt que d'apparaître d'un bloc.
              ⚠️ L'animation est sur CE conteneur, déjà présent, et non sur un
              `<div>` ajouté autour du fragment : un wrapper de plus casserait
              l'espacement du parent pour un simple effet.
              ⚠️ **Grille à la SOURIS** (`lg:grid-cols-2`), une colonne en
              dessous — même seuil que la grille d'équipes de siège
              (SiegeBoard.tsx). Une recommandation porte souvent une demi-douzaine
              de decks : les empiler sur une seule colonne, à la souris, laissait
              la moitié de la largeur de l'écran vide.
              ⚠️ **Le deck en ÉDITION reprend toute la largeur** (`col-span-2`) :
              ses 3 emplacements de monstres plus le picker de chacun seraient à
              l'étroit sur une demi-colonne — même raison que pour une équipe de
              siège dépliée. */}
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:items-start animate-[apparition_180ms_var(--ease-out)]">
            {/* ⚠️ Pendant une recherche, SEULS les decks trouvés sont rendus —
                les autres disparaissent complètement. Sans ça la carte remontait
                dans les résultats en affichant ses six decks, et il fallait
                encore chercher à l'œil lequel répondait. Le filtre porte donc
                sur les deux niveaux : quelles recos, et quels decks dedans.
                ⚠️ On itère sur les decks D'ORIGINE et on filtre : `di` doit
                rester l'index réel, il indexe le match, l'édition et le repli. */}
            {reco.decks.map((deck, di) => {
              if (decksFiltres && !decksTrouves.has(di)) return null;
              return (
                // Conteneur porteur de la ref : c'est la cible du défilement
                // quand on clique la ligne correspondante du résumé.
                <div
                  key={di}
                  ref={(el) => {
                    if (el) deckRefs.current.set(di, el);
                    else deckRefs.current.delete(di);
                  }}
                  className={editingDeck === di ? 'lg:col-span-2' : undefined}
                >
                  <DeckBlock
                    reco={reco}
                    deck={deck}
                    deckIndex={di}
                    monsters={monsters}
                    monsterByCom2us={monsterByCom2us}
                    match={match?.decks[di] ?? null}
                    editing={editingDeck === di}
                    onToggleEdit={() => setEditingDeck((cur) => (cur === di ? null : di))}
                    folded={!openDecks.has(di) && editingDeck !== di && !decksTrouves.has(di)}
                    onToggleFold={() => toggleDeck(di)}
                    hit={hitDeDeck(di)}
                    recos={recos}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <div className="mt-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Bouton
              onClick={() => {
                recos.addDeck(reco.id);
                setEditingDeck(reco.decks.length); // le nouveau deck s'ouvre en édition
              }}
              trait="pointille"
              taille="sm"
              icone={<Plus size={14} />}
              libelle="Ajouter un deck vide"
            />
            {/* ⚠️ `trait` bascule pointillé → plein avec l'état, comme le fond :
                le pointillé dit « pas encore rempli », et perd son sens une fois
                le choix ouvert. `actif` seul ne pilote que le fond dans `Bouton`. */}
            <Bouton
              onClick={() => setPickOffense((v) => !v)}
              disabled={offenseTeams.length === 0}
              actif={pickOffense}
              trait={pickOffense ? 'plein' : 'pointille'}
              title={
                offenseTeams.length === 0
                  ? "Aucune équipe d'offense : importe ton compte (barre du haut) après avoir sauvegardé tes attaques en jeu."
                  : "Partir d'une de tes équipes d'offense (monstres, sets, artéfacts et stats réels pré-remplis)"
              }
              taille="sm"
              icone={<Swords size={14} />}
              libelle={
                <>
                  Importer un deck d'offense{' '}
                  <span className="font-mono text-micro opacity-70">{offenseTeams.length}</span>
                </>
              }
            />
          </div>

          {pickOffense && offenseTeams.length > 0 && (
            <div className="mt-2 rounded-xl border border-border bg-panel/60 p-2">
              <p className="label mb-1.5">
                Tes équipes d'offense — les stats du build sont reprises comme minimums
              </p>

              {/* Recherche par monstre : avec ~50 attaques sauvegardées, c'est
                  le seul moyen de retrouver une équipe. */}
              <Champ
                value={offenseQuery}
                onChange={(e) => setOffenseQuery(e.target.value)}
                placeholder="Filtrer par monstre…"
                icone={<Search size={13} />}
                className="mb-1.5 py-1 text-xs"
              />

              <div className="max-h-[240px] overflow-y-auto flex flex-col gap-1">
                {filteredOffense.map(({ team, index, summary, monsters: trio }) => (
                  <ZoneCliquable
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
                    <span className="font-mono text-micro text-ink-dim flex-none">#{index + 1}</span>
                    <span className="flex items-center gap-1.5 flex-1">
                      {trio.map((m, i) => (
                        <MiniMonster key={i} monster={m} size={30} />
                      ))}
                    </span>
                    <Plus size={13} className="flex-none text-ink-dim" />
                  </ZoneCliquable>
                ))}
                {filteredOffense.length === 0 && (
                  <p className="px-1 py-2 text-xs text-ink-dim">Aucune équipe avec ce monstre.</p>
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

// Les QUATRE familles de verdict de l'analyse — une par statut réel.
//
// ⚠️ Le rouge est SCINDÉ en deux, alors qu'il ne l'était pas au départ : « à
// revoir » et « monstre manquant » partagent la couleur mais pas du tout le
// geste. L'un se répare en rerunant ce qu'on possède déjà ; l'autre demande
// d'invoquer et de monter un monstre qu'on n'a pas — ce n'est plus le même
// horizon, ni la même décision. Les fondre obligeait à parcourir la liste rouge
// pour trier à l'œil ce sur quoi on pouvait agir ce soir.
//
// Les deux gardent la couleur `fire` : ils sont bloquants tous les deux, et
// c'est bien ce que la couleur dit. Ce sont deux FILTRES sur un même rouge, pas
// deux couleurs de plus.
type VerdictKey = 'ok' | 'nodeck' | 'ko' | 'missing';

const VERDICTS: {
  key: VerdictKey;
  label: string;
  statuts: DeckMatch['status'][];
  dot: string;
  texte: string;
  actif: string;
  // ⚠️ Rang de TRI de la liste, distinct de l'ordre des pastilles ci-dessous.
  // La liste va du plus urgent au plus tranquille — rouge, orange, vert : ce
  // qui demande du travail se lit en premier, les decks déjà jouables closent
  // et n'ont pas à être dépassés pour atteindre les problèmes.
  rang: number;
}[] = [
  // L'ordre du TABLEAU est celui des PASTILLES, qui se lisent comme une
  // légende, du meilleur au pire — l'inverse de la liste, et c'est voulu :
  // une légende ordonne des catégories, une liste hiérarchise l'urgence.
  {
    key: 'ok',
    label: 'Bon',
    statuts: ['ok'],
    dot: 'bg-good',
    texte: 'text-good',
    actif: 'border-good bg-good/30 text-ink',
    rang: 3,
  },
  {
    key: 'nodeck',
    label: 'À composer',
    statuts: ['nodeck'],
    dot: 'bg-warn',
    texte: 'text-warn',
    actif: 'border-warn bg-warn/45 text-ink',
    rang: 2,
  },
  {
    key: 'ko',
    label: 'À revoir',
    statuts: ['ko'],
    dot: 'bg-fire',
    texte: 'text-fire',
    actif: 'border-fire bg-fire/25 text-ink',
    rang: 1,
  },
  {
    // ⚠️ Le plus bloquant en tête de liste : rien de ce qu'on possède ne
    // répare un monstre absent, alors qu'un « à revoir » se corrige le soir
    // même avec les runes qu'on a déjà.
    key: 'missing',
    label: 'Monstre manquant',
    statuts: ['missing'],
    // ⚠️ Point CREUX, même rouge : deux pastilles de la même couleur côte à
    // côte ne se distinguent plus que par leur texte, qu'on ne relit pas une
    // fois la barre connue. Le creux dit « il manque quelque chose » sans
    // introduire une cinquième couleur qui mentirait sur la gravité.
    dot: 'border border-fire',
    texte: 'text-fire',
    actif: 'border-fire bg-fire/25 text-ink',
    rang: 0,
  },
];

const RANG_DE = Object.fromEntries(VERDICTS.map((v) => [v.key, v.rang])) as Record<
  VerdictKey,
  number
>;

const VERDICT_DE: Record<string, VerdictKey | null> = {
  ok: 'ok',
  nodeck: 'nodeck',
  ko: 'ko',
  missing: 'missing',
  unknown: null,
};

// Synthèse après « Analyser » : le verdict de CHAQUE deck, bons compris, et le
// détail de ceux qui ne passent pas. C'est le livrable de l'analyse — il reste
// visible même recommandation repliée.
//
// ⚠️ Les decks au niveau sont LISTÉS, pas seulement comptés. Un « 4/6 au
// niveau » oblige à rouvrir la carte pour savoir LESQUELS sont jouables — or
// c'est la question qu'on se pose devant une défense de guilde à poser. Le
// détail par monstre reste réservé aux decks fautifs : sur un deck bon, il n'y
// a rien à corriger.
function AnalysisSummary({
  reco,
  match,
  monsterByCom2us,
  onClear,
  onGoToDeck,
}: {
  reco: Reco;
  match: RecoMatch;
  monsterByCom2us: Map<number, Monster>;
  onClear: () => void;
  // Déplie le deck visé (et la carte si besoin) puis y fait défiler.
  onGoToDeck: (deckIndex: number) => void;
}) {
  // Tous les decks analysables, triés du plus urgent au plus tranquille :
  // ⚠️ ROUGE → ORANGE → VERT. Ce qui demande du travail se lit en premier ; les
  // decks déjà jouables closent la liste au lieu de la précéder — sinon il faut
  // les dépasser pour atteindre ce sur quoi on peut agir.
  // ⚠️ Tri STABLE (`sort` l'est en JS moderne) sur le seul rang : à verdict
  // égal, les decks gardent l'ordre de la recommandation, qui est celui de son
  // auteur. Trier aussi à l'intérieur d'une famille mélangerait ses decks sans
  // que rien à l'écran ne dise pourquoi.
  const lignes = reco.decks
    .map((deck, i) => ({ deck, i, dm: match.decks[i] }))
    .filter(({ dm }) => dm && dm.status !== 'unknown')
    .map((l) => ({ ...l, verdict: VERDICT_DE[l.dm.status] as VerdictKey }))
    .sort((a, b) => RANG_DE[a.verdict] - RANG_DE[b.verdict]);

  const compte = (k: VerdictKey) => lignes.filter((l) => l.verdict === k).length;
  const rates = lignes.filter((l) => l.verdict !== 'ok');

  // Filtres de verdict. ⚠️ Rien de coché = TOUT est montré : un écran de
  // filtres tous éteints qui n'afficherait rien se lirait comme une analyse
  // vide. Cocher restreint, et l'ensemble reste cumulable (plusieurs couleurs
  // à la fois) — d'où des pastilles indépendantes et non un `Segmented`.
  const [vus, setVus] = useState<Set<VerdictKey>>(new Set());
  const bascule = (k: VerdictKey) =>
    setVus((cur) => {
      const next = new Set(cur);
      if (!next.delete(k)) next.add(k);
      return next;
    });
  const visibles = vus.size === 0 ? lignes : lignes.filter((l) => vus.has(l.verdict));

  // Referme le résultat : la carte redevient neutre (halo et pastille compris).
  const closeBtn = (
    <BoutonIcone
      onClick={onClear}
      libelle="Masquer le résultat de l'analyse"
      icone={<X size={14} />}
      className="ml-auto"
    />
  );

  if (match.totalDecks === 0) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-panel/60 px-3 py-2">
        <p className="text-sm text-ink-dim">Rien à analyser : aucun deck rempli.</p>
        {closeBtn}
      </div>
    );
  }

  // L'encart prend la couleur du pire verdict présent : vert si tout passe,
  // orange sinon — le rouge reste porté par les lignes, pour ne pas alarmer sur
  // une reco dont il ne manque qu'une équipe à composer.
  const toutPasse = rates.length === 0;

  return (
    <div
      className={`mb-3 rounded-lg border px-3 py-2 ${
        toutPasse ? 'border-good bg-good/30' : 'border-warn bg-warn/40'
      }`}
    >
      <div className="flex items-center gap-2">
        {toutPasse ? (
          <Check size={15} className="flex-none text-good" />
        ) : (
          <AlertTriangle size={15} className="flex-none text-warn" />
        )}
        <p className={`text-sm font-semibold ${toutPasse ? 'text-good' : 'text-warn'}`}>
          {toutPasse
            ? `Tout est respecté : les ${match.totalDecks} deck(s) sont jouables avec tes monstres.`
            : `${match.okDecks}/${match.totalDecks} deck(s) au niveau · ${rates.length} à corriger`}
        </p>
        {closeBtn}
      </div>

      {/* Filtres de verdict — pastilles CUMULABLES (plusieurs couleurs à la
          fois), d'où des boutons indépendants et non un `Segmented`, qui dirait
          que les choix s'excluent (voir ui/Segmented.tsx).
          ⚠️ La BORDURE marque l'actif, jamais un aplat plein : c'est la règle
          des pastilles de filtre (voir spec/shared/design.md).
          Un verdict sans aucun deck est affiché GRISÉ et non retiré : on voit
          qu'il n'y en a aucun, au lieu de chercher un bouton disparu.
          ⚠️ Pas un `Bouton` de la librairie : chaque verdict porte SA couleur
          sémantique (bon/à composer/à revoir/manquant), et aucune n'est un ton
          de bouton (accent, danger…) — même exception que les pastilles
          manque/surplus de siège et « Recommandation ignorée ». */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {VERDICTS.map((v) => {
          const n = compte(v.key);
          const actif = vus.has(v.key);
          return (
            <button
              key={v.key}
              onClick={() => bascule(v.key)}
              disabled={n === 0}
              aria-pressed={actif}
              title={
                n === 0
                  ? `Aucun deck « ${v.label} »`
                  : actif
                    ? `Ne plus isoler « ${v.label} »`
                    : `N'afficher que « ${v.label} »`
              }
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs
                          font-semibold transition ${
                            n === 0
                              ? 'border-border text-ink-dim opacity-40 cursor-not-allowed'
                              : actif
                                ? v.actif
                                : 'border-border text-ink-dim hoverable:border-accent hoverable:text-ink'
                          }`}
            >
              {/* 2 px de plus que le point des lignes : un cercle CREUX de
                  1.5 px ne se lit pas, son intérieur disparaît. */}
              <span className={`h-2 w-2 flex-none rounded-full ${v.dot}`} />
              {v.label}
              <span className="font-mono text-micro text-ink-dim">{n}</span>
            </button>
          );
        })}
        {vus.size > 0 && (
          <button
            onClick={() => setVus(new Set())}
            className="text-xs text-ink-dim underline transition hoverable:text-ink"
          >
            Tout afficher
          </button>
        )}
      </div>

      {/* ⚠️ TOUS les decks sont listés, les bons compris : « lesquels puis-je
          poser » est la question qu'on se pose devant une défense de guilde, et
          un simple compteur obligeait à rouvrir la carte pour y répondre. */}
      <ul className="mt-2 space-y-1.5">
        {visibles.map(({ deck, i, dm, verdict }) => {
          const v = VERDICTS.find((x) => x.key === verdict)!;
          return (
            <li key={i}>
              {/* ⚠️ La ligne entière est un BOUTON : le résumé dit ce qui
                  cloche, et le geste suivant est toujours d'aller voir le deck.
                  Sans ça il fallait déplier la carte, retrouver le deck à l'œil
                  parmi six, puis l'ouvrir — alors que la ligne le désigne déjà.
                  ⚠️ Le DÉTAIL par monstre reste HORS du bouton : c'est du texte
                  qu'on lit et qu'on veut pouvoir sélectionner, pas une cible. */}
              <ZoneCliquable
                onClick={() => onGoToDeck(i)}
                className="flex w-full items-baseline gap-1.5 flex-wrap rounded-md px-1 py-0.5 -mx-1
                           transition hoverable:bg-panel2/60"
                title={`Voir le deck « ${deckLabel(deck, monsterByCom2us, i)} »`}
              >
                {/* Le point du VERDICT, pas `DOT[status]` : il doit être le
                    même que celui de la pastille qui filtre cette ligne — dont
                    le creux distingue « monstre manquant » de « à revoir ».
                    `DOT` reste la table de l'aperçu replié, où le vocabulaire à
                    trois couleurs suffit. */}
                <span className={`w-2 h-2 rounded-full flex-none self-center ${v.dot}`} />
                <span className="text-xs font-semibold text-ink">
                  {deckLabel(deck, monsterByCom2us, i)}
                </span>
                <span className={`font-mono text-micro ${v.texte}`}>
                  {/* Un deck bon annonce ce qui le rend jouable — l'équipe
                      retenue —, pas un simple « ok » : c'est elle qu'on va
                      chercher en jeu. */}
                  {verdict === 'ok'
                    ? dm.team
                      ? `jouable · ${dm.team}`
                      : 'jouable'
                    : deckProblem(dm)}
                </span>
                {/* Combien de fois le deck est montable EN PARALLÈLE avec la
                    réserve 6★ (`deckCopies`). C'est la question qu'on se pose
                    devant SIX défenses de guilde à remplir : un deck jouable
                    une seule fois n'en couvre qu'une.
                    ⚠️ Affiché sur TOUS les verdicts, pas seulement les bons :
                    savoir qu'un deck à revoir n'existe de toute façon qu'en un
                    exemplaire change ce qu'on décide d'aller corriger. */}
                <CopiesBadge copies={dm.copies} />
              </ZoneCliquable>
              {/* Détail par monstre : sur les deux verdicts rouges. « à
                  revoir » dit quoi corriger, « monstre manquant » dit LEQUEL
                  manque — sans quoi on saurait le deck bloqué sans savoir par
                  qui. « nodeck » n'en a pas (aucun build à confronter) et un
                  deck bon n'a rien à montrer. */}
              {(verdict === 'ko' || verdict === 'missing') && (
                <ul className="ml-3 mt-0.5 space-y-0.5">
                  {deck.slots.map((slot, si) => {
                    const txt = dm.slots[si] ? slotProblem(slot, dm.slots[si], monsterByCom2us) : null;
                    return txt ? (
                      <li key={si} className="text-xs text-ink-dim leading-snug">
                        • {txt}
                      </li>
                    ) : null;
                  })}
                </ul>
              )}
            </li>
          );
        })}
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
  ok: 'border-good/70 bg-good/20',
  nodeck: 'border-warn/70 bg-warn/35',
  ko: 'border-fire/70 bg-fire/20',
  missing: 'border-fire/70 bg-fire/20',
  partial: 'border-warn/70 bg-warn/35',
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
  hit,
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
  // Positions du monstre cherché dans CE deck, `null` hors recherche.
  hit: DeckHit | null;
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

  return (
    <div className={`rounded-xl border p-2.5 compact:p-1 ${DECK_AURA[empty ? 'unknown' : status]}`}>
      <div className="mb-2">
        {/* ⚠️ **Rangée à part, jamais mêlée au verdict/copies en dessous** :
            le crayon doit rester en HAUT À DROITE quel que soit l'état du
            deck. Le mettre dans la même rangée flex-wrap que le verdict le
            faisait suivre le badge sur sa ligne (repoussé en bas dès que
            « réalisable N fois » prenait sa propre ligne, voir plus bas) —
            un bouton d'action ne doit pas se déplacer selon ce qui s'affiche
            à côté de lui. */}
        <div className="flex items-center gap-2">
          {/* Chevron de repli : indispensable en édition avec plusieurs decks */}
          <BoutonIcone
            onClick={onToggleFold}
            aria-expanded={!folded}
            taille="serre"
            icone={<ChevronDown size={14} className={`transition-transform ${folded ? '-rotate-90' : ''}`} />}
            libelle={folded ? 'Déplier ce deck' : 'Replier ce deck'}
          />

          {/* ⚠️ **Plus de titre texte : les portraits SEULS identifient le
              deck**, plus grands (34 px, contre 26 pour l'ancien aperçu replié
              seul) pour porter ce que le mot enlevé portait. Un titre — libre ou
              calculé — redoublait ce que ces portraits montrent déjà ; les
              garder seuls, agrandis, évite la redite plutôt que de biffer un mot
              de plus dans un en-tête déjà chargé. Toujours affichés, replié ou
              non : c'est le seul repère du deck quel que soit son état.
              ⚠️ `deck.name` reste dans le TYPE et le stockage (retrocompat) :
              une recommandation exportée avant ce changement, ou reçue d'un ami
              qui n'a pas encore mis à jour l'app, garde son champ `name` — il
              n'a jamais été lu ici, et n'est pas rejeté à l'import. */}
          <ZoneCliquable
            onClick={onToggleFold}
            className="flex items-center gap-1.5 flex-1 min-w-0"
            title={folded ? 'Déplier ce deck' : 'Replier ce deck'}
          >
            {deck.slots.map((sl, i) => (
              <MiniMonster
                key={i}
                monster={sl.com2usId != null ? monsterByCom2us.get(sl.com2usId) ?? null : null}
                fallback={sl.name}
                size={34}
                lead={i === 0 ? leaderLead : null}
              />
            ))}
          </ZoneCliquable>
          {/* Le lead n'est pas dans l'en-tête : il est posé sur le leader lui-même
              (aperçu replié ci-dessous, ou slot 0 déplié) — comme en siège. */}

          {/* Édition PROPRE au deck (monstres, sets, stats, consignes) : icônes
              nues et resserrées, comme dans l'en-tête de la recommandation. */}
          <div className="ml-auto flex items-center gap-0.5">
            {/* ⚠️ Même exception que l'en-tête de la recommandation : le ✓ doré
                est la convention documentée de l'édition en cours sur toute
                cette page (spec/siege/recommandations.md), pas le marqueur
                d'état standard. */}
            <button
              onClick={onToggleEdit}
              data-cible-fine
              className={`flex h-5 w-5 items-center justify-center transition ${
                editing ? 'text-star' : 'text-ink-dim hoverable:text-ink'
              }`}
              title={editing ? "Terminer l'édition de ce deck" : 'Éditer ce deck'}
              aria-label={editing ? "Terminer l'édition de ce deck" : 'Éditer ce deck'}
              aria-pressed={editing}
            >
              {editing ? <Check size={13} /> : <Pencil size={12} />}
            </button>
            {editing && (
              <BoutonIcone
                onClick={() => setDeckAConfirmer(true)}
                ton="danger"
                taille="serre"
                icone={<Trash2 size={12} />}
                libelle="Supprimer ce deck"
              />
            )}
          </div>
        </div>

        {/* ⚠️ `basis-full` sur mobile, PAS un simple `flex-wrap` sur le
            conteneur : un item flex qui a un peu de place restante sur la
            ligne s'y installe et enroule son PROPRE texte au mot
            (« indis- » collé, « ponible... » en dessous) au lieu de
            descendre entier à la ligne suivante — c'est ce qui rendait le
            repli imprévisible (bon tantôt, tronqué tantôt). `basis-full`
            force CHAQUE ligne (verdict, puis nombre de copies) à démarrer sa
            propre ligne, systématique. `sm:basis-auto` : au-delà, la place ne
            manque plus, elles reprennent leur place naturelle côte à côte. */}
        {!editing && match && !empty && (
          <div className="flex flex-wrap items-center gap-2 compact:gap-1 mt-1 compact:mt-0.5">
            <span className="basis-full sm:basis-auto">
              <DeckBadge match={match} />
            </span>
            <span className="basis-full sm:basis-auto">
              <CopiesBadge copies={match.copies} />
            </span>
          </div>
        )}
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
            placeholder="Consignes pour ce deck (ex. « ne pas ouvrir sur le leader »)…"
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
              className={`min-w-0 rounded-xl border p-2.5 compact:p-2 ${
                // Indisponible ET stats insuffisantes sont tous deux bloquants → rouge.
                sm?.status === 'absent' || sm?.status === 'ko'
                  ? 'border-fire bg-fire/20'
                  : sm?.status === 'ok'
                    ? 'border-good/70 bg-good/20'
                    : 'border-border bg-panel2/60'
              } ${
                // ⚠️ Le monstre CHERCHÉ prend un fond d'accent léger, jamais une
                // bordure : celle-ci porte déjà le résultat de l'analyse
                // (rouge/vert), et la remplacer effacerait cette information au
                // moment où on parcourt la page. Deux langages distincts, deux
                // supports distincts. Même écho de filtre que les propriétés
                // recherchées d'un artéfact — voir spec/shared/design.md.
                hit?.slots.includes(idx) ? 'bg-accent/[0.10]' : ''
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
                  <p className="text-xs text-ink-dim py-4 text-center">
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
                      <div className="text-xs font-semibold leading-tight truncate">
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
                      {!monster && <div className="font-mono text-micro text-ink-dim">monstre inconnu</div>}
                    </div>
                    {editing && (
                      <BoutonIcone
                        onClick={() => recos.setSlotMonster(reco.id, deckIndex, idx, null, '')}
                        ton="danger"
                        libelle="Vider le slot"
                        icone={<X size={14} />}
                      />
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
                        onSet={(key, total) =>
                          recos.setSlotStat(reco.id, deckIndex, idx, key, total)
                        }
                      />
                    ) : (
                      <StatList
                        slot={slot}
                        monster={monster}
                        sm={sm}
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
        hitCounters={hit?.counters ?? []}
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
  hitCounters,
}: {
  deck: RecoDeck;
  reco: Reco;
  deckIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  recos: UseRecoState;
  // Index des défenses qui contiennent le monstre cherché.
  hitCounters: number[];
}) {
  // ⚠️ Édition PAR DÉFENSE, et non pour le bloc entier.
  //
  // Le bloc n'a plus de bouton « Éditer » : noter la défense qu'on vient
  // d'affronter est un geste DE PASSAGE, et le crayon ajoutait une étape
  // (ouvrir le mode, ajouter, refermer) là où le geste réel est « + ». Le « + »
  // ajoute donc directement une défense, et c'est ELLE qui s'ouvre en édition —
  // les autres restent en lecture, en vignettes, à côté.
  //
  // `null` = aucune en édition. On n'en édite qu'une à la fois : on note une
  // composition, pas six.
  const [enEdition, setEnEdition] = useState<number | null>(null);

  // Précision affichée : `null` = aucune. Une seule à la fois.
  //
  // ⚠️ **La note s'affiche en POPOVER**, ancré sur sa vignette. Un panneau posé
  // dans le flux devait s'aligner sous une vignette qui, en `flex-wrap`, peut
  // être n'importe où sur n'importe quelle ligne : le trait du cran et celui du
  // panneau ne se rejoignaient pas, et le rattachement mentait. Un flottant naît
  // de son ancre, il n'a rien à aligner. Il ne pousse rien non plus — la rangée
  // de vignettes ne bouge plus quand on lit une note.
  //
  // ⚠️ **Aucune ouverture automatique à la recherche.** Une défense trouvée
  // s'ouvrait d'office : sur une recherche qui remonte plusieurs défenses, cela
  // dépliait des notes qu'on n'avait pas demandées, et le surlignage de la
  // vignette suffit à dire laquelle répond. On ouvre si on veut lire.
  const [noteOuverte, setNoteOuverte] = useState<number | null>(null);

  // Un flottant se referme au clic extérieur et à Échap — même motif que le menu
  // de réglages et les autres popovers de l'app (voir SettingsMenu.tsx).
  const rangeeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (noteOuverte == null) return;
    const onDown = (e: MouseEvent) => {
      if (rangeeRef.current && !rangeeRef.current.contains(e.target as Node)) setNoteOuverte(null);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setNoteOuverte(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [noteOuverte]);

  // ⚠️ Les index se décalent à la suppression : une défense retirée laisserait
  // l'édition (ou la note ouverte) pointer sur sa voisine, ou dans le vide.
  const nbCounters = deck.counters.length;
  useEffect(() => {
    setEnEdition((cur) => (cur != null && cur >= nbCounters ? null : cur));
    setNoteOuverte((cur) => (cur != null && cur >= nbCounters ? null : cur));
  }, [nbCounters]);

  const estVide = (ci: number) =>
    (deck.counters[ci]?.monsters ?? []).every((m) => m.com2usId == null);

  // ⚠️ Le bloc vit dans la partie DÉPLIÉE du deck : replier le démonte sans
  // passer par « Terminer ». Sans ce nettoyage, une défense ouverte et laissée
  // vide survivait au repli — exactement ce qu'on refuse d'enregistrer.
  // Les valeurs sont lues dans une ref : l'effet de démontage ne s'exécute
  // qu'une fois, et capturerait sinon l'état du premier rendu.
  const etatAuDemontage = useRef({ enEdition, estVide, reco, deckIndex, recos });
  etatAuDemontage.current = { enEdition, estVide, reco, deckIndex, recos };
  useEffect(
    () => () => {
      const s = etatAuDemontage.current;
      if (s.enEdition != null && s.estVide(s.enEdition))
        s.recos.removeCounter(s.reco.id, s.deckIndex, s.enEdition);
    },
    []
  );

  const ajouter = () => {
    // ⚠️ Si une défense est déjà ouverte et restée vide, on ne l'empile pas :
    // cliquer « + » deux fois de suite ne doit pas laisser une entrée vide
    // derrière soi. On la réutilise plutôt que d'en créer une seconde.
    if (enEdition != null && estVide(enEdition)) return;
    recos.addCounter(reco.id, deckIndex);
    // La nouvelle est ajoutée en fin de liste : elle s'ouvre en édition, sinon
    // on aurait ajouté une vignette vide sans moyen de la remplir.
    setEnEdition(nbCounters);
  };

  // ⚠️ **Une défense sans AUCUN monstre n'est pas conservée.** L'entrée est bien
  // créée au « + » — c'est le formulaire qu'on remplit —, mais si on la referme
  // sans avoir rien choisi, elle est retirée : elle ne décrit aucune
  // composition, ne se lit pas en vignette, et voyagerait telle quelle dans
  // l'export. Refermer sans rien poser vaut donc « j'abandonne », pas
  // « j'enregistre du vide ».
  //
  // ⚠️ La note seule ne suffit PAS à la retenir : une précision sans les
  // portraits qu'elle qualifie (« si le Chloe est en lead ») ne veut rien dire.
  // Ce sont les 3 monstres qui font la défense.
  const fermerEdition = (ci: number) => {
    if (estVide(ci)) recos.removeCounter(reco.id, deckIndex, ci);
    setEnEdition(null);
  };

  // Passer d'une défense à une autre referme la précédente — et l'abandonne si
  // elle est restée vide, exactement comme le bouton « Terminer ».
  const basculerEdition = (ci: number) => {
    if (enEdition === ci) {
      fermerEdition(ci);
      return;
    }
    if (enEdition != null && estVide(enEdition)) {
      recos.removeCounter(reco.id, deckIndex, enEdition);
      // ⚠️ Retirer une entrée AVANT celle qu'on vise décale son index d'un cran.
      setEnEdition(enEdition < ci ? ci - 1 : ci);
      return;
    }
    setEnEdition(ci);
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-border/50">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Swords size={13} className="flex-none text-ink-dim" />
        <span className="label">Fort contre</span>
        {deck.counters.length > 1 && (
          <span className="font-mono text-micro text-ink-dim">{deck.counters.length}</span>
        )}
      </div>

      {/* ⚠️ Les défenses côte à côte, en `flex-wrap` : ce sont des vignettes de
          3 portraits, empilées elles gaspillaient une ligne entière chacune
          pour 90 px de contenu. On en voit maintenant plusieurs d'un coup, ce
          qui est le point : reconnaître la composition qu'on affronte.
          Celle EN ÉDITION reprend toute la largeur — elle porte alors 3
          sélecteurs et un champ de texte —, d'où le `w-full` qu'elle se donne
          elle-même dans la rangée. */}
      <div ref={rangeeRef} className="flex flex-wrap items-start gap-1.5">
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
            editing={enEdition === ci}
            onToggleEdit={() => basculerEdition(ci)}
            trouve={hitCounters.includes(ci)}
            noteOuverte={noteOuverte === ci}
            onToggleNote={() => setNoteOuverte((cur) => (cur === ci ? null : ci))}
          />
        ))}

        {/* ⚠️ UN SEUL bouton, toujours visible : le « + ». Il vit DANS la
            rangée, à la suite des défenses — c'est là qu'on ajoute, et il montre
            où la prochaine se posera. Le bloc restant visible même vide, c'est
            aussi lui qui rend la fonctionnalité découvrable sur un deck qui n'en
            porte encore aucune. */}
        <Bouton
          onClick={ajouter}
          trait="pointille"
          className="h-[44px]"
          icone={<Plus size={14} />}
          libelle="Défense"
          aria-label="Ajouter une défense que ce deck bat"
          title="Ajouter une défense que ce deck bat"
        />
      </div>
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
  onToggleEdit,
  trouve,
  noteOuverte,
  onToggleNote,
}: {
  counter: RecoCounter;
  reco: Reco;
  deckIndex: number;
  counterIndex: number;
  monsters: Monster[];
  monsterByCom2us: Map<number, Monster>;
  recos: UseRecoState;
  editing: boolean;
  onToggleEdit: () => void; // ouvre/ferme l'édition de CETTE défense
  trouve: boolean; // contient le monstre cherché
  // ⚠️ L'état de la précision vit dans le BLOC, pas ici : une seule ouverte à la
  // fois sur toute la rangée. Voir CounterBlock.
  noteOuverte: boolean;
  onToggleNote: () => void;
}) {
  // La note dépliée est ancrée à gauche d'une vignette qui peut être la dernière
  // de sa rangée : sans recalage, elle sortait de l'écran par la droite.
  const noteRef = useRef<HTMLDivElement>(null);
  const { style: recalageNote } = useRecalageEcran(noteRef, noteOuverte);

  // Un même monstre ne peut pas occuper deux emplacements de LA MÊME défense —
  // même règle que les slots d'un deck. Il peut revenir dans une autre défense.
  const usedIds = new Set(
    counter.monsters
      .map((m) => (m.com2usId != null ? monsterByCom2us.get(m.com2usId)?.id : null))
      .filter((id): id is string => id != null)
      .map(String)
  );

  if (!editing) {
    // Une vignette sans note n'a rien à déplier : elle ne devient donc pas
    // cliquable. Un bouton qui ne fait rien au clic se lit comme un défaut.
    const aUneNote = counter.note.trim() !== '';

    const portraits = (
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
        {/* ⚠️ Le repère de note est TOUJOURS là quand il y en a une, ouverte ou
            non : sans lui, rien ne distingue une vignette qui cache une
            précision d'une vignette qui n'en a pas — on cliquerait au hasard. */}
        {aUneNote && (
          <ChevronDown
            size={12}
            className={`ml-0.5 flex-none text-ink-dim transition-transform ${
              noteOuverte ? 'rotate-180' : ''
            }`}
          />
        )}
      </div>
    );

    // La vignette dont la précision est ouverte prend la bordure d'accent, comme
    // le monstre sélectionné d'une équipe de siège dont on consulte les runes
    // (voir SiegeTeam.tsx) : elle dit d'où sort le popover.
    const cran = noteOuverte
      ? 'border-accent bg-panel2'
      : trouve
        ? // Même écho de recherche que sur un slot : un fond d'accent, rien de plus.
          'border-transparent bg-accent/[0.10]'
        : 'border-transparent bg-panel2/50';

    return (
      // `group` : le crayon n'apparaît qu'au survol de SA vignette.
      // `relative` : ancre du popover de précision. ⚠️ `z-20` quand il est
      // ouvert : les vignettes suivantes sont peintes APRÈS dans le flux et
      // passeraient sinon par-dessus le flottant.
      <div className={`group relative min-w-0 rounded-lg border ${noteOuverte ? 'z-20' : ''} ${cran}`}>
        {/* ⚠️ Une défense posée doit rester modifiable : sans le bouton
            « Éditer » du bloc, c'est la vignette qui porte son propre crayon.
            Discret (il ne se montre qu'au survol) pour ne pas alourdir une
            rangée qu'on parcourt du regard, mais TOUJOURS visible au tactile,
            où il n'y a pas de survol — voir la règle « un élément atteignable
            ne dépend jamais du survol » de spec/shared/design.md. */}
        {/* ⚠️ `taille="serre"` + `cadre` + `auSurvol` : posé SUR le coin de la
            vignette, hors du flux — agrandi par la règle tactile, il la
            déborde et recouvre le portrait, même cas que la croix de
            suppression d'une carte RTA. `auSurvol` reproduit exactement le
            même trio de classes qu'avant (masqué au repos, visible au survol,
            au focus, et D'OFFICE sans survol possible — voir BoutonIcone.tsx). */}
        <BoutonIcone
          onClick={onToggleEdit}
          taille="serre"
          cadre
          auSurvol
          icone={<Pencil size={10} />}
          libelle="Modifier cette défense"
          className="absolute -right-1 -top-1 z-10"
        />

        {aUneNote ? (
          <ZoneCliquable
            onClick={onToggleNote}
            aria-expanded={noteOuverte}
            className="flex w-full items-center rounded-lg px-2 py-1.5 transition hoverable:brightness-110"
            title={noteOuverte ? 'Masquer la précision' : 'Voir la précision'}
          >
            {portraits}
          </ZoneCliquable>
        ) : (
          <div className="px-2 py-1.5">{portraits}</div>
        )}

        {/* La précision, en POPOVER ancré sous SA vignette.
            ⚠️ Flottant et non posé dans le flux : il naît de son ancre, donc il
            n'a rien à aligner — et il ne pousse pas la rangée, qui reste
            immobile pendant qu'on lit.
            ⚠️ `origin-top-left` : un flottant ancré grandit DEPUIS son ancre,
            jamais depuis son centre (voir spec/shared/design.md).
            `min-w-full` : au moins aussi large que la vignette, pour se lire
            comme sa suite ; `w-max` + plafond au-delà, la note étant courte. */}
        {noteOuverte && (
          <div
            ref={noteRef}
            // ⚠️ Ancrée à gauche d'une vignette qui peut être la DERNIÈRE de sa
            // rangée : la note sortait alors de l'écran par la droite. Le
            // `max-w` borne sa largeur, pas sa position. Voir le hook.
            style={recalageNote}
            className="absolute left-0 top-full z-20 mt-1 w-max min-w-full max-w-[280px] origin-top-left
                       rounded-lg border border-accent bg-panel px-2.5 py-1.5 shadow-xl shadow-black/50
                       animate-[popover_150ms_var(--ease-out)]"
          >
            <p className="text-xs leading-snug text-ink-dim">{counter.note}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    // ⚠️ `w-full` : la rangée est en `flex-wrap` (les autres défenses restent en
    // vignettes à côté), et celle qu'on édite porte 3 sélecteurs plus un champ
    // de texte — elle prend donc toute la largeur pour elle seule.
    // La bordure d'accent dit LAQUELLE est en cours d'édition.
    <div className="w-full rounded-lg border border-accent bg-panel2/50 p-2">
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
                    <span className="min-w-0 flex-1 truncate text-micro text-ink">
                      {monster?.name ?? m.name}
                    </span>
                    <BoutonIcone
                      onClick={() =>
                        recos.setCounterMonster(reco.id, deckIndex, counterIndex, i, null, '')
                      }
                      ton="danger"
                      taille="serre"
                      icone={<X size={12} />}
                      libelle="Retirer ce monstre"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Terminer, puis supprimer — l'ordre du geste courant d'abord.
            ⚠️ Le ✓ doré est la convention de l'édition en cours dans toute la
            page (voir spec/siege/recommandations.md). */}
        <div className="mt-1 flex flex-none items-center gap-1.5">
          <button
            onClick={onToggleEdit}
            aria-pressed
            className="text-star transition hoverable:brightness-125"
            title="Terminer"
            aria-label="Terminer"
          >
            <Check size={14} />
          </button>
          <BoutonIcone
            onClick={() => recos.removeCounter(reco.id, deckIndex, counterIndex)}
            ton="danger"
            libelle="Retirer cette défense"
            icone={<Trash2 size={13} />}
          />
        </div>
      </div>

      {/* Condition éventuelle — une ligne, pas un pavé : elle précise QUAND ça
          marche, elle ne redit pas comment jouer (c'est la consigne du deck). */}
      <Champ
        value={counter.note}
        maxLength={COUNTER_NOTE_MAX}
        onChange={(e) =>
          recos.setCounterNote(reco.id, deckIndex, counterIndex, e.target.value)
        }
        onBlur={(e) => {
          const t = e.target.value.trim();
          if (t !== counter.note) recos.setCounterNote(reco.id, deckIndex, counterIndex, t);
        }}
        placeholder="Précision (ex. « si le Chloe est en lead »)…"
        className="mt-1.5 bg-panel py-1 text-micro"
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
  onSet,
}: {
  slot: RecoSlot;
  monster: Monster | null;
  onSet: (key: RecoStatKey, total: number | null) => void;
}) {
  // ⚠️ **PLUS de table qui défile.** Une table à colonnes fixes, sous sa
  // largeur mini, faisait défiler HORIZONTALEMENT dans la carte — et une
  // barre de défilement horizontale, sur trois ou quatre chiffres, est
  // illisible : on ne voit plus la ligne entière d'un coup d'œil. Chaque
  // stat est maintenant une ligne `flex-wrap` : label, base, bonus, total —
  // si la largeur manque, le TOTAL passe à la ligne suivante plutôt que de
  // sortir du cadre. Chaque valeur porte son propre petit mot (« base »,
  // « total ») puisqu'il n'y a plus d'en-tête de colonne au-dessus pour le
  // dire.
  return (
    <div className="flex flex-col">
      {RECO_STATS.map((st) => {
        const known = baseFor(st.key, monster);
        const base = known ?? 0; // base inconnue → le champ vaut le total
        const total = slot.stats[st.key];
        const bonus = total != null ? total - base : null;
        return (
          <div
            key={st.key}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/40 py-1 text-micro last:border-0"
          >
            <span className="w-14 flex-none text-ink-dim">{st.label}</span>
            <span className="flex-none font-mono text-ink-dim tabular-nums">
              {known != null ? fmtStat(known) : '—'}
            </span>
            <span className="flex flex-none items-center gap-1">
              <span className="font-mono text-micro text-good/70">+</span>
              {/* Champ texte (et non `type=number`) : pas de boutons +/- à
                  droite, qui mangent la largeur d'une colonne déjà étroite.
                  `inputMode=numeric` garde le pavé numérique sur mobile.
                  `w-14` : cinq chiffres visibles — la plupart des stats en ont
                  autant (PV ~35 000).
                  ⚠️ **`pleineLargeur={false}` obligatoire ici.** `Champ` vaut
                  `w-full` par défaut : posé tel quel dans une ligne
                  `flex-wrap`, sans largeur de colonne pour le contenir, il
                  s'étirait sur presque toute la carte — un champ numérique de
                  cinq chiffres large comme la ligne entière. */}
              <Champ
                inputMode="numeric"
                value={bonus ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '' || raw === '-') return onSet(st.key, null);
                  if (!/^-?\d+$/.test(raw)) return; // on ignore la frappe invalide
                  onSet(st.key, base + Number(raw));
                }}
                placeholder="—"
                pleineLargeur={false}
                className="w-14 bg-panel px-1 py-0.5 text-micro font-mono tabular-nums text-good"
              />
            </span>
            <span
              className={`ml-auto flex-none font-mono tabular-nums ${
                total != null ? 'font-semibold text-ink' : 'text-ink-dim'
              }`}
            >
              {total != null ? `= ${fmtStat(total)}${st.suffix}` : '—'}
            </span>
          </div>
        );
      })}
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
          <span className={`font-mono text-micro ${left <= 0 ? 'text-fire' : 'text-ink-dim'}`}>
            {left} car.
          </span>
        )}
      </div>
      <textarea
        value={value}
        maxLength={max}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        // ⚠️ Trim à la SORTIE du champ, jamais à la frappe : trimer pendant
        // qu'on tape empêcherait d'écrire une espace ou un retour à la ligne.
        // Les retours à la ligne INTÉRIEURS sont conservés — ils font partie de
        // la mise en forme voulue par l'auteur (voir NoteBlock).
        onBlur={(e) => {
          const t = e.target.value.trim();
          if (t !== value) onChange(t);
        }}
        placeholder={placeholder}
        className="w-full bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs text-ink
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
      <p className="text-xs text-ink leading-relaxed whitespace-pre-line">{text}</p>
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
/**
 * ⚠️ **L'INTANGIBLE n'est pas un set qu'on recommande.**
 *
 * Joker à UNE pièce (`SET_INFO.intangible = { pieces: 1 }`, effects.ts) qui
 * complète n'importe quel set : on recommande « Violent + Will », jamais
 * « Intangible ». Le proposer revenait à réclamer un set de 2 pièces qui
 * n'existe pas.
 *
 * ⚠️ Même défaut, corrigé en même temps, dans le picker de l'Optimizer
 * (`outils/SetComboPicker.tsx`) — c'est là qu'il a été signalé. Les deux
 * grilles partaient de `RUNE_SETS` entier.
 *
 * ⚠️ Le rendu des sets DÉJÀ posés continue de lire `RUNE_SETS` : une reco
 * enregistrée avant ce correctif peut en contenir un, et il doit rester
 * affichable et retirable.
 */
const SETS_CHOISISSABLES = RUNE_SETS.filter((s) => s.key !== INTANGIBLE_SET);

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
  const full = !SETS_CHOISISSABLES.some((st) => canAddSet(current, st.key)); // plus rien ne rentre
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
        <span className="font-mono text-micro text-ink-dim">
          {used}/{MAX_SET_PIECES} runes
        </span>
      </div>

      {options.some((o) => o.length > 0) && (
        <div className="flex flex-wrap items-center gap-1 mb-1">
          {options.map((sets, oi) => {
            const vise = oi === target && options.length > 1;
            return (
              <span key={oi} className="flex flex-wrap items-center gap-1">
                {oi > 0 && <span className="px-0.5 font-mono text-xs text-ink-dim">|</span>}
                <span
                  className={`flex flex-wrap items-center gap-1 rounded-md ${
                    vise ? 'ring-1 ring-accent px-1 py-0.5' : ''
                  }`}
                >
                  {sets.length === 0 ? (
                    <span className="font-mono text-micro text-ink-dim italic">vide</span>
                  ) : (
                    sets.map((key, pos) => (
                      <span
                        key={pos}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-panel pl-1 pr-1.5 py-0.5"
                      >
                        {/* Cliquer la chip VISE sa possibilité : c'est ainsi
                            qu'on revient compléter une combinaison laissée
                            incomplète. Bouton distinct du ✕ (pas de bouton
                            imbriqué — les deux sont SIBLINGS dans la puce). */}
                        <ZoneCliquable
                          onClick={() => setFocus(oi)}
                          title={
                            oi === target
                              ? 'Les sets ajoutés vont dans cette possibilité'
                              : 'Éditer cette possibilité'
                          }
                          className="inline-flex items-center gap-1"
                        >
                          <RuneIcon setKey={key} size={14} />
                          <span className="text-micro text-ink">×{setPieces(key)}</span>
                        </ZoneCliquable>
                        {/* ⚠️ Pas `BoutonIcone` : sa plus petite taille
                            (`serre`, 20 px) est le plancher du BOUTON de la
                            librairie, mais reste plus haute que cette
                            puce (~16 px) — posée dedans, elle étirait toute
                            la puce à sa propre hauteur. Un bouton nu, sans
                            boîte imposée, épouse la hauteur du texte à côté
                            duquel il vit — exactement ce que cette puce
                            demande. */}
                        <button
                          onClick={() => onRemove(oi, pos)}
                          data-cible-fine
                          className="flex-none text-ink-dim transition hoverable:text-fire"
                          title="Retirer ce set"
                          aria-label="Retirer ce set"
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

      {/* Les deux actions sur la MÊME ligne, à égalité : chacune la moitié de
          la largeur de la carte, plutôt que sa largeur de contenu.
          ⚠️ **`grid grid-cols-2` + `pleineLargeur` sur chaque bouton, pas
          `flex` + `flex-1`.** `Bouton` pose `flex-none` dans son SOCLE (voir
          Bouton.tsx) : un `flex-1` posé en `className` ne le bat pas,
          `flex-none` vient APRÈS dans la feuille de style construite
          (vérifié, pas supposé). `pleineLargeur` pose `w-full`, qui lui
          s'applique bien malgré `flex-none` — dans une grille à 2 colonnes
          égales, chaque bouton remplit alors exactement sa moitié. */}
      <div className="grid grid-cols-2 gap-1">
        {/* ⚠️ `icone`, pas un « + » écrit dans le texte : c'était la seule
            incohérence entre les deux boutons de cette rangée, l'un portait
            son symbole dans l'icône (comme partout ailleurs dans l'app),
            l'autre dans le libellé. */}
        <Bouton
          onClick={() => setOpen((o) => !o)}
          disabled={full}
          aria-expanded={open}
          taille="xs"
          pleineLargeur
          icone={!full ? <Plus size={11} /> : undefined}
          libelle={full ? 'Plus de place (6 runes)' : 'Set'}
        />
        <Bouton
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
          taille="xs"
          pleineLargeur
          icone={<Plus size={11} />}
          libelle="Possibilité"
        />
      </div>

      {/* Choix par ICÔNES plutôt que par menu déroulant : on reconnaît un set du
          jeu à son symbole, pas à son nom dans une liste. Le panneau reste
          ouvert pour enchaîner les ajouts, et se referme tout seul dès que les
          6 runes sont prises — il n'y a alors plus rien à cliquer.
          ⚠️ Pas `BoutonIcone` : cette grille est un CHOIX D'ICÔNES DE JEU (les
          symboles de set), pas une action d'interface — même famille que la
          roue de runes et les emplacements d'artéfacts, qui restent hors de la
          librairie.
          ⚠️ **28 px, pas 32** : le jeu compte plus de vingt sets. À 32 px +
          `gap-1`, la grille pesait lourd sur une carte de siège déjà étroite —
          un pavé de cases pour un choix qu'on fait une fois par slot. `RuneIcon`
          descend à 16 px avec la case, le symbole restant net à cette taille
          (voir la roue de runes, qui le dessine déjà aussi petit). */}
      {open && !full && (
        <div className="mt-1 rounded-lg border border-border bg-panel p-1.5">
          <div className="flex flex-wrap gap-1">
            {SETS_CHOISISSABLES.map((st) => {
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
                  // ⚠️ `data-cible-fine` : grille serrée d'icônes de set, où une
                  // cible de 44 px déborderait sur la voisine.
                  data-cible-fine
                  className={`flex items-center justify-center w-7 h-7 rounded-md border transition
                    ${
                      fits
                        ? 'bg-panel2 border-border hoverable:border-accent'
                        : 'bg-panel border-border opacity-25 cursor-not-allowed'
                    }`}
                >
                  <RuneIcon setKey={st.key} size={16} />
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
              <span className="font-mono text-micro text-ink-dim">{label}</span>
              <span className="font-mono text-micro text-ink-dim">
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
                    <span className="text-micro text-ink">{artifactSubLabel(code)}</span>
                    <BoutonIcone
                      onClick={() => onRemove(key, code)}
                      ton="danger"
                      taille="serre"
                      icone={<X size={10} />}
                      libelle="Retirer cette propriété"
                    />
                  </span>
                ))}
              </div>
            )}

            {/* `value=""` en permanence : le menu sert à AJOUTER, pas à porter
                une sélection courante — sinon le dernier ajout resterait
                affiché comme s'il était encore modifiable là. */}
            <Selecteur
              value=""
              disabled={plein || dispo.length === 0}
              onChange={(e) => {
                const code = Number(e.target.value);
                if (code) onAdd(key, code);
              }}
              taille="dense"
              surface="panel"
              className="mt-0.5 text-ink-dim hoverable:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
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
            </Selecteur>
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
            <span className="font-mono text-micro text-ink-dim">{label}</span>
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
                        ? 'border-good bg-good/25'
                        : 'border-fire bg-fire/20'
                  }`}
                >
                  <span className={`text-micro ${ok === false ? 'text-fire' : 'text-ink'}`}>
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
    return <p className="font-mono text-micro text-ink-dim">Aucun set recommandé</p>;
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
            {oi > 0 && <span className="px-0.5 font-mono text-xs text-ink-dim">|</span>}
            {sets.length === 0 ? (
              <span className="font-mono text-micro text-ink-dim italic">aucun set</span>
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
                            ? 'border-good/70 bg-good/20'
                            : 'border-fire/70 bg-fire/20'
                      }`}
                    >
                      <RuneIcon setKey={key} size={14} />
                      <span className={`text-micro ${ok === false ? 'text-fire' : 'text-ink'}`}>
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
  return <span className={`font-mono text-micro ${m.cls}`}>· {m.text}</span>;
}

// Combien de fois le deck est montable EN PARALLÈLE avec la réserve 6★.
//
// ⚠️ Une pastille DISTINCTE du badge de statut : ce n'est pas un verdict sur le
// deck (« jouable », « à revoir ») mais une information de stock. Les fondre
// ferait lire « jouable ×2 » comme un degré de conformité.
//
// ⚠️ **6★ uniquement** — la box n'en contient pas d'autres (voir
// `countCopiesByCom2us`). Un monstre en réserve à 5★ ne se joue pas tel quel.
function CopiesBadge({ copies }: { copies: number | null }) {
  // `null` = pas de compte importé, ou deck vide : on ne dit rien plutôt que
  // d'annoncer « 0 fois », qui affirmerait quelque chose de faux.
  if (copies === null) return null;

  // ⚠️ Zéro se dit, et se dit en ROUGE : c'est l'information la plus utile de
  // la pastille — le deck ne peut pas être monté, faute d'exemplaires 6★.
  if (copies === 0) {
    return (
      <span
        className="font-mono text-micro text-fire"
        title="Il manque au moins un monstre 6★ en réserve pour monter ce deck"
      >
        · réalisable 0 fois
      </span>
    );
  }
  return (
    <span
      className="font-mono text-micro text-ink-dim"
      title={
        copies > 1
          ? `Tes monstres 6★ permettent de monter ce deck ${copies} fois en parallèle`
          : 'Tes monstres 6★ permettent de monter ce deck une seule fois'
      }
    >
      · réalisable {copies} fois
    </span>
  );
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
    return <div className="font-mono text-micro text-fire">monstre indisponible</div>;
  if (sm.status === 'unknown')
    // Possédé, mais aucun deck existant ne le réunit aux autres → rien à comparer.
    return <div className="font-mono text-micro text-ink-dim">possédé</div>;
  if (sm.status === 'ok')
    return (
      <div className="font-mono text-micro text-good" title={`Deck retenu : ${sm.owned?.label}`}>
        au niveau
      </div>
    );
  if (sm.status === 'ko')
    return (
      <div className="font-mono text-micro text-fire" title={`Deck retenu : ${sm.owned?.label}`}>
        {libelleCausesSlot(slotFaults(sm)) || 'critères non respectés'}
      </div>
    );
  return null;
}

// Liste « stat : minimum » avec, si un compte est chargé, la valeur réelle et
// l'écart (vert = atteint, rouge = il manque X).
//
// ⚠️ **Pas de colonne « total » permanente.** Base et bonus se lisent
// séparément par défaut ; un clic sur la table bascule vers le total —
// même geste que le détail d'une rune ou d'un artéfact équipé
// (`RuneDetailBox`/`ArtifactDetailBox` dans PieceDetail.tsx) : la carte du
// jeu montre « VIT +26 +5 » au repos, le total au clic. Trois colonnes
// affichées en permanence pour dire la même chose deux fois (bonus ET total)
// pesaient plus lourd que ce qu'elles ajoutaient.
function StatList({
  slot,
  monster,
  sm,
}: {
  slot: RecoSlot;
  monster: Monster | null;
  sm: SlotMatch | null;
}) {
  const entries = RECO_STATS.filter((st) => (slot.stats[st.key] ?? 0) > 0);
  const [total, setTotal] = useState(false);
  if (entries.length === 0) {
    return <p className="font-mono text-micro text-ink-dim">Aucune stat recommandée</p>;
  }
  const checkOf = (key: RecoStatKey) => sm?.checks.find((c) => c.key === key) ?? null;
  // La colonne « toi » n'a de sens qu'après une analyse.
  const analyse = !!sm && sm.checks.some((c) => c.actual !== null);

  // ⚠️ **PLUS de table qui défile** — même règle que `StatEditor` juste
  // au-dessus : chaque stat est une ligne `flex-wrap`, et la colonne
  // « actuel » passe à la ligne suivante plutôt que de sortir du cadre.
  // ⚠️ **Un seul en-tête « actuel », pas un mot répété à chaque ligne.**
  // Écrire « toi » devant chaque valeur pesait plus lourd que la colonne
  // qu'il remplaçait ; une seule étiquette au-dessus, alignée comme la
  // colonne l'était dans la table, suffit à la nommer une fois pour toutes.
  return (
    <ZoneCliquable
      onClick={() => setTotal((v) => !v)}
      aria-pressed={total}
      title={total ? 'Voir le détail (base + bonus)' : 'Voir les valeurs totales'}
      className="flex w-full flex-col text-left"
    >
      {analyse && (
        <div className="flex items-center pb-1">
          <span className="ml-auto label">actuel</span>
        </div>
      )}
      {entries.map((st) => {
        const req = slot.stats[st.key]!;
        const known = baseFor(st.key, monster);
        const bonus = known != null ? req - known : null;
        const c = checkOf(st.key);
        // Stat non respectée → ligne mise en évidence (fond rouge léger), pour
        // qu'on voie d'un coup CE qui bloque sans lire les chiffres.
        const rate = analyse && c && c.actual !== null && !c.ok;
        return (
          <div
            key={st.key}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/40 py-1
              text-micro last:border-0 ${rate ? 'bg-fire/10' : ''}`}
          >
            <span className={`w-14 flex-none ${rate ? 'text-fire font-semibold' : 'text-ink-dim'}`}>
              {st.label}
            </span>
            {total ? (
              <span className="flex-none font-mono font-semibold text-ink tabular-nums">
                {fmtStat(req)}
                {st.suffix}
              </span>
            ) : (
              <>
                <span className="flex-none font-mono text-ink-dim tabular-nums">
                  {known != null ? fmtStat(known) : '—'}
                </span>
                <span className="flex-none font-mono text-good tabular-nums">
                  {bonus != null ? `+${fmtStat(bonus)}` : '—'}
                </span>
              </>
            )}
            {analyse && (
              <span
                className={`ml-auto flex-none font-mono tabular-nums ${
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
                    {fmtStat(c.actual)}
                    {st.suffix}
                    {!c.ok && <span className="text-fire/70"> (−{fmtStat(-c.diff)})</span>}
                  </>
                ) : (
                  '—'
                )}
              </span>
            )}
          </div>
        );
      })}
    </ZoneCliquable>
  );
}
