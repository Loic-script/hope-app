# HOPE — Hope for a Better Life

Site vitrine et plateforme de dons de l'association **HOPE** (Madagascar) : accompagnement des
enfants orphelins, des mères célibataires et des familles vulnérables — scolarité,
employabilité, soins et alimentation.

**Conçu et développé par [TwinsDev](https://www.linkedin.com/in/twinsdev/)**, duo de développeurs
et informaticiens à Madagascar : [Faneva Loïc Razafimamonjy](https://www.linkedin.com/in/faneva-loïc-razafimamonjy)
(Loïc) et [Fahendrena Marco Razafimamonjy](https://www.linkedin.com/in/fahendrena-marco-razafimamonjy-310971343/) (Marco).

## Auteurs

**TwinsDev**, duo de développeurs et informaticiens, a conçu et développé l'ensemble du projet HOPE :

- le **site vitrine** public de l'association (accueil, activités, impacts, réalisations,
  actualités, partenaires) ;
- la **plateforme** : espaces administrateur, donateur, bénévole et bailleur, dons et paiements
  (MVola, Orange Money, carte bancaire, virement), messagerie, suivi des projets, des tâches et
  des impacts ;
- l'**API** Node.js / Express, la base **PostgreSQL**, les tests automatisés et le déploiement
  sur **Railway**.

| | |
|---|---|
| Duo | TwinsDev · [linkedin.com/in/twinsdev](https://www.linkedin.com/in/twinsdev/) |
| Membre | RAZAFIMAMONJY Faneva Loïc (Loïc) · [LinkedIn](https://www.linkedin.com/in/faneva-loïc-razafimamonjy) · [GitHub @Loic-script](https://github.com/Loic-script) |
| Aussi écrit | Faneva Loïc RAZAFIMAMONJY · Loïc RAZAFIMAMONJY · Loic Razafimamonjy · Loïc Faneva |
| Membre | RAZAFIMAMONJY Fahendrena Marco (Marco) · [LinkedIn](https://www.linkedin.com/in/fahendrena-marco-razafimamonjy-310971343/) |
| Aussi écrit | Fahendrena Marco RAZAFIMAMONJY · Marco RAZAFIMAMONJY · Marco Razafimamonjy |
| Rôle | Développeurs et informaticiens (React, Node.js, PostgreSQL) |
| Pays | Madagascar |

## Organisation des branches

| Branche   | Rôle                                                                |
|-----------|---------------------------------------------------------------------|
| `main`    | Production : chaque envoi est déployé automatiquement sur Railway.  |
| `dev`     | Branche d'intégration.                                              |
| `hopeapp` | Ancienne branche de développement.                                  |

> Le code du site et de la plateforme se trouve dans le dossier
> [`AppHopePlat/`](AppHopePlat/README.md) ; la mise en ligne est décrite dans
> [`AppHopePlat/DEPLOIEMENT.md`](AppHopePlat/DEPLOIEMENT.md).

## Pile technique

- **Backend** — Node.js, Express, PostgreSQL (`pg`, sans ORM)
- **Frontend** — React, Vite, CSS
- **Sécurité** — mots de passe hachés avec bcrypt, sessions JWT en cookies httpOnly
- **Qualité** — tests backend (`node --test`), tests de bout en bout (Playwright), audit
  d'accessibilité (axe-core), intégration continue GitHub Actions
- **Hébergement** — Railway (un seul service et une base PostgreSQL)

## Configuration

Les fichiers `.env` ne sont **jamais** versionnés : ils contiennent le
mot de passe PostgreSQL et le secret JWT. Se reporter aux fichiers
`.env.example` de chaque sous-projet.

---

© HOPE – Hope for a Better Life. Site et plateforme conçus et développés par **TwinsDev**
(RAZAFIMAMONJY Faneva Loïc et RAZAFIMAMONJY Fahendrena Marco).
