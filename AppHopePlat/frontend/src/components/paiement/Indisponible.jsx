/**
 * Un moyen de paiement que HOPE n'a pas encore configure (compte
 * bancaire, bureau...) : on le dit, et on propose la suite.
 *
 * prefixe : le bloc CSS de la page qui l'accueille ("vir", "dep"...).
 */
export default function Indisponible({ texte, quitter, prefixe }) {
  return (
    <section className={`${prefixe}__temps`}>
      <p className={`${prefixe}__texte`}>{texte}</p>
      <button type="button" className={`${prefixe}__bouton`} onClick={() => quitter(4)}>
        Choisir un autre moyen
      </button>
      <button type="button" className={`${prefixe}__lien`} onClick={() => quitter()}>
        Continuer sans payer
      </button>
    </section>
  );
}
