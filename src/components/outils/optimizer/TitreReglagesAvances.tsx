import { Wrench } from 'lucide-react';

export default function TitreReglagesAvances() {
  return (
    <>
      {/* Clé à molette, distincte des curseurs de « Critères de
          recherche » (forme différente, pas seulement une couleur) —
          même traitement accent que les autres en-têtes de carte. */}
      <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-accent/40 bg-accent-soft">
        <Wrench size={13} className="text-accent" />
      </div>
      Réglages avancés
    </>
  );
}
