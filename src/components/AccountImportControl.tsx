import { useRef } from 'react';
import { Import } from 'lucide-react';

interface Props {
  // Applique un export (RTA + siège défense + offense d'un coup).
  onImport: (text: string) => void;
  variant: 'desktop' | 'mobile';
}

// Bouton d'import unique et invariant, dans la barre de navigation (desktop) et
// le menu (mobile). Chaque import ouvre le sélecteur de fichier ; le fichier
// choisi remplace le précédent et alimente toutes les pages.
//
// ⚠️ « Supprimer mes données » n'est plus ici mais dans le menu ⚙ : une action
// destructrice collée au bouton qu'on utilise le plus souvent finit par être
// cliquée de travers.
export default function AccountImportControl({ onImport, variant }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de réimporter (même fichier ou un autre)
    if (!file) return;
    const text = await file.text();
    onImport(text);
  }

  const isMobile = variant === 'mobile';

  return (
    <div className={isMobile ? 'flex flex-col gap-1' : 'flex items-center gap-2'}>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => fileInput.current?.click()}
        title="Importer un export de compte SWEX (traité localement, rien n'est envoyé)"
        className={
          isMobile
            ? 'flex items-center gap-2 rounded-lg border border-border bg-panel2 px-3 py-3 text-base font-semibold text-ink'
            : 'flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-sm font-semibold text-ink-dim hoverable:text-ink hoverable:border-accent transition whitespace-nowrap'
        }
      >
        <Import size={isMobile ? 18 : 14} className="flex-none" /> Importer un JSON
      </button>

    </div>
  );
}
