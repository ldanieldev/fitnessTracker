import 'dotenv/config'
import { seedMeasurementTypes } from './body'
import { seedNutrients } from './nutrition'

await seedNutrients()
await seedMeasurementTypes()
console.log('seeded nutrients and measurement types')
process.exit(0)
