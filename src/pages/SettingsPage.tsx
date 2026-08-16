import { Settings } from 'lucide-react';
import { SettingsList } from '../components/SettingsMenu';

// Page des RÉGLAGES (`#/parametres`).
//
// ⚠️ **Une page, pas seulement un popover.** Le menu ⚙ reste — c'est le geste
// rapide, depuis n'importe quel écran. Mais il portait sept réglages dont deux
// à texte long (l'overcap, la conservation des données), et un popover de
// 260 px n'est pas le bon endroit pour lire trois lignes d'explication. Ici,
// tout tient à l'aise et se partage par une URL.
//
// ⚠️ **La MÊME liste** (`SettingsList`) que le popover, pas une copie : deux
// listes auraient divergé au premier réglage ajouté, et personne ne s'en serait
// aperçu puisqu'on n'ouvre jamais les deux à la fois.
export default function SettingsPage({
  onClearData,
  onKeepAccount,
  accountExportedAt,
  accountName,
}: {
  onClearData?: () => void;
  onKeepAccount?: () => void;
  accountExportedAt?: number | null;
  // Nom du joueur dont le compte est chargé. ⚠️ Répété ici parce que la barre
  // latérale, qui le porte au-dessus de `lg`, n'existe pas en dessous.
  accountName?: string | null;
}) {
  // ⚠️ **Colonne CENTRÉE**, contrairement aux autres pages. Celles-ci portent
  // des grilles et des tableaux qui se lisent en largeur ; les réglages sont une
  // pile de lignes courtes « intitulé / contrôle ». Alignés à gauche dans un
  // conteneur de 1180 px, ils laissaient les deux tiers de l'écran vides à
  // droite — et l'œil devait traverser ce vide pour relier l'intitulé au
  // contrôle.
  return (
    <div className="mx-auto max-w-[620px]">
      <p className="mb-4 text-[13px] leading-relaxed text-ink-dim">
        Ces réglages valent pour toute l'application et restent sur cet appareil.
      </p>

      {/* QUEL compte est chargé. Il précède les réglages : c'est ce sur quoi
          ils portent, et la question « est-ce le bon compte ? » vient avant
          « comment est-il affiché ? ». */}
      {accountName && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-border
                        bg-panel px-4 py-3">
          <span className="h-2 w-2 flex-none rounded-full bg-good" aria-hidden />
          <div className="min-w-0">
            <span className="label">Compte chargé</span>
            <div className="truncate text-[14px] font-semibold text-ink">{accountName}</div>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-panel px-4 py-1">
        <SettingsList
          onClearData={onClearData}
          onKeepAccount={onKeepAccount}
          accountExportedAt={accountExportedAt}
        />
      </div>
    </div>
  );
}
