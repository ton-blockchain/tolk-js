// Simple wallet smart contract
import "@stdlib/gas-payments"
import "@stdlib/tvm-lowlevel"

fun onInternalMessage(inMsg: slice) {
  // do nothing for internal messages
}

fun onExternalMessage(inMsg: slice) {
  var signature = inMsg.loadBits(512);
  var cs = inMsg;
  var (msgSeqno, validUntil) = (cs.loadUint(32), cs.loadUint(32));
  assert(!(validUntil <= now())) throw 35;
  var ds = getContractData().beginParse();
  var (storedSeqno, publicKey) = (ds.loadUint(32), ds.loadUint(256));
  ds.assertEndOfSlice();
  assert(msgSeqno == storedSeqno) throw 33;
  assert(isSignatureValid(sliceHash(inMsg), signature, publicKey)) throw 34;
  acceptExternalMessage();
  cs.stackMoveToTop();
  while (cs.getRemainingRefsCount()) {
    var mode = cs.loadUint(8);
    sendRawMessage(cs.loadRef(), mode)
  }
  cs.assertEndOfSlice();
  setContractData(beginCell().storeUint(storedSeqno + 1, 32).storeUint(publicKey, 256).endCell());
}

// Get methods

get seqno(): int {
  return getContractData().beginParse().preloadUint(32)
}

get get_public_key(): int {
  var cs = getContractData().beginParse();
  cs.loadUint(32);
  return cs.preloadUint(256);
}
