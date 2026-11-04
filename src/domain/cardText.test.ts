import { Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import * as CardText from './cardText'

const parsedOrThrow = (html: string) =>
  Result.getOrThrowWith(CardText.parse(html), error => new Error(error))

describe('parse', () => {
  test('paragraphs, line breaks, symbols and keywords', () => {
    expect(
      parsedOrThrow(
        '<p>[Assault 2] Pay :rb_energy_1: and :rb_rune_fury:.<br />Gain :rb_might:.</p>',
      ),
    ).toStrictEqual([
      {
        _tag: 'Paragraph',
        content: [
          { _tag: 'Keyword', name: 'Assault', label: 'Assault 2' },
          { _tag: 'Text', text: ' Pay ' },
          { _tag: 'Symbol', symbol: { _tag: 'Energy', amount: 1 } },
          { _tag: 'Text', text: ' and ' },
          {
            _tag: 'Symbol',
            symbol: { _tag: 'Rune', maybeDomain: Option.some('Fury') },
          },
          { _tag: 'Text', text: '.' },
          { _tag: 'LineBreak' },
          { _tag: 'Text', text: 'Gain ' },
          { _tag: 'Symbol', symbol: { _tag: 'Might' } },
          { _tag: 'Text', text: '.' },
        ],
      },
    ])
  })

  test('lists and entities', () => {
    expect(
      parsedOrThrow(
        '<p>Choose &quot;one&quot; —</p><ul><li>A &gt; B</li><li>C</li></ul>',
      ),
    ).toStrictEqual([
      {
        _tag: 'Paragraph',
        content: [{ _tag: 'Text', text: 'Choose "one" —' }],
      },
      {
        _tag: 'List',
        items: [
          [{ _tag: 'Text', text: 'A > B' }],
          [{ _tag: 'Text', text: 'C' }],
        ],
      },
    ])
  })

  test.each([
    ['<p>x</p><script>y</script>', 'Unsupported tag <script>'],
    ['<p>:rb_unknown:</p>', 'Unknown symbol :rb_unknown:'],
    ['<p>&nbsp;</p>', 'Unknown entity &nbsp;'],
    ['<p>open', 'Missing </p>'],
    ['loose text', 'Expected <p> or <ul>'],
  ])('rejects %s', (html, error) => {
    expect(CardText.parse(html)).toStrictEqual(Result.fail(error))
  })
})

describe('keywords and plainText', () => {
  const text = parsedOrThrow(
    '<p>[Tank] [Assault 2] [Tank] Exhaust :rb_exhaust: for :rb_rune_rainbow:.</p>',
  )

  test('keywords are unique names without numbers', () => {
    expect(CardText.keywords(text)).toStrictEqual(['Tank', 'Assault'])
  })

  test('plain text spells out symbols for search', () => {
    expect(CardText.plainText(text)).toBe(
      'Tank Assault 2 Tank Exhaust exhaust for any rune.',
    )
  })
})
