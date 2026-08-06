import { useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';

interface Props {
  // Applique un export (RTA + siège défense + offense d'un coup).
  onImport: (text: string) => void;
  // Efface toutes les données locales.
  onClearData: () => void;
  variant: 'desktop' | 'mobile';
}

// Bouton d'import unique et invariant, dans la barre de navigation (desktop) et
// le menu (mobile). Chaque import ouvre le sélecteur de fichier ; le fichier
// choisi remplace le précédent et alimente toutes les pages. À côté : un lien
// « Supprimer mes données ».
export default function AccountImportControl({ onImport, onClearData, variant }: Props) {
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
            ? 'flex items-center gap-2 rounded-lg border border-border bg-panel2 px-3 py-3 text-[15px] font-semibold text-ink'
            : 'flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-[13px] font-semibold text-ink-dim hover:text-ink hover:border-[#4a52a0] transition whitespace-nowrap'
        }
      >
        <Upload size={isMobile ? 18 : 14} /> Importer mon compte
      </button>

      <button
        onClick={onClearData}
        title="Efface la prépa RTA, les équipes de siège et les monstres perso (stockés en local)"
        className={
          isMobile
            ? 'flex items-center gap-2 text-left px-3 py-1 text-[12px] text-ink-dim hover:text-fire transition'
            : 'flex items-center gap-1 font-mono text-[11px] text-ink-dim hover:text-fire transition whitespace-nowrap'
        }
      >
        <Trash2 size={isMobile ? 14 : 12} /> Supprimer mes données
      </button>
    </div>
  );
}
