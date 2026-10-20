import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { AttenteResultats } from '../../../../lib/optimizerColonnes';

export type { AttenteResultats };

// Une carte de résultat (360, resultats.md) et le cadre de la boîte (bord 2 +
// rembourrage 24) : les résultats ne descendent jamais sous cette largeur.
export const LARGEUR_RESULTATS_MIN = 386;

// Les résultats, au bureau : une boîte ÉLASTIQUE (386 px au moins, sans
// maximum), présente dès le départ dans la colonne de droite. Avant la première
// recherche, une place d'attente (en-tête et message, ≈ 160 px) tient la place
// où arrivent les cartes : leur arrivée ne déplace jamais ce qu'on vient de
// cliquer. Ensuite, le contenu partagé avec le téléphone, passé par l'écran : en-tête
// (compte, « Adapter les artéfacts et reliques au tri », tri), diagnostics,
// grille de cartes (`GrilleResultats`, ≥ 360 px par carte) et pagination.
// L'état d'attente vient d'`attenteResultats` (src/lib/optimizerColonnes.ts) :
// pendant une recherche encore sans carte, le cadre reste, la phrase
// « Aucune recherche lancée… » non (sa ligne garde sa place).
//
// ⚠️ **Une relance garde la hauteur des résultats d'avant** tant qu'aucune
// carte n'est revenue (`sans-carte`) : la recherche relancée vide les
// résultats, et la page, devenue plus courte que son défilement, remontait
// d'un coup sous le pointeur — « Rechercher » compris (mesuré : 181 px à
// 2254 × 1290, page défilée de 300 px).
export default function ResultatsBureau({ attente, children }: { attente: AttenteResultats | null; children?: ReactNode }) {
  const boite = useRef<HTMLElement>(null);
  const [tenue, setTenue] = useState(0);
  useLayoutEffect(() => {
    if (attente === 'sans-carte') return;
    if (attente != null) { setTenue(0); return; }
    const el = boite.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const lire = () => setTenue(el.offsetHeight);
    lire();
    const obs = new ResizeObserver(lire);
    obs.observe(el);
    return () => obs.disconnect();
  }, [attente]);
  return (
    <section
      ref={boite}
      aria-label="Résultats"
      style={{ minWidth: LARGEUR_RESULTATS_MIN }}
      className="w-full rounded-xl border border-border bg-panel p-3"
    >
      {attente != null ? (
        // La hauteur tenue est celle de la boîte : son cadre (bord 2 +
        // rembourrage 24) retranché, elle va au contenu de l'attente.
        <div className="flex min-h-[134px] flex-col gap-2" style={attente === 'sans-carte' && tenue > 26 ? { minHeight: tenue - 26 } : undefined}>
          <p className={`label ${attente === 'sans-carte' ? 'invisible' : ''}`} aria-hidden={attente === 'sans-carte' || undefined}>
            {attente === 'sans-monstre' ? 'Choisis un monstre pour préparer la recherche.' : 'Aucune recherche lancée pour ce monstre.'}
          </p>
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-soft px-3 text-center text-xs text-ink-dim">
            Les builds trouvés s&apos;afficheront ici.
          </div>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
