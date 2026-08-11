import { CalendarClock } from 'lucide-react';

// Date de l'export chargé.
//
// ⚠️ **C'est la date de l'EXPORT, pas celle de l'import** (`tvalue`, voir
// `parseAccountExportDate`). Réimporter un fichier de trois semaines afficherait
// sinon « aujourd'hui » sur des données périmées — précisément le mensonge qu'on
// cherche à éviter. Un compte conservé sur l'appareil ne se voit plus arriver :
// sans cette ligne, on analyse de vieilles runes en les croyant à jour.
//
// Vit dans le **menu ⚙**, à côté du réglage qui décide de la conservation : c'est
// là qu'on se pose la question, et ça n'encombre aucune page.

// Au-delà, on ne se contente plus d'informer : on invite à réexporter. Deux
// semaines, c'est l'ordre de grandeur où un joueur actif a refait ses runes.
const JOURS_AVANT_RAPPEL = 14;

export function joursDepuis(exportedAt: number, maintenant = Date.now()): number {
  return Math.floor((maintenant - exportedAt) / 86_400_000);
}

// « le 9 août » — et l'année seulement si ce n'est pas la courante, sinon elle
// alourdit une information qu'on lit en passant.
export function dateCourte(exportedAt: number, maintenant = Date.now()): string {
  const d = new Date(exportedAt);
  const memeAnnee = d.getFullYear() === new Date(maintenant).getFullYear();
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(memeAnnee ? {} : { year: 'numeric' }),
  });
}

export default function AccountFreshness({
  exportedAt,
  className = '',
}: {
  exportedAt: number | null;
  className?: string;
}) {
  if (exportedAt == null) return null;

  const jours = joursDepuis(exportedAt);
  const vieux = jours >= JOURS_AVANT_RAPPEL;

  return (
    <p
      className={`flex items-center gap-1.5 text-[12px] leading-snug ${
        vieux ? 'text-warn' : 'text-ink-dim'
      } ${className}`}
    >
      <CalendarClock size={13} className="flex-none" />
      <span>
        Compte exporté le {dateCourte(exportedAt)}
        {vieux && (
          <>
            {' '}
            — <b>réexporte ton compte</b> pour des chiffres à jour.
          </>
        )}
      </span>
    </p>
  );
}
