import { useCallback, useEffect, useState } from 'react';
import { Monster } from '../types';
import { speedLeadOf } from '../lib/speed';

// Catégories libres de la prépa RTA : l'utilisateur crée ses propres étiquettes
// (« Striper », « Lead SPD », « AoE »…) avec une couleur, et les applique à ses
// monstres. Les cartes concernées portent alors un anneau de cette couleur.
//
// Pourquoi côté joueur : une box RTA se lit par RÔLE, pas seulement par set de
// runes. Les sections existantes classent par set ; les catégories permettent
// une seconde lecture, transversale, que chacun définit comme il veut.

const KEY = 'sw-forge-rta-categories-v1';

// ⚠️ Au-delà de 4, l'anneau devient illisible : les segments sont trop courts
// pour qu'on distingue les couleurs sur une carte de cette taille. C'est une
// limite d'AFFICHAGE, assumée, pas une limite de modèle.
export const MAX_CATEGORIES_PER_MONSTER = 4;

export interface RtaCategory {
  id: string;
  label: string;
  color: string; // « #rrggbb »
  members: string[]; // monsterId (id local, comme les entrées RTA)
}

export interface UseRtaCategories {
  categories: RtaCategory[];
  visible: boolean; // les anneaux sont-ils affichés ?
  setVisible: (v: boolean) => void;
  add: (label: string, color: string) => void;
  rename: (id: string, label: string, color: string) => void;
  remove: (id: string) => void;
  toggleMember: (id: string, monsterId: string) => void;
  clearMembers: (id: string) => void;
  // Catégories d'un monstre, dans l'ordre de création (donc stable à l'écran).
  categoriesOf: (monsterId: string) => RtaCategory[];
  // Peut-on encore en ajouter une à ce monstre ?
  canAssign: (monsterId: string) => boolean;
  // Amorce la catégorie « Lead SPD » à la première prépa non vide.
  ensureDefault: (monsters: Monster[]) => void;
}

// Catégorie proposée d'office : c'est le classement que tout le monde fait de
// tête en RTA, autant le donner déjà fait.
const DEFAULT_LABEL = 'Lead SPD';
const DEFAULT_COLOR = '#4ad8d8';

const uid = () => Math.random().toString(36).slice(2, 10);

interface Stored {
  categories: RtaCategory[];
  seeded: boolean; // la catégorie par défaut a déjà été proposée
  visible: boolean;
}

function cleanCategory(c: unknown): RtaCategory | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.slice(0, 24) : '';
  const color = typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : null;
  if (!label || !color) return null;
  return {
    id: typeof o.id === 'string' ? o.id : uid(),
    label,
    color,
    members: Array.isArray(o.members) ? o.members.filter((m) => typeof m === 'string') : [],
  };
}

function load(): Stored {
  const vide: Stored = { categories: [], seeded: false, visible: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return vide;
    const parsed = JSON.parse(raw);
    // Ancienne forme : un simple tableau de catégories.
    // ⚠️ `seeded` reste FAUX : un joueur qui avait déjà des catégories avant
    // l'arrivée de « Lead SPD » doit lui aussi se la voir proposer. La marquer
    // comme déjà amorcée la lui aurait supprimée avant même de l'avoir vue.
    if (Array.isArray(parsed)) {
      return { ...vide, categories: parsed.map(cleanCategory).filter((c): c is RtaCategory => !!c) };
    }
    if (!parsed || typeof parsed !== 'object') return vide;
    const o = parsed as Record<string, unknown>;
    return {
      categories: Array.isArray(o.categories)
        ? o.categories.map(cleanCategory).filter((c): c is RtaCategory => !!c)
        : [],
      seeded: o.seeded === true,
      visible: o.visible !== false, // affiché par défaut
    };
  } catch {
    return vide;
  }
}

export function useRtaCategories(): UseRtaCategories {
  const [state, setState] = useState<Stored>(load);
  const { categories, visible } = state;
  const setCategories = useCallback(
    (fn: (cs: RtaCategory[]) => RtaCategory[]) =>
      setState((st) => ({ ...st, categories: fn(st.categories) })),
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota plein : on ne casse pas la page pour autant */
    }
  }, [state]);

  const setVisible = useCallback((v: boolean) => setState((st) => ({ ...st, visible: v })), []);

  // Amorçage UNE SEULE FOIS, à la première prépa non vide : au tout premier
  // chargement la prépa est souvent vide (compte pas encore importé), une
  // catégorie créée à ce moment-là resterait éternellement sans personne.
  // Ensuite elle vit sa vie : le joueur la renomme, la vide ou la supprime.
  const ensureDefault = useCallback((monsters: Monster[]) => {
    setState((st) => {
      if (st.seeded || monsters.length === 0) return st;
      const membres = monsters
        .filter((m) => speedLeadOf(m) !== null)
        .map((m) => String(m.id));
      if (membres.length === 0) return st; // rien à y mettre : on réessaiera
      return {
        ...st,
        seeded: true,
        categories: [
          ...st.categories,
          { id: uid(), label: DEFAULT_LABEL, color: DEFAULT_COLOR, members: membres },
        ],
      };
    });
  }, []);

  const add = useCallback((label: string, color: string) => {
    const clean = label.trim().slice(0, 24);
    if (!clean) return;
    setCategories((cs) => [...cs, { id: uid(), label: clean, color, members: [] }]);
  }, []);

  const rename = useCallback((id: string, label: string, color: string) => {
    const clean = label.trim().slice(0, 24);
    if (!clean) return;
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, label: clean, color } : c)));
  }, []);

  const remove = useCallback(
    (id: string) => setCategories((cs) => cs.filter((c) => c.id !== id)),
    []
  );

  const toggleMember = useCallback((id: string, monsterId: string) => {
    setCategories((cs) => {
      const target = cs.find((c) => c.id === id);
      if (!target) return cs;
      const dedans = target.members.includes(monsterId);
      // Plafond vérifié À L'AJOUT seulement : retirer doit toujours marcher, y
      // compris sur un monstre qui aurait dépassé le plafond (données bricolées).
      if (!dedans) {
        const deja = cs.filter((c) => c.members.includes(monsterId)).length;
        if (deja >= MAX_CATEGORIES_PER_MONSTER) return cs;
      }
      return cs.map((c) =>
        c.id !== id
          ? c
          : {
              ...c,
              members: dedans
                ? c.members.filter((m) => m !== monsterId)
                : [...c.members, monsterId],
            }
      );
    });
  }, []);

  // Vider une catégorie sans la supprimer : on garde le libellé et la couleur
  // pour repartir de zéro, plutôt que de décocher les monstres un par un.
  const clearMembers = useCallback(
    (id: string) => setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, members: [] } : c))),
    []
  );

  const categoriesOf = useCallback(
    (monsterId: string) => categories.filter((c) => c.members.includes(monsterId)),
    [categories]
  );

  const canAssign = useCallback(
    (monsterId: string) =>
      categories.filter((c) => c.members.includes(monsterId)).length < MAX_CATEGORIES_PER_MONSTER,
    [categories]
  );

  return {
    categories,
    visible,
    setVisible,
    add,
    rename,
    remove,
    toggleMember,
    clearMembers,
    categoriesOf,
    canAssign,
    ensureDefault,
  };
}
