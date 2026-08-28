import { AlertTriangle, X, XCircle } from 'lucide-react';
import { ImportReport } from '../../lib/rtaShare';
import { BoutonIcone } from '../../ui';

// Rapport de validation du dernier fichier de prépa lu. Reste affiché jusqu'à
// fermeture : contrairement au message de succès, il y a quelque chose à LIRE.
//
// ⚠️ **Partagé par les DEUX lectures d'un fichier de prépa** — reprendre la
// sienne (`RtaBackupBar`) et ouvrir celle d'un ami (`RtaAmiSection`). Le même
// format se valide de la même façon, et un fichier bricolé à la main doit se
// plaindre pareil des deux côtés : le recopier aurait fait diverger les
// messages là où l'utilisateur, lui, voit un seul et même fichier.
export default function RtaValidationReport({
  report,
  onClose,
}: {
  report: ImportReport;
  onClose: () => void;
}) {
  const bloque = report.errors.length > 0;
  return (
    <div
      className={`mt-2 rounded-xl border px-3 py-2.5 ${
        bloque ? 'border-fire/50 bg-fire/5' : 'border-warn/40 bg-warn/5'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {bloque ? (
          <XCircle size={15} className="flex-none text-fire" />
        ) : (
          <AlertTriangle size={15} className="flex-none text-warn" />
        )}
        <span className={`text-xs font-semibold ${bloque ? 'text-fire' : 'text-warn'}`}>
          {bloque
            ? "Fichier refusé — le contenu n'est pas valide"
            : `Lu avec ${report.warnings.length} correction${report.warnings.length > 1 ? 's' : ''}`}
        </span>
        <BoutonIcone
          onClick={onClose}
          libelle="Fermer le rapport"
          icone={<X size={14} />}
          className="ml-auto"
        />
      </div>

      <ul className="space-y-0.5 max-h-[220px] overflow-y-auto">
        {report.errors.map((e, i) => (
          <li key={`e${i}`} className="text-xs text-fire leading-snug">
            • {e}
          </li>
        ))}
        {report.warnings.map((w, i) => (
          <li key={`w${i}`} className="text-xs text-warn/90 leading-snug">
            • {w}
          </li>
        ))}
      </ul>

      {!bloque && (
        <p className="mt-1.5 font-mono text-micro text-ink-dim">
          {report.counts.monstres} monstre(s) · {report.counts.avecRunes} avec runes ·{' '}
          {report.counts.categories} catégorie(s) lus.
        </p>
      )}
    </div>
  );
}
