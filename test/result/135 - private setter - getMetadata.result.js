const META = Symbol();

function meta(value) {
  return function(element, context) {
    const a = context.getMetadata(META) || [0];
    context.setMetadata(META, a[a.length - 1] + value);
  };
}

if (!Symbol.metadata) {
  Symbol.metadata = Symbol("Symbol.metadata");
}

const __metadataPrivate = new WeakMap();

function __PrepareMetadata(base, kind, property) {
  function createObjectWithPrototype(obj, key) {
    if (!Object.hasOwnProperty.call(obj, key)) {
      obj[key] = Object.create(obj[key] || null);
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

const _C_p_symbol_mho7j8 = Symbol();

const _C_p_symbol_pca0d8 = Symbol();

class C {
  _C_p_temp_0gke7o(v) {}
  static [_C_p_symbol_mho7j8] = meta(1)(C.prototype._C_p_temp_0gke7o, {
    kind: "setter",
    name: "#p",
    isStatic: false,
    isPrivate: true,
    access: {
      get: C.prototype[_C_p_symbol_mho7j8]
    },
    ...__PrepareMetadata(C.prototype, "private", undefined)
  }) ?? C.prototype._C_p_temp_0gke7o;
  static [_C_p_symbol_mho7j8] = meta(2)(C[_C_p_symbol_mho7j8], {
    kind: "setter",
    name: "#p",
    isStatic: false,
    isPrivate: true,
    access: {
      get: C.prototype[_C_p_symbol_mho7j8]
    },
    ...__PrepareMetadata(C.prototype, "private", undefined)
  }) ?? C[_C_p_symbol_mho7j8];
  set #p(v) {
    return C[_C_p_symbol_mho7j8].bind(this)(v);
  }
  [_C_p_symbol_mho7j8]() {
    return C[_C_p_symbol_mho7j8].bind(this);
  }
  _C_p_temp_rusgqo() {}
  static [_C_p_symbol_pca0d8] = meta(3)(C.prototype._C_p_temp_rusgqo, {
    kind: "getter",
    name: "#p",
    isStatic: false,
    isPrivate: true,
    access: {
      get: C.prototype[_C_p_symbol_pca0d8]
    },
    ...__PrepareMetadata(C.prototype, "private", undefined)
  }) ?? C.prototype._C_p_temp_rusgqo;
  static [_C_p_symbol_pca0d8] = meta(4)(C[_C_p_symbol_pca0d8], {
    kind: "getter",
    name: "#p",
    isStatic: false,
    isPrivate: true,
    access: {
      get: C.prototype[_C_p_symbol_pca0d8]
    },
    ...__PrepareMetadata(C.prototype, "private", undefined)
  }) ?? C[_C_p_symbol_pca0d8];
  get #p() {
    return C[_C_p_symbol_pca0d8].bind(this)();
  }
  [_C_p_symbol_pca0d8]() {
    return C[_C_p_symbol_pca0d8].bind(this);
  }
}

delete C.prototype._C_p_temp_rusgqo;

delete C.prototype._C_p_temp_0gke7o;

console.assert(C.prototype[Symbol.metadata][META].private[0] === 1);

console.assert(C.prototype[Symbol.metadata][META].private[1] === 3);

console.assert(C.prototype[Symbol.metadata][META].private[2] === 6);

console.assert(C.prototype[Symbol.metadata][META].private[3] === 10);