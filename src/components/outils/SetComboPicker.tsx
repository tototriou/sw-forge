import { RUNE_SETS } from '../../types';
import { canAddSet, setsCost, FOUR_PIECE_SETS, INTANGIBLE_SET, runeSetIconFilter } from '../../lib/effects';
import RuneIcon from '../RuneIcon';
import { Jeton, BoutonIcone } from '../../ui';

interface Props {
  sets: string[]; // combo courant (une entrée par activation, ex. ['violent','will'])
  onChange: (sets: string[]) => void;
}

/**
 * ⚠️ **L'INTANGIBLE n'est pas un set qu'on demande** — il est retiré des deux
 * groupes.
 *
 * C'est un **joker à UNE pièce** (`SET_INFO.intangible = { pieces: 1 }`,
 * effects.ts) : il complète n'importe quel set, on ne le vise jamais pour
 * lui-même. Il apparaissait pourtant sous « Set secondaire », parce que ce
 * groupe se définissait par la NÉGATION (« tout ce qui n'est pas un set de
 * 4 ») — or l'intangible n'est ni l'un ni l'autre. Le demander revenait à
 * réclamer un set de 2 pièces qui n'existe pas, et la recherche ne pouvait
 * rien en faire. Signalé à l'usage.
 *
 * ⚠️ Il reste évidemment UTILISABLE par la recherche, qui s'en sert pour
 * compléter les sets demandés — c'est seulement le fait de le CHOISIR comme
 * objectif qui n'a pas de sens.
 */
const CHOISISSABLES = RUNE_SETS.filter((s) => s.key !== INTANGIBLE_SET);

// Deux groupes affichés séparément — pas un simple filtre visuel, un rappel
// utile pendant la composition d'un combo (« il me reste 2 emplacements,
// seul un set 2 pièces peut encore rentrer »). Même source de vérité que le
// coût réel (`setPieces`/`FOUR_PIECE_SETS`, effects.ts), jamais dupliquée.
const FOUR_PIECE = CHOISISSABLES.filter((s) => FOUR_PIECE_SETS.has(s.key));
const TWO_PIECE = CHOISISSABLES.filter((s) => !FOUR_PIECE_SETS.has(s.key));

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
  // ⚠️ « Plein » se juge sur ce qu'on peut CHOISIR : compter l'intangible ici
  // laisserait le picker se dire non plein alors qu'aucun set proposé ne
  // rentre plus. ⚠️ En revanche, le rendu du combo courant (juste en dessous)
  // lit bien `RUNE_SETS` entier — une recette ancienne peut en contenir un, et
  // il doit rester affichable et retirable.
  const full = !CHOISISSABLES.some((s) => canAddSet(sets, s.key));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {sets.map((key, i) => {
          const def = RUNE_SETS.find((s) => s.key === key);
          return (
            <Jeton
              key={`${key}-${i}`}
              icone={<RuneIcon setKey={key} size={14} filter={runeSetIconFilter(false)} />}
              libelle={def?.label ?? key}
              onRetirer={() => onChange(sets.filter((_, j) => j !== i))}
              libelleRetrait={`Retirer ${def?.label ?? key}`}
            />
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
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-0 rounded-lg border border-border bg-panel p-2">
          {/* ⚠️ Toujours 2 colonnes, jamais empilé sous un seuil de largeur :
              chaque groupe passe déjà à la ligne en interne (`flex-wrap`), la
              séparation verticale gagne de la place sur le plan VERTICAL —
              le rare qui manque sur téléphone — plutôt que de dupliquer la
              hauteur pour rien.
              ⚠️ **Colonnes ASYMÉTRIQUES** (`auto` / `1fr`), au doigt COMME au
              bureau — demande explicite (« comme sur mobile ») : Set
              principal a EXACTEMENT 6 sets (`grid-cols-3` ci-dessous, deux
              lignes de trois, jamais plus) — lui laisser une colonne égale
              gaspillait une largeur qu'il n'utilise pas, surtout dans une
              carte « Critères de recherche » compactée. Set secondaire (17
              sets) récupère cette largeur libérée, ce qui réduit son nombre
              de lignes — c'est lui qui pèse sur la hauteur. */}
          {([
            ['Set principal', FOUR_PIECE],
            ['Set secondaire', TWO_PIECE],
          ] as const).map(([groupLabel, group], i) => (
            <div key={groupLabel} className={i > 0 ? 'border-l border-border-soft pl-3' : 'pr-3'}>
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-dimmer">{groupLabel}</p>
              <div className={i === 0 ? 'grid grid-cols-3 gap-1' : 'flex flex-wrap gap-1'}>
                {group.map((s) => {
                  const fits = canAddSet(sets, s.key);
                  return (
                    // ⚠️ `data-cible-fine` : grille serrée d'icônes de set, où
                    // une cible de 44 px déborderait sur la voisine. L'icône reste
                    // reconnaissable à 32 px, c'est ce qui compte.
                    <BoutonIcone
                      key={s.key}
                      cadre
                      libelle={s.label}
                      icone={<RuneIcon setKey={s.key} size={20} filter={runeSetIconFilter(false)} />}
                      disabled={!fits}
                      onClick={() => onChange([...sets, s.key])}
                      data-cible-fine
                      className="h-8 w-8"
                    />
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
