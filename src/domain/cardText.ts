import { Array, Match, Number, Option, Result, String, pipe } from 'effect'

import type { Domain } from './printing'

export type Symbol =
  | Readonly<{ _tag: 'Energy'; amount: number }>
  | Readonly<{ _tag: 'Might' }>
  | Readonly<{ _tag: 'Exhaust' }>
  | Readonly<{ _tag: 'Rune'; maybeDomain: Option.Option<Domain> }>

export type Inline =
  | Readonly<{ _tag: 'Text'; text: string }>
  | Readonly<{ _tag: 'Symbol'; symbol: Symbol }>
  | Readonly<{ _tag: 'Keyword'; name: string; label: string }>
  | Readonly<{ _tag: 'LineBreak' }>

export type Block =
  | Readonly<{ _tag: 'Paragraph'; content: ReadonlyArray<Inline> }>
  | Readonly<{ _tag: 'List'; items: ReadonlyArray<ReadonlyArray<Inline>> }>

export type CardText = ReadonlyArray<Block>

type TagName = 'p' | 'br' | 'ul' | 'li'

type Token =
  | Readonly<{ _tag: 'Open'; name: TagName }>
  | Readonly<{ _tag: 'Close'; name: TagName }>
  | Readonly<{ _tag: 'Chunk'; text: string }>

type Parsed<A> = Result.Result<A, string>

const TOKEN_PATTERN = /<(\/?)([a-z]+)\s*(\/?)>|[^<]+/g
const ENTITY_PATTERN = /&[a-z#0-9]+;/g
const INLINE_PATTERN = /(:rb_[a-z0-9_]+:|\[[A-Z][A-Za-z' ]*?(?: \d+)?\])/
const SYMBOL_PATTERN = /^:rb_([a-z0-9_]+):$/
const KEYWORD_PATTERN = /^\[([A-Z][A-Za-z' ]*?)(?: \d+)?\]$/

const ENTITIES: Readonly<Record<string, string>> = {
  '&gt;': '>',
  '&lt;': '<',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
}

const RUNE_DOMAINS: Readonly<Record<string, Domain>> = {
  fury: 'Fury',
  calm: 'Calm',
  mind: 'Mind',
  body: 'Body',
  chaos: 'Chaos',
  order: 'Order',
}

const isTagName = (name: string): name is TagName =>
  name === 'p' || name === 'br' || name === 'ul' || name === 'li'

// TOKENS

const toToken = (match: RegExpMatchArray): Parsed<ReadonlyArray<Token>> => {
  const [whole, closing, name, selfClosing] = match

  if (name === undefined) {
    return Result.succeed([{ _tag: 'Chunk', text: whole }])
  } else if (!isTagName(name)) {
    return Result.fail(`Unsupported tag <${name}>`)
  } else if (closing === '/') {
    return Result.succeed([{ _tag: 'Close', name }])
  } else if (selfClosing === '/' || name === 'br') {
    return Result.succeed([
      { _tag: 'Open', name },
      { _tag: 'Close', name },
    ])
  } else {
    return Result.succeed([{ _tag: 'Open', name }])
  }
}

const tokenize = (html: string): Parsed<ReadonlyArray<Token>> =>
  pipe(
    Array.fromIterable(html.matchAll(TOKEN_PATTERN)),
    Array.map(toToken),
    Result.all,
    Result.map(Array.flatten),
  )

// INLINE

const decodeEntity = (entity: string): Parsed<string> =>
  Option.match(Option.fromNullishOr(ENTITIES[entity]), {
    onNone: () => Result.fail(`Unknown entity ${entity}`),
    onSome: Result.succeed,
  })

const decodeEntities = (text: string): Parsed<string> =>
  pipe(
    Array.fromIterable(text.matchAll(ENTITY_PATTERN)),
    Array.map(([entity]) => decodeEntity(entity)),
    Result.all,
    Result.map(() =>
      text.replace(ENTITY_PATTERN, entity => ENTITIES[entity] ?? entity),
    ),
  )

const unknownSymbol = (code: string): Parsed<Symbol> =>
  Result.fail(`Unknown symbol :rb_${code}:`)

const parseSymbol = (code: string): Parsed<Symbol> =>
  Match.value(code).pipe(
    Match.withReturnType<Parsed<Symbol>>(),
    Match.when('might', () => Result.succeed({ _tag: 'Might' })),
    Match.when('exhaust', () => Result.succeed({ _tag: 'Exhaust' })),
    Match.when('rune_rainbow', () =>
      Result.succeed({ _tag: 'Rune', maybeDomain: Option.none() }),
    ),
    Match.when(String.startsWith('rune_'), runeCode =>
      Option.match(
        Option.fromNullishOr(RUNE_DOMAINS[String.slice(5)(runeCode)]),
        {
          onNone: () => unknownSymbol(code),
          onSome: domain =>
            Result.succeed({ _tag: 'Rune', maybeDomain: Option.some(domain) }),
        },
      ),
    ),
    Match.when(String.startsWith('energy_'), energyCode =>
      Option.match(Number.parse(String.slice(7)(energyCode)), {
        onNone: () => unknownSymbol(code),
        onSome: amount => Result.succeed({ _tag: 'Energy', amount }),
      }),
    ),
    Match.orElse(() => unknownSymbol(code)),
  )

const parsePart = (part: string): Parsed<ReadonlyArray<Inline>> => {
  const maybeSymbol = Option.fromNullishOr(SYMBOL_PATTERN.exec(part)?.[1])
  const maybeKeyword = Option.fromNullishOr(KEYWORD_PATTERN.exec(part)?.[1])

  if (Option.isSome(maybeSymbol)) {
    return Result.map(parseSymbol(maybeSymbol.value), symbol => [
      { _tag: 'Symbol', symbol },
    ])
  } else if (Option.isSome(maybeKeyword)) {
    return Result.succeed([
      { _tag: 'Keyword', name: maybeKeyword.value, label: part.slice(1, -1) },
    ])
  } else if (String.isEmpty(part)) {
    return Result.succeed([])
  } else {
    return Result.succeed([{ _tag: 'Text', text: part }])
  }
}

const parseChunk = (raw: string): Parsed<ReadonlyArray<Inline>> =>
  pipe(
    decodeEntities(raw),
    Result.flatMap(text =>
      pipe(
        String.split(INLINE_PATTERN)(text),
        Array.map(parsePart),
        Result.all,
      ),
    ),
    Result.map(Array.flatten),
  )

const parseInline = (
  tokens: ReadonlyArray<Token>,
): Parsed<ReadonlyArray<Inline>> =>
  pipe(
    tokens,
    Array.map((token): Parsed<ReadonlyArray<Inline>> =>
      Match.value(token).pipe(
        Match.withReturnType<Parsed<ReadonlyArray<Inline>>>(),
        Match.tag('Chunk', ({ text }) => parseChunk(text)),
        Match.when({ _tag: 'Open', name: 'br' }, () =>
          Result.succeed([{ _tag: 'LineBreak' }]),
        ),
        Match.when({ _tag: 'Close', name: 'br' }, () => Result.succeed([])),
        Match.orElse(({ name }) =>
          Result.fail(`Unexpected <${name}> inside text`),
        ),
      ),
    ),
    Result.all,
    Result.map(Array.flatten),
  )

// BLOCKS

const isClose =
  (name: TagName) =>
  (token: Token): boolean =>
    token._tag === 'Close' && token.name === name

const splitAtClose = (
  tokens: ReadonlyArray<Token>,
  name: TagName,
): Parsed<
  Readonly<{ inner: ReadonlyArray<Token>; rest: ReadonlyArray<Token> }>
> =>
  Option.match(Array.findFirstIndex(tokens, isClose(name)), {
    onNone: () => Result.fail(`Missing </${name}>`),
    onSome: index =>
      Result.succeed({
        inner: Array.take(tokens, index),
        rest: Array.drop(tokens, index + 1),
      }),
  })

const parseListItems = (
  tokens: ReadonlyArray<Token>,
): Parsed<ReadonlyArray<ReadonlyArray<Inline>>> =>
  Array.match(tokens, {
    onEmpty: () => Result.succeed([]),
    onNonEmpty: ([head, ...tail]) => {
      if (head._tag !== 'Open' || head.name !== 'li') {
        return Result.fail('Expected <li> inside <ul>')
      } else {
        return Result.gen(function* () {
          const { inner, rest } = yield* splitAtClose(tail, 'li')
          const item = yield* parseInline(inner)
          const items = yield* parseListItems(rest)
          return [item, ...items]
        })
      }
    },
  })

const parseBlocks = (tokens: ReadonlyArray<Token>): Parsed<CardText> =>
  Array.match(tokens, {
    onEmpty: () => Result.succeed([]),
    onNonEmpty: ([head, ...tail]) =>
      Result.gen(function* () {
        if (head._tag === 'Open' && head.name === 'p') {
          const { inner, rest } = yield* splitAtClose(tail, 'p')
          const content = yield* parseInline(inner)
          const blocks = yield* parseBlocks(rest)
          return [{ _tag: 'Paragraph', content }, ...blocks]
        } else if (head._tag === 'Open' && head.name === 'ul') {
          const { inner, rest } = yield* splitAtClose(tail, 'ul')
          const items = yield* parseListItems(inner)
          const blocks = yield* parseBlocks(rest)
          return [{ _tag: 'List', items }, ...blocks]
        } else {
          return yield* Result.fail('Expected <p> or <ul>')
        }
      }),
  })

// PUBLIC

export const parse = (html: string): Parsed<CardText> =>
  Result.flatMap(tokenize(html), parseBlocks)

const inlinesOf = (block: Block): ReadonlyArray<Inline> =>
  Match.value(block).pipe(
    Match.tagsExhaustive({
      Paragraph: ({ content }) => content,
      List: ({ items }) => Array.flatten(items),
    }),
  )

export const keywords = (text: CardText): ReadonlyArray<string> =>
  pipe(
    text,
    Array.flatMap(inlinesOf),
    Array.filterMap(inline =>
      inline._tag === 'Keyword' ? Result.succeed(inline.name) : Result.failVoid,
    ),
    Array.dedupe,
  )

export const symbolLabel = (symbol: Symbol): string =>
  Match.value(symbol).pipe(
    Match.tagsExhaustive({
      Energy: ({ amount }) => `${amount} energy`,
      Might: () => 'might',
      Exhaust: () => 'exhaust',
      Rune: ({ maybeDomain }) =>
        Option.match(maybeDomain, {
          onNone: () => 'any rune',
          onSome: domain => `${domain} rune`,
        }),
    }),
  )

const inlineText = (inline: Inline): string =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      Text: ({ text }) => text,
      Symbol: ({ symbol }) => symbolLabel(symbol),
      Keyword: ({ label }) => label,
      LineBreak: () => ' ',
    }),
  )

export const plainText = (text: CardText): string =>
  pipe(
    text,
    Array.map(block => Array.join(Array.map(inlinesOf(block), inlineText), '')),
    Array.join(' '),
  )
