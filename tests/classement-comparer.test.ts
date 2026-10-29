import * as React from 'react';
import OptimizerSection from '../src/components/outils/OptimizerSection';
import GrilleResultats, { type GrilleResultatsProps } from '../src/components/outils/optimizer/GrilleResultats';
import { useOptimizerState } from '../src/hooks/useOptimizerState';
import { useOptimizerLists } from '../src/hooks/useOptimizerLists';
import { classerPourLaPage, fixtureClassementCombat } from './classement-fixture';
import { faussLocalStorage, egal, ok, titre } from './outils';
import type { Monster } from '../src/types';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { contexteResultat } from '../src/lib/contexteResultat';

/** Les vrais hooks et leurs setters, sans effets de plateforme ni composants enfants. */
function racine<T>(produire: () => T) {
  const cellules: any[] = [];
  let i = 0;
  const dispatcher = {
    useState(initial: any) {
      const n = i++;
      if (!(n in cellules)) cellules[n] = typeof initial === 'function' ? initial() : initial;
      return [cellules[n], (v: any) => { cellules[n] = typeof v === 'function' ? v(cellules[n]) : v; }];
    },
    useRef(initial: unknown) { const n = i++; return cellules[n] ??= { current: initial }; },
    useMemo<TMemo>(f: () => TMemo) { return f(); },
    useCallback<TCallback>(f: TCallback) { return f; },
    useSyncExternalStore(_subscribe: unknown, snapshot: () => unknown) { return snapshot(); },
    useId() { return `test-${i++}`; },
    useContext(contexte: { _currentValue: unknown }) { return contexte._currentValue; },
    useEffect() {}, useLayoutEffect() {},
  };
  return () => {
    const internes = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    const avant = internes.ReactCurrentDispatcher.current;
    internes.ReactCurrentDispatcher.current = dispatcher; i = 0;
    try { return produire(); } finally { internes.ReactCurrentDispatcher.current = avant; }
  };
}

function grille(noeud: unknown): GrilleResultatsProps | null {
  if (Array.isArray(noeud)) { for (const n of noeud) { const g = grille(n); if (g) return g; } }
  else if (React.isValidElement(noeud)) {
    if (noeud.type === GrilleResultats) return noeud.props as GrilleResultatsProps;
    for (const valeur of Object.values(noeud.props as object)) { const g = grille(valeur); if (g) return g; }
  }
  return null;
}

export function testClassementComparerApresValidation() {
  titre('Comparer — vrais gestes de la carte et de validation, référence courante et recherche figée');
  faussLocalStorage({});
  const f = fixtureClassementCombat('ehp');
  // La même relique équipe la fiche et le résultat ; la validation remplace runes et paire.
  const relicContext = resoudreContexteRelique({ mode: 'off', principale: 'libre', type: 'libre', seuil: 6 }, f.photo.fiche.relic, []);
  const photo = contexteResultat({ ...f.photo, params: { ...f.params, relicContext, objective: 'degats_reels' },
    resolution: { ...f.photo.resolution!, relicContext } });
  const { instantane: publication } = classerPourLaPage(photo, f.candidats, f.vue);
  const resultat = { ...publication.bilan!, nombre: publication.comptes.recus };
  const monster: Monster = { id: 1, com2usId: 1, name: 'Test', element: 'fire', archetype: 'attack', stars: 6,
    naturalStars: 5, secondAwaken: false, image: null, leaderSkill: null,
    stats: { hp: 10000, attack: 700, defense: 600, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 } };
  const listes = racine(useOptimizerLists), etat = racine(useOptimizerState);
  listes().createList('Test', 'guilde');
  const construire = racine(() => {
    const reel = etat();
    return OptimizerSection({ box: [{ key: '1', monster, gear: f.photo.fiche, stars: 6, level: 40 }], runes: f.params.pool,
      artifacts: f.photo.resolution!.artifactParams.inventaire, relics: [f.photo.fiche.relic!], relicUsageById: {},
      allMonsters: [monster], rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], lists: listes(),
      accountName: null, menuOuvert: false, onFermerMenu: () => {}, onOuvrirMenu: () => {}, onImporterEquipe: reel.importerEquipe,
      optimizer: { ...reel, selectedId: '1', sourceSelector: { source: 'box', unitKey: '1' }, gearSource: 'box',
        comboSets: ['violent'], capturerMembre: () => {},
        search: { ...reel.search, status: 'done', result: resultat, contexte: photo, classement: publication } } });
  });
  const lire = () => {
    const g = grille(construire());
    if (!g) throw new Error('Grille réelle absente');
    // Une carte dont les runes diffèrent de la photo, avec la relique portée.
    const rang = publication.page.cartes.findIndex(c => c.candidat.runeIds[0] !== f.photo.fiche.runes[0].id
      && (c.resultat?.relique?.id ?? f.photo.fiche.relic?.id) === f.photo.fiche.relic?.id);
    if (rang < 0) throw new Error('Carte de comparaison absente');
    return g.proprietesCarte(publication.page.cartes[rang].candidat, rang);
  };
  const avant = lire();
  ok(!!avant.onCompare && !!avant.onValidate, 'les deux vrais gestes sont disponibles');
  avant.onCompare!();
  const comparee = lire();
  ok(comparee.comparaison!.some(s => s.delta !== 0), 'avant validation : équipement différent, écarts non nuls');
  const photoAvant = JSON.stringify(photo), ordreAvant = publication.page.cartes;
  comparee.onValidate!();
  const apres = lire();
  egal(apres.validated, 'oui', 'le vrai geste de la carte a réservé ce build dans la liste');
  egal(apres.comparaison!.map(s => s.delta), Array(8).fill(0), 'après validation : huit écarts statistiques nuls');
  egal(apres.pvEffectifs?.delta, 0, 'après validation : écart PV effectifs nul');
  egal(apres.degatsReels?.delta, 0, 'après validation : écart Dégâts réels nul');
  ok(publication.page.cartes === ordreAvant && JSON.stringify(photo) === photoAvant, 'candidats, ordre et paramètres photographiés conservés');
}
