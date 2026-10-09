import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import LiensLegaux from '../components/LiensLegaux.jsx';
import HopeLogo from '../components/HopeLogo.jsx';
import MadagascarSilhouette from '../components/MadagascarSilhouette.jsx';
import photoHope from '../assets/hope-couverture.jpg';
import {
  IconeCadenas,
  IconeChevronBas,
  IconeCoeur,
  IconeFleche,
  IconeGroupe,
  IconeImmeuble,
  IconeNeutre,
  IconeOeil,
  IconeOeilBarre,
  IconePoigneeMain,
  IconeUtilisateur,
} from '../components/HopeIcons.jsx';
import { useChargement } from '../hooks/useChargement.js';
import { messageErreur } from '../services/api.js';
import { CLE_JETON_BENEVOLE, ecrireStockage } from '../services/apiBenevole.js';
import { TEMOIN_SESSION } from '../services/api.js';
import { focusAutomatique } from '../utils/ecran.js';
import * as authService from '../services/auth.service.js';
import * as utilisateurService from '../services/utilisateur.service.js';

const MESSAGE_ERREUR = 'Adresse ou mot de passe incorrect.';

const LONGUEUR_MOT_DE_PASSE = 8;

const TYPES_PAR_DEFAUT = [
  { cle: 'donateur', libelle: 'Donateur', validationRequise: false },
  { cle: 'benevole', libelle: 'Bénévole', validationRequise: true },
  { cle: 'bailleur', libelle: 'Bailleur', validationRequise: true },
];

const AUCUN = { cle: 'aucun', libelle: 'Aucun', validationRequise: false };

const SITE_PUBLIC = import.meta.env.VITE_SITE_URL ?? '/';

const FORMULAIRE_VIDE = {
  email: '',
  typeUtilisateur: '',
  motDePasse: '',
  confirmation: '',
  accepteConditions: false,
};

export default function Authentification() {
  const navigate = useNavigate();
  const compteSupprime = Boolean(useLocation().state?.compteSupprime);
  const { donnees: typesServeur } = useChargement(() => utilisateurService.typesUtilisateur(), []);
  const types = typesServeur?.length ? typesServeur : TYPES_PAR_DEFAUT;

  const [section, setSection] = useState('connexion');

  const titre = useRef(null);
  const [largeurTitre, setLargeurTitre] = useState(null);
  useLayoutEffect(() => {
    const element = titre.current;
    if (!element) return undefined;
    const mesurer = () => {
      const plage = document.createRange();
      plage.selectNodeContents(element);
      const lignes = [...plage.getClientRects()];
      if (lignes.length === 0) return;
      const fin = Math.max(...lignes.map((ligne) => ligne.right));
      setLargeurTitre(Math.ceil(fin - element.getBoundingClientRect().left));
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    document.fonts?.ready.then(mesurer);
    return () => observateur.disconnect();
  }, []);

  return (
    <div className="connexion connexion--defile">
      <section
        className="connexion__illustration connexion__illustration--utilisateur"
        style={{ '--photo-hope': `url(${photoHope})` }}
      >
        <div className="illustration__principal">
          <p className="illustration__surtitre">Rejoindre HOPE</p>
          <h1 className="illustration__titre" ref={titre}>
            Des enfants d’aujourd’hui,
            <br />
            un meilleur demain
          </h1>
          <div
            className="trait-hope trait-hope--renverse illustration__barre"
            style={largeurTitre ? { width: largeurTitre } : undefined}
            aria-hidden="true"
          />
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

      <section className="connexion__panneau">
        <div className="carte-connexion carte-connexion--utilisateur">
          <header className="carte-connexion__entete">
            <HopeLogo />
            <h2 className="carte-connexion__titre carte-connexion__titre--anime" key={`titre-${section}`}>
              {section === 'connexion' ? 'Se connecter' : 'Créer un compte'}
            </h2>
            <p className="carte-connexion__accroche carte-connexion__accroche--anime" key={`accroche-${section}`}>
              {section === 'connexion'
                ? 'Accédez à votre espace : donateur, bénévole ou bailleur.'
                : 'Choisissez ce que vous venez faire chez HOPE : la suite s’adapte.'}
            </p>
          </header>

          {compteSupprime && (
            <p className="formulaire__succes" role="status">
              Votre compte est supprimé. Merci pour ce que vous avez fait avec HOPE.
            </p>
          )}

          <div className="bascule-acces" role="tablist" data-section={section}>
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

          <div className="carte-connexion__section" key={section}>
            {section === 'connexion' ? (
              <Connexion navigate={navigate} types={types} />
            ) : (
              <Inscription
                types={types}
                navigate={navigate}
                onInscrit={() => setSection('connexion')}
              />
            )}
          </div>

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
        <LiensLegaux />
      </section>
    </div>
  );
}

function Connexion({ navigate, types }) {
  const emplacement = useLocation();
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') ?? '');
  const [typeUtilisateur, setTypeUtilisateur] = useState(() => {
    const type = new URLSearchParams(window.location.search).get('type') ?? '';
    return ['donateur', 'benevole', 'bailleur', AUCUN.cle].includes(type) ? type : '';
  });
  const [typeEnErreur, setTypeEnErreur] = useState(false);
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
    setTypeEnErreur(false);

    if (email.trim() === '' || typeUtilisateur === '' || motDePasse === '') {
      setTypeEnErreur(typeUtilisateur === '');
      setErreur('Veuillez renseigner votre adresse, votre type d’utilisateur et votre mot de passe.');
      return;
    }

    setChargement(true);
    try {
      if (typeUtilisateur === AUCUN.cle) {
        await authService.connecter(email.trim(), motDePasse, seSouvenir);
        navigate(emplacement.state?.depuis ?? '/admin', { replace: true });
        return;
      }
      const session = await utilisateurService.connecter(
        email.trim(),
        motDePasse,
        typeUtilisateur,
        seSouvenir
      );
      navigate(session.destination, { replace: true });
    } catch (echec) {
      const statut = echec?.response?.status;
      const code = echec?.response?.data?.code;

      if (code === 'COMPTE_EN_ATTENTE') {
        setEnAttente(true);
        setErreur(echec.response.data.message);
      } else if (code === 'TYPE_INCORRECT') {
        setTypeEnErreur(true);
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
  const identifiant = typeUtilisateur === AUCUN.cle;

  return (
    <form className={`formulaire${erreur && !enAttente ? ' formulaire--refus' : ''}`} onSubmit={soumettre} noValidate>
      <div className="champ">
        <label className="champ__label" htmlFor="email">
          {identifiant ? 'Identifiant' : 'Adresse électronique'}
        </label>
        <div className={`champ__boite${champEnErreur ? ' champ__boite--erreur' : ''}`}>
          <IconeUtilisateur className="champ__icone" />
          <input
            id="email"
            name="email"
            className="champ__saisie"
            type={identifiant ? 'text' : 'email'}
            autoComplete={identifiant ? 'username' : 'email'}
            placeholder={identifiant ? 'Votre identifiant' : 'vous@exemple.mg'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={chargement}
            autoFocus={focusAutomatique()}
          />
        </div>
      </div>

      <ChampType
        id="typeConnexion"
        types={[...types, AUCUN]}
        valeur={typeUtilisateur}
        onChange={(e) => {
          setTypeUtilisateur(e.target.value);
          setTypeEnErreur(false);
        }}
        erreur={typeEnErreur}
        disabled={chargement}
        invite="Votre espace"
      />

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
        <Link className="formulaire__lien" to="/mot-de-passe-oublie">
          Mot de passe oublié ?
        </Link>
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
          <>
            <span className="bouton__chargement" aria-hidden="true" />
            Connexion…
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
  );
}

function Inscription({ types, navigate, onInscrit }) {
  const [champs, setChamps] = useState(FORMULAIRE_VIDE);
  const [erreursChamps, setErreursChamps] = useState({});
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const enCours = useRef(false);

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

  function verifier() {
    const details = {};
    if (champs.email.trim() === '') details.email = 'Champ obligatoire';
    if (champs.typeUtilisateur === '') details.typeUtilisateur = 'Champ obligatoire';
    if (champs.motDePasse === '') details.motDePasse = 'Champ obligatoire';
    else if (champs.motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
      details.motDePasse = `Au moins ${LONGUEUR_MOT_DE_PASSE} caractères`;
    }
    if (champs.confirmation !== champs.motDePasse) {
      details.confirmation = 'Les deux mots de passe ne correspondent pas';
    }
    if (!champs.accepteConditions) {
      details.accepteConditions = 'Cochez la case pour créer votre compte';
    }
    return details;
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    if (enCours.current) return;

    setErreur('');
    setSucces('');

    const details = verifier();
    if (Object.keys(details).length > 0) {
      setErreursChamps(details);
      setErreur('Le formulaire comporte des erreurs.');
      return;
    }

    enCours.current = true;
    setEnvoi(true);
    try {
      const { message, jetonCompletion, aCompleter } = await utilisateurService.inscrire({
        email: champs.email.trim(),
        typeUtilisateur: champs.typeUtilisateur,
        motDePasse: champs.motDePasse,
        confirmation: champs.confirmation,
        accepteConditions: champs.accepteConditions,
      });

      if (jetonCompletion && aCompleter) {
        ecrireStockage(CLE_JETON_BENEVOLE, TEMOIN_SESSION);
        navigate(aCompleter, { replace: true });
        return;
      }
      if (champs.typeUtilisateur === 'donateur') {
        try {
          const session = await utilisateurService.connecter(
            champs.email.trim(),
            champs.motDePasse,
            'donateur',
            true
          );
          navigate(session.destination, { replace: true });
          return;
        } catch {
        }
      }
      setSucces(message);
      setChamps(FORMULAIRE_VIDE);
    } catch (echec) {
      setErreursChamps(echec?.response?.data?.details ?? {});
      setErreur(messageErreur(echec, 'L’inscription n’a pas pu être enregistrée.'));
    } finally {
      enCours.current = false;
      setEnvoi(false);
    }
  }

  const typeChoisi = types.find((t) => t.cle === champs.typeUtilisateur);

  return (
    <form className="formulaire" onSubmit={soumettre} noValidate>
      <Champ
        id="emailInscription"
        nom="email"
        libelle="Adresse électronique"
        type="email"
        valeur={champs.email}
        onChange={modifier('email')}
        erreur={erreursChamps.email}
        disabled={envoi}
        autoComplete="email"
        placeholder="vous@exemple.mg"
        autoFocus={focusAutomatique()}
      />

      <ChampType
        id="typeUtilisateur"
        types={types}
        valeur={champs.typeUtilisateur}
        onChange={modifier('typeUtilisateur')}
        erreur={erreursChamps.typeUtilisateur}
        disabled={envoi}
        invite="Que venez-vous faire ?"
      />

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

      <div className="consentement">
        <label className={`case-a-cocher case-a-cocher--texte${erreursChamps.accepteConditions ? ' case-a-cocher--erreur' : ''}`}>
          <input
            type="checkbox"
            name="accepteConditions"
            checked={champs.accepteConditions}
            onChange={(e) => {
              const coche = e.target.checked;
              setChamps((precedents) => ({ ...precedents, accepteConditions: coche }));
              setErreursChamps((precedentes) => ({ ...precedentes, accepteConditions: undefined }));
            }}
            disabled={envoi}
            aria-invalid={Boolean(erreursChamps.accepteConditions)}
            aria-describedby={erreursChamps.accepteConditions ? 'erreur-consentement' : undefined}
          />
          <span className="case-a-cocher__repere" />
          <span>
            J’accepte les{' '}
            <Link to="/conditions-utilisation" target="_blank" rel="noopener">
              conditions d’utilisation
            </Link>{' '}
            et la{' '}
            <Link to="/confidentialite" target="_blank" rel="noopener">
              politique de confidentialité
            </Link>{' '}
            de HOPE.
          </span>
        </label>
        {erreursChamps.accepteConditions && (
          <p className="champ__erreur" id="erreur-consentement">
            {erreursChamps.accepteConditions}
          </p>
        )}
      </div>

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
          <>
            <span className="bouton__chargement" aria-hidden="true" />
            Création…
          </>
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

const ICONES_TYPES = {
  donateur: IconeCoeur,
  benevole: IconePoigneeMain,
  bailleur: IconeImmeuble,
  aucun: IconeNeutre,
};

function ChampType({ id, types, valeur, onChange, erreur, disabled, invite }) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const boite = useRef(null);
  const bouton = useRef(null);

  const choisi = types.find((type) => type.cle === valeur) ?? null;
  const IconeChoisie = choisi ? (ICONES_TYPES[choisi.cle] ?? IconeGroupe) : IconeGroupe;
  const idListe = `${id}-liste`;

  const choisir = (cle) => {
    onChange({ target: { value: cle } });
    setOuvert(false);
    bouton.current?.focus();
  };

  const ouvrir = () => {
    if (disabled) return;
    setActif(Math.max(0, types.findIndex((type) => type.cle === valeur)));
    setOuvert(true);
  };

  useEffect(() => {
    if (!ouvert) return undefined;
    const auClic = (e) => boite.current && !boite.current.contains(e.target) && setOuvert(false);
    document.addEventListener('pointerdown', auClic);
    return () => document.removeEventListener('pointerdown', auClic);
  }, [ouvert]);

  function auClavier(evenement) {
    const { key } = evenement;
    if (!ouvert) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        evenement.preventDefault();
        ouvrir();
      }
      return;
    }
    if (key === 'Escape' || key === 'Tab') {
      if (key === 'Escape') evenement.preventDefault();
      setOuvert(false);
    } else if (key === 'ArrowDown') {
      evenement.preventDefault();
      setActif((i) => Math.min(types.length - 1, i + 1));
    } else if (key === 'ArrowUp') {
      evenement.preventDefault();
      setActif((i) => Math.max(0, i - 1));
    } else if (key === 'Home') {
      evenement.preventDefault();
      setActif(0);
    } else if (key === 'End') {
      evenement.preventDefault();
      setActif(types.length - 1);
    } else if (key === 'Enter' || key === ' ') {
      evenement.preventDefault();
      if (types[actif]) choisir(types[actif].cle);
    }
  }

  return (
    <div className="champ">
      <span className="champ__label" id={`${id}-etiquette`}>
        Type d’utilisateur
      </span>
      <div
        ref={boite}
        className={`champ__boite liste-type${ouvert ? ' liste-type--ouverte' : ''}${erreur ? ' champ__boite--erreur' : ''}`}
      >
        <IconeChoisie className={`champ__icone liste-type__icone${choisi ? ` liste-type__icone--${choisi.cle}` : ''}`} />
        <button
          ref={bouton}
          type="button"
          id={`${id}-bouton`}
          className={`champ__saisie liste-type__bouton${choisi ? '' : ' liste-type__bouton--vide'}`}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={ouvert}
          aria-controls={ouvert ? idListe : undefined}
          aria-labelledby={`${id}-etiquette ${id}-bouton`}
          aria-describedby={`${id}-aide`}
          aria-invalid={erreur ? true : undefined}
          aria-activedescendant={ouvert && types[actif] ? `${idListe}-${types[actif].cle}` : undefined}
          disabled={disabled}
          onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
          onKeyDown={auClavier}
        >
          <span className="liste-type__valeur">{choisi ? choisi.libelle : invite}</span>
          <IconeChevronBas className="liste-type__chevron" />
        </button>

        {ouvert && (
          <ul id={idListe} className="liste-type__panneau" role="listbox" aria-labelledby={`${id}-etiquette`}>
            {types.map((type, i) => {
              const Icone = ICONES_TYPES[type.cle] ?? IconeGroupe;
              const pris = type.cle === valeur;
              return (
                <li
                  key={type.cle}
                  id={`${idListe}-${type.cle}`}
                  role="option"
                  aria-selected={pris}
                  className={`liste-type__option liste-type__option--${type.cle}${pris ? ' liste-type__option--prise' : ''}${
                    i === actif ? ' liste-type__option--active' : ''
                  }`}
                  style={{ '--rang': i }}
                  onPointerEnter={() => setActif(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choisir(type.cle)}
                >
                  <span className="liste-type__pastille" aria-hidden="true">
                    <Icone />
                  </span>
                  <span className="liste-type__nom">{type.libelle}</span>
                  {pris && (
                    <svg className="liste-type__coche" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="sr-only" id={`${id}-aide`}>
        {invite}
      </p>

      <select
        id={id}
        name="typeUtilisateur"
        className="sr-only"
        value={valeur}
        onChange={onChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      >
        <option value="">{invite}</option>
        {types.map((type) => (
          <option key={type.cle} value={type.cle}>
            {type.libelle}
          </option>
        ))}
      </select>

      {typeof erreur === 'string' && erreur && <p className="champ__erreur">{erreur}</p>}
    </div>
  );
}

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
