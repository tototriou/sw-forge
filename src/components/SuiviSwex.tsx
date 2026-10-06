import { useEffect, useRef } from 'react';
import { swex } from '../lib/bureau';
import { useNotifier } from '../ui/Notification';

// Le dossier SW Exporter, côté page — application de bureau, lot 9,
// décision 15 (bureau/swex.ts). Rien à l'écran : il reçoit les exports du
// compte suivi, en applique « Mon compte » (`appliquer`, App.tsx
// `rafraichirCompte`) et l'annonce. Sur le site : inerte.
//
// ⚠️ **`pret` seulement une fois les monstres chargés ET le compte conservé
// relu** (App.tsx) : appliqué plus tôt, l'export donnerait une box vide
// (sans l'index des monstres), ou serait écrasé par la relecture d'un compte
// plus ancien.
export default function SuiviSwex({
  appliquer,
  pret,
  sansCompte,
}: {
  appliquer: (texte: string) => { ok: boolean; nom: string | null };
  pret: boolean;
  // La page n'a aucun compte (conservation refusée) : l'export se relit en
  // silence, même s'il a déjà été lu.
  sansCompte: boolean;
}) {
  const notifier = useNotifier();
  // La DERNIÈRE version des deux : `appliquer` lit l'index des monstres, qui
  // change ; l'abonnement, lui, ne se refait pas à chaque rendu.
  const appliquerRef = useRef(appliquer);
  appliquerRef.current = appliquer;
  const sansCompteRef = useRef(sansCompte);
  sansCompteRef.current = sansCompte;

  useEffect(() => {
    const s = swex();
    if (!s || !pret) return;
    const desabonner = s.surExport((exp) => {
      const r = appliquerRef.current(exp.texte);
      // Illisible (à moitié écrit ?) : rien n'est marqué lu, le prochain
      // changement du fichier le redonnera.
      if (!r.ok) return;
      s.lu(exp.modifie);
      if (exp.nouveau) {
        notifier({
          message: r.nom ? `Compte de ${r.nom} mis à jour depuis SW Exporter` : 'Compte mis à jour depuis SW Exporter',
        });
      }
    });
    s.pret(sansCompteRef.current);
    return desabonner;
  }, [pret, notifier]);

  return null;
}
