# Data and flows (MVP)

## Card identity

A card printing is identified by its **card code**, the format used by
[Piltover Archive deck codes](https://github.com/Piltover-Archive/RiftboundDeckCodes):

```
OGN-007a   set OGN, number 007, variant a (alternate art)
OGN-007s   signed (also written OGN-007*)
OGS-R01    rune
VEN-SP1    special
```

Riftcodex `riftbound_id` values look like `ogn-007a-298`. The card code is the
first two parts in upper case (`OGN-007a`).

## Data model (D1)

```mermaid
erDiagram
  user ||--o{ session : has
  user ||--o{ account : "signs in via"
  user ||--o{ collection_item : owns
  user ||--o{ deck : builds
  deck ||--o{ deck_card : contains
  user ||--o{ wishlist_item : wants

  user {
    text id PK
    text name
    text image
  }
  session {
    text id PK
    text user_id FK
    datetime expires_at
  }
  account {
    text id PK
    text user_id FK
    text provider_id "discord"
    text account_id "Discord user id"
  }
  collection_item {
    text user_id PK, FK
    text card_code PK "e.g. OGN-007a"
    int quantity
  }
  deck {
    text id PK
    text user_id FK
    text name
    text chosen_champion "card code, optional"
    datetime updated_at
  }
  deck_card {
    text deck_id PK, FK
    text card_code PK
    text section PK "main | sideboard"
    int count
  }
  wishlist_item {
    text user_id PK, FK
    text card_code PK
    int quantity "added by hand"
  }
```

- `user`, `session` and `account` belong to Better Auth. Their exact columns come from its schema; only the relevant ones are shown.
- `deck_card` rows have the same shape as the deck-code library's `{ cardCode, count }`, so import and export convert directly.
- "Missing" is calculated, not stored.

## Missing cards

For each card code:

```
needed  = sum of deck_card.count across all of the user's decks
missing = max(0, needed - collection_item.quantity)
wishlist line = missing + wishlist_item.quantity
```

The deck view groups lines by card (same name across printings) for display.
Each line stays a specific printing.

## Flows

### Sign in

```mermaid
sequenceDiagram
  actor U as User
  participant S as SPA
  participant W as Worker (Better Auth)
  participant D as Discord
  participant DB as D1
  U->>S: Sign in with Discord
  S->>W: GET /api/auth/sign-in/discord
  W-->>U: redirect to Discord
  U->>D: approve
  D-->>W: callback with code
  W->>D: exchange code, read profile
  W->>DB: upsert user + account, create session
  W-->>S: session cookie
```

### Load the app

```mermaid
sequenceDiagram
  participant S as SPA
  participant R as Riftcodex
  participant W as Worker
  participant DB as D1
  par
    S->>R: GET /cards (all pages, cached)
  and
    S->>W: GET /api/me/collection, /api/me/decks, /api/me/wishlist
    W->>DB: select by user_id
    W-->>S: rows
  end
  S->>S: work out missing, group by card
```

### Add an owned card

```mermaid
sequenceDiagram
  actor U as User
  participant S as SPA
  participant W as Worker
  participant DB as D1
  U->>S: pick printing, set quantity
  S->>W: PUT /api/me/collection/{card_code} {quantity}
  W->>DB: upsert (0 deletes)
  W-->>S: ok
```

### Import a deck code

```mermaid
sequenceDiagram
  actor U as User
  participant S as SPA
  participant W as Worker
  participant DB as D1
  U->>S: paste deck code
  S->>S: getDeckFromCode(code)
  S->>W: POST /api/me/decks {name, chosen_champion, cards}
  W->>DB: insert deck + deck_card rows
  W-->>S: deck id
```

### Send wishlist to CardTrader

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

## Open questions (the MVP answers these with a real token)

1. The body CardTrader expects for `POST /wishlists`: card codes (`expansion_code` + `collector_number`), or its own blueprint ids.
2. Whether CardTrader's Riftbound expansion codes match `OGN`, `UNL`, …
3. How CardTrader numbers alt-art and signed printings.
4. **Card codes aren't unique.** Riftcodex has `opp-013-024` and `opp-013-298`, and both become `OPP-013`. Promo sets (`PR`, `OPP`, `JDG`) also can't go into deck codes.
5. Whether Better Auth can skip saving Discord OAuth tokens (no option for this found; `databaseHooks` may work), and whether `user.email` is required.
