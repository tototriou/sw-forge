// Inspecte la STRUCTURE d'un export de compte SWEX sans révéler de données.
// N'affiche que : noms de clés, types, tailles de listes, sous-clés, et repère
// les listes d'identifiants + les clés "suspectes" à tous les niveaux.
// Aucune valeur texte/perso n'est imprimée.
//
// Usage : node scripts/inspect-account.mjs /chemin/vers/export.json

import { readFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path) {
  console.error('Usage : node scripts/inspect-account.mjs <export.json>');
  process.exit(1);
}

const data = JSON.parse(await readFile(path, 'utf8'));
const SUSPECT = /freq|favor|used|team|deck|arena|pick|select|myteam|lock|main|world|rta|represent|profile/i;

// Décrit une valeur sans exposer son contenu.
function describe(v) {
  if (Array.isArray(v)) {
    const obj = v.find((x) => x && typeof x === 'object');
    if (obj) return `array[${v.length}] d'objets { ${Object.keys(obj).join(', ')} }`;
    const allNums = v.length > 0 && v.every((x) => typeof x === 'number');
    return allNums ? `array[${v.length}] de nombres (probables ids)` : `array[${v.length}]`;
  }
  if (v && typeof v === 'object') return `object { ${Object.keys(v).join(', ')} }`;
  return typeof v;
}

console.log('=== Clés de premier niveau ===');
for (const [k, v] of Object.entries(data)) console.log(`${k}: ${describe(v)}`);

// Recherche récursive des clés suspectes (profondeur limitée).
console.log('\n=== Clés "suspectes" à tous les niveaux ===');
const hits = [];
(function walk(node, pathStr, depth) {
  if (!node || typeof node !== 'object' || depth > 4) return;
  for (const [k, v] of Object.entries(node)) {
    const p = pathStr ? `${pathStr}.${k}` : k;
    if (SUSPECT.test(k)) hits.push(`${p}: ${describe(v)}`);
    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p, depth + 1);
    else if (Array.isArray(v) && v[0] && typeof v[0] === 'object') walk(v[0], `${p}[0]`, depth + 1);
  }
})(data, '', 0);
console.log(hits.length ? [...new Set(hits)].join('\n') : '(rien trouvé)');

// Structure d'une unité (pour repérer un éventuel flag "sélectionné/favori").
const unit = Array.isArray(data.unit_list) ? data.unit_list.find((u) => u && typeof u === 'object') : null;
if (unit) {
  console.log('\n=== Clés d\'une unité (unit_list[0]) ===');
  console.log(Object.keys(unit).join(', '));
}
