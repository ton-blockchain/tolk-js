// @ts-ignore
import wasmModule from "./tolkfiftlib.js"
// @ts-ignore
import wasmBase64 from "./tolkfiftlib.wasm.js"
// @ts-ignore
import stdlibContents from "./stdlib.tolk.js"
import {realpath} from "./path-utils"
import {Cell, runtime, text, trace} from "ton-assembly";
import {AssemblyMapping, HighLevelMapping, SourceMap} from "ton-source-map"

let wasmBinary: Uint8Array | undefined = undefined

type WasmModule = any

export type FsReadCallback = (path: string) => string

export type TolkCompilerConfig = {
  entrypointFileName: string
  fsReadCallback: FsReadCallback
  optimizationLevel?: number
  withStackComments?: boolean
  withSrcLineComments?: boolean
  experimentalOptions?: string
  collectSourceMap?: boolean
}

export type TolkResultSuccess = {
  status: "ok"
  fiftCode: string
  codeBoc64: string
  codeHashHex: string
  stderr: string
  fiftSourceMapCode?: string
  sourceMapCodeRecompiledBoc64?: string
  sourceMapCodeBoc64?: string
  sourceMap?: SourceMap
  sourcesSnapshot: { filename: string, contents: string }[]
}

type TolkCompilerResultSuccess = {
  status: "ok"
  fiftCode: string
  codeBoc64: string
  codeHashHex: string
  stderr: string
  fiftSourceMapCode?: string
  sourceMapCodeBoc64?: string
  sourceMap?: HighLevelMapping
}

export type TolkResultError = {
  status: "error"
  message: string
}

function copyToCStringAllocating(mod: WasmModule, inStr: string): any {
  const len = mod.lengthBytesUTF8(inStr) + 1
  const ptr = mod._malloc(len)
  mod.stringToUTF8(inStr, ptr, len)
  return ptr
}

function copyToCStringPtr(mod: WasmModule, inStr: string, destPtr: any): any {
  const allocated = copyToCStringAllocating(mod, inStr)
  mod.setValue(destPtr, allocated, '*')
  return allocated
}

function copyFromCString(mod: WasmModule, inPtr: any): string {
  return mod.UTF8ToString(inPtr)
}

async function instantiateWasmModule() {
  if (wasmBinary === undefined) {
    if (typeof Buffer !== 'undefined') {  // node.js
      wasmBinary = new Uint8Array(Buffer.from(wasmBase64, 'base64'))
    } else if (typeof window !== 'undefined') {  // browser
      const binaryString = atob(wasmBase64)      // window.atob() is fast and safe for valid base64 strings
      wasmBinary = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        wasmBinary[i] = binaryString.charCodeAt(i)
      }
    }
  }
  return await wasmModule({wasmBinary})
}

export async function getTolkCompilerVersion(): Promise<string> {
  const mod = await instantiateWasmModule()

  const versionJsonPtr = mod._version()
  const result = JSON.parse(copyFromCString(mod, versionJsonPtr))
  mod._free(versionJsonPtr)

  return result.tolkVersion
}

export async function runTolkCompiler(compilerConfig: TolkCompilerConfig): Promise<TolkResultSuccess | TolkResultError> {
  const mod = await instantiateWasmModule()
  const allocatedPointers = []
  const sourcesSnapshot: TolkResultSuccess['sourcesSnapshot'] = []

  // see tolk-wasm.cpp: typedef void (*WasmFsReadCallback)(int, char const*, char**, char**)
  const callbackPtr = mod.addFunction(function (kind: number, dataPtr: any, destContents: any, destError: any) {
    switch (kind) { // enum ReadCallback::Kind in C++
      case 0:       // realpath
        let relativeFilename = copyFromCString(mod, dataPtr)  // from `import` statement, relative to cur file
        if (!relativeFilename.endsWith('.tolk')) {
          relativeFilename += '.tolk'
        }
        allocatedPointers.push(copyToCStringPtr(mod, realpath(relativeFilename), destContents))
        break
      case 1:       // read file
        try {
          const filename = copyFromCString(mod, dataPtr) // already normalized (as returned above)
          if (filename.startsWith('@stdlib/')) {
            if (filename in stdlibContents) {
              allocatedPointers.push(copyToCStringPtr(mod, stdlibContents[filename], destContents))
            } else {
              allocatedPointers.push(copyToCStringPtr(mod, filename + " not found", destError))
            }
          } else {
            const contents = compilerConfig.fsReadCallback(filename)
            sourcesSnapshot.push({ filename, contents })
            allocatedPointers.push(copyToCStringPtr(mod, contents, destContents))
          }
        } catch (err: any) {
          allocatedPointers.push(copyToCStringPtr(mod, err.message || err.toString(), destError))
        }
        break
      default:
        allocatedPointers.push(copyToCStringPtr(mod, 'Unknown callback kind=' + kind, destError))
        break
    }
  }, 'viiii')

  const configStr = JSON.stringify({  // undefined fields won't be present, defaults will be used, see tolk-wasm.cpp
    entrypointFileName: compilerConfig.entrypointFileName,
    optimizationLevel: compilerConfig.optimizationLevel,
    withStackComments: compilerConfig.withStackComments,
    withSrcLineComments: compilerConfig.withSrcLineComments,
    experimentalOptions: compilerConfig.experimentalOptions,
    collectSourceMap: compilerConfig.collectSourceMap,
  })

  const configStrPtr = copyToCStringAllocating(mod, configStr)
  allocatedPointers.push(configStrPtr)

  const resultPtr = mod._tolk_compile(configStrPtr, callbackPtr)
  allocatedPointers.push(resultPtr)
  const result: TolkCompilerResultSuccess | TolkResultError = JSON.parse(copyFromCString(mod, resultPtr))

  allocatedPointers.forEach(ptr => mod._free(ptr))
  mod.removeFunction(callbackPtr)

  if (result.status === 'error') {
    return result
  }

  if (compilerConfig.collectSourceMap) {
    // When we compile with a source map enabled, the compiler generates special DEBUGMARK %id
    // instructions that describe the start of a code section with a specific ID.
    // These instructions, along with the rest of the Fifth code, are compiled into "poisoned"
    // bitcode.
    // The result of this compilation is stored in the `sourceMapCodeBoc64` field.
    //
    // The code generated in this way is not runnable, since the DEBUGMARK instruction is
    // unknown to TVM, running such code directly will cause TVM to crash.
    //
    // And this is where the further code comes into play.
    //
    // Its task is to disassemble bitcode back into instructions, including DEBUGMARK, and
    // compile it back into bitcode.
    // Thanks to DEBUGMARK instructions, upon recompilation, TASM can map of each instruction
    // and the debug section, thus getting a complete source code map that is accurately down
    // to the specific TVM instruction.

    const sourceMapCodeCell = Cell.fromBase64(result.sourceMapCodeBoc64 ?? result.codeBoc64)
    const [cleanCell, mapping] = recompileCell(sourceMapCodeCell);
    const assemblyMapping: AssemblyMapping = trace.createMappingInfo(mapping)

    if (result.sourceMap === undefined) {
      console.warn('Source map was not generated. This is probably a bug in Tolk compiler.')
    }

    return {
      ...result,
      codeBoc64: result.codeBoc64,
      sourceMapCodeRecompiledBoc64: cleanCell.toBoc().toString('base64'),
      sourceMapCodeBoc64: result.sourceMapCodeBoc64,
      sourceMap: {
        highlevelMapping: result.sourceMap ?? emptyHighlevelMapping,
        assemblyMapping,
        recompiledCode: cleanCell.toBoc().toString('base64'),
      },
      sourcesSnapshot,
    }
  }

  return {...result, sourcesSnapshot, sourceMap: undefined}
}

function recompileCell(cell: Cell): [Cell, runtime.Mapping] {
  const instructions = runtime.decompileCell(cell);
  const assembly = text.print(instructions);

  const parseResult = text.parse("out.tasm", assembly);
  if (parseResult.$ === "ParseFailure") {
    throw new Error("Cannot parse resulting text Assembly");
  }

  return runtime.compileCellWithMapping(parseResult.instructions, {skipRefs: true});
}

const emptyHighlevelMapping: HighLevelMapping = {
  version: "0",
  language: "tolk",
  compiler_version: "",
  files: [],
  globals: [],
  locations: [],
};
