const META = Symbol();

function meta(value) {
  return function(element, context) {
    const n = context.getMetadata(META) || 0;
    context.setMetadata(META, n + value);
  };
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

const _C_p_symbol_0cp98 = Symbol();

class __C_vun45o {
  _C_p_temp_88i3d8() {
    return "a";
  }
  static [_C_p_symbol_0cp98] = meta(1)(__C_vun45o.prototype._C_p_temp_88i3d8, {
    kind: "getter",
    name: "#p",
    isStatic: false,
    isPrivate: true,
    access: {
      get: __C_vun45o.prototype[_C_p_symbol_0cp98]
    },
    ...__PrepareMetadata(__C_vun45o.prototype, "private", "#p")
  }) ?? __C_vun45o.prototype._C_p_temp_88i3d8;
  static [_C_p_symbol_0cp98] = meta(2)(__C_vun45o[_C_p_symbol_0cp98], {
    kind: "getter",
    name: "#p",
    isStatic: false,
    isPrivate: true,
    access: {
      get: __C_vun45o.prototype[_C_p_symbol_0cp98]
    },
    ...__PrepareMetadata(__C_vun45o.prototype, "private", "#p")
  }) ?? __C_vun45o[_C_p_symbol_0cp98];
  get #p() {
    return __C_vun45o[_C_p_symbol_0cp98].bind(this)();
  }
  [_C_p_symbol_0cp98]() {
    return __C_vun45o[_C_p_symbol_0cp98].bind(this);
  }
}

delete __C_vun45o.prototype._C_p_temp_88i3d8;

let C = __C_vun45o;

Object.defineProperty(C, "name", {
  value: "C"
});

console.assert(C.prototype[Symbol.metadata][META].private[0] === 3);