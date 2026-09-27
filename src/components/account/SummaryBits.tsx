// Briques d'affichage des pages « Résumé » (runes, artéfacts).
//
// ⚠️ Partagées, pas recopiées. Elles vivaient dans RunesSummary ; le résumé des
// artéfacts pose exactement les mêmes objets (tuile de chiffre clé, panneau
// titré, ligne de barre). Une seconde copie aurait divergé au premier
// ajustement de gabarit, et les deux pages se liraient alors comme deux
// composants étrangers l'un à l'autre.

import React from 'react';

export const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);
export const fmt = (v: number) => v.toFixed(1);

// Tuile de chiffre clé : libellé mono, grande valeur, sous-titre.
// ⚠️ `bandeau` (refonte graphique, lot 8a, la maquette `.stats`) : à la
// SOURIS, le chiffre n'est plus une carte mais une CASE d'un bandeau commun —
// sans cadre propre, séparée de la précédente par un filet (`premier` : pas de
// filet à gauche). Au doigt, la carte d'avant (lot 11).
const CASE_BANDEAU = 'lg:flex-1 lg:rounded-none lg:border-0 lg:border-l lg:border-border-soft lg:bg-transparent lg:px-4 lg:py-3';

export function Kpi({
  label,
  value,
  sub,
  tone,
  bandeau = false,
  premier = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  bandeau?: boolean;
  premier?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-panel px-3 py-2.5 ${bandeau ? CASE_BANDEAU : ''} ${
        bandeau && premier ? 'lg:border-l-0' : ''
      }`}
    >
      <p className="label">{label}</p>
      <p
        className="mt-0.5 text-[22px] font-bold leading-none tabular-nums"
        style={{ color: tone ?? 'rgb(var(--ink))' }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 font-mono text-micro text-ink-dim">{sub}</p>}
    </div>
  );
}

// Panneau titré.
// `className` : la place du panneau dans une grille (ordre, largeur) — le
// Résumé des runes le range en trois colonnes à la souris (lot 8a).
export function Panel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-panel p-4 ${className}`}>
      <h3 className="mb-3 label">{title}</h3>
      {children}
    </section>
  );
}

// Ligne de barre : libellé · barre proportionnelle · effectif + part.
export function BarRow({
  label,
  n,
  total,
  max,
  color,
  labelWidth = 104,
}: {
  label: string;
  n: number;
  total: number;
  max: number;
  color: string;
  // Les libellés d'artéfact (« Dmg crit Compétence 2 ») sont plus longs que
  // « ≥ 110 % » : la colonne s'élargit au besoin sans casser l'alignement des
  // autres résumés.
  labelWidth?: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex-none font-mono text-micro text-ink-dim truncate"
        style={{ width: labelWidth }}
        title={label}
      >
        {label}
      </span>
      <div className="h-2.5 flex-1 rounded-full bg-panel2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${max ? (n / max) * 100 : 0}%`, background: color }}
        />
      </div>
      <span className="w-[92px] flex-none text-right font-mono text-micro text-ink-dim tabular-nums">
        <b className="text-ink">{n.toLocaleString('fr-FR')}</b> · {fmt(pct(n, total))} %
      </span>
    </div>
  );
}
