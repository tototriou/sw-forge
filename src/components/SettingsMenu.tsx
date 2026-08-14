import { ReactNode, useEffect, useRef, useState } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { RUNE_METRICS, setRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';
import { setPersistence, storageAvailable, usePersistence } from '../hooks/usePersistence';
import { THEME_CHOICES, setTheme, useTheme } from '../hooks/useTheme';
import AccountFreshness from './AccountFreshness';
import Segmented from './Segmented';

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

// Interrupteur générique oui/non, pour les réglages qui n'ont que deux états.
// Un `<Segmented>` à deux options ferait le travail, mais un réglage binaire se
// lit mieux d'un coup d'œil sur un interrupteur : on voit l'état sans lire.
function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[40px] flex-none rounded-full border transition
        ${disabled ? 'cursor-not-allowed opacity-40' : ''}
        ${checked ? 'border-star/70 bg-star/30' : 'border-border bg-panel2'}`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[16px] rounded-full transition-all
          ${checked ? 'left-[20px] bg-star' : 'left-[2px] bg-ink-dim'}`}
      />
    </button>
  );
}

/* --------------------------------------------------------------------------
 * Le menu
 * ----------------------------------------------------------------------- */

// Réglages GLOBAUX de l'application : on les pose une fois, ils valent partout.
// Règle (voir spec/README.md) : un réglage qui concerne plusieurs pages vient
// ICI, jamais dupliqué en sélecteur sur chaque page.
function SettingsList({
  onClearData,
  onKeepAccount,
  accountExportedAt,
}: {
  onClearData?: () => void;
  onKeepAccount?: () => void;
  accountExportedAt?: number | null;
}) {
  const metric = useRuneMetric();
  const keep = usePersistence();
  const storageOk = storageAvailable();
  const theme = useTheme();
  return (
    <div>
      {/* Le réglage le plus global de tous : il change l'app entière, il vient
          donc en premier. ⚠️ TROIS options, pas un interrupteur — « Auto » doit
          rester un choix explicite, sinon quelqu'un dont le système bascule le
          soir perd ce comportement sans l'avoir demandé.
          Voir spec/shared/design.md. */}
      <Setting title="Thème">
        <Segmented options={THEME_CHOICES} value={theme} onChange={setTheme} />
      </Setting>

      <Setting title="Score">
        <Segmented options={RUNE_METRICS} value={metric} onChange={setRuneMetric} />
      </Setting>

      <Setting
        title="Garder mes données"
        hint={
          storageOk
            ? 'Recommandé : sans ça, tout est perdu en fermant l’onglet — prépa RTA, équipes de siège, recommandations et compte. Tout reste dans ton navigateur, sur cet appareil : à éviter sur un ordinateur partagé.'
            : "Ton navigateur n'autorise pas le stockage (navigation privée ?). L'import reste valable le temps de la session."
        }
      >
        <Switch
          checked={keep && storageOk}
          disabled={!storageOk}
          onChange={(v) => setPersistence(v, onKeepAccount)}
          label="Garder mes données sur cet appareil"
        />
      </Setting>

      {/* L'âge des données vit ICI, à côté du réglage qui décide de leur
          conservation : c'est là qu'on se pose la question, et ça n'encombre
          aucune page. */}
      <AccountFreshness exportedAt={accountExportedAt ?? null} className="pb-2.5" />

      {/* ⚠️ La suppression vit ICI, pas à côté du bouton d'import : une action
          destructrice collée au bouton le plus utilisé finit par être cliquée de
          travers. Dans un menu qu'on ouvre exprès, le geste est délibéré. */}
      {onClearData && (
        <Setting title="Mes données">
          <button
            onClick={onClearData}
            title="Efface la prépa RTA, les équipes de siège, les recommandations, les monstres perso et le compte importé"
            className="flex flex-none items-center gap-1.5 rounded-lg border border-border bg-panel2
                       px-2.5 py-1 text-[11.5px] font-semibold text-ink-dim transition
                       hoverable:border-fire/60 hoverable:text-fire"
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
  onKeepAccount,
  accountExportedAt,
}: {
  variant?: 'desktop' | 'bar';
  onClearData?: () => void;
  onKeepAccount?: () => void;
  accountExportedAt?: number | null;
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
      : `w-9 h-9 rounded-lg ${open ? 'bg-panel2 text-ink' : 'text-ink-dim hoverable:text-ink hoverable:bg-panel2'}`;

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
        <div
          // Ancré à DROITE de son bouton, donc origine en haut à droite : le
          // menu sort de l'engrenage, pas de son propre centre.
          className="absolute z-30 right-0 mt-1.5 w-fit min-w-[260px] rounded-xl border border-border bg-panel px-3 py-2 shadow-glow shadow-black/60
                     origin-top-right animate-[popover_150ms_var(--ease-out)]"
        >
          <div className="label pb-1.5 border-b border-border">
            Réglages
          </div>
          <SettingsList
            onClearData={onClearData}
            onKeepAccount={onKeepAccount}
            accountExportedAt={accountExportedAt}
          />
        </div>
      )}
    </div>
  );
}
