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

  Home --> Collection[Collection: summary per set, owned cards]
  Home -. hover or tap a card .-> CardPanel[Card panel: every printing, owned amount, − / +]
  Collection -. hover or tap a card .-> CardPanel
  CardPanel --> CardPage

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
  CardPage --> CardInfo[Every printing with owned amount and − / +, decks using this card]

  Home --> Wishlist[Wishlist]
  Wishlist --> WishlistContent[Missing from decks + cards added by hand]
  Wishlist --> Send{CardTrader token in this browser?}
  Send -- no --> PasteToken[Paste token: this tab only / remember on this device]
  PasteToken --> Push
  Send -- yes --> Push[Send to CardTrader wishlist]
  Push --> CardTrader[Open CardTrader: Shop Optimizer, pay there]
```

## In the MVP

- A public home page at `/` explains the app; everything else is behind sign-in (email and password accounts with a display name)
- Card catalogue: browse and search every printing
- Collection: owned printings with quantities, changed from the card page or the card panel (hover or tap any card). The Cards page (`/cards`) is both the catalogue and the collection: a switch shows All cards, My collection (with a summary per set) or Wanted (what decks miss plus the custom wishlist); each card shows how many you own and how many you need
- The catalogue, the collection and decks show one entry per card; every printing of a card is in its panel and page
- Decks: create, duplicate, delete, import and export Piltover Archive deck codes. The deck page checks the official deckbuilding rules as you build (progress per part, problems explained), shows one tile per version with capped Main / Side counters, and has deck stats and card search side by side (a bottom sheet on phones)
- Missing cards: what all decks need combined, minus what you own
- Card page and hover: owned printings and the decks that use the card
- Wishlists: one per deck (what it misses, kept up to date) plus a custom one for cards added by hand. Marking cards as bought adds them to the collection. With the user's own CardTrader token, a wishlist can be created on CardTrader and synced by hand, and a CardTrader wishlist can be imported into the custom one

## Later

- Collection CSV import/export (Piltover Archive format)
- Prices
- Foil, language and condition on owned copies
- Public deck links
- Discord sign-in and account linking
- Email verification and password reset
