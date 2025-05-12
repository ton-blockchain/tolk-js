import {runTolkCompiler, getTolkCompilerVersion, TolkResultSuccess, TolkResultError} from "../src";
import fs from "fs";
import {Cell} from "@ton/core";

describe('tolk-js', () => {
  const walletCodeCellHash = "hA3nAz+xEJePYGrDyjJ+BXBcxSp9Y2xaAFLRgGntfDs="

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
    }) as TolkResultSuccess

    expect(result.status).toEqual('ok')
    expect(result.stderr).toContain(`the contract is written in Tolk v0.1, but you use Tolk compiler v${tolkVersion}`)
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

  it('should pass experimentalOptions', async () => {
    let res = await runTolkCompiler({
      entrypointFileName: 'with-unused.tolk',
      fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8'),
      experimentalOptions: 'remove-unused-functions'
    }) as TolkResultSuccess

    expect(res.fiftCode).not.toContain('unusedF')
  })

  it('should return sourcesSnapshot', async () => {
    let result = await runTolkCompiler({
      entrypointFileName: "wallet-code.tolk",
      fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8')
    }) as TolkResultSuccess

    expect(result.sourcesSnapshot).toStrictEqual([
      {
        filename: 'wallet-code.tolk',
        contents: fs.readFileSync(__dirname + '/contracts/wallet-code.tolk', 'utf-8'),
      }
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
})
