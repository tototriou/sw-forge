import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  Swords,
  BookOpen,
  Home,
  Castle,
  Trophy,
  Calculator,
  CircleUserRound,
  Github,
  MessageCircle,
  Tag,
  Sparkles,
  Shield,
  Lightbulb,
  Settings,
  Timer,
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
import SettingsPage from './pages/SettingsPage';
import AccountImportControl from './components/AccountImportControl';
import SettingsMenu from './components/SettingsMenu';
import Sidebar, {
  LARGEUR_SIDEBAR,
  LARGEUR_SIDEBAR_RETRACTEE,
  SidebarGroupe,
  SidebarSection,
  useSidebarRetractee,
} from './components/Sidebar';
import MobileTabs, { OngletMobile } from './components/MobileTabs';
import MobileNavSheet from './components/MobileNavSheet';
import TopBar from './components/TopBar';
import SidebarCompte from './components/SidebarCompte';
import SidebarSearch, { CibleNav } from './components/SidebarSearch';
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
import { ConfirmDialog, KeepAccountDialog } from './ui/Dialogs';
import InventaireIcon, { InventaireIconKey } from './components/InventaireIcon';
import {
  COULEUR_SECTION,
  COULEUR_SIEGE_SUB,
  COULEUR_COMPTE_SUB,
} from './data/couleursSection';
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
  parseAccountWizardName,
  parseAccountSource,
  parseSiegeDefense,
  parseSiegeOffense,
  parseAccountBox,
  parseAccountInventory,
  parseWizardId,
} from './lib/importAccount';
import { mapRtaItems, mapSiegeTeams, mapBoxMonsters, BoxItem } from './lib/applyAccount';
import { VUES_INVENTAIRE, hashVue, vueValide } from './lib/accountViews';

const DISCORD_INVITE = 'https://discord.gg/R2Fe4GJZET';

// Pages dont les actions et les filtres passent dans le panneau mobile
// (`MobileSheet`), ouvert par le bouton « Options » au-dessus de la barre
// d'onglets.
// ⚠️ **L'OPTIMISEUR y est revenu** — Réglages avancés et Exclusion de runes
// SEULS (voir OptimizerSection.tsx), pas l'écran entier : Monstre &
// équipement, Critères de recherche et Résultats restent dans la page, qui
// n'est donc jamais vide au-dessus du bouton. Réglages avancés/Exclusion de
// runes, eux, sont des réglages secondaires consultés une fois puis oubliés
// — exactement le profil qui gagne à sortir du défilement principal.
// ⚠️ Même chose pour Accueil, Mécaniques, Nouveautés et Paramètres : aucune
// action à y loger. Leur ouvrir un panneau vide serait pire que ne rien
// proposer — c'est la règle qui décide de l'appartenance à cette liste.
const PAGES_AVEC_MENU = new Set<Route>(['rta', 'siege', 'bestiary', 'compte', 'outils']);

type Route =
  | 'home'
  | 'bestiary'
  | 'rta'
  | 'siege'
  | 'arene'
  | 'mecaniques'
  | 'compte'
  | 'outils'
  | 'releases'
  | 'parametres';
export type AccountSub = 'monstres' | 'runes' | 'artefacts';

// Vue à l'intérieur d'un inventaire — troisième niveau de navigation.
//
// ⚠️ **Dans l'URL, pas dans un état local.** Elles y vivaient
// (`useStickyState('runes.view')`), ce qui les rendait impossibles à mettre dans
// la barre latérale : rien n'aurait dit laquelle est active, et un lien direct
// vers « Courbes » n'existait pas. Le hash devient `#/compte/runes/courbes`.
export type AccountView =
  | 'resume'
  | 'liste'
  | 'courbes'
  | 'comparaison'
  | 'optimisation'
  | 'meules'
  | 'gemmes';
export type ToolSub = 'optimizer' | 'speed-tuning';

// Route + sous-route de siège (offense/défense) + sous-section « Mon compte »
// + sous-section « Outils » déduites du hash.
function parseHash(): {
  route: Route;
  siegeTab: SiegeTab;
  accountSub: AccountSub;
  accountView: AccountView;
  toolSub: ToolSub;
} {
  const h = window.location.hash.replace(/^#\/?/, '');
  const base = {
    siegeTab: 'defense' as SiegeTab,
    accountSub: 'monstres' as AccountSub,
    accountView: 'resume' as AccountView,
    toolSub: 'optimizer' as ToolSub,
  };
  if (h === 'rta') return { route: 'rta', ...base };
  if (h === 'bestiary') return { route: 'bestiary', ...base };
  if (h === 'arene') return { route: 'arene', ...base };
  if (h === 'compte' || h.startsWith('compte/')) {
    // `compte/runes/courbes` → sous-section « runes », vue « courbes ».
    const [, sub, vue] = h.split('/');
    const accountSub: AccountSub =
      sub === 'runes' ? 'runes' : sub === 'artefacts' ? 'artefacts' : 'monstres';
    return {
      route: 'compte',
      siegeTab: 'defense',
      accountSub,
      // ⚠️ Défaut « resume » : on arrive sur l'état du stock, pas sur 2 000
      // tuiles. C'était déjà le défaut des onglets internes.
      accountView: (vue as AccountView) || 'resume',
      toolSub: 'optimizer',
    };
  }
  if (h === 'outils' || h.startsWith('outils/')) {
    const [, sub] = h.split('/');
    const toolSub: ToolSub = sub === 'speed-tuning' ? 'speed-tuning' : 'optimizer';
    return { route: 'outils', ...base, toolSub };
  }
  if (h === 'mecaniques') return { route: 'mecaniques', ...base };
  if (h === 'releases') return { route: 'releases', ...base };
  if (h === 'parametres') return { route: 'parametres', ...base };
  if (h === 'siege' || h.startsWith('siege/')) {
    const siegeTab: SiegeTab =
      h === 'siege/offense' ? 'offense' : h === 'siege/recommandations' ? 'recos' : 'defense';
    return { route: 'siege', ...base, siegeTab };
  }
  return { route: 'home', ...base };
}

// ⚠️ `couleur` : la teinte de SIGNATURE de la section (data/couleursSection),
// posée sur l'ICÔNE partout où la nav l'affiche — barre latérale, onglets du
// bas, panneau mobile, barre supérieure, recherche. La MÊME couleur que la
// carte de l'accueil ; elle voyage avec l'item plutôt que d'être ressaisie à
// chaque point de rendu. Elle ne marque PAS l'état (l'actif reste le contour
// d'accent, spec/shared/design.md « un seul marqueur ») : elle est constante,
// actif ou non.
type NavItem = { key: Route; label: string; icon: typeof BookOpen; hash: string; couleur: string };

// Onglets principaux (outils). Arène est à part (voir ARENE_ITEM) : elle se
// positionne entre les dropdowns Outils et Ressources, pas dans ce groupe.
const NAV: NavItem[] = [
  { key: 'home', label: 'Accueil', icon: Home, hash: '#/', couleur: COULEUR_SECTION.home },
  { key: 'rta', label: 'RTA', icon: Swords, hash: '#/rta', couleur: COULEUR_SECTION.rta },
  { key: 'siege', label: 'Siège', icon: Castle, hash: '#/siege/defense', couleur: COULEUR_SECTION.siege },
];

const ARENE_ITEM: NavItem = { key: 'arene', label: 'Arène', icon: Trophy, hash: '#/arene', couleur: COULEUR_SECTION.arene };

// Sous-sections de « Mon compte » (dropdown de nav).
// ⚠️ Icônes AU TRAIT dans le style de la librairie (voir InventaireIcon) : les
// silhouettes du jeu (tête de monstre, rune, médaillon) redessinées au contour
// monochrome, pour ne pas jurer à côté des icônes lucide de la nav.
// ⚠️ Plus de `hash` ici : les liens passent par `hashVue`, qui compose
// `#/compte/<inventaire>/<vue>`. Deux façons d'écrire la même URL auraient
// divergé — l'une menant à la vue par défaut, l'autre à la vue courante.
const ACCOUNT_SUBS: { sub: AccountSub; label: string; icon: InventaireIconKey; couleur: string }[] = [
  { sub: 'monstres', label: 'Monstres', icon: 'monster', couleur: COULEUR_COMPTE_SUB.monstres },
  { sub: 'runes', label: 'Runes', icon: 'rune', couleur: COULEUR_COMPTE_SUB.runes },
  { sub: 'artefacts', label: 'Artéfacts', icon: 'artifact', couleur: COULEUR_COMPTE_SUB.artefacts },
];

// Sous-sections d'« Outils » (dropdown de nav) — un seul outil pour l'instant,
// structuré pour en accueillir d'autres sans retoucher la nav.
const OUTILS_SUBS: { sub: ToolSub; label: string; icon: typeof Sparkles; hash: string; couleur: string }[] = [
  { sub: 'optimizer', label: 'Optimizer', icon: Sparkles, hash: '#/outils/optimizer', couleur: COULEUR_SECTION.outils },
  { sub: 'speed-tuning', label: 'Speed tuning', icon: Timer, hash: '#/outils/speed-tuning', couleur: COULEUR_SECTION.outils },
];

// Sous-sections de « Siège ». ⚠️ Remontées ICI depuis SiegePage : elles
// étaient des onglets posés en haut de la page, et chaque section avait le sien
// avec son propre rendu. La barre latérale les porte toutes de la même façon.
const SIEGE_SUBS: { tab: SiegeTab; label: string; icon: typeof Shield; hash: string; couleur: string }[] = [
  { tab: 'defense', label: 'Défense', icon: Shield, hash: '#/siege/defense', couleur: COULEUR_SIEGE_SUB.defense },
  { tab: 'offense', label: 'Offense', icon: Swords, hash: '#/siege/offense', couleur: COULEUR_SIEGE_SUB.offense },
  { tab: 'recos', label: 'Recommandations', icon: Lightbulb, hash: '#/siege/recommandations', couleur: COULEUR_SIEGE_SUB.recos },
];

// Regroupées sous « Ressources ».
const RESOURCES: NavItem[] = [
  { key: 'bestiary', label: 'Bestiaire', icon: BookOpen, hash: '#/bestiary', couleur: COULEUR_SECTION.bestiary },
  { key: 'mecaniques', label: 'Mécaniques', icon: Calculator, hash: '#/mecaniques', couleur: COULEUR_SECTION.mecaniques },
  { key: 'releases', label: 'Nouveautés', icon: Tag, hash: '#/releases', couleur: COULEUR_SECTION.releases },
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

  // Identité du DERNIER compte importé cette session (`wizard_id`, voir
  // parseWizardId) — comparée dans `appliquerImport` pour réinitialiser
  // l'exclusion manuelle de runes de l'Optimizer UNIQUEMENT sur un compte
  // réellement différent, jamais sur un simple réexport (même wizard_id,
  // seule la date d'export change). `null` : rien d'importé pour l'instant
  // cette session (ne couvre pas un compte hydraté depuis le stockage local
  // d'une session précédente — non persisté, cf. `appliquerImport`).
  const wizardIdRef = useRef<number | null>(null);

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

  // Nom du joueur dont le compte est chargé (`wizard_info.wizard_name`).
  // ⚠️ On peut jongler entre plusieurs exports — le sien, celui d'un ami dont
  // on compare les runes — et rien ne disait lequel était affiché.
  const [accountName, setAccountName] = useState<string | null>(null);

  const [{ route, siegeTab, accountSub, accountView, toolSub }, setNav] = useState(parseHash);

  // Écran d'où l'on vient, pour que le bouton ⚙ RAMÈNE là où on était.
  //
  // ⚠️ Un lien seul ne permettait pas de sortir des paramètres : on y entrait
  // sans pouvoir en revenir autrement qu'en choisissant une autre destination.
  // Le bouton bascule donc — il ouvre, puis il referme.
  //
  // ⚠️ Une `ref` et non un état : sa mise à jour ne doit RIEN redessiner, et
  // elle se fait dans l'effet de navigation lui-même.
  const avantParametres = useRef<string>('#/');
  // Hash courant, tenu à jour par l'effet de navigation : c'est LUI qu'on
  // mémorise en entrant dans les paramètres, pas `window.location.hash`, qui
  // porte déjà la destination au moment où l'événement arrive.
  const hashCourant = useRef<string>(window.location.hash || '#/');
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askKeep, setAskKeep] = useState(false);
  // Fichier déposé, en attente de confirmation de remplacement.
  const [importEnAttente, setImportEnAttente] = useState<string | null>(null);
  // Confirmations à l'écran : purge globale (⚙), et refus de conservation alors
  // qu'on conservait déjà (la valeur portée est « ne plus me montrer »).
  const [purgeGlobale, setPurgeGlobale] = useState(false);

  // Panneau d'actions de la page, sous `lg`. ⚠️ L'état vit ICI parce que le
  // bouton (barre d'onglets) et le contenu (la page) sont deux sous-arbres
  // distincts : seul leur ancêtre commun peut les relier.
  const [menuPageOuvert, setMenuPageOuvert] = useState(false);

  // Navigation de second niveau sur téléphone : le TITRE de la section dont on
  // choisit la sous-section, `null` si le panneau est fermé (voir
  // MobileNavSheet). ⚠️ Même raison que ci-dessus : le déclencheur est dans la
  // barre d'onglets, le contenu vient des sections — seul leur ancêtre commun
  // peut les relier.
  const [navMobileOuverte, setNavMobileOuverte] = useState<string | null>(null);

  // ⚠️ La page ne suffit pas à décider si le bouton « Options » s'affiche : sur
  // « Mon compte », seules les vues qui étalent une GRILLE de tuiles y gagnent —
  // la Liste et l'Optimisation. Le résumé et la comparaison n'ont pas de quoi
  // remplir la place, et les courbes se réduiraient à un graphe et deux réglages.
  // ⚠️ Les COURBES en sont exclues, alors qu'elles ont des filtres. Descendus
  // dans le tiroir, ils laissaient un écran qui ne porte plus qu'un graphe et
  // deux réglages : la page paraît vide, et le bouton flottant annonce un
  // contenu qu'on ne devine pas. La Liste et l'Optimisation, elles, ont des
  // milliers de tuiles à montrer — chaque rangée de filtre leur prend un écran de
  // résultats. **Avoir des filtres ne suffit donc pas : il faut aussi que la page
  // ait de quoi remplir la place qu'ils libèrent.**
  const pageAPanneau =
    PAGES_AVEC_MENU.has(route) &&
    (route !== 'compte' ||
      accountSub === 'monstres' ||
      accountView === 'liste' ||
      accountView === 'optimisation') &&
    // ⚠️ Un seul outil aujourd'hui (Optimizer), mais la vérification
    // reste écrite : un futur outil sans réglages avancés n'hériterait pas
    // du bouton par accident (même raison que la garde ci-dessus sur
    // « Mon compte »).
    (route !== 'outils' || toolSub === 'optimizer');

  // Le panneau se referme à chaque changement d'écran : ses actions portent sur
  // celui qu'on vient de quitter. ⚠️ `accountSub`/`accountView`/`siegeTab`/
  // `toolSub` en font partie — ce sont des écrans à part entière, avec chacun
  // ses filtres, et rester ouvert sur ceux du précédent afficherait des
  // contrôles sans rapport.
  useEffect(
    () => setMenuPageOuvert(false),
    [route, accountSub, accountView, siegeTab, toolSub]
  );

  // ⚠️ Le panneau de NAVIGATION se referme aux mêmes changements. Il se ferme
  // déjà au clic sur une destination (voir MobileNavSheet), mais pas quand la
  // page change autrement — retour arrière du navigateur, lien depuis l'accueil,
  // recherche de navigation. Il serait alors resté ouvert par-dessus l'écran
  // qu'on vient d'atteindre.
  useEffect(
    () => setNavMobileOuverte(null),
    [route, accountSub, accountView, siegeTab]
  );

  // Repli de la barre latérale. Vit ici et non dans `Sidebar` : le CONTENU doit
  // décaler sa marge en même temps, sinon la barre se replie sur une colonne de
  // vide.
  const [sidebarRetractee, setSidebarRetractee] = useSidebarRetractee();
  const [purgeApresRefus, setPurgeApresRefus] = useState<boolean | null>(null);


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
        setAccountName(rec.wizardName ?? null);
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
    const nomJoueur = parseAccountWizardName(data);
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

    // Exclusion manuelle de runes de l'Optimizer (excludedSelectors) : à
    // effacer sur un compte VRAIMENT DIFFÉRENT (autre wizard_id — voir
    // parseWizardId), pas sur une simple nouvelle version RÉEXPORTÉE du même
    // compte (même wizard_id, seul `tvalue` change) — un réexport garde les
    // mêmes ids de monstre/rune, la sélection reste valide. `null` (import
    // précédent illisible, ou tout premier import de la session) : aucune
    // identité connue à comparer, on ne réinitialise pas — cohérent avec
    // resetSearch() côté box (voir plus bas), qui lui se déclenche sur
    // CHAQUE import sans cette distinction (les critères/résultats affichés
    // deviennent obsolètes même pour un simple réexport, contrairement à
    // l'exclusion qui référence des ids stables).
    const wizardId = parseWizardId(data);
    if (wizardIdRef.current !== null && wizardId !== null && wizardIdRef.current !== wizardId) {
      optimizer.setExcludedSelectors([]);
    }
    wizardIdRef.current = wizardId;

    // Box + inventaire : toujours remplacés par le dernier import.
    importedManuallyRef.current = true;
    rawBoxRef.current = boxRes.monsters ?? [];
    setAccountExportedAt(exporte);
    setAccountName(nomJoueur);
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
        wizardName: nomJoueur,
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
    void saveAccount({
      box: rawBoxRef.current,
      runes,
      artifacts,
      crafts,
      exportedAt: accountExportedAt,
      wizardName: accountName,
    });
  }

  useEffect(() => {
    const onHash = () => {
      // ⚠️ Mémorisé AVANT la mise à jour : `window.location.hash` porte déjà la
      // nouvelle valeur, mais `route` tient encore l'ancienne. On enregistre
      // donc l'écran qu'on QUITTE, et jamais les paramètres eux-mêmes — sinon
      // le bouton n'aurait nulle part où ramener.
      const cible = parseHash().route;
      if (cible === 'parametres' && route !== 'parametres') {
        avantParametres.current = hashCourant.current;
      }
      hashCourant.current = window.location.hash || '#/';
      setNav(parseHash());
      // ⚠️ **Retour en HAUT à chaque changement d'écran.** Le routage par hash
      // ne fait défiler nulle part : on arrivait sur une nouvelle page à la
      // position qu'on occupait sur la précédente — au milieu du bestiaire
      // après avoir quitté une longue liste de runes, sans rien y comprendre.
      // C'est le comportement d'une navigation classique, que le hash nous fait
      // perdre.
      //
      // ⚠️ `instant` et non `smooth` : ce n'est pas un déplacement DANS la page
      // qu'on suit du regard, mais un changement de page. Une animation
      // donnerait à croire qu'on défile encore dans l'écran d'avant.
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [route]);

  // Message d'import éphémère : il disparaît tout seul (un peu plus long pour une erreur).
  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), importMsg.ok ? 5000 : 9000);
    return () => clearTimeout(t);
  }, [importMsg]);

  // ⚠️ **La SECTION OUVERTE, si elle a des sous-sections.** Quand elle existe,
  // elle REMPLACE la liste des sections dans la barre latérale (voir Sidebar) :
  // une seule liste à lire, et la place revient aux sous-sections.
  //
  // Trois sections en ont : Siège, Mon compte, Outils. Les autres (Accueil,
  // RTA, Bestiaire…) n'ont qu'un écran — la barre y garde son premier niveau.
  // Les trois sections à sous-sections, déclarées une fois : elles servent à la
  // fois de niveau ouvert par la route ET de cible des entrées du premier
  // niveau (`ouvre`). Deux définitions auraient divergé.
  const sectionSiege: SidebarSection = {
    titre: 'Siège',
    icon: <Castle size={17} color={COULEUR_SECTION.siege} />,
    groupes: [
      {
        liens: SIEGE_SUBS.map((t) => ({
          key: t.tab,
          label: t.label,
          hash: t.hash,
          icon: <t.icon size={17} color={t.couleur} />,
          actif: route === 'siege' && siegeTab === t.tab,
        })),
      },
    ],
  };

  const sectionCompte: SidebarSection = {
    titre: 'Mon compte',
    icon: <CircleUserRound size={17} color={COULEUR_SECTION.compte} />,
    // ⚠️ **Un groupe par INVENTAIRE, ses vues en entrées.** Les trois
    // inventaires étaient trois liens, et leurs vues (Résumé, Liste, Courbes…)
    // vivaient dans une rangée d'onglets en haut de page — invisible tant qu'on
    // n'y était pas. Onze destinations dont huit cachées derrière un clic.
    // Le nom de l'inventaire devient un TITRE de groupe, comme « Ressources »
    // au premier niveau : il annonce, il ne mène nulle part. C'est la vue qu'on
    // choisit, pas l'inventaire.
    groupes: ACCOUNT_SUBS.map((sub) => ({
      titre: sub.label,
      // Pour le panneau mobile, qui fait choisir l'inventaire AVANT sa vue.
      icone: <InventaireIcon name={sub.icon} size={17} couleur={sub.couleur} />,
      // ⚠️ Les VUES d'un inventaire portent la couleur de leur inventaire :
      // une même famille de teinte pour tout le groupe (Runes → Résumé, Liste,
      // Courbes… toutes en cyan), pas neuf teintes sans lien entre elles.
      liens: VUES_INVENTAIRE[sub.sub].map((v) => ({
        key: `${sub.sub}-${v.key}`,
        label: v.label,
        hash: hashVue(sub.sub, v.key),
        icon: <v.icon size={17} color={sub.couleur} />,
        actif: route === 'compte' && accountSub === sub.sub && accountView === v.key,
      })),
    })),
  };

  const sectionOutils: SidebarSection = {
    titre: 'Outils',
    icon: <Sparkles size={17} color={COULEUR_SECTION.outils} />,
    groupes: [
      {
        liens: OUTILS_SUBS.map((sub) => ({
          key: sub.sub,
          label: sub.label,
          hash: sub.hash,
          icon: <sub.icon size={17} color={sub.couleur} />,
          actif: route === 'outils' && toolSub === sub.sub,
        })),
      },
    ],
  };

  // ⚠️ **La SECTION OUVERTE PAR LA ROUTE.** Arriver sur `#/siege/offense`
  // montre les sous-sections du Siège ; la barre peut ensuite en ouvrir une
  // autre à la main, sans naviguer (voir Sidebar).
  const sectionOuverte: SidebarSection | null =
    route === 'siege'
      ? sectionSiege
      : route === 'compte'
        ? sectionCompte
        : route === 'outils'
          ? sectionOutils
          : null;

  // Premier niveau — les sections. ⚠️ Le MÊME ordre d'importance que la nav
  // précédente (spec/README.md) : Accueil → RTA → Siège → Mon compte → Outils
  // → Arène, puis les ressources. La refonte change la FORME de la navigation,
  // pas la hiérarchie, qui elle est le fruit de l'usage.

  const groupesNav: SidebarGroupe[] = [
    {
      liens: [
        ...NAV.map((item) => ({
          key: item.key,
          label: item.label,
          icon: <item.icon size={17} color={item.couleur} />,
          // ⚠️ Le Siège OUVRE sa section au lieu de naviguer : on choisit
          // Défense, Offense ou Recommandations avant de charger une page.
          ...(item.key === 'siege' ? { ouvre: sectionSiege } : { hash: item.hash }),
          actif: route === item.key,
        })),
        {
          key: 'compte',
          label: 'Mon compte',
          icon: <CircleUserRound size={17} color={COULEUR_SECTION.compte} />,
          ouvre: sectionCompte,
          actif: route === 'compte',
        },
        {
          key: 'outils',
          label: 'Outils',
          icon: <Sparkles size={17} color={COULEUR_SECTION.outils} />,
          ouvre: sectionOutils,
          actif: route === 'outils',
        },
        {
          key: ARENE_ITEM.key,
          label: ARENE_ITEM.label,
          hash: ARENE_ITEM.hash,
          icon: <ARENE_ITEM.icon size={17} color={ARENE_ITEM.couleur} />,
          actif: route === 'arene',
        },
      ],
    },
    {
      titre: 'Ressources',
      liens: RESOURCES.map((item) => ({
        key: item.key,
        label: item.label,
        hash: item.hash,
        icon: <item.icon size={17} color={item.couleur} />,
        actif: route === item.key,
      })),
    },
  ];

  // Titre de la barre supérieure — la section courante.
  //
  // ⚠️ DÉRIVÉ des mêmes constantes que la navigation, jamais une table de plus :
  // une seconde liste de libellés aurait divergé au premier renommage, et le
  // titre aurait annoncé une page qui n'existe plus sous ce nom.
  //
  // ⚠️ **Le titre montre la SOUS-SECTION courante**, pas le nom de la section,
  // quand celle-ci en a : l'inventaire sur « Mon compte » (Monstres / Runes /
  // Artéfacts), la vue sur le « Siège » (Défense / Offense / Recommandations).
  // Répéter « Mon compte » ou « Siège » faisait DOUBLON avec la navigation —
  // l'onglet du bas au doigt, l'en-tête de section de la barre latérale à la
  // souris. Nommer la sous-section apprend où l'on est au lieu de répéter le
  // niveau au-dessus.
  const entreeCourante = [...NAV, ARENE_ITEM, ...RESOURCES].find((i) => i.key === route);
  const compteSub = route === 'compte' ? ACCOUNT_SUBS.find((s) => s.sub === accountSub) : null;
  const siegeSub = route === 'siege' ? SIEGE_SUBS.find((s) => s.tab === siegeTab) : null;
  // ⚠️ Sur « Mon compte », le titre nomme l'inventaire ET SA VUE
  // (« Runes · Liste »). Il ne disait que l'inventaire : la vue était portée par
  // une rangée d'onglets dans la page, qui est passée dans le panneau de
  // navigation (voir MobileNavSheet). Sans elle, plus rien à l'écran ne disait
  // laquelle des sept vues de Runes on regardait.
  // La vue n'est ajoutée que s'il y a un CHOIX : la box de monstres n'en a
  // qu'une, « Monstres · Ma box » répéterait la même chose deux fois.
  const compteVue =
    compteSub && VUES_INVENTAIRE[accountSub].length > 1
      ? VUES_INVENTAIRE[accountSub].find((v) => v.key === vueValide(accountSub, accountView))?.label
      : null;
  const titreSection =
    (compteSub ? `${compteSub.label}${compteVue ? ` · ${compteVue}` : ''}` : null) ??
    siegeSub?.label ??
    sectionOuverte?.titre ??
    entreeCourante?.label ??
    (route === 'parametres' ? 'Paramètres' : 'SW Forge');
  // ⚠️ Deux branches : l'icône d'inventaire (`InventaireIcon`, au trait comme le
  // reste) et la vue de siège (lucide) n'ont pas la même API — mais le MÊME style.
  const iconeSection = compteSub ? (
    <InventaireIcon name={compteSub.icon} size={16} couleur={compteSub.couleur} />
  ) : siegeSub ? (
    <siegeSub.icon size={16} color={siegeSub.couleur} />
  ) : (
    sectionOuverte?.icon ??
    (entreeCourante ? <entreeCourante.icon size={16} color={entreeCourante.couleur} /> : null) ??
    (route === 'parametres' ? <Settings size={16} /> : null)
  );

  // TOUTES les destinations pour la recherche de navigation — sections ET
  // sous-sections, à plat.
  //
  // ⚠️ **Dérivée des mêmes constantes que la barre** (`NAV`, `ACCOUNT_SUBS`…),
  // pas ressaisie : une seconde liste écrite à la main aurait divergé au premier
  // écran ajouté, et le manque serait passé inaperçu — on ne cherche pas ce dont
  // on ignore l'existence.
  //
  // ⚠️ Les sous-sections portent leur SECTION en contexte : « Défense » seul ne
  // dit pas de quel écran il s'agit.
  const ciblesRecherche: CibleNav[] = [
    ...NAV.map((i) => ({
      key: i.key,
      label: i.label,
      hash: i.hash,
      icon: <i.icon size={15} color={i.couleur} />,
    })),
    ...SIEGE_SUBS.map((t) => ({
      key: `siege-${t.tab}`,
      label: t.label,
      hash: t.hash,
      icon: <t.icon size={15} color={t.couleur} />,
      contexte: 'Siège',
    })),
    // ⚠️ Chaque VUE de chaque inventaire, pas seulement les trois inventaires :
    // c'est tout l'intérêt du champ. On tape « courbes » pour y aller, sans
    // passer par Mon compte puis Runes.
    // Le contexte porte l'inventaire (« Runes »), sinon « Résumé » et « Liste »
    // apparaîtraient trois fois sans qu'on sache lesquels.
    ...ACCOUNT_SUBS.flatMap((sub) =>
      VUES_INVENTAIRE[sub.sub].map((v) => ({
        key: `compte-${sub.sub}-${v.key}`,
        label: v.label,
        hash: hashVue(sub.sub, v.key),
        icon: <v.icon size={15} color={sub.couleur} />,
        contexte: sub.label,
      }))
    ),
    ...OUTILS_SUBS.map((sub) => ({
      key: `outils-${sub.sub}`,
      label: sub.label,
      hash: sub.hash,
      icon: <sub.icon size={15} color={sub.couleur} />,
      contexte: 'Outils',
    })),
    {
      key: ARENE_ITEM.key,
      label: ARENE_ITEM.label,
      hash: ARENE_ITEM.hash,
      icon: <ARENE_ITEM.icon size={15} color={ARENE_ITEM.couleur} />,
    },
    ...RESOURCES.map((i) => ({
      key: i.key,
      label: i.label,
      hash: i.hash,
      icon: <i.icon size={15} color={i.couleur} />,
      contexte: 'Ressources',
    })),
    {
      key: 'parametres',
      label: 'Paramètres',
      hash: '#/parametres',
      icon: <Settings size={15} />,
    },
  ];

  // ⚠️ CINQ onglets mobiles au maximum — au-delà, les cibles passent sous 44 px.
  // Les quatre premiers sont les destinations de travail ; « Compte » ouvre la
  // section dont dépendent toutes les autres.
  //
  // ⚠️ **Un onglet qui a des SOUS-SECTIONS les fait choisir** (`ouvre`) au lieu
  // de mener droit à l'une d'elles — voir MobileNavSheet. « Siège » ouvrait la
  // Défense et « Compte » l'inventaire de monstres ; les dix autres vues du
  // compte n'étaient atteignables que par des rangées d'onglets posées DANS la
  // page, une par écran, invisibles tant qu'on n'y était pas. C'est la règle de
  // la barre latérale portée au tactile : on choisit d'abord OÙ.
  //
  // ⚠️ « Outils » compte désormais PLUSIEURS sous-sections (Optimizer, Speed
  // tuning) : il OUVRE leur choix comme Siège et Compte, au lieu de mener droit
  // à l'une d'elles. (Tant qu'il n'y en avait qu'une, il restait un simple lien
  // — un panneau pour un seul choix n'ajoutait qu'un geste.)
  const ongletsMobile: OngletMobile[] = [
    { key: 'home', label: 'Accueil', hash: '#/', icon: <Home size={17} color={COULEUR_SECTION.home} />, actif: route === 'home' },
    { key: 'rta', label: 'RTA', hash: '#/rta', icon: <Swords size={17} color={COULEUR_SECTION.rta} />, actif: route === 'rta' },
    { key: 'siege', label: 'Siège', ouvre: sectionSiege.titre, icon: <Castle size={17} color={COULEUR_SECTION.siege} />, actif: route === 'siege' },
    { key: 'compte', label: 'Compte', ouvre: sectionCompte.titre, icon: <CircleUserRound size={17} color={COULEUR_SECTION.compte} />, actif: route === 'compte' },
    { key: 'outils', label: 'Outils', ouvre: sectionOutils.titre, icon: <Sparkles size={17} color={COULEUR_SECTION.outils} />, actif: route === 'outils' || route === 'bestiary' || route === 'mecaniques' || route === 'releases' || route === 'arene' },
  ];

  // La section dont on choisit la sous-section, sur téléphone.
  // ⚠️ Son TITRE, jamais son objet : un objet mémorisé se fige à l'instant du
  // clic et son surlignage reste en arrière de la navigation — la barre
  // latérale a déjà payé cette leçon (voir Sidebar, `ouverte`).
  const sectionMobile =
    [sectionSiege, sectionCompte, sectionOutils].find((s) => s.titre === navMobileOuverte) ?? null;

  return (
    // ⚠️ `data-ctx` sur la RACINE : c'est lui qui décide de l'accent contextuel
    // de tout l'écran (voir index.css). Une page qui parle d'un monstre le
    // posera à son élément ; partout ailleurs il reste absent, et `--ctx`
    // retombe sur l'accent de l'app.
    <div
      // ⚠️ La marge suit le REPLI de la barre, et à la même courbe : sans ça,
      // la barre se replierait sur une colonne de vide. `--pad-nav` n'est posé
      // qu'au-dessus de `lg` (voir index.css) — sous cette largeur la barre
      // n'existe pas.
      style={
        {
          '--pad-nav': `${sidebarRetractee ? LARGEUR_SIDEBAR_RETRACTEE : LARGEUR_SIDEBAR}px`,
        } as CSSProperties
      }
      className="pad-nav"
    >
      {/* La sidebar est FIXE et hors flux : le contenu se décale d'autant
          au lieu d'être encapsulé dans une grille. Un
          `position: sticky` aurait suffi visuellement, mais la barre doit
          rester en place quand le contenu défile sur 3 000 monstres. */}
      <Sidebar
        groupes={groupesNav}
        section={sectionOuverte}
        recherche={
          <SidebarSearch
            cibles={ciblesRecherche}
            retractee={sidebarRetractee}
            onDeplier={() => setSidebarRetractee(false)}
          />
        }
        retractee={sidebarRetractee}
        onToggleRetract={() => setSidebarRetractee((r) => !r)}
        pied={
          /* ⚠️ Le pied dit QUI est chargé, et porte les deux gestes qui s'y
             rapportent : changer de compte, régler l'app. Il a d'abord affiché
             la date du dernier import dans une carte — une information qu'on ne
             lit qu'une fois, occupant en permanence le bas de l'écran. Elle vit
             maintenant dans les paramètres, à côté du réglage de conservation,
             là où on se pose la question. */
          <SidebarCompte
            nom={accountName}
            retractee={sidebarRetractee}
            parametresActifs={route === 'parametres'}
            onImport={importAccount}
          />
        }
      />

      <MobileTabs
        onglets={ongletsMobile}
        // ⚠️ **BASCULE, pas ouverture.** Retoucher l'onglet déjà ouvert le
        // referme. Le geste qui ouvre doit pouvoir défaire ce qu'il vient de
        // faire : sans ça, on ouvrait « Compte » par erreur et il fallait viser
        // la croix ou le voile pour en sortir — deux cibles ailleurs sur
        // l'écran, alors que le doigt est encore sur l'onglet.
        onOuvrirSection={(titre) =>
          setNavMobileOuverte((cur) => (cur === titre ? null : titre))
        }
        sectionOuverte={navMobileOuverte}
        onOuvrirActions={
          pageAPanneau ? () => setMenuPageOuvert(true) : undefined
        }
        actionsOuvertes={menuPageOuvert}
      />

      {/* Choix de la sous-section, sur téléphone. Alimenté par les MÊMES
          sections que la barre latérale — pas une seconde liste. */}
      <MobileNavSheet section={sectionMobile} onFermer={() => setNavMobileOuverte(null)} />

      {/* ⚠️ Montée APRÈS la barre latérale dans le DOM, mais posée au-dessus
          (`z-40` contre `z-30`) : elle traverse toute la largeur, y compris
          au-dessus de la barre. */}
      <TopBar
        titre={titreSection}
        icone={iconeSection}
        decalage={sidebarRetractee ? LARGEUR_SIDEBAR_RETRACTEE : LARGEUR_SIDEBAR}
        // ⚠️ Le burger n'apparaît que sur les pages qui ONT des actions : un
        // bouton qui ouvre un panneau vide est pire que pas de bouton.
        parametresActifs={route === 'parametres'}
        // ⚠️ Le MÊME geste que « Effacer mes données » des paramètres, pas un
        // second chemin : deux façons de purger auraient divergé à la première
        // garde ajoutée (le dialogue de conservation, par exemple).
        onDeconnexion={() => setPurgeGlobale(true)}
        onToggleParametres={() => {
          window.location.hash =
            route === 'parametres' ? avantParametres.current : '#/parametres';
        }}
        gauche={
          /* ⚠️ Le LOGO SEUL, et seulement sous `lg` — au-dessus, la barre
             latérale porte déjà l'identité. La zone a porté l'import et les
             réglages : trois éléments qui poussaient le titre centré en absolu
             SOUS eux, et le bouton ⚙ chevauchait « RTA ». */
          <a href="#/" className="flex items-center gap-2 lg:hidden">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6" />
          </a>
        }
      />

      {/* ⚠️ `pb-[calc(...)]` sous `lg` : la barre d'onglets est fixée en bas
          et recouvrirait le pied de page. */}
      {/* ⚠️ **Toute la largeur disponible**, plus de plafond à 1180 px. Celui-ci
          datait de la navigation horizontale : le contenu était centré sous une
          barre elle-même centrée. Avec une barre latérale, la page commence à
          son bord droit et doit aller jusqu'au bout — les grilles de monstres,
          les tableaux de runes et l'optimiseur gagnent une à deux colonnes.
          ⚠️ `pt-[68px]` : la barre supérieure est FIXE (48 px) et recouvrirait
          le haut du contenu. `pb-[calc(...)]` sous `lg` : la barre d'onglets
          est fixée en bas. */}
      {/* ⚠️ Le dégagement du haut inclut l'ENCOCHE : la barre supérieure
          descend sous elle (voir TopBar), donc le contenu doit descendre
          d'autant.
          ⚠️ **En `padding`, pas en `margin`** : une marge s'effondrerait hors du
          conteneur et la barre recouvrirait de nouveau le début de la page. */}
      {/* ⚠️ **`pb-[calc(116px_+_env(safe-area-inset-bottom))]`, pas `pb-24`
          (96 px) — mesuré insuffisant.** La barre d'onglets (`HAUTEUR_ONGLETS`,
          52 px) porte au-dessus d'elle le bouton flottant « Options »
          (`MobileTabs.tsx` : décalé de `env(safe-area-inset-bottom) + 16px`,
          haut mesuré 40 px) — son bord SUPÉRIEUR est donc à
          `env(safe-area-inset-bottom) + 52+16+40 = env(...) + 108px` du bas de
          l'écran. `pb-24` (96 px fixe, sans `env()`) laissait la dernière
          rangée de contenu — ex. les tuiles de `RunesOptim.tsx` — en partie
          SOUS ces deux éléments fixes, jamais atteignable en défilant même sur
          un appareil SANS encoche basse (108 > 96) : `elementFromPoint` sur
          une tuile de rune y résolvait le lien de navigation ou le bouton
          Options en dessous, pas la tuile elle-même (confirmé avec Playwright,
          viewport mobile réel — voir historique-*.md sous compte/runes.md).
          `116px` = 108 px + 8 px de respiration, `+ env(safe-area-inset-bottom)`
          pour rester aligné avec le même terme dans `MobileTabs.tsx`. */}
      <div
        className="px-4 pb-[calc(116px_+_env(safe-area-inset-bottom))] sm:px-6 lg:pb-16"
        style={{ paddingTop: 'calc(68px + env(safe-area-inset-top))' }}
      >

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
              className={`mb-3 text-xs animate-[apparition_200ms_var(--ease-out)] ${
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
            menuOuvert={menuPageOuvert}
            onFermerMenu={() => setMenuPageOuvert(false)}
          />
        ) : route === 'bestiary' ? (
          <BestiaryPage
            monsters={data.monsters}
            loadState={data.loadState}
            menuOuvert={menuPageOuvert}
            onFermerMenu={() => setMenuPageOuvert(false)}
          />
        ) : route === 'siege' ? (
          <SiegePage
            tab={siegeTab}
            siege={siegeTab === 'offense' ? siegeOff : siegeDef}
            offense={siegeOff}
            siegeDefenseTeams={siegeDef.state.teams}
            siegeOffenseTeams={siegeOff.state.teams}
            recos={recos}
            builds={ownedBuilds}
            teams={ownedTeams}
            copies6={copies6}
            monsters={allMonsters}
            loadState={data.loadState}
            onCreateMonster={custom.addCustomMonster}
            customMonsters={custom.customMonsters}
            onDeleteMonster={custom.removeCustomMonster}
            menuOuvert={menuPageOuvert}
            onFermerMenu={() => setMenuPageOuvert(false)}
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
            // ⚠️ `vueValide` : passer des Runes (sur « Courbes ») aux Artéfacts,
            // qui n'ont pas de courbes, laissait sinon un écran blanc.
            vue={vueValide(accountSub, accountView)}
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
            menuOuvert={menuPageOuvert}
            onFermerMenu={() => setMenuPageOuvert(false)}
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
            menuOuvert={menuPageOuvert}
            onFermerMenu={() => setMenuPageOuvert(false)}
          />
        ) : route === 'releases' ? (
          <ReleasesPage />
        ) : route === 'mecaniques' ? (
          <MechanicsPage />
        ) : route === 'parametres' ? (
          <SettingsPage
            onClearData={() => setPurgeGlobale(true)}
            onKeepAccount={persistCurrentAccount}
            onImport={importAccount}
            accountExportedAt={accountExportedAt}
            accountName={accountName}
          />
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
    </div>
  );
}
