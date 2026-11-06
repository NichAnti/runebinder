import { Array, Option, Record } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Printing } from '../../../../domain'
import { signInRouter, signUpHref } from '../../../../route'
import { Badge, CardTile, Icon, Link } from '../../../../ui'
import type { Message } from './message'
import type { Model } from './model'
import { SHOWCASE } from './showcase'

const printingOf = (
  model: Model,
  printingId: Printing.PrintingId,
): Option.Option<Printing.Printing> =>
  model.showcase._tag === 'Ready'
    ? Record.get(model.showcase.printings, printingId)
    : Option.none()

const PORTRAIT = 'aspect-[744/1039]'
const LANDSCAPE = 'aspect-[1039/744]'

const artView = (
  model: Model,
  printingId: Printing.PrintingId,
  className: string,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(printingOf(model, printingId), {
    onNone: () =>
      h.div([
        h.AriaHidden(true),
        h.Class(`${className} ${PORTRAIT} bg-surface-raised`),
      ]),
    onSome: printing =>
      h.img([
        h.Src(printing.imageUrl),
        h.Alt(''),
        h.Class(
          `${className} ${printing.orientation === 'Landscape' ? LANDSCAPE : PORTRAIT} bg-surface-raised object-contain`,
        ),
      ]),
  })

const tileView = (
  model: Model,
  printingId: Printing.PrintingId,
  highlights: ReadonlyArray<string>,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(printingOf(model, printingId), {
    onNone: () =>
      h.div([
        h.AriaHidden(true),
        h.Class(`${PORTRAIT} w-full rounded-card bg-surface-raised`),
      ]),
    onSome: printing =>
      CardTile.view(
        {
          imageUrl: printing.imageUrl,
          imageAlt: Option.getOrElse(
            printing.maybeAccessibilityText,
            () => printing.name,
          ),
          title: printing.name,
          maybeSubtitle: printing.maybeSubtitle,
          domains: printing.domains,
          meta: '',
          highlights,
        },
        h,
      ),
  })

const ctaView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex flex-col gap-2')],
    [
      h.div(
        [h.Class('flex flex-wrap gap-3')],
        [
          Link.view(
            {
              href: signUpHref(),
              content: ['Join with an invite'],
              variant: 'Primary',
            },
            h,
          ),
          Link.view(
            {
              href: signInRouter(),
              content: ['Sign in'],
              variant: 'Secondary',
            },
            h,
          ),
        ],
      ),
      h.p(
        [h.Class('text-sm text-fg-muted')],
        ['Invite only for now: ask a friend who uses it for an invite link.'],
      ),
    ],
  )

// HERO

const heroView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.section(
    [
      h.AriaLabel('Introduction'),
      h.Class('grid items-center gap-12 lg:grid-cols-[1fr_auto]'),
    ],
    [
      h.div(
        [h.Class('flex max-w-xl flex-col gap-6')],
        [
          h.p(
            [h.Class('text-sm font-semibold text-accent')],
            ['For Riftbound players'],
          ),
          h.h1(
            [
              h.Class(
                'text-4xl font-semibold tracking-tight text-balance sm:text-5xl',
              ),
            ],
            ['Your Riftbound collection, decks and shopping list in one place'],
          ),
          h.p(
            [h.Class('text-lg text-fg-muted')],
            [
              'Track the cards you own, build decks that follow the official rules, and see exactly which cards you still need. When you are ready to buy, send the list to CardTrader.',
            ],
          ),
          ctaView(h),
        ],
      ),
      h.div(
        [h.AriaHidden(true), h.Class('flex justify-center px-8 py-4')],
        [
          artView(
            model,
            SHOWCASE.champion,
            'w-32 -rotate-6 rounded-card shadow-raised sm:w-44',
            h,
          ),
          artView(
            model,
            SHOWCASE.legend,
            'relative z-10 -mx-10 w-36 -translate-y-4 rounded-card shadow-raised sm:w-48',
            h,
          ),
          artView(
            model,
            SHOWCASE.unit,
            'w-32 rotate-6 rounded-card shadow-raised sm:w-44',
            h,
          ),
        ],
      ),
    ],
  )

// HOW IT WORKS

type Step = Readonly<{ title: string; text: string }>

const STEPS: ReadonlyArray<Step> = [
  {
    title: 'Track what you own',
    text: 'Count the cards in your binder, version by version.',
  },
  {
    title: 'Build a deck',
    text: 'Pick a legend and add cards. The rules are checked as you go.',
  },
  {
    title: 'See what is missing',
    text: 'Every deck lists the cards you still need.',
  },
  {
    title: 'Buy and tick them off',
    text: 'Order on CardTrader, then mark the cards as bought.',
  },
]

const stepsView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.AriaLabel('How it works'), h.Class('flex flex-col gap-6')],
    [
      h.h2([h.Class('text-2xl font-semibold')], ['How it works']),
      h.ol(
        [h.Class('grid gap-4 sm:grid-cols-2 lg:grid-cols-4')],
        Array.map(STEPS, ({ title, text }, index) =>
          h.li(
            [
              h.Class(
                'flex flex-col gap-2 rounded-card border border-border bg-surface p-4',
              ),
            ],
            [
              h.span(
                [
                  h.AriaHidden(true),
                  h.Class(
                    'flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg',
                  ),
                ],
                [`${index + 1}`],
              ),
              h.h3([h.Class('font-semibold')], [title]),
              h.p([h.Class('text-sm text-fg-muted')], [text]),
            ],
          ),
        ),
      ),
      h.p(
        [h.Class('flex items-center gap-2 text-sm text-fg-muted')],
        [
          Icon.view({ name: 'ArrowPath', size: 'Small' }),
          'Cards you buy join your collection, so every deck and wishlist stays up to date.',
        ],
      ),
    ],
  )

// FEATURES

type Feature = Readonly<{
  title: string
  lead: string
  points: ReadonlyArray<string>
  visual: Html
  isReversed: boolean
}>

const featureView = (
  { title, lead, points, visual, isReversed }: Feature,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.AriaLabel(title), h.Class('grid items-center gap-10 lg:grid-cols-2')],
    [
      h.div(
        [h.Class('flex flex-col gap-4')],
        [
          h.h2([h.Class('text-2xl font-semibold')], [title]),
          h.p([h.Class('text-lg text-fg-muted')], [lead]),
          h.ul(
            [h.Class('flex flex-col gap-2')],
            Array.map(points, point =>
              h.li(
                [h.Class('flex items-start gap-2 text-sm')],
                [
                  h.span(
                    [h.Class('mt-0.5 text-accent')],
                    [Icon.view({ name: 'Check', size: 'Small' })],
                  ),
                  point,
                ],
              ),
            ),
          ),
        ],
      ),
      h.div(
        [
          h.AriaHidden(true),
          h.Class(
            `rounded-card border border-border bg-surface p-5 ${isReversed ? 'lg:order-first' : ''}`,
          ),
        ],
        [visual],
      ),
    ],
  )

const trackVisual = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('grid grid-cols-3 gap-3')],
    [
      tileView(model, SHOWCASE.owned, ['Owned 2'], h),
      tileView(model, SHOWCASE.needed, ['Need 1'], h),
      tileView(model, SHOWCASE.partly, ['Owned 1', 'Need 1'], h),
    ],
  )

type Progress = Readonly<{ label: string; count: number; total: number }>

const PROGRESS: ReadonlyArray<Progress> = [
  { label: 'Main deck', count: 34, total: 40 },
  { label: 'Runes', count: 12, total: 12 },
  { label: 'Battlefields', count: 2, total: 3 },
]

const progressRowView = (
  { label, count, total }: Progress,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex flex-col gap-1')],
    [
      h.div(
        [h.Class('flex justify-between text-sm')],
        [
          h.span([], [label]),
          h.span(
            [h.Class('tabular-nums text-fg-muted')],
            [`${count} / ${total}`],
          ),
        ],
      ),
      h.div(
        [h.Class('h-2 overflow-hidden rounded-full bg-surface-raised')],
        [
          h.div([
            h.Class(
              `h-full rounded-full ${count === total ? 'bg-success' : 'bg-accent'}`,
            ),
            h.Style({ width: `${Math.round((count / total) * 100)}%` }),
          ]),
        ],
      ),
    ],
  )

const deckVisual = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex gap-5')],
    [
      artView(model, SHOWCASE.legend, 'w-24 shrink-0 rounded-card sm:w-32', h),
      h.div(
        [h.Class('flex min-w-0 flex-1 flex-col gap-4')],
        [
          h.div(
            [h.Class('flex flex-col gap-1')],
            [
              h.span([h.Class('text-lg font-semibold')], ['Jinx burn']),
              h.div(
                [h.Class('flex gap-1')],
                [
                  Badge.view({ content: ['Fury'], tone: 'Fury' }, h),
                  Badge.view({ content: ['Chaos'], tone: 'Chaos' }, h),
                ],
              ),
            ],
          ),
          ...Array.map(PROGRESS, progress => progressRowView(progress, h)),
        ],
      ),
    ],
  )

type WishlistRow = Readonly<{
  printingId: Printing.PrintingId
  name: string
  need: number
}>

const WISHLIST_ROWS: ReadonlyArray<WishlistRow> = [
  { printingId: SHOWCASE.missing, name: 'Jinx, Demolitionist', need: 2 },
  { printingId: SHOWCASE.wanted, name: 'Yasuo, Windrider', need: 1 },
  { printingId: SHOWCASE.rune, name: 'Chaos Rune', need: 3 },
]

const wishlistVisual = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex flex-col gap-3')],
    [
      h.div(
        [h.Class('flex items-baseline justify-between gap-2')],
        [
          h.span([h.Class('font-semibold')], ['Jinx burn']),
          h.span([h.Class('text-sm text-fg-muted')], ['6 copies missing']),
        ],
      ),
      h.ul(
        [h.Class('flex flex-col gap-2')],
        Array.map(WISHLIST_ROWS, ({ printingId, name, need }) =>
          h.li(
            [
              h.Class(
                'flex items-center gap-3 rounded-card border border-border bg-canvas p-2',
              ),
            ],
            [
              artView(model, printingId, 'w-10 shrink-0 rounded-control', h),
              h.span(
                [h.Class('min-w-0 flex-1 truncate text-sm font-semibold')],
                [name],
              ),
              Badge.view({ content: [`Need ${need}`], tone: 'Accent' }, h),
              h.span(
                [
                  h.Class(
                    'flex size-8 items-center justify-center rounded-control border border-border text-fg',
                  ),
                ],
                [Icon.view({ name: 'Check', size: 'Small' })],
              ),
            ],
          ),
        ),
      ),
    ],
  )

type FlowStep = Readonly<{ icon: Icon.Name; title: string; text: string }>

const CARDTRADER_FLOW: ReadonlyArray<FlowStep> = [
  {
    icon: 'CloudArrowUp',
    title: 'Send the wishlist',
    text: 'Jinx burn · 6 copies on CardTrader',
  },
  {
    icon: 'ArrowTopRightOnSquare',
    title: 'Order with the Shop Optimizer',
    text: 'CardTrader finds the sellers',
  },
  {
    icon: 'Check',
    title: 'Mark them as bought',
    text: 'They join your collection',
  },
]

const cardTraderVisual = (h: HtmlBuilder<Message>): Html =>
  h.ol(
    [h.Class('flex flex-col gap-3')],
    Array.map(CARDTRADER_FLOW, ({ icon, title, text }) =>
      h.li(
        [
          h.Class(
            'flex items-center gap-3 rounded-card border border-border bg-canvas p-3',
          ),
        ],
        [
          h.span(
            [
              h.Class(
                'flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-accent',
              ),
            ],
            [Icon.view({ name: icon })],
          ),
          h.div(
            [h.Class('flex min-w-0 flex-col')],
            [
              h.span([h.Class('text-sm font-semibold')], [title]),
              h.span([h.Class('text-sm text-fg-muted')], [text]),
            ],
          ),
        ],
      ),
    ),
  )

const featuresOf = (model: Model, h: HtmlBuilder<Message>) => [
  {
    title: 'Browse and track cards',
    lead: 'Every Riftbound card in one catalogue, with your collection built in.',
    points: [
      'Search the whole catalogue and filter by set, domain, type and more.',
      'Switch between All cards, My collection and Wanted.',
      'Count the copies of each version of a card separately.',
    ],
    visual: trackVisual(model, h),
    isReversed: false,
  },
  {
    title: 'Build decks',
    lead: 'A deck builder that knows the official deckbuilding rules.',
    points: [
      'Legend, champion, main deck, runes and battlefields, with copy limits and domains checked as you build.',
      'A progress bar shows what is left and what breaks the rules.',
      'See which cards you already own, and share decks with deck codes.',
    ],
    visual: deckVisual(model, h),
    isReversed: true,
  },
  {
    title: 'Automatic wishlists',
    lead: 'Every deck keeps its own shopping list.',
    points: [
      'Each deck lists the cards you are missing and updates as your collection changes.',
      'A custom wishlist holds anything else you want.',
      'When cards arrive, tick them as bought and they join your collection.',
    ],
    visual: wishlistVisual(model, h),
    isReversed: false,
  },
  {
    title: 'Buy on CardTrader',
    lead: 'Optional: connect your CardTrader account when you want to buy.',
    points: [
      'Send a wishlist to CardTrader and let its Shop Optimizer find the sellers.',
      'Bring a CardTrader wishlist into your custom wishlist.',
      'You check out on CardTrader. Your token stays in your browser and never reaches our server.',
    ],
    visual: cardTraderVisual(h),
    isReversed: true,
  },
]

// QUESTIONS

const QUESTIONS: ReadonlyArray<Readonly<{ question: string; answer: string }>> =
  [
    {
      question: 'Is it free?',
      answer: 'Yes. There are no ads, subscriptions or paid features.',
    },
    {
      question: 'Can anyone join?',
      answer:
        'Not yet. Sign-up is invite only for now, so you need an invite link or code from someone who uses it.',
    },
    {
      question: 'Do I need a CardTrader account?',
      answer:
        'No. Collection, decks and wishlists work without one. Connect CardTrader only when you want to buy.',
    },
    {
      question: 'Is my CardTrader token safe?',
      answer:
        'It is saved only in your browser and sent straight to CardTrader. Our server never sees it.',
    },
    {
      question: 'Is this an official Riot Games app?',
      answer:
        'No, it is made by fans. Card names, text and images belong to Riot Games.',
    },
  ]

const questionsView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.AriaLabel('Questions'), h.Class('flex flex-col gap-6')],
    [
      h.h2([h.Class('text-2xl font-semibold')], ['Questions']),
      h.dl(
        [h.Class('grid gap-6 sm:grid-cols-2')],
        Array.map(QUESTIONS, ({ question, answer }) =>
          h.div(
            [h.Class('flex flex-col gap-1')],
            [
              h.dt([h.Class('font-semibold')], [question]),
              h.dd([h.Class('text-sm text-fg-muted')], [answer]),
            ],
          ),
        ),
      ),
    ],
  )

const closingView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [
      h.AriaLabel('Get started'),
      h.Class(
        'flex flex-col items-start gap-4 rounded-card border border-border bg-surface p-8',
      ),
    ],
    [
      h.h2(
        [h.Class('text-2xl font-semibold')],
        ['Start with the cards you already own'],
      ),
      ctaView(h),
    ],
  )

export const view = Submodel.defineView<Model, Message>((model, h) =>
  h.div(
    [h.Class('flex flex-col gap-20 sm:gap-24')],
    [
      heroView(model, h),
      stepsView(h),
      ...Array.map(featuresOf(model, h), feature => featureView(feature, h)),
      questionsView(h),
      closingView(h),
    ],
  ),
)
