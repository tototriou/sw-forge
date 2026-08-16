import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Download, Upload, Trash2, Lightbulb, AlertTriangle, XCircle, X } from 'lucide-react';
import { Monster, Reco } from '../../types';
import { UseRecoState } from '../../hooks/useSiegeRecos';
import { UseSiegeState } from '../../hooks/useSiegeState';
import { useStickyState } from '../../hooks/useStickyState';
import { teamSummary, isTeamUsable } from '../../lib/recoFromSiege';
import { encodeRecosJson, validateRecosImport, ImportReport, slugify } from '../../lib/recoShare';
import { matchReco, RecoMatch } from '../../lib/recoMatch';
import { chercheMonstre, RecoHit, RecoSearchMode } from '../../lib/recoSearch';
import { ConfirmDialog } from '../Dialogs';
import { OwnedBuild, OwnedTeam, indexBuildsByCom2us } from '../../lib/ownedBuilds';
import { formesJouables } from '../../lib/monsterForms';
import Segmented from '../Segmented';
import MonsterAvatar from '../MonsterAvatar';
import MonsterPicker from '../MonsterPicker';
import RecoCard from './RecoCard';

interface Props {
  recos: UseRecoState;
  monsters: Monster[];
  builds: OwnedBuild[]; // tous les builds connus (box + RTA + siège) → « je possède ce monstre »
  teams: OwnedTeam[]; // équipes réellement composées → « j'ai un deck avec ces monstres »
  // Exemplaires 6★ possédés, par com2usId → « combien de fois puis-je monter ce
  // deck en parallèle ». Vient de la BOX seule (voir countCopiesByCom2us).
  copies6: Map<number, number>;
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

// Où chercher quand on tape un nom de monstre. Le mode FILTRE : ce qui relève
// de l'autre rôle n'est pas affiché — voir lib/recoSearch.ts.
const SEARCH_MODES: { key: RecoSearchMode; label: string; hint: string }[] = [
  { key: 'all', label: 'Partout', hint: 'Dans les decks et dans les défenses visées' },
  {
    key: 'defense',
    label: 'Défense à taper',
    hint: 'Uniquement dans les défenses visées — quels decks la battent',
  },
  {
    key: 'offense',
    label: 'Offense à runer',
    hint: 'Uniquement dans les monstres des decks — qui joue ce monstre',
  },
];

// Sujet du message quand la recherche ne renvoie rien — il doit nommer le rôle
// où l'on vient de chercher, puisque le sélecteur filtre.
//
// ⚠️ Formulé au SINGULIER et sans accord à porter par la suite de la phrase
// (« … ne réunit X », « … ne contient X ») : le libellé change, pas la
// grammaire autour.
const LIBELLE_VIDE: Record<RecoSearchMode, string> = {
  all: 'Aucun deck ni défense visée',
  defense: 'Aucune défense visée',
  offense: 'Aucun deck d’offense',
};

export default function RecoBoard({ recos, monsters, builds, teams, copies6, offense }: Props) {
  const [filter, setFilter] = useStickyState<OriginFilter>('recos.filter', 'all');
  // Recherche par monstre : jusqu'à TROIS, autant qu'une composition.
  //
  // ⚠️ Les trois se cumulent en ET (voir recoSearch.ts) : on décrit la défense
  // qu'on affronte, monstre par monstre, et chaque ajout précise au lieu
  // d'élargir. D'où trois champs et non un seul où l'on séparerait par des
  // espaces — un nom du jeu en contient (« Dark Cow Girl »), la séparation
  // serait donc ambiguë.
  // ⚠️ On stocke les NOMS, pas des `com2usId` : la recherche compare des noms
  // (voir recoSearch.ts), et un monstre d'une reco importée peut être absent des
  // données chargées — il ne porterait alors aucun id local.
  const [queries, setQueries] = useStickyState<string[]>('recos.queries', ['', '', '']);
  const [searchMode, setSearchMode] = useStickyState<RecoSearchMode>('recos.searchMode', 'all');
  const termesPoses = queries.map((q) => q.trim()).filter(Boolean);
  const aUneRecherche = termesPoses.length > 0;
  // Vide les trois cases d'un coup.
  const effacerRecherche = () => setQueries(['', '', '']);
  // Pose un monstre dans la PREMIÈRE case libre : un seul champ sert les trois,
  // on enchaîne donc les noms sans avoir à viser une case avant chaque saisie.
  const poserMonstre = (nom: string) =>
    setQueries((cur) => {
      const i = cur.findIndex((q) => !q.trim());
      if (i < 0) return cur; // les trois sont prises
      return cur.map((q, k) => (k === i ? nom : q));
    });
  // Retire un monstre. ⚠️ Les cases restantes ne sont PAS tassées : chacune garde
  // sa place, sinon les portraits sautent d'une case à l'autre sous le curseur.
  const retirerMonstre = (i: number) =>
    setQueries((cur) => cur.map((q, k) => (k === i ? '' : q)));
  const casesPleines = queries.every((q) => q.trim());
  // ⚠️ LA MÊME liste que celle du sélecteur (voir lib/monsterForms.ts) : les
  // cases doivent afficher le portrait de la forme réellement proposée, pas
  // celui d'une homonyme non éveillée restée dans les données brutes.
  const monstresJouables = useMemo(() => formesJouables(monsters), [monsters]);
  // Ids locaux des monstres déjà posés, pour les retirer des suggestions.
  const dejaPoses = useMemo(() => {
    const noms = new Set(queries.filter(Boolean));
    const ids = new Set<string>();
    for (const m of monstresJouables) if (noms.has(m.name)) ids.add(String(m.id));
    return ids;
  }, [queries, monstresJouables]);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // Rapport de validation du dernier import : NON éphémère (il faut pouvoir le lire).
  const [report, setReport] = useState<ImportReport | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Recommandations dépliées (« Consulter ») — toutes repliées par défaut, pour
  // garder une liste lisible quand on en a beaucoup.
  // ⚠️ UN SEUL état à trois valeurs par carte, et non deux ensembles qui se
  // corrigent l'un l'autre :
  //
  //   absent  → l'automatique décide (repliée, ou dépliée si c'est un résultat)
  //   true    → l'utilisateur l'a ouverte
  //   false   → l'utilisateur l'a fermée, même si c'est un résultat
  //
  // Deux ensembles séparés (« ouvertes » + « refermées pendant la recherche »)
  // demandaient TROIS clics pour fermer une carte à la fois ouverte à la main et
  // trouvée par la recherche : chaque clic n'en corrigeait qu'un des deux, et
  // l'autre rouvrait aussitôt. Un choix explicite écrase l'automatique, point.
  const [choixOuverture, setChoixOuverture] = useState<Map<string, boolean>>(new Map());
  const estOuverte = (id: string) => choixOuverture.get(id) ?? hitPar.has(id);
  const toggleOpen = (id: string) => {
    const ouverte = estOuverte(id);
    setChoixOuverture((m) => new Map(m).set(id, !ouverte));
  };
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
    () => ({ builds: indexBuildsByCom2us(builds), teams, copies6 }),
    [builds, teams, copies6]
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
  const parOrigine = filter === 'all' ? all : all.filter((r) => r.origin === filter);

  // Recherche par monstre. `null` = aucune recherche en cours (état neutre de la
  // page : rien n'est filtré, rien n'est déplié d'office).
  const hits = useMemo(
    () => chercheMonstre(parOrigine, queries, searchMode, monsterByCom2us),
    [parOrigine, queries, searchMode, monsterByCom2us]
  );
  const list = hits ? hits.map((h) => h.reco) : parOrigine;
  // Où se trouve le monstre, par recommandation — la carte s'en sert pour
  // déplier les bons decks et surligner les bons portraits.
  // ⚠️ Changer de recherche efface les choix d’ouverture : ils valaient pour CES
  // résultats-là. Et SEULEMENT quand une recherche est en cours — sans cette
  // garde, taper puis effacer refermait les cartes ouvertes à la main avant.
  const cleRecherche = queries.join('\0');
  useEffect(() => {
    if (!cleRecherche.trim()) return;
    setChoixOuverture(new Map());
  }, [cleRecherche]);

  const hitPar = useMemo(() => {
    const m = new Map<string, RecoHit>();
    for (const h of hits ?? []) m.set(h.reco.id, h);
    return m;
  }, [hits]);

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
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-sm
                     text-ink hoverable:border-accent transition"
        >
          <Plus size={15} /> Créer une recommandation
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-sm
                     text-ink-dim hoverable:text-ink hoverable:border-accent transition"
          title="Charger un fichier .json reçu d'un ami"
        >
          <Download size={15} /> Importer
        </button>

        {list.length > 0 && (
          <button
            onClick={() => handleExport(list, filter === 'all' ? 'toutes' : filter)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-sm
                       text-ink-dim hoverable:text-ink hoverable:border-accent transition"
            // ⚠️ Le LIBELLÉ NE CHANGE PAS avec le filtre. Un bouton qui se
            // renomme sous le curseur se lit comme un autre bouton : on cesse de
            // le reconnaître d'un écran à l'autre, et on relit une barre
            // d'actions qu'on connaissait. Ce qui part réellement se dit dans
            // l'infobulle, et le message de retour le récapitule.
            title={
              filter === 'all'
                ? 'Exporter toutes les recommandations en un seul fichier'
                : "Exporter les recommandations affichées (celles du filtre actif)"
            }
          >
            <Upload size={15} /> Tout exporter
          </button>
        )}

        {all.length > 0 && (
          <button
            onClick={() => setEffacementAConfirmer(true)}
            className="ml-auto flex items-center gap-1.5 text-xs text-ink-dim hoverable:text-fire transition"
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
        <p className={`mt-3 text-sm ${msg.error ? 'text-fire' : 'text-good'}`}>{msg.text}</p>
      )}

      {report && (report.errors.length > 0 || report.warnings.length > 0) && (
        <ValidationReport report={report} onClose={() => setReport(null)} />
      )}

      {/* Bloc de filtres — origine, composition cherchée, rôle.
          ⚠️ UN SEUL bloc, et des RANGÉES INTITULÉES (même grammaire que
          l'inventaire d'artéfacts, voir account/ArtifactsList.tsx) : les trois
          contrôles filtrent tous la même liste, les poser à trois niveaux et
          sans intitulé donnait trois objets flottants dont rien ne disait qu'ils
          se combinaient. L'intitulé de largeur fixe aligne les contrôles entre
          eux, quelle que soit la longueur du mot.
          ⚠️ N'apparaît que s'il y a des recommandations : un filtre au-dessus
          d'une page vide n'a rien à filtrer, et laisse croire qu'on n'a rien
          trouvé alors qu'il n'y a rien. */}
      {all.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-border bg-panel/40 px-3 py-3">
          {/* Origine — le VRAI Segmented, pas une copie : deux contrôles à cran
              dans la même page doivent avoir le même cadre, le même rayon et la
              même taille de texte. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-[76px] flex-none label">Origine</span>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({
                key: f.key,
                label: f.label,
                // Le compteur vit DANS le cran, APRÈS le libellé, en mono comme
                // tout ce qui se compare d'une ligne à l'autre. Il reste
                // `ink-dim` posé comme au repos : c'est une quantité, pas l'état
                // du cran — le fond dit déjà lequel est choisi (design.md).
                suffix: <span className="font-mono text-micro text-ink-dim">{counts[f.key]}</span>,
              }))}
            />
          </div>

          {/* Composition cherchée. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-[76px] flex-none label">Monstres</span>
            {/* ⚠️ TROIS CASES, et non trois champs texte : elles montrent la
                forme de ce qu'on cherche — une composition de 3 monstres — avant
                même qu'on ait tapé quoi que ce soit, et reprennent le langage
                des slots de deck de la page. Un champ unique à côté les remplit
                dans l'ordre : on enchaîne les trois noms sans avoir à viser une
                case entre chaque. */}
            <div className="flex items-center gap-1.5">
              {queries.map((nom, i) => {
                // ⚠️ Résolu dans les formes JOUABLES, pas dans la liste
                // complète : plusieurs entrées portent le même nom (forme
                // éveillée, 2A, entrées techniques de SWARFARM). Chercher dans
                // `monsters` retombait sur la première venue — d'où un portrait
                // qui ne correspondait pas à celui choisi dans les suggestions.
                const mon = nom ? monstresJouables.find((m) => m.name === nom) ?? null : null;
                if (!nom) {
                  return (
                    <div
                      key={i}
                      className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-lg
                                 border border-dashed border-border text-ink-dim"
                      aria-hidden
                    >
                      <Plus size={15} />
                    </div>
                  );
                }
                return (
                  <button
                    key={i}
                    onClick={() => retirerMonstre(i)}
                    className="group relative flex h-[40px] w-[40px] flex-none items-center justify-center
                               rounded-lg border border-accent bg-accent/[0.08] transition
                               hoverable:border-fire"
                    title={`Retirer ${nom}`}
                    aria-label={`Retirer ${nom}`}
                  >
                    {/* Le portrait, pas le nom : plusieurs monstres portent le
                        même nom (formes 2A) — voir MonsterAvatar. Le repli sur
                        les initiales couvre un monstre absent des données. */}
                    <MonsterAvatar monster={mon} fallback={nom} size={32} />
                    <span
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full
                                 bg-panel2 text-ink-dim opacity-0 transition-opacity
                                 no-hover:opacity-100 group-hoverable:opacity-100"
                    >
                      <X size={10} />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Le champ unique, sur la MÊME rangée que les cases qu'il remplit :
                empilé dessous, rien ne disait qu'il les alimentait. Il disparaît
                quand les trois sont prises — un champ de saisie qui n'a plus où
                poser ce qu'on y tape se lit comme un bug. */}
            {!casesPleines ? (
              <div className="min-w-[180px] flex-1 sm:max-w-[260px]">
                <MonsterPicker
                  monsters={monsters}
                  // ⚠️ Les monstres déjà posés sont retirés des suggestions : le
                  // ET exige des monstres DISTINCTS (voir recoSearch.ts), poser
                  // deux fois le même garantirait zéro résultat.
                  excludeIds={dejaPoses}
                  placeholder="Nom du monstre…"
                  onPick={(id) => {
                    const m = monsters.find((x) => String(x.id) === id);
                    if (m) poserMonstre(m.name);
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-ink-dim">
                Trois monstres posés — clique un portrait pour le retirer.
              </p>
            )}

            {/* Vider les trois cases d'un coup — distinct du retrait d'un seul
                portrait, qui sert à affiner. Il vit AVEC les cases qu'il vide,
                et non avec le sélecteur de rôle, qui ne les touche pas. */}
            {aUneRecherche && (
              <button
                onClick={effacerRecherche}
                className="flex flex-none items-center gap-1 rounded-lg border border-border px-2 py-1
                           text-xs font-semibold text-ink-dim transition
                           hoverable:border-fire hoverable:text-fire"
                title="Vider la recherche"
                aria-label="Vider la recherche"
              >
                <X size={13} /> Vider
              </button>
            )}
          </div>

          {/* ⚠️ Le sélecteur FILTRE : ce qui relève de l'autre rôle n'est pas
              affiché (voir SEARCH_MODES). Il n'apparaît qu'une fois quelque
              chose posé — sans monstre, il n'y a rien à filtrer.
              Le compteur de résultats vit sur CETTE rangée : c'est le rôle qui
              décide combien il en reste, et il n'a ainsi plus besoin d'une
              hauteur de ligne en dur pour se caler sur un contrôle voisin. */}
          {aUneRecherche && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-[76px] flex-none label">Rôle</span>
              <Segmented
                value={searchMode}
                onChange={setSearchMode}
                options={SEARCH_MODES.map((m) => ({ key: m.key, label: m.label, hint: m.hint }))}
              />
              {hits && (
                <span className="font-mono text-micro text-ink-dim">
                  {hits.length === 0
                    ? 'aucun résultat'
                    : `${hits.length} reco${hits.length > 1 ? 's' : ''}`}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {all.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-panel/40 py-16 px-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-panel2 border border-border mb-4">
            <Lightbulb size={26} className="text-ink-dim" />
          </div>
          <p className="text-ink-dim text-sm max-w-md">
            Aucune recommandation. <b className="text-ink">Crée-en une</b> pour proposer un{' '}
            <b className="text-ink">ensemble de decks</b> avec les sets, les artéfacts et les stats à
            viser sur chaque monstre, ou <b className="text-ink">importe</b> celle d'un autre joueur pour vérifier
            lesquels de ses decks tu peux jouer.
          </p>
        </div>
      ) : list.length === 0 && hits ? (
        // ⚠️ La RECHERCHE ne renvoie rien — message distinct de celui du filtre.
        // Dire « tu n'as créé aucune recommandation » alors qu'on vient de taper
        // un nom ferait croire à une perte de données.
        <div className="mt-6 rounded-xl border border-dashed border-border bg-panel/40 py-8 px-6 text-center">
          <p className="text-sm text-ink-dim">
            {/* ⚠️ Le message dit LA RÈGLE quand il y a plusieurs monstres : les
                trois doivent être dans la MÊME composition. Sans ça, une
                recherche à trois termes qui ne renvoie rien se lit comme un bug
                — on voit bien chaque monstre à l'écran, séparément. */}
            {/* ⚠️ Le message nomme aussi le RÔLE cherché : avec un sélecteur
                qui filtre, « aucun deck ne réunit X » est incomplet — le deck
                existe peut-être, dans l'autre rôle. Le dire évite de conclure
                qu'il n'existe pas alors qu'il suffit de basculer sur
                « Partout ». */}
            {termesPoses.length > 1 ? (
              <>
                {LIBELLE_VIDE[searchMode]} ne réunit{' '}
                <b className="text-ink">{termesPoses.join(' + ')}</b>
              </>
            ) : (
              <>
                {LIBELLE_VIDE[searchMode]} ne contient «{' '}
                <b className="text-ink">{termesPoses[0]}</b> »
              </>
            )}
            {filter !== 'all' && ' dans ce filtre'}.{' '}
            {/* ⚠️ Sur un mode restrictif, la porte de sortie utile n'est pas
                d'effacer mais d'ÉLARGIR : le résultat existe peut-être dans
                l'autre rôle, et c'est un clic. Effacer reste proposé à côté. */}
            {searchMode !== 'all' && (
              <>
                <button
                  onClick={() => setSearchMode('all')}
                  className="text-ink underline transition hoverable:text-star"
                >
                  Chercher partout
                </button>
                {' · '}
              </>
            )}
            <button
              onClick={effacerRecherche}
              className="text-ink underline transition hoverable:text-star"
            >
              Effacer la recherche
            </button>
          </p>
        </div>
      ) : list.length === 0 ? (
        // Il y a des recommandations, mais aucune dans le filtre actif.
        <div className="mt-6 rounded-xl border border-dashed border-border bg-panel/40 py-8 px-6 text-center">
          <p className="text-ink-dim text-sm">
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
                // ⚠️ Une carte qui répond à la recherche est dépliée d’office,
                // mais la recherche PROPOSE ce dépliage, elle ne l’impose pas :
                // un choix explicite de l’utilisateur l’emporte toujours, dans les
                // deux sens (voir `estOuverte`).
                open={estOuverte(reco.id)}
                onToggleOpen={toggleOpen}
                hit={hitPar.get(reco.id) ?? null}
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
        bloque ? 'border-fire/50 bg-fire/5' : 'border-warn/40 bg-warn/5'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {bloque ? (
          <XCircle size={15} className="flex-none text-fire" />
        ) : (
          <AlertTriangle size={15} className="flex-none text-warn" />
        )}
        <span className={`text-xs font-semibold ${bloque ? 'text-fire' : 'text-warn'}`}>
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
          <li key={`e${i}`} className="text-xs text-fire leading-snug">
            • {e}
          </li>
        ))}
        {report.warnings.map((w, i) => (
          <li key={`w${i}`} className="text-xs text-warn/90 leading-snug">
            • {w}
          </li>
        ))}
      </ul>

      {!bloque && (
        <p className="mt-1.5 font-mono text-micro text-ink-dim">
          {report.counts.recos} recommandation(s) · {report.counts.decks} deck(s) ·{' '}
          {report.counts.monstres} monstre(s) retenus.
        </p>
      )}
    </div>
  );
}
