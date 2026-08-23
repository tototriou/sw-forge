import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

// Champ numérique de l'app : **deux boutons − / +** encadrant la valeur.
//
// ⚠️ **Jamais `type="number"`.** Les flèches natives du navigateur sont deux
// triangles gris minuscules, hors charte, impossibles à styler correctement et
// pénibles à viser — surtout au tactile. On garde donc un `type="text"` avec
// `inputMode="numeric"` (qui fait remonter le pavé numérique sur mobile) et on
// dessine nos propres boutons.
//
// La frappe non numérique est simplement ignorée : plus prévisible qu'un champ
// qui se vide ou qui corrige tout seul pendant qu'on tape.
//
// ⚠️ **APPUI PROLONGÉ = répétition.** Ces champs servent à des valeurs qui
// varient sur des dizaines d'unités — une vitesse de 180 à 240, un minimum de
// crit de 15 à 85. Un pas par clic imposait soixante clics, ou de repasser par
// le clavier alors qu'on avait déjà le doigt sur le bouton.

// Temps d'appui avant que la répétition démarre. ⚠️ Assez long pour qu'un clic
// ordinaire, même mou, n'en déclenche jamais une : sous ~300 ms, un simple clic
// posé faisait sauter la valeur de deux.
const DELAI_AVANT_REPETITION = 400;
// Cadence de départ, puis accélération jusqu'au plancher. ⚠️ Elle accélère
// parce qu'un appui long dit qu'on va LOIN : à cadence fixe, il fallait choisir
// entre une répétition trop lente pour traverser 60 unités et une répétition si
// vive qu'on dépassait toujours sa cible.
const CADENCE_DEPART = 110;
const CADENCE_PLANCHER = 35;
const FACTEUR_ACCELERATION = 0.88;

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  width?: string; // classe de largeur du CHAMP TEXTE (ignorée si `boxWidth` est fourni)
  // Largeur totale du contrôle (boutons + champ + suffixe compris), fixe.
  // ⚠️ À utiliser quand plusieurs champs doivent s'aligner pixel pour pixel
  // même si certains ont un `suffix` et d'autres non (ex. la grille de
  // Conditions de l'Optimizer) : sans ça, un champ avec `suffix="%"` est
  // TOUJOURS plus large qu'un champ sans suffixe à `width` égale, puisque le
  // suffixe prend de la place en plus DANS le contrôle. Avec `boxWidth`, le
  // champ texte devient flexible (`flex-1`) et absorbe la différence — la
  // largeur totale, elle, ne bouge jamais.
  boxWidth?: string;
  placeholder?: string;
  allowEmpty?: boolean; // un champ vide vaut `null` (ex. « pas de valeur saisie »)
  title?: string;
  ariaLabel?: string;
  suffix?: string; // affiché statiquement après la valeur, ex. « % »
  disabled?: boolean; // grisé et non interactif — la valeur reste affichée
  // ⚠️ **Axe pour les GRILLES DENSES** (une cellule par case d'un tableau, ex.
  // les mods de speed tuning) : masque les deux boutons − / +, ne laisse que le
  // champ. Deux boutons de 24 px par cellule feraient un tableau illisible ; on
  // saisit la valeur au clavier/pavé numérique. Le cadre et la logique de
  // frappe restent ceux du composant — ce n'est pas un input nu.
  sansBoutons?: boolean;
}

export default function NumberField({
  value,
  onChange,
  step = 1,
  min,
  max,
  width = 'w-16',
  boxWidth,
  placeholder = '0',
  allowEmpty = false,
  title,
  ariaLabel,
  suffix,
  disabled = false,
  sansBoutons = false,
}: Props) {
  const borne = (n: number) => {
    let v = n;
    if (min != null && v < min) v = min;
    if (max != null && v > max) v = max;
    return v;
  };

  // ⚠️ **Brouillon transitoire pour la saisie d'un négatif.** La valeur est un
  // `number | null` : elle ne peut pas retenir un « - » seul, tapé avant le
  // premier chiffre. Sans ça, la frappe « - » était rejetée (regex sans chiffre)
  // et le champ revenait aussitôt à sa valeur — impossible d'écrire « -30 ». Le
  // brouillon ne vit QUE le temps de cette saisie incomplète, puis s'efface dès
  // qu'un nombre valide est parsé ou à la sortie du champ.
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const affiche = brouillon ?? (value == null ? '' : String(value));

  // ⚠️ **La valeur courante est tenue dans une `ref`, pas lue dans la closure.**
  // La répétition vit dans un `setTimeout` : la fonction qu'il rappelle a
  // capturé la valeur du rendu où elle a été créée, et un appui long
  // n'incrémentait donc qu'une seule fois, encore et encore. La `ref` est aussi
  // mise à jour SUR-LE-CHAMP par `bouger`, sans attendre le rendu suivant —
  // deux pas peuvent tomber entre deux peintures.
  const valeurCourante = useRef(value);
  useEffect(() => {
    valeurCourante.current = value;
  }, [value]);

  // Renvoie `false` quand la valeur ne peut plus bouger : c'est ce qui arrête la
  // répétition à la butée, au lieu de la laisser tourner à vide.
  const bouger = (delta: number): boolean => {
    const suivant = borne((valeurCourante.current ?? 0) + delta);
    if (suivant === valeurCourante.current) return false;
    valeurCourante.current = suivant;
    onChange(suivant);
    return true;
  };

  // ── Appui prolongé ────────────────────────────────────────────────────────
  const minuterie = useRef<number | null>(null);
  // ⚠️ Un `pointerdown` fait déjà le premier pas ; le `click` qui suit au
  // relâchement en ferait un second. On mémorise donc que le pointeur a pris la
  // main, et le clic passe son tour — SANS supprimer `onClick`, qui reste la
  // seule voie d'activation pour un lecteur d'écran (VoiceOver émet un clic, pas
  // une séquence de pointeur).
  const pointeurAGere = useRef(false);

  const arreter = () => {
    if (minuterie.current != null) window.clearTimeout(minuterie.current);
    minuterie.current = null;
  };

  const demarrer = (delta: number) => {
    pointeurAGere.current = true;
    if (!bouger(delta)) return;
    let cadence = CADENCE_DEPART;
    const prochain = (attente: number) => {
      minuterie.current = window.setTimeout(() => {
        if (!bouger(delta)) return arreter();
        cadence = Math.max(CADENCE_PLANCHER, cadence * FACTEUR_ACCELERATION);
        prochain(cadence);
      }, attente);
    };
    prochain(DELAI_AVANT_REPETITION);
  };

  // ⚠️ Le relâchement est écouté sur la FENÊTRE, pas sur le bouton : on lâche
  // très souvent à côté après avoir glissé le doigt, et un `pointerup` posé sur
  // le bouton laissait alors la valeur défiler toute seule.
  useEffect(() => {
    const stop = () => arreter();
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    // Basculer d'onglet ou d'application pendant l'appui : le relâchement
    // n'arrive jamais.
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      arreter();
    };
  }, []);

  // Propriétés communes aux deux flèches. ⚠️ `touch-none` : sans lui, maintenir
  // le doigt sur « + » fait défiler la page au lieu d'incrémenter.
  const gestes = (delta: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      // Bouton droit ou molette : pas une pression.
      if (e.button !== 0) return;
      demarrer(delta);
    },
    onClick: () => {
      if (pointeurAGere.current) {
        pointeurAGere.current = false;
        return;
      }
      bouger(delta);
    },
    // L'appui long fait apparaître la loupe et la sélection sur iOS.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  // ⚠️ **Ces deux flèches restent des `<button>` nus, et c'est délibéré.** Elles
  // ne sont pas des boutons de l'app mais les ENTRAILLES de ce composant-ci :
  // elles n'existent qu'à l'intérieur de son cadre, dont elles épousent la
  // hauteur, et ne se dupliquent nulle part. C'est `NumberField` qui est partagé,
  // pas ses pièces — les faire passer par `BoutonIcone` reviendrait à annuler sa
  // forme (`rounded`, rembourrage, pression au clic) pour retrouver celle-ci.
  //
  // ⚠️ `data-cible-fine` sur chacune : EMPILÉES et collées dans un cadre de
  // 28 px, la règle tactile les portait à 40 px chacune — 80 px de haut pour un
  // champ qui en fait 28, et le cadre éclatait. Une zone étendue les ferait se
  // chevaucher : on incrémenterait en voulant décrémenter.
  //
  // ⚠️ `tabIndex={-1}` : au clavier on tape la valeur, on ne clique pas trente
  // fois sur « + ». Les laisser dans le parcours de tabulation imposait trois
  // arrêts par champ pour atteindre le suivant.
  const btn =
    'flex h-7 w-6 flex-none touch-none select-none items-center justify-center text-ink-dim transition hoverable:text-ink hoverable:bg-panel2 disabled:opacity-30';

  return (
    <div
      className={`inline-flex h-7 items-center overflow-hidden rounded-lg border border-border bg-panel
                 focus-within:border-accent ${boxWidth ?? ''} ${disabled ? 'opacity-40' : ''}`}
      title={title}
    >
      {!sansBoutons && (
        <button
          type="button"
          {...gestes(-step)}
          disabled={disabled || (min != null && (value ?? 0) <= min)}
          data-cible-fine
          className={`${btn} border-r border-border`}
          aria-label="Diminuer"
          tabIndex={-1}
        >
          <Minus size={12} />
        </button>
      )}

      <input
        type="text"
        inputMode="numeric"
        value={affiche}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => {
          const brut = e.target.value.trim();
          if (brut === '') {
            setBrouillon(null);
            return onChange(allowEmpty ? null : 0);
          }
          // « - » seul : négatif en cours de frappe, on le garde à l'écran sans
          // encore produire de valeur (voir `brouillon`).
          if (brut === '-') {
            setBrouillon('-');
            return;
          }
          if (!/^-?\d+$/.test(brut)) return; // frappe invalide ignorée
          // ⚠️ PAS de `borne()` ici : borner CHAQUE frappe casse la saisie dès
          // qu'un `min` positif dépasse un chiffre isolé. Exemple vécu : min 15,
          // max 100 — taper « 5 » saute à 15, puis « 0 » (lu comme « 150 »)
          // saute à 100. On ne peut alors plus jamais écrire « 50 ». La borne
          // s'applique donc seulement en sortie de champ (`onBlur`) et sur les
          // boutons ± (des pas discrets, pas de composition de chiffres).
          setBrouillon(null);
          onChange(Number(brut));
        }}
        onBlur={() => {
          setBrouillon(null); // un « - » resté seul disparaît, le champ suit la valeur
          if (value == null) return; // vide autorisé : rien à borner
          const b = borne(value);
          if (b !== value) onChange(b);
        }}
        // ⚠️ Un cran plus bas au doigt : 13 px, ce champ pesait plus lourd que
        // le nom du monstre à côté duquel il vit.
        className={`${boxWidth ? 'flex-1' : width} min-w-0 bg-transparent px-1 text-center font-mono text-sm compact:text-xs text-ink
                    outline-none placeholder:text-ink-dim disabled:cursor-not-allowed`}
      />

      {suffix && <span className="pr-1.5 font-mono text-xs text-ink-dim">{suffix}</span>}

      {!sansBoutons && (
        <button
          type="button"
          {...gestes(step)}
          disabled={disabled || (max != null && (value ?? 0) >= max)}
          data-cible-fine
          className={`${btn} border-l border-border`}
          aria-label="Augmenter"
          tabIndex={-1}
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
