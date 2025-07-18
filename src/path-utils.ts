const SLASH = 47
const DOT = 46

// this function is directly from node source
function posixNormalize(path: string, allowAboveRoot: boolean): string {
  let res = ''
  let lastSegmentLength = 0
  let lastSlash = -1
  let dots = 0
  let code

  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) {
      code = path.charCodeAt(i)
    } else if (code === SLASH) {
      break
    } else {
      code = SLASH
    }
    if (code === SLASH) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          res.charCodeAt(res.length - 1) !== DOT ||
          res.charCodeAt(res.length - 2) !== DOT
        ) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf('/')
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = ''
                lastSegmentLength = 0
              } else {
                res = res.slice(0, lastSlashIndex)
                lastSegmentLength = res.length - 1 - res.lastIndexOf('/')
              }
              lastSlash = i
              dots = 0
              continue
            }
          } else if (res.length === 2 || res.length === 1) {
            res = ''
            lastSegmentLength = 0
            lastSlash = i
            dots = 0
            continue
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) {
            res += '/..'
          } else {
            res = '..'
          }
          lastSegmentLength = 2
        }
      } else {
        if (res.length > 0) {
          res += '/' + path.slice(lastSlash + 1, i)
        } else {
          res = path.slice(lastSlash + 1, i)
        }
        lastSegmentLength = i - lastSlash - 1
      }
      lastSlash = i
      dots = 0
    } else if (code === DOT && dots !== -1) {
      ++dots
    } else {
      dots = -1
    }
  }

  return res
}

// 'realpath' in Tolk internals is used to resolve imports
// (e.g., to detect that `import "a.tolk"` and `import "dir/../a"` reference the same file)
// here we do the same using manual normalization, taken from Node internals (to work in web)
//
// also, 'realpath' in C++ resolves symlinks
// here, in tolk-js, we don't do anything about it, since we don't perform actual file reading
export function realpath(p: string): string {
  let isAbsolute = p.charCodeAt(0) === SLASH
  let path = posixNormalize(p, !isAbsolute)

  if (isAbsolute) { // posixNormalize() drops leading slash
    return '/' + path
  }
  return path.length === 0 ? '.' : path
}
