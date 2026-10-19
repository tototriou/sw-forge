import { type ReactNode } from 'react';

export interface CarteEtatMonstreProps {
  etatMonstre: ReactNode;
}

export default function CarteEtatMonstre({ etatMonstre }: CarteEtatMonstreProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-3">
      {etatMonstre}
    </div>
  );
}
