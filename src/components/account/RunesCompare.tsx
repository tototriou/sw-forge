import { useMemo, useRef, useState } from 'react';
import { Download, Upload, FileJson, X, LineChart, Boxes } from 'lucide-react';
import { RuneDetail } from '../../types';
import { runeEfficiency, runeScore, isAncient } from '../../lib/effects';
import { encodeCurveJson, decodeCurve } from '../../lib/runeCurveShare';
import { parseAccountInventory } from '../../lib/importAccount';
import { useStickyState } from '../../hooks/useStickyState';
import { useRuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import CurveChart, { CurveSeries, OWN_COLOR } from './CurveChart';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import NumberField from '../NumberField';

interface Props {
  runes: RuneDetail[];
}

const DEFAULT_LIMIT = 400;
const OVERLAY_COLORS = ['#5cc2ff', '#7cf0a6', '#ff7a9c', '#c88cff', '#ffd166', '#8fd4ff'];

// Une courbe importée porte LES DEUX séries : on affiche celle qui correspond
// au réglage global, sans dépendre de la mesure choisie par l'expéditeur.
interface CurveOverlay {
  name: string;
  effs: number[];
  scores: number[];
  color: string;
}

// Un compte importé garde ses RUNES : c'est ce qui permet d'y appliquer les
// mêmes filtres qu'à l'onglet Courbes.
interface AccountOverlay {
  name: string;
  runes: RuneDetail[];
  color: string;
}

type Onglet = 'courbes' | 'comptes';

const median = (sorted: number[]) => (sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0);
const desc = (a: number, b: number) => b - a;

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ⚠️ DEUX onglets, parce que les deux formats ne portent pas la même chose.
//
// Un **export de courbe** ne contient que les **points** — c'est volontaire :
// il ne transporte aucune donnée de compte. On ne peut donc pas y appliquer un
// filtre par set, par emplacement ou par antiques : l'information n'est pas là,
// et l'appliquer à ma seule courbe comparerait mon top Violent à *tout* le stock
// de l'autre, ce qui ne veut rien dire.
//
// Un **fichier de compte** (SWEX), lui, contient les runes : là, les filtres
// s'appliquent **à tout le monde de la même façon**, donc la comparaison reste
// honnête. D'où la séparation, plutôt qu'un onglet unique aux filtres qui
// marchent une fois sur deux.
export default function RunesCompare({ runes }: Props) {
  const [onglet, setOnglet] = useStickyState<Onglet>('runesCompare.tab', 'courbes');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const metric = useRuneMetric();
  const flash = (ok: boolean, text: string) => setMsg({ ok, text });

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 bg-panel border border-border rounded-lg p-0.5 w-fit">
        {[
          { key: 'courbes' as const, icon: LineChart, label: 'Courbes partagées' },
          { key: 'comptes' as const, icon: Boxes, label: 'Fichiers de compte' },
        ].map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              onClick={() => {
                setOnglet(o.key);
                setMsg(null);
              }}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
                onglet === o.key
                  ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink'
                  : 'text-ink-dim hover:text-ink'
              }`}
            >
              <Icon size={13} /> {o.label}
            </button>
          );
        })}
      </div>

      {msg && <p className={`text-[12px] mb-3 ${msg.ok ? 'text-wind' : 'text-fire'}`}>{msg.text}</p>}

      {onglet === 'courbes' ? (
        <OngletCourbes runes={runes} metric={metric} flash={flash} />
      ) : (
        <OngletComptes runes={runes} metric={metric} flash={flash} />
      )}
    </div>
  );
}

/* ---- Onglet 1 : courbes partagées (points seuls) ------------------------- */

function OngletCourbes({
  runes,
  metric,
  flash,
}: {
  runes: RuneDetail[];
  metric: 'eff' | 'score';
  flash: (ok: boolean, text: string) => void;
}) {
  const [overlays, setOverlays] = useStickyState<CurveOverlay[]>('runesCompare.overlays', []);
  const [hidden, setHidden] = useStickyState<Set<string>>('runesCompare.hidden', new Set());
  const [limit, setLimit] = useStickyState('runesCompare.limit', DEFAULT_LIMIT);
  const curveRef = useRef<HTMLInputElement>(null);

  const myEffs = useMemo(() => runes.map((r) => runeEfficiency(r)).sort(desc), [runes]);
  const myScores = useMemo(() => runes.map((r) => runeScore(r)).sort(desc), [runes]);
  const mine = metric === 'eff' ? myEffs : myScores;

  function handleExport() {
    if (myEffs.length === 0) return flash(false, 'Aucune rune à exporter.');
    const name = (prompt('Nom de ta courbe (visible par tes amis) :', 'Moi') || '').trim() || 'Moi';
    // ⚠️ On n'exporte QUE les points, jamais les runes : une courbe partagée ne
    // doit transporter aucune donnée de compte.
    const json = encodeCurveJson(name, myEffs, myScores);
    navigator.clipboard?.writeText(json).catch(() => {});
    download(`swforge-runes-${name.replace(/\s+/g, '_')}.json`, json);
    flash(true, 'Courbe exportée : fichier .json téléchargé et contenu copié.');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const payload = decodeCurve(String(reader.result ?? ''));
      if (!payload) return flash(false, 'Courbe invalide.');
      setOverlays((prev) => [
        ...prev,
        {
          ...payload,
          name: nomLibre(payload.name, prev.map((o) => o.name)),
          color: OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length],
        },
      ]);
      flash(true, `Courbe « ${payload.name} » importée.`);
    };
    reader.onerror = () => flash(false, 'Lecture du fichier impossible.');
    reader.readAsText(file);
  }

  const cap = (arr: number[]) => arr.slice(0, Math.max(1, limit));
  const series: CurveSeries[] = [
    { name: 'Moi', effs: cap(mine), color: OWN_COLOR, own: true },
    ...overlays.map((o) => ({
      name: o.name,
      effs: cap(metric === 'eff' ? o.effs : o.scores),
      color: o.color,
      own: false,
    })),
  ];

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button onClick={handleExport} className={btn}>
          <Upload size={14} /> Exporter ma courbe
        </button>
        <button onClick={() => curveRef.current?.click()} className={btn}>
          <Download size={14} /> Importer une courbe
        </button>
        <input ref={curveRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">Nb de runes</span>
          <NumberField
            value={limit}
            min={1}
            step={50}
            width="w-14"
            ariaLabel="Nombre de runes"
            onChange={(v) => setLimit(Math.max(1, v ?? 1))}
          />
        </div>
      </div>

      {/* ⚠️ Explique l'ABSENCE des autres filtres, sinon on la prend pour un oubli. */}
      <p className="mb-3 text-[12px] leading-relaxed text-ink-dim">
        Une courbe partagée ne contient que des <b className="text-ink">points</b>, pas les runes —
        c'est ce qui lui évite de transporter la moindre donnée de compte. Les filtres par set,
        emplacement ou antiques ont donc besoin de l'onglet{' '}
        <b className="text-ink">Fichiers de compte</b>.
      </p>

      <Graphe
        series={series}
        metric={metric}
        hidden={hidden}
        setHidden={setHidden}
        onRemove={(i) => setOverlays((prev) => prev.filter((_, j) => j !== i))}
      />
    </>
  );
}

/* ---- Onglet 2 : fichiers de compte (runes complètes) --------------------- */

function OngletComptes({
  runes,
  metric,
  flash,
}: {
  runes: RuneDetail[];
  metric: 'eff' | 'score';
  flash: (ok: boolean, text: string) => void;
}) {
  const [overlays, setOverlays] = useStickyState<AccountOverlay[]>('runesCompare.accounts', []);
  const [hidden, setHidden] = useStickyState<Set<string>>('runesCompare.accountsHidden', new Set());
  const [sets, setSets] = useStickyState<Set<string>>('runesCompare.sets', new Set());
  const [slots, setSlots] = useStickyState<Set<number>>('runesCompare.slots', new Set());
  const [ancientOnly, setAncientOnly] = useStickyState('runesCompare.ancient', false);
  const [limit, setLimit] = useStickyState('runesCompare.accountsLimit', DEFAULT_LIMIT);
  const jsonRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const repli = file.name.replace(/\.json$/i, '').slice(0, 40) || 'Ami';
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseAccountInventory(String(reader.result ?? ''));
      if (res.error || res.runes.length === 0) {
        return flash(false, res.error || 'Aucune rune trouvée dans ce fichier de compte.');
      }
      const nom = (prompt('Nom de ce compte :', repli) || repli).trim() || repli;
      setOverlays((prev) => [
        ...prev,
        {
          name: nomLibre(nom, prev.map((o) => o.name)),
          runes: res.runes,
          color: OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length],
        },
      ]);
      flash(true, `${res.runes.length} runes importées pour « ${nom} ».`);
    };
    reader.onerror = () => flash(false, 'Lecture du fichier impossible.');
    reader.readAsText(file);
  }

  // ⚠️ Le MÊME filtre est appliqué à tout le monde : c'est ce qui rend la
  // comparaison honnête (mon top Violent contre le sien, pas contre son stock).
  const filtrer = (rs: RuneDetail[]) =>
    rs.filter((r) => {
      if (sets.size && !sets.has(r.set)) return false;
      if (slots.size && !slots.has(r.slot)) return false;
      if (ancientOnly && !isAncient(r)) return false;
      return true;
    });

  const valeurs = (rs: RuneDetail[]) =>
    filtrer(rs)
      .map((r) => (metric === 'eff' ? runeEfficiency(r) : runeScore(r)))
      .sort(desc)
      .slice(0, Math.max(1, limit));

  const series: CurveSeries[] = [
    { name: 'Moi', effs: valeurs(runes), color: OWN_COLOR, own: true },
    ...overlays.map((o) => ({ name: o.name, effs: valeurs(o.runes), color: o.color, own: false })),
  ];

  // Sets proposés au filtre : ceux présents chez MOI **ou** chez un ami — sinon
  // on ne pourrait pas filtrer sur un set qu'on ne possède pas encore.
  const toutesLesRunes = useMemo(
    () => [...runes, ...overlays.flatMap((o) => o.runes)],
    [runes, overlays]
  );

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button onClick={() => jsonRef.current?.click()} className={btn}>
          <FileJson size={14} /> Importer un fichier de compte
        </button>
        <input ref={jsonRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
        <span className="text-[12px] text-ink-dim">
          L'export SWEX d'un ami — lu dans la page, jamais envoyé.
        </span>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <SetFilter runes={toutesLesRunes} value={sets} onChange={setSets} />
        <div className="flex flex-wrap items-center gap-2">
          <SlotFilter value={slots} onChange={setSlots} />
          <button
            onClick={() => setAncientOnly((v) => !v)}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                ancientOnly
                  ? 'bg-[#3a2a55] border-[#a074d0] text-[#c79bff] shadow'
                  : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
              }`}
          >
            Antiques
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">Nb de runes</span>
            <NumberField
              value={limit}
              min={1}
              step={50}
              width="w-14"
              ariaLabel="Nombre de runes"
              onChange={(v) => setLimit(Math.max(1, v ?? 1))}
            />
          </div>
        </div>
      </div>

      {overlays.length === 0 && (
        <p className="mb-3 text-[12px] leading-relaxed text-ink-dim">
          Importe le fichier de compte d'un ami pour le comparer au tien.{' '}
          <b className="text-ink">Les filtres s'appliquent à tout le monde de la même façon</b> — ton
          top Violent face au sien, et non face à l'ensemble de son stock.
        </p>
      )}

      <Graphe
        series={series}
        metric={metric}
        hidden={hidden}
        setHidden={setHidden}
        onRemove={(i) => setOverlays((prev) => prev.filter((_, j) => j !== i))}
      />
    </>
  );
}

/* ---- Communs -------------------------------------------------------------- */

const btn =
  'flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[12.5px] ' +
  'font-semibold text-ink-dim hover:text-ink hover:border-[#4a52a0] transition';

// Deux courbes homonymes seraient impossibles à distinguer dans la légende.
function nomLibre(souhaite: string, pris: string[]): string {
  const set = new Set(pris);
  let nom = souhaite;
  let k = 2;
  while (set.has(nom)) nom = `${souhaite} (${k++})`;
  return nom;
}

// Légende cliquable (masquer/afficher) + graphe, partagés par les deux onglets.
function Graphe({
  series,
  metric,
  hidden,
  setHidden,
  onRemove,
}: {
  series: CurveSeries[];
  metric: 'eff' | 'score';
  hidden: Set<string>;
  setHidden: (fn: (prev: Set<string>) => Set<string>) => void;
  onRemove: (index: number) => void;
}) {
  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {series.map((s, i) => {
          const off = hidden.has(s.name);
          return (
            <span key={s.name} className="flex items-center gap-1.5 font-mono text-[12px]">
              <button
                onClick={() => toggle(s.name)}
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
                  onClick={() => onRemove(i - 1)}
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
        series={series.filter((s) => !hidden.has(s.name))}
        yLabel={metric === 'eff' ? 'Efficience (%)' : 'Score SW'}
        unit={metric === 'eff' ? '%' : ''}
      />

      <p className="mt-3 font-mono text-[11px] text-ink-dim">
        Tout reste en local : rien n'est envoyé.
      </p>
    </>
  );
}
