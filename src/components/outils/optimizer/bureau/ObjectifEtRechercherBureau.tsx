import { useEffect, useState, type ReactNode } from 'react';
import { Download, Search, Square, Upload } from 'lucide-react';
import { Bouton } from '../../../../ui';
import Segmented from '../../../../ui/Segmented';
import { OBJECTIVE_LABELS } from '../../../../lib/runeBuildOptim';
import ProgressionRecherche, { type ProgressionRechercheProps } from '../ProgressionRecherche';
import { ResumeCombat, TitreObjectifRecherche, type ObjectifEtActionsProps } from '../ObjectifEtActions';

export const LARGEUR_OBJECTIF_ETROIT = 340;
// La forme large prend la largeur de sa colonne : au moins celle d'« Exemplaire ».
export const LARGEUR_OBJECTIF_LARGE_MIN = 616;
// « Arrêter » reste inactif ce temps après le lancement : le double clic qui a
// lancé la recherche ne l'arrête pas (A.2.2-8 de la refonte).
export const DELAI_ARRET_MS = 300;

export type FormeObjectif = 'etroite' | 'large';

export interface ObjectifEtRechercherBureauProps extends ObjectifEtActionsProps {
  forme: FormeObjectif;
  // `EstimationPool`, ou `null` tant qu'il n'y a rien à estimer (aucun monstre, aucun set).
  estimation: ReactNode;
  // `MessageImportRecette` (rien sans message).
  messageImport: ReactNode;
  progression: Omit<ProgressionRechercheProps, 'status'>;
}

// La progression la plus haute que la recherche affiche (phase d'appariement,
// grands nombres) : copie invisible qui RÉSERVE sa place, à la largeur du bloc.
// Sans elle, la progression qui paraît au lancement pousserait ce qui suit le
// bloc (le contrôle à onglets en A2) au moment du clic.
const PROGRESSION_LA_PLUS_HAUTE: Omit<ProgressionRechercheProps, 'status'> = {
  progress: { phase: 'pairing', explored: 999_999_999_999, found: 999_999, pct: 1, totalPairs: 999_999_999_999, candidates: [] },
  refusal: null,
  compteAffiche: { compte: 999_999 },
};

// Le bloc « Objectif et Rechercher » du bureau, en deux formes (fiche
// docs/02-app/optimizer/ecran/README.md, « Bloc « Objectif et Rechercher » ») :
// - étroite, 340 px : estimation du pool, objectifs en 2 × 2, résumé « Dégâts
//   réels », « Rechercher », « Exporter » · « Importer », progression ;
// - large, à la largeur de sa colonne : objectifs sur une ligne, « Rechercher »
//   · « Exporter » · « Importer » sur une rangée.
// La forme est choisie par la mise en page (un clic d'onglet), jamais par le bloc.
//
// ⚠️ **Rien ne bouge au clic** : estimation, résumé et progression ont une
// place réservée ; « Arrêter » prend la place EXACTE de « Rechercher » (les deux
// dans la même case de grille, l'absent invisible) et reste inactif 300 ms.
export default function ObjectifEtRechercherBureau({
  forme, estimation, messageImport, progression, objective, setObjective, setSetupOuvert, resumeCombat, handleSearch, selected, status,
  comboSets, exportRecipe, importFileRef, importRecipe, setStoppedManually, stop,
}: ObjectifEtRechercherBureauProps) {
  const enCours = status === 'running';
  const [arretActif, setArretActif] = useState(false);
  useEffect(() => {
    if (!enCours) return;
    const minuterie = window.setTimeout(() => setArretActif(true), DELAI_ARRET_MS);
    return () => {
      window.clearTimeout(minuterie);
      setArretActif(false);
    };
  }, [enCours]);
  const etroite = forme === 'etroite';

  const rechercher = (
    <div className="grid">
      {/* ⚠️ `comboSets.length === 0` hors de `disabled`, comme sur la page
          d'aujourd'hui (`ObjectifEtActions`) : le clic doit encore atteindre
          `handleSearch`, qui ramène au « Set de runes recherché ». */}
      <Bouton
        taille="lg"
        ton="accent"
        pleineLargeur
        onClick={handleSearch}
        disabled={!selected || enCours}
        title={selected && !enCours && comboSets.length === 0 ? 'Choisis d\'abord un set de runes recherché' : undefined}
        icone={<Search size={16} />}
        libelle="Rechercher"
        className={`col-start-1 row-start-1 ${enCours ? 'invisible' : ''} ${comboSets.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
        {...(enCours ? { 'aria-hidden': true, tabIndex: -1 } : {})}
      />
      <Bouton
        taille="lg"
        ton="danger"
        fond="vide"
        pleineLargeur
        onClick={() => {
          setStoppedManually(true);
          stop();
        }}
        disabled={!enCours || !arretActif}
        title="Arrêter la recherche et garder ce qui a déjà été trouvé"
        icone={<Square size={14} fill="currentColor" />}
        libelle="Arrêter"
        className={`col-start-1 row-start-1 ${enCours ? '' : 'invisible'}`}
        {...(enCours ? {} : { 'aria-hidden': true, tabIndex: -1 })}
      />
    </div>
  );

  const exporter = (
    <Bouton
      onClick={exportRecipe}
      disabled={!selected || comboSets.length === 0}
      aria-label="Exporter les paramètres de recherche"
      title="Télécharger les réglages de cette recherche en fichier .json (set, minimums, objectif…) — pour la partager ou la reproduire, jamais tes runes ni ton compte."
      icone={<Upload size={14} />}
      libelle="Exporter"
      pleineLargeur={etroite}
    />
  );
  const importer = (
    <Bouton
      onClick={() => importFileRef.current?.click()}
      aria-label="Importer les paramètres de recherche"
      title="Reprendre les réglages d'un fichier .json exporté depuis l'Optimizer (le tien ou celui d'un autre joueur)."
      icone={<Download size={14} />}
      libelle="Importer"
      pleineLargeur={etroite}
    />
  );

  return (
    <section
      aria-label="Objectif et Rechercher"
      data-forme={forme}
      style={etroite ? { width: LARGEUR_OBJECTIF_ETROIT } : undefined}
      className={`flex flex-col gap-2.5 rounded-xl border border-border bg-panel p-3 ${etroite ? '' : 'w-full'}`}
    >
      {/* Deux lignes réservées dans les deux formes : la ligne d'estimation
          passe à la ligne dès qu'un pool dépasse trois chiffres. */}
      <div className="min-h-8">{estimation}</div>

      <div>
        <TitreObjectifRecherche />
        <Segmented
          options={OBJECTIVE_LABELS}
          value={objective}
          onChange={(o) => {
            setObjective(o);
            if (o === 'degats_reels') setSetupOuvert(true);
          }}
          size="lg"
          colonnes={etroite ? 2 : undefined}
        />
        <ResumeCombat resumeCombat={resumeCombat} setSetupOuvert={setSetupOuvert} cache={objective !== 'degats_reels'} />
      </div>

      {etroite ? (
        <>
          {rechercher}
          <div className="grid grid-cols-2 gap-2">{exporter}{importer}</div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{rechercher}</div>
          {exporter}
          {importer}
        </div>
      )}
      <input
        ref={importFileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) importRecipe(f);
        }}
      />

      <div className="grid">
        <div aria-hidden className="invisible col-start-1 row-start-1">
          <ProgressionRecherche status="running" {...PROGRESSION_LA_PLUS_HAUTE} />
        </div>
        <div className="col-start-1 row-start-1 space-y-1">
          {messageImport}
          <ProgressionRecherche status={status} {...progression} />
        </div>
      </div>
    </section>
  );
}
