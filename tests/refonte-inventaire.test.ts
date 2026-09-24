// Garde-fous de la refonte graphique — lot 0 de
// `spec/chantiers/refonte-graphique.md` (B.0). La refonte change l'affichage,
// jamais ce qui existe : ces vérifications refusent qu'une information ou une
// fonctionnalité visible disparaisse sans déplacement déclaré ni décision de
// Thomas, et qu'un lot touche la logique, les données ou les rendus du jeu.
//
// ⚠️ L'EXTRACTION tourne dans un processus à part (`scripts/inventaire-ui.mjs`) :
// elle a besoin du compilateur TypeScript, qu'on n'embarque pas dans le paquet
// des tests. La COMPARAISON, pure, est testée directement.

import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { comparer, decisionsRetrait } from '../scripts/lib/inventaire-comparer.mjs';
import { interdits } from '../scripts/chemins-interdits.mjs';
import { egal, ok, titre } from './outils';

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function lancer(args: string[]): { code: number | null; sortie: string } {
  const r = spawnSync(process.execPath, [resolve(RACINE, 'scripts/inventaire-ui.mjs'), ...args], {
    cwd: RACINE,
    encoding: 'utf8',
  });
  return { code: r.status, sortie: r.stdout };
}

// Le vrai dépôt : rien de la référence figée n'a disparu.
export function testRefonteInventaire() {
  titre('refonte-inventaire · le dépôt réel ne perd aucune entrée visible');
  const { code, sortie } = lancer(['--verifier', '--json']);
  const r = JSON.parse(sortie);
  ok(code === 0 && r.ok, `aucune perte — ${r.manquants.length} perdue(s), ${r.deplacementsNonFaits.length} déplacement(s) non fait(s), ${r.retraitsNonDecides.length} retrait(s) non décidé(s), ${r.orphelins.length} orphelin(s)`);
  for (const m of r.manquants.slice(0, 10)) ok(false, `perdu : ${m.fichier} :: ${m.entree}`);
}

// L'extracteur relève ce qui s'affiche, et seulement ça.
export function testRefonteInventaireExtraction() {
  titre('refonte-inventaire · extraction sur fixture (vu / ignoré)');
  const { code, sortie } = lancer(['--fichier', 'tests/fixtures/refonte-inventaire/exemple.tsx']);
  ok(code === 0, 'extraction de la fixture sans erreur');
  const e: string[] = JSON.parse(sortie);
  for (const vu of [
    'texte:Texte affiché',
    'attr:title:Infobulle',
    'attr:aria-label:Fermer le panneau',
    'attr:aria-label:Ouvrir le panneau',
    'texte:Replier',
    'texte:Déplier',
    'texte:Seulement ouvert',
    'texte:Prépa',
    'route:#/siege/defense',
    'route:#/rta',
    'prop:label:Ma prépa',
    'message:Fichier importé',
    'attr:placeholder:Rechercher {…}…',
    "texte:L'apostrophe décodée",
  ]) {
    ok(e.includes(vu), `relevé : ${vu}`);
  }
  for (const pasVu of ['bg-panel text-ink', 'bg-bg', 'accueil', 'rta', 'appel ignoré', 'ignore-moi', 'flex gap-2']) {
    ok(!e.some((x) => x.endsWith(':' + pasVu)), `ignoré : ${pasVu}`);
  }
  const deux = lancer(['--fichier', 'tests/fixtures/refonte-inventaire/exemple.tsx']);
  ok(deux.sortie === sortie, 'déterministe : deux extractions, même octet');
}

// La comparaison : chaque cas accepté ou refusé par A.6, dont les refus.
export function testRefonteInventaireComparer() {
  titre('refonte-inventaire · comparaison — acceptations et refus');
  const ref = { 'src/A.tsx': ['texte:Garder', 'texte:Déplacé', 'texte:Retiré'], 'src/B.tsx': ['texte:Rien'] };

  const identique = comparer(ref, ref, {}, new Set());
  ok(identique.ok, 'inventaire identique : accepté');

  const ajout = comparer(ref, { ...ref, 'src/A.tsx': [...ref['src/A.tsx'], 'texte:Nouveau'] }, {}, new Set());
  ok(ajout.ok, 'entrée nouvelle : acceptée (ajouter n\'efface rien)');

  const perte = comparer(ref, { 'src/A.tsx': ['texte:Garder', 'texte:Déplacé', 'texte:Retiré'], 'src/B.tsx': [] }, {}, new Set());
  ok(!perte.ok, 'entrée disparue sans déclaration : REFUSÉ');
  egal(perte.manquants, [{ fichier: 'src/B.tsx', entree: 'texte:Rien' }], 'la perte est nommée (fichier et entrée)');

  const courant = { 'src/A.tsx': ['texte:Garder'], 'src/B.tsx': ['texte:Rien'], 'src/C.tsx': ['texte:Déplacé'] };
  const dep = {
    'src/A.tsx :: texte:Déplacé': { de: 'src/A.tsx', vers: 'src/C.tsx' },
    'src/A.tsx :: texte:Retiré': { de: 'src/A.tsx', retrait: 'A.2 bis #3' },
  };
  ok(comparer(ref, courant, dep, new Set([3])).ok, 'déplacement fait + retrait décidé (#3) : accepté');

  const nonFait = comparer(ref, { ...courant, 'src/C.tsx': [] }, dep, new Set([3]));
  ok(!nonFait.ok && nonFait.deplacementsNonFaits.length === 1, 'déplacement déclaré mais introuvable dans « vers » : REFUSÉ');

  const nonDecide = comparer(ref, courant, dep, new Set([4]));
  ok(!nonDecide.ok && nonDecide.retraitsNonDecides.length === 1, 'retrait dont le numéro n\'est pas décidé dans A.2 bis : REFUSÉ');

  // Une entrée qui change de NATURE sans disparaître (`devient`).
  const refLabel = { 'src/N.tsx': ['prop:label:Mon compte'] };
  const devient = { 'src/N.tsx :: prop:label:Mon compte': { de: 'src/N.tsx', vers: 'src/N.tsx', devient: 'prop:titre:Mon compte' } };
  ok(comparer(refLabel, { 'src/N.tsx': ['prop:titre:Mon compte'] }, devient, new Set()).ok, 'changement de nature déclaré (devient) et retrouvé : accepté');
  ok(!comparer(refLabel, { 'src/N.tsx': [] }, devient, new Set()).ok, 'changement de nature déclaré mais forme introuvable : REFUSÉ');

  const orphelin = comparer(ref, ref, { 'src/A.tsx :: texte:Garder': { de: 'src/A.tsx', vers: 'src/C.tsx' } }, new Set());
  ok(!orphelin.ok && orphelin.orphelins.length === 1, 'déclaration sans disparition réelle : REFUSÉ (elle masquerait une perte future)');

  const cadrage = [
    '### A.2 Cible',
    'exemple cité hors décision : [retrait #9]',
    '### A.2 bis Décisions retenues',
    '1. Meules et Gemmes — [retrait #1] décidé par Thomas le 2026-09-25',
    '2. rayons 8 px — retenu',
    '### A.3 Hiérarchie',
    'autre mention : [retrait #7]',
  ].join('\n');
  egal([...decisionsRetrait(cadrage)], [1], 'seuls les [retrait #n] de la section A.2 bis comptent comme décisions');
}

// Les chemins qu'aucun lot ne touche.
export function testRefonteCheminsInterdits() {
  titre('refonte-chemins-interdits · logique, données et rendus du jeu');
  egal(
    interdits([
      'src/lib/speed.ts',
      'src/components/Sidebar.tsx',
      'public/data/monsters.json',
      'src/components/RuneWheel.tsx',
      'src/data/couleursSection.ts',
      'src/data/releases.ts',
      'src\\hooks\\useRtaState.ts',
      'src/index.css',
      'src/types.ts',
    ]),
    [
      'public/data/monsters.json',
      'src/components/RuneWheel.tsx',
      'src/hooks/useRtaState.ts',
      'src/lib/speed.ts',
      'src/types.ts',
    ],
    'interdits relevés (logique, données, rendus du jeu, types) ; couleursSection, releases, Sidebar et index.css permis'
  );
  egal(interdits(['src/pages/HomePage.tsx', 'tailwind.config.js']), [], 'un diff purement visuel ne déclenche rien');
}
