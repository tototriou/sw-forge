import { useEffect, useState, type ReactNode } from 'react';
import { Download, Search, Square, Upload } from 'lucide-react';
import { Bouton } from '../../../../ui';
import Segmented from '../../../../ui/Segmented';
import { OBJECTIVE_LABELS } from '../../../../lib/runeBuildOptim';
import type { FormeObjectifBureau } from '../../../../lib/optimizerColonnes';
import ProgressionRecherche, { type ProgressionRechercheProps } from '../ProgressionRecherche';
import { ResumeCombat, TitreObjectifRecherche, type ObjectifEtActionsProps } from '../ObjectifEtActions';
import { PANNEAU } from './panneau';

export const LARGEUR_OBJECTIF_ETROIT = 340;
// La forme large prend la largeur de sa colonne : au plus étroit, le contenu
// de la colonne de droite à sa largeur minimale (`LARGEURS_BUREAU.exemplaireMin`,
// 388, moins 32 de barre, d'écart et de cadre).
export const LARGEUR_OBJECTIF_LARGE_MIN = 356;
// « Arrêter » reste inactif ce temps après le lancement : le double clic qui a
// lancé la recherche ne l'arrête pas.
export const DELAI_ARRET_MS = 300;
// « Rechercher » dans la forme large : à DROITE de sa rangée, à cette largeur,
// jamais réduit ; l'écart avec « Importer » prend ce qui manque.
const LARGEUR_RECHERCHER_LARGE = 'w-60';
// ⚠️ **Sous 448 px de rangée, « Rechercher » passe sous « Exporter » ·
// « Importer », pleine largeur** : « Exporter » 96 + 8 + « Importer » 96 + 8
// + « Rechercher » 240 (mesurés), ce que la colonne de droite ne tient plus
// près de son minimum (356 de contenu). Une requête sur la rangée elle-même,
// conteneur nommé (`rangee`) : le passage ne dépend que de sa largeur, jamais
// d'un clic, et « Arrêter » prend la même place que « Rechercher » dans les
// deux formes. Classes écrites en entier pour Tailwind.
const RANGEE_LARGE = 'flex flex-col-reverse gap-2 @[448px]/rangee:flex-row-reverse @[448px]/rangee:items-center @[448px]/rangee:justify-between';
const RECHERCHER_DANS_LA_RANGEE = 'w-full @[448px]/rangee:w-60 @[448px]/rangee:flex-none';

// La progression la plus haute que la recherche affiche (phase d'appariement,
// grands nombres ; préparation, erreur et refus tiennent dans sa place) :
// sa copie invisible fixe la hauteur de la barre fine de A1.
const PROGRESSION_LA_PLUS_HAUTE: Omit<ProgressionRechercheProps, 'status'> = {
  progress: { phase: 'pairing', explored: 999_999_999_999, found: 999_999, pct: 1, totalPairs: 999_999_999_999 },
  refusal: null,
  compteAffiche: { compte: 999_999 },
};

// Choisie par la mise en page (`formeObjectifBureau`, src/lib/optimizerColonnes.ts).
export type FormeObjectif = FormeObjectifBureau;

// Ce que la page rend du bloc : tout (A2, A3), ou, en A1, les réglages à leur
// place d'un côté, et de l'autre la barre fine collée au bas de la fenêtre
// (« Rechercher » / « Arrêter » et la progression).
export type PartieObjectif = 'tout' | 'reglages' | 'barre';

export interface ObjectifEtRechercherBureauProps extends ObjectifEtActionsProps {
  forme: FormeObjectif;
  // Le bloc porte-t-il son propre panneau ? Oui quand il est seul (A1, A2) ;
  // non en A3, où il est une section du panneau de la colonne de droite.
  cadre?: boolean;
  partie?: PartieObjectif;
  // `EstimationPool`, ou `null` tant qu'il n'y a rien à estimer (aucun monstre, aucun set).
  estimation: ReactNode;
  // `MessageImportRecette` (rien sans message).
  messageImport: ReactNode;
  progression: Omit<ProgressionRechercheProps, 'status'>;
}

// Le bloc « Objectif et Rechercher » du bureau, en deux formes
// (docs/02-app/optimizer/ecran/README.md, « Bloc « Objectif et Rechercher » ») :
// - étroite, 340 px : estimation du pool, objectifs en 2 × 2, résumé « Dégâts
//   réels », « Rechercher », « Exporter » · « Importer », progression ;
// - large, à la largeur de sa colonne : objectifs sur une ligne, « Exporter » ·
//   « Importer » à gauche, « Rechercher » à droite, ou dessous, pleine
//   largeur, sous 448 px de rangée.
// La forme est choisie par la mise en page (un clic d'onglet), jamais par le bloc.
//
// ⚠️ **Une seule place réservée : celle de « Rechercher » / « Arrêter »**
// (décision de l'utilisateur). « Arrêter » prend la place EXACTE
// de « Rechercher » (les deux dans la même case de grille, l'absent
// invisible) et reste inactif 300 ms. Estimation, résumé « Dégâts réels » et
// progression prennent leur hauteur quand ils paraissent : ils ne paraissent
// jamais au-dessus de ce qu'on vient de cliquer (le choix d'un set, d'un
// objectif, « Rechercher »), seulement dessous — la règle protège la cible du
// clic, pas ce qui la suit.
export default function ObjectifEtRechercherBureau({
  forme, cadre = true, partie = 'tout', estimation, messageImport, progression, objective, setObjective, setSetupOuvert, resumeCombat, handleSearch, selected, status,
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

  // Sa largeur : celle du bloc (étroite), 240 px dans la barre fine de A1,
  // selon sa rangée dans la forme large.
  const largeurRechercher = etroite ? '' : partie === 'barre' ? `flex-none ${LARGEUR_RECHERCHER_LARGE}` : RECHERCHER_DANS_LA_RANGEE;
  const rechercher = (
    <div className={`grid ${largeurRechercher}`}>
      {/* ⚠️ `comboSets.length === 0` hors de `disabled`, comme au téléphone
          (`ObjectifEtActions`) : le clic doit encore atteindre
          `handleSearch`, qui ramène au « Set de runes recherché ».
          ⚠️ **Braise pleine** (`fond="plein"`, le bouton principal de
          `Bouton`) dès qu'un set est choisi : l'action qu'on vient faire doit
          peser plus qu'un segment choisi, qui est lui aussi en braise pleine.
          Sans set, le fond `doux` d'avant et son grisé : une braise pleine à
          40 % d'opacité donne le brun boueux que `Bouton` écarte pour son
          état désactivé. Même taille et même contour de 1 px dans les deux
          fonds : le bouton ne bouge pas quand le premier set arrive. */}
      <Bouton
        taille="lg"
        ton="accent"
        fond={comboSets.length === 0 ? 'doux' : 'plein'}
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
  const progressionCompacte = <ProgressionRecherche status={status} {...progression} compacte />;

  // A1 : la barre fine, collée au bas de la fenêtre par la page.
  // ⚠️ **Sa hauteur ne change jamais** : collée par le bas, une barre qui
  // grandit monte, et « Rechercher » / « Arrêter » avec elle, sous le
  // pointeur (mesuré : `clics-7b`, recherche longue en A1). La progression y
  // tient donc dans la place de la plus haute (copie invisible) : c'est la
  // place de « Rechercher » / « Arrêter » qu'elle garde, la seule réservée.
  if (partie === 'barre') {
    return (
      <div role="group" aria-label="Rechercher" data-forme={forme} className={`${PANNEAU} flex items-center gap-3`}>
        {rechercher}
        <div className="grid min-w-0 flex-1">
          <div aria-hidden className="invisible col-start-1 row-start-1">
            <ProgressionRecherche status="running" {...PROGRESSION_LA_PLUS_HAUTE} compacte />
          </div>
          <div className="col-start-1 row-start-1 self-center">{progressionCompacte}</div>
        </div>
      </div>
    );
  }

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
      style={etroite && cadre ? { width: LARGEUR_OBJECTIF_ETROIT } : undefined}
      className={`flex flex-col gap-2 ${cadre ? PANNEAU : ''} ${etroite && cadre ? '' : 'w-full'}`}
    >
      {estimation}

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
        {objective === 'degats_reels' && <ResumeCombat resumeCombat={resumeCombat} setSetupOuvert={setSetupOuvert} />}
      </div>

      {etroite ? (
        <>
          {rechercher}
          <div className="grid grid-cols-2 gap-2">{exporter}{importer}</div>
        </>
      ) : partie === 'reglages' ? (
        <div className="flex items-center gap-2">{exporter}{importer}</div>
      ) : (
        // « Rechercher » d'abord dans le DOM (ordre de tabulation d'avant),
        // à droite à l'écran, ou dessous quand la rangée est étroite.
        <div className="@container/rangee">
          <div className={RANGEE_LARGE}>
            {rechercher}
            <div className="flex items-center gap-2">{exporter}{importer}</div>
          </div>
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

      {messageImport}
      {partie === 'tout' && progressionCompacte}
    </section>
  );
}
