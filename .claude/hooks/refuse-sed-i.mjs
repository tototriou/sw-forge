// Refuse `sed -i` (modification d'un fichier en place) dans les outils Bash et
// PowerShell — voir CLAUDE.md, « Jamais de code entre guillemets doubles dans
// une commande shell » : un fichier se modifie par l'outil Edit, jamais par un
// remplacement transporté dans une chaîne shell.
//
// ⚠️ **Pourquoi un hook et pas seulement la consigne écrite** : une consigne
// écrite, même reprise dans chaque brief de sous-agent, s'érode. Un `sed -i`
// raté ne dit rien : motif absent →
// fichier intact sans erreur ; motif multiple → tout remplacé ; fins de ligne
// et accents réécrits par le `sed` de Git sous Windows. L'outil Edit, lui,
// échoue bruyamment et montre l'avant / l'après. D'où un refus au MOMENT de
// l'action, sur Bash ET PowerShell (le
// `sed` de Git est aussi joignable depuis PowerShell).
//
// ⚠️ **Portée : `sed` appelé avec une option en place** (`-i`, `-i.bak`,
// `-Ei`, `-ie`, `--in-place`), où qu'il soit dans le segment (derrière
// `find -exec`, `xargs`…). Le texte « sed -i » ENTRE GUILLEMETS (un `grep`,
// un `echo`) ou dans le corps d'un heredoc n'est jamais refusé : la commande
// est découpée en jetons qui respectent les guillemets.
//
// Protocole : lit le JSON de l'outil sur stdin, sort en 2 pour REFUSER (le
// texte de stderr est rendu à l'agent). Toute autre sortie laisse passer.

let brut = '';
for await (const morceau of process.stdin) brut += morceau;

let commande = '';
try {
  const charge = JSON.parse(brut);
  if (charge.tool_name !== 'Bash' && charge.tool_name !== 'PowerShell') process.exit(0);
  commande = String(charge.tool_input?.command ?? '');
} catch {
  // Entrée illisible : on laisse passer. Un hook qui bloque sur son propre
  // bug serait pire que le défaut qu'il prévient.
  process.exit(0);
}

/**
 * Retire le CORPS des heredocs bash (`<<FIN` … `FIN`) et des here-strings
 * PowerShell (`@'` … `'@`, `@"` … `"@`) : un message de commit qui PARLE de
 * `sed -i` ne doit pas être refusé (même raison que refuse-commit-m.mjs).
 */
function sansCorpsLitteraux(texte) {
  const lignes = texte.split(/\r?\n/);
  const sortie = [];
  let fin = null;
  for (const ligne of lignes) {
    if (fin != null) {
      if (ligne.trim() === fin) fin = null;
      continue;
    }
    const heredocs = [...ligne.matchAll(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)];
    if (heredocs.length > 0) fin = heredocs[heredocs.length - 1][2];
    else if (/@['"]\s*$/.test(ligne)) fin = ligne.trim().endsWith(`@'`) ? `'@` : `"@`;
    sortie.push(ligne);
  }
  return sortie.join('\n');
}

/**
 * Découpe en segments de commande (`\n`, `&&`, `||`, `;`, `|`) puis en jetons,
 * en respectant les guillemets simples et doubles : un jeton cité garde ses
 * guillemets, il ne peut donc jamais valoir `sed` ni `-i`.
 */
function segmentsEnJetons(texte) {
  const segments = [];
  let jetons = [];
  let jeton = '';
  let cite = null;
  const pousserJeton = () => { if (jeton) jetons.push(jeton); jeton = ''; };
  const pousserSegment = () => { pousserJeton(); if (jetons.length) segments.push(jetons); jetons = []; };
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (cite) {
      jeton += c;
      if (c === cite) cite = null;
      continue;
    }
    if (c === "'" || c === '"') { cite = c; jeton += c; continue; }
    if (c === '\n' || c === ';') { pousserSegment(); continue; }
    if ((c === '&' || c === '|') && texte[i + 1] === c) { pousserSegment(); i++; continue; }
    if (c === '|') { pousserSegment(); continue; }
    if (/\s/.test(c)) { pousserJeton(); continue; }
    jeton += c;
  }
  pousserSegment();
  return segments;
}

const sansGuillemets = (jeton) => jeton.replace(/^(['"])(.*)\1$/, '$2');
const estSed = (jeton) => /(^|[\\/])sed(\.exe)?$/i.test(jeton);
// `-i`, `-i.bak`, `-Ei`, `-ie` (en place, suffixe « e ») : toute grappe
// d'options courtes qui contient `i` ; ou `--in-place[=SUFFIXE]`.
const estEnPlace = (jeton) => /^--in-place(=.*)?$/.test(jeton) || /^-[A-Za-z]*i/.test(jeton);
// Préfixes après lesquels le jeton suivant est une COMMANDE : sans cette
// condition, `grep sed -rin spec/` (sed = motif, -i = option de grep) serait
// refusé à tort.
const LANCEURS = new Set(['-exec', '-execdir', '-ok', 'xargs', 'sudo', 'env', 'command', 'nohup', 'time', 'exec', '&']);

/** Position de commande : premier jeton (après `FOO=bar`), ou derrière un lanceur (`xargs` et ses options compris). */
function enPositionDeCommande(jetons, k) {
  let i = 0;
  while (i < k && /^[A-Za-z_][A-Za-z0-9_]*=/.test(jetons[i])) i++;
  if (i === k) return true;
  let j = k - 1;
  while (j >= 0 && jetons[j].startsWith('-') && !LANCEURS.has(jetons[j])) j--; // `xargs -0 sed`
  return j >= 0 && LANCEURS.has(jetons[j]);
}

const fautif = segmentsEnJetons(sansCorpsLitteraux(commande)).find((jetons) =>
  jetons.some((jeton, k) => {
    // Un chemin cité n'est une commande que derrière `&` (PowerShell) ;
    // ailleurs, un jeton cité est un argument (`grep "sed"`).
    const nom = jetons[k - 1] === '&' ? sansGuillemets(jeton) : jeton;
    return estSed(nom) && enPositionDeCommande(jetons, k) && jetons.slice(k + 1).some(estEnPlace);
  })
);
if (!fautif) process.exit(0);

process.stderr.write(
  `REFUSÉ — « sed -i » est interdit sur ce dépôt (CLAUDE.md).\n\n` +
    `Un sed -i raté ne signale rien : motif absent → fichier intact sans erreur ;\n` +
    `motif multiple → tout remplacé ; fins de ligne et accents réécrits sous Windows.\n\n` +
    `Modifie le fichier avec l'outil Edit (il échoue si le texte est introuvable ou\n` +
    `ambigu, et montre l'avant / l'après). Pour une mutation de test : Edit, puis\n` +
    `\`git checkout -- <fichier>\` pour restaurer. Pour un traitement en masse : un\n` +
    `script dans un fichier, lancé par son chemin.\n\n` +
    `Segment refusé : ${fautif.join(' ').slice(0, 200)}\n`
);
process.exit(2);
