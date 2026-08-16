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
      // ⚠️ **`data-cible-fine` : la règle tactile globale ne s'applique PAS
      // ici.** Elle porte tout bouton à 40 px de haut au doigt (voir
      // index.css) ; sur cet interrupteur, dont la hauteur EST le dessin, elle
      // transformait la piste de 22 px en un cercle de 40, avec la pastille
      // collée en haut. Un interrupteur qui grossit n'est plus un interrupteur.
      //
      // ⚠️ La cible tactile est rétablie AUTREMENT, par un pseudo-élément qui
      // déborde de chaque côté (`.cible-tactile` dans index.css) : la zone
      // touchable atteint 44 px sans qu'un pixel du dessin ne bouge. C'est la
      // bonne réponse chaque fois que la forme d'un contrôle porte du sens.
      data-cible-fine
      className={`cible-tactile relative h-[22px] w-[40px] flex-none rounded-full border transition
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
