import { useOutletContext, useSearchParams } from 'react-router-dom';

import ParcoursDon from '../../components/don/ParcoursDon.jsx';
import * as service from '../../services/espaceBenevole.service.js';

export default function FaireUnDon() {
  const { benevole, rafraichirCompteurs } = useOutletContext();
  const [parametres] = useSearchParams();

  return (
    <ParcoursDon
      prenom={benevole?.prenom}
      titre="Faire un don à ce projet"
      accroche="Choisissez votre moyen de paiement : la page suivante vous guide pour le montant et le règlement, et l’équipe HOPE confirme votre don à réception."
      projetImpose={parametres.get('projet')}
      avecRythme={false}
      avecFinances={false}
      lienRetour={{ to: '/benevole', libelle: 'Retour aux actualités' }}
      onEnvoye={rafraichirCompteurs}
      chargerOptions={async () => {
        const options = await service.optionsDon();
        return { modes: options.modesPaiement ?? [], devises: options.devises ?? [] };
      }}
      chargerProjets={async () =>
        (await service.listerProjets()).map((p) => ({
          id: p.id,
          nom: p.name,
          image: p.mediaType === 'PHOTO' ? p.mediaUrl : null,
          lieu: p.location,
          categorie: p.categoryName,
        }))
      }
      envoyer={service.faireUnDon}
      payer="/benevole/payer"
    />
  );
}
