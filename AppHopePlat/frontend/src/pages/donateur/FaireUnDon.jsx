import { useOutletContext, useSearchParams } from 'react-router-dom';

import ParcoursDon from '../../components/don/ParcoursDon.jsx';
import * as service from '../../services/donateur.service.js';

export default function FaireUnDon() {
  const { donateur, rafraichirCompteurs } = useOutletContext();
  const [parametres] = useSearchParams();

  return (
    <ParcoursDon
      prenom={donateur?.prenom}
      titre="Faire un don"
      accroche="Choisissez votre moyen de paiement : la page suivante vous guide pour le montant et le règlement."
      projetPropose={parametres.get('projet')}
      avecRythme
      avecFinances
      lienSuivi={{ to: '/donateur/mes-dons', libelle: 'Suivre mes dons' }}
      lienRetour={{ to: '/donateur', libelle: 'Retour aux actualités' }}
      onEnvoye={rafraichirCompteurs}
      chargerOptions={async () => {
        const profil = await service.recupererProfil();
        return {
          modes: profil.options?.modesPaiement ?? [],
          devises: profil.options?.devises ?? [],
          preferences: {
            devise: profil.profil?.devise,
            mode: profil.paiement?.mode,
            frequence: profil.frequence?.valeur,
            affectation: profil.don?.affectation,
            projetId: profil.don?.projetId,
          },
        };
      }}
      chargerProjets={async () => (await service.listerProjets()).items ?? []}
      envoyer={service.faireUnDon}
      payer="/donateur/payer"
    />
  );
}
