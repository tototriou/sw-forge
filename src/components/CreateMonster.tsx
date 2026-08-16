import { useEffect, useRef, useState } from 'react';
import { useRecalageEcran } from '../hooks/useRecalageEcran';
import { COMPACT, useMediaQuery } from '../hooks/useMediaQuery';
import MobileSheet from './MobileSheet';
import { Plus, X, Wand2 } from 'lucide-react';
import { ELEMENTS, ElementKey, Monster } from '../types';
import { CustomLead } from '../hooks/useCustomMonsters';
import ElementIcon from './ElementIcon';
import NumberField from './NumberField';

const ELEMENT_CHOICES = ELEMENTS.filter((e) => e.key !== 'unknown');

// Types de leader skill (valeurs = libellés SWARFARM).
const LEAD_STATS = [
  { value: 'Attack Speed', label: 'Vitesse' },
  { value: 'Attack Power', label: 'Attaque' },
  { value: 'HP', label: 'PV' },
  { value: 'Defense', label: 'Défense' },
  { value: 'Critical Rate', label: 'Taux crit' },
  { value: 'Critical DMG', label: 'Dégâts crit' },
  { value: 'Accuracy', label: 'Précision' },
  { value: 'Resistance', label: 'Résistance' },
];

interface Props {
  onCreate: (name: string, element: ElementKey, speed: number, lead: CustomLead | null) => void;
  customMonsters: Monster[];
  onDelete: (id: string) => void;
}

// Bouton + formulaire pour créer un monstre perso (nom, élément, SPD de base).
export default function CreateMonster({ onCreate, customMonsters, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [element, setElement] = useState<ElementKey>('fire');
  const [speed, setSpeed] = useState('');
  const [leadStat, setLeadStat] = useState('');
  const [lead, setLead] = useState('');
  const [scope, setScope] = useState<'General' | 'Element'>('General');
  const ref = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const auDoigt = useMediaQuery(COMPACT);
  // Le recalage ne concerne que la popup ancrée : le panneau centré est posé
  // par rapport à l'écran, il n'a rien à corriger.
  const { style: recalage } = useRecalageEcran(popover, open && !auDoigt);

  // Ferme la popup au clic à l'extérieur ou sur Échap.
  // ⚠️ Le clic extérieur ne vaut QUE pour la popup ancrée. Le panneau mobile est
  // monté hors de `ref` (il est fixé à l'écran) : tout clic DANS le formulaire
  // aurait donc été vu comme extérieur et l'aurait refermé aussitôt. Le panneau
  // a son propre voile, qui ferme déjà au clic.
  useEffect(() => {
    if (!open || auDoigt) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, auDoigt]);

  const speedNum = Number(speed);
  const valid = name.trim().length > 0 && speed !== '' && Number.isFinite(speedNum) && speedNum > 0;

  function submit() {
    if (!valid) return;
    const leadNum = Number(lead);
    const leadObj: CustomLead | null =
      leadStat !== '' && lead !== '' && Number.isFinite(leadNum) && leadNum > 0
        ? { stat: leadStat, amount: leadNum, area: scope }
        : null;
    // ⚠️ Le nom TRIMÉ : la validation portait déjà sur `name.trim()`, mais on
    // stockait le brut — un monstre pouvait s'appeler « Chloé  », impossible à
    // distinguer de « Chloé » à l'écran et pourtant différent partout ailleurs.
    onCreate(name.trim(), element, speedNum, leadObj);
    setName('');
    setSpeed('');
    setLeadStat('');
    setLead('');
  }

  return (
    <div className="relative" ref={ref}>
      {/* Même gabarit que les autres boutons d'action (RTA & siège) :
          px-3.5 py-2 / 13px, sinon il paraît rabougri à côté d'eux. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Créer un monstre"
        title="Créer un monstre qui n'existe pas dans les données chargées"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-sm
                   text-ink-dim hoverable:text-ink hoverable:border-accent transition"
      >
        {/* ⚠️ Deux longueurs : dans le panneau mobile ce bouton occupe une
            cellule d'un tiers de 348 px, où « Créer un monstre » passe à la
            ligne. `aria-label` et l'infobulle portent la phrase entière. */}
        <Wand2 size={15} />
        <span className="lg:hidden">Monstre</span>
        <span className="hidden lg:inline">Créer un monstre</span>
      </button>

      {/* ⚠️ **Panneau centré au doigt, popup ancrée à la souris.** La popup est
          en `absolute` dans le flux de la page ; posée dans le panneau
          « Options », qui défile (`overflow-y: auto`), elle s'y trouvait
          CLIPPÉE — on n'en voyait qu'une bande. C'est le même remède que pour
          le formulaire de catégorie : un panneau de second niveau, qui recouvre
          celui d'où il sort. */}
      {open && auDoigt && (
        <MobileSheet ouvert centre onFermer={() => setOpen(false)} titre="Nouveau monstre">
          <div className="flex flex-col">

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du monstre"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm text-ink
                       placeholder:text-ink-dim outline-none focus:border-accent mb-2"
          />

          <div className="flex gap-2 mb-2.5">
            <select
              value={element}
              onChange={(e) => setElement(e.target.value as ElementKey)}
              className="flex-1 bg-panel2 border border-border rounded-lg px-2.5 py-2 text-sm text-ink outline-none"
            >
              {ELEMENT_CHOICES.map((el) => (
                <option key={el.key} value={el.key}>
                  {el.label}
                </option>
              ))}
            </select>
            {/* La valeur est stockée en TEXTE ici (champ libre du formulaire) :
                on convertit aux bornes du composant. */}
            <NumberField
              value={speed === '' ? null : Number(speed)}
              allowEmpty
              min={0}
              width="w-16"
              placeholder="SPD"
              ariaLabel="Vitesse de base"
              onChange={(v) => setSpeed(v == null ? '' : String(v))}
            />
          </div>

          {/* Lead (optionnel). Affiché en Siège ; seul un lead de vitesse alimente le tick. */}
          <select
            value={leadStat}
            onChange={(e) => setLeadStat(e.target.value)}
            title="Type de lead (optionnel)"
            className="w-full bg-panel2 border border-border rounded-lg px-2.5 py-2 text-sm text-ink outline-none mb-2.5"
          >
            <option value="">Lead : aucun</option>
            {LEAD_STATS.map((s) => (
              <option key={s.value} value={s.value}>
                Lead {s.label}
              </option>
            ))}
          </select>

          {leadStat !== '' && (
            <div className="flex gap-2 mb-2.5">
              <NumberField
                value={lead === '' ? null : Number(lead)}
                allowEmpty
                min={0}
                max={100}
                width="w-14"
                placeholder="%"
                ariaLabel="Valeur du lead en %"
                onChange={(v) => setLead(v == null ? '' : String(v))}
              />
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'General' | 'Element')}
                title="Portée du lead"
                className="flex-1 bg-panel2 border border-border rounded-lg px-2.5 py-2 text-sm text-ink outline-none"
              >
                <option value="General">Toutes cibles</option>
                <option value="Element">Même élément</option>
              </select>
            </div>
          )}

          <button
            onClick={submit}
            disabled={!valid}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-accent-soft
                       px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Créer
          </button>

          {customMonsters.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border">
              <span className="label">
                Mes monstres perso
              </span>
              <ul className="mt-1.5 flex flex-col gap-1 max-h-40 overflow-y-auto">
                {customMonsters.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-xs">
                    <ElementIcon element={m.element} size={15} className="flex-none" />
                    <span className="truncate flex-1">{m.name}</span>
                    <span className="font-mono text-ink-dim">SPD {m.stats.speed ?? '—'}</span>
                    <button
                      onClick={() => onDelete(String(m.id))}
                      className="text-ink-dim hoverable:text-fire flex-none"
                      title="Supprimer"
                      aria-label="Supprimer"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          </div>
        </MobileSheet>
      )}

      {open && !auDoigt && (
        <div
          ref={popover}
          // ⚠️ Ce panneau de 300 px est ancré à gauche de son bouton, dont la
          // place varie : dernier d'une barre d'outils sur desktop, cellule de
          // grille dans le panneau mobile. Il sortait de l'écran dans le second
          // cas — `max-w` borne la largeur, pas la position. Voir le hook.
          style={recalage}
          // ⚠️ `left-0` explicite : le recalage s'exprime en `left`, qui n'a de
          // sens que si l'ancrage horizontal est posé. Sans lui (`left: auto`),
          // une valeur négative ne décale pas — elle repositionne depuis un bord
          // que le navigateur choisit seul.
          className="absolute left-0 z-30 mt-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-panel p-3 shadow-glow shadow-black/60
                     origin-top-left animate-[popover_150ms_var(--ease-out)]"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="label">
              Nouveau monstre
            </span>
            <button onClick={() => setOpen(false)} className="text-ink-dim hoverable:text-ink" aria-label="Fermer">
              <X size={14} />
            </button>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du monstre"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm text-ink
                       placeholder:text-ink-dim outline-none focus:border-accent mb-2"
          />

          <div className="flex gap-2 mb-2.5">
            <select
              value={element}
              onChange={(e) => setElement(e.target.value as ElementKey)}
              className="flex-1 bg-panel2 border border-border rounded-lg px-2.5 py-2 text-sm text-ink outline-none"
            >
              {ELEMENT_CHOICES.map((el) => (
                <option key={el.key} value={el.key}>
                  {el.label}
                </option>
              ))}
            </select>
            {/* La valeur est stockée en TEXTE ici (champ libre du formulaire) :
                on convertit aux bornes du composant. */}
            <NumberField
              value={speed === '' ? null : Number(speed)}
              allowEmpty
              min={0}
              width="w-16"
              placeholder="SPD"
              ariaLabel="Vitesse de base"
              onChange={(v) => setSpeed(v == null ? '' : String(v))}
            />
          </div>

          {/* Lead (optionnel). Affiché en Siège ; seul un lead de vitesse alimente le tick. */}
          <select
            value={leadStat}
            onChange={(e) => setLeadStat(e.target.value)}
            title="Type de lead (optionnel)"
            className="w-full bg-panel2 border border-border rounded-lg px-2.5 py-2 text-sm text-ink outline-none mb-2.5"
          >
            <option value="">Lead : aucun</option>
            {LEAD_STATS.map((s) => (
              <option key={s.value} value={s.value}>
                Lead {s.label}
              </option>
            ))}
          </select>

          {leadStat !== '' && (
            <div className="flex gap-2 mb-2.5">
              <NumberField
                value={lead === '' ? null : Number(lead)}
                allowEmpty
                min={0}
                max={100}
                width="w-14"
                placeholder="%"
                ariaLabel="Valeur du lead en %"
                onChange={(v) => setLead(v == null ? '' : String(v))}
              />
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'General' | 'Element')}
                title="Portée du lead"
                className="flex-1 bg-panel2 border border-border rounded-lg px-2.5 py-2 text-sm text-ink outline-none"
              >
                <option value="General">Toutes cibles</option>
                <option value="Element">Même élément</option>
              </select>
            </div>
          )}

          <button
            onClick={submit}
            disabled={!valid}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-accent-soft
                       px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Créer
          </button>

          {customMonsters.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border">
              <span className="label">
                Mes monstres perso
              </span>
              <ul className="mt-1.5 flex flex-col gap-1 max-h-40 overflow-y-auto">
                {customMonsters.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-xs">
                    <ElementIcon element={m.element} size={15} className="flex-none" />
                    <span className="truncate flex-1">{m.name}</span>
                    <span className="font-mono text-ink-dim">SPD {m.stats.speed ?? '—'}</span>
                    <button
                      onClick={() => onDelete(String(m.id))}
                      className="text-ink-dim hoverable:text-fire flex-none"
                      title="Supprimer"
                      aria-label="Supprimer"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
