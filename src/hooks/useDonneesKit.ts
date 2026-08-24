import { useEffect, useState } from 'react';
import { Monster } from '../types';
import { chargerDetail } from '../lib/monsterSkills';
import { kitVitesse, sortsVitesse } from '../lib/speedTuneKit';
import { passifsVitesse } from '../lib/speedTunePassif';
import { DonneesKit } from '../lib/speedTuneAuto';

// Charge, pour une poignée de monstres, ce que leurs kits disent de la vitesse
// (sort retenu, liste des sorts, passifs). ⚠️ Un seul endroit pour ce chargement :
// l'outil et le siège en ont besoin, et `chargerDetail` mémorise déjà — deux
// copies de cette boucle auraient surtout produit deux façons de rater le cache.
export function useDonneesKit(monstres: (Monster | null | undefined)[]): DonneesKit {
  const [donnees, setDonnees] = useState<DonneesKit>({
    kits: new Map(),
    sorts: new Map(),
    passifs: new Map(),
  });

  // La clé de dépendance : les identifiants, pas le tableau — il change à chaque
  // rendu du parent, la boucle repartirait sans fin.
  const ids = [
    ...new Set(monstres.map((m) => m?.com2usId).filter((id): id is number => id != null)),
  ].sort((a, b) => a - b);
  const cle = ids.join(',');

  useEffect(() => {
    const manquants = ids.filter((id) => !donnees.kits.has(id));
    if (manquants.length === 0) return;
    let annule = false;
    Promise.all(
      manquants.map((id) =>
        chargerDetail(id).then((d) => [id, kitVitesse(d), sortsVitesse(d), passifsVitesse(d)] as const)
      )
    ).then((paires) => {
      if (annule) return;
      setDonnees((prev) => ({
        kits: new Map([...prev.kits, ...paires.map(([id, k]) => [id, k] as const)]),
        sorts: new Map([...prev.sorts, ...paires.map(([id, , s]) => [id, s] as const)]),
        passifs: new Map([...prev.passifs, ...paires.map(([id, , , p]) => [id, p] as const)]),
      }));
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return donnees;
}
