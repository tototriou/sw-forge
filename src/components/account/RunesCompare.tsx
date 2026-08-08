import { useMemo, useRef, useState } from 'react';
import { Download, Upload, FileJson, X } from 'lucide-react';
import { RuneDetail } from '../../types';
import { runeEfficiency, runeScore } from '../../lib/effects';
import { encodeCurveJson, decodeCurve } from '../../lib/runeCurveShare';
import { parseAccountInventory } from '../../lib/importAccount';
import { useStickyState } from '../../hooks/useStickyState';
import { useRuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import CurveChart, { CurveSeries, OWN_COLOR } from './CurveChart';

interface Props {
  runes: RuneDetail[];
}

const DEFAULT_LIMIT = 400;
const OVERLAY_COLORS = ['#5cc2ff', '#7cf0a6', '#ff7a9c', '#c88cff', '#ffd166', '#8fd4ff'];

// Une courbe importée porte LES DEUX séries : on affiche celle qui correspond
// au réglage global, sans dépendre de la mesure choisie par l'expéditeur.
interface Overlay {
  name: string;
  effs: number[];
  scores: number[];
  color: string;
}

const median = (sorted: number[]) => (sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0);

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RunesCompare({ runes }: Props) {
  const [showAll, setShowAll] = useStickyState('runesCompare.showAll', false);
  const [overlays, setOverlays] = useStickyState<Overlay[]>('runesCompare.overlays', []);
  const [hidden, setHidden] = useStickyState<Set<string>>('runesCompare.hidden', new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const curveRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const metric = useRuneMetric();
  const desc = (a: number, b: number) => b - a;
  const myEffs = useMemo(() => runes.map((r) => runeEfficiency(r)).sort(desc), [runes]);
  const myScores = useMemo(() => runes.map((r) => runeScore(r)).sort(desc), [runes]);
  // Série affichée pour MOI, selon la mesure choisie.
  const mine = metric === 'eff' ? myEffs : myScores;

  const flash = (ok: boolean, text: string) => setMsg({ ok, text });

  function handleExport() {
    if (myEffs.length === 0) return flash(false, 'Aucune rune à exporter.');
    const name = (prompt('Nom de ta courbe (visible par tes amis) :', 'Moi') || '').trim() || 'Moi';
    // JSON : téléchargé en fichier ET copié au presse-papier (pièce jointe ou
    // copier/coller, au choix).
    const json = encodeCurveJson(name, myEffs, myScores);
    navigator.clipboard?.writeText(json).catch(() => {});
    download(`swforge-runes-${name.replace(/\s+/g, '_')}.json`, json);
    flash(true, 'Courbe exportée : fichier .json téléchargé et contenu copié.');
  }

  function addOverlay(payload: { name: string; effs: number[]; scores: number[] } | null) {
    if (!payload) return flash(false, 'Courbe invalide.');
    setOverlays((prev) => {
      const color = OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length];
      let name = payload.name;
      const taken = new Set(prev.map((s) => s.name));
      let k = 2;
      while (taken.has(name)) name = `${payload.name} (${k++})`;
      return [...prev, { name, effs: payload.effs, scores: payload.scores, color }];
    });
    flash(true, `Courbe « ${payload.name} » importée.`);
  }

  function handleCurveFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addOverlay(decodeCurve(String(reader.result ?? '')));
    reader.onerror = () => flash(false, 'Lecture du fichier impossible.');
    reader.readAsText(file);
  }

  // Import direct d'un JSON de compte (SWEX) : extraction des runes à la volée.
  function handleJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fallbackName = file.name.replace(/\.json$/i, '').slice(0, 40) || 'Ami';
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseAccountInventory(String(reader.result ?? ''));
      if (res.error || res.runes.length === 0) {
        return flash(false, res.error || 'Aucune rune trouvée dans ce JSON de compte.');
      }
      // Les DEUX mesures sont calculées : la courbe reste lisible quel que soit
      // le réglage choisi ensuite.
      const effs = res.runes.map((r) => runeEfficiency(r)).sort(desc);
      const scores = res.runes.map((r) => runeScore(r)).sort(desc);
      const name = (prompt('Nom de cette courbe :', fallbackName) || fallbackName).trim() || fallbackName;
      addOverlay({ name, effs, scores });
    };
    reader.onerror = () => flash(false, 'Lecture du fichier impossible.');
    reader.readAsText(file);
  }

  const limit = (arr: number[]) => (showAll ? arr : arr.slice(0, DEFAULT_LIMIT));
  // Chaque courbe est tracée dans la mesure choisie globalement.
  const seriesOf = (o: Overlay) => (metric === 'eff' ? o.effs : o.scores);
  const series: CurveSeries[] = [
    { name: 'Moi', effs: limit(mine), color: OWN_COLOR, own: true },
    ...overlays.map((o) => ({
      name: o.name,
      effs: limit(seriesOf(o)),
      color: o.color,
      own: false,
    })),
  ];
  // Séries réellement tracées (on retire celles masquées via la légende).
  const visible = series.filter((s) => !hidden.has(s.name));

  function toggleHidden(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[12.5px] font-semibold text-ink-dim hover:text-ink hover:border-[#4a52a0] transition"
        >
          <Upload size={14} /> Exporter
        </button>
        <button
          onClick={() => curveRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[12.5px] font-semibold text-ink-dim hover:text-ink hover:border-[#4a52a0] transition"
        >
          <Download size={14} /> Importer une courbe
        </button>
        <button
          onClick={() => jsonRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[12.5px] font-semibold text-ink-dim hover:text-ink hover:border-[#4a52a0] transition"
          title="Importer directement le JSON de compte d'un ami (extraction automatique)"
        >
          <FileJson size={14} /> Importer un JSON
        </button>
        <input
          ref={curveRef}
          type="file"
          accept=".json,application/json"
          onChange={handleCurveFile}
          className="hidden"
        />
        <input ref={jsonRef} type="file" accept=".json,application/json" onChange={handleJsonFile} className="hidden" />

        {mine.length > DEFAULT_LIMIT && (
          <div className="ml-auto flex items-center gap-1 bg-panel border border-border rounded-lg p-0.5">
            {[
              { all: false, label: `Top ${DEFAULT_LIMIT}` },
              { all: true, label: 'Tout' },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => setShowAll(o.all)}
                className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition
                  ${showAll === o.all ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink' : 'text-ink-dim hover:text-ink'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {msg && <p className={`text-[12px] mb-3 ${msg.ok ? 'text-wind' : 'text-fire'}`}>{msg.text}</p>}

      {/* Légende — cliquer un nom masque/affiche sa courbe */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {series.map((s, i) => {
          const off = hidden.has(s.name);
          return (
            <span key={s.name} className="flex items-center gap-1.5 font-mono text-[12px]">
              <button
                onClick={() => toggleHidden(s.name)}
                title={off ? 'Afficher cette courbe' : 'Masquer cette courbe'}
                className="flex items-center gap-1.5"
              >
                <span
                  className="inline-block w-3 h-1.5 rounded-full transition"
                  style={{ background: s.color, opacity: off ? 0.3 : 1 }}
                />
                <span className={`font-semibold transition ${off ? 'text-ink-dim line-through' : 'text-ink'}`}>
                  {s.name}
                </span>
                {s.effs.length > 0 && !off && (
                  <span className="text-ink-dim">
                    · max {formatRuneMetric(s.effs[0], metric)} · méd.{' '}
                    {formatRuneMetric(median(s.effs), metric)} · {s.effs.length}
                  </span>
                )}
              </button>
              {!s.own && (
                <button
                  onClick={() => setOverlays((prev) => prev.filter((_, j) => j !== i - 1))}
                  className="text-ink-dim hover:text-fire transition"
                  title="Retirer cette courbe"
                >
                  <X size={13} />
                </button>
              )}
            </span>
          );
        })}
      </div>

      <CurveChart
        series={visible}
        yLabel={metric === 'eff' ? 'Efficience (%)' : 'Score SW'}
        unit={metric === 'eff' ? '%' : ''}
      />

      <p className="mt-3 font-mono text-[11px] text-ink-dim">
        Exporte ta courbe pour la partager, ou importe celle d'un ami (fichier exporté, ou son JSON
        de compte brut s'il n'a pas l'outil). Tout reste en local.
      </p>
    </div>
  );
}
