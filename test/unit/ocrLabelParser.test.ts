import { describe, expect, it } from 'vitest'
import { parseNutritionLabel } from '../../app/utils/ocr/labelParser'

const usLabel = `Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g 10%
Saturated Fat 1g 5%
Cholesterol 0mg 0%
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g
Protein 3g`

const euLabel = `Nutrition Information
Energy 2252 kJ / 539 kcal
Fat 30,9 g
of which saturates 10,6 g
Carbohydrate 57,5 g
of which sugars 56,3 g
Protein 6,3 g
Salt 0,107 g`

const garbageText = `asdlkfj asldkfj qwer 1234 zxcv
mnbv poiu`

const confusedLabel = `Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g 10%
Saturated Fat 1g 5%
Cholesterol 0mg 0%
Sodium l60mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g
Protein 3q`

describe('parseNutritionLabel', () => {
  it('parses a US-style label', () => {
    const result = parseNutritionLabel(usLabel)
    expect(result.servingGrams).toBe(55)
    expect(result.nutrients.energy).toBe(230)
    expect(result.nutrients.fat).toBe(8)
    expect(result.nutrients.saturatedFat).toBe(1)
    expect(result.nutrients.cholesterol).toBe(0)
    expect(result.nutrients.sodium).toBe(160)
    expect(result.nutrients.carbohydrate).toBe(37)
    expect(result.nutrients.fiber).toBe(4)
    expect(result.nutrients.sugar).toBe(12)
    expect(result.nutrients.protein).toBe(3)
    expect(result.confidence).toBeCloseTo(0.9)
  })

  it('parses an EU-style label with comma decimals, prefers kcal over kJ, and derives sodium from salt', () => {
    const result = parseNutritionLabel(euLabel)
    expect(result.nutrients.energy).toBe(539)
    expect(result.nutrients.fat).toBe(30.9)
    expect(result.nutrients.saturatedFat).toBe(10.6)
    expect(result.nutrients.carbohydrate).toBe(57.5)
    expect(result.nutrients.sugar).toBe(56.3)
    expect(result.nutrients.protein).toBe(6.3)
    expect(result.nutrients.sodium).toBeCloseTo(42.8, 1)
    expect(result.confidence).toBeLessThan(0.8)
  })

  it('returns no nutrients and zero confidence for garbage text', () => {
    const result = parseNutritionLabel(garbageText)
    expect(result.servingGrams).toBeNull()
    expect(result.nutrients).toEqual({})
    expect(result.confidence).toBe(0)
  })

  it('handles common OCR confusions (q for g, l for 1)', () => {
    const result = parseNutritionLabel(confusedLabel)
    expect(result.nutrients.protein).toBe(3)
    expect(result.nutrients.sodium).toBe(160)
  })

  it('recovers the serving grams when a trailing 9 misread swallows the g (P2-R25)', () => {
    const result = parseNutritionLabel('Serving size 2/3 cup (559)')
    expect(result.servingGrams).toBe(55)
  })

  it('rejects a P2-R25 recovery when the result is out of the plausible serving range', () => {
    const result = parseNutritionLabel('Serving size 2/3 cup (5009)')
    expect(result.servingGrams).toBeNull()
  })

  it('parses a serving size with no parentheses', () => {
    const result = parseNutritionLabel('Serving size 240 g')
    expect(result.servingGrams).toBe(240)
  })

  it('parses fiber, carbohydrate and sugar from a Tesseract-merged line', () => {
    const merged = 'Total Carbohydrate 37g 13% Dietary Fiber 4g 14% Total Sugars 12g'
    const result = parseNutritionLabel(merged)
    expect(result.nutrients.carbohydrate).toBe(37)
    expect(result.nutrients.fiber).toBe(4)
    expect(result.nutrients.sugar).toBe(12)
  })
})
