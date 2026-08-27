import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { OptimizerList } from '../../lib/optimizerExclusion';
import { ConfirmDialog, Flottant, PromptDialog } from '../../ui';

interface Props {
  lists: OptimizerList[];
  activeListId: string | null;
  memberCounts: Record<string, number>;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

// « Liste active » (Lot 3) — menu déroulant, jamais de liste fixe (Box/RTA/
// Défense siège ne sont plus des cas spéciaux, voir spec/outils/optimizer/
// historique-import-monstres-a-optimiser.md, « Suite — cadrage du Lot 3 ») :
// tout est créé, renommé, supprimé par l'utilisateur. Flotte par-dessus zone
// C au lieu de la repousser (voir spec/shared/design.md, « un clic ne
// déplace jamais ce qu'on vient de cliquer »).
export default function OptimizerListPicker({ lists, activeListId, memberCounts, onSelect, onCreate, onRename, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [promptFor, setPromptFor] = useState<'create' | { renameId: string; name: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const active = lists.find((l) => l.id === activeListId) ?? null;
  const deleteTarget = confirmDeleteId ? lists.find((l) => l.id === confirmDeleteId) : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-lg border bg-panel2 px-2.5 py-2 text-[13px] font-semibold transition
          ${open ? 'border-accent text-ink' : 'border-border-soft text-ink hoverable:border-accent/50'}`}
      >
        <span className="flex items-center gap-2 truncate">
          {active && <span className="h-2 w-2 flex-none rounded-full bg-accent" />}
          <span className="truncate">{active ? active.name : 'Aucune liste — choisir ou créer'}</span>
        </span>
        <ChevronDown size={14} className={`flex-none text-ink-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <Flottant aria-label="Listes" rembourrage="aucun" className="max-h-[320px] overflow-y-auto">
          {lists.length === 0 && (
            <p className="px-3 py-2 text-[12px] text-ink-dim">Aucune liste — crée-en une pour commencer.</p>
          )}
          {lists.map((l) => (
            <div
              key={l.id}
              className={`flex items-center gap-2 px-3 py-2 hoverable:bg-accent-soft/60 ${l.id === activeListId ? 'bg-accent-soft' : ''}`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(l.id);
                  setOpen(false);
                }}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
              >
                <span className="truncate text-[12.5px] font-medium text-ink">{l.name}</span>
                <span className="flex-none text-[10.5px] text-ink-dim">
                  {memberCounts[l.id] ?? 0} monstre{(memberCounts[l.id] ?? 0) > 1 ? 's' : ''}
                </span>
              </button>
              <button
                type="button"
                title="Renommer cette liste"
                onClick={() => setPromptFor({ renameId: l.id, name: l.name })}
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded text-ink-dim hoverable:text-ink"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                title="Supprimer cette liste"
                onClick={() => setConfirmDeleteId(l.id)}
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded text-ink-dim hoverable:text-bad"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <div className="border-t border-border-soft">
            <button
              type="button"
              onClick={() => setPromptFor('create')}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] font-semibold text-accent hoverable:bg-accent-soft/60"
            >
              <Plus size={14} />
              Nouvelle liste&hellip;
            </button>
          </div>
        </Flottant>
      )}

      {promptFor && (
        <PromptDialog
          titre={promptFor === 'create' ? 'Nouvelle liste' : 'Renommer la liste'}
          valeurInitiale={promptFor === 'create' ? '' : promptFor.name}
          placeholder="ex. Deck A, Mon RTA…"
          libelleAction={promptFor === 'create' ? 'Créer' : 'Renommer'}
          onValider={(valeur) => {
            const nom = valeur.trim();
            if (!nom) {
              setPromptFor(null);
              return;
            }
            if (promptFor === 'create') onCreate(nom);
            else onRename(promptFor.renameId, nom);
            setPromptFor(null);
            setOpen(false);
          }}
          onCancel={() => setPromptFor(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          titre={`Supprimer « ${deleteTarget.name} » ?`}
          message="Ses monstres et ses éventuelles runes validées seront perdus. Les runes elles-mêmes ne sont pas touchées — seule cette liste de travail disparaît."
          libelleAction="Supprimer"
          destructif
          onConfirm={() => {
            onDelete(deleteTarget.id);
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
