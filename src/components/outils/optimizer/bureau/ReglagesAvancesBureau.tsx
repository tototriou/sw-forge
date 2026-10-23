import { type ReactNode } from 'react';

// « Réglages avancés », au bureau : EN LIGNE dans la colonne repliable « Aura,
// exclusion, avancés », section de son panneau, jamais repliée derrière un
// en-tête, et sans titre : le panneau de la colonne et les traits entre
// sections situent déjà la section (le téléphone garde son titre dans le
// panneau « Options »). Le contenu est
// `ReglagesAvancesContenu`, hors panneau : sa grille
// `minmax(260px, 1fr)` y tient sur une colonne. L'estimation du pool n'y est
// plus : elle est en tête du bloc « Objectif et Rechercher ».
//
// ⚠️ **Une enveloppe, sans hauteur fixe ni place réservée** : la section prend
// la hauteur de son contenu partagé. Le retrait d'un réglage (« Diagnostic
// approfondi sur 0 résultat » est appelé à partir) passe sans retouche ici.
export default function ReglagesAvancesBureau({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Réglages avancés">
      {children}
    </section>
  );
}
