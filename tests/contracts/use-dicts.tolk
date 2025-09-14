import "@stdlib/tvm-dicts"

fun prepareDict_3_30_4_40_5_x(valueAt5: int): dict {
    var dict: cell? = createEmptyDict();
    dict.iDictSetBuilder(32, 3, beginCell().storeInt(30, 32));
    dict.iDictSetBuilder(32, 4, beginCell().storeInt(40, 32));
    dict.iDictSetBuilder(32, 5, beginCell().storeInt(valueAt5, 32));
    return dict;
}

fun main(){
    prepareDict_3_30_4_40_5_x;
}
