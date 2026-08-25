import { Monster, SiegeTeam } from '../../types';
import { DeckInitial } from '../../hooks/useSpeedTune';
import { Bouton } from '../../ui';
import { Modale } from '../../ui/Dialogs';
import SpeedTuningSection, { REGLE_TICKS } from './SpeedTuningSection';

interface Props {
  deck: DeckInitial;
  allMonsters: Monster[];
  siegeDefenseTeams: SiegeTeam[];
  siegeOffenseTeams: SiegeTeam[];
  onClose: () => void;
}

// L'outil de speed tuning ouvert PAR-DESSUS le deck d'où l'on vient.
//
// ⚠️ **Une modale, pas un changement de page.** « Voir le speed tune » envoyait
// sur `#/outils/speed-tuning` : il fallait alors déposer l'équipe dans
// `sessionStorage`, la reprendre à l'arrivée, retenir d'où l'on venait et
// ajouter un bouton « retour » — quatre mécanismes pour revenir à un écran qu'on
// n'avait aucune raison de quitter. Ici la page du siège reste là, dessous, avec
// son défilement et ses équipes dépliées : fermer suffit à retrouver sa place.
//
// ⚠️ **Le même composant que la page**, pas une version réduite : c'est tout
// l'outil, avec les mêmes réglages persistants — ce qu'on y change se retrouve
// dans la page d'outil, et l'inverse. Deux vues d'un seul état.
export default function SpeedTuneModale({
  deck,
  allMonsters,
  siegeDefenseTeams,
  siegeOffenseTeams,
  onClose,
}: Props) {
  return (
    <Modale
      onClose={onClose}
      labelledBy="speed-tune-modale"
      titre="Speed tuning"
      sousTitre={REGLE_TICKS}
      croix
      // ⚠️ Un tableau de ticks est LARGE (11 colonnes et autant de monstres) :
      // les 400 px du défaut le réduiraient à une bande à faire défiler des deux
      // côtés. On prend l'écran, en gardant la marge du voile.
      largeur="max-w-[min(1400px,95vw)]"
      padding="p-4"
      // ⚠️ **La modale contient un OUTIL entier**, pas un message : chaque pixel
      // pris par les deux bandes est une ligne de tableau en moins sur les
      // 90 % de hauteur d écran. Les bandes se serrent, le corps garde son air.
      bandes="compactes"
      actions={<Bouton onClick={onClose} libelle="Fermer" />}
    >
      <SpeedTuningSection
        allMonsters={allMonsters}
        siegeDefenseTeams={siegeDefenseTeams}
        siegeOffenseTeams={siegeOffenseTeams}
        deckInitial={deck}
        entete={false}
      />
    </Modale>
  );
}
