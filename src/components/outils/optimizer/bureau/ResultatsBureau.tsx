import { type ReactNode } from 'react';

// Une carte de résultat (360, resultats.md) et le cadre de la boîte (bord 2 +
// rembourrage 24) : les résultats ne descendent jamais sous cette largeur.
export const LARGEUR_RESULTATS_MIN = 386;

export type AttenteResultats = 'sans-monstre' | 'sans-recherche';

// Les résultats, au bureau : une boîte ÉLASTIQUE (386 px au moins, sans
// maximum), présente dès le départ dans la colonne de droite. Avant la première
// recherche, une place d'attente (en-tête et message, ≈ 160 px) tient la place
// où arrivent les cartes : leur arrivée ne déplace jamais ce qu'on vient de
// cliquer. Ensuite, le contenu d'aujourd'hui, passé par l'écran : en-tête
// (compte, « Adapter les artéfacts et reliques au tri », tri), diagnostics,
// grille de cartes (`GrilleResultats`, ≥ 360 px par carte) et pagination.
export default function ResultatsBureau({ attente, children }: { attente: AttenteResultats | null; children?: ReactNode }) {
  return (
    <section aria-label="Résultats" style={{ minWidth: LARGEUR_RESULTATS_MIN }} className="w-full rounded-xl border border-border bg-panel p-3">
      {attente != null ? (
        <div className="flex min-h-[134px] flex-col gap-2">
          <p className="label">
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
