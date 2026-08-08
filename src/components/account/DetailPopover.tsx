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
  return (
    <div className={`absolute ${h} ${v} shadow-xl shadow-black/50`} style={{ width, maxWidth: '90vw' }}>
      {children}
    </div>
  );
}
