import {runTolkCompiler, getTolkCompilerVersion, TolkResultSuccess, TolkResultError} from "../src";
import fs from "fs";
import {Cell} from "@ton/core";

describe('tolk-js', () => {
  const walletCodeCellHash = "Bg+vB15TzyHO+CoGkTUbOAJbJEthskyCowQISlng0fI="

  it('npm package version should match Tolk version', async () => {
    let tolkVersion = await getTolkCompilerVersion()
    let npmVersion = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf-8')).version
    expect(tolkVersion).toBe(npmVersion)
  })

  it('should compile wallet', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "wallet-code.tolk",
      fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8')
    }) as TolkResultSuccess

    expect(result.status).toEqual('ok')
    let codeCell = Cell.fromBoc(Buffer.from(result.codeBoc64, "base64"))[0]
    expect(codeCell.hash().toString('base64')).toBe(walletCodeCellHash)
  })

  it('should handle required version', async () => {
    let tolkVersion = await getTolkCompilerVersion()
    let source = `
            tolk 0.1
            fun main() { return; }
`
    let result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: _ => source,
    }) as TolkResultError

    expect(result.status).toEqual('error')
    expect(result.message.startsWith('error:')).toBeTruthy();
    expect(result.message).toContain(`the contract is written in Tolk v0.1, but you use Tolk compiler v${tolkVersion}`)
  })

  it('should fail if fsReadCallback throws', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: function(path) {
        if (path === 'main.tolk') return 'import "non-existing.tolk";'
        throw `Can't resolve ${path}`
      }
    }) as TolkResultError

    expect(result.status).toEqual('error')
    expect(result.message).toContain("Can\'t resolve non-existing.tolk")
  })

  it('should normalize import paths', async () => {
    let res = await runTolkCompiler({
      entrypointFileName: 'main.tolk',
      fsReadCallback: function(path) {
        if (path === 'main.tolk') return `import "../lib.tolk"; import "some/../near.tolk"; import "/var/./cold.tolk"; fun main() {}`
        if (path === '../lib.tolk' || path === 'near.tolk' || path === '/var/cold.tolk')
          return ``
        throw "can't resolve path " + path
      },
    })

    expect((res as any).message).toBe(undefined)
  })

  it('should return sourcesSnapshot', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "wallet-code.tolk",
      fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8')
    }) as TolkResultSuccess

    expect(result.sourcesSnapshot.map(s => s.filename)).toStrictEqual([
        'wallet-code.tolk',
        '../imports/wallet-helpers.tolk',
        '../imports/wallet-storage.tolk',
        '../imports/wallet-nothing.tolk',
    ]);
  })

  it('should import @stdlib/ files', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "use-dicts.tolk",
      fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8')
    }) as TolkResultSuccess

    expect(result.status).toEqual('ok')
    expect(result.fiftCode).toContain('prepareDict_3_30_4_40_5_x')
  })

  it('should fail if import @stdlib/ unexisting', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: _ => 'import "@stdlib/nonexisting"'
    }) as TolkResultError

    expect(result.status).toEqual('error')
    expect(result.message).toContain("@stdlib/nonexisting.tolk not found")
  })

  it('should handle pathMappings', async () => {
    let queriedFiles = [] as string[]
    let result = await runTolkCompiler({
      entrypointFileName: __dirname + "/contracts/has-mapping-1.tolk",
      pathMappings: {
        '@tolk-js': __dirname + '/../',
        '@imports': __dirname + '/imports/',
      },
      fsReadCallback: path => {
        queriedFiles.push(path.substring(__dirname.length))
        return fs.readFileSync(path, 'utf-8')
      }
    }) as TolkResultSuccess

    expect(result.status).toEqual('ok')
    expect(queriedFiles).toStrictEqual([
      "/contracts/has-mapping-1.tolk",
      "/imports/wallet-nothing.tolk",
      "/imports/wallet-storage.tolk"
    ])
  })

  it('should gracefully fail on invalid import', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: _ => 'import "@asdf/me"'
    }) as TolkResultError

    expect(result.status).toEqual('error')
    expect(result.message).toContain('path mapping @asdf was not registered')
  })

  it('should contain abiJson', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "wallet-code.tolk",
      fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8')
    }) as TolkResultSuccess

    expect(result.abiJson['compiler_version']).toEqual('1.5.0')
    expect(result.abiJson['thrown_errors']).toContainEqual({"err_code": 34, "kind": "plain_int"})
  })

  it('should not contain debug marks by default', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "id-and-main.tolk",
      fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8')
    }) as TolkResultSuccess

    expect(result.status).toEqual('ok')
    expect(result.symbolTypesJson.files.length).toBe(2)
    expect(result.symbolTypesJson.functions.map((f:any) => f.name)).toEqual(['main', 'id<int>'])
    expect(result.debugMarksJson).toBeNull()
    expect(result.debugMarksBase64).toHaveLength(0)
  })

  it('should contain debug marks if an option passed', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "id-and-main.tolk",
      withDebugMarks: true,
      fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8')
    }) as TolkResultSuccess

    expect(result.debugMarksJson!.length).toBe(13)
    expect(result.debugMarksJson![0].kind).toBe('enter_fun')
    expect(result.debugMarksBase64.startsWith('te6ccg')).toBeTruthy()
  })

  it('should colorize errors if an option passed', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      colorizeErrors: true,
      fsReadCallback: _ => 'fun main(x) {}'
    }) as TolkResultError

    expect(result.message.startsWith('error:')).toBeFalsy();
    expect(result.message.startsWith("\x1b[1;31merror\x1b[0m\x1b[1m: \x1b[0m")).toBeTruthy();
  })
})
