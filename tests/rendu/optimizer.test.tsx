// Tests de rendu — Outils · Optimizer (`OptimizerSection`, et l'écran vide de
// `OutilsPage`). Principe dans tests/rendu/outils-rendu.tsx : on vérifie que
// chaque fonctionnalité et chaque information sont présentes, jamais
// l'apparence : un changement de style doit les laisser verts sans qu'une
// assertion change.
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
export const BOX = mapBoxMonsters(parseAccountBox(SOURCE).monsters, PAR_COM2US);
const INVENTAIRE = parseAccountInventory(SOURCE);
// Le premier monstre de la box (Devilmon), désigné par son id de monstre.
export const CHOISI = String(BOX[0].monster.id);

// `etat` : les champs remplacés, ou une fonction de l'état réel — pour
// remplacer un champ imbriqué (`search`) sans perdre le reste.
type EtatBanc = Record<string, unknown> | ((reel: ReturnType<typeof useOptimizerState>) => Record<string, unknown>);
function Banc({ etat, menuOuvert }: { etat: EtatBanc; menuOuvert: boolean }) {
  const reel = useOptimizerState();
  const optimizer = { ...reel, ...(typeof etat === 'function' ? etat(reel) : etat) } as ReturnType<typeof useOptimizerState>;
  const lists = useOptimizerLists();
  return (
    <OptimizerSection
      box={BOX}
      runes={INVENTAIRE.runes}
      artifacts={INVENTAIRE.artifacts}
      relics={INVENTAIRE.relics}
      relicUsageById={INVENTAIRE.relicUsageById}
      optimizer={optimizer}
      onImporterEquipe={optimizer.importerEquipe}
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

// `stockage` : le faux `localStorage` de départ (listes de travail…), lu par les hooks.
export function rendreOptimizer(etat: EtatBanc = {}, menuOuvert = false, stockage: Record<string, string> = {}): string {
  faussLocalStorage(stockage);
  return rendre(<Banc etat={etat} menuOuvert={menuOuvert} />);
}

export const AVEC_MONSTRE = { selectedId: CHOISI, comboSets: ['violent'], showAdvanced: true };

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
        onImporterEquipe={() => { throw new Error('Écran vide sans import.'); }}
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
  ok(!t.includes('Optimizer en bêta') && !t.includes('en rodage'), 'aucun bandeau « Optimizer en bêta » : l’outil n’est plus en bêta');
  ok(!t.includes('Recherche parmi tes runes possédées'), 'au bureau, aucune phrase d’introduction au-dessus des colonnes');
  // Au bureau (rendu serveur : format bureau, largeur inconnue), la page en
  // colonnes : essentiels, contrôle à onglets, « Artéfacts et relique »
  // ouverte par défaut, « Aura, exclusion, avancés » fermée, colonne de droite.
  for (const carte of ['Critères de recherche', 'Artéfacts', 'Sous-propriétés verrouillées', 'État de mon monstre', 'Objectif de recherche'])
    ok(t.includes(carte), `la carte « ${carte} »`);
  ok(!t.includes('Monstre & équipement'), 'au bureau, plus de carte « Monstre & équipement » : la liste de travail ouvre les essentiels, « Exemplaire » a sa carte');
  ok(bouton(html, 'Artéfacts et relique')?.presse === true && bouton(html, 'Aura, exclusion, avancés')?.presse === false,
    'le contrôle à onglets : « Artéfacts et relique » ouverte, « Aura, exclusion, avancés » fermée');
  ok(!t.includes('Réglages avancés') && !t.includes('Exclusion de runes') && !t.includes('Sets d\'aura des autres monstres'),
    '« Réglages avancés », « Exclusion de runes » et les sets d\'aura attendent l\'ouverture de leur colonne');
  ok(valeurs(html, 'placeholder').includes('Rechercher un monstre…'), 'la recherche du monstre à optimiser');
  ok(/Liste active Aucune liste — choisir ou créer .*Importer une équipe.* Ajouter un monstre à la liste/.test(t) && !t.includes('Monstres de la liste'),
    'les listes de travail : liste active et import sur une ligne, puis la zone des membres, dont le titre nomme le champ qui le suit');
  ok(t.includes(`Exemplaire ${SOURCES}`), 'l\'exemplaire, avec ses quatre sources');
  ok(bouton(html, 'Valider ce build')?.desactive === true, '« Valider ce build » désactivé sans résultat');
  ok(bouton(html, 'Rechercher')?.desactive === true, '« Rechercher » désactivé sans monstre');
  ok(t.includes('Set de runes recherché 0/6 runes') && !!bouton(html, 'Set de runes recherché : Aucun'), 'le set recherché, vide : la liste compacte dit « Aucun »');
  // Au téléphone, la grille des cartes, inchangée.
  const telephone = texteVisible(auTelephone(() => rendreOptimizer()));
  ok(telephone.includes('Monstre & équipement') && telephone.includes('Set de runes recherché 0/6 runes Set principal Set secondaire'),
    'au téléphone : « Monstre & équipement » et le set recherché en grille, comme avant');
  ok(!telephone.includes('Optimizer en bêta') && !telephone.includes('en rodage'), 'au téléphone non plus, aucun bandeau « Optimizer en bêta »');
  ok(telephone.startsWith("Recherche parmi tes runes possédées ; rien n'est appliqué à ton compte, l'outil est purement indicatif — c'est à toi de re-runer dans le jeu."),
    'au téléphone, la phrase d’introduction en tête : ce que fait l’outil, et ce qu’il ne fait pas');
}

export function testRenduOptimizerMonstre() {
  titre('rendu · Optimizer — un monstre et un set choisis');
  const html = rendreOptimizer(AVEC_MONSTRE);
  const t = texteVisible(html);
  const b = boutons(html);
  ok(/data-monstre-actif[^>]*>[\s\S]{0,400}?Devilmon/.test(html), 'le monstre choisi, sur la rangée du titre de la liste');
  ok(t.includes('PV 1 500 +180 ATQ 700 +160 DEF 500 — VIT 101 +80 Taux Crit 15% — Dmg Crit 50% +63% RES 15% +63% Précision 0% +7%'), 'ses stats : base et bonus de l\'équipement');
  ok(t.includes('Relique PV +11%'), 'sa relique');
  ok(!!bouton(html, 'Créer une liste et y ajouter Devilmon'), 'l\'ajouter à une nouvelle liste');
  ok(t.includes('Set de runes recherché 4/6 runes') && !!bouton(html, 'Set de runes recherché : Violent'), 'le set choisi et son coût en runes');
  ok(!!b.find((x) => x.ariaLabel === 'Retirer Violent'), 'retirer le set choisi');
  for (const set of ['Swift', 'Despair', 'Rage', 'Fatal', 'Vampire'])
    ok(b.find((x) => x.ariaLabel === set)?.desactive === true, `${set} (4 pièces) désactivé : il ne reste pas la place`);
  for (const set of ['Will', 'Blade', 'Energy', 'Guard', 'Focus', 'Seal'])
    ok(b.find((x) => x.ariaLabel === set)?.desactive === false, `${set} (2 pièces) encore possible`);
  ok(t.includes('Statistique principale imposée (slots pairs)') && ['Slot 2 : Libre', 'Slot 4 : Libre', 'Slot 6 : Libre'].every((n) => !!bouton(html, n)),
    'la statistique principale imposée, une liste par slot');
  ok(t.includes('Conditions Stats de base exclues'), 'les conditions, stats de base exclues');
  ok(
    t.includes('Min Max PV Min Max ATQ Min Max DEF Min Max VIT Min Max Taux Crit % Min % Max Dmg Crit % Min % Max RES % Min % Max Précision % Min % Max'),
    `un minimum et un maximum pour chacune des huit stats (${STATS_CONDITIONS.join(', ')})`,
  );
  ok(!!bouton(html, 'Réinitialiser les conditions'), 'réinitialiser les conditions');
  // ⚠️ La v1.14.0 a fait entrer la relique dans ce
  // bloc : « Artéfacts » est devenu « Artéfacts et reliques », et son
  // interrupteur aussi. Le reste du bloc est inchangé.
  ok(t.includes("Artéfacts et reliques Activer l'optimisation d'artéfacts et reliques Attribut Comme équipé Libre ATQ +100 DEF +100 PV +1500 Type"), 'les deux artéfacts : garder, libre, ou une principale (libellés courts)');
  ok(t.includes('Principale Comme équipée Libre ATQ % DEF % PV %') && !t.includes('Garder la relique équipée'), 'la relique : « Comme équipée », libre, ou une principale');
  ok(t.includes('Sous-propriétés verrouillées 0 / 8 + Sous-propriété…'), 'les sous-propriétés verrouillées, compteur sur 8');
  ok(t.includes('Meilleurs artéfacts offensifs pour ce build') && b.find((x) => x.texte === 'Dégâts supplémentaires')?.presse === true, 'les meilleurs artéfacts offensifs, en dégâts supplémentaires');
  ok(b.find((x) => x.ariaLabel === 'Buff ATQ — inactif')?.title === 'Augmente l’ATQ du monstre de 50 %.', 'l\'état du monstre : buffs, et ce qu\'ils font');
  ok(t.includes('Lead Aucun') && !t.includes('Invocateur Combat Contenu de guilde'), 'lead présent et choix des compétences d’invocateur retiré');
  ok(t.includes('8 runes gardées après pré-filtrage (pool par emplacement : 1 + 2 + 1 + 2 + 1 + 1)'), 'l\'estimation du pool');
  ok(bouton(html, 'Rechercher')?.desactive === false, '« Rechercher » actif');
}

export function testRenduOptimizerReglages() {
  titre('rendu · Optimizer — réglages avancés, objectif, partage');
  const html = rendreOptimizer(AVEC_MONSTRE);
  const t = texteVisible(html);
  const b = boutons(html);
  // Au bureau, « Réglages avancés » vit dans la colonne « Aura, exclusion,
  // avancés », fermée par défaut (son ouverture au clic de l'onglet :
  // `testRendu…OptimizerEcranReglagesAvances`, au navigateur). Son contenu,
  // le même composant, se lit ici dans le panneau « Options » du téléphone.
  ok(!t.includes('Pré-filtrage par emplacement') && bouton(html, 'Aura, exclusion, avancés')?.presse === false,
    'au bureau : les réglages avancés attendent l\'ouverture de leur colonne');
  const panneau = auTelephone(() => rendreOptimizer(AVEC_MONSTRE, true));
  const bp = boutons(panneau);
  ok(texteVisible(panneau).includes('Réglages avancés Pré-filtrage par emplacement'), 'le pré-filtrage par emplacement');
  for (const p of PALIERS) ok(!!bp.find((x) => x.texte === p && x.title), `le palier « ${p} », expliqué`);
  ok(bp.find((x) => x.texte === 'Moyen')?.presse === true, '« Moyen » par défaut');
  for (const r of ["Rechercher jusqu'à épuisement complet", 'Diagnostic approfondi sur 0 résultat'])
    ok(bp.some((x) => x.ariaLabel === r), `l'option « ${r} »`);
  ok(!bp.some((x) => x.ariaLabel === 'Prioriser les stats les plus difficiles'), '« Prioriser les stats les plus difficiles » retiré');
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
  ok(t.includes("Exclure les runes d'un monstre"), "l'exclusion des runes d'un monstre");
  ok(b.some((x) => x.ariaLabel === 'Exclure les runes déjà utilisées'), 'l\'interrupteur « Exclure les runes déjà utilisées »');
  ok(t.includes("Conserver ces slots dans l'optimisation Slot 1 · ATQ Slot 2 · VIT Slot 3 — Slot 4 · Dmg Crit Slot 5 — Slot 6 · RES"), 'les runes imposées, slot par slot');
  // Le panneau masque les intitulés (`[data-tiroir] .label`) ; celui-ci reste.
  ok(/data-intitule-conserve[^>]*>Conserver ces slots dans l(&#x27;|&#39;|')optimisation/.test(html), 'les runes imposées gardent leur intitulé dans le panneau');
  ok(t.includes('Réglages avancés Pré-filtrage par emplacement') && t.includes('Pool de runes = 8'), 'les réglages avancés et le pool');
  ok(t.includes('Objectif de recherche Efficience'), 'l\'objectif de recherche');
  ok(b.some((x) => x.texte === 'Rechercher') && !!bouton(html, 'Exporter les paramètres de recherche') && !!bouton(html, 'Importer les paramètres de recherche'), 'rechercher, exporter, importer');
  // Au téléphone, « Meilleurs artéfacts offensifs » est replié par défaut :
  // son titre reste, ses crans et sa paire attendent le dépliement.
  const fiche = auTelephone(() => rendreOptimizer(AVEC_MONSTRE));
  ok(
    fiche.includes('aria-expanded="false"') && texteVisible(fiche).includes('Meilleurs artéfacts offensifs pour ce build')
      && !boutons(fiche).some((x) => x.texte === 'Dégâts supplémentaires'),
    'les meilleurs artéfacts offensifs, repliés par défaut au téléphone',
  );
}
