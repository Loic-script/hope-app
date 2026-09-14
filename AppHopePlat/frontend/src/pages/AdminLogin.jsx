import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import HopeLogo from '../components/HopeLogo.jsx';
// Le pictogramme officiel remplace le soleil dessine : declinaison
// pour fond violet, dont les couleurs conviennent au panneau sombre.
import pictogramme from '../assets/LOGO_PICTOGRAMME_FOND_VIOLET.png';
import MadagascarSilhouette from '../components/MadagascarSilhouette.jsx';
import {
  IconeAlerte,
  IconeCadenas,
  IconeFleche,
  IconeOeil,
  IconeOeilBarre,
  IconeBouclier,
  IconeUtilisateur,
} from '../components/HopeIcons.jsx';
import * as authService from '../services/auth.service.js';
import photoHope from '../assets/hope-couverture.jpg';

/** Message unique en cas d'echec : il ne revele jamais quel champ est faux. */
const MESSAGE_ERREUR = 'Login ou mot de passe incorrect.';

/** Adresse du site public HOPE (pas encore developpe a cette etape). */
const SITE_PUBLIC = import.meta.env.VITE_SITE_URL ?? '/';

export default function AdminLogin() {
  const navigate = useNavigate();

  const [adminLog, setAdminLog] = useState('');
  const [password, setPassword] = useState('');
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [seSouvenir, setSeSouvenir] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [information, setInformation] = useState('');

  // Si une session est deja ouverte, on saute la page de connexion.
  useEffect(() => {
    let annule = false;

    if (!authService.lireJeton()) return undefined;

    authService
      .recupererProfil()
      .then(() => {
        if (!annule) navigate('/admin', { replace: true });
      })
      .catch(() => {
        // Jeton perime ou API injoignable : on reste sur le formulaire.
        authService.effacerSession();
      });

    return () => {
      annule = true;
    };
  }, [navigate]);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');
    setInformation('');

    // Verification cote client, doublee cote serveur.
    if (adminLog.trim() === '' || password === '') {
      setErreur('Veuillez renseigner votre login et votre mot de passe.');
      return;
    }

    setChargement(true);
    try {
      await authService.connecter(adminLog.trim(), password, seSouvenir);
      navigate('/admin', { replace: true });
    } catch (echec) {
      const statut = echec?.response?.status;

      if (statut === 401) {
        // Message volontairement generique (cf. cahier des charges).
        setErreur(MESSAGE_ERREUR);
      } else if (statut === 429) {
        setErreur(echec.response.data?.message ?? 'Trop de tentatives, veuillez patienter.');
      } else if (statut === 400) {
        setErreur('Veuillez renseigner votre login et votre mot de passe.');
      } else {
        setErreur(
          "Le serveur HOPE est injoignable. Vérifiez que l'API est démarrée sur le port 3000."
        );
      }
      setPassword('');
    } finally {
      setChargement(false);
    }
  }

  const champEnErreur = erreur === MESSAGE_ERREUR;

  return (
    <div className="connexion">
      {/* ----- Panneau d'illustration ----- */}
      <section
        className="connexion__illustration"
        style={{ '--photo-hope': `url(${photoHope})` }}
      >
        <div className="illustration__accroche">
          <p>
            Des enfants
            d’aujourd’hui,
            <br />
            un meilleur
            demain
          </p>
        </div>
          <img className="illustration__soleil" src={pictogramme} alt="" aria-hidden="true" />

        <div className="illustration__principal">
          <h1 className="illustration__titre">
            Espace
            <br />
            Administrateur
          </h1>
          <div className="trait-hope illustration__barre" aria-hidden="true" />
          <p className="illustration__sous-titre">
            Gérez vos dons, vos projets et suivez concrètement notre impact à Madagascar.
          </p>
        </div>

        <div className="illustration__pied">
          <MadagascarSilhouette className="illustration__madagascar" />
          <p className="illustration__devise">
            Pour un Madagascar
            <br />
            plus fort et plus solidaire
          </p>
        </div>
      </section>

      {/* ----- Panneau du formulaire ----- */}
      <section className="connexion__panneau">
        <div className="carte-connexion">
          <header className="carte-connexion__entete">
            <HopeLogo />
            <h2 className="carte-connexion__titre">Connexion administrateur</h2>
            <p className="carte-connexion__accroche">
              Accédez à votre espace pour gérer les dons, les projets, les équipes et suivre
              notre impact.
            </p>
          </header>

          <form className="formulaire" onSubmit={soumettre} noValidate>
            {/* --- Login --- */}
            <div className="champ">
              <label className="champ__label" htmlFor="adminLog">
                Login administrateur
              </label>
              <div className={`champ__boite${champEnErreur ? ' champ__boite--erreur' : ''}`}>
                <IconeUtilisateur className="champ__icone" />
                <input
                  id="adminLog"
                  name="adminLog"
                  className="champ__saisie"
                  type="text"
                  autoComplete="username"
                  placeholder="AdminHope"
                  value={adminLog}
                  onChange={(e) => setAdminLog(e.target.value)}
                  disabled={chargement}
                  autoFocus
                />
              </div>
            </div>

            {/* --- Mot de passe --- */}
            <div className="champ">
              <label className="champ__label" htmlFor="password">
                Mot de passe
              </label>
              <div className={`champ__boite${champEnErreur ? ' champ__boite--erreur' : ''}`}>
                <IconeCadenas className="champ__icone" />
                <input
                  id="password"
                  name="password"
                  className="champ__saisie"
                  type={motDePasseVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={chargement}
                />
                <button
                  type="button"
                  className="champ__bascule"
                  onClick={() => setMotDePasseVisible((visible) => !visible)}
                  aria-label={
                    motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                  }
                  aria-pressed={motDePasseVisible}
                  title={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {motDePasseVisible ? <IconeOeilBarre /> : <IconeOeil />}
                </button>
              </div>
            </div>

            {/* --- Options --- */}
            <div className="formulaire__options">
              <label className="case-a-cocher">
                <input
                  type="checkbox"
                  checked={seSouvenir}
                  onChange={(e) => setSeSouvenir(e.target.checked)}
                  disabled={chargement}
                />
                <span className="case-a-cocher__repere" />
                Se souvenir de moi
              </label>

              <button
                type="button"
                className="formulaire__lien"
                onClick={() =>
                  setInformation(
                    "Contactez l'administrateur technique de HOPE pour réinitialiser votre mot de passe."
                  )
                }
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* --- Retours utilisateur --- */}
            {erreur !== '' && (
              <p className="formulaire__erreur" role="alert">
                <IconeAlerte />
                {erreur}
              </p>
            )}

            {information !== '' && (
              <p className="formulaire__erreur" role="status">
                <IconeAlerte />
                {information}
              </p>
            )}

            {/* --- Actions --- */}
            <button type="submit" className="bouton bouton--principal" disabled={chargement}>
              {chargement ? (
                <>
                  <span className="bouton__chargement" aria-hidden="true" />
                  Connexion en cours…
                </>
              ) : (
                <>
                  Se connecter
                  <IconeFleche />
                </>
              )}
            </button>

            <a className="bouton bouton--secondaire" href={SITE_PUBLIC}>
              Retour au site
            </a>
          </form>

          <footer className="carte-connexion__pied">
            <span className="carte-connexion__trait" />
            <div className="reassurance">
              
              <div>
                <strong>Accès réservé à l’équipe HOPE</strong>
                </div>
            </div>
            <span className="carte-connexion__trait" />
          </footer>
        </div>

        <p className="connexion__signature">Ensemble pour un avenir meilleur</p>
        <span className="trait-hope trait-hope--centre" aria-hidden="true" />
      </section>
    </div>
  );
}
