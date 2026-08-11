import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Download, Upload, Trash2, Lightbulb, AlertTriangle, XCircle, X } from 'lucide-react';
import { Monster, Reco } from '../../types';
import { UseRecoState } from '../../hooks/useSiegeRecos';
import { UseSiegeState } from '../../hooks/useSiegeState';
import { useStickyState } from '../../hooks/useStickyState';
import { teamSummary, isTeamUsable } from '../../lib/recoFromSiege';
import { encodeRecosJson, validateRecosImport, ImportReport, slugify } from '../../lib/recoShare';
import { matchReco, RecoMatch } from '../../lib/recoMatch';
import { ConfirmDialog } from '../Dialogs';
import { OwnedBuild, OwnedTeam, indexBuildsByCom2us } from '../../lib/ownedBuilds';
import RecoCard from './RecoCard';

interface Props {
  recos: UseRecoState;
  monsters: Monster[];
  builds: OwnedBuild[]; // tous les builds connus (box + RTA + siège) → « je possède ce monstre »
  teams: OwnedTeam[]; // équipes réellement composées → « j'ai un deck avec ces monstres »
  offense: UseSiegeState; // équipes d'attaque de siège, réutilisables comme decks
}

// Télécharge un texte en fichier (aucun envoi réseau).
function download(filename: string, text: string, mime = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Filtre d'origine : mes créations vs ce qu'on m'a partagé.
type OriginFilter = 'all' | 'mine' | 'imported';
const FILTERS: { key: OriginFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'mine', label: 'Mes recos' },
  { key: 'imported', label: 'Importées' },
];

export default function RecoBoard({ recos, monsters, builds, teams, offense }: Props) {
  const [filter, setFilter] = useStickyState<OriginFilter>('recos.filter', 'all');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // Rapport de validation du dernier import : NON éphémère (il faut pouvoir le lire).
  const [report, setReport] = useState<ImportReport | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Recommandations dépliées (« Consulter ») — toutes repliées par défaut, pour
  // garder une liste lisible quand on en a beaucoup.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) =>
    setOpenIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const fileRef = useRef<HTMLInputElement>(null);

  // Scroll vers la recommandation qu'on vient de créer (comme les équipes).
  const [scrollToLast, setScrollToLast] = useState(false);
  const [effacementAConfirmer, setEffacementAConfirmer] = useState(false);
  const lastRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollToLast) return;
    lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollToLast(false);
  }, [scrollToLast]);

  // Message éphémère (même convention que l'import de compte).
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.error ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const monsterByCom2us = useMemo(() => {
    const m = new Map<number, Monster>();
    for (const mon of monsters) if (mon.com2usId != null) m.set(mon.com2usId, mon);
    return m;
  }, [monsters]);

  // Index par id local : c'est ce que référencent les slots de siège.
  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  // Équipes d'offense proposables comme point de départ d'un deck (celles qui
  // contiennent au moins un monstre partageable).
  const offenseTeams = useMemo(
    () =>
      offense.state.teams
        .map((team, index) => ({
          team,
          index,
          summary: teamSummary(team, monsterById),
          monsters: team.slots.map((s) => (s.monsterId ? monsterById.get(s.monsterId) ?? null : null)),
        }))
        .filter(({ team }) => isTeamUsable(team, monsterById)),
    [offense.state.teams, monsterById]
  );

  const matchCtx = useMemo(
    () => ({ builds: indexBuildsByCom2us(builds), teams }),
    [builds, teams]
  );

  // Confrontation À LA DEMANDE (bouton « Analyser ») et non à chaque rendu :
  // on mémorise la reco et les builds analysés pour détecter qu'un résultat est
  // périmé (toute édition recrée les objets → comparaison par identité).
  const [analyses, setAnalyses] = useState<
    Map<string, { match: RecoMatch; reco: Reco; builds: OwnedBuild[] }>
  >(new Map());

  const analyzeReco = (reco: Reco) =>
    setAnalyses((m) => new Map(m).set(reco.id, { match: matchReco(reco, matchCtx), reco, builds }));

  // Effacer le résultat : la carte redevient neutre (plus d'aura ni de pastille).
  const clearAnalysis = (id: string) =>
    setAnalyses((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });

  const matchOf = (reco: Reco): RecoMatch | null => {
    const entry = analyses.get(reco.id);
    return entry && entry.reco === reco && entry.builds === builds ? entry.match : null;
  };

  function handleExport(list: Reco[], label: string) {
    // Une reco n'est exportable que si au moins un de ses decks a un monstre.
    const usable = list.filter((r) =>
      r.decks.some((d) => d.slots.some((s) => s.com2usId != null))
    );
    if (usable.length === 0) {
      setMsg({ text: 'Rien à exporter : ajoute au moins un monstre.', error: true });
      return;
    }
    const decks = usable.reduce(
      (n, r) => n + r.decks.filter((d) => d.slots.some((s) => s.com2usId != null)).length,
      0
    );
    // Un seul format ET un seul support : le fichier .json. Plus de copie au
    // presse-papier — l'import ne lit que des fichiers, un contenu collé
    // n'aurait nulle part où aller.
    const what = `${usable.length} recommandation(s) · ${decks} deck(s)`;
    download(`swforge-reco-${slugify(label)}.json`, encodeRecosJson(usable));
    setMsg({ text: `${what} · fichier .json téléchargé.` });
  }

  // JSON uniquement, et **par fichier uniquement** : pas de zone de collage.
  // Une recommandation se transmet comme une pièce jointe ; un champ de texte
  // libre n'apportait qu'une seconde voie à valider et à expliquer.
  // Le contenu est VALIDÉ :
  // rien n'est importé en cas d'erreur bloquante, et les corrections appliquées
  // sont remontées à l'utilisateur.
  function applyImport(text: string) {
    const rep = validateRecosImport(text);

    // Monstres absents des données chargées : signalés ici (le validateur de
    // format ne connaît pas le bestiaire).
    if (rep.recos) {
      const inconnus = new Set<number>();
      for (const r of rep.recos)
        for (const d of r.decks)
          for (const s of d.slots)
            if (s.com2usId != null && !monsterByCom2us.has(s.com2usId)) inconnus.add(s.com2usId);
      if (inconnus.size > 0) {
        rep.warnings.push(
          `${inconnus.size} monstre(s) inconnu(s) des données chargées (id ${[...inconnus]
            .slice(0, 5)
            .join(', ')}${inconnus.size > 5 ? '…' : ''}) : affichés sans portrait et non confrontés.`
        );
      }
    }

    setReport(rep);
    if (!rep.recos) return; // erreurs bloquantes : on n'importe rien

    // Un import AJOUTE toujours, il ne remplace jamais : les recommandations
    // sont du contenu créé à la main, non re-dérivable. Pour repartir de zéro,
    // « Tout effacer » est là — c'est un geste explicite et séparé.
    const n = recos.importRecos(rep.recos);
    setMsg({
      text: `${n} recommandation(s) · ${rep.counts.decks} deck(s) · ${rep.counts.monstres} monstre(s) importés.`,
    });
    // Ne pas cacher ce qu'on vient d'importer si le filtre montrait « mes recos ».
    if (filter === 'mine') setFilter('all');
  }

  const all = recos.state.recos;
  const counts = {
    all: all.length,
    mine: all.filter((r) => r.origin === 'mine').length,
    imported: all.filter((r) => r.origin === 'imported').length,
  };
  const list = filter === 'all' ? all : all.filter((r) => r.origin === filter);

  return (
    <div>
      <div className="flex items-center gap-3 mt-5 flex-wrap">
        <button
          onClick={() => {
            const id = recos.addReco();
            setEditingId(id);
            setScrollToLast(true);
            // La nouvelle est « à moi » : ne pas la créer dans une vue qui la cache.
            if (filter === 'imported') setFilter('mine');
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-[13px]
                     text-ink hoverable:border-accent transition"
        >
          <Plus size={15} /> Créer une recommandation
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-[13px]
                     text-ink-dim hoverable:text-ink hoverable:border-accent transition"
          title="Charger un fichier .json reçu d'un ami"
        >
          <Download size={15} /> Importer
        </button>

        {list.length > 0 && (
          <button
            onClick={() => handleExport(list, filter === 'all' ? 'toutes' : filter)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-[13px]
                       text-ink-dim hoverable:text-ink hoverable:border-accent transition"
            title={
              filter === 'all'
                ? 'Exporter toutes les recommandations en un seul fichier'
                : "Exporter les recommandations affichées (celles du filtre actif)"
            }
          >
            <Upload size={15} /> {filter === 'all' ? 'Tout exporter' : "Exporter l'affichage"}
          </button>
        )}

        {all.length > 0 && (
          <button
            onClick={() => setEffacementAConfirmer(true)}
            className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-dim hoverable:text-fire transition"
          >
            <Trash2 size={13} /> Tout effacer
          </button>
        )}
      </div>

      {effacementAConfirmer && (
        <ConfirmDialog
          titre="Effacer toutes les recommandations ?"
          message="Les tiennes comme celles que tu as importées seront supprimées, avec tous leurs decks. Tes équipes de siège ne sont pas touchées."
          libelleAction="Tout effacer"
          destructif
          onCancel={() => setEffacementAConfirmer(false)}
          onConfirm={() => {
            setEffacementAConfirmer(false);
            recos.clearAll();
          }}
        />
      )}

      {/* Filtre d'origine : n'apparaît que s'il y a quelque chose à trier */}
      {all.length > 0 && (
        <div className="mt-3 flex items-center gap-1 bg-panel border border-border rounded-xl p-1 w-fit">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = counts[f.key];
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition
                  ${active ? 'bg-accent-soft text-ink shadow' : 'text-ink-dim hoverable:text-ink'}`}
              >
                {f.label}
                <span className={`font-mono text-[11px] ${active ? 'text-ink-dim' : 'opacity-70'}`}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Import : un seul chemin, le fichier .json (input déclenché par le
          bouton « Importer » ci-dessus). */}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de recharger le même fichier
          if (!f) return;
          f.text().then(applyImport);
        }}
      />

      {msg && (
        <p className={`mt-3 text-[12.5px] ${msg.error ? 'text-fire' : 'text-emerald-400'}`}>{msg.text}</p>
      )}

      {report && (report.errors.length > 0 || report.warnings.length > 0) && (
        <ValidationReport report={report} onClose={() => setReport(null)} />
      )}

      {all.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-panel/40 py-16 px-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-panel2 border border-border mb-4">
            <Lightbulb size={26} className="text-ink-dim" />
          </div>
          <p className="text-ink-dim text-[14px] max-w-md">
            Aucune recommandation. <b className="text-ink">Crée-en une</b> pour proposer un{' '}
            <b className="text-ink">ensemble de decks</b> avec les sets, les artéfacts et les stats à
            viser sur chaque monstre, ou <b className="text-ink">importe</b> celle d'un autre joueur pour vérifier
            lesquels de ses decks tu peux jouer.
          </p>
        </div>
      ) : list.length === 0 ? (
        // Il y a des recommandations, mais aucune dans le filtre actif.
        <div className="mt-6 rounded-xl border border-dashed border-border bg-panel/40 py-8 px-6 text-center">
          <p className="text-ink-dim text-[13px]">
            {filter === 'mine'
              ? "Tu n'as créé aucune recommandation pour l'instant."
              : "Tu n'as importé aucune recommandation pour l'instant."}{' '}
            <button onClick={() => setFilter('all')} className="text-ink underline hoverable:text-star transition">
              Voir toutes les recommandations
            </button>
          </p>
        </div>
      ) : (
        // Une recommandation contient plusieurs decks (3 monstres chacun) :
        // elle prend toute la largeur, pas de mise en 2 colonnes.
        <div className="mt-6 flex flex-col gap-4">
          {list.map((reco, i) => (
            <div key={reco.id} ref={i === list.length - 1 ? lastRef : undefined}>
              <RecoCard
                reco={reco}
                index={i}
                monsters={monsters}
                monsterByCom2us={monsterByCom2us}
                monsterById={monsterById}
                offenseTeams={offenseTeams}
                match={matchOf(reco)}
                canAnalyze={builds.length > 0}
                onAnalyze={() => analyzeReco(reco)}
                onClearAnalysis={() => clearAnalysis(reco.id)}
                open={openIds.has(reco.id)}
                onToggleOpen={toggleOpen}
                editing={editingId === reco.id}
                onToggleEdit={(id) => setEditingId((cur) => (cur === id ? null : id))}
                onExport={(r) => handleExport([r], r.name || `reco-${i + 1}`)}
                recos={recos}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Rapport de validation du dernier import. Reste affiché jusqu'à fermeture :
// contrairement au message de succès, il y a quelque chose à LIRE.
function ValidationReport({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const bloque = report.errors.length > 0;
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2.5 ${
        bloque ? 'border-fire/50 bg-fire/5' : 'border-amber-500/40 bg-amber-500/5'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {bloque ? (
          <XCircle size={15} className="flex-none text-fire" />
        ) : (
          <AlertTriangle size={15} className="flex-none text-amber-400" />
        )}
        <span className={`text-[12.5px] font-semibold ${bloque ? 'text-fire' : 'text-amber-300'}`}>
          {bloque
            ? "Import refusé — le contenu n'est pas valide"
            : `Import effectué avec ${report.warnings.length} correction${report.warnings.length > 1 ? 's' : ''}`}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-ink-dim hoverable:text-ink transition"
          title="Fermer le rapport"
        >
          <X size={14} />
        </button>
      </div>

      <ul className="space-y-0.5 max-h-[220px] overflow-y-auto">
        {report.errors.map((e, i) => (
          <li key={`e${i}`} className="text-[12px] text-fire leading-snug">
            • {e}
          </li>
        ))}
        {report.warnings.map((w, i) => (
          <li key={`w${i}`} className="text-[12px] text-amber-300/90 leading-snug">
            • {w}
          </li>
        ))}
      </ul>

      {!bloque && (
        <p className="mt-1.5 font-mono text-[11px] text-ink-dim">
          {report.counts.recos} recommandation(s) · {report.counts.decks} deck(s) ·{' '}
          {report.counts.monstres} monstre(s) retenus.
        </p>
      )}
    </div>
  );
}
