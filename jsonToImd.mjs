import { readFile, writeFile } from 'fs/promises'
import { basename } from 'path'

async function fromJson(dir) {
  const buffer = await readFile(dir, 'utf-8')
  return JSON.parse(buffer)
}

function toImd(json) {
  const {
    tempo: bpm,
    durationtime,
    tracks,
  } = json

  /** 每拍长度 */
  const beatTime = 60000 / bpm

  /** 时间戳数 */
  const sectionNum = Math.ceil(durationtime / beatTime) + 1

  /** 谱面列表 */
  const notesList = tracks
    .reduce((cur, item) => {
      item.note.forEach((note) => {
        note.track = item.track
      })
      return cur.concat(item.note)
    }, [])
    .sort((a, b) => {
      return a.idx - b.idx
    })

  /** imd 字节数 */
  const imdByteNum = 14 + sectionNum * 12 + notesList.length * 11

  /** imd 二进制 */
  const imdBytes = new Uint8Array(imdByteNum)

  writeInt(imdBytes, durationtime, 0, 4)
  writeInt(imdBytes, sectionNum, 4, 4)

  let offset = 8
  for (let i = 0; i < sectionNum; i++) {
    writeInt(imdBytes, Math.floor(beatTime * i), offset, 4)
    offset += 4
    writeFloat(imdBytes, bpm, offset)
    offset += 8
  }

  writeInt(imdBytes, 3, offset, 1)
  offset++
  writeInt(imdBytes, 3, offset, 1)
  offset++

  writeInt(imdBytes, notesList.length, offset, 4)
  offset += 4
  notesList.forEach((note) => {
    const typeValue = noteTypeValue(note)
    writeInt(imdBytes, typeValue, offset, 2)
    offset += 2
    writeInt(imdBytes, note.time, offset, 4)
    offset += 4
    writeInt(imdBytes, note.track - 3, offset, 1)
    offset++
    writeInt(imdBytes, noteDuration(note), offset, 4)
    offset += 4
  })

  return Buffer.from(imdBytes)
}


function writeInt(bytes, value, from, len) {
  const newBuffer = new Uint8Array(len);
  const view = new DataView(newBuffer.buffer, 0, len)
  if (len === 1) {
    view.setInt8(0, value, true)
  }
  else if (len === 2) {
    view.setInt16(0, value, true)
  }
  else if (len === 4) {
    view.setInt32(0, value, true)
  }
  else {
    throw new Error('Invalid int length!')
  }
  bytes.set(newBuffer, from)
}

function writeFloat(bytes, value, from) {
  const view = new DataView(bytes.buffer, from, 8)
  view.setFloat64(0, value, true)
}

function noteTypeValue(note) {
  if (note.toTrack === 0) {
    return 0
  }

  /**
   * attr 值说明：
   * - 0 单点
   * - 3 动作 开始
   * - 4 动作 进行中 / 结束
   */

  const isHold = note.toTrack === note.track
  if (note.isEnd === 1 && note.attr === 3) {
    // 单滑键
    return !isHold ? 1 : 2
  }
  if (note.isEnd === 1 && note.attr === 4) {
    // 折线末尾
    return !isHold ? 161 : 162
  }
  if (note.isEnd === 0 && note.attr === 3) {
    // 折线开始
    return !isHold ? 97 : 98
  }
  // 折线中间
  return !isHold ? 33 : 34
}

function noteDuration(note) {
  if (note.toTrack === 0) {
    return 0
  }
  if (note.toTrack === note.track) {
    return note.time_dur
  }
  return note.toTrack - note.track
}

async function main() {
  const [,, jsonPath] = process.argv
  const json = await fromJson(jsonPath)
  const jsonFileName = basename(jsonPath)
  const dotIndex = jsonFileName.indexOf('.')
  const jsonFileNameWithoutExt = dotIndex >= 0 ? jsonFileName.slice(0, dotIndex) : jsonFileName

  const buffer = toImd(json)
  await writeFile(`${jsonFileNameWithoutExt}.imd`, buffer, 'binary')
}

main()