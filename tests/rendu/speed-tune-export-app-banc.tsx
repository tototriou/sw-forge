import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import App from '../../src/App';
import { saveAccount } from '../../src/lib/accountStore';
import { runesUtiliseesVides } from '../../src/lib/importAccount';
import { reinitialiserSticky } from '../../src/hooks/useStickyState';
import { setPersistence } from '../../src/hooks/usePersistence';
import type { GearSet, Monster, SiegeTeam } from '../../src/types';

const gear: GearSet = { base: { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
const monstres: Monster[] = [1, 2, 3].map(id => ({ id, com2usId: 10200 + id, name: `Allié ${id}`, element: 'water', archetype: 'attack',
  stars: 6, naturalStars: 5, secondAwaken: false, image: null,
  stats: { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 }, leaderSkill: null }));
const equipe: SiegeTeam = { id: 'o1', lead: 0, tickAlertDismissed: false,
  slots: monstres.map(m => ({ monsterId: String(m.id), runeSpeed: 150, tick: 0, sets: ['swift'], gear })) };
const pause = () => new Promise(r => setTimeout(r, 80));
async function geste(action: () => void) { flushSync(action); await pause(); }
async function attendre(lire: () => boolean) {
  for (let i = 0; i < 60; i++) { if (lire()) return; await pause(); }
  throw new Error('Écran attendu absent après montage d’App.');
}
const rapport = () => document.querySelector<HTMLElement>('[aria-labelledby="rapport-export-optimizer"]');
const modale = () => document.querySelector<HTMLElement>('[aria-labelledby="speed-tune-modale"]');
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (racine: Element, texte: string) => [...racine.querySelectorAll<HTMLButtonElement>('button')].find(b => visible(b) && b.textContent?.trim() === texte);

async function ouvrirParPalette() {
  await geste(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
  const champ = document.querySelector<HTMLInputElement>('[aria-label="Rechercher une page, un monstre, une action"]');
  if (!champ) throw new Error('Palette d’App absente.');
  await geste(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, 'Allié');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const choix = [...document.querySelectorAll<HTMLButtonElement>('#palette-liste [role="option"]')].find(b => b.textContent?.includes('Speed tuning ·'));
  if (!choix) throw new Error('Équipe de la palette absente.');
  await geste(() => choix.click());
  await attendre(() => !!modale() && !!bouton(modale()!, "Exporter vers l'Optimizer") && !bouton(modale()!, "Exporter vers l'Optimizer")!.disabled);
}

export async function scenario(): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (v: boolean, m: string) => preuves.push([v, m]);
  localStorage.clear(); reinitialiserSticky(''); setPersistence(true);
  localStorage.setItem('swblacksmith-siege-offense-v1', JSON.stringify({ teams: [equipe] }));
  const enregistre = await saveAccount({ box: monstres.map(m => ({ unitId: Number(m.id), com2usId: m.com2usId!, stars: 6, level: 40, gear })),
    runes: [], artifacts: [], relics: [], crafts: [], usedRuneIds: runesUtiliseesVides(), relicUsageById: {}, runeMarkerLabels: {}, exportedAt: null, wizardName: 'Synthétique' });
  if (!enregistre) throw new Error('Compte synthétique non enregistré.');
  const fetchAvant = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).endsWith('data/monsters.json')) {
      const reponse = new Response('{}');
      reponse.json = async () => ({ monsters: monstres, meta: { source: 'live' } });
      return reponse;
    }
    return new Response('{}', { status: 404 });
  };
  location.hash = '#/outils/optimizer';
  const racine = createRoot(document.getElementById('racine')!);
  try {
    await geste(() => racine.render(<App />));
    await attendre(() => [...document.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Importer une équipe'));
    for (const accepte of [true, false]) {
      await ouvrirParPalette();
      verifier(location.hash === '#/outils/optimizer' && !!modale(), `${accepte ? 'accepté' : 'refusé'} : modale ouverte par App sur la route Optimizer`);
      const exportation = bouton(modale()!, "Exporter vers l'Optimizer")!;
      const identites = monstres.map(m => m.com2usId);
      try {
        await geste(() => {
          // Sources devenues inutilisables entre le rendu du bouton et le geste :
          // le vrai producteur et l'action d'App doivent rendre leur refus.
          if (!accepte) monstres.forEach(m => { m.com2usId = null; });
          exportation.click();
        });
        const texte = rapport()?.innerText ?? '';
        verifier(!!rapport() && visible(rapport()!), `${accepte ? 'accepté' : 'refusé'} : rapport global visible`);
        verifier(texte.includes('ne garantit pas l’ordre des tours'), `${accepte ? 'accepté' : 'refusé'} : avertissement de conversion lu à l’écran`);
        verifier(accepte ? texte.includes('3 monstre(s), 1 équipe(s)') : texte.includes('Aucune liste créée') && texte.includes('identité d’espèce inutilisable'),
          accepte ? 'accepté : compte des membres et équipe lu à l’écran' : 'refusé : motif lu à l’écran');
        verifier(accepte ? !modale() : !!modale(), accepte ? 'accepté : speed tuning fermé' : 'refusé : speed tuning conservé');
        verifier(location.hash === '#/outils/optimizer', 'route Optimizer conservée');
        const fermer = rapport()?.querySelector<HTMLButtonElement>('[aria-label="Fermer"]');
        if (fermer) await geste(() => fermer.click());
        verifier(!rapport(), 'rapport global refermable');
        if (!accepte) verifier(!!modale()?.querySelector('[aria-label="Vitesse des runes de Allié 1"]'), 'refusé : saisie conservée derrière le rapport');
      } finally { monstres.forEach((m, i) => { m.com2usId = identites[i]; }); }
    }
    await geste(() => modale()?.querySelector<HTMLButtonElement>('[aria-label="Fermer"]')?.click());
    await geste(() => bouton(document.body, 'Importer une équipe')!.click());
    const source = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Sources d’import"] button')].find(b => b.textContent?.includes('Offense'));
    if (!source) throw new Error('Source du flottant Optimizer absente.');
    await geste(() => source.click());
    verifier(!rapport(), 'import par le flottant : aucune modale globale');
    verifier(document.querySelector<HTMLElement>('[aria-label="Rapport d’import"]')?.innerText.includes('3 monstre(s), 1 équipe(s)') ?? false,
      'import par le flottant : rapport interne lu à l’écran');
  } finally {
    await geste(() => racine.unmount());
    globalThis.fetch = fetchAvant;
  }
  return preuves;
}
