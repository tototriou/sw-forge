import { type BuildOptimProgress, type BuildOptimStatus } from '../../../hooks/useBuildOptimSearch';
import { type RelicVide } from '../../../lib/relicOptim';

export interface ProgressionRechercheProps {
  status: BuildOptimStatus;
  progress: BuildOptimProgress | null;
  refusal: { motif: 'relique-pool-vide'; vide: RelicVide } | null;
  // Le compte des trouvées de la ligne d'appariement (`compteAffichable`).
  compteAffiche: { compte: number };
  // Forme compacte du bloc « Objectif et Rechercher » du bureau (décision de
  // l'utilisateur) : sans barre, les lignes de texte seules — à l'appariement,
  // « … combinaisons examinées · … trouvée(s) » et « Attendez la fin… ». Le
  // téléphone et la page d'aujourd'hui ne la passent pas.
  compacte?: boolean;
}

export default function ProgressionRecherche({ status, progress, refusal, compteAffiche, compacte = false }: ProgressionRechercheProps) {
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
        <div className={compacte ? 'space-y-0.5' : 'space-y-2'}>
          {(['A', 'B'] as const).map((half) => {
            const h = progress.halves[half];
            return (
              <div key={half}>
                {!compacte && (
                  <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
                    <div
                      className="h-full bg-accent/60 transition-[width] duration-150 ease-out"
                      style={{ width: `${Math.round((h?.pct ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
                <p className={`${compacte ? '' : 'mt-1 '}font-mono text-micro text-ink-dim`}>
                  Préparation — moitié {half} :{' '}
                  {h ? `${h.scanned.toLocaleString('fr-FR')} / ${h.total.toLocaleString('fr-FR')} runes` : 'en attente…'}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {status === 'running' && (progress === null || progress.phase === 'pairing') && (
        <div>
          {!compacte && (
            <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
              <div
                className="h-full bg-accent transition-[width] duration-150 ease-out"
                style={{ width: `${Math.round((progress?.pct ?? 0) * 100)}%` }}
              />
            </div>
          )}
          {/* ⚠️ Le dénominateur ici est `totalPairs` (voir `totalPairCount`),
              la taille EXACTE de l'espace à épuiser — un plafond de nœuds a
              longtemps coexisté avec lui, écarté d'ici parce qu'il
              grandissait en cours de route et aurait fait RECULER la barre.
              C'est ce choix de l'interface qui a fini par emporter sa
              suppression du moteur. */}
          <p className={`${compacte ? '' : 'mt-1 '}font-mono text-micro text-ink-dim`}>
            {progress === null
              ? 'Préparation…'
              : `${progress.explored.toLocaleString('fr-FR')} / ${progress.totalPairs.toLocaleString('fr-FR')} combinaisons examinées · ${compteAffiche.compte.toLocaleString('fr-FR')} trouvée(s)`}
          </p>
          {progress !== null && (
            <p className="mt-0.5 font-mono text-[11px] font-bold text-star">
              Attendez la fin de la recherche pour être sûr de trouver votre build optimal.
            </p>
          )}
          {/* ⚠️ Plus de phrase sur un budget qui s'élargit : l'escalade du
              budget de paires n'existe plus dans le moteur (runeBuildOptim.ts,
              « Il n'existe PLUS de budget de PAIRES »). */}
        </div>
      )}

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
