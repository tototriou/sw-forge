// Refuse `git commit`, `git merge` et `git tag` avec un message en ligne
// (`-m`, forme collée `-m"…"` comprise, grappe `-am`, `--message` et ses
// abréviations acceptées par git), derrière toute option globale, et
// `node -e`/`--eval`/`-p`/`--print` dont l'argument est une chaîne entre
// guillemets doubles contenant un backtick, un `$` ou une barre oblique
// inverse — voir CLAUDE.md,
// « Jamais de code entre guillemets doubles dans une commande shell ».
//
// ⚠️ **Pourquoi un hook et pas seulement la consigne écrite** : la consigne
// existe et est lue au démarrage, mais une règle lue s'érode — après des
// dizaines d'exemples réussis de la forme interdite, l'exemple pèse plus que
// la règle.
// Un refus au MOMENT de l'action ne dépend d'aucune vigilance.
//
// ⚠️ **Portée volontairement ÉTROITE.** Ce hook ne couvre pas la classe de
// fautes (« du code entre backticks dans une chaîne à guillemets doubles »),
// qui touche aussi `gh pr create --body`, `sed -i "s/…/`x`/"`, `echo "…" >>`.
// La couvrir demanderait une analyse de quoting bash qui produirait des faux
// positifs en permanence — `$(…)` est une construction légitime et courante.
// Ici, la perte est nulle : les messages de ce dépôt citent
// toujours du code, donc `-m` n'y est jamais le bon outil, et le heredoc
// marche aussi pour une ligne unique, y compris chaîné derrière un `&&`.
// `node -e` n'est refusé que dans la seule forme qui transforme le script :
// argument entre guillemets doubles avec un backtick, un `$` ou une barre
// oblique inverse (bash réduit `\\` à `\`, et `\"`, `\$`, `` \` ``, sans rien
// dire). Même échappé, et quel que soit ce qui suit la barre : la règle est
// mécanique, elle n'examine pas l'échappement. Entre apostrophes ou sans ces
// trois caractères, il passe : ces usages sont sûrs et fréquents.
// Un commentaire bash (`#` en début de mot, hors guillemets et hors heredoc,
// jusqu'à la fin de la ligne) n'est pas analysé : bash ne l'exécute pas.
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
 * Retire le CORPS des heredocs et les commentaires avant toute analyse.
 *
 * ⚠️ **Indispensable, pas défensif** : les messages de commit de ce dépôt
 * PARLENT de la règle — « un message de commit passe par un heredoc, jamais
 * par -m » contient littéralement `-m`. Sans ce nettoyage, le hook refuserait
 * précisément la forme correcte qu'il existe pour imposer. Un commentaire
 * n'est pas exécuté par bash : `echo ok # exemple ; node -e "$x"` ne lance
 * pas node, et son texte n'ouvre pas de position de commande.
 */
function sansHeredocsNiCommentaires(texte) {
  const lignes = texte.split(/\r?\n/);
  const sortie = [];
  let tagOuvert = null;
  const lecture = { guillemet: null, debutDeMot: true };
  for (const ligne of lignes) {
    if (tagOuvert != null) {
      if (ligne.trim() === tagOuvert) tagOuvert = null;
      continue; // corps du heredoc : jamais analysé
    }
    // Le commentaire est retiré AVANT de chercher une ouverture : un `<<FIN`
    // cité dans un commentaire n'ouvre rien, et les lignes suivantes restent
    // analysées.
    const gardee = sansCommentaire(ligne, lecture);
    // `<<TAG`, `<<'TAG'`, `<<"TAG"`, `<<-TAG` — on prend le DERNIER ouvert sur
    // la ligne, le corps commençant à la ligne suivante dans tous les cas.
    const ouvertures = [...gardee.matchAll(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)];
    if (ouvertures.length > 0) tagOuvert = ouvertures[ouvertures.length - 1][2];
    sortie.push(gardee);
  }
  return sortie.join('\n');
}

/**
 * La ligne privée de son commentaire : un `#` en début de mot, hors
 * guillemets, ouvre un commentaire jusqu'à la fin de la ligne, que bash ne
 * lit pas. Collé à un mot (`a#b`, `$#`, `${#x}`), il n'en ouvre pas.
 *
 * ⚠️ `lecture` porte l'état d'une ligne à la suivante : une chaîne citée peut
 * s'étendre sur plusieurs lignes (`#` y reste littéral), et après une
 * continuation (`\` en fin de ligne) la ligne suivante prolonge le mot.
 * `$'…'` est lu comme bash : `\'` n'y ferme pas la chaîne.
 */
function sansCommentaire(ligne, lecture) {
  let debutDeMot = lecture.guillemet == null && lecture.debutDeMot;
  lecture.debutDeMot = true;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (lecture.guillemet != null) {
      if (c === '\\' && lecture.guillemet !== "'") i++; // `"…"` et `$'…'` : caractère suivant échappé
      else if (c === (lecture.guillemet === '"' ? '"' : "'")) lecture.guillemet = null;
      continue;
    }
    if (c === '#' && debutDeMot) return ligne.slice(0, i);
    if (c === '\\') {
      // Continuation : bash retire `\` et la fin de ligne, la ligne suivante
      // est en début de mot si et seulement si la barre l'était.
      if (i + 1 === ligne.length) lecture.debutDeMot = debutDeMot;
      i++;
      debutDeMot = false;
      continue;
    }
    if (c === '$' && ligne[i + 1] === "'") {
      lecture.guillemet = "$'";
      i++;
      debutDeMot = false;
      continue;
    }
    if (c === "'" || c === '"') {
      lecture.guillemet = c;
      debutDeMot = false;
      continue;
    }
    debutDeMot = /[\s;&|()<>]/.test(c);
  }
  return ligne;
}

// ⚠️ Découpage en POSITION DE COMMANDE, jamais en sous-chaîne : sans ça,
// `grep -rn "git commit -m" spec/` serait refusé — exactement le genre d'audit
// de documentation qu'on lance sur ce dépôt.
const analysable = sansHeredocsNiCommentaires(commande);
const segments = analysable
  .split(/\n|&&|\|\||;|(?<!\|)\|(?!\|)/)
  .map((s) => s.trim())
  .filter(Boolean);

// Sous-commandes surveillées, et leurs options courtes qui prennent une valeur
// (`git <commande> -h`, git 2.55) : dans une grappe, ce qui suit une de ces
// lettres est sa valeur — `-Fmsg.txt` lit le fichier `msg.txt`, `-smxyz` nomme
// une stratégie ; aucun des deux n'est un message.
const OPTIONS_COURTES_A_VALEUR = { commit: 'FmcCtSUu', merge: 'sXmFS', tag: 'nmFu' };

// Plus courte abréviation de `--message` que git accepte (git 2.55) : pour
// `tag`, `--m` et `--me` sont ambiguës avec `--merged` et git les refuse.
const ABREVIATION_MINIMALE_DE_MESSAGE = { commit: 1, merge: 1, tag: 3 };

// Options globales de git qui acceptent leur valeur dans le jeton suivant
// (git 2.55) : celles de `git -h` plus `--attr-source`, absente de `git -h`.
// Git n'abrège pas les options globales ; `--exec-path` ne prend sa valeur
// qu'avec `=`.
const OPTIONS_GLOBALES_A_VALEUR = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--attr-source']);

/**
 * Sous-commande surveillée appelée par ce segment, et ses arguments.
 *
 * ⚠️ Tokenisé, pas deviné par expression régulière : un premier essai en
 * `git\s+(?:-\S+\s+)*commit` laissait passer `git -C . commit -m`, parce que
 * la VALEUR d'une option globale (`.`) n'est pas un `-…`.
 */
function sousCommandeGit(segment) {
  const jetons = segment.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < jetons.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(jetons[i])) i++; // FOO=bar git …
  if (jetons[i] !== 'git') return null;
  i++;
  while (i < jetons.length) {
    if (OPTIONS_GLOBALES_A_VALEUR.has(jetons[i])) { i += 2; continue; }
    if (jetons[i].startsWith('-')) { i++; continue; }
    if (!Object.hasOwn(OPTIONS_COURTES_A_VALEUR, jetons[i])) return null;
    return { nom: jetons[i], args: jetons.slice(i + 1) };
  }
  return null;
}

function porteUnMessage({ nom, args }) {
  for (const jeton of args) {
    // `--message`, `--message=…` et leurs abréviations acceptées (`--mes`, `--mess=…`).
    const long = /^--([a-z]+)(=|$)/.exec(jeton)?.[1];
    if (long && long.length >= ABREVIATION_MINIMALE_DE_MESSAGE[nom] && 'message'.startsWith(long)) return true;
    // Un seul tiret, sinon `--allow-empty-message` serait pris pour un message.
    if (!/^-[^-]/.test(jeton)) continue;
    // Grappe d'options courtes lue lettre à lettre, comme git : `-m`, `-am`,
    // forme collée `-m"…"`/`-mtexte` ; la première option à valeur prend le
    // reste du jeton.
    for (const lettre of jeton.slice(1)) {
      if (lettre === 'm') return true;
      if (!/[A-Za-z]/.test(lettre) || OPTIONS_COURTES_A_VALEUR[nom].includes(lettre)) break;
    }
  }
  return false;
}

// Forme sûre propre à chaque commande. `git merge -F -` ne lit pas l'entrée
// standard (« could not read file '-' ») : pas de heredoc pour merge.
const FORMES_SURES = {
  commit:
    `Utilise le heredoc, sans examiner le contenu du message :\n\n` +
    `  git commit -F - <<'FIN'\n` +
    `  titre du commit\n` +
    `\n` +
    `  corps, backticks compris.\n` +
    `  FIN\n\n` +
    `(\`<<'FIN'\` entre apostrophes = aucune expansion. En PowerShell : message écrit dans un fichier par l'outil Write, puis git commit -F <fichier>.)\n`,
  tag:
    `Utilise le heredoc, sans examiner le contenu du message :\n\n` +
    `  git tag -a <nom> -F - <<'FIN'\n` +
    `  message de l'étiquette, backticks compris.\n` +
    `  FIN\n\n` +
    `(\`<<'FIN'\` entre apostrophes = aucune expansion. En PowerShell : message écrit dans un fichier par l'outil Write, puis git tag -a <nom> -F <fichier>.)\n`,
  merge:
    `git merge -F - ne lit PAS l'entrée standard : pas de heredoc ici. Au choix :\n\n` +
    `  git merge --no-edit <branche>       message par défaut de git\n` +
    `  git merge -F <fichier> <branche>    message écrit dans un fichier par l'outil Write\n`,
};

/**
 * Découpe en segments de commande et en mots, SANS couper une chaîne citée.
 *
 * ⚠️ Le découpage naïf ci-dessus suffit à `git commit -m` mais pas à
 * `node -e "…"` : le script cité contient couramment `;`, `|` ou `&&`, et
 * `node -e "a; console.log(\`x\`)"` coupé au `;` laisserait le backtick dans un
 * segment sans `node`. Lexer bash réduit : apostrophes (tout littéral),
 * guillemets doubles (`\` n'y échappe que `"`, `\`, `$`, backtick, fin de
 * ligne), `\` hors guillemets ; séparateurs hors guillemets : fin de ligne,
 * `;`, `&`, `|`, `(`, `)` et backtick (une substitution `$(…)` ou `` `…` ``
 * ouvre une position de commande).
 *
 * Chaque mot porte `texte` (valeur sans guillemets) et `sensible` : un
 * backtick, un `$` ou une barre oblique inverse figure dans une de ses parties
 * entre guillemets doubles.
 */
function segmentsHorsGuillemets(texte) {
  const segments = [];
  let mots = [];
  let mot = null;
  const motCourant = () => (mot ??= { texte: '', sensible: false });
  const finirMot = () => {
    if (mot) mots.push(mot);
    mot = null;
  };
  const finirSegment = () => {
    finirMot();
    if (mots.length > 0) segments.push(mots);
    mots = [];
  };
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (c === "'") {
      const fin = texte.indexOf("'", i + 1);
      const j = fin < 0 ? texte.length : fin;
      motCourant().texte += texte.slice(i + 1, j);
      i = j + 1;
      continue;
    }
    if (c === '"') {
      const m = motCourant();
      i++;
      while (i < texte.length && texte[i] !== '"') {
        const d = texte[i];
        if (d === '\\') m.sensible = true;
        if (d === '\\' && i + 1 < texte.length) {
          const s = texte[i + 1];
          m.texte += '"\\$`\n'.includes(s) ? s : d + s;
          i += 2;
          continue;
        }
        if (d === '$' || d === '`') m.sensible = true;
        m.texte += d;
        i++;
      }
      i++; // guillemet fermant (une chaîne non fermée court jusqu'à la fin)
      continue;
    }
    if (c === '\\') {
      motCourant().texte += texte[i + 1] ?? '';
      i += 2;
      continue;
    }
    if ('\n;&|()`'.includes(c)) {
      finirSegment();
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      finirMot();
      i++;
      continue;
    }
    motCourant().texte += c;
    i++;
  }
  finirSegment();
  return segments;
}

// Mots qui laissent la position de commande au mot suivant.
const PRECEDENTS = new Set(['{', '!', 'if', 'then', 'else', 'elif', 'do', 'while', 'until', 'time', 'exec', 'command', 'env']);
// Options de node dont la valeur est le mot SUIVANT : la sauter, sinon elle
// serait prise pour le nom du script (fin des options de node).
const OPTIONS_NODE_A_VALEUR = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '-C', '--conditions', '--input-type']);

/**
 * Ce segment lance-t-il `node -e "…"` dont la chaîne à guillemets doubles
 * contient un backtick, un `$` ou une barre oblique inverse ?
 *
 * ⚠️ Les options sont lues jusqu'au premier mot qui n'en est pas une : c'est le
 * script, et ce qui suit lui appartient (`node x.mjs -e "$y"` passe).
 */
function evalueUneChaineDouble(mots) {
  let i = 0;
  while (i < mots.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(mots[i].texte) || PRECEDENTS.has(mots[i].texte))) i++;
  if (i >= mots.length || !/(^|[\\/])node(\.exe)?$/i.test(mots[i].texte)) return false;
  for (i++; i < mots.length; i++) {
    const t = mots[i].texte;
    if (t === '--' || !t.startsWith('-')) return false;
    if (/^--(eval|print)=/.test(t)) return mots[i].sensible;
    if (/^(-e|-p|-pe|-ep|--eval|--print)$/.test(t)) return Boolean(mots[i + 1]?.sensible);
    if (OPTIONS_NODE_A_VALEUR.has(t)) i++;
  }
  return false;
}

const nodeFautif = segmentsHorsGuillemets(analysable).find(evalueUneChaineDouble);
if (nodeFautif) {
  process.stderr.write(
    `REFUSÉ — « node -e "…" » avec un backtick, un $ ou une barre oblique inverse est interdit sur ce dépôt (CLAUDE.md).\n\n` +
      `Dans une chaîne à guillemets doubles, bash EXÉCUTE un backtick, développe un $ et réduit\n` +
      `sans rien dire une barre oblique inverse (\\\\ devient \\, de même \\", \\$, \\\`) :\n` +
      `node ne reçoit pas le script qui a été écrit.\n\n` +
      `Écris le script dans un fichier du scratchpad (outil Write), puis lance-le par son chemin :\n\n` +
      `  node <scratchpad>/diagnostic.mjs\n\n` +
      `Segment refusé : ${nodeFautif.map((m) => m.texte).join(' ').slice(0, 200)}\n`
  );
  process.exit(2);
}

let fautif = null;
for (const segment of segments) {
  const appel = sousCommandeGit(segment);
  if (appel && porteUnMessage(appel)) {
    fautif = { segment, nom: appel.nom };
    break;
  }
}
if (!fautif) process.exit(0);

process.stderr.write(
  `REFUSÉ — « git ${fautif.nom} -m » est interdit sur ce dépôt (CLAUDE.md).\n\n` +
    `Bash EXÉCUTE un backtick dans une chaîne à guillemets doubles, et les messages\n` +
    `de ce dépôt citent du code : un « -m » contenant \`label\` lance la commande\n` +
    `label de Windows, qui attend une saisie jusqu'au délai d'attente.\n\n` +
    FORMES_SURES[fautif.nom] +
    `\nSegment refusé : ${fautif.segment.slice(0, 200)}\n`
);
process.exit(2);
