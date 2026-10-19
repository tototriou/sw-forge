import { type SearchResult } from '../../../lib/runeBuildOptim';

export interface AvisRechercheTronqueeProps {
  result: SearchResult;
  stoppedManually: boolean;
}

export default function AvisRechercheTronquee({ result, stoppedManually }: AvisRechercheTronqueeProps) {
  return (
    <p className="mb-2 text-micro text-warn">
      {stoppedManually
        ? `Recherche arrêtée après examen de ${result.explored.toLocaleString('fr-FR')} combinaisons — voici le meilleur trouvé jusque-là.`
        : `Recherche interrompue après examen de ${result.explored.toLocaleString('fr-FR')} combinaisons — resserre tes critères pour un résultat exhaustif.`}
    </p>
  );
}
