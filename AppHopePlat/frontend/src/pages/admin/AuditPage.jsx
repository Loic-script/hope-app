import { useEffect, useState } from 'react';

import { Badge, BarreOutils, EntetePage, Panneau, Tableau } from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { api } from '../../services/api.js';
import * as fmt from '../../utils/format.js';

const FILTRES = [
  { valeur: '', label: 'Tout' },
  { valeur: 'admin', label: 'Équipe' },
  { valeur: 'utilisateur', label: 'Utilisateurs' },
];

const LIBELLES_ACTEUR = { admin: 'Équipe', utilisateur: 'Utilisateur', systeme: 'Système' };
const COULEURS_ACTEUR = { admin: 'violet', utilisateur: 'bleu', systeme: 'gris' };

function detailsLisibles(details) {
  if (!details || typeof details !== 'object') return null;
  return Object.entries(details)
    .map(([cle, valeur]) => `${cle} : ${valeur}`)
    .join(' · ');
}

export default function AuditPage() {
  const [type, setType] = useState('');
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const minuterie = setTimeout(() => {
      setRecherche(saisie.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(minuterie);
  }, [saisie]);

  const { donnees, chargement, erreur } = useChargement(
    () => api.get('/admin/audit', { params: { type: type || undefined, recherche: recherche || undefined, page } }).then((r) => r.data),
    [type, recherche, page]
  );

  const total = donnees?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (donnees?.parPage ?? 50)));

  return (
    <>
      <EntetePage
        fil={[{ label: 'Paramètres', to: '/admin/settings' }, { label: 'Journal d’audit' }]}
        titre="Journal d’audit"
        accroche="Qui a fait quoi, quand, et avec quel résultat. Chaque modification de l’équipe y entre d’office."
      />

      <Panneau serre>
        <BarreOutils
          recherche={saisie}
          onRecherche={setSaisie}
          placeholder="Rechercher une action, une personne…"
          filtres={FILTRES}
          filtreActif={type}
          onFiltre={(valeur) => {
            setType(valeur);
            setPage(1);
          }}
          compteur={`${fmt.nombre(total)} entrée${total > 1 ? 's' : ''}`}
        />
        <Tableau
          empilable
          chargement={chargement}
          erreur={erreur}
          lignes={donnees?.items ?? []}
          colonnes={[
            {
              cle: 'quand',
              titre: 'Quand',
              largeur: '150px',
              rendu: (l) => (
                <time dateTime={l.creeLe} title={new Date(l.creeLe).toLocaleString('fr-FR')}>
                  {fmt.date(l.creeLe)} · {new Date(l.creeLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </time>
              ),
            },
            {
              cle: 'qui',
              titre: 'Qui',
              rendu: (l) => (
                <span className="audit__qui">
                  <Badge valeur={l.acteurType} libelles={LIBELLES_ACTEUR} couleur={COULEURS_ACTEUR[l.acteurType]} />{' '}
                  {l.acteurLibelle || (l.acteurId ? `n° ${String(l.acteurId).slice(0, 8)}` : '—')}
                </span>
              ),
            },
            {
              cle: 'quoi',
              titre: 'Action',
              rendu: (l) => (
                <span>
                  {l.libelle}
                  {l.cible && <span className="audit__cible"> — n° {l.cible}</span>}
                  {detailsLisibles(l.details) && <span className="audit__details">{detailsLisibles(l.details)}</span>}
                </span>
              ),
            },
            {
              cle: 'resultat',
              titre: 'Résultat',
              largeur: '110px',
              rendu: (l) =>
                l.statutHttp && l.statutHttp >= 400 ? (
                  <Badge valeur="REFUS" libelles={{ REFUS: 'refusé' }} couleur="rouge" />
                ) : (
                  <Badge valeur="OK" libelles={{ OK: 'effectué' }} couleur="vert" />
                ),
            },
            { cle: 'ip', titre: 'Adresse IP', largeur: '130px', rendu: (l) => <span className="audit__ip">{l.ip ?? '—'}</span> },
          ]}
        />
        {pages > 1 && (
          <nav className="audit__pages" aria-label="Pages du journal">
            <button type="button" className="btn btn--secondaire btn--petit" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Plus récent
            </button>
            <span>
              Page {page} sur {pages}
            </span>
            <button type="button" className="btn btn--secondaire btn--petit" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Plus ancien
            </button>
          </nav>
        )}
      </Panneau>
    </>
  );
}
