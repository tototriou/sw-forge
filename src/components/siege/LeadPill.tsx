import { ELEMENTS, ElementKey, LeaderSkill } from '../../types';
import ElementIcon from '../ElementIcon';

// Icônes officielles des leader skills (SWARFARM), servies en local depuis
// public/leader-skills/. Voir ../../spec/shared/donnees-monstres.md.
const ICON_BASE = `${import.meta.env.BASE_URL}leader-skills/`;

// Attributs pour lesquels SWARFARM fournit une icône déclinée par portée.
// Les autres cas (Critical DMG, portée Element/General) n'ont que l'icône de
// base : c'est le jeu qui est comme ça, on ne fabrique rien de custom.
const SCOPED_ATTRS = new Set([
  'Accuracy',
  'Attack Power',
  'Attack Speed',
  'Critical Rate',
  'Defense',
  'HP',
  'Resistance',
]);
const SCOPED_AREAS = new Set(['Arena', 'Dungeon', 'Guild']);

function leadIconUrl(ls: LeaderSkill): string | null {
  if (!ls.stat) return null;
  const attr = ls.stat.replace(/ /g, '_');
  const scoped = SCOPED_ATTRS.has(ls.stat) && SCOPED_AREAS.has(ls.area ?? '');
  return `${ICON_BASE}leader_skill_${attr}${scoped ? `_${ls.area}` : ''}.png`;
}

// Libellés courts des stats de leader skill (infobulle uniquement).
const STAT_LABEL: Record<string, string> = {
  'Attack Speed': 'VIT',
  'Attack Power': 'ATQ',
  HP: 'PV',
  Defense: 'DEF',
  'Critical Rate': 'Taux crit',
  'Critical DMG': 'DMG crit',
  Accuracy: 'Précision',
  Resistance: 'Résistance',
};

function elementLabel(el: ElementKey | null): string {
  return ELEMENTS.find((e) => e.key === el)?.label ?? '—';
}

// Un lead est-il EFFECTIF en siège ? Seule la vitesse alimente les ticks, et les
// portées Arène/Donjon ne s'appliquent pas au contenu de guilde.
// Voir ../../spec/shared/calcul-vitesse.md.
export function leadIsActive(ls: LeaderSkill): boolean {
  return (
    ls.stat === 'Attack Speed' &&
    (ls.area === 'General' || ls.area === 'Guild' || ls.area === 'Element')
  );
}

// Pastille de lead du leader (slot 0) : l'icône officielle du jeu (elle encode
// déjà la stat ET la portée) + le montant. L'icône d'élément complète la portée
// élémentaire, que l'icône du jeu ne distingue pas. Mise en avant (doré)
// seulement si le lead compte vraiment en siège ; sinon neutre.
export default function LeadPill({ ls }: { ls: LeaderSkill }) {
  const active = leadIsActive(ls);
  const stat = STAT_LABEL[ls.stat ?? ''] ?? ls.stat ?? '';
  const scope = ls.area === 'Arena' ? ' (arène)' : ls.area === 'Dungeon' ? ' (donjon)' : '';
  const icon = leadIconUrl(ls);

  return (
    <span
      title={
        active
          ? `Lead du leader : +${ls.amount}% ${stat}${
              ls.area === 'Element' ? ` — alliés ${elementLabel(ls.element)} uniquement` : ''
            }`
          : `Lead +${ls.amount}% ${stat}${scope} — sans effet en siège`
      }
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] font-semibold
        ${active ? 'bg-star/15 text-star' : 'bg-panel border border-border text-ink-dim'}`}
    >
      {icon && (
        <img
          src={icon}
          alt=""
          width={16}
          height={16}
          className={`flex-none ${active ? '' : 'opacity-60 grayscale'}`}
          aria-hidden
        />
      )}
      +{ls.amount}%
      {ls.area === 'Element' && ls.element && (
        <ElementIcon element={ls.element} size={13} className="flex-none" />
      )}
      {scope}
    </span>
  );
}
