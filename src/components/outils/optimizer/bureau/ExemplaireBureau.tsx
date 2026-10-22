import ExemplaireEtFiche, { type ExemplaireEtFicheProps } from '../ExemplaireEtFiche';

// La place d'« Exemplaire » en tête de la colonne de droite, et les deux
// largeurs repères de cette colonne (`LARGEURS_BUREAU.exemplaire` et
// `exemplaireMin`, src/lib/optimizerColonnes.ts) : la fiche (statistiques,
// artéfacts, roue de runes, relique) dépliée, 564 px mesurés avec une relique
// ATQ ou DEF à deux chiffres, ou repliée, 356 px, plus le contour et le
// rembourrage du panneau, l'écart et la barre de défilement de la colonne (32).
export const LARGEUR_EXEMPLAIRE = 596;
export const LARGEUR_EXEMPLAIRE_MIN = 388;
const LARGEUR_FICHE_REPLIEE = 356;
// La section prend la largeur de sa piste, au plus 598 px (sa largeur quand la
// place ne manque pas), jamais moins que la fiche repliée : les puces de source
// se partagent ce qui reste, la fiche se replie sous 564 px
// (`ExemplaireEtFiche`) et ne se réduit pas au-delà.
const LARGEUR_SECTION_MAX = 598;

// « Exemplaire », au bureau : en tête de la colonne de droite (A3) ou sous les
// réglages (A1, A2), section du panneau de cette colonne. Le contenu est
// `ExemplaireEtFiche` : puces Box / RTA / Défenses siège / Offenses siège,
// choix de l'exemplaire en flottant, fiche, « Valider ce build ». La carte
// « Monstre & équipement » n'existe qu'au téléphone : au bureau, la liste de
// travail tient sa place dans les essentiels.
export default function ExemplaireBureau(props: ExemplaireEtFicheProps) {
  return (
    <section aria-label="Exemplaire" className="w-full" style={{ maxWidth: LARGEUR_SECTION_MAX, minWidth: LARGEUR_FICHE_REPLIEE }}>
      <ExemplaireEtFiche {...props} />
    </section>
  );
}
