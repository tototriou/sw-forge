import { X } from 'lucide-react';
import { RUNE_SETS } from '../../types';
import { canAddSet, setsCost, FOUR_PIECE_SETS } from '../../lib/effects';
import RuneIcon from '../RuneIcon';

interface Props {
  sets: string[]; // combo courant (une entrée par activation, ex. ['violent','will'])
  onChange: (sets: string[]) => void;
}

// Deux groupes affichés séparément — pas un simple filtre visuel, un rappel
// utile pendant la composition d'un combo (« il me reste 2 emplacements,
// seul un set 2 pièces peut encore rentrer »). Même source de vérité que le
// coût réel (`setPieces`/`FOUR_PIECE_SETS`, effects.ts), jamais dupliquée.
const FOUR_PIECE = RUNE_SETS.filter((s) => FOUR_PIECE_SETS.has(s.key));
const TWO_PIECE = RUNE_SETS.filter((s) => !FOUR_PIECE_SETS.has(s.key));

// Sélecteur du combo de sets recherché — UN SEUL combo (contrairement aux
// recommandations de siège, qui proposent plusieurs possibilités au choix).
// Même comportement que le picker de RecoCard.tsx (grille d'icônes, jamais un
// menu déroulant — on reconnaît un set à son symbole), réécrit en plus simple
// pour ne pas toucher au code du siège.
//
// ⚠️ Grille TOUJOURS déployée (pas de bascule « + Set » à cliquer d'abord) :
// c'est le tout premier réglage à remplir avant de pouvoir lancer une
// recherche — le garder replié par défaut ajoutait un clic systématique
// sans jamais rien cacher d'utile.
export default function SetComboPicker({ sets, onChange }: Props) {
  const used = setsCost(sets);
  const full = !RUNE_SETS.some((s) => canAddSet(sets, s.key));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {sets.map((key, i) => {
          const def = RUNE_SETS.find((s) => s.key === key);
          return (
            <span
              key={`${key}-${i}`}
              className="flex items-center gap-1 rounded-full border border-border bg-panel2 pl-1.5 pr-1 py-0.5 text-micro font-semibold"
            >
              <RuneIcon setKey={key} size={14} />
              {def?.label ?? key}
              <button
                type="button"
                onClick={() => onChange(sets.filter((_, j) => j !== i))}
                aria-label={`Retirer ${def?.label ?? key}`}
                className="rounded-full p-0.5 text-ink-dim transition hoverable:text-bad"
              >
                <X size={11} />
              </button>
            </span>
          );
        })}

        {full && (
          <span className="rounded-full border border-border bg-panel px-2 py-1 text-micro font-semibold text-ink-dim opacity-40">
            Plus de place (6 runes)
          </span>
        )}
        <span className="font-mono text-micro text-ink-dim">{used}/6 runes</span>
      </div>

      {!full && (
        <div className="mt-2 grid grid-cols-1 gap-3 rounded-lg border border-border bg-panel p-2 sm:grid-cols-2 sm:gap-0">
          {([
            ['Set principal', FOUR_PIECE],
            ['Set secondaire', TWO_PIECE],
          ] as const).map(([groupLabel, group], i) => (
            <div key={groupLabel} className={i > 0 ? 'border-t border-border-soft pt-2 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0' : 'sm:pr-3'}>
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-dimmer">{groupLabel}</p>
              <div className="flex flex-wrap gap-1">
                {group.map((s) => {
                  const fits = canAddSet(sets, s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={!fits}
                      onClick={() => onChange([...sets, s.key])}
                      title={s.label}
                      // ⚠️ `data-cible-fine` : grille serrée d'icônes de set, où
                      // une cible de 44 px déborderait sur la voisine. L'icône reste
                      // reconnaissable à 32 px, c'est ce qui compte.
                      data-cible-fine
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-panel2
                                 transition hoverable:border-accent disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <RuneIcon setKey={s.key} size={20} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
