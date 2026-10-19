import { type ComponentProps } from 'react';
import EtatMonstre from '../EtatMonstre';

// La carte « État de mon monstre » : ses props sont celles d'`EtatMonstre`.
export type CarteEtatMonstreProps = ComponentProps<typeof EtatMonstre>;

export default function CarteEtatMonstre(props: CarteEtatMonstreProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-3">
      <EtatMonstre {...props} />
    </div>
  );
}
