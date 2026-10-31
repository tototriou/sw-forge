// Langues de l'interface — docs/02-app/transverse/feat-langues.md.
//
// La règle du premier lancement (langue du navigateur), la forme des
// dictionnaires, les formats de nombres et de dates, le réglage conservé, et
// le garde-fou ESLint qui refuse un texte écrit en dur dans un fichier traduit.

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DICTIONNAIRES, LANGUES, NOM_LANGUE, resoudreLangue } from '../src/i18n';
import { formatDate, formatNombre } from '../src/i18n/format';
import { CLE_LANGUE, setChoixLangue } from '../src/hooks/useLangue';
import { CLES_SESSION, valeurStockageValide } from '../src/lib/session';
import { egal, faussLocalStorage, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

export function testLangueResolution() {
  titre('langue — au premier lancement, celle du navigateur');
  egal(resoudreLangue('auto', ['fr-FR']), 'fr', 'navigateur en français : français');
  egal(resoudreLangue('auto', ['fr-CA', 'en-US']), 'fr', 'français du Canada : français');
  egal(resoudreLangue('auto', ['en-GB']), 'en', 'navigateur en anglais : anglais');
  egal(resoudreLangue('auto', ['de-DE', 'fr-FR']), 'fr', 'allemand puis français : la première langue que l’app sait afficher');
  egal(resoudreLangue('auto', ['de-DE', 'es-ES']), 'en', 'aucune langue connue : anglais');
  egal(resoudreLangue('auto', []), 'en', 'aucune langue préférée : anglais');
  egal(resoudreLangue('auto', ['FR']), 'fr', 'étiquette en majuscules : reconnue');

  titre('langue — un choix explicite l’emporte sur le navigateur');
  egal(resoudreLangue('fr', ['en-US']), 'fr', '« Français » sur un navigateur anglais');
  egal(resoudreLangue('en', ['fr-FR']), 'en', '« English » sur un navigateur français');
}

// Les clés de `fr` et de `en`, à plat, avec la nature de chaque valeur.
function forme(objet: Record<string, unknown>, prefixe = ''): string[] {
  return Object.entries(objet).flatMap(([cle, v]) =>
    v && typeof v === 'object'
      ? forme(v as Record<string, unknown>, `${prefixe}${cle}.`)
      : [`${prefixe}${cle}:${typeof v}${typeof v === 'function' ? (v as () => unknown).length : ''}`]
  );
}

function chaines(objet: Record<string, unknown>, prefixe = ''): [string, string][] {
  return Object.entries(objet).flatMap(([cle, v]): [string, string][] =>
    typeof v === 'string' ? [[`${prefixe}${cle}`, v]] : v && typeof v === 'object' ? chaines(v as Record<string, unknown>, `${prefixe}${cle}.`) : []
  );
}

export function testLangueDictionnaires() {
  titre('langue — chaque langue a les mêmes textes que le français');
  const source = forme(DICTIONNAIRES.fr).sort();
  for (const l of LANGUES) {
    egal(forme(DICTIONNAIRES[l]).sort(), source, `${l} : mêmes clés, mêmes natures, mêmes paramètres`);
    const vides = chaines(DICTIONNAIRES[l]).filter(([, v]) => v.trim() === '');
    egal(vides.map(([k]) => k), [], `${l} : aucun texte vide`);
    ok(NOM_LANGUE[l].length > 0, `${l} a un nom, écrit dans sa langue (« ${NOM_LANGUE[l]} »)`);
  }
  egal(DICTIONNAIRES.en.barreHaut.sauvegarderDans('a.json'), 'Save to a.json (Ctrl+S)', 'un texte à paramètre se traduit avec sa valeur');
  egal(DICTIONNAIRES.fr.parametres.resumeBuildsRapides(1, 2), '1 combinaison · 2 builds par combinaison, au Résumé des runes.', 'le pluriel suit le nombre (fr)');
  egal(DICTIONNAIRES.en.parametres.resumeBuildsRapides(2, 1), '2 combinations · 1 build per combination, in the runes Summary.', 'le pluriel suit le nombre (en)');
}

export function testLangueFormats() {
  titre('langue — nombres et dates selon la langue');
  // ⚠️ Le séparateur de milliers français est une espace insécable étroite.
  egal(formatNombre(12345, 'fr').replace(/\s/g, ' '), '12 345', 'français : espace entre les milliers');
  egal(formatNombre(12345, 'en'), '12,345', 'anglais : virgule entre les milliers');
  const date = Date.UTC(2026, 7, 9, 12);
  egal(formatDate(date, 'fr'), '9 août 2026', 'français : « 9 août 2026 »');
  egal(formatDate(date, 'en'), 'August 9, 2026', 'anglais : « August 9, 2026 »');
}

export function testLangueReglage() {
  titre('langue — un RÉGLAGE : conservé, et repris par la session');
  const stockage = faussLocalStorage();
  try {
    setChoixLangue('en');
    egal(stockage.get(CLE_LANGUE), 'en', 'le choix est écrit sous sa clé');
    setChoixLangue('auto');
    egal(stockage.get(CLE_LANGUE), 'auto', '« Auto » aussi : c’est un choix explicite');
  } finally {
    setChoixLangue('auto');
  }
  ok((CLES_SESSION as readonly string[]).includes(CLE_LANGUE), 'la langue voyage dans la session, avec les autres réglages');
  ok(valeurStockageValide(CLE_LANGUE, 'en') && valeurStockageValide(CLE_LANGUE, 'auto'), 'la session relit « en » et « auto »');
  ok(!valeurStockageValide(CLE_LANGUE, 'klingon'), 'la session refuse une langue inconnue');
}

// Le lint d'un fichier traduit, sur un texte donné : la vraie configuration,
// donc la règle ET la liste des fichiers où elle s'applique.
function lint(fichier: string, code: string): string[] {
  const r = spawnSync(
    process.execPath,
    [join(RACINE, 'node_modules', 'eslint', 'bin', 'eslint.js'), '--format', 'json', '--stdin', '--stdin-filename', fichier],
    { cwd: RACINE, input: code, encoding: 'utf8' }
  );
  const [resultat] = JSON.parse(r.stdout || '[]') as { messages: { ruleId: string | null; message: string }[] }[];
  return (resultat?.messages ?? []).filter((m) => m.ruleId === 'swblacksmith/texte-en-dur').map((m) => m.message);
}

export function testLangueTexteEnDur() {
  titre('langue — ESLint refuse un texte en dur dans un fichier traduit');
  const fichier = 'src/components/TopBar.tsx';
  const enDur = [
    'export const A = () => <span>Paramètres</span>;',
    'export const A = () => <button title="Fermer">x</button>;',
    'export const A = () => <Bouton libelle="Sauvegarder" />;',
    "export const A = ({ ok }: { ok: boolean }) => <span>{ok ? 'Oui' : 'Non'}</span>;",
    'export const A = ({ n }: { n: number }) => <span aria-label={`${n} monstres`} />;',
  ];
  for (const code of enDur) ok(lint(fichier, code).length === 1, `refusé : ${code.slice(20, 75)}`);

  const permis = [
    'export const A = ({ t }: { t: { x: string } }) => <span title={t.x}>{t.x}</span>;',
    'export const A = () => <span className="text-ink flex">·</span>;',
    'export const A = () => <span>{12} ★ ×</span>;',
    "export const A = () => <a href=\"#/parametres\" data-repere=\"dossier\" />;",
  ];
  for (const code of permis) egal(lint(fichier, code), [], `permis : ${code.slice(20, 75)}`);

  egal(lint('src/components/RuneIcon.tsx', enDur[0]), [], 'un fichier pas encore traduit n’est pas visé');
}
