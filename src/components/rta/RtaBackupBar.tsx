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
  History,
} from 'lucide-react';
import { ElementKey, Monster, RtaState } from '../../types';
import { CustomLead } from '../../hooks/useCustomMonsters';
import { UseRtaState } from '../../hooks/useRtaState';
import { UseRtaCategories } from '../../hooks/useRtaCategories';
import { UseRtaBackup } from '../../hooks/useRtaBackup';
import {
  appliquer,
  comptePartageable,
  encodeSnapshot,
  ImportReport,
  NiveauPartage,
  RtaSnapshot,
  RtaVueAmi,
  toSnapshot,
  validateRtaImport,
  versVueAmi,
} from '../../lib/rtaShare';
import { ConfirmDialog } from '../Dialogs';

/* --------------------------------------------------------------------------
 * Sauvegarder · Reprendre · Réinitialiser · Exporter · Importer
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
 * ⚠️ **Trois points de retour, trois portées différentes** :
 *
 *   | Bouton | Ramène à | Posé par |
 *   |--------|----------|----------|
 *   | Reprendre | le point qu'on a figé soi-même | « Sauvegarder » |
 *   | Réinitialiser | la prépa **telle que l'import l'a produite** | automatiquement, à chaque import de compte |
 *   | Importer | une prépa d'un fichier | l'utilisateur |
 *
 * ⚠️ **Tout geste qui modifie la prépa confirme**, et jamais avec un OK
 * destructeur — « Annuler » est le défaut, l'action portée en couleur d'alerte.
 * Voir ../Dialogs.tsx.
 */

interface Props {
  rta: UseRtaState;
  cats: UseRtaCategories;
  backup: UseRtaBackup;
  monsters: Monster[];
  /** Remonte la prépa consultée : elle s'affiche sous la page, pas ici. */
  onConsulter: (vue: RtaVueAmi) => void;
  /**
   * Recrée un monstre perso à la reprise d'une prépa. ⚠️ Utilisé par « Importer »
   * seulement : la consultation, elle, se contente d'afficher ceux du fichier
   * sans rien créer chez le lecteur.
   */
  onCreateMonster: (
    name: string,
    element: ElementKey,
    speed: number,
    lead?: CustomLead | null
  ) => Monster;
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

// ⚠️ **Icône seule sous `sm`** — le libellé vit dans un `<span className="hidden
// compact:hidden">`, et dans le `title` de chaque bouton. Six actions à libellé
// complet, chacune portée à 40 px de haut par la règle tactile, remplissaient
// l'écran d'un téléphone : trois rangées de boutons avant d'atteindre la prépa.
// Rien n'est perdu — l'intitulé reste au survol et au lecteur d'écran.
// ⚠️ **L'ICÔNE NUE sous `sm`** — ni cadre, ni bordure, ni fond. Six boutons
// encadrés faisaient six carrés dans une barre qu'on cherche à compacter, et le
// cadre n'apprend rien : l'icône dit l'action, sa présence dit qu'on peut la
// toucher. Le cadre revient à la souris, où la barre a la place et où le survol
// a besoin d'une surface à colorer.
// `data-cible-fine` est posé sur chaque bouton ; `.cible-tactile` rend 44 px
// touchables sans qu'un pixel du dessin ne bouge.
// ⚠️ **Le même gabarit que `CreateMonster`** (`px-3.5 py-2 / 13 px`) : les sept
// boutons se retrouvent côte à côte dans le panneau mobile, et « Monstre » y
// paraissait plus grand que ses six voisins — un bouton d'action n'a pas de
// raison de peser plus qu'un autre. Les deux gabarits doivent rester alignés.
const BOUTON =
  'cible-tactile relative flex items-center justify-center gap-1.5 rounded-lg border ' +
  'border-border bg-panel px-3.5 py-2 text-sm text-ink-dim hoverable:text-ink ' +
  'hoverable:border-accent transition disabled:opacity-40 disabled:cursor-not-allowed ' +
  'compact:gap-0 compact:rounded-none compact:border-0 compact:bg-transparent ' +
  'compact:px-0 compact:py-0';

export default function RtaBackupBar({
  rta,
  cats,
  backup,
  monsters,
  onConsulter,
  onCreateMonster,
}: Props) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // Rapport de validation : NON éphémère, il y a quelque chose à lire.
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reprendreAConfirmer, setReprendreAConfirmer] = useState(false);
  const [ecraserAConfirmer, setEcraserAConfirmer] = useState(false);
  const [resetAConfirmer, setResetAConfirmer] = useState(false);
  // Choix « avec / sans équipement », posé au moment d'exporter.
  const [exportAChoisir, setExportAChoisir] = useState(false);
  // Import en attente de confirmation : l'appliquer écraserait la prépa en cours.
  const [aConfirmer, setAConfirmer] = useState<{
    snapshot: RtaSnapshot;
    resume: string;
    perso: number; // monstres perso qui seront recréés
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
    setMsg({ text: 'Point de sauvegarde posé.' });
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

  // Retour à la prépa **telle que l'import de compte l'a produite**.
  //
  // ⚠️ C'est le geste le plus destructeur de la barre : il efface d'un coup tout
  // le classement fait à la main depuis l'import. D'où une confirmation qui
  // l'énonce, et qui rappelle qu'un export est la seule façon d'en garder trace.
  function reinitialiser() {
    if (!backup.importe) return;
    rta.replaceAll(backup.importe.state);
    cats.replaceAll(
      backup.importe.categories.map((c) => ({ label: c.label, color: c.color, members: c.members }))
    );
    setMsg({ text: 'Prépa remise dans l’état de ton dernier import de compte.' });
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
      setMsg({ text: 'Rien à exporter : ta prépa est vide.', error: true });
      return;
    }
    const snap = toSnapshot(rta.state, cats.categories, monsterById, { niveau });
    // ⚠️ **Le nom du fichier dit ce qu'il contient.** C'est le seul repère
    // avant de l'ouvrir — et quand on en a plusieurs dans son dossier de
    // téléchargements, ou qu'on en reçoit un d'un ami, « swforge-prepa-rta.json »
    // ne permet pas de savoir si les runes y sont.
    const suffixe: Record<NiveauPartage, string> = {
      complet: 'complet',
      vitesses: 'ordre-et-sets',
      ordre: 'ordre-seul',
    };
    const jour = new Date().toISOString().slice(0, 10); // déjà « 2026-08-11 »
    const fichier = `swforge-prepa-rta-${suffixe[niveau]}-${jour}.json`;
    download(fichier, encodeSnapshot(snap));
    const dit: Record<NiveauPartage, string> = {
      complet: 'avec les runes et artéfacts',
      vitesses: 'ordre de tour, vitesses et sets',
      ordre: 'ordre de tour seul',
    };
    // ⚠️ Le nom du fichier est REPRIS dans le message : c'est lui qu'on ira
    // chercher dans ses téléchargements. Les monstres perso PARTENT désormais
    // (décrits en entier), mais on le dit : ils s'afficheront sans portrait chez
    // le lecteur, qui ne les a pas dans ses données.
    setMsg({
      text:
        `${partageables} monstre(s) exporté(s) ${dit[niveau]} · ${fichier}` +
        (perso > 0 ? ` · dont ${perso} monstre(s) perso, affiché(s) sans portrait.` : ''),
    });
  }

  // Un seul lecteur de fichier pour les deux boutons — même format, même
  // validation. Seul diffère ce qu'on fait du résultat.
  function lireFichier(text: string) {
    const mode = modeRef.current;
    const rep = validateRtaImport(text);
    setReport(rep);
    if (!rep.snapshot) return; // erreurs bloquantes : rien à faire

    // ⚠️ Compté SANS `creerPerso` : appeler `appliquer` ici puis à la
    // confirmation créerait chaque monstre perso deux fois. La création est
    // différée au moment où l'utilisateur valide.
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
      const contenu: Record<NiveauPartage, string> = {
        complet: ', runes incluses',
        vitesses: ', ordre de tour et sets',
        ordre: ', ordre de tour seul',
      };
      setMsg({
        text: `Prépa${auteur} ouverte en consultation · ${vue.entries.length} monstre(s)${
          contenu[vue.niveau]
        }. Ta prépa n'a pas bougé.`,
      });
      return;
    }

    // Reprise d'une prépa : elle REMPLACE la sienne (il n'y en a qu'une), donc
    // elle passe par une confirmation qui énonce ce qu'on perd.
    // ⚠️ On garde l'INSTANTANÉ, pas l'état calculé : recréer les monstres perso
    // n'a lieu qu'à la validation, sinon annuler laisserait derrière soi des
    // monstres créés pour rien.
    const { state } = appliquer(rep.snapshot, monsterByCom2us, rta.state);
    const perso = rep.snapshot.entries.filter((e) => e.com2usId == null && e.perso).length;
    const retenus = Object.keys(state.entries).length + perso;
    if (retenus === 0) {
      setMsg({ text: "Aucun monstre de ce fichier n'existe dans les données chargées.", error: true });
      return;
    }
    setAConfirmer({
      snapshot: rep.snapshot,
      resume: `${retenus} monstre(s)`,
      perso,
    });
  }

  function ouvrirFichier(mode: 'consulter' | 'importer') {
    modeRef.current = mode;
    fileRef.current?.click();
  }

  const dateBackup = backup.backup ? depuis(backup.backup.date) : '';

  return (
    // ⚠️ `data-passe-grille` : dans le panneau mobile, ce conteneur et celui
    // des deux rangées s'effacent pour que les six boutons deviennent les
    // enfants directs de la grille commune (voir index.css).
    <div data-passe-grille className="mt-4">
      {/* ⚠️ **Une rangée par TYPE d'action**, et non une seule file de six
          boutons. Les trois premiers agissent sur l'état COURANT de la prépa
          (le figer, y revenir) ; les trois suivants échangent un FICHIER avec
          l'extérieur. Alignés d'affilée, « Réinitialiser » et « Exporter » se
          lisaient comme voisins alors qu'ils n'ont rien à voir — et le
          séparateur vertical qui les distinguait passait inaperçu dès que la
          rangée se repliait, ce qu'elle fait sur tout écran étroit. */}
      {/* ⚠️ `data-grille-actions` : dans le panneau mobile, les DEUX rangées
          fusionnent en une seule grille de six cellules égales (voir
          index.css). Chacune y formait sinon sa propre grille de trois
          colonnes, et celle qui perdait « Réinitialiser » — absent tant qu'aucun
          compte n'a été importé — étirait sa dernière cellule. */}
      <div data-grille-actions data-passe-grille className="flex flex-col gap-1.5">
      {/* ⚠️ Écart PLUS LARGE sous `sm`, où les boutons sont des icônes nues :
          sans cadre pour les délimiter, six icônes à 8 px d'intervalle se lisent
          comme une frise continue, et l'on ne sait plus où finit l'une et où
          commence la suivante. C'est l'espace qui remplace le trait. */}
      <div data-rangee-actions className="flex flex-wrap items-center gap-2 compact:gap-4">
        <button
          onClick={() => (backup.backup ? setEcraserAConfirmer(true) : sauvegarder())}
          disabled={vide}
          aria-label="Sauvegarder"
          data-cible-fine
          className={BOUTON}
          title={
            vide
              ? 'Ajoute des monstres avant de poser un point de sauvegarde'
              : 'Fige la prépa actuelle comme point de retour. Ta prépa est déjà conservée automatiquement : ceci sert à pouvoir revenir en arrière après des essais.'
          }
        >
          <Save size={14} /> <span className="compact:hidden">Sauvegarder</span>
        </button>

        <button
          onClick={() => setReprendreAConfirmer(true)}
          disabled={!backup.backup}
          aria-label="Reprendre"
          data-cible-fine
          className={BOUTON}
          title={
            backup.backup
              ? `Revenir au point de sauvegarde (${dateBackup})`
              : "Aucun point de sauvegarde : clique d'abord sur « Sauvegarder »"
          }
        >
          <RotateCcw size={14} /> <span className="compact:hidden">Reprendre</span>
        </button>

        {/* ⚠️ N'apparaît QUE si un compte a été importé : sans point d'import,
            le bouton n'aurait aucun état où revenir. Le griser en permanence
            aurait ajouté une promesse à celui qui n'importe jamais de compte. */}
        {backup.importe && (
          <button
            onClick={() => setResetAConfirmer(true)}
            aria-label="Réinitialiser"
            data-cible-fine
          className={BOUTON}
            title={`Remettre la prépa dans l'état de ton dernier import de compte (${depuis(
              backup.importe.date
            )})`}
          >
            <History size={14} /> <span className="compact:hidden">Réinitialiser</span>
          </button>
        )}

      </div>

      <div data-rangee-actions className="flex flex-wrap items-center gap-2 compact:gap-4">
        <button
          onClick={() => setExportAChoisir(true)}
          disabled={vide}
          aria-label="Exporter"
          data-cible-fine
          className={BOUTON}
          title="Télécharger ta prépa en fichier .json, pour la partager ou la garder de côté"
        >
          <Upload size={14} /> <span className="compact:hidden">Exporter</span>
        </button>

        {/* ⚠️ DEUX boutons pour un même format de fichier, parce que ce sont
            deux intentions : reprendre une prépa à soi (elle remplace), ou
            regarder celle d'un ami (elle ne touche à rien). Un seul bouton
            obligerait à demander « et maintenant, j'en fais quoi ? » après coup,
            alors que l'utilisateur le sait déjà en cliquant. */}
        <button
          onClick={() => ouvrirFichier('importer')}
          aria-label="Importer"
          data-cible-fine
          className={BOUTON}
          title="Reprendre une prépa exportée : une archive, ou celle d'un autre navigateur. Elle remplacera la tienne."
        >
          <Download size={14} /> <span className="compact:hidden">Importer</span>
        </button>

        <button
          onClick={() => ouvrirFichier('consulter')}
          aria-label="Consulter la prépa d'un ami"
          data-cible-fine
          className={BOUTON}
          title="Ouvrir la prépa d'un ami en lecture (fichier .json). Ta prépa n'est pas touchée."
        >
          {/* ⚠️ **« Ami » et rien d'autre.** Le libellé complet — « Consulter
              celle d'un ami » — fait à lui seul près de la moitié d'une largeur
              de téléphone : dans la grille du panneau il passait sur trois
              lignes et déformait toute la rangée. Deux variantes n'y changeaient
              rien, la règle qui révèle les libellés dans le panneau les
              affichant l'une et l'autre.
              Le sens tient dans le mot ; l'infobulle et `aria-label` portent la
              phrase entière. */}
          <Users size={14} />
          <span className="compact:hidden">Ami</span>
        </button>
      </div>
      </div>

      {/* Le point de sauvegarde est ANNONCÉ : sans repère visible, on ne sait
          pas s'il existe ni de quand il date — donc on n'ose pas expérimenter. */}
      {backup.backup && (
        <p className="mt-1.5 font-mono text-micro text-ink-dim">
          {/* ⚠️ Le NOMBRE de monstres a disparu de cette ligne. Il ne servait
              à rien qu'on vienne y chercher : ce qu'on veut savoir, c'est
              QUAND le point a été posé, pour décider si l'on peut y revenir
              sans perdre le travail de la session. Le compte, lui, se lit sur
              la prépa elle-même, juste en dessous. */}
          Point de sauvegarde · {dateBackup}
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
        <p className={`mt-2 text-xs ${msg.error ? 'text-fire' : 'text-good'}`} role="status">
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

      {/* ⚠️ La confirmation la plus bavarde de la barre, et elle le mérite : ce
          geste efface tout le classement fait depuis l'import, ET le point de
          sauvegarde manuel devient une référence vers un état qu'on quitte. On
          dit donc les deux, et on rappelle qu'un export est la seule façon de
          garder ce travail. */}
      {resetAConfirmer && backup.importe && (
        <ConfirmDialog
          titre="Revenir à l'état de ton import de compte ?"
          message={
            <>
              Ta prépa actuelle ({nbMonstres} monstre(s)) et ses catégories seront remplacées par
              celles issues de ton import du{' '}
              <b className="text-ink">{depuis(backup.importe.date)}</b> (
              {Object.keys(backup.importe.state.entries).length} monstre(s)).{' '}
              <b className="text-ink">
                Tout le classement que tu as fait depuis sera perdu
              </b>{' '}
              — monstres ajoutés à la main, sections modifiées, catégories.
              {backup.backup && (
                <>
                  {' '}
                  Ton point de sauvegarde du <b className="text-ink">{dateBackup}</b> reste en place,
                  mais il pointe vers un classement d'avant ce retour en arrière.
                </>
              )}
              <br />
              <span className="text-ink-dim">
                Pour garder ton travail actuel, annule et utilise « Exporter » : c'est le seul moyen
                de le retrouver ensuite.
              </span>
            </>
          }
          libelleAction="Réinitialiser"
          destructif
          onCancel={() => setResetAConfirmer(false)}
          onConfirm={() => {
            setResetAConfirmer(false);
            reinitialiser();
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
              {aConfirmer.perso > 0 && (
                <>
                  {' '}
                  {aConfirmer.perso} monstre(s) perso du fichier seront{' '}
                  <b className="text-ink">recréés</b> dans ta liste.
                </>
              )}
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
            // ⚠️ C'est ICI que les monstres perso sont recréés — pas avant :
            // annuler ne doit rien laisser derrière soi.
            const { state, categories } = appliquer(
              aConfirmer.snapshot,
              monsterByCom2us,
              rta.state,
              (p) =>
                onCreateMonster(
                  p.nom,
                  p.element,
                  p.vitesse,
                  p.lead
                    ? {
                        stat: p.lead.stat,
                        amount: p.lead.amount,
                        area: p.lead.area === 'Element' ? 'Element' : 'General',
                      }
                    : null
                )
            );
            rta.replaceAll(state);
            cats.replaceAll(categories);
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
      titre: 'Tout : ta prépa, tes runes et tes artéfacts',
      detail:
        'Il voit ton classement par section et le détail de chaque rune, substats compris.',
      compte: avecRunes,
      desactive: avecRunes === 0,
    },
    {
      cle: 'vitesses',
      icone: Gauge,
      titre: 'Ordre de tour : vitesses et sets',
      detail:
        "Il voit ton ordre de tour avec la vitesse et les sets de chaque monstre, mais pas le détail de tes runes ni ton classement par section.",
    },
    {
      cle: 'ordre',
      icone: EyeOff,
      titre: 'Ordre de tour seul',
      detail:
        "Il voit seulement qui passe avant qui, en vignettes numérotées. Pas de vitesses, pas de sets, pas de sections.",
    },
  ];

  return (
    <div
      // ⚠️ `z-[70]` comme les autres dialogues (voir Dialogs.tsx) : celui-ci
      // s'ouvre depuis le panneau d'actions, qui est lui-même à `z-50`. Au même
      // niveau, le panneau — monté après dans le DOM — serait passé devant.
      className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/80 p-4"
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
        <h2 id="export-rta-titre" className="text-base font-bold text-ink">
          Que veux-tu partager ?
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
          Tes sections et tes catégories sont toujours incluses. La question porte sur ce que tu
          laisses voir de <b className="text-ink">ton runage</b>.
        </p>

        {avecRunes === 0 && (
          <p className="mt-3 rounded-lg border border-border bg-panel2 px-3 py-2 text-micro leading-relaxed text-ink-dim">
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
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    {o.titre}
                    {o.compte ? (
                      <span className="font-mono text-micro text-ink-dim">{o.compte}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-micro leading-relaxed text-ink-dim">
                    {o.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ⚠️ Explique POURQUOI chaque palier retire ce qu'il retire. Sans ces
            phrases, les restrictions passent pour arbitraires alors que chacune
            ferme une fuite réelle. */}
        <p className="mt-3 text-micro leading-relaxed text-ink-dim">
          Le <b className="text-ink">classement par section</b> part avec le détail des runes :
          ranger un monstre dans « Swift » en dit autant que l'icône. Et la vitesse de base étant
          publique, donner la vitesse totale revient à donner celle des runes — c'est pourquoi le
          dernier niveau ne transmet que l'ordre.
        </p>

        <button
          onClick={onAnnuler}
          className="mt-3 w-full text-center text-xs text-ink-dim hoverable:text-ink transition"
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
        <span className={`text-xs font-semibold ${bloque ? 'text-fire' : 'text-warn'}`}>
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
          <li key={`e${i}`} className="text-xs text-fire leading-snug">
            • {e}
          </li>
        ))}
        {report.warnings.map((w, i) => (
          <li key={`w${i}`} className="text-xs text-warn/90 leading-snug">
            • {w}
          </li>
        ))}
      </ul>

      {!bloque && (
        <p className="mt-1.5 font-mono text-micro text-ink-dim">
          {report.counts.monstres} monstre(s) · {report.counts.avecRunes} avec runes ·{' '}
          {report.counts.categories} catégorie(s) lus.
        </p>
      )}
    </div>
  );
}
