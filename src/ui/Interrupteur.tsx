import { forwardRef, ReactNode } from 'react';

// Interrupteur à glissière : un réglage qui reste, avec son libellé à côté.
//
// ⚠️ **`role="switch"` et non `button`.** Un lecteur d'écran annonce alors
// « interrupteur, activé » plutôt que « bouton » — la différence entre savoir
// dans quel état on est et devoir l'essayer pour le découvrir. `aria-checked`
// porte l'état, jamais une classe.
//
// ⚠️ **Distinct de [Pastille](Pastille.tsx), qui a le même rôle logique.** La
// pastille vit dans une RANGÉE de ses semblables, où seul le fond peut porter
// l'état sans que trois voisines ne se disputent le regard. La glissière vit
// SEULE, avec une phrase à côté : elle a la place de dessiner son état, et le
// mouvement du curseur dit dans quel sens on va. Choisir l'une ou l'autre est
// une question de contexte, pas de goût — et c'est pour cela qu'elles restent
// deux composants.
//
// ⚠️ Le curseur est TOUJOURS blanc, sur les deux thèmes : c'est un objet
// physique posé sur une piste, pas un élément d'interface qui suivrait la
// palette. Le teinter le faisait disparaître dans sa propre piste à l'état actif.

export interface InterrupteurProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onChange'> {
  actif: boolean;
  onChange: (actif: boolean) => void;
  libelle?: ReactNode;
  // Couleur de la piste à l'état actif. `accent` par défaut ; `star` pour un
  // réglage d'ATTENTION visuelle (surligner, signaler) — la teinte dit alors ce
  // que le réglage va faire apparaître à l'écran.
  ton?: 'accent' | 'star';
}

const Interrupteur = forwardRef<HTMLButtonElement, InterrupteurProps>(function Interrupteur(
  { actif, onChange, libelle, ton = 'accent', className = '', type = 'button', ...reste },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={actif}
      onClick={() => onChange(!actif)}
      className={`flex select-none items-center gap-2 ${className}`}
      {...reste}
    >
      <span
        className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors ${
          actif
            ? ton === 'star'
              ? 'bg-star'
              : 'bg-accent'
            : 'border border-border bg-panel2'
        }`}
      >
        {/* Décalages en pixels et non en pourcentage : la piste fait 36 px et le
            curseur 14 — un `translate-x-full` le sortirait de la piste. */}
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            actif ? 'translate-x-[19px]' : 'translate-x-[3px]'
          }`}
        />
      </span>
      {libelle != null && (
        <span className={`text-xs font-semibold ${actif ? 'text-ink' : 'text-ink-dim'}`}>
          {libelle}
        </span>
      )}
    </button>
  );
});

export default Interrupteur;
