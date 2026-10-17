// Inventaire des compétences du corpus, lu comme l'application le lit
// (`scripts/lib/inventaireCompetences.ts`). Lancé par
// `node scripts/inventaire-competences.mjs [options]` ; `--aide` pour le détail.

import { fileURLToPath } from 'node:url';
import { inventaireDesCompetences, inventaireEnMarkdown, SIGNAUX, type CodeSignal, type OptionsInventaire } from './lib/inventaireCompetences';

const AIDE = `Inventaire des compétences de public/data/skills, avec la formule RETENUE par l'app.

  node scripts/inventaire-competences.mjs [options]

Filtres (combinés) :
  --ids <a,b,…>       identifiants com2us des compétences
  --effet <nom>       nom exact d'un effet (casse ignorée), ex. "Ally Attack"
  --prose <mot>       mot cherché dans toute la prose (sort, effets, améliorations, auxiliaires)
  --slot <n>          emplacement du sort (1 à 4)
  --monstre <x>       nom de monstre (sous-chaîne) ou com2usId de sa fiche
  --signal <code>     un signal de doute, ou « tous » pour toute compétence signalée

Sortie :
  (défaut)            Markdown, une section par compétence, prose complète
  --json              tableau JSON des entrées
  --aide              ce texte

Signaux de doute (des compétences à lire à la main, jamais un verdict) :
${Object.entries(SIGNAUX).map(([c, d]) => `  ${c.padEnd(26)}${d}`).join('\n')}
`;

function lire(argv: string[]): { options: OptionsInventaire; json: boolean } | string {
  const options: OptionsInventaire = { racine: fileURLToPath(new URL('..', import.meta.url)) };
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valeur = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} attend une valeur`);
      return v;
    };
    switch (a) {
      case '--aide':
      case '--help':
        return AIDE;
      case '--json':
        json = true;
        break;
      case '--ids': {
        const ids = valeur().split(',').map((x) => Number(x.trim()));
        if (ids.some((x) => !Number.isInteger(x))) throw new Error('--ids attend des entiers séparés par des virgules');
        options.ids = ids;
        break;
      }
      case '--effet':
        options.effet = valeur();
        break;
      case '--prose':
        options.prose = valeur();
        break;
      case '--slot': {
        const n = Number(valeur());
        if (!Number.isInteger(n)) throw new Error('--slot attend un entier');
        options.slot = n;
        break;
      }
      case '--monstre':
        options.monstre = valeur();
        break;
      case '--signal': {
        const s = valeur();
        if (s !== 'tous' && !(s in SIGNAUX)) throw new Error(`signal inconnu : ${s} (voir --aide)`);
        options.signal = s as CodeSignal | 'tous';
        break;
      }
      default:
        throw new Error(`option inconnue : ${a} (voir --aide)`);
    }
  }
  return { options, json };
}

try {
  const lu = lire(process.argv.slice(2));
  if (typeof lu === 'string') {
    process.stdout.write(lu);
  } else {
    const entrees = inventaireDesCompetences(lu.options);
    const { racine: _racine, ...filtres } = lu.options;
    void _racine;
    const entete = Object.keys(filtres).length ? `Filtres : \`${JSON.stringify(filtres)}\`` : 'Corpus entier, sans filtre.';
    process.stdout.write(lu.json ? JSON.stringify(entrees, null, 2) + '\n' : inventaireEnMarkdown(entrees, entete));
  }
} catch (e) {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exit(2);
}
