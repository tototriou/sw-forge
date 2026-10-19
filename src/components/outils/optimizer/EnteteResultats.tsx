import HelpPopover from '../../HelpPopover';
import { Interrupteur, Selecteur } from '../../../ui';
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
  optimiserArtefacts: boolean;
  adapterArtefactsAuTri: boolean;
  setAdapterArtefactsAuTri: Dispatch<SetStateAction<boolean>>;
  sortBy: OptimizerSortKey;
  setSortBy: Dispatch<SetStateAction<OptimizerSortKey>>;
  setResultsPage: Dispatch<SetStateAction<number>>;
  realDamage: RealDamageContext | null;
  fileArtefacts: UseArtifactOptimQueue;
  compteAffiche: CompteAffichable;
}

export default function EnteteResultats({ result, compteConfirmes, resoudreEquipement, optimiserArtefacts, adapterArtefactsAuTri, setAdapterArtefactsAuTri, sortBy, setSortBy, setResultsPage, realDamage, fileArtefacts, compteAffiche }: EnteteResultatsProps) {
  return (
    <>
    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
      {/* ⚠️ Le compte des CONFIRMÉES (`compteConfirmes`) :
          seulement les builds vérifiés (résolus et conformes), un
          compte qui ne baisse jamais pendant une recherche. « Aucune
          combinaison… » seulement quand tout est vérifié sans aucune
          confirmée. La ligne de progression garde les trouvées :
          l'infobulle dit la différence. */}
      <div className="flex items-center gap-1.5">
        <p className="label">
          {result
            ? compteConfirmes.aucune
              ? 'Aucune combinaison ne répond à ces critères'
              : `${compteConfirmes.confirmees.toLocaleString('fr-FR')} combinaison(s) confirmée(s)`
            : `${compteConfirmes.confirmees.toLocaleString('fr-FR')} combinaison(s) confirmée(s) pour l'instant — recherche en cours…`}
        </p>
        {/* Seulement quand une file vérifie : sans elle, confirmées et
            trouvées sont le même nombre. */}
        {resoudreEquipement != null && !compteConfirmes.aucune && (
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
        )}
      </div>
      {/* ⚠️ **Le tri est une VUE, l’optimisation d’artéfacts une
          DÉCISION.** Les coupler d’office déplaçait la paire dès qu’on
          changeait de tri pour explorer — alors qu’on veut souvent
          garder celle qui maximise les PV effectifs tout en regardant
          les builds classés par une stat.

          ⚠️ MASQUÉ quand l’optimisation est désactivée : il n’y a alors
          qu’une paire possible, celle qui est portée. Une saisie sans
          effet est pire qu’une saisie absente — même règle que les
          sélecteurs de principale et les sous-propriétés verrouillées. */}
      {optimiserArtefacts && !compteConfirmes.aucune && (
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-dim">Adapter les artéfacts et reliques au tri</span>
          <HelpPopover title="Adapter les artéfacts et reliques au tri">
            Activé (défaut), chaque build reçoit les artéfacts ET la relique qui maximisent le{' '}
            <b className="text-ink">critère de tri</b> affiché : trier par ATQ ne retient pas les mêmes
            pièces que trier par PV effectifs.
            <br />
            <br />
            Désactivé, les artéfacts et la relique restent ceux qui servent l’<b className="text-ink">objectif de la
            recherche</b>, quel que soit le tri. Utile pour parcourir les résultats classés autrement sans
            que l’équipement bouge — et « Valider les artéfacts » propose alors toujours le même.
            <br />
            <br />
            Sans effet sur Efficience, Vitesse, Taux CRIT, Dgts CRIT, Résistance et Précision : aucun
            artéfact ni aucune propriété de relique n’entre dans ces classements.
          </HelpPopover>
          <Interrupteur
            actif={adapterArtefactsAuTri}
            onChange={setAdapterArtefactsAuTri}
            aria-label="Adapter les artéfacts et reliques au tri"
          />
        </div>
      )}
      {/* Masqués (avec « Adapter… ») seulement quand tout est vérifié
          sans aucune confirmée. */}
      {!compteConfirmes.aucune && (
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
      )}
    </div>

    {/* Combien la file doit encore vérifier : les builds des
        places en attente de la page, puis l'avance de fond vers K
        confirmées — le compte
        ci-dessus les inclut, la page ne les
        montre qu'une fois vérifiés. `enAttente` est le reste de la file,
        tenu par le hook pour l'affichage. ⚠️ Rangée TOUJOURS présente
        quand la file tourne : quand elle se vide, l'espace insécable
        garde sa hauteur, et la grille ne remonte pas. */}
    {resoudreEquipement != null && (
      <p className="mb-2 text-xs text-ink-dim">
        {fileArtefacts.enAttente > 0
          ? `${fileArtefacts.enAttente.toLocaleString('fr-FR')} combinaison(s) en vérification…`
          : ' '}
      </p>
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
