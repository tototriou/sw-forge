import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Search, Square, Upload } from 'lucide-react';
import { Bouton } from '../../../../ui';
import Segmented from '../../../../ui/Segmented';
import { OBJECTIVE_LABELS } from '../../../../lib/runeBuildOptim';
import ProgressionRecherche, { type ProgressionRechercheProps } from '../ProgressionRecherche';
import { ResumeCombat, TitreObjectifRecherche, type ObjectifEtActionsProps } from '../ObjectifEtActions';
import { PANNEAU } from './panneau';

export const LARGEUR_OBJECTIF_LARGE_MIN = 328;
export const DELAI_ARRET_MS = 300;
const RANGEE_LARGE = 'flex flex-col-reverse gap-2 @[448px]/rangee:flex-row-reverse @[448px]/rangee:items-center @[448px]/rangee:justify-between';
const RECHERCHER_DANS_LA_RANGEE = 'w-full @[448px]/rangee:w-60 @[448px]/rangee:flex-none';
export type PartieObjectif = 'tout' | 'reglages' | 'barre' | 'progression';

export interface ObjectifEtRechercherBureauProps extends ObjectifEtActionsProps {
  cadre?: boolean;
  partie?: PartieObjectif;
  estimation: ReactNode;
  messageImport: ReactNode;
  progression: Omit<ProgressionRechercheProps, 'status'>;
}

// Une seule forme, à la largeur reçue : les objectifs passent en 2 × 2
// quand la copie à texte normal ne tient pas sur une ligne. Ni le choix
// d'objectif ni le lancement de la recherche n'interviennent dans la mesure.
// docs/02-app/optimizer/ecran/README.md, « Bloc « Objectif et Rechercher » ».
export default function ObjectifEtRechercherBureau({
  cadre = true, partie = 'tout', estimation, messageImport, progression, objective, setObjective, setSetupOuvert, resumeCombat, handleSearch, selected, status,
  comboSets, exportRecipe, importFileRef, importRecipe, setStoppedManually, stop,
}: ObjectifEtRechercherBureauProps) {
  const enCours = status === 'running';
  const [arretActif, setArretActif] = useState(false);
  useEffect(() => {
    if (!enCours) return;
    const minuterie = window.setTimeout(() => setArretActif(true), DELAI_ARRET_MS);
    return () => { window.clearTimeout(minuterie); setArretActif(false); };
  }, [enCours]);
  const place = useRef<HTMLDivElement>(null);
  const copie = useRef<HTMLDivElement>(null);
  const [deuxColonnes, setDeuxColonnes] = useState(true);
  useLayoutEffect(() => {
    const p = place.current, c = copie.current;
    if (!p || !c || typeof ResizeObserver === 'undefined') return;
    const mesurer = () => setDeuxColonnes(c.getBoundingClientRect().width > p.clientWidth);
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(p); obs.observe(c);
    return () => obs.disconnect();
  }, []);
  const largeurRechercher = partie === 'barre' ? 'w-60 flex-none' : RECHERCHER_DANS_LA_RANGEE;
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

  // La progression reste dans le bloc : sa hauteur ne peut faire monter
  // le bouton collé sous le pointeur. Arrêter occupe sa case exacte.
  if (partie === 'barre') return <div role="group" aria-label="Rechercher" className="flex justify-end">{rechercher}</div>;
  if (partie === 'progression') return <>{messageImport}<ProgressionRecherche status={status} {...progression} compacte /></>;
  const exporter = (
    <Bouton
      onClick={exportRecipe}
      disabled={!selected || comboSets.length === 0}
      aria-label="Exporter les paramètres de recherche"
      title="Télécharger les réglages de cette recherche en fichier .json (set, minimums, objectif…) — pour la partager ou la reproduire, jamais tes runes ni ton compte."
      icone={<Upload size={14} />}
      libelle="Exporter"
    />
  );
  const importer = (
    <Bouton
      onClick={() => importFileRef.current?.click()}
      aria-label="Importer les paramètres de recherche"
      title="Reprendre les réglages d'un fichier .json exporté depuis l'Optimizer (le tien ou celui d'un autre joueur)."
      icone={<Download size={14} />}
      libelle="Importer"
    />
  );


  return (
    <section aria-label="Objectif et Rechercher" className={`flex w-full flex-col gap-2 ${cadre ? PANNEAU : ''}`}>
      {estimation}
      <div ref={place}>
        <TitreObjectifRecherche />
        <Segmented options={OBJECTIVE_LABELS} value={objective} onChange={(o) => {
          setObjective(o);
          if (o === 'degats_reels') setSetupOuvert(true);
        }} size="lg" colonnes={deuxColonnes ? 2 : undefined} dense={false} />
        <div aria-hidden className="pointer-events-none h-0 overflow-hidden">
          <div ref={copie} className="invisible w-max">
            <Segmented options={OBJECTIVE_LABELS} value={null} onChange={() => {}} size="lg" dense={false} />
          </div>
        </div>
        {objective === 'degats_reels' && <ResumeCombat resumeCombat={resumeCombat} setSetupOuvert={setSetupOuvert} />}
      </div>
      {partie === 'reglages' ? <div className="flex items-center gap-2">{exporter}{importer}</div> : (
        <div className="@container/rangee"><div className={RANGEE_LARGE}>
          {rechercher}<div className="flex items-center gap-2">{exporter}{importer}</div>
        </div></div>
      )}
      <input ref={importFileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; e.target.value = ''; if (f) importRecipe(f);
      }} />
      {partie === 'tout' && <>{messageImport}<ProgressionRecherche status={status} {...progression} compacte /></>}
    </section>
  );
}
