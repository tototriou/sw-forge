import { useRef } from 'react';
import { GripVertical, X } from 'lucide-react';
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
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
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
  onDragStart,
  onDragEnd,
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

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', String(monster.id));
    e.dataTransfer.effectAllowed = 'move';
    if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 24, 24);
    onDragStart(String(monster.id));
  }

  const toggle = hasGear ? () => onToggleDetail(String(monster.id)) : undefined;

  return (
    <div
      ref={cardRef}
      // ⚠️ Le NOM d'abord, les catégories ensuite. Le nom est masqué sous `sm`
      // (voir plus bas) : sans lui ici, il n'existerait plus nulle part sur
      // téléphone. Il précède les catégories parce que c'est ce qu'on cherche
      // en survolant une carte qu'on ne reconnaît pas.
      title={[monster.name, ...categoryLabels].join(' · ')}
      // ⚠️ `data-carte-dense` : le sélecteur de section reste à 32 px au doigt,
      // au lieu des 40 px de la règle tactile générale. Dans une tuile de
      // 150 px qui porte déjà un portrait, un nom, une vitesse et trois icônes
      // de set, un contrôle de 40 px pesait plus lourd que le monstre qu'il
      // classe. Voir index.css.
      data-carte-dense
      // ⚠️ La bordure SEULE quand le détail est ouvert : elle était doublée d'un
      // `ring-1 ring-accent/50`, soit deux traits d'accent concentriques autour
      // de la même carte. Superposés, ils ne se lisent pas comme deux
      // informations mais comme un contour flou. Voir spec/shared/design.md.
      className={`group relative rounded-lg border bg-panel2 transition-colors ${
        open ? 'border-accent' : 'border-border'
      }`}
    >
      {/* Anneau des catégories, par-dessus la bordure (voir CategoryRing). */}
      <CategoryRing colors={categoryColors} />
      <div className="flex items-center gap-2 p-1.5">
      {/* Poignée de drag : seule zone qui déclenche le glisser-déposer.
          ⚠️ Masquée au DOIGT (`coarse:hidden`) : le glisser-déposer HTML5 n'y
          fonctionne pas, et le sélecteur de section sous le nom fait déjà le
          travail. Elle prenait 14 px de large sur une carte qui en compte 150. */}
      <button
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        className="flex-none cursor-grab active:cursor-grabbing text-ink-dim
                   hoverable:text-ink touch-none coarse:hidden"
        title="Glisser vers une section"
        aria-label="Déplacer"
      >
        <GripVertical size={14} />
      </button>

      {/* ⚠️ **Le PORTRAIT ouvre le détail des runes.** Un chevron « ⌄ » le
          faisait aussi, au bout de la ligne : deux cibles pour un seul geste,
          dont une de 14 px coincée entre les icônes de set. Le portrait est la
          plus grande zone de la carte et celle qu'on vise naturellement — il
          suffit. L'état ouvert se lit au détail déplié juste dessous. */}
      <div
        className={`relative flex-none ${hasGear ? 'cursor-pointer' : ''}`}
        onClick={toggle}
        title={hasGear ? 'Voir le détail des runes' : undefined}
      >
        <div
          className={`hex-frame w-[50px] h-[50px] p-[2px] bg-gradient-to-br compact:w-[42px] compact:h-[42px] ${GRADIENT[monster.element]}`}
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
          // ⚠️ `gap-0.5` sous `sm` : la ligne porte la vitesse, son icône, le
          // badge de désync et jusqu'à trois icônes de set sur 150 px. À
          // `gap-1` partout, la somme des écarts débordait de la carte.
          className={`flex items-center gap-1 compact:gap-0.5 ${hasGear ? 'cursor-pointer' : ''}`}
          onClick={toggle}
          title={hasGear ? 'Voir le détail des runes' : undefined}
        >
          {/* Nom en orange quand les runes ne suivent plus la vitesse demandée :
              on repère les monstres à re-runer sans ouvrir chaque fiche.
              ⚠️ **Masqué sous `sm`.** Sur deux colonnes de 150 px, avec la
              vitesse, le badge de désync et trois icônes de set sur la même
              ligne, il ne restait au nom qu'une quarantaine de pixels — de quoi
              afficher « Sath… », qui ne distingue rien. Le PORTRAIT identifie le
              monstre bien mieux qu'un nom tronqué, et il est déjà là. Le nom
              complet reste dans l'infobulle de la carte.
              La vitesse prend la place : c'est la donnée qu'on vient lire sur
              cet écran — la prépa RTA se règle au point de vitesse.
              ⚠️ La vitesse passe alors à GAUCHE (`flex-1` transféré) : seule sur
              sa ligne, calée à droite, elle flottait loin du portrait qu'elle
              qualifie. */}
          <span
            className={`text-xs font-semibold compact:hidden leading-tight truncate flex-1 ${
              desync && markDesync ? 'text-warn' : ''
            }`}
          >
            {monster.name}
          </span>
          {showSpeed && (
            <>
              <img src={SPD_ICON} alt="SPD" width={15} height={15} className="flex-none" />
              <span
                className={`font-mono text-sm font-black leading-none compact:flex-1 ${
                  desync && markDesync ? 'text-warn' : 'text-ink'
                }`}
              >
                {total !== null ? total : '—'}
              </span>
            </>
          )}
          {desync && <DesyncBadge ecart={desync} size={13} />}
          {/* ⚠️ `pr-3` sous `sm` : la croix de suppression est posée SUR le coin
              haut-droit de la carte, hors du flux — rien ne la repousse. La
              dernière icône de set passait dessous. Le nom masqué sur téléphone
              avait libéré assez de place pour que les trois icônes atteignent le
              bord, ce qu'elles ne faisaient pas quand il les repoussait. */}
          {/* ⚠️ Icônes de set COLLÉES sous `sm` seulement. À trois sets — le
              maximum — les deux écarts suffisaient à faire déborder la dernière
              de la carte, qui n'y fait que 150 px. Elles restent lisibles au
              contact : ce sont des pastilles rondes cerclées, chacune se détache
              de sa voisine sans blanc entre elles.
              Sur bureau la carte est deux fois plus large et l'écart tient sans
              rien coûter — il n'y avait pas lieu de l'y retirer. */}
          <span className="flex flex-none items-center gap-1 compact:gap-0 compact:pr-3">
            {(entry.sets ?? []).slice(0, 3).map((s, i) => (
              <RuneIcon key={i} setKey={s} size={18} className="flex-none" />
            ))}
          </span>
        </div>
        <select
          value={entry.section}
          onChange={(e) => onMove(String(monster.id), e.target.value)}
          title="Déplacer vers une section"
          className="mt-1 w-full bg-panel border border-border rounded px-1.5 py-0.5 text-micro
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
        // ⚠️ `data-cible-fine` : la règle tactile globale (40 px, voir
        // index.css) ne s'applique pas ici. Cette croix est POSÉE SUR le coin
        // de la carte, pas dans un flux : agrandie, elle la déborde et recouvre
        // le portrait. Sa cible reste petite mais isolée — rien d'autre à
        // toucher autour, donc rien à rater.
        data-cible-fine
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
