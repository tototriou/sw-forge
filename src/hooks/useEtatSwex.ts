import { createContext, useContext, useEffect, useState } from 'react';
import { EtatSwex, swex } from '../lib/bureau';

// Ce qui précède un changement de compte (App.tsx) : proposer de sauvegarder
// la session si le travail a changé, puis `changer`. Sans fournisseur, le
// changement se fait tout de suite.
export const GardeChangementCompte = createContext<((changer: () => void) => void) | null>(null);

// L'état du dossier SW Exporter (application de bureau — voir
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
    // Un état diffusé avant la réponse de `etat()` est plus récent : elle ne
    // l'écrase pas (voir useSessionEnCours.ts).
    let diffuse = false;
    void s.etat().then((e) => actif && !diffuse && setEtat(e));
    const desabonner = s.surEtat((e) => {
      diffuse = true;
      setEtat(e);
    });
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

  // ⚠️ **Choisir un invocateur, ou un dossier qui en désigne un d'office,
  // CHANGE DE COMPTE** : l'export qui suit remplace prépa RTA, siège et
  // « Mon compte ». Ces choix passent donc par la garde, qui propose d'abord
  // de sauvegarder. Choisir celui déjà suivi ne fait rien.
  const garde = useContext(GardeChangementCompte);
  const avecGarde = (faire: Parameters<typeof agir>[0]) => {
    const changer = () => void agir(faire);
    if (garde) garde(changer);
    else changer();
  };
  const choisirInvocateur = (fichier: string) => {
    if (fichier === etat?.fichier) return;
    avecGarde((s) => s.choisirInvocateur(fichier));
  };
  const choisirDossier = () => avecGarde((s) => s.choisirDossier());
  return { etat, agir, choisirInvocateur, choisirDossier };
}
