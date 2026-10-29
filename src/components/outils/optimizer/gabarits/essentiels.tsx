import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import ListeDeTravailBureau, { LARGEUR_MONSTRE as LARGEUR_ESSENTIELS } from '../bureau/ListeDeTravailBureau';
import SetDeRunesCompact from '../bureau/SetDeRunesCompact';
import PrincipalesImposeesBureau, { LARGEUR_COLONNE_ETROITE } from '../bureau/PrincipalesImposeesBureau';
import ConditionsBureau, { LARGEUR_CONDITIONS } from '../bureau/ConditionsBureau';
import EtatMonstreEssentiels from '../bureau/EtatMonstreEssentiels';
import { Onglets } from '../../../../ui';
import SelecteurListes from '../SelecteurListes';
import MonsterSourcePicker from '../../MonsterSourcePicker';
import OptimizerImportButton from '../../OptimizerImportButton';
import { listesInertes, optimizerInerte } from './inertes';
import type { ContexteGabarits, Gabarit } from './types';
import { exclusionSelectorKey, resolveExclusionEntry, type OptimizerListMember } from '../../../../lib/optimizerExclusion';
import { leadEffectifMembreOptimizer } from '../../../../lib/equipesOptimizer';
import { artifactConditionFloor, relicConditionFloor } from '../../../../lib/artifactConditionFloor';
import { type DamageSetup } from '../../../../lib/damage';
import type { ColonneReglage } from '../../../../lib/optimizerColonnes';
import type { EquipeOptimizer } from '../../../../lib/optimizerMemberStorage';
import type { StatKey } from '../../../../lib/effects';
import type { Monster } from '../../../../types';

// Les gabarits des ESSENTIELS (colonne de gauche du bureau) et du contrôle à
// onglets. Chaque état part de l'état réel (`ContexteGabarits`) ; ses gestes
// agissent sur un état local, jamais sur l'Optimizer.

const LISTE_GABARIT = { id: 'gabarit', name: 'Défense G3' };
// Monstres non possédés ajoutés à la liste remplie, pour dépasser les ≈ 4 lignes
// visibles avec le compte d'exemple (3 monstres) : pris dans le bestiaire.
const NON_POSSEDES = ['Lushen', 'Veromos', 'Theomars', 'Chasun', 'Bastet'];

// Le monstre de l'Optimizer : l'espèce choisie, son premier exemplaire Box.
function monstreReel(ctx: ContexteGabarits) {
  const id = ctx.optimizer.selectedId;
  if (!id) return null;
  const item = ctx.box.find((b) => String(b.monster.id) === id && b.gear);
  return item ? { monster: item.monster, gear: item.gear! } : null;
}

function membresRemplis(ctx: ContexteGabarits): OptimizerListMember[] {
  const box = ctx.box.filter((b) => b.gear).map((b) => ({ listId: LISTE_GABARIT.id, selector: { source: 'box' as const, unitKey: b.key } }));
  const autres = NON_POSSEDES.map((nom) => ctx.allMonsters.find((m) => m.name === nom))
    .filter((m): m is Monster => !!m)
    .map((m) => ({ listId: LISTE_GABARIT.id, selector: { source: 'unowned' as const, monsterId: String(m.id) } }));
  return [...box, ...autres].slice(0, 7);
}

function ListeGabarit({ ctx, mode }: { ctx: ContexteGabarits; mode: 'vide' | 'remplie' | 'reelle' }) {
  const lists = useMemo(() => {
    if (mode === 'reelle') return listesInertes(ctx.lists);
    if (mode === 'vide') return listesInertes(ctx.lists, { lists: [LISTE_GABARIT], activeListId: LISTE_GABARIT.id, members: [], teams: [], validated: [], rapportStockage: [] });
    const members = membresRemplis(ctx);
    const equipe: EquipeOptimizer = {
      id: 'gabarit-equipe', listId: LISTE_GABARIT.id, members: members.slice(0, 3).map((m) => m.selector),
      leader: members[0]?.selector, lead: { stat: 'Attack Speed', amount: 24, area: 'General', element: null },
    };
    return listesInertes(ctx.lists, { lists: [LISTE_GABARIT], activeListId: LISTE_GABARIT.id, members, teams: [equipe], validated: [], rapportStockage: [] });
  }, [ctx, mode]);
  const optimizer = useMemo(() => optimizerInerte(ctx.optimizer), [ctx.optimizer]);
  const [actif, setActif] = useState<Monster | null>(() => {
    if (mode === 'vide') return null;
    if (mode === 'reelle') return monstreReel(ctx)?.monster ?? null;
    const premier = lists.members[0];
    return premier ? resolveExclusionEntry(premier.selector, ctx.exclusionData)?.monster ?? null : null;
  });
  const activeList = lists.lists.find((l) => l.id === lists.activeListId) ?? null;
  const activeMembers = lists.activeListId ? lists.members.filter((m) => m.listId === lists.activeListId) : [];
  const equipes = lists.teams.filter((e) => e.listId === lists.activeListId);
  const dansEquipe = (m: OptimizerListMember, e: EquipeOptimizer) => e.members.some((s) => exclusionSelectorKey(s) === exclusionSelectorKey(m.selector));
  const groupesMembres = [
    ...equipes.map((equipe) => ({ equipe, members: activeMembers.filter((m) => dansEquipe(m, equipe)) })),
    { equipe: null, members: activeMembers.filter((m) => !equipes.some((e) => dansEquipe(m, e))) },
  ];
  const compte: Record<string, number> = {};
  for (const m of lists.members) compte[m.listId] = (compte[m.listId] ?? 0) + 1;
  const runeById = new Map(ctx.runes.map((r) => [r.id, r]));
  const artifactById = new Map(ctx.artifacts.map((a) => [a.id, a]));
  const rien = () => {};
  return (
    <ListeDeTravailBureau
      listes={<SelecteurListes lists={lists} memberCounts={compte} titreSection
        action={<OptimizerImportButton enLigne sources={[]} onImporter={optimizer.importerEquipe} rapport={null} />} />}
      recherche={<MonsterSourcePicker mode="bestiary" candidates={ctx.allMonsters} onPick={setActif} />}
      monstreActif={actif}
      liste={{
        activeList, activeMembers, groupesMembres, lists, optimizer, exclusionData: ctx.exclusionData, artifacts: ctx.artifacts,
        setEquipeOuverte: rien, rapportZoneC: mode === 'reelle' ? [...ctx.lists.rapportStockage, ...ctx.optimizer.rapportCriteres] : [],
        runeById, artifactById, choisirMembreDeLaListe: (_m, resolved) => setActif(resolved?.monster ?? null),
        setReleaseConfirm: rien, setReleaseArtifactsConfirm: rien, setRemoveMemberConfirm: rien, rappelAuras: false,
        listHasValidated: activeList != null && lists.validated.some((v) => v.listId === activeList.id), setReleaseAllConfirm: rien,
      }}
    />
  );
}

function SetGabarit({ initial, invalide = false }: { initial: string[]; invalide?: boolean }) {
  const [sets, setSets] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);
  return <SetDeRunesCompact setPickerSectionRef={ref} setPickerInvalid={invalide && sets.length === 0} comboSets={sets} onChangeSets={setSets} />;
}

type Principales = Partial<Record<2 | 4 | 6, number[]>>;
function PrincipalesGabarit({ initial }: { initial: Principales }) {
  const [choix, setChoix] = useState(initial);
  const basculer = (slot: 2 | 4 | 6, code: number) => setChoix((c) => {
    const avant = c[slot] ?? [];
    return { ...c, [slot]: avant.includes(code) ? avant.filter((x) => x !== code) : [...avant, code] };
  });
  return <PrincipalesImposeesBureau mainStatsBySlot={choix} toggleMainStat={basculer} />;
}

type Stats = Partial<Record<StatKey, number>>;
function ConditionsGabarit({ ctx, min, max }: { ctx: ContexteGabarits; min: Stats; max: Stats }) {
  const [minStats, setMinStats] = useState(min);
  const [maxStats, setMaxStats] = useState(max);
  const [excludeBase, setExcludeBase] = useState(ctx.optimizer.excludeBase);
  const monstre = monstreReel(ctx) ?? (ctx.box.find((b) => b.gear) ? { gear: ctx.box.find((b) => b.gear)!.gear! } : null);
  const baseOf = (key: StatKey) => (monstre ? (monstre.gear.base as unknown as Record<StatKey, number>)[key] : 0);
  const artifactFloorOf = (key: StatKey, base: number, bonusMode: boolean) =>
    artifactConditionFloor(key, base, bonusMode, ctx.optimizer.optimiserArtefacts ? ctx.optimizer.artifactMainByKind : { element: 'equipped', archetype: 'equipped' }, monstre?.gear.artifacts ?? [])
    + relicConditionFloor(key, base, ctx.optimizer.relicMainChoice, monstre?.gear.relic);
  return <ConditionsBureau excludeBase={excludeBase} setExcludeBase={setExcludeBase} baseOf={baseOf} artifactFloorOf={artifactFloorOf}
    minStats={minStats} maxStats={maxStats} setMinStats={setMinStats} setMaxStats={setMaxStats} />;
}

function EtatGabarit({ ctx, patch = {}, equipe = false }: { ctx: ContexteGabarits; patch?: Partial<DamageSetup>; equipe?: boolean }) {
  const [setup, setSetup] = useState<DamageSetup>(() => ({ ...ctx.optimizer.lireCombatMembre().setup, ...patch }));
  // Le motif est celui que l'app calcule pour un membre d'une équipe dont le
  // lead d'Arène est inactif en donjon (`leadEffectifMembreOptimizer`), jamais
  // recopié ici. (Celui d'une liste sans contenu de combat ne s'affiche jamais.)
  const selecteur = { source: 'unowned' as const, monsterId: 'gabarit' };
  const lead = leadEffectifMembreOptimizer({
    teams: [{ id: 'e', listId: 'l', members: [selecteur], lead: { stat: 'Attack Speed', amount: 24, area: 'Arena', element: null } }],
    listContents: new Map([['l', 'donjon']]),
  }, 'l', selecteur, 'fire');
  return <EtatMonstreEssentiels setup={setup} maj={(p) => setSetup((s) => ({ ...s, ...p }))} equipe={equipe}
    motifLead={equipe && lead.type === 'aucun' ? lead.motif : null} etroit={false} rappelsBuffs={[]} />;
}

const LARGEUR_ONGLETS = 320;
const AUCUNE_COLONNE = { artefacts: false, complements: false, derniere: null };
function OngletsGabarit({ initial }: { initial: { artefacts: boolean; complements: boolean; derniere: string | null }; deuxTiennent: boolean }) {
  const [etat, setEtat] = useState<ColonneReglage>(initial.complements ? 'complements' : 'artefacts');
  return <Onglets aria-label="Réglages de recherche" valeur={etat} onChange={setEtat}
    options={[{ cle: 'artefacts', libelle: 'Artéfacts' }, { cle: 'complements', libelle: 'Options' }]} />;
}

export const GABARITS_ESSENTIELS: Gabarit[] = [
  {
    id: 'liste', nom: 'Liste de travail (et choix du monstre)', largeur: LARGEUR_ESSENTIELS, hauteurEstimee: 412,
    composant: 'ListeDeTravailBureau (bureau/ListeDeTravailBureau.tsx), composant à part',
    telephone: 'Partage MonstresDeLaListe avec le téléphone, par une variante qu\'il ne prend pas (prop enTete) ; SelecteurListes, MonsterSourcePicker et OptimizerImportButton tels quels.',
    changements: [
      '« Rechercher un monstre… » et le monstre actif passent sur la rangée du titre de la carte de la liste ; plus de bloc « Monstre à optimiser » au-dessus.',
      'Le titre de la carte est toujours « Ajouter un monstre / à la liste », sur deux lignes (il nomme le champ qui le suit) : ni le nom de la liste ni son compte, que « Liste active » dit juste au-dessus.',
      '« Liste active » prend le style d\'un titre de section (13,5 px gras ; le téléphone garde l\'étiquette).',
      'Les puces d\'exemplaire (Box / RTA / Défenses siège / Offenses siège) quittent ce bloc pour la carte « Exemplaire ».',
      'Dans cette vue : « Importer une équipe » sans sources, gestes de la liste inertes (ils restent dans OptimizerSection).',
    ],
    etats: [
      { id: 'vide', nom: 'Liste vide, aucun monstre', rendu: (ctx) => <ListeGabarit ctx={ctx} mode="vide" /> },
      { id: 'remplie', nom: 'Liste remplie (7 membres, une équipe), monstre actif', rendu: (ctx) => <ListeGabarit ctx={ctx} mode="remplie" /> },
      { id: 'reelle', nom: 'Listes réelles du navigateur', rendu: (ctx) => <ListeGabarit ctx={ctx} mode="reelle" /> },
    ],
  },
  {
    id: 'set', nom: 'Set de runes recherché (compact)', largeur: LARGEUR_ESSENTIELS, hauteurEstimee: 110,
    composant: 'SetDeRunesCompact (bureau/SetDeRunesCompact.tsx), composant à part',
    telephone: 'Aucun composant modifié : SetComboPicker (partagé) est repris tel quel dans la surface ; le téléphone garde SetDeRunes.',
    changements: [
      'La grille d\'icônes n\'est plus toujours déployée : une liste fermée montre les sets choisis, la grille (jetons, retrait, deux groupes) s\'ouvre en flottant ; un clic de plus pour choisir.',
      'Une seule liste (et non « Set principal » · « Set secondaire ») : deux fois le même set reste possible.',
      '« Sélectionne au moins un set… » se met sur la ligne du titre (le compte « n/6 runes » n\'y figure que déplié, en A3 quand la colonne tient) : aucune ligne réservée sous la liste, et rien ne bouge quand il paraît.',
      'Liste fermée sans set : « Aucun ».',
      'La liste reste ouverte pendant la composition (après un set de 4, il reste un set de 2 à choisir) ; elle se ferme d\'elle-même au choix qui remplit les six emplacements, sinon au clic ailleurs ou à Échap.',
    ],
    etats: [
      { id: 'aucun', nom: '0 set', rendu: () => <SetGabarit initial={[]} /> },
      { id: 'choisis', nom: 'Un set (Violent, 4/6)', rendu: () => <SetGabarit initial={['violent']} /> },
      { id: 'plein', nom: 'Plein (Violent + Will, 6/6)', rendu: () => <SetGabarit initial={['violent', 'will']} /> },
      { id: 'repete', nom: 'Même set répété (Blade × 2 + Fight)', rendu: () => <SetGabarit initial={['blade', 'blade', 'fight']} /> },
      { id: 'invalide', nom: 'Recherche refusée sans set', rendu: () => <SetGabarit initial={[]} invalide /> },
      { id: 'reel', nom: 'Sets de l\'Optimizer', rendu: (ctx) => <SetGabarit initial={ctx.optimizer.comboSets} /> },
    ],
  },
  {
    id: 'principales', nom: 'Statistique principale imposée (slots pairs)', largeur: LARGEUR_COLONNE_ETROITE, hauteurEstimee: 126,
    composant: 'PrincipalesImposeesBureau (bureau/PrincipalesImposeesBureau.tsx), composant à part, sur SelecteurMultiple (src/ui)',
    telephone: 'Aucun composant modifié : le téléphone garde StatPrincipaleImposee (puces).',
    changements: [
      'Une rangée de puces par slot devient une liste à choix multiples par slot ; « Libre » quand rien n\'est choisi ; un clic de plus pour voir ou changer les choix.',
      'Ouverte, une liste classique (« forme 2 ») : chaque principale choisie en surbrillance, sans case ; un clic la choisit ou la retire, la liste reste ouverte.',
      'Fermée, la liste montre toutes les principales choisies, à la ligne entre deux, rien de tronqué ; chaque champ a d\'avance la hauteur de son slot entier (deux lignes), un choix ne le fait pas grandir.',
      'Le nom du slot au-dessus de sa liste, qui prend la largeur de la carte ; les trois listes s\'espacent dans la hauteur de la carte (12 px au moins).',
    ],
    etats: [
      { id: 'libres', nom: 'Principales libres', rendu: () => <PrincipalesGabarit initial={{}} /> },
      { id: 'choisies', nom: 'Principales choisies', rendu: () => <PrincipalesGabarit initial={{ 2: [8], 4: [9, 10], 6: [2, 4, 6] }} /> },
      { id: 'reelles', nom: 'Principales de l\'Optimizer', rendu: (ctx) => <PrincipalesGabarit initial={ctx.optimizer.mainStatsBySlot} /> },
    ],
  },
  {
    id: 'conditions', nom: 'Conditions', largeur: LARGEUR_CONDITIONS, hauteurEstimee: 336,
    composant: 'ConditionsBureau (bureau/ConditionsBureau.tsx) : une carte autour de Conditions, variante bureau',
    telephone: 'Partage Conditions avec le téléphone, par une variante qu\'il ne prend pas (prop bureau).',
    changements: ['Dans sa propre carte de 362 px : la colonne des libellés prend la largeur du plus long d\'entre eux (plus 90 px au moins), Min et Max s\'en rapprochent ; les champs gardent leur largeur.'],
    etats: [
      { id: 'vides', nom: 'Conditions vides', rendu: (ctx) => <ConditionsGabarit ctx={ctx} min={{}} max={{}} /> },
      { id: 'remplies', nom: 'PV, VIT et Taux Crit minimum, Taux Crit maximum', rendu: (ctx) => <ConditionsGabarit ctx={ctx} min={{ hp: 20000, spd: 200, cr: 85 }} max={{ cr: 100 }} /> },
      { id: 'reelles', nom: 'Conditions de l\'Optimizer', rendu: (ctx) => <ConditionsGabarit ctx={ctx} min={ctx.optimizer.minStats} max={ctx.optimizer.maxStats} /> },
    ],
  },
  {
    id: 'etat', nom: 'État de mon monstre : buffs et lead', largeur: LARGEUR_COLONNE_ETROITE, hauteurEstimee: 186,
    composant: 'EtatMonstreEssentiels (bureau/EtatMonstreEssentiels.tsx), composant à part',
    telephone: 'EtatMonstre (partagé) exporte son titre, son choix du lead et ses rappels, rendu inchangé ; le téléphone garde EtatMonstre entier.',
    changements: [
      'Réduit aux buffs et au lead ; « Sets d\'aura des autres monstres » passe en tête de la colonne « Aura, exclusion, avancés ».',
      'Les trois vignettes de buff en colonne, à toute largeur de fenêtre, centrée dans la carte.',
      'L\'aide du titre ne nomme plus les sets d\'aura et n\'a plus le paragraphe « Ce qui décrit le combat… ».',
      'Aux deux formats : plus de phrase « Lead effectif de l\'équipe : … » ni de motif « Le contenu de combat de la liste n\'est pas défini… ». Au bureau, le motif d\'un lead inactif ne paraît que s\'il existe, sous le lead, sans place réservée (le téléphone garde la sienne).',
    ],
    etats: [
      { id: 'defaut', nom: 'Ni buff ni lead', rendu: (ctx) => <EtatGabarit ctx={ctx} patch={{ atkBuff: false, defBuff: false, spdBuff: false, leaderSkill: undefined }} /> },
      { id: 'buffs-lead', nom: 'Buffs ATQ et VIT, lead VIT 24 %', rendu: (ctx) => <EtatGabarit ctx={ctx} patch={{ atkBuff: true, defBuff: false, spdBuff: true, leaderSkill: { stat: 'Attack Speed', pct: 24 } }} /> },
      { id: 'lead-inactif', nom: 'Membre d\'équipe, lead inactif', rendu: (ctx) => <EtatGabarit ctx={ctx} equipe patch={{ leaderSkill: undefined }} /> },
      { id: 'reel', nom: 'État de l\'Optimizer', rendu: (ctx) => <EtatGabarit ctx={ctx} /> },
    ],
  },
  {
    id: 'onglets', nom: 'Contrôle à onglets des colonnes repliables', largeur: LARGEUR_ONGLETS, hauteurEstimee: 36,
    composant: 'Onglets (src/ui/Onglets.tsx)',
    telephone: 'Aucun : le téléphone garde le panneau « Options ».',
    changements: [
      'Nouveau contrôle : « Artéfacts et relique » · « Aura, exclusion, avancés » ouvrent leur colonne ; recliquer l\'onglet actif la referme.',
      'Là où une seule colonne tient, ouvrir l\'une ferme l\'autre ; là où les deux tiennent, la seconde s\'ajoute.',
      'Exclusion de runes et Réglages avancés ne s\'ouvrent plus en flottant depuis leur en-tête : ils sont en ligne dans leur colonne.',
    ],
    etats: [
      { id: 'aucune', nom: 'Aucune colonne', rendu: () => <OngletsGabarit initial={AUCUNE_COLONNE} deuxTiennent={false} /> },
      { id: 'artefacts', nom: '« Artéfacts et relique » ouverte', rendu: () => <OngletsGabarit initial={{ artefacts: true, complements: false, derniere: 'artefacts' }} deuxTiennent={false} /> },
      { id: 'complements', nom: '« Aura, exclusion, avancés » ouverte', rendu: () => <OngletsGabarit initial={{ artefacts: false, complements: true, derniere: 'complements' }} deuxTiennent={false} /> },
      { id: 'les-deux', nom: 'Les deux (dès 1 872 px)', rendu: () => <OngletsGabarit initial={{ artefacts: true, complements: true, derniere: 'complements' }} deuxTiennent /> },
    ],
  },
];
