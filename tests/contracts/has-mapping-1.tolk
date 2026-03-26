// "@imports = imports" set in config
// "@tolk-js = /PROJECT_ROOT" set in config
import "@imports/wallet-nothing"
import "@tolk-js/tests/imports/wallet-storage"
import "@tolk-js/tests/imports/wallet-nothing"

fun f(st: Storage) {
    return st.seqno + st.publicKey
}

fun main() {
    var v = Nothing {};
}
