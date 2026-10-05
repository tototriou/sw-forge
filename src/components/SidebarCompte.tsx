import { ChangeEvent, useRef } from 'react';
import { ChevronsUpDown, Import } from 'lucide-react';
import { IconeParametres } from './IconesAtelier';
import { dateCourte } from './AccountFreshness';

// Carte du compte, en tête de la barre latérale (bureau) : QUI est chargé, et
// le geste qui s'y rapporte — en charger un autre.
//
// ⚠️ **Le nom du joueur en premier.** On jongle entre plusieurs exports (le
// sien, celui d'un ami dont on compare les runes) et rien ne disait lequel
// était affiché. En dessous, la date de l'EXPORT et le nombre de monstres :
// deux comptes importés le même jour ne se ressemblent plus.
//
// ⚠️ **Toute la carte est le bouton d'import.** Le double chevron dit
// « changer » : charger un autre compte EST changer de compte. Un bouton à
// part, à côté, aurait fait deux cibles pour un seul geste.
//
// ⚠️ **L'avatar est une INITIALE, pas une image.** L'export SWEX ne porte
// aucune photo de profil. Une initiale sur fond teinté distingue deux comptes
// d'un coup d'œil sans rien inventer.
export default function SidebarCompte({
  nom,
  exporteLe,
  nbMonstres,
  retractee,
  onImport,
}: {
  // `null` = aucun compte chargé : la carte invite à importer.
  nom: string | null;
  // Date de l'export chargé (`tvalue`), pas celle de l'import.
  exporteLe: number | null;
  nbMonstres: number;
  retractee: boolean;
  // Reçoit le contenu du fichier choisi. ⚠️ Le composant porte son propre
  // `<input type="file">` : le sélecteur natif ne s'ouvre que depuis un vrai
  // clic utilisateur.
  onImport: (texte: string) => void;
}) {
  const fichier = useRef<HTMLInputElement>(null);

  async function choisir(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // permet de réimporter le même fichier
    if (!f) return;
    onImport(await f.text());
  }

  const detail = nom
    ? [exporteLe != null ? `Export du ${dateCourte(exporteLe)}` : null, `${nbMonstres} monstres`]
        .filter(Boolean)
        .join(' · ')
    : 'Importer un export SWEX';

  return (
    <>
      <input
        ref={fichier}
        type="file"
        accept=".json,application/json"
        onChange={choisir}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fichier.current?.click()}
        aria-label="Importer un compte"
        title="Importer un export de compte SWEX (traité localement, rien n'est envoyé)"
        className={`flex w-full items-center rounded-xl border border-border-soft bg-panel text-left
                    transition-colors hoverable:bg-panel2 ${
                      retractee ? 'justify-center p-1.5' : 'gap-2.5 p-2'
                    }`}
      >
        {/* Repliée, seul l'avatar tient : c'est la seule chose de la carte qui
            reste identifiable à cette taille. */}
        <span
          aria-hidden
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-ctx-soft
                     text-sm font-bold uppercase text-ctx"
        >
          {nom ? nom.trim().charAt(0) : <Import size={16} />}
        </span>
        {!retractee && (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`truncate text-sm font-semibold ${nom ? 'text-ink' : 'text-ink-dim'}`}>
                {nom ?? 'Aucun compte'}
              </span>
              <span className="truncate text-xs text-ink-dimmer">{detail}</span>
            </span>
            <ChevronsUpDown size={16} aria-hidden className="flex-none text-ink-dimmer" />
          </>
        )}
      </button>
    </>
  );
}

// Paramètres, en pied de la barre — une entrée au gabarit des autres.
//
// ⚠️ **Une BASCULE, pas un lien.** Le ⚙ ouvre les paramètres, et le clic
// suivant ramène à l'écran d'où l'on vient — le même geste que le ⚙ de la
// barre supérieure au doigt (`basculerParametres` dans App.tsx). L'engrenage
// pivote d'un huitième de tour quand ils sont ouverts : le bouton dit qu'il
// fera l'INVERSE au prochain clic.
export function SidebarParametres({
  actifs,
  retractee,
  onToggle,
}: {
  actifs: boolean;
  retractee: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={actifs ? 'Fermer les paramètres' : 'Paramètres'}
      title={actifs ? 'Fermer les paramètres' : 'Paramètres'}
      aria-pressed={actifs}
      className={`flex h-8 w-full items-center rounded-lg text-left text-md font-medium transition-colors ${
        retractee ? 'justify-center px-0' : 'gap-2.5 px-2.5'
      } ${actifs ? 'bg-accent-soft text-accent' : 'text-ink-dim hoverable:bg-ink/5 hoverable:text-ink'}`}
    >
      {/* Rebranding R4 : les curseurs « Réglages » de la toile (décision 28 —
          l'engrenage est à Mécaniques), et l'état ouvert en braise comme toute
          entrée active de la barre (décision 29). L'engrenage pivotait d'un
          huitième de tour à l'ouverture : des curseurs tournés ne diraient
          rien, et l'état se lit déjà au fond et au libellé. */}
      <IconeParametres size={16} />
      {!retractee && <span>Paramètres</span>}
    </button>
  );
}
