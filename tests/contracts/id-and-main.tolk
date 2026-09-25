fun id<T>(v: T) {
    return v;
}

fun main(v: int) {
    return id(v) + id(v);
}
