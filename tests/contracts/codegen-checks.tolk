@method_id(101)
fun check1() {
    return beginCell().endCell().beginParse().hash()
}

@method_id(102)
fun check2() {
    return createEmptySlice().loadAny<address?>()
}

@method_id(103)
fun check3() {
    return ("".literalSlice() as address).toCell()
}

@method_id(104)
fun check4() {
    return grams("0.05");
}

fun main() {
    
}
