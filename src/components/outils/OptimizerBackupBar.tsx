import { useState, type ReactNode } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Bouton, ConfirmDialog } from '../../ui';
import type { UseOptimizerLists } from '../../hooks/useOptimizerLists';
import type { OptimizerState } from '../../hooks/useOptimizerState';
import type { ExclusionSourceData } from '../../lib/optimizerExclusion';

export default function OptimizerBackupBar({ listes, optimizer, data, artifactIds, debut, fin }: {
  listes: UseOptimizerLists; optimizer: OptimizerState; data: ExclusionSourceData; artifactIds: Set<number>;
  /** Posé au bout de la ligne d'annonce, dans une place réservée par l'appelant. */
  fin?: ReactNode;
  /** Actions de la liste, dans la même rangée que Sauvegarder et Reprendre. */
  debut?: ReactNode;
}) {
  const [confirmation, setConfirmation] = useState<'remplacer' | 'reprendre' | null>(null);
  const point = listes.point;
  const date = point ? new Date(point.date).toLocaleString('fr-FR') : '';
  const sauvegarder = () => listes.sauvegarderPoint(optimizer.proprietaireCriteres, data);
  const annonce = point ? `Point de sauvegarde : ${point.historique.lists.length} liste(s) · ${point.historique.members.length} membre(s) · ${date}`
    : listes.pointExiste ? listes.rapportPoint.join(' ') : 'Aucun point de sauvegarde.';
  return <div aria-label="Point de sauvegarde des listes">
    <div aria-label="Actions de la liste" className="grid grid-cols-2 gap-1 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
      {debut}
      <Bouton taille="sm" pleineLargeur icone={<Save size={14} />} libelle="Sauvegarder"
        title="Les listes sont déjà conservées automatiquement. Pose un point pour essayer et revenir ici."
        onClick={() => listes.pointExiste ? setConfirmation('remplacer') : sauvegarder()} />
      <Bouton taille="sm" pleineLargeur icone={<RotateCcw size={14} />} libelle="Reprendre"
        disabled={!point} title={point ? 'Revenir au point de sauvegarde de toutes les listes.'
          : listes.pointExiste ? 'Le point est illisible : reprise impossible.' : 'Aucun point de sauvegarde.'}
        onClick={() => setConfirmation('reprendre')} />
    </div>
    {/* Une seule ligne, réservée avant le premier point aux deux formats :
        l'annonce tronquée garde son texte complet en infobulle. La colonne
        minmax(0, 1fr) empêche son texte d'élargir la page au téléphone. */}
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <p role="status" aria-label="Annonce du point de sauvegarde" title={annonce}
        className="truncate py-1 text-[11px] text-ink-dim">{annonce}</p>
      {fin}
    </div>
    {confirmation === 'remplacer' && <ConfirmDialog titre="Remplacer le point de sauvegarde ?" destructif libelleAction="Remplacer"
      message={<>{point ? `Le point du ${date} (${point.historique.lists.length} liste(s))` : 'Le point conservé mais illisible'} sera remplacé par tes listes actuelles. Tu ne pourras plus revenir à cet ancien point.</>}
      onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); sauvegarder(); }} />}
    {confirmation === 'reprendre' && point && <ConfirmDialog titre="Revenir au point de sauvegarde ?" destructif libelleAction="Reprendre"
      message={<>Toutes tes listes actuelles seront remplacées par le point du {date} ({point.historique.lists.length} liste(s)).
        Les listes, membres, builds validés, critères mémorisés, équipes et contenus créés ou modifiés depuis ce point seront perdus.
        Le point de sauvegarde reste disponible.</>}
      onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); optimizer.reprendrePoint(artifactIds); }} />}
  </div>;
}
