import axios from 'axios';
import {
  mkdir,
  readFile,
  writeFile,
  rm,
  access
} from 'node:fs/promises'
import { join } from 'node:path'
import { zip } from 'compressing'
import { decryptFromBase64 } from './xxtea.mjs'
import { decryptRmp } from './transformRmp.mjs'
import { jsonToImd } from './jsonToImd.mjs'

axios.defaults.baseURL = 'https://res.ds.qq.com'

export const logger = {
  txt: '',
  log(...args) {
    logger.txt += args.join(' ') + '\n';
    console.log(...args)
  },
  async output() {
    await writeFile('log', logger.txt, 'utf-8')
  }
}

function isExist(path) {
  return access(path).then(() => true).catch(() => false)
} 

export async function downloadFile(url, savePath) {
  logger.log('正在下载：', url)
  const saveDir = join(savePath, '..')
  const res = await axios.get(url, { responseType: 'stream' })
  await mkdir(saveDir, { recursive: true })
  await writeFile(savePath, res.data, 'binary')
  logger.log('下载完成：', url)
}

const WORKSPACE = 'dist'

export async function initWorkspace() {
  logger.log('正在初始化工作目录...')
  await rm(WORKSPACE, { force: true, recursive: true })
  await mkdir(WORKSPACE)
  await mkdir(join(WORKSPACE, 'imd'))
}

export async function getDecryptHash() {
  logger.log('正在获取解码 hash 值...')
  const hashFilePath = join(WORKSPACE, 'version.json')

  const isFileExist = await isExist(hashFilePath)
  if (!isFileExist) {
    await downloadFile('/Table/BetaTest_V2/version.json', hashFilePath)
  }
  
  const buffer = await readFile(hashFilePath, 'utf-8');
  const data = JSON.parse(buffer);
  return data.hash
}

export async function getConfigs(hash) {
  logger.log('正在获取配置文件...')
  const configzipPath = join(WORKSPACE, 'TableEnc.zip')
  const configDir = join(WORKSPACE, 'configs')
  const isZipExist = await isExist(configzipPath)

  if (!isZipExist) {
    await downloadFile('/Table/BetaTest_V2/554/TableEnc.zip', configzipPath)  
  }

  await zip.uncompress(configzipPath, configDir)


  const songConfigPath = join(configDir, 'mrock_song_client.json')
  const decryptSongConfigPath = join(configDir, 'mrock_song_client.decrypt.json')

  const isDecryptConfigExist = await isExist(decryptSongConfigPath)
  if (!isDecryptConfigExist) {
    const buffer = await readFile(songConfigPath, 'binary')
    let res = decryptFromBase64(buffer, hash)
    res = unescape(res.replace(/\\u/g, '%u'))
    await writeFile(join(configDir, 'mrock_song_client.decrypt.json'), res, 'utf-8')    
  }

  const buffer = await readFile(decryptSongConfigPath, 'utf-8')
  return JSON.parse(buffer)
}

export async function resolveMap(config) {
  const {
    m_szSongName,
    m_szPath,
    m_ush4KeyEasy,
    m_ush4KeyNormal,
    m_ush4KeyHard,
    m_ush5KeyEasy,
    m_ush5KeyNormal,
    m_ush5KeyHard,
    m_ush6KeyEasy,
    m_ush6KeyNormal,
    m_ush6KeyHard,
  } = config

  const name = `LV${
    Number(m_ush4KeyHard) || 
    Number(m_ush5KeyHard) || 
    Number(m_ush6KeyHard) ||
    Number(m_ush4KeyNormal) ||
    Number(m_ush5KeyNormal) ||
    Number(m_ush6KeyNormal) ||
    Number(m_ush4KeyEasy) ||
    Number(m_ush5KeyEasy) ||
    Number(m_ush6KeyEasy)
  }.${m_szSongName}`.replace(/[?*"\/:|,\\<>]/g, '')
  logger.log(`正在处理谱面：${name}`)
  const errHandler = (sign, err) => {
    logger.log(`${name}: ${sign} 处理失败！`)
    logger.log(err)
  }

  const promises = [
    downloadMp3(name, m_szPath).catch(errHandler.bind(null, 'mp3')),
    downloadThumb(name, m_szPath).catch(errHandler.bind(null, 'thumb')),
    resolveRmp(name, m_szPath, 4, 'ez', m_ush4KeyEasy).catch(errHandler.bind(null, '4k_ez')),
    resolveRmp(name, m_szPath, 4, 'nm', m_ush4KeyNormal).catch(errHandler.bind(null, '4k_nm')),
    resolveRmp(name, m_szPath, 4, 'hd', m_ush4KeyHard).catch(errHandler.bind(null, '4k_hd')),
    resolveRmp(name, m_szPath, 5, 'ez', m_ush5KeyEasy).catch(errHandler.bind(null, '5k_ez')),
    resolveRmp(name, m_szPath, 5, 'nm', m_ush5KeyNormal).catch(errHandler.bind(null, '5k_nm')),
    resolveRmp(name, m_szPath, 5, 'hd', m_ush5KeyHard).catch(errHandler.bind(null, '5k_hd')),
    resolveRmp(name, m_szPath, 6, 'ez', m_ush6KeyEasy).catch(errHandler.bind(null, '6k_ez')),
    resolveRmp(name, m_szPath, 6, 'nm', m_ush6KeyNormal).catch(errHandler.bind(null, '6k_nm')),
    resolveRmp(name, m_szPath, 6, 'hd', m_ush6KeyHard).catch(errHandler.bind(null, '6k_hd'))
  ]

  await Promise.allSettled(promises)
}

export async function downloadMp3(name, path) {
  const fileUrl = `/Test_SongRes_V2/song/${path}/${path}.mp3`
  const mp3Path = join(WORKSPACE, 'imd', name, `${path}.mp3`)
  const isMp3Exist = await isExist(mp3Path);
  if (!isMp3Exist) {
    await downloadFile(fileUrl, mp3Path)
  }
}

export async function downloadThumb(name, path) {
  const fileUrl = `/Test_SongRes_V2/song/${path}/${path}_thumb.jpg`
  const thumbPath = join(WORKSPACE, 'imd', name, `${path}_thumb.jpg`)
  const isThumbExist = await isExist(thumbPath);
  if (!isThumbExist) {
    await downloadFile(fileUrl, thumbPath)
  }
}

export async function resolveRmp(name, path, key, difficuty, level) {
  if (Number(level) <= 0) {
    return;
  }

  const mapKey = `${path}_${key}k_${difficuty}`
  const fileUrl = `/Test_SongRes_V2/song/${path}/${mapKey}.rmp`
  const rmpPath = join(WORKSPACE, 'imd', name, `${mapKey}.rmp`)
  const isRmpExist = await isExist(rmpPath);
  if (!isRmpExist) {
    await downloadFile(fileUrl, rmpPath)
  }

  const jsonPath = join(WORKSPACE, 'imd', name, `${mapKey}.json`)
  const isJsonExist = await isExist(jsonPath);
  if (!isJsonExist) {
    await decryptRmp(mapKey, rmpPath, jsonPath);
  }

  const imdPath = join(WORKSPACE, 'imd', name, `${mapKey}.imd`)
  const isImdExist = await isExist(imdPath);
  if (!isImdExist) {
    await jsonToImd(jsonPath, imdPath)
  }
}


