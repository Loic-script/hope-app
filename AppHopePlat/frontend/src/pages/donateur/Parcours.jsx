import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import ChoixSurPage, { parLettre } from '../../components/ChoixSurPage.jsx';
import {
  Champ as ChampParcours,
  commeUneListe,
  GROUPES_PAYS,
  numeroAffiche,
  numeroInternational,
  paysDuNumero,
  RayonsDecor,
  SelecteurIndicatif as SelecteurIndicatifParcours,
} from '../../components/parcours/champs.jsx';
import HopeLogo from '../../components/HopeLogo.jsx';
import {
  IconeCoche,
  IconeCoeur,
  IconeEnveloppe,
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
import { VISUELS_PAIEMENT } from '../../components/VisuelsPaiement.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as donateurService from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';
import { pageDePaiement } from '../../utils/pagesPaiement.js';
import { focusAutomatique, useEcranTelephone } from '../../utils/ecran.js';
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

const NOMBRE_ETAPES = 5;

const nomsDeLangueEnAnglais =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'language' })
    : null;

function langueEnAnglais(code) {
  try {
    return nomsDeLangueEnAnglais?.of(code) ?? '';
  } catch {
    return '';
  }
}

function deuxNomsDeLangue(libelle) {
  const trouve = /^(.+?) \((.+)\)$/.exec(libelle ?? '');
  return trouve ? [trouve[1], trouve[2]] : [libelle, undefined];
}

export default function Parcours() {
  const navigate = useNavigate();
  const emplacement = useLocation();
  const { rafraichir } = useOutletContext();
  const { donnees, chargement, erreur } = useChargement(() => donateurService.recupererProfil(), []);

  const [etape, setEtape] = useState(null);
  const [misAJour, setMisAJour] = useState(null);
  const profil = misAJour ?? donnees;
  const [brouillons, setBrouillons] = useState({});

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
    const demandee = Number(emplacement.state?.etape);
    const retour = demandee >= 1 && demandee <= donnees.etapeSuivante ? demandee : null;
    setEtape((courante) => courante ?? retour ?? donnees.etapeSuivante);
  }, [donnees, navigate, emplacement.state]);

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
            onSuivante={async (reponse) => {
              const page = pageDePaiement('/donateur/completer-profil', reponse?.paiement?.mode);
              if (page) {
                await rafraichir?.();
                navigate(page);
                return;
              }
              await apresEnregistrement(4, reponse);
            }}
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
              await rafraichir?.();
              navigate('/donateur', { replace: true, state: { parcoursTermine: true } });
            }}
          />
        )}
      </main>
    </div>
  );
}

const OBLIGATOIRES = ['nom', 'prenom', 'adresse', 'ville', 'pays', 'telephone'];

const ORDRE_INVITE = ['nom', 'prenom', 'courriel', 'ville', 'pays', 'telephone'];
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function verifier(champs, invite = false) {
  const erreurs = {};
  if (champs.nom.trim() === '') erreurs.nom = 'Indiquez votre nom.';
  if (champs.prenom.trim() === '') erreurs.prenom = 'Indiquez votre prénom.';
  if (invite) {
    const courriel = champs.courriel.trim();
    if (courriel === '') erreurs.courriel = 'Indiquez votre adresse de courriel.';
    else if (!COURRIEL.test(courriel)) erreurs.courriel = 'Cette adresse de courriel n’est pas valide.';
  } else {
    if (champs.adresse.trim() === '') erreurs.adresse = 'Indiquez votre adresse.';
    if (champs.ville.trim() === '') erreurs.ville = 'Indiquez votre ville.';
  }
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

export function EtapeInformations({
  initiales,
  sources,
  onSuivante,
  enregistrer = donateurService.enregistrerEtape1,
  variante = 'compte',
  total = NOMBRE_ETAPES,
}) {
  const invite = variante === 'invite';
  const ordre = invite ? ORDRE_INVITE : [...OBLIGATOIRES, 'profession', 'source'];
  const [champs, setChamps] = useState(() => {
    const indicatif = paysDuNumero(initiales.telephone) ?? (initiales.pays || PAYS_PAR_DEFAUT);
    return {
      nom: initiales.nom ?? '',
      prenom: initiales.prenom ?? '',
      courriel: initiales.courriel ?? '',
      adresse: initiales.adresse ?? '',
      ville: initiales.ville ?? '',
      pays: initiales.pays ?? '',
      indicatif,
      telephone: numeroAffiche(initiales.telephone, indicatif),
      profession: initiales.profession ?? '',
      source: initiales.source ?? '',
    };
  });
  const [indicatifChoisi, setIndicatifChoisi] = useState(() =>
    Boolean(paysDuNumero(initiales.telephone))
  );
  const [touches, setTouches] = useState({});
  const [erreursServeur, setErreursServeur] = useState({});
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const formulaire = useRef(null);

  const erreursLocales = verifier(champs, invite);
  const erreurDe = (champ) =>
    erreursServeur[champ] ?? ((touches[champ] || soumis) ? erreursLocales[champ] : undefined);
  const telephone = useEcranTelephone();

  function modifier(champ) {
    return (evenement) => {
      const valeur = evenement.target.value;
      setChamps((precedents) => ({ ...precedents, [champ]: valeur }));
      setErreursServeur((precedentes) => ({ ...precedentes, [champ]: undefined }));
      if (evenement.target.tagName === 'SELECT') {
        setTouches((precedents) => ({ ...precedents, [champ]: true }));
      }
    };
  }

  function modifierPays(evenement) {
    const valeur = evenement.target.value;
    modifier('pays')(evenement);
    if (!indicatifChoisi && valeur) {
      setChamps((precedents) => ({ ...precedents, indicatif: valeur }));
    }
  }

  function modifierIndicatif(evenement) {
    const valeur = evenement.target.value;
    setIndicatifChoisi(true);
    setChamps((precedents) => ({ ...precedents, indicatif: valeur }));
    setErreursServeur((precedentes) => ({ ...precedentes, telephone: undefined }));
  }

  function quitter(champ) {
    return () => {
      setTouches((precedents) => ({ ...precedents, [champ]: true }));
      if (champ === 'telephone') {
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

  function focaliserPremiereErreur(erreurs) {
    const premier = ordre.find((champ) => erreurs[champ]);
    if (premier) formulaire.current?.querySelector(`#donateur-${premier}`)?.focus();
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');

    const erreurs = verifier(champs, invite);
    if (Object.keys(erreurs).length > 0) {
      focaliserPremiereErreur(erreurs);
      return;
    }

    setEnvoi(true);
    try {
      const communs = {
        nom: champs.nom.trim(),
        prenom: champs.prenom.trim(),
        ville: champs.ville.trim(),
        pays: champs.pays,
        telephone: numeroInternational(champs.telephone, champs.indicatif),
      };
      const reponse = await enregistrer(
        invite
          ? { ...communs, courriel: champs.courriel.trim().toLowerCase() }
          : {
              ...communs,
              adresse: champs.adresse.trim(),
              profession: champs.profession.trim(),
              source: champs.source,
            }
      );
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

  const nbErreurs = soumis ? ordre.filter((champ) => erreurDe(champ)).length : 0;

  return (
    <>
      <EntetePas
        etape={1}
        total={total}
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

        {invite ? (
          <Champ id="courriel" libelle="Courriel" erreur={erreurDe('courriel')} Icone={IconeEnveloppe}>
            <input
              type="email"
              inputMode="email"
              value={champs.courriel}
              onChange={modifier('courriel')}
              onBlur={quitter('courriel')}
              placeholder="Votre adresse de courriel"
              autoComplete="email"
              maxLength={255}
              disabled={envoi}
            />
          </Champ>
        ) : (
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
        )}

        <div className="parcours__paire">
          <Champ id="ville" libelle="Ville" facultatif={invite} erreur={erreurDe('ville')} Icone={IconeImmeuble}>
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
            {telephone ? (
              <ChoixSurPage
                nom="Pays"
                valeur={champs.pays}
                groupes={GROUPES_PAYS}
                indice="Sélectionnez votre pays"
                indiceRecherche="Rechercher un pays…"
                onChoisir={commeUneListe(modifierPays)}
                onQuitter={quitter('pays')}
                disabled={envoi}
              />
            ) : (
              <select
                value={champs.pays}
                onChange={modifierPays}
                onBlur={quitter('pays')}
                autoComplete="country"
                disabled={envoi}
                data-vide={champs.pays === ''}
              >
                <option value="">Sélectionnez votre pays</option>
                {PAYS.map((pays) => (
                  <option key={pays.code} value={pays.code}>
                    {pays.nom}
                  </option>
                ))}
              </select>
            )}
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
              onChange={modifierIndicatif}
              disabled={envoi}
              surPage={telephone}
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

        {!invite && (
          <>
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
              <select
                value={champs.source}
                onChange={modifier('source')}
                disabled={envoi}
                data-vide={champs.source === ''}
              >
                <option value="">Sélectionnez une réponse</option>
                {sources.map((source) => (
                  <option key={source.cle} value={source.cle}>
                    {source.libelle}
                  </option>
                ))}
              </select>
            </Champ>
          </>
        )}

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

const ICONES_TYPE = {
  particulier: IconeUtilisateur,
  entreprise: IconeImmeuble,
  fondation: IconeCoeur,
  organisation: IconeGroupe,
  partenaire: IconePoigneeMain,
  international: IconeGlobe,
};

const LIBELLE_STRUCTURE = {
  entreprise: 'Nom de l’entreprise',
  fondation: 'Nom de la fondation',
  organisation: 'Nom de l’organisation',
  partenaire: 'Nom de la structure partenaire',
};

const CHAMPS_PROFIL = ['type', 'nomStructure', 'siteWeb', 'devise', 'langue', 'fuseau'];

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

  const locaux = useMemo(() => fuseauxDuPays(pays), [pays]);
  const [autres, setAutres] = useState([]);
  useEffect(() => {
    const minuterie = setTimeout(() => {
      setAutres(tousLesFuseaux().filter((fuseau) => !locaux.includes(fuseau.nom)));
    }, 0);
    return () => clearTimeout(minuterie);
  }, [locaux]);

  const telephone = useEcranTelephone();

  const groupesLangues = useMemo(() => {
    const langues = (options.langues ?? []).map((langue) => {
      const [francais, propre] = deuxNomsDeLangue(langue.libelle);
      return {
        valeur: langue.cle,
        libelle: francais,
        sousTitre: propre,
        pastille: langue.cle.toUpperCase(),
        affichage: langue.libelle,
        motsCles: [langue.cle, langueEnAnglais(langue.cle)],
        courante: langue.courante,
      };
    });
    const autres = langues
      .filter((langue) => !langue.courante)
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
    return [
      { libelle: 'Les plus courantes', options: langues.filter((langue) => langue.courante) },
      ...parLettre(autres),
    ];
  }, [options.langues]);

  const groupesFuseaux = useMemo(() => {
    const option = (nom, code) => {
      const ecart = decalage(nom);
      return {
        valeur: nom,
        libelle: (code && nomDuPays(code)) || ville(nom),
        sousTitre: code ? ville(nom) : undefined,
        drapeau: code || undefined,
        detail: ecart,
        affichage: libelleFuseau(nom),
        motsCles: [nom, nomAnglais(code), ecart.replace('UTC', 'GMT'), ecart.replace('UTC', '')],
      };
    };
    const connus = new Set([...locaux, ...autres.map((fuseau) => fuseau.nom)]);
    const ailleurs = autres
      .map((fuseau) => option(fuseau.nom, fuseau.pays))
      .sort(
        (a, b) =>
          a.libelle.localeCompare(b.libelle, 'fr') || (a.sousTitre ?? '').localeCompare(b.sousTitre ?? '', 'fr')
      );
    return [
      ...(champs.fuseau && !connus.has(champs.fuseau) ? [{ options: [option(champs.fuseau, '')] }] : []),
      { libelle: 'Votre pays', options: locaux.map((nom) => option(nom, pays)) },
      ...parLettre(ailleurs),
    ];
  }, [locaux, autres, pays, champs.fuseau]);

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
      if (evenement.target.tagName === 'SELECT') {
        setTouches((precedents) => ({ ...precedents, [champ]: true }));
      }
    };
  }

  function quitter(champ) {
    return () => {
      setTouches((precedents) => ({ ...precedents, [champ]: true }));
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
  const fuseauHorsListe =
    champs.fuseau &&
    !locaux.includes(champs.fuseau) &&
    !autres.some((fuseau) => fuseau.nom === champs.fuseau);

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
            <select value={champs.devise} onChange={modifier('devise')} disabled={envoi}>
              {(options.devises ?? []).map((devise) => (
                <option key={devise.code} value={devise.code}>
                  {devise.code} · {devise.libelle}
                </option>
              ))}
            </select>
          </Champ>

          <Champ id="langue" libelle="Langue" erreur={erreurDe('langue')} Icone={IconeLangue} liste>
            {telephone ? (
              <ChoixSurPage
                nom="Langue"
                valeur={champs.langue}
                groupes={groupesLangues}
                indiceRecherche="Rechercher une langue…"
                onChoisir={commeUneListe(modifier('langue'))}
                onQuitter={quitter('langue')}
                disabled={envoi}
              />
            ) : (
              <select value={champs.langue} onChange={modifier('langue')} disabled={envoi}>
                <optgroup label="Les plus courantes">
                  {(options.langues ?? [])
                    .filter((langue) => langue.courante)
                    .map((langue) => (
                      <option key={langue.cle} value={langue.cle}>
                        {langue.libelle}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Toutes les langues">
                  {(options.langues ?? [])
                    .filter((langue) => !langue.courante)
                    .map((langue) => (
                      <option key={langue.cle} value={langue.cle}>
                        {langue.libelle}
                      </option>
                    ))}
                </optgroup>
              </select>
            )}
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
          {telephone ? (
            <ChoixSurPage
              nom="Fuseau horaire"
              valeur={champs.fuseau}
              groupes={groupesFuseaux}
              indiceRecherche="Ville, pays ou décalage (UTC+3)…"
              onChoisir={commeUneListe(modifier('fuseau'))}
              onQuitter={quitter('fuseau')}
              disabled={envoi}
            />
          ) : (
            <select value={champs.fuseau} onChange={modifier('fuseau')} disabled={envoi}>
              {fuseauHorsListe && <option value={champs.fuseau}>{libelleFuseau(champs.fuseau)}</option>}
              <optgroup label={nomDuPays(pays) || 'Votre pays'}>
                {locaux.map((nom) => (
                  <option key={nom} value={nom}>
                    {libelleFuseau(nom)}
                  </option>
                ))}
              </optgroup>
              {autres.length > 0 && (
                <optgroup label="Autres fuseaux">
                  {autres.map((fuseau) => (
                    <option key={fuseau.nom} value={fuseau.nom}>
                      {fuseau.libelle}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
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

function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function EtapeAffectation({
  initiales,
  onRetour,
  onSuivante,
  chargerProjets = donateurService.listerProjets,
  enregistrer = donateurService.enregistrerEtape3,
  etape = 3,
  total = NOMBRE_ETAPES,
}) {
  const { donnees: liste, chargement, erreur: erreurListe } = useChargement(() => chargerProjets(), []);
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

  const projetValable = projetChoisi && !projetChoisi.atteint;
  const erreurProjet =
    erreurServeur ||
    (soumis && affecte && !chargement && !projetValable
      ? 'Choisissez le projet que vous voulez soutenir.'
      : '');

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
      const reponse = await enregistrer({
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
        etape={etape}
        total={total}
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

export function EtapePaiement({
  initiales,
  pays,
  modes,
  onRetour,
  onSuivante,
  enregistrer = donateurService.enregistrerEtape4,
  etape = 4,
  total = NOMBRE_ETAPES,
}) {
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
      const reponse = await enregistrer({ mode });
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
        etape={etape}
        total={total}
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

const ILLUSTRATIONS_FREQUENCE = {
  ONE_TIME: IconeRecuCoche,
  MONTHLY: IconeCalendrierRenouvele,
};

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

export function EntetePas({ etape, titre, accroche, total = NOMBRE_ETAPES }) {
  return (
    <header className="parcours__entete">
      <p className="parcours__etape">
        Étape {etape}
        <span className="sr-only"> sur {total}</span>
      </p>
      <ol className="parcours__progression" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
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

function Champ(proprietes) {
  return <ChampParcours prefixeId="donateur" {...proprietes} />;
}

function SelecteurIndicatif(proprietes) {
  return <SelecteurIndicatifParcours id="donateur-indicatif" {...proprietes} />;
}
