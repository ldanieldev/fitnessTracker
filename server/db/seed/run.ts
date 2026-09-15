import 'dotenv/config'
import { seedNutrients } from './nutrition'

await seedNutrients()
console.log('seeded nutrients')
process.exit(0)
