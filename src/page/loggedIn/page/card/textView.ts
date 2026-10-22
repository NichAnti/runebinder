import { Array, Match, Option, Result } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { CardText } from '../../../../domain'
import { Badge } from '../../../../ui'

const inlineView = <Message>(
  inline: CardText.Inline,
  h: HtmlBuilder<Message>,
): Html | string =>
  Match.value(inline).pipe(
    Match.withReturnType<Html | string>(),
    Match.tag('Text', ({ text }) => text),
    Match.tag('LineBreak', () => h.br([])),
    Match.tag('Keyword', ({ label }) =>
      Badge.view({ content: [label], tone: 'Accent' }, h),
    ),
    Match.tag('Symbol', ({ symbol }) =>
      Badge.view(
        {
          content: [CardText.symbolLabel(symbol)],
          tone: Match.value(symbol).pipe(
            Match.withReturnType<Badge.Tone>(),
            Match.tag('Rune', ({ maybeDomain }) =>
              Option.getOrElse(maybeDomain, () => 'Neutral'),
            ),
            Match.orElse(() => 'Neutral'),
          ),
        },
        h,
      ),
    ),
    Match.exhaustive,
  )

const blockView = <Message>(
  block: CardText.Block,
  h: HtmlBuilder<Message>,
): Html =>
  Match.value(block).pipe(
    Match.tagsExhaustive({
      Paragraph: ({ content }) =>
        h.p(
          [h.Class('leading-relaxed')],
          Array.map(content, inline => inlineView(inline, h)),
        ),
      List: ({ items }) =>
        h.ul(
          [h.Class('list-disc space-y-1 pl-5')],
          Array.map(items, item =>
            h.li(
              [],
              Array.map(item, inline => inlineView(inline, h)),
            ),
          ),
        ),
    }),
  )

export const view = <Message>(html: string, h: HtmlBuilder<Message>): Html =>
  Result.match(CardText.parse(html), {
    onFailure: () =>
      h.p([h.Class('text-fg-muted')], ['This text could not be shown.']),
    onSuccess: blocks =>
      h.div(
        [h.Class('flex flex-col gap-2 text-sm text-fg')],
        Array.map(blocks, block => blockView(block, h)),
      ),
  })
