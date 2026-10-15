import { useEffect, useState } from 'react';
import { EtatSession, sessionBureau } from '../lib/bureau';
import { usePersistence } from './usePersistence';

// L'état de la session de l'application de bureau (bureau/session.ts), tenu à
// jour par le processus principal : la session en cours et le dossier SW
// Blacksmith. Sur le site : `null`, et `agir` ne fait rien.
export function useEtatSession() {
  const [etat, setEtat] = useState<EtatSession | null>(null);
  useEffect(() => {
    const s = sessionBureau();
    if (!s) return;
    let actif = true;
    // ⚠️ Un état diffusé avant la réponse de `etat()` est plus récent qu'elle :
    // elle ne l'écrase pas (le dossier ou la session affichés reviendraient
    // à l'ancienne valeur).
    let diffuse = false;
    void s.etat().then((e) => actif && !diffuse && e && setEtat(e));
    const desabonner = s.surEtat((e) => {
      diffuse = true;
      setEtat(e);
    });
    return () => {
      actif = false;
      desabonner();
    };
  }, []);

  // Un choix (dossier, retrait) : l'état rendu par le processus principal
  // remplace le nôtre.
  const agir = async (faire: (s: NonNullable<ReturnType<typeof sessionBureau>>) => Promise<EtatSession | null>) => {
    const s = sessionBureau();
    if (!s) return;
    const e = await faire(s);
    if (e) setEtat(e);
  };
  return { etat, agir, setEtat };
}

// La session en cours (`null` tant qu'il n'y en a pas, et sur le site), pour
// la barre du haut.
//
// ⚠️ « Garder mes données » est redit au bureau au chargement et à chaque
// changement : c'est lui qui décide si la session en cours survit à la
// fermeture de l'app (docs/02-app/transverse/). Un seul appelant :
// `App.tsx`.
export function useSessionEnCours(): EtatSession | null {
  const conserver = usePersistence();
  const { etat, setEtat } = useEtatSession();

  useEffect(() => {
    const s = sessionBureau();
    if (!s) return;
    let actif = true;
    void s.retenir(conserver).then((e) => {
      if (actif && e) setEtat(e);
    });
    return () => {
      actif = false;
    };
  }, [conserver, setEtat]);

  return etat?.chemin ? etat : null;
}
