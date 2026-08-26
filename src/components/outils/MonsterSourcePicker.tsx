import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Champ, Flottant } from '../../ui';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useNameFilteredResults } from '../../hooks/useNameFilteredResults';
import { ExclusionCandidate, exclusionSelectorKey } from '../../lib/optimizerExclusion';
import { Monster } from '../../types';
import { formesJouables } from '../../lib/monsterForms';
import MonsterAvatar from '../MonsterAvatar';
import ExclusionCandidateRow from './ExclusionCandidateRow';

// ⚠️ **Deux modes, UN SEUL composant** (voir spec/outils/optimizer/
// historique-import-monstres-a-optimiser.md, Question 8) — plutôt que de
// dupliquer un second picker pour la recherche bestiaire.
interface AccountModeProps {
  // Mode « compte réel » (défaut, comportement historique inchangé) —
  // cherche PARMI des candidats déjà filtrés par la source active
  // (box/RTA/Défenses siège/Offenses siège), choisis par l'appelant. Seul
  // mode utilisable pour EXCLURE des runes : impossible d'exclure les runes
  // d'un monstre non possédé.
  mode?: 'account';
  candidates: ExclusionCandidate[];
  onPick: (candidate: ExclusionCandidate) => void;
  placeholder?: string;
}

interface BestiaryModeProps {
  // Mode « bestiaire » — résout une ESPÈCE (nom, icône, stats de base,
  // sorts), indépendamment de tout compte : « Monstre à optimiser » l'utilise
  // pour trouver un monstre même NON possédé. Seules les formes JOUABLES sont
  // proposées (`formesJouables`, même filtre que MonsterPicker.tsx).
  mode: 'bestiary';
  candidates: Monster[];
  onPick: (monster: Monster) => void;
  placeholder?: string;
}

type Props = AccountModeProps | BestiaryModeProps;

export default function MonsterSourcePicker(props: Props) {
  if (props.mode === 'bestiary') return <BestiaryPicker {...props} />;
  return <AccountPicker {...props} />;
}

// Recherche du monstre à optimiser PARMI un compte — EXACTEMENT le même
// mécanisme que RuneExclusionPicker (Champ + Flottant + ExclusionCandidateRow),
// demande explicite de cohérence entre « Monstre & équipement » et
// « Exclure les runes d'un monstre ». Sélection UNIQUE (pas de liste de choix
// cumulés) : choisir une entrée remplace la précédente plutôt que de s'y
// ajouter.
function AccountPicker({ candidates, onPick, placeholder }: AccountModeProps) {
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

// Recherche du monstre à optimiser dans TOUT le bestiaire (monstre possédé ou
// non) — résout une ESPÈCE, jamais un exemplaire/build (voir Question 1 du
// cadrage) : nom, icône, SPD de base, exactement ce que porte `Monster`.
// Choisir un exemplaire précis avec un build réel se fait ENSUITE, via les 4
// puces Box/RTA/Défenses siège/Offenses siège (voir OptimizerSection.tsx).
function BestiaryPicker({ candidates, onPick, placeholder }: BestiaryModeProps) {
  const [query, setQuery] = useState('');
  const idBase = useId();

  const jouables = useMemo(() => formesJouables(candidates), [candidates]);
  // `useNameFilteredResults` est générique sur `{ monster: Monster }` (déjà
  // partagé avec le mode compte réel ci-dessus) — un `Monster` nu s'y prête
  // par ce petit enrobage plutôt qu'une seconde fonction de filtrage.
  const wrapped = useMemo(() => jouables.map((m) => ({ monster: m })), [jouables]);
  const results = useNameFilteredResults(wrapped, query);

  const nav = useComboboxNav<{ monster: Monster }>({
    results,
    query,
    setQuery,
    idBase,
    onValider: (r) => onPick(r.monster),
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
            <div className="px-3 py-2 text-ink-dim text-[12.5px]">Aucun monstre trouvé.</div>
          ) : (
            results.map((r, i) => {
              const estActif = i === nav.actif;
              return (
                <div
                  key={r.monster.id}
                  {...nav.optionProps(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(r.monster);
                    nav.reinitialiser();
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left transition
                    ${estActif ? 'bg-accent-soft' : ''}`}
                >
                  <MonsterAvatar monster={r.monster} size={28} className="flex-none" />
                  <span className="text-[13px] font-medium truncate flex-1">{r.monster.name}</span>
                </div>
              );
            })
          )}
        </Flottant>
      )}
    </div>
  );
}
