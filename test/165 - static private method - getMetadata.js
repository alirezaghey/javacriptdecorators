const ONE = Symbol();
function decorator(value) {
  return function (method, context) {
    const a = context.getMetadata(ONE) || [0];
    context.setMetadata(ONE, a[a.length - 1] + value);
  }
}

class C {
  @decorator(1)
  @decorator(2)
  static #m() {}
}

console.assert(C[Symbol.metadata][ONE].private[0] === 1);
console.assert(C[Symbol.metadata][ONE].private[1] === 3);
