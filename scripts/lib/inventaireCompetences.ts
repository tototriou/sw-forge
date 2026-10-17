// Inventaire des compétences du corpus (`public/data/skills`), tel que
// l'APPLICATION les lit : formule et portée retenues par `src/lib/damage.ts`
// (`formuleRetenueAvecOrigine`, `porteeRetenue`), statut de calcul rendu par
// `skillDamageProfile` / `monsterOffensivePassives`, à côté de ce que dit la
// fiche SWARFARM et de la prose complète.
//
// ⚠️ **Pourquoi la formule RETENUE** : un balayage qui lisait
// `Competence.formule` seule a classé « sans ratio » deux sorts que l'app
// calcule (Purification, Cooperation! 21415, Rite of Ashes 22015 : fiche vide,
// ratio porté par leur compétence auxiliaire). Toute la logique métier vient
// de `damage.ts`, jamais recopiée ici.
//
// ⚠️ **Le module TROUVE, il ne classe pas** (skill `game-data-curation`, § 4) :
// aucun verdict, des signaux de doute nommés, chacun avec sa raison, qui disent
// quelle compétence lire à la main. Un signal n'est pas une erreur ; son
// absence n'est pas une preuve. Les mots-clés de prose (`MOTS_CLES_D_EFFET`)
// sont un repérage à relire, jamais un discriminant.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Competence, DetailMonstre } from '../../src/lib/monsterSkills';
import {
  estPrisEnCharge,
  formuleRetenueAvecOrigine,
  monsterOffensivePassives,
  porteeRetenue,
  skillDamageProfile,
  type OrigineFormuleRetenue,
} from '../../src/lib/damage';
import { estEveille, estObtenable } from '../../src/lib/monsterForms';
import type { Monster } from '../../src/types';

export type CodeSignal =
  | 'formule-fiche-vide'
  | 'formule-fiche-remplacee'
  | 'auxiliaire-non-retenue'
  | 'formule-sans-calcul'
  | 'ally-attack-sans-formule'
  | 'portee-corrigee'
  | 'coups-zero-avec-formule'
  | 'mot-cle-sans-effet'
  | 'fiches-divergentes';

/** Ce que chaque signal relève, pour `--aide` et la documentation. */
export const SIGNAUX: Record<CodeSignal, string> = {
  'formule-fiche-vide': 'fiche à formule vide, formule retenue présente (table curée ou compétence auxiliaire)',
  'formule-fiche-remplacee': 'fiche à formule, remplacée par une formule curée différente',
  'auxiliaire-non-retenue': 'aucune formule retenue alors qu’une auxiliaire `versCeSort` porte une formule',
  'formule-sans-calcul': 'formule retenue présente, mais l’app ne calcule pas la compétence (masquée, refusée, passif non offensif)',
  'ally-attack-sans-formule': 'effet `Ally Attack` sans formule retenue',
  'portee-corrigee': 'portée retenue différente de la portée de la fiche',
  'coups-zero-avec-formule': '`coups` à 0 ou absent, avec une formule retenue',
  'mot-cle-sans-effet': 'la prose du sort porte un mot-clé sans l’effet qui lui correspond',
  'fiches-divergentes': 'le même identifiant porte des données différentes selon la fiche de monstre',
};

export interface Signal {
  code: CodeSignal;
  raison: string;
}

export interface PorteurCompetence {
  fiche: number; // com2usId du monstre (nom du fichier)
  nom: string | null; // null : fiche sans monstre dans monsters.json
  element: string | null;
  jouable: boolean; // obtenable ET éveillé, au sens du Bestiaire
  jumeauCollab: { com2usId: number; nom: string | null } | null;
}

export type CalculApplication =
  | { statut: 'profil'; coups: number; coupsVariables?: { min: number; max: number }; portee: boolean }
  | { statut: 'refus'; raison: string }
  | { statut: 'sans-profil' }
  | { statut: 'passif-offensif'; categories: string[] }
  | { statut: 'passif-non-offensif' };

export interface ProseCompetence {
  description: string | null;
  effets: { nom: string | null; description: string | null; note: string | null }[];
  ameliorations: string[];
  auxiliaires: { com2usId: number | null; nom: string; sens: string; formule: string; description: string | null }[];
}

export interface EntreeInventaire {
  com2usId: number;
  nom: string;
  slot: number | null;
  passif: boolean;
  porteurs: PorteurCompetence[];
  formuleFiche: string;
  formuleRetenue: string;
  origineFormule: OrigineFormuleRetenue | null;
  porteeFiche: boolean;
  porteeRetenue: boolean;
  coupsFiche: number | null;
  effets: (string | null)[];
  prose: ProseCompetence;
  calcul: CalculApplication;
  signaux: Signal[];
}

export interface OptionsInventaire {
  racine?: string; // racine du dépôt, défaut : le dossier courant
  ids?: number[];
  effet?: string; // nom exact d'un effet, casse ignorée
  prose?: string; // mot cherché dans toute la prose, casse ignorée
  slot?: number;
  monstre?: string; // nom (sous-chaîne, casse ignorée) ou com2usId d'une fiche
  signal?: CodeSignal | 'tous';
}

// Mots de prose qui désignent un effet que l'app lit par son NOM. Repérage à
// relire, jamais une règle : la prose ne se classe pas par expression
// régulière (game-data-curation, § 4). Lue sur la description du sort seule
// (la description d'un effet répète son nom).
const MOTS_CLES_D_EFFET: { mot: string; motif: RegExp; effet: string }[] = [
  { mot: 'together', motif: /\btogether\b/i, effet: 'Ally Attack' },
  { mot: 'ignore … DEF', motif: /\bignor(?:e|es|ing)\b[^.]*?\b(?:DEF|Defense)\b/i, effet: 'Ignore DEF' },
  { mot: 'bomb', motif: /\bbombs?\b/i, effet: 'Bomb' },
];

function calculDe(c: Competence, fiches: DetailMonstre[]): CalculApplication {
  if (c.passif) {
    const categories = new Set<string>();
    for (const d of fiches) {
      for (const p of monsterOffensivePassives(d)) {
        if (p.profile.skillCom2usId !== c.com2usId) continue;
        const k = p.categorie;
        categories.add(k.type === 'toujours' ? k.type : `${k.type} : ${k.condition}`);
      }
    }
    return categories.size ? { statut: 'passif-offensif', categories: [...categories] } : { statut: 'passif-non-offensif' };
  }
  const p = skillDamageProfile(c);
  if (!p) return { statut: 'sans-profil' };
  if (!estPrisEnCharge(p)) return { statut: 'refus', raison: p.raison };
  return { statut: 'profil', coups: p.hits, ...(p.hitsRange ? { coupsVariables: p.hitsRange } : {}), portee: p.aoe };
}

function signauxDe(c: Competence, e: Omit<EntreeInventaire, 'signaux'>, divergente: number[]): Signal[] {
  const s: Signal[] = [];
  const nomsEffets = new Set(c.effets.map((x) => x.nom));
  if (!e.formuleFiche && e.formuleRetenue) {
    s.push({ code: 'formule-fiche-vide', raison: `fiche vide, formule retenue \`${e.formuleRetenue}\` (${e.origineFormule})` });
  }
  if (e.formuleFiche && e.origineFormule === 'curee' && e.formuleFiche !== e.formuleRetenue) {
    s.push({ code: 'formule-fiche-remplacee', raison: `fiche \`${e.formuleFiche}\`, formule curée \`${e.formuleRetenue}\`` });
  }
  if (!e.formuleRetenue) {
    const aux = (c.auxiliaires ?? []).filter((a) => a.sens === 'versCeSort' && (a.competence.formule ?? '').trim());
    if (aux.length) {
      s.push({
        code: 'auxiliaire-non-retenue',
        raison: `${aux.length} auxiliaire(s) \`versCeSort\` à formule (${aux.map((a) => `${a.competence.com2usId} \`${(a.competence.formule ?? '').trim()}\``).join(', ')}), aucune retenue`,
      });
    }
  }
  if (e.formuleRetenue && e.calcul.statut !== 'profil' && e.calcul.statut !== 'passif-offensif') {
    const detail =
      e.calcul.statut === 'refus' ? `refusée : ${e.calcul.raison}`
        : e.calcul.statut === 'sans-profil' ? 'sort sans profil (soin, sans attaque ou masqué)'
          : 'passif hors des passifs offensifs';
    s.push({ code: 'formule-sans-calcul', raison: `formule retenue \`${e.formuleRetenue}\`, ${detail}` });
  }
  if (nomsEffets.has('Ally Attack') && !e.formuleRetenue) {
    s.push({ code: 'ally-attack-sans-formule', raison: 'effet `Ally Attack`, aucune formule retenue (fiche, table curée, auxiliaire)' });
  }
  if (e.porteeRetenue !== e.porteeFiche) {
    s.push({ code: 'portee-corrigee', raison: `fiche ${e.porteeFiche ? 'zone' : 'mono-cible'}, retenue ${e.porteeRetenue ? 'zone' : 'mono-cible'}` });
  }
  if (e.formuleRetenue && !(e.coupsFiche && e.coupsFiche > 0)) {
    s.push({ code: 'coups-zero-avec-formule', raison: `coups de la fiche : ${e.coupsFiche}, formule retenue \`${e.formuleRetenue}\`` });
  }
  for (const m of MOTS_CLES_D_EFFET) {
    if (m.motif.test(c.description ?? '') && !nomsEffets.has(m.effet)) {
      s.push({ code: 'mot-cle-sans-effet', raison: `prose « ${m.mot} », sans l’effet \`${m.effet}\`` });
    }
  }
  if (divergente.length) {
    s.push({ code: 'fiches-divergentes', raison: `données différentes dans les fiches ${divergente.join(', ')}` });
  }
  return s;
}

function lireMonstres(racine: string): Map<number, Monster> {
  const brut = JSON.parse(readFileSync(join(racine, 'public/data/monsters.json'), 'utf8'));
  const liste: Monster[] = Array.isArray(brut) ? brut : brut.monsters;
  const m = new Map<number, Monster>();
  for (const x of liste) if (x.com2usId != null) m.set(x.com2usId, x);
  return m;
}

/**
 * Une entrée par compétence distincte (`com2usId`) du corpus, triées par
 * identifiant, filtrées par `options` (filtres combinés). La première fiche
 * lue fait foi pour les données ; une fiche qui en diverge est signalée.
 */
export function inventaireDesCompetences(options: OptionsInventaire = {}): EntreeInventaire[] {
  const racine = options.racine ?? process.cwd();
  const dossier = join(racine, 'public/data/skills');
  const monstres = lireMonstres(racine);

  const parId = new Map<number, { c: Competence; empreinte: string; fiches: DetailMonstre[]; divergentes: number[] }>();
  for (const f of readdirSync(dossier).sort()) {
    if (!f.endsWith('.json')) continue;
    const d: DetailMonstre = JSON.parse(readFileSync(join(dossier, f), 'utf8'));
    for (const c of d.competences) {
      if (c.com2usId == null) continue;
      const empreinte = JSON.stringify({ ...c, id: undefined });
      const vu = parId.get(c.com2usId);
      if (!vu) parId.set(c.com2usId, { c, empreinte, fiches: [d], divergentes: [] });
      else {
        vu.fiches.push(d);
        if (vu.empreinte !== empreinte) vu.divergentes.push(d.com2usId);
      }
    }
  }

  const effet = options.effet?.toLowerCase();
  const prose = options.prose?.toLowerCase();
  const monstre = options.monstre?.trim().toLowerCase();
  const ids = options.ids ? new Set(options.ids) : null;

  const out: EntreeInventaire[] = [];
  for (const [id, { c, fiches, divergentes }] of [...parId].sort((a, b) => a[0] - b[0])) {
    if (ids && !ids.has(id)) continue;
    if (options.slot != null && c.slot !== options.slot) continue;
    if (effet && !c.effets.some((e) => (e.nom ?? '').toLowerCase() === effet)) continue;

    const porteurs: PorteurCompetence[] = fiches.map((d) => {
      const m = monstres.get(d.com2usId);
      const jumeau = m?.jumeauCollab != null ? monstres.get(m.jumeauCollab) : undefined;
      return {
        fiche: d.com2usId,
        nom: m?.name ?? null,
        element: m?.element ?? null,
        jouable: m ? estObtenable(m) && estEveille(m) : false,
        jumeauCollab: m?.jumeauCollab != null ? { com2usId: m.jumeauCollab, nom: jumeau?.name ?? null } : null,
      };
    });
    if (monstre && !porteurs.some((p) => String(p.fiche) === monstre || (p.nom ?? '').toLowerCase().includes(monstre))) continue;

    const textes: ProseCompetence = {
      description: c.description,
      effets: c.effets.map((e) => ({ nom: e.nom, description: e.description, note: e.note })),
      ameliorations: c.ameliorations.map((a) => a.trim()),
      auxiliaires: (c.auxiliaires ?? []).map((a) => ({
        com2usId: a.competence.com2usId,
        nom: a.competence.nom,
        sens: a.sens,
        formule: (a.competence.formule ?? '').trim(),
        description: a.competence.description,
      })),
    };
    if (prose) {
      const tout = [
        textes.description,
        ...textes.effets.flatMap((e) => [e.description, e.note]),
        ...textes.ameliorations,
        ...textes.auxiliaires.map((a) => a.description),
      ].join('\n').toLowerCase();
      if (!tout.includes(prose)) continue;
    }

    const { formule, origine } = formuleRetenueAvecOrigine(c);
    const base: Omit<EntreeInventaire, 'signaux'> = {
      com2usId: id,
      nom: c.nom,
      slot: c.slot,
      passif: c.passif,
      porteurs,
      formuleFiche: (c.formule ?? '').trim(),
      formuleRetenue: formule,
      origineFormule: origine,
      porteeFiche: c.aoe,
      porteeRetenue: porteeRetenue(c),
      coupsFiche: c.coups,
      effets: c.effets.map((e) => e.nom),
      prose: textes,
      calcul: calculDe(c, fiches),
    };
    const signaux = signauxDe(c, base, divergentes);
    if (options.signal === 'tous' && !signaux.length) continue;
    if (options.signal && options.signal !== 'tous' && !signaux.some((x) => x.code === options.signal)) continue;
    out.push({ ...base, signaux });
  }
  return out;
}

const portee = (zone: boolean) => (zone ? 'zone' : 'mono-cible');

function calculLisible(k: CalculApplication): string {
  switch (k.statut) {
    case 'profil':
      return `profil de dégâts, ${k.coupsVariables ? `${k.coupsVariables.min} à ${k.coupsVariables.max} coups (retenu ${k.coups})` : `${k.coups} coup(s)`}, ${portee(k.portee)}`;
    case 'refus':
      return `refusé : ${k.raison}`;
    case 'sans-profil':
      return 'aucun profil (sort sans dégâts calculés)';
    case 'passif-offensif':
      return `passif offensif (${k.categories.join(', ')})`;
    case 'passif-non-offensif':
      return 'passif hors des passifs offensifs';
  }
}

const cite = (t: string | null) => (t ?? '').trim().split(/\r?\n/).map((l) => `> ${l}`).join('\n');

/** Une section Markdown par compétence, prose complète. */
export function inventaireEnMarkdown(entrees: EntreeInventaire[], entete = ''): string {
  const l: string[] = [`# Inventaire des compétences — ${entrees.length} compétence(s)`, ''];
  if (entete) l.push(entete, '');
  for (const e of entrees) {
    l.push(`## ${e.com2usId} · ${e.nom} (S${e.slot ?? '?'}${e.passif ? ', passif' : ''})`, '');
    const porteurs = e.porteurs.map((p) => {
      const collab = p.jumeauCollab ? `, collab ↔ ${p.jumeauCollab.nom ?? '?'} ${p.jumeauCollab.com2usId}` : '';
      return `${p.nom ?? '(monstre absent)'} — ${p.element ?? '?'}, fiche ${p.fiche}${p.jouable ? '' : ', non jouable'}${collab}`;
    });
    l.push(`- **Porté par** : ${porteurs.join(' ; ')}`);
    l.push(`- **Formule de la fiche** : ${e.formuleFiche ? `\`${e.formuleFiche}\`` : '(vide)'}`);
    l.push(`- **Formule retenue** : ${e.formuleRetenue ? `\`${e.formuleRetenue}\` (${e.origineFormule})` : '(aucune)'}`);
    l.push(`- **Portée** : fiche ${portee(e.porteeFiche)}, retenue ${portee(e.porteeRetenue)}`);
    l.push(`- **Coups de la fiche** : ${e.coupsFiche ?? '(absent)'}`);
    l.push(`- **Calcul de l’app** : ${calculLisible(e.calcul)}`);
    l.push(`- **Effets** : ${e.effets.length ? e.effets.map((x) => `\`${x}\``).join(', ') : '(aucun)'}`);
    l.push(`- **Signaux** :${e.signaux.length ? '' : ' (aucun)'}`);
    for (const s of e.signaux) l.push(`  - \`${s.code}\` — ${s.raison}`);
    l.push('', '**Description**', '', cite(e.prose.description) || '> (vide)');
    if (e.prose.effets.length) {
      l.push('', '**Effets**', '');
      for (const x of e.prose.effets) l.push(`- \`${x.nom}\` — ${(x.description ?? '').trim()}${x.note ? ` (note : ${x.note.trim()})` : ''}`);
    }
    if (e.prose.ameliorations.length) {
      l.push('', '**Améliorations**', '');
      for (const a of e.prose.ameliorations) l.push(`- ${a}`);
    }
    if (e.prose.auxiliaires.length) {
      l.push('', '**Compétences auxiliaires**', '');
      for (const a of e.prose.auxiliaires) {
        l.push(`- ${a.com2usId} · ${a.nom} (\`${a.sens}\`) · ${a.formule ? `\`${a.formule}\`` : '(sans formule)'}`);
        if (a.description) l.push(`  ${cite(a.description).replace(/\n/g, '\n  ')}`);
      }
    }
    l.push('');
  }
  return l.join('\n');
}
