#!/usr/bin/env node
/** Extraction du lot 1 : aucune valeur de jeu nouvelle, aucun import du moteur.
 * Usage : node scripts/audit-degats-aura-corpus.mjs [--out chemin.json]
 * JSON tabulaire : une ligne par enregistrement, tableaux séparés par unité.
 * Les prédicats découvrent des CANDIDATS ; ils ne prouvent aucune mécanique.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out')) {
  throw new Error('Usage : node scripts/audit-degats-aura-corpus.mjs [--out chemin.json]');
}
const auditPath = 'spec/outils/optimizer/archive/audit-degats-conditionnels-2026-09-08/inventaire.csv';
const sortie = resolve(racine, args[1] ?? 'spec/outils/optimizer/archive/controles-degats-aura-2026-09/corpus-lot-1.json');
const lire = p => readFileSync(resolve(racine, p), 'utf8');
const hash = s => createHash('sha256').update(s).digest('hex');
const unique = xs => [...new Set(xs)].sort((a, b) => typeof a === 'number' ? a - b : a < b ? -1 : a > b ? 1 : 0);
const exiger = (condition, message) => { if (!condition) throw new Error(message); };

// CSV à séparateur point-virgule : guillemets doublés et retours internes conservés.
function csv(texte) {
  texte = texte.replace(/^\uFEFF/, '');
  const lignes = []; let ligne = [], champ = '', cite = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === '"') {
      if (cite && texte[i + 1] === '"') { champ += '"'; i++; }
      else cite = !cite;
    } else if (!cite && (c === ';' || c === '\n')) {
      ligne.push(champ.replace(/\r$/, '')); champ = '';
      if (c === '\n') { lignes.push(ligne); ligne = []; }
    } else champ += c;
  }
  exiger(!cite, 'CSV : guillemet non refermé');
  if (champ || ligne.length) { ligne.push(champ.replace(/\r$/, '')); lignes.push(ligne); }
  const entete = lignes.shift();
  return lignes.map((valeurs, i) => {
    exiger(valeurs.length === entete.length, `CSV : largeur invalide, ligne ${i + 2}`);
    return { ligneCsv: i + 2, ...Object.fromEntries(entete.map((cle, j) => [cle, valeurs[j]])) };
  });
}

// Lecture statique de la table TypeScript : aucune exécution de code de production.
function litteral(n) {
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return ts.isNumericLiteral(n) ? Number(n.text) : n.text;
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken) return -litteral(n.operand);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(litteral);
  if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.map(p => {
    exiger(ts.isPropertyAssignment(p), 'Table : propriété non littérale');
    return [p.name.text, litteral(p.initializer)];
  }));
  throw new Error(`Table : syntaxe non prise en charge : ${n.getText()}`);
}
const dommage = lire('src/lib/damage.ts');
const ast = ts.createSourceFile('damage.ts', dommage, ts.ScriptTarget.Latest, true);
let declaration;
function visiter(n) {
  if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'STATS_COMBAT_PAR_ID_CONNUS') declaration = n;
  ts.forEachChild(n, visiter);
}
visiter(ast);
exiger(declaration?.initializer, 'Table STATS_COMBAT_PAR_ID_CONNUS introuvable');
const table = litteral(declaration.initializer);
const ligneTable = ast.getLineAndCharacterOfPosition(declaration.getStart(ast)).line + 1;
const uiPath = 'src/components/outils/DamageSetupCard.tsx';
const ui = lire(uiPath);
function ligneUi(fragment) {
  const index = ui.indexOf(fragment);
  exiger(index >= 0, `Branche UI introuvable : ${fragment}`);
  return ui.slice(0, index).split('\n').length;
}
const branches = {
  stacks: ['compteur', 'const record = profile.source'],
  buffsPropres: ['compteur buffs propres', "const record = profile.source"],
  buffsAllies: ['compteur buffs alliés', "const record = profile.source"],
  debuffsPropres: ['compteur débuffs propres', "const record = profile.source"],
  toujours: ['Jeton toujours actif', "if (profile.source === 'toujours')"],
  debuffsInverses: ['Jeton et trois interrupteurs', "if (profile.source === 'debuffsInverses')"],
  toggle: ['PassifInterrupteur ou Jeton si condition partagée déjà affichée', "if (profile.source === 'toggle')"],
};
const audit = csv(lire(auditPath));
exiger(audit.length === 695, `Audit : ${audit.length} lignes, 695 attendues (revoir le contrat)`);
exiger(audit.every(r => /^\d+$/.test(r.entree) && /^\d+$/.test(r.skill_com2us)), 'Audit : en-têtes ou identifiants invalides');
const monstres = JSON.parse(lire('public/data/monsters.json')).monsters;
const parMonstre = new Map(monstres.map(m => [m.com2usId, m]));
exiger(parMonstre.size === monstres.length, 'Identifiants de monstres dupliqués');
const fichiers = readdirSync(resolve(racine, 'public/data/skills')).filter(f => f.endsWith('.json')).sort();
const competences = new Map();
const empreinteCorpus = createHash('sha256');
let occurrences = 0;
for (const fichier of fichiers) {
  const chemin = `public/data/skills/${fichier}`;
  const brut = lire(chemin);
  empreinteCorpus.update(chemin + '\0' + hash(brut) + '\n');
  const kit = JSON.parse(brut);
  exiger(parMonstre.has(kit.com2usId), `Forme absente de monsters.json : ${chemin}`);
  for (const s of kit.competences) {
    occurrences++;
    exiger(s.com2usId != null, `Compétence sans identifiant : ${chemin}`);
    const donnees = { skillCom2usId: s.com2usId, skillSwarfarm: s.id, nom: s.nom, slot: s.slot,
      passif: s.passif, aoe: s.aoe, coups: s.coups, formule: s.formule,
      description: s.description, ameliorations: s.ameliorations, effets: s.effets };
    const groupe = competences.get(s.com2usId) ?? { variantes: new Map(), formes: new Set() };
    const cle = JSON.stringify(donnees);
    const variante = groupe.variantes.get(cle) ?? { ...donnees, formes: [], fichiers: [] };
    variante.formes.push(kit.com2usId); variante.fichiers.push(chemin);
    groupe.variantes.set(cle, variante); groupe.formes.add(kit.com2usId);
    competences.set(s.com2usId, groupe);
  }
}

const constats = {
  bladeSurge: [151, 163, 173, 180],
  tempest: [164, 168, 178, 179, 313],
  bladeDancers: [212],
  statsCombat: [],
};
const amorces = Object.fromEntries(Object.entries(constats).map(([famille, numeros]) => [famille,
  new Set(audit.filter(r => numeros.includes(Number(r.entree))).map(r => Number(r.skill_com2us)))]));
for (const numero of Object.values(constats).flat()) exiger(audit.some(r => Number(r.entree) === numero), `Constat absent : ${numero}`);
amorces.statsCombat = new Set(Object.keys(table).map(Number));
for (const [famille, ids] of Object.entries(amorces)) for (const id of ids) exiger(competences.has(id), `${famille} : amorce absente ${id}`);
const noms = Object.fromEntries(Object.entries(amorces).map(([famille, ids]) => [famille,
  new Set([...ids].flatMap(id => [...competences.get(id).variantes.values()].map(s => s.nom)))]));
const has = (s, nom) => s.effets.some(e => e.nom === nom);
const candidats = Object.fromEntries(Object.keys(constats).map(f => [f, new Map()]));
for (const [id, groupe] of competences) {
  for (const famille of Object.keys(constats)) {
    const raisons = [];
    if (amorces[famille].has(id)) raisons.push('amorce du contrat / table existante');
    if (famille !== 'statsCombat') for (const s of groupe.variantes.values()) {
      if (noms[famille].has(s.nom)) raisons.push('nom partagé (candidature seulement)');
      if (famille === 'bladeSurge' && s.coups === 2 && s.formule === '0.5*{ATK}') raisons.push('deux coups à 0.5 ATQ (candidature seulement)');
      if (famille === 'tempest' && has(s, 'Additional Attack')) raisons.push('effet Additional Attack (candidature seulement)');
      if (famille === 'bladeDancers' && has(s, 'Ignore DEF') && has(s, 'Decrease ATB')) raisons.push('Ignore DEF et Decrease ATB (candidature seulement)');
    }
    if (raisons.length) candidats[famille].set(id, unique(raisons));
  }
}

// Les décisions sourcées seront complétées après la mesure et la lecture humaine.
function decision(famille, id) {
  if (famille === 'statsCombat') return { verdict: 'même mécanique', source: `src/lib/damage.ts:${ligneTable}`, raison: 'Appartenance à la table existante uniquement ; aucune validation des valeurs de jeu.' };
  return { verdict: 'à documenter', source: 'Extraction automatique ; lecture humaine requise', raison: 'Un prédicat de découverte ne classe pas une mécanique.' };
}
const idsRetenus = unique(Object.values(candidats).flatMap(m => [...m.keys()]));
const donneesCompetences = idsRetenus.flatMap(id => [...competences.get(id).variantes.values()].map((s, index) => ({
  ...s, variante: index + 1, formes: unique(s.formes), fichiers: unique(s.fichiers),
})));
const donneesFormes = unique(idsRetenus.flatMap(id => [...competences.get(id).formes])).map(id => {
  const m = parMonstre.get(id);
  return { monstreCom2usId: id, nom: m.name, element: m.element, secondAwaken: m.secondAwaken,
    familyId: m.familyId, skillGroupId: m.skillGroupId,
    competencesCandidates: idsRetenus.filter(skill => competences.get(skill).formes.has(id)) };
});
const lignesAudit = audit.filter(r => idsRetenus.includes(Number(r.skill_com2us)));
const configurations = Object.entries(table).flatMap(([id, configs]) => configs.map((config, index) => {
  exiger(branches[config.source], `Source inconnue : ${config.source}`);
  return { skillCom2usId: Number(id), configuration: index + 1, ...config,
    formes: unique([...competences.get(Number(id)).formes]),
    branche: branches[config.source][0], sourceRendu: `${uiPath}:${ligneUi(branches[config.source][1])}` };
}));
const familles = Object.entries(candidats).map(([famille, map]) => {
  const ids = unique([...map.keys()]);
  const lignes = audit.filter(r => ids.includes(Number(r.skill_com2us)));
  const formes = unique(ids.flatMap(id => [...competences.get(id).formes]));
  return { famille, compteurs: { lignesAudit: lignes.length, identifiantsCompetence: ids.length, formesMonstre: formes.length },
    lignesAudit: lignes.map(r => r.ligneCsv), identifiantsCompetence: ids, formesMonstre: formes };
});
const decisions = Object.entries(candidats).flatMap(([famille, map]) => unique([...map.keys()]).map(id => ({
  famille, skillCom2usId: id, decouverte: map.get(id), ...decision(famille, id),
})));
const metadonnees = { version: 1, format: 'JSON tabulaire, une ligne par enregistrement, aucune troncature',
  audit: { chemin: auditPath, sha256: hash(lire(auditPath)), lignes: audit.length },
  corpus: { fichiers: fichiers.length, occurrencesCompetence: occurrences, identifiantsCompetence: competences.size,
    sha256: empreinteCorpus.digest('hex'), protocoleHash: 'fichiers triés : chemin + NUL + SHA256(contenu UTF-8) + LF' },
  monstres: { chemin: 'public/data/monsters.json', nombre: monstres.length, sha256: hash(lire('public/data/monsters.json')) },
  table: { chemin: 'src/lib/damage.ts', ligne: ligneTable, sha256: hash(declaration.initializer.getText(ast)),
    identifiants: Object.keys(table).length, configurations: configurations.length },
  rendu: { chemin: uiPath, sha256: hash(ui) },
  limites: ['Balayage exhaustif des fichiers, découverte bornée aux amorces, noms et critères structurés déclarés dans le script.',
    'Une mécanique sans marqueur, sans nom partagé et absente des constats amorces peut échapper aux prédicats.',
    'Aucune valeur curée étendue ; aucune vérification en jeu ; aucune dépendance au moteur de recherche.'] };
const sections = { familles, decisions, lignesAudit, competences: donneesCompetences, formes: donneesFormes, configurations };
const contenu = '{\n  "metadonnees": ' + JSON.stringify(metadonnees) + ',\n' +
  Object.entries(sections).map(([nom, valeurs]) => `  "${nom}": [\n${valeurs.map(v => '    ' + JSON.stringify(v)).join(',\n')}\n  ]`).join(',\n') + '\n}\n';
mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, contenu);
const lignesUtiles = contenu.split('\n').filter(l => l.trim()).length;
console.log(JSON.stringify({ sortie: relative(racine, sortie).replaceAll('\\', '/'), octets: Buffer.byteLength(contenu), lignesUtiles,
  lectureHumaineAutorisee: lignesUtiles <= 800, sha256: hash(contenu), balayage: metadonnees.corpus,
  familles: familles.map(({ famille, compteurs }) => ({ famille, ...compteurs })),
  configurations: configurations.length }, null, 2));
if (lignesUtiles > 800) {
  console.error('ARRÊT : plus de 800 lignes utiles ; demander au pilote des sous-lots avant toute lecture humaine.');
  process.exitCode = 2;
}
