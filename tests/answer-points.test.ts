import { describe, expect, it } from 'vitest'
import { altitudeLiftForPoints, fallRateForHeight, fuzzyAnswerScore, isPartialCategory, parseAnswerSpec, partialCategoryPoints, plainLanguageAnswerScore } from '../src/game/game'

describe('variable answer points', () => {
  it('maps the Test prompt answers across the full 100-to-800 range', () => {
    const prompt = 'Test'
    const answers = [
      ['common answer=100', 100],
      ['strong common=175', 175],
      ['rare answer=300', 300],
      ['strong rare [375]', 375],
      ['extreme answer=550', 550],
      ['strong extreme=650', 650],
      ['eagle answer=800', 800],
    ] as const

    expect(prompt).toBe('Test')
    expect(answers.map(([spec]) => parseAnswerSpec('Sparrow', spec).text)).toEqual([
      'common answer', 'strong common', 'rare answer', 'strong rare', 'extreme answer', 'strong extreme', 'eagle answer',
    ])
    expect(answers.map(([spec]) => parseAnswerSpec('Sparrow', spec).points)).toEqual(answers.map(([, points]) => points))
  })

  it('uses tier defaults and clamps out-of-range values', () => {
    expect(parseAnswerSpec('Crow', 'default rare').points).toBe(200)
    expect(parseAnswerSpec('Hawk', 'too low=20').points).toBe(100)
    expect(parseAnswerSpec('Eagle', 'too high=9999').points).toBe(800)
  })

  it('accepts useful partial and close-phrase category inputs', () => {
    expect(fuzzyAnswerScore('brewing', 'brewing equipment')).toBeGreaterThanOrEqual(0.96)
    expect(fuzzyAnswerScore('brewing machine', 'brewing equipment')).toBeGreaterThanOrEqual(0.84)
    expect(fuzzyAnswerScore('equipment', 'brewing equipment')).toBeGreaterThanOrEqual(0.84)
    expect(fuzzyAnswerScore('banana', 'brewing equipment')).toBe(0)
  })

  it('accepts small spelling mistakes in long category words', () => {
    expect(fuzzyAnswerScore('haredware', 'hardware')).toBeGreaterThanOrEqual(0.86)
    expect(fuzzyAnswerScore('garment suport', 'garment support')).toBeGreaterThanOrEqual(0.86)
    expect(fuzzyAnswerScore('banana', 'hardware')).toBe(0)
  })
  it('accepts concise category phrases but rejects sentence-like descriptions', () => {
    expect(plainLanguageAnswerScore('money holder', 'Money holder', 'Leather Wallet')).toBeGreaterThanOrEqual(0.9)
    expect(plainLanguageAnswerScore('writing instrument', 'Writing instrument', 'Ballpoint Pen')).toBeGreaterThanOrEqual(0.9)
    expect(plainLanguageAnswerScore('painting equipment', 'textile', 'Canvas')).toBeGreaterThanOrEqual(0.86)
    expect(plainLanguageAnswerScore('things that hold money', 'Money holder', 'Leather Wallet')).toBe(0)
    expect(plainLanguageAnswerScore('something you use to write', 'Writing instrument', 'Ballpoint Pen')).toBe(0)
    expect(plainLanguageAnswerScore('a thing you ride', 'Vehicle', 'Bicycle')).toBe(0)
    expect(plainLanguageAnswerScore('banana', 'Furniture', 'Rocking Chair')).toBe(0)
  })
  it('rejects malformed object descriptions instead of rewarding a generic alias', () => {
    expect(fuzzyAnswerScore('things you hold ice on', 'Ice-making equipment')).toBe(0)
    expect(plainLanguageAnswerScore('things you hold ice on', 'Container', 'Ice Cube Tray')).toBe(0)
    expect(plainLanguageAnswerScore('things you hold ice on', 'Kitchenware', 'Ice Cube Tray')).toBe(0)
    expect(plainLanguageAnswerScore('things you hold ice on', 'Tray', 'Ice Cube Tray')).toBe(0)
  })
  it('recognizes contained category words as minimum-value answers', () => {
    expect(isPartialCategory('dish', 'pie dish')).toBe(false)
    expect(isPartialCategory('dish', 'frozen pie dish')).toBe(true)
    expect(isPartialCategory('pie dish', 'pie dish')).toBe(false)
    expect(isPartialCategory('dish', 'household item')).toBe(false)
    expect(partialCategoryPoints(560)).toBe(476)
    expect(partialCategoryPoints(100)).toBe(85)
  })
  it('starts falling at 2.75u/s and ramps up into a difficult late game', () => {
    expect(fallRateForHeight(37.5, 0)).toBeCloseTo(2.75, 2)
    expect(fallRateForHeight(240, 180)).toBeGreaterThan(12)
    expect(fallRateForHeight(255, 180)).toBeCloseTo(14, 1)
  })
  it('keeps two Extreme answers below Rare Sky from the starting altitude', () => {
    expect(altitudeLiftForPoints(100)).toBe(12)
    expect(altitudeLiftForPoints(550)).toBe(66)
    expect(37.5 + altitudeLiftForPoints(550) * 2).toBeLessThan(180)
  })
})
