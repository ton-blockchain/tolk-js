import "wallet-storage"
import "./wallet-nothing"

// test that relative imports work, compilation doesn't fail
fun doNothing(s: Storage, d: Nothing) {
}
