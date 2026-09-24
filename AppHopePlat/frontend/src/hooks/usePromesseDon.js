import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { messageErreur } from '../services/api.js';
import * as donateurService from '../services/donateur.service.js';
import { PARCOURS } from './usePaiementMobile.js';

/**
 * Les pages de paiement hors ligne du parcours donateur -- virement,
 * depot, especes, virement international, plateformes -- partagent la
 * meme mecanique :
 *
 *   * elles chargent la fiche du donateur et les coordonnees de HOPE ;
 *   * elles ne s'ouvrent qu'apres le choix de leur moyen a l'etape 4 ;
 *   * elles enregistrent une PROMESSE (le don part en attente), puis,
 *     quand le moyen s'y prete, le donateur signale son paiement avec
 *     la reference de sa banque ;
 *   * elles rendent la main au parcours, a l'etape 5.
 *
 * Chaque page garde son habit et ses champs ; ce hook tient le reste.
 */
export function usePromesseDon(mode) {
  const navigate = useNavigate();
  const { rafraichir } = useOutletContext() ?? {};

  const [profil, setProfil] = useState(null);
  const [coordonnees, setCoordonnees] = useState(null);
  const [projets, setProjets] = useState([]);
  const [erreurChargement, setErreurChargement] = useState('');
  const [don, setDon] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  useEffect(() => {
    let annule = false;
    Promise.all([
      donateurService.recupererProfil(),
      donateurService.coordonneesDePaiement(),
      donateurService.listerProjets(),
    ])
      .then(([lu, coord, liste]) => {
        if (annule) return;
        if (lu.paiement?.mode !== mode || lu.etapeSuivante < 5) {
          navigate(PARCOURS, { replace: true });
          return;
        }
        setProfil(lu);
        setCoordonnees(coord);
        setProjets(liste?.items ?? []);
      })
      .catch((echec) => {
        if (!annule) setErreurChargement(messageErreur(echec, 'La page de paiement n’a pas pu être préparée.'));
      });
    return () => {
      annule = true;
    };
  }, [navigate, mode]);

  const beneficiaire = useMemo(() => {
    if (!profil) return '';
    if (profil.don?.affectation !== 'PROJECT') return 'Les projets de HOPE';
    const projet = projets.find((p) => Number(p.id) === Number(profil.don?.projetId));
    return projet?.nom ?? 'Le projet choisi';
  }, [profil, projets]);

  const nom = profil ? [profil.informations?.prenom, profil.informations?.nom].filter(Boolean).join(' ') : '';

  /**
   * Enregistre la promesse. Rend le don, ou null si le serveur refuse
   * (le motif est alors dans refus).
   */
  async function promettre({ montant, devise = 'MGA', ...extras }) {
    setRefus('');
    setEnvoi(true);
    try {
      const reponse = await donateurService.faireUnDon({
        affectation: profil.don?.affectation || 'HOPE',
        projetId: profil.don?.affectation === 'PROJECT' ? profil.don.projetId : undefined,
        montant: String(montant),
        devise,
        mode,
        // Le premier don ; la frequence se choisit a l'etape suivante.
        frequence: 'ONE_TIME',
        ...extras,
      });
      setDon(reponse.don);
      await rafraichir?.();
      return reponse.don;
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre don n’a pas pu être enregistré. Réessayez.'));
      return null;
    } finally {
      setEnvoi(false);
    }
  }

  /** Le donateur signale son paiement : rend true si c'est enregistre. */
  async function declarer(referencePaiement) {
    setRefus('');
    setEnvoi(true);
    try {
      const reponse = await donateurService.declarerPaiement(don.id, referencePaiement);
      setDon(reponse.don);
      return true;
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre paiement n’a pas pu être signalé. Réessayez.'));
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  /** Revenir au parcours : a l'etape 4, ou a la suite. */
  function quitter(etape) {
    navigate(PARCOURS, { replace: true, state: etape ? { etape } : undefined });
  }

  return {
    profil,
    coordonnees,
    erreurChargement,
    beneficiaire,
    nom,
    email: profil?.compte?.email ?? '',
    don,
    envoi,
    refus,
    setRefus,
    promettre,
    declarer,
    quitter,
  };
}

/** Un montant saisi "25 000" -> 25000 ; "12,50" -> 12.5 ; sinon null. */
export function montantSaisi(texte) {
  const propre = String(texte ?? '')
    .replace(/[\s  ]/g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(propre)) return null;
  const valeur = Number(propre);
  return valeur > 0 ? valeur : null;
}

/** Une reference de paiement : lettres, chiffres, points, tirets, espaces. */
export const REFERENCE_PAIEMENT = /^[A-Za-z0-9][A-Za-z0-9./ -]{3,39}$/;
