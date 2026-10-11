import { useState } from 'react';
import { Bouton, Champ, Modale, Selecteur } from '../../ui';
import type { ContenuListeOptimizer } from '../../lib/optimizerMemberStorage';
import type { OptimizerList } from '../../lib/optimizerExclusion';
import { nomNouvelleListeOptimizer } from '../../lib/optimizerListNames';

export const CONTENUS_LISTE_OPTIMIZER = { guilde: 'Guilde', donjon: 'Donjon', arene: 'Arène' } as const;

// `enLigne` : le libellé est posé au-dessus par l'appelant, et le menu prend
// à la souris la hauteur d'un `Bouton` md (32 px) voisin, que `Selecteur` md
// dépasse encore (37,5 px).
export function ContenuListePicker({ contenu, onChange, enLigne = false, disabled = false }: {
  contenu: ContenuListeOptimizer | undefined;
  onChange: (contenu: ContenuListeOptimizer) => void;
  enLigne?: boolean;
  disabled?: boolean;
}) {
  const menu = <Selecteur aria-label="Contenu de la liste" taille={enLigne ? 'md' : 'sm'} className={enLigne ? 'lg:min-h-8 lg:py-0' : ''}
      value={contenu ?? ''} disabled={disabled}
      onChange={e => onChange(e.target.value as ContenuListeOptimizer)}>
      {!contenu && <option value="" disabled>Sans contenu</option>}
      {Object.entries(CONTENUS_LISTE_OPTIMIZER).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
    </Selecteur>;
  return enLigne ? menu : <label className="flex items-center gap-2 text-xs text-ink-dim">Contenu{menu}</label>;
}

export default function OptimizerCreateListDialog({ listes, libelleAction = 'Créer', onValider, onCancel }: {
  listes: OptimizerList[];
  libelleAction?: string;
  onValider: (nom: string, contenu: ContenuListeOptimizer) => void;
  onCancel: () => void;
}) {
  const [nom, setNom] = useState('');
  const [contenu, setContenu] = useState<ContenuListeOptimizer>();
  return <Modale titre="Nouvelle liste" labelledBy="creer-liste-optimizer" croix onClose={onCancel}
    actions={<>
      <Bouton libelle="Annuler" fond="plein" onClick={onCancel} />
      <Bouton type="submit" form="creer-liste-optimizer-form" ton="accent" fond="doux" libelle={libelleAction} disabled={!contenu} />
    </>}>
    <form id="creer-liste-optimizer-form" className="space-y-3" onSubmit={e => { e.preventDefault(); if (contenu) onValider(nom.trim(), contenu); }}>
      <Champ aria-label="Nom de la liste" placeholder={nomNouvelleListeOptimizer(listes)} value={nom} onChange={e => setNom(e.target.value)} autoFocus />
      <ContenuListePicker contenu={contenu} onChange={setContenu} />
    </form>
  </Modale>;
}
