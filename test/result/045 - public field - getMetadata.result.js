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

let _C_f_initializer_fi0mf8;

let _C_f_initializer_5gd86o;

let _C_p_initializer_5bkg1;

let _C_p_initializer_sof6ug;

class C {
  p = _C_p_initializer_sof6ug.call(this, _C_p_initializer_5bkg1.call(this, 10));
  f = _C_f_initializer_5gd86o.call(this, _C_f_initializer_fi0mf8.call(this, 20));
}

_C_p_initializer_sof6ug = meta(1)(undefined, {
  kind: "field",
  name: "p",
  isStatic: false,
  isPrivate: false,
  ...__PrepareMetadata(C.prototype, "public", "p")
}) ?? (v => v);

_C_p_initializer_5bkg1 = meta(2)(undefined, {
  kind: "field",
  name: "p",
  isStatic: false,
  isPrivate: false,
  ...__PrepareMetadata(C.prototype, "public", "p")
}) ?? (v => v);

_C_f_initializer_5gd86o = meta(3)(undefined, {
  kind: "field",
  name: "f",
  isStatic: false,
  isPrivate: false,
  ...__PrepareMetadata(C.prototype, "public", "f")
}) ?? (v => v);

_C_f_initializer_fi0mf8 = meta(3)(undefined, {
  kind: "field",
  name: "f",
  isStatic: false,
  isPrivate: false,
  ...__PrepareMetadata(C.prototype, "public", "f")
}) ?? (v => v);

console.assert(C.prototype[Symbol.metadata][META].public.p === 3);

console.assert(C.prototype[Symbol.metadata][META].public.f === 6);