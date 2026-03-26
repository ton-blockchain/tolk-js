const fs = require('fs')

function sanitizeFileContents(contents) {
  return contents.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
}

let out = `// stdlib files are stored as strings in order to make it work on web (without fs.readFile)
module.exports = {\n\n`

let fileNames = [
  ...fs.readdirSync('./src/tolk-stdlib').filter(s => s.endsWith('.tolk')).sort(),
]

for (let fileName of fileNames) {
  const contents = fs.readFileSync('./src/tolk-stdlib/' + fileName, 'utf-8')
  out += `'@stdlib/${fileName}':\`${sanitizeFileContents(contents)}\`,\n\n`
}

let fiftFileNames = [
  ...fs.readdirSync('./src/fiftlib').filter(s => s.endsWith('.fif')).sort(),
]

for (let fileName of fiftFileNames) {
  const contents = fs.readFileSync('./src/fiftlib/' + fileName, 'utf-8')
  out += `'@fiftlib/${fileName}':\`${sanitizeFileContents(contents)}\`,\n\n`
}

out += "};\n"
fs.writeFileSync('./src/stdlib.tolk.js', out)
