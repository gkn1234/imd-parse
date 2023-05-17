const fs = require("fs");
const pako = require('pako');
const xxtea = require('./xxtea');

let salt = 'RMP4TT3RN';
let path = 'hungarian_4k_hd';
let file_base64_data = fs.readFileSync('./' + path + '.rmp');
// console.log(file_base64_data.toString());

let decrypt_data = xxtea.decryptFromBase64(file_base64_data.toString(), salt + path);
// console.log(decrypt_data);

let decompress_data = _base64ToArrayBuffer(decrypt_data);
// console.log(decompress_data);

let inflate_data = pako.inflate(decompress_data);
console.log(inflate_data);

let imd_json = "";
for (p = 0; p < inflate_data.length / 8192; p++) {
    imd_json += String.fromCharCode.apply(null, inflate_data.slice(8192 * p, 8192 * (p + 1)));
}
imd_json += String.fromCharCode.apply(null, inflate_data.slice(8192 * p));

// console.log(imd_json);
fs.writeFileSync(path + '.imd.json', imd_json);

// 尝试反向加密
inflate_data = [];
let utf8_codes = [];
for (let i = 0; i < imd_json.length; i++) {
    utf8_codes.push(imd_json.charCodeAt(i));
    if (utf8_codes.length === 8192) {
        inflate_data = inflate_data.concat(utf8_codes);
        utf8_codes = [];
    }
}

if (utf8_codes.length > 0) {
    inflate_data = inflate_data.concat(utf8_codes);
}
inflate_data = new Uint8Array(inflate_data);
// console.log(charCodeArray);

let deflate_data = pako.deflate(inflate_data, { memLevel: 9 });
let encrypt_data = xxtea.encryptToBase64(_arrayBufferToBase64(deflate_data), salt + path);
console.log(encrypt_data == file_base64_data);


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