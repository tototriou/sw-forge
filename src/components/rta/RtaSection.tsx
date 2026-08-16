import { ReactNode, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { RTA_OTHER, RTA_UNASSIGNED } from '../../types';
import RuneIcon from '../RuneIcon';
import AccordionGrid from '../AccordionGrid';

interface Props {
  sectionKey: string;
  label: string;
  accent: string;
  count: number;
  removable?: boolean;
  onRemoveSection?: (key: string) => void;
  onDropMonster: (section: string, id: string) => void;
  openIndex?: number; // index de la carte dont le détail est ouvert (-1 = aucune)
  detail?: ReactNode; // panneau de détail, inséré sous la ligne de cette carte
  children: ReactNode;
}

export default function RtaSection({
  sectionKey,
  label,
  accent,
  count,
  removable,
  onRemoveSection,
  onDropMonster,
  openIndex = -1,
  detail,
  children,
}: Props) {
  const [over, setOver] = useState(false);
  const depth = useRef(0); // compte enter/leave pour éviter le scintillement

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  }
  function onDragLeave() {
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setOver(false);
    }
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onDropMonster(sectionKey, id);
  }

  return (
    <section
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-2xl border p-3 transition-colors ${
        over ? 'border-transparent bg-panel2/80' : 'border-border bg-panel/40'
      }`}
      style={over ? { boxShadow: `0 0 0 2px ${accent}`, borderColor: accent } : undefined}
    >
      <div className="flex items-center gap-2.5 mb-3">
        {sectionKey === RTA_OTHER || sectionKey === RTA_UNASSIGNED ? (
          <span className="w-3 h-3 rounded-[3px] rotate-45 flex-none" style={{ background: accent }} />
        ) : (
          <RuneIcon setKey={sectionKey} size={22} className="flex-none" />
        )}
        <h3 className="font-display text-[16px] tracking-wide">{label}</h3>
        <span className="font-mono text-ink-dim text-[11px]">{count}</span>
        {removable && onRemoveSection && (
          <button
            onClick={() => onRemoveSection(sectionKey)}
            className="ml-auto flex items-center gap-1 text-ink-dim hoverable:text-fire text-[11px] transition"
            title="Supprimer la section (les monstres reviennent en Non classé)"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {count === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-6 text-center text-ink-dim text-[12.5px]">
          Glisse des monstres ici
        </div>
      ) : (
        <AccordionGrid
          // ⚠️ **150 px de colonne minimale, pas 210.** À 210, une seule carte
          // tenait sur 320 px utiles : une prépa de trente monstres devenait
          // trente lignes, et l'ordre de tour — qui se lit en balayant — n'était
          // plus lisible d'un coup d'œil. À 150, deux colonnes tiennent dès
          // 320 px et trois à partir de 480.
          // La carte s'y adapte : le sélecteur de section passe sous le nom
          // plutôt qu'à côté (voir RtaCard).
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-2
                     sm:grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] sm:gap-2.5"
          openIndex={openIndex}
          detail={detail}
        >
          {children}
        </AccordionGrid>
      )}
    </section>
  );
}
