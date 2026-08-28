import { useEffect, useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Monster } from '../../types';
import { ImportReport, RtaVueAmi, validateRtaImport, versVueAmi } from '../../lib/rtaShare';
import { mapRtaVueAmi } from '../../lib/applyAccount';
import {
  parseAccountJson,
  parseAccountSource,
  parseAccountWizardName,
} from '../../lib/importAccount';
import RtaFriendView from './RtaFriendView';
import RtaValidationReport from './RtaValidationReport';
import Bouton from '../../ui/Bouton';

/* --------------------------------------------------------------------------
 * Sous-onglet « Ami » — consulter la prépa de quelqu'un d'autre
 * -----------------------------------------------------------------------
 *
 * ⚠️ **Un ÉCRAN, plus un panneau posé au-dessus de sa prépa.** La prépa d'un ami
 * s'ouvrait par un bouton de la barre de sauvegarde et s'affichait au-dessus de
 * la sienne : deux prépas dans la même page, dont l'une n'est pas la sienne, et
 * un écran qui doublait de longueur sans prévenir. Elle a désormais sa propre
 * destination (`#/rta/ami`), donc son propre point d'entrée — celui-ci.
 *
 * ⚠️ **Consulter n'est pas importer.** Rien n'entre dans l'état local : la prépa
 * lue ne remplace rien, ne se compare à rien. C'est ce qui permet de l'ouvrir
 * SANS confirmation — il n'y a rien à perdre. Reprendre une prépa (celle qui
 * remplace la sienne) reste dans « Ma prépa », avec les autres gestes de
 * fichier.
 *
 * ⚠️ **DEUX fichiers acceptés, et c'est le FICHIER qui décide** — pas un
 * sélecteur de plus :
 *
 *   | Fichier | Ce qu'on en tire |
 *   |---|---|
 *   | export de prépa (bouton « Exporter ») | la prépa telle que son auteur l'a classée |
 *   | export **SWEX complet** du compte | sa box RTA, pré-classée par set comme le ferait son propre import |
 *
 * Tout le monde n'a pas SW Forge : demander à un ami de l'installer et d'y
 * ranger sa prépa pour qu'on puisse la regarder, c'est demander beaucoup. Son
 * export SWEX, lui, existe déjà. On le reconnaît à son `unit_list`, un champ
 * qu'un fichier de prépa ne porte pas.
 *
 * ⚠️ **Rien du compte lu ne sort de la RTA, et rien n'est conservé** : on en
 * extrait la box RTA, en mémoire, et le reste du fichier est jeté avec lui.
 * Même règle que le compte d'un ami dans la comparaison de courbes — on ne
 * stocke jamais le compte de quelqu'un d'autre.
 */

export default function RtaAmiSection({
  vue,
  onOuvrir,
  onFermer,
  monsters,
}: {
  /** La prépa consultée, ou `null` : l'écran propose alors d'en ouvrir une. */
  vue: RtaVueAmi | null;
  onOuvrir: (vue: RtaVueAmi) => void;
  onFermer: () => void;
  monsters: Monster[];
}) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  // Rapport de validation : NON éphémère, il y a quelque chose à lire.
  const [report, setReport] = useState<ImportReport | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  // Message éphémère (même convention que les autres imports de l'app).
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.error ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const monsterByCom2us = useMemo(() => {
    const m = new Map<number, Monster>();
    for (const mon of monsters) if (mon.com2usId != null) m.set(mon.com2usId, mon);
    return m;
  }, [monsters]);

  // Export SWEX complet : sa box RTA, lue exactement comme le ferait son propre
  // import de compte (`parseAccountJson` → `mapRtaVueAmi`).
  function lireCompte(data: any) {
    setReport(null); // un export de compte ne produit pas de rapport de validation
    const res = parseAccountJson(data);
    if (!res.units || res.units.length === 0) {
      setMsg({
        text:
          res.error ??
          "Cet export de compte ne contient aucun monstre en RTA — son auteur n'a rien runé en arène du monde.",
        error: true,
      });
      return;
    }
    const lue = mapRtaVueAmi(res.units, monsterByCom2us, parseAccountWizardName(data));
    if (lue.entries.length === 0) {
      setMsg({ text: "Aucun monstre de ce compte n'existe dans les données chargées.", error: true });
      return;
    }
    onOuvrir(lue);
    const auteur = lue.auteur ? ` de ${lue.auteur}` : '';
    setMsg({
      text:
        `Box RTA${auteur} ouverte · ${lue.entries.length} monstre(s), runes incluses.` +
        (lue.inconnus.length > 0
          ? ` ${lue.inconnus.length} monstre(s) absent(s) des données chargées ne sont pas affichés.`
          : '') +
        " Ta prépa n'a pas bougé.",
    });
  }

  function lire(text: string) {
    // ⚠️ Le TYPE de fichier se déduit du CONTENU, jamais d'un choix demandé à
    // l'utilisateur : il sait quel fichier il ouvre, pas comment il est fait.
    // `unit_list` est la racine d'un export SWEX ; un fichier de prépa ne la
    // porte pas.
    const compte = parseAccountSource(text);
    if (compte && Array.isArray(compte.unit_list)) {
      lireCompte(compte);
      return;
    }

    const rep = validateRtaImport(text);
    setReport(rep);
    if (!rep.snapshot) return; // erreurs bloquantes : rien à afficher

    const lue = versVueAmi(rep.snapshot, monsterByCom2us);
    // ⚠️ Les monstres absents des données chargées sont ANNONCÉS, jamais avalés :
    // une prépa qui perd trois cartes en silence passe pour incomplète chez son
    // auteur.
    if (lue.inconnus.length > 0) {
      rep.warnings.push(
        `${lue.inconnus.length} monstre(s) absent(s) des données chargées (id ${lue.inconnus
          .slice(0, 5)
          .join(', ')}${lue.inconnus.length > 5 ? '…' : ''}) : non affichés.`
      );
      setReport({ ...rep });
    }
    if (lue.entries.length === 0) {
      setMsg({ text: "Aucun monstre de ce fichier n'existe dans les données chargées.", error: true });
      return;
    }

    onOuvrir(lue);
    const auteur = lue.auteur ? ` de ${lue.auteur}` : '';
    const contenu = {
      complet: ', runes incluses',
      vitesses: ', ordre de tour et sets',
      ordre: ', ordre de tour seul',
    } as const;
    setMsg({
      text: `Prépa${auteur} ouverte · ${lue.entries.length} monstre(s)${
        contenu[lue.niveau]
      }. Ta prépa n'a pas bougé.`,
    });
  }

  // ⚠️ Le bouton est le MÊME qu'une prépa soit ouverte ou non — seul son libellé
  // change. En ouvrir une autre est le geste courant (on en compare deux, on se
  // trompe de fichier) : l'obliger à fermer d'abord ajoutait un clic sans rien
  // protéger, puisque rien n'est en train d'être modifié.
  const bouton = (
    <Bouton
      onClick={() => fichier.current?.click()}
      icone={<Users size={14} />}
      libelle={vue ? 'Ouvrir une autre prépa' : "Ouvrir la prépa d'un ami"}
      title="Ouvrir un .json en lecture : une prépa exportée, ou un export SWEX complet dont on ne lira que la box RTA. Ta prépa n'est pas touchée."
    />
  );

  return (
    <div>
      <input
        ref={fichier}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de recharger le même fichier
          if (!f) return;
          f.text().then(lire);
        }}
      />

      {vue ? (
        <>
          {/* ⚠️ Le bouton d'ouverture reste EN HAUT, avant la prépa lue : c'est
              le seul geste de l'écran, et il doit rester à portée sans avoir à
              redescendre une prépa entière. */}
          <div className="mb-4 flex flex-wrap items-center gap-2">{bouton}</div>
          {msg && (
            <p className={`mb-3 text-xs ${msg.error ? 'text-fire' : 'text-good'}`} role="status">
              {msg.text}
            </p>
          )}
          {report && (report.errors.length > 0 || report.warnings.length > 0) && (
            <div className="mb-3">
              <RtaValidationReport report={report} onClose={() => setReport(null)} />
            </div>
          )}
          <RtaFriendView vue={vue} onClose={onFermer} />
        </>
      ) : (
        /* État vide : il ANNONCE ce qu'on va y trouver et comment y arriver —
           même patron que « Aucune donnée de compte chargée » (AccountPage).
           ⚠️ `max-w-sm` + centrage : la phrase se lit pareil au doigt et sur un
           écran large, où une ligne pleine largeur ferait quinze mots de long. */
        <div className="mt-10 flex flex-col items-center text-center text-ink-dim">
          <Users size={34} className="mb-3 opacity-70" />
          <p className="text-base font-semibold text-ink">Aucune prépa consultée</p>
          <p className="mt-1 max-w-sm text-sm">
            Ouvre le <b className="text-ink">.json</b> qu'un ami t'a partagé : sa prépa exportée
            (bouton « Exporter », dans « Ma prépa ») <b className="text-ink">ou son export SWEX
            complet</b>, dont seule la box RTA est lue. Tu verras son classement, ses vitesses et
            son ordre de tour. <b className="text-ink">Ta prépa n'est pas touchée</b>, rien n'est
            comparé à tes monstres et rien n'est conservé.
          </p>
          <div className="mt-4">{bouton}</div>
          {msg && (
            <p className={`mt-3 text-xs ${msg.error ? 'text-fire' : 'text-good'}`} role="status">
              {msg.text}
            </p>
          )}
          {report && (report.errors.length > 0 || report.warnings.length > 0) && (
            <div className="mt-3 w-full max-w-lg text-left">
              <RtaValidationReport report={report} onClose={() => setReport(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
