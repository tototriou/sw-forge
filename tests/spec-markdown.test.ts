// Parseur Markdown partagé (`scripts/lib/spec-markdown.mjs`) — utilisé par les
// futurs contrôles de rangement de `spec/` (slugs uniques, sommaire). La
// fixture est un montage de titres RÉELS du dépôt (accents, guillemets
// français, backticks, emoji, doublons volontaires), pas des exemples
// inventés : voir `spec/chantiers/spec-rangement.md`, B.2.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { referencesSection, slug, titres } from '../scripts/lib/spec-markdown.mjs';
import { egal, ok, titre } from './outils';

const FIXTURE = resolve(
  new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  'tests/fixtures/spec-markdown/titres-reels.md'
);

export default function testSpecMarkdown() {
  titre('spec-markdown · titres()');

  const texte = readFileSync(FIXTURE, 'utf8');
  const t = titres(texte);

  egal(t.length, 8, 'huit titres détectés — les deux faux titres du bloc de code sont exclus');

  egal(
    t.map((x) => x.niveau),
    [1, 2, 3, 2, 2, 3, 3, 1],
    'niveaux dans l’ordre du fichier'
  );

  egal(t[0], { niveau: 1, texte: 'RTA · Catégories de monstres', ligne: 1 }, 'H1 — accents et « · » conservés dans le texte');
  egal(
    t[2],
    { niveau: 3, texte: '⚠️ Catégorie par catégorie — depuis la LÉGENDE', ligne: 14 },
    'H3 après le bloc de code — la numérotation de ligne saute bien les lignes du bloc'
  );
  egal(
    t[4],
    { niveau: 2, texte: "Catégorie « Lead SPD » proposée d'office", ligne: 18 },
    'doublon volontaire du H2 — le texte n’est pas altéré par la détection du doublon'
  );

  titre('spec-markdown · slug()');

  const compteurs = new Map<string, number>();
  const slugs = t.map((x) => slug(x.texte, compteurs));

  egal(
    slugs,
    [
      'rta--catégories-de-monstres',
      'catégorie--lead-spd--proposée-doffice',
      '-catégorie-par-catégorie--depuis-la-légende',
      'anneau--categoryring',
      'catégorie--lead-spd--proposée-doffice-1',
      '-une-branche-porte-un-sujet-pas-un-numéro',
      '-une-branche-porte-un-sujet-pas-un-numéro-1',
      'outils--optimizer-outilsoptimizer',
    ],
    'slugs dans l’ordre du fichier, doublons suffixés -1 à la deuxième occurrence'
  );

  ok(new Set(slugs).size === slugs.length, 'tous les slugs produits sont uniques (contrôle par slug, pas par texte)');

  egal(slug('Anneau — `CategoryRing`'), 'anneau--categoryring', 'backticks et tiret cadratin supprimés, pas remplacés par un espace');
  egal(slug('RTA · Catégories de monstres'), 'rta--catégories-de-monstres', 'accents CONSERVÉS (é), ponctuation « · » supprimée');

  // Deux appels sans compteur partagé : chacun repart de zéro, donc aucun -1 —
  // le dédoublonnage est bien la responsabilité de l’appelant (un compteur par
  // document), pas un état caché du module.
  egal(slug('Pourquoi'), slug('Pourquoi'), 'sans compteur partagé, deux appels sur le même titre redonnent le même slug (pas d’état global)');

  titre('spec-markdown · referencesSection() — parenthèse et crochet équilibrés depuis le début de la section');

  egal(
    referencesSection('Source : a.md § 3.2 Dgts CRIT (222-223) — ✅ IMPLÉMENTÉ\n')[0].section,
    '3.2 Dgts CRIT (222-223) — ✅ IMPLÉMENTÉ',
    'parenthèse OUVERTE puis FERMÉE à l’intérieur de la section : ne termine pas la capture'
  );

  egal(
    referencesSection('[a.md § Écran (de haut en bas)](a.md)\n')[0].section,
    'Écran (de haut en bas)',
    'lien Markdown : le crochet fermant DU LIEN (sans ouvrant dans la section) termine la capture, la parenthèse mi-titre non'
  );

  egal(
    referencesSection('(a.md § Titre simple) et la suite\n')[0].section,
    'Titre simple',
    'parenthèse qui ENVELOPPE toute la référence (aucun ouvrant vu depuis le début de la section) : elle termine la capture'
  );

  const deuxRefs = referencesSection('(a.md § Un) et (a.md § Deux)\n');
  egal(deuxRefs.map((r) => r.section), ['Un', 'Deux'], 'deux références enveloppées de parenthèses, sans « ; » entre elles : chacune se termine sur SA propre parenthèse');

  egal(
    referencesSection('a.md § Un ; a.md § Deux\n').map((r) => r.section),
    ['Un', 'Deux'],
    'séparateur « ; » : termine toujours la capture, même sans parenthèse ni crochet'
  );

  egal(
    referencesSection('a.md § `resetSearch()` — texte après\n')[0].section,
    '`resetSearch()` — texte après',
    'section démarrant par un backtick : capturée en entier (le backtick ne termine jamais)'
  );
}
