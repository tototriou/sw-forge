// Règle ESLint locale `swblacksmith/texte-en-dur` : un texte affiché ne s'écrit
// pas dans un composant, il vient du dictionnaire (src/i18n/, `useTraduction`).
// Décision : docs/04-decisions/adr/traductions-par-dictionnaires.md.
//
// Ce qui est refusé, dans le JSX :
//   - un texte entre balises qui contient un mot (`<span>Paramètres</span>`) ;
//   - une chaîne littérale en enfant (`{'Paramètres'}`, `{ok ? 'Oui' : 'Non'}`) ;
//   - la même chose dans un attribut qui s'affiche ou se lit (`title`,
//     `aria-label`, `placeholder`, `alt`, et les props de texte de la librairie
//     UI : `libelle`, `label`, `hint`, `titre`, `invite`, `aide`).
//
// ⚠️ « Un mot » = deux lettres qui se suivent : la ponctuation, les symboles
// (« · », « × », « ★ ») et les nombres passent. Une classe CSS ou une clé
// n'est jamais visée : seuls les attributs ci-dessus sont lus.
//
// ⚠️ Limites assumées : une chaîne rangée dans une variable puis affichée
// (`const x = 'Oui'; <span>{x}</span>`) ne se voit pas ; un texte construit
// hors du JSX non plus. La règle attrape le cas courant, la relecture le reste.

const ATTRIBUTS_DE_TEXTE = new Set([
  'title',
  'aria-label',
  'placeholder',
  'alt',
  'libelle',
  'label',
  'hint',
  'titre',
  'invite',
  'aide',
]);

const MOT = /\p{L}{2}/u;

// L'expression produit-elle une chaîne écrite en dur ? Suit les deux branches
// d'un ternaire et d'un `&&` / `||`.
function texteLitteral(expr) {
  if (!expr) return false;
  switch (expr.type) {
    case 'Literal':
      return typeof expr.value === 'string' && MOT.test(expr.value);
    case 'TemplateLiteral':
      return expr.quasis.some((q) => MOT.test(q.value.cooked ?? ''));
    case 'ConditionalExpression':
      return texteLitteral(expr.consequent) || texteLitteral(expr.alternate);
    case 'LogicalExpression':
      return texteLitteral(expr.left) || texteLitteral(expr.right);
    default:
      return false;
  }
}

export const regleTexteEnDur = {
  meta: {
    type: 'problem',
    docs: { description: 'Un texte affiché vient du dictionnaire (src/i18n/), jamais écrit dans un composant.' },
    messages: {
      texte:
        'Texte en dur « {{texte}} » : il s’écrit dans src/i18n/fr.ts et en.ts, et s’affiche par useTraduction().',
    },
    schema: [],
  },
  create(context) {
    const signaler = (node, texte) =>
      context.report({ node, messageId: 'texte', data: { texte: texte.trim().slice(0, 40) } });
    const source = context.sourceCode ?? context.getSourceCode();
    return {
      JSXText(node) {
        if (MOT.test(node.value)) signaler(node, node.value);
      },
      JSXExpressionContainer(node) {
        // Un enfant `{…}` ; un attribut est jugé par `JSXAttribute`.
        if (node.parent?.type === 'JSXAttribute') return;
        if (texteLitteral(node.expression)) signaler(node, source.getText(node.expression));
      },
      JSXAttribute(node) {
        const nom = typeof node.name.name === 'string' ? node.name.name : '';
        if (!ATTRIBUTS_DE_TEXTE.has(nom) || !node.value) return;
        if (node.value.type === 'Literal') {
          if (typeof node.value.value === 'string' && MOT.test(node.value.value)) signaler(node, node.value.value);
        } else if (node.value.type === 'JSXExpressionContainer' && texteLitteral(node.value.expression)) {
          signaler(node, source.getText(node.value.expression));
        }
      },
    };
  },
};

export const pluginSwblacksmith = { rules: { 'texte-en-dur': regleTexteEnDur } };
