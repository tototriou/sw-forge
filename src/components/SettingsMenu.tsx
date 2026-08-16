import { ReactNode, useEffect, useRef, useState } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { RUNE_METRICS, setRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';
import { setPersistence, storageAvailable, usePersistence } from '../hooks/usePersistence';
import { THEME_CHOICES, setTheme, useTheme } from '../hooks/useTheme';
import { setOvercapDisplay, useOvercapDisplay } from '../hooks/useOvercapDisplay';
import AccountFreshness from './AccountFreshness';
import Segmented from './Segmented';
import Switch from './Switch';

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

/* --------------------------------------------------------------------------
 * Le menu
 * ----------------------------------------------------------------------- */

// Réglages GLOBAUX de l'application : on les pose une fois, ils valent partout.
// Règle (voir spec/README.md) : un réglage qui concerne plusieurs pages vient
// ICI, jamais dupliqué en sélecteur sur chaque page.
//
// ⚠️ **Exportée** : la PAGE de réglages (`#/parametres`) affiche exactement la
// même liste que le popover. Deux copies auraient divergé au premier réglage
// ajouté — et c'est le genre de divergence qu'on ne voit pas, puisqu'on n'ouvre
// jamais les deux à la fois.
export function SettingsList({
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
  const overcap = useOvercapDisplay();
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
        title="Overcap Taux Crit/RES/Précision"
        hint="Ces trois stats sont plafonnées à 100 % dans le jeu. Désactivé, leur TOTAL affiché s'arrête à 100 % même si la somme brute des runes dépasse — la donnée elle-même n'est jamais tronquée, seul l'affichage change."
      >
        <Switch
          checked={overcap}
          onChange={setOvercapDisplay}
          label="Afficher le total au-delà de 100 % pour Taux Crit, RES et Précision"
        />
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
          // ⚠️ `max-w-[calc(100vw-2rem)]` : ancré à droite de son bouton, le
          // popover sortait de l'écran sur un téléphone — les réglages les plus
          // à gauche devenaient inatteignables. `min-w` seul ne borne rien.
          className="absolute z-30 right-0 mt-1.5 w-fit min-w-[260px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-panel px-3 py-2 shadow-glow shadow-black/60
                     origin-top-right animate-[popover_150ms_var(--ease-out)]"
        >
          <div className="flex items-baseline gap-3 border-b border-border pb-1.5">
            <span className="label">Réglages</span>
            {/* ⚠️ Vers la PAGE : ce popover porte sept réglages dont deux à
                explication longue, et 260 px ne suffisent pas à les lire. Il
                reste le geste rapide ; la page est là pour s'y attarder. */}
            <a
              href="#/parametres"
              onClick={() => setOpen(false)}
              className="ml-auto text-[11.5px] text-accent transition hoverable:text-ink"
            >
              Tout voir
            </a>
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
