import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Swords,
  BookOpen,
  Home,
  Castle,
  Trophy,
  Menu,
  X,
  Calculator,
  Library,
  ChevronDown,
  CircleUserRound,
  Github,
  MessageCircle,
  Tag,
  Wrench,
  Sparkles,
} from 'lucide-react';
import HomePage from './pages/HomePage';
import BestiaryPage from './pages/BestiaryPage';
import RtaPage from './pages/RtaPage';
import SiegePage, { SiegeTab } from './pages/SiegePage';
import MechanicsPage from './pages/MechanicsPage';
import ReleasesPage from './pages/ReleasesPage';
import AccountPage from './pages/AccountPage';
import OutilsPage from './pages/OutilsPage';
import ComingSoon from './pages/ComingSoon';
import AccountImportControl from './components/AccountImportControl';
import SettingsMenu from './components/SettingsMenu';
import MobileNotice from './components/MobileNotice';
import { loadAccount, saveAccount } from './lib/accountStore';
import {
  dialogueMasque,
  persistenceEnabled,
  purgeDonneesConservees,
  setDialogueMasque,
  setPersistence,
  storageAvailable,
} from './hooks/usePersistence';
import { ConfirmDialog, KeepAccountDialog } from './components/Dialogs';
import GameIcon, { GameIconKey } from './components/GameIcon';
import { ArtifactDetail, CraftLine, Monster, RuneDetail } from './types';
import { useMonsters } from './hooks/useMonsters';
import { useCustomMonsters } from './hooks/useCustomMonsters';
import { useRtaState } from './hooks/useRtaState';
import { useSiegeState } from './hooks/useSiegeState';
import { useSiegeRecos } from './hooks/useSiegeRecos';
import { useOptimizerState } from './hooks/useOptimizerState';
import { collectOwnedBuilds, collectOwnedTeams, countCopiesByCom2us } from './lib/ownedBuilds';
import {
  BoxMonster,
  parseAccountJson,
  parseAccountExportDate,
  parseAccountSource,
  parseSiegeDefense,
  parseSiegeOffense,
  parseAccountBox,
  parseAccountInventory,
} from './lib/importAccount';
import { mapRtaItems, mapSiegeTeams, mapBoxMonsters, BoxItem } from './lib/applyAccount';

const DISCORD_INVITE = 'https://discord.gg/R2Fe4GJZET';

type Route =
  | 'home'
  | 'bestiary'
  | 'rta'
  | 'siege'
  | 'arene'
  | 'mecaniques'
  | 'compte'
  | 'outils'
  | 'releases';
export type AccountSub = 'monstres' | 'runes' | 'artefacts';
export type ToolSub = 'optimizer';

// Route + sous-route de siège (offense/défense) + sous-section « Mon compte »
// + sous-section « Outils » déduites du hash.
function parseHash(): {
  route: Route;
  siegeTab: SiegeTab;
  accountSub: AccountSub;
  toolSub: ToolSub;
} {
  const h = window.location.hash.replace(/^#\/?/, '');
  const base = {
    siegeTab: 'defense' as SiegeTab,
    accountSub: 'monstres' as AccountSub,
    toolSub: 'optimizer' as ToolSub,
  };
  if (h === 'rta') return { route: 'rta', ...base };
  if (h === 'bestiary') return { route: 'bestiary', ...base };
  if (h === 'arene') return { route: 'arene', ...base };
  if (h === 'compte' || h.startsWith('compte/')) {
    const accountSub: AccountSub =
      h === 'compte/runes' ? 'runes' : h === 'compte/artefacts' ? 'artefacts' : 'monstres';
    return { route: 'compte', siegeTab: 'defense', accountSub, toolSub: 'optimizer' };
  }
  if (h === 'outils' || h.startsWith('outils/')) {
    return { route: 'outils', siegeTab: 'defense', accountSub: 'monstres', toolSub: 'optimizer' };
  }
  if (h === 'mecaniques') return { route: 'mecaniques', ...base };
  if (h === 'releases') return { route: 'releases', ...base };
  if (h === 'siege' || h.startsWith('siege/')) {
    const siegeTab: SiegeTab =
      h === 'siege/offense' ? 'offense' : h === 'siege/recommandations' ? 'recos' : 'defense';
    return { route: 'siege', siegeTab, accountSub: 'monstres', toolSub: 'optimizer' };
  }
  return { route: 'home', ...base };
}

type NavItem = { key: Route; label: string; icon: typeof BookOpen; hash: string };

// Onglets principaux (outils). Arène est à part (voir ARENE_ITEM) : elle se
// positionne entre les dropdowns Outils et Ressources, pas dans ce groupe.
const NAV: NavItem[] = [
  { key: 'home', label: 'Accueil', icon: Home, hash: '#/' },
  { key: 'rta', label: 'RTA', icon: Swords, hash: '#/rta' },
  { key: 'siege', label: 'Siège', icon: Castle, hash: '#/siege/defense' },
];

const ARENE_ITEM: NavItem = { key: 'arene', label: 'Arène', icon: Trophy, hash: '#/arene' };

// Sous-sections de « Mon compte » (dropdown de nav).
// ⚠️ Icônes DU JEU (voir GameIcon), pas des pictogrammes de bibliothèque : un
// joueur reconnaît ses trois inventaires instantanément à celles-ci.
const ACCOUNT_SUBS: { sub: AccountSub; label: string; icon: GameIconKey; hash: string }[] = [
  { sub: 'monstres', label: 'Monstres', icon: 'monster', hash: '#/compte' },
  { sub: 'runes', label: 'Runes', icon: 'rune', hash: '#/compte/runes' },
  { sub: 'artefacts', label: 'Artéfacts', icon: 'artifact', hash: '#/compte/artefacts' },
];

// Sous-sections d'« Outils » (dropdown de nav) — un seul outil pour l'instant,
// structuré pour en accueillir d'autres sans retoucher la nav.
const OUTILS_SUBS: { sub: ToolSub; label: string; icon: typeof Sparkles; hash: string }[] = [
  { sub: 'optimizer', label: 'Optimizer', icon: Sparkles, hash: '#/outils/optimizer' },
];

// Regroupées sous « Ressources ».
const RESOURCES: NavItem[] = [
  { key: 'bestiary', label: 'Bestiaire', icon: BookOpen, hash: '#/bestiary' },
  { key: 'mecaniques', label: 'Mécaniques', icon: Calculator, hash: '#/mecaniques' },
  { key: 'releases', label: 'Nouveautés', icon: Tag, hash: '#/releases' },
];

export default function App() {
  const data = useMonsters();
  const custom = useCustomMonsters();

  // États remontés ici pour qu'un import unique alimente toutes les pages à la
  // fois (page courante affichée + les autres en arrière-plan).
  const rta = useRtaState();
  const siegeDef = useSiegeState('defense');
  const siegeOff = useSiegeState('offense');
  const recos = useSiegeRecos();
  const optimizer = useOptimizerState();

  // Compte (box + inventaire runes/artéfacts). En mémoire, et **conservé sur
  // l'appareil** si l'utilisateur l'a demandé dans le menu ⚙ (voir
  // spec/shared/import-compte.md).
  const [box, setBox] = useState<BoxItem[]>([]);
  const [runes, setRunes] = useState<RuneDetail[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactDetail[]>([]);
  const [crafts, setCrafts] = useState<CraftLine[]>([]);

  // Un nouveau compte importé (`appliquerImport`, `setBox` avec une NOUVELLE
  // référence) rend obsolètes les « Critères de recherche »/« Combinaisons
  // trouvées » de l'Optimizer — autre monstre possible, autre pool de runes.
  // ⚠️ Ici, dans App.tsx (jamais démonté), pas dans OptimizerSection.tsx
  // (démontée à chaque changement d'onglet — voir son commentaire de tête) :
  // importer un compte pendant qu'on est sur un AUTRE onglet doit quand même
  // vider l'Optimizer, pas seulement quand on l'a sous les yeux au moment de
  // l'import. Ignore la toute première exécution (montage) : `box` n'a pas
  // encore de valeur « précédente » à comparer, et l'Optimizer démarre de
  // toute façon déjà vide.
  const boxMountedRef = useRef(false);
  useEffect(() => {
    if (!boxMountedRef.current) {
      boxMountedRef.current = true;
      return;
    }
    optimizer.resetSearch();
  }, [box]);

  // Box telle que sortie de l'extracteur, avant résolution en monstres. C'est
  // ELLE qu'on enregistre : un `BoxItem` embarque l'objet `Monster` et figerait
  // la correspondance com2usId → monstre au moment de l'import.
  const rawBoxRef = useRef<BoxMonster[]>([]);

  // Vrai tant qu'on relit le compte conservé. ⚠️ Sans cet état, l'accueil
  // afficherait « ton compte n'est pas chargé » pendant les quelques dizaines de
  // millisecondes de lecture, puis tout apparaîtrait : on croit à une perte de
  // données, puis à un miracle.
  const [accountHydrating, setAccountHydrating] = useState(
    () => persistenceEnabled() && storageAvailable()
  );
  // Un import manuel pendant l'hydratation doit gagner : la lecture en cours ne
  // doit pas écraser le fichier que l'utilisateur vient de déposer.
  const importedManuallyRef = useRef(false);

  // Date de l'EXPORT chargé (`tvalue`), affichée dans le menu ⚙. Vaut aussi pour
  // un compte simplement en mémoire : elle dit l'âge des DONNÉES, pas celui de
  // l'enregistrement.
  const [accountExportedAt, setAccountExportedAt] = useState<number | null>(null);

  const [{ route, siegeTab, accountSub, toolSub }, setNav] = useState(parseHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [outilsOpen, setOutilsOpen] = useState(false);
  const outilsRef = useRef<HTMLDivElement>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askKeep, setAskKeep] = useState(false);
  // Fichier déposé, en attente de confirmation de remplacement.
  const [importEnAttente, setImportEnAttente] = useState<string | null>(null);
  // Confirmations à l'écran : purge globale (⚙), et refus de conservation alors
  // qu'on conservait déjà (la valeur portée est « ne plus me montrer »).
  const [purgeGlobale, setPurgeGlobale] = useState(false);
  const [purgeApresRefus, setPurgeApresRefus] = useState<boolean | null>(null);

  // Barre du haut : si la rangée complète (onglets + import + réglages) ne tient
  // pas sur UNE ligne, on bascule sur le menu hamburger plutôt que de laisser
  // les boutons passer à la ligne. Mesuré, pas fixé à un breakpoint : le nombre
  // d'onglets change à chaque nouvelle section, un seuil en dur serait périmé.
  const barRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const neededRef = useRef(0); // largeur d'une ligne complète, dernière mesure
  const [compactNav, setCompactNav] = useState(false);

  const resourcesActive = RESOURCES.some((r) => r.key === route);

  // Monstres officiels + monstres créés à la main (RTA & Siège).
  const allMonsters = useMemo(
    () => [...data.monsters, ...custom.customMonsters],
    [data.monsters, custom.customMonsters]
  );

  // Index com2usId → monstre, pour mapper les unités d'un export de compte.
  const monsterByCom2us = useMemo(() => {
    const m = new Map<number, Monster>();
    for (const mon of allMonsters) if (mon.com2usId != null) m.set(mon.com2usId, mon);
    return m;
  }, [allMonsters]);

  // Relecture du compte conservé, au démarrage.
  //
  // ⚠️ Attendre `data.monsters` : la box stockée n'est qu'une liste de
  // `com2usId`, elle a besoin de l'index pour redevenir des monstres. Lancer la
  // lecture trop tôt donnerait une box vide, sans erreur.
  useEffect(() => {
    if (!accountHydrating) return;
    // Données de monstres en échec : on abandonne la relecture plutôt que de
    // laisser « Chargement de ton compte… » tourner indéfiniment.
    if (data.loadState === 'error') {
      setAccountHydrating(false);
      return;
    }
    if (allMonsters.length === 0) return;
    let annule = false;
    loadAccount().then((rec) => {
      if (annule) return;
      // L'utilisateur a déposé un fichier pendant la lecture : son geste prime.
      if (rec && !importedManuallyRef.current) {
        rawBoxRef.current = rec.box;
        setBox(mapBoxMonsters(rec.box, monsterByCom2us));
        setRunes(rec.runes);
        setArtifacts(rec.artifacts);
        setCrafts(rec.crafts);
        setAccountExportedAt(rec.exportedAt);
      }
      setAccountHydrating(false);
    });
    return () => {
      annule = true;
    };
  }, [accountHydrating, allMonsters.length, monsterByCom2us, data.loadState]);

  // Tous les BUILDS connus du joueur : box (équipement porté) + preset RTA +
  // presets de siège. Un monstre a un build par contexte — s'en tenir à la box
  // ferait échouer la confrontation d'un deck de siège pourtant possédé.
  // + les ÉQUIPES réellement composées, pour distinguer « j'ai ces monstres »
  // de « j'ai un deck qui les réunit » (voir siege/recommandations.md).
  const { ownedBuilds, ownedTeams, copies6 } = useMemo(() => {
    const byId = new Map<string, Monster>();
    for (const mon of allMonsters) byId.set(String(mon.id), mon);
    return {
      ownedBuilds: collectOwnedBuilds({
        box,
        rta: Object.values(rta.state.entries),
        defense: siegeDef.state.teams,
        offense: siegeOff.state.teams,
        monsterById: byId,
      }),
      ownedTeams: collectOwnedTeams({
        defense: siegeDef.state.teams,
        offense: siegeOff.state.teams,
        monsterById: byId,
      }),
      // Exemplaires 6★ réellement possédés : la BOX seule, et non les builds
      // agrégés — un même monstre y figure une fois par preset, ce qui
      // multiplierait le compte. Voir `countCopiesByCom2us`.
      copies6: countCopiesByCom2us(box),
    };
  }, [box, rta.state.entries, siegeDef.state.teams, siegeOff.state.teams, allMonsters]);

  // Import GLOBAL : un seul fichier alimente RTA + siège défense + siège offense.
  //
  // ⚠️ Si des données existent déjà, on demande confirmation AVANT d'appliquer
  // quoi que ce soit — dans une modale de la page (`ReplaceImportDialog`), pas
  // dans un `confirm()` du navigateur. Le fichier attend dans `importEnAttente`
  // le temps de la réponse.
  //
  // ⚠️ « Annuler » ANNULE L'IMPORT — il ne doit surtout pas déclencher une
  // fusion : c'était le cas, et fusionner des équipes de siège les DÉDOUBLAIT
  // (un compte à 50 attaques repartait à 100). Un import de compte est un
  // rafraîchissement de l'état du jeu, jamais un ajout.
  function importAccount(text: string) {
    const aDejaDesDonnees =
      Object.keys(rta.state.entries).length > 0 ||
      siegeDef.state.teams.length > 0 ||
      siegeOff.state.teams.length > 0;
    if (aDejaDesDonnees) {
      setImportEnAttente(text);
      return;
    }
    appliquerImport(text);
  }

  function appliquerImport(text: string) {
    // ⚠️ Parser UNE fois et passer l'objet aux cinq extracteurs : chacun
    // reparsait le fichier de son côté, soit cinq JSON.parse d'un export de
    // 8 Mo. Les index internes (runes, unités, artéfacts) sont mémoïsés sur cet
    // objet, donc partagés eux aussi.
    const data = parseAccountSource(text);
    if (!data) {
      setImportMsg({ ok: false, text: 'Fichier JSON illisible.' });
      return;
    }

    const exporte = parseAccountExportDate(data);
    const rtaRes = parseAccountJson(data);
    const defRes = parseSiegeDefense(data);
    const offRes = parseSiegeOffense(data);
    const boxRes = parseAccountBox(data);
    const invRes = parseAccountInventory(data);

    const rtaItems = rtaRes.units ? mapRtaItems(rtaRes.units, monsterByCom2us) : [];
    const def = mapSiegeTeams(defRes.decks ?? [], monsterByCom2us);
    const off = mapSiegeTeams(offRes.decks ?? [], monsterByCom2us);
    const boxItems = mapBoxMonsters(boxRes.monsters ?? [], monsterByCom2us);

    if (
      rtaItems.length === 0 &&
      def.teams.length === 0 &&
      off.teams.length === 0 &&
      boxItems.length === 0
    ) {
      setImportMsg({
        ok: false,
        text:
          rtaRes.error || defRes.error || offRes.error || boxRes.error || 'Rien à importer depuis ce fichier.',
      });
      return;
    }

    if (rtaItems.length) {
      rta.clearAll();
      rta.importEntries(rtaItems);
    }
    if (def.teams.length) siegeDef.importTeams(def.teams);
    if (off.teams.length) siegeOff.importTeams(off.teams);
    // Box + inventaire : toujours remplacés par le dernier import.
    importedManuallyRef.current = true;
    rawBoxRef.current = boxRes.monsters ?? [];
    setAccountExportedAt(exporte);
    setBox(boxItems);
    setRunes(invRes.runes ?? []);
    setArtifacts(invRes.artifacts ?? []);
    setCrafts(invRes.crafts ?? []);

    // Enregistrement **après** la mise à jour de l'affichage et sans attendre :
    // une écriture de 2 Mo ne doit pas retarder l'apparition du compte. Un échec
    // (stockage plein, refusé) laisse l'import parfaitement utilisable pour la
    // session — on ne casse pas l'usage courant pour un problème de confort.
    if (persistenceEnabled()) {
      void saveAccount({
        box: rawBoxRef.current,
        runes: invRes.runes ?? [],
        artifacts: invRes.artifacts ?? [],
        crafts: invRes.crafts ?? [],
        exportedAt: exporte,
      });
    }

    const parts: string[] = [];
    if (boxItems.length) parts.push(`${boxItems.length} monstres 6★`);
    if (rtaItems.length) parts.push(`${rtaItems.length} monstres RTA`);
    if (def.teams.length) parts.push(`${def.teams.length} défenses`);
    if (off.teams.length) parts.push(`${off.teams.length} attaques`);
    const missing = def.missing + off.missing;
    setImportMsg({
      ok: true,
      text:
        `Import : ${parts.join(' · ')}` +
        (missing > 0 ? ` · ${missing} monstre(s) introuvable(s), à créer à la main` : '') +
        '.',
    });

    // La question de la conservation se pose ICI, une fois les données à l'écran
    // — pas dans un menu que personne n'ouvre (voir usePersistence). Elle revient
    // à CHAQUE import tant que « ne plus me montrer » n'est pas coché : le
    // contexte peut changer entre deux fichiers (poste partagé, ordinateur d'un
    // ami), et un choix pris une fois pour toutes ne le rattraperait jamais.
    //
    // ⚠️ **Après le succès seulement.** Proposer de conserver des données
    // qu'on vient d'échouer à lire n'aurait aucun sens.
    if (!dialogueMasque() && storageAvailable()) setAskKeep(true);
  }

  // Réponse à la fenêtre de choix. `null` = fermée sans répondre : on
  // n'enregistre rien et on redemandera, plutôt que d'interpréter un silence.
  function repondreConservation(keep: boolean | null, nePlusMontrer = false) {
    setAskKeep(false);
    if (keep === null) return; // fermée sans répondre : on ne décide rien

    // ⚠️ Refuser alors qu'on conservait déjà **efface tout l'existant** — prépa
    // RTA, équipes, recommandations. La fenêtre revenant à chaque import, un clic
    // machinal ne doit pas coûter des mois de travail : on repasse par une
    // confirmation, dont le défaut est de NE RIEN PERDRE.
    if (!keep && persistenceEnabled()) {
      setPurgeApresRefus(nePlusMontrer);
      return;
    }

    setDialogueMasque(nePlusMontrer);
    setPersistence(keep, persistCurrentAccount);
  }

  // Refus confirmé : on efface pour de bon.
  function confirmerRefusConservation(nePlusMontrer: boolean) {
    setPurgeApresRefus(null);
    setDialogueMasque(nePlusMontrer);
    setPersistence(false, persistCurrentAccount);
  }

  // Efface toutes les données locales (prépa RTA, équipes de siège,
  // recommandations, monstres perso) **et le compte conservé**.
  //
  // ⚠️ L'effacement du compte est asynchrone et doit finir AVANT le rechargement.
  // Sans l'attente, la page repart pendant la transaction et le compte pourrait
  // survivre à une action annoncée comme irréversible.
  async function clearAllData() {
    setPurgeGlobale(false);
    await purgeDonneesConservees();
    location.reload();
  }

  // Activation du réglage « Garder mon compte » : on enregistre ce qui est déjà
  // en mémoire, sinon il faudrait réimporter le même fichier pour rien.
  function persistCurrentAccount() {
    if (rawBoxRef.current.length === 0 && runes.length === 0 && artifacts.length === 0) return;
    void saveAccount({ box: rawBoxRef.current, runes, artifacts, crafts, exportedAt: accountExportedAt });
  }

  useEffect(() => {
    const onHash = () => {
      setNav(parseHash());
      setMenuOpen(false); // referme le menu mobile à chaque navigation
      setResourcesOpen(false); // referme le dropdown Ressources
      setAccountOpen(false); // referme le dropdown Mon compte
      setOutilsOpen(false); // referme le dropdown Outils
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Ferme les dropdowns (Ressources / Mon compte / Outils) au clic à l'extérieur.
  useEffect(() => {
    if (!resourcesOpen && !accountOpen && !outilsOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (resourcesRef.current && !resourcesRef.current.contains(t)) setResourcesOpen(false);
      if (accountRef.current && !accountRef.current.contains(t)) setAccountOpen(false);
      if (outilsRef.current && !outilsRef.current.contains(t)) setOutilsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [resourcesOpen, accountOpen, outilsOpen]);

  // Mesure de la barre du haut. En mode complet on RETIENT la largeur nécessaire
  // (`neededRef`) : une fois replié, la rangée ne contient plus la nav et ne
  // peut donc plus la mesurer — sans cette mémoire on ne saurait jamais quand
  // redéployer. `useLayoutEffect` : le repli est décidé avant peinture, donc
  // aucune image de barre débordante.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      if (navRef.current && toolsRef.current) {
        // +12 : le `gap-3` entre la nav et le bloc import/réglages.
        neededRef.current = navRef.current.offsetWidth + toolsRef.current.offsetWidth + 12;
      }
      // clientWidth 0 = barre masquée (mobile) : c'est le hamburger natif qui joue.
      setCompactNav(bar.clientWidth > 0 && bar.clientWidth < neededRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    // La nav aussi : la largeur de la barre ne bouge pas quand c'est son
    // CONTENU qui s'élargit (police chargée après coup, libellé plus long).
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [compactNav]);

  // Message d'import éphémère : il disparaît tout seul (un peu plus long pour une erreur).
  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), importMsg.ok ? 5000 : 9000);
    return () => clearTimeout(t);
  }, [importMsg]);

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-5 py-5 sm:py-6 pb-16">
        {/* ---- Barre repliée : logo + menu hamburger ----
            Sur mobile par CSS, et sur desktop dès que la rangée complète ne
            tient plus sur une ligne (`compactNav`). */}
        <div className={`mb-4 ${compactNav ? '' : 'sm:hidden'}`}>
          <div className="flex items-center justify-between">
            <a href="#/" className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="w-7 h-7" />
              <span className="font-display text-[18px] tracking-wide">SW Forge</span>
            </a>
            {/* Les réglages restent EN DEHORS du menu : accessibles en un geste
                quelle que soit la largeur, jamais enfouis derrière le hamburger. */}
            <div className="flex items-center gap-1.5">
              <SettingsMenu
                variant="bar"
                onClearData={() => setPurgeGlobale(true)}
                onKeepAccount={persistCurrentAccount}
                accountExportedAt={accountExportedAt}
              />
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Menu"
                aria-expanded={menuOpen}
                className="flex items-center justify-center w-11 h-11 rounded-lg border border-border bg-panel text-ink"
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav className="mt-2 flex flex-col gap-1 bg-panel border border-border rounded-xl p-2">
              {NAV.map((item) => {
                const active = route === item.key;
                const Icon = item.icon;
                return (
                  <a
                    key={item.key}
                    href={item.hash}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[16px] font-semibold transition
                      ${active ? 'bg-accent-soft text-ink' : 'text-ink-dim'}`}
                  >
                    <Icon size={18} /> {item.label}
                  </a>
                );
              })}

              {/* Mon compte */}
              <div className="mt-1 pt-2 border-t border-border">
                <div className="px-3 pb-1 label">
                  Mon compte
                </div>
                {ACCOUNT_SUBS.map((item) => {
                  const active = route === 'compte' && accountSub === item.sub;
                  return (
                    <a
                      key={item.sub}
                      href={item.hash}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[16px] font-semibold transition
                        ${active ? 'bg-accent-soft text-ink' : 'text-ink-dim'}`}
                    >
                      <GameIcon name={item.icon} size={20} /> {item.label}
                    </a>
                  );
                })}
              </div>

              {/* Outils */}
              <div className="mt-1 pt-2 border-t border-border">
                <div className="px-3 pb-1 label">
                  Outils
                </div>
                {OUTILS_SUBS.map((item) => {
                  const active = route === 'outils' && toolSub === item.sub;
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.sub}
                      href={item.hash}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[16px] font-semibold transition
                        ${active ? 'bg-accent-soft text-ink' : 'text-ink-dim'}`}
                    >
                      <Icon size={18} /> {item.label}
                    </a>
                  );
                })}
              </div>

              {/* Arène — entre Outils et Ressources, voir la nav desktop plus bas. */}
              <a
                href={ARENE_ITEM.hash}
                onClick={() => setMenuOpen(false)}
                className={`mt-1 pt-2 border-t border-border flex items-center gap-3 rounded-lg px-3 py-3 text-[16px] font-semibold transition
                  ${route === 'arene' ? 'bg-accent-soft text-ink' : 'text-ink-dim'}`}
              >
                <Trophy size={18} /> {ARENE_ITEM.label}
              </a>

              {/* Ressources */}
              <div className="mt-1 pt-2 border-t border-border">
                <div className="px-3 pb-1 label">
                  Ressources
                </div>
                {RESOURCES.map((item) => {
                  const active = route === item.key;
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.key}
                      href={item.hash}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[16px] font-semibold transition
                        ${active ? 'bg-accent-soft text-ink' : 'text-ink-dim'}`}
                    >
                      <Icon size={18} /> {item.label}
                    </a>
                  );
                })}
              </div>

              {/* Pas de section « Réglages » ici : le ⚙ est resté dans la barre. */}

              {/* Import unique, sous les liens de navigation */}
              <div className="mt-1 pt-2 border-t border-border">
                <AccountImportControl onImport={importAccount} variant="mobile" />
              </div>
            </nav>
          )}
        </div>

        {/* ---- Barre desktop : onglets + import ----
            Reste MONTÉE même repliée (hauteur nulle) : c'est elle qui mesure la
            largeur disponible, donc qui sait quand redéployer. */}
        <div
          ref={barRef}
          className={`hidden sm:flex items-center gap-3 flex-wrap ${compactNav ? '' : 'mb-3'}`}
        >
          {!compactNav && (
            <>
          {/* `flex-nowrap` : la nav ne doit JAMAIS passer à la ligne toute
              seule — c'est son débordement qui déclenche le hamburger. */}
          <nav
            ref={navRef}
            className="flex flex-nowrap items-center gap-1 bg-panel border border-border rounded-xl p-1"
          >
            {NAV.map((item) => {
              const active = route === item.key;
              const Icon = item.icon;
              return (
                <a
                  key={item.key}
                  href={item.hash}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition flex-none whitespace-nowrap
                    ${
                      // ⚠️ Le fond SEUL marque l'onglet courant. L'ombre qu'il
                      // portait était une fausse élévation : une ombre dit
                      // « ceci flotte au-dessus du reste », or un onglet actif
                      // est dans le plan de la barre. Voir spec/shared/design.md.
                      active
                        ? 'bg-accent-soft text-ink'
                        : 'text-ink-dim hoverable:text-ink'
                    }`}
                >
                  <Icon size={14} /> {item.label}
                </a>
              );
            })}

            {/* Mon compte (Monstres + Runes + Artéfacts) */}
            <div className="relative" ref={accountRef}>
              <button
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition flex-none whitespace-nowrap
                  ${
                    // Fond seul, sans fausse élévation — voir design.md.
                    route === 'compte'
                      ? 'bg-accent-soft text-ink'
                      : 'text-ink-dim hoverable:text-ink'
                  }`}
              >
                {/* Le bouton ouvre le compte entier, pas un inventaire : une icône
                    de profil, et les icônes du jeu restent sur les trois sous-onglets. */}
                <CircleUserRound size={16} /> Mon compte
                <ChevronDown size={12} className={`transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
              </button>
              {accountOpen && (
                <div
                  // Le menu grandit depuis SON BOUTON (coin haut gauche), pas
                  // depuis son centre : il sort de l'onglet qu'on vient de
                  // cliquer. Même règle que DetailPopover.
                  className="absolute z-30 left-0 mt-1.5 min-w-[168px] rounded-xl border border-border bg-panel p-1 shadow-glow shadow-black/60
                             origin-top-left animate-[popover_150ms_var(--ease-out)]"
                >
                  {ACCOUNT_SUBS.map((item) => {
                    const active = route === 'compte' && accountSub === item.sub;
                    return (
                      <a
                        key={item.sub}
                        href={item.hash}
                        onClick={() => setAccountOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition
                          ${active ? 'bg-panel2 text-ink' : 'text-ink-dim hoverable:text-ink hoverable:bg-panel2'}`}
                      >
                        <GameIcon name={item.icon} size={17} /> {item.label}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Outils (Optimizer) */}
            <div className="relative" ref={outilsRef}>
              <button
                onClick={() => setOutilsOpen((o) => !o)}
                aria-expanded={outilsOpen}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition flex-none whitespace-nowrap
                  ${
                    route === 'outils'
                      ? 'bg-accent-soft text-ink shadow'
                      : 'text-ink-dim hoverable:text-ink'
                  }`}
              >
                <Wrench size={14} /> Outils
                <ChevronDown size={12} className={`transition-transform ${outilsOpen ? 'rotate-180' : ''}`} />
              </button>
              {outilsOpen && (
                <div className="absolute z-30 left-0 mt-1.5 min-w-[168px] rounded-xl border border-border bg-panel p-1 shadow-glow shadow-black/60">
                  {OUTILS_SUBS.map((item) => {
                    const active = route === 'outils' && toolSub === item.sub;
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.sub}
                        href={item.hash}
                        onClick={() => setOutilsOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition
                          ${active ? 'bg-panel2 text-ink' : 'text-ink-dim hoverable:text-ink hoverable:bg-panel2'}`}
                      >
                        <Icon size={14} /> {item.label}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Arène — entre Outils et Ressources. */}
            <a
              href={ARENE_ITEM.hash}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition flex-none whitespace-nowrap
                ${route === 'arene' ? 'bg-accent-soft text-ink shadow' : 'text-ink-dim hoverable:text-ink'}`}
            >
              <Trophy size={14} /> {ARENE_ITEM.label}
            </a>

            {/* Ressources (Bestiaire + Mécaniques) */}
            <div className="relative" ref={resourcesRef}>
              <button
                onClick={() => setResourcesOpen((o) => !o)}
                aria-expanded={resourcesOpen}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition flex-none whitespace-nowrap
                  ${
                    // Fond seul, sans fausse élévation — voir design.md.
                    resourcesActive
                      ? 'bg-accent-soft text-ink'
                      : 'text-ink-dim hoverable:text-ink'
                  }`}
              >
                <Library size={14} /> Ressources
                <ChevronDown size={12} className={`transition-transform ${resourcesOpen ? 'rotate-180' : ''}`} />
              </button>
              {resourcesOpen && (
                <div
                  // Le menu grandit depuis SON BOUTON (coin haut gauche), pas
                  // depuis son centre : il sort de l'onglet qu'on vient de
                  // cliquer. Même règle que DetailPopover.
                  className="absolute z-30 left-0 mt-1.5 min-w-[168px] rounded-xl border border-border bg-panel p-1 shadow-glow shadow-black/60
                             origin-top-left animate-[popover_150ms_var(--ease-out)]"
                >
                  {RESOURCES.map((item) => {
                    const active = route === item.key;
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.key}
                        href={item.hash}
                        onClick={() => setResourcesOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition
                          ${active ? 'bg-panel2 text-ink' : 'text-ink-dim hoverable:text-ink hoverable:bg-panel2'}`}
                      >
                        <Icon size={14} /> {item.label}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
          {/* Réglages tout à droite, après l'import : c'est le geste le plus rare. */}
          <div ref={toolsRef} className="ml-auto flex items-center gap-1">
            {/* ⚠️ Masqué sur l'ACCUEIL : la zone de dépôt y est déjà au centre
                de l'écran, deux points d'entrée pour le même geste sèment le
                doute sur celui qui « compte vraiment ». */}
            {route !== 'home' && (
              <AccountImportControl onImport={importAccount} variant="desktop" />
            )}
            <SettingsMenu
              onClearData={() => setPurgeGlobale(true)}
              onKeepAccount={persistCurrentAccount}
              accountExportedAt={accountExportedAt}
            />
          </div>
            </>
          )}
        </div>

        {/* Avertissement petit écran : au-dessus du contenu, avant qu'on se soit
            fait une idée sur un affichage à l'étroit. */}
        <MobileNotice />

        {/* Message d'import global.
            ⚠️ `role="status"` : c'est le compte rendu de l'action structurante
            de l'app (« 312 monstres 6★ · 84 défenses »). Sans lui, un lecteur
            d'écran ne l'annonce jamais — il est seulement affiché.
            `aria-live` est implicite en `polite` sur `status`. */}
        <div role="status">
          {importMsg && (
            // Le retour d'import se pose en fondu court plutôt que de surgir :
            // il arrive APRÈS une action (un fichier déposé), et un texte qui
            // apparaît d'un coup sous le curseur se lit comme une erreur de
            // rendu. Voir spec/shared/design.md.
            <p
              className={`mb-3 text-[12.5px] animate-[apparition_200ms_var(--ease-out)] ${
                importMsg.ok ? 'text-good' : 'text-bad'
              }`}
            >
              {importMsg.text}
            </p>
          )}
        </div>

        {route === 'rta' ? (
          <RtaPage
            rta={rta}
            monsters={allMonsters}
            loadState={data.loadState}
            onCreateMonster={custom.addCustomMonster}
            customMonsters={custom.customMonsters}
            onDeleteMonster={custom.removeCustomMonster}
          />
        ) : route === 'bestiary' ? (
          <BestiaryPage monsters={data.monsters} loadState={data.loadState} />
        ) : route === 'siege' ? (
          <SiegePage
            tab={siegeTab}
            siege={siegeTab === 'offense' ? siegeOff : siegeDef}
            offense={siegeOff}
            recos={recos}
            builds={ownedBuilds}
            teams={ownedTeams}
            copies6={copies6}
            monsters={allMonsters}
            loadState={data.loadState}
            onCreateMonster={custom.addCustomMonster}
            customMonsters={custom.customMonsters}
            onDeleteMonster={custom.removeCustomMonster}
          />
        ) : route === 'arene' ? (
          <ComingSoon
            title="Arène"
            icon={Trophy}
            description="Préparation des équipes d'arène classique (offense et défense)."
          />
        ) : route === 'compte' ? (
          <AccountPage
            sub={accountSub}
            box={box}
            runes={runes}
            artifacts={artifacts}
            crafts={crafts}
            loadState={data.loadState}
            hydrating={accountHydrating}
            // ⚠️ Le bestiaire COMPLET, pas seulement la box : la fiche d'un
            // monstre transformable doit pouvoir montrer sa seconde forme, que
            // la box ne contient pas forcément (voir `autreForme`).
            allMonsters={allMonsters}
          />
        ) : route === 'outils' ? (
          <OutilsPage
            sub={toolSub}
            box={box}
            runes={runes}
            loadState={data.loadState}
            hydrating={accountHydrating}
            optimizer={optimizer}
            allMonsters={allMonsters}
            rtaEntries={rta.state.entries}
            siegeDefenseTeams={siegeDef.state.teams}
            siegeOffenseTeams={siegeOff.state.teams}
          />
        ) : route === 'releases' ? (
          <ReleasesPage />
        ) : route === 'mecaniques' ? (
          <MechanicsPage />
        ) : (
          <HomePage
            stats={{
              rta: Object.keys(rta.state.entries).length,
              // Une équipe « vide » (créée puis abandonnée) ne compte pas :
              // afficher 12 équipes dont 9 sans monstre serait mensonger.
              defense: siegeDef.state.teams.filter((t) => t.slots.some((s) => s.monsterId)).length,
              offense: siegeOff.state.teams.filter((t) => t.slots.some((s) => s.monsterId)).length,
              recos: recos.state.recos.length,
            }}
            onImport={importAccount}
          />
        )}

        <footer className="mt-16 text-center font-mono text-xs text-ink-dim space-y-2">
          {/* Signature : projet perso, code ouvert, et un contact direct pour les
              questions ou les demandes particulières. */}
          <p className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap">
            <a
              href="https://github.com/tototriou/sw-forge"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-accent hoverable:text-ink transition"
              title="Le code de SW Forge sur GitHub"
            >
              <Github size={13} /> github.com/tototriou
            </a>
            <a
              href="#/releases"
              className="inline-flex items-center gap-1.5 text-accent hoverable:text-ink transition"
              title="Voir les nouveautés de cette version"
            >
              <Tag size={13} /> v{__APP_VERSION__}
            </a>
            {/* Lien vers le SERVEUR plutôt qu'un pseudo : un pseudo se recopie
                à la main et ne mène nulle part au clic. */}
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-accent hoverable:text-ink transition"
              title="Rejoindre le serveur Discord de SW Forge"
            >
              <MessageCircle size={13} /> Rejoindre le Discord
            </a>
          </p>
          <p>Toutes tes données restent en local dans ton navigateur.</p>
          <p>
            Données et images © Com2uS · Source :{' '}
            <a href="https://swarfarm.com" target="_blank" rel="noreferrer" className="text-accent">
              swarfarm.com
            </a>
          </p>
        </footer>

        {importEnAttente !== null && (
          <ConfirmDialog
            titre="Remplacer les données présentes ?"
            message="Cet import va remplacer ta prépa RTA, tes équipes de siège et ta box par le contenu du fichier. Tes recommandations enregistrées ne sont pas touchées."
            libelleAction="Remplacer"
            destructif
            onCancel={() => setImportEnAttente(null)}
            onConfirm={() => {
              const texte = importEnAttente;
              setImportEnAttente(null);
              appliquerImport(texte);
            }}
          />
        )}

        {purgeGlobale && (
          <ConfirmDialog
            titre="Supprimer toutes tes données ?"
            message="Prépa RTA, équipes de siège, recommandations, monstres perso et compte importé seront effacés de cet appareil. Cette action est irréversible."
            libelleAction="Tout supprimer"
            destructif
            onCancel={() => setPurgeGlobale(false)}
            onConfirm={clearAllData}
          />
        )}

        {purgeApresRefus !== null && (
          <ConfirmDialog
            titre="Ne plus rien garder ?"
            message="Ce qui est déjà enregistré sur cet appareil sera effacé : prépa RTA, équipes de siège, recommandations et compte importé."
            libelleAction="Tout effacer"
            destructif
            onCancel={() => setPurgeApresRefus(null)}
            onConfirm={() => confirmerRefusConservation(purgeApresRefus)}
          />
        )}

        {/* La question de la conservation, modale : la réponse conditionne ce
            qui sera gardé. */}
        {askKeep && !importEnAttente && (
          <KeepAccountDialog
            onChoose={(keep, nePlusMontrer) => repondreConservation(keep, nePlusMontrer)}
            onDismiss={() => repondreConservation(null)}
          />
        )}
      </div>
  );
}
