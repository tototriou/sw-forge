import { useId, type ReactNode } from 'react';
import TitreReglagesAvances from '../TitreReglagesAvances';

// « Réglages avancés », au bureau : EN LIGNE dans la colonne repliable « Aura,
// exclusion, avancés », section de son panneau, jamais repliée derrière un
// en-tête. Le contenu est
// `ReglagesAvancesContenu`, hors panneau : sa grille
// `minmax(260px, 1fr)` y tient sur une colonne. L'estimation du pool n'y est
// plus : elle est en tête du bloc « Objectif et Rechercher ».
//
// ⚠️ **Une enveloppe, sans hauteur fixe ni place réservée** : la section prend
// la hauteur de son contenu partagé. Le retrait d'un réglage (« Diagnostic
// approfondi sur 0 résultat » est appelé à partir) passe sans retouche ici.
export default function ReglagesAvancesBureau({ children }: { children: ReactNode }) {
  const titre = useId();
  return (
    <section aria-labelledby={titre}>
      <div id={titre} className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
        <TitreReglagesAvances />
      </div>
      {children}
    </section>
  );
}
