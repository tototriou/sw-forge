import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import TableauResultats, { CARTES_SOUS_LE_SEUIL, TABLEAU_VISIBLE } from '../../src/components/outils/optimizer/TableauResultats';
import type { TriResultats } from '../../src/components/outils/optimizer/TetesDeTri';
import type { CarteClassement } from '../../src/lib/classementCompact';
import type { BornesResultats } from '../../src/lib/filtresResultats';
import type { ColonneResultat } from '../../src/lib/colonnesResultats';
import type { StatRow } from '../../src/lib/stats';
import type { RuneDetail } from '../../src/types';

// Banc de navigateur du tableau des résultats de l'Optimizer : le vrai
// composant, aux valeurs les plus larges que l'écran doit tenir (PV effectifs
// et dégâts à six chiffres, PV à cinq, efficience à trois chiffres et une
// décimale, toutes les bornes posées dont « 150000 »), dans un conteneur
// `@container/resultats` d'une largeur donnée.

const runes: RuneDetail[] = [1, 2, 3, 4, 5, 6].map((slot) => ({
  id: 700 + slot, slot, set: 'swift', rank: 6, rarity: 5, level: 15,
  // Des secondaires énormes : la mesure moyenne passe 100 % (trois chiffres).
  main: { code: slot === 2 ? 8 : 1, value: slot === 2 ? 42 : 160 }, subs: [{ code: 8, value: 40 }, { code: 9, value: 30 }, { code: 10, value: 35 }, { code: 2, value: 40 }],
}));
const runeById = new Map(runes.map((r) => [r.id, r]));
const stats: StatRow[] = [
  { key: 'hp', label: 'PV', suffix: '', base: 19755, bonus: 79244, total: 98999 },
  { key: 'atk', label: 'ATQ', suffix: '', base: 1000, bonus: 2999, total: 3999 },
  { key: 'def', label: 'DEF', suffix: '', base: 900, bonus: 2999, total: 3899 },
  { key: 'spd', label: 'VIT', suffix: '', base: 119, bonus: 199, total: 318 },
  { key: 'cr', label: 'Taux Crit', suffix: '%', base: 15, bonus: 95, total: 110 },
  { key: 'cd', label: 'Dmg Crit', suffix: '%', base: 50, bonus: 249, total: 299 },
  { key: 'res', label: 'RES', suffix: '%', base: 40, bonus: 80, total: 120 },
  { key: 'acc', label: 'Précision', suffix: '%', base: 25, bonus: 95, total: 120 },
];
// Vingt lignes : la sixième rune change d'identifiant d'une ligne à l'autre (clés distinctes).
const cartes: CarteClassement[] = Array.from({ length: 20 }, (_, i) => {
  const sixieme = { ...runes[5], id: 706 + (i + 1) * 1000 };
  runeById.set(sixieme.id, sixieme);
  return { ordinal: i, resultat: null, pvEffectifs: 999999 - i * 1000, degatsReels: 888888 - i * 1000,
    candidat: { runeIds: [...runes.slice(0, 5).map((r) => r.id), sixieme.id], stats, effTotal: 0 } };
});

export const BORNES_PLEINES: BornesResultats = {
  hp: { min: 18000, max: 99999 }, atk: { min: 1000, max: 9999 }, def: { min: 600, max: 9999 }, spd: { min: 130, max: 999 },
  cr: { min: 30, max: 999 }, cd: { min: 50, max: 999 }, res: { min: 100, max: 999 }, acc: { min: 100, max: 999 },
  efficience: { min: 60, max: 999 }, degats_reels: { min: 150000, max: 999999 }, ehp: { min: 150000, max: 999999 },
};

export interface OptionsTableau {
  largeur: number;
  // Le tableau seul, sans la requête de conteneur : pour mesurer sa largeur minimale.
  force: boolean;
  bornes: 'pleines' | 'aucune' | 'contradictoire';
  sansSort?: boolean;
}

function Banc({ largeur, force, bornes: genre, sansSort }: OptionsTableau) {
  const [tri, setTri] = useState<TriResultats>({ tri: 'spd', sens: 'desc' });
  const [bornes, setBornes] = useState<BornesResultats>(genre === 'pleines' ? BORNES_PLEINES : genre === 'contradictoire' ? { spd: { min: 220, max: 200 } } : {});
  const disponible = (c: ColonneResultat) => !(sansSort && c === 'degats_reels');
  const tableau = (
    <TableauResultats cartes={cartes} premierRang={1} placesEnAttente={0} runeById={runeById} metric="eff" afficherDepassement
      tri={tri} trier={setTri} bornes={bornes} disponible={disponible} ouvrirDetail={() => {}}
      poserBorne={(c, cote, v) => setBornes((b) => ({ ...b, [c]: { ...(b[c] ?? { min: null, max: null }), [cote]: v } }))}
      vide={genre === 'contradictoire' ? 'Vue vide : le minimum de VIT (220) dépasse son maximum (200).' : null} />
  );
  return (
    <div data-racine-tableau="" className="@container/resultats" style={{ width: largeur }}>
      {force ? tableau : (
        <>
          <div className={TABLEAU_VISIBLE}>{tableau}</div>
          <div className={CARTES_SOUS_LE_SEUIL} data-cartes-repli="">cartes</div>
        </>
      )}
    </div>
  );
}

let root: Root | null = null;
export async function monter(options: OptionsTableau) {
  if (root) { const r = root; flushSync(() => r.unmount()); }
  root = createRoot(document.getElementById('racine')!);
  const r = root;
  flushSync(() => r.render(<div style={{ padding: 16 }}><Banc {...options} /></div>));
  await new Promise((fin) => setTimeout(fin, 50));
}
