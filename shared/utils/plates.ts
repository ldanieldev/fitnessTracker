import { z } from 'zod'
import type { LoadStyle } from '../types/workout'

export const DEFAULT_PLATE_SIZES = [45, 35, 25, 10, 5, 2.5]
export const DEFAULT_BAR_WEIGHT = 45
export const MAX_PLATE_SIZES = 12

// Two decimals keeps the loadable-weight search on an integer grid of hundredths of a pound.
const plateSize = z
  .number()
  .positive()
  .max(100)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'At most two decimals')

export const plateSizesSchema = z
  .array(plateSize)
  .min(1)
  .max(MAX_PLATE_SIZES)
  .refine((sizes) => new Set(sizes).size === sizes.length, 'Each plate size once')

export function normalizePlateSizes(sizes: number[]): number[] {
  return [...new Set(sizes)].sort((a, b) => b - a)
}

export function effectivePlateSizes(
  loadStyle: LoadStyle | null,
  override: string[] | null,
  fallback: string[]
): number[] | null {
  if (loadStyle !== 'barbell') return null
  return (override ?? fallback).map(Number)
}
