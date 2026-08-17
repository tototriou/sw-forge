import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Download, Upload, Trash2, Lightbulb, AlertTriangle, XCircle, X, Gauge } from 'lucide-react';
import { Monster, Reco } from '../../types';
import { UseRecoState } from '../../hooks/useSiegeRecos';
import { UseSiegeState } from '../../hooks/useSiegeState';
import { useStickyState } from '../../hooks/useStickyState';
import { teamSummary, isTeamUsable } from '../../lib/recoFromSiege';
import { encodeRecosJson, validateRecosImport, ImportReport, slugify } from '../../lib/recoShare';
import { matchReco, RecoMatch } from '../../lib/recoMatch';
import { chercheMonstre, RecoHit, RecoSearchMode } from '../../lib/recoSearch';
import { ConfirmDialog } from '../../ui/Dialogs';
import { OwnedBuild, OwnedTeam, indexBuildsByCom2us } from '../../lib/ownedBuilds';
import { formesJouables } from '../../lib/monsterForms';
import Segmented from '../Segmented';
import MobileSheet from '../../ui/MobileSheet';
import MonsterAvatar from '../MonsterAvatar';
import MonsterPicker from '../MonsterPicker';
import RecoCard from './RecoCard';
import { Bouton, BoutonIcone, Selecteur, ZoneCliquable } from '../../ui';

interface Props {
  recos: UseRecoState;
  monsters: Monster[];
  builds: OwnedBuild[]; // tous les builds connus (box + RTA + siège) → « je possède ce monstre »
  teams: OwnedTeam[]; // équipes réellement composées → « j'ai un deck avec ces monstres »
  // Exemplaires 6★ possédés, par com2usId → « combien de fois puis-je monter ce
  // deck en parallèle ». Vient de la BOX seule (voir countCopiesByCom2us).
  copies6: Map<number, number>;
  offense: UseSiegeState; // équipes d'attaque de siège, réutilisables comme decks
  // Panneau d'actions mobile — piloté par le bouton « Options » (voir App.tsx).
  menuOuvert: boolean;
  onFermerMenu: () => void;
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

export default function RecoBoard({
  recos,
  monsters,
  builds,
  teams,
  copies6,
  offense,
  menuOuvert,
  onFermerMenu,
}: Props) {
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

  // ⚠️ **Lancée depuis le panneau « Options », au DOIGT.** Le bouton « Analyser
  // mes decks » de l'en-tête vit sur la carte elle-même — mais au doigt il
  // faut d'abord faire défiler jusqu'à la bonne recommandation pour l'atteindre.
  // Le panneau propose donc le même geste sans quitter le haut de l'écran : un
  // menu choisit LAQUELLE (il n'y a pas de carte sous les yeux pour le dire),
  // puis « Analyser » fait le reste — et ouvre la carte visée, pour que le
  // résultat soit là au premier défilement plutôt que caché repliée.
  const [pickAnalyse, setPickAnalyse] = useState('');
  function analyserDepuisPanneau() {
    const reco = list.find((r) => r.id === pickAnalyse);
    if (!reco) return;
    analyzeReco(reco);
    setChoixOuverture((m) => new Map(m).set(reco.id, true));
    setPickAnalyse('');
    onFermerMenu();
    setMsg({ text: `Analyse lancée pour « ${reco.name || 'cette recommandation'} ».` });
  }

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

  // ⚠️ **Confirmation avant l'export**, même s'il ne détruit rien sur place :
  // c'est un geste vers l'EXTÉRIEUR (un fichier qui part sur le disque, prêt à
  // être partagé), et la confirmation dit CE QUI VA SORTIR — combien de
  // recommandations, combien de decks — avant que ça parte, plutôt qu'un
  // message après coup qu'on ne lit qu'une fois le fichier déjà écrit.
  const [exportAConfirmer, setExportAConfirmer] = useState<{
    list: Reco[];
    label: string;
    usable: Reco[];
    decks: number;
  } | null>(null);

  function requestExport(list: Reco[], label: string) {
    // Une reco n'est exportable que si au moins un de ses decks a un monstre.
    const usable = list.filter((r) =>
      r.decks.some((d) => d.slots.some((s) => s.com2usId != null))
    );
    if (usable.length === 0) {
      // Rien à confirmer : l'export échouerait de toute façon.
      setMsg({ text: 'Rien à exporter : ajoute au moins un monstre.', error: true });
      return;
    }
    const decks = usable.reduce(
      (n, r) => n + r.decks.filter((d) => d.slots.some((s) => s.com2usId != null)).length,
      0
    );
    setExportAConfirmer({ list, label, usable, decks });
  }

  function handleExport() {
    if (!exportAConfirmer) return;
    const { usable, label, decks } = exportAConfirmer;
    // Un seul format ET un seul support : le fichier .json. Plus de copie au
    // presse-papier — l'import ne lit que des fichiers, un contenu collé
    // n'aurait nulle part où aller.
    const what = `${usable.length} recommandation(s) · ${decks} deck(s)`;
    download(`swforge-reco-${slugify(label)}.json`, encodeRecosJson(usable));
    setMsg({ text: `${what} · fichier .json téléchargé.` });
    setExportAConfirmer(null);
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

  // ⚠️ Rendues une seule fois, posées à DEUX endroits selon la largeur. Deux
  // copies auraient divergé au premier bouton ajouté.
  // ⚠️ Boutons de la librairie, pas des `<button>` redessinés — même geste que
  // SiegeBoard (`Bouton` porte déjà `icone`+`libelle`+`libelleCourt`).
  const actions = (
    <>
      <Bouton
        onClick={() => {
          const id = recos.addReco();
          setEditingId(id);
          setScrollToLast(true);
          // La nouvelle est « à moi » : ne pas la créer dans une vue qui la cache.
          if (filter === 'imported') setFilter('mine');
          // ⚠️ Même geste que « Ajouter une équipe » (SiegeBoard) : le panneau
          // « Options » se referme et la page défile jusqu'à la nouvelle carte.
          // Créer une reco est le geste principal de cet écran, comme composer
          // une équipe l'est en défense/offense — il doit se voir tout de suite,
          // pas rester caché derrière un panneau resté ouvert.
          onFermerMenu();
        }}
        icone={<Plus size={15} />}
        libelle="Créer une recommandation"
        libelleCourt="Créer"
      />

      <Bouton
        onClick={() => fileRef.current?.click()}
        icone={<Download size={15} />}
        libelle="Importer"
        title="Charger un fichier .json reçu d'un ami"
      />

      {/* ⚠️ **Toujours affiché, désactivé plutôt que retiré.** Un bouton qui
          apparaît une fois la première recommandation créée surprend : on ne
          comprend pas D'OÙ il sort, puisqu'on ne l'a jamais vu absent d'un
          geste volontaire. Désactivé, il reste un repère fixe de la barre —
          on sait qu'exporter est possible, juste pas encore. Même règle
          partout dans l'app : voir `boutonEffacer` ci-dessous. */}
      <Bouton
        onClick={() => requestExport(list, filter === 'all' ? 'toutes' : filter)}
        disabled={list.length === 0}
        icone={<Upload size={15} />}
        // ⚠️ Le LIBELLÉ NE CHANGE PAS avec le filtre. Un bouton qui se
        // renomme sous le curseur se lit comme un autre bouton : on cesse de
        // le reconnaître d'un écran à l'autre, et on relit une barre
        // d'actions qu'on connaissait. Ce qui part réellement se dit dans
        // l'infobulle, et le message de retour le récapitule.
        libelle="Tout exporter"
        libelleCourt="Exporter"
        title={
          list.length === 0
            ? 'Aucune recommandation à exporter'
            : filter === 'all'
              ? 'Exporter toutes les recommandations en un seul fichier'
              : "Exporter les recommandations affichées (celles du filtre actif)"
        }
      />
    </>
  );

  // Origine — le VRAI Segmented, pas une copie : deux contrôles à cran dans la
  // même page doivent avoir le même cadre, le même rayon et la même taille de
  // texte. Rendu une seule fois, posé à deux endroits selon la largeur (voir
  // plus bas) — même geste que `actions` et `effacer`.
  // ⚠️ `pleineLargeur` : au doigt, dans le panneau « Options », le cran prend
  // TOUTE la largeur (`Segmented` en `size="lg"`, intitulé au-dessus plutôt
  // qu'à côté) — c'est le seul contrôle de cette ligne, le laisser à sa
  // largeur propre le fait flotter dans une bande vide. À la souris, il garde
  // sa place à côté de son intitulé, dans la rangée des autres filtres.
  const origineFilter = (pleineLargeur: boolean) => {
    const segmented = (
      <Segmented
        value={filter}
        onChange={setFilter}
        // ⚠️ `md` à la souris, pas `sm` : posé seul sur sa ligne depuis qu'il
        // est sorti du bloc de filtres, ce contrôle a la place d'être aussi
        // lisible qu'un réglage structurant — `md` porte le texte et le
        // rembourrage de `lg` sans forcer sa largeur, contrairement à `lg`
        // (réservé au panneau, où il n'y a que lui sur la ligne).
        size={pleineLargeur ? 'lg' : 'md'}
        options={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          // Le compteur vit DANS le cran, APRÈS le libellé, en mono comme tout
          // ce qui se compare d'une ligne à l'autre. Il reste `ink-dim` posé
          // comme au repos : c'est une quantité, pas l'état du cran — le fond
          // dit déjà lequel est choisi (design.md).
          suffix: <span className="font-mono text-micro text-ink-dim">{counts[f.key]}</span>,
        }))}
      />
    );
    // ⚠️ **Pas d'intitulé « Origine » à la SOURIS.** Il avait sa raison d'être
    // DANS le bloc de filtres, aligné sur « Monstres » et « Rôle » en dessous
    // (même largeur `w-[76px]`, même grammaire intitulé+contrôle) — mais
    // Origine est sortie de ce bloc, seule sur sa ligne : les trois crans
    // (Toutes/Mes recos/Importées) se lisent d'eux-mêmes, rien ne les précède
    // plus à quoi l'intitulé pourrait s'aligner. Gardé au DOIGT (`mb-1 block`)
    // où il n'accompagne aucune autre rangée : c'est le seul repère du panneau
    // pour ce contrôle.
    return pleineLargeur ? (
      <div className="w-full">
        <span className="label mb-1 block">Origine</span>
        {segmented}
      </div>
    ) : (
      segmented
    );
  };

  // ⚠️ « Tout effacer » reste SÉPARÉ : dans la page il se pose à l'opposé
  // (`ml-auto`), loin des gestes de construction. Un bouton destructeur ne se
  // met pas à côté de celui qu'on presse en boucle — dans le panneau il garde
  // cette distance, détaché en bas.
  // ⚠️ Même habillage à deux visages que RTA/SiegeBoard (`boutonEffacer`) :
  // nu dans la page, fond + contour rouges et pleine largeur dans le panneau.
  // ⚠️ **Toujours affiché, désactivé s'il n'y a rien à effacer** — jamais
  // retiré. Un bouton qui surgit dès qu'on a créé une première recommandation
  // ne s'explique pas : on ne l'a jamais vu apparaître d'un geste, il était
  // juste absent. Désactivé, c'est un repère fixe de la page, dont l'état
  // dit lui-même pourquoi il ne répond pas — même règle partout dans l'app.
  const effacer = (dansLePanneau: boolean) => (
    <Bouton
      onClick={() => {
        setEffacementAConfirmer(true);
        onFermerMenu();
      }}
      disabled={all.length === 0}
      ton="danger"
      fond={dansLePanneau ? 'doux' : 'vide'}
      trait={dansLePanneau ? 'plein' : 'aucun'}
      pleineLargeur={dansLePanneau}
      taille="sm"
      icone={<Trash2 size={13} />}
      libelle="Tout effacer"
      title={all.length === 0 ? 'Aucune recommandation à effacer' : undefined}
      className="leading-none"
    />
  );

  return (
    <div>
      {/* ⚠️ Sous `lg`, les actions descendent dans le panneau « Options » :
          quatre boutons à libellé complet remplissaient deux rangées avant la
          première recommandation. */}
      <div className="mt-5 flex flex-wrap items-center gap-3 empty:mt-0">
        <div className="hidden lg:contents">{actions}</div>
        <div className="ml-auto hidden lg:contents">{effacer(false)}</div>
      </div>

      <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre="Actions — recommandations">
        <div data-rangee-actions>{actions}</div>

        {/* ⚠️ « Analyser mes decks », AU DOIGT : le bouton de l'en-tête d'une
            carte demande d'abord d'y faire défiler. Le panneau propose le même
            geste d'ici — un menu choisit LAQUELLE, puisqu'aucune carte n'est
            sous les yeux pour le dire — voir `analyserDepuisPanneau` plus haut.
            ⚠️ **Toujours affiché**, désactivé sans recommandation ni compte
            importé plutôt que retiré — même règle que « Tout exporter » et
            « Tout effacer » : un contrôle qui apparaît une fois qu'on a de
            quoi l'utiliser surprend, on ne l'a jamais vu absent d'un geste. */}
        <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
          <span className="label">Analyser une recommandation</span>
          <div className="flex items-center gap-1.5">
            <Selecteur
              value={pickAnalyse}
              onChange={(e) => setPickAnalyse(e.target.value)}
              disabled={list.length === 0 || builds.length === 0}
              className="flex-1"
            >
              <option value="">
                {list.length === 0
                  ? 'Aucune recommandation'
                  : builds.length === 0
                    ? 'Importe ton compte pour analyser'
                    : 'Choisir…'}
              </option>
              {list.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {r.name || `Recommandation ${i + 1}`}
                </option>
              ))}
            </Selecteur>
            <Bouton
              onClick={analyserDepuisPanneau}
              disabled={!pickAnalyse || list.length === 0 || builds.length === 0}
              icone={<Gauge size={14} />}
              libelle="Analyser"
              taille="sm"
            />
          </div>
        </div>

        {/* ⚠️ Origine AU DOIGT : descendue ici plutôt que sur la page, qui garde
            la carte pour la recherche — voir `origineFilter` plus haut.
            ⚠️ **Toujours affiché, actif même sans recommandation** — comme
            « Tout exporter » et « Tout effacer » un peu plus haut, ce n'est
            pas un bouton d'action qui perd son sens à vide : les trois crans
            (Toutes/Mes recos/Importées) restent de vrais filtres, juste tous
            à zéro. Le retirer avait le même défaut que les retirer, eux : il
            réapparaît une fois la première recommandation créée, sans qu'on
            comprenne d'où il sort. */}
        <div className="mt-4 border-t border-border pt-3">{origineFilter(true)}</div>
        <div data-zone-destructive className="mt-4 border-t border-border pt-3">
          {effacer(true)}
        </div>
      </MobileSheet>

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

      {/* ⚠️ Pas `destructif` : rien ne disparaît sur cet appareil, un fichier
          part seulement sur le disque. Le ton neutre le distingue d'un
          effacement — même si les deux se confirment. */}
      {exportAConfirmer && (
        <ConfirmDialog
          titre={
            exportAConfirmer.usable.length > 1
              ? `Exporter ${exportAConfirmer.usable.length} recommandations ?`
              : `Exporter « ${exportAConfirmer.usable[0].name || 'cette recommandation'} » ?`
          }
          message={`${exportAConfirmer.usable.length} recommandation${
            exportAConfirmer.usable.length > 1 ? 's' : ''
          } · ${exportAConfirmer.decks} deck${
            exportAConfirmer.decks > 1 ? 's' : ''
          } seront réunis dans un fichier .json téléchargé sur cet appareil.`}
          libelleAction="Exporter"
          onCancel={() => setExportAConfirmer(null)}
          onConfirm={handleExport}
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

      {/* ⚠️ **Origine, à la SOURIS : SORTIE du bloc de filtres, toujours
          affichée et active.** Contrairement à la recherche par composition
          (Monstres/Rôle, plus bas), qui n'a effectivement rien à filtrer sur
          une liste vide, Origine reste un vrai filtre même à zéro — les trois
          crans (Toutes/Mes recos/Importées) ont un sens dès qu'on en crée une
          première. Rendu une seule fois (`origineFilter`), posé aux deux
          endroits (ici et dans le panneau « Options » au doigt). */}
      <div className="mt-4 hidden lg:flex flex-wrap items-center gap-2">
        {origineFilter(false)}
      </div>

      {/* Bloc de filtres — composition cherchée, rôle.
          ⚠️ **Sans cadre ni intitulé « Monstres »** : les trois cases ET le
          champ de recherche disent déjà par leur FORME ce qu'on y fait — une
          composition de 3 monstres à composer —, un mot devant n'ajoutait
          rien. Le cadre (bordure + fond) enfermait un contenu qui n'a pas
          besoin d'être distingué du reste de la page : Origine, juste
          au-dessus, n'en a pas non plus.
          ⚠️ « Rôle » garde son intitulé, lui : contrairement aux cases, un
          `Segmented` Partout/Défense/Offense ne dit pas de lui-même sur QUOI
          il porte.
          ⚠️ N'apparaît que s'il y a des recommandations : à la différence
          d'Origine, il n'y a RIEN à chercher dans une liste vide — poser le
          bloc quand même laisserait croire qu'on n'a rien trouvé alors qu'il
          n'y a rien. */}
      {all.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {/* Composition cherchée. */}
          <div className="flex flex-wrap items-center gap-2">
            {/* ⚠️ **La recherche à GAUCHE, les portraits à DROITE.** C'est le
                champ qu'on utilise en premier — le regard commence par lui,
                pas par des cases encore vides. Les cases suivent CE QU'ON A
                TAPÉ, elles se lisent après.
                ⚠️ `min(180px, 100%)` et non `180px` nu : un minimum rigide
                empêche le champ de se réduire dans un conteneur plus étroit,
                et c'est toute la page qui gagne un défilement latéral. Même
                garde que RecoCard et ReleasesPage. */}
            {!casesPleines ? (
              <div className="min-w-[min(180px,100%)] flex-1 sm:max-w-[260px]">
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
              <p className="flex-1 text-xs text-ink-dim">
                Trois monstres posés — clique un portrait pour le retirer.
              </p>
            )}

            {/* TROIS CASES, et non trois champs texte : elles montrent la
                forme de ce qu'on cherche — une composition de 3 monstres —, et
                reprennent le langage des slots de deck de la page. Poussées à
                DROITE (`ml-auto`) : c'est le résultat du champ à gauche, il se
                lit après lui, jamais avant. */}
            <div className="ml-auto flex items-center gap-1.5">
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
                  <ZoneCliquable
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
                  </ZoneCliquable>
                );
              })}
            </div>

            {/* Vider les trois cases d'un coup — distinct du retrait d'un seul
                portrait, qui sert à affiner. Il vit AVEC les cases qu'il vide,
                et non avec le sélecteur de rôle, qui ne les touche pas. */}
            {/* ⚠️ Ton NEUTRE, pas `danger` : vider une recherche se repose en un
                geste, ça ne se confirme pas (voir spec/README.md) — la
                surestimer en rouge permanent la ferait paraître plus grave
                qu'elle ne l'est. */}
            {aUneRecherche && (
              <Bouton
                onClick={effacerRecherche}
                taille="sm"
                icone={<X size={13} />}
                libelle="Vider"
                title="Vider la recherche"
                aria-label="Vider la recherche"
                className="flex-none"
              />
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
                onExport={(r) => requestExport([r], r.name || `reco-${i + 1}`)}
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
        <BoutonIcone
          onClick={onClose}
          libelle="Fermer le rapport"
          icone={<X size={14} />}
          className="ml-auto"
        />
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
