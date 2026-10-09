import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { messageErreur } from '../../services/api.js';
import { apiBailleur } from '../../services/apiBailleur.js';
import { apiBenevole } from '../../services/apiBenevole.js';
import { apiDonateur } from '../../services/apiDonateur.js';
import { effacerToutesLesSessions } from '../../services/utilisateur.service.js';

const CLIENTS = { donateur: apiDonateur, benevole: apiBenevole, bailleur: apiBailleur };
const LONGUEUR = 8;

function solidite(motDePasse) {
  let points = 0;
  if (motDePasse.length >= LONGUEUR) points += 1;
  if (motDePasse.length >= 12) points += 1;
  if (/[a-z]/.test(motDePasse) && /[A-Z]/.test(motDePasse)) points += 1;
  if (/\d/.test(motDePasse)) points += 1;
  if (/[^A-Za-z0-9]/.test(motDePasse)) points += 1;
  if (motDePasse.length < LONGUEUR) return { niveau: 0, libelle: 'Trop court' };
  if (points <= 2) return { niveau: 1, libelle: 'Faible' };
  if (points <= 3) return { niveau: 2, libelle: 'Correct' };
  return { niveau: 3, libelle: 'Solide' };
}

function IconeOeil({ barre }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {barre && <path d="M4 4l16 16" />}
    </svg>
  );
}

function ChampSecret({ id, libelle, valeur, onChange, visible, erreur, autoComplete, disabled, aide }) {
  return (
    <div className="securite__champ">
      <label htmlFor={id}>{libelle}</label>
      <input
        id={id}
        name={id}
        type={visible ? 'text' : 'password'}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={Boolean(erreur)}
        aria-describedby={erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined}
      />
      {erreur ? (
        <span className="securite__erreur" id={`${id}-erreur`}>
          {erreur}
        </span>
      ) : (
        aide && (
          <span className="securite__aide" id={`${id}-aide`}>
            {aide}
          </span>
        )
      )}
    </div>
  );
}

function ChangerMotDePasse({ client }) {
  const [ouvert, setOuvert] = useState(false);
  const [champs, setChamps] = useState({ actuel: '', nouveau: '', confirmation: '' });
  const [visible, setVisible] = useState(false);
  const [erreurs, setErreurs] = useState({});
  const [refus, setRefus] = useState('');
  const [succes, setSucces] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const force = solidite(champs.nouveau);

  const modifier = (nom) => (valeur) => {
    setChamps((c) => ({ ...c, [nom]: valeur }));
    setErreurs((e) => ({ ...e, [nom]: undefined }));
  };

  async function soumettre(evenement) {
    evenement.preventDefault();
    setRefus('');
    const details = {};
    if (!champs.actuel) details.actuel = 'Champ obligatoire';
    if (champs.nouveau.length < LONGUEUR) details.nouveau = `Au moins ${LONGUEUR} caractères`;
    if (champs.confirmation !== champs.nouveau) details.confirmation = 'Les deux mots de passe ne correspondent pas';
    if (Object.keys(details).length > 0) {
      setErreurs(details);
      return;
    }
    setEnvoi(true);
    try {
      const { data } = await client.post('/espace/compte/mot-de-passe', champs);
      setSucces(data.message);
      setChamps({ actuel: '', nouveau: '', confirmation: '' });
      setOuvert(false);
    } catch (echec) {
      setErreurs(echec?.response?.data?.details ?? {});
      setRefus(messageErreur(echec, 'Le mot de passe n’a pas pu être changé.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="securite__ligne">
      <div className="securite__entete">
        <span className="securite__pictogramme" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        </span>
        <div>
          <h3>Mot de passe</h3>
          <p>Changez-le si vous pensez qu’il a pu être vu. Vos autres sessions seront fermées.</p>
        </div>
        {!ouvert && (
          <button
            type="button"
            className="securite__bouton"
            onClick={() => {
              setOuvert(true);
              setSucces('');
            }}
            aria-expanded={ouvert}
          >
            Changer
          </button>
        )}
      </div>

      {succes && (
        <p className="securite__succes" role="status">
          {succes}
        </p>
      )}

      {ouvert && (
        <form className="securite__formulaire" onSubmit={soumettre} noValidate>
          <ChampSecret
            id="motDePasseActuel"
            libelle="Mot de passe actuel"
            valeur={champs.actuel}
            onChange={modifier('actuel')}
            visible={visible}
            erreur={erreurs.actuel}
            autoComplete="current-password"
            disabled={envoi}
          />
          <ChampSecret
            id="nouveauMotDePasseCompte"
            libelle="Nouveau mot de passe"
            valeur={champs.nouveau}
            onChange={modifier('nouveau')}
            visible={visible}
            erreur={erreurs.nouveau}
            autoComplete="new-password"
            disabled={envoi}
            aide={`Au moins ${LONGUEUR} caractères ; mélangez lettres, chiffres et signes.`}
          />
          {champs.nouveau && (
            <div className={`securite__force securite__force--${force.niveau}`} aria-live="polite">
              <span className="securite__jauge" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {force.libelle}
            </div>
          )}
          <ChampSecret
            id="confirmationMotDePasseCompte"
            libelle="Confirmer le nouveau mot de passe"
            valeur={champs.confirmation}
            onChange={modifier('confirmation')}
            visible={visible}
            erreur={erreurs.confirmation}
            autoComplete="new-password"
            disabled={envoi}
          />
          <button
            type="button"
            className="securite__voir"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
          >
            <IconeOeil barre={visible} />
            {visible ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
          </button>
          {refus && (
            <p className="securite__refus" role="alert">
              {refus}
            </p>
          )}
          <div className="securite__actions">
            <button type="button" className="securite__bouton securite__bouton--discret" onClick={() => setOuvert(false)} disabled={envoi}>
              Annuler
            </button>
            <button type="submit" className="securite__bouton securite__bouton--principal" disabled={envoi}>
              {envoi ? 'Enregistrement…' : 'Changer mon mot de passe'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SupprimerCompte({ client }) {
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurs, setErreurs] = useState({});
  const [refus, setRefus] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const premierChamp = useRef(null);
  const declencheur = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    premierChamp.current?.focus();
    const fermerAuClavier = (e) => {
      if (e.key === 'Escape' && !envoi) setOuvert(false);
    };
    window.addEventListener('keydown', fermerAuClavier);
    return () => window.removeEventListener('keydown', fermerAuClavier);
  }, [ouvert, envoi]);

  function fermer() {
    if (envoi) return;
    setOuvert(false);
    setMotDePasse('');
    setConfirmation('');
    setErreurs({});
    setRefus('');
    declencheur.current?.focus();
  }

  async function supprimer(evenement) {
    evenement.preventDefault();
    setRefus('');
    setEnvoi(true);
    try {
      await client.post('/espace/compte/suppression', { motDePasse, confirmation });
      effacerToutesLesSessions();
      navigate('/authentification', { replace: true, state: { compteSupprime: true } });
    } catch (echec) {
      setErreurs(echec?.response?.data?.details ?? {});
      setRefus(messageErreur(echec, 'Le compte n’a pas pu être supprimé.'));
      setEnvoi(false);
    }
  }

  const pret = motDePasse !== '' && confirmation.trim().toUpperCase() === 'SUPPRIMER';

  return (
    <div className="securite__ligne securite__ligne--danger">
      <div className="securite__entete">
        <span className="securite__pictogramme securite__pictogramme--danger" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </span>
        <div>
          <h3>Supprimer mon compte</h3>
          <p>Vos informations personnelles sont effacées. C’est définitif.</p>
        </div>
        <button
          type="button"
          ref={declencheur}
          className="securite__bouton securite__bouton--danger"
          onClick={() => setOuvert(true)}
        >
          Supprimer
        </button>
      </div>

      {ouvert && (
        <div className="securite__voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
          <form
            className="securite__fenetre"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-suppression"
            onSubmit={supprimer}
            noValidate
          >
            <h3 id="titre-suppression">Supprimer votre compte ?</h3>
            <ul className="securite__consequences">
              <li>Votre nom, téléphone, adresse et photo sont effacés.</li>
              <li>Vous ne pourrez plus vous connecter avec ce compte.</li>
              <li>
                Les dons déjà faits restent dans la comptabilité de l’association, comme la loi l’impose.
              </li>
            </ul>
            <div className="securite__champ">
              <label htmlFor="motDePasseSuppression">Votre mot de passe</label>
              <input
                ref={premierChamp}
                id="motDePasseSuppression"
                type="password"
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                disabled={envoi}
                aria-invalid={Boolean(erreurs.motDePasse)}
              />
              {erreurs.motDePasse && <span className="securite__erreur">{erreurs.motDePasse}</span>}
            </div>
            <div className="securite__champ">
              <label htmlFor="confirmationSuppression">
                Écrivez <strong>SUPPRIMER</strong> pour confirmer
              </label>
              <input
                id="confirmationSuppression"
                type="text"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={envoi}
              />
            </div>
            {refus && (
              <p className="securite__refus" role="alert">
                {refus}
              </p>
            )}
            <div className="securite__actions">
              <button type="button" className="securite__bouton securite__bouton--discret" onClick={fermer} disabled={envoi}>
                Garder mon compte
              </button>
              <button type="submit" className="securite__bouton securite__bouton--danger-plein" disabled={!pret || envoi}>
                {envoi ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function SecuriteCompte({ espace }) {
  const client = CLIENTS[espace];
  return (
    <section className="securite" aria-labelledby="titre-securite">
      <h2 id="titre-securite" className="securite__titre">
        Sécurité du compte
      </h2>
      <ChangerMotDePasse client={client} />
      <SupprimerCompte client={client} />
    </section>
  );
}
