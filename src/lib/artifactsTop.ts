// Le top des artéfacts par propriété secondaire — la vue « Top 10 » de Mon
// compte › Artéfacts (docs/02-app/compte/feat-artefacts.md § Top 10).
//
// Pour un groupe d'artéfacts (un attribut ou un type, intangibles compris), chaque
// propriété portée devient une COLONNE : ses meilleures valeurs, triées. Les
// colonnes se rangent par FAMILLE (dégâts reçus d'abord, puis l'ordre de la
// recherche du jeu).
//
// ⚠️ **On classe la valeur brute de la ligne, propriété par propriété.** Deux
// propriétés n'ont pas d'échelle commune (docs/02-app/compte/feat-calcul-artefacts.md) :
// la vue ne compare jamais une colonne à une autre, seulement les artéfacts
// entre eux sur UNE propriété.

import { ArtifactArchetype, ArtifactDetail, ElementKey } from '../types';
import { ARTIFACT_SUB, artifactSubKinds, artifactSubName, artifactSubOrder, isArtifactSub } from './effects';
import { artifactScore } from './artifacts';

// Le groupe montré : un attribut ou un type.
export type GroupeTop = Exclude<ElementKey, 'unknown'> | ArtifactArchetype;

const ELEMENTS_TOP: GroupeTop[] = ['water', 'fire', 'wind', 'light', 'dark'];

export const GROUPES_TOP: { key: GroupeTop; label: string }[] = [
  { key: 'water', label: 'Eau' },
  { key: 'fire', label: 'Feu' },
  { key: 'wind', label: 'Vent' },
  { key: 'light', label: 'Lumière' },
  { key: 'dark', label: 'Ténèbres' },
  { key: 'attack', label: 'Attaque' },
  { key: 'defense', label: 'Défense' },
  { key: 'hp', label: 'PV' },
  { key: 'support', label: 'Support' },
];

export const TAILLE_TOP = 10;

export const estGroupeElement = (g: GroupeTop): g is Exclude<ElementKey, 'unknown'> => ELEMENTS_TOP.includes(g);

// ⚠️ **Un intangible compte dans TOUS les groupes de sa sorte** : il se pose
// sur n'importe quel monstre, donc un intangible d'attribut est une pièce
// pour l'Eau comme pour le Feu. Son attribut ou son type lu ne veut rien dire
// (com2us envoie 98) : on ne s'en sert jamais.
export function dansGroupe(art: ArtifactDetail, groupe: GroupeTop): boolean {
  const groupeElement = estGroupeElement(groupe);
  if (art.intangible) return (art.kind === 'element') === groupeElement;
  return art.kind === 'element' ? art.element === groupe : art.archetype === groupe;
}

// Les familles de colonnes, dans l'ordre de la « Recherche détaillée de
// sous-propriétés » du jeu (`SUB_ORDER`, effects.ts) — sauf les dégâts
// reçus, passés devant (voir `FAMILLES`).
//
// ⚠️ **Le nom EN ENTIER dans le titre du tableau, le seul élément qui varie
// dans la colonne** : « Augmentation des dégâts infligés », puis « Feu »,
// « Eau »… Le jeu abrège ses libellés (« Aug. des dgts infl. au Feu ») faute
// de place sur sa fiche ; ici, le titre a la place, et répété dans cinq
// colonnes le nom noyait ce qui les distingue. Une colonne sans élément
// propre (`entete` absent) prend le nom complet de la propriété
// (`artifactSubName`), sur plusieurs lignes.
interface FamilleDef {
  titre: string;
  colonnes: { code: number; entete?: string }[];
}

const PAR_ELEMENT = (base: number) => [
  { code: base, entete: 'Feu' },
  { code: base + 1, entete: 'Eau' },
  { code: base + 2, entete: 'Vent' },
  { code: base + 3, entete: 'Lumière' },
  { code: base + 4, entete: 'Ténèbres' },
];

const PAR_COMPETENCE = (base: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ code: base + i, entete: `[Comp.${i + 1}]` }));

// ⚠️ **Les dégâts REÇUS d'abord**, puis les infligés — l'inverse de la
// recherche du jeu, à dessein : c'est la ligne qu'on cherche d'abord sur un
// artéfact d'attribut (choix de Thomas). Le reste suit l'ordre du jeu.
const FAMILLES: FamilleDef[] = [
  { titre: 'Réduction des dégâts reçus', colonnes: PAR_ELEMENT(305) },
  { titre: 'Augmentation des dégâts infligés', colonnes: PAR_ELEMENT(300) },
  {
    titre: 'Augmentation des dégâts critiques',
    colonnes: [...PAR_COMPETENCE(400, 4), { code: 410, entete: '[Comp.3/4]' }, { code: 411, entete: '1re attaque' }],
  },
  { titre: 'Augmentation des soins', colonnes: PAR_COMPETENCE(404, 3) },
  { titre: 'Augmentation de la précision', colonnes: PAR_COMPETENCE(407, 3) },
  {
    titre: 'Effet de renforcement',
    colonnes: [
      { code: 226, entete: 'ATQ/DEF' },
      { code: 204, entete: 'ATQ' },
      { code: 205, entete: 'DEF' },
    ],
  },
  {
    titre: 'Dégâts supplémentaires en proportion de',
    colonnes: [
      { code: 218, entete: 'PV' },
      { code: 219, entete: 'ATQ' },
      { code: 220, entete: 'DEF' },
      { code: 221, entete: 'VIT' },
    ],
  },
  { titre: 'Dégâts critiques selon la cible', colonnes: [{ code: 222 }, { code: 223 }, { code: 224 }] },
];

// Tout le reste tombe ici, comme sous « Autres sous-propriétés » dans le jeu.
export const TITRE_AUTRES = 'Autres sous-propriétés';

export interface CelluleTop {
  art: ArtifactDetail;
  valeur: number;
}

export interface ColonneTop {
  code: number;
  entete: string;
  // L'en-tête est l'élément qui varie (« Feu »), pas le nom complet : il
  // tient sur une ligne.
  court: boolean;
  cellules: CelluleTop[];
}

export interface FamilleTop {
  titre: string;
  colonnes: ColonneTop[];
}

// Les stats principales d'artéfact, dans l'ordre du jeu : 100 PV, 101 ATQ,
// 102 DEF.
export const PRINCIPALES = [100, 101, 102] as const;

// Un artéfact retenu par le filtre de stat principale : `null` = toutes,
// sinon les codes COCHÉS — une liste blanche, cumulable (PV et DEF ensemble).
export const dePrincipale = (art: ArtifactDetail, principales: readonly number[] | null): boolean =>
  principales === null || principales.includes(art.main.code);

// Les familles du groupe : TOUTES celles que sa sorte peut porter, avec
// toutes leurs colonnes, même vides.
//
// ⚠️ **Les tableaux ne bougent jamais d'un groupe ou d'un filtre à l'autre** :
// une colonne vide se lit (« je n'ai rien là »), alors qu'une colonne qui
// disparaît décale les autres et ne dit pas ce qui manque. Seules les
// propriétés IMPOSSIBLES pour la sorte sont écartées (`artifactSubKinds`) : un
// artéfact d'attribut ne porte jamais « Aug. des soins », ce tableau serait
// vide à jamais. Une colonne a donc de 0 à `taille` valeurs ; l'écran
// complète avec des cases vides.
//
// `principales` : ne garder que les artéfacts de ces stats principales — « mes
// réductions de dégâts reçus, sur des artéfacts PV ou DEF ». Vide : rien.
export function topParPropriete(
  artifacts: ArtifactDetail[],
  groupe: GroupeTop,
  principales: readonly number[] | null = null,
  taille = TAILLE_TOP
): FamilleTop[] {
  const parCode = new Map<number, CelluleTop[]>();
  for (const art of artifacts) {
    if (!dansGroupe(art, groupe) || !dePrincipale(art, principales)) continue;
    for (const s of art.subs) {
      if (!isArtifactSub(s.code)) continue;
      const liste = parCode.get(s.code) ?? [];
      liste.push({ art, valeur: s.value });
      parCode.set(s.code, liste);
    }
  }

  // ⚠️ Ex æquo départagés par le SCORE de l'artéfact, puis son identifiant :
  // deux « +20 % » se valent sur la colonne, mais le mieux tombé dans
  // l'ensemble passe devant — et l'ordre ne change pas d'un rendu à l'autre.
  const scores = new Map<ArtifactDetail, number>();
  const score = (a: ArtifactDetail) => {
    let s = scores.get(a);
    if (s === undefined) scores.set(a, (s = artifactScore(a)));
    return s;
  };
  const colonne = (code: number, entete?: string): ColonneTop => ({
    code,
    entete: entete ?? artifactSubName(code),
    court: entete !== undefined,
    cellules: (parCode.get(code) ?? [])
      .sort((x, y) => y.valeur - x.valeur || score(y.art) - score(x.art) || x.art.id - y.art.id)
      .slice(0, taille),
  });

  const sorte = estGroupeElement(groupe) ? 'element' : 'archetype';
  const possible = (code: number) => artifactSubKinds(code).includes(sorte);
  const ranges = new Set<number>();
  const familles: FamilleTop[] = [];
  for (const f of FAMILLES) {
    const colonnes = f.colonnes.filter((c) => possible(c.code)).map((c) => colonne(c.code, c.entete));
    for (const c of f.colonnes) ranges.add(c.code);
    if (colonnes.length > 0) familles.push({ titre: f.titre, colonnes });
  }
  const autres = Object.keys(ARTIFACT_SUB)
    .map(Number)
    .filter((code) => possible(code) && !ranges.has(code))
    .sort((a, b) => artifactSubOrder(a) - artifactSubOrder(b))
    .map((code) => colonne(code));
  if (autres.length > 0) familles.push({ titre: TITRE_AUTRES, colonnes: autres });
  return familles;
}

// Le nombre d'artéfacts de chaque groupe — la pastille d'un groupe vide reste
// affichée, désactivée.
export function effectifsGroupes(artifacts: ArtifactDetail[]): Record<GroupeTop, number> {
  const n = Object.fromEntries(GROUPES_TOP.map((g) => [g.key, 0])) as Record<GroupeTop, number>;
  for (const art of artifacts) for (const g of GROUPES_TOP) if (dansGroupe(art, g.key)) n[g.key]++;
  return n;
}
