// Simple wallet smart contract
import "@stdlib/gas-payments"
import "@stdlib/tvm-lowlevel"
import "../imports/wallet-helpers"
import "../imports/./wallet-storage.tolk"

fun onInternalMessage(inMsg: slice) {
  // do nothing for internal messages
}

fun onExternalMessage(inMsg: slice) {
  var signature = inMsg.loadBits(512);
  var cs = inMsg;
  var (msgSeqno, validUntil) = (cs.loadUint(32), cs.loadUint(32));
  assert(!(validUntil <= blockchain.now())) throw 35;
  var st = Storage.fromCell(contract.getData());
  assert(msgSeqno == st.seqno) throw 33;
  assert(isSignatureValid(inMsg.hash(), signature, st.publicKey)) throw 34;
  acceptExternalMessage();
  cs.stackMoveToTop();
  while (cs.remainingRefsCount()) {
    var mode = cs.loadUint(8);
    sendRawMessage(cs.loadRef(), mode)
  }
  cs.assertEnd();
  st.seqno += 1;
  contract.setData(st.toCell());
}

// Get methods

get fun seqno(): int {
  return contract.getData().beginParse().preloadUint(32)
}

get fun get_public_key(): int {
  var cs = contract.getData().beginParse();
  cs.loadUint(32);
  return cs.preloadUint(256);
}
