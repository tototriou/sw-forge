import ExemplaireEtFiche, { type ExemplaireEtFicheProps } from '../ExemplaireEtFiche';

// La place d'« Exemplaire » en tête de la colonne de droite : la largeur
// minimale de son panneau. La section y prend 598 px, rembourrage et contour
// du panneau retirés.
export const LARGEUR_EXEMPLAIRE = 616;
const LARGEUR_SECTION = 598;

// « Exemplaire », au bureau : en tête de la colonne de droite (A3) ou sous les
// réglages (A1, A2), section du panneau de cette colonne. Le contenu est
// `ExemplaireEtFiche` : puces Box / RTA / Défenses siège / Offenses siège,
// choix de l'exemplaire en flottant, fiche, « Valider ce build ». La carte
// « Monstre & équipement » n'existe qu'au téléphone : au bureau, la liste de
// travail tient sa place dans les essentiels.
export default function ExemplaireBureau(props: ExemplaireEtFicheProps) {
  return (
    <section aria-label="Exemplaire" style={{ width: LARGEUR_SECTION }}>
      <ExemplaireEtFiche {...props} />
    </section>
  );
}
