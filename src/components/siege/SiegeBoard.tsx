import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Gauge, Wand2, Upload, Download } from 'lucide-react';
import { IconeDefense, IconeOffense } from '../IconesAtelier';
import { Monster, ElementKey, SiegeTeam as SiegeTeamData } from '../../types';
import { LoadState } from '../../hooks/useMonsters';
import { SiegeSide, UseSiegeState } from '../../hooks/useSiegeState';
import { useStickyState } from '../../hooks/useStickyState';
import SiegeTeam from './SiegeTeam';
import SpeedTuneModale from '../outils/SpeedTuneModale';
import CreateMonster from '../CreateMonster';
import { ConfirmDialog } from '../../ui/Dialogs';
import MobileSheet from '../../ui/MobileSheet';
import { BarreActions, Bouton, Interrupteur, Jeton, useNotifier } from '../../ui';
import MonsterPicker from '../MonsterPicker';
import MonsterAvatar from '../MonsterAvatar';
import { equipeContient } from './rechercheEquipe';
import { exporterEquipes, lireEquipes, nomFichierSiege } from '../../lib/siegeShare';
import { telechargerTexte } from '../../lib/telechargement';
import { NOM_APP } from '../../marque';
import { CustomLead } from '../../hooks/useCustomMonsters';
import type { ActionImportOptimizer } from '../../lib/actionImportOptimizer';
import type { ExclusionSourceData } from '../../lib/optimizerExclusion';
import { importerDefensesSiegeOptimizer, importerOffenseSiegeOptimizer } from '../../lib/importEquipes';

interface Props {
  onImporterEquipe: ActionImportOptimizer;
  sourcesOptimizer: ExclusionSourceData;
  compteCharge: boolean;
  side: SiegeSide;
  siege: UseSiegeState;
  monsters: Monster[];
  // Les équipes des DEUX camps : l'outil de speed tuning, ouvert en modale
  // depuis une équipe, propose d'importer n'importe quel deck — pas seulement
  // ceux du côté qu'on regarde.
  siegeDefenseTeams: SiegeTeamData[];
  siegeOffenseTeams: SiegeTeamData[];
  loadState: LoadState;
  onCreateMonster: (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => Monster;
  customMonsters: Monster[];
  onDeleteMonster: (id: string) => void;
  // Panneau d'actions mobile — piloté par le bouton « Options » de la barre
  // d'onglets (voir App.tsx).
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

// L'import se fait globalement depuis la barre de nav (voir AccountImportControl) :
// un seul import alimente RTA + défense + offense. Ce board ne gère que la
// composition/édition des équipes de son côté.
export default function SiegeBoard({
  onImporterEquipe,
  sourcesOptimizer,
  compteCharge,
  side,
  siege,
  monsters,
  siegeDefenseTeams,
  siegeOffenseTeams,
  loadState,
  onCreateMonster,
  customMonsters,
  onDeleteMonster,
  menuOuvert,
  onFermerMenu,
}: Props) {
  const produireEquipe = useCallback((teamId: string, data: ExclusionSourceData) => side === 'defense'
    ? importerDefensesSiegeOptimizer({ ...data, siegeDefenseTeams: data.siegeDefenseTeams.filter(t => t.id === teamId) })
    : importerOffenseSiegeOptimizer(teamId, data), [side]);
  const disponibiliteExport = useMemo(() => {
    const raisonCompte = 'Charge un compte pour exporter vers l’Optimizer.';
    const equipes = new Map(siege.state.teams.map(t => [t.id, !compteCharge ? raisonCompte
      : produireEquipe(t.id, sourcesOptimizer).membres.length ? undefined : 'Aucun monstre importable dans cette équipe.']));
    const defenses = !compteCharge ? raisonCompte : importerDefensesSiegeOptimizer(sourcesOptimizer).membres.length
      ? undefined : 'Aucun monstre importable dans les défenses de siège.';
    return { equipes, defenses };
  }, [compteCharge, produireEquipe, siege.state.teams, sourcesOptimizer]);
  const exporterDefensesOptimizer = () => onImporterEquipe(importerDefensesSiegeOptimizer);
  // ⚠️ **Éteint par défaut** : les équipes s'affichent telles quelles, et c'est
  // un geste délibéré qui demande la vérification. Tout ce que l'app calcule
  // ensuite est automatique — statut, message, ordre d'une équipe Swift : le
  // bouton dit QUAND on veut voir, pas ce qu'il faut recalculer soi-même.
  const [checkTicks, setCheckTicks] = useStickyState(`siege.checkTicks.${side}`, false);
  // Formulaire de création ouvert depuis le menu « ⋯ » (bureau).
  const [creationOuverte, setCreationOuverte] = useState(false);

  const noun = side === 'defense' ? 'défense' : 'attaque';
  // ⚠️ L'élision se choisit AVEC le mot : `d'${noun}` écrivait « équipes
  // d'défense ».
  const deNoun = side === 'defense' ? 'de défense' : "d'attaque";

  // Supprimer une équipe SE DÉFAIT au lieu de se confirmer (lot 13, décision
  // 29) : immédiat, puis « Équipe retirée · Annuler » la remet à SA place,
  // avec ses monstres, leurs vitesses et ses réglages.
  const notifier = useNotifier();
  function retirerEquipe(teamId: string) {
    const index = siege.state.teams.findIndex((t) => t.id === teamId);
    if (index < 0) return;
    const equipe = siege.state.teams[index];
    siege.removeTeam(teamId);
    notifier({
      message: `Équipe retirée ${side === 'defense' ? 'de la défense' : "de l'offense"}`,
      action: () => siege.restaurerEquipe(equipe, index),
    });
  }

  // « Voir le speed tune » : l'outil s'ouvre EN MODALE par-dessus le deck.
  //
  // ⚠️ **On ne change pas de page.** Y aller déposait l'équipe dans
  // `sessionStorage`, obligeait à retenir d'où l'on venait et à offrir un
  // « retour » — pour revenir à un écran qu'on n'avait pas de raison de quitter.
  // La page reste là, dessous : fermer la modale rend exactement sa place, son
  // défilement et ses équipes dépliées.
  const [speedTune, setSpeedTune] = useState<string | null>(null);

  // Mode vérification des ticks : désactivé par défaut (équipes neutres), on
  // l'active volontairement pour faire passer les auras de couleur.

  // Équipes en cours d'édition : remontées ici pour que la grille leur donne la
  // pleine largeur (les 3 slots seraient trop à l'étroit sur une demi-colonne).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (teamId: string) =>
    setExpandedIds((s) => {
      const next = new Set(s);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });

  // Scroll automatique vers l'équipe qu'on vient d'ajouter (rendue en dernier).
  const [scrollToLast, setScrollToLast] = useState(false);
  const [effacementAConfirmer, setEffacementAConfirmer] = useState(false);
  const lastTeamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollToLast) return;
    lastTeamRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollToLast(false);
  }, [scrollToLast]);

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  // ---- Recherche d'équipe par monstre (décision 14) ----------------------
  // ⚠️ État LOCAL, jamais enregistré : revenir sur la page montre toutes ses
  // équipes — un filtre oublié ferait croire à des équipes disparues.
  const [recherche, setRecherche] = useState('');
  // Les équipes affichées, AVEC leur rang dans la liste complète : la
  // numérotation (« Équipe 5 ») est l'identité de l'équipe, elle ne change pas
  // quand on filtre.
  const affichees = siege.state.teams
    .map((team, rang) => ({ team, rang }))
    .filter(({ team }) => equipeContient(team, recherche, monsterById));
  const filtre = recherche.trim() !== '';
  // Les monstres présents dans les équipes de ce côté : ce sont les seules
  // suggestions utiles (un autre monstre ne trouverait aucune équipe).
  const monstresDesEquipes = useMemo(() => {
    const vus = new Map<string, Monster>();
    for (const t of siege.state.teams)
      for (const sl of t.slots) {
        const m = sl.monsterId ? monsterById.get(sl.monsterId) : undefined;
        if (m) vus.set(String(m.id), m);
      }
    return [...vus.values()];
  }, [siege.state.teams, monsterById]);
  const choisi = filtre ? monstresDesEquipes.find((m) => m.name === recherche) ?? null : null;

  // ---- Export / import d'équipes (décision 14, lib/siegeShare) ------------
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.error ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [msg]);
  const fichierEquipes = useRef<HTMLInputElement>(null);

  function exporter() {
    const aExporter = affichees.map((a) => a.team);
    if (aExporter.length === 0) return;
    const { texte, equipes, perso } = exporterEquipes(aExporter, side, monsterById);
    const nom = nomFichierSiege(side);
    telechargerTexte(nom, texte);
    setMsg({
      text:
        `${equipes} équipe(s) exportée(s) · ${nom}` +
        (perso > 0 ? ` · ${perso} monstre(s) perso non exporté(s) : emplacement vide.` : ''),
    });
  }

  function importer(texte: string) {
    const lu = lireEquipes(texte, monsters);
    if (!lu.ok) {
      setMsg({ text: `Import refusé : ${lu.erreur}`, error: true });
      return;
    }
    siege.appendTeams(lu.equipes);
    setScrollToLast(true);
    setMsg({
      text:
        `${lu.equipes.length} équipe(s) ajoutée(s) à la suite des tiennes.` +
        (lu.cote !== side ? ` Le fichier venait ${lu.cote === 'defense' ? 'de la défense' : "de l'offense"}.` : '') +
        (lu.inconnus.length > 0
          ? ` ${lu.inconnus.length} monstre(s) absent(s) des données chargées (${lu.inconnus.slice(0, 3).join(', ')}${lu.inconnus.length > 3 ? '…' : ''}) : emplacement vide.`
          : ''),
      error: lu.inconnus.length > 0,
    });
  }

  // Les actions du board, rendues une seule fois et posées à DEUX endroits
  // selon la largeur : dans la page au-dessus de `lg`, dans le panneau en
  // dessous. Deux copies auraient divergé au premier bouton ajouté.
  // ⚠️ « Tout effacer » est SÉPARÉ des autres actions : dans la page il se pose
  // à l'opposé (`ml-auto`), loin des gestes de construction — un bouton
  // destructeur ne se met pas à côté de celui qu'on presse en boucle. Dans le
  // panneau il garde la même distance, en bas et détaché.
  // ⚠️ **Boutons de la librairie, pas des `<button>` redessinés.** Ce board les
  // écrivait à la main — trois fois la même paire de classes, un `lg:hidden` /
  // `hidden lg:inline` recopié pour chaque libellé court. `Bouton` porte déjà
  // ça par ses axes (`icone`+`libelle`+`libelleCourt`, `actif` pour un
  // interrupteur) : voir le même geste sur RTA (`RtaBackupBar`).
  // ⚠️ **Même bouton que RTA (`boutonEffacer` dans RtaPage.tsx), au trait
  // près.** Deux habillages selon le contenant, pas deux boutons : nu dans la
  // page, où il vit au bout d'une rangée d'actions déjà cadrées (un cadre de
  // plus y ferait du bruit) ; fond + contour rouges et PLEINE LARGEUR dans le
  // panneau, où il est seul sur sa ligne sous un filet — à sa largeur propre,
  // il y flottait au milieu d'une bande vide dont rien n'expliquait la
  // présence.
  // ⚠️ **Toujours affiché, désactivé s'il n'y a rien à effacer** — jamais
  // retiré. Un bouton qui apparaît une fois la première équipe créée ne
  // s'explique pas : on ne l'a jamais vu apparaître d'un geste, il était
  // juste absent. Désactivé, c'est un repère fixe de la page — même règle
  // partout dans l'app, voir RecoBoard.tsx.
  const effacer = (dansLePanneau: boolean) => (
    <Bouton
      onClick={() => {
        setEffacementAConfirmer(true);
        onFermerMenu();
      }}
      disabled={siege.state.teams.length === 0}
      ton="danger"
      fond={dansLePanneau ? 'doux' : 'vide'}
      trait={dansLePanneau ? 'plein' : 'aucun'}
      pleineLargeur={dansLePanneau}
      taille="sm"
      icone={<Trash2 size={13} />}
      libelle="Tout effacer"
      title={siege.state.teams.length === 0 ? "Aucune équipe à effacer" : undefined}
      // ⚠️ `leading-none` : l'interligne du libellé donne au texte une boîte
      // plus haute que sa lettre. Centrées boîte contre boîte, la poubelle et
      // le mot ne le sont plus à l'œil.
      className="leading-none"
    />
  );

  // Posé DEUX fois : dans l'en-tête bureau, et seul dans la page au téléphone.
  const compteur = (
    <>
      {siege.state.teams.length} équipe{siege.state.teams.length > 1 ? 's' : ''}
    </>
  );

  const actions = (
    <>
      {/* ⚠️ Deux longueurs : en grille à trois colonnes, un bouton dispose d'un
          tiers de 348 px. « Ajouter une équipe » y passait à la ligne et
          déformait la rangée. `libelleCourt` porte « Équipe » sous `lg`,
          l'infobulle et `aria-label` gardent la phrase entière. */}
      <Bouton
        onClick={() => {
          siege.addTeam();
          setScrollToLast(true);
          onFermerMenu();
        }}
        aria-label="Ajouter une équipe"
        icone={<Plus size={15} />}
        libelle="Ajouter une équipe"
        libelleCourt="Équipe"
      />

      {/* ⚠️ « Vérifier mes speed » n'est PLUS ici : au téléphone, c'est un
          interrupteur sur la page, à côté du compteur (lot 11b, décision 25) —
          un affichage qu'on allume et éteint en parcourant ses équipes. */}

      {/* Export / import d'équipes (décision 14) — mêmes gestes que dans
          l'en-tête bureau, mêmes fonctions. */}
      <Bouton
        onClick={() => {
          exporter();
          onFermerMenu();
        }}
        disabled={affichees.length === 0}
        title={affichees.length === 0 ? 'Aucune équipe à exporter' : 'Exporter les équipes affichées en fichier .json'}
        icone={<Upload size={15} />}
        libelle="Exporter"
      />
      <Bouton
        onClick={() => {
          fichierEquipes.current?.click();
          onFermerMenu();
        }}
        title={`Ajouter les équipes d'un fichier .json exporté par ${NOM_APP} — les tiennes ne sont pas touchées`}
        icone={<Download size={15} />}
        libelle="Importer"
      />

      {/* En dernier des actions : c'est le geste le plus rare. */}
      <CreateMonster
        onCreate={onCreateMonster}
        customMonsters={customMonsters}
        onDelete={onDeleteMonster}
      />
    </>
  );

  return (
    <div>
      {/* ⚠️ Sous `lg`, les trois actions descendent dans le panneau
          « Options » : à 40 px avec leur libellé complet, elles remplissaient
          deux rangées avant la première équipe. Le COMPTEUR reste, lui — c'est
          une information, pas une action, et elle tient sur une ligne. */}
      {/* ---- En-tête BUREAU (refonte graphique, lot 7a) --------------------
          Comme la RTA (décision 13, précisée) : le titre, le compteur, puis
          les actions — toutes en boutons quand elles tiennent sur la ligne,
          sinon « Ajouter une équipe » et « Vérifier mes speed » visibles et le
          reste (Créer un monstre, Tout effacer) dans le menu « ⋯ ».
          « Ajouter une équipe » est l'action PRINCIPALE de l'écran (décision
          4, aplat d'accent). Le téléphone garde son compteur et son panneau
          « Options » (lot 11). */}
      <div className="mt-5 hidden flex-wrap items-center gap-x-3 gap-y-1 lg:flex">
        <h1 className="font-display text-xl tracking-wide text-ink">
          {side === 'defense' ? 'Défense' : 'Offense'}
        </h1>
        <span className="rounded-full border border-border-soft bg-panel2 px-2 py-0.5 font-mono text-micro text-ink-dim">
          {compteur}
        </span>
        <BarreActions
          libelleMenu="Plus d'actions"
          toujours={[
            // « Vérifier mes speed » vient en premier : c'est pour vérifier ses
            // équipes qu'on vient ici, on n'en ajoute qu'une de temps en temps.
            // ⚠️ **Aucune action n'est mise en avant** (pas d'aplat d'accent) :
            // essayé sur ce bouton, le mainteneur l'a retiré — « ça rend pas bien ».
            // Allumé, il prend le fond d'accent doux d'un bouton enclenché.
            {
              cle: 'verifier',
              libelle: 'Vérifier mes speed',
              icone: <Gauge size={15} />,
              actif: checkTicks,
              disabled: siege.state.teams.length === 0,
              // Même texte que le bouton du panneau mobile, ci-dessous.
              title:
                siege.state.teams.length === 0
                  ? 'Aucune équipe à vérifier'
                  : checkTicks
                    ? 'Masquer les auras de vérification'
                    : 'Colorer les équipes selon leur vitesse : speed tune pour une équipe Swift, calage sur les ticks ATB pour les autres',
              onClick: () => setCheckTicks((v) => !v),
            },
            {
              cle: 'ajouter',
              libelle: 'Ajouter une équipe',
              'aria-label': 'Ajouter une équipe',
              icone: <Plus size={15} />,
              onClick: () => {
                siege.addTeam();
                setScrollToLast(true);
              },
            },
            ...(side === 'defense' ? [{
              cle: 'optimizer', libelle: "Exporter vers l'Optimizer", icone: <Upload size={15} />,
              disabled: !!disponibiliteExport.defenses,
              title: disponibiliteExport.defenses ?? 'Créer une liste avec toutes les défenses de siège.',
              onClick: exporterDefensesOptimizer,
            }] : []),
          ]}
          autres={[
            // Export / import d'équipes — ajout décidé par le mainteneur (décision 14).
            {
              cle: 'exporter',
              libelle: 'Exporter',
              icone: <Upload size={14} />,
              disabled: affichees.length === 0,
              title:
                affichees.length === 0
                  ? 'Aucune équipe à exporter'
                  : filtre
                    ? 'Exporter les équipes affichées (celles de la recherche) en fichier .json'
                    : `Télécharger tes équipes ${deNoun} en fichier .json, pour les partager ou les garder de côté`,
              onClick: exporter,
            },
            {
              cle: 'importer',
              libelle: 'Importer',
              icone: <Download size={14} />,
              title: `Ajouter les équipes d'un fichier .json exporté par ${NOM_APP} — les tiennes ne sont pas touchées`,
              onClick: () => fichierEquipes.current?.click(),
            },
            {
              cle: 'creer',
              libelle: 'Créer un monstre',
              icone: <Wand2 size={15} />,
              title: "Créer un monstre qui n'existe pas dans les données chargées",
              onClick: () => setCreationOuverte(true),
            },
            {
              cle: 'effacer',
              libelle: 'Tout effacer',
              icone: <Trash2 size={14} />,
              danger: true,
              disabled: siege.state.teams.length === 0,
              title: siege.state.teams.length === 0 ? 'Aucune équipe à effacer' : undefined,
              onClick: () => setEffacementAConfirmer(true),
            },
          ]}
        />
      </div>
      {/* Le formulaire de création, ouvert depuis le menu (mode piloté). */}
      <CreateMonster
        onCreate={onCreateMonster}
        customMonsters={customMonsters}
        onDelete={onDeleteMonster}
        sansBouton
        ouvert={creationOuverte}
        onOuvert={setCreationOuverte}
      />

      {/* Le sélecteur de fichier de l'import d'équipes (jamais dessiné). */}
      <input
        ref={fichierEquipes}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de recharger le même fichier
          if (f) f.text().then(importer);
        }}
      />

      {/* ---- Recherche d'équipe par monstre (décision 14) — aux deux formats.
          Le message d'export / d'import s'affiche juste en dessous. */}
      {/* ⚠️ **Une liste de suggestions sous le champ, comme partout ailleurs**
          (RTA, Recommandations) — demandé par le mainteneur : on tape, on CHOISIT un
          monstre dans la liste, et le filtre s'applique. Les suggestions ne
          proposent que les monstres PRÉSENTS dans les équipes de ce côté : un
          autre ne trouverait rien. Le monstre choisi devient un jeton, que sa
          croix retire. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="w-full sm:w-72">
          <MonsterPicker
            monsters={monstresDesEquipes}
            placeholder="Nom du monstre…"
            ariaLabel="Chercher une équipe par monstre"
            onPick={(id) => setRecherche(monsterById.get(id)?.name ?? '')}
          />
        </div>
        {filtre && (
          <>
            <Jeton
              icone={
                choisi ? <MonsterAvatar monster={choisi} size={20} /> : undefined
              }
              libelle={recherche}
              onRetirer={() => setRecherche('')}
              libelleRetrait="Vider la recherche"
            />
            <span className="font-mono text-xs text-ink-dim">
              {affichees.length} équipe{affichees.length > 1 ? 's' : ''} sur {siege.state.teams.length}
            </span>
          </>
        )}
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.error ? 'text-bad' : 'text-good'}`} role="status">
          {msg.text}
        </p>
      )}

      {/* TÉLÉPHONE : le compteur et « Vérifier mes speed » ; les autres
          actions sont dans le panneau.
          ⚠️ **Un INTERRUPTEUR sur la page** (lot 11b, décision 25, la
          maquette) : il était un bouton du panneau « Options », qu'il fallait
          ouvrir pour allumer ou éteindre un AFFICHAGE qu'on consulte en
          parcourant ses équipes. Toujours affiché, désactivé sans équipe. */}
      <div className="mt-5 flex items-center gap-3 lg:hidden">
        <span className="font-mono text-xs text-ink-dim">{compteur}</span>
        {/* L'`Interrupteur` de la LIBRAIRIE, libellé à côté (et non le
            `Switch` des réglages, antérieur à la librairie). */}
        <Interrupteur
          actif={checkTicks}
          onChange={setCheckTicks}
          disabled={siege.state.teams.length === 0}
          libelle="Vérifier mes speed"
          aria-label="Vérifier mes speed"
          className="ml-auto"
          title={
            siege.state.teams.length === 0
              ? 'Aucune équipe à vérifier'
              : checkTicks
                ? 'Masquer les auras de vérification'
                : // ⚠️ L'interrupteur couvre les DEUX questions : une équipe
                  // Swift se juge sur son speed tune, les autres sur leur tick.
                  'Colorer les équipes selon leur vitesse : speed tune pour une équipe Swift, calage sur les ticks ATB pour les autres'
          }
        />
      </div>

      <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre={`Actions — ${noun}`}>
        <div data-rangee-actions>{actions}</div>
        {side === 'defense' && <Bouton className="mt-3" pleineLargeur
          libelle="Exporter vers l'Optimizer" icone={<Upload size={15} />}
          disabled={!!disponibiliteExport.defenses}
          title={disponibiliteExport.defenses ?? 'Créer une liste avec toutes les défenses de siège.'}
          onClick={exporterDefensesOptimizer} />}
        <div data-zone-destructive className="mt-4 border-t border-border pt-3">
          {effacer(true)}
        </div>
      </MobileSheet>

      {effacementAConfirmer && (
        <ConfirmDialog
          titre={`Effacer toutes les équipes ${deNoun} ?`}
          message="Toutes les équipes de ce côté seront supprimées, avec leurs monstres et leurs vitesses. L'autre côté n'est pas touché."
          libelleAction="Tout effacer"
          destructif
          onCancel={() => setEffacementAConfirmer(false)}
          onConfirm={() => {
            setEffacementAConfirmer(false);
            siege.clearAll();
          }}
        />
      )}

      {loadState === 'loading' && monsters.length === 0 && (
        <p className="mt-4 text-ink-dim text-sm">Chargement des monstres…</p>
      )}

      {siege.state.teams.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-panel/40 py-16 px-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-panel2 border border-border mb-4">
            {/* L'icône du CÔTÉ, celle de son entrée de nav — bouclier ou épée
                (rebranding, décision 44). */}
            {side === 'defense' ? (
              <IconeDefense size={26} className="text-ink-dim" />
            ) : (
              <IconeOffense size={26} className="text-ink-dim" />
            )}
          </div>
          <p className="text-ink-dim text-sm max-w-md">
            Aucune équipe {deNoun} pour l'instant. Clique sur{' '}
            <b className="text-ink">Ajouter une équipe</b> pour composer, ou importe ton compte
            depuis la barre du haut.
          </p>
        </div>
      ) : affichees.length === 0 ? (
        // La recherche ne trouve rien : on le dit, et on propose d'en sortir.
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-ink-dim">
            Aucune équipe ne contient « {recherche.trim()} ».
          </p>
          <Bouton taille="sm" libelle="Effacer la recherche" onClick={() => setRecherche('')} />
        </div>
      ) : (
        // ⚠️ **Autant de colonnes que la PLACE en permet** (lot 7a, « optimiser
        // l'espace ») : des colonnes d'au moins 480 px — la largeur où les trois
        // monstres d'une équipe tiennent côte à côte, nom et vitesse lisibles.
        // Le nombre suit la largeur RÉELLE, barre latérale comprise : 1 colonne
        // sur un écran de 1024 px, 2 sur 1280, 3 sur 1920. Il était fixé à 2
        // à partir de `xl`, même sur un grand écran qui en tenait trois.
        // Une équipe en édition reprend toute la ligne (`col-span-full`).
        // `items-start` évite d'étirer les cartes basses.
        // ⚠️ Écarts réduits sous `sm` : la page empile jusqu'à huit équipes, et
        // chaque écart se paie autant de fois — un écran entier de vide sur un
        // téléphone.
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,480px),1fr))] items-start gap-2 sm:mt-4 sm:gap-3">
          {/* Les équipes AFFICHÉES (filtre de recherche), chacune avec son rang
              dans la liste complète : « Équipe 5 » reste « Équipe 5 ». */}
          {affichees.map(({ team, rang }) => (
            <div
              key={team.id}
              ref={rang === siege.state.teams.length - 1 ? lastTeamRef : undefined}
              className={expandedIds.has(team.id) ? 'col-span-full' : undefined}
            >
            <SiegeTeam
              team={team}
              onExporterOptimizer={() => onImporterEquipe(data => produireEquipe(team.id, data))}
              raisonExportOptimizer={disponibiliteExport.equipes.get(team.id)}
              index={rang}
              monsters={monsters}
              monsterById={monsterById}
              checkTicks={checkTicks}
              onVoirSpeedTune={setSpeedTune}
              expanded={expandedIds.has(team.id)}
              onToggleExpand={toggleExpand}
              onRemoveTeam={retirerEquipe}
              onPickMonster={siege.setSlotMonster}
              onClearSlot={siege.clearSlot}
              onSlotRune={siege.setSlotRune}
              onSlotTick={siege.setSlotTick}
              onDismissAlert={siege.dismissTickAlert}
              onSwap={siege.swapSlots}
            />
            </div>
          ))}
          {/* ⚠️ **La carte d'ajout, en fin de grille** (rebranding, décision 41,
              la toile) — en plus du bouton de l'en-tête, pas à sa place.
              BUREAU seulement : le téléphone ajoute depuis « Options »
              (décision 45).
              - Elle est la PLACE de la nouvelle équipe : l'équipe naît
                exactement là où l'on a cliqué, et la carte passe à la case
                suivante. Rien d'autre ne bouge, donc AUCUN défilement — au
                contraire du bouton d'en-tête, qui va chercher une équipe née
                hors de vue.
              - `self-stretch` : à côté d'une équipe, elle en prend la hauteur ;
                seule sur sa ligne, `min-h-36` la tient à la hauteur d'une
                carte repliée.
              - Désactivée pendant une recherche : une équipe vide n'y
                apparaîtrait pas, et la carte promet de la montrer ici. */}
          <Bouton
            onClick={() => siege.addTeam()}
            disabled={filtre}
            title={
              filtre
                ? "Vide la recherche pour ajouter une équipe ici : une équipe vide n'y apparaîtrait pas"
                : 'Ajouter une équipe à la fin de la liste'
            }
            fond="vide"
            trait="pointille"
            taille="carre"
            icone={<Plus size={22} />}
            libelle="Ajouter une équipe"
            // ⚠️ `lg:text-sm` et non `text-sm` : le `text-xs` de la taille
            // `carre` vient APRÈS `text-sm` dans le CSS construit et l'emportait.
            className="hidden min-h-36 w-full flex-col gap-2 self-stretch rounded-xl p-4 lg:inline-flex lg:text-sm"
          />
        </div>
      )}

      {/* L'outil de speed tuning, par-dessus le deck. ⚠️ Monté seulement quand
          on le demande : il charge les kits des monstres à l'ouverture. */}
      {speedTune && (
        <SpeedTuneModale
          onImporterEquipe={onImporterEquipe}
          sourcesOptimizer={sourcesOptimizer}
          compteCharge={compteCharge}
          deck={{ source: side, teamId: speedTune }}
          allMonsters={monsters}
          siegeDefenseTeams={siegeDefenseTeams}
          siegeOffenseTeams={siegeOffenseTeams}
          onClose={() => setSpeedTune(null)}
        />
      )}
    </div>
  );
}
