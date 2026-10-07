// Tests de rendu — Outils · Optimizer (`OptimizerSection`, et l'écran vide de
// `OutilsPage`). Principe dans tests/rendu/outils-rendu.tsx : on vérifie que
// chaque fonctionnalité et chaque information sont présentes, jamais
// l'apparence. Écrits AVANT le lot 9a de la refonte graphique
// (`spec/chantiers/refonte-graphique.md` § B.5 à B.10, rebranding décision
// 64) : ils doivent rester verts sans qu'une assertion change.
//
// ⚠️ L'état de l'outil (`useOptimizerState`) est un objet ordinaire : le banc
// appelle le vrai hook puis REMPLACE les champs voulus (monstre choisi, set,
// réglages ouverts). Les setters restent ceux du hook — en rendu serveur, rien
// ne les appelle. Aucun code de l'app n'est modifié pour autant.
// ⚠️ Le compte vient de l'export miniature commité (`compte-miniature.json`),
// lu par les VRAIS extracteurs de l'import : deux monstres 6★, 8 runes,
// 3 artéfacts.

import OptimizerSection from '../../src/components/outils/OptimizerSection';
import OutilsPage from '../../src/pages/OutilsPage';
import { useOptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { parseAccountBox, parseAccountInventory } from '../../src/lib/importAccount';
import { mapBoxMonsters } from '../../src/lib/applyAccount';
import type { Monster } from '../../src/types';
import { egal, exportSynthetique, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { auTelephone, bouton, boutons, rendre, texteVisible, valeurs } from './outils-rendu';

const MONSTRES = monstersJson() as Monster[];
const PAR_COM2US = new Map(MONSTRES.filter((m) => m.com2usId != null).map((m) => [m.com2usId as number, m]));
const SOURCE = exportSynthetique();
const BOX = mapBoxMonsters(parseAccountBox(SOURCE).monsters, PAR_COM2US);
const INVENTAIRE = parseAccountInventory(SOURCE);
// Le premier monstre de la box (Devilmon), désigné par son id de monstre.
const CHOISI = String(BOX[0].monster.id);

function Banc({ etat, menuOuvert }: { etat: Record<string, unknown>; menuOuvert: boolean }) {
  const optimizer = { ...useOptimizerState(), ...etat } as ReturnType<typeof useOptimizerState>;
  const lists = useOptimizerLists();
  return (
    <OptimizerSection
      box={BOX}
      runes={INVENTAIRE.runes}
      artifacts={INVENTAIRE.artifacts}
      relics={INVENTAIRE.relics}
      relicUsageById={INVENTAIRE.relicUsageById}
      optimizer={optimizer}
      allMonsters={MONSTRES}
      rtaEntries={{}}
      siegeDefenseTeams={[]}
      siegeOffenseTeams={[]}
      lists={lists}
      accountName="Testeur"
      menuOuvert={menuOuvert}
      onFermerMenu={() => {}}
      onOuvrirMenu={() => {}}
    />
  );
}

export function rendreOptimizer(etat: Record<string, unknown> = {}, menuOuvert = false): string {
  faussLocalStorage({});
  return rendre(<Banc etat={etat} menuOuvert={menuOuvert} />);
}

const AVEC_MONSTRE = { selectedId: CHOISI, comboSets: ['violent'], showAdvanced: true };

const BETA =
  "Optimizer en bêta. L'outil est encore en rodage : le moteur de recherche peut mettre du temps sur des critères serrés ou manquer un build sur un cas inhabituel — vérifie toujours le résultat avant de re-runer.";
const SOURCES = 'Box RTA Défenses siège Offenses siège';
const STATS_CONDITIONS = ['PV', 'ATQ', 'DEF', 'VIT', 'Taux Crit', 'Dmg Crit', 'RES', 'Précision'];
const PALIERS = ['Bas', 'Moyen', 'Haut', 'Extrême'];

export function testRenduOptimizerVide() {
  titre('rendu · Optimizer — aucun compte, puis aucun monstre choisi');
  // L'écran vide des Outils, tant qu'aucun compte n'est chargé.
  faussLocalStorage({});
  const vide = texteVisible(
    rendre(
      <OutilsPage
        sub="optimizer"
        box={[]}
        runes={[]}
        artifacts={[]}
        relics={[]}
        relicUsageById={{}}
        loadState="live"
        optimizer={{} as never}
        allMonsters={MONSTRES}
        rtaEntries={{}}
        siegeDefenseTeams={[]}
        siegeOffenseTeams={[]}
        lists={{} as never}
        accountName={null}
        menuOuvert={false}
        onFermerMenu={() => {}}
        onOuvrirMenu={() => {}}
      />,
    ),
  );
  egal(
    vide,
    'Aucune donnée de compte chargée Importe ton compte (bouton « Importer un JSON ») pour rechercher des combinaisons de runes parmi celles que tu possèdes déjà.',
    'sans compte : l\'écran vide dit quoi faire',
  );

  const html = rendreOptimizer();
  const t = texteVisible(html);
  ok(t.startsWith(BETA), 'le bandeau bêta, en tête');
  ok(t.includes("Recherche parmi tes runes possédées ; rien n'est appliqué à ton compte, l'outil est purement indicatif — c'est à toi de re-runer dans le jeu."), 'ce que fait l\'outil, et ce qu\'il ne fait pas');
  for (const carte of ['Monstre & équipement', 'Critères de recherche', 'Artéfacts', 'Sous-propriétés verrouillées', 'État de mon monstre', 'Réglages avancés', 'Exclusion de runes', 'Objectif de recherche'])
    ok(t.includes(carte), `la carte « ${carte} »`);
  ok(valeurs(html, 'placeholder').includes('Rechercher un monstre…'), 'la recherche du monstre à optimiser');
  ok(t.includes(`Liste active Aucune liste — choisir ou créer Monstres de la liste`), 'les listes de travail');
  ok(t.includes(`Exemplaire ${SOURCES}`), 'l\'exemplaire, avec ses quatre sources');
  ok(bouton(html, 'Valider ce build')?.desactive === true, '« Valider ce build » désactivé sans résultat');
  ok(bouton(html, 'Rechercher')?.desactive === true, '« Rechercher » désactivé sans monstre');
  ok(t.includes('Set de runes recherché 0/6 runes Set principal Set secondaire'), 'le set recherché, vide');
}

export function testRenduOptimizerMonstre() {
  titre('rendu · Optimizer — un monstre et un set choisis');
  const html = rendreOptimizer(AVEC_MONSTRE);
  const t = texteVisible(html);
  const b = boutons(html);
  ok(t.includes('Monstre à optimiser Devilmon'), 'le monstre choisi');
  ok(t.includes('PV 1 500 +180 ATQ 700 +160 DEF 500 — VIT 101 +80 Taux Crit 15% — Dmg Crit 50% +63% RES 15% +63% Précision 0% +7%'), 'ses stats : base et bonus de l\'équipement');
  ok(t.includes('Relique PV +11%'), 'sa relique');
  ok(!!bouton(html, 'Créer une liste et y ajouter Devilmon'), 'l\'ajouter à une nouvelle liste');
  ok(t.includes('Set de runes recherché Violent 4/6 runes'), 'le set choisi et son coût en runes');
  ok(!!b.find((x) => x.ariaLabel === 'Retirer Violent'), 'retirer le set choisi');
  for (const set of ['Swift', 'Despair', 'Rage', 'Fatal', 'Vampire'])
    ok(b.find((x) => x.ariaLabel === set)?.desactive === true, `${set} (4 pièces) désactivé : il ne reste pas la place`);
  for (const set of ['Will', 'Blade', 'Energy', 'Guard', 'Focus', 'Seal'])
    ok(b.find((x) => x.ariaLabel === set)?.desactive === false, `${set} (2 pièces) encore possible`);
  ok(t.includes('Statistique principale imposée (slots pairs) Slot 2 PV% ATQ% DEF% VIT Slot 4 PV% ATQ% DEF% Taux Crit Dmg Crit Slot 6 PV% ATQ% DEF% RES Précision'), 'la statistique principale imposée, slot par slot');
  ok(t.includes('Conditions Stats de base exclues'), 'les conditions, stats de base exclues');
  ok(
    t.includes('Min Max PV Min Max ATQ Min Max DEF Min Max VIT Min Max Taux Crit % Min % Max Dmg Crit % Min % Max RES % Min % Max Précision % Min % Max'),
    `un minimum et un maximum pour chacune des huit stats (${STATS_CONDITIONS.join(', ')})`,
  );
  ok(!!bouton(html, 'Réinitialiser les conditions'), 'réinitialiser les conditions');
  // ⚠️ La v1.14.0 a fait entrer la relique dans ce
  // bloc : « Artéfacts » est devenu « Artéfacts et reliques », et son
  // interrupteur aussi. Le reste du bloc est inchangé.
  ok(t.includes("Artéfacts et reliques Activer l'optimisation d'artéfacts et reliques Attribut Garder l'artéfact équipé Libre Principale ATQ +100 Principale DEF +100 Principale PV +1500 Type"), 'les deux artéfacts : garder, libre, ou une principale');
  ok(t.includes('Sous-propriétés verrouillées 0 / 8 + Sous-propriété…'), 'les sous-propriétés verrouillées, compteur sur 8');
  ok(t.includes('Meilleurs artéfacts offensifs pour ce build') && b.find((x) => x.texte === 'Dégâts supplémentaires')?.presse === true, 'les meilleurs artéfacts offensifs, en dégâts supplémentaires');
  ok(b.find((x) => x.ariaLabel === 'Buff ATQ — inactif')?.title === 'Augmente l’ATQ du monstre de 50 %.', 'l\'état du monstre : buffs, et ce qu\'ils font');
  ok(t.includes('Lead Aucun') && t.includes('Invocateur Combat Combat + Guilde'), 'lead et compétences d\'invocateur');
  ok(t.includes('8 runes gardées après pré-filtrage (pool par emplacement : 1 + 2 + 1 + 2 + 1 + 1)'), 'l\'estimation du pool');
  ok(bouton(html, 'Rechercher')?.desactive === false, '« Rechercher » actif');
}

export function testRenduOptimizerReglages() {
  titre('rendu · Optimizer — réglages avancés, objectif, partage');
  const html = rendreOptimizer(AVEC_MONSTRE);
  const t = texteVisible(html);
  const b = boutons(html);
  ok(t.includes('Réglages avancés Pré-filtrage par emplacement'), 'le pré-filtrage par emplacement');
  for (const p of PALIERS) ok(!!b.find((x) => x.texte === p && x.title), `le palier « ${p} », expliqué`);
  ok(b.find((x) => x.texte === 'Moyen')?.presse === true, '« Moyen » par défaut');
  for (const r of ["Rechercher jusqu'à épuisement complet", 'Diagnostic approfondi sur 0 résultat', 'Prioriser les stats les plus difficiles'])
    ok(b.some((x) => x.ariaLabel === r), `l'option « ${r} »`);
  ok(t.includes('Objectif de recherche Efficience'), 'l\'objectif de recherche');
  ok(b.find((x) => x.texte === 'Efficience')?.presse === true, 'l\'efficience par défaut');
  for (const o of ['PV effectifs', 'Vitesse']) ok(b.some((x) => x.texte === o), `l'objectif « ${o} »`);
  egal(
    bouton(html, 'Exporter les paramètres de recherche')?.title ?? null,
    'Télécharger les réglages de cette recherche en fichier .json (set, minimums, objectif…) — pour la partager ou la reproduire, jamais tes runes ni ton compte.',
    'exporter la recherche, et ce qui part',
  );
  egal(
    bouton(html, 'Importer les paramètres de recherche')?.title ?? null,
    "Reprendre les réglages d'un fichier .json exporté depuis l'Optimizer (le tien ou celui d'un autre joueur).",
    'importer une recherche',
  );
}

export function testRenduTelephoneOptimizer() {
  titre('rendu · Optimizer au téléphone — le panneau « Options de recherche »');
  const html = auTelephone(() => rendreOptimizer({ selectedId: CHOISI, comboSets: ['violent'] }, true));
  const t = texteVisible(html);
  const b = boutons(html);
  ok(t.includes('Options de recherche Exclusion de runes Deux réglages indépendants, qui se superposent.'), 'le panneau, et l\'exclusion en tête');
  ok(b.some((x) => x.ariaLabel === 'Fermer'), 'le panneau se ferme');
  for (const r of ["Exclure les runes d'un monstre", 'Exclure les runes déjà utilisées'])
    ok(b.some((x) => x.ariaLabel === r), `l'interrupteur « ${r} »`);
  ok(t.includes('Runes imposées Slot 1 · ATQ Slot 2 · VIT Slot 3 — Slot 4 · Dmg Crit Slot 5 — Slot 6 · RES'), 'les runes imposées, slot par slot');
  ok(t.includes('Réglages avancés Pré-filtrage par emplacement') && t.includes('Pool de runes = 8'), 'les réglages avancés et le pool');
  ok(t.includes('Objectif de recherche Efficience'), 'l\'objectif de recherche');
  ok(b.some((x) => x.texte === 'Rechercher') && !!bouton(html, 'Exporter les paramètres de recherche') && !!bouton(html, 'Importer les paramètres de recherche'), 'rechercher, exporter, importer');
}
