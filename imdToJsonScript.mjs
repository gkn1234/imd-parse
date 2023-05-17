import { imdToJson } from './imdToJson.mjs'
import { basename } from 'node:path'

const [,, imdPath, key, version = '1.2.2'] = process.argv
const imdFileName = basename(imdPath)
const dotIndex = imdFileName.indexOf('.')
const imdFileNameWithoutExt = dotIndex >= 0 ? imdFileName.slice(0, dotIndex) : imdFileName

await imdToJson(imdPath, `${imdFileNameWithoutExt}.json`, Number(key), version)