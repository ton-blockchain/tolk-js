#!/usr/bin/env node
import arg from 'arg'
import fs from 'fs'
import path from 'path'
import {runTolkCompiler, getTolkCompilerVersion} from '.'

async function tolkJsCli() {
  const args = arg({
    '--version': Boolean,
    '--help': Boolean,
    '--require-version': String,
    '--output-json': String,
    '--output-fift': String,
    '--experimental-options': String,
    '--cwd': String,
    '--source-map': Boolean,

    '-v': '--version',
    '-h': '--help',
    '-o': '--output-json',
    '-x': '--experimental-options',
    '-C': '--cwd',
  })

  if (args['--help']) {
    console.log(`Usage: tolk-js [OPTIONS] entrypointFileName.tolk
Options:
-h, --help — print this help and exit
-v, --version — print Tolk compiler version and exit
--require-version <version> — exit if Tolk compiler version differs from the required
--output-json <filename>, -o <filename> — output .json file with BoC, Fift code, and some other stuff
--output-fif <filename> - output .fif file with Fift code output
--experimental-options <names> - set experimental compiler options, comma-separated
--cwd <path>, -C <path> — sets cwd to locate .tolk files (doesn't affect output paths)
--source-map — collect a source map for debugging
`)
    process.exit(0)
  }

  const version = await getTolkCompilerVersion()

  if (args['--version']) {
    console.log(`Tolk compiler v${version}`)
    process.exit(0)
  }

  if (args['--require-version'] !== undefined && version !== args['--require-version']) {
    throw `Failed to run tolk-js: --require-version = ${args['--require-version']}, but Tolk compiler version = ${version}`
  }

  if (args._.length !== 1) {
    throw 'entrypointFileName wasn\'t specified. Run with -h to see help.'
  }

  console.log(`Compiling using Tolk v${version}`)

  const cwd = args['--cwd']
  const result = await runTolkCompiler({
    entrypointFileName: args._[0],
    experimentalOptions: args['--experimental-options'],
    fsReadCallback: p => fs.readFileSync(cwd ? path.join(cwd, p) : p, 'utf-8'),
    collectSourceMap: args['--source-map'] === true,
  })

  if (result.status === 'error') {
    throw result.message
  }

  if (args['--output-json']) {
    fs.writeFileSync(args['--output-json'], JSON.stringify({
      artifactVersion: 1,
      tolkVersion: version,
      fiftCode: result.fiftCode,
      codeBoc64: result.codeBoc64,
      codeHashHex: result.codeHashHex,
      sourcesSnapshot: result.sourcesSnapshot,
      fiftSourceMapCode: result.fiftSourceMapCode,
      sourceMapCodeRecompiledBoc64: result.sourceMapCodeRecompiledBoc64,
      sourceMapCodeBoc64: result.sourceMapCodeBoc64,
      sourceMap: result.sourceMap,
    }, null, 2))
  }

  if (args['--output-fift']) {
    fs.writeFileSync(args['--output-fift'], result.fiftCode)
  }

  console.log('Compiled successfully!')

  if (!args['--output-json'] && !args['--output-fift']) {
    console.warn('Warning: No output options were specified. Run with -h to see help.')
  } else {
    console.log('Written output files.')
  }
}

tolkJsCli().catch(ex => {
  console.error(ex)
  process.exit(1)
})
