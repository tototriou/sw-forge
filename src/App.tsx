import { useEffect, useMemo, useState } from 'react';
import { Swords, BookOpen, Home, Castle, Trophy, Menu, X } from 'lucide-react';
import HomePage from './pages/HomePage';
import BestiaryPage from './pages/BestiaryPage';
import RtaPage from './pages/RtaPage';
import SiegePage from './pages/SiegePage';
import ComingSoon from './pages/ComingSoon';
import AccountImportControl from './components/AccountImportControl';
import { Monster } from './types';
import { useMonsters } from './hooks/useMonsters';
import { useCustomMonsters } from './hooks/useCustomMonsters';
import { useRtaState } from './hooks/useRtaState';
import { useSiegeState, SiegeSide } from './hooks/useSiegeState';
import { parseAccountJson, parseSiegeDefense, parseSiegeOffense } from './lib/importAccount';
import { mapRtaItems, mapSiegeTeams } from './lib/applyAccount';

type Route = 'home' | 'bestiary' | 'rta' | 'siege' | 'arene';

// Route + sous-route de siège (offense/défense) déduites du hash.
function parseHash(): { route: Route; siegeSide: SiegeSide } {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === 'rta') return { route: 'rta', siegeSide: 'defense' };
  if (h === 'bestiary') return { route: 'bestiary', siegeSide: 'defense' };
  if (h === 'arene') return { route: 'arene', siegeSide: 'defense' };
  if (h === 'siege' || h.startsWith('siege/')) {
    return { route: 'siege', siegeSide: h === 'siege/offense' ? 'offense' : 'defense' };
  }
  return { route: 'home', siegeSide: 'defense' };
}

const NAV: { key: Route; label: string; icon: typeof BookOpen; hash: string }[] = [
  { key: 'home', label: 'Accueil', icon: Home, hash: '#/' },
  { key: 'rta', label: 'RTA', icon: Swords, hash: '#/rta' },
  { key: 'siege', label: 'Siège', icon: Castle, hash: '#/siege/defense' },
  { key: 'arene', label: 'Arène', icon: Trophy, hash: '#/arene' },
  { key: 'bestiary', label: 'Bestiaire', icon: BookOpen, hash: '#/bestiary' },
];

export default function App() {
  const data = useMonsters();
  const custom = useCustomMonsters();

  // États remontés ici pour qu'un import unique alimente toutes les pages à la
  // fois (page courante affichée + les autres en arrière-plan).
  const rta = useRtaState();
  const siegeDef = useSiegeState('defense');
  const siegeOff = useSiegeState('offense');

  const [{ route, siegeSide }, setNav] = useState(parseHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  // Import GLOBAL : un seul fichier alimente RTA + siège défense + siège offense.
  function importAccount(text: string) {
    const rtaRes = parseAccountJson(text);
    const defRes = parseSiegeDefense(text);
    const offRes = parseSiegeOffense(text);

    const rtaItems = rtaRes.units ? mapRtaItems(rtaRes.units, monsterByCom2us) : [];
    const def = mapSiegeTeams(defRes.decks ?? [], monsterByCom2us);
    const off = mapSiegeTeams(offRes.decks ?? [], monsterByCom2us);

    if (rtaItems.length === 0 && def.teams.length === 0 && off.teams.length === 0) {
      setImportMsg({
        ok: false,
        text: rtaRes.error || defRes.error || offRes.error || 'Rien à importer depuis ce fichier.',
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

    const parts: string[] = [];
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

  // Efface toutes les données locales (prépa RTA, équipes de siège, monstres
  // perso). Le compte importé n'est déjà qu'en mémoire → le reload le vide aussi.
  function clearAllData() {
    if (
      !confirm(
        'Supprimer toutes tes données locales (prépa RTA, équipes de siège, monstres perso) ?\n\nCette action est irréversible.'
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
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
            side={siegeSide}
            siege={siegeSide === 'offense' ? siegeOff : siegeDef}
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
