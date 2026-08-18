import { Dispatch, SetStateAction, useMemo, useRef, useState } from 'react';
import { Download, Upload, FileJson, X, LineChart, Boxes, Trash2 } from 'lucide-react';
import { RuneDetail } from '../../types';
import { runeEfficiency, runeScore, isAncient } from '../../lib/effects';
import { encodeCurveJson, decodeCurve } from '../../lib/runeCurveShare';
import { parseAccountInventory } from '../../lib/importAccount';
import { ConfirmDialog, PromptDialog } from '../../ui/Dialogs';
import { useStickyState } from '../../hooks/useStickyState';
import { useRuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import CurveChart, { CurveSeries, OWN_COLOR } from './CurveChart';
import { couleurLibre } from './curveColors';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import NumberField from '../../ui/NumberField';
import Pastille from '../../ui/Pastille';
import Bouton from '../../ui/Bouton';
import BoutonIcone from '../../ui/BoutonIcone';
import Segmented from '../Segmented';

interface Props {
  runes: RuneDetail[];
}

const DEFAULT_LIMIT = 400;

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

  // Les listes importées vivent ICI, pas dans les sous-onglets : c'est ce qui
  // permet un « Tout retirer » unique, qui vide les deux d'un coup.
  const [courbes, setCourbes] = useStickyState<CurveOverlay[]>('runesCompare.overlays', []);
  const [comptes, setComptes] = useStickyState<AccountOverlay[]>('runesCompare.accounts', []);
  const [hidden, setHidden] = useStickyState<Set<string>>('runesCompare.hidden', new Set());
  const [retraitAConfirmer, setRetraitAConfirmer] = useState(false);
  const importes = courbes.length + comptes.length;
  // Unicité des noms sur les DEUX listes : elles cohabitent dans l'onglet
  // Courbes, deux homonymes y seraient impossibles à distinguer.
  const noms = [...courbes, ...comptes].map((o) => o.name);

  // ⚠️ Ne touche QUE ce qui a été importé dans cet onglet. Ni le compte du
  // joueur (box, runes, artéfacts), ni ses recommandations, ni sa prépa RTA ou
  // ses équipes de siège — d'où un message qui le dit explicitement, pour qu'on
  // n'hésite pas à cliquer.
  // Ce qui va être retiré, en toutes lettres : « 2 courbes et 1 compte ».
  const resumeRetrait = [
    courbes.length > 0 && `${courbes.length} courbe${courbes.length > 1 ? 's' : ''}`,
    comptes.length > 0 && `${comptes.length} compte${comptes.length > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' et ');

  function toutRetirer() {
    setRetraitAConfirmer(false);
    setCourbes([]);
    setComptes([]);
    setHidden(new Set());
    flash(true, 'Comparaison remise à zéro.');
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Segmented
          value={onglet}
          onChange={(k) => {
            setOnglet(k);
            setMsg(null);
          }}
          options={[
            { key: 'courbes', label: 'Courbes partagées', icon: <LineChart size={13} /> },
            { key: 'comptes', label: 'Fichiers de compte', icon: <Boxes size={13} /> },
          ]}
        />

        {importes > 0 && (
          <Bouton
            onClick={() => setRetraitAConfirmer(true)}
            title="Retire uniquement ce qui a été importé ici"
            ton="danger"
            fond="vide"
            taille="sm"
            icone={<Trash2 size={14} />}
            libelle={`Tout retirer (${importes})`}
            className="ml-auto"
          />
        )}
      </div>

      {msg && <p className={`text-xs mb-3 ${msg.ok ? 'text-wind' : 'text-fire'}`}>{msg.text}</p>}

      {onglet === 'courbes' ? (
        <OngletCourbes
          runes={runes}
          metric={metric}
          flash={flash}
          overlays={courbes}
          setOverlays={setCourbes}
          comptes={comptes}
          setComptes={setComptes}
          noms={noms}
          hidden={hidden}
          setHidden={setHidden}
        />
      ) : (
        <OngletComptes
          runes={runes}
          metric={metric}
          flash={flash}
          overlays={comptes}
          setOverlays={setComptes}
          noms={noms}
          hidden={hidden}
          setHidden={setHidden}
        />
      )}

      {retraitAConfirmer && (
        <ConfirmDialog
          titre={`Retirer ${resumeRetrait} de la comparaison ?`}
          message="Ton propre compte, tes recommandations et tes équipes ne sont pas touchés."
          libelleAction="Tout retirer"
          destructif
          onCancel={() => setRetraitAConfirmer(false)}
          onConfirm={toutRetirer}
        />
      )}
    </div>
  );
}

/* ---- Onglet 1 : courbes partagées (points seuls) ------------------------- */

function OngletCourbes({
  runes,
  metric,
  flash,
  overlays,
  setOverlays,
  comptes,
  setComptes,
  noms,
  hidden,
  setHidden,
}: {
  runes: RuneDetail[];
  metric: 'eff' | 'score';
  flash: (ok: boolean, text: string) => void;
  overlays: CurveOverlay[];
  setOverlays: Dispatch<SetStateAction<CurveOverlay[]>>;
  comptes: AccountOverlay[];
  setComptes: Dispatch<SetStateAction<AccountOverlay[]>>;
  noms: string[];
  hidden: Set<string>;
  setHidden: Dispatch<SetStateAction<Set<string>>>;
}) {
  const [limit, setLimit] = useStickyState('runesCompare.limit', DEFAULT_LIMIT);
  const curveRef = useRef<HTMLInputElement>(null);

  const [nomExportDemande, setNomExportDemande] = useState(false);
  const myEffs = useMemo(() => runes.map((r) => runeEfficiency(r)).sort(desc), [runes]);
  const myScores = useMemo(() => runes.map((r) => runeScore(r)).sort(desc), [runes]);

  function handleExport() {
    if (myEffs.length === 0) return flash(false, 'Aucune rune à exporter.');
    setNomExportDemande(true);
  }

  function exporterSous(saisi: string) {
    setNomExportDemande(false);
    const name = saisi.trim() || 'Moi';
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
          name: nomLibre(payload.name, noms),
          // Pendant exact de `nomLibre` juste au-dessus : deux courbes ne
        // doivent partager ni leur nom, ni leur couleur. ⚠️ On passe les
        // couleurs DÉJÀ POSÉES, pas un compteur — voir curveColors.ts.
        color: couleurLibre(prev.map((o) => o.color)),
        },
      ]);
      flash(true, `Courbe « ${payload.name} » importée.`);
    };
    reader.onerror = () => flash(false, 'Lecture du fichier impossible.');
    reader.readAsText(file);
  }

  const cap = (arr: number[]) => arr.slice(0, Math.max(1, limit));
  // ⚠️ Cet onglet montre TOUT ce qui est importé : les courbes partagées **et**
  // les fichiers de compte, ramenés à leurs points. L'inverse n'est pas vrai —
  // l'onglet Comptes ne peut pas afficher une courbe partagée, faute de runes
  // sur lesquelles appliquer ses filtres.
  // Valeurs ET runes triées ensemble, pour que le graphe puisse ouvrir la rune
  // d'un point par son rang (les deux tableaux doivent rester alignés).
  const classees = (rs: RuneDetail[]) => {
    const tri = rs
      .map((r) => ({ rune: r, val: metric === 'eff' ? runeEfficiency(r) : runeScore(r) }))
      .sort((a, b) => b.val - a.val)
      .slice(0, Math.max(1, limit));
    return { effs: tri.map((t) => t.val), runes: tri.map((t) => t.rune) };
  };

  const lignes: Ligne[] = [
    // ⚠️ `runes` et non `mine` : `mine` n'est qu'une liste de valeurs déjà
    // triées, sans les runes qui vont avec.
    { series: { name: 'Moi', ...classees(runes), color: OWN_COLOR, own: true } },
    // ⚠️ Une courbe PARTAGÉE ne porte pas ses runes — juste des points. Elle
    // reste donc en lecture seule, sans `runes` : le graphe ne promet un clic
    // que là où il y a quelque chose à ouvrir.
    ...overlays.map((o, i) => ({
      series: {
        name: o.name,
        effs: cap(metric === 'eff' ? o.effs : o.scores),
        color: o.color,
        own: false,
      },
      remove: () => setOverlays((prev) => prev.filter((_, j) => j !== i)),
    })),
    // Un FICHIER DE COMPTE, lui, porte ses runes : ses points sont ouvrables.
    ...comptes.map((o, i) => ({
      series: { name: o.name, ...classees(o.runes), color: o.color, own: false },
      remove: () => setComptes((prev) => prev.filter((_, j) => j !== i)),
    })),
  ];

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Bouton onClick={handleExport} taille="sm" icone={<Upload size={14} />} libelle="Exporter ma courbe" />
        <Bouton
          onClick={() => curveRef.current?.click()}
          taille="sm"
          icone={<Download size={14} />}
          libelle="Importer une courbe"
        />
        <input ref={curveRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />

        <div className="ml-auto flex items-center gap-2">
          <span className="label">Nb de runes</span>
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
      <p className="mb-3 text-xs leading-relaxed text-ink-dim">
        Cet onglet montre <b className="text-ink">tout ce que tu as importé</b>, courbes partagées
        comme fichiers de compte. Une courbe partagée ne contient que des{' '}
        <b className="text-ink">points</b>, pas les runes — c'est ce qui lui évite de transporter la
        moindre donnée de compte, mais aussi ce qui rend les filtres par set, emplacement ou
        antiques impossibles ici : ils vivent dans l'onglet{' '}
        <b className="text-ink">Fichiers de compte</b>.
      </p>

      <Graphe lignes={lignes} metric={metric} hidden={hidden} setHidden={setHidden} />

      {nomExportDemande && (
        <PromptDialog
          titre="Nom de ta courbe"
          message="Il sera visible par ceux à qui tu partages le fichier."
          valeurInitiale="Moi"
          libelleAction="Exporter"
          onCancel={() => setNomExportDemande(false)}
          onValider={exporterSous}
        />
      )}
    </>
  );
}

/* ---- Onglet 2 : fichiers de compte (runes complètes) --------------------- */

function OngletComptes({
  runes,
  metric,
  flash,
  overlays,
  setOverlays,
  noms,
  hidden,
  setHidden,
}: {
  runes: RuneDetail[];
  metric: 'eff' | 'score';
  flash: (ok: boolean, text: string) => void;
  overlays: AccountOverlay[];
  setOverlays: Dispatch<SetStateAction<AccountOverlay[]>>;
  noms: string[];
  hidden: Set<string>;
  setHidden: Dispatch<SetStateAction<Set<string>>>;
}) {
  const [sets, setSets] = useStickyState<Set<string>>('runesCompare.sets', new Set());
  const [slots, setSlots] = useStickyState<Set<number>>('runesCompare.slots', new Set());
  const [ancientOnly, setAncientOnly] = useStickyState('runesCompare.ancient', false);
  const [limit, setLimit] = useStickyState('runesCompare.accountsLimit', DEFAULT_LIMIT);
  const jsonRef = useRef<HTMLInputElement>(null);
  // Runes lues, en attente du nom sous lequel les afficher.
  const [compteEnAttente, setCompteEnAttente] = useState<{ runes: RuneDetail[]; repli: string } | null>(
    null
  );

  function ajouterCompte(saisi: string) {
    if (!compteEnAttente) return;
    const nom = saisi.trim() || compteEnAttente.repli;
    setOverlays((prev) => [
      ...prev,
      {
        name: nomLibre(nom, noms),
        runes: compteEnAttente.runes,
        // Pendant exact de `nomLibre` juste au-dessus : deux courbes ne
        // doivent partager ni leur nom, ni leur couleur. ⚠️ On passe les
        // couleurs DÉJÀ POSÉES, pas un compteur — voir curveColors.ts.
        color: couleurLibre(prev.map((o) => o.color)),
      },
    ]);
    flash(true, `${compteEnAttente.runes.length} runes importées pour « ${nom} ».`);
    setCompteEnAttente(null);
  }

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
      // On demande le nom APRÈS avoir lu le fichier : inutile de faire saisir
      // quoi que ce soit pour un fichier qui n'aurait rien d'exploitable.
      setCompteEnAttente({ runes: res.runes, repli });
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

  // ⚠️ Valeurs ET runes triées ENSEMBLE : le graphe ouvre la rune d'un point
  // par son rang, les deux tableaux doivent donc rester alignés. Un `filtrer`
  // puis un `sort` séparés auraient suffi à décaler l'un par rapport à l'autre.
  const classees = (rs: RuneDetail[]) => {
    const tri = filtrer(rs)
      .map((r) => ({ rune: r, val: metric === 'eff' ? runeEfficiency(r) : runeScore(r) }))
      .sort((a, b) => b.val - a.val)
      .slice(0, Math.max(1, limit));
    return { effs: tri.map((t) => t.val), runes: tri.map((t) => t.rune) };
  };

  // Ici TOUTES les séries portent leurs runes — les fichiers de compte en
  // contiennent, contrairement aux courbes partagées. Chacune est donc ouvrable.
  const lignes: Ligne[] = [
    { series: { name: 'Moi', ...classees(runes), color: OWN_COLOR, own: true } },
    ...overlays.map((o, i) => ({
      series: { name: o.name, ...classees(o.runes), color: o.color, own: false },
      remove: () => setOverlays((prev) => prev.filter((_, j) => j !== i)),
    })),
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
        <Bouton
          onClick={() => jsonRef.current?.click()}
          taille="sm"
          icone={<FileJson size={14} />}
          libelle="Importer un fichier de compte"
        />
        <input ref={jsonRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
        <span className="text-xs text-ink-dim">
          L'export SWEX d'un ami — lu dans la page, jamais envoyé.
        </span>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <SetFilter runes={toutesLesRunes} value={sets} onChange={setSets} />
        <div className="flex flex-wrap items-center gap-2">
          <SlotFilter value={slots} onChange={setSlots} />
          <Pastille actif={ancientOnly} onClick={() => setAncientOnly((v) => !v)} libelle="Antiques" />
          <div className="ml-auto flex items-center gap-2">
            <span className="label">Nb de runes</span>
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
        <p className="mb-3 text-xs leading-relaxed text-ink-dim">
          Importe le fichier de compte d'un ami pour le comparer au tien.{' '}
          <b className="text-ink">Les filtres s'appliquent à tout le monde de la même façon</b> — ton
          top Violent face au sien, et non face à l'ensemble de son stock. Seuls les fichiers de
          compte apparaissent ici : une courbe partagée n'a pas les runes qu'il faudrait pour être
          filtrée.
        </p>
      )}

      <Graphe lignes={lignes} metric={metric} hidden={hidden} setHidden={setHidden} />

      {compteEnAttente && (
        <PromptDialog
          titre="Nom de ce compte"
          message="Il sert d'étiquette sur le graphe, rien de plus."
          valeurInitiale={compteEnAttente.repli}
          libelleAction="Ajouter"
          onCancel={() => setCompteEnAttente(null)}
          onValider={ajouterCompte}
        />
      )}
    </>
  );
}

/* ---- Communs -------------------------------------------------------------- */

// Deux courbes homonymes seraient impossibles à distinguer dans la légende.
function nomLibre(souhaite: string, pris: string[]): string {
  const set = new Set(pris);
  let nom = souhaite;
  let k = 2;
  while (set.has(nom)) nom = `${souhaite} (${k++})`;
  return nom;
}

// Une ligne du graphe = une série + son éventuel retrait. On attache le retrait
// à la ligne plutôt que de le déduire d'un index : l'onglet Courbes mélange deux
// listes (courbes et comptes), un index n'y désignerait plus rien de fiable.
export interface Ligne {
  series: CurveSeries;
  remove?: () => void;
}

// Légende cliquable (masquer/afficher) + graphe, partagés par les deux onglets.
function Graphe({
  lignes,
  metric,
  hidden,
  setHidden,
}: {
  lignes: Ligne[];
  metric: 'eff' | 'score';
  hidden: Set<string>;
  setHidden: Dispatch<SetStateAction<Set<string>>>;
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
        {lignes.map(({ series: s, remove }) => {
          const off = hidden.has(s.name);
          return (
            <span key={s.name} className="flex items-center gap-1.5 font-mono text-xs">
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
              {remove && (
                <BoutonIcone
                  onClick={remove}
                  icone={<X size={13} />}
                  libelle="Retirer cette courbe"
                  ton="danger"
                  taille="serre"
                />
              )}
            </span>
          );
        })}
      </div>

      <CurveChart
        series={lignes.map((l) => l.series).filter((s) => !hidden.has(s.name))}
        yLabel={metric === 'eff' ? 'Efficience (%)' : 'Score SW'}
        unit={metric === 'eff' ? '%' : ''}
      />

      <p className="mt-3 font-mono text-micro text-ink-dim">
        Tout reste en local : rien n'est envoyé.
      </p>
    </>
  );
}
