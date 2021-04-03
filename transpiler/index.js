const recast = require ('recast');
const walker = require ('../lib/walker.js');
const clone  = require ('../lib/clone.js');
const unique = () => Math.random ().toString (32).substring (2);

module.exports = (ast) =>
  prettySource (
    recast.print (
      transform (ast),
      {tabWidth : 2, reuseWhitespace : false}
    ).code);


function transform (ast) {
  const source              = clone (ast);
  let defineMetadataCreated = false;
  let applyDecoratorCreated = false;
  let preClassLocation      = null;
  
  //-----------------------------------
  // By Class
  //-----------------------------------
  walker (
    source,
    (o) => {
      return o.type === 'ClassDeclaration';
    },
    (klass, parent) => {
      
      let decoratorsCreated     = 0;
      let initDecoratorsCreated = 0; // TODO: remove and put 0
      const className           = klass.id.name;
      const i                   = parent.indexOf (klass);
      preClassLocation          = preClassLocation || i;
      let nextElement           = parent[ i + 1 ] || null;
      
      //---------------------------------
      // Static members
      // Public methods and fields
      //---------------------------------
      walker (
        klass,
        (o) => {
          return (o.type === 'MethodDefinition' || o.type === 'ClassProperty') &&
            o.static &&
            o.key.type !== 'PrivateName' &&
            o.decorators?.length;
        },
        (o, p) => {
          for (let decorator of (o.decorators || [])) {
            insertAfter (
              parent,
              klass,
              publicMemberGenerator ({
                kind          : decorator.kind,
                className     : className,
                elementName   : o.key.name,
                decoratorName : decorator.expression,
                variableName  : (decorator.kind === 'getter' || decorator.kind === 'setter' ?
                  '_descriptor_' :
                  '_initializer_') + unique (),
                isStatic      : true
              })
            );
            decoratorsCreated++;
          }
          o.decorators = undefined;
        }
      );
      
      //---------------------------------
      // Class decorators
      //---------------------------------
      const classInitializersName = '_class_initializers_' + unique ();
      for (let decorator of (klass.decorators || [])) {
        if (decorator.kind === 'init-class') {
          initDecoratorsCreated++;
        }
        insertAfter (
          parent,
          klass,
          decorator.kind === 'init-class' ?
            classInitGenerator (klass.id.name, decorator.expression, classInitializersName) :
            classGenerator (klass.id.name, decorator.expression)
        );
        decoratorsCreated++;
      }
      if (initDecoratorsCreated) {
        insertBefore (parent, klass, [{
          'type'         : 'VariableDeclaration',
          'declarations' : [{
            'type' : 'VariableDeclarator',
            'id'   : {'type' : 'Identifier', 'name' : classInitializersName},
            'init' : {'type' : 'ArrayExpression', 'elements' : []}
          }],
          'kind'         : 'const'
        }]);
        insertBeforeNext (parent, nextElement, [{
          'type'       : 'ExpressionStatement',
          'expression' : {
            'type'      : 'CallExpression',
            'callee'    : {'type' : 'MemberExpression', 'object' : {'type' : 'Identifier', 'name' : classInitializersName}, 'property' : {'type' : 'Identifier', 'name' : 'forEach'}},
            'arguments' : [
              {
                'type'       : 'ArrowFunctionExpression',
                'expression' : true,
                'params'     : [{'type' : 'Identifier', 'name' : 'initialize'}],
                'body'       : {
                  'type'      : 'CallExpression',
                  'callee'    : {'type' : 'MemberExpression', 'object' : {'type' : 'Identifier', 'name' : 'initialize'}, 'property' : {'type' : 'Identifier', 'name' : 'call'}},
                  'arguments' : [{'type' : 'Identifier', 'name' : className}, {'type' : 'Identifier', 'name' : className}]
                }
              }
            ]
          }
        }]);
      }
      klass.decorators = undefined;
      
      //---------------------------------
      // Methods
      //---------------------------------
      walker (
        klass,
        (o) => {
          return o.type === 'MethodDefinition' &&
            (!o.static || (o.key.type === 'PrivateName' && o.static)) &&
            o.decorators?.length;
        },
        (o, p) => {
          if (o.key.type === 'PrivateName') {
            //--------
            // Private
            //--------
            const symbolName         = '_symbol_' + unique ();
            const tempName           = '_temp_' + unique ();
            const elementName        = o.key.id.name;
            const elementPrivateName = '#' + elementName;
            const beforeClass        = privateMemberBeforeGenerator (symbolName);
            const afterClass         = privateMemberAfterGenerator (className, tempName, o.static);
            let replaceElement;
            for (let decorator of (o.decorators || [])) {
              if (!replaceElement) {
                replaceElement = privateFirstMemberGenerator ({
                  kind          : decorator.kind,
                  element       : o,
                  decoratorName : decorator.expression,
                  isStatic      : o.static,
                  tempName,
                  symbolName,
                  className,
                  elementName,
                  elementPrivateName
                });
              } else {
                privateNextMemberGenerator (
                  replaceElement,
                  {
                    kind          : decorator.kind,
                    decoratorName : decorator.expression,
                    isStatic      : o.static,
                    symbolName,
                    className,
                    elementPrivateName
                  }
                );
                
              }
            }
            insertBefore (parent, klass, beforeClass);
            replace (klass.body.body, o, replaceElement);
            insertAfter (parent, klass, afterClass);
            decoratorsCreated++;
          } else {
            //--------
            // Public
            //--------
            for (let decorator of (o.decorators || [])) {
              insertAfter (
                parent,
                klass,
                publicMemberGenerator ({
                  kind          : decorator.kind,
                  className     : className,
                  elementName   : o.key.name,
                  decoratorName : decorator.expression,
                  variableName  : '_descriptor_' + unique (),
                  isStatic      : false
                })
              );
              decoratorsCreated++;
            }
          }
          o.decorators = undefined;
        }
      );
      
      //---------------------------------
      // Fields
      //---------------------------------
      walker (
        klass,
        (o) => {
          return o.type === 'ClassProperty' &&
            o.decorators?.length;
        },
        (o, p) => {
          const symbolGetName = '_symbol_' + unique ();
          const symbolSetName = '_symbol_' + unique ();
          let isFirst         = true;
          for (let decorator of (o.decorators || [])) {
            decoratorsCreated    = true;
            const variableName   = '_initializer_' + unique ();
            const elementsBefore = [];
            if (!o.static) {
              elementsBefore.push ({
                'type'         : 'VariableDeclaration',
                'declarations' : [
                  {
                    'type' : 'VariableDeclarator',
                    'id'   : {'type' : 'Identifier', 'name' : variableName}
                  }
                ],
                'kind'         : 'let'
              });
            }
            if (o.key.type === 'PrivateName' && isFirst) {
              elementsBefore.push (
                {
                  'type'         : 'VariableDeclaration',
                  'declarations' : [
                    {
                      'type' : 'VariableDeclarator',
                      'id'   : {
                        'type' : 'Identifier',
                        'name' : symbolGetName
                      },
                      'init' : {
                        'type'      : 'CallExpression',
                        'callee'    : {
                          'type' : 'Identifier',
                          'name' : 'Symbol'
                        },
                        'arguments' : []
                      }
                    }
                  ],
                  'kind'         : 'const'
                },
                {
                  'type'         : 'VariableDeclaration',
                  'declarations' : [
                    {
                      'type' : 'VariableDeclarator',
                      'id'   : {
                        'type' : 'Identifier',
                        'name' : symbolSetName
                      },
                      'init' : {
                        'type'      : 'CallExpression',
                        'callee'    : {
                          'type' : 'Identifier',
                          'name' : 'Symbol'
                        },
                        'arguments' : []
                      }
                    }
                  ],
                  'kind'         : 'const'
                }
              );
            }
            insertBefore (
              parent,
              klass,
              elementsBefore
            );
            insertAfter (
              parent,
              klass,
              o.key.type === 'PrivateName' ?
                privateFieldGenerator ({
                  kind          : decorator.kind,
                  elementName   : o.key.name,
                  decoratorName : decorator.expression,
                  isStatic      : !!o.static,
                  className,
                  variableName,
                  symbolGetName,
                  symbolSetName
                  
                }) :
                publicMemberGenerator ({
                  kind          : decorator.kind,
                  elementName   : o.key.name,
                  decoratorName : decorator.expression,
                  isStatic      : o.static,
                  className,
                  variableName
                })
            );
            if (!o.static) {
              o.value = {
                'type'      : 'CallExpression',
                'callee'    : {
                  'type' : 'Identifier',
                  'name' : variableName
                },
                'arguments' : [o.value]
              };
            }
            if (o.key.type === 'PrivateName' && isFirst) {
              isFirst = false;
              insertAfter (klass.body.body, o, [
                {
                  'type'     : 'MethodDefinition',
                  'kind'     : 'method',
                  'static'   : o.static,
                  'computed' : true,
                  'key'      : {
                    'type' : 'Identifier',
                    'name' : symbolGetName
                  },
                  'value'    : {
                    'type'   : 'FunctionExpression',
                    'params' : [],
                    'body'   : {
                      'type' : 'BlockStatement',
                      'body' : [
                        {
                          'type'     : 'ReturnStatement',
                          'argument' : {
                            'type'     : 'MemberExpression',
                            'object'   : (o.static) ?
                              {
                                'type' : 'Identifier',
                                'name' : className
                              } :
                              {
                                'type' : 'ThisExpression'
                              },
                            'computed' : false,
                            'optional' : false,
                            'property' : {
                              'type' : 'PrivateName',
                              'name' : o.key.name,
                              'id'   : {
                                'type' : 'Identifier',
                                'name' : o.key.name
                              }
                            }
                          }
                        }
                      ]
                    }
                  }
                },
                {
                  'type'     : 'MethodDefinition',
                  'kind'     : 'method',
                  'static'   : o.static,
                  'computed' : true,
                  'key'      : {
                    'type' : 'Identifier',
                    'name' : symbolSetName
                  },
                  'value'    : {
                    'type'   : 'FunctionExpression',
                    'params' : [
                      {
                        'type' : 'Identifier',
                        'name' : 'v'
                      }
                    ],
                    'body'   : {
                      'type' : 'BlockStatement',
                      'body' : [
                        {
                          'type'       : 'ExpressionStatement',
                          'expression' : {
                            'type'     : 'AssignmentExpression',
                            'operator' : '=',
                            'left'     : {
                              'type'     : 'MemberExpression',
                              'object'   : (o.static) ?
                                {
                                  'type' : 'Identifier',
                                  'name' : className
                                } :
                                {
                                  'type' : 'ThisExpression'
                                },
                              'property' : {
                                'type' : 'PrivateName',
                                'name' : o.key.name,
                                'id'   : {
                                  'type' : 'Identifier',
                                  'name' : o.key.name
                                }
                              }
                            },
                            'right'    : {
                              'type' : 'Identifier',
                              'name' : 'v'
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              ]);
            }
            decoratorsCreated++;
          }
          o.decorators = undefined;
        }
      );
      
      //-------------------------------
      // Global helpers
      //-------------------------------
      if (decoratorsCreated && !defineMetadataCreated) {
        parent.splice (preClassLocation, 0, ...defineMetadataGenerator ());
        preClassLocation += 2;
        defineMetadataCreated = true;
      }
      if (initDecoratorsCreated && !applyDecoratorCreated) {
        parent.splice (preClassLocation++, 0, applyDecoratorGenerator ());
        applyDecoratorCreated = true;
      }
      
    }
  );
  return source;
}

function publicMemberGenerator ({kind, className, elementName, decoratorName, variableName, isStatic}) {
  return [
    (kind === 'setter' || kind === 'getter') && {
      'type'         : 'VariableDeclaration',
      'declarations' : [
        {
          'type' : 'VariableDeclarator',
          'id'   : {
            'type' : 'Identifier',
            'name' : variableName
          },
          'init' : {
            'type'      : 'CallExpression',
            'callee'    : {
              'type'     : 'MemberExpression',
              'object'   : {
                'type' : 'Identifier',
                'name' : 'Object'
              },
              'property' : {
                'type' : 'Identifier',
                'name' : 'getOwnPropertyDescriptor'
              }
            },
            'arguments' : [
              (isStatic) ?
                {
                  'type' : 'Identifier',
                  'name' : className
                } :
                {
                  'type'     : 'MemberExpression',
                  'object'   : {
                    'type' : 'Identifier',
                    'name' : className
                  },
                  'property' : {
                    'type' : 'Identifier',
                    'name' : 'prototype'
                  }
                },
              {
                'type'  : 'Literal',
                'value' : elementName
              }
            ]
          }
        }
      ],
      'kind'         : 'const'
    },
    {
      'type'       : 'ExpressionStatement',
      'expression' : {
        'type'     : 'AssignmentExpression',
        'left'     :
          (kind === 'setter' || kind === 'getter') ?
            {
              'type'     : 'MemberExpression',
              'object'   : {
                'type' : 'Identifier',
                'name' : variableName
              },
              'property' : {
                'type' : 'Identifier',
                'name' : kind === 'setter' ? 'set' : 'get'
              }
            } :
            (kind === 'field') ?
              {
                'type' : 'Identifier',
                'name' : (isStatic ? 'const ' : '') + variableName
              } :
              {
                'type'     : 'MemberExpression',
                'object'   :
                  (isStatic) ?
                    {
                      'type' : 'Identifier',
                      'name' : className
                    } :
                    {
                      'type'     : 'MemberExpression',
                      'object'   : {
                        'type' : 'Identifier',
                        'name' : className
                      },
                      'property' : {
                        'type' : 'Identifier',
                        'name' : 'prototype'
                      }
                    },
                'property' : {
                  'type' : 'Identifier',
                  'name' : elementName
                }
              },
        'operator' : '=',
        'right'    : {
          'type'     : 'LogicalExpression',
          'left'     : {
            'type'      : 'CallExpression',
            'callee'    : decoratorName,
            'arguments' : [
              (kind === 'setter' || kind === 'getter') ?
                {
                  'type'     : 'MemberExpression',
                  'object'   : {
                    'type' : 'Identifier',
                    'name' : variableName
                  },
                  'property' : {
                    'type' : 'Identifier',
                    'name' : kind === 'setter' ? 'set' : 'get'
                  }
                } :
                (kind === 'field') ?
                  {
                    'type' : 'Identifier',
                    'name' : 'undefined'
                  } :
                  {
                    'type'     : 'MemberExpression',
                    'object'   :
                      (isStatic) ?
                        {
                          'type' : 'Identifier',
                          'name' : className
                        } :
                        {
                          'type'     : 'MemberExpression',
                          'object'   : {
                            'type' : 'Identifier',
                            'name' : className
                          },
                          'property' : {
                            'type' : 'Identifier',
                            'name' : 'prototype'
                          }
                        },
                    'property' : {
                      'type' : 'Identifier',
                      'name' : elementName
                    }
                  },
              {
                'type'       : 'ObjectExpression',
                'properties' : [
                  {
                    'type' : 'Property',
                    'key'  : {
                      'type' : 'Identifier',
                      'name' : 'kind'
                    },
                    
                    'value' : {
                      'type'  : 'Literal',
                      'value' : kind
                    }
                  },
                  {
                    'type'  : 'Property',
                    'key'   : {
                      'type' : 'Identifier',
                      'name' : 'name'
                    },
                    'value' : {
                      'type'  : 'Literal',
                      'value' : elementName
                    }
                  },
                  {
                    'type'  : 'Property',
                    'key'   : {
                      'type' : 'Identifier',
                      'name' : 'isStatic'
                    },
                    'value' : {
                      'type'  : 'Literal',
                      'value' : !!isStatic
                    }
                  },
                  {
                    'type' : 'Property',
                    'key'  : {
                      'type' : 'Identifier',
                      'name' : 'isPrivate'
                    },
                    
                    'value' : {
                      'type'  : 'Literal',
                      'value' : false,
                      'raw'   : 'false'
                    }
                  },
                  defineMetadataGeneratorCall (
                    isStatic ? className : `${ className }.prototype`,
                    elementName
                  )
                ]
              }
            ]
          },
          'operator' : '??',
          'right'    :
            (kind === 'setter' || kind === 'getter') ?
              {
                'type'     : 'MemberExpression',
                'object'   : {
                  'type' : 'Identifier',
                  'name' : variableName
                },
                'property' : {
                  'type' : 'Identifier',
                  'name' : kind === 'setter' ? 'set' : 'get'
                }
              } :
              (kind === 'field') ?
                {
                  'type'   : 'ArrowFunctionExpression',
                  'params' : [
                    {
                      'type' : 'Identifier',
                      'name' : 'v'
                    }
                  ],
                  'body'   : {
                    'type' : 'Identifier',
                    'name' : 'v'
                  }
                } :
                {
                  'type'     : 'MemberExpression',
                  'object'   :
                    (isStatic) ?
                      {
                        'type' : 'Identifier',
                        'name' : className
                      } :
                      {
                        'type'     : 'MemberExpression',
                        'object'   : {
                          'type' : 'Identifier',
                          'name' : className
                        },
                        'property' : {
                          'type' : 'Identifier',
                          'name' : 'prototype'
                        }
                      },
                  'property' : {
                    'type' : 'Identifier',
                    'name' : elementName
                  }
                }
        }
      }
    },
    (kind === 'setter' || kind === 'getter') ?
      {
        'type'       : 'ExpressionStatement',
        'expression' : {
          'type'      : 'CallExpression',
          'callee'    : {
            'type'     : 'MemberExpression',
            'object'   : {
              'type' : 'Identifier',
              'name' : 'Object'
            },
            'property' : {
              'type' : 'Identifier',
              'name' : 'defineProperty'
            }
          },
          'arguments' : [
            (isStatic) ?
              {
                'type' : 'Identifier',
                'name' : className
              } :
              {
                'type'     : 'MemberExpression',
                'object'   : {
                  'type' : 'Identifier',
                  'name' : className
                },
                'property' : {
                  'type' : 'Identifier',
                  'name' : 'prototype'
                }
              },
            {
              'type'  : 'Literal',
              'value' : elementName
            },
            {
              'type' : 'Identifier',
              'name' : variableName
            }
          ],
          'optional'  : false
        }
      } :
      (isStatic && kind === 'field') ?
        {
          'type'       : 'ExpressionStatement',
          'expression' : {
            'type'     : 'AssignmentExpression',
            'operator' : '=',
            'left'     : {
              'type'     : 'MemberExpression',
              'object'   : {
                'type' : 'Identifier',
                'name' : className
              },
              'property' : {
                'type' : 'Identifier',
                'name' : elementName
              }
            },
            'right'    : {
              'type'      : 'CallExpression',
              'callee'    : {
                'type' : 'Identifier',
                'name' : variableName
              },
              'arguments' : [
                {
                  'type'     : 'MemberExpression',
                  'object'   : {
                    'type' : 'Identifier',
                    'name' : className
                  },
                  'property' : {
                    'type' : 'Identifier',
                    'name' : elementName
                  }
                }
              ],
              'optional'  : false
            }
          }
        } :
        undefined
  ];
}

function privateFieldGenerator ({kind, className, elementName, decoratorName, variableName, symbolGetName, symbolSetName, isStatic}) {
  return [
    {
      'type'       : 'ExpressionStatement',
      'expression' : {
        'type'     : 'AssignmentExpression',
        'left'     :
          {
            'type' : 'Identifier',
            'name' : (isStatic ? 'const ' : '') + variableName
          },
        'operator' : '=',
        'right'    : {
          'type'     : 'LogicalExpression',
          'left'     : {
            'type'      : 'CallExpression',
            'callee'    : decoratorName,
            'arguments' : [
              {
                'type' : 'Identifier',
                'name' : 'undefined'
              },
              {
                'type'       : 'ObjectExpression',
                'properties' : [
                  {
                    'type' : 'Property',
                    'key'  : {
                      'type' : 'Identifier',
                      'name' : 'kind'
                    },
                    
                    'value' : {
                      'type'  : 'Literal',
                      'value' : kind
                    }
                  },
                  {
                    'type'  : 'Property',
                    'key'   : {
                      'type' : 'Identifier',
                      'name' : 'name'
                    },
                    'value' : {
                      'type'  : 'Literal',
                      'value' : '#' + elementName
                    }
                  },
                  {
                    'type'  : 'Property',
                    'key'   : {
                      'type' : 'Identifier',
                      'name' : 'access'
                    },
                    'value' : {
                      'type'       : 'ObjectExpression',
                      'properties' : [
                        {
                          'type'  : 'Property',
                          'key'   : {
                            'type' : 'Identifier',
                            'name' : 'get'
                          },
                          'value' : {
                            'type'     : 'MemberExpression',
                            'object'   : (isStatic) ?
                              {
                                'type' : 'Identifier',
                                'name' : className
                              } :
                              {
                                'type'     : 'MemberExpression',
                                'object'   : {
                                  'type' : 'Identifier',
                                  'name' : className
                                },
                                'property' : {
                                  'type' : 'Identifier',
                                  'name' : 'prototype'
                                }
                              },
                            'property' : {
                              'type' : 'Identifier',
                              'name' : symbolGetName
                            },
                            'computed' : true
                          },
                          'kind'  : 'init'
                        },
                        {
                          'type'  : 'Property',
                          'key'   : {
                            'type' : 'Identifier',
                            'name' : 'set'
                          },
                          'value' : {
                            'type'     : 'MemberExpression',
                            'object'   : (isStatic) ?
                              {
                                'type' : 'Identifier',
                                'name' : className
                              } :
                              {
                                'type'     : 'MemberExpression',
                                'object'   : {
                                  'type' : 'Identifier',
                                  'name' : className
                                },
                                'property' : {
                                  'type' : 'Identifier',
                                  'name' : 'prototype'
                                }
                              },
                            'property' : {
                              'type' : 'Identifier',
                              'name' : symbolSetName
                            },
                            'computed' : true
                          },
                          'kind'  : 'init'
                        }
                      ]
                    },
                    'kind'  : 'init'
                  },
                  {
                    'type'  : 'Property',
                    'key'   : {
                      'type' : 'Identifier',
                      'name' : 'isStatic'
                    },
                    'value' : {
                      'type'  : 'Literal',
                      'value' : isStatic
                    }
                  },
                  {
                    'type' : 'Property',
                    'key'  : {
                      'type' : 'Identifier',
                      'name' : 'isPrivate'
                    },
                    
                    'value' : {
                      'type'  : 'Literal',
                      'value' : true
                    }
                  },
                  defineMetadataGeneratorCall (
                    className + (isStatic ? '' : '.prototype'),
                    '#' + elementName
                  )
                ]
              }
            ]
          },
          'operator' : '??',
          'right'    :
            {
              'type'   : 'ArrowFunctionExpression',
              'params' : [
                {
                  'type' : 'Identifier',
                  'name' : 'v'
                }
              ],
              'body'   : {
                'type' : 'Identifier',
                'name' : 'v'
              }
            }
        }
      }
    },
    isStatic ? {
        'type'       : 'ExpressionStatement',
        'expression' : {
          'type'      : 'CallExpression',
          'callee'    : {
            'type'     : 'MemberExpression',
            'object'   : {
              'type' : 'Identifier',
              'name' : className
            },
            'property' : {
              'type' : 'Identifier',
              'name' : symbolSetName
            },
            'computed' : true
          },
          'arguments' : [
            {
              'type'      : 'CallExpression',
              'callee'    : {
                'type' : 'Identifier',
                'name' : variableName
              },
              'arguments' : [
                {
                  'type'      : 'CallExpression',
                  'callee'    : {
                    'type'     : 'MemberExpression',
                    'object'   : {
                      'type' : 'Identifier',
                      'name' : className
                    },
                    'property' : {
                      'type' : 'Identifier',
                      'name' : symbolGetName
                    },
                    'computed' : true
                  },
                  'arguments' : []
                }
              ]
            }
          ]
        }
      } :
      undefined
  ];
}

function privateMemberBeforeGenerator (symbolName) {
  return [{
    'type'         : 'VariableDeclaration',
    'kind'         : 'const',
    'declarations' : [
      {
        'type' : 'VariableDeclarator',
        'id'   : {
          'type' : 'Identifier',
          'name' : symbolName
        },
        'init' : {
          'type'      : 'CallExpression',
          'callee'    : {
            'type' : 'Identifier',
            'name' : 'Symbol'
          },
          'arguments' : []
        }
      }
    ]
  }];
}

function privateFirstMemberGenerator ({kind, className, element, elementName, elementPrivateName, decoratorName, tempName, symbolName, isStatic}) {
  return [
    {
      'type'   : 'MethodDefinition',
      'kind'   : 'method',
      'static' : isStatic,
      'key'    : {
        'type' : 'Identifier',
        'name' : tempName
      },
      'value'  : element.value
    },
    {
      'type'     : 'ClassProperty',
      'static'   : true,
      'computed' : true,
      'key'      : {
        'type' : 'Identifier',
        'name' : symbolName
      },
      'value'    : {
        'type'     : 'LogicalExpression',
        'left'     : {
          'type'      : 'CallExpression',
          'callee'    : decoratorName,
          'arguments' : [
            {
              'type'     : 'MemberExpression',
              'object'   :
                (isStatic) ? {
                    'type' : 'Identifier',
                    'name' : className
                  } :
                  {
                    'type'     : 'MemberExpression',
                    'object'   : {
                      'type' : 'Identifier',
                      'name' : className
                    },
                    'property' : {
                      'type' : 'Identifier',
                      'name' : 'prototype'
                    }
                  },
              'property' : {
                'type' : 'Identifier',
                'name' : tempName
              }
            },
            {
              'type'       : 'ObjectExpression',
              'properties' : [
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'kind'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : kind
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'name'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : elementPrivateName
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'isStatic'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : isStatic
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'isPrivate'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : true
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'access'
                  },
                  'value' : {
                    'type'       : 'ObjectExpression',
                    'properties' : [
                      {
                        'type'  : 'Property',
                        'key'   : {
                          'type' : 'Identifier',
                          'name' : 'get'
                        },
                        'value' : {
                          'type'     : 'MemberExpression',
                          'object'   :
                            (isStatic) ? {
                                'type' : 'Identifier',
                                'name' : className
                              } :
                              {
                                'type'     : 'MemberExpression',
                                'object'   : {
                                  'type' : 'Identifier',
                                  'name' : className
                                },
                                'property' : {
                                  'type' : 'Identifier',
                                  'name' : 'prototype'
                                }
                              },
                          'property' : {
                            'type' : 'Identifier',
                            'name' : symbolName
                          },
                          'computed' : true
                        },
                        'kind'  : 'init'
                      }
                    ]
                  },
                  'kind'  : 'init'
                },
                defineMetadataGeneratorCall (
                  className + (isStatic ? '' : '.prototype'),
                  elementPrivateName
                )
              ]
            }
          ],
          'optional'  : false
        },
        'operator' : '??',
        'right'    : {
          'type'     : 'MemberExpression',
          'object'   :
            (isStatic) ? {
                'type' : 'Identifier',
                'name' : className
              } :
              {
                'type'     : 'MemberExpression',
                'object'   : {
                  'type' : 'Identifier',
                  'name' : className
                },
                'property' : {
                  'type' : 'Identifier',
                  'name' : 'prototype'
                }
              },
          'property' : {
            'type' : 'Identifier',
            'name' : tempName
          }
        }
      }
    },
    (kind === 'getter' || kind === 'setter') ?
      {
        'type'   : 'MethodDefinition',
        'kind'   : (kind === 'getter') ? 'get' : 'set',
        'static' : isStatic,
        'key'    : {
          'type' : 'PrivateName',
          'name' : elementName,
          'id'   : {
            'type' : 'Identifier',
            'name' : elementName
          }
        },
        'value'  : {
          'type'   : 'FunctionExpression',
          'params' : [
            (kind === 'setter') ?
              {
                'type' : 'Identifier',
                'name' : 'v'
              } :
              undefined
          ],
          'body'   : {
            'type' : 'BlockStatement',
            'body' : [
              {
                'type'     : 'ReturnStatement',
                'argument' : {
                  'type'      : 'CallExpression',
                  'callee'    : {
                    'type'      : 'CallExpression',
                    'callee'    : {
                      'type'     : 'MemberExpression',
                      'object'   : {
                        'type'     : 'MemberExpression',
                        'object'   : {
                          'type' : 'Identifier',
                          'name' : className
                        },
                        'property' : {
                          'type' : 'Identifier',
                          'name' : symbolName
                        },
                        'computed' : true
                      },
                      'property' : {
                        'type' : 'Identifier',
                        'name' : 'bind'
                      }
                    },
                    'arguments' : [
                      {
                        'type' : 'ThisExpression'
                      }
                    ]
                  },
                  'arguments' : [
                    (kind === 'setter') ?
                      {
                        'type'  : 'Identifier',
                        'start' : 406,
                        'end'   : 407,
                        'name'  : 'v'
                      } :
                      undefined
                  ]
                }
              }
            ]
          }
        }
      } :
      {
        'type'   : 'ClassProperty',
        'static' : isStatic,
        'key'    : {
          'type' : 'PrivateName',
          'name' : elementName,
          'id'   : {
            'type' : 'Identifier',
            'name' : elementName
          }
        },
        'value'  : {
          'type'     : 'MemberExpression',
          'object'   : {
            'type' : 'Identifier',
            'name' : className
          },
          'property' : {
            'type' : 'Identifier',
            'name' : symbolName
          },
          'computed' : true,
          'optional' : false
        }
      },
    {
      'type'     : 'MethodDefinition',
      'kind'     : 'method',
      'static'   : isStatic,
      'computed' : true,
      'key'      : {
        'type' : 'Identifier',
        'name' : symbolName
      },
      'value'    : {
        'type'   : 'FunctionExpression',
        'params' : [],
        'body'   : {
          'type' : 'BlockStatement',
          'body' : [
            (kind === 'getter' || kind === 'setter') ?
              {
                'type'     : 'ReturnStatement',
                'argument' : {
                  'type'      : 'CallExpression',
                  'callee'    : {
                    'type'     : 'MemberExpression',
                    'object'   : {
                      'type'     : 'MemberExpression',
                      'object'   : {
                        'type' : 'Identifier',
                        'name' : className
                      },
                      'property' : {
                        'type' : 'Identifier',
                        'name' : symbolName
                      },
                      'computed' : true
                    },
                    'property' : {
                      'type' : 'Identifier',
                      'name' : 'bind'
                    }
                  },
                  'arguments' : [
                    {
                      'type' : 'ThisExpression'
                    }
                  ]
                }
              } :
              {
                'type'     : 'ReturnStatement',
                'argument' : {
                  'type'     : 'MemberExpression',
                  'object'   : {
                    'type' : 'ThisExpression'
                  },
                  'property' : {
                    'type' : 'PrivateName',
                    'name' : elementName,
                    'id'   : {
                      'type' : 'Identifier',
                      'name' : elementName
                    }
                  }
                }
              }
          ]
        }
      }
    }
  ];
}

function privateNextMemberGenerator (descriptor, {kind, className, elementPrivateName, decoratorName, isStatic, symbolName}) {
  descriptor.splice (descriptor.length - 2, 0,
    {
      'type'     : 'ClassProperty',
      'static'   : true,
      'computed' : true,
      'key'      : {
        'type' : 'Identifier',
        'name' : symbolName
      },
      'value'    : {
        'type'     : 'LogicalExpression',
        'left'     : {
          'type'      : 'CallExpression',
          'callee'    : decoratorName,
          'arguments' : [
            {
              'type'     : 'MemberExpression',
              'object'   : {
                'type' : 'Identifier',
                'name' : className
              },
              'property' : {
                'type' : 'Identifier',
                'name' : symbolName
              },
              'computed' : true
            },
            {
              'type'       : 'ObjectExpression',
              'properties' : [
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'kind'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : kind
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'name'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : elementPrivateName
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'isStatic'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : false
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'isPrivate'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : true
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'access'
                  },
                  'value' : {
                    'type'       : 'ObjectExpression',
                    'properties' : [
                      {
                        'type'  : 'Property',
                        'key'   : {
                          'type' : 'Identifier',
                          'name' : 'get'
                        },
                        'value' : {
                          'type'     : 'MemberExpression',
                          'object'   :
                            (isStatic) ? {
                                'type' : 'Identifier',
                                'name' : className
                              } :
                              {
                                'type'     : 'MemberExpression',
                                'object'   : {
                                  'type' : 'Identifier',
                                  'name' : className
                                },
                                'property' : {
                                  'type' : 'Identifier',
                                  'name' : 'prototype'
                                }
                              },
                          'property' : {
                            'type' : 'Identifier',
                            'name' : symbolName
                          },
                          'computed' : true
                        },
                        'kind'  : 'init'
                      }
                    ]
                  },
                  'kind'  : 'init'
                },
                defineMetadataGeneratorCall (
                  className + (isStatic ? '' : '.prototype'),
                  elementPrivateName
                )
              ]
            }
          ],
          'optional'  : false
        },
        'operator' : '??',
        'right'    : {
          'type'     : 'MemberExpression',
          'object'   : {
            'type' : 'Identifier',
            'name' : className
          },
          'property' : {
            'type' : 'Identifier',
            'name' : symbolName
          },
          'computed' : true
        }
      }
    }
  );
}

function privateMemberAfterGenerator (className, tempName, isStatic) {
  return [
    {
      'type'       : 'ExpressionStatement',
      'expression' : {
        'type'     : 'UnaryExpression',
        'operator' : 'delete',
        'prefix'   : true,
        'argument' : {
          'type'     : 'MemberExpression',
          'object'   :
            (isStatic) ? {
                'type' : 'Identifier',
                'name' : className
              } :
              {
                'type'     : 'MemberExpression',
                'object'   : {
                  'type' : 'Identifier',
                  'name' : className
                },
                'property' : {
                  'type' : 'Identifier',
                  'name' : 'prototype'
                }
              },
          'property' : {
            'type' : 'Identifier',
            'name' : tempName
          }
        }
      }
    }
  ];
}

function classInitGenerator (className, decoratorName, collection) {
  return [
    {
      'type'       : 'ExpressionStatement',
      'expression' : {
        'type'     : 'AssignmentExpression',
        'operator' : '=',
        'left'     : {'type' : 'Identifier', 'name' : className},
        'right'    : {
          'type'      : 'CallExpression',
          'callee'    : {'type' : 'Identifier', 'name' : '__applyDecorator'},
          'arguments' : [
            {
              'type'      : 'CallExpression',
              'callee'    : decoratorName,
              'arguments' : [
                {'type' : 'Identifier', 'name' : className},
                {
                  'type'       : 'ObjectExpression',
                  'properties' : [
                    {
                      'type'  : 'Property',
                      'key'   : {'type' : 'Identifier', 'name' : 'kind'},
                      'value' : {'type' : 'Literal', 'value' : 'init-class'},
                      'kind'  : 'init'
                    },
                    {
                      'type'  : 'Property',
                      'key'   : {'type' : 'Identifier', 'name' : 'name'},
                      'value' : {'type' : 'Literal', 'value' : className},
                      'kind'  : 'init'
                    },
                    {
                      'type'  : 'Property',
                      'key'   : {'type' : 'Identifier', 'name' : 'defineMetadata'},
                      'value' : {
                        'type'      : 'CallExpression',
                        'callee'    : {'type' : 'Identifier', 'name' : '__DefineMetadata'},
                        'arguments' : [
                          {'type' : 'Identifier', 'name' : className},
                          {'type' : 'Literal', 'value' : 'constructor'}
                        ]
                      },
                      'kind'  : 'init'
                    }
                  ]
                }
              ]
            },
            {'type' : 'Identifier', 'name' : className},
            {'type' : 'Identifier', 'name' : collection}
          ]
        }
      }
    }
  ];
}

function classGenerator (className, decoratorName) {
  return [{
    'type'       : 'ExpressionStatement',
    'expression' : {
      'type'     : 'AssignmentExpression',
      'operator' : '=',
      'left'     : {
        'type' : 'Identifier',
        'name' : className
      },
      'right'    : {
        'type'     : 'LogicalExpression',
        'left'     : {
          'type'      : 'CallExpression',
          'callee'    : decoratorName,
          'arguments' : [
            {
              'type' : 'Identifier',
              'name' : className
            },
            {
              'type'       : 'ObjectExpression',
              'properties' : [
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'kind'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : 'class',
                    'raw'   : '"class"'
                  },
                  'kind'  : 'init'
                },
                {
                  'type'  : 'Property',
                  'key'   : {
                    'type' : 'Identifier',
                    'name' : 'name'
                  },
                  'value' : {
                    'type'  : 'Literal',
                    'value' : className,
                    'raw'   : `"${ className }"`
                  },
                  'kind'  : 'init'
                },
                defineMetadataGeneratorCall (className, 'constructor')
              ]
            }
          ],
          'optional'  : false
        },
        'operator' : '??',
        'right'    : {
          'type' : 'Identifier',
          'name' : className
        }
      }
    }
  }];
}

function defineMetadataGeneratorCall (storage, metaKey) {
  return {
    'type'  : 'Property',
    'key'   : {
      'type' : 'Identifier',
      'name' : 'defineMetadata'
    },
    'value' : {
      'type'      : 'CallExpression',
      'callee'    : {
        'type' : 'Identifier',
        'name' : '__DefineMetadata'
      },
      'arguments' : [
        {
          'type' : 'Identifier',
          'name' : storage
        },
        {
          'type'  : 'Literal',
          'value' : metaKey
        }
      ],
      'optional'  : false
    }
  };
}

function defineMetadataGenerator () {
  return [{
    'type'       : 'IfStatement',
    'test'       : {
      'type'     : 'UnaryExpression',
      'operator' : '!',
      'prefix'   : true,
      'argument' : {
        'type'     : 'MemberExpression',
        'object'   : {
          'type' : 'Identifier',
          'name' : 'Symbol'
        },
        'property' : {
          'type' : 'Identifier',
          'name' : 'metadata'
        }
      }
    },
    'consequent' : {
      'type' : 'BlockStatement',
      'body' : [
        {
          'type'       : 'ExpressionStatement',
          'expression' : {
            'type'     : 'AssignmentExpression',
            'operator' : '=',
            'left'     : {
              'type'     : 'MemberExpression',
              'object'   : {
                'type' : 'Identifier',
                'name' : 'Symbol'
              },
              'property' : {
                'type' : 'Identifier',
                'name' : 'metadata'
              }
            },
            'right'    : {
              'type'      : 'CallExpression',
              'callee'    : {
                'type' : 'Identifier',
                'name' : 'Symbol'
              },
              'arguments' : [],
              'optional'  : false
            }
          }
        }
      ]
    }
  },
    {
      'type'   : 'FunctionDeclaration',
      'id'     : {
        'type' : 'Identifier',
        'name' : '__DefineMetadata'
      },
      'params' : [
        {
          'type' : 'Identifier',
          'name' : 'base'
        },
        {
          'type' : 'Identifier',
          'name' : 'name'
        }
      ],
      'body'   : {
        'type' : 'BlockStatement',
        'body' : [
          {
            'type'     : 'ReturnStatement',
            'argument' : {
              'type'   : 'FunctionExpression',
              'params' : [
                {
                  'type' : 'Identifier',
                  'name' : 'key'
                },
                {
                  'type' : 'Identifier',
                  'name' : 'value'
                }
              ],
              'body'   : {
                'type' : 'BlockStatement',
                'body' : [
                  {
                    'type'       : 'IfStatement',
                    'test'       : {
                      'type'     : 'UnaryExpression',
                      'operator' : '!',
                      'prefix'   : true,
                      'argument' : {
                        'type'        : 'MemberExpression',
                        'object'      : {
                          'type' : 'Identifier',
                          'name' : 'base'
                        },
                        'property'    : {
                          'type'     : 'MemberExpression',
                          'object'   : {
                            'type' : 'Identifier',
                            'name' : 'Symbol'
                          },
                          'property' : {
                            'type' : 'Identifier',
                            'name' : 'metadata'
                          }
                        }, 'computed' : true
                      }
                    },
                    'consequent' : {
                      'type' : 'BlockStatement',
                      'body' : [
                        {
                          'type'       : 'ExpressionStatement',
                          'expression' : {
                            'type'     : 'AssignmentExpression',
                            'operator' : '=',
                            'left'     : {
                              'type'        : 'MemberExpression',
                              'object'      : {
                                'type' : 'Identifier',
                                'name' : 'base'
                              },
                              'property'    : {
                                'type'     : 'MemberExpression',
                                'object'   : {
                                  'type' : 'Identifier',
                                  'name' : 'Symbol'
                                },
                                'property' : {
                                  'type' : 'Identifier',
                                  'name' : 'metadata'
                                }
                              }, 'computed' : true
                            },
                            'right'    : {
                              'type'      : 'CallExpression',
                              'callee'    : {
                                'type'     : 'MemberExpression',
                                'object'   : {
                                  'type' : 'Identifier',
                                  'name' : 'Object'
                                },
                                'property' : {
                                  'type' : 'Identifier',
                                  'name' : 'create'
                                }
                              },
                              'arguments' : [
                                {
                                  'type'  : 'Literal',
                                  'value' : null,
                                  'raw'   : 'null'
                                }
                              ]
                            }
                          }
                        }
                      ]
                    }
                  },
                  {
                    'type'       : 'IfStatement',
                    'test'       : {
                      'type'     : 'UnaryExpression',
                      'operator' : '!',
                      'prefix'   : true,
                      'argument' : {
                        'type'        : 'MemberExpression',
                        'object'      : {
                          'type'        : 'MemberExpression',
                          'object'      : {
                            'type' : 'Identifier',
                            'name' : 'base'
                          },
                          'property'    : {
                            'type'     : 'MemberExpression',
                            'object'   : {
                              'type' : 'Identifier',
                              'name' : 'Symbol'
                            },
                            'property' : {
                              'type' : 'Identifier',
                              'name' : 'metadata'
                            }
                          }, 'computed' : true
                        },
                        'property'    : {
                          'type' : 'Identifier',
                          'name' : 'name'
                        }, 'computed' : true
                      }
                    },
                    'consequent' : {
                      'type' : 'BlockStatement',
                      'body' : [
                        {
                          'type'       : 'ExpressionStatement',
                          'expression' : {
                            'type'     : 'AssignmentExpression',
                            'operator' : '=',
                            'left'     : {
                              'type'        : 'MemberExpression',
                              'object'      : {
                                'type'        : 'MemberExpression',
                                'object'      : {
                                  'type' : 'Identifier',
                                  'name' : 'base'
                                },
                                'property'    : {
                                  'type'     : 'MemberExpression',
                                  'object'   : {
                                    'type' : 'Identifier',
                                    'name' : 'Symbol'
                                  },
                                  'property' : {
                                    'type' : 'Identifier',
                                    'name' : 'metadata'
                                  }
                                }, 'computed' : true
                              },
                              'property'    : {
                                'type' : 'Identifier',
                                'name' : 'name'
                              }, 'computed' : true
                            },
                            'right'    : {
                              'type'       : 'ObjectExpression',
                              'properties' : []
                            }
                          }
                        }
                      ]
                    }
                  },
                  {
                    'type'         : 'VariableDeclaration',
                    'declarations' : [
                      {
                        'type' : 'VariableDeclarator',
                        'id'   : {
                          'type' : 'Identifier',
                          'name' : 'db'
                        },
                        'init' : {
                          'type'        : 'MemberExpression',
                          'object'      : {
                            'type'        : 'MemberExpression',
                            'object'      : {
                              'type' : 'Identifier',
                              'name' : 'base'
                            },
                            'property'    : {
                              'type'     : 'MemberExpression',
                              'object'   : {
                                'type' : 'Identifier',
                                'name' : 'Symbol'
                              },
                              'property' : {
                                'type' : 'Identifier',
                                'name' : 'metadata'
                              }
                            }, 'computed' : true
                          },
                          'property'    : {
                            'type' : 'Identifier',
                            'name' : 'name'
                          }, 'computed' : true
                        }
                      }
                    ],
                    'kind'         : 'const'
                  },
                  {
                    'type'       : 'IfStatement',
                    'test'       : {
                      'type'     : 'BinaryExpression',
                      'left'     : {
                        'type' : 'Identifier',
                        'name' : 'key'
                      },
                      'operator' : 'in',
                      'right'    : {
                        'type' : 'Identifier',
                        'name' : 'db'
                      }
                    },
                    'consequent' : {
                      'type' : 'BlockStatement',
                      'body' : [
                        {
                          'type'       : 'IfStatement',
                          'test'       : {
                            'type'     : 'UnaryExpression',
                            'operator' : '!',
                            'prefix'   : true,
                            'argument' : {
                              'type'      : 'CallExpression',
                              'callee'    : {
                                'type'     : 'MemberExpression',
                                'object'   : {
                                  'type' : 'Identifier',
                                  'name' : 'Array'
                                },
                                'property' : {
                                  'type' : 'Identifier',
                                  'name' : 'isArray'
                                }
                              },
                              'arguments' : [
                                {
                                  'type'        : 'MemberExpression',
                                  'object'      : {
                                    'type' : 'Identifier',
                                    'name' : 'db'
                                  },
                                  'property'    : {
                                    'type' : 'Identifier',
                                    'name' : 'key'
                                  }, 'computed' : true
                                }
                              ]
                            }
                          },
                          'consequent' : {
                            'type' : 'BlockStatement',
                            'body' : [
                              {
                                'type'     : 'ReturnStatement',
                                'argument' : {
                                  'type'     : 'AssignmentExpression',
                                  'operator' : '=',
                                  'left'     : {
                                    'type'     : 'MemberExpression',
                                    'object'   : {
                                      'type' : 'Identifier',
                                      'name' : 'db'
                                    },
                                    'property' : {
                                      'type' : 'Identifier',
                                      'name' : 'key'
                                    },
                                    'computed' : true
                                  },
                                  'right'    : {
                                    'type'     : 'ArrayExpression',
                                    'elements' : [
                                      {
                                        'type'     : 'MemberExpression',
                                        'object'   : {
                                          'type' : 'Identifier',
                                          'name' : 'db'
                                        },
                                        'property' : {
                                          'type' : 'Identifier',
                                          'name' : 'key'
                                        },
                                        'computed' : true
                                      },
                                      {
                                        'type' : 'Identifier',
                                        'name' : 'value'
                                      }
                                    ]
                                  }
                                }
                              }
                            ]
                          }
                        },
                        {
                          'type'     : 'ReturnStatement',
                          'argument' : {
                            'type'      : 'CallExpression',
                            'callee'    : {
                              'type'     : 'MemberExpression',
                              'object'   : {
                                'type'        : 'MemberExpression',
                                'object'      : {
                                  'type' : 'Identifier',
                                  'name' : 'db'
                                },
                                'property'    : {
                                  'type' : 'Identifier',
                                  'name' : 'key'
                                }, 'computed' : true
                              },
                              'property' : {
                                'type' : 'Identifier',
                                'name' : 'push'
                              }
                            },
                            'arguments' : [
                              {
                                'type' : 'Identifier',
                                'name' : 'value'
                              }
                            ]
                          }
                        }
                      ]
                    },
                    'alternate'  : null
                  },
                  {
                    'type'     : 'ReturnStatement',
                    'argument' : {
                      'type'     : 'AssignmentExpression',
                      'operator' : '=',
                      'left'     : {
                        'type'        : 'MemberExpression',
                        'object'      : {
                          'type' : 'Identifier',
                          'name' : 'db'
                        },
                        'property'    : {
                          'type' : 'Identifier',
                          'name' : 'key'
                        }, 'computed' : true
                      },
                      'right'    : {
                        'type' : 'Identifier',
                        'name' : 'value'
                      }
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    }];
}

function applyDecoratorGenerator () {
  return {
    'type'   : 'FunctionDeclaration',
    'id'     : {'type' : 'Identifier', 'name' : '__applyDecorator'},
    'params' : [
      {'type' : 'Identifier', 'name' : 'result'},
      {'type' : 'Identifier', 'name' : 'origin'},
      {'type' : 'Identifier', 'name' : 'collection'}
    ],
    'body'   : {
      'type' : 'BlockStatement',
      'body' : [
        {
          'type'       : 'IfStatement',
          'test'       : {
            'type'     : 'BinaryExpression',
            'left'     : {'type' : 'UnaryExpression', 'operator' : 'typeof', 'prefix' : true, 'argument' : {'type' : 'Identifier', 'name' : 'result'}},
            'operator' : '===',
            'right'    : {'type' : 'Literal', 'value' : 'undefined'}
          },
          'consequent' : {'type' : 'BlockStatement', 'body' : [{'type' : 'ReturnStatement', 'argument' : {'type' : 'Identifier', 'name' : 'origin'}}]}
        },
        {
          'type'       : 'IfStatement',
          'test'       : {
            'type'     : 'BinaryExpression',
            'left'     : {'type' : 'UnaryExpression', 'operator' : 'typeof', 'prefix' : true, 'argument' : {'type' : 'Identifier', 'name' : 'result'}},
            'operator' : '===',
            'right'    : {'type' : 'Literal', 'value' : 'function'}
          },
          'consequent' : {'type' : 'BlockStatement', 'body' : [{'type' : 'ReturnStatement', 'argument' : {'type' : 'Identifier', 'name' : 'result'}}]}
        },
        {
          'type'       : 'IfStatement',
          'test'       : {
            'type'     : 'BinaryExpression',
            'left'     : {'type' : 'UnaryExpression', 'operator' : 'typeof', 'prefix' : true, 'argument' : {'type' : 'Identifier', 'name' : 'result'}},
            'operator' : '===',
            'right'    : {'type' : 'Literal', 'value' : 'object'}
          },
          'consequent' : {
            'type' : 'BlockStatement',
            'body' : [
              {
                'type'       : 'IfStatement',
                'test'       : {
                  'type'     : 'BinaryExpression',
                  'left'     : {'type' : 'UnaryExpression', 'operator' : 'typeof', 'prefix' : true, 'argument' : {'type' : 'MemberExpression', 'object' : {'type' : 'Identifier', 'name' : 'result'}, 'property' : {'type' : 'Identifier', 'name' : 'initialize'}}},
                  'operator' : '===',
                  'right'    : {'type' : 'Literal', 'value' : 'function'}
                },
                'consequent' : {
                  'type' : 'BlockStatement',
                  'body' : [
                    {
                      'type'       : 'ExpressionStatement',
                      'expression' : {
                        'type'      : 'CallExpression', 'callee' : {'type' : 'MemberExpression', 'object' : {'type' : 'Identifier', 'name' : 'collection'}, 'property' : {'type' : 'Identifier', 'name' : 'push'}},
                        'arguments' : [
                          {'type' : 'MemberExpression', 'object' : {'type' : 'Identifier', 'name' : 'result'}, 'property' : {'type' : 'Identifier', 'name' : 'initialize'}}
                        ]
                      }
                    }
                  ]
                }
              },
              {
                'type'     : 'ReturnStatement',
                'argument' : {
                  'type'     : 'LogicalExpression',
                  'left'     : {
                    'type'     : 'LogicalExpression',
                    'left'     : {
                      'type'     : 'LogicalExpression',
                      'left'     : {'type' : 'MemberExpression', 'object' : {'type' : 'Identifier', 'name' : 'result'}, 'property' : {'type' : 'Identifier', 'name' : 'get'}},
                      'operator' : '||',
                      'right'    : {'type' : 'MemberExpression', 'object' : {'type' : 'Identifier', 'name' : 'result'}, 'property' : {'type' : 'Identifier', 'name' : 'set'}}
                    },
                    'operator' : '||',
                    'right'    : {'type' : 'MemberExpression', 'object' : {'type' : 'Identifier', 'name' : 'result'}, 'property' : {'type' : 'Identifier', 'name' : 'definition'}}
                  },
                  'operator' : '||',
                  'right'    : {'type' : 'Identifier', 'name' : 'origin'}
                }
              }
            ]
          }
        },
        {
          'type'     : 'ThrowStatement',
          'argument' : {
            'type'      : 'NewExpression', 'callee' : {'type' : 'Identifier', 'name' : 'TypeError'},
            'arguments' : [{'type' : 'Literal', 'value' : 'invalid decorator return'}]
          }
        }
      ]
    }
  };
}

function insertAfter (arr, current, elements) {
  arr.splice (arr.indexOf (current) + 1, 0, ...elements);
}

function insertBefore (arr, current, elements) {
  arr.splice (arr.indexOf (current), 0, ...elements);
}

function insertBeforeNext (arr, next, elements) {
  if (next !== null) {
    return arr.splice (arr.indexOf (next), 0, ...elements);
  }
  arr.push (...elements);
}

function replace (arr, current, elements) {
  arr.splice (arr.indexOf (current), 1, ...elements);
}

function prettySource (source) {
  const lines = source.split (/\n|\r\n/);
  for (let n = 0; n < lines.length; n++) {
    const line = lines[ n ];
    const next = n + 1 < lines.length ? lines [ n + 1 ] : '';
    if (!line) {
      if (next.substring (0, 1) === ' ') {
        lines.splice (n--, 1);
      }
    } else {
      if (line.substring (0, 1) !== ' ' && next && next.substring (0, 1) !== ' ') {
        lines.splice (++n, 0, '');
      }
    }
  }
  return lines.join ('\n');
}