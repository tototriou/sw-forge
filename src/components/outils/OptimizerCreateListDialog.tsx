import { useState } from 'react';
import { Bouton, Champ, Modale, Selecteur } from '../../ui';
import type { ContenuListeOptimizer } from '../../lib/optimizerMemberStorage';

export const CONTENUS_LISTE_OPTIMIZER = { guilde: 'Guilde', donjon: 'Donjon', arene: 'Arène' } as const;

export function ContenuListePicker({ contenu, onChange }: {
  contenu: ContenuListeOptimizer | undefined;
  onChange: (contenu: ContenuListeOptimizer) => void;
}) {
  return <label className="flex items-center gap-2 text-xs text-ink-dim">
    Contenu
    <Selecteur aria-label="Contenu de la liste" taille="sm" value={contenu ?? ''}
      onChange={e => onChange(e.target.value as ContenuListeOptimizer)}>
      {!contenu && <option value="" disabled>Sans contenu</option>}
      {Object.entries(CONTENUS_LISTE_OPTIMIZER).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
    </Selecteur>
  </label>;
}

export default function OptimizerCreateListDialog({ libelleAction = 'Créer', onValider, onCancel }: {
  libelleAction?: string;
  onValider: (nom: string, contenu: ContenuListeOptimizer) => void;
  onCancel: () => void;
}) {
  const [nom, setNom] = useState('');
  const [contenu, setContenu] = useState<ContenuListeOptimizer>('guilde');
  return <Modale titre="Nouvelle liste" labelledBy="creer-liste-optimizer" croix onClose={onCancel}
    actions={<>
      <Bouton libelle="Annuler" fond="plein" onClick={onCancel} />
      <Bouton type="submit" form="creer-liste-optimizer-form" ton="accent" fond="doux" libelle={libelleAction} disabled={!nom.trim()} />
    </>}>
    <form id="creer-liste-optimizer-form" className="space-y-3" onSubmit={e => { e.preventDefault(); if (nom.trim()) onValider(nom.trim(), contenu); }}>
      <Champ aria-label="Nom de la liste" placeholder="ex. Deck A, Mon RTA…" value={nom} onChange={e => setNom(e.target.value)} autoFocus />
      <ContenuListePicker contenu={contenu} onChange={setContenu} />
    </form>
  </Modale>;
}
