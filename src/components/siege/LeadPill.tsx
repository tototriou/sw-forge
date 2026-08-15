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

export function leadIconUrl(ls: LeaderSkill): string | null {
  if (!ls.stat) return null;
  const attr = ls.stat.replace(/ /g, '_');
  const scoped = SCOPED_ATTRS.has(ls.stat) && SCOPED_AREAS.has(ls.area ?? '');
  return `${ICON_BASE}leader_skill_${attr}${scoped ? `_${ls.area}` : ''}.png`;
}

// Libellés courts des stats de leader skill.
//
// ⚠️ Exporté : la fiche d'un monstre les affiche aussi, et deux tables de
// libellés auraient divergé — « Attack Speed » y serait devenu « Vitesse » d'un
// côté et « VIT » de l'autre pour la même donnée.
export const STAT_LABEL: Record<string, string> = {
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

// Un lead s'applique-t-il en siège ? C'est une question de PORTÉE, pas de stat :
// tout lead global / de guilde / élémentaire profite à l'équipe, quelle que soit
// la stat (un lead PV ou DEF compte autant qu'un lead VIT). Seules les portées
// Arène et Donjon ne concernent pas le contenu de guilde.
// (Le calcul des ticks, lui, ne retient que la vitesse — voir
// ../../spec/shared/calcul-vitesse.md.)
export function leadIsActive(ls: LeaderSkill): boolean {
  return ls.area === 'General' || ls.area === 'Guild' || ls.area === 'Element';
}

// Infobulle commune à la pastille et au badge.
function leadTitle(ls: LeaderSkill): string {
  const stat = STAT_LABEL[ls.stat ?? ''] ?? ls.stat ?? '';
  const scope = ls.area === 'Arena' ? ' (arène)' : ls.area === 'Dungeon' ? ' (donjon)' : '';
  return leadIsActive(ls)
    ? `Lead du leader : +${ls.amount}% ${stat}${
        ls.area === 'Element' ? ` — alliés ${elementLabel(ls.element)} uniquement` : ''
      }`
    : `Lead +${ls.amount}% ${stat}${scope} — sans effet en siège`;
}

// Badge posé SUR le portrait du leader (coin bas-gauche), là où la place manque
// pour la pastille complète (vue compacte). Il remplace la couronne : l'icône du
// jeu marque déjà le leader ET dit quel est son lead. Le montant reste dans
// l'infobulle. Voir ../../spec/siege/equipes.md.
export function LeadBadge({ ls, size = 22 }: { ls: LeaderSkill; size?: number }) {
  const icon = leadIconUrl(ls);
  if (!icon) return null;
  const actif = leadIsActive(ls);
  return (
    <span
      className="absolute -bottom-1.5 -left-1.5 inline-flex items-center"
      title={leadTitle(ls)}
    >
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        aria-hidden
        // Icône NUE, carrée, comme dans le jeu : ni pastille ronde, ni fond, ni
        // anneau — le jeu ne l'encadre pas. Seule l'ombre portée reste, pour
        // qu'elle se détache du portrait.
        className={`flex-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
          actif ? '' : 'opacity-70 grayscale'
        }`}
      />
      {/* Lead ÉLÉMENTAIRE : l'icône du jeu ne dit pas QUEL élément, alors qu'il
          décide qui en profite. Sans elle, un lead eau et un lead feu sont
          indiscernables. */}
      {ls.area === 'Element' && ls.element && (
        <ElementIcon
          element={ls.element}
          size={Math.max(10, Math.round(size * 0.55))}
          className={`-ml-1 flex-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
            actif ? '' : 'opacity-70 grayscale'
          }`}
        />
      )}
    </span>
  );
}

// Pastille de lead du leader (slot 0) : l'icône officielle du jeu (elle encode
// déjà la stat ET la portée) + le montant. L'icône d'élément complète la portée
// élémentaire, que l'icône du jeu ne distingue pas. Mise en avant (doré)
// seulement si le lead compte vraiment en siège ; sinon neutre.
export default function LeadPill({ ls }: { ls: LeaderSkill }) {
  const active = leadIsActive(ls);
  const scope = ls.area === 'Arena' ? ' (arène)' : ls.area === 'Dungeon' ? ' (donjon)' : '';
  const icon = leadIconUrl(ls);

  return (
    <span
      title={leadTitle(ls)}
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[12px] font-bold leading-none
        ${active ? 'bg-star/15 text-star' : 'bg-panel border border-border text-ink-dim'}`}
    >
      {icon && (
        <img
          src={icon}
          alt=""
          width={22}
          height={22}
          className={`flex-none ${active ? '' : 'opacity-60 grayscale'}`}
          aria-hidden
        />
      )}
      +{ls.amount}%
      {ls.area === 'Element' && ls.element && (
        <ElementIcon element={ls.element} size={14} className="flex-none" />
      )}
      {scope}
    </span>
  );
}
