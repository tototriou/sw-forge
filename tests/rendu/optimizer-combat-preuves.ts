import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';
import { parseOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { resolvedLeaderSkill } from '../../src/lib/damage';

interface Banc {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (action: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (noms: string[]) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e) && (noms.includes(e.getAttribute('aria-label') ?? '')
  || [...e.querySelectorAll('span')].some(s => visible(s) && noms.includes(s.textContent?.trim() ?? '')) || noms.includes(e.textContent?.trim() ?? '')))!;
const memoire = (b: Banc) => b.listes().memories.get(cleMemoireMembre('a', b.premier))!;

async function lier(b: Banc) {
  await b.geste(() => {
    b.listes().setListContent('a', 'guilde');
    b.listes().setTeams([{ id: 'ea', listId: 'a', members: [b.premier, b.second],
      lead: { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } }]);
  });
}

async function choisirLead(b: Banc, valeur: string) {
  await b.geste(() => {
    const menu = [...document.querySelectorAll<HTMLSelectElement>('[aria-label="Type de leader skill"]')].find(visible)!;
    menu.value = valeur; menu.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export async function preuvesRecetteLeadEquipe(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  await b.geste(() => b.etat().setDamageSetup(s => ({ ...s, leaderSkill: { stat: 'HP', pct: 33 }, leaderSpeedPct: 19 })));
  await lier(b);
  const personnel = JSON.stringify(b.etat().damageSetup), photo = JSON.stringify(memoire(b)), teams = JSON.stringify(b.listes().teams);
  const textes: Promise<string>[] = [];
  const creerUrl = URL.createObjectURL, cliquerLien = HTMLAnchorElement.prototype.click;
  let texte!: string;
  try {
    URL.createObjectURL = blob => { textes.push((blob as Blob).text()); return creerUrl(blob); };
    // Lire le Blob produit par le vrai bouton, sans enregistrer un fichier.
    HTMLAnchorElement.prototype.click = function () { if (!this.download) cliquerLien.call(this); };
    await b.geste(() => bouton(['Exporter', 'Exporter les paramètres de recherche']).click());
    verifier(textes.length === 1, 'export réel : un JSON produit par le clic');
    texte = await textes[0];
  } finally { URL.createObjectURL = creerUrl; HTMLAnchorElement.prototype.click = cliquerLien; }
  const { recipe } = parseOptimizerRecipe(texte);
  verifier(recipe?.damageSetup?.leaderSkill?.stat === 'Attack Speed' && recipe.damageSetup.leaderSkill.pct === 24,
    'recette exportée depuis le membre lié : lead effectif de l’équipe');
  verifier(recipe?.damageSetup?.leaderSpeedPct === undefined, 'recette : aucun ancien lead personnel superposé');
  verifier(JSON.stringify(b.etat().damageSetup) === personnel && JSON.stringify(memoire(b)) === photo,
    'exporter garde les critères personnels et la mémoire du membre intacts');
  const donnees = JSON.parse(texte) as Record<string, unknown>;
  verifier(!('teams' in donnees) && !('proprietaireCriteres' in donnees), 'recette : valeurs de recherche, sans équipe ni propriétaire');
  const lireFichier = File.prototype.text;
  let resoudre!: (contenu: string) => void;
  try {
    File.prototype.text = () => new Promise<string>(r => { resoudre = r; });
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept=".json,application/json"]')!;
    const fichiers = new DataTransfer(); fichiers.items.add(new File([texte], 'recette.json', { type: 'application/json' }));
    await b.geste(() => { input.files = fichiers.files; input.dispatchEvent(new Event('change', { bubbles: true })); });
    await b.geste(() => resoudre(texte));
    await b.geste(() => {});
  } finally { File.prototype.text = lireFichier; }
  verifier(b.etat().proprietaireCriteres === null && b.etat().lireCombatMembre().equipe === null,
    'réimport : aucune attribution à une équipe ou à un propriétaire');
  verifier(b.etat().damageSetup.leaderSkill?.stat === 'Attack Speed' && b.etat().damageSetup.leaderSkill?.pct === 24,
    'réimport : le lead effectif exporté devient une valeur de recette');
  verifier(JSON.stringify(memoire(b)) === photo && JSON.stringify(b.listes().teams) === teams,
    'réimport : aucune mémoire ni équipe existante écrasée');
  return preuves;
}

export async function preuvesLeadAncienHorsEquipe(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const poserPersonnel = () => b.geste(() => b.etat().setDamageSetup(s => ({ ...s,
    leaderSkill: { stat: 'HP', pct: 33 }, leaderSpeedPct: 19 })));
  await poserPersonnel();
  verifier(b.etat().proprietaireCriteres?.com2usId === 10101 && resolvedLeaderSkill(b.etat().damageSetup)?.stat === 'HP',
    'hors équipe : propriétaire valide, critères avec lead moderne et ancien lead de VIT');
  await choisirLead(b, '');
  verifier(resolvedLeaderSkill(b.etat().damageSetup) === null && b.etat().damageSetup.leaderSpeedPct === undefined,
    'hors équipe, choix Aucun : aucun lead résolu, ancien champ de VIT effacé');
  verifier(b.etat().proprietaireCriteres?.com2usId === 10101 && memoire(b).com2usId === 10101
    && resolvedLeaderSkill(memoire(b).criteres.damageSetup) === null && memoire(b).criteres.damageSetup.leaderSpeedPct === undefined,
    'hors équipe : choix Aucun écrit la mémoire du propriétaire valide en conséquence');
  await poserPersonnel();
  await lier(b);
  const personnel = JSON.stringify(b.etat().damageSetup), photo = JSON.stringify(memoire(b));
  await choisirLead(b, '');
  verifier(b.listes().teams[0].lead === null && resolvedLeaderSkill(b.etat().lireCombatMembre().setup) === null,
    'membre lié, choix Aucun : lead partagé retiré, aucun repli sur le lead personnel');
  verifier(b.etat().damageSetup.leaderSpeedPct === 19 && b.etat().damageSetup.leaderSkill?.pct === 33
    && JSON.stringify(b.etat().damageSetup) === personnel && JSON.stringify(memoire(b)) === photo,
    'membre lié, même geste : ancien champ et lead personnel conservés dans les critères et la mémoire');
  return preuves;
}
