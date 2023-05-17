import { jsonToImd } from './jsonToImd.mjs'

const [,, jsonPath] = process.argv
const jsonFileName = basename(jsonPath)
const dotIndex = jsonFileName.indexOf('.')
const jsonFileNameWithoutExt = dotIndex >= 0 ? jsonFileName.slice(0, dotIndex) : jsonFileName

await jsonToImd(jsonPath, `${jsonFileNameWithoutExt}.imd`)