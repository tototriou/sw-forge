import ExemplaireEtFiche, { type ExemplaireEtFicheProps } from '../ExemplaireEtFiche';

// « Exemplaire », au bureau, section du panneau « Monstre » (358 px de
// contenu). Le contenu est `ExemplaireEtFiche` : vues, puces Box / RTA /
// Défenses siège / Offenses siège, choix de l'exemplaire en flottant, fiche
// dépliée à la façon des cartes de résultat, « Valider ce build ». La carte
// « Monstre & équipement » n'existe qu'au téléphone : au bureau, la liste de
// travail tient sa place au-dessus de cette section.
export default function ExemplaireBureau(props: ExemplaireEtFicheProps) {
  return (
    <section aria-label="Exemplaire" className="w-full">
      <ExemplaireEtFiche {...props} />
    </section>
  );
}
