import { ChangeEvent, useRef } from 'react';
import { Import, Settings } from 'lucide-react';

// Pied de la barre latérale : QUI est chargé, et les deux gestes qui s'y
// rapportent — changer de compte, régler l'application.
//
// ⚠️ **Le nom du joueur en premier.** On jongle entre plusieurs exports (le
// sien, celui d'un ami dont on compare les runes) et rien ne disait lequel
// était affiché. Une date d'import ne suffit pas : deux comptes importés le
// même jour se ressemblent.
//
// ⚠️ **L'avatar est une INITIALE, pas une image.** L'export SWEX ne porte
// aucune photo de profil, et le jeu n'expose pas celle du joueur. Une initiale
// sur fond teinté distingue deux comptes d'un coup d'œil sans rien inventer —
// là où un pictogramme générique serait le même pour tous.
export default function SidebarCompte({
  nom,
  retractee,
  parametresActifs,
  onImport,
}: {
  // `null` = aucun compte chargé. L'avatar cède alors la place au seul geste
  // qui vaille : importer.
  nom: string | null;
  retractee: boolean;
  parametresActifs: boolean;
  // Reçoit le contenu du fichier choisi. ⚠️ Le composant porte son propre
  // `<input type="file">` : le sélecteur natif ne s'ouvre que depuis un vrai
  // clic utilisateur, et le relayer à travers un parent aurait ajouté une ref
  // et un effet pour rien.
  onImport: (texte: string) => void;
}) {
  const fichier = useRef<HTMLInputElement>(null);

  async function choisir(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // permet de réimporter le même fichier
    if (!f) return;
    onImport(await f.text());
  }

  const champ = (
    <input
      ref={fichier}
      type="file"
      accept=".json,application/json"
      onChange={choisir}
      className="hidden"
    />
  );
  // Rétractée, la barre ne garde que l'avatar — il tient dans 52 px, et c'est
  // la seule chose du pied qui reste identifiable à cette taille.
  if (retractee) {
    return (
      <div className="flex flex-col items-center gap-1">
        {champ}
        {nom && <Avatar nom={nom} />}
        <button
          type="button"
          onClick={() => fichier.current?.click()}
          title="Importer un export de compte SWEX"
          aria-label="Importer un compte"
          className="flex aspect-square h-8 w-8 items-center justify-center rounded-lg text-ink-dim
                     transition-colors hoverable:bg-panel2 hoverable:text-ink"
        >
          <Import size={16} />
        </button>
        <a
          href="#/parametres"
          title="Paramètres"
          aria-label="Paramètres"
          className={`flex aspect-square h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            parametresActifs
              ? 'bg-ctx-soft text-ctx'
              : 'text-ink-dim hoverable:bg-panel2 hoverable:text-ink'
          }`}
        >
          <Settings size={16} />
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {champ}
      {nom ? (
        <>
          <Avatar nom={nom} />
          {/* `min-w-0` + `truncate` : un pseudo long ne doit pas pousser les
              deux boutons hors de la barre. */}
          <span className="min-w-0 flex-1 truncate text-sm text-ink" title={nom}>
            {nom}
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-ink-dimmer">
          Aucun compte
        </span>
      )}

      {/* ⚠️ Deux boutons NUS, alignés à droite : ils accompagnent le nom, ils
          ne sont pas des destinations de la navigation. Encadrés, ils se
          liraient comme deux entrées de plus dans la liste au-dessus.
          ⚠️ Une icône d'IMPORT, pas trois points : « … » annonce un menu de
          plusieurs choix, alors qu'il n'y a qu'une action ici. On cliquait en
          s'attendant à une liste. */}
      <button
        type="button"
        onClick={() => fichier.current?.click()}
        title="Importer un export de compte SWEX (traité localement, rien n'est envoyé)"
        aria-label="Importer un compte"
        className="flex aspect-square h-8 w-8 flex-none items-center justify-center rounded-md text-ink-dim
                   transition-colors hoverable:bg-panel2 hoverable:text-ink"
      >
        <Import size={16} />
      </button>
      <a
        href="#/parametres"
        title="Paramètres"
        aria-label="Paramètres"
        className={`flex aspect-square h-8 w-8 flex-none items-center justify-center rounded-md
                    transition-colors ${
                      parametresActifs
                        ? 'bg-ctx-soft text-ctx'
                        : 'text-ink-dim hoverable:bg-panel2 hoverable:text-ink'
                    }`}
      >
        <Settings size={16} />
      </a>
    </div>
  );
}

// Pastille d'initiale. La teinte suit l'ACCENT CONTEXTUEL : sur la fiche d'un
// monstre d'eau, tout l'écran vire au bleu, l'avatar compris.
function Avatar({ nom }: { nom: string }) {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 flex-none items-center justify-center rounded-full
                 bg-ctx-soft text-xs font-bold uppercase text-ctx"
    >
      {nom.trim().charAt(0)}
    </span>
  );
}
