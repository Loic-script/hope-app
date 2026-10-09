import { createContext, useContext, useMemo } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import * as bailleurService from '../../services/bailleur.service.js';
import * as donateurService from '../../services/donateur.service.js';
import * as donInviteService from '../../services/donInvite.service.js';
import * as benevoleService from '../../services/espaceBenevole.service.js';

const PARCOURS = '/donateur/completer-profil';

const DON_INVITE = '/faire-un-don';

const CLE_JETON_INVITE = 'hope.don-invite.jeton';

function lireJetonInvite() {
  try {
    return sessionStorage.getItem(CLE_JETON_INVITE) ?? '';
  } catch {
    return '';
  }
}

function retenirJetonInvite(jeton) {
  try {
    if (jeton) sessionStorage.setItem(CLE_JETON_INVITE, jeton);
  } catch {
  }
}

const Contexte = createContext(null);

export function useContextePaiement() {
  const contexte = useContext(Contexte);
  if (!contexte) throw new Error('Une page de paiement doit etre dans un ContextePaiement.');
  return contexte;
}

const ESPACES = {
  donateur: {
    service: donateurService,
    faireUnDon: '/donateur/faire-un-don',
    suite: '/donateur/mes-dons',
    libelleSuite: 'Voir mes dons',
  },
  bailleur: {
    service: bailleurService,
    faireUnDon: '/bailleur/faire-un-don',
    suite: '/bailleur',
    libelleSuite: 'Revenir à l’accueil',
  },
  benevole: {
    service: benevoleService,
    faireUnDon: '/benevole/faire-un-don',
    suite: '/benevole',
    libelleSuite: 'Revenir à l’accueil',
  },
};

function personneDe(source = {}) {
  return {
    prenom: source.prenom ?? '',
    nom: source.nom ?? '',
    email: source.email ?? '',
    telephone: source.telephone ?? '',
    adresse: source.adresse ?? '',
    ville: source.ville ?? '',
    pays: source.pays ?? '',
    devise: source.devise ?? '',
  };
}

export default function ContextePaiement({ espace, children }) {
  const navigate = useNavigate();
  const emplacement = useLocation();
  const exterieur = useOutletContext() ?? {};
  const brouillon = emplacement.state?.brouillon ?? null;
  const sessionPayee = new URLSearchParams(emplacement.search).get('session');

  const valeur = useMemo(() => {
    if (espace === 'parcours') {
      return {
        espace,
        libelleSuite: 'Continuer mon inscription',
        libellePlusTard: 'Payer plus tard',
        rafraichir: exterieur.rafraichir,
        async charger(mode) {
          const [profil, liste] = await Promise.all([
            donateurService.recupererProfil(),
            donateurService.listerProjets(),
          ]);
          if (profil.paiement?.mode !== mode || profil.etapeSuivante < 5) {
            navigate(PARCOURS, { replace: true });
            return null;
          }
          const projet =
            profil.don?.affectation === 'PROJECT'
              ? (liste?.items ?? []).find((p) => Number(p.id) === Number(profil.don?.projetId))
              : null;
          return {
            personne: personneDe({
              ...profil.informations,
              email: profil.compte?.email,
              devise: profil.profil?.devise,
            }),
            affectation: profil.don?.affectation || 'HOPE',
            projetId: profil.don?.affectation === 'PROJECT' ? profil.don.projetId : undefined,
            beneficiaire: projet?.nom ?? (profil.don?.affectation === 'PROJECT' ? 'Le projet choisi' : 'Les projets de HOPE'),
            frequence: 'ONE_TIME',
            montant: null,
            devise: null,
          };
        },
        coordonnees: () => donateurService.coordonneesDePaiement(),
        promettre: (corps) => donateurService.faireUnDon(corps),
        declarer: (id, reference) => donateurService.declarerPaiement(id, reference),
        carte: {
          reglages: () => donateurService.reglagesCarte(),
          ouvrir: (corps) => donateurService.ouvrirPaiementCarte(corps),
          etat: (session) => donateurService.etatPaiementCarte(session),
        },
        sessionPayee,
        quitter(etape) {
          navigate(PARCOURS, { replace: true, state: etape ? { etape } : undefined });
        },
      };
    }

    if (espace === 'invite') {
      const prepare = brouillon ?? {};
      const donateur = prepare.personne ?? null;
      return {
        espace,
        libelleSuite: 'Revenir au site HOPE',
        libellePlusTard: 'Revenir au site',
        rafraichir: undefined,
        async charger(mode) {
          if ((!brouillon || brouillon.mode !== mode) && !sessionPayee) {
            navigate(DON_INVITE, { replace: true });
            return null;
          }
          return {
            personne: personneDe(donateur ?? {}),
            affectation: prepare.affectation || 'HOPE',
            projetId: prepare.affectation === 'PROJECT' ? prepare.projetId : undefined,
            beneficiaire:
              prepare.projetNom || (prepare.affectation === 'PROJECT' ? 'Le projet choisi' : 'Les projets de HOPE'),
            frequence: 'ONE_TIME',
            message: prepare.message,
            montant: prepare.montant ?? null,
            devise: prepare.devise ?? null,
          };
        },
        coordonnees: () => donInviteService.coordonneesDePaiement(),
        async promettre(corps) {
          const reponse = await donInviteService.faireUnDon({ ...corps, donateur });
          retenirJetonInvite(reponse.jeton);
          return reponse;
        },
        declarer: (id, reference) => donInviteService.declarerPaiement(id, reference, lireJetonInvite()),
        carte: {
          reglages: () => donInviteService.reglagesCarte(),
          async ouvrir(corps) {
            const reponse = await donInviteService.ouvrirPaiementCarte({ ...corps, donateur });
            retenirJetonInvite(reponse.jeton);
            return reponse;
          },
          etat: (session) => donInviteService.etatPaiementCarte(session, lireJetonInvite()),
        },
        sessionPayee,
        quitter(etape) {
          if (etape) {
            navigate(DON_INVITE, { replace: true, state: prepare.reprise ? { reprise: prepare.reprise } : undefined });
            return;
          }
          navigate('/', { replace: true });
        },
      };
    }

    const reglage = ESPACES[espace];
    return {
      espace,
      libelleSuite: reglage.libelleSuite,
      libellePlusTard: 'Revenir plus tard',
      rafraichir: exterieur.rafraichirCompteurs ?? exterieur.rafraichir,
      async charger(mode) {
        if ((!brouillon || brouillon.mode !== mode) && !sessionPayee) {
          navigate(reglage.faireUnDon, { replace: true });
          return null;
        }
        let source = exterieur.donateur ?? exterieur.bailleur ?? exterieur.benevole ?? {};
        if (espace === 'donateur') {
          const profil = await donateurService.recupererProfil();
          source = { ...profil.informations, email: profil.compte?.email, devise: profil.profil?.devise };
        }
        const prepare = brouillon ?? {};
        return {
          personne: personneDe(source),
          affectation: prepare.affectation || 'HOPE',
          projetId: prepare.affectation === 'PROJECT' ? prepare.projetId : undefined,
          beneficiaire:
            prepare.projetNom || (prepare.affectation === 'PROJECT' ? 'Le projet choisi' : 'Les projets de HOPE'),
          frequence: prepare.frequence || 'ONE_TIME',
          message: prepare.message,
          montant: prepare.montant ?? null,
          devise: prepare.devise ?? null,
        };
      },
      coordonnees: () => reglage.service.coordonneesDePaiement(),
      promettre: (corps) => reglage.service.faireUnDon(corps),
      declarer: (id, reference) => reglage.service.declarerPaiement(id, reference),
      carte: {
        reglages: () => reglage.service.reglagesCarte(),
        ouvrir: (corps) => reglage.service.ouvrirPaiementCarte(corps),
        etat: (session) => reglage.service.etatPaiementCarte(session),
      },
      sessionPayee,
      quitter(etape) {
        if (etape) {
          const projet = brouillon?.projetId ? `?projet=${brouillon.projetId}` : '';
          navigate(`${reglage.faireUnDon}${projet}`, { replace: true });
          return;
        }
        navigate(reglage.suite, { replace: true });
      },
    };
  }, [
    espace,
    brouillon,
    sessionPayee,
    navigate,
    exterieur.rafraichir,
    exterieur.rafraichirCompteurs,
    exterieur.donateur,
    exterieur.bailleur,
    exterieur.benevole,
  ]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}
