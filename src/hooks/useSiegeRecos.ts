import { useCallback, useEffect, useState } from 'react';
import {
  Reco,
  RecoDeck,
  RecoSlot,
  RecoPayload,
  RecoState,
  RecoStatKey,
  RUNE_SETS,
  emptyRecoDeck,
} from '../types';
import { canAddSet } from '../lib/effects';
import { cleanSetOptions } from '../lib/recoShare';
import { saveLocal, usePersistence } from './usePersistence';

const SET_KEYS = new Set(RUNE_SETS.map((s) => s.key));

// Recommandations de decks de siège. Contrairement à la box (en mémoire), ce
// sont des données CRÉÉES par l'utilisateur ou reçues d'un ami : elles sont
// persistées dans localStorage, comme les équipes de siège.
const STORAGE_KEY = 'sw-forge-siege-recos-v1';

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `r_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// Une nouvelle recommandation démarre avec un deck vide.
export function newReco(): Reco {
  return { id: newId(), origin: 'mine', name: '', author: '', note: '', decks: [emptyRecoDeck()] };
}

// Normalise un slot venant du stockage (types validés, stats numériques > 0).
function loadSlot(raw: unknown): RecoSlot {
  const s = (raw ?? {}) as Partial<RecoSlot>;
  const stats: Partial<Record<RecoStatKey, number>> = {};
  if (s.stats && typeof s.stats === 'object') {
    for (const [k, v] of Object.entries(s.stats)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) stats[k as RecoStatKey] = Math.ceil(n);
    }
  }
  // Possibilités de runage : contrainte de coût (≤ 6 runes) rejouée au
  // chargement, et lecture de l'ancienne forme `sets: string[]` (une seule
  // possibilité) via le même normaliseur que l'import.
  const brut = s as { setOptions?: unknown; sets?: unknown };
  const setOptions = cleanSetOptions(brut.setOptions ?? brut.sets, { errors: [], warnings: [] }, '');
  return {
    com2usId: typeof s.com2usId === 'number' ? s.com2usId : null,
    name: typeof s.name === 'string' ? s.name : '',
    stats,
    setOptions,
  };
}

function loadDeck(raw: unknown): RecoDeck {
  const d = (raw ?? {}) as Partial<RecoDeck>;
  return {
    name: typeof d.name === 'string' ? d.name : '',
    note: typeof d.note === 'string' ? d.note : '',
    slots: [0, 1, 2].map((i) => loadSlot(d?.slots?.[i])), // toujours 3 slots
  };
}

function load(): RecoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { recos: [] };
    const parsed = JSON.parse(raw) as Partial<RecoState>;
    if (!Array.isArray(parsed.recos)) return { recos: [] };
    return {
      recos: parsed.recos.map((r) => {
        // Migration : ancienne forme « une reco = un deck » (champ `slots`).
        const legacy = (r as unknown as { slots?: unknown[] })?.slots;
        const rawDecks = Array.isArray(r?.decks)
          ? r.decks
          : Array.isArray(legacy)
            ? [{ name: '', note: '', slots: legacy }]
            : [];
        const decks = rawDecks.map(loadDeck);
        return {
          id: typeof r?.id === 'string' ? r.id : newId(),
          // Enregistrement d'avant l'origine → considéré comme créé localement.
          origin: r?.origin === 'imported' ? 'imported' : 'mine',
          name: typeof r?.name === 'string' ? r.name : '',
          author: typeof r?.author === 'string' ? r.author : '',
          note: typeof r?.note === 'string' ? r.note : '',
          decks: decks.length ? decks : [emptyRecoDeck()], // jamais zéro deck
        };
      }),
    };
  } catch {
    return { recos: [] };
  }
}

export interface UseRecoState {
  state: RecoState;
  addReco: () => string; // renvoie l'id créé (pour ouvrir l'édition + scroller)
  removeReco: (id: string) => void;
  setMeta: (id: string, patch: Partial<Pick<Reco, 'name' | 'author' | 'note'>>) => void;
  addDeck: (id: string) => void;
  addDeckWith: (id: string, deck: RecoDeck) => void; // deck pré-rempli (ex. depuis le siège)
  removeDeck: (id: string, deck: number) => void;
  setDeckMeta: (id: string, deck: number, patch: Partial<Pick<RecoDeck, 'name' | 'note'>>) => void;
  setSlotMonster: (id: string, deck: number, idx: number, com2usId: number | null, name: string) => void;
  setSlotStat: (id: string, deck: number, idx: number, stat: RecoStatKey, value: number | null) => void;
  addSlotSet: (id: string, deck: number, idx: number, option: number, setKey: string) => void;
  removeSlotSet: (id: string, deck: number, idx: number, option: number, position: number) => void;
  addSetOption: (id: string, deck: number, idx: number) => void;
  removeSetOption: (id: string, deck: number, idx: number, option: number) => void;
  swapSlots: (id: string, deck: number, from: number, to: number) => void;
  importRecos: (recos: RecoPayload[]) => number; // AJOUTE toujours (jamais de remplacement)
  clearAll: () => void;
}

export function useSiegeRecos(): UseRecoState {
  const [state, setState] = useState<RecoState>(load);

  const persist = usePersistence();
  useEffect(() => {
    saveLocal(STORAGE_KEY, JSON.stringify(state));
  }, [state, persist]);

  const update = useCallback((id: string, fn: (r: Reco) => Reco) => {
    setState((s) => ({ recos: s.recos.map((r) => (r.id === id ? fn(r) : r)) }));
  }, []);

  const updateDeck = useCallback(
    (id: string, deck: number, fn: (d: RecoDeck) => RecoDeck) =>
      update(id, (r) => ({ ...r, decks: r.decks.map((d, i) => (i === deck ? fn(d) : d)) })),
    [update]
  );

  const updateSlot = useCallback(
    (id: string, deck: number, idx: number, fn: (sl: RecoSlot) => RecoSlot) =>
      updateDeck(id, deck, (d) => ({
        ...d,
        slots: d.slots.map((sl, i) => (i === idx ? fn(sl) : sl)),
      })),
    [updateDeck]
  );

  const addReco = useCallback(() => {
    const reco = newReco();
    setState((s) => ({ recos: [...s.recos, reco] }));
    return reco.id;
  }, []);

  const removeReco = useCallback(
    (id: string) => setState((s) => ({ recos: s.recos.filter((r) => r.id !== id) })),
    []
  );

  const setMeta = useCallback(
    (id: string, patch: Partial<Pick<Reco, 'name' | 'author' | 'note'>>) =>
      update(id, (r) => ({ ...r, ...patch })),
    [update]
  );

  const addDeck = useCallback(
    (id: string) => update(id, (r) => ({ ...r, decks: [...r.decks, emptyRecoDeck()] })),
    [update]
  );

  // Ajoute un deck déjà constitué (import depuis une équipe de siège).
  const addDeckWith = useCallback(
    (id: string, deck: RecoDeck) => update(id, (r) => ({ ...r, decks: [...r.decks, deck] })),
    [update]
  );

  // Une recommandation garde toujours au moins un deck.
  const removeDeck = useCallback(
    (id: string, deck: number) =>
      update(id, (r) => {
        const decks = r.decks.filter((_, i) => i !== deck);
        return { ...r, decks: decks.length ? decks : [emptyRecoDeck()] };
      }),
    [update]
  );

  const setDeckMeta = useCallback(
    (id: string, deck: number, patch: Partial<Pick<RecoDeck, 'name' | 'note'>>) =>
      updateDeck(id, deck, (d) => ({ ...d, ...patch })),
    [updateDeck]
  );

  // Changer de monstre remet stats ET sets à zéro : ils n'avaient de sens que
  // pour le monstre auquel ils étaient destinés.
  const setSlotMonster = useCallback(
    (id: string, deck: number, idx: number, com2usId: number | null, name: string) =>
      updateSlot(id, deck, idx, () => ({ com2usId, name, stats: {}, setOptions: [[]] })),
    [updateSlot]
  );

  const setSlotStat = useCallback(
    (id: string, deck: number, idx: number, stat: RecoStatKey, value: number | null) =>
      updateSlot(id, deck, idx, (sl) => {
        const stats = { ...sl.stats };
        if (value == null || !(value > 0)) delete stats[stat];
        else stats[stat] = Math.ceil(value);
        return { ...sl, stats };
      }),
    [updateSlot]
  );

  // Remplace UNE possibilité de runage, les autres inchangées.
  const mapOption = (
    sl: RecoSlot,
    option: number,
    fn: (sets: string[]) => string[]
  ): RecoSlot => ({
    ...sl,
    setOptions: sl.setOptions.map((o, i) => (i === option ? fn(o) : o)),
  });

  // Ajoute un set à une possibilité, si la place le permet (4+2 · 2+2+2 · 4 · 2+2 · 2).
  const addSlotSet = useCallback(
    (id: string, deck: number, idx: number, option: number, setKey: string) =>
      updateSlot(id, deck, idx, (sl) =>
        SET_KEYS.has(setKey) && canAddSet(sl.setOptions[option] ?? [], setKey)
          ? mapOption(sl, option, (o) => [...o, setKey])
          : sl
      ),
    [updateSlot]
  );

  // Retrait PAR POSITION (et non par clé) : un même set peut figurer plusieurs fois.
  // Vider une possibilité la SUPPRIME (sauf si c'est la seule) : une entrée vide
  // au milieu d'un « A | B » n'a pas de sens et alourdirait l'affichage.
  const removeSlotSet = useCallback(
    (id: string, deck: number, idx: number, option: number, position: number) =>
      updateSlot(id, deck, idx, (sl) => {
        const next = mapOption(sl, option, (o) => o.filter((_, i) => i !== position));
        if (next.setOptions.length > 1 && next.setOptions[option].length === 0) {
          return { ...next, setOptions: next.setOptions.filter((_, i) => i !== option) };
        }
        return next;
      }),
    [updateSlot]
  );

  // Une possibilité de plus (« Violent/Némésis OU Violent/Vengeance »).
  const addSetOption = useCallback(
    (id: string, deck: number, idx: number) =>
      updateSlot(id, deck, idx, (sl) => ({ ...sl, setOptions: [...sl.setOptions, []] })),
    [updateSlot]
  );

  // Retrait d'une possibilité. Il en reste TOUJOURS au moins une : supprimer la
  // dernière la vide au lieu de laisser un slot sans aucune entrée.
  const removeSetOption = useCallback(
    (id: string, deck: number, idx: number, option: number) =>
      updateSlot(id, deck, idx, (sl) => {
        const rest = sl.setOptions.filter((_, i) => i !== option);
        return { ...sl, setOptions: rest.length > 0 ? rest : [[]] };
      }),
    [updateSlot]
  );

  const swapSlots = useCallback(
    (id: string, deck: number, from: number, to: number) =>
      updateDeck(id, deck, (d) => {
        if (from === to) return d;
        const slots = [...d.slots];
        [slots[from], slots[to]] = [slots[to], slots[from]];
        return { ...d, slots };
      }),
    [updateDeck]
  );

  // Import d'un lot reçu d'un ami : **toujours ajouté à la suite**, jamais en
  // remplacement — c'est du contenu créé à la main, qu'un import ne doit pas
  // pouvoir détruire. Pour repartir de zéro, « Tout effacer » existe.
  // Renvoie le nombre de recommandations ajoutées.
  const importRecos = useCallback((recos: RecoPayload[]) => {
    // Tout ce qui entre par l'import est marqué « importée » (jamais partagé :
    // l'origine est propre à chaque joueur).
    const built: Reco[] = recos.map((r) => ({ ...r, id: newId(), origin: 'imported' as const }));
    setState((s) => ({ recos: [...s.recos, ...built] }));
    return built.length;
  }, []);

  const clearAll = useCallback(() => setState({ recos: [] }), []);

  return {
    state,
    addReco,
    removeReco,
    setMeta,
    addDeck,
    addDeckWith,
    removeDeck,
    setDeckMeta,
    setSlotMonster,
    setSlotStat,
    addSlotSet,
    removeSlotSet,
    addSetOption,
    removeSetOption,
    swapSlots,
    importRecos,
    clearAll,
  };
}
