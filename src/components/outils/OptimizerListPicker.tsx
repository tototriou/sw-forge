import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { OptimizerList } from '../../lib/optimizerExclusion';
import { Bouton, BoutonIcone, ZoneCliquable, ConfirmDialog, Flottant, PromptDialog } from '../../ui';
import type { ContenuListeOptimizer } from '../../lib/optimizerMemberStorage';
import OptimizerCreateListDialog, { ContenuListePicker, CONTENUS_LISTE_OPTIMIZER } from './OptimizerCreateListDialog';

interface Props {
  lists: OptimizerList[];
  activeListId: string | null;
  memberCounts: Record<string, number>;
  onSelect: (id: string) => void;
  onCreate: (name: string, contenu: ContenuListeOptimizer) => void;
  listContents: Map<string, ContenuListeOptimizer>;
  onContent: (id: string, contenu: ContenuListeOptimizer) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** Action posée au bout de la même ligne, alignée sur les deux menus. */
  action?: ReactNode;
}

// « Liste active » — menu déroulant, jamais de liste fixe (Box/RTA/
// Défense siège ne sont pas des cas spéciaux, voir
// docs/02-app/optimizer/,
// « Créer, valider et réserver dans une liste ») :
// tout est créé, renommé, supprimé par l'utilisateur. Flotte par-dessus zone
// C au lieu de la repousser (voir docs/03-developpeur/interface/, « un clic ne
// déplace jamais ce qu'on vient de cliquer »).
export default function OptimizerListPicker({ lists, activeListId, memberCounts, listContents, onContent, onSelect, onCreate, onRename, onDelete, action }: Props) {
  const [open, setOpen] = useState(false);
  const [promptFor, setPromptFor] = useState<'create' | { renameId: string; name: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // L'action partage la ligne mais ouvre son propre flottant : elle ferme la liste.
    const onDown = (e: MouseEvent) => {
      if (ref.current && (!ref.current.contains(e.target as Node) || actionRef.current?.contains(e.target as Node))) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const active = lists.find((l) => l.id === activeListId) ?? null;
  const deleteTarget = confirmDeleteId ? lists.find((l) => l.id === confirmDeleteId) : null;

  return (
    <div ref={ref}>
      {/* Les deux menus, et l'action éventuelle, partagent une ligne ; la
          liste des listes s'ouvre sous toute la ligne. Le contenu garde sa
          place sans liste active, désactivé. */}
      <div className={`relative grid items-end gap-2 ${action ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]'}`}>
        <div className="min-w-0">
          <p className="label mb-1.5">Liste active</p>
          <Bouton
            pleineLargeur fond="plein" trait="plein"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="[&>span]:w-full"
            libelle={<span className="flex items-center justify-between gap-2">
              <span className="truncate">{active ? active.name : 'Aucune liste — choisir ou créer'}</span>
              <ChevronDown size={14} className={`flex-none text-ink-dim transition-transform ${open ? 'rotate-180' : ''}`} />
            </span>}
          />
        </div>
        {/* Largeur fixe : la disparition de « Sans contenu » ne déplace rien. */}
        <div className="w-32">
          <p className="label mb-1.5">Contenu</p>
          <ContenuListePicker enLigne contenu={active ? listContents.get(active.id) : undefined}
            disabled={!active} onChange={contenu => active && onContent(active.id, contenu)} />
        </div>
        {action && <div ref={actionRef}>{action}</div>}

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
              <ZoneCliquable imbrique
                onClick={() => {
                  onSelect(l.id);
                  setOpen(false);
                }}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
              >
                <span className="truncate text-[12.5px] font-medium text-ink">{l.name} · {listContents.has(l.id) ? CONTENUS_LISTE_OPTIMIZER[listContents.get(l.id)!] : 'Sans contenu'}</span>
                <span className="flex-none text-[10.5px] text-ink-dim">
                  {memberCounts[l.id] ?? 0} monstre{(memberCounts[l.id] ?? 0) > 1 ? 's' : ''}
                </span>
              </ZoneCliquable>
              <BoutonIcone
                libelle="Renommer cette liste" icone={<Pencil size={13} />}
                onClick={() => setPromptFor({ renameId: l.id, name: l.name })}
              />
              <BoutonIcone
                libelle="Supprimer cette liste" icone={<Trash2 size={13} />} ton="danger"
                onClick={() => setConfirmDeleteId(l.id)}
              />
            </div>
          ))}
          <div className="border-t border-border-soft">
            <Bouton pleineLargeur fond="vide" ton="accent" icone={<Plus size={14} />} libelle="Nouvelle liste…"
              onClick={() => setPromptFor('create')}
            />
          </div>
        </Flottant>
      )}
      </div>
      {active && <p className={`mt-1 text-xs text-warn ${listContents.has(active.id) ? 'invisible' : ''}`} aria-hidden={listContents.has(active.id)}>
        Sans contenu : aucun lead d’équipe appliqué.
      </p>}

      {promptFor === 'create' && <OptimizerCreateListDialog
        onValider={(nom, contenu) => { onCreate(nom, contenu); setPromptFor(null); setOpen(false); }}
        onCancel={() => setPromptFor(null)} />}
      {promptFor && promptFor !== 'create' && (
        <PromptDialog
          titre="Renommer la liste"
          valeurInitiale={promptFor.name}
          placeholder="ex. Deck A, Mon RTA…"
          libelleAction="Renommer"
          onValider={(valeur) => {
            const nom = valeur.trim();
            if (!nom) {
              setPromptFor(null);
              return;
            }
            onRename(promptFor.renameId, nom);
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
