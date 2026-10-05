import { forwardRef, ReactNode, useId } from 'react';
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
  // Action posée JUSTE À DROITE DU TITRE, dans la case mais HORS du bouton
  // principal : le « ? » qui ouvre la prose d'un sort (`HelpPopover`), par
  // exemple. Elle garde son propre libellé et son propre geste.
  //
  // ⚠️ **Un axe, pas une variante, et il change la STRUCTURE.** Posée dans
  // `titre`, l'action ferait un bouton dans un bouton — HTML invalide, et un
  // clic sur elle choisirait aussi l'option. Avec elle, la case devient donc un
  // CADRE qui dessine (le patron de `BoutonGroupe`) : le bouton principal la
  // couvre entièrement, sans contenu, nommé par le titre et la description
  // (`aria-labelledby`), et l'action, posée après lui, passe devant. Le clic
  // sur l'action ne choisit rien ; partout ailleurs, la case se choisit comme
  // avant.
  // ⚠️ L'action reste VIVE quand l'option est désactivée (un sort refusé garde
  // le « ? » de sa prose) : seuls l'icône, le titre et la description
  // s'estompent, jamais elle. Sans action, la case reste le `<button>` d'avant,
  // au caractère près.
  actionTitre?: ReactNode;
}

// Pression du CADRE quand la case porte une action : la case entière s'enfonce
// quand on appuie sur son bouton principal — comme le `<button>` sans action —,
// pas quand on appuie sur l'action. `:active` gagne aussi les ancêtres, d'où le
// `:has(> button:active)` : seul l'enfant DIRECT, le bouton principal, compte.
const PRESSION_CADRE = 'transition-transform duration-150 ease-out has-[>button:active]:scale-[0.97]';

const Option = forwardRef<HTMLButtonElement, OptionProps>(function Option(
  { titre, description, icone, compte, actif, actionTitre, className = '', type = 'button', ...reste },
  ref,
) {
  const id = useId();
  if (actionTitre != null && actionTitre !== false) {
    const desactive = reste.disabled === true;
    const estompe = desactive ? 'opacity-40' : '';
    const idTitre = `${id}-titre`;
    const idDescription = `${id}-description`;
    return (
      <div
        className={`relative flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left
          transition ${PRESSION_CADRE} ${
            // Désactivée : le cadre prend l'opacité que le `<button>` sans
            // action reçoit tout entier (`disabled:opacity-40`), mais par ses
            // COULEURS — une opacité sur le cadre estomperait aussi l'action.
            desactive
              ? 'border-border/40 bg-panel2/40'
              : actif
                ? 'border-accent bg-accent-soft'
                : 'border-border bg-panel2 hoverable:border-accent'
          } ${className}`}
      >
        {/* ⚠️ Vide et POSÉ SUR TOUTE LA CASE (`-inset-px` : bordure comprise,
            pour que le contour de focus tombe où il tombait). Positionné, il
            passe devant le contenu, qui ne l'est pas : un clic sur l'icône, le
            titre ou la description le choisit. `data-cible-fine` : la case est
            déjà la cible, la règle tactile n'a rien à étirer (comme le bouton
            principal de `BoutonGroupe`). */}
        <button
          ref={ref}
          type={type}
          aria-pressed={actif}
          aria-labelledby={description ? `${idTitre} ${idDescription}` : idTitre}
          data-cible-fine
          className="absolute -inset-px rounded-xl disabled:cursor-not-allowed"
          {...reste}
        />
        {/* `aria-hidden` sur ce qui nomme le bouton : lu une fois, par lui, et
            non une seconde fois en texte à côté. L'action, elle, reste lue. */}
        {icone && (
          <div aria-hidden className={`mt-[2px] flex-none text-ink-dim ${estompe}`}>
            {icone}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <span id={idTitre} aria-hidden className={`flex items-center gap-1.5 ${estompe}`}>
              {titre}
              {compte != null && <span className="font-mono text-micro text-ink-dim">{compte}</span>}
            </span>
            {/* ⚠️ `relative` : positionnée et placée APRÈS le bouton principal,
                l'action passe devant lui sans `z-index` — un `z-index` ferait
                d'elle un contexte d'empilement, et la bulle qu'elle ouvre
                passerait sous le « ? » de la case suivante. */}
            <div className="relative flex-none">{actionTitre}</div>
          </div>
          {description && (
            <div
              id={idDescription}
              aria-hidden
              className={`mt-0.5 text-micro leading-relaxed text-ink-dim ${estompe}`}
            >
              {description}
            </div>
          )}
        </div>
      </div>
    );
  }
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
