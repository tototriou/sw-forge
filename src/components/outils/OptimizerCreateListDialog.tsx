import { useState } from 'react';
import { Bouton, Champ, Modale, Selecteur } from '../../ui';
import type { ContenuListeOptimizer } from '../../lib/optimizerMemberStorage';
import type { OptimizerList } from '../../lib/optimizerExclusion';
import { nomNouvelleListeOptimizer } from '../../lib/optimizerListNames';

export const CONTENUS_LISTE_OPTIMIZER = { guilde: 'Guilde', donjon: 'Donjon', arene: 'Arène' } as const;

export function ContenuListePicker({ contenu, onChange, creation = false }: {
  creation?: boolean;
  contenu: ContenuListeOptimizer | undefined;
  onChange: (contenu: ContenuListeOptimizer) => void;
}) {
  const menu = <Selecteur aria-label="Contenu de la liste" taille="sm"
      ton={creation && !contenu ? 'accent' : 'neutre'} className={creation && contenu ? 'focus:!border-border' : undefined}
      aria-describedby={creation ? 'contenu-liste-aide' : undefined}
      value={contenu ?? ''}
      onChange={e => onChange(e.target.value as ContenuListeOptimizer)}>
      {!contenu && <option value="" disabled>{creation ? 'Choisis le contenu de la liste' : 'Sans contenu'}</option>}
      {Object.entries(CONTENUS_LISTE_OPTIMIZER).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
    </Selecteur>;
  return <label className={`${creation ? 'flex flex-col gap-1' : 'flex items-center gap-2'} text-xs text-ink-dim`}>Contenu{menu}</label>;
}

export default function OptimizerCreateListDialog({ listes, edition, libelleAction = edition ? 'Enregistrer' : 'Créer', onValider, onCancel }: {
  listes: OptimizerList[];
  edition?: { nom: string; contenu: ContenuListeOptimizer | undefined };
  libelleAction?: string;
  onValider: (nom: string, contenu: ContenuListeOptimizer) => void;
  onCancel: () => void;
}) {
  const [nom, setNom] = useState(edition?.nom ?? '');
  const [contenu, setContenu] = useState<ContenuListeOptimizer | undefined>(edition?.contenu);
  const valide = !!contenu && (!edition || !!nom.trim());
  return <Modale titre={edition ? 'Éditer la liste' : 'Nouvelle liste'} labelledBy="creer-liste-optimizer" croix onClose={onCancel}
    actions={<>
      <Bouton libelle="Annuler" fond="plein" onClick={onCancel} />
      <Bouton type="submit" form="creer-liste-optimizer-form" ton="accent" fond="doux" libelle={libelleAction} disabled={!valide}
        title={!edition && !contenu ? "Choisis d'abord le contenu." : undefined} />
    </>}>
    <form id="creer-liste-optimizer-form" className="space-y-3" onSubmit={e => { e.preventDefault(); if (valide && contenu) onValider(nom.trim(), contenu); }}>
      <Champ aria-label="Nom de la liste" placeholder={nomNouvelleListeOptimizer(listes)} value={nom} onChange={e => setNom(e.target.value)} autoFocus />
      <ContenuListePicker contenu={contenu} onChange={setContenu} creation={!edition} />
      {!edition && <p id="contenu-liste-aide" className="text-xs text-ink-dim">Obligatoire : le contenu décide des leads actifs et des compétences d'invocateur.</p>}
    </form>
  </Modale>;
}
