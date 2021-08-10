function decorator1(value, context) {
  if (context.kind === "getter") {
    return function() {
      return value.call(this) * 2;
    };
  }
}

function decorator2(value, context) {
  if (context.kind === "getter") {
    return function() {
      return value.call(this) * 3;
    };
  }
}

if (!Symbol.metadata) {
  Symbol.metadata = Symbol("Symbol.metadata");
}

const __metadataPrivate = new WeakMap();

function __PrepareMetadata(base, kind, property) {
  const createObjectWithPrototype = (obj, key) => Object.hasOwnProperty.call(obj, key) ? obj[key] : Object.create(obj[key] || Object.prototype);
  return {
    getMetadata(key) {
      if (base[Symbol.metadata] && base[Symbol.metadata][key] && typeof base[Symbol.metadata][key][kind] !== "undefined") {
        return kind === "public" ? base[Symbol.metadata][key].public[property] : kind === "private" ? __metadataPrivate.has(base[Symbol.metadata][key]) ? __metadataPrivate.get(base[Symbol.metadata][key])[property] : undefined : base[Symbol.metadata][key][kind];
      }
    },
    setMetadata(key, value) {
      if (typeof key !== "symbol") {
        throw new TypeError("the key must be a Symbol");
      }
      base[Symbol.metadata] = createObjectWithPrototype(base, Symbol.metadata);
      base[Symbol.metadata][key] = createObjectWithPrototype(base[Symbol.metadata], key);
      base[Symbol.metadata][key].public = createObjectWithPrototype(base[Symbol.metadata][key], "public");
      if (!Object.hasOwnProperty.call(base[Symbol.metadata][key], "private")) {
        Object.defineProperty(base[Symbol.metadata][key], "private", {
          get() {
            return Object.values(__metadataPrivate.get(base[Symbol.metadata][key]) || {}).concat(Object.getPrototypeOf(base[Symbol.metadata][key])?.private || []);
          }
        });
      }
      if (kind === "public") {
        base[Symbol.metadata][key].public[property] = value;
      } else if (kind === "private") {
        if (!__metadataPrivate.has(base[Symbol.metadata][key])) {
          __metadataPrivate.set(base[Symbol.metadata][key], {});
        }
        __metadataPrivate.get(base[Symbol.metadata][key])[property] = value;
      } else if (kind === "constructor") {
        base[Symbol.metadata][key].constructor = value;
      }
    }
  };
}

const _C_p_symbol_9hhut = Symbol();

class __C_t49kjg {
  static _C_p_temp_85n18() {
    return 2;
  }
  static [_C_p_symbol_9hhut] = decorator1(__C_t49kjg._C_p_temp_85n18, {
    kind: "getter",
    name: "#p",
    isStatic: true,
    isPrivate: true,
    access: {
      get: __C_t49kjg[_C_p_symbol_9hhut]
    },
    ...__PrepareMetadata(__C_t49kjg, "private", "#p")
  }) ?? __C_t49kjg._C_p_temp_85n18;
  static [_C_p_symbol_9hhut] = decorator2(__C_t49kjg[_C_p_symbol_9hhut], {
    kind: "getter",
    name: "#p",
    isStatic: true,
    isPrivate: true,
    access: {
      get: __C_t49kjg[_C_p_symbol_9hhut]
    },
    ...__PrepareMetadata(__C_t49kjg, "private", "#p")
  }) ?? __C_t49kjg[_C_p_symbol_9hhut];
  static get #p() {
    return __C_t49kjg[_C_p_symbol_9hhut].bind(this)();
  }
  static [_C_p_symbol_9hhut]() {
    return __C_t49kjg[_C_p_symbol_9hhut].bind(this);
  }
  static get check() {
    return this.#p;
  }
}

delete __C_t49kjg._C_p_temp_85n18;

let C = __C_t49kjg;

Object.defineProperty(C, "name", {
  value: "C"
});

console.assert(C.check === 12);