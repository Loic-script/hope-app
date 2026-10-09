import { useEffect, useRef, useState } from 'react';

import { useContextePaiement } from '../components/paiement/ContextePaiement.jsx';
import { messageErreur } from '../services/api.js';

export function usePromesseDon(mode) {
  const contexte = useContextePaiement();
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

export function montantSaisi(texte) {
  const propre = String(texte ?? '')
    .replace(/[\s\u202f\u00a0]/g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(propre)) return null;
  const valeur = Number(propre);
  return valeur > 0 ? valeur : null;
}

export const REFERENCE_PAIEMENT = /^[A-Za-z0-9][A-Za-z0-9./ -]{3,39}$/;

export function montantInitial(montantPrevu, devisePrevue, deviseDeLaPage = 'MGA') {
  if (!montantPrevu || (devisePrevue && devisePrevue !== deviseDeLaPage)) return '';
  const valeur = Number(montantPrevu);
  if (!(valeur > 0)) return '';
  return deviseDeLaPage === 'MGA' ? valeur.toLocaleString('fr-FR').replace(/\u202f/g, ' ') : String(valeur);
}
