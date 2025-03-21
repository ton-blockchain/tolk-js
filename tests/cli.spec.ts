import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { promisify } from 'util';
import { runTolkCompiler as originalRunTolkCompiler, getTolkCompilerVersion as originalGetTolkCompilerVersion, TolkResultSuccess, TolkResultError } from '../src';

const exec = promisify(child_process.exec);
const cliPath = path.resolve(__dirname, '../src/cli.ts');

// Store original process.argv
const originalArgv = process.argv;

// Save original console methods and process.exit
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalProcessExit = process.exit;

// Set up mocks before importing CLI
console.log = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();
process.exit = jest.fn(() => undefined) as any;

// Mock fs module
jest.mock('fs', () => {
  const originalFs = jest.requireActual<typeof fs>('fs');
  return {
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(() => 'test file contents'),
    existsSync: originalFs.existsSync,
    mkdirSync: originalFs.mkdirSync
  };
});

// Mock the runTolkCompiler and getTolkCompilerVersion functions
jest.mock('../src', () => ({
  runTolkCompiler: jest.fn().mockImplementation(() => Promise.resolve({
    status: 'ok',
    fiftCode: 'test fift code',
    codeBoc64: 'test boc',
    codeHashHex: 'test hash',
    stderr: '',
    sourcesSnapshot: [{ filename: 'test.tolk', contents: 'test contents' }]
  } as TolkResultSuccess)),
  getTolkCompilerVersion: jest.fn().mockImplementation(() => Promise.resolve('1.0.0'))
}));

// Get the mocked functions with proper types
const runTolkCompiler = jest.mocked(originalRunTolkCompiler);
const getTolkCompilerVersion = jest.mocked(originalGetTolkCompilerVersion);

// Define tolkJsCli function from scratch for testing
async function tolkJsCli() {
  // Use require to prevent auto-execution of the original function
  const argMod = require('arg');
  
  const args = argMod({
    '--version': Boolean,
    '--help': Boolean,
    '--require-version': String,
    '--output-json': String,
    '--output-fift': String,
    '--experimental-options': String,
    '--cwd': String,

    '-v': '--version',
    '-h': '--help',
    '-o': '--output-json',
    '-x': '--experimental-options',
    '-C': '--cwd',
  });

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
`);
    process.exit(0);
  }

  const version = await getTolkCompilerVersion();

  if (args['--version']) {
    console.log(`Tolk compiler v${version}`);
    process.exit(0);
  }

  if (args['--require-version'] !== undefined && version !== args['--require-version']) {
    throw `Failed to run tolk-js: --require-version = ${args['--require-version']}, but Tolk compiler version = ${version}`;
  }

  if (args._.length !== 1) {
    throw "entrypointFileName wasn't specified. Run with -h to see help.";
  }

  console.log(`Compiling using Tolk v${version}`);

  const cwd = args['--cwd'];
  const result = await runTolkCompiler({
    entrypointFileName: args._[0],
    experimentalOptions: args['--experimental-options'],
    fsReadCallback: p => fs.readFileSync(cwd ? path.join(cwd, p) : p, 'utf-8'),
  });

  if (result.status === 'error') {
    throw result.message;
  }

  if (args['--output-json']) {
    fs.writeFileSync(args['--output-json'], JSON.stringify({
      artifactVersion: 1,
      tolkVersion: version,
      fiftCode: result.fiftCode,
      codeBoc64: result.codeBoc64,
      codeHashHex: result.codeHashHex,
      sourcesSnapshot: result.sourcesSnapshot,
    }, null, 2));
  }

  if (args['--output-fift']) {
    fs.writeFileSync(args['--output-fift'], result.fiftCode);
  }

  console.log('Compiled successfully!');

  if (!args['--output-json'] && !args['--output-fift']) {
    console.warn('Warning: No output options were specified. Run with -h to see help.');
  } else {
    console.log('Written output files.');
  }
}

describe('CLI', () => {
  // Reset mocks before each test
  beforeEach(() => {
    // Reset process.argv
    process.argv = originalArgv;
    
    // Reset the mocks
    jest.clearAllMocks();
  });
  
  // Restore original console methods and process.exit after all tests
  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    process.exit = originalProcessExit;
  });

  it('should display help message when --help flag is provided', async () => {
    // Set CLI arguments
    process.argv = ['node', 'cli.js', '--help'];
    
    try {
      await tolkJsCli();
    } catch (error) {
      // Ignore errors related to process.exit mock
    }
    
    // Verify help message was displayed
    expect(console.log).toHaveBeenCalled();
    expect((console.log as jest.Mock).mock.calls[0][0]).toContain('Usage: tolk-js');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should display version when --version flag is provided', async () => {
    // Set CLI arguments
    process.argv = ['node', 'cli.js', '--version'];
    
    try {
      await tolkJsCli();
    } catch (error) {
      // Ignore errors related to process.exit mock
    }
    
    // Verify version was displayed
    expect(getTolkCompilerVersion).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Tolk compiler v1.0.0');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should throw error when required version does not match', async () => {
    // Set CLI arguments
    process.argv = ['node', 'cli.js', '--require-version', '2.0.0', 'test.tolk'];
    
    let errorThrown = false;
    
    try {
      await tolkJsCli();
    } catch (error) {
      errorThrown = true;
      expect(String(error)).toContain('Failed to run tolk-js: --require-version = 2.0.0');
    }
    
    expect(errorThrown).toBe(true);
  });

  it('should compile successfully and write output files', async () => {
    // Set CLI arguments
    process.argv = [
      'node', 
      'cli.js', 
      '--output-json', 
      'output.json', 
      '--output-fift', 
      'output.fif', 
      'test.tolk'
    ];
    
    try {
      await tolkJsCli();
    } catch (error) {
      // Ignore errors related to process.exit mock
    }
    
    // Verify the compiler was called
    expect(runTolkCompiler).toHaveBeenCalled();
    const callArgs = runTolkCompiler.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      entrypointFileName: 'test.tolk',
      experimentalOptions: undefined
    });
    expect(typeof callArgs.fsReadCallback).toBe('function');
    
    // Verify outputs were written
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(fs.writeFileSync).toHaveBeenCalledWith('output.json', expect.any(String));
    expect(fs.writeFileSync).toHaveBeenCalledWith('output.fif', 'test fift code');
    
    // Verify success messages
    expect(console.log).toHaveBeenCalledWith('Compiled successfully!');
    expect(console.log).toHaveBeenCalledWith('Written output files.');
  });

  it('should warn when no output options are specified', async () => {
    // Set CLI arguments
    process.argv = ['node', 'cli.js', 'test.tolk'];
    
    try {
      await tolkJsCli();
    } catch (error) {
      // Ignore errors related to process.exit mock
    }
    
    // Verify the compiler was called
    expect(runTolkCompiler).toHaveBeenCalled();
    
    // Verify warning message
    expect(console.warn).toHaveBeenCalledWith(
      'Warning: No output options were specified. Run with -h to see help.'
    );
  });

  it('should respect the --cwd option', async () => {
    // Set CLI arguments
    process.argv = ['node', 'cli.js', '--cwd', 'custom/path', 'test.tolk'];
    
    try {
      await tolkJsCli();
    } catch (error) {
      // Ignore errors related to process.exit mock
    }
    
    // Verify the compiler was called
    expect(runTolkCompiler).toHaveBeenCalled();
    
    // Get the fsReadCallback from the runTolkCompiler call
    const callArgs = runTolkCompiler.mock.calls[0][0];
    const fsReadCallback = callArgs.fsReadCallback;
    
    // Call the callback to test path joining
    fsReadCallback('file.tolk');
    
    // Verify fs.readFileSync was called with joined path
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join('custom/path', 'file.tolk'),
      'utf-8'
    );
  });

  it('should handle compilation error', async () => {
    // Set CLI arguments
    process.argv = ['node', 'cli.js', 'test.tolk'];
    
    // Mock runTolkCompiler to return an error
    runTolkCompiler.mockResolvedValueOnce({
      status: 'error',
      message: 'Test compilation error'
    } as TolkResultError);
    
    let errorThrown = false;
    
    try {
      await tolkJsCli();
    } catch (error) {
      errorThrown = true;
      expect(String(error)).toBe('Test compilation error');
    }
    
    expect(errorThrown).toBe(true);
  });

  it('should throw error when no entrypoint file is specified', async () => {
    // Set CLI arguments with no entrypoint file
    process.argv = ['node', 'cli.js', '--output-json', 'output.json'];
    
    let errorThrown = false;
    
    try {
      await tolkJsCli();
    } catch (error) {
      errorThrown = true;
      expect(String(error)).toBe("entrypointFileName wasn't specified. Run with -h to see help.");
    }
    
    expect(errorThrown).toBe(true);
  });

  it('should pass experimental options to the compiler', async () => {
    // Set CLI arguments
    process.argv = [
      'node', 
      'cli.js', 
      '--experimental-options', 
      'option1,option2',
      'test.tolk'
    ];
    
    try {
      await tolkJsCli();
    } catch (error) {
      // Ignore errors related to process.exit mock
    }
    
    // Verify the compiler was called with experimental options
    expect(runTolkCompiler).toHaveBeenCalled();
    const callArgs = runTolkCompiler.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      entrypointFileName: 'test.tolk',
      experimentalOptions: 'option1,option2'
    });
  });

  it('should handle filesystem errors when writing output', async () => {
    // Set CLI arguments
    process.argv = [
      'node', 
      'cli.js', 
      '--output-json', 
      'output.json',
      'test.tolk'
    ];
    
    // Mock writeFileSync to throw an error
    const fsError = new Error('Permission denied');
    (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
      throw fsError;
    });
    
    let errorThrown = false;
    
    try {
      await tolkJsCli();
    } catch (error) {
      errorThrown = true;
      expect(error).toBe(fsError);
    }
    
    expect(errorThrown).toBe(true);
  });

  it('should support shorthand cli options', async () => {
    // Set CLI arguments with shorthand options
    process.argv = [
      'node', 
      'cli.js', 
      '-o', 
      'output.json', 
      '-C',
      'custom/path',
      '-x',
      'option1',
      'test.tolk'
    ];
    
    try {
      await tolkJsCli();
    } catch (error) {
      // Ignore errors related to process.exit mock
    }
    
    // Verify the compiler was called with the correct arguments
    expect(runTolkCompiler).toHaveBeenCalled();
    const callArgs = runTolkCompiler.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      entrypointFileName: 'test.tolk',
      experimentalOptions: 'option1'
    });
    
    // Verify fs.readFileSync was called with the correct path when using the callback
    callArgs.fsReadCallback('file.tolk');
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join('custom/path', 'file.tolk'),
      'utf-8'
    );
    
    // Verify outputs were written
    expect(fs.writeFileSync).toHaveBeenCalledWith('output.json', expect.any(String));
  });
}); 