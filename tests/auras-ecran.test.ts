// Lot 7a de degats-et-aura — la saisie des auras EXTERNES à l'écran.
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
import {
  PLAFOND_AURAS_EXTERNES,
  SETS_AURA,
  ajouterAura,
  changerNombreAura,
  changerSetAura,
  echoAurasExternes,
  erreurAurasExternes,
  libelleNombreAura,
  nombreMaxDeLaLigne,
  peutAjouterAura,
  retirerAura,
  setsDisponibles,
  sommeAurasExternes,
  type AuraExterne,
} from '../src/lib/aurasExternes';
import { mulberry32 } from '../scripts/lib/randomPool';

const a = (set: SetAura, nombre: number): AuraExterne => ({ set, nombre });

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
  egal(PLAFOND_AURAS_EXTERNES, 15, 'plafond de saisie : 15 (cinq autres monstres à trois sets, A.2 ter)');
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

  // Les deux sources sont indépendantes (cadrage, lot 7, point 2).
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
  ok(/const \[compterAurasResPre, setCompterAurasResPre\] = useState\(true\);/.test(lire('src/hooks/useOptimizerState.ts')),
    'état : activé par défaut');

  const ecran = lire('src/components/outils/OptimizerSection.tsx');
  const sansCommentaires = ecran.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const avances = sansCommentaires.slice(sansCommentaires.indexOf('const reglagesAvancesInner = '), sansCommentaires.indexOf('const reglagesAvancesTitre = '));
  const libelle = 'Compter les effets d\'auras Tolerance et Précision dans les conditions';
  // La rangée entière : de son cadre jusqu'à la fermeture qui suit l'interrupteur.
  const rangee = avances.match(
    /<div className="flex items-center justify-between gap-2 py-3 last:pb-0">\s*<div className="flex items-center gap-1\.5">\s*<span className="text-\[11\.5px\] text-ink-dim">\s*Compter les effets[\s\S]*?<Interrupteur[\s\S]*?\/>\s*<\/div>/,
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
