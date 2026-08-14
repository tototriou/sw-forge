import { ReactNode, useEffect, useRef } from 'react';
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
  // Enregistrement de la zone auprès de `useDragLong` : sans `dataTransfer`,
  // c'est le hook qui décide quelle zone est sous le pointeur.
  enregistrerZone: (clé: string, el: HTMLElement | null) => void;
  over: boolean; // le pointeur survole CETTE zone pendant un déplacement
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
  enregistrerZone,
  over,
  openIndex = -1,
  detail,
  children,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  // ⚠️ Désenregistrement au démontage : une section supprimée qui resterait
  // dans la table continuerait de capter les dépôts sur son ancien rectangle.
  useEffect(() => {
    enregistrerZone(sectionKey, ref.current);
    return () => enregistrerZone(sectionKey, null);
  }, [sectionKey, enregistrerZone]);

  return (
    <section
      ref={ref}
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
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-2.5"
          openIndex={openIndex}
          detail={detail}
        >
          {children}
        </AccordionGrid>
      )}
    </section>
  );
}
