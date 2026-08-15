import { useCallback, useEffect, useState } from 'react';
import { Monster } from '../types';
import { speedLeadOf } from '../lib/speed';
import { saveLocal, usePersistence } from './usePersistence';

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
  showSpeeds: boolean; // les vitesses sont-elles affichées sur les cartes ?
  setShowSpeeds: (v: boolean) => void;
  markDesync: boolean; // signaler en orange les monstres dont les runes ne suivent plus
  setMarkDesync: (v: boolean) => void;
  add: (label: string, color: string) => void;
  rename: (id: string, label: string, color: string) => void;
  remove: (id: string) => void;
  toggleMember: (id: string, monsterId: string) => void;
  clearMembers: (id: string) => void;
  // Catégories d'un monstre, dans l'ordre de création (donc stable à l'écran).
  //
  // ⚠️ Ne renvoie que les catégories VISIBLES : c'est ce que les cartes et
  // l'ordre de tour affichent. Le panneau d'affectation, lui, doit voir toutes
  // les catégories — il passe donc par `categories` directement.
  categoriesOf: (monsterId: string) => RtaCategory[];
  /** Une catégorie est-elle affichée sur les cartes ? */
  estVisible: (id: string) => boolean;
  /** Affiche/masque UNE catégorie, sans toucher aux autres. */
  toggleVisible: (id: string) => void;
  /** Réaffiche toutes les catégories masquées. */
  toutAfficher: () => void;
  /** N'affiche QUE celle-ci — le geste « je veux voir mes strippers ». */
  isoler: (id: string) => void;
  // Peut-on encore en ajouter une à ce monstre ?
  canAssign: (monsterId: string) => boolean;
  // Amorce la catégorie « Lead SPD » à la première prépa non vide.
  ensureDefault: (monsters: Monster[]) => void;
  // Remplace TOUTES les catégories (restauration d'un point, import d'une prépa).
  replaceAll: (cats: { label: string; color: string; members: string[] }[]) => void;
}

// Catégorie proposée d'office : c'est le classement que tout le monde fait de
// tête en RTA, autant le donner déjà fait.
const DEFAULT_LABEL = 'Lead SPD';
const DEFAULT_COLOR = '#4ad8d8';

// ⚠️ Un lead ne compte ici que s'il s'applique EN RTA, sans condition :
// portée **General** (partout) ou **Arena**. Sont donc exclus les leads de
// **guilde** et de **donjon** (mauvais contenu), mais aussi les leads
// **élémentaires** — ils ne profitent qu'aux alliés du bon élément, donc les
// ranger avec les leads inconditionnels induirait en erreur au moment de
// composer une équipe.
const RTA_LEAD_AREAS = new Set(['General', 'Arena']);

function hasRtaSpeedLead(m: Monster): boolean {
  const lead = speedLeadOf(m);
  return !!lead && RTA_LEAD_AREAS.has(lead.area);
}

const uid = () => Math.random().toString(36).slice(2, 10);

interface Stored {
  categories: RtaCategory[];
  seeded: boolean; // la catégorie par défaut a déjà été proposée
  visible: boolean;
  showSpeeds: boolean;
  markDesync: boolean;
  // Catégories masquées, par id.
  //
  // ⚠️ On stocke les MASQUÉES et non les visibles : une catégorie qu'on vient de
  // créer doit s'afficher sans qu'on ait à la cocher. Avec la liste inverse, il
  // aurait fallu penser à l'y ajouter à chaque création — et un oubli l'aurait
  // rendue invisible sans raison apparente.
  masquees: string[];
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
  const vide: Stored = {
    categories: [],
    seeded: false,
    visible: true,
    showSpeeds: true,
    markDesync: true,
    masquees: [],
  };
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
      showSpeeds: o.showSpeeds !== false,
      markDesync: o.markDesync !== false,
      masquees: Array.isArray(o.masquees)
        ? o.masquees.filter((m): m is string => typeof m === 'string')
        : [],
    };
  } catch {
    return vide;
  }
}

export function useRtaCategories(): UseRtaCategories {
  const [state, setState] = useState<Stored>(load);
  const { categories, visible, showSpeeds, markDesync, masquees } = state;
  const setCategories = useCallback(
    (fn: (cs: RtaCategory[]) => RtaCategory[]) =>
      setState((st) => ({ ...st, categories: fn(st.categories) })),
    []
  );

  const persist = usePersistence();
  useEffect(() => {
    saveLocal(KEY, JSON.stringify(state));
  }, [state, persist]);

  const setVisible = useCallback((v: boolean) => setState((st) => ({ ...st, visible: v })), []);
  const setShowSpeeds = useCallback(
    (v: boolean) => setState((st) => ({ ...st, showSpeeds: v })),
    []
  );
  const setMarkDesync = useCallback(
    (v: boolean) => setState((st) => ({ ...st, markDesync: v })),
    []
  );

  // Amorçage UNE SEULE FOIS, à la première prépa non vide : au tout premier
  // chargement la prépa est souvent vide (compte pas encore importé), une
  // catégorie créée à ce moment-là resterait éternellement sans personne.
  // Ensuite elle vit sa vie : le joueur la renomme, la vide ou la supprime.
  const ensureDefault = useCallback((monsters: Monster[]) => {
    setState((st) => {
      if (st.seeded || monsters.length === 0) return st;
      const membres = monsters.filter(hasRtaSpeedLead).map((m) => String(m.id));
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

  // Remplacement en bloc — restauration d'un point de sauvegarde, ou import
  // d'une prépa reçue. Les ids sont RÉGÉNÉRÉS : ils n'ont de sens que localement
  // et ne voyagent pas dans un fichier partagé.
  //
  // ⚠️ `seeded` passe à VRAI : sans ça, « Lead SPD » se réamorcerait par-dessus
  // ce qu'on vient de restaurer, et réapparaîtrait précisément chez qui l'avait
  // supprimée avant de sauvegarder.
  const replaceAll = useCallback((cats: { label: string; color: string; members: string[] }[]) => {
    setState((st) => ({
      ...st,
      seeded: true,
      categories: cats
        .map((c) => cleanCategory({ ...c, id: uid() }))
        .filter((c): c is RtaCategory => !!c),
      // Les ids changent : les anciennes masquées ne désignent plus rien. On
      // repart donc tout visible, ce qui est aussi le plus lisible après une
      // restauration — on voit ce qu'on vient de récupérer.
      masquees: [],
    }));
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

  // ⚠️ L'id sort AUSSI des masquées : sans ça, une catégorie supprimée puis
  // recréée sous le même id (improbable mais gratuit à couvrir) reviendrait
  // masquée, et la liste grossirait indéfiniment d'ids morts.
  const remove = useCallback(
    (id: string) =>
      setState((st) => ({
        ...st,
        categories: st.categories.filter((c) => c.id !== id),
        masquees: st.masquees.filter((m) => m !== id),
      })),
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

  // ⚠️ Filtre les catégories MASQUÉES : c'est ce que les cartes et l'ordre de
  // tour affichent. Le panneau d'affectation lit `categories` directement — on
  // doit pouvoir ranger un monstre dans une catégorie qu'on a masquée.
  const categoriesOf = useCallback(
    (monsterId: string) =>
      categories.filter((c) => c.members.includes(monsterId) && !masquees.includes(c.id)),
    [categories, masquees]
  );

  const estVisible = useCallback((id: string) => !masquees.includes(id), [masquees]);

  const toggleVisible = useCallback(
    (id: string) =>
      setState((st) => ({
        ...st,
        masquees: st.masquees.includes(id)
          ? st.masquees.filter((m) => m !== id)
          : [...st.masquees, id],
      })),
    []
  );

  const toutAfficher = useCallback(() => setState((st) => ({ ...st, masquees: [] })), []);

  // ⚠️ « Isoler » masque TOUTES les autres, il ne fait pas qu'afficher celle-ci :
  // c'est le geste « montre-moi seulement mes strippers », qui demanderait
  // sinon de masquer les cinq autres une par une.
  const isoler = useCallback(
    (id: string) =>
      setState((st) => ({
        ...st,
        masquees: st.categories.filter((c) => c.id !== id).map((c) => c.id),
      })),
    []
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
    showSpeeds,
    setShowSpeeds,
    markDesync,
    setMarkDesync,
    add,
    rename,
    remove,
    toggleMember,
    clearMembers,
    categoriesOf,
    estVisible,
    toggleVisible,
    toutAfficher,
    isoler,
    canAssign,
    ensureDefault,
    replaceAll,
  };
}
