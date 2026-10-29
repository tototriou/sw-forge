// Tests de rendu — les gabarits de bureau de l'Optimizer
// (`src/components/outils/optimizer/bureau/`) et leur vue de développement
// (`src/components/outils/optimizer/gabarits/VueGabarits.tsx`, `#/outils/optimizer/gabarits`). Le sens, jamais
// la forme : libellés, choix, états et leur nom accessible.

import { useOptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists } from '../../src/hooks/useOptimizerLists';
import OutilsPage from '../../src/pages/OutilsPage';
import VueGabarits from '../../src/components/outils/optimizer/gabarits/VueGabarits';
import { GABARITS } from '../../src/components/outils/optimizer/gabarits/registre';
import Onglets from '../../src/ui/Onglets';
import PrincipalesImposeesBureau from '../../src/components/outils/optimizer/bureau/PrincipalesImposeesBureau';
import SetDeRunesCompact from '../../src/components/outils/optimizer/bureau/SetDeRunesCompact';
import { SetDeplieContext } from '../../src/components/outils/optimizer/bureau/setDeplie';
import ConditionsBureau from '../../src/components/outils/optimizer/bureau/ConditionsBureau';
import EtatMonstreEssentiels from '../../src/components/outils/optimizer/bureau/EtatMonstreEssentiels';
import { ADRESSE_GABARITS, estAdresseGabarits } from '../../src/lib/optimizerGabarits';
import { parseAccountInventory } from '../../src/lib/importAccount';
import { DEFAULT_DAMAGE_SETUP } from '../../src/lib/damage';
import { MOTIF_CONTENU_NON_DEFINI } from '../../src/lib/equipesOptimizer';
import type { Monster } from '../../src/types';
import { egal, exportSynthetique, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { bouton, boutons, rendre, texteVisible } from './outils-rendu';
import { BOX, CHOISI } from './optimizer.test';

const MONSTRES = monstersJson() as Monster[];
const INVENTAIRE = parseAccountInventory(exportSynthetique());
const rien = () => {};
const ref = { current: null };

export function testRenduOptimizerGabaritsComposants() {
  titre('rendu · Optimizer — gabarits de bureau des essentiels');

  // Le contrôle à onglets : deux boutons à deux états, libellés de la direction.
  const onglets = rendre(<Onglets aria-label="Réglages de recherche" valeur="artefacts" onChange={rien}
    options={[{ cle: 'artefacts', libelle: 'Artéfacts' }, { cle: 'complements', libelle: 'Options' }]} />);
  egal([...onglets.matchAll(/role="tab"[^>]*aria-selected="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map(m => [texteVisible(m[2]), m[1]]), [['Artéfacts', 'true'], ['Options', 'false']],
    'onglets : Artéfacts sélectionné, Options disponible');
  ok(/role="tablist"[^>]*aria-label="Réglages de recherche"/.test(onglets), 'onglets : une liste nommée');

  // Les principales : une liste à choix multiples par slot pair.
  const libres = rendre(<PrincipalesImposeesBureau mainStatsBySlot={{}} toggleMainStat={rien} />);
  ok(['Slot 2 : Libre', 'Slot 4 : Libre', 'Slot 6 : Libre'].every((n) => !!bouton(libres, n)), 'principales libres : trois listes, « Libre »');
  egal((libres.match(/type="checkbox"/g) ?? []).length, 0, 'principales : aucune case (forme 2, surbrillance)');
  egal((libres.match(/aria-pressed="false"/g) ?? []).length, 14, 'principales : chaque principale possible est une valeur de la liste (4 + 5 + 5)');
  const choisies = rendre(<PrincipalesImposeesBureau mainStatsBySlot={{ 4: [9, 10] }} toggleMainStat={rien} />);
  ok(!!bouton(choisies, 'Slot 4 : Taux Crit, Dmg Crit'), 'principales choisies : le slot résume ses choix');
  egal(boutons(choisies).filter((b) => b.presse).map((b) => b.texte), ['Taux Crit', 'Dmg Crit'], 'principales choisies : en surbrillance dans la liste');
  ok(texteVisible(libres).includes('Statistique principale imposée (slots pairs)'), 'principales : le titre de l\'app');
  egal((libres.match(/data-resume-entier/g) ?? []).length, 3, 'principales : chaque champ fermé montre tout son résumé (resumeEntier)');
  egal((libres.match(/data-reserve-resume/g) ?? []).length, 0, 'principales : aucune hauteur réservée pour toutes les options');
  egal((libres.match(/class="flex items-center gap-1.5"><span class="w-9 flex-none text-micro text-ink-dim">Slot/g) ?? []).length, 3,
    'principales : trois rangées compactes, « Slot n » à gauche de sa liste');
  ok(/^<section[^>]*class="flex flex-col"/.test(libres), 'principales : une section sans cadre (le panneau de la colonne le porte)');

  // Le set compact : fermé sur les sets choisis, la grille d'ajout dans la surface.
  const sansSet = rendre(<SetDeRunesCompact setPickerSectionRef={ref} setPickerInvalid={false} comboSets={[]} onChangeSets={rien} />);
  ok(!!bouton(sansSet, 'Set de runes recherché : Aucun'), 'set : sans choix, la liste dit « Aucun »');
  ok(!!bouton(sansSet, 'Swift') && !!bouton(sansSet, 'Fight'), 'set : la grille d\'ajout d\'aujourd\'hui est dans la surface (Set principal, Set secondaire)');
  ok(!texteVisible(sansSet).includes('Critères de recherche'), 'set : au bureau, sans le titre « Critères de recherche » du téléphone (la colonne situe la section)');
  const message = 'Sélectionne au moins un set avant de lancer la recherche.';
  // Le message se met sur la ligne du titre : aucune ligne réservée sous la liste.
  const ligneTitre = (html: string) => texteVisible(html.split('Set de runes recherché</p>')[1]?.split('<button')[0] ?? '');
  ok(!sansSet.includes(message) && ligneTitre(sansSet) === '',
    'set valide, compact : rien sur la ligne du titre, aucun message monté (ni place réservée)');
  const refuse = rendre(<SetDeRunesCompact setPickerSectionRef={ref} setPickerInvalid comboSets={[]} onChangeSets={rien} />);
  // (La grille de la surface garde son propre compteur, hors de la ligne du titre.)
  ok(ligneTitre(refuse) === message && (refuse.match(/Sélectionne au moins un set/g) ?? []).length === 1,
    'set refusé : le message se lit une fois, sur la ligne du titre, avant la liste');
  // Déplié (la page dit que la colonne tient) : la grille du téléphone à la
  // place de la liste fermée, dans son coffre ; son compte est le seul, rien
  // à droite du titre (un second compte y faisait doublon).
  const deplie = (invalide: boolean, sets: string[]) => rendre(
    <SetDeplieContext.Provider value={{ deplie: true, reporterEcart: rien }}>
      <SetDeRunesCompact setPickerSectionRef={ref} setPickerInvalid={invalide} comboSets={sets} onChangeSets={rien} />
    </SetDeplieContext.Provider>);
  // (La grille dépliée suit aussitôt la ligne du titre : seul compte ce qui
  // est posé à droite du titre, sur sa ligne.)
  const aDroiteDuTitre = (html: string) => texteVisible(/Set de runes recherché<\/p>(<span[^>]*>[^<]*<\/span>)?/.exec(html)?.[1] ?? '');
  const deplieViolent = deplie(false, ['violent']);
  ok(!bouton(deplieViolent, 'Set de runes recherché : Violent') && !!bouton(deplieViolent, 'Retirer Violent') && !!bouton(deplieViolent, 'Swift')
    && aDroiteDuTitre(deplieViolent) === '' && (texteVisible(deplieViolent).match(/4\/6 runes/g) ?? []).length === 1
    && aDroiteDuTitre(rendre(<SetDeRunesCompact setPickerSectionRef={ref} setPickerInvalid={false} comboSets={['violent']} onChangeSets={rien} />)) === '',
  'set déplié : la grille du téléphone à la place de la liste, son compte le seul, rien à droite du titre (compact : rien non plus)');
  // Avant toute mesure (rendu serveur), 3 + 4 colonnes au prorata de la largeur du coffre.
  ok(/class="mt-2 grid gap-0 rounded-lg bg-panel2 p-2" style="grid-template-columns:minmax\(min-content,3fr\) minmax\(min-content,4fr\)"/.test(deplieViolent)
    && /grid-template-columns:repeat\(3, minmax\(2rem, 1fr\)\)/.test(deplieViolent) && /grid-template-columns:repeat\(4, minmax\(2rem, 1fr\)\)/.test(deplieViolent)
    && !/class="mt-2 grid gap-0 [^"]*border/.test(deplieViolent),
  'set déplié : coffre en creux, sur toute sa largeur, principal sur 3 colonnes et secondaire sur 4 avant mesure');
  ok(aDroiteDuTitre(deplie(true, [])) === message, 'set déplié refusé : le message à droite du titre');
  const repete = rendre(<SetDeRunesCompact setPickerSectionRef={ref} setPickerInvalid={false} comboSets={['blade', 'blade', 'fight']} onChangeSets={rien} />);
  ok(!!bouton(repete, 'Set de runes recherché : Blade, Blade, Fight'), 'set : un même set choisi deux fois se résume deux fois');
  ok(!!bouton(repete, 'Retirer Blade') && texteVisible(repete).includes('6/6 runes'), 'set : chaque set choisi garde sa croix de retrait');

  // Les conditions : les libellés d'aujourd'hui, dans sa carte, en variante bureau.
  const conditionsHtml = rendre(<ConditionsBureau excludeBase setExcludeBase={rien} baseOf={() => 0} artifactFloorOf={() => 0}
    minStats={{}} maxStats={{}} setMinStats={rien} setMaxStats={rien} />);
  const conditions = texteVisible(conditionsHtml);
  ok(['Conditions', 'Stats de base exclues', 'Taux Crit', 'Réinitialiser les conditions'].every((t) => conditions.includes(t)), 'conditions : les libellés d\'aujourd\'hui');
  ok(/grid-cols-\[auto_auto_auto\]/.test(conditionsHtml) && !/minmax\(90px,auto\)/.test(conditionsHtml), 'conditions : variante bureau, la colonne des libellés à la largeur du plus long');

  // État de mon monstre : buffs et lead, sans les sets d'aura.
  const etat = rendre(<EtatMonstreEssentiels setup={{ ...DEFAULT_DAMAGE_SETUP, atkBuff: true }} maj={rien} etroit={false}
    rappelsBuffs={[]} />);
  ok(['Buff ATQ', 'Buff DEF', 'Buff VIT'].every((b) => !!bouton(etat, b)), 'état : les trois buffs');
  ok(/aria-label="Type de leader skill"/.test(etat), 'état : le choix du lead');
  ok(!texteVisible(etat).includes('Sets d\'aura des autres monstres'), 'état : les sets d\'aura n\'y sont plus');
  const membre = (motif: string) => texteVisible(rendre(<EtatMonstreEssentiels setup={DEFAULT_DAMAGE_SETUP} maj={rien} etroit={false} equipe motifLead={motif}
    rappelsBuffs={[]} />));
  const inactive = 'Cette portée de lead est inactive pour ce contenu.';
  ok(membre(inactive).includes(inactive), 'état d\'un membre d\'équipe : le motif du lead inactif');
  ok(!membre(inactive).includes('Lead effectif de l’équipe'), 'état d\'un membre d\'équipe : aucune phrase d\'explication du lead d\'équipe');
  ok(!membre(MOTIF_CONTENU_NON_DEFINI).includes('n’est pas défini'), 'état d\'un membre d\'équipe : jamais le motif « contenu de combat non défini »');
}

function BancVue() {
  const optimizer = { ...useOptimizerState(), selectedId: CHOISI, comboSets: ['violent'] };
  const lists = useOptimizerLists();
  return (
    <VueGabarits ctx={{
      optimizer, lists, box: BOX, runes: INVENTAIRE.runes, artifacts: INVENTAIRE.artifacts, relics: INVENTAIRE.relics, allMonsters: MONSTRES,
      exclusionData: { box: BOX, rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map(MONSTRES.map((m) => [String(m.id), m])) },
    }} />
  );
}

export function testRenduOptimizerGabaritsVue() {
  titre('rendu · Optimizer — vue des gabarits');
  faussLocalStorage({});
  const html = rendre(<BancVue />);
  const texte = texteVisible(html);

  egal([...html.matchAll(/data-gabarit="([^"]+)"/g)].map((m) => m[1]), GABARITS.map((g) => g.id), 'chaque gabarit du registre a sa section, dans l\'ordre');
  egal(GABARITS.slice(0, 6).map((g) => g.id), ['liste', 'set', 'principales', 'conditions', 'etat', 'onglets'], 'les essentiels et le contrôle à onglets sont au registre');
  for (const g of GABARITS) {
    const section = html.split(`data-gabarit="${g.id}"`)[1]?.split('data-gabarit=')[0] ?? '';
    egal([...section.matchAll(/data-etat="([^"]+)"/g)].map((m) => m[1]), g.etats.map((e) => e.id), `« ${g.nom} » : chacun de ses états est rendu`);
    ok(texteVisible(section).includes('Ce qui change de comportement') && g.changements.every((c) => texteVisible(section).includes(c)),
      `« ${g.nom} » : l'encadré des changements de comportement`);
  }
  ok(texte.includes('Réel : non mesuré'), 'sans navigateur, la taille réelle n\'est pas inventée');
  egal(GABARITS.filter(g => g.id.startsWith('configuration-')).map(g => [g.id, g.largeur]), [
    ['configuration-deux-piles', 752], ['configuration-groupe', 1200],
    ['configuration-criteres-et-groupe', 1500], ['configuration-colonnes', 1800],
  ], 'la galerie assemble les quatre configurations, chacune à sa largeur');
  egal((html.match(/data-page-fenetre=""/g) ?? []).length, 4, 'chaque configuration monte la vraie page de bureau');

  // La liste de travail : vide, remplie, réelle.
  const liste = html.split('data-gabarit="liste"')[1].split('data-gabarit=')[0];
  const vide = texteVisible(liste.split('data-etat="vide"')[1].split('data-etat=')[0]);
  // Au bureau, la liste active se lit au bouton « Liste active » ; le titre de la carte nomme le champ, jamais la liste.
  ok(vide.includes('Aucun monstre dans cette liste pour l\'instant.') && vide.includes('Liste active Défense G3 - ')
    && !vide.includes('Ajouter un monstre à la liste') && !vide.includes('Monstres de « Défense G3 »'), 'liste vide : la liste active, sans membre ni titre au-dessus de la recherche');
  const remplie = liste.split('data-etat="remplie"')[1].split('data-etat=')[0];
  ok(texteVisible(remplie).includes('Équipe 1') && texteVisible(remplie).includes('Sans équipe'), 'liste remplie : une équipe et des membres sans équipe');
  ok(/placeholder="Rechercher un monstre/.test(remplie), 'liste : « Rechercher un monstre… » dans la carte de la liste');
  ok(texteVisible(remplie).includes(BOX[0].monster.name), 'liste remplie : le monstre actif est nommé');
  ok(/max-h-\[308px\]/.test(remplie) && !/max-h-\[164px\]/.test(remplie), 'liste : les membres s\'étirent jusqu\'à 308 px (plus les ≈ 4 lignes d\'avant), puis défilent');

  // Les états qui partent de l'état réel.
  const setReel = html.split('data-gabarit="set"')[1].split('data-etat="reel"')[1].split('data-etat=')[0];
  ok(!!bouton(setReel, 'Set de runes recherché : Violent'), 'set « de l\'Optimizer » : le set de l\'état réel');
}

export function testRenduOptimizerGabaritsAdresse() {
  titre('rendu · Optimizer — adresse de la vue des gabarits');
  ok(estAdresseGabarits(ADRESSE_GABARITS) && estAdresseGabarits('#outils/optimizer/gabarits/'), 'l\'adresse de la vue est reconnue, avec ou sans barre');
  ok(!estAdresseGabarits('#/outils/optimizer') && !estAdresseGabarits('#/outils/speed-tuning') && !estAdresseGabarits('#/outils/optimizer/gabaritsx'),
    'l\'Optimizer et les autres outils ne mènent pas à la vue');

  // Hors développement (`import.meta.env.DEV` faux, comme en production), la
  // page de l'Optimizer s'affiche, quelle que soit l'adresse.
  const page = texteVisible(rendre(pageOptimizer()));
  // La page de bureau (rendu serveur : format bureau) : son contrôle à onglets
  // la signe, « Monstre & équipement » n'y est plus, ni le titre « Critères de
  // recherche » du téléphone.
  ok(page.includes('Set de runes recherché') && page.includes('Critères') && page.includes('Options') && !page.includes('Gabarits de l\'Optimizer'),
    'hors développement : la page de l\'Optimizer, jamais la vue');
}

// OutilsPage avec l'état réel du hook, rendu comme dans l'app.
function pageOptimizer() {
  faussLocalStorage({});
  function Page() {
    const optimizer = useOptimizerState();
    const lists = useOptimizerLists();
    return (
      <OutilsPage sub="optimizer" box={BOX} runes={INVENTAIRE.runes} artifacts={INVENTAIRE.artifacts} relics={INVENTAIRE.relics}
        relicUsageById={INVENTAIRE.relicUsageById} loadState="live" optimizer={optimizer} onImporterEquipe={optimizer.importerEquipe}
        allMonsters={MONSTRES} rtaEntries={{}} siegeDefenseTeams={[]} siegeOffenseTeams={[]} lists={lists} accountName="Testeur"
        menuOuvert={false} onFermerMenu={rien} onOuvrirMenu={rien} />
    );
  }
  return <Page />;
}
