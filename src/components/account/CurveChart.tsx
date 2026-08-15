// Rendu SVG (sobre) d'une ou plusieurs courbes d'efficience de runes.
// Ordonnée = efficience (%), abscisse = nombre de runes (rang cumulé).
// Réutilisé par « Courbes » (une série) et « Comparaison » (plusieurs séries).

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { RuneDetailBox } from '../MonsterGear';
import RuneSlotIcon from '../RuneSlotIcon';

export interface CurveSeries {
  name: string;
  effs: number[]; // efficiences (%), triées décroissant, déjà limitées à l'affichage
  color: string;
  own: boolean; // true = ma courbe (aire + trait plus épais)
  // ⚠️ Runes ALIGNÉES sur `effs`, même index, même tri — facultatif : une courbe
  // importée d'un ami ne transporte que des valeurs, jamais ses runes. Quand
  // elles sont là, un clic sur le graphe ouvre celle du point visé ; sinon le
  // graphe reste en lecture seule, sans rien annoncer de cliquable.
  runes?: RuneDetail[];
}

const W = 820;
const H = 380;
const PAD_L = 52;
const PAD_R = 18;
const PAD_T = 20;
const PAD_B = 42;
const IW = W - PAD_L - PAD_R;
const IH = H - PAD_T - PAD_B;

export const OWN_COLOR = '#5cc2ff'; // « Actuelle » / « Moi » → bleu

interface Pt {
  x: number;
  y: number;
}

function niceStep(range: number): number {
  const raw = range / 5;
  for (const s of [5, 10, 20, 25, 50, 100]) if (raw <= s) return s;
  return 100;
}

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function downsample(effs: number[], toX: (i: number) => number, toY: (e: number) => number): Pt[] {
  const n = effs.length;
  const MAXP = 240;
  const step = Math.max(1, Math.ceil(n / MAXP));
  const out: Pt[] = [];
  for (let i = 0; i < n; i += step) out.push({ x: toX(i), y: toY(effs[i]) });
  if (out.length && n > 0 && out[out.length - 1].x !== toX(n - 1)) {
    out.push({ x: toX(n - 1), y: toY(effs[n - 1]) });
  }
  return out;
}

// `yLabel` / `unit` : le graphe sert aussi bien à l'efficience qu'au score SW.
export default function CurveChart({
  series,
  yLabel = 'Efficience (%)',
  unit = '%',
}: {
  series: CurveSeries[];
  yLabel?: string;
  unit?: string; // suffixe des valeurs (graduations et infobulle)
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Rang cliqué. `null` = fermé.
  //
  // ⚠️ On mémorise le RANG seul, jamais les runes : les séries se recalculent à
  // chaque changement de filtre ou de mesure, et des runes figées désigneraient
  // un point qui n'existe plus. Le rang désigne une POSITION du classement, et
  // c'est cette position qu'on lit sur toutes les courbes à la fois.
  const [choisi, setChoisi] = useState<{ rang: number } | null>(null);

  // Échap ferme ; les flèches ← → parcourent le classement. Le clavier double
  // les boutons plutôt que de les remplacer : on garde la main sur la souris
  // quand on vient de cliquer un point.
  const nbRangs = series.reduce((m, s) => (s.runes?.length ? Math.max(m, s.effs.length) : m), 0);
  useEffect(() => {
    if (choisi == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChoisi(null);
      else if (e.key === 'ArrowLeft')
        setChoisi((c) => (c && c.rang > 0 ? { rang: c.rang - 1 } : c));
      else if (e.key === 'ArrowRight')
        setChoisi((c) => (c && c.rang < nbRangs - 1 ? { rang: c.rang + 1 } : c));
      else return;
      // Seulement pour les touches qu'on traite : ne pas confisquer le reste.
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [choisi, nbRangs]);

  const active = series.filter((s) => s.effs.length > 0);
  if (active.length === 0) {
    return <p className="text-ink-dim text-[13px]">Aucune rune à afficher.</p>;
  }

  // Bornes X (nb max de runes) et Y (min→max global, arrondis).
  let maxLen = 1;
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of active) {
    maxLen = Math.max(maxLen, s.effs.length);
    hi = Math.max(hi, s.effs[0]);
    lo = Math.min(lo, s.effs[s.effs.length - 1]);
  }
  lo = Math.floor(lo / 10) * 10;
  hi = Math.ceil(hi / 10) * 10;
  if (hi <= lo) hi = lo + 10;

  const x = (i: number) => PAD_L + (maxLen <= 1 ? IW / 2 : (i / (maxLen - 1)) * IW);
  const y = (e: number) => PAD_T + IH - ((e - lo) / (hi - lo)) * IH;

  const yStep = niceStep(hi - lo);
  const yTicks: number[] = [];
  for (let v = lo; v <= hi + 0.001; v += yStep) yTicks.push(v);
  const xTickCount = Math.min(6, maxLen);
  const xTicks = Array.from({ length: xTickCount }, (_, k) =>
    Math.round((k / (xTickCount - 1 || 1)) * (maxLen - 1))
  );

  const me = active.find((s) => s.own);

  // Survol : convertit la position pointeur en index de rune (X).
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = maxLen <= 1 ? 0 : (px - PAD_L) / IW;
    setHover(Math.max(0, Math.min(maxLen - 1, Math.round(frac * (maxLen - 1)))));
  }

  // Séries disposant d'une valeur au point survolé, ordonnées comme les courbes
  // (la plus haute en premier) au point X.
  const hoverSeries =
    hover != null
      ? active
          .filter((s) => hover < s.effs.length)
          .map((s) => ({ s, val: s.effs[hover] }))
          .sort((a, b) => b.val - a.val)
      : [];

  // Séries qui portent leurs runes : ce sont les seules ouvrables. Une courbe
  // PARTAGÉE n'a que des valeurs ; un fichier de compte, lui, porte ses runes.
  const ouvrables = active.filter((s) => s.runes?.length);
  const cliquable = ouvrables.length > 0;

  // ⚠️ TOUTES les runes du rang choisi, une par courbe ouvrable — pas seulement
  // celle de la courbe la plus proche du clic. C'est tout l'intérêt en
  // comparaison : « à ma 12ᵉ meilleure rune, qu'ont-ils, eux ? ». N'en montrer
  // qu'une obligeait à recliquer chaque courbe pour la même question.
  //
  // Ordonnées par valeur décroissante, comme les courbes au point X et comme
  // l'infobulle de survol : la lecture est la même de haut en bas.
  const runesChoisies =
    choisi == null
      ? []
      : ouvrables
          .filter((s) => choisi.rang < (s.runes?.length ?? 0))
          .map((s) => ({ serie: s, rune: s.runes![choisi.rang], val: s.effs[choisi.rang] }))
          .sort((a, b) => b.val - a.val);

  // Combien de rangs on peut parcourir : la plus longue des courbes ouvrables.
  // ⚠️ Le max et non le min : une courbe plus courte s'arrête simplement d'être
  // affichée, elle ne doit pas brider la navigation sur les autres.
  const rangMax = ouvrables.reduce((m, s) => Math.max(m, s.effs.length), 0);

  function onClick() {
    if (!cliquable || hover == null) return;
    // Re-cliquer le même rang referme : le geste est son propre inverse.
    setChoisi((cur) => (cur && cur.rang === hover ? null : { rang: hover }));
  }

  return (
    <div className="rounded-xl border border-border bg-panel/50 p-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        // Le curseur dit que le graphe répond au clic — mais seulement quand il
        // y a réellement des runes derrière les points.
        className={`w-full h-auto ${cliquable ? 'cursor-pointer' : ''}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={onClick}
      >
        <defs>
          <linearGradient id="rcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={OWN_COLOR} stopOpacity="0.14" />
            <stop offset="100%" stopColor={OWN_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grille + graduations Y */}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line
              x1={PAD_L}
              y1={y(v)}
              x2={W - PAD_R}
              y2={y(v)}
              stroke="#242a4d"
              strokeWidth="1"
              strokeDasharray={v === lo ? '' : '3 5'}
            />
            <text x={PAD_L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7c85b8" fontFamily="monospace">
              {Math.round(v)}{unit}
            </text>
          </g>
        ))}

        {/* Graduations X (nombre de runes) */}
        {xTicks.map((i) => (
          <g key={`x${i}`}>
            <line x1={x(i)} y1={PAD_T} x2={x(i)} y2={PAD_T + IH} stroke="#1c2140" strokeWidth="1" />
            <text
              x={x(i)}
              y={H - PAD_B + 18}
              textAnchor="middle"
              fontSize="11"
              fill="#7c85b8"
              fontFamily="monospace"
            >
              {i + 1}
            </text>
          </g>
        ))}

        {/* Aire sous ma courbe */}
        {me &&
          (() => {
            const line = smoothPath(downsample(me.effs, x, y));
            const area = `${line} L${x(me.effs.length - 1).toFixed(1)},${(PAD_T + IH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + IH).toFixed(1)} Z`;
            return <path d={area} fill="url(#rcFill)" />;
          })()}

        {/* Courbes (overlays d'abord, la mienne au-dessus) */}
        {[...active]
          .sort((a, b) => Number(a.own) - Number(b.own))
          .map((s) => (
            <path
              key={s.name}
              d={smoothPath(downsample(s.effs, x, y))}
              fill="none"
              stroke={s.color}
              strokeWidth={s.own ? 1.4 : 1.2}
              strokeOpacity={s.own ? 1 : 0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

        {/* Titres des axes */}
        <text x={PAD_L + IW / 2} y={H - 5} textAnchor="middle" fontSize="11" fill="#9aa2d0" fontFamily="monospace">
          Nombre de runes
        </text>
        <text
          x={15}
          y={PAD_T + IH / 2}
          textAnchor="middle"
          fontSize="11"
          fill="#9aa2d0"
          fontFamily="monospace"
          transform={`rotate(-90 15 ${PAD_T + IH / 2})`}
        >
          {yLabel}
        </text>

        {/* Survol : ligne verticale + points + infobulle */}
        {hover != null &&
          hoverSeries.length > 0 &&
          (() => {
            const hx = x(hover);
            // ⚠️ L'infobulle porte le NOM de chaque courbe, pas seulement sa
            // valeur : à trois courbes superposées, une pastille de couleur ne
            // suffit pas — il fallait faire l'aller-retour avec la légende pour
            // savoir qui valait quoi.
            const fmt = (v: number) => (unit === '%' ? v.toFixed(1) : String(Math.round(v))) + unit;
            // Nom borné : un libellé long étirerait l'infobulle jusqu'à sortir
            // du graphe. Le nom complet reste lisible dans la légende.
            const court = (n: string) => (n.length > 16 ? `${n.slice(0, 15)}…` : n);
            const lignes = hoverSeries.map(({ s, val }) => ({
              s,
              nom: court(s.name),
              valeur: fmt(val),
              val,
            }));
            // Largeur mesurée sur le contenu réel (police mono ≈ 6,7 px/car.) :
            // en dur, les noms débordaient de la boîte.
            const CAR = 6.7;
            const boxW = Math.max(
              104,
              ...lignes.map((l) => 19 + l.nom.length * CAR + 12 + l.valeur.length * CAR + 8)
            );
            const boxH = 20 + hoverSeries.length * 14 + 4;
            const left = hx > PAD_L + IW * 0.6;
            const bx = left ? hx - boxW - 8 : hx + 8;
            const by = PAD_T + 4;
            return (
              <g pointerEvents="none">
                <line
                  x1={hx}
                  y1={PAD_T}
                  x2={hx}
                  y2={PAD_T + IH}
                  stroke="rgb(var(--accent))"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                {hoverSeries.map(({ s, val }) => (
                  <circle key={s.name} cx={hx} cy={y(val)} r="3.2" fill={s.color} stroke="#0d1022" strokeWidth="1.2" />
                ))}
                <rect x={bx} y={by} width={boxW} height={boxH} rx="6" fill="#0d1022" stroke="#2b3055" opacity="0.96" />
                <text x={bx + 8} y={by + 14} fontSize="11" fill="#9aa2d0" fontFamily="monospace">
                  {hover + 1} runes
                </text>
                {lignes.map((l, k) => (
                  <g key={l.s.name}>
                    <circle cx={bx + 11} cy={by + 29 + k * 14 - 3.5} r="3" fill={l.s.color} />
                    <text x={bx + 19} y={by + 29 + k * 14} fontSize="11" fill="#9aa2d0" fontFamily="monospace">
                      {l.nom}
                    </text>
                    {/* Valeurs alignées à droite : en colonne, elles se
                        comparent d'un coup d'œil. */}
                    <text
                      x={bx + boxW - 8}
                      y={by + 29 + k * 14}
                      fontSize="11"
                      fill="#ffffff"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {l.valeur}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

        {/* Repère du point CHOISI. ⚠️ TIRETÉ comme celui du survol, et non
            plein : c'est le même geste de visée, seulement figé — un trait plein
            se lisait comme un autre objet, une graduation du graphe. Il est
            simplement plus marqué (2 px, tirets plus longs), et il SURVIT au
            départ du pointeur : c'est lui qui dit d'où sort le détail lu en
            dessous, une fois la souris partie vers les flèches.
            ⚠️ `rgb(var(--accent))` et NON `var(--accent)` : les tokens de
            couleur sont des TRIPLETS (« 43 54 165 »), pas des couleurs CSS.
            Posé nu dans un attribut SVG, le trait n'était tout simplement pas
            peint — invisible, sans erreur. Voir spec/shared/design.md. */}
        {choisi && runesChoisies.length > 0 && (
          <g pointerEvents="none">
            <line
              x1={x(choisi.rang)}
              y1={PAD_T}
              x2={x(choisi.rang)}
              y2={PAD_T + IH}
              stroke="rgb(var(--accent))"
              strokeWidth="2"
              strokeDasharray="5 3"
            />
            {/* Un point par courbe ouvrable : ils marquent toutes les runes lues
                en dessous, et non une seule.
                ⚠️ À peine plus gros que celui du survol (3.2) : ces points se
                posent SUR la courbe, un disque trop large la masque et se lit
                comme une donnée en soi. L'anneau d'accent suffit à les
                distinguer. */}
            {runesChoisies.map(({ serie, val }) => (
              <circle
                key={serie.name}
                cx={x(choisi.rang)}
                cy={y(val)}
                r="3.6"
                fill={serie.color}
                stroke="rgb(var(--accent))"
                strokeWidth="1.2"
              />
            ))}
          </g>
        )}

        {/* Zone de capture du pointeur (transparente, au-dessus) */}
        <rect x={0} y={0} width={W} height={H} fill="transparent" />
      </svg>

      {/* Détail de la (ou des) rune(s) du point cliqué.
          ⚠️ SOUS le graphe, dans le flux, et non en flottant : la carte d'une
          rune fait ~300 px de haut, un popover de cette taille ancré sur un
          point du graphe recouvrirait la courbe qu'on vient de lire. Ici on voit
          les deux. */}
      {choisi && runesChoisies.length > 0 && (
        <div className="relative mt-2 border-t border-border pt-2 animate-[apparition_150ms_var(--ease-out)]">
          {/* La croix reste calée en haut à DROITE du bloc : le détail étant
              centré, la mettre dans son en-tête l'aurait décentré. */}
          <button
            onClick={() => setChoisi(null)}
            className="absolute right-0 top-2 text-ink-dim transition hoverable:text-ink"
            title="Fermer le détail"
            aria-label="Fermer le détail"
          >
            <X size={14} />
          </button>

          {/* Navigation — les deux flèches CÔTE À CÔTE, juste sous la courbe :
              elles font parcourir le classement, qui est l'axe du graphe
              au-dessus, pas la carte du dessous. Encadrer la carte les
              éloignait l'une de l'autre alors qu'on les enchaîne.
              ⚠️ Elles bornent au lieu de boucler — le classement a un début et
              une fin, et repasser du dernier au premier ferait croire à un saut
              de position. Aux extrémités, la flèche est désactivée. */}
          <div className="mb-2 flex items-center justify-center gap-1">
            <button
              onClick={() => setChoisi((c) => (c && c.rang > 0 ? { rang: c.rang - 1 } : c))}
              disabled={choisi.rang === 0}
              className="flex-none rounded-lg border border-border bg-panel p-1.5 text-ink-dim
                         transition hoverable:border-accent hoverable:text-ink
                         disabled:cursor-not-allowed disabled:opacity-30"
              title="Rune précédente (mieux classée)"
              aria-label="Rune précédente"
            >
              <ChevronLeft size={16} />
            </button>
            {/* Le rang ENTRE les deux flèches : c'est lui qu'elles font défiler,
                et il dit où l'on en est dans le classement. Largeur fixe, sinon
                les flèches se déplacent au passage de « 9 » à « 10 ». */}
            <span className="w-[92px] text-center font-mono text-[11px] text-ink-dim">
              n° {choisi.rang + 1} / {rangMax}
            </span>
            <button
              onClick={() =>
                setChoisi((c) => (c && c.rang < rangMax - 1 ? { rang: c.rang + 1 } : c))
              }
              disabled={choisi.rang >= rangMax - 1}
              className="flex-none rounded-lg border border-border bg-panel p-1.5 text-ink-dim
                         transition hoverable:border-accent hoverable:text-ink
                         disabled:cursor-not-allowed disabled:opacity-30"
              title="Rune suivante (moins bien classée)"
              aria-label="Rune suivante"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* ⚠️ UNE CARTE PAR COURBE ouvrable, à ce rang. En comparaison, c'est
              tout l'intérêt : « à ma 12ᵉ meilleure rune, qu'ont-ils, eux ? ».
              N'en montrer qu'une obligeait à recliquer chaque courbe pour poser
              la même question.
              Elles sont ordonnées par valeur décroissante, comme les courbes au
              point X et comme l'infobulle de survol : même lecture partout. */}
          <div className="flex flex-wrap items-start justify-center gap-3">
            {runesChoisies.map(({ serie, rune, val }) => (
              <div key={serie.name} className="w-[260px] max-w-full">
                {/* En-tête : l'IMAGE de la rune (cadre du slot + symbole du set,
                    comme dans le jeu et dans la liste de runes) puis son set et
                    son slot. ⚠️ L'image d'abord : c'est à elle qu'on reconnaît
                    une rune d'un coup d'œil, le texte ne fait que confirmer.
                    Même rendu que les tuiles de l'onglet Liste. */}
                <div className="mb-1.5 flex items-center gap-2.5">
                  <RuneSlotIcon
                    slot={rune.slot}
                    setKey={rune.set}
                    rarity={rune.rarity}
                    ancient={rune.rank > 10}
                    height={46}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold leading-tight text-ink">
                      {RUNE_SETS.find((s) => s.key === rune.set)?.label ?? rune.set} ·{' '}
                      <span className="text-ink-dim">slot {rune.slot}</span>
                    </div>
                    {/* Le rang n'est PAS répété ici : il vit dans la barre de
                        navigation au-dessus, entre les deux flèches. */}
                    <div className="font-mono text-[11px] text-ink-dim">
                      {unit === '%' ? val.toFixed(1) : String(Math.round(val))}
                      {unit}
                    </div>
                    {/* ⚠️ Le nom de la courbe n'apparaît QUE s'il y en a
                        plusieurs d'ouvrables : sur l'onglet Courbes, où seule la
                        mienne l'est, il n'apprend rien. */}
                    {ouvrables.length > 1 && (
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px]">
                        <span
                          className="inline-block h-1.5 w-3 flex-none rounded-full"
                          style={{ background: serie.color }}
                        />
                        <span className="truncate text-ink">{serie.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ⚠️ Aucun cadre ici : `RuneDetailBox` porte déjà le sien. En
                    ajouter un donnait une carte dans une carte. */}
                <RuneDetailBox rune={rune} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
