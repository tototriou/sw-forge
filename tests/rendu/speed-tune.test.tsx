// Tests de rendu — Outils · Speed tuning (`SpeedTuningSection`). Principe dans
// tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et
// chaque information sont présentes, jamais l'apparence. Écrits AVANT le lot 9b
// de la refonte graphique (`spec/chantiers/refonte-graphique.md` § B.5 à
// B.10) : ils doivent rester verts sans qu'une assertion change.
//
// ⚠️ Rendu serveur : les kits (`public/data/skills`) se chargent dans un
// effet, qui ne tourne pas. « Ordre des sorts » reste donc vide et l'analyse
// n'est pas lancée ; ce qui en dépend est couvert par `tests/speed-tune.test.ts`.

import SpeedTuningSection from '../../src/components/outils/SpeedTuningSection';
import { leadPresent, ligneVierge, type Ligne } from '../../src/lib/speedTuneLignes';
import type { Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { boutons, rendre, texteVisible, valeurs } from './outils-rendu';

const MONSTRES = monstersJson() as Monster[];
const monstre = (nom: string, el: string) =>
  MONSTRES.filter((m) => m.name === nom && m.element === el && m.com2usId != null).sort(
    (a, b) => (a.stats.speed ?? 0) - (b.stats.speed ?? 0),
  )[0];

// ⚠️ **L'état de l'outil vit dans le magasin de `useStickyState`**, privé au
// module et rempli par un effet — qui ne tourne pas en rendu serveur. Le
// modifier pour l'exposer toucherait `src/hooks/`, interdit à la refonte
// (A.2). On intercepte donc, LE TEMPS DU RENDU seulement, la lecture de ce
// magasin : `Map.prototype.has`/`get` répondent pour les clés fournies, et
// laissent passer toutes les autres (React s'en sert aussi).
function avecEtat<T>(etat: Record<string, unknown>, faire: () => T): T {
  const has = Map.prototype.has;
  const get = Map.prototype.get;
  Map.prototype.has = function (this: Map<unknown, unknown>, k: unknown) {
    return (typeof k === 'string' && k in etat) || has.call(this, k);
  };
  Map.prototype.get = function (this: Map<unknown, unknown>, k: unknown) {
    return typeof k === 'string' && k in etat ? etat[k] : get.call(this, k);
  };
  try {
    return faire();
  } finally {
    Map.prototype.has = has;
    Map.prototype.get = get;
  }
}

const ligne = (nom: string, el: string, camp: 'allie' | 'ennemi', extra: Partial<Ligne> = {}): Ligne => ({
  ...ligneVierge(monstre(nom, el), camp),
  ...extra,
});

// Trois alliés, dont deux en Swift ; en face, un Lushen ; une case de barre et
// un buff posés à la main, un artéfact de buff, un monstre masqué.
export const LIGNES: Ligne[] = [
  ligne('Galleon', 'water', 'allie', { runeSpeed: 180, swift: true, speedMod: { 3: 30 } }),
  ligne('Veromos', 'dark', 'allie', { runeSpeed: 150, swift: true, atbMod: { 2: 20 } }),
  ligne('Belladeon', 'light', 'allie', { runeSpeed: 120, artefactBuff: 8 }),
  ligne('Chasun', 'wind', 'allie', { runeSpeed: 100, masque: true }),
  ligne('Lushen', 'wind', 'ennemi', { runeSpeed: 130 }),
];

export function rendreSpeedTune(etat: Record<string, unknown> = {}): string {
  faussLocalStorage({});
  return avecEtat(etat, () =>
    rendre(<SpeedTuningSection allMonsters={MONSTRES} siegeDefenseTeams={[]} siegeOffenseTeams={[]} />),
  );
}

const ETAT_EQUIPE = () => ({
  'speedTune.lignes': LIGNES,
  'speedTune.leadAllie': leadPresent(LIGNES, 'allie'),
  'speedTune.leadChoisi': { allie: true, ennemi: true },
});

// La valeur du champ nommé `nom` (aria-label), ou null. L'apostrophe est
// encodée dans le HTML (`&#x27;`).
function valeurChamp(html: string, nom: string): string | null {
  const attr = `aria-label="${nom.replace(/'/g, '&#x27;')}"`;
  const balise = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]).find((b) => b.includes(attr));
  return balise?.match(/\svalue="([^"]*)"/)?.[1] ?? null;
}

const LEADS =
  'Sans +33% +28% +24% +21% +19% +17% +16% +15% +10% +30% · Ténèbres +23% · Ténèbres +30% · Feu +23% · Feu +30% · Lumière +23% · Lumière +30% · Eau +23% · Eau +30% · Vent +23% · Vent';
const IMPORT_VIDE = 'Aucune équipe de siège enregistrée — importe ton compte, ou compose une défense / offense dans Siège.';

export function testRenduSpeedTuneVide() {
  titre('rendu · Speed tuning — sans monstre');
  const html = rendreSpeedTune();
  const t = texteVisible(html);
  const b = boutons(html);
  ok(t.startsWith('Speed tuning À chaque tick, la barre d\'action monte de vitesse × 7 % ; un seul monstre agit par tick. Ajoute tes monstres et ceux d\'en face pour voir qui joue avant qui.'), 'le titre et la règle des ticks');
  ok(t.includes('Vitesse de combat pour agir au tick · repère de speed tune 3 477 4 358 5 286 6 239 7 205 8 179 9 159 10 143 11 130'), 'le repère des ticks, du 3 au 11');
  ok(t.includes(`Ton équipe Lead ${LEADS}`) && t.includes(`En face Lead ${LEADS}`), 'deux camps, chacun avec tous les leads');
  const aria = valeurs(html, 'aria-label');
  ok(aria.includes('Lead de vitesse — Ton équipe') && aria.includes('Lead de vitesse — En face'), 'le lead de chaque camp est nommé');
  const places = valeurs(html, 'placeholder');
  ok(places.includes('Ajouter un monstre à ton équipe…') && places.includes('Ajouter un monstre adverse…'), 'une recherche d\'ajout par camp');
  const imports = b.filter((x) => x.texte === 'Importer un deck de siège');
  egal(imports.length, 2, '« Importer un deck de siège » dans chaque camp');
  ok(imports.every((x) => x.desactive && x.title === IMPORT_VIDE), 'désactivé sans équipe de siège, et pourquoi');
  ok(t.endsWith('Ajoute au moins un monstre pour visualiser le remplissage des barres et l\'ordre de tour.'), 'ce qu\'il faut faire pour voir les tableaux');
}

export function testRenduSpeedTuneCamps() {
  titre('rendu · Speed tuning — les deux camps');
  const html = rendreSpeedTune(ETAT_EQUIPE());
  const t = texteVisible(html);
  const b = boutons(html);
  const nomme = (n: string) => b.find((x) => x.ariaLabel === n);
  ok(t.includes('Ton équipe Lead +24%') && valeurs(html, 'title').includes('Lead du leader : +24% VIT'), 'le lead d\'équipe, et d\'où il vient');
  for (const carte of [
    'Galleon base 108 Runes Set SPD buff effect 331 combat',
    'Veromos base 100 Runes Set SPD buff effect 289 combat',
    'Belladeon base 108 Runes Set SPD buff effect 271 combat',
    'Chasun base 101 Runes Set SPD buff effect 241 combat',
    'Lushen base 103 Runes Set SPD buff effect 249 combat',
  ]) ok(t.includes(carte), `card : « ${carte} »`);
  for (const [nom, runes] of [['Galleon', '180'], ['Veromos', '150'], ['Belladeon', '120'], ['Lushen', '130']])
    egal(valeurChamp(html, `Vitesse des runes de ${nom}`), runes, `vitesse des runes de ${nom}`);
  egal(valeurChamp(html, 'Bonus d\'artéfact au buff de vitesse de Belladeon'), '8', 'bonus d\'artéfact de Belladeon');
  ok(valeurs(html, 'title').includes('Bonus d\'artéfact « Effet aug. VIT » — s\'ajoute au buff de vitesse quand il est actif. Repris tel quel d\'un deck importé ou de l\'adversaire de référence.'), 'le bonus d\'artéfact expliqué');
  ok(nomme('Set Rapidité porté par Galleon')?.presse === true && nomme('Set Rapidité porté par Belladeon')?.presse === false, 'Swift : porté ou non');
  ok(nomme('Set Rapidité porté par Galleon')?.title === 'Le monstre porte le set Rapidité (VIT +25 %) — sa vitesse de combat se calcule alors autrement (d\'un point près).', 'Swift expliqué');
  ok(nomme('Galleon joue déjà en premier à vitesse égale')?.desactive === true, 'le premier ne monte pas, et pourquoi');
  ok(nomme('Chasun joue déjà en dernier à vitesse égale')?.desactive === true, 'le dernier ne descend pas, et pourquoi');
  ok(!!nomme('Monter Veromos : à vitesse égale, il jouera avant') && !!nomme('Descendre Veromos : à vitesse égale, il jouera après'), 'monter / descendre, et ce que ça change');
  ok(nomme('Masquer Galleon')?.presse === false && nomme('Afficher Chasun')?.presse === true, 'masquer / afficher');
  ok(!!nomme('Copier Galleon en face') && !!nomme('Copier Lushen dans ton équipe'), 'copier dans l\'autre camp');
  for (const nom of ['Galleon', 'Veromos', 'Belladeon', 'Chasun', 'Lushen']) ok(!!nomme(`Retirer ${nom}`), `retirer ${nom}`);
  egal(b.filter((x) => x.ariaLabel === 'Augmenter').length, 10, 'runes et artéfact : un « Augmenter » par champ');
}

export function testRenduSpeedTuneAnalyse() {
  titre('rendu · Speed tuning — ordre des sorts, analyse, tableaux');
  const html = rendreSpeedTune(ETAT_EQUIPE());
  const t = texteVisible(html);
  const b = boutons(html);
  const afficher = b.find((x) => x.texte === 'Afficher');
  ok(t.includes('Ordre des sorts Afficher Ajoute des monstres à ton équipe pour composer un ordre.'), '« Ordre des sorts » et son état sans kit');
  egal(afficher?.title ?? null, 'Replie la liste pour gagner de la place. ⚠️ Les sorts déjà choisis continuent de compter : refermer ne défait rien.', '« Afficher » et ce qu\'il ne défait pas');
  ok(b.find((x) => x.texte === 'Analyser')?.title === 'Lit les kits et POSE le résultat dans les grilles, comme si tu les remplissais à la main. Ensuite tout est modifiable : l\'analyse ne repasse plus, sauf si tu changes un sort.', '« Analyser » et ce qu\'il écrit');
  ok(t.includes('Barre d\'action par tick · % rempli sur 40 ticks — la case surlignée = ce monstre prend le tour (la barre repart de 0)'), 'le tableau des barres, et comment le lire');
  ok(t.includes('Veromos 20.230 %/tick 20.230 60.460 80.690 100.920 1'), 'la barre au millième, la case saisie comptée (+20 au tick 2), le rang du tour');
  ok(t.includes('Lushen adv 17.430 %/tick'), 'l\'adversaire marqué');
  ok(!/Chasun \d/.test(t.split('Barre d\'action par tick')[1]), 'le monstre masqué quitte les tableaux');
  ok(t.includes('Ton équipe agit Adversaire agit Un seul monstre par tick ; le numéro donne l\'ordre des tours.'), 'la légende du tableau');
  ok(t.includes('Modification de barre d\'attaque · à un tick précis : +% pour remplir, −% pour vider la barre (jamais sous 0) — l\'analyse écrit ici, tu corriges par-dessus'), 'la grille des barres, et ce qu\'on y saisit');
  ok(t.includes('Buff de vitesse · icône SPD = buff +30 % d\'un clic, ou saisis une valeur — l\'analyse écrit ici, tu corriges par-dessus'), 'la grille des buffs, et ce qu\'on y saisit');
  const aria = valeurs(html, 'aria-label');
  ok(aria.includes('Toute ton équipe — tick 1') && aria.includes('Tout en face — tick 1') && aria.includes('Lushen — tick 40'), 'une case par camp et par monstre, sur les 40 ticks');
  ok(aria.includes('Veromos — tick 2'), 'la case saisie existe');
  ok(b.find((x) => x.ariaLabel === 'Galleon — tick 3 — buff +30 %')?.presse === true, 'le buff +30 % posé, enclenché');
  ok(b.find((x) => x.ariaLabel === 'Toute ton équipe — tick 1 — buff +30 %')?.presse === false, 'le buff d\'un clic pour tout le camp');
  ok(t.endsWith('Ordre de tour 1 Veromos tick 4 → 2 Galleon tick 5 → 3 Belladeon tick 6 → 4 Lushen tick 7'), 'l\'ordre de tour, rang et tick');
}
