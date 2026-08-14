import { useRef } from 'react';
import { GripVertical, X, ChevronDown } from 'lucide-react';
import { Monster, RtaEntry, sectionLabel } from '../../types';
import ElementIcon from '../ElementIcon';
import RuneIcon from '../RuneIcon';
import CategoryRing from './CategoryRing';
import DesyncBadge from './DesyncBadge';

const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`;

const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};
const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

interface Props {
  monster: Monster;
  entry: RtaEntry;
  sectionKeys: string[]; // destinations possibles (Non classé + sections runes)
  open: boolean; // le détail de CETTE carte est ouvert (panneau rendu par la grille)
  onToggleDetail: (id: string) => void;
  onMove: (id: string, section: string) => void;
  onRemove: (id: string) => void;
  // Saisie par APPUI LONG sur la carte entière, ou immédiate sur la poignée ≡
  // (voir useDragLong). Remplace le drag HTML5, qui n'existait pas au doigt.
  onPointerDownDrag: (id: string, e: React.PointerEvent, immediat?: boolean) => void;
  dragging: boolean; // cette carte est celle qu'on déplace
  categoryColors?: string[]; // anneau des catégories du monstre (0 à 4)
  categoryLabels?: string[]; // pour l'infobulle
  // Vitesse saisie ≠ vitesse des runes importées → triangle d'alerte.
  desync?: { attendu: number; saisi: number } | null;
  showSpeed?: boolean; // afficher la vitesse sur la carte (voir la barre de catégories)
  markDesync?: boolean; // écrire le nom en orange quand les runes ne suivent plus
}

export default function RtaCard({
  monster,
  entry,
  sectionKeys,
  open,
  onToggleDetail,
  onMove,
  onRemove,
  onPointerDownDrag,
  dragging,
  categoryColors = [],
  categoryLabels = [],
  desync = null,
  showSpeed = true,
  markDesync = true,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const base = monster.stats.speed;
  const rune = entry.runeSpeed;
  const total = base !== null || rune !== null ? (base ?? 0) + (rune ?? 0) : null;
  const hasGear = !!entry.gear && entry.gear.runes.length > 0;

  // Appui long n'importe où sur la carte.
  //
  // ⚠️ Sauf sur les VRAIS contrôles : la croix de retrait et le sélecteur de
  // section. Maintenir le doigt dessus doit les actionner, pas saisir la carte
  // — un `select` ouvert qui se met à suivre le pointeur est incompréhensible.
  // Le portrait et le nom, eux, restent saisissables : leur clic (ouvrir le
  // détail) se déclenche au relâchement, donc les deux gestes cohabitent.
  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button, select')) return;
    onPointerDownDrag(String(monster.id), e);
  }

  const toggle = hasGear ? () => onToggleDetail(String(monster.id)) : undefined;

  return (
    <div
      ref={cardRef}
      title={categoryLabels.length > 0 ? categoryLabels.join(' · ') : undefined}
      onPointerDown={handlePointerDown}
      // ⚠️ Menu contextuel bloqué sur la zone saisissable. Sur mobile, l'appui
      // long ouvre « Copier / Rechercher » PENDANT les 400 ms d'attente —
      // `select-none` ne l'en empêche pas, et le conditionner à une saisie déjà
      // active serait trop tard. Les contrôles gardent le leur : un clic droit
      // sur le sélecteur de section reste utile.
      onContextMenu={(e) => {
        if (!(e.target as HTMLElement).closest('button, select')) e.preventDefault();
      }}
      // ⚠️ `touch-none` : sans lui, le navigateur s'approprie le geste pour
      // faire défiler la page avant que `pointermove` puisse l'en empêcher, et
      // la carte reste collée au doigt sans jamais suivre.
      // ⚠️ `select-none` : maintenir le doigt ou le bouton, c'est AUSSI le geste
      // qui sélectionne du texte. Sans lui, l'appui long surlignait le nom du
      // monstre en bleu au lieu de saisir la carte — et au tactile, il ouvrait
      // la bulle « Copier / Rechercher ». Rien ici n'est à sélectionner : la
      // carte est un objet qu'on déplace, pas du texte qu'on lit.
      // La carte saisie s'efface (elle est doublée par la carte fantôme) et
      // reste EN PLACE : la retirer du flux ferait s'effondrer la grille sous
      // le doigt, et on perdrait de vue l'endroit d'où l'on part.
      // ⚠️ La bordure SEULE quand le détail est ouvert. Elle était doublée d'un
      // `ring-1 ring-accent/50` : deux traits d'accent concentriques autour de
      // la même carte, en permanence. Superposés, ils ne se lisent pas comme
      // deux informations mais comme un contour flou et sale.
      // Voir spec/shared/design.md.
      className={`group relative rounded-lg border bg-panel2 touch-none select-none transition-colors ${
        open ? 'border-accent' : 'border-border'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      {/* Anneau des catégories, par-dessus la bordure (voir CategoryRing). */}
      <CategoryRing colors={categoryColors} />
      <div className="flex items-center gap-2 p-1.5">
      {/* Poignée : saisie IMMÉDIATE, sans attendre l'appui long.
          ⚠️ Elle reste alors que toute la carte est saisissable — c'est le seul
          repère visuel qui annonce qu'une carte se déplace. Sans elle, il
          faudrait découvrir le geste en maintenant le doigt au hasard. Elle ne
          sert qu'à ça, donc aucun clic à préserver : pas de délai. */}
      <button
        onPointerDown={(e) => onPointerDownDrag(String(monster.id), e, true)}
        className="flex-none cursor-grab active:cursor-grabbing text-ink-dim hoverable:text-ink touch-none"
        title="Glisser vers une section (ou appui long sur la carte)"
        aria-label="Déplacer"
      >
        <GripVertical size={14} />
      </button>

      <div className={`relative flex-none ${hasGear ? 'cursor-pointer' : ''}`} onClick={toggle}>
        <div
          className={`hex-frame w-[50px] h-[50px] p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
        >
          <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
            {monster.image ? (
              <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" />
            ) : (
              <span className={`font-display font-bold text-sm ${TEXT[monster.element]}`}>
                {initials(monster.name)}
              </span>
            )}
          </div>
        </div>
        <ElementIcon
          element={monster.element}
          size={16}
          className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={`flex items-center gap-1 ${hasGear ? 'cursor-pointer' : ''}`}
          onClick={toggle}
          title={hasGear ? 'Voir le détail des runes' : undefined}
        >
          {/* Nom en orange quand les runes ne suivent plus la vitesse demandée :
              on repère les monstres à re-runer sans ouvrir chaque fiche. */}
          <span
            className={`text-[12px] font-semibold leading-tight truncate flex-1 ${
              desync && markDesync ? 'text-warn' : ''
            }`}
          >
            {monster.name}
          </span>
          {showSpeed && (
            <>
              <img src={SPD_ICON} alt="SPD" width={15} height={15} className="flex-none" />
              <span
                className={`font-mono text-[14px] font-black leading-none ${
                  desync && markDesync ? 'text-warn' : 'text-ink'
                }`}
              >
                {total !== null ? total : '—'}
              </span>
            </>
          )}
          {desync && <DesyncBadge ecart={desync} size={13} />}
          {(entry.sets ?? []).slice(0, 3).map((s, i) => (
            <RuneIcon key={i} setKey={s} size={18} className="flex-none" />
          ))}
          {hasGear && (
            <ChevronDown
              size={14}
              className={`flex-none text-ink-dim transition-transform ${open ? 'rotate-180' : ''}`}
            />
          )}
        </div>
        <select
          value={entry.section}
          onChange={(e) => onMove(String(monster.id), e.target.value)}
          title="Déplacer vers une section"
          className="mt-1 w-full bg-panel border border-border rounded px-1.5 py-0.5 text-[10px]
                     text-ink-dim outline-none focus:border-accent"
        >
          {sectionKeys.map((k) => (
            <option key={k} value={k}>
              {sectionLabel(k)}
            </option>
          ))}
        </select>
      </div>

      {/* ⚠️ JAMAIS `hidden group-hover:flex` : l'élément sortait du flux, donc
          il n'était ni focusable au clavier, ni atteignable au doigt — on ne
          pouvait pas retirer un monstre sur téléphone. On joue sur l'opacité
          (l'élément reste dans le DOM) et on le laisse visible là où il n'y a
          pas de survol. Voir spec/shared/design.md. */}
      <button
        onClick={() => onRemove(String(monster.id))}
        className="absolute -top-1.5 -right-1.5 flex items-center justify-center
                   w-5 h-5 rounded-full bg-fire text-white shadow
                   opacity-0 no-hover:opacity-100 group-hoverable:opacity-100
                   focus-visible:opacity-100 transition-opacity duration-150 ease-out"
        title="Retirer"
        aria-label={`Retirer ${monster.name}`}
      >
        <X size={12} />
      </button>
      </div>
    </div>
  );
}
