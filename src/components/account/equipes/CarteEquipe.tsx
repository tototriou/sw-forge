import type { Monster } from '../../../types';
import { Menu, ZoneCliquable, type ElementMenu } from '../../../ui';
import MonsterAvatar from '../../MonsterAvatar';
import { useTraduction } from '../../../hooks/useLangue';
import type { EquipeEnregistree, ResumeEcarts } from '../../../lib/equipesEnregistrees';

interface Props {
  equipe: EquipeEnregistree;
  monstreDe: (com2usId: number) => Monster | undefined;
  // `null` sans compte : aucune comparaison n'est affichée.
  ecarts: ResumeEcarts | null;
  speedTuneIncomplet: boolean;
  actions: ElementMenu[];
  onOuvrir: () => void;
}

// Une carte de « Mes équipes » : le nom, les monstres dans l'ordre (le leader
// couronné), la note sur une ligne, l'écart au compte et le menu d'actions.
// Même contenu aux deux formats ; seule la taille des avatars change.
export default function CarteEquipe({ equipe, monstreDe, ecarts, speedTuneIncomplet, actions, onOuvrir }: Props) {
  const c = useTraduction().equipes.carte;
  const signaux = [
    ecarts && ecarts.modifiees > 0 ? c.modifiees(ecarts.modifiees) : null,
    ecarts && ecarts.disparues > 0 ? c.disparues(ecarts.disparues) : null,
    speedTuneIncomplet ? c.speedTuneIncomplet : null,
  ].filter((x): x is string => x !== null);
  return (
    <article className="relative flex min-w-0 flex-col rounded-lg border border-border bg-panel" aria-label={equipe.nom}>
      <ZoneCliquable onClick={onOuvrir} aria-label={`${c.ouvrir} ${equipe.nom}`}
        className="flex min-w-0 flex-1 flex-col gap-2 p-3 pr-11 text-left hoverable:bg-panel2">
        <span className="truncate text-sm font-semibold text-ink">{equipe.nom}</span>
        <span className="flex min-h-[40px] flex-wrap items-center gap-1.5">
          {equipe.monstres.map((m) => {
            const monstre = monstreDe(m.com2usId) ?? null;
            return (
              <MonsterAvatar key={m.uid} monster={monstre} fallback={String(m.com2usId)} size={40}
                couronne={equipe.leader === m.uid} titre={equipe.leader === m.uid ? `${monstre?.name ?? m.com2usId} · ${c.leader}` : monstre?.name ?? null} />
            );
          })}
        </span>
        {equipe.note && <span className="truncate text-xs text-ink-dim">{equipe.note}</span>}
        {signaux.length > 0 && <span className="text-xs text-warn">{signaux.join(' · ')}</span>}
      </ZoneCliquable>
      <div className="absolute right-1.5 top-1.5">
        <Menu libelle={c.actions} elements={actions} />
      </div>
    </article>
  );
}
