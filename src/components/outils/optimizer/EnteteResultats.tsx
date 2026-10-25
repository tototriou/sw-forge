import HelpPopover from '../../HelpPopover';
import { Selecteur } from '../../../ui';
import { OptimizerSortKey } from '../../../hooks/useOptimizerState';
import { RECO_STATS } from '../../../types';
import { OBJECTIVE_LABELS, type SearchResult, type BuildCandidate, type RealDamageContext } from '../../../lib/runeBuildOptim';
import { type CompteConfirme, type ResultatArtefacts, type CompteAffichable } from '../../../lib/artifactQueue';
import { type Dispatch, type SetStateAction } from 'react';
import { type UseArtifactOptimQueue } from '../../../hooks/useArtifactOptimQueue';

export interface EnteteResultatsProps {
  result: SearchResult | null;
  compteConfirmes: CompteConfirme;
  resoudreEquipement: ((c: BuildCandidate) => ResultatArtefacts) | null;
  sortBy: OptimizerSortKey;
  setSortBy: Dispatch<SetStateAction<OptimizerSortKey>>;
  setResultsPage: Dispatch<SetStateAction<number>>;
  realDamage: RealDamageContext | null;
  fileArtefacts: UseArtifactOptimQueue;
  compteAffiche: CompteAffichable;
  // L'en-tête resserré du bureau (voir plus bas) ; le téléphone garde le sien.
  bureau?: boolean;
}

export default function EnteteResultats({ result, compteConfirmes, resoudreEquipement, sortBy, setSortBy, setResultsPage, realDamage, fileArtefacts, compteAffiche, bureau = false }: EnteteResultatsProps) {
  // ⚠️ Le compte des CONFIRMÉES (`compteConfirmes`) : seulement les builds
  // vérifiés (résolus et conformes), un compte qui ne baisse jamais pendant
  // une recherche. « Aucune combinaison… » seulement quand tout est vérifié
  // sans aucune confirmée. La ligne de progression garde les trouvées :
  // l'infobulle dit la différence.
  const compte = (
    <p className="label">
      {result
        ? compteConfirmes.aucune
          ? 'Aucune combinaison ne répond à ces critères'
          : `${compteConfirmes.confirmees.toLocaleString('fr-FR')} combinaison(s) confirmée(s)`
        : `${compteConfirmes.confirmees.toLocaleString('fr-FR')} combinaison(s) confirmée(s) pour l'instant — recherche en cours…`}
    </p>
  );
  // Seulement quand une file vérifie : sans elle, confirmées et trouvées sont
  // le même nombre.
  const aide = resoudreEquipement != null && !compteConfirmes.aucune && (
    <HelpPopover title="Combinaisons confirmées">
      Une combinaison est <b className="text-ink">confirmée</b> quand ses artéfacts et sa relique ont
      été vérifiés avec les pièces de ton inventaire : elle tient vraiment toutes les conditions.
      <br />
      <br />
      Le nombre « trouvée(s) » de la barre de progression compte tout ce que la recherche a retenu stat
      par stat : une estimation optimiste, pas encore vérifiée. Une partie de ces combinaisons est
      écartée à la vérification.
      <br />
      <br />
      La vérification s'arrête à 100 confirmées (300 quand la relique est cherchée) ; « Vérifier toutes
      les combinaisons trouvées », dans les réglages avancés, va jusqu'au bout.
    </HelpPopover>
  );
  // Masqué seulement quand tout est vérifié sans aucune confirmée. Le tri
  // réordonne les combinaisons confirmées ; il ne résout aucun équipement.
  const tri = !compteConfirmes.aucune && (
    <Selecteur
      value={sortBy}
      onChange={(e) => {
        setSortBy(e.target.value as OptimizerSortKey);
        // Classement entièrement différent : la page courante
        // n'a plus le même sens, on repart du meilleur résultat.
        setResultsPage(1);
      }}
      taille="sm"
      surface="panel"
      pleineLargeur={false}
    >
      <optgroup label="Stats">
        {RECO_STATS.map((st) => (
          <option key={st.key} value={st.key}>
            Trier par {st.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Objectifs">
        {/* ⚠️ « Dégâts réels » n'est proposé que si un sort est
            réellement calculable pour ce monstre : sans sort, ce
            tri n'aurait aucune formule à appliquer et laisserait la
            liste dans son ordre précédent, sans rien dire. */}
        {OBJECTIVE_LABELS.filter((o) => o.key !== 'degats_reels' || realDamage).map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </Selecteur>
  );
  // Combien la file doit encore vérifier : les builds des places en attente
  // de la page, puis l'avance de fond vers K confirmées — le compte ci-dessus
  // les inclut, la page ne les montre qu'une fois vérifiés. `enAttente` est le
  // reste de la file, tenu par le hook pour l'affichage. ⚠️ Ligne TOUJOURS
  // présente quand la file tourne : quand elle se vide, l'espace insécable
  // garde sa hauteur, et la grille ne remonte pas.
  const enVerification =
    fileArtefacts.enAttente > 0
      ? `${fileArtefacts.enAttente.toLocaleString('fr-FR')} combinaison(s) en vérification…`
      : ' ';

  return (
    <>
      {bureau ? (
        // ⚠️ **Au bureau, l'en-tête tient sur une rangée** (décision de
        // l'utilisateur : la première carte remonte) : à gauche le compte et,
        // SOUS lui, la ligne « en vérification » (sa place reste réservée,
        // même vide), l'aide à leur droite ; à droite le tri.
        // Quand la colonne est étroite, la rangée passe à la ligne d'elle-même :
        // ce passage ne dépend que de la largeur, jamais d'un clic.
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col">
              {compte}
              {resoudreEquipement != null && <p className="text-xs leading-4 text-ink-dim">{enVerification}</p>}
            </div>
            {aide}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {tri}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              {compte}
              {aide}
            </div>
            {tri}
          </div>
          {resoudreEquipement != null && <p className="mb-2 text-xs text-ink-dim">{enVerification}</p>}
        </>
      )}

      {/* ⚠️ Zéro dû aux seuls builds écartés par la résolution :
          le moteur a trouvé, aucun couple réel ne tient. Sous « Aucune combinaison… » seulement — tout vérifié, aucune
          confirmée —, la ligne qu'elle explique. Les blocs ci-dessous
          (diagnostic, « suffirait ») gardent leur condition, moteur vide :
          leurs chiffres viennent des bornes du moteur. */}
      {compteConfirmes.aucune && compteAffiche.raison && (
        <p className="mb-3 text-xs text-ink-dim">{compteAffiche.raison}</p>
      )}
    </>
  );
}
