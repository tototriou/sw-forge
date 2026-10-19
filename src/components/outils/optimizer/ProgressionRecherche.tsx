import { type ReactNode } from 'react';
import { type BuildOptimProgress, type BuildOptimStatus } from '../../../hooks/useBuildOptimSearch';
import { type RelicVide } from '../../../lib/relicOptim';

export interface ProgressionRechercheProps {
  status: BuildOptimStatus;
  progress: BuildOptimProgress | null;
  refusal: { motif: 'relique-pool-vide'; vide: RelicVide } | null;
  appariement: ReactNode;
}

export default function ProgressionRecherche({ status, progress, refusal, appariement }: ProgressionRechercheProps) {
  return (
    <>
      {/* ⚠️ Deux phases distinctes affichées différemment, pas une seule
          barre continue : `building` (construction des compartiments, avant
          même de savoir combien de paires il y aura à explorer) et `pairing`
          (l'ancienne barre, inchangée) ne partagent pas la même notion de
          progression — les mélanger sous un seul repère aurait été plus
          trompeur qu'utile (la barre aurait pu reculer en changeant de
          phase). Avant ce correctif, `progress` restait `null` pendant toute
          la phase `building` (jusqu'à ~1 minute sur un compte réel à
          beaucoup de conditions) : la barre affichait 0 % sans bouger et le
          texte « 0 combinaisons examinées », sans dire qu'un TRAVAIL était
          en cours — voir docs/02-app/optimizer/,
          « Barre de progression ». */}
      {/* ⚠️ Deux barres empilées, une par moitié, pas une seule — depuis leur
          construction EN PARALLÈLE (deux Workers, voir
          runeBuildOptim.worker.ts), A et B avancent en même temps ; une seule
          barre ne pourrait montrer que la dernière moitié à avoir posté un
          message, faisant croire à tort que l'autre est à l'arrêt. */}
      {status === 'running' && progress?.phase === 'building' && (
        <div className="space-y-2">
          {(['A', 'B'] as const).map((half) => {
            const h = progress.halves[half];
            return (
              <div key={half}>
                <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
                  <div
                    className="h-full bg-accent/60 transition-[width] duration-150 ease-out"
                    style={{ width: `${Math.round((h?.pct ?? 0) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-micro text-ink-dim">
                  Préparation — moitié {half} :{' '}
                  {h ? `${h.scanned.toLocaleString('fr-FR')} / ${h.total.toLocaleString('fr-FR')} runes` : 'en attente…'}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {appariement}

      {status === 'error' && (
        <p className="text-xs text-bad">La recherche a échoué. Réessaie avec des critères moins stricts.</p>
      )}

      {/* ⚠️ Refus NOMMÉ : `search.status ===
          'refused'` et `search.refusal.vide` sont la SEULE source de ce
          texte — un par raison, jamais un pool recalculé pour deviner
          pourquoi. `'refused'` se traite ici comme `'error'` l'est
          juste au-dessus, à la place du lancement. */}
      {status === 'refused' && refusal && (
        <p className="text-xs text-bad">
          {refusal.vide === 'seuil'
            ? 'Aucune relique éligible : abaisse le niveau minimum.'
            : refusal.vide === 'principale'
              ? 'Aucune relique de cette principale dans ton inventaire.'
              : refusal.vide === 'type'
                ? 'Aucune relique de cette propriété unique dans ton inventaire.'
                : refusal.vide === 'inventaire'
                  ? "Aucune relique dans le compte importé : réimporte le compte, ou coupe l'optimisation d'artéfacts et reliques."
                  : 'Ce monstre ne porte pas de relique.'}
        </p>
      )}
    </>
  );
}
