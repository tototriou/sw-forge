// Preuves au navigateur des BRANCHEMENTS de l'écran de l'Optimizer : ce que
// fait un geste sur le vrai écran (vrais hooks, vrais composants), quel que
// soit le composant qui porte le contrôle. Elles remplacent les lectures du
// texte d'`OptimizerSection` qui épinglaient l'endroit où un contrôle était
// écrit : un contrôle peut changer de composant, son effet doit rester.
import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
import { buildOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP } from '../../src/lib/damage';
import { AVERTISSEMENT_CRIT_MOYENNE } from '../../src/lib/optimizerRecipe';

export interface BancEcran {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
  troisieme: ExclusionSelector;
  // Le panneau « Options » du téléphone, tenu par le banc comme par App.tsx.
  menuOuvert: () => boolean;
  fermerMenu: () => void;
  // Un résultat de recherche posé à la main (le banc n'a pas le Worker de la recherche).
  forcerRecherche: (r: Record<string, unknown> | null) => void;
}
type Preuves = [boolean, string][];

const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
const telephone = () => innerWidth < 1024;
const bouton = (nom: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button:not([role="switch"])')]
  .find((e) => visible(e) && (e.textContent?.trim() === nom || e.getAttribute('aria-label') === nom));
const interrupteur = (nom: string) => [...document.querySelectorAll<HTMLButtonElement>('button[role="switch"]')]
  .find((e) => visible(e) && e.getAttribute('aria-label') === nom);
const texteVisible = (morceau: string) => [...document.querySelectorAll<HTMLElement>('div, p, section')]
  .some((e) => visible(e) && (e.textContent ?? '').includes(morceau));

export const COMPTER = "Compter les effets d'auras Tolerance et Précision dans les conditions";
export const VERIFIER = 'Vérifier toutes les combinaisons trouvées';
// Réglage retiré de l'écran : ni interrupteur, ni effet des paliers Haut et Extrême.
const PRIORISER = 'Prioriser les stats les plus difficiles';
const RAPPEL = 'Pense à vérifier les sets d\'aura externes.';

// Le cadre d'attention de l'interrupteur des auras : le bloc qui contient
// son libellé et l'interrupteur, et rien d'autre.
const cadreCompter = () => interrupteur(COMPTER)?.parentElement?.parentElement ?? null;

// Au bureau, « Réglages avancés » et les sets d'aura vivent en ligne dans la
// colonne repliable « Aura, exclusion, avancés », ouverte par son onglet.
const ONGLET_COMPLEMENTS = 'Aura, exclusion, avancés';
const ongletComplements = () => [...document.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Colonnes repliables"] button')]
  .find((e) => e.textContent?.trim() === ONGLET_COMPLEMENTS);
const colonneComplementsOuverte = () => ongletComplements()?.getAttribute('aria-pressed') === 'true';
async function ouvrirReglages(b: BancEcran) {
  if (telephone()) return; // au doigt, le panneau est ouvert par la guidance ou par le banc
  if (!colonneComplementsOuverte()) await b.geste(() => ongletComplements()!.click());
}
async function fermerSurfaces(b: BancEcran) {
  if (b.menuOuvert()) await b.geste(() => b.fermerMenu());
  if (!telephone() && colonneComplementsOuverte()) await b.geste(() => ongletComplements()!.click());
}
// Au bureau, la grille des sets s'ouvre depuis la liste compacte du set.
async function ouvrirSets(b: BancEcran) {
  if (telephone()) return;
  const champ = [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((e) => visible(e) && (e.getAttribute('aria-label') ?? e.textContent ?? '').startsWith('Set de runes recherché'));
  if (champ && champ.getAttribute('aria-expanded') !== 'true') await b.geste(() => champ.click());
}

// « Réglages avancés » : les deux interrupteurs agissent sur l'état qu'ils
// affichent, leur aide s'ouvre, « Vérifier toutes… » suit l'optimisation
// d'artéfacts et l'interrupteur des auras reste rendu, en dernier.
export async function preuvesReglagesAvances(b: BancEcran, ouvrirMenu: () => void): Promise<Preuves> {
  const preuves: Preuves = [];
  if (telephone()) await b.geste(ouvrirMenu);
  await ouvrirReglages(b);
  const compter = interrupteur(COMPTER);
  preuves.push([!!compter && compter.getAttribute('aria-checked') === String(b.etat().compterAurasResPre),
    'interrupteur des auras visible, affichant `compterAurasResPre`']);
  if (!compter) return preuves;
  const avant = b.etat().compterAurasResPre;
  await b.geste(() => compter.click());
  preuves.push([b.etat().compterAurasResPre === !avant && interrupteur(COMPTER)?.getAttribute('aria-checked') === String(!avant),
    'clic : `compterAurasResPre` basculé, et l’interrupteur le montre']);
  await b.geste(() => interrupteur(COMPTER)!.click());
  preuves.push([b.etat().compterAurasResPre === avant, 'second clic : valeur d’origine']);

  const verifier = interrupteur(VERIFIER);
  preuves.push([!!verifier && b.etat().optimiserArtefacts, '« Vérifier toutes… » visible avec l’optimisation d’artéfacts']);
  if (verifier) {
    const v = b.etat().verifierToutesLesCombinaisons;
    await b.geste(() => verifier.click());
    preuves.push([b.etat().verifierToutesLesCombinaisons === !v, 'clic : `verifierToutesLesCombinaisons` basculé']);
    await b.geste(() => interrupteur(VERIFIER)!.click());
  }
  const aide = bouton(VERIFIER);
  if (aide) {
    await b.geste(() => aide.click());
    await attendre(250);
    preuves.push([['100 combinaisons sont confirmées', '300', 'toutes les combinaisons trouvées sont vérifiées', 'plusieurs minutes'].every(texteVisible),
      'aide de « Vérifier toutes… » : au-delà des confirmées, tout est vérifié, ce qui peut prendre plusieurs minutes']);
    const fermer = telephone() ? [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Fermer"]')].filter(visible).pop() : bouton(VERIFIER);
    if (fermer) await b.geste(() => fermer.click());
    await attendre(250);
  } else preuves.push([false, 'aide de « Vérifier toutes… » présente']);
  preuves.push([!!bouton(COMPTER), 'l’interrupteur des auras a son aide']);

  // « Prioriser les stats les plus difficiles » est retiré : ni interrupteur
  // ni aide, et Haut / Extrême n'activent plus que l'épuisement complet.
  preuves.push([!interrupteur(PRIORISER) && !bouton(PRIORISER) && !texteVisible(PRIORISER),
    `plus d’interrupteur « ${PRIORISER} », ni son aide`]);
  const presetAvant = b.etat().slotFilterPreset, epuisementAvant = b.etat().exhaustiveSearch;
  for (const [palier, cle] of [['Haut', 'haut'], ['Extrême', 'extreme']] as const) {
    await b.geste(() => b.etat().setExhaustiveSearch(false));
    const p = bouton(palier);
    if (!p) { preuves.push([false, `palier « ${palier} » visible`]); continue; }
    await b.geste(() => p.click());
    preuves.push([b.etat().slotFilterPreset === cle && b.etat().exhaustiveSearch && !b.etat().adaptiveTrancheWeighting,
      `« ${palier} » : épuisement complet activé, adaptiveTrancheWeighting reste faux (${b.etat().adaptiveTrancheWeighting})`]);
  }
  await b.geste(() => { b.etat().setSlotFilterPreset(presetAvant); b.etat().setExhaustiveSearch(epuisementAvant); });

  const ordre = () => [...document.querySelectorAll<HTMLButtonElement>('button[role="switch"]')].filter(visible).map((e) => e.getAttribute('aria-label'));
  const avecFile = ordre();
  await b.geste(() => b.etat().setOptimiserArtefacts(false));
  const sansFile = ordre();
  preuves.push([!sansFile.includes(VERIFIER) && avecFile.includes(VERIFIER), 'sans optimisation d’artéfacts : « Vérifier toutes… » masqué']);
  preuves.push([avecFile[avecFile.length - 1] === COMPTER && sansFile[sansFile.length - 1] === COMPTER,
    `l’interrupteur des auras, sans condition, en dernier (${JSON.stringify(sansFile.slice(-3))})`]);
  await b.geste(() => b.etat().setOptimiserArtefacts(true));
  return preuves;
}

// Ouverture guidée : choisir Accuracy comme set recherché, puis l'ajouter aux
// auras externes d'« État de mon monstre », ouvre la surface des réglages et
// colore le cadre de l'interrupteur, amené à l'écran, pendant trois secondes.
export async function preuvesGuidage(b: BancEcran): Promise<Preuves> {
  const preuves: Preuves = [];
  const surfaceOuverte = () => (telephone() ? b.menuOuvert() : colonneComplementsOuverte());
  const verifierGuidage = async (geste: string) => {
    await attendre(1300);
    const cadre = cadreCompter();
    const r = cadre?.getBoundingClientRect();
    preuves.push([surfaceOuverte(), `${geste} : la surface des réglages s’ouvre (${telephone() ? 'panneau « Options »' : 'colonne « Aura, exclusion, avancés »'})`]);
    preuves.push([!!cadre && cadre.classList.contains('border-warn') && cadre.classList.contains('bg-warn-soft'),
      `${geste} : le cadre de l’interrupteur passe au token d’attention`]);
    // Au bureau, la colonne fixe où il vit, pour lire un échec. Tolérance d'un
    // demi-pixel : aligné au bord, le cadre peut finir à une fraction près.
    const col = document.querySelector('[data-colonne="complements"]')?.getBoundingClientRect();
    preuves.push([!!r && r.top >= -0.5 && r.bottom <= innerHeight + 0.5, `${geste} : l’interrupteur est amené à l’écran (${r?.top} → ${r?.bottom} / ${innerHeight}`
      + `${col ? ` ; colonne ${Math.round(col.top)} → ${Math.round(col.bottom)}, page défilée de ${Math.round(scrollY)}` : ''})`]);
    await attendre(3100);
    const apres = cadreCompter();
    preuves.push([!!apres && apres.classList.contains('border-transparent') && !apres.classList.contains('border-warn'),
      `${geste} : surlignage effacé après trois secondes, cadre gardé (bord transparent)`]);
  };
  await fermerSurfaces(b);
  await ouvrirSets(b);
  const accuracy = bouton('Accuracy');
  preuves.push([!!accuracy && !b.etat().comboSets.includes('accuracy'), 'set Accuracy proposé, pas encore choisi']);
  if (!accuracy) return preuves;
  await b.geste(() => accuracy.click());
  preuves.push([b.etat().comboSets.includes('accuracy'), 'clic : Accuracy devient un set recherché']);
  await verifierGuidage('Accuracy choisi comme set recherché');

  await fermerSurfaces(b);
  await b.geste(() => b.etat().setDamageSetup({ ...b.etat().damageSetup,
    setsAuraExternes: [{ set: 'fight', nombre: 1 }, { set: 'determination', nombre: 1 }, { set: 'enhance', nombre: 1 }] }));
  // Au bureau, l'ajout vit dans la colonne même où le guidage mène : elle est
  // ouverte pour atteindre le bouton.
  await ouvrirReglages(b);
  const ajouter = bouton("Ajouter un set d'aura");
  preuves.push([!!ajouter && (telephone() ? !surfaceOuverte() : true), telephone() ? '« Ajouter un set d’aura » présent, surfaces fermées' : '« Ajouter un set d’aura » présent, dans sa colonne ouverte']);
  if (!ajouter) return preuves;
  await b.geste(() => ajouter.click());
  preuves.push([b.etat().damageSetup.setsAuraExternes?.some((a) => a.set === 'accuracy') === true, 'clic : Accuracy ajouté aux auras externes']);
  await verifierGuidage('Accuracy ajouté aux auras externes');
  return preuves;
}

// Rappel des auras au clic d'un membre de la liste de travail : le MÊME état
// rend deux messages, dans la boîte des auras et sous la liste, à place
// réservée (rien ne bouge quand ils paraissent).
export async function preuvesRappelDeuxRendus(b: BancEcran): Promise<Preuves> {
  const preuves: Preuves = [];
  await b.geste(() => b.etat().choisirMembre('a', b.troisieme));
  await b.geste(() => b.etat().setDamageSetup({ ...b.etat().damageSetup, setsAuraExternes: [{ set: 'fight', nombre: 2 }] }));
  await b.geste(() => b.etat().choisirMembre('a', b.premier));
  const pli = bouton('Gérer mes listes');
  if (pli?.getAttribute('aria-expanded') === 'false') await b.geste(() => pli.click());
  // Au bureau, la boîte des auras vit dans la colonne « Aura, exclusion, avancés ».
  await ouvrirReglages(b);
  const zone = [...document.querySelectorAll<HTMLElement>('[aria-label="Rapport des critères"]')].find(visible)!.parentElement!;
  const messages = () => [...document.querySelectorAll<HTMLElement>('p')].filter((e) => e.textContent?.trim() === RAPPEL);
  const dansZone = () => messages().find((e) => zone.contains(e));
  // La boîte des auras : « État de mon monstre » au téléphone, la carte des
  // sets d'aura de la colonne « Aura, exclusion, avancés » au bureau (qui
  // n'annonce plus : la page le fait, `annonces` plus bas).
  const dansBoite = () => messages().find((e) => !zone.contains(e) && !e.classList.contains('sr-only')
    && (!!e.closest('[aria-live="polite"]') || !!e.closest('section[aria-label="Sets d\'aura des autres monstres"]')));
  // Les régions `aria-live` qui exposent la phrase (texte présent, non masqué) :
  // une seule pendant le rappel, aucune hors rappel, à chaque format.
  const annonces = () => [...document.querySelectorAll<HTMLElement>('[aria-live="polite"]')]
    .filter((r) => (r.children.length ? [...r.querySelectorAll<HTMLElement>('p')] : [r])
      .some((p) => p.textContent?.trim() === RAPPEL && getComputedStyle(p).visibility !== 'hidden'));
  // Position relative à son conteneur : le clic change l'exemplaire affiché,
  // ce qui peut décaler la page entière — seul compte ce qui bouge AUTOUR du message.
  const relatif = (e: HTMLElement | undefined, cadre: HTMLElement | null | undefined) => {
    if (!e || !cadre) return null;
    const r = e.getBoundingClientRect(), c = cadre.getBoundingClientRect();
    return JSON.stringify([r.x - c.x, r.y - c.y, r.width, r.height]);
  };
  const lignes = [...zone.querySelectorAll<HTMLElement>('[role="button"]')];
  // Au bureau, le rappel de la zone C sort du flux : aucune place réservée
  // sous la liste, il paraît en surimpression au bas de la carte de la liste
  // (positionnée), dans ses bords. Ce qui ne doit pas bouger y est la carte
  // elle-même ; au téléphone, le message à sa place réservée.
  // La carte de la liste est le parent du rappel une fois paru ; avant, sa
  // place se relit dans le relevé de toutes les boîtes de la zone.
  const carteListe = () => dansZone()?.parentElement ?? undefined;
  const boitesAvant = new Map([zone, ...zone.querySelectorAll<HTMLElement>('div')].map((d) => [d, relatif(d, zone)]));
  const positions = (avantClic: boolean) => ({
    zone: telephone() ? relatif(dansZone(), zone)
      : avantClic ? null : (boitesAvant.get(carteListe()!) ?? null) === relatif(carteListe(), zone) ? 'carte immobile' : `carte déplacée ${relatif(carteListe(), zone)}`,
    boite: relatif(dansBoite(), dansBoite()?.parentElement?.parentElement),
  });
  const avant = positions(true);
  // La zone C ne lit le rappel qu'à un endroit : hors le message (sa classe au
  // téléphone, l'élément lui-même au bureau), rien d'autre n'y change quand il
  // paraît. Comparé après le clic, rappel affiché puis effacé : le clic
  // lui-même change l'exemplaire affiché (et le rapport des critères), le
  // rappel rien d'autre.
  const sansMessage = () => {
    const m = dansZone();
    if (!m) return zone.innerHTML;
    if (!telephone()) return zone.innerHTML.replace(m.outerHTML, '');
    const c = m.className; m.className = ''; const h = zone.innerHTML; m.className = c; return h;
  };
  preuves.push([telephone() ? !!dansZone() && !visible(dansZone()!) && !!dansBoite() && !visible(dansBoite()!)
    : !dansZone() && !!dansBoite() && !visible(dansBoite()!),
  telephone() ? 'hors rappel : les deux messages sont montés, invisibles (place réservée)'
    : 'hors rappel : la boîte des auras garde son message invisible ; sous la liste, rien n’est monté (aucune place réservée)']);
  preuves.push([annonces().length === 0, 'hors rappel : aucune région ne l’annonce']);
  const cible = lignes.find((e) => e.textContent?.includes('Premier') && e !== lignes[0]) ?? lignes[2];
  await b.geste(() => cible.click());
  await attendre(300); // l'apparition (200 ms) glisse le message de quelques pixels avant sa place
  const apres = positions(false);
  preuves.push([!!dansZone() && visible(dansZone()!), 'clic sur un autre exemplaire avec auras : rappel sous la liste']);
  // Le dessin : un seul contour warn de 1 px, texte warn ; fond warn-soft à
  // sa place réservée (téléphone), fond plein du panneau en surimpression
  // (bureau), pour rester lisible par-dessus les lignes.
  const cl = [...(dansZone()?.classList ?? [])];
  preuves.push([['border', 'border-warn', 'text-warn', telephone() ? 'bg-warn-soft' : 'bg-panel'].every((x) => cl.includes(x))
    && cl.filter((x) => /^border(-|$)/.test(x)).join(' ') === 'border border-warn' && !cl.some((x) => /^(ring|outline)/.test(x)),
  `rappel de la zone C : contour warn de 1 px, un seul, texte warn, ${telephone() ? 'fond warn-soft' : 'fond plein du panneau'} (${cl.join(' ')})`]);
  if (!telephone()) {
    const m = dansZone(), c = carteListe();
    const r = m?.getBoundingClientRect(), rc = c?.getBoundingClientRect();
    preuves.push([!!m && !!c && c.contains(m) && getComputedStyle(m).position === 'absolute' && getComputedStyle(m).pointerEvents === 'none'
      && !!r && !!rc && r.left >= rc.left && r.right <= rc.right && r.bottom <= rc.bottom && r.top >= rc.top,
    `au bureau : rappel en surimpression au bas de la carte de la liste, dans ses bords, sans recevoir de clic (${JSON.stringify([r, rc])})`]);
  }
  preuves.push([!!dansBoite() && visible(dansBoite()!), `… et dans la boîte des auras (${telephone() ? '« État de mon monstre »' : 'colonne « Aura, exclusion, avancés »'})`]);
  preuves.push([(telephone() ? avant.zone !== null && avant.zone === apres.zone : apres.zone === 'carte immobile')
    && avant.boite !== null && avant.boite === apres.boite,
    telephone() ? `les deux messages paraissent à leur place réservée, rien ne bouge (${JSON.stringify([avant, apres])})`
      : `le message de la boîte paraît à sa place réservée, la carte de la liste garde sa place et sa taille (${JSON.stringify([avant, apres])})`]);
  preuves.push([annonces().length === 1, `pendant le rappel : une seule région l’annonce (${annonces().length})`]);
  const avecRappel = sansMessage();
  await attendre(3100);
  preuves.push([(telephone() ? !!dansZone() && !visible(dansZone()!) : !dansZone()) && sansMessage() === avecRappel,
    telephone() ? 'zone C : rappel effacé après trois secondes, et seul le message a changé — rien d’autre n’y est monté sous sa condition'
      : 'zone C : rappel démonté après trois secondes, et seul le message a changé — rien d’autre n’y est monté sous sa condition']);
  if (!telephone()) {
    // Au bureau, colonne « Aura, exclusion, avancés » FERMÉE (la carte des
    // auras démontée) : le rappel s'annonce encore, hors de la colonne.
    // Le rappel revient en revenant à `cible` (qui porte des auras) depuis
    // un autre membre, une fois l'éventuel rappel de ce détour effacé.
    await fermerSurfaces(b);
    const autre = lignes.find((e) => e !== cible) ?? lignes[0];
    await b.geste(() => autre.click());
    await attendre(3100);
    await b.geste(() => cible.click());
    await attendre(300);
    const regions = annonces();
    preuves.push([!colonneComplementsOuverte() && regions.length === 1 && !regions[0].closest('[data-colonne]'),
      `colonne fermée : le rappel s’annonce, une fois, hors de la colonne (${regions.length})`]);
    await attendre(3100);
  }
  return preuves;
}

// Sélecteur de listes : choisir, créer et supprimer une liste à l'écran ne
// remettent jamais la recherche à zéro (ni monstre, ni exemplaire changés).
export async function preuvesListesEcran(b: BancEcran): Promise<Preuves> {
  const preuves: Preuves = [];
  const pli = bouton('Gérer mes listes');
  if (pli?.getAttribute('aria-expanded') === 'false') await b.geste(() => pli.click());
  const garde = () => JSON.stringify([b.etat().selectedId, b.etat().sourceSelector]);
  const avant = garde();
  const listeActive = () => [...document.querySelectorAll('p')].find((e) => visible(e) && e.textContent === 'Liste active')!
    .parentElement!.querySelector<HTMLButtonElement>('button')!;
  const ouvrir = async () => { if (listeActive().getAttribute('aria-expanded') !== 'true') await b.geste(() => listeActive().click()); };
  const ligne = (nom: string) => [...document.querySelectorAll<HTMLElement>('[role="button"]')]
    .find((e) => visible(e) && e.textContent?.trim().startsWith(`${nom} - `));
  await ouvrir();
  const beta = ligne('Bêta');
  preuves.push([!!beta, 'la liste Bêta est proposée']);
  if (!beta) return preuves;
  await b.geste(() => beta.click());
  preuves.push([b.listes().activeListId === 'b' && garde() === avant, 'choisir une liste : active, sans remise à zéro']);
  await ouvrir();
  await b.geste(() => bouton('Supprimer cette liste', ligne('Bêta')!.parentElement!)!.click());
  await attendre(250);
  const confirmation = document.querySelector<HTMLElement>('[role="dialog"]');
  if (confirmation) await b.geste(() => bouton('Supprimer', confirmation)!.click());
  preuves.push([!b.listes().lists.some((l) => l.id === 'b') && garde() === avant, 'supprimer une liste : retirée, sans remise à zéro']);
  await ouvrir();
  await b.geste(() => bouton('Nouvelle liste…')!.click());
  await attendre(250);
  const dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const menu = dialogue.querySelector<HTMLSelectElement>('[aria-label="Contenu de la liste"]')!;
  await b.geste(() => { menu.value = 'arene'; menu.dispatchEvent(new Event('change', { bubbles: true })); });
  const nombre = b.listes().lists.length;
  await b.geste(() => bouton('Créer', dialogue)!.click());
  preuves.push([b.listes().lists.length === nombre + 1 && b.listes().listContents.get(b.listes().activeListId!) === 'arene' && garde() === avant,
    'créer une liste : créée avec son contenu et active, sans remise à zéro']);
  return preuves;
}

// Une vraie recherche (Second, six runes Energy) : l'infobulle de l'en-tête
// dit ce qu'est une combinaison confirmée et renvoie à « Vérifier toutes… ».
export async function preuvesResultats(b: BancEcran): Promise<Preuves> {
  const preuves: Preuves = [];
  await b.geste(() => b.etat().choisirMembre('a', b.second));
  // Le build des six runes de Second, rendu comme le moteur l'aurait trouvé ;
  // la file le vérifie (repli sans Worker), comme après une vraie recherche.
  const candidat = { runeIds: [101, 102, 103, 104, 105, 106], effTotal: 0,
    stats: [{ key: 'atk', label: 'ATQ', suffix: '', base: 800, bonus: 0, total: 800 }] };
  await b.geste(() => b.forcerRecherche({ status: 'done', progress: null,
    result: { candidates: [candidat], explored: 1, truncated: false, nearMissByCondition: [], globalNearMiss: null } }));
  const entete = () => [...document.querySelectorAll<HTMLElement>('p')]
    .find((e) => visible(e) && /^\d[\d\s ]* combinaison\(s\) confirmée\(s\)$/.test(e.textContent?.trim() ?? ''));
  for (let t = 0; t < 100 && !/^[1-9]/.test(entete()?.textContent?.trim() ?? ''); t++) await attendre(100);
  preuves.push([/^1 combinaison/.test(entete()?.textContent?.trim() ?? ''), `résultat vérifié : « 1 combinaison(s) confirmée(s) » (${entete()?.textContent})`]);
  const aide = bouton('Combinaisons confirmées');
  preuves.push([!!aide, 'file active : l’infobulle « Combinaisons confirmées »']);
  if (!aide) return preuves;
  await b.geste(() => aide.click());
  await attendre(250);
  const bulle = [...document.querySelectorAll<HTMLElement>('div')].filter(visible)
    .map((e) => e.textContent ?? '').filter((t) => t.includes('optimiste')).sort((x, y) => x.length - y.length)[0] ?? '';
  preuves.push([/confirmée/.test(bulle) && /trouvée\(s\)/.test(bulle) && /optimiste/.test(bulle) && /écartée/.test(bulle),
    'infobulle : la différence avec les trouvées (estimation optimiste, une partie écartée à la vérification)']);
  preuves.push([/Vérifier toutes\s+les combinaisons trouvées/.test(bulle), 'infobulle : renvoie à « Vérifier toutes les combinaisons trouvées »']);
  await b.geste(() => aide.click());

  // Le même build, écarté par la vérification (condition que ses pièces réelles
  // ne tiennent pas) : « Aucune combinaison… », la ligne de raison dessous,
  // sans « Adapter… » ni « Trier par ».
  await b.geste(() => b.forcerRecherche(null));
  await b.geste(() => b.etat().setMinStats({ spd: 999 }));
  await b.geste(() => b.forcerRecherche({ status: 'done', progress: null,
    result: { candidates: [candidat], explored: 1, truncated: false, nearMissByCondition: [], globalNearMiss: null } }));
  const aucune = () => [...document.querySelectorAll<HTMLElement>('p')].find((e) => visible(e) && e.textContent?.trim() === 'Aucune combinaison ne répond à ces critères');
  for (let t = 0; t < 100 && !aucune(); t++) await attendre(100);
  const raison = [...document.querySelectorAll<HTMLElement>('p')].find((e) => visible(e) && e.textContent?.includes('a été écartée'));
  preuves.push([!!aucune(), 'build écarté à la vérification : « Aucune combinaison ne répond à ces critères »']);
  preuves.push([raison?.textContent?.trim() === "1 combinaison trouvée par la recherche a été écartée : aucune paire d'artéfacts réelle ne tient toutes les conditions.",
    `… et la ligne de raison dessous (${raison?.textContent})`]);
  preuves.push([!interrupteur('Adapter les artéfacts et reliques au tri') && ![...document.querySelectorAll('select')].some((e) => visible(e) && e.textContent?.includes('Trier par')),
    '… sans « Adapter… » ni « Trier par »']);

  // Pendant l'appariement, la ligne de progression compte les trouvées moins
  // les écartées (`compteAffichable`), pas le compte brut du moteur.
  await b.geste(() => b.forcerRecherche(null));
  await b.geste(() => b.forcerRecherche({ status: 'running', result: null,
    progress: { phase: 'pairing', explored: 10, found: 5, pct: 0.1, totalPairs: 100, candidates: [candidat] } }));
  const ligne = () => [...document.querySelectorAll<HTMLElement>('p')].find((e) => visible(e) && e.textContent?.includes('combinaisons examinées'))?.textContent ?? '';
  for (let t = 0; t < 100 && !ligne().includes('4 trouvée(s)'); t++) await attendre(100);
  preuves.push([ligne() === '10 / 100 combinaisons examinées · 4 trouvée(s)', `appariement : 5 trouvées, 1 écartée → « 4 trouvée(s) » (${ligne()})`]);
  return preuves;
}

// Message d'import d'une recette : sa couleur suit le message (token d'avertissement
// quand le parseur a converti quelque chose, de succès sinon).
export async function preuvesMessageImport(b: BancEcran): Promise<Preuves> {
  const preuves: Preuves = [];
  const recette = (critMode: string) => {
    const r = buildOptimizerRecipe({ monsterCom2usId: 10101, monsterName: 'Premier', damageSetup: DEFAULT_DAMAGE_SETUP,
      requirement: { sets: [], minStats: {} }, objective: 'efficience', metric: 'eff', slotFilterPreset: 'moyen',
      adaptiveTrancheWeighting: false, exhaustiveSearch: false, excludeUsedRunes: false, excludeUsedScope: 'box',
      excludedSelectors: [], ignoreArtifacts: false, artifactMainByKind: {} });
    return JSON.stringify({ ...r, damageSetup: { ...r.damageSetup, critMode } });
  };
  const importer = async (texte: string) => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const fichiers = new DataTransfer(); fichiers.items.add(new File([texte], 'recette.json', { type: 'application/json' }));
    await b.geste(() => { input.files = fichiers.files; input.dispatchEvent(new Event('change', { bubbles: true })); });
    await attendre(100); await b.geste(() => {});
    return [...document.querySelectorAll<HTMLElement>('p[role="status"]')].find((e) => visible(e) && e.textContent?.includes('Recette'))
      ?? [...document.querySelectorAll<HTMLElement>('p[role="status"]')].filter(visible).pop();
  };
  const ordinaire = await importer(recette('crit'));
  preuves.push([!!ordinaire && ordinaire.classList.contains('text-good') && !ordinaire.textContent?.includes(AVERTISSEMENT_CRIT_MOYENNE),
    `import ordinaire : message au token de succès (${ordinaire?.className} · ${ordinaire?.textContent})`]);
  const converti = await importer(recette('moyenne'));
  preuves.push([!!converti && converti.classList.contains('text-warn') && !!converti.textContent?.includes(AVERTISSEMENT_CRIT_MOYENNE),
    `import converti : message au token d’avertissement, qui cite la conversion (${converti?.className})`]);
  // Une recette qui porte l'ancien réglage à vrai s'importe comme une autre
  // et n'active rien.
  const priorite = await importer(JSON.stringify({ ...JSON.parse(recette('crit')), adaptiveTrancheWeighting: true }));
  preuves.push([!!priorite && priorite.classList.contains('text-good') && !b.etat().adaptiveTrancheWeighting,
    `import d’une recette qui porte adaptiveTrancheWeighting à vrai : succès, l’état reste faux (${priorite?.className} · ${b.etat().adaptiveTrancheWeighting})`]);
  const refus = await importer('{');
  preuves.push([!!refus && refus.classList.contains('text-bad'), `import refusé : message au token d’erreur (${refus?.className})`]);

  // Ce que l'écran ENVOIE, quoi que porte l'état (une session reprise peut
  // encore le poser à vrai, le champ restant dans `OptimizerState`) : la
  // recherche (message au Worker, intercepté) et la recette exportée (fichier
  // intercepté) portent `adaptiveTrancheWeighting: false`.
  const envois: Record<string, unknown>[] = [];
  let fichier: Blob | null = null;
  const vraiWorker = globalThis.Worker, vraiCreer = URL.createObjectURL, vraiClic = HTMLAnchorElement.prototype.click;
  class FauxWorker {
    onmessage: unknown = null; onerror: unknown = null;
    postMessage(d: Record<string, unknown>) { envois.push(d); }
    terminate() {} addEventListener() {} removeEventListener() {}
  }
  try {
    (globalThis as unknown as { Worker: unknown }).Worker = FauxWorker;
    URL.createObjectURL = (b: Blob | MediaSource) => { fichier = b as Blob; return 'blob:recette'; };
    HTMLAnchorElement.prototype.click = () => {};
    await b.geste(() => { b.etat().setComboSets(['violent']); b.etat().setAdaptiveTrancheWeighting(true); });
    const rechercher = bouton('Rechercher');
    if (rechercher) await b.geste(() => rechercher.click());
    const recherche = envois.find((d) => 'pool' in d);
    preuves.push([!!recherche && recherche.adaptiveTrancheWeighting === false,
      `état à vrai : la recherche part avec adaptiveTrancheWeighting faux (${recherche ? String(recherche.adaptiveTrancheWeighting) : 'aucun envoi'})`]);
    const exporter = bouton('Exporter les paramètres de recherche');
    if (exporter) await b.geste(() => exporter.click());
    const recetteExportee = fichier ? JSON.parse(await (fichier as Blob).text()) as Record<string, unknown> : null;
    preuves.push([recetteExportee?.adaptiveTrancheWeighting === false,
      `état à vrai : la recette exportée porte adaptiveTrancheWeighting faux (${recetteExportee ? String(recetteExportee.adaptiveTrancheWeighting) : 'aucun fichier'})`]);
  } finally {
    (globalThis as unknown as { Worker: unknown }).Worker = vraiWorker;
    URL.createObjectURL = vraiCreer;
    HTMLAnchorElement.prototype.click = vraiClic;
    await b.geste(() => b.etat().setAdaptiveTrancheWeighting(false));
  }
  return preuves;
}
