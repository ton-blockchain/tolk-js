import {realpath} from '../src/path-utils'

describe('realpath', () => {
  it('should not change already normalized', () => {
    const should_be_unchanged = [
      'some.tolk',
      'some/utils.tolk',
      '/var/tmp/stdlib.tolk',
      '.gitignore',
      '../stdlib.tolk',
      '@stdlib/gas-payments',
      '@stdlib/gas-payments.tolk',
    ]
    for (let p of should_be_unchanged) {
      expect(realpath(p)).toBe(p)
    }
  })

  it('should normalize dots', () => {
    expect(realpath('some/../some/utils.tolk')).toBe('some/utils.tolk')
    expect(realpath('./my.tolk')).toBe('my.tolk')
    expect(realpath('.././')).toBe('..')
  })

  it('should preserve absolute paths', () => {
    expect(realpath('/usr/../my.tolk')).toBe('/my.tolk')
    expect(realpath('/usr/../../usr/my.tolk')).toBe('/usr/my.tolk')
  })

  it('should handle empty input', () => {
    expect(realpath('')).toBe('.')
    expect(realpath('.')).toBe('.')
    expect(realpath('/')).toBe('/')
    expect(realpath('   ')).toBe('   ')
  })
})
