import { createContext, useContext, useMemo } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import * as bailleurService from '../../services/bailleur.service.js';
import * as donateurService from '../../services/donateur.service.js';
import * as benevoleService from '../../services/espaceBenevole.service.js';

/** Le parcours d'accueil du donateur. */
const PARCOURS = '/donateur/completer-profil';

const Contexte = createContext(null);

/**
 * D'ou l'on paie : le contexte que lisent les pages de paiement.
 *
 * Une meme page -- MVola, carte, virement... -- sert quatre chemins :
 *
 *   * parcours : le donateur vient de s'inscrire ; le moyen et
 *     l'affectation sont ceux de son profil, et la page rend la main a
 *     l'etape 5 ;
 *   * donateur, bailleur, benevole : "Faire un don" dans un espace. Le
 *     don se prepare dans ParcoursDon (destination, montant, moyen),
 *     qui l'apporte ici en brouillon ; la page le fait payer, puis
 *     revient a l'espace.
 *
 * Ce contexte cache la difference : qui paie, quel don, quels services
 * appeler, ou aller en quittant.
 */
export function useContextePaiement() {
  const contexte = useContext(Contexte);
  if (!contexte) throw new Error('Une page de paiement doit etre dans un ContextePaiement.');
  return contexte;
}

/** Les espaces : leurs services, et ou menent les sorties. */
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

/** La personne connectee, telle que les pages de paiement la lisent. */
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
  /*
   * Le retour de Stripe : la banque a pu demander une confirmation au
   * donateur, et le ramener ici par une adresse -- sans l'etat de la
   * page, donc sans brouillon. La session suffit alors : le don est
   * deja enregistre, il ne reste qu'a en montrer le recu.
   */
  const sessionPayee = new URLSearchParams(emplacement.search).get('session');

  const valeur = useMemo(() => {
    // ----- Le parcours d'accueil -----
    if (espace === 'parcours') {
      return {
        espace,
        libelleSuite: 'Continuer mon inscription',
        libellePlusTard: 'Payer plus tard',
        rafraichir: exterieur.rafraichir,
        /**
         * Le moyen doit etre celui choisi a l'etape 4, et l'etape 4
         * franchie : sinon, retour au parcours.
         */
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
            // Le premier don ; la frequence se choisit a l'etape suivante.
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

    // ----- Un espace : le don prepare dans ParcoursDon -----
    const reglage = ESPACES[espace];
    return {
      espace,
      libelleSuite: reglage.libelleSuite,
      libellePlusTard: 'Revenir plus tard',
      rafraichir: exterieur.rafraichirCompteurs ?? exterieur.rafraichir,
      async charger(mode) {
        // Sans brouillon -- une adresse tapee, une page rechargee --, ou
        // pour un autre moyen : le don se prepare d'abord. Sauf au
        // retour d'un paiement : le don est fait, on montre son recu.
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
          // Revenir au choix du moyen : le don se reprend la ou il etait.
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
