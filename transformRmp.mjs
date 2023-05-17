import {
  readFile,
  writeFile
} from 'node:fs/promises'
import {
  decryptFromBase64
} from './xxtea.mjs'
import { inflate } from 'pako';

const SALT = 'RMP4TT3RN';

export async function decryptRmp(name, rmpPath, jsonPath) {
  const key = `${SALT}${name}`
  const buffer = await readFile(rmpPath)
  const decryptData = decryptFromBase64(buffer.toString(), key);

  const decompressData = _base64ToArrayBuffer(decryptData);
  
  const inflateData = inflate(decompressData)

  let json = ""
  let p
  for (p = 0; p < inflateData.length / 8192; p++) {
    json += String.fromCharCode.apply(null, inflateData.slice(8192 * p, 8192 * (p + 1)))
  }
  json += String.fromCharCode.apply(null, inflateData.slice(8192 * p))
  
  await writeFile(jsonPath, json);
}

function _base64ToArrayBuffer(e) {
  for (var t = atob(e), n = t.length, o = new Uint8Array(n), i = 0; i < n; i++) o[i] = t.charCodeAt(i);
  return o;
}

function _arrayBufferToBase64(buffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}