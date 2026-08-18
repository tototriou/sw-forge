import { AnimatePresence } from 'framer-motion';
import { ElementDef, Monster } from '../types';
import MonsterCard from './MonsterCard';
import ElementIcon from './ElementIcon';
import { jumeauDeCollab } from '../lib/monsterForms';

interface Props {
  elementDef: ElementDef;
  monsters: Monster[];
  /** Ouvre la fiche complète d'un monstre. */
  onOpen?: (m: Monster) => void;
  /**
   * Liste COMPLÈTE, pour retrouver le jumeau de collaboration d'un monstre
   * (Satoru Gojo ↔ Werner). ⚠️ Pas `monsters` : ce bloc ne porte qu'un élément,
   * alors qu'une paire peut être coupée par la pagination ou un filtre.
   */
  allMonsters?: Monster[];
  /**
   * Animer l'entrée et la disposition des cartes. ⚠️ Décidé par le PARENT sur le
   * total de la PAGE, pas par ce bloc : une page de 60 cartes réparties en cinq
   * éléments ferait cinq petits blocs sous le seuil, chacun animé — et les
   * soixante FLIP simultanés saccaderaient quand même. Voir
   * `SEUIL_ANIMATION_GRILLE` (MonsterCard).
   */
  anime?: boolean;
}

export default function MonsterGrid({
  elementDef,
  monsters,
  onOpen,
  allMonsters,
  anime = true,
}: Props) {
  if (monsters.length === 0) return null;

  const cartes = monsters.map((m) => (
    <MonsterCard
      key={m.id}
      monster={m}
      jumeau={allMonsters ? jumeauDeCollab(m, allMonsters) : null}
      onOpen={onOpen}
      anime={anime}
    />
  ));

  return (
    <section className="mt-9">
      <div className="flex items-center gap-3 pb-2.5 mb-4 border-b border-border">
        <ElementIcon element={elementDef.key} size={22} />
        <h2 className="font-display text-lg tracking-wide">{elementDef.label}</h2>
        <span className="font-mono text-ink-dim text-xs ml-auto">
          {monsters.length} monstre{monsters.length > 1 ? 's' : ''}
        </span>
      </div>
      {/* ⚠️ Gabarit repris de la BOX du compte : colonnes de 104 px, écart
          resserré. C'est la grille la plus dense des deux, et c'est la bonne
          référence — on parcourt des centaines de monstres. */}
      {/* ⚠️ `AnimatePresence` SEULEMENT quand on anime : au-dessus du seuil, les
          cartes sont des `<div>` ordinaires, et les envelopper d'`AnimatePresence`
          ne servirait qu'à retenir dans le DOM les cartes qui disparaissent. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,104px),1fr))] gap-2 items-start">
        {anime ? <AnimatePresence mode="popLayout">{cartes}</AnimatePresence> : cartes}
      </div>
    </section>
  );
}
