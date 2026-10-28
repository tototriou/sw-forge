import { type BilanRecherche } from '../../../hooks/useBuildOptimSearch';
import type { ArretMemoire } from '../../../lib/classementCompact';

export interface AvisRechercheTronqueeProps {
  result: BilanRecherche | null;
  stoppedManually: boolean;
  /** L'arrêt sur la mémoire du classeur : il prime sur les autres motifs, la cause n'est ni le temps ni l'utilisateur. */
  arretMemoire?: ArretMemoire | null;
}

export default function AvisRechercheTronquee({ result, stoppedManually, arretMemoire = null }: AvisRechercheTronqueeProps) {
  const fr = (n: number) => n.toLocaleString('fr-FR');
  return (
    <p className="mb-2 text-micro text-warn" data-arret-memoire={arretMemoire ? '' : undefined}>
      {arretMemoire
        ? `Arrêt : mémoire — ${fr(arretMemoire.gardes)} builds gardés sur ${fr(arretMemoire.trouves)} trouvés. Resserre tes critères pour un résultat complet.`
        : stoppedManually
          ? `Recherche arrêtée après examen de ${fr(result?.explored ?? 0)} combinaisons — voici le meilleur trouvé jusque-là.`
          : `Recherche interrompue après examen de ${fr(result?.explored ?? 0)} combinaisons — resserre tes critères pour un résultat exhaustif.`}
    </p>
  );
}
