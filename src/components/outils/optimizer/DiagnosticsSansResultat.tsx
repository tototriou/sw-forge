import DiagnosticFaisabilite from './DiagnosticFaisabilite';
import DiagnosticApprofondi from './DiagnosticApprofondi';
import QuasiSucces from './QuasiSucces';
import { type SearchResult, type StatFeasibility, type BlockingConditionsDiagnosis, type Objective } from '../../../lib/runeBuildOptim';
import { type RuneDetail } from '../../../types';
import { type RuneMetric } from '../../../hooks/useRuneMetric';
import { type SetAura, type DamageSetup } from '../../../lib/damage';

export interface DiagnosticsSansResultatProps {
  result: SearchResult | null;
  feasibilityDiagnosis: StatFeasibility[];
  impossibleFeasibility: StatFeasibility[];
  blockingDiagnosis: BlockingConditionsDiagnosis | null;
  diagnoseBlockingEnabled: boolean;
  runeById: Map<number, RuneDetail>;
  metric: RuneMetric;
  objective: Objective;
  aurasPropresDe: (c: { runeIds: number[]; }) => Readonly<Record<SetAura, number>>;
  damageSetup: DamageSetup;
}

export default function DiagnosticsSansResultat({ result, feasibilityDiagnosis, impossibleFeasibility, blockingDiagnosis, diagnoseBlockingEnabled, runeById, metric, objective, aurasPropresDe, damageSetup }: DiagnosticsSansResultatProps) {
  return (
    <>
    {/* ⚠️ Diagnostic affiché UNIQUEMENT sur 0 résultat — voir
        `diagnoseFeasibility` dans runeBuildOptim.ts pour ce qu'il
        prouve exactement. Deux cas : au moins une condition
        PROUVÉE hors de portée (rouge, liste précise) ; ou aucune ne
        l'est individuellement (message neutre — le blocage vient de
        leur combinaison ou de la recherche elle-même, pas d'une seule
        stat identifiable). */}
    {result?.candidates.length === 0 && feasibilityDiagnosis.length > 0 && (
      <DiagnosticFaisabilite
        impossibleFeasibility={impossibleFeasibility}
      />
    )}

    {/* ⚠️ Palier 2 — voir `rankBlockingConditions` dans
        runeBuildOptim.ts : un INDICE (pas une preuve, contrairement au
        palier 1 ci-dessus), désactivé par défaut (coûte plus cher).
        Deux affichages selon l'état de la bascule : le classement s'il
        est activé, une invitation discrète sinon. */}
    {result?.candidates.length === 0 && (
      <DiagnosticApprofondi blockingDiagnosis={blockingDiagnosis} diagnoseBlockingEnabled={diagnoseBlockingEnabled} />
    )}

    {/* ⚠️ Quasi-succès à l'appariement — sous-produit GRATUIT de la
        vraie recherche (`pairBuckets`, jamais recalculé), affiché
        SYSTÉMATIQUEMENT (contrairement au palier 2 ci-dessus, dont le
        coût réel justifie un réglage) : voir docs/03-developpeur/optimizer/,
        « Quasi-succès à l'appariement ». Ne voit que ce que la recherche a
        RÉELLEMENT exploré avant troncature — une paire encore plus
        proche, jamais atteinte, resterait invisible. */}
    {result?.candidates.length === 0 && (result.globalNearMiss || result.nearMissByCondition.length > 0) && (
      <QuasiSucces
        result={result}
        runeById={runeById}
        metric={metric}
        objective={objective}
        aurasPropresDe={aurasPropresDe}
        damageSetup={damageSetup}
      />
    )}
    </>
  );
}
