import { useId } from 'react';
import { Modale, ZoneCliquable } from '../../../ui';
import MonsterAvatar from '../../MonsterAvatar';
import { useTraduction } from '../../../hooks/useLangue';
import type { SourceImportEquipe } from '../../../lib/sourcesEquipesEnregistrees';

interface Props {
  sources: SourceImportEquipe[];
  onChoisir: (source: SourceImportEquipe) => void;
  onFermer: () => void;
}

// Les sources d'import, avec la grammaire de l'import de l'Optimizer : un
// en-tête par section, les monstres puis le libellé, une source vide
// désactivée avec sa raison. Le rembourrage par défaut garde l'air du titre ;
// la liste en sort par des marges négatives pour que ses bandes touchent les bords.
export default function ImportEquipeModale({ sources, onChoisir, onFermer }: Props) {
  const im = useTraduction().equipes.imports;
  const id = useId();
  return (
    <Modale onClose={onFermer} labelledBy={id} titre={im.titre} croix largeur="max-w-[480px]">
      <div className="-mx-5 -mb-5 max-h-[60dvh] overflow-y-auto">
        {sources.map((s, n) => (
          <div key={s.cle}>
            {(n === 0 || sources[n - 1].groupe !== s.groupe) && (
              <div className="border-y border-border-soft bg-panel2 px-4 py-1.5 text-micro font-semibold uppercase tracking-wider text-ink-dimmer">
                {s.groupe}
              </div>
            )}
            <ZoneCliquable disabled={s.raison !== null} title={s.raison ?? undefined} aria-label={s.libelle}
              onClick={() => onChoisir(s)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-ink hoverable:bg-accent-soft disabled:text-ink-dimmer">
              {s.monstres.length > 0 && (
                <span className="flex flex-none items-center gap-1">
                  {s.monstres.slice(0, 6).map((m, k) => <MonsterAvatar key={k} monster={m} size={28} element={false} />)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{s.libelle}</span>
              {s.raison && <span className="flex-none text-xs text-ink-dimmer">{s.raison}</span>}
            </ZoneCliquable>
          </div>
        ))}
      </div>
    </Modale>
  );
}
