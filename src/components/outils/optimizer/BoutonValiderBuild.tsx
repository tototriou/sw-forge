import { Bouton } from '../../../ui';
import { CheckCircle2 } from 'lucide-react';
import { type EtatValidation } from './types';

export interface BoutonValiderBuildProps {
  handleValidateDisplayed: () => void;
  canValidateDisplayed: boolean;
  matchesValidatedBuild: boolean;
  etatFiche: EtatValidation;
  displayedRuneConflicts: { slot: number | null; monsterName: string; }[];
}

export default function BoutonValiderBuild({ handleValidateDisplayed, canValidateDisplayed, matchesValidatedBuild, etatFiche, displayedRuneConflicts }: BoutonValiderBuildProps) {
  return (
    <>
      <Bouton
        onClick={handleValidateDisplayed}
        disabled={!canValidateDisplayed || matchesValidatedBuild}
        // ⚠️ Même code couleur que les cartes de résultat (BuildCandidateCard) :
        // `alerte` sur « Valider les artéfacts », parce qu'il signale un état
        // des DONNÉES — ce qui est affiché n'est pas ce qui est réservé.
        ton={etatFiche === 'oui' ? 'accent' : etatFiche === 'artefacts' ? 'alerte' : 'neutre'}
        fond={etatFiche === 'non' ? 'plein' : 'doux'}
        taille="sm"
        pleineLargeur
        icone={matchesValidatedBuild ? <CheckCircle2 size={14} /> : undefined}
        // ⚠️ Trois libellés, pas deux : mêmes runes + autre paire, il reste
        // quelque chose à valider — les artéfacts. Voir `EtatValidation`.
        libelle={etatFiche === 'oui' ? 'Validé' : etatFiche === 'artefacts' ? 'Valider les artéfacts' : 'Valider ce build'}
        className="mt-2.5"
      />
      {/* Message listant les runes déjà utilisées — demande explicite,
          « il faut afficher quelles runes sont déjà utilisées dans la
          liste ». Absent si déjà validé (le bandeau `validatedBadge`
          suffit alors, ce build EST la réservation). */}
      {displayedRuneConflicts.length > 0 && !matchesValidatedBuild && (
        <p className="mt-1.5 text-[11px] text-warn">
          {displayedRuneConflicts.length > 1 ? 'Runes déjà réservées' : 'Rune déjà réservée'} dans cette liste :{' '}
          {displayedRuneConflicts.map((c, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {c.slot != null ? `emplacement ${c.slot}` : 'une rune'} ({c.monsterName})
            </span>
          ))}
          .
        </p>
      )}
    </>
  );
}
