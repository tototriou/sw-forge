import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { BoxItem } from '../../src/lib/applyAccount';
import type { ArtifactDetail, RuneDetail, SiegeTeam } from '../../src/types';
import { exclusionSelectorKey, otherValidatedArtifactIds, type ExclusionSelector, type ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import { cleMemoireMembre, reverifierStockageOptimizer } from '../../src/lib/optimizerMemberStorage';
import { OPTIMIZER_BACKUP_STORAGE_KEY } from '../../src/lib/optimizerBackup';

interface Banc {
  etat: () => OptimizerState; listes: () => UseOptimizerLists; data: () => ExclusionSourceData;
  runes: () => RuneDetail[]; arts: () => ArtifactDetail[];
  changerBox: (box: BoxItem[]) => void; changerRunes: (runes: RuneDetail[]) => void;
  changerArtefacts: (arts: ArtifactDetail[]) => void; changerDefenses: (teams: SiegeTeam[]) => void;
  geste: (action: () => void) => Promise<void>;
  premier: ExclusionSelector; second: ExclusionSelector; siege: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (texte: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button')]
  .find(e => visible(e) && (e.textContent?.trim() === texte || e.getAttribute('aria-label') === texte))!;
const annonce = () => [...document.querySelectorAll<HTMLElement>('[aria-label="Annonce du point de sauvegarde"]')].find(visible)!;
const rapport = () => [...document.querySelectorAll<HTMLElement>('[aria-label="Rapport des critères"]')].find(visible)!;
const minimum = () => [...document.querySelectorAll<HTMLInputElement>('[aria-label="VIT minimum"]')].find(visible)?.value;
const position = (e: Element) => { const { x, y, width, height } = e.getBoundingClientRect(); return { x, y, width, height }; };

export async function preuvesPointOptimizer(b: Banc, nom: string): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const pli = bouton('Monstres à optimiser');
  if (pli) await b.geste(() => pli.click());
  await b.geste(() => {
    b.listes().setListContent('a', 'guilde');
    b.listes().setTeams([{ id: 'e', listId: 'a', members: [b.premier, b.second], leader: b.premier,
      lead: { stat: 'HP', amount: 33, area: 'Guild', element: null } }]);
    b.etat().setMinStats({ spd: 230 });
    b.etat().setExcludeBase(false);
    b.listes().validateBuild('a', b.premier, b.runes().map(r => r.id), b.arts().map(a => a.id), 10101);
  });
  const sansMemoire = nom.startsWith('point-sans-memoire');
  if (sansMemoire) await b.geste(() => b.etat().choisirMembre('a', b.second));
  const minimumSansMemoire = minimum();
  const barre = annonce().parentElement!;
  barre.scrollIntoView({ block: 'center' });
  verifier(bouton('Reprendre', barre).disabled && annonce().textContent === 'Aucun point de sauvegarde.', 'sans point : annonce visible et reprise désactivée');
  verifier(bouton('Sauvegarder', barre).title.includes('automatiquement'), 'bouton : conservation automatique expliquée');
  const cibles = [bouton('Sauvegarder', barre), bouton('Reprendre', barre), annonce(), bouton('Lier une team')];
  const avant = cibles.map(position);
  verifier(annonce().getBoundingClientRect().height >= 48 && getComputedStyle(annonce()).overflowY === 'auto',
    `place de l’annonce réservée avant le point, avec défilement interne — ${JSON.stringify(position(annonce()))}`);
  await b.geste(() => bouton('Sauvegarder', barre).click());
  verifier(annonce().textContent!.includes('Point de sauvegarde : 2 liste(s)') && !bouton('Reprendre', barre).disabled, 'point posé annoncé avec son étendue');
  verifier(JSON.stringify(cibles.map(position)) === JSON.stringify(avant), 'poser le point garde la position et la taille des contrôles et de l’annonce');
  const brut = localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY);
  async function ouvrirReprise() {
    await b.geste(() => bouton('Reprendre', barre).click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    verifier(dialog.textContent!.includes('Toutes tes listes actuelles') && ['membres', 'builds validés', 'critères mémorisés', 'équipes', 'contenus'].every(m => dialog.textContent!.includes(m)), 'confirmation : toutes les pertes du travail courant sont dites');
    verifier(document.activeElement?.textContent === 'Annuler', 'reprise : Annuler est le défaut au clavier');
    return dialog;
  }
  if (sansMemoire) {
    const cle = cleMemoireMembre('a', b.second);
    verifier(!b.listes().memories.has(cle), 'point sauvegardé sur le membre sélectionné sans mémoire');
    await b.geste(() => b.listes().setActiveListId('b'));
    await b.geste(() => b.etat().choisirMembre('b', b.premier));
    verifier(barre.parentElement!.textContent!.includes('Monstres de « Bêta »') && minimum() === '90',
      'avant reprise : liste Bêta et ses critères lus à l’écran');
    if (nom === 'point-sans-memoire-liste-supprimee') {
      await b.geste(() => b.listes().deleteList('a'));
      verifier(!b.listes().lists.some(l => l.id === 'a') && barre.parentElement!.textContent!.includes('Monstres de « Bêta »'),
        'Alpha supprimée avant reprise, Bêta reste affichée');
    }
    const dialog = await ouvrirReprise(); await b.geste(() => bouton('Reprendre', dialog).click());
    verifier(barre.parentElement!.textContent!.includes('Monstres de « Alpha »') && minimum() === minimumSansMemoire,
      'reprise depuis Bêta : Alpha et la base du membre sans mémoire affichées');
    const p = b.etat().proprietaireCriteres;
    verifier(p?.listId === 'a' && exclusionSelectorKey(p.selector) === exclusionSelectorKey(b.second) && p.com2usId === 10102,
      'après réconciliation : propriétaire du membre repris gardé');
    verifier(!b.listes().memories.has(cle), 'reprise seule : aucune mémoire créée');
    const menu = (label: string) => [...document.querySelectorAll<HTMLSelectElement>(`select[aria-label="${label}"]`)].find(visible);
    verifier(menu('Type de leader skill')?.value === 'HP' && menu('Valeur du leader skill')?.value === '33',
      'membre sans mémoire repris : lead PV +33 % de l’équipe affiché');
    await b.geste(() => {
      const champ = [...document.querySelectorAll<HTMLInputElement>('[aria-label="VIT minimum"]')].find(visible)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, '195');
      champ.dispatchEvent(new Event('input', { bubbles: true }));
    });
    verifier(minimum() === '195' && typeof b.listes().memories.get(cle)?.criteres.minStats.spd === 'number',
      'saisie VIT dans le champ réel : valeur affichée et mémoire du membre créée');
    await b.geste(() => b.etat().choisirMembre('a', b.premier));
    await b.geste(() => b.etat().choisirMembre('a', b.second));
    verifier(minimum() === '195' && menu('Type de leader skill')?.value === 'HP' && menu('Valeur du leader skill')?.value === '33',
      'retour au membre : saisie mémorisée restaurée à l’écran et lead d’équipe toujours appliqué');
    verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === brut, 'reprise et saisie gardent le point intact');
  } else if (nom === 'point-gestes') {
    await b.geste(() => b.etat().setMinStats({ spd: 250 }));
    verifier(minimum() === '250', 'modification avant reprise lue dans le champ VIT de l’écran');
    await b.geste(() => bouton('Sauvegarder', barre).click());
    let dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    verifier(dialog.textContent!.includes('Remplacer le point de sauvegarde ?') && document.activeElement?.textContent === 'Annuler', 'remplacement confirmé avec défaut sans perte');
    await b.geste(() => bouton('Annuler', dialog).click());
    verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === brut, 'annuler le remplacement garde les octets du point');
    await b.geste(() => bouton('Sauvegarder', barre).click());
    dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    await b.geste(() => bouton('Remplacer', dialog).click());
    verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) !== brut, 'remplacement accepté pose un nouveau point');
    await b.geste(() => { b.etat().setMinStats({ spd: 280 }); b.listes().renameList('a', 'Modifiée'); b.listes().deleteList('b');
      b.listes().setListContent('a', 'arene'); b.listes().setTeams([]); b.listes().releaseAllInList('a'); });
    const courant = localStorage.getItem('swblacksmith-optimizer-lists-v1');
    dialog = await ouvrirReprise();
    await b.geste(() => bouton('Annuler', dialog).click());
    verifier(minimum() === '280' && localStorage.getItem('swblacksmith-optimizer-lists-v1') === courant, 'annuler la reprise garde l’affichage et les listes courantes');
    const point = localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY);
    dialog = await ouvrirReprise(); await b.geste(() => bouton('Reprendre', dialog).click());
    verifier(minimum() === '250', 'reprise dans la même liste : VIT sauvegardée affichée, pas les critères remplacés');
    verifier(barre.parentElement!.textContent!.includes('Monstres de « Alpha »') && !!bouton('Modifier l’équipe'), 'nom et équipe sauvegardés rendus à l’écran');
    verifier(b.listes().lists.length === 2 && b.listes().validated.length === 1 && b.listes().listContents.get('a') === 'guilde', 'liste supprimée, build et contenu repris ensemble');
    verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === point, 'reprise et suppression de liste gardent le point');
    await b.geste(() => b.etat().setMinStats({ spd: 260 }));
    verifier(minimum() === '260' && b.listes().memories.get(cleMemoireMembre('a', b.premier))?.criteres.minStats.spd === 260,
      'modification suivant la reprise affichée et écrite vers le membre repris');
  } else if (nom === 'point-reimport') {
    await b.geste(() => b.etat().choisirMembre('a', b.siege));
    await b.geste(() => { b.etat().setMinStats({ spd: 275 }); b.etat().setExcludeBase(false);
      b.listes().validateBuild('a', b.siege, b.runes().map(r => r.id), [71, 72], 10101); });
    await b.geste(() => bouton('Sauvegarder', barre).click());
    await b.geste(() => bouton('Remplacer', document.querySelector('[role="dialog"]')!).click());
    const point = localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY);
    const defenses = b.data().siegeDefenseTeams.map(e => ({ ...e, slots: e.slots.map((s, i) => i === 0 ? { ...s, monsterId: '2' } : s) }));
    const data = { ...b.data(), siegeDefenseTeams: defenses }, runes = b.runes().slice(0, -1), arts = b.arts().slice(0, 1);
    const ids = new Set(runes.map(r => r.id));
    const r = reverifierStockageOptimizer(b.listes(), data, ids, new Set(arts.map(a => a.id)));
    await b.geste(() => { b.changerDefenses(defenses); b.changerRunes(runes); b.changerArtefacts(arts);
      b.listes().replaceAfterRevalidation(r.stockage); b.etat().appliquerReverificationMembres(r.stockage, r.rapport, data, ids); });
    verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === point, 'réimport ne modifie pas le point');
    verifier([...document.querySelectorAll('[role="status"]')].some(e => visible(e) && e.textContent!.includes('1 artéfact(s) absent(s)')), 'réimport : artéfact disparu signalé par l’écran');
    await b.geste(() => b.etat().setMinStats({ spd: 300 }));
    const dialog = await ouvrirReprise(); await b.geste(() => bouton('Reprendre', dialog).click());
    verifier(minimum() === '275', 'après réimport : VIT du bon membre sauvegardé affichée');
    verifier(rapport().textContent!.includes('rattaché') && rapport().textContent!.includes('1 artéfact(s) absent(s)'), 'rapport affiché : rattachement, rune et artéfact absents');
    verifier(rapport().textContent!.includes('1 rune(s) absente(s)'), 'rapport affiché : rune disparue gardée');
    const selector = b.etat().sourceSelector!;
    verifier(selector.source === 'unowned' && b.etat().selectedId === '1', 'autre occupant du slot : sélection de l’espèce sauvegardée sans collision');
    const build = b.listes().validated.find(v => exclusionSelectorKey(v.selector) === exclusionSelectorKey(selector))!;
    verifier(build.artifactIds?.includes(72) === true && build.artefactsManquants?.includes(72) === true
      && !otherValidatedArtifactIds(b.listes().validated, 'a', null).has(72), 'paire conservée, artéfact absent marqué et plus réservé');
    verifier([...document.querySelectorAll('[role="status"]')].some(e => visible(e) && e.textContent!.includes('Seuls les artéfacts présents')), 'fiche du membre repris : artéfacts absents expliqués');
  } else if (nom === 'point-vide') {
    await b.geste(() => { b.changerBox([]); b.changerRunes([]); b.changerArtefacts([]); b.listes().deleteList('a'); });
    const dialog = await ouvrirReprise(); await b.geste(() => bouton('Reprendre', dialog).click());
    verifier(rapport().textContent!.includes('Compte vide') && rapport().textContent!.includes('sans revérification'), 'compte vide annoncé sur l’écran');
    verifier(barre.parentElement!.textContent!.includes('Monstres de « Alpha »') && b.listes().members.length === 10 && b.listes().validated.length === 1,
      'compte vide : liste, membres et build repris sans retrait');
    verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === brut, 'compte vide : point intact');
    verifier(b.etat().proprietaireCriteres === null, 'membre introuvable : aucun propriétaire attribué');
  }
  verifier(document.documentElement.scrollWidth <= window.innerWidth, 'format sans débordement horizontal');
  return preuves;
}
