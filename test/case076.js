function decorator (value, context) {
  console.log("value", value);
  console.log("context", context);
  return {
    initialize() {
      this.test = 10;
    }
  }
}


class C {
  @init:decorator
  static set p(v) {}
}

console.assert(C.test === 10);