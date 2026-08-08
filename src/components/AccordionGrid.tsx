import { Children, ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  className?: string; // classes de la grille (colonnes, gap…)
  openIndex: number; // index de la carte ouverte parmi les enfants (-1 = aucune)
  detail?: ReactNode; // panneau à insérer sous la LIGNE de la carte ouverte
  children: ReactNode; // les cartes (grid items)
}

// Grille « façon Google Images » : le panneau de détail s'insère **après la
// dernière carte de la ligne ouverte**, en pleine largeur. Les cartes voisines
// (même ligne) gardent donc leur place ; seules les lignes suivantes sont
// poussées vers le bas.
//
// Le nombre de colonnes n'est pas connu à l'avance (`auto-fill`) : on le lit sur
// la grille résolue (`gridTemplateColumns`) et on le recalcule au redimensionnement.
export default function AccordionGrid({ className = '', openIndex, detail, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const tracks = getComputedStyle(el).gridTemplateColumns;
      setCols(Math.max(1, tracks ? tracks.split(' ').filter(Boolean).length : 1));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = Children.toArray(children);
  // Fin de la ligne contenant la carte ouverte (bornée au nombre de cartes).
  const insertAt =
    openIndex >= 0 && detail ? Math.min(items.length, (Math.floor(openIndex / cols) + 1) * cols) : -1;

  if (insertAt < 0) {
    return (
      <div ref={ref} className={className}>
        {items}
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      {items.slice(0, insertAt)}
      <div style={{ gridColumn: '1 / -1' }}>{detail}</div>
      {items.slice(insertAt)}
    </div>
  );
}
