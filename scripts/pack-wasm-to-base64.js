const fs = require('fs')

const wasmBinary = fs.readFileSync('./src/tolkfiftlib.wasm')
const out = `// tolkfiftlib.wasm is packed to base64 in order to make it work on web (without fs.readFile)
module.exports = '${wasmBinary.toString('base64')}';`

fs.writeFileSync('./src/tolkfiftlib.wasm.js', out)
