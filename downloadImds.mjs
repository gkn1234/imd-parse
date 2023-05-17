import { 
  initWorkspace,
  getConfigs,
  getDecryptHash,
  resolveMap,
  logger
} from './request.mjs'

const [,, update = 'false'] = process.argv

try {
  if (update === 'true') {
    await initWorkspace();
  }
  
  const hash = await getDecryptHash()
  const config = await getConfigs(hash)
  for (let i = 0; i < config.length; i++) {
    await resolveMap(config[i])
  }
} catch(e) {
  console.error(e)
} finally {
  await logger.output()
}
