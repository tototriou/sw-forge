import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, RotateCcw, Upload, Download, AlertTriangle, XCircle, X } from 'lucide-react';
import { Monster, RtaState } from '../../types';
import { UseRtaState } from '../../hooks/useRtaState';
import { UseRtaCategories } from '../../hooks/useRtaCategories';
import { UseRtaBackup } from '../../hooks/useRtaBackup';
import {
  appliquer,
  comptePartageable,
  encodeSnapshot,
  ImportReport,
  slugify,
  toSnapshot,
  validateRtaImport,
} from '../../lib/rtaShare';
import { ConfirmDialog } from '../Dialogs';

/* --------------------------------------------------------------------------
 * Sauvegarder · Reprendre · Exporter · Importer
 * -----------------------------------------------------------------------
 *
 * ⚠️ **« Sauvegarder » n'est PAS de l'enregistrement.** La prépa est déjà écrite
 * à chaque changement : on la retrouve intacte à la session suivante sans rien
 * cliquer. Ce bouton pose un **point de retour** — il sert à essayer un autre
 * classement sans risquer celui qui marchait. Le libellé et l'infobulle le
 * disent, sinon on croit que sans lui tout est perdu, ce qui est faux.
 *
 * ⚠️ **Trois gestes remplacent la prépa en cours** (Reprendre, Importer, et
 * l'écrasement d'un point existant) : les trois confirment, et jamais avec un
 * OK destructeur — « Annuler » est le défaut, l'action portée en couleur
 * d'alerte. Voir ../Dialogs.tsx.
 */

interface Props {
  rta: UseRtaState;
  cats: UseRtaCategories;
  backup: UseRtaBackup;
  monsters: Monster[];
}

// Télécharge un texte en fichier (aucun envoi réseau).
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// « il y a 3 minutes », « hier à 14:32 » — repère plus parlant qu'une date ISO
// pour dire de quand date le point de retour.
function depuis(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j === 1) return 'hier';
  if (j < 30) return `il y a ${j} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const BOUTON =
  'flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[12.5px] ' +
  'text-ink-dim hoverable:text-ink hoverable:border-accent transition ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export default function RtaBackupBar({ rta, cats, backup, monsters }: Props) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // Rapport de validation : NON éphémère, il y a quelque chose à lire.
  const [report, setReport] = useState<ImportReport | null>(null);
  // Ce qu'un import a produit, en attente de confirmation : l'appliquer
  // écraserait la prépa en cours.
  const [aConfirmer, setAConfirmer] = useState<{
    state: RtaState;
    categories: { label: string; color: string; members: string[] }[];
    resume: string;
  } | null>(null);
  const [reprendreAConfirmer, setReprendreAConfirmer] = useState(false);
  const [ecraserAConfirmer, setEcraserAConfirmer] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Message éphémère (même convention que l'import de compte).
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.error ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  const monsterByCom2us = useMemo(() => {
    const m = new Map<number, Monster>();
    for (const mon of monsters) if (mon.com2usId != null) m.set(mon.com2usId, mon);
    return m;
  }, [monsters]);

  const nbMonstres = Object.keys(rta.state.entries).length;
  const vide = nbMonstres === 0;

  function sauvegarder() {
    backup.sauvegarder(rta.state, cats.categories);
    setMsg({ text: `Point de sauvegarde posé · ${nbMonstres} monstre(s).` });
  }

  function reprendre() {
    if (!backup.backup) return;
    rta.replaceAll(backup.backup.state);
    // Les catégories sont restaurées avec la prépa : elles en font partie.
    cats.replaceAll(
      backup.backup.categories.map((c) => ({ label: c.label, color: c.color, members: c.members }))
    );
    setMsg({ text: 'Prépa restaurée au dernier point de sauvegarde.' });
  }

  function exporter() {
    const { partageables, perso } = comptePartageable(rta.state, monsterById);
    if (partageables === 0) {
      setMsg({
        text: perso > 0
          ? "Rien à exporter : tes monstres perso n'existent que dans ton navigateur, ils ne peuvent pas être partagés."
          : 'Rien à exporter : ta prépa est vide.',
        error: true,
      });
      return;
    }
    const snap = toSnapshot(rta.state, cats.categories, monsterById);
    download(`swforge-prepa-rta-${slugify(new Date().toISOString().slice(0, 10))}.json`, encodeSnapshot(snap));
    // ⚠️ Les monstres perso écartés sont ANNONCÉS : un fichier silencieusement
    // incomplet se découvrirait chez l'ami, trop tard.
    setMsg({
      text:
        `${partageables} monstre(s) exporté(s) · fichier .json téléchargé.` +
        (perso > 0 ? ` ${perso} monstre(s) perso non partageable(s) : non inclus.` : ''),
    });
  }

  function lireFichier(text: string) {
    const rep = validateRtaImport(text);
    setReport(rep);
    if (!rep.snapshot) return; // erreurs bloquantes : rien n'est importé

    const { state, categories, inconnus } = appliquer(rep.snapshot, monsterByCom2us, rta.state);

    if (inconnus.length > 0) {
      rep.warnings.push(
        `${inconnus.length} monstre(s) absent(s) des données chargées (id ${inconnus
          .slice(0, 5)
          .join(', ')}${inconnus.length > 5 ? '…' : ''}) : non importés.`
      );
      setReport({ ...rep });
    }

    const retenus = Object.keys(state.entries).length;
    if (retenus === 0) {
      setMsg({ text: "Aucun monstre de ce fichier n'existe dans les données chargées.", error: true });
      return;
    }

    const auteur = rep.snapshot.auteur ? ` de ${rep.snapshot.auteur}` : '';
    // ⚠️ Contrairement aux recommandations (qui s'ajoutent), une prépa importée
    // REMPLACE : il n'y a qu'une prépa RTA, deux classements ne peuvent pas
    // coexister. D'où la confirmation — et le fait qu'elle dise ce qu'on perd.
    setAConfirmer({
      state,
      categories,
      resume: `${retenus} monstre(s)${auteur}`,
    });
  }

  const dateBackup = backup.backup ? depuis(backup.backup.date) : '';

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => (backup.backup ? setEcraserAConfirmer(true) : sauvegarder())}
          disabled={vide}
          className={BOUTON}
          title={
            vide
              ? 'Ajoute des monstres avant de poser un point de sauvegarde'
              : 'Fige la prépa actuelle comme point de retour. Ta prépa est déjà conservée automatiquement : ceci sert à pouvoir revenir en arrière après des essais.'
          }
        >
          <Save size={14} /> Sauvegarder
        </button>

        <button
          onClick={() => setReprendreAConfirmer(true)}
          disabled={!backup.backup}
          className={BOUTON}
          title={
            backup.backup
              ? `Revenir au point de sauvegarde (${dateBackup})`
              : "Aucun point de sauvegarde : clique d'abord sur « Sauvegarder »"
          }
        >
          <RotateCcw size={14} /> Reprendre
        </button>

        <span className="w-px h-5 bg-border" aria-hidden />

        <button
          onClick={exporter}
          disabled={vide}
          className={BOUTON}
          title="Télécharger ta prépa en fichier .json, pour la partager ou la garder de côté"
        >
          <Upload size={14} /> Exporter
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className={BOUTON}
          title="Charger une prépa reçue d'un ami (fichier .json)"
        >
          <Download size={14} /> Importer
        </button>
      </div>

      {/* Le point de sauvegarde est ANNONCÉ : sans repère visible, on ne sait
          pas s'il existe ni de quand il date — donc on n'ose pas expérimenter. */}
      {backup.backup && (
        <p className="mt-1.5 font-mono text-[11px] text-ink-dim">
          Point de sauvegarde : {Object.keys(backup.backup.state.entries).length} monstre(s) ·{' '}
          {dateBackup}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de recharger le même fichier
          if (!f) return;
          f.text().then(lireFichier);
        }}
      />

      {msg && (
        <p className={`mt-2 text-[12.5px] ${msg.error ? 'text-fire' : 'text-good'}`} role="status">
          {msg.text}
        </p>
      )}

      {report && (report.errors.length > 0 || report.warnings.length > 0) && (
        <ValidationReport report={report} onClose={() => setReport(null)} />
      )}

      {/* Écraser un point existant : c'est une perte, donc on confirme. */}
      {ecraserAConfirmer && (
        <ConfirmDialog
          titre="Remplacer le point de sauvegarde ?"
          message={
            <>
              Le point posé <b className="text-ink">{dateBackup}</b> (
              {Object.keys(backup.backup?.state.entries ?? {}).length} monstre(s)) sera remplacé par
              ta prépa actuelle ({nbMonstres} monstre(s)). Tu ne pourras plus y revenir.
            </>
          }
          libelleAction="Remplacer"
          destructif
          onCancel={() => setEcraserAConfirmer(false)}
          onConfirm={() => {
            setEcraserAConfirmer(false);
            sauvegarder();
          }}
        />
      )}

      {reprendreAConfirmer && backup.backup && (
        <ConfirmDialog
          titre="Revenir au point de sauvegarde ?"
          message={
            <>
              Ta prépa actuelle ({nbMonstres} monstre(s)) sera remplacée par celle sauvegardée{' '}
              <b className="text-ink">{dateBackup}</b> (
              {Object.keys(backup.backup.state.entries).length} monstre(s)). Les catégories suivent.
            </>
          }
          libelleAction="Reprendre"
          destructif
          onCancel={() => setReprendreAConfirmer(false)}
          onConfirm={() => {
            setReprendreAConfirmer(false);
            reprendre();
          }}
        />
      )}

      {aConfirmer && (
        <ConfirmDialog
          titre="Remplacer ta prépa par celle-ci ?"
          message={
            <>
              La prépa importée ({aConfirmer.resume}) remplacera la tienne ({nbMonstres} monstre(s))
              et ses catégories.{' '}
              {backup.backup ? (
                <>
                  Ton point de sauvegarde n'est pas touché : tu pourras revenir en arrière avec
                  « Reprendre ».
                </>
              ) : (
                <>
                  <b className="text-ink">
                    Tu n'as aucun point de sauvegarde : ton classement actuel sera perdu.
                  </b>{' '}
                  Annule et clique « Sauvegarder » d'abord si tu veux pouvoir y revenir.
                </>
              )}{' '}
              Tes runes importées ne changent pas.
            </>
          }
          libelleAction="Remplacer ma prépa"
          destructif
          onCancel={() => setAConfirmer(null)}
          onConfirm={() => {
            rta.replaceAll(aConfirmer.state);
            cats.replaceAll(aConfirmer.categories);
            setMsg({ text: `Prépa importée · ${aConfirmer.resume}.` });
            setAConfirmer(null);
          }}
        />
      )}
    </div>
  );
}

// Rapport de validation du dernier import. Reste affiché jusqu'à fermeture :
// contrairement au message de succès, il y a quelque chose à LIRE.
function ValidationReport({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const bloque = report.errors.length > 0;
  return (
    <div
      className={`mt-2 rounded-xl border px-3 py-2.5 ${
        bloque ? 'border-fire/50 bg-fire/5' : 'border-warn/40 bg-warn/5'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {bloque ? (
          <XCircle size={15} className="flex-none text-fire" />
        ) : (
          <AlertTriangle size={15} className="flex-none text-warn" />
        )}
        <span className={`text-[12.5px] font-semibold ${bloque ? 'text-fire' : 'text-warn'}`}>
          {bloque
            ? "Import refusé — le contenu n'est pas valide"
            : `Lu avec ${report.warnings.length} correction${report.warnings.length > 1 ? 's' : ''}`}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-ink-dim hoverable:text-ink transition"
          title="Fermer le rapport"
        >
          <X size={14} />
        </button>
      </div>

      <ul className="space-y-0.5 max-h-[220px] overflow-y-auto">
        {report.errors.map((e, i) => (
          <li key={`e${i}`} className="text-[12px] text-fire leading-snug">
            • {e}
          </li>
        ))}
        {report.warnings.map((w, i) => (
          <li key={`w${i}`} className="text-[12px] text-warn/90 leading-snug">
            • {w}
          </li>
        ))}
      </ul>

      {!bloque && (
        <p className="mt-1.5 font-mono text-[11px] text-ink-dim">
          {report.counts.monstres} monstre(s) · {report.counts.sections} section(s) ·{' '}
          {report.counts.categories} catégorie(s) lus.
        </p>
      )}
    </div>
  );
}
