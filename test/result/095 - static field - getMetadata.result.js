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

class C {
  static p = 10;
  static f = 20;
}

const _C_f_initializer_3npib8 = meta(3)(undefined, {
  kind: "field",
  name: "f",
  isStatic: true,
  isPrivate: false,
  ...__PrepareMetadata(C, "public", "f")
}) ?? (v => v);

C.f = _C_f_initializer_3npib8.call(C, C.f);

const _C_f_initializer_pkrk48 = meta(3)(undefined, {
  kind: "field",
  name: "f",
  isStatic: true,
  isPrivate: false,
  ...__PrepareMetadata(C, "public", "f")
}) ?? (v => v);

C.f = _C_f_initializer_pkrk48.call(C, C.f);

const _C_p_initializer_2gr3po = meta(2)(undefined, {
  kind: "field",
  name: "p",
  isStatic: true,
  isPrivate: false,
  ...__PrepareMetadata(C, "public", "p")
}) ?? (v => v);

C.p = _C_p_initializer_2gr3po.call(C, C.p);

const _C_p_initializer_ads3m = meta(1)(undefined, {
  kind: "field",
  name: "p",
  isStatic: true,
  isPrivate: false,
  ...__PrepareMetadata(C, "public", "p")
}) ?? (v => v);

C.p = _C_p_initializer_ads3m.call(C, C.p);

console.assert(C[Symbol.metadata][META].public.p === 3);

console.assert(C[Symbol.metadata][META].public.f === 6);