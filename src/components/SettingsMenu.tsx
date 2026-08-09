import { ReactNode, useEffect, useRef, useState } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { RUNE_METRICS, setRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';

/* --------------------------------------------------------------------------
 * Briques de réglage — ajouter un paramètre = ajouter un <Setting>, rien d'autre
 * ----------------------------------------------------------------------- */

// Une ligne de réglage : intitulé à gauche, contrôle à droite. `hint` reste
// disponible pour un futur réglage moins évident, mais on s'en passe quand
// l'intitulé et les options parlent d'eux-mêmes.
function Setting({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="py-2.5 border-b border-border/60 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        {children}
      </div>
      {hint && <p className="mt-1 text-[11px] text-ink-dim leading-snug">{hint}</p>}
    </div>
  );
}

// Contrôle générique à choix unique, réutilisable par les futurs réglages.
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-panel2 border border-border rounded-lg p-0.5 flex-none">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            title={o.hint}
            aria-pressed={active}
            className={`rounded-md px-2 py-1 text-[11.5px] font-semibold transition whitespace-nowrap ${
              active
                ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink shadow'
                : 'text-ink-dim hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Le menu
 * ----------------------------------------------------------------------- */

// Réglages GLOBAUX de l'application : on les pose une fois, ils valent partout.
// Règle (voir spec/README.md) : un réglage qui concerne plusieurs pages vient
// ICI, jamais dupliqué en sélecteur sur chaque page.
function SettingsList({ onClearData }: { onClearData?: () => void }) {
  const metric = useRuneMetric();
  return (
    <div>
      <Setting title="Score">
        <Segmented options={RUNE_METRICS} value={metric} onChange={setRuneMetric} />
      </Setting>

      {/* ⚠️ La suppression vit ICI, pas à côté du bouton d'import : une action
          destructrice collée au bouton le plus utilisé finit par être cliquée de
          travers. Dans un menu qu'on ouvre exprès, le geste est délibéré. */}
      {onClearData && (
        <Setting title="Mes données">
          <button
            onClick={onClearData}
            title="Efface la prépa RTA, les équipes de siège, les recommandations et les monstres perso"
            className="flex flex-none items-center gap-1.5 rounded-lg border border-border bg-panel2
                       px-2.5 py-1 text-[11.5px] font-semibold text-ink-dim transition
                       hover:border-fire/60 hover:text-fire"
          >
            <Trash2 size={12} /> Tout supprimer
          </button>
        </Setting>
      )}
    </div>
  );
}

// `bar` = à côté du hamburger, quand la nav est repliée : les réglages doivent
// rester accessibles en UN geste, donc jamais enfouis dans le menu. Même gabarit
// que le bouton hamburger (44 px, encadré) pour former une paire.
export default function SettingsMenu({
  variant = 'desktop',
  onClearData,
}: {
  variant?: 'desktop' | 'bar';
  onClearData?: () => void;
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

  const btnClass =
    variant === 'bar'
      ? `w-11 h-11 rounded-lg border border-border ${open ? 'bg-panel2' : 'bg-panel'} text-ink`
      : `w-9 h-9 rounded-lg ${open ? 'bg-panel2 text-ink' : 'text-ink-dim hover:text-ink hover:bg-panel2'}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Réglages"
        title="Réglages"
        className={`flex items-center justify-center transition ${btnClass}`}
      >
        <Settings size={variant === 'bar' ? 20 : 16} />
      </button>
      {open && (
        <div className="absolute z-30 right-0 mt-1.5 w-fit min-w-[260px] rounded-xl border border-border bg-panel px-3 py-2 shadow-glow shadow-black/60">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim pb-1.5 border-b border-border">
            Réglages
          </div>
          <SettingsList onClearData={onClearData} />
        </div>
      )}
    </div>
  );
}
