// Une seule lecture des options pour le lanceur et son registre construit.
export class RefusArguments extends Error {}

export function lireArguments(args: string[]) {
  const filtres: string[] = [];
  const valeurs = new Map<string, string>();
  const drapeaux = new Set<string>();
  const avecValeur = new Set(['--depuis', '--plage', '--selection', '--manifeste', '--max-entrees']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) { filtres.push(arg); continue; }
    if (valeurs.has(arg) || drapeaux.has(arg)) throw new RefusArguments(arg + ' : option répétée');
    if (avecValeur.has(arg)) {
      const valeur = args[++i];
      if (!valeur || valeur.startsWith('-')) throw new RefusArguments(arg + ' attend une valeur');
      valeurs.set(arg, valeur);
    } else if (arg === '--lister' || arg === '--silencieux') drapeaux.add(arg);
    else throw new RefusArguments('option inconnue : ' + arg);
  }
  const depuis = valeurs.get('--depuis');
  const plage = valeurs.get('--plage');
  if (depuis && plage) throw new RefusArguments('une seule option parmi --depuis et --plage');
  if ((depuis || plage) && valeurs.has('--selection')) throw new RefusArguments('--selection ne se combine pas avec --depuis ou --plage');
  if (plage && !/^([^.].*?)\.\.([^.].*)$/.test(plage)) throw new RefusArguments('--plage attend <a>..<b>');
  const max = valeurs.get('--max-entrees');
  if (max !== undefined && (!/^\d+$/.test(max) || !Number.isSafeInteger(Number(max)))) {
    throw new RefusArguments('--max-entrees attend un entier positif ou nul');
  }
  return { filtres, depuis, plage, selection: valeurs.get('--selection') ?? null,
    manifeste: valeurs.get('--manifeste') ?? null, maxEntrees: max === undefined ? null : Number(max),
    lister: drapeaux.has('--lister'), silencieux: drapeaux.has('--silencieux') };
}
