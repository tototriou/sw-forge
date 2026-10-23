import { classeMessageImport, type MessageImport } from '../../../lib/messageImport';

export interface MessageImportRecetteProps {
  message: MessageImport | null;
}

// Le message d'import d'une recette : sa couleur suit le message (succès,
// avertissement de conversion, refus), voir `classeMessageImport`.
export default function MessageImportRecette({ message }: MessageImportRecetteProps) {
  if (!message) return null;
  return (
    <p className={`text-[12.5px] ${classeMessageImport(message)}`} role="status">
      {message.text}
    </p>
  );
}
