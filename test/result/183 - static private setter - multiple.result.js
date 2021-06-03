function decorator1(value, context) {
  if (context.kind === "setter") {
    return function(v) {
      value.call(this, v * 2);
    };
  }
}

function decorator2(value, context) {
  if (context.kind === "setter") {
    return function(v) {
      value.call(this, v * 3);
    };
  }
}

if (!Symbol.metadata) {
  Symbol.metadata = Symbol("Symbol.metadata");
}

const __metadataPrivate = new WeakMap();

function __PrepareMetadata(base, kind, property) {
  function createObjectWithPrototype(obj, key) {
    if (!Object.hasOwnProperty.call(obj, key)) {
      for (let proto = obj; proto; proto = Object.getPrototypeOf(proto)) {
        if (Object.hasOwnProperty.call(proto, key)) {
          return obj[key] = Object.create(proto[key]);
        }
      }
      obj[key] = Object.create(null);
    }
  }
  return {
    getMetadata(key) {
      if (base[Symbol.metadata] && base[Symbol.metadata][key] && typeof base[Symbol.metadata][key][kind] !== "undefined") {
        return kind === "public" ? base[Symbol.metadata][key].public[property] : base[Symbol.metadata][key][kind];
      }
    },
    setMetadata(key, value) {
      if (typeof key !== "symbol") {
        throw new TypeError("the key must be a Symbol");
      }
      createObjectWithPrototype(base, Symbol.metadata);
      createObjectWithPrototype(base[Symbol.metadata], key);
      createObjectWithPrototype(base[Symbol.metadata][key], "public");
      if (!Object.hasOwnProperty.call(base[Symbol.metadata][key], "private")) {
        Object.defineProperty(base[Symbol.metadata][key], "private", {
          get() {
            return (__metadataPrivate.get(base[Symbol.metadata][key]) || []).concat(Object.getPrototypeOf(base[Symbol.metadata][key])?.private || []);
          }
        });
      }
      if (kind === "public") {
        base[Symbol.metadata][key].public[property] = value;
      } else if (kind === "private") {
        if (!__metadataPrivate.has(base[Symbol.metadata][key])) {
          __metadataPrivate.set(base[Symbol.metadata][key], []);
        }
        __metadataPrivate.get(base[Symbol.metadata][key]).push(value);
      } else if (kind === "constructor") {
        base[Symbol.metadata][key].constructor = value;
      }
    }
  };
}

const _C_p_symbol_u031lo = Symbol();

class C {
  static #q = 0;
  static _C_p_temp_7q2q9(v) {
    this.#q = v;
  }
  static [_C_p_symbol_u031lo] = decorator1(C._C_p_temp_7q2q9, {
    kind: "setter",
    name: "#p",
    isStatic: true,
    isPrivate: true,
    access: {
      get: C[_C_p_symbol_u031lo]
    },
    ...__PrepareMetadata(C, "private", undefined)
  }) ?? C._C_p_temp_7q2q9;
  static [_C_p_symbol_u031lo] = decorator2(C[_C_p_symbol_u031lo], {
    kind: "setter",
    name: "#p",
    isStatic: true,
    isPrivate: true,
    access: {
      get: C[_C_p_symbol_u031lo]
    },
    ...__PrepareMetadata(C, "private", undefined)
  }) ?? C[_C_p_symbol_u031lo];
  static set #p(v) {
    return C[_C_p_symbol_u031lo].bind(this)(v);
  }
  static [_C_p_symbol_u031lo]() {
    return C[_C_p_symbol_u031lo].bind(this);
  }
  static get #p() {
    return this.#q;
  }
  static get check() {
    return this.#p;
  }
  static set check(v) {
    this.#p = v;
  }
}

delete C._C_p_temp_7q2q9;

console.assert(C.check === 0);

C.check = 1;

console.assert(C.check === 6);