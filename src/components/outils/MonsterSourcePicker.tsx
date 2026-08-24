import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { Champ, Flottant } from '../../ui';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useNameFilteredResults } from '../../hooks/useNameFilteredResults';
import { ExclusionCandidate, exclusionSelectorKey } from '../../lib/optimizerExclusion';
import ExclusionCandidateRow from './ExclusionCandidateRow';

interface Props {
  // Déjà filtrés par la source active (box/RTA/Défenses siège/Offenses
  // siège) par l'appelant — ce composant ne fait QUE chercher/choisir par
  // nom PARMI eux, la source elle-même se choisit ailleurs (le sélecteur à
  // côté du titre, voir OptimizerSection.tsx).
  candidates: ExclusionCandidate[];
  onPick: (candidate: ExclusionCandidate) => void;
  placeholder?: string;
}

// Recherche du monstre à optimiser — EXACTEMENT le même mécanisme que
// RuneExclusionPicker (Champ + Flottant + ExclusionCandidateRow), demande
// explicite de cohérence entre « Monstre & équipement » et « Exclure les
// runes d'un monstre ». Sélection UNIQUE (pas de liste de choix cumulés) :
// choisir une entrée remplace la précédente plutôt que de s'y ajouter.
export default function MonsterSourcePicker({ candidates, onPick, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const idBase = useId();

  const results = useNameFilteredResults(candidates, query);

  const nav = useComboboxNav<ExclusionCandidate>({
    results,
    query,
    setQuery,
    idBase,
    onValider: onPick,
  });

  return (
    <div className="relative">
      <Champ
        {...nav.inputProps}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Rechercher un monstre…'}
        icone={<Search className="h-4 w-4" />}
      />

      {nav.open && (
        <Flottant
          {...nav.listProps}
          aria-label="Résultats de la recherche"
          rembourrage="aucun"
          className="max-h-[300px] overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="px-3 py-2 text-ink-dim text-[12.5px]">
              {candidates.length === 0 ? 'Aucun monstre dans cette source.' : 'Aucun monstre trouvé.'}
            </div>
          ) : (
            results.map((c, i) => {
              const estActif = i === nav.actif;
              return (
                <div
                  key={exclusionSelectorKey(c.selector)}
                  {...nav.optionProps(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(c);
                    nav.reinitialiser();
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 px-3 text-left transition
                    ${c.teamContext ? 'py-1' : 'py-1.5'}
                    ${estActif ? 'bg-accent-soft' : ''}`}
                >
                  <ExclusionCandidateRow candidate={c} />
                </div>
              );
            })
          )}
        </Flottant>
      )}
    </div>
  );
}
