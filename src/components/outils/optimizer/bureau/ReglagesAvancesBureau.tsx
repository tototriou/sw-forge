import { useId, type ReactNode } from 'react';
import TitreReglagesAvances from '../TitreReglagesAvances';
import { LARGEUR_COMPLEMENTS } from './SetsAuraBureau';

// « Réglages avancés », au bureau : EN LIGNE dans la colonne repliable « Aura,
// exclusion, avancés », jamais repliée derrière un en-tête. Le contenu est
// `ReglagesAvancesContenu`, hors panneau : sa grille
// `minmax(260px, 1fr)` y tient sur une colonne. L'estimation du pool n'y est
// plus : elle est en tête du bloc « Objectif et Rechercher ».
//
// ⚠️ **Une enveloppe, sans hauteur fixe ni place réservée** : la carte prend
// la hauteur de son contenu partagé. Le retrait d'un réglage (« Diagnostic
// approfondi sur 0 résultat » est appelé à partir) passe sans retouche ici.
export default function ReglagesAvancesBureau({ children }: { children: ReactNode }) {
  const titre = useId();
  return (
    <section aria-labelledby={titre} style={{ width: LARGEUR_COMPLEMENTS }} className="rounded-xl border border-border bg-panel p-3">
      <div id={titre} className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
        <TitreReglagesAvances />
      </div>
      {children}
    </section>
  );
}
