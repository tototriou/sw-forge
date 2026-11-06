import { useCallback, useEffect, useRef, useState } from 'react';
import { ecrituresEntre, fusionnerRelecture, type EquipeEnregistree, type SignalementEquipe } from '../lib/equipesEnregistrees';
import { chargerEquipes, enregistrerEquipes, supprimerEquipes } from '../lib/equipesStore';
import { persistenceEnabled, usePersistence } from './usePersistence';

// Les équipes de « Mes équipes », instancié dans App.tsx (la page et
// l'Optimizer s'en servent). Spec : docs/02-app/compte/feat-equipes.md,
// « Conservation ».
//
// ⚠️ **Sous l'interrupteur unique de conservation** : sans accord, les équipes
// vivent en mémoire ; l'activation écrit tout de suite celles qui y sont, le
// refus efface la base (`purgeDonneesConservees`) sans toucher à la mémoire.
//
// ⚠️ **La relecture passe SOUS les gestes** : une équipe créée, modifiée ou
// supprimée avant la fin de la relecture n'est ni remplacée ni ressuscitée.

export type RelectureEquipesEtat = 'en-cours' | 'finie';

export interface EquipesEnregistreesApi {
  equipes: EquipeEnregistree[];
  relecture: RelectureEquipesEtat;
  illisibles: number;
  signalements: { id: string; signalements: SignalementEquipe[] }[];
  // Les clés des entrées illisibles de la base : un import ne les reprend pas.
  clesReservees: ReadonlySet<string>;
  // Les signalements d'équipes ajoutées par un fichier.
  signaler: (s: { id: string; signalements: SignalementEquipe[] }[]) => void;
  appliquer: (f: (equipes: EquipeEnregistree[]) => EquipeEnregistree[]) => void;
  remplacerTout: (equipes: EquipeEnregistree[]) => void;
}

export function useEquipesEnregistrees(): EquipesEnregistreesApi {
  const persiste = usePersistence();
  const [equipes, setEquipes] = useState<EquipeEnregistree[]>([]);
  const [relecture, setRelecture] = useState<RelectureEquipesEtat>(() => (persistenceEnabled() ? 'en-cours' : 'finie'));
  const [illisibles, setIllisibles] = useState(0);
  const [signalements, setSignalements] = useState<EquipesEnregistreesApi['signalements']>([]);
  const [clesReservees, setClesReservees] = useState<ReadonlySet<string>>(() => new Set());
  // Les objets déjà sur le disque : une équipe relue n'est pas réécrite.
  const surDisque = useRef(new WeakSet<EquipeEnregistree>());
  const precedent = useRef<EquipeEnregistree[]>([]);
  const supprimeesPendantRelecture = useRef(new Set<string>());
  const enRelecture = useRef(relecture === 'en-cours');

  useEffect(() => {
    if (!enRelecture.current) return;
    let vivant = true;
    void chargerEquipes().then((res) => {
      if (!vivant) return;
      enRelecture.current = false;
      if (res) {
        for (const e of res.equipes) surDisque.current.add(e);
        setIllisibles(res.illisibles);
        setSignalements((s) => [...res.signalements, ...s]);
        setClesReservees(new Set(res.clesIllisibles));
        // ⚠️ Une COPIE : l'updater s'exécute plus tard, après le vidage ci-dessous.
        const supprimees = new Set(supprimeesPendantRelecture.current);
        setEquipes((m) => fusionnerRelecture(m, res.equipes, supprimees));
      }
      supprimeesPendantRelecture.current.clear();
      setRelecture('finie');
    });
    return () => { vivant = false; };
  }, []);

  // Les écritures suivent l'état : un seul endroit les décide.
  useEffect(() => {
    const { aEcrire, aSupprimer } = ecrituresEntre(precedent.current, equipes);
    precedent.current = equipes;
    if (enRelecture.current) for (const id of aSupprimer) supprimeesPendantRelecture.current.add(id);
    if (!persiste) return;
    const nouvelles = aEcrire.filter((e) => !surDisque.current.has(e));
    if (nouvelles.length) void enregistrerEquipes(nouvelles).then((ok) => { if (ok) for (const e of nouvelles) surDisque.current.add(e); });
    if (aSupprimer.length) void supprimerEquipes(aSupprimer);
  }, [equipes, persiste]);

  // Activation de la conservation : tout ce qui est en mémoire part sur le
  // disque. Refus : la purge a vidé la base, plus rien n'y est.
  const avant = useRef(persiste);
  useEffect(() => {
    if (persiste === avant.current) return;
    avant.current = persiste;
    surDisque.current = new WeakSet();
    if (persiste && precedent.current.length) {
      const toutes = precedent.current;
      void enregistrerEquipes(toutes).then((ok) => { if (ok) for (const e of toutes) surDisque.current.add(e); });
    }
  }, [persiste]);

  const appliquer = useCallback((f: (e: EquipeEnregistree[]) => EquipeEnregistree[]) => setEquipes((e) => f(e)), []);
  const remplacerTout = useCallback((e: EquipeEnregistree[]) => setEquipes(e), []);
  const signaler = useCallback((s: EquipesEnregistreesApi['signalements']) => { if (s.length) setSignalements((p) => [...p, ...s]); }, []);

  return { equipes, relecture, illisibles, signalements, clesReservees, signaler, appliquer, remplacerTout };
}
