import { Minus, Plus } from 'lucide-react';

// Champ numérique de l'app : **deux boutons − / +** encadrant la valeur.
//
// ⚠️ **Jamais `type="number"`.** Les flèches natives du navigateur sont deux
// triangles gris minuscules, hors charte, impossibles à styler correctement et
// pénibles à viser — surtout au tactile. On garde donc un `type="text"` avec
// `inputMode="numeric"` (qui fait remonter le pavé numérique sur mobile) et on
// dessine nos propres boutons.
//
// La frappe non numérique est simplement ignorée : plus prévisible qu'un champ
// qui se vide ou qui corrige tout seul pendant qu'on tape.

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  width?: string; // classe de largeur du CHAMP TEXTE (ignorée si `boxWidth` est fourni)
  // Largeur totale du contrôle (boutons + champ + suffixe compris), fixe.
  // ⚠️ À utiliser quand plusieurs champs doivent s'aligner pixel pour pixel
  // même si certains ont un `suffix` et d'autres non (ex. la grille de
  // Conditions de l'Optimizer) : sans ça, un champ avec `suffix="%"` est
  // TOUJOURS plus large qu'un champ sans suffixe à `width` égale, puisque le
  // suffixe prend de la place en plus DANS le contrôle. Avec `boxWidth`, le
  // champ texte devient flexible (`flex-1`) et absorbe la différence — la
  // largeur totale, elle, ne bouge jamais.
  boxWidth?: string;
  placeholder?: string;
  allowEmpty?: boolean; // un champ vide vaut `null` (ex. « pas de valeur saisie »)
  title?: string;
  ariaLabel?: string;
  suffix?: string; // affiché statiquement après la valeur, ex. « % »
  disabled?: boolean; // grisé et non interactif — la valeur reste affichée
}

export default function NumberField({
  value,
  onChange,
  step = 1,
  min,
  max,
  width = 'w-16',
  boxWidth,
  placeholder = '0',
  allowEmpty = false,
  title,
  ariaLabel,
  suffix,
  disabled = false,
}: Props) {
  const borne = (n: number) => {
    let v = n;
    if (min != null && v < min) v = min;
    if (max != null && v > max) v = max;
    return v;
  };

  const bouger = (delta: number) => onChange(borne((value ?? 0) + delta));

  // ⚠️ `data-cible-fine` (posé sur chaque bouton) : ces deux flèches sont
  // EMPILÉES et collées, à l'intérieur du cadre du champ. La règle tactile les
  // portait à 40 px chacune, soit 80 px de haut pour un champ qui en fait 28 —
  // le cadre éclatait. Une zone étendue les ferait se chevaucher : on
  // incrémenterait en voulant décrémenter.
  const btn =
    'flex h-7 w-6 flex-none items-center justify-center text-ink-dim transition hoverable:text-ink hoverable:bg-panel2 disabled:opacity-30';

  return (
    <div
      className={`inline-flex h-7 items-center overflow-hidden rounded-lg border border-border bg-panel
                 focus-within:border-accent ${boxWidth ?? ''} ${disabled ? 'opacity-40' : ''}`}
      title={title}
    >
      <button
        type="button"
        onClick={() => bouger(-step)}
        disabled={disabled || (min != null && (value ?? 0) <= min)}
        data-cible-fine
        className={`${btn} border-r border-border`}
        aria-label="Diminuer"
        tabIndex={-1}
      >
        <Minus size={12} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={value ?? ''}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => {
          const brut = e.target.value.trim();
          if (brut === '') return onChange(allowEmpty ? null : 0);
          if (!/^-?\d+$/.test(brut)) return; // frappe invalide ignorée
          // ⚠️ PAS de `borne()` ici : borner CHAQUE frappe casse la saisie dès
          // qu'un `min` positif dépasse un chiffre isolé. Exemple vécu : min 15,
          // max 100 — taper « 5 » saute à 15, puis « 0 » (lu comme « 150 »)
          // saute à 100. On ne peut alors plus jamais écrire « 50 ». La borne
          // s'applique donc seulement en sortie de champ (`onBlur`) et sur les
          // boutons ± (des pas discrets, pas de composition de chiffres).
          onChange(Number(brut));
        }}
        onBlur={() => {
          if (value == null) return; // vide autorisé : rien à borner
          const b = borne(value);
          if (b !== value) onChange(b);
        }}
        className={`${boxWidth ? 'flex-1' : width} min-w-0 bg-transparent px-1 text-center font-mono text-sm text-ink
                    outline-none placeholder:text-ink-dim disabled:cursor-not-allowed`}
      />

      {suffix && <span className="pr-1.5 font-mono text-xs text-ink-dim">{suffix}</span>}

      <button
        type="button"
        onClick={() => bouger(step)}
        disabled={disabled || (max != null && (value ?? 0) >= max)}
        data-cible-fine
        className={`${btn} border-l border-border`}
        aria-label="Augmenter"
        tabIndex={-1}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
