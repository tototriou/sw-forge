import { useEffect, useMemo, useRef, useState } from 'react';
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
  Boxes,
  Disc3,
  Gem,
} from 'lucide-react';
import HomePage from './pages/HomePage';
import BestiaryPage from './pages/BestiaryPage';
import RtaPage from './pages/RtaPage';
import SiegePage, { SiegeTab } from './pages/SiegePage';
import MechanicsPage from './pages/MechanicsPage';
import AccountPage from './pages/AccountPage';
import ComingSoon from './pages/ComingSoon';
import AccountImportControl from './components/AccountImportControl';
import { ArtifactDetail, Monster, RuneDetail } from './types';
import { useMonsters } from './hooks/useMonsters';
import { useCustomMonsters } from './hooks/useCustomMonsters';
import { useRtaState } from './hooks/useRtaState';
import { useSiegeState } from './hooks/useSiegeState';
import { useSiegeRecos } from './hooks/useSiegeRecos';
import { collectOwnedBuilds, collectOwnedTeams } from './lib/ownedBuilds';
import {
  parseAccountJson,
  parseSiegeDefense,
  parseSiegeOffense,
  parseAccountBox,
  parseAccountInventory,
} from './lib/importAccount';
import { mapRtaItems, mapSiegeTeams, mapBoxMonsters, BoxItem } from './lib/applyAccount';

type Route = 'home' | 'bestiary' | 'rta' | 'siege' | 'arene' | 'mecaniques' | 'compte';
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
const ACCOUNT_SUBS: { sub: AccountSub; label: string; icon: typeof BookOpen; hash: string }[] = [
  { sub: 'monstres', label: 'Monstres', icon: Boxes, hash: '#/compte' },
  { sub: 'runes', label: 'Runes', icon: Disc3, hash: '#/compte/runes' },
  { sub: 'artefacts', label: 'Artéfacts', icon: Gem, hash: '#/compte/artefacts' },
];

// Regroupées sous « Ressources ».
const RESOURCES: NavItem[] = [
  { key: 'bestiary', label: 'Bestiaire', icon: BookOpen, hash: '#/bestiary' },
  { key: 'mecaniques', label: 'Mécaniques', icon: Calculator, hash: '#/mecaniques' },
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

  // Compte (box + inventaire runes/artéfacts) : en mémoire uniquement (ré-import à chaque session).
  const [box, setBox] = useState<BoxItem[]>([]);
  const [runes, setRunes] = useState<RuneDetail[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactDetail[]>([]);

  const [{ route, siegeTab, accountSub }, setNav] = useState(parseHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
  function importAccount(text: string) {
    const rtaRes = parseAccountJson(text);
    const defRes = parseSiegeDefense(text);
    const offRes = parseSiegeOffense(text);
    const boxRes = parseAccountBox(text);
    const invRes = parseAccountInventory(text);

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

    // Une seule confirmation pour les trois cibles si des données existent déjà.
    const hasExisting =
      Object.keys(rta.state.entries).length > 0 ||
      siegeDef.state.teams.length > 0 ||
      siegeOff.state.teams.length > 0;
    let replace = true;
    if (hasExisting) {
      replace = confirm(
        'Importer ton compte va remplir RTA, défense et offense.\n\n' +
          'OK = remplacer les données existantes\n' +
          'Annuler = fusionner / ajouter'
      );
    }

    if (rtaItems.length) {
      if (replace) rta.clearAll();
      rta.importEntries(rtaItems);
    }
    if (def.teams.length) siegeDef.importTeams(def.teams, replace);
    if (off.teams.length) siegeOff.importTeams(off.teams, replace);
    // Box + inventaire en mémoire : toujours remplacés par le dernier import.
    setBox(boxItems);
    setRunes(invRes.runes ?? []);
    setArtifacts(invRes.artifacts ?? []);

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

  // Efface toutes les données locales (prépa RTA, équipes de siège,
  // recommandations, monstres perso). Le compte importé n'est déjà qu'en
  // mémoire → le reload le vide aussi.
  function clearAllData() {
    if (
      !confirm(
        'Supprimer toutes tes données locales (prépa RTA, équipes de siège, recommandations, monstres perso) ?\n\nCette action est irréversible.'
      )
    )
      return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sw-forge') || k.startsWith('sky-arena'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* stockage indisponible : on ignore */
    }
    location.reload();
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

  // Message d'import éphémère : il disparaît tout seul (un peu plus long pour une erreur).
  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), importMsg.ok ? 5000 : 9000);
    return () => clearTimeout(t);
  }, [importMsg]);

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-5 py-5 sm:py-6 pb-16">
        {/* ---- Barre mobile : logo + menu hamburger ---- */}
        <div className="sm:hidden mb-4">
          <div className="flex items-center justify-between">
            <a href="#/" className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="w-7 h-7" />
              <span className="font-display text-[18px] tracking-wide">SW Forge</span>
            </a>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="flex items-center justify-center w-11 h-11 rounded-lg border border-border bg-panel text-ink"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
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
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.sub}
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

              {/* Import unique, sous les liens de navigation */}
              <div className="mt-1 pt-2 border-t border-border">
                <AccountImportControl
                  onImport={importAccount}
                  onClearData={clearAllData}
                  variant="mobile"
                />
              </div>
            </nav>
          )}
        </div>

        {/* ---- Barre desktop : onglets + import ---- */}
        <div className="hidden sm:flex items-center gap-3 flex-wrap mb-3">
          <nav className="flex flex-wrap items-center gap-1 bg-panel border border-border rounded-xl p-1 max-w-full">
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
                <Boxes size={14} /> Mon compte
                <ChevronDown size={12} className={`transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
              </button>
              {accountOpen && (
                <div className="absolute z-30 left-0 mt-1.5 min-w-[168px] rounded-xl border border-border bg-panel p-1 shadow-glow shadow-black/60">
                  {ACCOUNT_SUBS.map((item) => {
                    const active = route === 'compte' && accountSub === item.sub;
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.sub}
                        href={item.hash}
                        onClick={() => setAccountOpen(false)}
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
          <div className="ml-auto">
            <AccountImportControl
              onImport={importAccount}
              onClearData={clearAllData}
              variant="desktop"
            />
          </div>
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
          />
        ) : route === 'mecaniques' ? (
          <MechanicsPage />
        ) : (
          <HomePage />
        )}

        <footer className="mt-16 text-center font-mono text-xs text-ink-dim space-y-2">
          <p>Toutes tes données restent en local dans ton navigateur.</p>
          <p>
            Données et images © Com2uS · Source :{' '}
            <a href="https://swarfarm.com" target="_blank" rel="noreferrer" className="text-[#8b92e0]">
              swarfarm.com
            </a>
          </p>
        </footer>
      </div>
  );
}
