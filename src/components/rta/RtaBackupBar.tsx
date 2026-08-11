import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  RotateCcw,
  Upload,
  Download,
  Users,
  AlertTriangle,
  XCircle,
  X,
  Eye,
  EyeOff,
  Gauge,
} from 'lucide-react';
import { Monster, RtaState } from '../../types';
import { UseRtaState } from '../../hooks/useRtaState';
import { UseRtaCategories } from '../../hooks/useRtaCategories';
import { UseRtaBackup } from '../../hooks/useRtaBackup';
import {
  appliquer,
  comptePartageable,
  encodeSnapshot,
  ImportReport,
  RtaVueAmi,
  slugify,
  toSnapshot,
  validateRtaImport,
  versVueAmi,
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
 * ⚠️ **Consulter n'est pas importer.** La prépa d'un ami s'ouvre EN LECTURE, à
 * côté de la sienne : elle ne remplace rien, ne se compare à rien, et n'entre
 * jamais dans l'état local. C'est ce qui permet de l'ouvrir sans confirmation —
 * il n'y a rien à perdre. Voir RtaFriendView.tsx.
 *
 * ⚠️ **Deux gestes seulement modifient la prépa** (Reprendre, et l'écrasement
 * d'un point existant) : les deux confirment, et jamais avec un OK destructeur —
 * « Annuler » est le défaut, l'action portée en couleur d'alerte. Voir
 * ../Dialogs.tsx.
 */

// Ce que l'auteur laisse voir de son runage. Trois niveaux et non deux cases à
// cocher : « vitesses sans les runes » est un cas réel (on partage son speed
// tune sans exposer ses substats), et une paire de cases laisserait choisir
// « runes sans vitesses », qui n'a pas de sens — les runes portent la vitesse.
export type NiveauPartage = 'complet' | 'vitesses' | 'classement';

interface Props {
  rta: UseRtaState;
  cats: UseRtaCategories;
  backup: UseRtaBackup;
  monsters: Monster[];
  /** Remonte la prépa consultée : elle s'affiche sous la page, pas ici. */
  onConsulter: (vue: RtaVueAmi) => void;
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

export default function RtaBackupBar({ rta, cats, backup, monsters, onConsulter }: Props) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // Rapport de validation : NON éphémère, il y a quelque chose à lire.
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reprendreAConfirmer, setReprendreAConfirmer] = useState(false);
  const [ecraserAConfirmer, setEcraserAConfirmer] = useState(false);
  // Choix « avec / sans équipement », posé au moment d'exporter.
  const [exportAChoisir, setExportAChoisir] = useState(false);
  // Import en attente de confirmation : l'appliquer écraserait la prépa en cours.
  const [aConfirmer, setAConfirmer] = useState<{
    state: RtaState;
    categories: { label: string; color: string; members: string[] }[];
    resume: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // ⚠️ Le MÊME fichier se lit de deux façons : consulté ou repris. L'intention
  // ne se devine pas, elle est déclarée par le bouton cliqué — mémorisée ici le
  // temps que le sélecteur de fichier rende la main.
  const modeRef = useRef<'consulter' | 'importer'>('consulter');

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

  // Combien de monstres emporteraient réellement leur équipement ? Sert à ne pas
  // proposer « avec mes runes » à quelqu'un qui n'a pas importé de compte.
  const avecRunes = useMemo(
    () => Object.values(rta.state.entries).filter((e) => e.gear && e.gear.runes.length > 0).length,
    [rta.state.entries]
  );

  function exporter(niveau: NiveauPartage) {
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
    const snap = toSnapshot(rta.state, cats.categories, monsterById, {
      avecEquipement: niveau === 'complet',
      avecVitesses: niveau !== 'classement',
    });
    download(
      `swforge-prepa-rta-${slugify(new Date().toISOString().slice(0, 10))}.json`,
      encodeSnapshot(snap)
    );
    const dit: Record<NiveauPartage, string> = {
      complet: 'avec les runes, artéfacts et vitesses',
      vitesses: 'avec les vitesses, sans le détail des runes',
      classement: 'classement seul, sans les runes ni les vitesses',
    };
    // ⚠️ Les monstres perso écartés sont ANNONCÉS : un fichier silencieusement
    // incomplet se découvrirait chez l'ami, trop tard.
    setMsg({
      text:
        `${partageables} monstre(s) exporté(s) ${dit[niveau]} · fichier .json téléchargé.` +
        (perso > 0 ? ` ${perso} monstre(s) perso non partageable(s) : non inclus.` : ''),
    });
  }

  // Un seul lecteur de fichier pour les deux boutons — même format, même
  // validation. Seul diffère ce qu'on fait du résultat.
  function lireFichier(text: string) {
    const mode = modeRef.current;
    const rep = validateRtaImport(text);
    setReport(rep);
    if (!rep.snapshot) return; // erreurs bloquantes : rien à faire

    const inconnus =
      mode === 'consulter'
        ? versVueAmi(rep.snapshot, monsterByCom2us).inconnus
        : appliquer(rep.snapshot, monsterByCom2us, rta.state).inconnus;

    if (inconnus.length > 0) {
      rep.warnings.push(
        `${inconnus.length} monstre(s) absent(s) des données chargées (id ${inconnus
          .slice(0, 5)
          .join(', ')}${inconnus.length > 5 ? '…' : ''}) : ${
          mode === 'consulter' ? 'non affichés' : 'non repris'
        }.`
      );
      setReport({ ...rep });
    }

    if (mode === 'consulter') {
      // ⚠️ Rien n'entre dans la prépa locale : il n'y a rien à perdre, donc rien
      // à confirmer.
      const vue = versVueAmi(rep.snapshot, monsterByCom2us);
      if (vue.entries.length === 0) {
        setMsg({
          text: "Aucun monstre de ce fichier n'existe dans les données chargées.",
          error: true,
        });
        return;
      }
      onConsulter(vue);
      const auteur = vue.auteur ? ` de ${vue.auteur}` : '';
      setMsg({
        text: `Prépa${auteur} ouverte en consultation · ${vue.entries.length} monstre(s)${
          vue.avecEquipement ? ', runes incluses' : ', sans les runes'
        }. Ta prépa n'a pas bougé.`,
      });
      return;
    }

    // Reprise d'une prépa : elle REMPLACE la sienne (il n'y en a qu'une), donc
    // elle passe par une confirmation qui énonce ce qu'on perd.
    const { state, categories } = appliquer(rep.snapshot, monsterByCom2us, rta.state);
    const retenus = Object.keys(state.entries).length;
    if (retenus === 0) {
      setMsg({ text: "Aucun monstre de ce fichier n'existe dans les données chargées.", error: true });
      return;
    }
    setAConfirmer({ state, categories, resume: `${retenus} monstre(s)` });
  }

  function ouvrirFichier(mode: 'consulter' | 'importer') {
    modeRef.current = mode;
    fileRef.current?.click();
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
          onClick={() => setExportAChoisir(true)}
          disabled={vide}
          className={BOUTON}
          title="Télécharger ta prépa en fichier .json, pour la partager ou la garder de côté"
        >
          <Upload size={14} /> Exporter
        </button>

        {/* ⚠️ DEUX boutons pour un même format de fichier, parce que ce sont
            deux intentions : reprendre une prépa à soi (elle remplace), ou
            regarder celle d'un ami (elle ne touche à rien). Un seul bouton
            obligerait à demander « et maintenant, j'en fais quoi ? » après coup,
            alors que l'utilisateur le sait déjà en cliquant. */}
        <button
          onClick={() => ouvrirFichier('importer')}
          className={BOUTON}
          title="Reprendre une prépa exportée : une archive, ou celle d'un autre navigateur. Elle remplacera la tienne."
        >
          <Download size={14} /> Importer
        </button>

        <button
          onClick={() => ouvrirFichier('consulter')}
          className={BOUTON}
          title="Ouvrir la prépa d'un ami en lecture (fichier .json). Ta prépa n'est pas touchée."
        >
          <Users size={14} /> Consulter celle d'un ami
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
          titre="Remplacer ta prépa par ce fichier ?"
          message={
            <>
              La prépa du fichier ({aConfirmer.resume}) remplacera la tienne ({nbMonstres}{' '}
              monstre(s)) et ses catégories.{' '}
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
              Les runes de tes propres monstres ne changent pas.
              {/* Si l'intention était de regarder la prépa d'un ami, ce dialogue
                  est le dernier endroit où le dire — après, c'est remplacé. */}
              <br />
              <span className="text-ink-dim">
                Pour seulement la regarder sans rien changer, annule et utilise « Consulter celle
                d'un ami ».
              </span>
            </>
          }
          libelleAction="Remplacer ma prépa"
          destructif
          onCancel={() => setAConfirmer(null)}
          onConfirm={() => {
            rta.replaceAll(aConfirmer.state);
            cats.replaceAll(aConfirmer.categories);
            setMsg({ text: `Prépa reprise · ${aConfirmer.resume}.` });
            setAConfirmer(null);
          }}
        />
      )}

      {exportAChoisir && (
        <ChoixExport
          avecRunes={avecRunes}
          onAnnuler={() => setExportAChoisir(false)}
          onChoisir={(niveau) => {
            setExportAChoisir(false);
            exporter(niveau);
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Choix d'export : avec ou sans l'équipement
 * -----------------------------------------------------------------------
 *
 * ⚠️ **Une question, pas une case à cocher enfouie.** Ce que le fichier contient
 * n'est pas un détail : partager ses runes, c'est montrer ce qu'on possède.
 * Certains le veulent (c'est tout l'intérêt de consulter la prépa d'un ami),
 * d'autres non. Le choix est donc posé à voix haute, au moment d'exporter, avec
 * ce que chaque option donne à voir.
 *
 * ⚠️ Aucune des deux réponses ne détruit quoi que ce soit : les deux
 * téléchargent un fichier. « Avec » est mis en avant parce que c'est ce qui rend
 * la consultation utile, pas parce que l'autre serait un mauvais choix.
 */
function ChoixExport({
  avecRunes,
  onChoisir,
  onAnnuler,
}: {
  avecRunes: number;
  onChoisir: (niveau: NiveauPartage) => void;
  onAnnuler: () => void;
}) {
  const options: {
    cle: NiveauPartage;
    icone: typeof Eye;
    titre: string;
    detail: string;
    compte?: number;
    desactive?: boolean;
  }[] = [
    {
      cle: 'complet',
      icone: Eye,
      titre: 'Tout : runes, artéfacts et vitesses',
      detail: 'Il voit comment tu runes chaque monstre, et son ordre de tour est calculé.',
      compte: avecRunes,
      desactive: avecRunes === 0,
    },
    {
      cle: 'vitesses',
      icone: Gauge,
      titre: 'Vitesses seules, sans le détail des runes',
      detail:
        "Il voit tes sections et tes vitesses — donc ton ordre de tour — mais pas tes sets ni tes substats.",
    },
    {
      cle: 'classement',
      icone: EyeOff,
      titre: 'Classement seul',
      detail:
        "Il voit quels monstres tu runes et dans quelle section, rien d'autre. Pas d'ordre de tour.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      onClick={onAnnuler}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-rta-titre"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-2xl border border-border bg-panel p-5 shadow-glow shadow-black/60"
      >
        <h2 id="export-rta-titre" className="text-[15px] font-bold text-ink">
          Que veux-tu partager ?
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">
          Tes sections et tes catégories sont toujours incluses. La question porte sur ce que tu
          laisses voir de <b className="text-ink">ton runage</b>.
        </p>

        {avecRunes === 0 && (
          <p className="mt-3 rounded-lg border border-border bg-panel2 px-3 py-2 text-[11.5px] leading-relaxed text-ink-dim">
            Aucun de tes monstres ne porte de runes connues — importe ton compte pour pouvoir les
            partager.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {options.map((o, i) => {
            const Icone = o.icone;
            return (
              <button
                key={o.cle}
                onClick={() => onChoisir(o.cle)}
                autoFocus={i === 0}
                disabled={o.desactive}
                className="flex items-start gap-2.5 rounded-xl border border-border bg-panel2 px-3 py-2.5 text-left
                           transition hoverable:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icone size={16} className="mt-[2px] flex-none text-ink-dim" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                    {o.titre}
                    {o.compte ? (
                      <span className="font-mono text-[11px] text-ink-dim">{o.compte}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-dim">
                    {o.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ⚠️ Explique POURQUOI cacher les runes cache aussi les vitesses.
            Sans cette phrase, l'option « classement seul » passe pour une
            restriction gratuite, alors qu'elle ferme la seule vraie fuite. */}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-dim">
          La vitesse de base d'un monstre est publique : donner sa vitesse totale revient à donner
          la vitesse de ses runes. C'est pourquoi « classement seul » les retire aussi.
        </p>

        <button
          onClick={onAnnuler}
          className="mt-3 w-full text-center text-[12px] text-ink-dim hoverable:text-ink transition"
        >
          Annuler
        </button>
      </div>
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
          {report.counts.monstres} monstre(s) · {report.counts.avecRunes} avec runes ·{' '}
          {report.counts.categories} catégorie(s) lus.
        </p>
      )}
    </div>
  );
}
