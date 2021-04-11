function type (kind, options = {silence : false}) {
  return function (value, context) {
    if (context.kind === 'setter' || context.kind === 'auto-accessor') {
      const setter = context.kind === 'setter' ? value : value.set;
      function check (v) {
        if (typeof kind === 'string') {
          if (typeof v !== kind) {
            if (!options.silence) {
              throw new TypeError (`the property ".${ context.name }" must be a ${ kind }`);
            } else {
              return;
            }
          }
          debugger;
          if (kind === 'string' && options.match && !v.match(options.match)) {
            if (!options.silence) {
              throw new TypeError (`the property ".${ context.name }" must be match with ${options.name}`);
            } else {
              return;
            }
          }
          return setter.call(this, v);
        } else if (typeof kind === 'function') {
          if (!(v instanceof kind)) {
            if (!options.silence) {
              throw new TypeError (`the property ".${ context.name }" must be an instance of ${ kind.name }`)
            } else {
              return;
            }
          }
          return setter.call(this, v);
        }
      }
      return context.kind === 'setter' ? check : {set : check};
    }
  };
}

const email = type('string', {silence: true, name: 'email format', 'match': /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/})

class Test {
  @type('string', {silence: true}) accessor
  p = 'a';
  @type(Array, {silence: true}) accessor
  a = [];
  @email accessor
  email = '';
}

const t = new Test();
t.email = 'p@p.com'
t.email = '.cp'
console.log(t.email);
// t.p = 1;
// console.log(t.p);
// t.p = 'b';
// console.log(t.p);
// t.a = [1,2,3]
// console.log(t.a);