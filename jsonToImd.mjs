import { readFile, writeFile } from 'node:fs/promises'

async function fromJson(dir) {
  const buffer = await readFile(dir, 'utf-8')
  return JSON.parse(buffer)
}

function toImd(json) {
  const {
    tempo: bpm,
    tracks,
  } = json

  /** 每拍长度 */
  const beatTime = 60000 / bpm
  const tickTime = beatTime / 48

  /** 谱面列表 */
  const notesList = tracks
    .reduce((cur, item) => {
      item.note.forEach((note) => {
        note.track = item.track
        note.time = Math.round(note.tick * tickTime)
        note.time_dur = Math.round(note.dur * tickTime)
      })
      return cur.concat(item.note)
    }, [])
    .sort((a, b) => {
      // 粗排序
      if (a.tick !== b.tick) {
        return a.tick - b.tick
      }

      if (a.isEnd !== b.isEnd) {
        return a.isEnd - b.isEnd
      }

      const tapDelta = Number(isTap(b)) - Number(isTap(a))
      if (tapDelta !== 0) {
        return tapDelta
      }

      const slideDelta = Number(isSlide(b)) - Number(isSlide(a))
      if (slideDelta !== 0) {
        return slideDelta
      }
      return a.track - b.track
    })

  const duration = getDuration(notesList)
  const durationtime = duration * tickTime

  /** 时间戳数 */
  const sectionNum = Math.ceil(durationtime / beatTime) + 1
  
  // 提取面条
  sortNotes(notesList)

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

function getDuration(notes) {
  const lastNode = notes[notes.length - 1]
  let latestTick = lastNode.tick + lastNode.dur
  for (let i = notes.length - 2; i >= 0; i--) {
    const note = notes[i]
    const endTick = note.tick + note.dur
    if (endTick > latestTick) {
      latestTick = endTick
    }
  }
  // 假定歌曲结束时间为最后一个动作完成后的 4 拍之后
  return latestTick + 4 * 48
}

function sortNotes(notes) {
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    if (isSingleAction(note)) {
      continue
    }

    if (isLineStart(note)) {
      const tempNotes = [];
      let j = i + 1
      let cur = note
      do {
        j = lineNextNode(notes, cur, j)
        if (j !== null) {
          const spliceNodes = notes.splice(j, 1)
          cur = spliceNodes[0]
          tempNotes.push(spliceNodes[0])          
        }
      } while (j !== null)
      notes.splice(i + 1, 0, ...tempNotes)
      i += tempNotes.length
      continue
    }

    if (isLineProcess(note) || isLineEnd(note)) {
      throw new Error('Found invalid broken line!')
    }
  }
}

function lineNextNode(notes, note, index) {
  if (note.isEnd === 1) {
    return null
  }

  const isHoldNote = isHold(note)
  for (let i = index; i < notes.length; i++) {
    const cur = notes[i]
    if (
      isHoldNote &&
      (isLineProcess(cur) || isLineEnd(cur)) && 
      cur.track === note.track &&
      // 因为舍入问题，先这样写判断条件，以后再详细考虑
      Math.abs(cur.tick - note.tick - note.dur) <= 1
    ) {
      return i
    }
    if (isHoldNote && cur.tick - note.tick - note.dur > 1) {
      return null
    }
    if (
      !isHoldNote &&
      (isLineProcess(cur) || isLineEnd(cur)) &&
      cur.track === note.toTrack &&
      cur.tick === note.tick
    ) {
      return i
    }
    if (!isHoldNote && cur.tick > note.tick) {
      return null
    }
  }
  return null
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

function isTap(note) {
  return note.toTrack === 0
}

function isHold(note) {
  return note.toTrack === note.track
}

function isSlide(note) {
  return !isHold(note) && !isTap(note)
}

function isSingleAction(note) {
  return (!isTap(note) && note.isEnd === 1 && note.attr === 3) || isTap(note)
}

function isLineStart(note) {
  return note.isEnd === 0 && note.attr === 3
}

function isLineProcess(note) {
  return note.isEnd === 0 && note.attr === 4
}

function isLineEnd(note) {
  return note.isEnd === 1 && note.attr === 4
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

export async function jsonToImd(jsonPath, imdPath) {
  const json = await fromJson(jsonPath)
  const buffer = toImd(json)
  await writeFile(imdPath, buffer, 'binary')
}