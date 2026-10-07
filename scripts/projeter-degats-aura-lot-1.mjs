#!/usr/bin/env node
/** Projections canoniques depuis le corpus figé. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpusRelatif = 'spec/outils/optimizer/archive/controles-degats-aura-2026-09/corpus-lot-1.json';
const dossierRelatif = 'spec/outils/optimizer/archive/controles-degats-aura-2026-09';
const empreinteAttendue = 'e14d2259f1a7501dee37f34d15c1dbb4d042db31c334f870989b64f6a38d5f34';
const sha256 = texte => createHash('sha256').update(texte).digest('hex');
const exiger = (condition, message) => { if (!condition) throw new Error(message); };
const comparerId = (a, b) => a.skillCom2usId - b.skillCom2usId;

const brut = readFileSync(resolve(racine, corpusRelatif), 'utf8');
exiger(sha256(brut) === empreinteAttendue, 'Le corpus du lot 1a ne porte pas l’empreinte attendue.');
const corpus = JSON.parse(brut);
const decisions = [...corpus.decisions].sort(comparerId);

const deFamille = famille => decisions.filter(d => d.famille === famille);
const tempest = deFamille('tempest');
const tempestAmorces = tempest.filter(d =>
  d.decouverte.includes('amorce du contrat / table existante') ||
  d.decouverte.includes('nom partagé (candidature seulement)'));
const tempestAdditionnels = tempest.filter(d =>
  !d.decouverte.includes('amorce du contrat / table existante') &&
  !d.decouverte.includes('nom partagé (candidature seulement)') &&
  d.decouverte.includes('effet Additional Attack (candidature seulement)'));

exiger(tempestAmorces.length === 22, `Tempest amorces/noms : ${tempestAmorces.length}, 22 attendus.`);
exiger(tempestAdditionnels.length === 118, `Tempest Additional Attack : ${tempestAdditionnels.length}, 118 attendus.`);

const groupes = [
  { lot: '1b', famille: 'bladeSurge', decisions: deFamille('bladeSurge') },
  { lot: '1c1', famille: 'tempest', decisions: tempestAmorces },
  { lot: '1c2', famille: 'tempest', decisions: tempestAdditionnels.slice(0, 59) },
  { lot: '1c3', famille: 'tempest', decisions: tempestAdditionnels.slice(59) },
  { lot: '1d', famille: 'bladeDancers', decisions: deFamille('bladeDancers') },
  { lot: '1e', famille: 'statsCombat', decisions: deFamille('statsCombat') },
];

function serialiserTabulaire(meta, sections) {
  return '{\n  "metadonnees": ' + JSON.stringify(meta) + ',\n' +
    Object.entries(sections).map(([nom, valeurs]) =>
      `  ${JSON.stringify(nom)}: [\n${valeurs.map(v => '    ' + JSON.stringify(v)).join(',\n')}\n  ]`).join(',\n') +
    '\n}\n';
}

function projection(groupe) {
  const ids = groupe.decisions.map(d => d.skillCom2usId).sort((a, b) => a - b);
  const ensemble = new Set(ids);
  const couplesAttendus = ids.map(skillCom2usId => ({ famille: groupe.famille, skillCom2usId }));
  const competences = corpus.competences.filter(c => ensemble.has(c.skillCom2usId));
  const formes = corpus.formes.filter(f => f.competencesCandidates.some(id => ensemble.has(id))).map(f => ({
    ...f,
    competencesCandidates: f.competencesCandidates.filter(id => ensemble.has(id)),
  }));
  const lignesAudit = corpus.lignesAudit.filter(l => ensemble.has(Number(l.skill_com2us)));
  const configurations = groupe.lot === '1e'
    ? corpus.configurations.filter(c => ensemble.has(c.skillCom2usId))
    : [];
  const sections = { couplesAttendus, candidats: groupe.decisions, competences, formes, lignesAudit, configurations };
  const compteurs = Object.fromEntries(Object.entries(sections).map(([nom, valeurs]) => [nom, valeurs.length]));
  const texte = serialiserTabulaire({
    version: 1,
    lot: groupe.lot,
    famille: groupe.famille,
    corpus: corpusRelatif,
    sha256Corpus: empreinteAttendue,
    format: 'JSON tabulaire ; une ligne par enregistrement ; tableaux triés',
    compteurs,
  }, sections);
  return { texte, couplesAttendus, compteurs };
}

const sortie = resolve(racine, dossierRelatif);
mkdirSync(sortie, { recursive: true });
const resultats = [];
const tousLesCouples = [];
for (const groupe of groupes) {
  const produit = projection(groupe);
  const fichier = `projection-lot-${groupe.lot}.json`;
  writeFileSync(resolve(sortie, fichier), produit.texte);
  const lignesUtiles = produit.texte.split('\n').filter(l => l.trim()).length;
  resultats.push({
    lot: groupe.lot,
    famille: groupe.famille,
    fichier,
    sha256: sha256(produit.texte),
    octets: Buffer.byteLength(produit.texte),
    lignesUtiles,
    compteurs: produit.compteurs,
  });
  tousLesCouples.push(...produit.couplesAttendus.map(c => ({ lot: groupe.lot, ...c })));
}

const cles = tousLesCouples.map(c => `${c.famille}:${c.skillCom2usId}`);
exiger(cles.length === 197, `Manifeste : ${cles.length} couples, 197 attendus.`);
exiger(new Set(cles).size === 197, 'Manifeste : couple famille/identifiant dupliqué.');

const manifeste = {
  version: 1,
  corpus: corpusRelatif,
  sha256Corpus: empreinteAttendue,
  schemaDecision: {
    champsObligatoires: [
      'famille', 'skillCom2usId', 'verdict', 'justification', 'sources',
      'lignesAudit', 'formes', 'incertitudes',
    ],
    verdicts: ['même mécanique', 'même architecture', 'hors famille', 'à documenter'],
    forme: ['monstreCom2usId', 'nom', 'element'],
    supplement1e: ['configurations'],
  },
  projections: resultats,
  couplesAttendus: tousLesCouples,
};
const texteManifeste = JSON.stringify(manifeste, null, 2) + '\n';
writeFileSync(resolve(sortie, 'manifest-lot-1.json'), texteManifeste);

console.log(JSON.stringify({
  corpus: { sha256: empreinteAttendue },
  manifeste: {
    fichier: `${dossierRelatif}/manifest-lot-1.json`,
    sha256: sha256(texteManifeste),
    couples: tousLesCouples.length,
  },
  projections: resultats,
}, null, 2));
