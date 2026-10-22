# User flows (MVP)

What a player can do in the first version.

```mermaid
flowchart TD
  Start([Open app]) --> SignedIn{Signed in?}
  SignedIn -- no --> SignIn[Sign in: email + password]
  SignIn -. no account .-> SignUp[Sign up: display name, email, password]
  SignUp --> Home
  SignIn --> Home
  SignedIn -- yes --> Home[Catalogue]
  Home --> SignOut[Sign out]

  Home --> CardPage

  Home --> Collection[Collection]
  Collection --> AddOwned[Search card, pick printing, set quantity]

  Home --> Decks[Decks]
  Decks --> NewDeck[Create deck]
  Decks --> ImportDeck[Import deck code]
  NewDeck --> DeckView
  ImportDeck --> DeckView[Deck view: one line per card, e.g. 3× Vi]
  DeckView --> DeckCardDetail[Card detail: choose printing per copy]
  DeckView --> Status[Owned / needed / missing per card]
  DeckView --> ExportDeck[Copy deck code]

  Home --> CardPage[Card page]
  DeckView -. hover .-> CardPage
  CardPage --> CardInfo[Printings owned + decks using this card]

  Home --> Wishlist[Wishlist]
  Wishlist --> WishlistContent[Missing from decks + cards added by hand]
  Wishlist --> Send{CardTrader token in this browser?}
  Send -- no --> PasteToken[Paste token: this tab only / remember on this device]
  PasteToken --> Push
  Send -- yes --> Push[Send to CardTrader wishlist]
  Push --> CardTrader[Open CardTrader: Shop Optimizer, pay there]
```

## In the MVP

- Email and password accounts with a display name; the whole app is behind sign-in
- Card catalogue: browse and search every printing
- Collection: owned printings with quantities
- Decks: create, import and export Piltover Archive deck codes, one line per card with printings in the detail view
- Missing cards: what all decks need combined, minus what you own
- Card page and hover: owned printings and the decks that use the card
- Wishlist: missing cards plus cards added by hand, sent to a CardTrader wishlist with the user's own token

## Later

- Collection CSV import/export (Piltover Archive format)
- Deck rule checks
- Prices
- Foil, language and condition on owned copies
- Public deck links
- Discord sign-in and account linking
- Email verification and password reset
