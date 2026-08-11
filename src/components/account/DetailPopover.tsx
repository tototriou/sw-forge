import { ReactNode, RefObject, useLayoutEffect, useState } from 'react';

interface Props {
  open: boolean;
  anchorRef: RefObject<HTMLElement>; // la tuile (conteneur `relative`)
  width?: number; // largeur de la carte (px)
  height?: number; // hauteur estimée (px) pour décider haut/bas
  children: ReactNode;
}

// Carte de détail flottante avec placement auto : s'ouvre vers la gauche si on
// est près du bord droit, vers le haut si on est près du bas — pour rester
// entièrement visible sans être coupée.
export default function DetailPopover({ open, anchorRef, width = 260, height = 320, children }: Props) {
  const [place, setPlace] = useState<{ h: 'left' | 'right'; v: 'up' | 'down' }>({ h: 'left', v: 'down' });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPlace({
      h: r.left + width > vw - 8 ? 'right' : 'left',
      v: r.bottom + height > vh - 8 && r.top - height > 8 ? 'up' : 'down',
    });
  }, [open, width, height, anchorRef]);

  if (!open) return null;

  const h = place.h === 'right' ? 'right-0' : 'left-0';
  const v = place.v === 'up' ? 'bottom-full mb-1' : 'top-full mt-1';
  // ⚠️ Fond OPAQUE (`bg-panel`) : la carte flotte au-dessus de la grille de
  // tuiles, pas au-dessus du fond de page. Les translucides du contenu
  // (`bg-panel/70` de RuneDetailBox) laissaient voir les runes derrière — on ne
  // lisait pas le détail.
  //
  // L'entrée s'anime depuis l'ANCRE : la carte grandit du coin d'où elle sort,
  // jamais depuis son centre. Et jamais depuis `scale(0)` — rien n'apparaît de
  // nulle part. Voir spec/shared/design.md.
  const origine = `${place.v === 'up' ? 'bottom' : 'top'} ${place.h === 'right' ? 'right' : 'left'}`;
  return (
    <div
      className={`absolute ${h} ${v} z-30 overflow-hidden rounded-lg border border-border bg-panel
                  shadow-xl shadow-black/50 animate-[popover_150ms_var(--ease-out)]`}
      style={{ width, maxWidth: '90vw', transformOrigin: origine }}
    >
      {children}
    </div>
  );
}
