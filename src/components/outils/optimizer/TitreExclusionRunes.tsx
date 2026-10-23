import IconeInterdite from '../../IconeInterdite';
import GameIcon from '../../GameIcon';

export default function TitreExclusionRunes() {
  return (
    <>
      {/* Icône « Runes » de Mon compte (même GameIcon que le menu),
          barrée du vrai symbole « interdit » (cercle barré, comme le
          curseur non-cliquable) plutôt qu'un simple trait — l'exclusion
          RETIRE des runes de la recherche. */}
      <IconeInterdite taille={22}>
        <GameIcon name="rune" size={13} />
      </IconeInterdite>
      <p className="text-[13.5px] font-bold text-ink">Exclusion de runes</p>
    </>
  );
}
