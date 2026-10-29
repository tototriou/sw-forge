import ExemplaireEtFiche, { type ExemplaireEtFicheProps } from '../ExemplaireEtFiche';

// Sous la liste, dans « Monstre » : les 358 px de contenu imposent la
// fiche repliée, dont la plus large rangée mesure 356 px.
const LARGEUR_FICHE_REPLIEE = 356;
// « Exemplaire », au bureau, section du panneau « Monstre ». Le contenu est
// `ExemplaireEtFiche` : puces Box / RTA / Défenses siège / Offenses siège,
// choix de l'exemplaire en flottant, fiche, « Valider ce build ». La carte
// « Monstre & équipement » n'existe qu'au téléphone : au bureau, la liste de
// travail tient sa place au-dessus de cette section.
export default function ExemplaireBureau(props: ExemplaireEtFicheProps) {
  return (
    <section aria-label="Exemplaire" className="w-full" style={{ maxWidth: LARGEUR_FICHE_REPLIEE }}>
      <ExemplaireEtFiche {...props} />
    </section>
  );
}
