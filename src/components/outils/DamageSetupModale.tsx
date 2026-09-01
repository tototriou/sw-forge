import { ComponentProps } from 'react';
import { Modale } from '../../ui/Dialogs';
import DamageSetupCard from './DamageSetupCard';

// La description du combat — sort visé, adversaire, coup critique, effets —
// ouverte PAR-DESSUS l'écran d'optimisation.
//
// ⚠️ **Une modale, pas un bloc sous l'objectif.** Ces réglages vivaient dans la
// carte « Objectif de recherche », révélés par le cran « Dégâts réels » : la
// carte devait alors réserver assez de place pour eux (voir son commentaire
// d'origine, « Objectif profite de tout l'espace restant »), ce qui figeait la
// colonne 2 autour d'un contenu affiché un quart du temps. Hors du flux, ils ne
// coûtent plus rien aux trois autres objectifs — et ils deviennent atteignables
// depuis DEUX portes (l'objectif de recherche, et le choix des meilleurs
// artéfacts) sans être écrits deux fois. Même patron que
// `SpeedTuneModale.tsx` : deux vues d'un seul état.
//
// ⚠️ **Ce n'est PAS « l'outil entier dans une modale ».** L'analogie avec
// `SpeedTuneModale` s'arrête au partage d'état : là-bas la modale porte tout
// l'outil de speed tuning parce qu'il existe AUSSI comme page à part entière.
// Ici il n'y a pas d'autre page — on sort une carte de son flux, rien de plus.
export default function DamageSetupModale({
  onClose,
  ...card
}: { onClose: () => void } & ComponentProps<typeof DamageSetupCard>) {
  return (
    <Modale
      onClose={onClose}
      labelledBy="damage-setup-modale"
      titre="Dégâts réels"
      sousTitre="Décris le coup à évaluer : le sort, l'adversaire, et comment traiter le critique."
      croix
      // ⚠️ Les 400 px du défaut réduiraient la grille d'effets à une colonne :
      // « Effets actifs » aligne une douzaine de vignettes, et « Adversaire »
      // trois champs numériques côte à côte. On prend la largeur disponible en
      // gardant la marge du voile, comme SpeedTuneModale.
      largeur="max-w-[min(1100px,95vw)]"
      padding="p-4"
      // La modale porte une CARTE de réglages, pas un message : chaque pixel de
      // bande est une vignette d'effet en moins à l'écran.
      bandes="compactes"
      // ⚠️ **Aucun pied.** On ne valide rien — chaque réglage s'applique au
      // moment où on le touche, comme quand la carte était dans le flux. Un
      // bouton « Fermer » ferait doublon avec la croix et laisserait croire à
      // une validation qui n'existe pas. Même convention que les autres modales
      // de consultation de l'app.
    >
      {/* ⚠️ `etroit` reste tel que l'appelant le passe : il décrit le FORMAT de
          l'appareil (téléphone), pas la largeur du conteneur. Le forcer à
          `false` ici casserait la disposition au doigt, où la modale est tout
          aussi étroite que la carte l'était. */}
      <DamageSetupCard {...card} />
    </Modale>
  );
}
