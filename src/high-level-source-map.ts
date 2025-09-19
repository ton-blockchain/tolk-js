enum FunctionInlineMode {
    NotCalculated = 0,
    InlineViaFif = 1,
    InlineRef = 2,
    InlineInPlace = 3,
    NoInline = 4,
}

export type HighLevelSourceMapLocation = {
    readonly file: string
    readonly line: number
    readonly col: number
    readonly line_offset: number
    readonly length: number
}

export type HighLevelSourceMapEntryContext = {
    readonly descr?: string
    readonly is_entry?: boolean
    readonly ast_kind: string
    readonly func_name: string
    readonly inlined_to_func?: string
    readonly func_inline_mode: FunctionInlineMode
    readonly before_inlined_function_call?: boolean
    readonly after_inlined_function_call?: boolean
}

export type HighLevelSourceMapDebugInfo = {
    readonly opcode?: string
    readonly line_str?: string
    readonly line_off?: string
}

export type HighLevelSourceMapEntry = {
    readonly idx: number
    readonly loc: HighLevelSourceMapLocation
    readonly vars: readonly HighLevelSourceMapVariable[]
    readonly context: HighLevelSourceMapEntryContext
    readonly debug?: HighLevelSourceMapDebugInfo
}

export type HighLevelSourceMapVariable = {
    readonly name: string
    readonly type: string
    readonly constant_value?: string
    readonly possible_qualifier_types: readonly string[]
}

export type HighLevelSourceMapGlobalVariable = {
    readonly name: string
    readonly type: string
}

export type HighLevelSourceMapFile = {
    readonly path: string
    readonly is_stdlib: boolean
    readonly content: string
}

/**
 * Represents a high-level source map.
 * "High-level" in this case means that this source map only contains a mapping from DEBUGMARK ID to
 * high-level language code, but it does not contain any further mapping from DEBUGMARK ID to
 * specific instructions in bitcode.
 */
export type HighLevelSourceMap = {
    readonly version: string
    readonly files: readonly HighLevelSourceMapFile[]
    readonly globals: readonly HighLevelSourceMapGlobalVariable[]
    readonly locations: readonly HighLevelSourceMapEntry[]
    readonly debugCode64?: string
}
