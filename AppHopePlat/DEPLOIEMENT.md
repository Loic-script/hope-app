# Déployer HOPE sur Railway

HOPE se déploie en **un seul service** : le serveur Express sert l'API sous `/api` et le
frontend React construit (`frontend/dist`). Une base **PostgreSQL** l'accompagne.

Tout est déjà prêt dans le dépôt :

| Fichier | Rôle |
|---|---|
| `package.json` (racine de `AppHopePlat`) | `build`, `start`, `db:preparer`, `db:premier-deploiement` |
| `railway.json` | les mêmes réglages que ceux de la section 1, pour mémoire : Railway abandonne ce fichier (*Config as Code*, voir ci-dessous) |
| `backend/.env.example` | la liste commentée de toutes les variables |

Durée : une trentaine de minutes la première fois.

---

## 1. Créer le projet

1. Sur [railway.com](https://railway.com), **New Project → Deploy from GitHub repo**, et choisir
   `Loic-script/hope-app`.
2. Dans le service créé, **Settings** :
   - **Root Directory** : `AppHopePlat` (le dépôt contient d'autres dossiers ; sans ce réglage,
     Railway construit la racine du dépôt, n'y trouve rien et échoue — voir « Dépannage ») ;
   - **Branch** : `main` pour la production (ou `dev` pour une préproduction) ;
   - rubrique **Build** → *Custom Build Command* : `npm run build` ;
   - rubrique **Deploy** :
     - *Custom Start Command* : `npm start` ;
     - *Pre-deploy Command* : `npm run db:preparer` — **indispensable** : c'est elle qui crée
       les tables et applique chaque évolution du schéma avant la mise en ligne ;
     - *Healthcheck Path* : `/api/sante` (délai : 120 s) — Railway garde l'ancienne version
       tant que la nouvelle ne répond pas ;
     - *Restart Policy* : *On Failure*, 5 tentatives.

   Ces réglages se saisissent dans l'interface. Le fichier `railway.json` du dépôt porte les
   mêmes, mais Railway abandonne ce mécanisme (*Config as Code*) : il cesse de fonctionner le
   1er décembre 2026, et un service qui ne l'a jamais utilisé ne peut plus l'activer depuis le
   28 août 2026.
3. **+ New → Database → PostgreSQL** dans le même projet.

## 2. Les variables du service

Dans le service HOPE, onglet **Variables**. Les valeurs entre `${{ }}` sont des références
Railway : elles se mettent à jour seules.

### Obligatoires

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | 48 octets aléatoires (voir ci-dessous). Le serveur **refuse de démarrer** en production avec un secret court ou d'exemple. |
| `ADMIN_LOG` | l'identifiant de connexion de l'administrateur |
| `ADMIN_PASSWORD` | son mot de passe (long, unique). Il n'est lu qu'à la création du compte. |
| `HOPE_SITE_URL` | l'adresse publique, ex. `https://hope-production.up.railway.app` (sert aux liens des courriels et au retour de Stripe) |
| `CORS_ORIGIN` | la même adresse |

Générer le secret JWT :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`PORT` est fourni par Railway : ne pas le définir. `DB_SSL` n'est utile que si la base impose
TLS (réseau privé Railway : inutile).

### Les coordonnées de paiement de HOPE

Affichées au donateur sur les pages de paiement. Tant qu'un moyen n'est pas renseigné, sa page
le dit (« pas encore ouvert ») au lieu d'afficher des coordonnées fausses.

| Moyen | Variables |
|---|---|
| MVola | `HOPE_MVOLA_NUMERO`, `HOPE_MVOLA_TITULAIRE` |
| Orange Money | `HOPE_ORANGE_MONEY_NUMERO`, `HOPE_ORANGE_MONEY_TITULAIRE` |
| Virement / dépôt | `HOPE_BANQUE_NOM`, `HOPE_BANQUE_AGENCE`, `HOPE_BANQUE_TITULAIRE`, `HOPE_BANQUE_RIB`, `HOPE_BANQUE_IBAN`, `HOPE_BANQUE_BIC`, `HOPE_BANQUE_ADRESSE` |
| Espèces au bureau | `HOPE_BUREAU_ADRESSE`, `HOPE_BUREAU_HORAIRES` |
| Plateformes de transfert | `HOPE_RETRAIT_NOM`, `HOPE_RETRAIT_VILLE` |

> Les valeurs du `.env` local sont **des valeurs d'essai** : ne pas les recopier.

### Les courriels (mot de passe oublié)

N'importe quel fournisseur SMTP : Brevo, Mailjet, Resend…

| Variable | Exemple |
|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` (ou `465` avec `SMTP_SECURE=true`) |
| `SMTP_USER`, `SMTP_PASSWORD` | fournis par le service |
| `SMTP_FROM` | `HOPE <no-reply@votre-domaine>` — une adresse d'un domaine vérifié chez le fournisseur |

Sans SMTP, la plateforme fonctionne, mais aucun courriel ne part (un avertissement l'écrit dans
le journal, sans jamais y mettre le lien).

Une fois SMTP configuré, la plateforme écrit d'elle-même :

| Événement | Destinataire |
|---|---|
| inscription : lien de confirmation de l'adresse | la personne |
| mot de passe oublié : lien de réinitialisation | la personne |
| promesse de don enregistrée (référence, suite) | le donateur |
| don reçu (confirmé par l'équipe ou payé par carte) : remerciement | le donateur |
| compte bénévole ou bailleur validé | la personne |
| compte à valider, promesse de don à confirmer | l'équipe (`EQUIPE_EMAIL`) |
| erreur interne du serveur | `ALERTE_EMAIL` |

Un compte d'utilisateur ne reçoit ces courriels qu'une fois son adresse confirmée. Les
adresses des domaines réservés (`.test`, `.example`) des comptes de démonstration ne sont
jamais envoyées : elles s'écrivent dans le journal.

Avec Gmail, `SMTP_USER` et l'adresse de `SMTP_FROM` doivent être la même, et
`SMTP_PASSWORD` est un **mot de passe d'application** (compte Google → Sécurité →
Validation en deux étapes → Mots de passe d'application), pas le mot de passe du compte.

### La carte bancaire (Stripe)

1. Dans le tableau de bord Stripe, **Développeurs → Clés API** : `STRIPE_SECRET_KEY` (`sk_live_…`)
   et `STRIPE_PUBLISHABLE_KEY` (`pk_live_…`).
2. **Développeurs → Webhooks → Ajouter un endpoint** :
   - URL : `https://<votre-adresse>/api/paiements/stripe/webhook`
   - événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired` ;
   - copier le **secret de signature** dans `STRIPE_WEBHOOK_SECRET` (`whsec_…`).

Sans ces trois clés, la page carte bancaire annonce que le paiement par carte n'est pas encore
ouvert ; les autres moyens restent disponibles. Faire un premier essai avec les clés **de test**
(`sk_test_…`) et la carte `4242 4242 4242 4242`.

### Facultatives

| Variable | Rôle |
|---|---|
| `EQUIPE_EMAIL`, `EQUIPE_TELEPHONE`, `EQUIPE_SITE` | coordonnées de l'association : fils d'assistance de la messagerie, et **adresse de contact des pages légales** (confidentialité, conditions d'utilisation) |
| `ALERTE_EMAIL` | adresse qui reçoit une alerte quand le serveur rencontre une erreur interne (au plus une par quart d'heure). Vide : `EQUIPE_EMAIL` |
| `JWT_EXPIRES_IN` | durée d'une session (défaut `2h`) |
| `BCRYPT_SALT_ROUNDS` | coût du hachage des mots de passe (défaut raisonnable déjà fixé) |

## 3. Les fichiers téléversés

Photos, preuves de terrain, justificatifs et photos de bénéficiaires sont écrits dans
`backend/uploads`. **Le disque d'un service Railway est effacé à chaque déploiement** : sans
volume, ces fichiers disparaissent.

Service HOPE → **+ New → Volume**, point de montage :

```
/app/backend/uploads
```

(Railway place le dossier racine du service dans `/app` : avec la racine `AppHopePlat`, le
dossier des fichiers est `/app/backend/uploads`.)

## 4. Premier déploiement

1. Lancer le déploiement (il part tout seul après la configuration, sinon **Deploy**).
   - construction : `npm run build` installe le backend, le frontend, et construit le frontend ;
   - avant la mise en ligne : `npm run db:preparer` crée la table administrateur et applique le
     schéma (sans risque : il est rejouable) ;
   - démarrage : `npm start`, puis Railway attend que `/api/sante` réponde.
2. **Settings → Networking → Generate Domain** pour obtenir l'adresse publique (tant qu'il n'y
   en a pas, Railway affiche « Unexposed service »). Si Railway demande un port, donner celui
   du journal de démarrage (`[HOPE] API demarree sur …:8080`). Reporter ensuite cette adresse
   dans `HOPE_SITE_URL` et `CORS_ORIGIN` (et dans le webhook Stripe).
3. **Une seule fois**, créer le compte administrateur (à partir de `ADMIN_LOG` et
   `ADMIN_PASSWORD`) et les catégories de projet. La commande doit tourner **dans** le service :
   la base est sur le réseau privé de Railway, qu'un poste ne joint pas (`railway run` exécute
   en local et échouerait sur `postgres.railway.internal`).

   - dans l'interface : onglet **Console** du service, s'il ouvre un terminal ;
   - sinon, avec la CLI Railway (`npm install -g @railway/cli`) :

     ```bash
     railway login
     railway link             # choisir le projet et le service HOPE
     railway ssh              # un terminal dans le service
     ```

   puis, dans ce terminal :

   ```bash
   npm run db:premier-deploiement
   ```

   Les deux étapes sont sans risque si on les rejoue : un administrateur existant n'est pas
   modifié, une catégorie présente n'est pas dupliquée.

Les données de démonstration (`db:seed-demo`, `db:seed-espace`…) ne sont **pas** jouées en
production.

## 5. Vérifier

| Contrôle | Attendu |
|---|---|
| `https://<adresse>/api/sante` | `{"statut":"ok"}` |
| `https://<adresse>/` | le site vitrine de HOPE (accueil) |
| `https://<adresse>/authentification` | la page de connexion des donateurs, bénévoles et bailleurs |
| `https://<adresse>/admin/login` | connexion avec `ADMIN_LOG` / `ADMIN_PASSWORD` |
| inscription d'un donateur | la case de consentement est exigée, le compte s'ouvre |
| « Mot de passe oublié ? » | un courriel arrive (si SMTP est configuré) |
| une photo téléversée, puis un redéploiement | la photo est toujours là (volume monté) |

### Dépannage

| Message dans Railway | Cause et remède |
|---|---|
| `Script start.sh not found` / `Railpack could not determine how to build the app` | Le service construit la racine du dépôt. **Settings → Root Directory** : `AppHopePlat`, puis redéployer. |
| Le site répond, mais la base reste vide (« You have no tables ») | La *Pre-deploy Command* manque : **Settings → Deploy → Pre-deploy Command** : `npm run db:preparer`, puis redéployer. Ou, une fois : `npm run db:premier-deploiement` dans l'onglet **Console** du service. |
| Railway affiche « successful » puis « Crashed » | Sans *Healthcheck Path*, Railway valide dès le démarrage du conteneur : lire les dernières lignes `[HOPE]` du journal (**Deploy Logs**). |
| Le service redémarre en boucle au démarrage | Une variable obligatoire manque (section 2) : les journaux du déploiement la nomment. |

## 6. Ensuite

- **Chaque envoi sur la branche suivie redéploie** : la migration passe avant la mise en ligne,
  et Railway garde l'ancienne version tant que la nouvelle ne répond pas sur `/api/sante`.
- **L'intégration continue** (GitHub Actions, `.github/workflows/ci.yml` à la racine du dépôt)
  relit le code, applique le schéma sur une base neuve, lance les tests et construit le
  frontend à chaque envoi : ne fusionner sur `main` qu'avec une coche verte.
- **Surveillance** : en production, chaque requête écrit une ligne JSON dans les journaux de
  Railway (méthode, chemin sans paramètres, statut, durée) ; filtrer sur `"niveau":"erreur"`
  pour voir les pannes. Une erreur interne envoie en plus un courriel à `ALERTE_EMAIL`. Les
  actions de l'équipe sont dans le **journal d'audit** (Paramètres → Journal d'audit complet).
- **Sauvegardes** : dans le service PostgreSQL, onglet **Backups**, activer les sauvegardes
  automatiques (quotidiennes). En plus, une fois par mois, une copie conservée hors de Railway :

  ```bash
  railway link                      # le service PostgreSQL
  railway run pg_dump --format=custom --file=hope-$(date +%F).dump "$DATABASE_URL"
  ```

  Restaurer : `pg_restore --clean --no-owner --dbname "$DATABASE_URL" hope-AAAA-MM-JJ.dump`.
  Essayer une restauration sur une base de test une fois, pour savoir qu'elle marche.
- **Nom de domaine** : **Settings → Networking → Custom Domain**, puis mettre à jour
  `HOPE_SITE_URL`, `CORS_ORIGIN` et le webhook Stripe.
- **Textes légaux** : la politique de confidentialité et les conditions d'utilisation
  (`frontend/src/pages/Legal.jsx`) sont une base de travail ; les faire relire par le bureau de
  l'association avant l'ouverture au public. Si elles changent, changer aussi
  `VERSION_CONDITIONS` dans `backend/src/shared/conditions.js` et dans `Legal.jsx`.
