import { useEffect, useRef, useState } from 'react';
import { Check, Download, Plus, X } from 'lucide-react';
import { Bouton, BoutonIcone, FlottantAuto, ZoneCliquable } from '../../ui';
import MonsterAvatar from '../MonsterAvatar';
import type { Monster } from '../../types';
import type { RapportImportOptimizer } from '../../lib/importEquipes';
import type { OptimizerState } from '../../hooks/useOptimizerState';

export interface SourceImportOptimizer {
  /** En-tête de la section, comme les camps de l'import de deck du Speed tuning. */
  groupe: string;
  /** Libellé court affiché après les icônes. */
  libelle: string;
  /** Nom complet, monstres compris : nom accessible et infobulle. */
  nom: string;
  monstres: Monster[];
  produire: Parameters<OptimizerState['importerEquipe']>[0];
  utilisable: boolean;
}

interface Props {
  sources: SourceImportOptimizer[];
  onImporter: OptimizerState['importerEquipe'];
  rapport: RapportImportOptimizer | null;
  /** Au bout d'une ligne de menus : bouton à sa largeur, sources sur une largeur propre. */
  enLigne?: boolean;
}

// Au-delà, la ligne dit combien d'autres monstres la source importe.
const ICONES_MAX = 5;

export default function OptimizerImportButton({ sources, onImporter, rapport, enLigne = false }: Props) {
  const [ouvert, setOuvert] = useState(false);
  // Deux secondes de « ✓ Liste créée » après un import réussi.
  const [confirme, setConfirme] = useState(false);
  useEffect(() => {
    if (!confirme) return;
    const id = setTimeout(() => setConfirme(false), 2000);
    return () => clearTimeout(id);
  }, [confirme]);
  const ancre = useRef<HTMLDivElement>(null);
  const disponible = sources.some(s => s.utilisable);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => { if (!ancre.current?.contains(e.target as Node)) setOuvert(false); };
    const clavier = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', dehors); document.addEventListener('keydown', clavier);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', clavier); };
  }, [ouvert]);
  return <div ref={ancre} className="relative">
    {/* Les deux libellés occupent la même case : la confirmation ne change
        pas la largeur du bouton, donc rien ne bouge autour de lui. */}
    <Bouton pleineLargeur={!enLigne} aria-label="Importer une équipe" ton={confirme ? 'accent' : undefined}
      icone={confirme ? <Check size={14} /> : <Download size={14} />}
      libelle={<span className="inline-grid">
        <span className={`col-start-1 row-start-1 ${confirme ? 'invisible' : ''}`}>Importer une équipe</span>
        <span className={`col-start-1 row-start-1 ${confirme ? '' : 'invisible'}`} role="status">{confirme ? 'Liste créée' : ''}</span>
      </span>}
      disabled={!disponible} title={disponible ? 'Créer une nouvelle liste depuis le siège, la prépa RTA ou un deck recommandé.' : 'Aucune source utilisable dans les défenses de siège, les offenses de siège, la prépa RTA ou les recommandations.'}
      aria-expanded={ouvert} onClick={() => setOuvert(v => !v)} />
    <FlottantAuto ouvert={ouvert} ancre={ancre} largeurAncre={!enLigne} largeur={320} hauteur={320} rembourrage="aucun"
      className="max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-sm font-semibold text-ink">Importer une équipe</p>
        <BoutonIcone libelle="Fermer les sources d’import" icone={<X size={14} />} onClick={() => setOuvert(false)} />
      </div>
      {/* Même grammaire que l'import de deck du Speed tuning : un en-tête par
          section, puis les monstres de chaque source avant son libellé. */}
      <div aria-label="Sources d’import">
        {sources.map((source, i) => <div key={source.nom}>
          {(i === 0 || sources[i - 1].groupe !== source.groupe) && (
            <div className="border-y border-border-soft bg-panel2 px-3 py-1.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
              {source.groupe}
            </div>
          )}
          <ZoneCliquable disabled={!source.utilisable} aria-label={source.nom}
            title={source.utilisable ? `${source.nom} — importer dans une nouvelle liste.` : 'Aucun membre résolvable dans cette source.'}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-ink hoverable:bg-accent-soft disabled:text-ink-dimmer"
            // Réussi, l'import replie les sources (le bandeau le confirme) ;
            // un refus reste lisible dans le rapport, sources ouvertes.
            onClick={() => { if (onImporter(source.produire).listeCreee) { setOuvert(false); setConfirme(true); } }}>
            <span className="flex flex-none items-center gap-1">
              {source.monstres.slice(0, ICONES_MAX).map((m, j) => <MonsterAvatar key={`${m.id}-${j}`} monster={m} size={26} element={false} />)}
              {source.monstres.length > ICONES_MAX && <span className="text-micro text-ink-dim">+{source.monstres.length - ICONES_MAX}</span>}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{source.libelle}</span>
            <Plus size={14} className="flex-none text-ink-dim" />
          </ZoneCliquable>
        </div>)}
      </div>
      {rapport && <div role="status" aria-label="Rapport d’import" className="border-t border-border-soft px-3 py-2 text-xs text-ink-dim">
        <p>{rapport.listeCreee ? `Liste « ${rapport.listeCreee.name} » créée : ${rapport.membresImportes} monstre(s), ${rapport.equipesCreees} équipe(s).` : 'Aucune liste créée.'}</p>
        {rapport.ignores.map((m, i) => <p key={`ignore-${i}`}>{m.libelle} : {m.raison}</p>)}
        {rapport.messages.map((m, i) => <p key={`message-${i}`}>{m}</p>)}
      </div>}
    </FlottantAuto>
  </div>;
}
