import SoleilHope from './SoleilHope.jsx';

/**
 * Le pied de page du site vitrine : le soleil de HOPE, ses reseaux, le
 * numero a appeler, le copyright et l'auteur du site, centres sur le
 * violet de la charte.
 *
 * Les adresses des pages de HOPE sur les reseaux sont a renseigner ici ;
 * en attendant, chaque icone mene a la page d'accueil du reseau.
 */
const RESEAUX = [
  {
    nom: 'Facebook',
    url: 'https://www.facebook.com/',
    icone: (
      <path d="M12 2a10 10 0 0 0-1.56 19.88v-7H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v7A10 10 0 0 0 12 2z" />
    ),
  },
  {
    nom: 'Instagram',
    url: 'https://www.instagram.com/',
    icone: (
      <path d="M7.6 2h8.8A5.6 5.6 0 0 1 22 7.6v8.8a5.6 5.6 0 0 1-5.6 5.6H7.6A5.6 5.6 0 0 1 2 16.4V7.6A5.6 5.6 0 0 1 7.6 2zm0 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.25-3.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z" />
    ),
  },
  {
    nom: 'LinkedIn',
    url: 'https://www.linkedin.com/',
    icone: (
      <path d="M3 3h18v18H3V3zm4.34 7.3H4.9v8.2h2.44v-8.2zM6.12 6.5a1.42 1.42 0 1 0 0 2.84 1.42 1.42 0 0 0 0-2.84zm12.98 7.33c0-2.2-.47-3.9-3.04-3.9-1.23 0-2.06.68-2.4 1.32h-.03V10.3H11.3v8.2h2.44v-4.06c0-1.07.2-2.1 1.53-2.1 1.3 0 1.32 1.23 1.32 2.17v3.99h2.44l.07-4.67z" />
    ),
  },
];

const TELEPHONE = '032 91 581 87';

export default function PiedVitrine() {
  return (
    <footer className="vitrine-pied">
      <div className="vitrine-pied__contenu">
        <SoleilHope className="vitrine-pied__soleil" />

        <ul className="vitrine-pied__reseaux" aria-label="HOPE sur les réseaux sociaux">
          {RESEAUX.map((reseau) => (
            <li key={reseau.nom}>
              <a
                href={reseau.url}
                target="_blank"
                rel="noopener noreferrer"
                className="vitrine-pied__reseau"
                aria-label={`HOPE sur ${reseau.nom} (nouvel onglet)`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {reseau.icone}
                </svg>
              </a>
            </li>
          ))}
        </ul>

        <p className="vitrine-pied__contact">
          Contact :{' '}
          <a href={`tel:+261${TELEPHONE.replace(/\s/g, '').replace(/^0/, '')}`}>{TELEPHONE}</a>
        </p>

        <p className="vitrine-pied__copyright">Copyright © Hope for better life, 2024.</p>
      </div>
    </footer>
  );
}
