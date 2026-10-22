import { type ComponentProps } from 'react';
import { AurasExternesSaisie } from '../../EtatMonstre';

// La place de la colonne « Aura, exclusion, avancés » : son panneau en prend
// 332 (`RETRAIT_PANNEAU`), ses sections 314.
export const LARGEUR_COMPLEMENTS = 340;

// « Sets d'aura des autres monstres », au bureau : en tête de la colonne
// repliable « Aura, exclusion, avancés », sa section du panneau. La saisie est
// celle d'« État de mon monstre » (`AurasExternesSaisie`, partagée avec le
// téléphone, inchangée) : même bouton d'ajout fixe en tête, même rappel.
// ⚠️ Rappel affiché, pas annoncé (`annonce={false}`) : la section n'est montée
// que colonne ouverte ; l'annonce vit dans la page (`AnnonceRappelAuras`).
// Sans cadre hors rappel (`sansCadre`) : le panneau de la colonne situe la
// section ; le rappel, un état, garde son contour et son fond.
export default function SetsAuraBureau(props: Omit<ComponentProps<typeof AurasExternesSaisie>, 'annonce' | 'sansCadre'>) {
  return (
    <section aria-label="Sets d'aura des autres monstres" className="flex">
      <AurasExternesSaisie {...props} annonce={false} sansCadre />
    </section>
  );
}
