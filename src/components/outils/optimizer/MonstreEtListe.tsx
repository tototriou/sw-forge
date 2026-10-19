import { type ReactNode } from 'react';
import MonsterSourcePicker from '../MonsterSourcePicker';
import MonsterAvatar from '../../MonsterAvatar';
import { type Monster, type GearSet } from '../../../types';

export interface MonstreEtListeProps {
  allMonsters: Monster[];
  pickSpecies: (monster: Monster) => void;
  selected: { monster: Monster; gear: GearSet; } | null;
  listesBureau: ReactNode;
  zoneCContent: ReactNode;
}

export default function MonstreEtListe({ allMonsters, pickSpecies, selected, listesBureau, zoneCContent }: MonstreEtListeProps) {
  return (
    <div>
      <p className="label mb-1.5">Monstre à optimiser</p>
      {/* ⚠️ Mode BESTIAIRE (voir MonsterSourcePicker.tsx) : résout une
          ESPÈCE (nom, icône, stats de base,
          sorts) dans TOUT le bestiaire — la recherche ne se fait pas
          PAR SOURCE (les 4 puces ne cherchent pas). Choisir
          un résultat pose l'espèce et tente une résolution Box
          silencieuse (`pickSpecies`, jamais en cas d'ambiguïté — voir
          sa définition). */}
      <MonsterSourcePicker mode="bestiary" candidates={allMonsters} onPick={pickSpecies} />
      {/* La sélection garde sa place même vide : l'import ne déplace pas les contrôles de liste. */}
      <div className="mt-3 h-8 flex items-center gap-2">
        {selected && <>
          <MonsterAvatar monster={selected.monster} size={32} />
          <span className="min-w-0 line-clamp-1 font-semibold text-[14px]" title={selected.monster.name}>{selected.monster.name}</span>
        </>}
      </div>
      {/* ⚠️ Aucune liste FIXE (Box/RTA/Défense siège ne sont pas des
          cas spéciaux, voir
          docs/02-app/optimizer/,
          « Créer, valider et réserver dans une liste ») —
          tout est créé/renommé/supprimé par l'utilisateur. Flotte par-
          dessus zone C, ne la pousse jamais (voir OptimizerListPicker.tsx). */}
      <div className="mt-3">
        {listesBureau}
      </div>
      <div className="mt-3">{zoneCContent}</div>
    </div>
  );
}
