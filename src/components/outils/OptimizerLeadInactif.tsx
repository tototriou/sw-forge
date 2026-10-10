import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BoutonIcone, FlottantAuto, Modale } from '../../ui';
import { COMPACT, useMediaQuery } from '../../hooks/useMediaQuery';

/** Le motif sort du flux et du défilement de la liste ; la cible garde sa place. */
export default function OptimizerLeadInactif({ motif }: { motif?: string }) {
  const auDoigt = useMediaQuery(COMPACT);
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState<DOMRect | null>(null);
  const cible = useRef<HTMLButtonElement>(null);
  const ancre = useRef<HTMLSpanElement>(null);
  const id = useId();
  const ouvrir = () => {
    setPosition(cible.current?.getBoundingClientRect() ?? null);
    setOuvert(true);
  };

  return <span className="inline-flex h-6 w-6 flex-none compact:h-10 compact:w-10">
    {motif && <BoutonIcone ref={cible} libelle={`Lead inactif : ${motif}`} sansInfobulle
      ton="alerte" icone={<span aria-hidden>⚠</span>} className="h-full w-full"
      aria-expanded={ouvert} aria-describedby={ouvert ? id : undefined}
      onMouseEnter={() => { if (!auDoigt) ouvrir(); }}
      onMouseLeave={() => { if (!auDoigt) setOuvert(false); }}
      onFocus={() => { if (!auDoigt) ouvrir(); }}
      onBlur={() => { if (!auDoigt) setOuvert(false); }}
      onKeyDown={e => { if (e.key === 'Escape') setOuvert(false); }}
      onClick={() => { if (auDoigt) ouvrir(); else setOuvert(v => !v); }} />}
    {motif && ouvert && (auDoigt
      ? <Modale onClose={() => setOuvert(false)} labelledBy={`${id}-titre`} titre="Lead inactif" croix>
        <p id={id} className="text-sm text-ink">{motif}</p>
      </Modale>
      : position && createPortal(<span ref={ancre} className="fixed pointer-events-none"
        style={{ left: position.left, top: position.top, width: position.width, height: position.height }}>
        <FlottantAuto ouvert ancre={ancre} rembourrage="sm">
          <p id={id} role="tooltip" className="text-xs text-ink">{motif}</p>
        </FlottantAuto>
      </span>, document.body))}
  </span>;
}
