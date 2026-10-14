import RuneIcon from './RuneIcon';
import { useMediaQuery, COMPACT } from '../hooks/useMediaQuery';

interface Props {
  sets: readonly string[];
  /** Taille d'une icône, en px. */
  taille: number;
  /** Classe d'espacement entre les icônes (`gap-0`, `gap-0.5`, `gap-1`…). */
  espacement: string;
  /** Classe d'affichage : `flex` par défaut ; `inline-flex`, `hidden lg:inline-flex`… */
  affichage?: string;
  /** Marges, cadre, `flex-none`… : tout ce qui n'est ni l'affichage ni l'espacement. */
  className?: string;
  /** Nombre d'icônes affichées au plus ; toutes si absent. */
  max?: number;
  /** Règle des trois sets serrés (voir plus bas) : `'au-doigt'` l'applique au doigt seulement,
   *  `'toujours'` quel que soit le pointeur ; absent, jamais. */
  troisSetsSerres?: 'au-doigt' | 'toujours';
  /** Sans set, rendre l'enveloppe vide quand même : sa marge compte dans la carte. */
  garderVide?: boolean;
  title?: string;
}

// Trois sets passent à 10 px, collés : la place d'une ligne étroite (vignette
// de siège, pastille des sets visés) est comptée pour deux sets, et le
// troisième la faisait déborder. La vignette de siège ne serre qu'au doigt
// (`'au-doigt'`) ; la pastille des sets visés, qui n'existe que sous `lg`,
// serre toujours (`'toujours'`), y compris à la souris sur une fenêtre étroite.
// 10 px et non 11 : à 11, la vignette de siège demande encore 58 px pour 55.
const TAILLE_TROIS_SETS = 10;

// Les sets portés par un monstre, en rangée d'icônes. Chaque écran règle
// taille, espacement et marge ; rien d'autre ne varie d'un endroit à l'autre.
export default function SetsPortes({
  sets,
  taille,
  espacement,
  affichage = 'flex',
  className = '',
  max,
  troisSetsSerres,
  garderVide = false,
  title,
}: Props) {
  const auDoigt = useMediaQuery(COMPACT);
  const affiches = max === undefined ? sets : sets.slice(0, max);
  if (affiches.length === 0 && !garderVide) return null;
  const regleActive = troisSetsSerres === 'toujours' || (troisSetsSerres === 'au-doigt' && auDoigt);
  const serre = regleActive && affiches.length === 3;
  return (
    <span className={`${affichage} items-center ${serre ? 'gap-0' : espacement} ${className}`} title={title}>
      {affiches.map((s, i) => (
        <RuneIcon key={i} setKey={s} size={serre ? TAILLE_TROIS_SETS : taille} className="flex-none" />
      ))}
    </span>
  );
}
