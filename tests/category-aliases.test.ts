import { describe, expect, it } from 'vitest'
import { parseTerms } from '../src/game/game'

const terms = parseTerms(`
Word: Coin Purse
Theme: Imported object
Common: Container=100, Bag=180, Purse=150
Rare: Personal accessory=270, Money holder=300, Coin container=320
Extreme: Carrying case=430
Eagle: Coin storage accessory=650

Word: Cotton Swab
Theme: Imported object
Common: swab=120, household supply=160
Rare: personal hygiene article=310, Personal care product=330
Extreme: cosmetic tool=430

Word: Solder Iron
Theme: Imported object
Common: Tool=100, Hand tool=180
Rare: Heating appliance=350, Workshop tool=260
Extreme: Metalworking tool=480, Soldering equipment=560
Eagle: Electronics tool=650

Word: External Hard Drive
Theme: Imported object
Common: Computer hardware=120, Data storage device=160
Rare: Secondary storage device=340, External storage device=340
Extreme: Nonvolatile storage device=410
`)

function tierFor(word: string, answer: string) {
  return terms.find(term => term.word === word)?.tiers.find(tier => tier.answers.includes(answer))?.name
}

describe('curated category aliases', () => {
  it('accepts both natural Coin Purse descriptions in the Rare tier', () => {
    expect(tierFor('Coin Purse', 'Money holder')).toBe('Crow')
    expect(tierFor('Coin Purse', 'Coin container')).toBe('Crow')
  })

  it('places natural alternative categories at reasonable tiers', () => {
    expect(tierFor('Cotton Swab', 'Personal care product')).toBe('Crow')
    expect(tierFor('Solder Iron', 'Soldering equipment')).toBe('Hawk')
    expect(tierFor('External Hard Drive', 'External storage device')).toBe('Crow')
  })
})
