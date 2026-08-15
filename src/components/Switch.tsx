// Interrupteur générique oui/non, pour les réglages qui n'ont que deux états.
// Un `<Segmented>` à deux options ferait le travail, mais un réglage binaire se
// lit mieux d'un coup d'œil sur un interrupteur : on voit l'état sans lire.
//
// Il vivait dans [SettingsMenu.tsx](src/components/SettingsMenu.tsx), qui a été
// le premier à en avoir besoin (« Garder mes données ») ; remonté ici au
// deuxième usage plutôt que recopié — deux copies auraient divergé, comme les
// chips d'élément avant [elementStyles.ts](src/components/elementStyles.ts) et
// le contrôle à choix unique avant [Segmented.tsx](src/components/Segmented.tsx).
export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[40px] flex-none rounded-full border transition
        ${disabled ? 'cursor-not-allowed opacity-40' : ''}
        ${checked ? 'border-star/70 bg-star/30' : 'border-border bg-panel2'}`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[16px] rounded-full transition-all
          ${checked ? 'left-[20px] bg-star' : 'left-[2px] bg-ink-dim'}`}
      />
    </button>
  );
}
