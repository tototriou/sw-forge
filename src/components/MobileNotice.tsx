import { Monitor, X } from 'lucide-react';
import { useStickyState } from '../hooks/useStickyState';

// Avertissement affiché **sur petit écran uniquement** : SW Forge manipule des
// listes de runes, des équipes de trois monstres et des ordres de tour — tout
// cela demande de la largeur. Sans un mot, on croit à un site mal fait plutôt
// qu'à un site consulté dans de mauvaises conditions.
//
// ⚠️ **Détection par media query CSS (`md:hidden`), jamais par user-agent.** Le
// sniffing se trompe (tablettes, mode bureau, navigateurs exotiques) et vieillit
// mal ; ce qui compte ici n'est pas l'appareil mais **la largeur disponible**.
//
// ⚠️ **Refermable, et l'oubli est volontairement court** : la fermeture vit en
// mémoire (`useStickyState`), donc elle tient pour la session et le bandeau
// revient à la visite suivante. Le persister demanderait le consentement de
// conservation — mettre un bandeau d'information dans la même balance qu'une
// prépa RTA serait disproportionné.
export default function MobileNotice() {
  const [ferme, setFerme] = useStickyState('mobileNotice.ferme', false);
  if (ferme) return null;

  return (
    <div className="md:hidden mb-4 flex items-start gap-2.5 rounded-xl border border-[#4a52a0] bg-panel2/60 px-3 py-2.5">
      <Monitor size={16} className="mt-0.5 flex-none text-[#8b92e0]" />
      <p className="flex-1 text-[12px] leading-relaxed text-ink-dim">
        <b className="text-ink">SW Forge est pensé pour un grand écran.</b> Tout fonctionne sur
        téléphone, mais les listes de runes et les équipes de siège se lisent bien plus
        confortablement sur ordinateur.
      </p>
      <button
        onClick={() => setFerme(true)}
        aria-label="Masquer cet avertissement"
        className="flex-none rounded-md p-1 text-ink-dim transition hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
