import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Bouton, BoutonIcone, FlottantAuto, ZoneCliquable } from '../../ui';
import { X } from 'lucide-react';
import type { RapportImportOptimizer } from '../../lib/importEquipes';
import type { OptimizerState } from '../../hooks/useOptimizerState';

interface Props {
  sources: { libelle: string; produire: Parameters<OptimizerState['importerEquipe']>[0]; utilisable: boolean }[];
  onImporter: OptimizerState['importerEquipe'];
  rapport: RapportImportOptimizer | null;
}

export default function OptimizerImportButton({ sources, onImporter, rapport }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const ancre = useRef<HTMLDivElement>(null);
  const disponible = sources.some(s => s.utilisable);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => { if (!ancre.current?.contains(e.target as Node)) setOuvert(false); };
    const clavier = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', dehors); document.addEventListener('keydown', clavier);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', clavier); };
  }, [ouvert]);
  return <div ref={ancre} className="relative mt-3">
    <Bouton pleineLargeur icone={<Download size={14} />} libelle="Importer une équipe"
      disabled={!disponible} title={disponible ? 'Créer une nouvelle liste depuis le siège, la prépa RTA ou un deck recommandé.' : 'Aucune source utilisable dans les défenses de siège, les offenses de siège, la prépa RTA ou les recommandations.'}
      aria-expanded={ouvert} onClick={() => setOuvert(v => !v)} />
    <FlottantAuto ouvert={ouvert} ancre={ancre} largeurAncre hauteur={320} rembourrage="aucun"
      className="max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-sm font-semibold text-ink">Importer une équipe</p>
        <BoutonIcone libelle="Fermer les sources d’import" icone={<X size={14} />} onClick={() => setOuvert(false)} />
      </div>
      <div aria-label="Sources d’import">
        {sources.map(source => <ZoneCliquable key={source.libelle} disabled={!source.utilisable}
          title={source.utilisable ? 'Importer dans une nouvelle liste.' : 'Aucun membre résolvable dans cette source.'}
          className="w-full px-3 py-2 text-sm text-ink hoverable:bg-accent-soft disabled:text-ink-dimmer"
          onClick={() => onImporter(source.produire)}>{source.libelle}</ZoneCliquable>)}
      </div>
      {rapport && <div role="status" aria-label="Rapport d’import" className="border-t border-border-soft px-3 py-2 text-xs text-ink-dim">
        <p>{rapport.listeCreee ? `Liste « ${rapport.listeCreee.name} » créée : ${rapport.membresImportes} monstre(s), ${rapport.equipesCreees} équipe(s).` : 'Aucune liste créée.'}</p>
        {rapport.ignores.map((m, i) => <p key={`ignore-${i}`}>{m.libelle} : {m.raison}</p>)}
        {rapport.messages.map((m, i) => <p key={`message-${i}`}>{m}</p>)}
      </div>}
    </FlottantAuto>
  </div>;
}
