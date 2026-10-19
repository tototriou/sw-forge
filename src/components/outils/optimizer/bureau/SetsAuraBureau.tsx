import { type ComponentProps } from 'react';
import { AurasExternesSaisie } from '../../EtatMonstre';

export const LARGEUR_COMPLEMENTS = 340;

// « Sets d'aura des autres monstres », au bureau : en tête de la colonne
// repliable « Aura, exclusion, avancés », dans sa propre carte. La saisie est
// celle d'« État de mon monstre » (`AurasExternesSaisie`, partagée avec le
// téléphone, inchangée) : même bouton d'ajout fixe en tête, même rappel.
export default function SetsAuraBureau(props: ComponentProps<typeof AurasExternesSaisie>) {
  return (
    <section aria-label="Sets d'aura des autres monstres" style={{ width: LARGEUR_COMPLEMENTS }} className="flex rounded-xl border border-border bg-panel p-3">
      <AurasExternesSaisie {...props} />
    </section>
  );
}
