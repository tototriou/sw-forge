// Refuse `git commit -m` et `git commit --amend -m` — voir CLAUDE.md,
// « Jamais de code entre guillemets doubles dans une commande shell ».
//
// ⚠️ **Pourquoi un hook et pas seulement la consigne écrite** : la consigne
// existe, elle est lue au démarrage de session, et elle a quand même été
// enfreinte plusieurs fois dans la même session — après des dizaines
// d'exemples réussis de la forme interdite, l'exemple pèse plus que la règle.
// Un refus au MOMENT de l'action ne dépend d'aucune vigilance.
//
// ⚠️ **Portée volontairement ÉTROITE.** Ce hook ne couvre pas la classe de
// fautes (« du code entre backticks dans une chaîne à guillemets doubles »),
// qui touche aussi `gh pr create --body`, `sed -i "s/…/`x`/"`, `echo "…" >>`.
// La couvrir demanderait une analyse de quoting bash qui produirait des faux
// positifs en permanence — `$(…)` est une construction légitime et courante.
// `node -e` n'est PAS bloqué non plus : ses usages sans backtick sont sûrs et
// fréquents. Ici, la perte est nulle : les messages de ce dépôt citent
// toujours du code, donc `-m` n'y est jamais le bon outil, et le heredoc
// marche aussi pour une ligne unique, y compris chaîné derrière un `&&`.
//
// Protocole : lit le JSON de l'outil sur stdin, sort en 2 pour REFUSER (le
// texte de stderr est rendu à l'agent). Toute autre sortie laisse passer.

let brut = '';
for await (const morceau of process.stdin) brut += morceau;

let commande = '';
try {
  const charge = JSON.parse(brut);
  if (charge.tool_name !== 'Bash') process.exit(0);
  commande = String(charge.tool_input?.command ?? '');
} catch {
  // Entrée illisible : on laisse passer. Un hook qui bloque sur son propre
  // bug serait pire que le défaut qu'il prévient.
  process.exit(0);
}

/**
 * Retire le CORPS des heredocs avant toute analyse.
 *
 * ⚠️ **Indispensable, pas défensif** : les messages de commit de ce dépôt
 * PARLENT de la règle — « un message de commit passe par un heredoc, jamais
 * par -m » contient littéralement `-m`. Sans ce nettoyage, le hook refuserait
 * précisément la forme correcte qu'il existe pour imposer.
 */
function sansHeredocs(texte) {
  const lignes = texte.split(/\r?\n/);
  const sortie = [];
  let tagOuvert = null;
  for (const ligne of lignes) {
    if (tagOuvert != null) {
      if (ligne.trim() === tagOuvert) tagOuvert = null;
      continue; // corps du heredoc : jamais analysé
    }
    // `<<TAG`, `<<'TAG'`, `<<"TAG"`, `<<-TAG` — on prend le DERNIER ouvert sur
    // la ligne, le corps commençant à la ligne suivante dans tous les cas.
    const ouvertures = [...ligne.matchAll(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)];
    if (ouvertures.length > 0) tagOuvert = ouvertures[ouvertures.length - 1][2];
    sortie.push(ligne);
  }
  return sortie.join('\n');
}

// ⚠️ Découpage en POSITION DE COMMANDE, jamais en sous-chaîne : sans ça,
// `grep -rn "git commit -m" spec/` serait refusé — exactement le genre d'audit
// de documentation qu'on lance sur ce dépôt.
const segments = sansHeredocs(commande)
  .split(/\n|&&|\|\||;|(?<!\|)\|(?!\|)/)
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Ce segment appelle-t-il `git commit` ?
 *
 * ⚠️ Tokenisé, pas deviné par expression régulière : un premier essai en
 * `git\s+(?:-\S+\s+)*commit` laissait passer `git -C . commit -m`, parce que
 * la VALEUR d'une option globale (`.`) n'est pas un `-…`. Les seules options
 * globales de git qui prennent une valeur séparée sont `-C` et `-c` ; les
 * autres (`--git-dir=`, `--work-tree=`…) sont des jetons uniques.
 */
function estUnCommit(segment) {
  const jetons = segment.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < jetons.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(jetons[i])) i++; // FOO=bar git …
  if (jetons[i] !== 'git') return false;
  i++;
  while (i < jetons.length) {
    if (jetons[i] === '-C' || jetons[i] === '-c') { i += 2; continue; }
    if (jetons[i].startsWith('-')) { i++; continue; }
    return jetons[i] === 'commit';
  }
  return false;
}

function porteUnMessage(segment) {
  for (const jeton of segment.split(/\s+/)) {
    if (jeton === '--message' || jeton.startsWith('--message=')) return true;
    // Grappe d'options courtes : `-m`, mais aussi `-am`, `-sm`. Un seul tiret,
    // sinon `--allow-empty-message` serait pris pour un message.
    if (/^-[A-Za-z]*m[A-Za-z]*$/.test(jeton) && !jeton.startsWith('--')) return true;
  }
  return false;
}

const fautif = segments.find((s) => estUnCommit(s) && porteUnMessage(s));
if (!fautif) process.exit(0);

process.stderr.write(
  `REFUSÉ — « git commit -m » est interdit sur ce dépôt (CLAUDE.md).\n\n` +
    `Bash EXÉCUTE un backtick dans une chaîne à guillemets doubles, et les messages\n` +
    `de ce dépôt citent du code. Un « -m » contenant \`label\` a déjà lancé le label\n` +
    `de Windows, resté bloqué sur une invite jusqu'au délai d'attente.\n\n` +
    `Utilise le heredoc, sans examiner le contenu du message :\n\n` +
    `  git commit -F - <<'FIN'\n` +
    `  titre du commit\n` +
    `\n` +
    `  corps, backticks compris.\n` +
    `  FIN\n\n` +
    `(\`<<'FIN'\` entre apostrophes = aucune expansion. En PowerShell : here-string @'…'@.)\n\n` +
    `Segment refusé : ${fautif.slice(0, 200)}\n`
);
process.exit(2);
