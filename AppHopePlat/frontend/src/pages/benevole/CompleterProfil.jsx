import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';

import ChoixSurPage from '../../components/ChoixSurPage.jsx';
import HopeLogo from '../../components/HopeLogo.jsx';
import {
  IconeCoche,
  IconeFleche,
  IconeFlecheGauche,
  IconeGlobe,
  IconeGroupe,
  IconeHorloge,
  IconeLangue,
  IconeMallette,
  IconeRecuCoche,
  IconeRepere,
  IconeSoleil,
  IconeTelephone,
  IconeUtilisateur,
} from '../../components/HopeIcons.jsx';
import {
  Champ as ChampParcours,
  commeUneListe,
  GROUPES_PAYS,
  numeroAffiche,
  numeroInternational,
  paysDuNumero,
  RayonsDecor,
  SelecteurIndicatif,
} from '../../components/parcours/champs.jsx';
import { messageErreur } from '../../services/api.js';
import { apiBenevole, CLE_BENEVOLE, CLE_JETON_BENEVOLE, effacerStockage } from '../../services/apiBenevole.js';
import { focusAutomatique, useEcranTelephone } from '../../utils/ecran.js';
import { PAYS, PAYS_PAR_DEFAUT, indicatifDe, nomDuPays } from '../../utils/pays.js';

/** Quatre etapes ; la cinquieme veut dire "fiche envoyee". */
const NOMBRE_ETAPES = 4;

const JOURS = [
  { cle: 'lundi', label: 'Lundi' },
  { cle: 'mardi', label: 'Mardi' },
  { cle: 'mercredi', label: 'Mercredi' },
  { cle: 'jeudi', label: 'Jeudi' },
  { cle: 'vendredi', label: 'Vendredi' },
  { cle: 'samedi', label: 'Samedi' },
  { cle: 'dimanche', label: 'Dimanche' },
];

const MOMENTS = [
  { cle: 'matin', label: 'Matin', heures: '8 h – 12 h' },
  { cle: 'apres-midi', label: 'Après-midi', heures: '12 h – 17 h' },
  { cle: 'soir', label: 'Soir', heures: 'après 17 h' },
  { cle: 'journee', label: 'Journée', heures: 'toute la journée' },
];

/**
 * Ce que HOPE a besoin de savoir faire, par famille.
 *
 * La liste n'est pas un catalogue de metiers : elle reprend ce que les
 * taches des projets demandent reellement -- servir des repas, faire du
 * soutien scolaire, traduire, tenir des comptes, photographier une
 * distribution. Cocher est plus rapide qu'ecrire, et surtout, deux
 * benevoles qui savent la meme chose l'ecrivent desormais pareil : une
 * tache se cherche alors par competence.
 *
 * "Autre" reste : aucune liste ne prevoit tout, et un savoir-faire
 * inattendu est precisement celui qu'il ne faut pas perdre.
 */
const FAMILLES_COMPETENCES = [
  {
    titre: 'Sur le terrain',
    competences: [
      'Distribution de repas',
      'Cuisine',
      'Logistique et transport',
      'Conduite',
      'Bricolage et montage',
      'Jardinage et agriculture',
      'Construction',
      'Eau et assainissement',
    ],
  },
  {
    titre: 'Enfance et éducation',
    competences: [
      'Soutien scolaire',
      'Animation d’activités',
      'Alphabétisation',
      'Formation professionnelle',
      'Encadrement de groupe',
    ],
  },
  {
    titre: 'Santé et accompagnement',
    competences: [
      'Premiers secours',
      'Soins infirmiers',
      'Écoute et soutien moral',
      'Accompagnement social',
      'Nutrition',
    ],
  },
  {
    titre: 'Communication',
    competences: [
      'Photographie',
      'Vidéo',
      'Réseaux sociaux',
      'Rédaction',
      'Traduction et interprétariat',
      'Graphisme',
    ],
  },
  {
    titre: 'Gestion et bureau',
    competences: [
      'Gestion de projet',
      'Comptabilité',
      'Secrétariat',
      'Collecte de fonds',
      'Informatique',
      'Saisie de données',
    ],
  },
];

/** Les langues qu'on entend le plus souvent sur les projets. */
const LANGUES = [
  'Malgache',
  'Français',
  'Anglais',
  'Allemand',
  'Italien',
  'Espagnol',
  'Chinois',
  'Arabe',
];

/** Les etapes, dans l'ordre : leur titre sert aussi de reperes. */
const ETAPES = [
  { titre: 'Faisons connaissance', accroche: 'Qui vous êtes, et comment l’équipe vous joint.' },
  {
    titre: 'Ce que vous savez faire',
    accroche: 'Cochez ce que vous savez faire : l’équipe vous proposera les tâches qui vont avec.',
  },
  {
    titre: 'Quand êtes-vous libre ?',
    accroche: 'Vos créneaux habituels. Rien n’est figé, vous les modifierez quand vous voudrez.',
  },
  {
    titre: 'En cas d’urgence',
    accroche: 'Qui prévenir s’il vous arrivait quelque chose pendant une mission.',
  },
];

/**
 * Le formulaire d'accueil d'un benevole, en quatre etapes.
 *
 * Il s'ouvre des l'inscription, avant meme que HOPE ne valide le
 * compte : c'est justement cette fiche -- savoir-faire, disponibilites,
 * pays -- qui permet a l'equipe de decider. Le jeton remis a
 * l'inscription ne vaut que pour elle (voir signerJetonCompletion cote
 * serveur).
 *
 * La mise en page est celle du parcours du donateur : meme progression,
 * memes champs, meme telephone en deux morceaux -- l'indicatif choisi
 * parmi tous les pays, puis le numero, verifie avant d'etre envoye.
 *
 * Une fois la fiche envoyee, le benevole ne rentre pas encore : il voit
 * un ecran qui dit ce qu'il attend, et ce qui se passera ensuite.
 */
export default function CompleterProfil() {
  const navigate = useNavigate();
  // Monte hors de la coque : un compte en attente n'a pas de contexte
  // d'espace. Un compte deja actif, lui, en a un.
  const contexte = useOutletContext() ?? {};
  const { benevole, rafraichir } = contexte;
  const surTelephone = useEcranTelephone();

  const [etape, setEtape] = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [erreurs, setErreurs] = useState({});
  const [termine, setTermine] = useState(null);

  const [champs, setChamps] = useState(() => {
    const indicatif = paysDuNumero(benevole?.telephone) ?? PAYS_PAR_DEFAUT;
    return {
      prenom: benevole?.prenom ?? '',
      nom: benevole?.nom ?? '',
      indicatif,
      telephone: numeroAffiche(benevole?.telephone, indicatif),
      dateDeNaissance: '',
      profession: '',
      adresse: '',
      pays: PAYS_PAR_DEFAUT,
      competences: [],
      autresCompetences: '',
      langues: [],
      autresLangues: '',
      disponibilites: {},
      contactUrgenceNom: '',
      contactUrgenceIndicatif: PAYS_PAR_DEFAUT,
      contactUrgenceTel: '',
    };
  });

  function modifier(nom, valeur) {
    setChamps((precedents) => ({ ...precedents, [nom]: valeur }));
    setErreurs((precedentes) => (precedentes[nom] ? { ...precedentes, [nom]: undefined } : precedentes));
  }

  /** Coche ou decoche une valeur dans une liste (competences, langues). */
  function basculer(nom, valeur) {
    setChamps((precedents) => {
      const actuelles = precedents[nom];
      return {
        ...precedents,
        [nom]: actuelles.includes(valeur)
          ? actuelles.filter((v) => v !== valeur)
          : [...actuelles, valeur],
      };
    });
    setErreurs((precedentes) => (precedentes[nom] ? { ...precedentes, [nom]: undefined } : precedentes));
  }

  /** Coche ou decoche un moment pour un jour donne. */
  function basculerDisponibilite(jour, moment) {
    setChamps((precedents) => {
      const actuels = precedents.disponibilites[jour] ?? [];
      const suivants = actuels.includes(moment)
        ? actuels.filter((m) => m !== moment)
        : [...actuels, moment];

      const disponibilites = { ...precedents.disponibilites };
      if (suivants.length === 0) delete disponibilites[jour];
      else disponibilites[jour] = suivants;

      return { ...precedents, disponibilites };
    });
  }

  /** Les erreurs de l'etape courante ; vide si l'on peut continuer. */
  function verifier(numero) {
    const trouvees = {};
    if (numero === 1) {
      if (champs.prenom.trim() === '') trouvees.prenom = 'Indiquez votre prénom.';
      if (champs.nom.trim() === '') trouvees.nom = 'Indiquez votre nom.';
      if (champs.pays === '') trouvees.pays = 'Choisissez votre pays d’origine.';
      if (champs.telephone.trim() !== '' && !numeroInternational(champs.telephone, champs.indicatif)) {
        trouvees.telephone = `Ce numéro n’est pas valide pour ${nomDuPays(
          champs.indicatif || PAYS_PAR_DEFAUT
        )} (${indicatifDe(champs.indicatif)}).`;
      }
    }
    if (numero === 2 && champs.competences.length === 0 && champs.autresCompetences.trim() === '') {
      trouvees.competences = 'Cochez au moins une compétence, ou écrivez la vôtre.';
    }
    if (numero === 4) {
      const tel = champs.contactUrgenceTel.trim();
      if (tel !== '' && !numeroInternational(tel, champs.contactUrgenceIndicatif)) {
        trouvees.contactUrgenceTel = 'Ce numéro n’est pas valide.';
      }
    }
    return trouvees;
  }

  /** Change d'etape en ramenant le haut de la page sous les yeux. */
  function allerA(numero) {
    setEtape(numero);
    setErreur('');
    const sobre = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sobre ? 'auto' : 'smooth' });
  }

  function continuer() {
    const trouvees = verifier(etape);
    if (Object.keys(trouvees).length > 0) {
      setErreurs(trouvees);
      return;
    }
    if (etape < NOMBRE_ETAPES) allerA(etape + 1);
    else envoyer();
  }

  /** Une liste libre "a, b" devient ['a', 'b'] ; les doublons tombent. */
  function listeComplete(choisies, libres) {
    const ajoutees = libres
      .split(',')
      .map((valeur) => valeur.trim())
      .filter(Boolean);
    return [...new Set([...choisies, ...ajoutees])];
  }

  async function envoyer() {
    setEnvoi(true);
    setErreur('');
    try {
      const { data } = await apiBenevole.post('/benevole/profil/completer', {
        prenom: champs.prenom.trim(),
        nom: champs.nom.trim(),
        telephone: numeroInternational(champs.telephone, champs.indicatif) ?? '',
        dateDeNaissance: champs.dateDeNaissance || null,
        profession: champs.profession.trim(),
        adresse: champs.adresse.trim(),
        pays: champs.pays,
        competences: listeComplete(champs.competences, champs.autresCompetences),
        langues: listeComplete(champs.langues, champs.autresLangues),
        disponibilites: champs.disponibilites,
        contactUrgenceNom: champs.contactUrgenceNom.trim(),
        contactUrgenceTel:
          numeroInternational(champs.contactUrgenceTel, champs.contactUrgenceIndicatif) ?? '',
      });

      /*
       * Compte deja actif : la garde relit le profil et ouvre l'espace.
       * Compte en attente : on ne rentre pas, et le jeton de completion
       * ne sert plus a rien -- on l'efface plutot que de le laisser
       * trainer dans le navigateur.
       */
      if (data.enAttente) {
        effacerStockage(CLE_JETON_BENEVOLE);
        effacerStockage(CLE_BENEVOLE);
        setTermine(data);
        window.scrollTo({ top: 0 });
      } else {
        await rafraichir?.();
        navigate('/benevole', { replace: true });
      }
    } catch (echec) {
      setErreur(messageErreur(echec, 'Votre fiche n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
    }
  }

  if (termine) return <EcranAttente message={termine.message} />;

  return (
    <div className="parcours">
      <RayonsDecor className="parcours__rayons parcours__rayons--gauche" />
      <RayonsDecor className="parcours__rayons parcours__rayons--droite" />

      <main className="parcours__colonne">
        <HopeLogo className="parcours__logo" />

        <EntetePas etape={etape} />

        {/* La cle relance l'animation d'entree a chaque changement d'etape. */}
        <div className="parcours__formulaire" key={etape}>
          {etape === 1 && (
            <EtapeVous
              champs={champs}
              erreurs={erreurs}
              envoi={envoi}
              surTelephone={surTelephone}
              modifier={modifier}
            />
          )}
          {etape === 2 && (
            <EtapeSavoirFaire
              champs={champs}
              erreurs={erreurs}
              envoi={envoi}
              basculer={basculer}
              modifier={modifier}
            />
          )}
          {etape === 3 && (
            <EtapeDisponibilites
              disponibilites={champs.disponibilites}
              envoi={envoi}
              onBasculer={basculerDisponibilite}
            />
          )}
          {etape === 4 && (
            <EtapeUrgence
              champs={champs}
              erreurs={erreurs}
              envoi={envoi}
              surTelephone={surTelephone}
              modifier={modifier}
            />
          )}

          {erreur && (
            <p className="parcours__alerte" role="alert">
              {erreur}
            </p>
          )}

          {/* La premiere etape n'a pas de retour : le bouton prend
              alors toute la largeur, comme chez le donateur. */}
          {etape === 1 ? (
            <Suivant etape={etape} envoi={envoi} onClick={continuer} />
          ) : (
            <div className="parcours__boutons">
              <button
                type="button"
                className="parcours__retour"
                onClick={() => allerA(etape - 1)}
                disabled={envoi}
              >
                <IconeFlecheGauche className="parcours__fleche-retour" />
                Retour
              </button>
              <Suivant etape={etape} envoi={envoi} onClick={continuer} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** Le bouton qui avance : "Continuer", puis "Envoyer ma fiche". */
function Suivant({ etape, envoi, onClick }) {
  return (
    <button type="button" className="parcours__continuer" onClick={onClick} disabled={envoi}>
      {envoi ? 'Envoi…' : etape === NOMBRE_ETAPES ? 'Envoyer ma fiche' : 'Continuer'}
      {!envoi && <IconeFleche className="parcours__fleche" />}
    </button>
  );
}

/* ================================================================
   Le fil des etapes
   ================================================================ */

function EntetePas({ etape }) {
  const { titre, accroche } = ETAPES[etape - 1];

  return (
    <header className="parcours__entete">
      <p className="parcours__etape">
        Étape {etape}
        <span className="sr-only"> sur {NOMBRE_ETAPES}</span>
      </p>
      <ol className="parcours__progression" aria-hidden="true">
        {Array.from({ length: NOMBRE_ETAPES }, (_, index) => (
          <li
            key={index}
            className={
              index + 1 < etape
                ? 'parcours__pas parcours__pas--fait'
                : index + 1 === etape
                  ? 'parcours__pas parcours__pas--actif'
                  : 'parcours__pas'
            }
          />
        ))}
      </ol>
      <h1 className="parcours__titre">{titre}</h1>
      <p className="parcours__accroche">{accroche}</p>
    </header>
  );
}

/** Le champ du parcours, avec le prefixe d'identifiant du benevole. */
function Champ(proprietes) {
  return <ChampParcours prefixeId="benevole" {...proprietes} />;
}

/* ================================================================
   Etape 1 : vous
   ================================================================ */

function EtapeVous({ champs, erreurs, envoi, surTelephone, modifier }) {
  // Tant qu'on ne l'a pas choisi soi-meme, l'indicatif suit le pays.
  const [indicatifChoisi, setIndicatifChoisi] = useState(false);

  function changerPays(valeur) {
    modifier('pays', valeur);
    if (!indicatifChoisi) modifier('indicatif', valeur || PAYS_PAR_DEFAUT);
  }

  return (
    <>
      <div className="parcours__paire">
        <Champ id="prenom" libelle="Prénom" erreur={erreurs.prenom} Icone={IconeUtilisateur}>
          <input
            type="text"
            value={champs.prenom}
            onChange={(e) => modifier('prenom', e.target.value)}
            disabled={envoi}
            autoComplete="given-name"
            autoFocus={focusAutomatique()}
          />
        </Champ>
        <Champ id="nom" libelle="Nom" erreur={erreurs.nom} Icone={IconeUtilisateur}>
          <input
            type="text"
            value={champs.nom}
            onChange={(e) => modifier('nom', e.target.value)}
            disabled={envoi}
            autoComplete="family-name"
          />
        </Champ>
      </div>

      <Champ
        id="pays"
        libelle="Pays d’origine"
        erreur={erreurs.pays}
        Icone={IconeGlobe}
        liste={!surTelephone}
        aide="La diaspora aide depuis l’étranger : l’équipe adapte les tâches à distance."
      >
        {surTelephone ? (
          <ChoixSurPage
            nom="Pays d’origine"
            valeur={champs.pays}
            groupes={GROUPES_PAYS}
            indiceRecherche="Chercher un pays…"
            onChoisir={commeUneListe((e) => changerPays(e.target.value))}
            disabled={envoi}
          />
        ) : (
          <select
            value={champs.pays}
            onChange={(e) => changerPays(e.target.value)}
            disabled={envoi}
          >
            <option value="">Choisissez votre pays</option>
            {PAYS.map((pays) => (
              <option key={pays.code} value={pays.code}>
                {pays.nom}
              </option>
            ))}
          </select>
        )}
      </Champ>

      <Champ
        id="telephone"
        libelle="Téléphone"
        facultatif
        erreur={erreurs.telephone}
        Icone={IconeTelephone}
        aide="L’équipe vous joint plus vite par téléphone."
        prefixe={
          <SelecteurIndicatif
            id="benevole-indicatif"
            valeur={champs.indicatif}
            onChange={(e) => {
              setIndicatifChoisi(true);
              modifier('indicatif', e.target.value);
            }}
            disabled={envoi}
            surPage={surTelephone}
          />
        }
      >
        <input
          type="tel"
          value={champs.telephone}
          onChange={(e) => modifier('telephone', e.target.value)}
          disabled={envoi}
          autoComplete="tel"
          placeholder="34 12 345 67"
          inputMode="tel"
        />
      </Champ>

      <div className="parcours__paire">
        <Champ id="dateDeNaissance" libelle="Date de naissance" facultatif Icone={IconeRecuCoche}>
          <input
            type="date"
            value={champs.dateDeNaissance}
            onChange={(e) => modifier('dateDeNaissance', e.target.value)}
            disabled={envoi}
            max={new Date().toISOString().slice(0, 10)}
          />
        </Champ>
        <Champ id="profession" libelle="Profession" facultatif Icone={IconeMallette}>
          <input
            type="text"
            value={champs.profession}
            onChange={(e) => modifier('profession', e.target.value)}
            disabled={envoi}
            placeholder="Enseignante, développeur…"
          />
        </Champ>
      </div>

      <Champ id="adresse" libelle="Où vous habitez" facultatif Icone={IconeRepere}>
        <input
          type="text"
          value={champs.adresse}
          onChange={(e) => modifier('adresse', e.target.value)}
          disabled={envoi}
          placeholder="Quartier, ville"
          autoComplete="street-address"
        />
      </Champ>
    </>
  );
}

/* ================================================================
   Etape 2 : ce que vous savez faire
   ================================================================ */

function EtapeSavoirFaire({ champs, erreurs, envoi, basculer, modifier }) {
  const choisies = champs.competences.length;

  return (
    <>
      <div className="savoirs" role="group" aria-label="Compétences">
        {FAMILLES_COMPETENCES.map((famille, rangFamille) => (
          <section className="savoirs__famille" key={famille.titre} style={{ '--rang': rangFamille }}>
            <h2 className="savoirs__titre">{famille.titre}</h2>
            <div className="savoirs__liste">
              {famille.competences.map((competence) => (
                <Puce
                  key={competence}
                  actif={champs.competences.includes(competence)}
                  onClick={() => basculer('competences', competence)}
                  disabled={envoi}
                >
                  {competence}
                </Puce>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className={`savoirs__compte${choisies > 0 ? ' savoirs__compte--rempli' : ''}`} role="status">
        {choisies === 0
          ? 'Aucune compétence choisie pour l’instant'
          : `${choisies} compétence${choisies > 1 ? 's' : ''} choisie${choisies > 1 ? 's' : ''}`}
      </p>

      <Champ
        id="autresCompetences"
        libelle="Autre compétence"
        facultatif
        erreur={erreurs.competences}
        Icone={IconeSoleil}
        aide="Ce que la liste ne propose pas. Séparez par des virgules."
      >
        <input
          type="text"
          value={champs.autresCompetences}
          onChange={(e) => modifier('autresCompetences', e.target.value)}
          disabled={envoi}
          placeholder="menuiserie, apiculture…"
        />
      </Champ>

      <section className="savoirs__famille savoirs__famille--langues">
        <h2 className="savoirs__titre">Langues que vous parlez</h2>
        <div className="savoirs__liste">
          {LANGUES.map((langue) => (
            <Puce
              key={langue}
              actif={champs.langues.includes(langue)}
              onClick={() => basculer('langues', langue)}
              disabled={envoi}
            >
              {langue}
            </Puce>
          ))}
        </div>
      </section>

      <Champ
        id="autresLangues"
        libelle="Autre langue"
        facultatif
        Icone={IconeLangue}
        aide="Séparez par des virgules."
      >
        <input
          type="text"
          value={champs.autresLangues}
          onChange={(e) => modifier('autresLangues', e.target.value)}
          disabled={envoi}
          placeholder="portugais, russe…"
        />
      </Champ>
    </>
  );
}

/** Une competence, une langue : un bouton qui se coche. */
function Puce({ actif, onClick, disabled, children }) {
  return (
    <button
      type="button"
      className={`puce-savoir${actif ? ' puce-savoir--actif' : ''}`}
      aria-pressed={actif}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="puce-savoir__coche" aria-hidden="true">
        <IconeCoche />
      </span>
      {children}
    </button>
  );
}

/* ================================================================
   Etape 3 : les disponibilites
   ================================================================ */

function EtapeDisponibilites({ disponibilites, envoi, onBasculer }) {
  const creneaux = useMemo(
    () => Object.values(disponibilites).reduce((total, moments) => total + moments.length, 0),
    [disponibilites]
  );

  return (
    <>
      <div className="dispo-parcours">
        {JOURS.map((jour, rang) => {
          const moments = disponibilites[jour.cle] ?? [];
          return (
            <div
              className={`dispo-parcours__jour${moments.length > 0 ? ' dispo-parcours__jour--pris' : ''}`}
              key={jour.cle}
              style={{ '--rang': rang }}
            >
              <span className="dispo-parcours__nom">{jour.label}</span>
              <div className="dispo-parcours__moments" role="group" aria-label={jour.label}>
                {MOMENTS.map((moment) => {
                  const actif = moments.includes(moment.cle);
                  return (
                    <button
                      key={moment.cle}
                      type="button"
                      className={`dispo-parcours__moment${actif ? ' dispo-parcours__moment--actif' : ''}`}
                      aria-pressed={actif}
                      aria-label={`${jour.label}, ${moment.label} (${moment.heures})`}
                      onClick={() => onBasculer(jour.cle, moment.cle)}
                      disabled={envoi}
                    >
                      {moment.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className={`savoirs__compte${creneaux > 0 ? ' savoirs__compte--rempli' : ''}`} role="status">
        {creneaux === 0
          ? 'Aucun créneau choisi — vous pourrez le faire plus tard'
          : `${creneaux} créneau${creneaux > 1 ? 'x' : ''} choisi${creneaux > 1 ? 's' : ''}`}
      </p>
    </>
  );
}

/* ================================================================
   Etape 4 : en cas d'urgence
   ================================================================ */

function EtapeUrgence({ champs, erreurs, envoi, surTelephone, modifier }) {
  return (
    <>
      <Champ id="contactUrgenceNom" libelle="Personne à prévenir" facultatif Icone={IconeGroupe}>
        <input
          type="text"
          value={champs.contactUrgenceNom}
          onChange={(e) => modifier('contactUrgenceNom', e.target.value)}
          disabled={envoi}
          placeholder="Son nom, et son lien avec vous"
          autoFocus={focusAutomatique()}
        />
      </Champ>

      <Champ
        id="contactUrgenceTel"
        libelle="Son téléphone"
        facultatif
        erreur={erreurs.contactUrgenceTel}
        Icone={IconeTelephone}
        prefixe={
          <SelecteurIndicatif
            id="benevole-urgence-indicatif"
            valeur={champs.contactUrgenceIndicatif}
            onChange={(e) => modifier('contactUrgenceIndicatif', e.target.value)}
            disabled={envoi}
            surPage={surTelephone}
          />
        }
      >
        <input
          type="tel"
          value={champs.contactUrgenceTel}
          onChange={(e) => modifier('contactUrgenceTel', e.target.value)}
          disabled={envoi}
          placeholder="34 12 345 67"
          inputMode="tel"
        />
      </Champ>

      <p className="parcours__note">
        Ces coordonnées ne servent qu’en cas d’accident pendant une mission. Elles restent dans le
        dossier de l’équipe HOPE.
      </p>
    </>
  );
}

/* ================================================================
   L'ecran d'attente
   ================================================================ */

/**
 * La fiche est partie : le compte attend maintenant l'equipe.
 *
 * L'ecran dit trois choses, dans cet ordre : c'est bien enregistre, ce
 * qu'il se passe maintenant, et quand revenir. Sans cela, le benevole
 * retourne a la connexion, se voit refuser l'entree, et croit s'etre
 * trompe.
 */
function EcranAttente({ message }) {
  const titre = useRef(null);

  // Le changement d'ecran n'est pas une navigation : sans ce focus, un
  // lecteur d'ecran resterait sur le bouton qui vient de disparaitre.
  useEffect(() => {
    titre.current?.focus();
  }, []);

  return (
    <div className="parcours">
      <RayonsDecor className="parcours__rayons parcours__rayons--gauche" />
      <RayonsDecor className="parcours__rayons parcours__rayons--droite" />

      <main className="parcours__colonne">
        <HopeLogo className="parcours__logo" />

        <section className="attente-benevole">
          <span className="attente-benevole__sceau" aria-hidden="true">
            <IconeHorloge />
          </span>

          <h1 className="attente-benevole__titre" ref={titre} tabIndex={-1}>
            Votre fiche est envoyée
          </h1>
          <p className="attente-benevole__message">{message}</p>

          <ol className="attente-benevole__suite">
            <li>
              <span aria-hidden="true">1</span>
              L’équipe HOPE lit votre fiche : vos compétences, vos disponibilités, votre pays.
            </li>
            <li>
              <span aria-hidden="true">2</span>
              Elle active votre compte, et vous prévient à votre adresse électronique.
            </li>
            <li>
              <span aria-hidden="true">3</span>
              Vous vous connectez, et les premières tâches vous attendent.
            </li>
          </ol>

          <Link className="parcours__continuer attente-benevole__lien" to="/authentification">
            Revenir à la connexion
            <IconeFleche className="parcours__fleche" />
          </Link>
        </section>
      </main>
    </div>
  );
}
