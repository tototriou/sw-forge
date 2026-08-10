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
} from 'lucide-react';
import HomePage from './pages/HomePage';
import BestiaryPage from './pages/BestiaryPage';
import RtaPage from './pages/RtaPage';
import SiegePage, { SiegeTab } from './pages/SiegePage';
import MechanicsPage from './pages/MechanicsPage';
import ReleasesPage from './pages/ReleasesPage';
import AccountPage from './pages/AccountPage';
import ComingSoon from './pages/ComingSoon';
import AccountImportControl from './components/AccountImportControl';
import SettingsMenu from './components/SettingsMenu';
import { loadAccount, saveAccount } from './lib/accountStore';
import {
  persistenceChoisie,
  persistenceEnabled,
  purgeDonneesConservees,
  setPersistence,
  storageAvailable,
} from './hooks/usePersistence';
import { ImportSpinner, KeepAccountDialog } from './components/ImportOverlay';
import GameIcon, { GameIconKey } from './components/GameIcon';
import { ArtifactDetail, Monster, RuneDetail } from './types';
import { useMonsters } from './hooks/useMonsters';
import { useCustomMonsters } from './hooks/useCustomMonsters';
import { useRtaState } from './hooks/useRtaState';
import { useSiegeState } from './hooks/useSiegeState';
import { useSiegeRecos } from './hooks/useSiegeRecos';
import { collectOwnedBuilds, collectOwnedTeams } from './lib/ownedBuilds';
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

// Deux frames : la première monte le spinner, la seconde garantit qu'il est
// PEINT avant qu'on bloque le thread. Une seule ne suffit pas — React peut
// encore n'avoir que commité le DOM.
function deuxFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

type Route = 'home' | 'bestiary' | 'rta' | 'siege' | 'arene' | 'mecaniques' | 'compte' | 'releases';
export type AccountSub = 'monstres' | 'runes' | 'artefacts';

// Route + sous-route de siège (offense/défense) + sous-section « Mon compte »
// déduites du hash.
function parseHash(): { route: Route; siegeTab: SiegeTab; accountSub: AccountSub } {
  const h = window.location.hash.replace(/^#\/?/, '');
  const base = { siegeTab: 'defense' as SiegeTab, accountSub: 'monstres' as AccountSub };
  if (h === 'rta') return { route: 'rta', ...base };
  if (h === 'bestiary') return { route: 'bestiary', ...base };
  if (h === 'arene') return { route: 'arene', ...base };
  if (h === 'compte' || h.startsWith('compte/')) {
    const accountSub: AccountSub =
      h === 'compte/runes' ? 'runes' : h === 'compte/artefacts' ? 'artefacts' : 'monstres';
    return { route: 'compte', siegeTab: 'defense', accountSub };
  }
  if (h === 'mecaniques') return { route: 'mecaniques', ...base };
  if (h === 'releases') return { route: 'releases', ...base };
  if (h === 'siege' || h.startsWith('siege/')) {
    const siegeTab: SiegeTab =
      h === 'siege/offense' ? 'offense' : h === 'siege/recommandations' ? 'recos' : 'defense';
    return { route: 'siege', siegeTab, accountSub: 'monstres' };
  }
  return { route: 'home', ...base };
}

type NavItem = { key: Route; label: string; icon: typeof BookOpen; hash: string };

// Onglets principaux (outils).
const NAV: NavItem[] = [
  { key: 'home', label: 'Accueil', icon: Home, hash: '#/' },
  { key: 'rta', label: 'RTA', icon: Swords, hash: '#/rta' },
  { key: 'siege', label: 'Siège', icon: Castle, hash: '#/siege/defense' },
  { key: 'arene', label: 'Arène', icon: Trophy, hash: '#/arene' },
];

// Sous-sections de « Mon compte » (dropdown de nav).
// ⚠️ Icônes DU JEU (voir GameIcon), pas des pictogrammes de bibliothèque : un
// joueur reconnaît ses trois inventaires instantanément à celles-ci.
const ACCOUNT_SUBS: { sub: AccountSub; label: string; icon: GameIconKey; hash: string }[] = [
  { sub: 'monstres', label: 'Monstres', icon: 'monster', hash: '#/compte' },
  { sub: 'runes', label: 'Runes', icon: 'rune', hash: '#/compte/runes' },
  { sub: 'artefacts', label: 'Artéfacts', icon: 'artifact', hash: '#/compte/artefacts' },
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

  // Compte (box + inventaire runes/artéfacts). En mémoire, et **conservé sur
  // l'appareil** si l'utilisateur l'a demandé dans le menu ⚙ (voir
  // spec/shared/import-compte.md).
  const [box, setBox] = useState<BoxItem[]>([]);
  const [runes, setRunes] = useState<RuneDetail[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactDetail[]>([]);

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

  const [{ route, siegeTab, accountSub }, setNav] = useState(parseHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [askKeep, setAskKeep] = useState(false);

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
  const { ownedBuilds, ownedTeams } = useMemo(() => {
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
    };
  }, [box, rta.state.entries, siegeDef.state.teams, siegeOff.state.teams, allMonsters]);

  // Import GLOBAL : un seul fichier alimente RTA + siège défense + siège offense.
  //
  // ⚠️ **Asynchrone uniquement pour laisser le spinner s'afficher.** Le parse et
  // le mapping d'un export de 8 Mo bloquent le thread principal : sans une
  // respiration avant, React n'a jamais l'occasion de peindre l'attente et l'app
  // paraît figée — on reclique, et tout repart.
  async function importAccount(text: string) {
    // ⚠️ La confirmation vient AVANT le spinner : une boîte native par-dessus un
    // écran d'attente donne l'impression que le traitement a planté.
    //
    // ⚠️ « Annuler » ANNULE L'IMPORT — il ne doit surtout pas déclencher une
    // fusion : c'était le cas, et fusionner des équipes de siège les DÉDOUBLAIT
    // (un compte à 50 attaques repartait à 100). Un import de compte est un
    // rafraîchissement de l'état du jeu, jamais un ajout.
    const aDejaDesDonnees =
      Object.keys(rta.state.entries).length > 0 ||
      siegeDef.state.teams.length > 0 ||
      siegeOff.state.teams.length > 0;
    if (
      aDejaDesDonnees &&
      !confirm("L'import va remplacer toutes les données présentes.\n\nEs-tu sûr ?")
    )
      return;

    setImporting(true);
    await deuxFrames();
    try {
      await appliquerImport(text);
    } finally {
      setImporting(false);
    }
    // La question de la conservation se pose ICI, une fois les données à l'écran
    // — pas dans un menu que personne n'ouvre (voir useKeepAccount).
    if (!persistenceChoisie() && storageAvailable()) setAskKeep(true);
  }

  async function appliquerImport(text: string) {
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

    // Enregistrement **après** la mise à jour de l'affichage et sans attendre :
    // une écriture de 2 Mo ne doit pas retarder l'apparition du compte. Un échec
    // (stockage plein, refusé) laisse l'import parfaitement utilisable pour la
    // session — on ne casse pas l'usage courant pour un problème de confort.
    if (persistenceEnabled()) {
      void saveAccount({
        box: rawBoxRef.current,
        runes: invRes.runes ?? [],
        artifacts: invRes.artifacts ?? [],
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
  }

  // Réponse à la fenêtre de choix. `null` = fermée sans répondre : on
  // n'enregistre rien et on redemandera, plutôt que d'interpréter un silence.
  function repondreConservation(keep: boolean | null) {
    setAskKeep(false);
    if (keep === null) return;
    setPersistence(keep, persistCurrentAccount);
  }

  // Efface toutes les données locales (prépa RTA, équipes de siège,
  // recommandations, monstres perso) **et le compte conservé**.
  //
  // ⚠️ L'effacement du compte est asynchrone et doit finir AVANT le rechargement.
  // Sans l'attente, la page repart pendant la transaction et le compte pourrait
  // survivre à une action annoncée comme irréversible.
  async function clearAllData() {
    if (
      !confirm(
        'Supprimer toutes tes données locales (prépa RTA, équipes de siège, recommandations, monstres perso) ?\n\nLe compte conservé sur cet appareil est effacé lui aussi.\n\nCette action est irréversible.'
      )
    )
      return;
    await purgeDonneesConservees();
    location.reload();
  }

  // Activation du réglage « Garder mon compte » : on enregistre ce qui est déjà
  // en mémoire, sinon il faudrait réimporter le même fichier pour rien.
  function persistCurrentAccount() {
    if (rawBoxRef.current.length === 0 && runes.length === 0 && artifacts.length === 0) return;
    void saveAccount({ box: rawBoxRef.current, runes, artifacts, exportedAt: accountExportedAt });
  }

  useEffect(() => {
    const onHash = () => {
      setNav(parseHash());
      setMenuOpen(false); // referme le menu mobile à chaque navigation
      setResourcesOpen(false); // referme le dropdown Ressources
      setAccountOpen(false); // referme le dropdown Mon compte
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Ferme les dropdowns (Ressources / Mon compte) au clic à l'extérieur.
  useEffect(() => {
    if (!resourcesOpen && !accountOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (resourcesRef.current && !resourcesRef.current.contains(t)) setResourcesOpen(false);
      if (accountRef.current && !accountRef.current.contains(t)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [resourcesOpen, accountOpen]);

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
                onClearData={clearAllData}
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
                      ${active ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink' : 'text-ink-dim'}`}
                  >
                    <Icon size={18} /> {item.label}
                  </a>
                );
              })}

              {/* Mon compte */}
              <div className="mt-1 pt-2 border-t border-border">
                <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
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
                        ${active ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink' : 'text-ink-dim'}`}
                    >
                      <GameIcon name={item.icon} size={20} /> {item.label}
                    </a>
                  );
                })}
              </div>

              {/* Ressources */}
              <div className="mt-1 pt-2 border-t border-border">
                <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
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
                        ${active ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink' : 'text-ink-dim'}`}
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
                      active
                        ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink shadow'
                        : 'text-ink-dim hover:text-ink'
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
                    route === 'compte'
                      ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink shadow'
                      : 'text-ink-dim hover:text-ink'
                  }`}
              >
                {/* Le bouton ouvre le compte entier, pas un inventaire : une icône
                    de profil, et les icônes du jeu restent sur les trois sous-onglets. */}
                <CircleUserRound size={16} /> Mon compte
                <ChevronDown size={12} className={`transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
              </button>
              {accountOpen && (
                <div className="absolute z-30 left-0 mt-1.5 min-w-[168px] rounded-xl border border-border bg-panel p-1 shadow-glow shadow-black/60">
                  {ACCOUNT_SUBS.map((item) => {
                    const active = route === 'compte' && accountSub === item.sub;
                    return (
                      <a
                        key={item.sub}
                        href={item.hash}
                        onClick={() => setAccountOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition
                          ${active ? 'bg-panel2 text-ink' : 'text-ink-dim hover:text-ink hover:bg-panel2'}`}
                      >
                        <GameIcon name={item.icon} size={17} /> {item.label}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ressources (Bestiaire + Mécaniques) */}
            <div className="relative" ref={resourcesRef}>
              <button
                onClick={() => setResourcesOpen((o) => !o)}
                aria-expanded={resourcesOpen}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition flex-none whitespace-nowrap
                  ${
                    resourcesActive
                      ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink shadow'
                      : 'text-ink-dim hover:text-ink'
                  }`}
              >
                <Library size={14} /> Ressources
                <ChevronDown size={12} className={`transition-transform ${resourcesOpen ? 'rotate-180' : ''}`} />
              </button>
              {resourcesOpen && (
                <div className="absolute z-30 left-0 mt-1.5 min-w-[168px] rounded-xl border border-border bg-panel p-1 shadow-glow shadow-black/60">
                  {RESOURCES.map((item) => {
                    const active = route === item.key;
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.key}
                        href={item.hash}
                        onClick={() => setResourcesOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition
                          ${active ? 'bg-panel2 text-ink' : 'text-ink-dim hover:text-ink hover:bg-panel2'}`}
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
              onClearData={clearAllData}
              onKeepAccount={persistCurrentAccount}
              accountExportedAt={accountExportedAt}
            />
          </div>
            </>
          )}
        </div>

        {/* Message d'import global */}
        {importMsg && (
          <p className={`mb-3 text-[12.5px] ${importMsg.ok ? 'text-wind' : 'text-fire'}`}>
            {importMsg.text}
          </p>
        )}

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
            loadState={data.loadState}
            hydrating={accountHydrating}
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
              className="inline-flex items-center gap-1.5 text-[#8b92e0] hover:text-ink transition"
              title="Le code de SW Forge sur GitHub"
            >
              <Github size={13} /> github.com/tototriou
            </a>
            <a
              href="#/releases"
              className="inline-flex items-center gap-1.5 text-[#8b92e0] hover:text-ink transition"
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
              className="inline-flex items-center gap-1.5 text-[#8b92e0] hover:text-ink transition"
              title="Rejoindre le serveur Discord de SW Forge"
            >
              <MessageCircle size={13} /> Rejoindre le Discord
            </a>
          </p>
          <p>Toutes tes données restent en local dans ton navigateur.</p>
          <p>
            Données et images © Com2uS · Source :{' '}
            <a href="https://swarfarm.com" target="_blank" rel="noreferrer" className="text-[#8b92e0]">
              swarfarm.com
            </a>
          </p>
        </footer>

        {/* Attente pendant le traitement, puis la question de la conservation.
            Les deux sont modales : l'une parce que rien d'autre n'est possible,
            l'autre parce que la réponse conditionne ce qui sera gardé. */}
        {importing && <ImportSpinner />}
        {askKeep && !importing && (
          <KeepAccountDialog
            onChoose={(keep) => repondreConservation(keep)}
            onDismiss={() => repondreConservation(null)}
          />
        )}
      </div>
  );
}
