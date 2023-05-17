/**********************************************************\
|                                                          |
| xxtea.js                                                 |
|                                                          |
| XXTEA encryption algorithm library for JavaScript.       |
|                                                          |
| Encryption Algorithm Authors:                            |
|      David J. Wheeler                                    |
|      Roger M. Needham                                    |
|                                                          |
| Code Author: Ma Bingyao <mabingyao@gmail.com>            |
| LastModified: Oct 4, 2016                                |
|                                                          |
\**********************************************************/

var DELTA = 0x9e3779b9;

export function toBinaryString(v, includeLength) {
  var length = v.length;
  var n = length << 2;
  if (includeLength) {
    var m = v[length - 1];
    n -= 4;
    if (m < n - 3 || m > n) {
      return null;
    }
    n = m;
  }
  for (var i = 0; i < length; i++) {
    v[i] = String.fromCharCode(
      v[i] & 0xff,
      (v[i] >>> 8) & 0xff,
      (v[i] >>> 16) & 0xff,
      (v[i] >>> 24) & 0xff
    );
  }
  var result = v.join("");
  if (includeLength) {
    return result.substring(0, n);
  }
  return result;
}

export function toUint32Array(bs, includeLength) {
  var length = bs.length;
  var n = length >> 2;
  if ((length & 3) !== 0) {
    ++n;
  }
  var v;
  if (includeLength) {
    v = new Array(n + 1);
    v[n] = length;
  } else {
    v = new Array(n);
  }
  for (var i = 0; i < length; ++i) {
    v[i >> 2] |= bs.charCodeAt(i) << ((i & 3) << 3);
  }
  return v;
}

export function int32(i) {
  return i & 0xffffffff;
}

export function mx(sum, y, z, p, e, k) {
  return (
    (((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^
    ((sum ^ y) + (k[(p & 3) ^ e] ^ z))
  );
}

export function fixk(k) {
  if (k.length < 4) k.length = 4;
  return k;
}

export function encryptUint32Array(v, k) {
  var length = v.length;
  var n = length - 1;
  var y, z, sum, e, p, q;
  z = v[n];
  sum = 0;
  for (q = Math.floor(6 + 52 / length) | 0; q > 0; --q) {
    sum = int32(sum + DELTA);
    e = (sum >>> 2) & 3;
    for (p = 0; p < n; ++p) {
      y = v[p + 1];
      z = v[p] = int32(v[p] + mx(sum, y, z, p, e, k));
    }
    y = v[0];
    z = v[n] = int32(v[n] + mx(sum, y, z, n, e, k));
  }
  return v;
}

export function decryptUint32Array(v, k) {
  var length = v.length;
  var n = length - 1;
  var y, z, sum, e, p, q;
  y = v[0];
  q = Math.floor(6 + 52 / length);
  for (sum = int32(q * DELTA); sum !== 0; sum = int32(sum - DELTA)) {
    e = (sum >>> 2) & 3;
    for (p = n; p > 0; --p) {
      z = v[p - 1];
      y = v[p] = int32(v[p] - mx(sum, y, z, p, e, k));
    }
    z = v[n];
    y = v[0] = int32(v[0] - mx(sum, y, z, 0, e, k));
  }
  return v;
}

export function utf8Encode(str) {
  if (/^[\x00-\x7f]*$/.test(str)) {
    return str;
  }
  var buf = [];
  var n = str.length;
  for (var i = 0, j = 0; i < n; ++i, ++j) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit < 0x80) {
      buf[j] = str.charAt(i);
    } else if (codeUnit < 0x800) {
      buf[j] = String.fromCharCode(
        0xc0 | (codeUnit >> 6),
        0x80 | (codeUnit & 0x3f)
      );
    } else if (codeUnit < 0xd800 || codeUnit > 0xdfff) {
      buf[j] = String.fromCharCode(
        0xe0 | (codeUnit >> 12),
        0x80 | ((codeUnit >> 6) & 0x3f),
        0x80 | (codeUnit & 0x3f)
      );
    } else {
      if (i + 1 < n) {
        var nextCodeUnit = str.charCodeAt(i + 1);
        if (
          codeUnit < 0xdc00 &&
          0xdc00 <= nextCodeUnit &&
          nextCodeUnit <= 0xdfff
        ) {
          var rune =
            (((codeUnit & 0x03ff) << 10) | (nextCodeUnit & 0x03ff)) + 0x010000;
          buf[j] = String.fromCharCode(
            0xf0 | ((rune >> 18) & 0x3f),
            0x80 | ((rune >> 12) & 0x3f),
            0x80 | ((rune >> 6) & 0x3f),
            0x80 | (rune & 0x3f)
          );
          ++i;
          continue;
        }
      }
      throw new Error("Malformed string");
    }
  }
  return buf.join("");
}

export function utf8DecodeShortString(bs, n) {
  var charCodes = new Array(n);
  var i = 0,
    off = 0;
  for (var len = bs.length; i < n && off < len; i++) {
    var unit = bs.charCodeAt(off++);
    switch (unit >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        charCodes[i] = unit;
        break;
      case 12:
      case 13:
        if (off < len) {
          charCodes[i] = ((unit & 0x1f) << 6) | (bs.charCodeAt(off++) & 0x3f);
        } else {
          throw new Error("Unfinished UTF-8 octet sequence");
        }
        break;
      case 14:
        if (off + 1 < len) {
          charCodes[i] =
            ((unit & 0x0f) << 12) |
            ((bs.charCodeAt(off++) & 0x3f) << 6) |
            (bs.charCodeAt(off++) & 0x3f);
        } else {
          throw new Error("Unfinished UTF-8 octet sequence");
        }
        break;
      case 15:
        if (off + 2 < len) {
          var rune =
            (((unit & 0x07) << 18) |
              ((bs.charCodeAt(off++) & 0x3f) << 12) |
              ((bs.charCodeAt(off++) & 0x3f) << 6) |
              (bs.charCodeAt(off++) & 0x3f)) -
            0x10000;
          if (0 <= rune && rune <= 0xfffff) {
            charCodes[i++] = ((rune >> 10) & 0x03ff) | 0xd800;
            charCodes[i] = (rune & 0x03ff) | 0xdc00;
          } else {
            throw new Error(
              "Character outside valid Unicode range: 0x" + rune.toString(16)
            );
          }
        } else {
          throw new Error("Unfinished UTF-8 octet sequence");
        }
        break;
      default:
        throw new Error("Bad UTF-8 encoding 0x" + unit.toString(16));
    }
  }
  if (i < n) {
    charCodes.length = i;
  }
  return String.fromCharCode.apply(String, charCodes);
}

export function utf8DecodeLongString(bs, n) {
  var buf = [];
  var charCodes = new Array(0x8000);
  var i = 0,
    off = 0;
  for (var len = bs.length; i < n && off < len; i++) {
    var unit = bs.charCodeAt(off++);
    switch (unit >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        charCodes[i] = unit;
        break;
      case 12:
      case 13:
        if (off < len) {
          charCodes[i] = ((unit & 0x1f) << 6) | (bs.charCodeAt(off++) & 0x3f);
        } else {
          throw new Error("Unfinished UTF-8 octet sequence");
        }
        break;
      case 14:
        if (off + 1 < len) {
          charCodes[i] =
            ((unit & 0x0f) << 12) |
            ((bs.charCodeAt(off++) & 0x3f) << 6) |
            (bs.charCodeAt(off++) & 0x3f);
        } else {
          throw new Error("Unfinished UTF-8 octet sequence");
        }
        break;
      case 15:
        if (off + 2 < len) {
          var rune =
            (((unit & 0x07) << 18) |
              ((bs.charCodeAt(off++) & 0x3f) << 12) |
              ((bs.charCodeAt(off++) & 0x3f) << 6) |
              (bs.charCodeAt(off++) & 0x3f)) -
            0x10000;
          if (0 <= rune && rune <= 0xfffff) {
            charCodes[i++] = ((rune >> 10) & 0x03ff) | 0xd800;
            charCodes[i] = (rune & 0x03ff) | 0xdc00;
          } else {
            throw new Error(
              "Character outside valid Unicode range: 0x" + rune.toString(16)
            );
          }
        } else {
          throw new Error("Unfinished UTF-8 octet sequence");
        }
        break;
      default:
        throw new Error("Bad UTF-8 encoding 0x" + unit.toString(16));
    }
    if (i >= 0x7fff - 1) {
      var size = i + 1;
      charCodes.length = size;
      buf[buf.length] = String.fromCharCode.apply(String, charCodes);
      n -= size;
      i = -1;
    }
  }
  if (i > 0) {
    charCodes.length = i;
    buf[buf.length] = String.fromCharCode.apply(String, charCodes);
  }
  return buf.join("");
}

// n is UTF16 length
export function utf8Decode(bs, n) {
  if (n === undefined || n === null || n < 0) n = bs.length;
  if (n === 0) return "";
  if (/^[\x00-\x7f]*$/.test(bs) || !/^[\x00-\xff]*$/.test(bs)) {
    if (n === bs.length) return bs;
    return bs.substr(0, n);
  }
  return n < 0xffff
    ? utf8DecodeShortString(bs, n)
    : utf8DecodeLongString(bs, n);
}

export function encrypt(data, key) {
  if (data === undefined || data === null || data.length === 0) {
    return data;
  }
  data = utf8Encode(data);
  key = utf8Encode(key);
  // console.log(toBinaryString(encryptUint32Array(toUint32Array(data, true), fixk(toUint32Array(key, false))), false))
  return toBinaryString(
    encryptUint32Array(
      toUint32Array(data, true),
      fixk(toUint32Array(key, false))
    ),
    false
  );
}

export function encryptToBase64(data, key) {
  return global.btoa(encrypt(data, key));
}

export function decrypt(data, key) {
  if (data === undefined || data === null || data.length === 0) {
    return data;
  }
  key = utf8Encode(key);
  return utf8Decode(
    toBinaryString(
      decryptUint32Array(
        toUint32Array(data, false),
        fixk(toUint32Array(key, false))
      ),
      true
    )
  );
}

export function decryptFromBase64(data, key) {
  if (data === undefined || data === null || data.length === 0) {
    return data;
  }
  return decrypt(global.atob(data), key);
}
