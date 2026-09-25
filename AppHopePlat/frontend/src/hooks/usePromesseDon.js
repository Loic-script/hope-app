import { useEffect, useRef, useState } from 'react';

import { useContextePaiement } from '../components/paiement/ContextePaiement.jsx';
import { messageErreur } from '../services/api.js';

/**
 * La mecanique commune des pages de paiement : charger qui paie et quel
 * don, enregistrer la PROMESSE (le don part en attente), laisser le
 * payeur signaler son paiement avec la reference de sa banque, et
 * rendre la main.
 *
 * D'ou l'on paie -- le parcours d'accueil, ou "Faire un don" dans un
 * espace donateur, bailleur, benevole -- c'est le ContextePaiement qui
 * le sait ; ce hook ne fait que s'en servir.
 *
 * @param {string} mode  la cle du moyen ("virement_bancaire", "especes"...)
 */
export function usePromesseDon(mode) {
  const contexte = useContextePaiement();
  // Le contexte change quand l'espace se rafraichit ; le chargement, lui,
  // ne se fait qu'une fois par page.
  const ref = useRef(contexte);
  ref.current = contexte;

  const [profil, setProfil] = useState(null);
  const [coordonnees, setCoordonnees] = useState(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const [don, setDon] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  useEffect(() => {
    let annule = false;
    Promise.all([ref.current.charger(mode), ref.current.coordonnees()])
      .then(([lu, coord]) => {
        if (annule || !lu) return;
        setProfil(lu);
        setCoordonnees(coord);
      })
      .catch((echec) => {
        if (!annule) setErreurChargement(messageErreur(echec, 'La page de paiement n’a pas pu être préparée.'));
      });
    return () => {
      annule = true;
    };
  }, [mode]);

  const personne = profil?.personne ?? {};

  /**
   * Enregistre la promesse. Rend le don, ou null si le serveur refuse
   * (le motif est alors dans refus).
   */
  async function promettre({ montant, devise = 'MGA', ...extras }) {
    setRefus('');
    setEnvoi(true);
    try {
      const reponse = await ref.current.promettre({
        affectation: profil.affectation,
        projetId: profil.projetId,
        montant: String(montant),
        devise,
        mode,
        frequence: profil.frequence || 'ONE_TIME',
        message: profil.message || undefined,
        ...extras,
      });
      setDon(reponse.don);
      await ref.current.rafraichir?.();
      return reponse.don;
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre don n’a pas pu être enregistré. Réessayez.'));
      return null;
    } finally {
      setEnvoi(false);
    }
  }

  /** Le payeur signale son paiement : rend true si c'est enregistre. */
  async function declarer(referencePaiement) {
    setRefus('');
    setEnvoi(true);
    try {
      const reponse = await ref.current.declarer(don.id, referencePaiement);
      setDon(reponse.don);
      return true;
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre paiement n’a pas pu être signalé. Réessayez.'));
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  return {
    profil,
    personne,
    coordonnees,
    erreurChargement,
    beneficiaire: profil?.beneficiaire ?? '',
    nom: [personne.prenom, personne.nom].filter(Boolean).join(' '),
    email: personne.email ?? '',
    // Ce que le don prepare apporte deja : montant et devise.
    montantPrevu: profil?.montant ?? null,
    devisePrevue: profil?.devise ?? null,
    don,
    envoi,
    refus,
    setRefus,
    promettre,
    declarer,
    quitter: (etape) => ref.current.quitter(etape),
    libelleSuite: contexte.libelleSuite,
    libellePlusTard: contexte.libellePlusTard,
  };
}

/** Un montant saisi "25 000" -> 25000 ; "12,50" -> 12.5 ; sinon null. */
export function montantSaisi(texte) {
  const propre = String(texte ?? '')
    .replace(/[\s\u202f\u00a0]/g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(propre)) return null;
  const valeur = Number(propre);
  return valeur > 0 ? valeur : null;
}

/** Une reference de paiement : lettres, chiffres, points, tirets, espaces. */
export const REFERENCE_PAIEMENT = /^[A-Za-z0-9][A-Za-z0-9./ -]{3,39}$/;

/**
 * Le montant prevu, pour pre-remplir un champ -- s'il est dans la devise
 * que la page encaisse. "25 000" pour 25000 en ariary.
 */
export function montantInitial(montantPrevu, devisePrevue, deviseDeLaPage = 'MGA') {
  if (!montantPrevu || (devisePrevue && devisePrevue !== deviseDeLaPage)) return '';
  const valeur = Number(montantPrevu);
  if (!(valeur > 0)) return '';
  return deviseDeLaPage === 'MGA' ? valeur.toLocaleString('fr-FR').replace(/\u202f/g, ' ') : String(valeur);
}
