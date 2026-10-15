import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { baseCompleteCriteres, photoCriteres } from '../../src/lib/criteresOptimizer';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';
import { exclusionSelectorKey, type ExclusionSelector } from '../../src/lib/optimizerExclusion';
import { buildOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { searchBuilds, type SearchParams } from '../../src/lib/runeBuildOptim';

interface BancMemoire {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (action: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
  rta: ExclusionSelector;
  siege: ExclusionSelector;
}
type Preuves = [boolean, string][];
const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const memoires = (b: BancMemoire) => JSON.stringify([...b.listes().memories]);

export async function preuvesSupplementaires(nom: string, b: BancMemoire): Promise<Preuves | null> {
  const preuves: Preuves = [];
  const verifier = (condition: boolean, texte: string) => preuves.push([condition, texte]);
  const choisir = (selector: ExclusionSelector) => b.geste(() => { b.etat().choisirMembre('a', selector); });
  if (nom === 'liste-inactive') {
    await b.geste(() => b.listes().setActiveListId('b'));
    verifier(b.etat().minStats.spd === 190, 'Bêta active : VIT 190 restaurée');
    const avant = memoires(b);
    let retour: ReturnType<OptimizerState['choisirMembre']> = null;
    await b.geste(() => { retour = b.etat().choisirMembre('a', b.premier); });
    verifier(retour === null, 'choix explicite dans Alpha inactive : retour nul');
    verifier(b.etat().minStats.spd === 190, 'Alpha inactive : VIT 230 non appliquée');
    verifier(b.etat().proprietaireCriteres === null, 'choix refusé : aucun propriétaire attribué');
    verifier(memoires(b) === avant, 'choix dans une liste inactive : toutes les mémoires intactes');
  } else if (nom === 'globaux-restauration') {
    const valeurs = { relicMinUpgrade: 12, excludeUsedRunes: true, excludeUsedScope: 'siege-defense',
      // Une autre copie reste une exclusion légitime pour les deux membres
      // restaurés ; exclure la cible testerait sa purge d'auto-exemption.
      excludedSelectors: [{ source: 'box', unitKey: '33' }], adaptiveTrancheWeighting: true, exhaustiveSearch: true,
      verifierToutesLesCombinaisons: true, slotFilterPreset: 'haut', showAdvanced: true, diagnoseBlockingEnabled: true };
    for (const [champ, valeur] of Object.entries(valeurs)) {
      await b.geste(() => (b.etat() as unknown as Record<string, (v: unknown) => void>)[`set${champ[0].toUpperCase()}${champ.slice(1)}`](valeur));
    }
    for (const [champ, valeur] of Object.entries(valeurs)) {
      verifier(egal((b.etat() as unknown as Record<string, unknown>)[champ], valeur), `${champ} : préférence non standard posée avant restauration`);
    }
    const avant = memoires(b);
    // Une base complète puis une mémoire sont deux chemins de restauration.
    for (const selector of [b.second, b.premier]) {
      await choisir(selector);
      for (const [champ, valeur] of Object.entries(valeurs)) {
        verifier(egal((b.etat() as unknown as Record<string, unknown>)[champ], valeur), `${champ} : préférence conservée après choix de ${exclusionSelectorKey(selector)}`);
      }
    }
    verifier(b.etat().minStats.spd === 230 && memoires(b) === avant, 'critères personnels restaurés, préférences sans capture');
  } else if (nom === 'source-rta' || nom === 'source-siege') {
    const selector = nom === 'source-rta' ? b.rta : b.siege;
    const vitesse = nom === 'source-rta' ? 270 : 280;
    const avant = memoires(b);
    const resultat: { photo: ReturnType<OptimizerState['choisirMembre']> } = { photo: null };
    await b.geste(() => { resultat.photo = b.etat().choisirMembre('a', selector); });
    verifier(resultat.photo?.minStats.spd === vitesse && b.etat().minStats.spd === vitesse, `${selector.source} : mémoire spécifique restaurée`);
    verifier(egal(b.etat().sourceSelector, selector) && b.etat().gearSource === selector.source,
      `${selector.source} : sélecteur et source affichée concordent`);
    verifier(egal(b.etat().proprietaireCriteres, { listId: 'a', selector, com2usId: 10101 }), `${selector.source} : propriétaire exact`);
    verifier(memoires(b) === avant, `${selector.source} : restauration sans capture`);
    await b.geste(() => b.etat().setMinStats({ spd: vitesse + 5 }));
    verifier(b.listes().memories.get(cleMemoireMembre('a', selector))?.criteres.minStats.spd === vitesse + 5,
      `${selector.source} : saisie attribuée à son sélecteur`);
    verifier(b.listes().memories.get(cleMemoireMembre('a', b.premier))?.criteres.minStats.spd === 230,
      `${selector.source} : mémoire Box de la même espèce intacte`);
    await choisir(b.premier); await choisir(selector);
    verifier(b.etat().minStats.spd === vitesse + 5, `${selector.source} : aller-retour retrouve la saisie`);
  } else if (nom === 'recette-sans-selection') {
    const recette = buildOptimizerRecipe({ monsterCom2usId: 99999, monsterName: 'Absent du bestiaire',
      damageSetup: baseCompleteCriteres(undefined).damageSetup,
      requirement: { sets: ['swift'], minStats: { spd: 310 } }, objective: 'vitesse', metric: 'eff',
      slotFilterPreset: 'moyen', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
      excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [], ignoreArtifacts: false, artifactMainByKind: {} });
    let resoudre!: (texte: string) => void;
    const original = File.prototype.text;
    File.prototype.text = () => new Promise<string>(r => { resoudre = r; });
    try {
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      const fichiers = new DataTransfer(); fichiers.items.add(new File([''], 'recette.json', { type: 'application/json' }));
      await b.geste(() => { input.files = fichiers.files; input.dispatchEvent(new Event('change', { bubbles: true })); });
      await choisir(b.second); await b.geste(() => b.etat().setMinStats({ spd: 185 }));
      const avant = memoires(b);
      await b.geste(() => resoudre(JSON.stringify(recette)));
      verifier(b.etat().selectedId === '2' && egal(b.etat().sourceSelector, b.second), 'espèce absente du bestiaire : aucune nouvelle sélection');
      verifier(b.etat().minStats.spd === 310 && b.etat().objective === 'vitesse', 'recette valide : critères appliqués à la résolution retardée');
      verifier(b.etat().proprietaireCriteres === null, 'recette sans sélection : propriétaire effacé à la résolution');
      verifier(memoires(b) === avant, 'recette sans sélection : toutes les mémoires intactes');
      await b.geste(() => b.etat().setMinStats({ spd: 320 }));
      verifier(b.etat().minStats.spd === 320 && b.etat().proprietaireCriteres === null, 'saisie suivante affichée sans propriétaire');
      verifier(memoires(b) === avant, 'saisie après recette sans sélection : aucune mémoire modifiée');
    } finally { File.prototype.text = original; }
  } else return null;
  return preuves;
}

let photoAvantClic: ReturnType<typeof photoCriteres>;
let autresMemoiresAvantClic: string;

export async function preparerClicInclusion(genre: string, b: BancMemoire): Promise<Preuves> {
  await b.geste(() => b.etat().choisirMembre('a', b.second));
  await b.geste(() => b.listes().removeMember('a', b.second));
  await b.geste(() => {
    b.etat().setComboSets(['energy', 'energy', 'energy']);
    b.etat().setMinStats({ spd: 25 }); b.etat().setMaxStats({ res: 80 });
    b.etat().setObjective('vitesse'); b.etat().setSortBy('vitesse');
    b.etat().setOptimiserArtefacts(false); b.etat().setCritereArtefacts('brut');
    b.etat().setCompterAurasResPre(false);
  });
  photoAvantClic = photoCriteres(b.etat(), { type: 'personnel' });
  autresMemoiresAvantClic = memoires(b);
  if (genre === 'carte') {
    // Le transport seul est remplacé : le vrai moteur calcule ce minuscule
    // inventaire et le vrai hook reçoit son résultat avant le clic de carte.
    globalThis.Worker = class {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror = null;
      postMessage(params: SearchParams) {
        const resultat = searchBuilds(params);
        queueMicrotask(() => this.onmessage?.(new MessageEvent('message', { data: { type: 'result', ...resultat } })));
      }
      terminate() { this.onmessage = null; }
    } as unknown as typeof Worker;
  }
  return [[b.etat().proprietaireCriteres === null, 'avant clic : aucun propriétaire'],
    [!b.listes().memories.has(cleMemoireMembre('a', b.second)), 'avant clic : aucune mémoire du membre à inclure'],
    [photoAvantClic.minStats.spd === 25 && photoAvantClic.maxStats.res === 80, 'avant clic : critères non standards affichés']];
}

export function verifierClicInclusion(b: BancMemoire): Preuves {
  const cle = cleMemoireMembre('a', b.second);
  const differences = Object.keys(photoAvantClic).filter(champ => !egal(
    (photoCriteres(b.etat(), { type: 'personnel' }) as unknown as Record<string, unknown>)[champ],
    (photoAvantClic as unknown as Record<string, unknown>)[champ]));
  return [
    [b.listes().members.some(m => m.listId === 'a' && egal(m.selector, b.second)), 'clic réel : monstre inclus dans Alpha'],
    [egal(b.etat().proprietaireCriteres, { listId: 'a', selector: b.second, com2usId: 10102 }), 'clic réel : propriétaire exact attribué'],
    [egal(b.listes().memories.get(cle)?.criteres, photoAvantClic), 'clic réel : photo complète des critères du geste mémorisée'],
    [JSON.stringify([...b.listes().memories].filter(([k]) => k !== cle)) === autresMemoiresAvantClic, 'clic réel : toutes les autres mémoires intactes'],
    [egal(photoCriteres(b.etat(), { type: 'personnel' }), photoAvantClic), `clic réel : critères affichés conservés${differences.length ? ` — différences : ${differences.join(', ')}` : ''}`],
  ];
}
