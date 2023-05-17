const fs = require("fs");
const pako = require('pako');
const xxtea = require('./xxtea');

let input_file = process.argv[2];
let output_filepath = process.argv[3];
let path = process.argv[4];
let imd_json = fs.readFileSync(input_file).toString();
let salt = 'RMP4TT3RN';
console.log(imd_json);

// 尝试反向加密
let inflate_data = [];
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

fs.writeFileSync(output_filepath, encrypt_data);


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