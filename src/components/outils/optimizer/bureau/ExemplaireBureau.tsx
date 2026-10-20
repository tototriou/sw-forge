import ExemplaireEtFiche, { type ExemplaireEtFicheProps } from '../ExemplaireEtFiche';

export const LARGEUR_EXEMPLAIRE = 616;

// « Exemplaire », au bureau : en tête de la colonne de droite (A3) ou sous les
// réglages (A1, A2), sa propre carte. Le contenu est `ExemplaireEtFiche` :
// puces Box / RTA / Défenses siège / Offenses siège, choix de l'exemplaire en
// flottant, fiche, « Valider ce build ». La carte « Monstre & équipement »
// n'existe qu'au téléphone : au bureau, la liste de travail tient sa place
// dans les essentiels.
export default function ExemplaireBureau(props: ExemplaireEtFicheProps) {
  return (
    <section aria-label="Exemplaire" style={{ width: LARGEUR_EXEMPLAIRE }} className="rounded-xl border border-border bg-panel p-3">
      <ExemplaireEtFiche {...props} />
    </section>
  );
}
