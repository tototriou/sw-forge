import { useEffect, useState } from 'react';
import { EtatSwex, swex } from '../lib/bureau';

// L'état du dossier SW Exporter (application de bureau, lot 9 — voir
// bureau/swex.ts), tenu à jour par le processus principal. Deux lecteurs :
// le bloc « Application » des Réglages et la carte du compte de la barre
// latérale — un seul réglage, deux accès. Sur le site : `null`, et `agir`
// ne fait rien.
export function useEtatSwex() {
  const [etat, setEtat] = useState<EtatSwex | null>(null);
  useEffect(() => {
    const s = swex();
    if (!s) return;
    let actif = true;
    void s.etat().then((e) => actif && setEtat(e));
    const desabonner = s.surEtat(setEtat);
    return () => {
      actif = false;
      desabonner();
    };
  }, []);

  // Un choix (dossier, invocateur, retrait) : l'état rendu par le processus
  // principal remplace le nôtre.
  const agir = async (faire: (s: NonNullable<ReturnType<typeof swex>>) => Promise<EtatSwex | null>) => {
    const s = swex();
    if (!s) return;
    const e = await faire(s);
    if (e) setEtat(e);
  };
  return { etat, agir };
}
