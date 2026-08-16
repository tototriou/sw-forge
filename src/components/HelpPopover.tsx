import { ReactNode, useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

// Bouton d'aide rond + popup fermable au clic extérieur — même patron que
// celui de RunesCurve.tsx (Mon compte → Courbes, « À quoi sert ce graphe ? »),
// généralisé ici pour être réutilisé ailleurs (Outils → Optimizer) sans
// dupliquer la gestion d'ouverture/fermeture à chaque nouvel usage.
export default function HelpPopover({
  title,
  children,
  ariaLabel,
  width = 340,
}: {
  title: string;
  children: ReactNode;
  ariaLabel?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={ariaLabel ?? title}
        title={ariaLabel ?? title}
        className={`flex items-center justify-center w-6 h-6 rounded-full border transition
          ${open ? 'bg-accent-soft border-accent text-ink' : 'bg-panel/80 border-border text-ink-dim hoverable:text-ink hoverable:border-accent'}`}
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1.5 w-[340px] max-w-[88vw] rounded-lg border border-accent bg-panel p-3
                     text-xs leading-relaxed text-ink-dim shadow-xl shadow-black/50"
          style={{ width }}
        >
          <p className="text-ink font-semibold mb-1">{title}</p>
          {children}
        </div>
      )}
    </div>
  );
}
