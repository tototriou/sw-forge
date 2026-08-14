import { useCallback, useEffect, useRef, useState } from 'react';

// Glisser-déposer au **doigt comme à la souris**, déclenché par un APPUI LONG.
//
// ⚠️ Pourquoi pas le drag HTML5 (`draggable` + `dataTransfer`) qui était en
// place : il ne se déclenche jamais au toucher. Sur téléphone et tablette, la
// seule façon de déplacer un monstre était le sélecteur de section — le
// glisser-déposer, qui est le geste naturel, n'existait tout simplement pas.
// Les Pointer Events couvrent souris, doigt et stylet avec un seul code.
//
// ⚠️ Et pourquoi un APPUI LONG plutôt qu'un drag immédiat : la carte porte
// déjà des zones cliquables (le portrait ouvre le détail, le sélecteur déplace,
// la croix retire). Démarrer le drag au premier pixel volerait tous ces clics.
// L'appui long est le geste que le tactile utilise partout pour « saisir ».

// Durée de l'appui avant saisie. 400 ms est le seuil retenu par iOS et Android
// pour leurs propres réorganisations : plus court, on saisit en voulant cliquer ;
// plus long, on croit que ça ne répond pas.
const DELAI_APPUI = 400;

// Tolérance de bougé pendant l'attente, en pixels.
//
// ⚠️ DEUX seuils, et c'est indispensable. Au doigt, un bougé franc veut dire
// « je fais défiler la page » et doit annuler la saisie — sans quoi tout
// défilement commencé sur une carte devenait un déplacement au bout de 400 ms.
// À la souris, la main n'est jamais immobile : le pointeur dérive de plusieurs
// pixels pendant les 400 ms d'attente, et un seuil serré annulait la saisie
// avant qu'elle ne démarre. C'était le bug : le clic long ne prenait que sur la
// poignée (qui saisit sans attendre), jamais sur le reste de la carte.
const TOLERANCE_TACTILE = 10;
const TOLERANCE_SOURIS = 40;

export interface DragLong {
  // Id en cours de déplacement, `null` si aucun. Sert à griser la carte source.
  dragId: string | null;
  // Position courante du pointeur, pour dessiner la carte fantôme.
  pos: { x: number; y: number } | null;
  // À brancher sur `onPointerDown` de ce qui doit être saisissable.
  //
  // `immediat` : démarre la saisie sans attendre, pour la poignée ≡ — elle ne
  // sert QU'à ça, donc aucun clic à préserver dessus.
  début: (id: string, e: React.PointerEvent, immediat?: boolean) => void;
  // Zones de dépôt : elles s'enregistrent pour qu'on sache laquelle est sous le
  // pointeur, `dataTransfer` n'existant pas ici.
  enregistrerZone: (clé: string, el: HTMLElement | null) => void;
  // Zone actuellement survolée pendant un drag (surbrillance).
  zoneActive: string | null;
}

export function useDragLong(onDrop: (zone: string, id: string) => void): DragLong {
  const [dragId, setDragId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [zoneActive, setZoneActive] = useState<string | null>(null);

  // Refs et non états : ces valeurs sont lues dans des écouteurs natifs posés
  // une seule fois. En état, les écouteurs captureraient la valeur du rendu où
  // ils ont été créés.
  const zones = useRef(new Map<string, HTMLElement>());
  const timer = useRef<number | null>(null);
  const départ = useRef<{ x: number; y: number } | null>(null);
  // Dernière position vue du pointeur, suivie même pendant l'attente : c'est
  // elle qui place le fantôme au déclenchement (le curseur a dérivé depuis).
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const enAttente = useRef<string | null>(null);
  // Type de pointeur de l'appui en cours : il décide de la tolérance de bougé.
  const tactile = useRef(false);
  const actif = useRef<string | null>(null);
  const survolée = useRef<string | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const enregistrerZone = useCallback((clé: string, el: HTMLElement | null) => {
    if (el) zones.current.set(clé, el);
    else zones.current.delete(clé);
  }, []);

  const annulerAttente = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    enAttente.current = null;
    départ.current = null;
  }, []);

  // Quelle zone se trouve sous ce point ? On teste les rectangles plutôt que
  // `elementFromPoint` : la carte fantôme suit le pointeur et intercepterait le
  // test à chaque déplacement.
  const zoneSous = useCallback((x: number, y: number) => {
    for (const [clé, el] of zones.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return clé;
    }
    return null;
  }, []);

  const début = useCallback(
    (id: string, e: React.PointerEvent, immediat = false) => {
      // Clic droit et clic molette ne saisissent pas.
      if (e.button !== 0) return;

      if (immediat) {
        actif.current = id;
        setDragId(id);
        setPos({ x: e.clientX, y: e.clientY });
        return;
      }

      départ.current = { x: e.clientX, y: e.clientY };
      dernier.current = { x: e.clientX, y: e.clientY };
      enAttente.current = id;
      tactile.current = e.pointerType !== 'mouse';
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (enAttente.current !== id) return;
        actif.current = id;
        setDragId(id);
        // ⚠️ La DERNIÈRE position connue, pas celle du `pointerdown` : pendant
        // les 400 ms d'attente le curseur a dérivé, et poser le fantôme au
        // point de départ le faisait apparaître à côté du pointeur avant de
        // le rejoindre d'un bond au premier mouvement.
        setPos(dernier.current);
        // Retour haptique là où il existe : c'est ce qui dit « c'est saisi »
        // au doigt, où il n'y a pas de curseur pour le montrer.
        navigator.vibrate?.(15);
      }, DELAI_APPUI);
    },
    []
  );

  // Écouteurs posés sur `window` : le pointeur sort constamment de la carte
  // pendant un déplacement, des écouteurs locaux perdraient le geste.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      // Suivi permanent, y compris pendant l'attente : le fantôme doit
      // apparaître sous le pointeur là où il est, pas où l'appui a commencé.
      dernier.current = { x: e.clientX, y: e.clientY };
      // Phase d'attente : un bougé franc annule (c'est un défilement).
      if (enAttente.current && départ.current && !actif.current) {
        const d = Math.hypot(e.clientX - départ.current.x, e.clientY - départ.current.y);
        if (d > (tactile.current ? TOLERANCE_TACTILE : TOLERANCE_SOURIS)) annulerAttente();
        return;
      }
      if (!actif.current) return;
      // ⚠️ Empêche le défilement de la page pendant qu'on déplace une carte au
      // doigt. Nécessite `touch-action: none` sur la carte (voir RtaCard) :
      // sans lui, le navigateur s'approprie le geste avant ce `preventDefault`.
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
      const z = zoneSous(e.clientX, e.clientY);
      if (z !== survolée.current) {
        survolée.current = z;
        setZoneActive(z);
      }
    }

    function onUp(e: PointerEvent) {
      if (actif.current) {
        const z = zoneSous(e.clientX, e.clientY);
        if (z) onDropRef.current(z, actif.current);
        // ⚠️ Le `click` qui suit un relâchement est SUPPRIMÉ après une saisie.
        // Sans ça, déposer une carte sur son portrait la déplaçait ET ouvrait
        // son détail de runes : le geste de drag se terminait toujours par un
        // clic parasite sur ce qui se trouvait dessous.
        // Écouteur en capture : il intercepte le clic avant qu'il n'atteigne la
        // carte.
        // ⚠️ Retiré au tick suivant, et pas seulement par `once` : un dépôt
        // ailleurs que sur la carte de départ ne produit AUCUN clic, l'écouteur
        // resterait alors armé et avalerait le prochain clic de l'utilisateur —
        // sans rapport, et impossible à diagnostiquer.
        const avale = (c: Event) => c.stopPropagation();
        window.addEventListener('click', avale, { capture: true });
        setTimeout(() => window.removeEventListener('click', avale, { capture: true }), 0);
      }
      annulerAttente();
      actif.current = null;
      survolée.current = null;
      setDragId(null);
      setPos(null);
      setZoneActive(null);
    }

    // Échap relâche la carte sans la déposer — la sortie de secours attendue
    // quand on a saisi par erreur.
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !actif.current) return;
      annulerAttente();
      actif.current = null;
      survolée.current = null;
      setDragId(null);
      setPos(null);
      setZoneActive(null);
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [annulerAttente, zoneSous]);

  return { dragId, pos, début, enregistrerZone, zoneActive };
}
