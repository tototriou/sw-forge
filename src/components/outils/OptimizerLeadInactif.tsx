import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BoutonIcone, FlottantAuto, Modale } from '../../ui';
import { COMPACT, useMediaQuery } from '../../hooks/useMediaQuery';

/** Le motif sort du flux et du défilement de la liste ; la cible garde sa place. */
export default function OptimizerLeadInactif({ motif }: { motif?: string }) {
  return <span className="inline-flex h-6 w-6 flex-none compact:h-10 compact:w-10">
    {motif && <MotifLead motif={motif} />}
  </span>;
}

// L'absence du motif démonte son contenu : aucune ouverture ni position ne survit.
function MotifLead({ motif }: { motif: string }) {
  const auDoigt = useMediaQuery(COMPACT);
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState<DOMRect | null>(null);
  const cible = useRef<HTMLButtonElement>(null);
  const ancre = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!ouvert || auDoigt) return;
    const fermer = () => setOuvert(false);
    // La capture reçoit aussi le défilement non bouillonnant de la liste et
    // de chacun de ses ancêtres ; le rectangle du portail cesse alors de servir.
    window.addEventListener('scroll', fermer, true);
    return () => window.removeEventListener('scroll', fermer, true);
  }, [ouvert, auDoigt]);

  const ouvrir = () => {
    // Un tap ne focalise pas toujours le bouton : Modale doit connaître l'ouvreur.
    if (auDoigt) cible.current?.focus({ preventScroll: true });
    setPosition(cible.current?.getBoundingClientRect() ?? null);
    setOuvert(true);
  };

  return <>
    <BoutonIcone ref={cible} libelle={`Lead inactif : ${motif}`} sansInfobulle
      ton="alerte" icone={<span aria-hidden>⚠</span>} className="h-full w-full"
      aria-expanded={ouvert} aria-describedby={ouvert ? id : undefined}
      onMouseEnter={() => { if (!auDoigt) ouvrir(); }}
      onMouseLeave={() => { if (!auDoigt) setOuvert(false); }}
      onFocus={() => { if (!auDoigt) ouvrir(); }}
      onBlur={() => { if (!auDoigt) setOuvert(false); }}
      onKeyDown={e => { if (e.key === 'Escape') setOuvert(false); }}
      onClick={() => { if (auDoigt) ouvrir(); else setOuvert(v => !v); }} />
    {ouvert && (auDoigt
      ? <Modale onClose={() => setOuvert(false)} labelledBy={`${id}-titre`} titre="Lead inactif" croix>
        <p id={id} className="text-sm text-ink">{motif}</p>
      </Modale>
      : position && createPortal(<span ref={ancre} className="fixed pointer-events-none"
        style={{ left: position.left, top: position.top, width: position.width, height: position.height }}>
        <FlottantAuto ouvert ancre={ancre} rembourrage="sm">
          <p id={id} role="tooltip" className="text-xs text-ink">{motif}</p>
        </FlottantAuto>
      </span>, document.body))}
  </>;
}
