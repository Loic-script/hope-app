import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import HopeLogo from '../components/HopeLogo.jsx';
// Le pictogramme officiel, declinaison pour fond violet : ses couleurs
// conviennent au panneau sombre.
import pictogramme from '../assets/LOGO_PICTOGRAMME_FOND_VIOLET.png';
import MadagascarSilhouette from '../components/MadagascarSilhouette.jsx';
import photoHope from '../assets/hope-couverture.jpg';
import {
  IconeBouclier,
  IconeCadenas,
  IconeFleche,
  IconeOeil,
  IconeOeilBarre,
  IconeUtilisateur,
} from '../components/HopeIcons.jsx';
import { useChargement } from '../hooks/useChargement.js';
import { messageErreur } from '../services/api.js';
import * as utilisateurService from '../services/utilisateur.service.js';

/** Message unique en cas d'echec : il ne revele jamais quel champ est faux. */
const MESSAGE_ERREUR = 'Adresse ou mot de passe incorrect.';

/** Longueur minimale, alignee sur le controle du backend. */
const LONGUEUR_MOT_DE_PASSE = 8;

/** Adresse du site public HOPE (pas encore developpe a cette etape). */
const SITE_PUBLIC = import.meta.env.VITE_SITE_URL ?? '/';

const FORMULAIRE_VIDE = {
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  typeUtilisateur: '',
  motDePasse: '',
  confirmation: '',
};

/**
 * Authentification des utilisateurs : donateur, benevole, bailleur.
 *
 * Une seule page pour les trois, et deux sections : se connecter ou
 * s'inscrire. Le type choisi a l'inscription decide de tout le reste --
 * si le compte s'ouvre aussitot ou attend la validation de HOPE, et
 * dans quel espace la connexion mene.
 *
 * L'administrateur n'est pas concerne : son compte n'est pas cree par
 * inscription, il garde sa propre page.
 */
export default function Authentification() {
  const navigate = useNavigate();
  const { donnees: types } = useChargement(() => utilisateurService.typesUtilisateur(), []);

  const [section, setSection] = useState('connexion');

  return (
    <div className="connexion">
      {/* ----- Panneau d'illustration ----- */}
      <section
        className="connexion__illustration connexion__illustration--utilisateur"
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
            Rejoindre
            <br />
            HOPE
          </h1>
          <div className="illustration__barre" />
          <p className="illustration__sous-titre">
            Donnez, agissez sur le terrain ou financez nos projets. Un seul compte, selon ce
            que vous venez faire.
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
        <div className="carte-connexion carte-connexion--utilisateur">
          <header className="carte-connexion__entete">
            <HopeLogo />
            <h2 className="carte-connexion__titre">
              {section === 'connexion' ? 'Se connecter' : 'Créer un compte'}
            </h2>
            <p className="carte-connexion__accroche">
              {section === 'connexion'
                ? 'Accédez à votre espace : donateur, bénévole ou bailleur.'
                : 'Choisissez ce que vous venez faire chez HOPE : la suite s’adapte.'}
            </p>
          </header>

          {/* Deux sections, un seul jeu d'onglets : on voit d'un coup
              d'oeil qu'il y a les deux, et laquelle est ouverte. */}
          <div className="bascule-acces" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={section === 'connexion'}
              className={`bascule-acces__onglet${
                section === 'connexion' ? ' bascule-acces__onglet--actif' : ''
              }`}
              onClick={() => setSection('connexion')}
            >
              Connexion
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === 'inscription'}
              className={`bascule-acces__onglet${
                section === 'inscription' ? ' bascule-acces__onglet--actif' : ''
              }`}
              onClick={() => setSection('inscription')}
            >
              Inscription
            </button>
          </div>

          {section === 'connexion' ? (
            <Connexion navigate={navigate} />
          ) : (
            <Inscription types={types ?? []} onInscrit={() => setSection('connexion')} />
          )}

          <footer className="carte-connexion__pied">
            <span className="carte-connexion__trait" />
            <div className="reassurance">
              <div>
                <strong>Espace réservé aux membres HOPE</strong>
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

/* ================================================================
   Section connexion : adresse et mot de passe
   ================================================================ */

function Connexion({ navigate }) {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [seSouvenir, setSeSouvenir] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enAttente, setEnAttente] = useState(false);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');
    setEnAttente(false);

    if (email.trim() === '' || motDePasse === '') {
      setErreur('Veuillez renseigner votre adresse et votre mot de passe.');
      return;
    }

    setChargement(true);
    try {
      const session = await utilisateurService.connecter(
        email.trim(),
        motDePasse,
        seSouvenir
      );
      // La destination est decidee par le backend : l'espace, ou le
      // formulaire de completion s'il reste des informations a donner.
      navigate(session.destination, { replace: true });
    } catch (echec) {
      const statut = echec?.response?.status;
      const code = echec?.response?.data?.code;

      // Un compte en attente de validation n'est pas une erreur de
      // saisie : le message l'explique, et le ton n'est pas celui d'un
      // refus.
      if (code === 'COMPTE_EN_ATTENTE') {
        setEnAttente(true);
        setErreur(echec.response.data.message);
      } else if (statut === 401) {
        setErreur(MESSAGE_ERREUR);
      } else if (statut === 429) {
        setErreur(echec.response.data?.message ?? 'Trop de tentatives, veuillez patienter.');
      } else {
        setErreur(messageErreur(echec, 'Connexion impossible pour le moment.'));
      }
      setMotDePasse('');
    } finally {
      setChargement(false);
    }
  }

  const champEnErreur = erreur === MESSAGE_ERREUR;

  return (
    <form className="formulaire" onSubmit={soumettre} noValidate>
      <div className="champ">
        <label className="champ__label" htmlFor="email">
          Adresse électronique
        </label>
        <div className={`champ__boite${champEnErreur ? ' champ__boite--erreur' : ''}`}>
          <IconeUtilisateur className="champ__icone" />
          <input
            id="email"
            name="email"
            className="champ__saisie"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.mg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={chargement}
            autoFocus
          />
        </div>
      </div>

      <div className="champ">
        <label className="champ__label" htmlFor="motDePasse">
          Mot de passe
        </label>
        <div className={`champ__boite${champEnErreur ? ' champ__boite--erreur' : ''}`}>
          <IconeCadenas className="champ__icone" />
          <input
            id="motDePasse"
            name="motDePasse"
            className="champ__saisie"
            type={motDePasseVisible ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            disabled={chargement}
          />
          <button
            type="button"
            className="champ__bascule"
            onClick={() => setMotDePasseVisible((visible) => !visible)}
            aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={motDePasseVisible}
          >
            {motDePasseVisible ? <IconeOeilBarre /> : <IconeOeil />}
          </button>
        </div>
      </div>

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
      </div>

      {erreur && (
        <p
          className={enAttente ? 'formulaire__attente' : 'formulaire__erreur'}
          role={enAttente ? 'status' : 'alert'}
        >
          {erreur}
        </p>
      )}

      <button type="submit" className="bouton bouton--principal" disabled={chargement}>
        {chargement ? (
          'Connexion…'
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
  );
}

/* ================================================================
   Section inscription
   ================================================================ */

function Inscription({ types, onInscrit }) {
  const [champs, setChamps] = useState(FORMULAIRE_VIDE);
  const [erreursChamps, setErreursChamps] = useState({});
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);

  // Le succes ramene a la connexion, le temps que le message se lise.
  useEffect(() => {
    if (succes === '') return undefined;
    const minuterie = setTimeout(onInscrit, 4000);
    return () => clearTimeout(minuterie);
  }, [succes, onInscrit]);

  function modifier(nom) {
    return (evenement) => {
      const valeur = evenement.target.value;
      setChamps((precedents) => ({ ...precedents, [nom]: valeur }));
      setErreursChamps((precedentes) => ({ ...precedentes, [nom]: undefined }));
    };
  }

  /** Controle cote client, double cote serveur. */
  function verifier() {
    const details = {};
    if (champs.prenom.trim() === '') details.prenom = 'Champ obligatoire';
    if (champs.nom.trim() === '') details.nom = 'Champ obligatoire';
    if (champs.email.trim() === '') details.email = 'Champ obligatoire';
    if (champs.telephone.trim() === '') details.telephone = 'Champ obligatoire';
    if (champs.typeUtilisateur === '') details.typeUtilisateur = 'Champ obligatoire';
    if (champs.motDePasse === '') details.motDePasse = 'Champ obligatoire';
    else if (champs.motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
      details.motDePasse = `Au moins ${LONGUEUR_MOT_DE_PASSE} caractères`;
    }
    if (champs.confirmation !== champs.motDePasse) {
      details.confirmation = 'Les deux mots de passe ne correspondent pas';
    }
    return details;
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');
    setSucces('');

    const details = verifier();
    if (Object.keys(details).length > 0) {
      setErreursChamps(details);
      setErreur('Le formulaire comporte des erreurs.');
      return;
    }

    setEnvoi(true);
    try {
      const { message } = await utilisateurService.inscrire({
        nom: champs.nom.trim(),
        prenom: champs.prenom.trim(),
        email: champs.email.trim(),
        telephone: champs.telephone.trim(),
        typeUtilisateur: champs.typeUtilisateur,
        motDePasse: champs.motDePasse,
        confirmation: champs.confirmation,
      });
      setSucces(message);
      setChamps(FORMULAIRE_VIDE);
    } catch (echec) {
      setErreursChamps(echec?.response?.data?.details ?? {});
      setErreur(messageErreur(echec, 'L’inscription n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
    }
  }

  // Ce que le type choisi implique, dit avant l'envoi.
  const typeChoisi = types.find((t) => t.cle === champs.typeUtilisateur);

  return (
    <form className="formulaire" onSubmit={soumettre} noValidate>
      <div className="paire-acces">
        <Champ
          id="prenom"
          libelle="Prénom"
          valeur={champs.prenom}
          onChange={modifier('prenom')}
          erreur={erreursChamps.prenom}
          disabled={envoi}
          autoComplete="given-name"
          autoFocus
        />
        <Champ
          id="nom"
          libelle="Nom"
          valeur={champs.nom}
          onChange={modifier('nom')}
          erreur={erreursChamps.nom}
          disabled={envoi}
          autoComplete="family-name"
        />
      </div>

      <Champ
        id="email"
        libelle="Adresse électronique"
        type="email"
        valeur={champs.email}
        onChange={modifier('email')}
        erreur={erreursChamps.email}
        disabled={envoi}
        autoComplete="email"
        placeholder="vous@exemple.mg"
      />

      <Champ
        id="telephone"
        libelle="Téléphone"
        type="tel"
        valeur={champs.telephone}
        onChange={modifier('telephone')}
        erreur={erreursChamps.telephone}
        disabled={envoi}
        autoComplete="tel"
        placeholder="+261 34 12 345 67"
      />

      <div className="champ">
        <label className="champ__label" htmlFor="typeUtilisateur">
          Utilisateur
        </label>
        <div
          className={`champ__boite${
            erreursChamps.typeUtilisateur ? ' champ__boite--erreur' : ''
          }`}
        >
          <IconeBouclier className="champ__icone" />
          <select
            id="typeUtilisateur"
            name="typeUtilisateur"
            className="champ__saisie champ__selection"
            value={champs.typeUtilisateur}
            onChange={modifier('typeUtilisateur')}
            disabled={envoi}
            aria-invalid={Boolean(erreursChamps.typeUtilisateur)}
          >
            <option value="">Que venez-vous faire ?</option>
            {types.map((type) => (
              <option key={type.cle} value={type.cle}>
                {type.libelle}
              </option>
            ))}
          </select>
        </div>
        {erreursChamps.typeUtilisateur && (
          <p className="champ__erreur">{erreursChamps.typeUtilisateur}</p>
        )}
      </div>

      {/* La regle de validation depend du type : on la dit ici, avant
          l'envoi, plutot que de laisser la surprise a la connexion. */}
      {typeChoisi && (
        <p className={typeChoisi.validationRequise ? 'note-acces' : 'note-acces note-acces--ok'}>
          {typeChoisi.validationRequise
            ? 'Votre compte sera vérifié par l’équipe HOPE avant votre première connexion.'
            : 'Vous pourrez vous connecter dès la création de votre compte.'}
        </p>
      )}

      <Champ
        id="motDePasseInscription"
        nom="motDePasse"
        libelle="Mot de passe"
        type={motDePasseVisible ? 'text' : 'password'}
        valeur={champs.motDePasse}
        onChange={modifier('motDePasse')}
        erreur={erreursChamps.motDePasse}
        disabled={envoi}
        autoComplete="new-password"
        placeholder={`Au moins ${LONGUEUR_MOT_DE_PASSE} caractères`}
        bascule={
          <button
            type="button"
            className="champ__bascule"
            onClick={() => setMotDePasseVisible((visible) => !visible)}
            aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={motDePasseVisible}
          >
            {motDePasseVisible ? <IconeOeilBarre /> : <IconeOeil />}
          </button>
        }
      />

      <Champ
        id="confirmation"
        libelle="Confirmer le mot de passe"
        type={motDePasseVisible ? 'text' : 'password'}
        valeur={champs.confirmation}
        onChange={modifier('confirmation')}
        erreur={erreursChamps.confirmation}
        disabled={envoi}
        autoComplete="new-password"
        placeholder="Saisissez-le à nouveau"
      />

      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}
      {succes && (
        <p className="formulaire__succes" role="status">
          {succes}
        </p>
      )}

      <button type="submit" className="bouton bouton--principal" disabled={envoi}>
        {envoi ? (
          'Création…'
        ) : (
          <>
            Créer mon compte
            <IconeFleche />
          </>
        )}
      </button>
    </form>
  );
}

/** Un champ du formulaire, libelle, icone et message d'erreur compris. */
function Champ({
  id,
  nom,
  libelle,
  erreur,
  valeur,
  onChange,
  type = 'text',
  bascule,
  ...reste
}) {
  const avecCadenas = type === 'password' || id.toLowerCase().includes('motdepasse')
    || id === 'confirmation';

  return (
    <div className="champ">
      <label className="champ__label" htmlFor={id}>
        {libelle}
      </label>
      <div className={`champ__boite${erreur ? ' champ__boite--erreur' : ''}`}>
        {avecCadenas ? (
          <IconeCadenas className="champ__icone" />
        ) : (
          <IconeUtilisateur className="champ__icone" />
        )}
        <input
          id={id}
          name={nom ?? id}
          className="champ__saisie"
          type={type}
          value={valeur}
          onChange={onChange}
          aria-invalid={Boolean(erreur)}
          aria-describedby={erreur ? `${id}-erreur` : undefined}
          {...reste}
        />
        {bascule}
      </div>
      {erreur && (
        <p className="champ__erreur" id={`${id}-erreur`}>
          {erreur}
        </p>
      )}
    </div>
  );
}
