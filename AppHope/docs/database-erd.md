# HOPE — Diagramme entité-association

Base : `hope_donations` (PostgreSQL). 15 tables.
Description détaillée de chaque colonne : [`database.md`](database.md).

---

## Diagramme complet

```mermaid
erDiagram
    DONOR ||--o{ DONATION : "s'engage par"
    DONATION ||--o{ TRANSACTION : "genere"
    PAYMENT_METHOD ||--o{ TRANSACTION : "utilisee par"
    DONATION ||--o{ DONATION_ALLOCATION : "repartie en"
    PROJECT ||--o{ DONATION_ALLOCATION : "recoit"
    PROJECT_CATEGORY ||--o{ PROJECT : "classe"
    PROJECT ||--o{ PROJECT_BUDGET : "planifie"
    PROJECT_BUDGET ||--o{ BUDGET_ITEM : "detaille"
    PROJECT ||--o{ EXPENSE : "depense"
    PROJECT_BUDGET ||--o{ EXPENSE : "impute"
    BUDGET_ITEM ||--o{ EXPENSE : "impute"
    EXPENSE ||--o{ SUPPORTING_DOCUMENT : "justifiee par"
    PROJECT ||--o{ PROJECT_BENEFICIARY : "accompagne"
    BENEFICIARY ||--o{ PROJECT_BENEFICIARY : "participe a"
    PROJECT ||--o{ IMPACT : "mesure"
    BENEFICIARY ||--o{ IMPACT : "concerne par"

    DONOR {
        uuid id PK
        varchar first_name
        varchar last_name
        varchar organization_name "nullable"
        varchar email UK
        varchar phone
        enum donor_type "INDIVIDUAL COMPANY FOUNDATION ORGANIZATION PARTNER"
        char country "ISO 3166-1 alpha-2"
        char preferred_currency "ISO 4217"
        varchar preferred_language "nullable"
        varchar timezone "nullable"
        text address "nullable"
        varchar city "nullable"
        varchar profession "nullable"
        varchar website "nullable"
        varchar discovery_source "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    DONATION {
        uuid id PK
        varchar reference UK "HOPE-DON-AAAAMMJJ-XXXXXX"
        uuid donor_id FK
        enum donation_type "ONE_TIME RECURRING"
        enum status "DRAFT ACTIVE COMPLETED CANCELLED"
        char currency
        decimal expected_amount "18,2 - par echeance"
        date start_date "nullable"
        date end_date "nullable"
        enum frequency "MONTHLY QUARTERLY YEARLY - nullable"
        date next_payment_date "nullable"
        text notes "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    PAYMENT_METHOD {
        uuid id PK
        varchar code UK "MVOLA ORANGE_MONEY CARD ..."
        varchar name
        varchar provider "MOCK puis STRIPE MVOLA ..."
        enum scope "LOCAL INTERNATIONAL BOTH"
        boolean is_active
        char_array supported_currencies "vide = aucune restriction"
        text description "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTION {
        uuid id PK
        uuid donation_id FK
        uuid payment_method_id FK
        decimal amount "18,2"
        char currency
        enum status "PENDING PROCESSING SUCCESS FAILED CANCELLED REFUNDED"
        varchar provider_reference "nullable - reference opaque"
        varchar internal_reference UK "HOPE-TXN-AAAAMMJJ-XXXXXX"
        int installment_number "nullable - numero d echeance"
        timestamptz transaction_date "nullable"
        text failure_reason "nullable"
        decimal refunded_amount "18,2 - defaut 0"
        timestamptz refunded_at "nullable"
        text refund_reason "nullable"
        jsonb metadata "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    DONATION_ALLOCATION {
        uuid id PK
        uuid donation_id FK
        uuid project_id FK
        decimal amount "18,2"
        char currency
        enum allocation_type "DONOR_DESIGNATED HOPE_ALLOCATED"
        timestamptz allocated_at
        text notes "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    PROJECT_CATEGORY {
        uuid id PK
        varchar name UK
        text description "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    PROJECT {
        uuid id PK
        varchar code UK "HOPE-PRJ-AAAAMMJJ-XXXXXX"
        uuid category_id FK
        varchar name
        text description
        varchar location "nullable"
        varchar manager_name "nullable"
        date start_date "nullable"
        date end_date "nullable"
        enum status "DRAFT ACTIVE COMPLETED SUSPENDED CANCELLED"
        varchar photo_url "nullable"
        varchar video_url "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    PROJECT_BUDGET {
        uuid id PK
        uuid project_id FK
        varchar name
        decimal total_amount "18,2"
        char currency
        date start_date "nullable"
        date end_date "nullable"
        enum status "DRAFT ACTIVE CLOSED CANCELLED"
        timestamptz created_at
        timestamptz updated_at
    }

    BUDGET_ITEM {
        uuid id PK
        uuid budget_id FK
        varchar name
        text description "nullable"
        decimal planned_amount "18,2"
        timestamptz created_at
        timestamptz updated_at
    }

    EXPENSE {
        uuid id PK
        varchar reference UK "HOPE-EXP-AAAAMMJJ-XXXXXX"
        uuid project_id FK
        uuid budget_id FK "nullable"
        uuid budget_item_id FK "nullable"
        decimal amount "18,2"
        char currency
        text description
        date expense_date
        enum status "DRAFT VALIDATED PAID CANCELLED"
        timestamptz validated_at "nullable"
        timestamptz paid_at "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    SUPPORTING_DOCUMENT {
        uuid id PK
        uuid expense_id FK
        enum document_type "INVOICE RECEIPT BANK_PROOF CONTRACT OTHER"
        varchar file_name
        varchar file_path
        varchar mime_type "nullable"
        int file_size "nullable"
        varchar reference "nullable - numero de facture"
        date issued_at "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    BENEFICIARY {
        uuid id PK
        varchar reference UK "HOPE-BEN-AAAAMMJJ-XXXXXX"
        varchar first_name "nullable"
        varchar last_name "nullable"
        enum beneficiary_type "ORPHAN SINGLE_MOTHER FAMILY OTHER"
        enum gender "MALE FEMALE OTHER UNDISCLOSED - nullable"
        date birth_date "nullable"
        char country
        varchar city "nullable"
        enum status "ACTIVE INACTIVE GRADUATED WITHDRAWN"
        text notes "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    PROJECT_BENEFICIARY {
        uuid id PK
        uuid project_id FK
        uuid beneficiary_id FK
        timestamptz joined_at
        timestamptz left_at "nullable"
        enum status "ACTIVE COMPLETED LEFT SUSPENDED"
        text notes "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    IMPACT {
        uuid id PK
        uuid project_id FK
        uuid beneficiary_id FK "nullable"
        varchar title
        text description
        varchar indicator "nullable - women_trained ..."
        decimal value "18,4 - nullable"
        varchar unit "nullable - persons percent ..."
        date measured_at
        timestamptz created_at
        timestamptz updated_at
    }

    AUDIT_LOG {
        uuid id PK
        varchar entity_type "TRANSACTION DONATION EXPENSE ..."
        uuid entity_id
        varchar action "TRANSACTION_CONFIRMED ..."
        jsonb old_data "nullable"
        jsonb new_data "nullable"
        uuid actor_id "nullable - reserve a l authentification future"
        timestamptz created_at
    }
```

> `AUDIT_LOG` n'a volontairement **aucune clé étrangère** : c'est un journal
> transverse qui référence n'importe quelle entité par le couple
> `(entity_type, entity_id)`, et qui doit survivre à ce qu'il trace.

---

## Le cœur financier

Le sous-ensemble à comprendre en premier : comment l'argent circule d'un donateur
jusqu'à une dépense justifiée.

```mermaid
flowchart TD
    A["DONOR<br/>Tiana, Madagascar"] --> B["DONATION<br/>engagement : 100 000 MGA<br/>(aucun argent encore)"]
    B --> C["TRANSACTION<br/>PENDING<br/>via MVola"]
    C -->|"confirmation"| D["TRANSACTION<br/>SUCCESS<br/>100 000 MGA encaisses"]
    C -->|"echec"| E["TRANSACTION<br/>FAILED<br/>0 MGA - statut final"]
    D --> F["DONATION_ALLOCATION<br/>70 000 MGA -> Projet A"]
    D --> G["30 000 MGA<br/>non affectes"]
    F --> H["PROJECT<br/>tresorerie : 70 000 MGA"]
    H --> I["EXPENSE<br/>50 000 MGA<br/>DRAFT -> VALIDATED -> PAID"]
    I --> J["SUPPORTING_DOCUMENT<br/>facture, recu"]
    H --> K["fonds restants<br/>20 000 MGA"]

    style D fill:#d7f5dd,stroke:#2f7a44,color:#123
    style E fill:#fadcdc,stroke:#a33,color:#123
    style B fill:#e6ecfb,stroke:#3355aa,color:#123
    style G fill:#fdf3d7,stroke:#a5872a,color:#123
    style K fill:#fdf3d7,stroke:#a5872a,color:#123
```

**Points à retenir**

- entre `DONATION` et `TRANSACTION`, aucun argent n'existe encore ;
- seule la branche `SUCCESS` alimente les fonds : `FAILED` apporte 0 et reste dans
  l'historique ;
- `DONATION_ALLOCATION` ne peut jamais dépasser ce que `TRANSACTION` a réellement
  apporté ;
- `EXPENSE` est plafonnée à la fois par la trésorerie du projet **et** par le budget.

---

## Cycles de vie

```mermaid
stateDiagram-v2
    direction LR
    state "TRANSACTION" as T {
        [*] --> PENDING
        PENDING --> PROCESSING
        PENDING --> SUCCESS
        PENDING --> FAILED
        PENDING --> CANCELLED
        PROCESSING --> SUCCESS
        PROCESSING --> FAILED
        PROCESSING --> CANCELLED
        SUCCESS --> REFUNDED
        FAILED --> [*]
        CANCELLED --> [*]
        REFUNDED --> [*]
    }
```

`FAILED → SUCCESS` et `SUCCESS → CANCELLED` sont **absents du diagramme parce qu'ils
sont interdits** : une tentative échouée ne redevient jamais réussie, et de l'argent
encaissé se rembourse au lieu de s'annuler.

```mermaid
stateDiagram-v2
    direction LR
    state "DONATION" as D {
        [*] --> DRAFT
        DRAFT --> ACTIVE
        DRAFT --> CANCELLED
        ACTIVE --> COMPLETED
        ACTIVE --> CANCELLED
    }
```

```mermaid
stateDiagram-v2
    direction LR
    state "EXPENSE" as E {
        [*] --> DRAFT
        DRAFT --> VALIDATED
        DRAFT --> CANCELLED
        VALIDATED --> PAID
        VALIDATED --> CANCELLED
    }
```

`PAID` est final : l'argent est sorti, une correction passe par une écriture
compensatoire.

```mermaid
stateDiagram-v2
    direction LR
    state "PROJECT" as P {
        [*] --> DRAFT
        DRAFT --> ACTIVE
        DRAFT --> CANCELLED
        ACTIVE --> SUSPENDED
        SUSPENDED --> ACTIVE
        ACTIVE --> COMPLETED
        ACTIVE --> CANCELLED
        SUSPENDED --> CANCELLED
    }
```
