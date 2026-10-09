import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import LiensLegaux from '../components/LiensLegaux.jsx';
import HopeLogo from '../components/HopeLogo.jsx';
import MadagascarSilhouette from '../components/MadagascarSilhouette.jsx';
import photoHope from '../assets/hope-couverture.jpg';
import { IconeCadenas, IconeFleche, IconeOeil, IconeOeilBarre, IconeUtilisateur } from '../components/HopeIcons.jsx';
import { messageErreur } from '../services/api.js';
import * as utilisateurService from '../services/utilisateur.service.js';

function CadreMotDePasse({
  titre,
  accroche,
  children,
  illustration = ['Un oubli,', 'ça arrive'],
  sousTitre = 'Un lien par courriel, un nouveau mot de passe, et vous retrouvez votre espace.',
}) {
  return (
    <div className="connexion connexion--defile">
      <section
        className="connexion__illustration connexion__illustration--utilisateur"
        style={{ '--photo-hope': `url(${photoHope})` }}
      >
        <div className="illustration__principal">
          <p className="illustration__surtitre">Votre compte HOPE</p>
          <h1 className="illustration__titre">
            {illustration[0]}
            <br />
            {illustration[1]}
          </h1>
          <div className="trait-hope trait-hope--renverse illustration__barre" aria-hidden="true" />
          <p className="illustration__sous-titre">{sousTitre}</p>
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

      <section className="connexion__panneau">
        <div className="carte-connexion carte-connexion--utilisateur">
          <header className="carte-connexion__entete">
            <HopeLogo />
            <h2 className="carte-connexion__titre">{titre}</h2>
            <p className="carte-connexion__accroche">{accroche}</p>
          </header>
          {children}
        </div>
        <p className="connexion__signature">Ensemble pour un avenir meilleur</p>
        <span className="trait-hope trait-hope--centre" aria-hidden="true" />
        <LiensLegaux />
      </section>
    </div>
  );
}

export function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [reponse, setReponse] = useState('');

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErreur('Indiquez une adresse électronique valide.');
      return;
    }
    setEnvoi(true);
    try {
      setReponse(await utilisateurService.demanderReinitialisation(email.trim()));
    } catch (echec) {
      setErreur(messageErreur(echec, 'La demande n’a pas pu partir. Réessayez dans un instant.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <CadreMotDePasse
      titre="Mot de passe oublié"
      accroche="Donnez l’adresse de votre compte : un lien pour choisir un nouveau mot de passe vous y attend."
    >
      {reponse ? (
        <div className="formulaire mot-de-passe__envoye" role="status">
          <p className="note-acces note-acces--ok">{reponse}</p>
          <p className="mot-de-passe__aide">
            Rien reçu ? Regardez dans les courriers indésirables, ou refaites la demande dans quelques minutes.
          </p>
          <Link className="bouton bouton--secondaire" to="/authentification">
            Revenir à la connexion
          </Link>
        </div>
      ) : (
        <form className="formulaire" onSubmit={soumettre} noValidate>
          <div className="champ">
            <label className="champ__label" htmlFor="emailOubli">
              Adresse électronique
            </label>
            <div className={`champ__boite${erreur ? ' champ__boite--erreur' : ''}`}>
              <IconeUtilisateur className="champ__icone" />
              <input
                id="emailOubli"
                name="email"
                type="email"
                className="champ__saisie"
                autoComplete="email"
                placeholder="vous@exemple.mg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={envoi}
                autoFocus
              />
            </div>
          </div>

          {erreur && (
            <p className="formulaire__erreur" role="alert">
              {erreur}
            </p>
          )}

          <button type="submit" className="bouton bouton--principal" disabled={envoi}>
            {envoi ? (
              'Envoi…'
            ) : (
              <>
                Recevoir le lien
                <IconeFleche />
              </>
            )}
          </button>
          <Link className="bouton bouton--secondaire" to="/authentification">
            Revenir à la connexion
          </Link>
        </form>
      )}
    </CadreMotDePasse>
  );
}

export function ReinitialiserMotDePasse() {
  const navigate = useNavigate();
  const [parametres] = useSearchParams();
  const jeton = parametres.get('jeton') ?? '';

  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [fait, setFait] = useState('');

  const lienValide = /^[a-f0-9]{64}$/.test(jeton);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');
    if (motDePasse.length < 8) {
      setErreur('Le mot de passe doit compter au moins 8 caractères.');
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setEnvoi(true);
    try {
      setFait(await utilisateurService.reinitialiserMotDePasse(jeton, motDePasse));
      setMotDePasse('');
      setConfirmation('');
    } catch (echec) {
      setErreur(messageErreur(echec, 'Le mot de passe n’a pas pu être changé.'));
    } finally {
      setEnvoi(false);
    }
  }

  if (!lienValide) {
    return (
      <CadreMotDePasse titre="Lien incomplet" accroche="Ce lien ne contient pas ce qu’il faut pour changer le mot de passe.">
        <div className="formulaire">
          <p className="formulaire__erreur" role="alert">
            Ouvrez le lien directement depuis le courriel reçu, ou demandez-en un nouveau.
          </p>
          <Link className="bouton bouton--principal" to="/mot-de-passe-oublie">
            Demander un nouveau lien
            <IconeFleche />
          </Link>
        </div>
      </CadreMotDePasse>
    );
  }

  return (
    <CadreMotDePasse titre="Nouveau mot de passe" accroche="Choisissez-le, puis connectez-vous avec.">
      {fait ? (
        <div className="formulaire" role="status">
          <p className="note-acces note-acces--ok">{fait}</p>
          <button type="button" className="bouton bouton--principal" onClick={() => navigate('/authentification')}>
            Se connecter
            <IconeFleche />
          </button>
        </div>
      ) : (
        <form className="formulaire" onSubmit={soumettre} noValidate>
          <div className="champ">
            <label className="champ__label" htmlFor="nouveauMotDePasse">
              Nouveau mot de passe
            </label>
            <div className={`champ__boite${erreur ? ' champ__boite--erreur' : ''}`}>
              <IconeCadenas className="champ__icone" />
              <input
                id="nouveauMotDePasse"
                name="motDePasse"
                type={visible ? 'text' : 'password'}
                className="champ__saisie"
                autoComplete="new-password"
                placeholder="Au moins 8 caractères"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                disabled={envoi}
                autoFocus
              />
              <button
                type="button"
                className="champ__bascule"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={visible}
              >
                {visible ? <IconeOeilBarre /> : <IconeOeil />}
              </button>
            </div>
          </div>

          <div className="champ">
            <label className="champ__label" htmlFor="confirmationMotDePasse">
              Confirmer le mot de passe
            </label>
            <div className="champ__boite">
              <IconeCadenas className="champ__icone" />
              <input
                id="confirmationMotDePasse"
                type={visible ? 'text' : 'password'}
                className="champ__saisie"
                autoComplete="new-password"
                placeholder="Saisissez-le à nouveau"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={envoi}
              />
            </div>
          </div>

          {erreur && (
            <p className="formulaire__erreur" role="alert">
              {erreur}
            </p>
          )}

          <button type="submit" className="bouton bouton--principal" disabled={envoi}>
            {envoi ? (
              'Enregistrement…'
            ) : (
              <>
                Changer mon mot de passe
                <IconeFleche />
              </>
            )}
          </button>
          {erreur.includes('plus valable') && (
            <Link className="bouton bouton--secondaire" to="/mot-de-passe-oublie">
              Demander un nouveau lien
            </Link>
          )}
        </form>
      )}
    </CadreMotDePasse>
  );
}

export function VerifierCourriel() {
  const [parametres] = useSearchParams();
  const jeton = parametres.get('jeton') ?? '';
  const lienValide = /^[a-f0-9]{64}$/.test(jeton);
  const [etat, setEtat] = useState(lienValide ? 'envoi' : 'invalide');
  const [message, setMessage] = useState('');

  const appel = useRef({ jeton: null, promesse: null });

  useEffect(() => {
    if (!lienValide) return undefined;
    let actif = true;
    if (appel.current.jeton !== jeton) {
      appel.current = { jeton, promesse: utilisateurService.verifierCourriel(jeton) };
    }
    appel.current.promesse
      .then((texte) => {
        if (!actif) return;
        setMessage(texte);
        setEtat('fait');
      })
      .catch((echec) => {
        if (!actif) return;
        setMessage(messageErreur(echec, 'L’adresse n’a pas pu être confirmée.'));
        setEtat('refus');
      });
    return () => {
      actif = false;
    };
  }, [jeton, lienValide]);

  const titres = {
    envoi: ['Confirmation…', 'Un instant : nous vérifions le lien.'],
    fait: ['Adresse confirmée', 'Tout est en ordre.'],
    refus: ['Lien expiré', 'Ce lien ne peut plus servir.'],
    invalide: ['Lien incomplet', 'Ce lien ne contient pas ce qu’il faut.'],
  };

  return (
    <CadreMotDePasse
      titre={titres[etat][0]}
      accroche={titres[etat][1]}
      illustration={['Bienvenue', 'chez HOPE']}
      sousTitre="Une adresse confirmée, et HOPE peut vous écrire au sujet de votre compte et de vos dons."
    >
      <div className="formulaire" role="status">
        {etat === 'fait' && <p className="note-acces note-acces--ok">{message}</p>}
        {(etat === 'refus' || etat === 'invalide') && (
          <p className="formulaire__erreur" role="alert">
            {message || 'Ouvrez le lien directement depuis le courriel reçu.'} Connectez-vous : votre espace permet d’en
            demander un nouveau.
          </p>
        )}
        {etat !== 'envoi' && (
          <Link className="bouton bouton--principal" to="/authentification">
            Aller à mon espace
            <IconeFleche />
          </Link>
        )}
      </div>
    </CadreMotDePasse>
  );
}
