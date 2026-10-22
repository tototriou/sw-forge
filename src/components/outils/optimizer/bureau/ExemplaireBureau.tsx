import ExemplaireEtFiche, { type ExemplaireEtFicheProps } from '../ExemplaireEtFiche';

// La place d'« Exemplaire » en tête de la colonne de droite, et la largeur
// minimale de cette colonne (`LARGEURS_BUREAU.exemplaire`,
// src/lib/optimizerColonnes.ts) : la fiche à pleine taille (statistiques,
// artéfacts, roue de runes, relique : 560 px mesurés), plus le contour et le
// rembourrage du panneau, l'écart et la barre de défilement de la colonne.
export const LARGEUR_EXEMPLAIRE = 592;
const LARGEUR_FICHE = 560;
// La section prend la largeur de sa piste, au plus 598 px (sa largeur quand la
// place ne manque pas), jamais moins que la fiche : les puces de source se
// partagent ce qui reste, la fiche ne se réduit pas.
const LARGEUR_SECTION_MAX = 598;

// « Exemplaire », au bureau : en tête de la colonne de droite (A3) ou sous les
// réglages (A1, A2), section du panneau de cette colonne. Le contenu est
// `ExemplaireEtFiche` : puces Box / RTA / Défenses siège / Offenses siège,
// choix de l'exemplaire en flottant, fiche, « Valider ce build ». La carte
// « Monstre & équipement » n'existe qu'au téléphone : au bureau, la liste de
// travail tient sa place dans les essentiels.
export default function ExemplaireBureau(props: ExemplaireEtFicheProps) {
  return (
    <section aria-label="Exemplaire" className="w-full" style={{ maxWidth: LARGEUR_SECTION_MAX, minWidth: LARGEUR_FICHE }}>
      <ExemplaireEtFiche {...props} />
    </section>
  );
}
