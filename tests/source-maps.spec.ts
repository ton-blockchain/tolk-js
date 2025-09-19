import {runTolkCompiler, SourceMap} from "../src";
import {HighLevelSourceMapEntry} from "../src/high-level-source-map";

describe('source-maps', () => {
  it('should generate source map', async () => {
    const file = `fun main(a: int) {
    return max(a, 10);
}`

    const result = await runTolkCompiler({
      entrypointFileName: "wallet-code.tolk",
      fsReadCallback: () => file,
      collectSourceMap: true,
    })
    if (result.status !== 'ok') {
      throw result.message
    }

    if (result.sourceMap?.highlevelMapping) {
      const sourceMap = {
        ...result.sourceMap,
        highlevelMapping: {
          ...result.sourceMap.highlevelMapping,
          files: [],
          locations: result.sourceMap.highlevelMapping.locations.map(it => ({
            ...it,
            debug: undefined
          }))
        }
      }
      expect(sourceMap).toMatchSnapshot()
    }
  });

  it('should generate correct source map for simple function', async () => {
    const file = `fun main(a: int) {
    var x = a + 1;
    return max(x, 10);
}`
    await doTest(file);
  });

  it('should generate correct source map for lazy match', async () => {
    const file = `struct (0x1) Single {
    x: int32
}

struct (0x2) Pair {
    x: int32
    y: int32
}

type Data = Single | Pair

fun main(data: slice) {
    val thing = lazy Data.fromSlice(data);
    
    match (thing) {
        Single => {
            throw thing.x;
        }
        Pair => {
            throw thing.x + thing.y;
        }
        else => {
            return 10;
        }
    }
}`
    await doTest(file);
  });


  async function doTest(file: string) {
    const result = await runTolkCompiler({
      entrypointFileName: "test.tolk",
      fsReadCallback: () => file,
      collectSourceMap: true,
      withStackComments: true,
    })
    if (result.status !== 'ok') {
      throw result.message
    }

    expect(result.sourceMap).toBeDefined()
    const visualization = visualizeMappings(result.sourceMap!, file)
    expect(visualization).toMatchSnapshot()
  }
})

function visualizeMappings(sourceMap: SourceMap, sourceCode: string): string {
  const {highlevelMapping, assemblyMapping} = sourceMap
  let result = ''

  result += "\n"

  const lines = sourceCode.split('\n')
  const locationsByLine = new Map<number, HighLevelSourceMapEntry[]>()

  for (const location of highlevelMapping.locations) {
    if (!locationsByLine.has(location.loc.line)) {
      locationsByLine.set(location.loc.line, [])
    }
    locationsByLine.get(location.loc.line)!.push(location)
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const line = lines[i]
    const lineLocations = locationsByLine.get(lineNum) || []

    lineLocations.sort((a, b) => a.loc.col - b.loc.col)

    let modifiedLine = line
    let offset = 0

    for (const location of lineLocations) {
      const marker = `<#${location.idx}>`
      const insertPos = location.loc.col + offset
      modifiedLine = modifiedLine.slice(0, insertPos) + marker + modifiedLine.slice(insertPos)
      offset += marker.length
    }

    result += `${lineNum.toString().padStart(3)} | ${modifiedLine}\n`
  }

  result += "\n"

  for (const [cellHash, cell] of Object.entries(assemblyMapping.cells)) {
    if (!cell) continue
    result += `Cell ${cellHash.slice(0, 8)}...:\n`
    for (const instruction of cell.instructions) {
      const debugStr = instruction.debugSections.length > 0
          ? ` [${instruction.debugSections.map(it => `#${it}`).join(',')}]`
          : ''
      result += `  ${instruction.offset.toString().padStart(3)}: ${instruction.name}${debugStr}\n`
    }
    result += '\n'
  }

  return result
}
