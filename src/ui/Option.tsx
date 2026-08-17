import { forwardRef, ReactNode } from 'react';
import { PRESSION } from './Bouton';

// Choix RICHE : une icône, un titre, une phrase qui explique ce qu'il implique.
// Ces options s'empilent verticalement — un dialogue « avec ou sans runes ? »,
// un réglage à trois paliers, un choix de format d'export.
//
// ⚠️ **Distinct de [Bouton](Bouton.tsx) parce qu'il ne se lit pas pareil.** Un
// bouton s'identifie d'un coup d'œil à son libellé ; une option se LIT. D'où le
// texte aligné à gauche (jamais centré), la description sous le titre, et
// l'icône calée en haut plutôt qu'au milieu — sur deux lignes de description,
// une icône centrée verticalement flotte en face de rien.
//
// ⚠️ **La DESCRIPTION n'est pas décorative.** Ces choix engagent quelque chose
// qu'on ne peut pas défaire d'un clic (ce qu'on publie de son compte, ce qu'on
// écrase). Un titre seul oblige à deviner ; c'est précisément là qu'on se
// trompe. Voir spec/README.md — le défaut ne perd jamais rien, et ce qui perd
// s'explique avant.

export interface OptionProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  titre: ReactNode;
  description?: ReactNode;
  icone?: ReactNode;
  // Valeur chiffrée posée à côté du titre — un effectif, un compte d'éléments
  // concernés. En mono, comme tout chiffre de l'app.
  compte?: ReactNode;
  // Option retenue, dans une liste où l'on garde le choix courant en évidence.
  actif?: boolean;
}

const Option = forwardRef<HTMLButtonElement, OptionProps>(function Option(
  { titre, description, icone, compte, actif, className = '', type = 'button', ...reste },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={actif}
      className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left
        transition disabled:cursor-not-allowed disabled:opacity-40 ${PRESSION} ${
          actif
            ? 'border-accent bg-accent-soft'
            : 'border-border bg-panel2 hoverable:border-accent'
        } ${className}`}
      {...reste}
    >
      {/* `mt-[2px]` : l'icône s'aligne sur la ligne de base du titre, pas sur le
          haut de sa boîte — sans quoi elle paraît décollée d'un pixel. */}
      {icone && <span className="mt-[2px] flex-none text-ink-dim">{icone}</span>}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          {titre}
          {compte != null && <span className="font-mono text-micro text-ink-dim">{compte}</span>}
        </span>
        {description && (
          <span className="mt-0.5 block text-micro leading-relaxed text-ink-dim">
            {description}
          </span>
        )}
      </span>
    </button>
  );
});

export default Option;
