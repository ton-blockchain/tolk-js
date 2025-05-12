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
  assert(!(validUntil <= blockchain.now())) throw 35;
  var ds = contract.getData().beginParse();
  var (storedSeqno, publicKey) = (ds.loadUint(32), ds.loadUint(256));
  ds.assertEnd();
  assert(msgSeqno == storedSeqno) throw 33;
  assert(isSignatureValid(inMsg.hash(), signature, publicKey)) throw 34;
  acceptExternalMessage();
  cs.stackMoveToTop();
  while (cs.remainingRefsCount()) {
    var mode = cs.loadUint(8);
    sendRawMessage(cs.loadRef(), mode)
  }
  cs.assertEnd();
  contract.setData(beginCell().storeUint(storedSeqno + 1, 32).storeUint(publicKey, 256).endCell());
}

// Get methods

get seqno(): int {
  return contract.getData().beginParse().preloadUint(32)
}

get get_public_key(): int {
  var cs = contract.getData().beginParse();
  cs.loadUint(32);
  return cs.preloadUint(256);
}
