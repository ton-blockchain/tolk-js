import {runTolkCompiler, getTolkCompilerVersion, TolkResultSuccess, TolkResultError} from "../src";
import fs from "fs";

const EXPECT_TO_CONTAIN = [
`
  check1() PROC:<{
    x{} PUSHSLICE
    HASHSU
  }>
`,
`
  check2() PROC:<{
    x{} PUSHSLICE
    LDOPTSTDADDR
    DROP
  }>
`,
`
  check3() PROC:<{
    x{} PUSHSLICE
    NEWC
    STSTDADDR
    ENDC
  }>
`,
]

const EXPECT_NOT_TO_CONTAIN = [
    'HASHBU',
]

describe('codegen-checks', () => {
    let outFiftCode = ''

    beforeAll(async () => {
        let result = await runTolkCompiler({
            entrypointFileName: "codegen-checks.tolk",
            fsReadCallback: path => fs.readFileSync(`./tests/contracts/${path}`, 'utf-8')
        }) as TolkResultSuccess

        expect(result.status).toEqual('ok')
        outFiftCode = result.fiftCode
    })
    
    it('check contains', () => {
        for (let subFift of EXPECT_TO_CONTAIN) {
            expect(outFiftCode).toContain(subFift.trim())
        }
        for (let subFift of EXPECT_NOT_TO_CONTAIN) {
            expect(outFiftCode).not.toContain(subFift)
        }
    })
})
