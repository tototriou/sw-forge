// La saisie des auras EXTERNES à l'écran.
//
// La logique vit dans `src/lib/aurasExternes.ts` (fonctions pures), que la
// carte « État de mon monstre » appelle pour CHAQUE écriture : c'est ici
// qu'on prouve les bornes, l'ajout, le retrait et le partage de la validation
// avec la recette. Le composant n'a pas de test de rendu (ARCHITECTURE.md
// § 9) : quelques contrôles de source vérifient qu'il passe bien par ces
// fonctions, et rien d'autre.

import { readFileSync } from 'node:fs';
import { egal, ok, titre } from './outils';
import { DEFAULT_DAMAGE_SETUP, STAT_DE_L_AURA, type SetAura } from '../src/lib/damage';
import { damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { RUNE_SETS } from '../src/types';
import {
  DUREE_ATTENTION_MS,
  PLAFOND_AURAS_EXTERNES,
  SETS_AURA,
  SETS_AURA_RES_PRE,
  ajouterAura,
  changerNombreAura,
  changerSetAura,
  doitRappeler,
  echoAurasExternes,
  erreurAurasExternes,
  guideVersResPre,
  libelleNombreAura,
  nomSetAura,
  nombreMaxDeLaLigne,
  peutAjouterAura,
  retirerAura,
  setsDisponibles,
  sommeAurasExternes,
  type AuraExterne,
  type MonstreOptimise,
  type VoieChangementMonstre,
} from '../src/lib/aurasExternes';
import { mulberry32 } from '../scripts/lib/randomPool';

const a = (set: SetAura, nombre: number): AuraExterne => ({ set, nombre });

// Source sans commentaires (JSX, blocs, lignes) : un nom cité en commentaire
// ne compte jamais comme un branchement.
const lireSansCommentaires = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
// Le texte de `debut` (inclus) jusqu'à `fin` (exclu), cherché après `debut` ; vide si l'un manque.
const entre = (source: string, debut: string, fin: string) => {
  const i = source.indexOf(debut);
  const j = i >= 0 ? source.indexOf(fin, i + debut.length) : -1;
  return i >= 0 && j >= 0 ? source.slice(i, j) : '';
};

function recette(setsAuraExternes: unknown, sets: string[] = []) {
  const base = buildOptimizerRecipe({
    monsterCom2usId: 14104, monsterName: 'Monstre du test',
    requirement: { sets, minStats: {} }, objective: 'efficience', damageSetup: DEFAULT_DAMAGE_SETUP,
    compterAurasResPre: true, metric: 'eff', slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: false, artifactMainByKind: {},
  });
  return parseOptimizerRecipe(JSON.stringify({ ...base, damageSetup: { ...base.damageSetup, setsAuraExternes } }));
}

export function testAurasEcranBornes() {
  titre('Auras à l’écran · bornes : 1 à 15 − somme des autres lignes, ajout impossible à 15 ou à cinq sets');

  egal(SETS_AURA, Object.keys(STAT_DE_L_AURA), 'les cinq sets sont DÉRIVÉS de STAT_DE_L_AURA, dans son ordre');
  egal(PLAFOND_AURAS_EXTERNES, 15, 'plafond de saisie : 15 (cinq autres monstres à trois sets)');
  egal(libelleNombreAura('fight'), 'Nombre de sets Fight des autres monstres de l\'équipe', 'libellé explicite, patron de l’utilisateur');
  egal(libelleNombreAura('tolerance'), 'Nombre de sets Tolerance des autres monstres de l\'équipe', 'même patron pour les cinq sets');

  const liste = [a('fight', 10), a('accuracy', 3)];
  egal(nombreMaxDeLaLigne(liste, 'fight'), 12, 'Fight : 15 − 3 (les autres lignes)');
  egal(nombreMaxDeLaLigne(liste, 'accuracy'), 5, 'Accuracy : 15 − 10');
  egal(nombreMaxDeLaLigne([a('fight', 15)], 'fight'), 15, 'une seule ligne : jusqu’à 15');

  // Jamais `min > max` au contrôle, sur des listes valides tirées au hasard.
  const rng = mulberry32(7007);
  let jamaisSousUn = true;
  let jamaisSousLaValeur = true;
  for (let essai = 0; essai < 500; essai++) {
    let l: AuraExterne[] = [];
    for (let pas = 0; pas < 12; pas++) {
      l = ajouterAura(l);
      const cible = l[Math.floor(rng() * l.length)];
      l = changerNombreAura(l, cible.set, Math.floor(rng() * 20));
    }
    for (const e of l) {
      const max = nombreMaxDeLaLigne(l, e.set);
      if (max < 1) jamaisSousUn = false;
      if (max < e.nombre) jamaisSousLaValeur = false;
    }
  }
  ok(jamaisSousUn, 'max ≥ 1 = min sur chaque ligne : jamais min > max');
  ok(jamaisSousLaValeur, 'max ≥ nombre courant : le contrôle ne réécrit jamais une valeur valide');

  ok(peutAjouterAura([]), 'liste vide : ajout possible');
  ok(peutAjouterAura([a('fight', 14)]), 'somme 14 : ajout possible');
  ok(!peutAjouterAura([a('fight', 15)]), 'somme 15 : ajout impossible');
  ok(!peutAjouterAura([a('fight', 10), a('tolerance', 5)]), 'somme 15 répartie : ajout impossible');
  ok(!peutAjouterAura(SETS_AURA.map((s) => a(s, 1))), 'cinq sets présents (somme 5) : ajout impossible');
  egal(setsDisponibles([a('determination', 2)], 'determination'), SETS_AURA, 'menu d’une ligne : son set et les absents');
  egal(setsDisponibles([a('determination', 2), a('fight', 1)], 'fight'), ['fight', 'enhance', 'accuracy', 'tolerance'],
    'menu d’une ligne : jamais le set d’une autre ligne');
}

export function testAurasEcranEcriture() {
  titre('Auras à l’écran · écriture : ajout en dernier, nombre borné, champ vidé = 1, corbeille seule');

  egal(ajouterAura([]), [a('fight', 1)], 'ajout : premier set absent, nombre 1');
  egal(ajouterAura([a('fight', 2), a('enhance', 1)]), [a('fight', 2), a('enhance', 1), a('determination', 1)],
    'ajout : la ligne s’ajoute EN DERNIER (sous les précédentes), premier set absent dans l’ordre du jeu');
  const plein = [a('fight', 10), a('accuracy', 5)];
  const pleinCopie = JSON.parse(JSON.stringify(plein));
  ok(ajouterAura(plein) === plein, 'somme 15 : ajout refusé, même liste rendue');
  egal(plein, pleinCopie, 'somme 15 : les lignes existantes ne sont pas modifiées');
  const cinq = SETS_AURA.map((s) => a(s, 1));
  ok(ajouterAura(cinq) === cinq, 'cinq sets présents : ajout refusé, même liste rendue');

  // 15 acceptés, 16 refusés — la borne de la FONCTION, pas celle du contrôle.
  egal(changerNombreAura([a('fight', 1)], 'fight', 15), [a('fight', 15)], '15 sets d’un type acceptés');
  egal(changerNombreAura([a('fight', 1)], 'fight', 16), [a('fight', 15)], '16 sets d’un type : ramené à 15');
  egal(changerNombreAura([a('fight', 10), a('accuracy', 1)], 'accuracy', 5), [a('fight', 10), a('accuracy', 5)],
    '15 sets répartis acceptés');
  egal(changerNombreAura([a('fight', 10), a('accuracy', 5)], 'accuracy', 6), [a('fight', 10), a('accuracy', 5)],
    'nombre au-delà de 15 − somme des autres refusé : 16 sets répartis jamais écrits');
  egal(changerNombreAura([a('fight', 10), a('accuracy', 1)], 'accuracy', 99), [a('fight', 10), a('accuracy', 5)],
    'frappe hors borne (99) : ramenée à 15 − somme des autres');

  // Champ vidé, zéro, négatif, décimal : jamais une ligne à 0, jamais retirée.
  egal(changerNombreAura([a('enhance', 4)], 'enhance', null), [a('enhance', 1)], 'champ vidé (null) : 1, la ligne reste');
  egal(changerNombreAura([a('enhance', 4)], 'enhance', 0), [a('enhance', 1)], '0 : 1, la ligne reste');
  egal(changerNombreAura([a('enhance', 4)], 'enhance', -3), [a('enhance', 1)], 'négatif : 1');
  egal(changerNombreAura([a('enhance', 4)], 'enhance', Number.NaN), [a('enhance', 1)], 'NaN : 1');
  egal(changerNombreAura([a('enhance', 4)], 'enhance', 2.7), [a('enhance', 2)], 'décimal : tronqué');
  const inchange = [a('enhance', 4)];
  ok(changerNombreAura(inchange, 'enhance', 4) === inchange, 'même nombre : même liste rendue (aucune écriture)');
  ok(changerNombreAura(inchange, 'fight', 3) === inchange, 'set sans ligne : liste inchangée');

  egal(changerSetAura([a('fight', 3), a('enhance', 2)], 'fight', 'tolerance'), [a('tolerance', 3), a('enhance', 2)],
    'changer le set : même place, même nombre');
  const deux = [a('fight', 3), a('enhance', 2)];
  ok(changerSetAura(deux, 'fight', 'enhance') === deux, 'changer vers le set d’une autre ligne : refusé (une ligne par set)');

  egal(retirerAura([a('fight', 3), a('enhance', 2), a('tolerance', 1)], 'enhance'), [a('fight', 3), a('tolerance', 1)],
    'corbeille : retire cette ligne seule');

  // Toute suite d'écritures rend une liste que la recette accepte.
  const rng = mulberry32(4242);
  let valides = true;
  let relues = true;
  for (let essai = 0; essai < 300; essai++) {
    let l: AuraExterne[] = [];
    for (let pas = 0; pas < 15; pas++) {
      const tirage = rng();
      const cible = l.length > 0 ? l[Math.floor(rng() * l.length)] : null;
      if (tirage < 0.35 || !cible) l = ajouterAura(l);
      else if (tirage < 0.7) l = changerNombreAura(l, cible.set, rng() < 0.1 ? null : Math.floor(rng() * 30) - 5);
      else if (tirage < 0.85) l = changerSetAura(l, cible.set, SETS_AURA[Math.floor(rng() * SETS_AURA.length)]);
      else l = retirerAura(l, cible.set);
      if (erreurAurasExternes(l) !== null || sommeAurasExternes(l) > PLAFOND_AURAS_EXTERNES) valides = false;
    }
    if (recette(l).recipe === null) relues = false;
  }
  ok(valides, 'suites aléatoires d’écritures : toujours une liste valide, somme ≤ 15');
  ok(relues, 'suites aléatoires d’écritures : toujours relues par la recette');
}

export function testAurasEcranValidationPartagee() {
  titre('Auras à l’écran · validation partagée avec la recette, indépendance du set recherché');

  // La recette compose son message à partir de `erreurAurasExternes` : même
  // chemin, même attente, pour chaque cas refusé.
  for (const [invalide, motif] of [
    [[{ set: 'fight', nombre: 10 }, { set: 'accuracy', nombre: 6 }], 'somme 16'],
    [[{ set: 'fight', nombre: 16 }], '16 d’un type'],
    [[{ set: 'fight', nombre: 0 }], 'zéro'],
    [[{ set: 'fight', nombre: 1.5 }], 'non entier'],
    [[{ set: 'fight', nombre: '2' }], 'nombre en texte'],
    [[{ set: 'inconnu', nombre: 1 }], 'set inconnu'],
    [[{ set: 'toString', nombre: 1 }], 'clé héritée d’Object'],
    [[{ set: 'fight', nombre: 1 }, { set: 'fight', nombre: 1 }], 'doublon'],
    [['fight'], 'entrée non objet'],
    ['fight', 'pas une liste'],
  ] as [unknown, string][]) {
    const e = erreurAurasExternes(invalide);
    ok(e !== null && recette(invalide).error === `Fichier invalide : damageSetup.setsAuraExternes${e.chemin} ${e.attente}.`,
      `même refus, même chemin à l’écran et dans la recette : ${motif}`);
  }
  egal(erreurAurasExternes(undefined), null, 'liste absente : zéro aura, acceptée');
  egal(erreurAurasExternes([]), null, 'liste vide acceptée');

  // Les deux sources sont indépendantes.
  ok(recette([], ['fight', 'fight', 'fight']).recipe !== null,
    'recette à 0 externe valide même avec trois Fight demandés (activés sur le build)');
  ok(recette([{ set: 'fight', nombre: 15 }], ['fight', 'fight', 'fight']).recipe !== null,
    '15 Fight externes + trois Fight demandés : valide, les propres s’ajoutent hors du champ');
  const setup = { ...DEFAULT_DAMAGE_SETUP, setsAuraExternes: [a('tolerance', 2), a('fight', 3)] };
  egal(damageSetupApresChangementMonstre(setup).setsAuraExternes, setup.setsAuraExternes,
    'changement de monstre : les auras saisies sont conservées');

  // Source du composant : il passe par les fonctions pures, et par elles seules.
  const brut = readFileSync('src/components/outils/EtatMonstre.tsx', 'utf8').replace(/\r\n/g, '\n');
  const source = brut.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const debut = source.indexOf('function AurasExternesSaisie(');
  const saisie = debut >= 0 ? source.slice(debut) : '';
  ok(debut >= 0, 'source : la saisie vit dans `AurasExternesSaisie`');
  egal(source.match(/setsAuraExternes:/g)?.length ?? 0, 1, 'source : UNE seule écriture de setsAuraExternes (`ecrire`)');
  for (const fn of ['ajouterAura(entrees)', 'changerNombreAura(entrees, entree.set, v)', 'changerSetAura(entrees, entree.set,', 'retirerAura(entrees, entree.set)']) {
    ok(saisie.includes(`ecrire(${fn}`), `source : écriture par ${fn.split('(')[0]}`);
  }
  const bouton = saisie.search(/<Bouton\s+trait="pointille"[\s\S]*?libelle="Ajouter un set d'aura"/);
  const lignes = saisie.indexOf('entrees.map(');
  ok(bouton >= 0 && lignes > bouton, 'source : bouton pointillé « Ajouter un set d’aura » AVANT les lignes (fixe en tête)');
  ok(/disabled=\{!ajoutPossible\}/.test(saisie), 'source : ajout désactivé (jamais retiré) quand il est impossible');
  ok(/allowEmpty/.test(saisie) && /onBlur=\{\(\) => setLigneVide\(null\)\}/.test(saisie),
    'source : un champ vidé reste vide à l’écran jusqu’à la sortie du champ, puis montre 1');
  ok(!/<(button|select|input)\b/.test(saisie), 'source : aucun contrôle natif, tout vient de src/ui');
}

export function testAurasEcranEcho() {
  titre('Auras à l’écran · écho de la fenêtre « Dégâts réels » : externes nommées, sets du build sans nombre');

  egal(echoAurasExternes([a('fight', 2), a('accuracy', 1)]),
    'auras externes : 2 sets Fight, 1 set Accuracy ; les sets d\'aura du build s\'y ajoutent sur chaque résultat',
    'externes nommées par set, avec leur nombre, dans l’ordre saisi');
  egal(echoAurasExternes([]), 'aucune aura externe ; les sets d\'aura du build comptent sur chaque résultat',
    'aucune externe : le dit, et rappelle les sets du build');
  egal(echoAurasExternes(undefined), echoAurasExternes([]), 'liste absente : comme vide');
  ok(!/\d/.test(echoAurasExternes([]).replace(/^.*?;/, '')) && !/\d/.test(echoAurasExternes([a('fight', 3)]).split(';')[1]),
    'la part du build ne porte AUCUN nombre : la fenêtre ne connaît aucun candidat');

  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8').replace(/\r\n/g, '\n');
  const echo = ecran.slice(ecran.indexOf('const echoEtatMonstre = useMemo('), ecran.indexOf('}, [damageSetup]);', ecran.indexOf('const echoEtatMonstre = useMemo(')));
  ok(echo.includes('echoAurasExternes(damageSetup.setsAuraExternes)'), 'écran : l’écho d’état passe par echoAurasExternes');
}

export function testAurasEcranInterrupteur() {
  titre('Auras à l’écran · interrupteur « Compter les effets d’auras Tolerance et Précision dans les conditions »');

  const lire = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  ok(/const \[compterAurasResPre, setCompterAurasResPre\] = useState\(base.compterAurasResPre\);/.test(lire('src/hooks/useOptimizerState.ts'))
    && lire('src/lib/criteresOptimizer.ts').includes("compterAurasResPre: true, critereArtefacts: 'brut'"),
    'état : activé par la base complète');

  const ecran = lire('src/components/outils/OptimizerSection.tsx');
  const sansCommentaires = ecran.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const avances = sansCommentaires.slice(sansCommentaires.indexOf('const reglagesAvancesInner = '), sansCommentaires.indexOf('const reglagesAvancesTitre = '));
  const libelle = 'Compter les effets d\'auras Tolerance et Précision dans les conditions';
  // La rangée entière : de son cadre jusqu'à la fermeture qui suit l'interrupteur.
  // Depuis 7b, la rangée porte un cadre intérieur — la cible de l'ouverture
  // guidée (voir `testAurasEcranGuidage`) — autour du libellé et de l'interrupteur.
  const rangee = avances.match(
    /<div className="py-2 last:pb-0">\s*<div\s+ref=\{[^}]*\}\s+className=\{`[^`]*`\}\s*>\s*<div className="flex items-center gap-1\.5">\s*<span className="text-\[11\.5px\] text-ink-dim">\s*Compter les effets[\s\S]*?<Interrupteur[\s\S]*?\/>\s*<\/div>\s*<\/div>/,
  )?.[0] ?? '';
  ok(new RegExp(`<span className="text-\\[11\\.5px\\] text-ink-dim">\\s*${libelle}\\s*</span>`).test(rangee),
    'Réglages avancés : une rangée au libellé exact de l’utilisateur');
  ok(rangee.includes(`<HelpPopover title="${libelle}">`), 'avec une aide');
  ok(rangee.includes('<Interrupteur\n') && new RegExp(`<Interrupteur\\s+actif=\\{compterAurasResPre\\}\\s+onChange=\\{setCompterAurasResPre\\}\\s+aria-label="${libelle}"\\s*/>`).test(rangee),
    'interrupteur `src/ui` branché sur compterAurasResPre');
  const position = rangee.length > 0 ? avances.indexOf(rangee) : -1;
  ok(position >= 0 && /\)\}\s*$/.test(avances.slice(0, position)) && /^\s*<\/div>\s*<\/div>\s*\);\s*$/.test(avances.slice(position + rangee.length)),
    'rendu SANS condition, en dernier, dans le contenu commun aux deux formats (`reglagesAvancesInner`)');
  egal(ecran.match(/reglagesAvancesInner\((true|false)\)/g), ['reglagesAvancesInner(false)', 'reglagesAvancesInner(true)'],
    'le même contenu sert le flottant du bureau et le panneau « Options » au doigt');
}

export function testAurasEcranRappel() {
  titre('Auras à l’écran · rappel au changement de monstre : liste de travail seulement, autre espèce ou autre exemplaire, auras renseignées ; un seul état, rendu dans la boîte des auras et sous la liste');

  // La décision est pure (`doitRappeler`) ; l'écran ne fait que la
  // brancher, ce que vérifient les contrôles de source plus bas.
  const auras = [a('fight', 2), a('tolerance', 1)];
  const m = (espece: string | null, exemplaire: string | null, aurasExternes: readonly AuraExterne[] | undefined = auras): MonstreOptimise =>
    ({ espece, exemplaire, aurasExternes });
  ok(doitRappeler('liste', m('1001', 'box:1'), m('2002', 'box:7')), 'liste de travail, autre espèce, auras renseignées : rappel');
  ok(doitRappeler('liste', m('1001', 'box:1'), m('1001', 'siege-defense:3')),
    'liste de travail, MÊME espèce, autre exemplaire : rappel');
  ok(!doitRappeler('liste', m('1001', 'box:1'), m('1001', 'box:1')), 'recliquer l’exemplaire déjà affiché : aucun rappel');
  ok(!doitRappeler('liste', m('1001', 'box:1', []), m('2002', 'box:7', [])), 'aucune aura externe : aucun rappel');
  // ⚠️ Objets écrits en entier : un `undefined` passé à `m` prendrait la valeur par défaut.
  ok(!doitRappeler('liste', { espece: '1001', exemplaire: 'box:1', aurasExternes: undefined }, { espece: '2002', exemplaire: 'box:7', aurasExternes: undefined }),
    'auras absentes : aucun rappel');
  ok(doitRappeler('liste', m(null, null), m('2002', 'box:7')), 'liste de travail, premier monstre choisi alors qu’aucun ne l’était : rappel');
  const autresVoies: VoieChangementMonstre[] = ['bestiaire', 'source', 'recette', 'compte', 'rendu'];
  for (const voie of autresVoies) {
    ok(!doitRappeler(voie, m('1001', 'box:1'), m('2002', 'box:7')), `voie « ${voie} », autre espèce, auras renseignées : aucun rappel`);
  }
  ok(!doitRappeler('rendu', m(null, null), m('2002', 'box:7')), 'premier rendu : aucun rappel');
  egal(DUREE_ATTENTION_MS, 3000, 'effacé après 3 s');
  const setup = { ...DEFAULT_DAMAGE_SETUP, setsAuraExternes: auras };
  egal(damageSetupApresChangementMonstre(setup).setsAuraExternes, auras,
    'les nombres ne sont jamais réécrits : le changement de monstre conserve les auras, le rappel ne fait que les signaler');

  // Branchement : dans le seul onClick d'un membre de la liste de travail.
  const ecran = lireSansCommentaires('src/components/outils/OptimizerSection.tsx');
  const zoneC = ecran.slice(Math.max(0, ecran.indexOf('const zoneCContent = (')));
  const clic = entre(zoneC, 'onClick={() => {', 'className="flex min-w-0 flex-1 items-center gap-2 text-left"');
  // La restauration est l'action de l'état partagé ; le rappel reste
  // uniquement dans le geste explicite de cette ligne.
  const chemin = entre(ecran, 'function choisirExemplaire(', 'function handleAddToList(');
  ok(clic.includes('if (!resolved) return;') && clic.includes('optimizer.choisirMembre(m.listId, m.selector);')
    && chemin.includes('setSelectedId(id);') && chemin.includes('effacerResultats()'),
  'source : le geste d’un membre de la liste de travail (zone C) est localisé');
  ok(/doitRappeler\(\s*'liste',/.test(clic), 'source : le rappel est décidé DANS ce onClick, voie « liste »');
  ok(/\{ espece: selectedId, exemplaire: ownSelectorKey, aurasExternes: damageSetup\.setsAuraExternes \}/.test(clic)
    && /\{ espece: id, exemplaire: key, aurasExternes: damageSetup\.setsAuraExternes \}/.test(clic),
  '… avant = l’espèce et l’exemplaire affichés, après = le membre cliqué (espèce ET exemplaire)');
  ok(/setRappelAuras\(\(n\) => \(n \?\? 0\) \+ 1\)/.test(clic), '… et déclenché là, par un jeton qui relance la minuterie');
  egal(ecran.match(/doitRappeler\(/g)?.length ?? 0, 1, 'source : UN seul appel de doitRappeler dans l’écran');
  egal(ecran.match(/setRappelAuras\((?!null\))/g)?.length ?? 0, 1,
    'source : le rappel n’est déclenché qu’à cet endroit — jamais pickSpecies, pickSource, importRecipe ni un effet sur selectedId');
  for (const [nom, corps] of [
    ['pickSpecies (bestiaire)', entre(ecran, 'function pickSpecies(', 'const zoneDRef = useRef')],
    ['pickSource (puces de source)', entre(ecran, 'function pickSource(', 'function pickSpecies(')],
    ['importRecipe (import de recette)', entre(ecran, 'function importRecipe(', 'const candidatesSource =')],
  ] as const) {
    ok(corps.length > 0 && !/doitRappeler|setRappelAuras/.test(corps), `source : ${nom} ne rappelle rien`);
  }
  const hook = lireSansCommentaires('src/hooks/useOptimizerState.ts');
  const reset = entre(hook, 'function resetSearch(', 'function effacerResultats(');
  ok(reset.length > 0 && !/doitRappeler|RappelAuras|rappelAuras/.test(reset), 'source : resetSearch ne rappelle rien');
  const app = lireSansCommentaires('src/App.tsx');
  ok(app.includes("optimizer.resetSearch('compte')") && !/doitRappeler|RappelAuras|rappelAuras/.test(app),
    'source : l’import de compte (App.tsx, `resetSearch(\'compte\')`) ne rappelle rien');
  ok(/setTimeout\(\(\) => setRappelAuras\(null\), DUREE_ATTENTION_MS\)/.test(ecran), 'source : effacé par une minuterie de DUREE_ATTENTION_MS');
  ok(/<EtatMonstre[\s\S]*?rappelAuras=\{rappelAuras !== null\}[\s\S]*?\/>/.test(ecran), 'source : l’état du rappel est passé à « État de mon monstre »');

  // Rendu : la boîte des auras recolorée au token d'attention, message à place réservée.
  const carte = lireSansCommentaires('src/components/outils/EtatMonstre.tsx');
  ok(/<AurasExternesSaisie setup=\{setup\} maj=\{maj\} rappel=\{rappelAuras\}[^>]*\/>/.test(carte), 'rendu : la carte transmet le rappel à la saisie des auras');
  const saisie = carte.slice(Math.max(0, carte.indexOf('function AurasExternesSaisie(')));
  ok(saisie.includes("rappel ? 'border-warn bg-warn-soft' : 'border-border-soft bg-panel2'"),
    'rendu : la boîte passe au token d’attention (warn / warn-soft) à la place de ses couleurs — un seul contour de 1 px');
  ok(/className=\{`col-start-1 row-start-1 flex items-center justify-between gap-2 \$\{rappel \? 'invisible' : ''\}`\}/.test(saisie),
    'rendu : l’en-tête occupe la case 1/1 de sa grille, effacé pendant le rappel');
  const message = saisie.match(/<div className="col-start-1 row-start-1 self-center" aria-live="polite">\s*<p\s+className=\{`text-xs font-semibold text-warn \$\{\s*rappel \? '[^']*' : 'invisible'\s*\}`\}\s*>\s*Pense à vérifier les sets d&apos;aura externes\.\s*<\/p>/);
  ok(message !== null, 'rendu : « Pense à vérifier les sets d’aura externes. » dans la MÊME case, toujours rendu, invisible hors rappel (place réservée)');
  ok(!/\{rappel &&/.test(saisie), 'rendu : rien n’est monté sous condition du rappel — rien ne bouge quand il paraît');

  // Le MÊME rappel, aussi sous la liste de la zone C :
  // un seul état (`rappelAuras`), une seule
  // minuterie, deux rendus. Aucun déclencheur nouveau : les deux comptes plus
  // haut (un seul `doitRappeler`, un seul `setRappelAuras` hors effacement)
  // le prouvent déjà.
  const corpsZoneC = entre(ecran, 'const zoneCContent = (', '\n  return (');
  const finListe = corpsZoneC.indexOf('activeMembers.map(');
  const liberer = corpsZoneC.indexOf('Libérer toutes les runes');
  const sousLaListe = corpsZoneC.match(
    /\{activeMembers\.length > 0 && \(\s*<p\s+className=\{`([^`$]*)\$\{\s*([^?]*?)\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\}`\}\s*>\s*([^<]*?)\s*<\/p>/
  );
  const debutMessage = sousLaListe?.index ?? -1;
  ok(finListe >= 0 && debutMessage > finListe && /<\/div>\s*\)\}\s*$/.test(corpsZoneC.slice(finListe, debutMessage))
    && (liberer < 0 || debutMessage < liberer),
  'rendu 7c : un message SOUS la liste de la zone C — hors du conteneur qui défile, avant « Libérer toutes les runes » —, monté avec la liste');
  const [, classes = '', condition = '', siRappel = '', sinon = '', texte = ''] = sousLaListe ?? [];
  egal(condition, 'rappelAuras !== null', 'rendu 7c : branché sur le MÊME état que la boîte des auras, jamais une autre condition');
  egal(sinon, 'invisible', 'rendu 7c : invisible hors rappel, jamais démonté — sa place est réservée, rien ne bouge');
  egal(siRappel, 'animate-[apparition_200ms_var(--ease-out)]', 'rendu 7c : la même apparition que le message de la boîte des auras');
  const jetons = classes.split(/\s+/);
  ok(['border', 'border-warn', 'bg-warn-soft', 'text-warn'].every((c) => jetons.includes(c))
    && jetons.filter((c) => /^border(-|$)/.test(c)).join(' ') === 'border border-warn' && !/\b(ring|outline)\b/.test(classes),
  'rendu 7c : même token (contour warn de 1 px, fond warn-soft, texte warn), un seul contour');
  egal(texte, 'Pense à vérifier les sets d&apos;aura externes.', 'rendu 7c : le même message, mot pour mot');
  egal(corpsZoneC.match(/rappelAuras/g)?.length ?? 0, 1, 'rendu 7c : la zone C ne lit le rappel qu’à cet endroit — rien n’y est monté sous sa condition');
  egal(ecran.match(/rappelAuras !== null/g)?.length ?? 0, 2,
    'source 7c : un seul état, deux rendus — `rappelAuras !== null` lu par « État de mon monstre » et sous la liste, nulle part ailleurs');
  egal(ecran.match(/setTimeout\([^;]*DUREE_ATTENTION_MS\)/g)?.length ?? 0, 2,
    'source 7c : aucune minuterie de plus — celle du rappel et celle de l’ouverture guidée, seules');
  ok(!/setTimeout/.test(carte), 'source 7c : « État de mon monstre » n’a aucune minuterie — il reçoit l’état du rappel, rien de plus');
}

export function testAurasEcranGuidage() {
  titre('Auras à l’écran · ouverture guidée vers l’interrupteur : Accuracy ou Tolerance ajouté, jamais Fight / Determination / Enhance');

  // La décision est pure (`guideVersResPre`), sur les vraies écritures.
  egal([...SETS_AURA_RES_PRE], ['accuracy', 'tolerance'], 'les sets qui guident sont DÉRIVÉS de STAT_DE_L_AURA : Précision et RES seulement');
  const vide: AuraExterne[] = [];
  ok(guideVersResPre({ aurasExternes: vide }, { aurasExternes: [a('accuracy', 1)] }), 'Accuracy ajouté aux auras externes : guide');
  ok(guideVersResPre({ aurasExternes: vide }, { aurasExternes: [a('tolerance', 1)] }), 'Tolerance ajouté aux auras externes : guide');
  const fight = [a('fight', 2)];
  ok(guideVersResPre({ aurasExternes: fight }, { aurasExternes: changerSetAura(fight, 'fight', 'tolerance') }),
    'ligne passée de Fight à Tolerance (menu de la ligne) : guide');
  const trois = [a('fight', 1), a('determination', 1), a('enhance', 1)];
  ok(guideVersResPre({ aurasExternes: trois }, { aurasExternes: ajouterAura(trois) }),
    '« Ajouter un set d’aura » quand Accuracy est le premier set libre : guide');
  ok(!guideVersResPre({ aurasExternes: vide }, { aurasExternes: ajouterAura(vide) }), '« Ajouter un set d’aura » sur une liste vide (ligne Fight) : rien');
  for (const set of ['fight', 'determination', 'enhance'] as const) {
    ok(!guideVersResPre({ aurasExternes: vide }, { aurasExternes: [a(set, 1)] }), `${nomSetAura(set)} ajouté aux auras externes : rien (aucun réglage associé)`);
  }
  ok(guideVersResPre({ aurasExternes: [a('accuracy', 1)] }, { aurasExternes: [a('accuracy', 1), a('tolerance', 1)] }),
    'Tolerance ajouté à côté d’un Accuracy déjà présent : guide');
  ok(!guideVersResPre({ aurasExternes: [a('accuracy', 1)] }, { aurasExternes: changerNombreAura([a('accuracy', 1)], 'accuracy', 3) }),
    'nombre changé sur une ligne Accuracy déjà présente : rien');
  ok(!guideVersResPre({ aurasExternes: [a('tolerance', 2)] }, { aurasExternes: retirerAura([a('tolerance', 2)], 'tolerance') }), 'ligne Tolerance retirée : rien');
  ok(!guideVersResPre({ aurasExternes: [a('accuracy', 1)] }, { aurasExternes: changerSetAura([a('accuracy', 1)], 'accuracy', 'enhance') }),
    'ligne passée d’Accuracy à Enhance : rien');
  ok(guideVersResPre({ setsRecherches: ['violent'] }, { setsRecherches: ['violent', 'accuracy'] }), 'Accuracy choisi comme set recherché : guide');
  ok(guideVersResPre({ setsRecherches: [] }, { setsRecherches: ['tolerance'] }), 'Tolerance choisi comme set recherché : guide');
  ok(!guideVersResPre({ setsRecherches: ['accuracy'] }, { setsRecherches: ['accuracy', 'accuracy'] }), 'seconde activation d’Accuracy : rien');
  ok(!guideVersResPre({ setsRecherches: ['tolerance', 'violent'] }, { setsRecherches: ['violent'] }), 'Tolerance retiré du set recherché : rien');
  egal(RUNE_SETS.filter((s) => guideVersResPre({ setsRecherches: [] }, { setsRecherches: [s.key] })).map((s) => s.key).sort(), ['accuracy', 'tolerance'],
    'parmi TOUS les sets du jeu choisis comme set recherché, seuls Accuracy et Tolerance guident');
  ok(guideVersResPre({ aurasExternes: [a('accuracy', 2)], setsRecherches: [] }, { aurasExternes: [a('accuracy', 2)], setsRecherches: ['accuracy'] }),
    'Accuracy déjà externe, puis choisi comme set recherché : guide (chaque source jugée pour elle seule)');

  // Déclencheurs : les deux gestes de l'utilisateur, et eux seuls.
  const ecran = lireSansCommentaires('src/components/outils/OptimizerSection.tsx');
  const carte = lireSansCommentaires('src/components/outils/EtatMonstre.tsx');
  const ecrire = entre(carte, 'const ecrire = (suivantes: AuraExterne[]) => {', '};');
  ok(/maj\(\{ setsAuraExternes: suivantes \}\);\s*if \(guideVersResPre\(\{ aurasExternes: entrees \}, \{ aurasExternes: suivantes \}\)\) onGuiderResPre\(\);/.test(ecrire),
    'source : chaque écriture des auras externes (`ecrire`, point de passage de tous les gestes de la boîte) guide quand Accuracy ou Tolerance y apparaît');
  egal(carte.match(/guideVersResPre\(/g)?.length ?? 0, 1, 'source : la carte ne décide le guidage qu’à cet endroit');
  ok(carte.includes('onGuiderResPre={onGuiderResPre}'), 'source : la carte transmet le guidage à la saisie des auras');
  ok(/<EtatMonstre[\s\S]*?onGuiderResPre=\{guiderVersResPre\}[\s\S]*?\/>/.test(ecran), 'source : l’écran fournit son guidage à « État de mon monstre »');
  const picker = entre(ecran, '<SetComboPicker', '/>');
  ok(/if \(guideVersResPre\(\{ setsRecherches: comboSets \}, \{ setsRecherches: next \}\)\) guiderVersResPre\(\);/.test(picker),
    'source : choisir un set recherché guide quand Accuracy ou Tolerance y apparaît, sans toucher aux auras externes');
  egal(ecran.match(/guideVersResPre\(/g)?.length ?? 0, 1, 'source : l’écran ne décide le guidage qu’au choix du set recherché');
  egal(ecran.match(/(?<!function )guiderVersResPre\(\)/g)?.length ?? 0, 1, 'source : guiderVersResPre n’est appelé qu’au choix du set recherché (la carte le reçoit en prop)');
  for (const [nom, corps] of [
    ['importRecipe (import de recette)', entre(ecran, 'function importRecipe(', 'const candidatesSource =')],
    ['pickSpecies (bestiaire)', entre(ecran, 'function pickSpecies(', 'const zoneDRef = useRef')],
    ['le geste de la zone C (changement de monstre)', entre(ecran.slice(Math.max(0, ecran.indexOf('const zoneCContent = ('))), 'onClick={() => {', 'className="flex min-w-0 flex-1 items-center gap-2 text-left"')],
  ] as const) {
    ok(corps.length > 0 && !/guiderVersResPre|guideVersResPre|setShowAdvanced\(true\)|onOuvrirMenu|setAttentionResPre/.test(corps), `source : ${nom} ne guide pas`);
  }
  const app = lireSansCommentaires('src/App.tsx');
  ok(app.includes("optimizer.resetSearch('compte')") && !/guiderVersResPre|guideVersResPre|onGuiderResPre/.test(app), 'source : l’import de compte (App.tsx) ne guide pas');

  // Deux formes, décidées par SOUS_LG.
  ok(ecran.includes('const sousLg = useMediaQuery(SOUS_LG);'), 'source : le format se décide par SOUS_LG, comme le panneau « Options » (MobileSheet)');
  const guider = entre(ecran, 'function guiderVersResPre() {', '\n  }\n');
  ok(/if \(sousLg\) \{[\s\S]*?onOuvrirMenu\(\);[\s\S]*?return;\s*\}/.test(guider),
    'au doigt : le panneau « Options de recherche » s’ouvre par-dessus la carte, demandé à App.tsx');
  ok(guider.includes('const ancre = avancesRef.current;') && /defilerPuis\(ancre, \(\) => \{\s*setShowAdvanced\(true\);/.test(guider),
    'à la souris : défiler vers l’ancre (`avancesRef`), PUIS ouvrir le flottant — l’ouverture est la suite du défilement');
  ok(guider.indexOf('defilerPuis(ancre') >= 0 && guider.indexOf('setShowAdvanced(true)') > guider.indexOf('defilerPuis(ancre'), '… jamais l’ouverture avant le défilement');
  const defiler = entre(ecran, 'function defilerPuis(', 'function guiderVersResPre() {');
  ok(defiler.includes("el.scrollIntoView({ behavior: 'smooth', block: 'center' });") && /addEventListener\('scrollend', fin\)/.test(defiler)
    && /setTimeout\(fin, 1000\)/.test(defiler) && /const fin = \(\) => \{\s*annuler\(\);\s*suite\(\);/.test(defiler),
  '… même défilement que « Set de runes recherché », la suite à sa fin (`scrollend`, repli d’une seconde)');
  ok(/setAttentionResPre\(\(n\) => \(n \?\? 0\) \+ 1\)/.test(guider), '… puis le surlignage, par un jeton');
  ok(/setTimeout\(\(\) => setAttentionResPre\(null\), DUREE_ATTENTION_MS\)/.test(ecran), 'le surlignage s’efface après DUREE_ATTENTION_MS (3 s)');
  ok(/sousLg\s*\?\s*menuOuvert\s*\?\s*interrupteurResPrePanneauRef\.current\s*:\s*null\s*:\s*showAdvanced\s*\?\s*interrupteurResPreFlottantRef\.current\s*:\s*null/.test(ecran)
    && ecran.includes("el.scrollIntoView({ behavior: 'smooth', block: sousLg ? 'center' : 'nearest' })"),
  'puis l’interrupteur est amené à l’écran dans sa surface ouverte : centré dans le panneau, au plus près sous le flottant');

  // La cible : cadre permanent au token d'attention, une ref par surface, un seul contenu.
  const avances = entre(ecran, 'const reglagesAvancesInner = ', 'const reglagesAvancesTitre = ');
  ok(/ref=\{dansPanneau \? interrupteurResPrePanneauRef : interrupteurResPreFlottantRef\}/.test(avances),
    'cible : une ref par surface (flottant du bureau, panneau au doigt)');
  ok(/className=\{`-mx-1 flex items-center justify-between gap-2 rounded-md border [^`]*\$\{\s*attentionResPre !== null \? 'border-warn bg-warn-soft' : 'border-transparent'\s*\}`\}/.test(avances),
    'cible : cadre PERMANENT (bord transparent hors guidage), au même token que le rappel — rien ne bouge quand il se colore');
  egal(ecran.match(/const reglagesAvancesInner = /g)?.length ?? 0, 1, 'un seul `reglagesAvancesInner` : l’interrupteur reste rendu, sans condition, dans les deux surfaces');

  // La prop d'ouverture du panneau, du shell à l'écran.
  ok(/onOuvrirMenu: \(\) => void;/.test(ecran), 'prop : OptimizerSection reçoit onOuvrirMenu');
  const outils = lireSansCommentaires('src/pages/OutilsPage.tsx');
  ok(/onOuvrirMenu: \(\) => void;/.test(outils) && outils.includes('onOuvrirMenu={onOuvrirMenu}'), 'prop : OutilsPage la relaie');
  ok(app.includes('onOuvrirMenu={() => setMenuPageOuvert(true)}'), 'prop : App.tsx ouvre le panneau par l’état qui le pilote (`menuPageOuvert`)');
}
