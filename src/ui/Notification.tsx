import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import Bouton from './Bouton';
import BoutonIcone from './BoutonIcone';

// Notification « … · Annuler » (refonte graphique, lot 13, décision 29, la
// maquette) — voir spec/shared/design.md § Notification « Annuler ».
//
// ⚠️ **Elle REMPLACE une confirmation**, pour quatre suppressions (monstre de
// la prépa RTA, équipe, deck, recommandation) : le geste se fait tout de suite,
// et « Annuler » le défait quelques secondes. `annuler` doit remettre
// l'élément À SA PLACE, tel quel (les fonctions `restaurer*` des hooks).
//
// ⚠️ **Une seule à la fois** : la suivante remplace la précédente, dont le geste
// devient définitif. Deux notifications empilées se liraient comme deux choses
// à décider.

export interface Annonce {
  message: string;
  // Absent : une simple annonce, sans retour possible.
  annuler?: () => void;
}

type Notifier = (annonce: Annonce) => void;

// ⚠️ Défaut SANS fournisseur : on ne fait rien. Un écran rendu seul (tests,
// modale montée ailleurs) ne doit pas planter faute de notification.
const Contexte = createContext<Notifier>(() => {});

export const useNotifier = () => useContext(Contexte);

const DUREE = 6000;

export function FournisseurNotification({ children }: { children: ReactNode }) {
  const [courante, setCourante] = useState<(Annonce & { cle: number }) | null>(null);
  const [retenue, setRetenue] = useState(false);
  const cle = useRef(0);

  const notifier = useCallback<Notifier>((annonce) => {
    cle.current += 1;
    setCourante({ ...annonce, cle: cle.current });
    setRetenue(false);
  }, []);

  // 6 s, puis elle s'en va — sauf tant qu'on la survole ou qu'elle a le focus.
  useEffect(() => {
    if (!courante || retenue) return;
    const id = setTimeout(() => setCourante(null), DUREE);
    return () => clearTimeout(id);
  }, [courante, retenue]);

  return (
    <Contexte.Provider value={notifier}>
      {children}
      {courante && (
        <BandeauNotification
          key={courante.cle}
          annonce={courante}
          onFermer={() => setCourante(null)}
          onRetenir={setRetenue}
        />
      )}
    </Contexte.Provider>
  );
}

// Le bandeau lui-même, sans la minuterie : ce que la notification MONTRE. Séparé
// du fournisseur pour être rendu (et testé) seul.
export function BandeauNotification({
  annonce,
  onFermer,
  onRetenir,
}: {
  annonce: Annonce;
  onFermer: () => void;
  // Survol ou focus : la notification reste tant qu'on y est.
  onRetenir?: (retenue: boolean) => void;
}) {
  return (
    <div
      role="status"
      onMouseEnter={() => onRetenir?.(true)}
      onMouseLeave={() => onRetenir?.(false)}
      onFocus={() => onRetenir?.(true)}
      onBlur={() => onRetenir?.(false)}
      // ⚠️ Au TÉLÉPHONE, en bas, centrée, AU-DESSUS de la barre d'onglets et du
      // bouton « Options » (même dégagement que le contenu, voir App.tsx :
      // 116 px + l'encoche), jamais dessous.
      // ⚠️ À la SOURIS, en bas à DROITE (rebranding, décision 23 — la planche
      // « Retours et fenêtres ») : `lg:` seulement, le téléphone ne bouge pas.
      // Fond `panel2`, un cran au-dessus des cartes qu'elle survole, comme la
      // toile.
      className="fixed inset-x-0 z-[70] mx-auto flex w-[min(92vw,440px)] items-center gap-2.5 rounded-xl border
                 border-border bg-panel2 py-2 pl-3.5 pr-2 text-sm text-ink shadow-glow shadow-black/60
                 bottom-[calc(116px+env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-6 lg:mx-0 lg:bottom-6"
    >
      <Check size={15} className="flex-none text-good" aria-hidden />
      <span className="min-w-0 flex-1">{annonce.message}</span>
      {annonce.annuler && (
        <Bouton
          taille="sm"
          // Le « fantôme » de la toile : l'action en braise, sans cadre.
          ton="accent"
          fond="vide"
          trait="aucun"
          libelle="Annuler"
          onClick={() => {
            annonce.annuler?.();
            onFermer();
          }}
        />
      )}
      <BoutonIcone taille="serre" libelle="Fermer la notification" icone={<X size={13} />} onClick={onFermer} />
    </div>
  );
}
