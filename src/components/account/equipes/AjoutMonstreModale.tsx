import { useId, useMemo, useState } from 'react';
import type { Monster } from '../../../types';
import { Bouton, Modale, Option, PiedDeDialogue } from '../../../ui';
import MonsterAvatar from '../../MonsterAvatar';
import MonsterPicker from '../../MonsterPicker';
import { useTraduction } from '../../../hooks/useLangue';
import { sourcesEquipementEspece, type ContexteSourcesEquipes, type SourceEquipement } from '../../../lib/sourcesEquipesEnregistrees';

interface Props {
  monstres: Monster[];
  ctx: ContexteSourcesEquipes;
  onChoisir: (com2usId: number, source: SourceEquipement) => void;
  onFermer: () => void;
}

// « Ajouter un monstre » : l'espèce, puis l'équipement à copier parmi ce que
// l'app connaît d'elle, chaque choix nommé par sa provenance.
export default function AjoutMonstreModale({ monstres, ctx, onChoisir, onFermer }: Props) {
  const t = useTraduction();
  const a = t.equipes.ajout;
  const id = useId();
  const [espece, setEspece] = useState<Monster | null>(null);
  const candidats = useMemo(() => monstres.filter((m) => m.com2usId != null), [monstres]);
  const sources = espece?.com2usId != null ? sourcesEquipementEspece(espece.com2usId, ctx, t) : [];
  return (
    <Modale onClose={onFermer} labelledBy={id} titre={a.titre} croix largeur="max-w-[480px]"
      actions={espece ? <PiedDeDialogue><Bouton libelle={a.changer} onClick={() => setEspece(null)} /></PiedDeDialogue> : undefined}>
      {!espece ? (
        <MonsterPicker monsters={candidats} placeholder={a.chercher} ariaLabel={a.chercher} jetonFocus={0}
          onPick={(mid) => setEspece(candidats.find((m) => String(m.id) === mid) ?? null)} />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <MonsterAvatar monster={espece} size={36} />
            <p className="text-sm font-semibold text-ink">{espece.name}</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-dimmer">{a.equipement}</p>
          {sources.map((s, i) => (
            <Option key={s.cle} autoFocus={i === 0} titre={s.libelle} onClick={() => onChoisir(espece.com2usId as number, s)} />
          ))}
        </div>
      )}
    </Modale>
  );
}
