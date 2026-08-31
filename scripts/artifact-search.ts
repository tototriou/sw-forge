// Meilleure PAIRE D'ARTÉFACTS pour un build DONNÉ, sur un compte réel.
//
// Le build de runes ne bouge pas : on cherche seulement quels deux artéfacts
// de l'inventaire maximisent les dégâts du sort choisi. Voir
// `artifactOptim.ts` pour le moteur, et spec/outils/degats-reels.md pour ce
// que chaque ligne d'artéfact fait au calcul.
//
// ⚠️ **Ce script sert AUSSI de vérification de bout en bout** : c'est le
// premier chemin qui fait travailler ensemble, sur de la vraie donnée,
// l'éligibilité (élément/archétype/intangible), la contrainte de paire, et
// les neuf familles de lignes du modèle de dégâts.
//
// Usage :
//   npx esbuild scripts/artifact-search.ts --bundle --platform=node \
//     --format=cjs --outfile=/tmp/as.cjs && node /tmp/as.cjs <export.json> <monstre> [options]
//
// Options :
//   --sort=<slot>        slot du sort visé (défaut : le dernier, comme l'écran)
//   --element=<clé>      élément de la cible (fire|water|wind|light|dark) ;
//                        absent = « ignorer l'élément », les lignes 300-304
//                        comptent 0
//   --def=<n>            DEF de l'adversaire (défaut : celle de l'écran)
//   --crit=<mode>        moyenne|crit|normal (défaut : moyenne)
//   --attribut=<choix>   equipped|none|libre|100|101|102 (défaut : libre)
//   --type=<choix>       idem pour l'artéfact de type
//   --top=<n>            nombre de paires à afficher (défaut : 5)

import { loadBoxMonster, printMonsterSummary } from './lib/loadMonster';
import { loadMonsterSkills } from './lib/skillsData';
import { loadMonstersList } from './lib/monstersData';
import { meilleuresPairesArtefacts, nombreDePaires, type ArtifactSearchParams, type ChoixPrincipale } from '../src/lib/artifactOptim';
import { artifactDamageProfile, computeTotalDamage, monsterDamageSkills, monsterOffensivePassives, DEFAULT_DAMAGE_SETUP, type DamageSetup, type SkillDamageProfile } from '../src/lib/damage';
import { computeStats } from '../src/lib/stats';
import { artifactSubName } from '../src/lib/effects';
import { ARTIFACT_KINDS, type ArtifactDetail, type ArtifactKind, type ElementKey } from '../src/types';

const libres = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [exportPath, monsterName] = libres;
const opt = (nom: string) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);

if (!exportPath || !monsterName) {
  console.error('Usage: artifact-search.ts <export.json> <monstre> [--sort=N] [--element=fire] [--def=N] [--crit=moyenne] [--attribut=libre] [--type=libre] [--top=5]');
  process.exit(1);
}

const loaded = loadBoxMonster(exportPath, monsterName);
printMonsterSummary('artefacts', loaded);

const fiche = loadMonsterSkills(loaded.com2usId);
const espece = loadMonstersList().find((m) => m.com2usId === loaded.com2usId);
if (!espece) throw new Error(`Monstre ${loaded.com2usId} absent du bestiaire.`);

// ⚠️ L'archétype décide de l'éligibilité de l'artéfact de TYPE — sans lui,
// aucun n'est éligible. On le dit plutôt que de rendre une liste vide sans
// explication (cas des monstres de matériau, ou d'un monsters.json ancien).
const porteur = { element: espece.element, archetype: espece.archetype };
if (!porteur.archetype) {
  console.warn(`⚠️  ${monsterName} n'a pas d'archétype connu : AUCUN artéfact de type ne lui sera proposé.`);
}

const sorts = monsterDamageSkills(fiche).filter((s): s is SkillDamageProfile => 'noeud' in s);
if (sorts.length === 0) throw new Error(`Aucun sort calculable pour ${monsterName}.`);
const slotVoulu = opt('sort') ? Number(opt('sort')) : null;
const sort = (slotVoulu != null ? sorts.find((s) => s.slot === slotVoulu) : null) ?? sorts[sorts.length - 1]!;

const setup: DamageSetup = {
  ...DEFAULT_DAMAGE_SETUP,
  ...(opt('def') ? { enemyDef: Number(opt('def')) } : {}),
  ...(opt('crit') ? { critMode: opt('crit') as DamageSetup['critMode'] } : {}),
  enemyElement: (opt('element') as ElementKey | undefined) ?? null,
};

const choix = (v: string | undefined): ChoixPrincipale =>
  v === 'equipped' || v === 'none' || v === 'libre' ? v : v ? (Number(v) as 100 | 101 | 102) : 'libre';

const passifs = monsterOffensivePassives(fiche);

// ⚠️ Les stats sont RECALCULÉES pour chaque paire : la stat principale d'un
// artéfact entre dans les stats du monstre. Un score qui réutiliserait les
// stats du build actuel comparerait des paires sur des stats fausses.
const evaluer = (artefacts: ArtifactDetail[]) => {
  const stats = computeStats({ ...loaded.gear, artifacts: artefacts });
  return computeTotalDamage(sort, passifs, stats, setup, espece.element, artifactDamageProfile(artefacts));
};

const params: ArtifactSearchParams = {
  porteur,
  inventaire: loaded.allArtifacts,
  equipes: loaded.gear.artifacts,
  principaleParSorte: { element: choix(opt('attribut')), archetype: choix(opt('type')) },
  evaluer,
};

const parSorte = ARTIFACT_KINDS.map(({ key, label }) => {
  const n = loaded.allArtifacts.filter((a) => a.kind === key).length;
  return `${label} : ${n} en inventaire`;
}).join(' · ');
console.log(`\nSort : ${sort.nom} (slot ${sort.slot}, ${sort.hits} coup(s)${sort.aoe ? ', zone' : ''}${sort.bombe ? ', BOMBE' : ''})`);
console.log(`Cible : ${setup.enemyDef} DEF · élément visé : ${setup.enemyElement ?? 'ignoré'} · critique : ${setup.critMode}`);
console.log(`Inventaire — ${parSorte}`);
console.log(`Paires réellement parcourues (éligibilité + contrainte d'intangible) : ${nombreDePaires(params)}`);

const t0 = Date.now();
const top = meilleuresPairesArtefacts(params, Number(opt('top') ?? 5));
const ms = Date.now() - t0;

const decrire = (a: ArtifactDetail | null, kind: ArtifactKind) => {
  if (!a) return '(aucun)';
  const quoi = a.intangible ? 'INTANGIBLE' : kind === 'element' ? (a.element ?? '?') : (a.archetype ?? '?');
  const lignes = a.subs.map((s) => `${artifactSubName(s.code)} ${s.value}`).join(', ');
  return `${quoi} — principale ${a.main.code}/${a.main.value}${lignes ? ` — ${lignes}` : ''}`;
};

// Référence : ce que le monstre porte AUJOURD'HUI, pour que le gain se lise.
const actuel = evaluer(loaded.gear.artifacts);
console.log(`\nÉquipé actuellement : ${Math.round(actuel).toLocaleString('fr')} dégâts`);
console.log(`\n${top.length} meilleure(s) paire(s) — calculées en ${ms} ms :\n`);
top.forEach((p, i) => {
  const gain = actuel > 0 ? ((p.score / actuel - 1) * 100).toFixed(1) : '—';
  console.log(`#${i + 1}  ${Math.round(p.score).toLocaleString('fr')} dégâts  (${gain} % vs équipé)`);
  console.log(`     Attribut : ${decrire(p.element, 'element')}`);
  console.log(`     Type     : ${decrire(p.archetype, 'archetype')}`);
});
