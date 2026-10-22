import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import BuildCandidateCard from '../../src/components/outils/BuildCandidateCard';
import type { BuildCandidate } from '../../src/lib/runeBuildOptim';
import type { StatRow } from '../../src/lib/stats';
import type { RuneDetail } from '../../src/types';

// Banc de navigateur d'une carte de résultat de l'Optimizer : le vrai
// composant, avec l'état que l'écran lui passe au clic sur « Comparer »
// (écarts de la valeur moyenne, de la valeur de l'objectif, grille des stats),
// posé à une largeur donnée depuis optimizer-carte-resultat-navigateur.test.ts.

// Six runes : 4 Swift et 2 Energy (deux sets à côté du rang).
const runes: RuneDetail[] = [3, 8, 5, 10, 1, 2].map((code, i) => ({
  id: 901 + i, slot: i + 1, set: i < 4 ? 'swift' : 'energy', rank: 6, rarity: 5, level: 15,
  main: { code, value: 100 }, subs: [{ code: 8, value: 6 }, { code: 9, value: 5 }],
}));
const runeById = new Map(runes.map((r) => [r.id, r]));

// La fiche de stats au pire cas : PV de base les plus hauts des données
// (19 755) avec un bonus de « +40 000 », et chaque ligne remplie.
const stats: StatRow[] = [
  { key: 'hp', label: 'PV', suffix: '', base: 19755, bonus: 40000, total: 59755 },
  { key: 'atk', label: 'ATQ', suffix: '', base: 1000, bonus: 2000, total: 3000 },
  { key: 'def', label: 'DEF', suffix: '', base: 900, bonus: 1500, total: 2400 },
  { key: 'spd', label: 'VIT', suffix: '', base: 119, bonus: 120, total: 239 },
  { key: 'cr', label: 'Taux Crit', suffix: '%', base: 15, bonus: 85, total: 100 },
  { key: 'cd', label: 'Dmg Crit', suffix: '%', base: 50, bonus: 150, total: 200 },
  { key: 'res', label: 'RES', suffix: '%', base: 40, bonus: 60, total: 100 },
  { key: 'acc', label: 'Précision', suffix: '%', base: 25, bonus: 75, total: 100 },
];
const candidat: BuildCandidate = { runeIds: runes.map((r) => r.id), stats, effTotal: 0 };

export interface OptionsCarte {
  bureau: boolean;
  largeur: number;
  // « Comparer » et « Valider ce build », ou « Valider ce build » seul.
  boutons: 1 | 2;
  // La rangée de l'objectif, avec la valeur qui a classé la carte.
  objectif: 'ehp' | 'degats' | null;
}

function Carte({ bureau, boutons, objectif }: OptionsCarte) {
  const [compare, setCompare] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  return <BuildCandidateCard rank={2} candidate={candidat} runeById={runeById} artifacts={[]} metric="eff"
    openDetailKey={ouvert} onToggleDetail={(k) => setOuvert((o) => (o === k ? null : k))} bureau={bureau}
    pvEffectifs={objectif === 'ehp' ? { total: 123456, delta: compare ? -1234 : undefined } : undefined}
    degatsReels={objectif === 'degats' ? { total: 45678, partPvCible: 87, delta: compare ? 2345 : undefined } : undefined}
    metricDelta={compare ? -43.2 : undefined}
    onValidate={() => {}} validated="non"
    onCompare={boutons === 2 ? () => setCompare((c) => !c) : undefined}
    comparaison={compare ? stats.map((s) => ({ key: s.key, label: s.label, suffix: s.suffix, delta: -12 })) : undefined} />;
}

let root: Root | null = null;
export async function monter(options: OptionsCarte) {
  if (root) { const r = root; flushSync(() => r.unmount()); }
  root = createRoot(document.getElementById('racine')!);
  const r = root;
  flushSync(() => r.render(<div style={{ padding: 16 }}><div style={{ width: options.largeur }}><Carte {...options} /></div></div>));
  await new Promise((fin) => setTimeout(fin, 50));
}
