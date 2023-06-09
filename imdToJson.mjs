import { readFile, writeFile } from 'node:fs/promises'

function toJson(buffer, key, version) {
  const result = {
    signature: "BNDQ",
    version: version,
    tracks: []
  }

  for (let i = 0; i < key; i++) {
    result.tracks.push({
      track: 3 + i,
      note: []
    })
  }

  const durationtime = buffer.readUInt32LE(0)
  // result.durationtime = durationtime
  
  /** 时间戳数 */
  const sectionNum = buffer.readUInt32LE(4)
  const bpm = buffer.readDoubleLE(12)
  result.tempo = bpm

  const beatTime = 60000 / bpm
  const tickTime = beatTime / 48

  // result.duration = Math.round(durationtime / tickTime)

  let offset = 14 + sectionNum * 12
  const noteRows = buffer.readUInt32LE(offset - 4)
  for (let i = 0; i < noteRows; i++) {
    const note = {
      tick: 0,
      key: 0,
      dur: 0,
      isEnd: 0,
      toTrack: 0,
      volume: 127,
      pan: 64,
      attr: 0,
    }
    const type = buffer.readUInt16LE(offset)
    offset += 2

    const time = buffer.readUInt32LE(offset)
    // note.time = time
    note.tick = Math.round(time / tickTime)
    offset += 4

    const pos = buffer.readUInt8(offset)
    result.tracks[pos].note.push(note)
    offset++

    // 注意滑箭有负数，因此动作值不能用 UInt 读取
    const actionValue = buffer.readInt32LE(offset)
    offset += 4

    console.log(time, actionValue)

    resolveNote(note, type, pos + 3, actionValue, tickTime)
  }
  
  return result
}

function resolveNote(note, type, track, actionValue, tickTime) {
  if (type === 0) {
    // 单点
    return
  }

  const isHold = type % 2 === 0
  note.toTrack = isHold ? track : track + actionValue
  // note.time_dur = actionValue
  note.dur = isHold ? Math.round(actionValue / tickTime) : 0

  if (type < 32) {
    // 单按单滑
    note.attr = 3
    note.isEnd = 1
  }
  else if (type < 96) {
    // 折线中间
    note.attr = 4
  }
  else if (type < 160) {
    // 折线开始
    note.attr = 3
  }
  else {
    // 折线结束
    note.attr = 4
    note.isEnd = 1
  }
}

export async function imdToJson(imdPath, jsonPath, key, version) {
  const buffer = await readFile(imdPath)
  const json = toJson(buffer, Number(key), version)
  await writeFile(jsonPath, JSON.stringify(json), 'utf-8')
}