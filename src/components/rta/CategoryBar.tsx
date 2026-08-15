import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff } from 'lucide-react';
import { Monster } from '../../types';
import MonsterAvatar from '../MonsterAvatar';
import { RtaCategory, UseRtaCategories, MAX_CATEGORIES_PER_MONSTER } from '../../hooks/useRtaCategories';
import { ConfirmDialog } from '../Dialogs';

// Palette FERMÉE plutôt qu'un sélecteur de couleur libre : le contrôle natif
// (`<input type="color">`) est un composant du système, hors charte, et un choix
// libre laisse composer des teintes trop proches — indistinguables sur l'anneau.
// Ces douze-là sont franches et se séparent bien sur fond sombre.
const PALETTE = [
  '#e8593d', '#f2884c', '#f2c24c', '#a8d84a',
  '#5edb8f', '#4ad8d8', '#3fa9f5', '#5b78e0',
  '#a15fe0', '#c79bff', '#ff8fc7', '#8890b8',
];

function nextColor(used: string[]): string {
  return PALETTE.find((c) => !used.includes(c.toLowerCase())) ?? PALETTE[0];
}

// « #rrggbb » + opacité → rgba(), pour teinter un fond sans écraser le texte.
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

interface Props {
  cats: UseRtaCategories;
  monsters: Monster[]; // monstres présents sur la page (prépa RTA)
}

// Catégories libres de la prépa RTA : créer, éditer, et affecter des monstres.
// Cliquer une catégorie ouvre en dessous la liste des monstres de la page ; on
// les sélectionne au clic. Voir ../../spec/rta/categories.md.
export default function CategoryBar({ cats, monsters }: Props) {
  const [openId, setOpenId] = useState<string | null>(null); // catégorie dépliée
  const [editId, setEditId] = useState<string | null>(null); // catégorie en édition
  const [creating, setCreating] = useState(false);
  const [aSupprimer, setASupprimer] = useState<{ id: string; label: string } | null>(null);

  const open = cats.categories.find((c) => c.id === openId) ?? null;
  // Effectif AFFICHÉ = membres réellement présents dans la prépa. Un monstre
  // retiré de la page garde son appartenance (il peut revenir), mais le compter
  // donnerait une pastille qui ne correspond à rien à l'écran.
  const presents = new Set(monsters.map((m) => String(m.id)));
  const countOf = (c: RtaCategory) => c.members.filter((id) => presents.has(id)).length;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="label mr-1">
          Catégories
        </span>

        {cats.categories.map((c) => (
          /* Pilule : point de couleur, nom, puis édition et suppression.
             ⚠️ **Tous les éléments de la barre font la même hauteur (`h-7`)** —
             pilules, bouton d'ajout, interrupteur. Des hauteurs différentes
             donnaient une rangée en dents de scie.
             Le cadre porte le style et les boutons sont transparents à
             l'intérieur : aucune couture entre eux, et pas de bouton imbriqué
             dans un bouton (HTML invalide). */
          <div key={c.id} className="relative">
            <div
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border pl-2.5 pr-1 transition ${
                openId === c.id
                  ? 'border-accent bg-panel2'
                  : 'border-border bg-panel hoverable:border-accent'
              }`}
            >
              <button
                onClick={() => setOpenId((o) => (o === c.id ? null : c.id))}
                aria-expanded={openId === c.id}
                title="Choisir les monstres de cette catégorie"
                className="flex h-full items-center gap-1.5 text-[12px] font-semibold text-ink"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </button>
              <button
                onClick={() => setEditId((e) => (e === c.id ? null : c.id))}
                title="Renommer / changer la couleur"
                aria-label={`Éditer ${c.label}`}
                className="flex items-center justify-center w-5 h-5 rounded-full text-ink-dim transition hoverable:text-ink hoverable:bg-black/25"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => setASupprimer({ id: c.id, label: c.label })}
                title="Supprimer la catégorie"
                aria-label={`Supprimer ${c.label}`}
                className="flex items-center justify-center w-5 h-5 rounded-full text-ink-dim transition hoverable:text-fire hoverable:bg-black/25"
              >
                <Trash2 size={11} />
              </button>
            </div>

            {editId === c.id && (
              <CategoryPopover
                initial={c}
                onClose={() => setEditId(null)}
                onSubmit={(label, color) => {
                  cats.rename(c.id, label, color);
                  setEditId(null);
                }}
              />
            )}
          </div>
        ))}

        <div className="relative">
          <button
            onClick={() => setCreating((v) => !v)}
            aria-expanded={creating}
            className="flex h-7 items-center gap-1 rounded-full border border-dashed border-border
                       bg-transparent px-2.5 text-[12px] text-ink-dim transition
                       hoverable:text-ink hoverable:border-accent hoverable:bg-panel2"
          >
            <Plus size={12} /> Catégorie
          </button>
          {creating && (
            <CategoryPopover
              initial={{ label: '', color: nextColor(cats.categories.map((x) => x.color.toLowerCase())) }}
              onClose={() => setCreating(false)}
              onSubmit={(label, color) => {
                cats.add(label, color);
                setCreating(false);
              }}
            />
          )}
        </div>

        {/* Interrupteurs d'affichage, poussés à droite. On coupe le bruit sans
            rien perdre : les catégories et les vitesses restent, seul le rendu
            disparaît. */}
        <button
          onClick={() => cats.setShowSpeeds(!cats.showSpeeds)}
          aria-pressed={cats.showSpeeds}
          title={
            cats.showSpeeds
              ? 'Masquer les vitesses sur les cartes'
              : 'Réafficher les vitesses sur les cartes'
          }
          className={`ml-auto flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition ${
            cats.showSpeeds
              ? 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
              : // Fond seul — voir spec/shared/design.md.
                'border-border bg-accent-soft text-ink'
          }`}
        >
          {cats.showSpeeds ? <Eye size={12} /> : <EyeOff size={12} />}
          Vitesses
        </button>

        <button
          onClick={() => cats.setMarkDesync(!cats.markDesync)}
          aria-pressed={cats.markDesync}
          title={
            cats.markDesync
              ? 'Ne plus signaler les monstres dont les runes ne suivent plus la vitesse demandée'
              : 'Signaler en orange les monstres dont les runes ne suivent plus'
          }
          className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition ${
            cats.markDesync
              ? 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
              : // Fond seul — voir spec/shared/design.md.
                'border-border bg-accent-soft text-ink'
          }`}
        >
          {cats.markDesync ? <Eye size={12} /> : <EyeOff size={12} />}
          Modifiés
        </button>

        {/* ⚠️ Toujours affiché, même sans aucune catégorie : les trois
            interrupteurs forment un groupe fixe. Un bouton qui apparaît et
            disparaît fait sauter la rangée et donne l'impression d'un réglage
            qu'on aurait perdu. */}
        <button
          onClick={() => cats.setVisible(!cats.visible)}
          aria-pressed={cats.visible}
          title={
            cats.visible
              ? 'Masquer les couleurs sur les cartes et l’ordre de tour'
              : 'Réafficher les couleurs'
          }
          className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition ${
            cats.visible
              ? 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
              : // Fond seul — voir spec/shared/design.md.
                'border-border bg-accent-soft text-ink'
          }`}
        >
          {cats.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          Catégories
        </button>
      </div>

      {/* Panneau d'affectation : tous les monstres de la page. */}
      {open && (
        <div
          // Le panneau se pose au lieu de surgir : il s'ouvre SOUS la rangée de
          // catégories et pousse le contenu, un apparaître sec fait sauter la
          // page. Pas de `scale` — il arrive à sa taille définitive.
          className="mt-2 rounded-xl border p-3 animate-[apparition_180ms_var(--ease-out)]"
          style={{
            borderColor: withAlpha(open.color, 0.5),
            // Le panneau reprend la teinte de la catégorie ouverte : on sait
            // toujours dans laquelle on est en train de cocher.
            backgroundColor: withAlpha(open.color, 0.07),
          }}
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: open.color }} />
            <span className="text-[13px] font-semibold text-ink">{open.label}</span>
            <span className="font-mono text-[11px] text-ink-dim">
              {countOf(open)} monstre{countOf(open) > 1 ? 's' : ''}
            </span>
            {countOf(open) > 0 && (
              <button
                onClick={() => cats.clearMembers(open.id)}
                className="ml-auto flex h-6 items-center gap-1 rounded-full border border-border bg-panel
                           px-2 text-[11px] text-ink-dim transition hoverable:border-fire/60 hoverable:text-fire"
                title="Retirer tous les monstres de cette catégorie"
              >
                <X size={11} /> Tout décocher
              </button>
            )}
            <button
              onClick={() => setOpenId(null)}
              className={`${countOf(open) > 0 ? '' : 'ml-auto '}text-ink-dim hoverable:text-ink transition`}
              title="Fermer"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>

          {monsters.length === 0 ? (
            <p className="text-[12.5px] text-ink-dim">
              Aucun monstre dans ta prépa : ajoute-en d'abord ci-dessus.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {monsters.map((m) => {
                const id = String(m.id);
                const dedans = open.members.includes(id);
                // Plafond atteint ailleurs : on montre le monstre mais on
                // explique pourquoi il est refusé, plutôt que de le cacher.
                const bloque = !dedans && !cats.canAssign(id);
                return (
                  <button
                    key={id}
                    onClick={() => cats.toggleMember(open.id, id)}
                    disabled={bloque}
                    aria-pressed={dedans}
                    title={
                      bloque
                        ? `${m.name} — déjà ${MAX_CATEGORIES_PER_MONSTER} catégories (maximum)`
                        : dedans
                          ? `Retirer ${m.name} de « ${open.label} »`
                          : `Ajouter ${m.name} à « ${open.label} »`
                    }
                    className={`relative flex w-[72px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition ${
                      bloque
                        ? 'opacity-25 cursor-not-allowed'
                        : dedans
                          ? ''
                          : 'opacity-70 hoverable:opacity-100 hoverable:bg-panel2'
                    }`}
                    style={
                      dedans
                        ? { boxShadow: `0 0 0 1.5px ${open.color}`, backgroundColor: withAlpha(open.color, 0.2) }
                        : undefined
                    }
                  >
                    {/* ⚠️ Pas de pastille d'élément ici, mais le NOM sous le
                        portrait : l'élément ne se distingue que par sa couleur,
                        illisible pour un daltonien. Le nom, lui, identifie le
                        monstre quelle que soit la vision des couleurs. */}
                    <MonsterAvatar monster={m} size={36} element={false} />
                    <span className="w-full truncate text-center text-[10px] leading-tight text-ink-dim">
                      {m.name}
                    </span>
                    {dedans && (
                      <span
                        className="absolute top-0.5 right-0.5 flex items-center justify-center w-3 h-3 rounded-full"
                        style={{ backgroundColor: open.color }}
                      >
                        <Check size={8} className="text-bg" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {aSupprimer && (
        <ConfirmDialog
          titre={`Supprimer la catégorie « ${aSupprimer.label} » ?`}
          message="Elle disparaît de la barre et des anneaux de couleur. Les monstres qui la portaient ne sont pas retirés de ta prépa."
          libelleAction="Supprimer"
          destructif
          onCancel={() => setASupprimer(null)}
          onConfirm={() => {
            cats.remove(aSupprimer.id);
            if (openId === aSupprimer.id) setOpenId(null);
            setASupprimer(null);
          }}
        />
      )}
    </div>
  );
}

// Saisie d'une catégorie : titre + couleur, dans une **popup flottante**.
//
// ⚠️ **Elle est en `absolute`, hors du flux.** Un formulaire inséré dans la
// rangée poussait les pilules suivantes et décalait toute la page à chaque
// ouverture — désagréable, et on perdait de vue la pilule qu'on éditait.
function CategoryPopover({
  initial,
  onSubmit,
  onClose,
}: {
  initial: { label: string; color: string };
  onSubmit: (label: string, color: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [color, setColor] = useState(initial.color);
  const ref = useRef<HTMLFormElement>(null);

  // Fermeture au clic extérieur et à Échap, comme les autres menus de l'app.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(label, color);
      }}
      className="absolute z-30 left-0 top-full mt-1.5 w-[220px] rounded-xl border border-border
                 bg-panel p-2.5 shadow-glow shadow-black/60"
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-4 h-4 rounded-full flex-none border border-black/30"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Striper, Lead SPD…"
          maxLength={24}
          className="min-w-0 flex-1 bg-panel2 border border-border rounded-md px-2 py-1 text-[12px] text-ink
                     outline-none focus:border-accent placeholder:text-ink-dim"
        />
      </div>

      <div className="mt-2 grid grid-cols-6 gap-1">
        {PALETTE.map((c) => {
          const actif = c.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Couleur ${c}`}
              aria-pressed={actif}
              className={`flex items-center justify-center h-6 rounded-md transition ${
                actif
                  ? 'ring-2 ring-ink ring-offset-2 ring-offset-panel'
                  : 'opacity-80 hoverable:opacity-100 hoverable:-translate-y-px'
              }`}
              style={{ backgroundColor: c }}
            >
              {actif && <Check size={12} className="text-bg drop-shadow" />}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="submit"
          disabled={!label.trim()}
          className="flex-1 rounded-md bg-accent-soft px-2 py-1
                     text-[12px] font-semibold text-ink transition disabled:opacity-40"
        >
          Valider
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-2 py-1 text-[12px] text-ink-dim
                     transition hoverable:text-ink hoverable:border-accent"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
