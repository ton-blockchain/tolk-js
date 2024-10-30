const fs = require('fs')

let out = `// stdlib files are stored as strings in order to make it work on web (without fs.readFile)
module.exports = {\n\n`

let fileNames = [
  ...fs.readdirSync('./src/tolk-stdlib').filter(s => s.endsWith('.tolk')).sort(),
]

for (let fileName of fileNames) {
  const contents = fs.readFileSync('./src/tolk-stdlib/' + fileName, 'utf-8')
  out += `'@stdlib/${fileName}':\`${contents.replace(/`/g, '\\`')}\`,\n\n`
}

out += "};\n"
fs.writeFileSync('./src/stdlib.tolk.js', out)

// note, that Asm.fif and similar are embedded into wasm binary,
// but stdlib files are embedded here and distributed like separate files also -
// they are for IDE purposes, since both plugins for VS Code and IDEA auto-locate these files
