# Data and flows (MVP)

## Card identity

A **printing** is one physical version of a card: normal, alternate art,
signed, overnumbered, metal. Collections and decks are made of printings.
A **card** is the game object; printings of the same card share a `card_id`.

| Id           | Example                | Comes from                                                                     |
| ------------ | ---------------------- | ------------------------------------------------------------------------------ |
| `PrintingId` | `ogn-304-star-298`     | Riot's card id from the Riot API                                               |
| `CardId`     | `vi-piltover-enforcer` | Slug of the card's name and subtitle                                           |
| `CardCode`   | `UNL-229*`             | Derived from a `PrintingId` when importing or exporting deck codes; not stored |

`CardCode` is the [Piltover Archive deck code](https://github.com/Piltover-Archive/RiftboundDeckCodes)
format, derived from a `PrintingId` (`ogn-304-star-298` → `OGN-304*`).

## Data model (D1)

```mermaid
erDiagram
  user ||--o{ session : has
  user ||--o{ account : "signs in via"
  user ||--o{ collection_item : owns
  user ||--o{ deck : builds
  deck ||--o{ deck_card : contains
  user ||--o{ wishlist_item : wants
  printing ||--o{ collection_item : "is owned as"
  printing ||--o{ deck_card : "is used as"
  printing ||--o{ wishlist_item : "is wanted as"

  printing {
    text id PK "PrintingId"
    text card_id "CardId"
    text set
    int collector_number
    text variant "Base | AlternateArt | Signature | Overnumbered"
    text rarity
    text name
    text type
    text supertype
    json domains
    int energy
    int might
    int power
    json tags
    text text_rich
    text text_plain
    text flavour
    text artist
    text image_url
    text accessibility_text
    text orientation
    datetime source_updated_on
  }
  user {
    text id PK
    text name
    text email
  }
  collection_item {
    text user_id PK, FK
    text printing_id PK, FK
    int quantity
  }
  deck {
    text id PK
    text user_id FK
    text name
    text chosen_champion "printing id, optional"
  }
  deck_card {
    text deck_id PK, FK
    text printing_id PK, FK
    text section PK "main | sideboard"
    int count
  }
  wishlist_item {
    text user_id PK, FK
    text printing_id PK, FK
    int quantity "added by hand"
  }
```

- `user`, `session`, `account` and `verification` are Better Auth's tables (`src/worker/schema/auth.ts`, generated). Only the relevant columns are shown.
- `printing` exists from Phase 4; `collection_item`, `deck`, `deck_card` and `wishlist_item` arrive in Phases 6 to 8. Their exact columns are decided then.
- Deleting a user cascades to everything they own.

## Catalogue build

Card data comes from a swappable `CatalogueSource` service:

| Layer        | Data                                                        | Use                                       |
| ------------ | ----------------------------------------------------------- | ----------------------------------------- |
| Riot gallery | recorded feed pages in `catalogue/recordings/riot-gallery/` | development, now                          |
| Riftcodex    | recorded API pages in `catalogue/recordings/riftcodex/`     | development, later (needs conflict rules) |
| Riot API     | live `riftbound-content-v1` with `RIOT_API_KEY`             | the only source allowed for a public app  |

```mermaid
sequenceDiagram
  participant B as bun run catalogue:build
  participant S as CatalogueSource
  participant A as Alchemy (dev / deploy)
  participant DB as D1
  B->>S: printings
  S->>S: read the recording, parse every record strictly, map to Printing
  S->>S: run the checks
  alt every record parses and every check passes
    S-->>B: printings
    B->>B: write catalogue/printing.sql
  else anything fails
    S-->>B: every failing record
    B->>B: write nothing; the previous catalogue stays
  end
  A->>DB: import catalogue/printing.sql when it changed
```

**Checks:** every record matches the source's schema exactly (unknown fields
are an error); the id parses; set and collector number agree with the id;
every printing has a `card_id`; every id is unique. Any failure rejects the
whole build (all or nothing).

## Missing cards

For each printing:

```
needed  = sum of deck_card.count across all of the user's decks
missing = max(0, needed - collection_item.quantity)
wishlist line = missing + wishlist_item.quantity
```

The deck view groups lines by `card_id` for display; each line stays a
specific printing.

## Flows

### Startup

```mermaid
sequenceDiagram
  participant S as SPA
  participant W as Backend
  participant DB as D1
  S->>W: GET /api/me (session cookie)
  W->>DB: look up session
  alt signed in
    W-->>S: User
    S->>S: start in the signed-in area
  else no session
    W-->>S: 401
    S->>S: start in the signed-out area
  end
```

### Sign up and sign in

```mermaid
sequenceDiagram
  actor U as User
  participant S as SPA (AuthClient)
  participant W as Backend (Better Auth)
  participant DB as D1
  U->>S: submit the form
  S->>W: POST /api/auth/sign-up/email or /sign-in/email
  W->>DB: create user and account, or check the password
  W->>DB: create session
  W-->>S: user + session cookie
  S->>S: decode User, switch to the signed-in area
```

### Add an owned printing (Phase 6)

```mermaid
sequenceDiagram
  actor U as User
  participant S as SPA (ApiClient)
  participant W as Backend
  participant DB as D1
  U->>S: pick printing, set quantity
  S->>W: PUT /api/collection/{printingId} {quantity}
  W->>DB: upsert (0 deletes)
  W-->>S: ok
```

### Import a deck code (Phase 7)

```mermaid
sequenceDiagram
  actor U as User
  participant S as SPA
  participant W as Backend
  participant DB as D1
  U->>S: paste deck code
  S->>S: getDeckFromCode(code), CardCode to PrintingId
  S->>W: POST /api/decks {name, chosen_champion, cards}
  W->>DB: insert deck + deck_card rows
  W-->>S: deck id
```

### Send the wishlist to CardTrader (Phases 5 and 8)

```mermaid
sequenceDiagram
  actor U as User
  participant S as SPA
  participant B as Browser storage
  participant CT as CardTrader API
  S->>B: read token
  alt no token
    U->>S: paste token, choose tab-only or remember
    S->>B: store
  end
  S->>CT: GET /games (find Riftbound id)
  S->>CT: POST /wishlists (missing lines)
  CT-->>S: wishlist id
  S-->>U: link to the wishlist on CardTrader
```

## Open questions

1. The body CardTrader expects for `POST /wishlists`: set code and collector number, or its own blueprint ids (Phase 5).
2. Whether CardTrader's Riftbound expansion codes match `OGN`, `UNL`, …, and how it numbers alternate-art, signed and metal printings (Phase 5).
3. Where the Riot API publishes the official deckbuilding rules the deck builder must enforce (Phase 7).
4. Whether `riftbound-content-v1` includes promo printings and how it marks variants (4.1, with the development key).
