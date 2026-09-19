import { cloneElement, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';

import logoCartes from '../../assets/paiement/cartes-bancaires.webp';
import imageEspeces from '../../assets/paiement/especes.webp';
import logoMvola from '../../assets/paiement/mvola.webp';
import logoOrangeMoney from '../../assets/paiement/orange-money.webp';
import HopeLogo from '../../components/HopeLogo.jsx';
import ListeRecherche, { normaliser } from '../../components/ListeRecherche.jsx';
import {
  IconeChevronBas,
  IconeCoche,
  IconeCoeur,
  IconeFleche,
  IconeFlecheGauche,
  IconeGlobe,
  IconeGroupe,
  IconeCalendrierRenouvele,
  IconeHorloge,
  IconeImmeuble,
  IconeInfo,
  IconeLangue,
  IconeLecture,
  IconeLien,
  IconeMainsCoeur,
  IconeMallette,
  IconeMegaphone,
  IconePieces,
  IconePoigneeMain,
  IconeRecherche,
  IconeRecuCoche,
  IconeRepere,
  IconeSoleil,
  IconeTelephone,
  IconeUtilisateur,
} from '../../components/HopeIcons.jsx';
import {
  IllustrationDepot,
  IllustrationInternational,
  IllustrationPlateformes,
  IllustrationVirement,
} from '../../components/IllustrationsPaiement.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as donateurService from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';
import { focusAutomatique } from '../../utils/ecran.js';
import {
  decalage,
  devisePourPays,
  fuseauParDefaut,
  fuseauxDuPays,
  languePourPays,
  libelleFuseau,
  tousLesFuseaux,
  ville,
} from '../../utils/fuseaux.js';
import { PAYS, PAYS_PAR_DEFAUT, indicatifDe, nomAnglais, nomDuPays } from '../../utils/pays.js';

/** Le parcours compte cinq etapes ; la sixieme veut dire "termine". */
const NOMBRE_ETAPES = 5;

/*
 * Les listes de choix se fouillent (ListeRecherche) : deux cents pays ou
 * quatre cents fuseaux ne se parcourent pas au doigt. On les cherche en
 * francais comme en anglais -- "Allemagne" ou "Germany" --, et
 * l'indicatif par son numero, avec ou sans "+".
 */

/** Les pays, Madagascar en tete. */
const GROUPES_PAYS = [
  {
    options: PAYS.map((pays) => ({
      valeur: pays.code,
      libelle: pays.nom,
      motsCles: [nomAnglais(pays.code)],
    })),
  },
];

/** Les indicatifs : "Madagascar ... +261", a chercher par "261" ou "+261". */
const GROUPES_INDICATIF = [
  {
    options: PAYS.map((pays) => {
      const indicatif = indicatifDe(pays.code);
      return {
        valeur: pays.code,
        libelle: pays.nom,
        detail: indicatif,
        motsCles: [indicatif.slice(1), nomAnglais(pays.code)],
      };
    }),
  },
];

const nomsDeLangueEnAnglais =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'language' })
    : null;

/** "es" -> "Spanish" : une langue se cherche aussi sous son nom anglais. */
function langueEnAnglais(code) {
  try {
    return nomsDeLangueEnAnglais?.of(code) ?? '';
  } catch {
    return '';
  }
}

/**
 * Le parcours d'accueil du donateur.
 *
 * Il s'ouvre des l'inscription : informations personnelles, profil du
 * donateur, affectation du don, mode de paiement, frequence. Chaque
 * etape est enregistree en la quittant ; le serveur retient ou
 * reprendre, et un donateur qui s'arrete en chemin retrouve sa place.
 *
 * "Terminer", a la cinquieme, clot le parcours : le compte est marque
 * complet et le donateur entre dans son espace.
 *
 * "Continuer" mene toujours a l'etape suivante, meme quand on revient
 * corriger une etape deja franchie. "Retour" garde ce qu'on a saisi sur
 * la page qu'on quitte : revenir a une etape ne doit rien faire perdre.
 */
export default function Parcours() {
  const navigate = useNavigate();
  const { rafraichir } = useOutletContext();
  const { donnees, chargement, erreur } = useChargement(() => donateurService.recupererProfil(), []);

  const [etape, setEtape] = useState(null);
  // La fiche telle que le serveur l'a renvoyee apres la derniere etape :
  // revenir en arriere doit montrer ce qui vient d'etre enregistre, pas
  // ce qui avait ete lu a l'ouverture de la page.
  const [misAJour, setMisAJour] = useState(null);
  const profil = misAJour ?? donnees;
  // Ce qui a ete saisi sur une etape quittee par "Retour", sans etre
  // enregistre : on le retrouve en y revenant.
  const [brouillons, setBrouillons] = useState({});

  /** Une etape vient d'etre enregistree : on passe a la suivante. */
  async function apresEnregistrement(numero, reponse) {
    setMisAJour(reponse);
    setBrouillons((precedents) => ({ ...precedents, [numero]: undefined }));
    await rafraichir?.();
    allerA(Math.min(numero + 1, NOMBRE_ETAPES));
  }

  useEffect(() => {
    if (!donnees) return;
    if (donnees.etapeSuivante > NOMBRE_ETAPES) {
      navigate('/donateur', { replace: true });
      return;
    }
    setEtape((courante) => courante ?? donnees.etapeSuivante);
  }, [donnees, navigate]);

  /** Change d'etape en ramenant le haut de la page sous les yeux. */
  function allerA(numero) {
    setEtape(numero);
    const sobre = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sobre ? 'auto' : 'smooth' });
  }

  return (
    <div className="parcours">
      <RayonsDecor className="parcours__rayons parcours__rayons--gauche" />
      <RayonsDecor className="parcours__rayons parcours__rayons--droite" />

      <main className={`parcours__colonne${etape === 4 ? ' parcours__colonne--large' : ''}`}>
        <HopeLogo className="parcours__logo" />

        {chargement && !donnees && (
          <p className="parcours__attente" role="status">
            Préparation de votre espace…
          </p>
        )}
        {erreur && (
          <p className="parcours__alerte" role="alert">
            {erreur}
          </p>
        )}

        {/* La cle relance l'animation d'entree a chaque changement d'etape. */}
        {profil && etape === 1 && (
          <EtapeInformations
            key="etape-1"
            initiales={profil.informations}
            sources={profil.options?.sources ?? []}
            onSuivante={(reponse) => apresEnregistrement(1, reponse)}
          />
        )}
        {profil && etape === 2 && (
          <EtapeProfil
            key="etape-2"
            initiales={brouillons[2] ?? profil.profil ?? {}}
            pays={profil.informations?.pays || PAYS_PAR_DEFAUT}
            options={profil.options ?? {}}
            onRetour={(valeurs) => {
              setBrouillons((precedents) => ({ ...precedents, 2: valeurs }));
              allerA(1);
            }}
            onSuivante={(reponse) => apresEnregistrement(2, reponse)}
          />
        )}
        {profil && etape === 3 && (
          <EtapeAffectation
            key="etape-3"
            initiales={brouillons[3] ?? profil.don ?? {}}
            onRetour={(valeurs) => {
              setBrouillons((precedents) => ({ ...precedents, 3: valeurs }));
              allerA(2);
            }}
            onSuivante={(reponse) => apresEnregistrement(3, reponse)}
          />
        )}
        {profil && etape === 4 && (
          <EtapePaiement
            key="etape-4"
            initiales={brouillons[4] ?? profil.paiement ?? {}}
            pays={profil.informations?.pays || PAYS_PAR_DEFAUT}
            modes={profil.options?.modesPaiement ?? []}
            onRetour={(valeurs) => {
              setBrouillons((precedents) => ({ ...precedents, 4: valeurs }));
              allerA(3);
            }}
            onSuivante={(reponse) => apresEnregistrement(4, reponse)}
          />
        )}
        {profil && etape === 5 && (
          <EtapeFrequence
            key="etape-5"
            initiales={brouillons[5] ?? profil.frequence ?? {}}
            frequences={profil.options?.frequences ?? []}
            modePaiement={profil.paiement?.mode}
            onRetour={(valeurs) => {
              setBrouillons((precedents) => ({ ...precedents, 5: valeurs }));
              allerA(4);
            }}
            onTerminer={async () => {
              // Le parcours est clos : la garde doit relire un compte
              // desormais complet avant qu'on entre dans l'espace.
              await rafraichir?.();
              navigate('/donateur', { replace: true, state: { parcoursTermine: true } });
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ================================================================
   Etape 1 : informations personnelles
   ================================================================ */

/** Ordre des champs obligatoires : c'est aussi l'ordre du focus en erreur. */
const OBLIGATOIRES = ['nom', 'prenom', 'adresse', 'ville', 'pays', 'telephone'];

/**
 * Le numero tel qu'on l'affiche : national s'il est de l'indicatif
 * choisi, international sinon. Le serveur, lui, le garde au format
 * +261...
 */
function numeroAffiche(telephone, indicatif) {
  const numero = parsePhoneNumberFromString(telephone ?? '');
  if (!numero) return telephone ?? '';
  return numero.country === (indicatif || PAYS_PAR_DEFAUT)
    ? numero.formatNational()
    : numero.formatInternational();
}

/** Le numero saisi, au format international, ou null s'il ne vaut rien. */
function numeroInternational(saisie, indicatif) {
  const texte = String(saisie ?? '').trim();
  if (texte === '') return null;
  const code = indicatif || PAYS_PAR_DEFAUT;
  if (!isValidPhoneNumber(texte, code)) return null;
  return parsePhoneNumberFromString(texte, code)?.number ?? null;
}

/** Le pays d'un numero deja enregistre ("+33612..." -> "FR"), s'il se deduit. */
function paysDuNumero(telephone) {
  return parsePhoneNumberFromString(telephone ?? '')?.country ?? null;
}

/** Les erreurs du formulaire, champ par champ. */
function verifier(champs) {
  const erreurs = {};
  if (champs.nom.trim() === '') erreurs.nom = 'Indiquez votre nom.';
  if (champs.prenom.trim() === '') erreurs.prenom = 'Indiquez votre prénom.';
  if (champs.adresse.trim() === '') erreurs.adresse = 'Indiquez votre adresse.';
  if (champs.ville.trim() === '') erreurs.ville = 'Indiquez votre ville.';
  if (champs.pays === '') erreurs.pays = 'Choisissez votre pays.';
  if (champs.telephone.trim() === '') {
    erreurs.telephone = 'Indiquez votre numéro de téléphone.';
  } else if (!numeroInternational(champs.telephone, champs.indicatif)) {
    erreurs.telephone = `Ce numéro n’est pas valide pour ${nomDuPays(
      champs.indicatif || PAYS_PAR_DEFAUT
    )} (${indicatifDe(champs.indicatif)}).`;
  }
  if (champs.profession.length > 120) erreurs.profession = 'Au plus 120 caractères.';
  return erreurs;
}

function EtapeInformations({ initiales, sources, onSuivante }) {
  /*
   * L'indicatif est distinct du pays de residence : on peut vivre en
   * France et garder un numero malgache. Il part du numero deja
   * enregistre, a defaut du pays, a defaut de Madagascar.
   */
  const [champs, setChamps] = useState(() => {
    const indicatif = paysDuNumero(initiales.telephone) ?? (initiales.pays || PAYS_PAR_DEFAUT);
    return {
      nom: initiales.nom ?? '',
      prenom: initiales.prenom ?? '',
      adresse: initiales.adresse ?? '',
      ville: initiales.ville ?? '',
      pays: initiales.pays ?? '',
      indicatif,
      telephone: numeroAffiche(initiales.telephone, indicatif),
      profession: initiales.profession ?? '',
      source: initiales.source ?? '',
    };
  });
  // Tant qu'on ne l'a pas choisi soi-meme, l'indicatif suit le pays : on
  // n'a pas a le chercher deux fois. Une fois choisi, on le respecte.
  const [indicatifChoisi, setIndicatifChoisi] = useState(() =>
    Boolean(paysDuNumero(initiales.telephone))
  );
  // Un champ n'est juge qu'une fois quitte : on ne reproche pas a
  // quelqu'un ce qu'il est en train d'ecrire.
  const [touches, setTouches] = useState({});
  const [erreursServeur, setErreursServeur] = useState({});
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const formulaire = useRef(null);

  const erreursLocales = verifier(champs);
  const erreurDe = (champ) =>
    erreursServeur[champ] ?? ((touches[champ] || soumis) ? erreursLocales[champ] : undefined);

  function modifier(champ) {
    return (evenement) => {
      const valeur = evenement.target.value;
      setChamps((precedents) => ({ ...precedents, [champ]: valeur }));
      setErreursServeur((precedentes) => ({ ...precedentes, [champ]: undefined }));
    };
  }

  /** Un choix dans une liste : il est acheve des qu'il est fait. */
  function choisir(champ) {
    return (valeur) => {
      setChamps((precedents) => ({ ...precedents, [champ]: valeur }));
      setErreursServeur((precedentes) => ({ ...precedentes, [champ]: undefined }));
      setTouches((precedents) => ({ ...precedents, [champ]: true }));
    };
  }

  /** Le pays de residence ; l'indicatif le suit s'il n'a pas ete choisi. */
  function choisirPays(valeur) {
    choisir('pays')(valeur);
    if (!indicatifChoisi && valeur) {
      setChamps((precedents) => ({ ...precedents, indicatif: valeur }));
    }
  }

  function choisirIndicatif(valeur) {
    setIndicatifChoisi(true);
    setChamps((precedents) => ({ ...precedents, indicatif: valeur }));
    setErreursServeur((precedentes) => ({ ...precedentes, telephone: undefined }));
  }

  const groupesSources = useMemo(
    () => [{ options: sources.map((source) => ({ valeur: source.cle, libelle: source.libelle })) }],
    [sources]
  );

  function quitter(champ) {
    return () => {
      setTouches((precedents) => ({ ...precedents, [champ]: true }));
      if (champ === 'telephone') {
        // Un numero saisi avec son "+" dit lui-meme son pays : l'indicatif
        // s'y range. "+33 6 12 34 56 78" -> +33 et "06 12 34 56 78".
        const texte = champs.telephone.trim();
        const international = texte.startsWith('+')
          ? parsePhoneNumberFromString(texte)
          : null;
        if (international?.isValid() && international.country) {
          setIndicatifChoisi(true);
          setChamps((precedents) => ({
            ...precedents,
            indicatif: international.country,
            telephone: international.formatNational(),
          }));
          return;
        }
        // Un numero valide se remet en forme : 0341234567 -> 034 12 345 67.
        const valide = numeroInternational(champs.telephone, champs.indicatif);
        if (valide) {
          setChamps((precedents) => ({
            ...precedents,
            telephone: numeroAffiche(valide, precedents.indicatif),
          }));
        }
      }
    };
  }

  /** Porte le focus sur le premier champ en erreur, dans l'ordre du formulaire. */
  function focaliserPremiereErreur(erreurs) {
    const premier = [...OBLIGATOIRES, 'profession', 'source'].find((champ) => erreurs[champ]);
    if (premier) formulaire.current?.querySelector(`#donateur-${premier}`)?.focus();
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');

    const erreurs = verifier(champs);
    if (Object.keys(erreurs).length > 0) {
      focaliserPremiereErreur(erreurs);
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await donateurService.enregistrerEtape1({
        nom: champs.nom.trim(),
        prenom: champs.prenom.trim(),
        adresse: champs.adresse.trim(),
        ville: champs.ville.trim(),
        pays: champs.pays,
        telephone: numeroInternational(champs.telephone, champs.indicatif),
        profession: champs.profession.trim(),
        source: champs.source,
      });
      await onSuivante(reponse);
    } catch (echec) {
      const details = echec?.response?.data?.details ?? {};
      setErreursServeur(details);
      focaliserPremiereErreur(details);
      setRefus(messageErreur(echec, 'Vos informations n’ont pas pu être enregistrées.'));
    } finally {
      setEnvoi(false);
    }
  }

  const nbErreurs = soumis
    ? [...OBLIGATOIRES, 'profession', 'source'].filter((champ) => erreurDe(champ)).length
    : 0;

  return (
    <>
      <EntetePas
        etape={1}
        titre="Faisons connaissance"
        accroche="Complétez vos informations personnelles pour commencer."
      />

      <form
        ref={formulaire}
        className="parcours__formulaire"
        onSubmit={soumettre}
        noValidate
        aria-labelledby="parcours-section-1"
      >
        <h2 className="parcours__section" id="parcours-section-1">
          Informations personnelles
        </h2>

        <div className="parcours__paire">
          <Champ id="nom" libelle="Nom" erreur={erreurDe('nom')} Icone={IconeUtilisateur}>
            <input
              type="text"
              value={champs.nom}
              onChange={modifier('nom')}
              onBlur={quitter('nom')}
              placeholder="Votre nom"
              autoComplete="family-name"
              maxLength={80}
              disabled={envoi}
              autoFocus={focusAutomatique()}
            />
          </Champ>
          <Champ id="prenom" libelle="Prénom" erreur={erreurDe('prenom')} Icone={IconeUtilisateur}>
            <input
              type="text"
              value={champs.prenom}
              onChange={modifier('prenom')}
              onBlur={quitter('prenom')}
              placeholder="Votre prénom"
              autoComplete="given-name"
              maxLength={80}
              disabled={envoi}
            />
          </Champ>
        </div>

        <Champ id="adresse" libelle="Adresse" erreur={erreurDe('adresse')} Icone={IconeRepere}>
          <input
            type="text"
            value={champs.adresse}
            onChange={modifier('adresse')}
            onBlur={quitter('adresse')}
            placeholder="Votre adresse"
            autoComplete="street-address"
            maxLength={255}
            disabled={envoi}
          />
        </Champ>

        <div className="parcours__paire">
          <Champ id="ville" libelle="Ville" erreur={erreurDe('ville')} Icone={IconeImmeuble}>
            <input
              type="text"
              value={champs.ville}
              onChange={modifier('ville')}
              onBlur={quitter('ville')}
              placeholder="Votre ville"
              autoComplete="address-level2"
              maxLength={120}
              disabled={envoi}
            />
          </Champ>
          <Champ id="pays" libelle="Pays" erreur={erreurDe('pays')} Icone={IconeGlobe} liste>
            <ListeRecherche
              nom="Pays"
              valeur={champs.pays}
              groupes={GROUPES_PAYS}
              indice="Sélectionnez votre pays"
              indiceRecherche="Rechercher un pays…"
              onChoisir={choisirPays}
              onQuitter={quitter('pays')}
              disabled={envoi}
            />
          </Champ>
        </div>

        <Champ
          id="telephone"
          libelle="Téléphone"
          erreur={erreurDe('telephone')}
          Icone={IconeTelephone}
          prefixe={
            <SelecteurIndicatif
              valeur={champs.indicatif}
              onChoisir={choisirIndicatif}
              disabled={envoi}
            />
          }
        >
          <input
            type="tel"
            inputMode="tel"
            value={champs.telephone}
            onChange={modifier('telephone')}
            onBlur={quitter('telephone')}
            placeholder="Votre numéro de téléphone"
            autoComplete="tel-national"
            maxLength={24}
            disabled={envoi}
          />
        </Champ>

        <Champ
          id="profession"
          libelle="Profession"
          facultatif
          erreur={erreurDe('profession')}
          Icone={IconeMallette}
        >
          <input
            type="text"
            value={champs.profession}
            onChange={modifier('profession')}
            onBlur={quitter('profession')}
            placeholder="Votre profession"
            autoComplete="organization-title"
            maxLength={120}
            disabled={envoi}
          />
        </Champ>

        <Champ
          id="source"
          libelle="Comment avez-vous connu Hope ?"
          facultatif
          erreur={erreurDe('source')}
          Icone={IconeMegaphone}
          liste
        >
          <ListeRecherche
            nom="Comment avez-vous connu Hope ?"
            valeur={champs.source}
            groupes={groupesSources}
            indice="Sélectionnez une réponse"
            indiceRecherche="Rechercher une réponse…"
            onChoisir={choisir('source')}
            disabled={envoi}
          />
        </Champ>

        <button type="submit" className="parcours__continuer" disabled={envoi} aria-busy={envoi}>
          {envoi ? (
            <>
              <span className="parcours__rotation" aria-hidden="true" />
              Enregistrement…
            </>
          ) : (
            <>
              Continuer
              <IconeFleche className="parcours__fleche" />
            </>
          )}
        </button>

        {/* Sous le bouton, la ou le regard se pose apres le clic. Toujours
            present, meme vide : une zone d'alerte ajoutee apres coup
            n'est pas toujours annoncee par les lecteurs d'ecran. */}
        <p className="parcours__recap" role="alert">
          {refus ||
            (nbErreurs > 0
              ? `${nbErreurs} champ${nbErreurs > 1 ? 's demandent' : ' demande'} votre attention.`
              : '')}
        </p>
      </form>
    </>
  );
}

/* ================================================================
   Etape 2 : profil et preferences
   ================================================================ */

/** L'icone de chaque type de donateur. */
const ICONES_TYPE = {
  particulier: IconeUtilisateur,
  entreprise: IconeImmeuble,
  fondation: IconeCoeur,
  organisation: IconeGroupe,
  partenaire: IconePoigneeMain,
  international: IconeGlobe,
};

/** Le libelle de la raison sociale, selon le type de structure. */
const LIBELLE_STRUCTURE = {
  entreprise: 'Nom de l’entreprise',
  fondation: 'Nom de la fondation',
  organisation: 'Nom de l’organisation',
  partenaire: 'Nom de la structure partenaire',
};

/** Ordre des champs de l'etape : c'est aussi l'ordre du focus en erreur. */
const CHAMPS_PROFIL = ['type', 'nomStructure', 'siteWeb', 'devise', 'langue', 'fuseau'];

/**
 * Une adresse de site, completee : "hope.mg" -> "https://hope.mg".
 * Vide si rien n'est saisi, null si ce n'est pas une adresse.
 */
function siteComplet(valeur) {
  const texte = String(valeur ?? '').trim();
  if (texte === '') return '';
  const complet = /^https?:\/\//i.test(texte) ? texte : `https://${texte}`;
  try {
    const domaine = new URL(complet).hostname;
    if (!domaine.includes('.') || domaine.startsWith('.') || domaine.endsWith('.')) return null;
    return complet;
  } catch {
    return null;
  }
}

/** Les erreurs de l'etape 2, champ par champ. */
function verifierProfil(champs, types) {
  const erreurs = {};
  const type = types.find((t) => t.cle === champs.type);
  if (!type) erreurs.type = 'Choisissez votre type de donateur.';
  if (type?.structure) {
    if (champs.nomStructure.trim() === '') erreurs.nomStructure = 'Indiquez le nom de votre structure.';
    if (siteComplet(champs.siteWeb) === null) {
      erreurs.siteWeb = 'Cette adresse de site n’est pas valide.';
    }
  }
  if (!champs.devise) erreurs.devise = 'Choisissez une devise.';
  if (!champs.langue) erreurs.langue = 'Choisissez une langue.';
  if (!champs.fuseau) erreurs.fuseau = 'Choisissez un fuseau horaire.';
  return erreurs;
}

/**
 * Etape 2 : le profil du donateur et ses preferences.
 *
 * Tant qu'elle n'a jamais ete enregistree, devise, langue et fuseau sont
 * proposes d'apres le pays donne a l'etape 1 : un donateur malgache
 * trouve l'ariary, le francais et Antananarivo deja choisis. Tout reste
 * modifiable.
 *
 * La raison sociale et le site web n'apparaissent que pour une
 * structure : a un particulier, ils ne demanderaient rien d'utile.
 */
function EtapeProfil({ initiales, pays, options, onRetour, onSuivante }) {
  const types = options.types ?? [];
  const [champs, setChamps] = useState(() => ({
    type: initiales.type || 'particulier',
    nomStructure: initiales.nomStructure ?? '',
    siteWeb: initiales.siteWeb ?? '',
    devise: initiales.devise || devisePourPays(pays),
    langue: initiales.langue || languePourPays(pays),
    fuseau: initiales.fuseau || fuseauParDefaut(pays),
  }));
  const [touches, setTouches] = useState({});
  const [erreursServeur, setErreursServeur] = useState({});
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const formulaire = useRef(null);

  // Les fuseaux du pays tout de suite ; les quatre cents autres juste
  // apres l'affichage : les calculer d'emblee retarderait la page.
  const locaux = useMemo(() => fuseauxDuPays(pays), [pays]);
  const [autres, setAutres] = useState([]);
  useEffect(() => {
    const minuterie = setTimeout(() => {
      setAutres(tousLesFuseaux().filter((fuseau) => !locaux.includes(fuseau.nom)));
    }, 0);
    return () => clearTimeout(minuterie);
  }, [locaux]);

  // Un fuseau deja enregistre reste choisissable meme avant que la liste
  // complete ne soit prete.
  const fuseauHorsListe =
    Boolean(champs.fuseau) &&
    !locaux.includes(champs.fuseau) &&
    !autres.some((fuseau) => fuseau.nom === champs.fuseau);

  /*
   * Les fuseaux : ceux du pays, puis tous les autres. On les trouve par la
   * ville, le pays ou le decalage : "tana", "Madagascar", "UTC+3", "+3".
   * Ferme, le champ dit "Antananarivo (UTC+3)".
   */
  const groupesFuseaux = useMemo(() => {
    const option = (nom, code, avecPays) => {
      const ecart = decalage(nom);
      return {
        valeur: nom,
        libelle: avecPays && code ? `${ville(nom)}, ${nomDuPays(code)}` : ville(nom),
        detail: ecart,
        affichage: libelleFuseau(nom),
        motsCles: [
          nom,
          nomDuPays(code),
          nomAnglais(code),
          ecart.replace('UTC', 'GMT'),
          ecart.replace('UTC', ''),
        ],
      };
    };
    return [
      ...(fuseauHorsListe ? [{ options: [option(champs.fuseau, '', false)] }] : []),
      { libelle: nomDuPays(pays) || 'Votre pays', options: locaux.map((nom) => option(nom, pays, false)) },
      {
        libelle: 'Autres fuseaux',
        options: autres.map((fuseau) => option(fuseau.nom, fuseau.pays, true)),
      },
    ];
  }, [locaux, autres, pays, fuseauHorsListe, champs.fuseau]);

  /** Les langues ou HOPE ecrit deja, puis toutes les autres. */
  const groupesLangues = useMemo(() => {
    const langues = (options.langues ?? []).map((langue) => ({
      valeur: langue.cle,
      libelle: langue.libelle,
      motsCles: [langue.cle, langueEnAnglais(langue.cle)],
      courante: langue.courante,
    }));
    return [
      { libelle: 'Les plus courantes', options: langues.filter((langue) => langue.courante) },
      { libelle: 'Toutes les langues', options: langues.filter((langue) => !langue.courante) },
    ];
  }, [options.langues]);

  const groupesDevises = useMemo(
    () => [
      {
        options: (options.devises ?? []).map((devise) => ({
          valeur: devise.code,
          libelle: `${devise.code} · ${devise.libelle}`,
        })),
      },
    ],
    [options.devises]
  );

  const typeChoisi = types.find((t) => t.cle === champs.type);
  const estStructure = Boolean(typeChoisi?.structure);

  const erreursLocales = verifierProfil(champs, types);
  const erreurDe = (champ) =>
    erreursServeur[champ] ?? ((touches[champ] || soumis) ? erreursLocales[champ] : undefined);

  function modifier(champ) {
    return (evenement) => {
      const valeur = evenement.target.value;
      setChamps((precedents) => ({ ...precedents, [champ]: valeur }));
      setErreursServeur((precedentes) => ({ ...precedentes, [champ]: undefined }));
    };
  }

  /** Un choix dans une liste : il est acheve des qu'il est fait. */
  function choisir(champ) {
    return (valeur) => {
      setChamps((precedents) => ({ ...precedents, [champ]: valeur }));
      setErreursServeur((precedentes) => ({ ...precedentes, [champ]: undefined }));
      setTouches((precedents) => ({ ...precedents, [champ]: true }));
    };
  }

  function quitter(champ) {
    return () => {
      setTouches((precedents) => ({ ...precedents, [champ]: true }));
      // "hope.mg" se complete en "https://hope.mg" des qu'on quitte le champ.
      if (champ === 'siteWeb') {
        const complet = siteComplet(champs.siteWeb);
        if (complet) setChamps((precedents) => ({ ...precedents, siteWeb: complet }));
      }
    };
  }

  function choisirType(evenement) {
    const valeur = evenement.target.value;
    setChamps((precedents) => ({ ...precedents, type: valeur }));
    setErreursServeur((precedentes) => ({
      ...precedentes,
      type: undefined,
      nomStructure: undefined,
      siteWeb: undefined,
    }));
  }

  function focaliserPremiereErreur(erreurs) {
    const premier = CHAMPS_PROFIL.find((champ) => erreurs[champ]);
    if (!premier) return;
    const cible =
      premier === 'type'
        ? formulaire.current?.querySelector('input[name="type"]')
        : formulaire.current?.querySelector(`#donateur-${premier}`);
    cible?.focus();
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');

    const erreurs = verifierProfil(champs, types);
    if (Object.keys(erreurs).length > 0) {
      focaliserPremiereErreur(erreurs);
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await donateurService.enregistrerEtape2({
        type: champs.type,
        nomStructure: estStructure ? champs.nomStructure.trim() : '',
        siteWeb: estStructure ? siteComplet(champs.siteWeb) || '' : '',
        devise: champs.devise,
        langue: champs.langue,
        fuseau: champs.fuseau,
      });
      await onSuivante(reponse);
    } catch (echec) {
      const details = echec?.response?.data?.details ?? {};
      setErreursServeur(details);
      focaliserPremiereErreur(details);
      setRefus(messageErreur(echec, 'Votre profil n’a pas pu être enregistré.'));
    } finally {
      setEnvoi(false);
    }
  }

  const nbErreurs = soumis ? CHAMPS_PROFIL.filter((champ) => erreurDe(champ)).length : 0;

  return (
    <>
      <EntetePas
        etape={2}
        titre="Votre profil donateur"
        accroche="Personnalisez votre profil et vos préférences."
      />

      <form
        ref={formulaire}
        className="parcours__formulaire"
        onSubmit={soumettre}
        noValidate
        aria-labelledby="parcours-section-2"
      >
        <h2 className="parcours__section" id="parcours-section-2">
          Profil et préférences
        </h2>

        {/* Un groupe de boutons radio : les fleches du clavier passent
            d'une carte a l'autre, comme dans toute liste de choix. */}
        <fieldset className="parcours__groupe" aria-describedby="donateur-type-aide">
          <legend className="parcours__libelle">Type de donateur</legend>
          <div className="parcours__types">
            {types.map((type) => {
              const Icone = ICONES_TYPE[type.cle] ?? IconeUtilisateur;
              const choisi = champs.type === type.cle;
              return (
                <label
                  key={type.cle}
                  className={`parcours__type${choisi ? ' parcours__type--choisi' : ''}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={type.cle}
                    checked={choisi}
                    onChange={choisirType}
                    disabled={envoi}
                    className="parcours__type-radio"
                  />
                  <span className="parcours__type-coche" aria-hidden="true">
                    <IconeCoche />
                  </span>
                  <Icone className="parcours__type-icone" />
                  <span className="parcours__type-nom">{type.libelle}</span>
                </label>
              );
            })}
          </div>
          {/* Ce que le type implique, dit a mesure qu'on le choisit. */}
          <p className="parcours__aide" id="donateur-type-aide" aria-live="polite">
            {typeChoisi?.description ?? ''}
          </p>
          {erreurDe('type') && <p className="parcours__erreur">{erreurDe('type')}</p>}
        </fieldset>

        {estStructure && (
          <div className="parcours__revele">
            <Champ
              id="nomStructure"
              libelle={LIBELLE_STRUCTURE[champs.type] ?? 'Nom de la structure'}
              erreur={erreurDe('nomStructure')}
              aide="Il figurera sur vos reçus de don."
              Icone={IconeImmeuble}
            >
              <input
                type="text"
                value={champs.nomStructure}
                onChange={modifier('nomStructure')}
                onBlur={quitter('nomStructure')}
                placeholder="Raison sociale"
                autoComplete="organization"
                maxLength={200}
                disabled={envoi}
              />
            </Champ>

            <Champ
              id="siteWeb"
              libelle="Site web"
              facultatif
              erreur={erreurDe('siteWeb')}
              Icone={IconeLien}
            >
              <input
                type="url"
                inputMode="url"
                value={champs.siteWeb}
                onChange={modifier('siteWeb')}
                onBlur={quitter('siteWeb')}
                placeholder="https://votre-site.com"
                autoComplete="url"
                maxLength={255}
                disabled={envoi}
              />
            </Champ>
          </div>
        )}

        <div className="parcours__paire">
          <Champ
            id="devise"
            libelle="Devise préférée"
            erreur={erreurDe('devise')}
            Icone={IconePieces}
            liste
          >
            <ListeRecherche
              nom="Devise préférée"
              valeur={champs.devise}
              groupes={groupesDevises}
              onChoisir={choisir('devise')}
              onQuitter={quitter('devise')}
              disabled={envoi}
            />
          </Champ>

          <Champ id="langue" libelle="Langue" erreur={erreurDe('langue')} Icone={IconeLangue} liste>
            {/* Cent soixante-dix langues : on tape "esp", "español" ou
                "Spanish" plutot que de les faire defiler. */}
            <ListeRecherche
              nom="Langue"
              valeur={champs.langue}
              groupes={groupesLangues}
              indiceRecherche="Rechercher une langue…"
              onChoisir={choisir('langue')}
              onQuitter={quitter('langue')}
              disabled={envoi}
            />
          </Champ>
        </div>

        <Champ
          id="fuseau"
          libelle="Fuseau horaire"
          erreur={erreurDe('fuseau')}
          aide="Défini automatiquement selon votre pays. Vous pouvez le modifier."
          Icone={IconeHorloge}
          liste
        >
          <ListeRecherche
            nom="Fuseau horaire"
            valeur={champs.fuseau}
            groupes={groupesFuseaux}
            indiceRecherche="Ville, pays ou décalage (UTC+3)…"
            onChoisir={choisir('fuseau')}
            onQuitter={quitter('fuseau')}
            disabled={envoi}
          />
        </Champ>

        <div className="parcours__boutons">
          <button
            type="button"
            className="parcours__retour"
            onClick={() => onRetour(champs)}
            disabled={envoi}
          >
            <IconeFlecheGauche className="parcours__fleche-retour" />
            Retour
          </button>
          <button type="submit" className="parcours__continuer" disabled={envoi} aria-busy={envoi}>
            {envoi ? (
              <>
                <span className="parcours__rotation" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                Continuer
                <IconeFleche className="parcours__fleche" />
              </>
            )}
          </button>
        </div>

        <p className="parcours__recap" role="alert">
          {refus ||
            (nbErreurs > 0
              ? `${nbErreurs} champ${nbErreurs > 1 ? 's demandent' : ' demande'} votre attention.`
              : '')}
        </p>
      </form>
    </>
  );
}

/* ================================================================
   Etape 3 : l'affectation du don
   ================================================================ */

/** Les deux facons d'affecter un don : le vocabulaire de donations.allocation. */
const MODES_AFFECTATION = [
  {
    cle: 'PROJECT',
    titre: 'Don affecté',
    texte: 'Soutenez un projet précis, parmi ceux qui sont en cours.',
    Illustration: IconeMainsCoeur,
  },
  {
    cle: 'HOPE',
    titre: 'Don non affecté',
    texte: 'Laissez HOPE utiliser votre don pour un ou plusieurs projets de son choix.',
    Illustration: IconePoigneeMain,
  },
];

/**
 * Etape 3 : l'affectation du don.
 *
 * Le modele proposait une liste deroulante et la fiche du seul projet
 * choisi. Les projets sont ici des cartes que l'on compare d'un regard :
 * image, lieu, jauge, ce qu'il reste a reunir. Ceux qui ont le plus
 * besoin de soutien viennent d'abord ; un projet deja finance reste
 * visible -- il dit ce que les dons ont permis -- mais ne se choisit plus.
 */
function EtapeAffectation({ initiales, onRetour, onSuivante }) {
  const { donnees: liste, chargement, erreur: erreurListe } = useChargement(
    () => donateurService.listerProjets(),
    []
  );
  const projets = liste?.items ?? [];

  const [choix, setChoix] = useState(() => ({
    affectation: initiales.affectation || 'PROJECT',
    projetId: initiales.projetId ?? null,
  }));
  const [recherche, setRecherche] = useState('');
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurServeur, setErreurServeur] = useState('');
  const [refus, setRefus] = useState('');
  const formulaire = useRef(null);

  const affecte = choix.affectation === 'PROJECT';
  const projetChoisi = projets.find((projet) => projet.id === choix.projetId);

  // Un projet choisi naguere, puis finance ou retire depuis, ne compte plus.
  const projetValable = projetChoisi && !projetChoisi.atteint;
  const erreurProjet =
    erreurServeur ||
    (soumis && affecte && !chargement && !projetValable
      ? 'Choisissez le projet que vous voulez soutenir.'
      : '');

  // Au-dela de six projets, une recherche aide a trouver le sien.
  const avecRecherche = projets.length > 6;
  const visibles = recherche.trim()
    ? projets.filter((projet) =>
        normaliser(`${projet.nom} ${projet.lieu} ${projet.categorie}`).includes(normaliser(recherche))
      )
    : projets;

  const ouverts = projets.filter((projet) => !projet.atteint);
  const memeDevise = ouverts.every((projet) => projet.devise === (ouverts[0]?.devise ?? 'MGA'));
  const resteTotal = ouverts.reduce((somme, projet) => somme + Number(projet.restant ?? 0), 0);

  function choisirMode(evenement) {
    const valeur = evenement.target.value;
    setChoix((precedent) => ({ ...precedent, affectation: valeur }));
    setErreurServeur('');
  }

  function choisirProjet(evenement) {
    const identifiant = Number(evenement.target.value);
    setChoix((precedent) => ({ ...precedent, projetId: identifiant }));
    setErreurServeur('');
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');

    if (affecte && !projetValable) {
      formulaire.current?.querySelector('input[name="projet"]:not(:disabled)')?.focus();
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await donateurService.enregistrerEtape3({
        affectation: choix.affectation,
        projetId: affecte ? choix.projetId : null,
      });
      await onSuivante(reponse);
    } catch (echec) {
      const details = echec?.response?.data?.details ?? {};
      setErreurServeur(details.projetId ?? '');
      setRefus(messageErreur(echec, 'Votre choix n’a pas pu être enregistré.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <EntetePas
        etape={3}
        titre="Affectation de votre don"
        accroche="Choisissez comment votre don sera utilisé."
      />

      <form
        ref={formulaire}
        className="parcours__formulaire"
        onSubmit={soumettre}
        noValidate
        aria-label="Affectation de votre don"
      >
        {/* Deux grandes cartes : un vrai groupe de boutons radio. */}
        <fieldset className="parcours__groupe">
          <legend className="sr-only">Comment votre don sera-t-il utilisé ?</legend>
          <div className="parcours__modes">
            {MODES_AFFECTATION.map(({ cle, titre, texte, Illustration }) => {
              const choisi = choix.affectation === cle;
              return (
                <label
                  key={cle}
                  className={`parcours__mode${choisi ? ' parcours__mode--choisi' : ''}`}
                >
                  <input
                    type="radio"
                    name="affectation"
                    value={cle}
                    checked={choisi}
                    onChange={choisirMode}
                    disabled={envoi}
                    className="parcours__type-radio"
                    aria-describedby={`donateur-mode-${cle}`}
                  />
                  <span className="parcours__rond" aria-hidden="true" />
                  <Illustration className="parcours__mode-illustration" />
                  <span className="parcours__mode-titre">{titre}</span>
                  <span className="parcours__mode-texte" id={`donateur-mode-${cle}`}>
                    {texte}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {affecte ? (
          <fieldset
            className="parcours__groupe parcours__revele"
            key="projets"
            aria-describedby="donateur-projets-aide"
          >
            <legend className="parcours__libelle">Choisissez un projet</legend>

            {avecRecherche && (
              <div className="parcours__boite parcours__recherche">
                <IconeRecherche className="parcours__icone" />
                <input
                  type="search"
                  className="parcours__saisie"
                  value={recherche}
                  onChange={(evenement) => setRecherche(evenement.target.value)}
                  placeholder="Rechercher un projet, une ville…"
                  aria-label="Rechercher un projet"
                />
              </div>
            )}

            {erreurListe && <p className="parcours__erreur">{erreurListe}</p>}

            <div className="parcours__projets">
              {chargement && !liste
                ? [0, 1, 2].map((index) => (
                    <div key={index} className="parcours__projet parcours__projet--squelette" aria-hidden="true">
                      <span className="parcours__projet-visuel" />
                      <span className="parcours__projet-corps">
                        <span className="parcours__squelette parcours__squelette--court" />
                        <span className="parcours__squelette" />
                        <span className="parcours__squelette parcours__squelette--jauge" />
                      </span>
                    </div>
                  ))
                : visibles.map((projet) => (
                    <CarteProjet
                      key={projet.id}
                      projet={projet}
                      choisi={choix.projetId === projet.id}
                      onChange={choisirProjet}
                      disabled={envoi}
                    />
                  ))}
              {!chargement && avecRecherche && visibles.length === 0 && (
                <p className="parcours__aide">Aucun projet ne correspond à « {recherche} ».</p>
              )}
            </div>

            <p className="parcours__aide" id="donateur-projets-aide">
              Seuls les projets en cours sont proposés, ceux qui ont le plus besoin de soutien en
              premier.
            </p>
            {erreurProjet && <p className="parcours__erreur">{erreurProjet}</p>}
          </fieldset>
        ) : (
          <div className="parcours__fonds parcours__revele" key="fonds">
            <IconeSoleil className="parcours__fonds-soleil" />
            <div>
              <p className="parcours__fonds-titre">
                HOPE place votre don là où le besoin est le plus grand
              </p>
              <p className="parcours__fonds-texte">
                Votre don rejoint le fonds de HOPE, que l’équipe répartit entre ses projets en
                cours selon leurs besoins.
              </p>
              {ouverts.length > 0 && (
                <ul className="parcours__fonds-chiffres">
                  <li>
                    <strong>{ouverts.length}</strong>
                    projet{ouverts.length > 1 ? 's cherchent' : ' cherche'} encore un financement
                  </li>
                  {memeDevise && (
                    <li>
                      <strong>{fmt.montant(resteTotal, ouverts[0]?.devise)}</strong>
                      restent à réunir
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="parcours__boutons">
          <button
            type="button"
            className="parcours__retour"
            onClick={() => onRetour(choix)}
            disabled={envoi}
          >
            <IconeFlecheGauche className="parcours__fleche-retour" />
            Retour
          </button>
          <button type="submit" className="parcours__continuer" disabled={envoi} aria-busy={envoi}>
            {envoi ? (
              <>
                <span className="parcours__rotation" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                Continuer
                <IconeFleche className="parcours__fleche" />
              </>
            )}
          </button>
        </div>

        <p className="parcours__recap" role="alert">
          {refus || (erreurProjet ? 'Choisissez un projet pour continuer.' : '')}
        </p>
      </form>
    </>
  );
}

/**
 * Un projet, tel qu'un donateur le compare : image, categorie, lieu, nom,
 * accroche, jauge et ce qu'il reste a reunir. Le bouton radio couvre la
 * carte ; son nom accessible dit l'essentiel en une phrase.
 */
function CarteProjet({ projet, choisi, onChange, disabled }) {
  const taux = Math.min(100, Math.max(0, Number(projet.taux ?? 0)));
  const nomAccessible = projet.atteint
    ? `${projet.nom} : objectif atteint, ne peut plus être choisi`
    : `${projet.nom} : ${fmt.montant(projet.restant, projet.devise)} restant à financer, ${fmt.pourcent(taux)} financé`;

  return (
    <label
      className={`parcours__projet${choisi ? ' parcours__projet--choisi' : ''}${
        projet.atteint ? ' parcours__projet--atteint' : ''
      }`}
    >
      <input
        type="radio"
        name="projet"
        value={projet.id}
        checked={choisi}
        onChange={onChange}
        disabled={disabled || projet.atteint}
        className="parcours__type-radio"
        aria-label={nomAccessible}
      />

      <span className="parcours__projet-visuel" aria-hidden="true">
        {projet.image ? (
          <img src={urlMedia(projet.image)} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="parcours__projet-substitut">
            {projet.video ? <IconeLecture /> : <IconeCoeur />}
          </span>
        )}
      </span>

      <span className="parcours__projet-corps" aria-hidden="true">
        <span className="parcours__projet-meta">
          {projet.categorie && <span className="parcours__puce">{projet.categorie}</span>}
          {projet.lieu && (
            <span className="parcours__projet-lieu">
              <IconeRepere />
              {projet.lieu}
            </span>
          )}
        </span>
        <span className="parcours__projet-nom">{projet.nom}</span>
        {projet.accroche && <span className="parcours__projet-accroche">{projet.accroche}</span>}
        <span className="parcours__jauge">
          <span style={{ '--taux': `${taux}%` }} />
        </span>
        <span className="parcours__projet-chiffres">
          {projet.atteint ? (
            <span>
              <strong>Objectif atteint</strong> · {fmt.montant(projet.objectif, projet.devise)}{' '}
              réunis
            </span>
          ) : (
            <span>
              <strong>{fmt.montant(projet.restant, projet.devise)}</strong> restant à financer
            </span>
          )}
          <span>
            {fmt.pourcent(taux)} · {fmt.montant(projet.collecte, projet.devise)} sur{' '}
            {fmt.montant(projet.objectif, projet.devise)}
          </span>
        </span>
      </span>

      {projet.atteint ? (
        <span className="parcours__badge-atteint" aria-hidden="true">
          <IconeCoche />
          Financé
        </span>
      ) : (
        <span className="parcours__rond" aria-hidden="true" />
      )}
    </label>
  );
}

/* ================================================================
   Etape 4 : le mode de paiement
   ================================================================ */

/**
 * Le visuel de chaque moyen : son logo quand il a une marque que l'on
 * reconnait, une illustration au trait de la charte sinon.
 */
const VISUELS_PAIEMENT = {
  mvola: { image: logoMvola },
  orange_money: { image: logoOrangeMoney },
  virement_bancaire: { Illustration: IllustrationVirement },
  depot_bancaire: { Illustration: IllustrationDepot },
  especes: { image: imageEspeces },
  carte_bancaire: { image: logoCartes },
  virement_international: { Illustration: IllustrationInternational },
  plateforme: { Illustration: IllustrationPlateformes },
};

/**
 * Etape 4 : le mode de paiement.
 *
 * Huit cartes, dans l'ordre du modele : les moyens de Madagascar, puis
 * ceux de l'etranger. Pour un donateur qui vit hors de Madagascar, ces
 * derniers passent devant -- MVola ne lui est guere utile en premier.
 *
 * Rien n'est coche d'avance : un moyen de paiement se choisit, il ne se
 * subit pas. Le choix fait, une phrase dit ce qu'il suppose.
 */
function EtapePaiement({ initiales, pays, modes, onRetour, onSuivante }) {
  const depuisEtranger = Boolean(pays) && pays !== 'MG';
  const ordonnes = depuisEtranger
    ? [...modes.filter((m) => m.zone === 'international'), ...modes.filter((m) => m.zone !== 'international')]
    : modes;

  const [mode, setMode] = useState(initiales.mode || '');
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const formulaire = useRef(null);

  const choisi = modes.find((m) => m.cle === mode);
  const erreur = soumis && !choisi ? 'Choisissez votre moyen de paiement.' : '';

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');

    if (!choisi) {
      formulaire.current?.querySelector('input[name="paiement"]')?.focus();
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await donateurService.enregistrerEtape4({ mode });
      await onSuivante(reponse);
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre choix n’a pas pu être enregistré.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <EntetePas
        etape={4}
        titre="Mode de paiement"
        accroche="Choisissez votre moyen de paiement pour poursuivre votre don."
      />

      <form
        ref={formulaire}
        className="parcours__formulaire"
        onSubmit={soumettre}
        noValidate
        aria-label="Mode de paiement"
      >
        <fieldset className="parcours__groupe" aria-describedby="donateur-paiement-aide">
          <legend className="parcours__section parcours__section--legende">Type de paiement</legend>

          <div className="parcours__paiements">
            {ordonnes.map((moyen) => {
              const visuel = VISUELS_PAIEMENT[moyen.cle] ?? {};
              const actif = mode === moyen.cle;
              return (
                <label
                  key={moyen.cle}
                  className={`parcours__paiement${actif ? ' parcours__paiement--choisi' : ''}`}
                >
                  <input
                    type="radio"
                    name="paiement"
                    value={moyen.cle}
                    checked={actif}
                    onChange={() => {
                      setMode(moyen.cle);
                      setRefus('');
                    }}
                    disabled={envoi}
                    className="parcours__type-radio"
                  />
                  <span className="parcours__rond" aria-hidden="true" />
                  <span className="parcours__paiement-visuel" aria-hidden="true">
                    {visuel.image ? (
                      <img src={visuel.image} alt="" decoding="async" />
                    ) : (
                      visuel.Illustration && <visuel.Illustration />
                    )}
                  </span>
                  <span className="parcours__paiement-nom">{moyen.libelle}</span>
                </label>
              );
            })}
          </div>

          {/* Ce que le moyen choisi suppose, dit a mesure qu'on le choisit. */}
          <p className="parcours__aide parcours__paiement-aide" id="donateur-paiement-aide" aria-live="polite">
            {choisi
              ? choisi.description
              : depuisEtranger
                ? 'Les moyens utilisables depuis l’étranger sont proposés en premier.'
                : 'Choisissez le moyen que vous utiliserez pour ce don.'}
          </p>
          {erreur && <p className="parcours__erreur">{erreur}</p>}
        </fieldset>

        <hr className="parcours__separateur" />

        <div className="parcours__boutons">
          <button
            type="button"
            className="parcours__retour"
            onClick={() => onRetour({ mode })}
            disabled={envoi}
          >
            <IconeFlecheGauche className="parcours__fleche-retour" />
            Retour
          </button>
          <button type="submit" className="parcours__continuer" disabled={envoi} aria-busy={envoi}>
            {envoi ? (
              <>
                <span className="parcours__rotation" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                Continuer
                <IconeFleche className="parcours__fleche" />
              </>
            )}
          </button>
        </div>

        <p className="parcours__recap" role="alert">
          {refus || (erreur ? 'Choisissez un moyen de paiement pour continuer.' : '')}
        </p>
      </form>
    </>
  );
}

/* ================================================================
   Etape 5 : la frequence du don
   ================================================================ */

/** L'illustration de chaque frequence. */
const ILLUSTRATIONS_FREQUENCE = {
  ONE_TIME: IconeRecuCoche,
  MONTHLY: IconeCalendrierRenouvele,
};

/**
 * Le moyen de paiement tel qu'on le dit dans une phrase : "par MVola",
 * "en especes", "par carte bancaire".
 */
const MOYEN_DANS_UNE_PHRASE = {
  mvola: 'par MVola',
  orange_money: 'par Orange Money',
  virement_bancaire: 'par virement bancaire',
  depot_bancaire: 'par dépôt bancaire',
  especes: 'en espèces',
  carte_bancaire: 'par carte bancaire',
  virement_international: 'par virement international',
  plateforme: 'sur une plateforme de paiement',
};

/**
 * Etape 5 : la frequence du don, et la fin du parcours.
 *
 * Le modele annoncait "Votre premier don est deja paye" : c'est faux --
 * aucun paiement n'a lieu pendant ce parcours. L'encart dit donc ce qui
 * est vrai : rien n'est preleve ici, et comment le don sera regle.
 *
 * Le don ponctuel est retenu d'avance, comme dans le modele : il
 * n'engage a rien au-dela d'un versement.
 */
function EtapeFrequence({ initiales, frequences, modePaiement, onRetour, onTerminer }) {
  const [frequence, setFrequence] = useState(initiales.valeur || 'ONE_TIME');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  const moyen = MOYEN_DANS_UNE_PHRASE[modePaiement];
  const information =
    frequence === 'MONTHLY'
      ? `Rien n’est prélevé à cette étape. Votre don sera réglé chaque mois${moyen ? ` ${moyen}` : ''}.`
      : `Rien n’est prélevé à cette étape. Votre don sera réglé en une seule fois${moyen ? ` ${moyen}` : ''}.`;

  async function soumettre(evenement) {
    evenement.preventDefault();
    setRefus('');
    setEnvoi(true);
    try {
      const reponse = await donateurService.enregistrerEtape5({ frequence });
      await onTerminer(reponse);
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre choix n’a pas pu être enregistré.'));
      setEnvoi(false);
    }
  }

  return (
    <>
      <EntetePas
        etape={5}
        titre="Fréquence de votre don"
        accroche="Souhaitez-vous renouveler votre soutien chaque mois ?"
      />

      <form className="parcours__formulaire" onSubmit={soumettre} noValidate aria-label="Fréquence de votre don">
        <fieldset className="parcours__groupe">
          <legend className="sr-only">Fréquence de votre don</legend>
          <div className="parcours__modes">
            {frequences.map((option) => {
              const Illustration = ILLUSTRATIONS_FREQUENCE[option.cle] ?? IconeRecuCoche;
              const choisi = frequence === option.cle;
              return (
                <label
                  key={option.cle}
                  className={`parcours__mode${choisi ? ' parcours__mode--choisi' : ''}`}
                >
                  <input
                    type="radio"
                    name="frequence"
                    value={option.cle}
                    checked={choisi}
                    onChange={() => setFrequence(option.cle)}
                    disabled={envoi}
                    className="parcours__type-radio"
                    aria-describedby={`donateur-frequence-${option.cle}`}
                  />
                  <span className="parcours__rond" aria-hidden="true" />
                  <Illustration className="parcours__mode-illustration" />
                  <span className="parcours__mode-titre">{option.libelle}</span>
                  <span className="parcours__mode-texte" id={`donateur-frequence-${option.cle}`}>
                    {option.texte}
                    <span className="parcours__mode-detail">{option.detail}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Ce que le choix engage, dit a mesure qu'on le fait. */}
        <p className="parcours__info" aria-live="polite">
          <IconeInfo className="parcours__info-icone" />
          <span>{information}</span>
        </p>

        <hr className="parcours__separateur" />

        <div className="parcours__boutons">
          <button
            type="button"
            className="parcours__retour"
            onClick={() => onRetour({ valeur: frequence })}
            disabled={envoi}
          >
            <IconeFlecheGauche className="parcours__fleche-retour" />
            Retour
          </button>
          <button type="submit" className="parcours__continuer" disabled={envoi} aria-busy={envoi}>
            {envoi ? (
              <>
                <span className="parcours__rotation" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                Terminer
                <IconeFleche className="parcours__fleche" />
              </>
            )}
          </button>
        </div>

        <p className="parcours__recap" role="alert">
          {refus}
        </p>
      </form>
    </>
  );
}

/* ================================================================
   Pieces communes
   ================================================================ */

/**
 * L'en-tete d'une etape : son numero, sa progression, son titre.
 *
 * La barre sous "Etape 1" compte les cinq etapes : on sait ou l'on est,
 * et combien il en reste, sans avoir a le lire.
 */
function EntetePas({ etape, titre, accroche }) {
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

/**
 * Un champ : libelle, icone, saisie, erreur.
 *
 * La saisie arrive en enfant ; ce composant lui donne son id, et la
 * relie a son message d'erreur pour les lecteurs d'ecran.
 */
function Champ({
  id,
  libelle,
  facultatif = false,
  erreur,
  aide,
  Icone,
  prefixe,
  liste = false,
  children,
}) {
  const identifiant = `donateur-${id}`;
  const idErreur = `${identifiant}-erreur`;
  const idAide = `${identifiant}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');
  const saisie = cloneElement(children, {
    id: identifiant,
    name: id,
    className: 'parcours__saisie',
    'aria-invalid': Boolean(erreur),
    'aria-describedby': decrit || undefined,
    'aria-required': facultatif ? undefined : true,
  });

  return (
    <div className={`parcours__champ${erreur ? ' parcours__champ--erreur' : ''}`}>
      <label className="parcours__libelle" htmlFor={identifiant}>
        {libelle}
        {facultatif && <span className="parcours__facultatif">facultatif</span>}
      </label>
      <div className={`parcours__boite${prefixe ? ' parcours__boite--prefixe' : ''}`}>
        <Icone className="parcours__icone" />
        {prefixe && <div className="parcours__prefixe">{prefixe}</div>}
        {saisie}
        {liste && <IconeChevronBas className="parcours__chevron" />}
      </div>
      {erreur ? (
        <p className="parcours__erreur" id={idErreur}>
          {erreur}
        </p>
      ) : (
        aide && (
          <p className="parcours__aide" id={idAide}>
            {aide}
          </p>
        )
      )}
    </div>
  );
}

/**
 * L'indicatif du telephone : tous les pays, Madagascar en tete.
 *
 * Replie, il ne montre que "+261" : le nom du pays ne tiendrait pas
 * devant le numero. Ouvert, c'est une liste "Pays ... +indicatif" que
 * l'on fouille par le pays ou par le numero : "Maurice", "Mauritius",
 * "230" ou "+230".
 */
function SelecteurIndicatif({ valeur, onChoisir, disabled }) {
  return (
    <ListeRecherche
      id="donateur-indicatif"
      className="parcours__indicatif"
      classePanneau="parcours__indicatif-panneau"
      nom="Indicatif téléphonique"
      aria-label="Indicatif téléphonique"
      valeur={valeur}
      groupes={GROUPES_INDICATIF}
      indiceRecherche="Pays ou indicatif, par ex. +261…"
      onChoisir={onChoisir}
      disabled={disabled}
      rendu={(option) => (
        <>
          <span className="parcours__indicatif-code" aria-hidden="true">
            {indicatifDe(valeur)}
          </span>
          {/* Le numero seul ne dit rien a l'oreille : on nomme le pays. */}
          <span className="sr-only">
            {option?.libelle ?? nomDuPays(valeur)} {indicatifDe(valeur)}
          </span>
          <IconeChevronBas className="parcours__indicatif-chevron" />
        </>
      )}
    />
  );
}

/**
 * Les rayons du soleil HOPE, en filigrane dans les coins bas de la page.
 * Purement decoratifs.
 */
function RayonsDecor({ className }) {
  return (
    <svg className={className} viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <circle cx="120" cy="240" r="62" />
      <g strokeLinecap="round" strokeWidth="22">
        <line x1="120" y1="150" x2="120" y2="96" />
        <line x1="62" y1="176" x2="30" y2="140" />
        <line x1="178" y1="176" x2="210" y2="140" />
        <line x1="40" y1="228" x2="4" y2="214" />
        <line x1="200" y1="228" x2="236" y2="214" />
      </g>
    </svg>
  );
}
