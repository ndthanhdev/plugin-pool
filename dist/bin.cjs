'use strict';

var logger$2 = require('./logger-00eecfeb.js');
require('@microsoft/typescript-etw');
require('fs');
require('path');
require('os');
require('crypto');
require('buffer');
var lib = require('./lib.cjs');
require('module');
require('inspector');
require('constants');
require('stream');
require('util');
require('assert');
require('events');
require('tty');

var isPromise = function isPromise (maybePromise) {
  return !!maybePromise && !!maybePromise.then && (typeof maybePromise.then === 'function')
};

// hoisted due to circular dependency on command.
var middleware = {
  applyMiddleware,
  commandMiddlewareFactory,
  globalMiddlewareFactory
};



function globalMiddlewareFactory (globalMiddleware, context) {
  return function (callback, applyBeforeValidation = false) {
    argsert_1('<array|function> [boolean]', [callback, applyBeforeValidation], arguments.length);
    if (Array.isArray(callback)) {
      for (let i = 0; i < callback.length; i++) {
        if (typeof callback[i] !== 'function') {
          throw Error('middleware must be a function')
        }
        callback[i].applyBeforeValidation = applyBeforeValidation;
      }
      Array.prototype.push.apply(globalMiddleware, callback);
    } else if (typeof callback === 'function') {
      callback.applyBeforeValidation = applyBeforeValidation;
      globalMiddleware.push(callback);
    }
    return context
  }
}

function commandMiddlewareFactory (commandMiddleware) {
  if (!commandMiddleware) return []
  return commandMiddleware.map(middleware => {
    middleware.applyBeforeValidation = false;
    return middleware
  })
}

function applyMiddleware (argv, yargs, middlewares, beforeValidation) {
  const beforeValidationError = new Error('middleware cannot return a promise when applyBeforeValidation is true');
  return middlewares
    .reduce((accumulation, middleware) => {
      if (middleware.applyBeforeValidation !== beforeValidation) {
        return accumulation
      }

      if (isPromise(accumulation)) {
        return accumulation
          .then(initialObj =>
            Promise.all([initialObj, middleware(initialObj, yargs)])
          )
          .then(([initialObj, middlewareObj]) =>
            Object.assign(initialObj, middlewareObj)
          )
      } else {
        const result = middleware(argv, yargs);
        if (beforeValidation && isPromise(result)) throw beforeValidationError

        return isPromise(result)
          ? result.then(middlewareObj => Object.assign(accumulation, middlewareObj))
          : Object.assign(accumulation, result)
      }
    }, argv)
}

const preserveCamelCase = string => {
	let isLastCharLower = false;
	let isLastCharUpper = false;
	let isLastLastCharUpper = false;

	for (let i = 0; i < string.length; i++) {
		const character = string[i];

		if (isLastCharLower && /[a-zA-Z]/.test(character) && character.toUpperCase() === character) {
			string = string.slice(0, i) + '-' + string.slice(i);
			isLastCharLower = false;
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = true;
			i++;
		} else if (isLastCharUpper && isLastLastCharUpper && /[a-zA-Z]/.test(character) && character.toLowerCase() === character) {
			string = string.slice(0, i - 1) + '-' + string.slice(i - 1);
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = false;
			isLastCharLower = true;
		} else {
			isLastCharLower = character.toLowerCase() === character && character.toUpperCase() !== character;
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = character.toUpperCase() === character && character.toLowerCase() !== character;
		}
	}

	return string;
};

const camelCase = (input, options) => {
	if (!(typeof input === 'string' || Array.isArray(input))) {
		throw new TypeError('Expected the input to be `string | string[]`');
	}

	options = Object.assign({
		pascalCase: false
	}, options);

	const postProcess = x => options.pascalCase ? x.charAt(0).toUpperCase() + x.slice(1) : x;

	if (Array.isArray(input)) {
		input = input.map(x => x.trim())
			.filter(x => x.length)
			.join('-');
	} else {
		input = input.trim();
	}

	if (input.length === 0) {
		return '';
	}

	if (input.length === 1) {
		return options.pascalCase ? input.toUpperCase() : input.toLowerCase();
	}

	const hasUpperCase = input !== input.toLowerCase();

	if (hasUpperCase) {
		input = preserveCamelCase(input);
	}

	input = input
		.replace(/^[_.\- ]+/, '')
		.toLowerCase()
		.replace(/[_.\- ]+(\w|$)/g, (_, p1) => p1.toUpperCase())
		.replace(/\d+(\w|$)/g, m => m.toUpperCase());

	return postProcess(input);
};

var camelcase = camelCase;
// TODO: Remove this for the next major release
var default_1 = camelCase;
camelcase.default = default_1;

var decamelize = function (str, sep) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	sep = typeof sep === 'undefined' ? '_' : sep;

	return str
		.replace(/([a-z\d])([A-Z])/g, '$1' + sep + '$2')
		.replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1' + sep + '$2')
		.toLowerCase();
};

// take an un-split argv string and tokenize it.
var tokenizeArgString = function (argString) {
  if (Array.isArray(argString)) {
    return argString.map(e => typeof e !== 'string' ? e + '' : e)
  }

  argString = argString.trim();

  var i = 0;
  var prevC = null;
  var c = null;
  var opening = null;
  var args = [];

  for (var ii = 0; ii < argString.length; ii++) {
    prevC = c;
    c = argString.charAt(ii);

    // split on spaces unless we're in quotes.
    if (c === ' ' && !opening) {
      if (!(prevC === ' ')) {
        i++;
      }
      continue
    }

    // don't split the string if we're in matching
    // opening or closing single and double quotes.
    if (c === opening) {
      opening = null;
    } else if ((c === "'" || c === '"') && !opening) {
      opening = c;
    }

    if (!args[i]) args[i] = '';
    args[i] += c;
  }

  return args
};

function parse (args, opts) {
  if (!opts) opts = {};
  // allow a string argument to be passed in rather
  // than an argv array.
  args = tokenizeArgString(args);

  // aliases might have transitive relationships, normalize this.
  var aliases = combineAliases(opts.alias || {});
  var configuration = Object.assign({
    'short-option-groups': true,
    'camel-case-expansion': true,
    'dot-notation': true,
    'parse-numbers': true,
    'boolean-negation': true,
    'negation-prefix': 'no-',
    'duplicate-arguments-array': true,
    'flatten-duplicate-arrays': true,
    'populate--': false,
    'combine-arrays': false,
    'set-placeholder-key': false,
    'halt-at-non-option': false,
    'strip-aliased': false,
    'strip-dashed': false,
    'unknown-options-as-args': false
  }, opts.configuration);
  var defaults = opts.default || {};
  var configObjects = opts.configObjects || [];
  var envPrefix = opts.envPrefix;
  var notFlagsOption = configuration['populate--'];
  var notFlagsArgv = notFlagsOption ? '--' : '_';
  var newAliases = {};
  var defaulted = {};
  // allow a i18n handler to be passed in, default to a fake one (util.format).
  var __ = opts.__ || logger$2.require$$0.format;
  var error = null;
  var flags = {
    aliases: {},
    arrays: {},
    bools: {},
    strings: {},
    numbers: {},
    counts: {},
    normalize: {},
    configs: {},
    nargs: {},
    coercions: {},
    keys: []
  };
  var negative = /^-([0-9]+(\.[0-9]+)?|\.[0-9]+)$/;
  var negatedBoolean = new RegExp('^--' + configuration['negation-prefix'] + '(.+)')

  ;[].concat(opts.array).filter(Boolean).forEach(function (opt) {
    var key = opt.key || opt;

    // assign to flags[bools|strings|numbers]
    const assignment = Object.keys(opt).map(function (key) {
      return ({
        boolean: 'bools',
        string: 'strings',
        number: 'numbers'
      })[key]
    }).filter(Boolean).pop();

    // assign key to be coerced
    if (assignment) {
      flags[assignment][key] = true;
    }

    flags.arrays[key] = true;
    flags.keys.push(key);
  })

  ;[].concat(opts.boolean).filter(Boolean).forEach(function (key) {
    flags.bools[key] = true;
    flags.keys.push(key);
  })

  ;[].concat(opts.string).filter(Boolean).forEach(function (key) {
    flags.strings[key] = true;
    flags.keys.push(key);
  })

  ;[].concat(opts.number).filter(Boolean).forEach(function (key) {
    flags.numbers[key] = true;
    flags.keys.push(key);
  })

  ;[].concat(opts.count).filter(Boolean).forEach(function (key) {
    flags.counts[key] = true;
    flags.keys.push(key);
  })

  ;[].concat(opts.normalize).filter(Boolean).forEach(function (key) {
    flags.normalize[key] = true;
    flags.keys.push(key);
  });

  Object.keys(opts.narg || {}).forEach(function (k) {
    flags.nargs[k] = opts.narg[k];
    flags.keys.push(k);
  });

  Object.keys(opts.coerce || {}).forEach(function (k) {
    flags.coercions[k] = opts.coerce[k];
    flags.keys.push(k);
  });

  if (Array.isArray(opts.config) || typeof opts.config === 'string') {
[].concat(opts.config).filter(Boolean).forEach(function (key) {
      flags.configs[key] = true;
    });
  } else {
    Object.keys(opts.config || {}).forEach(function (k) {
      flags.configs[k] = opts.config[k];
    });
  }

  // create a lookup table that takes into account all
  // combinations of aliases: {f: ['foo'], foo: ['f']}
  extendAliases(opts.key, aliases, opts.default, flags.arrays);

  // apply default values to all aliases.
  Object.keys(defaults).forEach(function (key) {
    (flags.aliases[key] || []).forEach(function (alias) {
      defaults[alias] = defaults[key];
    });
  });

  checkConfiguration();

  var argv = { _: [] };
  var notFlags = [];

  for (var i = 0; i < args.length; i++) {
    var arg = args[i];
    var broken;
    var key;
    var letters;
    var m;
    var next;
    var value;

    // any unknown option (except for end-of-options, "--")
    if (arg !== '--' && isUnknownOptionAsArg(arg)) {
      argv._.push(arg);
    // -- separated by =
    } else if (arg.match(/^--.+=/) || (
      !configuration['short-option-groups'] && arg.match(/^-.+=/)
    )) {
      // Using [\s\S] instead of . because js doesn't support the
      // 'dotall' regex modifier. See:
      // http://stackoverflow.com/a/1068308/13216
      m = arg.match(/^--?([^=]+)=([\s\S]*)$/);

      // nargs format = '--f=monkey washing cat'
      if (checkAllAliases(m[1], flags.nargs)) {
        args.splice(i + 1, 0, m[2]);
        i = eatNargs(i, m[1], args);
      // arrays format = '--f=a b c'
      } else if (checkAllAliases(m[1], flags.arrays)) {
        args.splice(i + 1, 0, m[2]);
        i = eatArray(i, m[1], args);
      } else {
        setArg(m[1], m[2]);
      }
    } else if (arg.match(negatedBoolean) && configuration['boolean-negation']) {
      key = arg.match(negatedBoolean)[1];
      setArg(key, checkAllAliases(key, flags.arrays) ? [false] : false);

    // -- separated by space.
    } else if (arg.match(/^--.+/) || (
      !configuration['short-option-groups'] && arg.match(/^-[^-]+/)
    )) {
      key = arg.match(/^--?(.+)/)[1];

      // nargs format = '--foo a b c'
      // should be truthy even if: flags.nargs[key] === 0
      if (checkAllAliases(key, flags.nargs) !== false) {
        i = eatNargs(i, key, args);
      // array format = '--foo a b c'
      } else if (checkAllAliases(key, flags.arrays)) {
        i = eatArray(i, key, args);
      } else {
        next = args[i + 1];

        if (next !== undefined && (!next.match(/^-/) ||
          next.match(negative)) &&
          !checkAllAliases(key, flags.bools) &&
          !checkAllAliases(key, flags.counts)) {
          setArg(key, next);
          i++;
        } else if (/^(true|false)$/.test(next)) {
          setArg(key, next);
          i++;
        } else {
          setArg(key, defaultValue(key));
        }
      }

    // dot-notation flag separated by '='.
    } else if (arg.match(/^-.\..+=/)) {
      m = arg.match(/^-([^=]+)=([\s\S]*)$/);
      setArg(m[1], m[2]);

    // dot-notation flag separated by space.
    } else if (arg.match(/^-.\..+/) && !arg.match(negative)) {
      next = args[i + 1];
      key = arg.match(/^-(.\..+)/)[1];

      if (next !== undefined && !next.match(/^-/) &&
        !checkAllAliases(key, flags.bools) &&
        !checkAllAliases(key, flags.counts)) {
        setArg(key, next);
        i++;
      } else {
        setArg(key, defaultValue(key));
      }
    } else if (arg.match(/^-[^-]+/) && !arg.match(negative)) {
      letters = arg.slice(1, -1).split('');
      broken = false;

      for (var j = 0; j < letters.length; j++) {
        next = arg.slice(j + 2);

        if (letters[j + 1] && letters[j + 1] === '=') {
          value = arg.slice(j + 3);
          key = letters[j];

          // nargs format = '-f=monkey washing cat'
          if (checkAllAliases(key, flags.nargs)) {
            args.splice(i + 1, 0, value);
            i = eatNargs(i, key, args);
          // array format = '-f=a b c'
          } else if (checkAllAliases(key, flags.arrays)) {
            args.splice(i + 1, 0, value);
            i = eatArray(i, key, args);
          } else {
            setArg(key, value);
          }

          broken = true;
          break
        }

        if (next === '-') {
          setArg(letters[j], next);
          continue
        }

        // current letter is an alphabetic character and next value is a number
        if (/[A-Za-z]/.test(letters[j]) &&
          /^-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
          setArg(letters[j], next);
          broken = true;
          break
        }

        if (letters[j + 1] && letters[j + 1].match(/\W/)) {
          setArg(letters[j], next);
          broken = true;
          break
        } else {
          setArg(letters[j], defaultValue(letters[j]));
        }
      }

      key = arg.slice(-1)[0];

      if (!broken && key !== '-') {
        // nargs format = '-f a b c'
        // should be truthy even if: flags.nargs[key] === 0
        if (checkAllAliases(key, flags.nargs) !== false) {
          i = eatNargs(i, key, args);
        // array format = '-f a b c'
        } else if (checkAllAliases(key, flags.arrays)) {
          i = eatArray(i, key, args);
        } else {
          next = args[i + 1];

          if (next !== undefined && (!/^(-|--)[^-]/.test(next) ||
            next.match(negative)) &&
            !checkAllAliases(key, flags.bools) &&
            !checkAllAliases(key, flags.counts)) {
            setArg(key, next);
            i++;
          } else if (/^(true|false)$/.test(next)) {
            setArg(key, next);
            i++;
          } else {
            setArg(key, defaultValue(key));
          }
        }
      }
    } else if (arg === '--') {
      notFlags = args.slice(i + 1);
      break
    } else if (configuration['halt-at-non-option']) {
      notFlags = args.slice(i);
      break
    } else {
      argv._.push(maybeCoerceNumber('_', arg));
    }
  }

  // order of precedence:
  // 1. command line arg
  // 2. value from env var
  // 3. value from config file
  // 4. value from config objects
  // 5. configured default value
  applyEnvVars(argv, true); // special case: check env vars that point to config file
  applyEnvVars(argv, false);
  setConfig(argv);
  setConfigObjects();
  applyDefaultsAndAliases(argv, flags.aliases, defaults, true);
  applyCoercions(argv);
  if (configuration['set-placeholder-key']) setPlaceholderKeys(argv);

  // for any counts either not in args or without an explicit default, set to 0
  Object.keys(flags.counts).forEach(function (key) {
    if (!hasKey(argv, key.split('.'))) setArg(key, 0);
  });

  // '--' defaults to undefined.
  if (notFlagsOption && notFlags.length) argv[notFlagsArgv] = [];
  notFlags.forEach(function (key) {
    argv[notFlagsArgv].push(key);
  });

  if (configuration['camel-case-expansion'] && configuration['strip-dashed']) {
    Object.keys(argv).filter(key => key !== '--' && key.includes('-')).forEach(key => {
      delete argv[key];
    });
  }

  if (configuration['strip-aliased']) {
[].concat(...Object.keys(aliases).map(k => aliases[k])).forEach(alias => {
      if (configuration['camel-case-expansion']) {
        delete argv[alias.split('.').map(prop => camelcase(prop)).join('.')];
      }

      delete argv[alias];
    });
  }

  // how many arguments should we consume, based
  // on the nargs option?
  function eatNargs (i, key, args) {
    var ii;
    const toEat = checkAllAliases(key, flags.nargs);

    if (toEat === 0) {
      setArg(key, defaultValue(key));
      return i
    }

    // nargs will not consume flag arguments, e.g., -abc, --foo,
    // and terminates when one is observed.
    var available = 0;
    for (ii = i + 1; ii < args.length; ii++) {
      if (!args[ii].match(/^-[^0-9]/) || args[ii].match(negative) || isUnknownOptionAsArg(args[ii])) available++;
      else break
    }

    if (available < toEat) error = Error(__('Not enough arguments following: %s', key));

    const consumed = Math.min(available, toEat);
    for (ii = i + 1; ii < (consumed + i + 1); ii++) {
      setArg(key, args[ii]);
    }

    return (i + consumed)
  }

  // if an option is an array, eat all non-hyphenated arguments
  // following it... YUM!
  // e.g., --foo apple banana cat becomes ["apple", "banana", "cat"]
  function eatArray (i, key, args) {
    let argsToSet = [];
    let next = args[i + 1];

    if (checkAllAliases(key, flags.bools) && !(/^(true|false)$/.test(next))) {
      argsToSet.push(true);
    } else if (isUndefined(next) || (/^-/.test(next) && !negative.test(next) && !isUnknownOptionAsArg(next))) {
      // for keys without value ==> argsToSet remains an empty []
      // set user default value, if available
      if (defaults.hasOwnProperty(key)) {
        const defVal = defaults[key];
        argsToSet = Array.isArray(defVal) ? defVal : [defVal];
      }
    } else {
      for (var ii = i + 1; ii < args.length; ii++) {
        next = args[ii];
        if (/^-/.test(next) && !negative.test(next) && !isUnknownOptionAsArg(next)) break
        i = ii;
        argsToSet.push(processValue(key, next));
      }
    }

    setArg(key, argsToSet);
    return i
  }

  function setArg (key, val) {
    if (/-/.test(key) && configuration['camel-case-expansion']) {
      var alias = key.split('.').map(function (prop) {
        return camelcase(prop)
      }).join('.');
      addNewAlias(key, alias);
    }

    var value = processValue(key, val);

    var splitKey = key.split('.');
    setKey(argv, splitKey, value);

    // handle populating aliases of the full key
    if (flags.aliases[key]) {
      flags.aliases[key].forEach(function (x) {
        x = x.split('.');
        setKey(argv, x, value);
      });
    }

    // handle populating aliases of the first element of the dot-notation key
    if (splitKey.length > 1 && configuration['dot-notation']) {
(flags.aliases[splitKey[0]] || []).forEach(function (x) {
        x = x.split('.');

        // expand alias with nested objects in key
        var a = [].concat(splitKey);
        a.shift(); // nuke the old key.
        x = x.concat(a);

        setKey(argv, x, value);
      });
    }

    // Set normalize getter and setter when key is in 'normalize' but isn't an array
    if (checkAllAliases(key, flags.normalize) && !checkAllAliases(key, flags.arrays)) {
      var keys = [key].concat(flags.aliases[key] || []);
      keys.forEach(function (key) {
        argv.__defineSetter__(key, function (v) {
          val = path$2__default.normalize(v);
        });

        argv.__defineGetter__(key, function () {
          return typeof val === 'string' ? path$2__default.normalize(val) : val
        });
      });
    }
  }

  function addNewAlias (key, alias) {
    if (!(flags.aliases[key] && flags.aliases[key].length)) {
      flags.aliases[key] = [alias];
      newAliases[alias] = true;
    }
    if (!(flags.aliases[alias] && flags.aliases[alias].length)) {
      addNewAlias(alias, key);
    }
  }

  function processValue (key, val) {
    // strings may be quoted, clean this up as we assign values.
    if (typeof val === 'string' &&
      (val[0] === "'" || val[0] === '"') &&
      val[val.length - 1] === val[0]
    ) {
      val = val.substring(1, val.length - 1);
    }

    // handle parsing boolean arguments --foo=true --bar false.
    if (checkAllAliases(key, flags.bools) || checkAllAliases(key, flags.counts)) {
      if (typeof val === 'string') val = val === 'true';
    }

    var value = Array.isArray(val)
      ? val.map(function (v) { return maybeCoerceNumber(key, v) })
      : maybeCoerceNumber(key, val);

    // increment a count given as arg (either no value or value parsed as boolean)
    if (checkAllAliases(key, flags.counts) && (isUndefined(value) || typeof value === 'boolean')) {
      value = increment;
    }

    // Set normalized value when key is in 'normalize' and in 'arrays'
    if (checkAllAliases(key, flags.normalize) && checkAllAliases(key, flags.arrays)) {
      if (Array.isArray(val)) value = val.map(path$2__default.normalize);
      else value = path$2__default.normalize(val);
    }
    return value
  }

  function maybeCoerceNumber (key, value) {
    if (!checkAllAliases(key, flags.strings) && !checkAllAliases(key, flags.bools) && !Array.isArray(value)) {
      const shouldCoerceNumber = isNumber(value) && configuration['parse-numbers'] && (
        Number.isSafeInteger(Math.floor(value))
      );
      if (shouldCoerceNumber || (!isUndefined(value) && checkAllAliases(key, flags.numbers))) value = Number(value);
    }
    return value
  }

  // set args from config.json file, this should be
  // applied last so that defaults can be applied.
  function setConfig (argv) {
    var configLookup = {};

    // expand defaults/aliases, in-case any happen to reference
    // the config.json file.
    applyDefaultsAndAliases(configLookup, flags.aliases, defaults);

    Object.keys(flags.configs).forEach(function (configKey) {
      var configPath = argv[configKey] || configLookup[configKey];
      if (configPath) {
        try {
          var config = null;
          var resolvedConfigPath = path$2__default.resolve(process.cwd(), configPath);

          if (typeof flags.configs[configKey] === 'function') {
            try {
              config = flags.configs[configKey](resolvedConfigPath);
            } catch (e) {
              config = e;
            }
            if (config instanceof Error) {
              error = config;
              return
            }
          } else {
            config = logger$2.commonjsRequire(resolvedConfigPath);
          }

          setConfigObject(config);
        } catch (ex) {
          if (argv[configKey]) error = Error(__('Invalid JSON config file: %s', configPath));
        }
      }
    });
  }

  // set args from config object.
  // it recursively checks nested objects.
  function setConfigObject (config, prev) {
    Object.keys(config).forEach(function (key) {
      var value = config[key];
      var fullKey = prev ? prev + '.' + key : key;

      // if the value is an inner object and we have dot-notation
      // enabled, treat inner objects in config the same as
      // heavily nested dot notations (foo.bar.apple).
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && configuration['dot-notation']) {
        // if the value is an object but not an array, check nested object
        setConfigObject(value, fullKey);
      } else {
        // setting arguments via CLI takes precedence over
        // values within the config file.
        if (!hasKey(argv, fullKey.split('.')) || (checkAllAliases(fullKey, flags.arrays) && configuration['combine-arrays'])) {
          setArg(fullKey, value);
        }
      }
    });
  }

  // set all config objects passed in opts
  function setConfigObjects () {
    if (typeof configObjects === 'undefined') return
    configObjects.forEach(function (configObject) {
      setConfigObject(configObject);
    });
  }

  function applyEnvVars (argv, configOnly) {
    if (typeof envPrefix === 'undefined') return

    var prefix = typeof envPrefix === 'string' ? envPrefix : '';
    Object.keys(process.env).forEach(function (envVar) {
      if (prefix === '' || envVar.lastIndexOf(prefix, 0) === 0) {
        // get array of nested keys and convert them to camel case
        var keys = envVar.split('__').map(function (key, i) {
          if (i === 0) {
            key = key.substring(prefix.length);
          }
          return camelcase(key)
        });

        if (((configOnly && flags.configs[keys.join('.')]) || !configOnly) && !hasKey(argv, keys)) {
          setArg(keys.join('.'), process.env[envVar]);
        }
      }
    });
  }

  function applyCoercions (argv) {
    var coerce;
    var applied = {};
    Object.keys(argv).forEach(function (key) {
      if (!applied.hasOwnProperty(key)) { // If we haven't already coerced this option via one of its aliases
        coerce = checkAllAliases(key, flags.coercions);
        if (typeof coerce === 'function') {
          try {
            var value = maybeCoerceNumber(key, coerce(argv[key]))
            ;([].concat(flags.aliases[key] || [], key)).forEach(ali => {
              applied[ali] = argv[ali] = value;
            });
          } catch (err) {
            error = err;
          }
        }
      }
    });
  }

  function setPlaceholderKeys (argv) {
    flags.keys.forEach((key) => {
      // don't set placeholder keys for dot notation options 'foo.bar'.
      if (~key.indexOf('.')) return
      if (typeof argv[key] === 'undefined') argv[key] = undefined;
    });
    return argv
  }

  function applyDefaultsAndAliases (obj, aliases, defaults, canLog = false) {
    Object.keys(defaults).forEach(function (key) {
      if (!hasKey(obj, key.split('.'))) {
        setKey(obj, key.split('.'), defaults[key]);
        if (canLog) defaulted[key] = true

        ;(aliases[key] || []).forEach(function (x) {
          if (hasKey(obj, x.split('.'))) return
          setKey(obj, x.split('.'), defaults[key]);
        });
      }
    });
  }

  function hasKey (obj, keys) {
    var o = obj;

    if (!configuration['dot-notation']) keys = [keys.join('.')];

    keys.slice(0, -1).forEach(function (key) {
      o = (o[key] || {});
    });

    var key = keys[keys.length - 1];

    if (typeof o !== 'object') return false
    else return key in o
  }

  function setKey (obj, keys, value) {
    var o = obj;

    if (!configuration['dot-notation']) keys = [keys.join('.')];

    keys.slice(0, -1).forEach(function (key, index) {
      if (typeof o === 'object' && o[key] === undefined) {
        o[key] = {};
      }

      if (typeof o[key] !== 'object' || Array.isArray(o[key])) {
        // ensure that o[key] is an array, and that the last item is an empty object.
        if (Array.isArray(o[key])) {
          o[key].push({});
        } else {
          o[key] = [o[key], {}];
        }

        // we want to update the empty object at the end of the o[key] array, so set o to that object
        o = o[key][o[key].length - 1];
      } else {
        o = o[key];
      }
    });

    var key = keys[keys.length - 1];

    var isTypeArray = checkAllAliases(keys.join('.'), flags.arrays);
    var isValueArray = Array.isArray(value);
    var duplicate = configuration['duplicate-arguments-array'];

    // nargs has higher priority than duplicate
    if (!duplicate && checkAllAliases(key, flags.nargs)) {
      duplicate = true;
      if ((!isUndefined(o[key]) && flags.nargs[key] === 1) || (Array.isArray(o[key]) && o[key].length === flags.nargs[key])) {
        o[key] = undefined;
      }
    }

    if (value === increment) {
      o[key] = increment(o[key]);
    } else if (Array.isArray(o[key])) {
      if (duplicate && isTypeArray && isValueArray) {
        o[key] = configuration['flatten-duplicate-arrays'] ? o[key].concat(value) : (Array.isArray(o[key][0]) ? o[key] : [o[key]]).concat([value]);
      } else if (!duplicate && Boolean(isTypeArray) === Boolean(isValueArray)) {
        o[key] = value;
      } else {
        o[key] = o[key].concat([value]);
      }
    } else if (o[key] === undefined && isTypeArray) {
      o[key] = isValueArray ? value : [value];
    } else if (duplicate && !(o[key] === undefined || checkAllAliases(key, flags.counts))) {
      o[key] = [ o[key], value ];
    } else {
      o[key] = value;
    }
  }

  // extend the aliases list with inferred aliases.
  function extendAliases (...args) {
    args.forEach(function (obj) {
      Object.keys(obj || {}).forEach(function (key) {
        // short-circuit if we've already added a key
        // to the aliases array, for example it might
        // exist in both 'opts.default' and 'opts.key'.
        if (flags.aliases[key]) return

        flags.aliases[key] = [].concat(aliases[key] || []);
        // For "--option-name", also set argv.optionName
        flags.aliases[key].concat(key).forEach(function (x) {
          if (/-/.test(x) && configuration['camel-case-expansion']) {
            var c = camelcase(x);
            if (c !== key && flags.aliases[key].indexOf(c) === -1) {
              flags.aliases[key].push(c);
              newAliases[c] = true;
            }
          }
        });
        // For "--optionName", also set argv['option-name']
        flags.aliases[key].concat(key).forEach(function (x) {
          if (x.length > 1 && /[A-Z]/.test(x) && configuration['camel-case-expansion']) {
            var c = decamelize(x, '-');
            if (c !== key && flags.aliases[key].indexOf(c) === -1) {
              flags.aliases[key].push(c);
              newAliases[c] = true;
            }
          }
        });
        flags.aliases[key].forEach(function (x) {
          flags.aliases[x] = [key].concat(flags.aliases[key].filter(function (y) {
            return x !== y
          }));
        });
      });
    });
  }

  // return the 1st set flag for any of a key's aliases (or false if no flag set)
  function checkAllAliases (key, flag) {
    var toCheck = [].concat(flags.aliases[key] || [], key);
    let setAlias = toCheck.find(key => flag.hasOwnProperty(key));
    return setAlias ? flag[setAlias] : false
  }

  function hasAnyFlag (key) {
    // XXX Switch to [].concat(...Object.values(flags)) once node.js 6 is dropped
    var toCheck = [].concat(...Object.keys(flags).map(k => flags[k]));

    return toCheck.some(function (flag) {
      return flag[key]
    })
  }

  function hasFlagsMatching (arg, ...patterns) {
    var toCheck = [].concat(...patterns);
    return toCheck.some(function (pattern) {
      var match = arg.match(pattern);
      return match && hasAnyFlag(match[1])
    })
  }

  // based on a simplified version of the short flag group parsing logic
  function hasAllShortFlags (arg) {
    // if this is a negative number, or doesn't start with a single hyphen, it's not a short flag group
    if (arg.match(negative) || !arg.match(/^-[^-]+/)) { return false }
    var hasAllFlags = true;
    var letters = arg.slice(1).split('');
    var next;
    for (var j = 0; j < letters.length; j++) {
      next = arg.slice(j + 2);

      if (!hasAnyFlag(letters[j])) {
        hasAllFlags = false;
        break
      }

      if ((letters[j + 1] && letters[j + 1] === '=') ||
        next === '-' ||
        (/[A-Za-z]/.test(letters[j]) && /^-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) ||
        (letters[j + 1] && letters[j + 1].match(/\W/))) {
        break
      }
    }
    return hasAllFlags
  }

  function isUnknownOptionAsArg (arg) {
    return configuration['unknown-options-as-args'] && isUnknownOption(arg)
  }

  function isUnknownOption (arg) {
    // ignore negative numbers
    if (arg.match(negative)) { return false }
    // if this is a short option group and all of them are configured, it isn't unknown
    if (hasAllShortFlags(arg)) { return false }
    // e.g. '--count=2'
    const flagWithEquals = /^-+([^=]+?)=[\s\S]*$/;
    // e.g. '-a' or '--arg'
    const normalFlag = /^-+([^=]+?)$/;
    // e.g. '-a-'
    const flagEndingInHyphen = /^-+([^=]+?)-$/;
    // e.g. '-abc123'
    const flagEndingInDigits = /^-+([^=]+?)\d+$/;
    // e.g. '-a/usr/local'
    const flagEndingInNonWordCharacters = /^-+([^=]+?)\W+.*$/;
    // check the different types of flag styles, including negatedBoolean, a pattern defined near the start of the parse method
    return !hasFlagsMatching(arg, flagWithEquals, negatedBoolean, normalFlag, flagEndingInHyphen, flagEndingInDigits, flagEndingInNonWordCharacters)
  }

  // make a best effor to pick a default value
  // for an option based on name and type.
  function defaultValue (key) {
    if (!checkAllAliases(key, flags.bools) &&
        !checkAllAliases(key, flags.counts) &&
        `${key}` in defaults) {
      return defaults[key]
    } else {
      return defaultForType(guessType(key))
    }
  }

  // return a default value, given the type of a flag.,
  // e.g., key of type 'string' will default to '', rather than 'true'.
  function defaultForType (type) {
    var def = {
      boolean: true,
      string: '',
      number: undefined,
      array: []
    };

    return def[type]
  }

  // given a flag, enforce a default type.
  function guessType (key) {
    var type = 'boolean';

    if (checkAllAliases(key, flags.strings)) type = 'string';
    else if (checkAllAliases(key, flags.numbers)) type = 'number';
    else if (checkAllAliases(key, flags.bools)) type = 'boolean';
    else if (checkAllAliases(key, flags.arrays)) type = 'array';

    return type
  }

  function isNumber (x) {
    if (x === null || x === undefined) return false
    // if loaded from config, may already be a number.
    if (typeof x === 'number') return true
    // hexadecimal.
    if (/^0x[0-9a-f]+$/i.test(x)) return true
    // don't treat 0123 as a number; as it drops the leading '0'.
    if (x.length > 1 && x[0] === '0') return false
    return /^[-]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x)
  }

  function isUndefined (num) {
    return num === undefined
  }

  // check user configuration settings for inconsistencies
  function checkConfiguration () {
    // count keys should not be set as array/narg
    Object.keys(flags.counts).find(key => {
      if (checkAllAliases(key, flags.arrays)) {
        error = Error(__('Invalid configuration: %s, opts.count excludes opts.array.', key));
        return true
      } else if (checkAllAliases(key, flags.nargs)) {
        error = Error(__('Invalid configuration: %s, opts.count excludes opts.narg.', key));
        return true
      }
    });
  }

  return {
    argv: argv,
    error: error,
    aliases: flags.aliases,
    newAliases: newAliases,
    defaulted: defaulted,
    configuration: configuration
  }
}

// if any aliases reference each other, we should
// merge them together.
function combineAliases (aliases) {
  var aliasArrays = [];
  var change = true;
  var combined = {};

  // turn alias lookup hash {key: ['alias1', 'alias2']} into
  // a simple array ['key', 'alias1', 'alias2']
  Object.keys(aliases).forEach(function (key) {
    aliasArrays.push(
      [].concat(aliases[key], key)
    );
  });

  // combine arrays until zero changes are
  // made in an iteration.
  while (change) {
    change = false;
    for (var i = 0; i < aliasArrays.length; i++) {
      for (var ii = i + 1; ii < aliasArrays.length; ii++) {
        var intersect = aliasArrays[i].filter(function (v) {
          return aliasArrays[ii].indexOf(v) !== -1
        });

        if (intersect.length) {
          aliasArrays[i] = aliasArrays[i].concat(aliasArrays[ii]);
          aliasArrays.splice(ii, 1);
          change = true;
          break
        }
      }
    }
  }

  // map arrays back to the hash-lookup (de-dupe while
  // we're at it).
  aliasArrays.forEach(function (aliasArray) {
    aliasArray = aliasArray.filter(function (v, i, self) {
      return self.indexOf(v) === i
    });
    combined[aliasArray.pop()] = aliasArray;
  });

  return combined
}

// this function should only be called when a count is given as an arg
// it is NOT called to set a default value
// thus we can start the count at 1 instead of 0
function increment (orig) {
  return orig !== undefined ? orig + 1 : 1
}

function Parser (args, opts) {
  var result = parse(args.slice(), opts);

  return result.argv
}

// parse arguments and return detailed
// meta information, aliases, etc.
Parser.detailed = function (args, opts) {
  return parse(args.slice(), opts)
};

var yargsParser = Parser;

var join = path$2__default.join,
  resolve = path$2__default.resolve,
  dirname = path$2__default.dirname,
  defaultOptions = {
    extensions: ['js', 'json', 'coffee'],
    recurse: true,
    rename: function (name) {
      return name;
    },
    visit: function (obj) {
      return obj;
    }
  };

function checkFileInclusion(path, filename, options) {
  return (
    // verify file has valid extension
    (new RegExp('\\.(' + options.extensions.join('|') + ')$', 'i').test(filename)) &&

    // if options.include is a RegExp, evaluate it and make sure the path passes
    !(options.include && options.include instanceof RegExp && !options.include.test(path)) &&

    // if options.include is a function, evaluate it and make sure the path passes
    !(options.include && typeof options.include === 'function' && !options.include(path, filename)) &&

    // if options.exclude is a RegExp, evaluate it and make sure the path doesn't pass
    !(options.exclude && options.exclude instanceof RegExp && options.exclude.test(path)) &&

    // if options.exclude is a function, evaluate it and make sure the path doesn't pass
    !(options.exclude && typeof options.exclude === 'function' && options.exclude(path, filename))
  );
}

function requireDirectory(m, path, options) {
  var retval = {};

  // path is optional
  if (path && !options && typeof path !== 'string') {
    options = path;
    path = null;
  }

  // default options
  options = options || {};
  for (var prop in defaultOptions) {
    if (typeof options[prop] === 'undefined') {
      options[prop] = defaultOptions[prop];
    }
  }

  // if no path was passed in, assume the equivelant of __dirname from caller
  // otherwise, resolve path relative to the equivalent of __dirname
  path = !path ? dirname(m.filename) : resolve(dirname(m.filename), path);

  // get the path of each file in specified directory, append to current tree node, recurse
  logger$2.fs.readdirSync(path).forEach(function (filename) {
    var joined = join(path, filename),
      files,
      key,
      obj;

    if (logger$2.fs.statSync(joined).isDirectory() && options.recurse) {
      // this node is a directory; recurse
      files = requireDirectory(m, joined, options);
      // exclude empty directories
      if (Object.keys(files).length) {
        retval[options.rename(filename, joined, filename)] = files;
      }
    } else {
      if (joined !== m.filename && checkFileInclusion(joined, filename, options)) {
        // hash node key shouldn't include file extension
        key = filename.substring(0, filename.lastIndexOf('.'));
        obj = m.require(joined);
        retval[options.rename(key, joined, filename)] = options.visit(obj, joined, filename) || obj;
      }
    }
  });

  return retval;
}

var requireDirectory_1 = requireDirectory;
var defaults = defaultOptions;
requireDirectory_1.defaults = defaults;

var whichModule = function whichModule (exported) {
  for (var i = 0, files = Object.keys(logger$2.commonjsRequire.cache), mod; i < files.length; i++) {
    mod = logger$2.commonjsRequire.cache[files[i]];
    if (mod.exports === exported) return mod
  }
  return null
};

const inspect = logger$2.require$$0.inspect;

const { applyMiddleware: applyMiddleware$1, commandMiddlewareFactory: commandMiddlewareFactory$1 } = middleware;



const DEFAULT_MARKER = /(^\*)|(^\$0)/;

// handles parsing positional arguments,
// and populating argv with said positional
// arguments.
var command = function command (yargs, usage, validation, globalMiddleware) {
  const self = {};
  let handlers = {};
  let aliasMap = {};
  let defaultCommand;
  globalMiddleware = globalMiddleware || [];

  self.addHandler = function addHandler (cmd, description, builder, handler, commandMiddleware) {
    let aliases = [];
    const middlewares = commandMiddlewareFactory$1(commandMiddleware);
    handler = handler || (() => {});

    if (Array.isArray(cmd)) {
      aliases = cmd.slice(1);
      cmd = cmd[0];
    } else if (typeof cmd === 'object') {
      let command = (Array.isArray(cmd.command) || typeof cmd.command === 'string') ? cmd.command : moduleName(cmd);
      if (cmd.aliases) command = [].concat(command).concat(cmd.aliases);
      self.addHandler(command, extractDesc(cmd), cmd.builder, cmd.handler, cmd.middlewares);
      return
    }

    // allow a module to be provided instead of separate builder and handler
    if (typeof builder === 'object' && builder.builder && typeof builder.handler === 'function') {
      self.addHandler([cmd].concat(aliases), description, builder.builder, builder.handler, builder.middlewares);
      return
    }

    // parse positionals out of cmd string
    const parsedCommand = self.parseCommand(cmd);

    // remove positional args from aliases only
    aliases = aliases.map(alias => self.parseCommand(alias).cmd);

    // check for default and filter out '*''
    let isDefault = false;
    const parsedAliases = [parsedCommand.cmd].concat(aliases).filter((c) => {
      if (DEFAULT_MARKER.test(c)) {
        isDefault = true;
        return false
      }
      return true
    });

    // standardize on $0 for default command.
    if (parsedAliases.length === 0 && isDefault) parsedAliases.push('$0');

    // shift cmd and aliases after filtering out '*'
    if (isDefault) {
      parsedCommand.cmd = parsedAliases[0];
      aliases = parsedAliases.slice(1);
      cmd = cmd.replace(DEFAULT_MARKER, parsedCommand.cmd);
    }

    // populate aliasMap
    aliases.forEach((alias) => {
      aliasMap[alias] = parsedCommand.cmd;
    });

    if (description !== false) {
      usage.command(cmd, description, isDefault, aliases);
    }

    handlers[parsedCommand.cmd] = {
      original: cmd,
      description: description,
      handler,
      builder: builder || {},
      middlewares,
      demanded: parsedCommand.demanded,
      optional: parsedCommand.optional
    };

    if (isDefault) defaultCommand = handlers[parsedCommand.cmd];
  };

  self.addDirectory = function addDirectory (dir, context, req, callerFile, opts) {
    opts = opts || {};
    // disable recursion to support nested directories of subcommands
    if (typeof opts.recurse !== 'boolean') opts.recurse = false;
    // exclude 'json', 'coffee' from require-directory defaults
    if (!Array.isArray(opts.extensions)) opts.extensions = ['js'];
    // allow consumer to define their own visitor function
    const parentVisit = typeof opts.visit === 'function' ? opts.visit : o => o;
    // call addHandler via visitor function
    opts.visit = function visit (obj, joined, filename) {
      const visited = parentVisit(obj, joined, filename);
      // allow consumer to skip modules with their own visitor
      if (visited) {
        // check for cyclic reference
        // each command file path should only be seen once per execution
        if (~context.files.indexOf(joined)) return visited
        // keep track of visited files in context.files
        context.files.push(joined);
        self.addHandler(visited);
      }
      return visited
    };
    requireDirectory_1({ require: req, filename: callerFile }, dir, opts);
  };

  // lookup module object from require()d command and derive name
  // if module was not require()d and no name given, throw error
  function moduleName (obj) {
    const mod = whichModule(obj);
    if (!mod) throw new Error(`No command name given for module: ${inspect(obj)}`)
    return commandFromFilename(mod.filename)
  }

  // derive command name from filename
  function commandFromFilename (filename) {
    return path$2__default.basename(filename, path$2__default.extname(filename))
  }

  function extractDesc (obj) {
    for (let keys = ['describe', 'description', 'desc'], i = 0, l = keys.length, test; i < l; i++) {
      test = obj[keys[i]];
      if (typeof test === 'string' || typeof test === 'boolean') return test
    }
    return false
  }

  self.parseCommand = function parseCommand (cmd) {
    const extraSpacesStrippedCommand = cmd.replace(/\s{2,}/g, ' ');
    const splitCommand = extraSpacesStrippedCommand.split(/\s+(?![^[]*]|[^<]*>)/);
    const bregex = /\.*[\][<>]/g;
    const parsedCommand = {
      cmd: (splitCommand.shift()).replace(bregex, ''),
      demanded: [],
      optional: []
    };
    splitCommand.forEach((cmd, i) => {
      let variadic = false;
      cmd = cmd.replace(/\s/g, '');
      if (/\.+[\]>]/.test(cmd) && i === splitCommand.length - 1) variadic = true;
      if (/^\[/.test(cmd)) {
        parsedCommand.optional.push({
          cmd: cmd.replace(bregex, '').split('|'),
          variadic
        });
      } else {
        parsedCommand.demanded.push({
          cmd: cmd.replace(bregex, '').split('|'),
          variadic
        });
      }
    });
    return parsedCommand
  };

  self.getCommands = () => Object.keys(handlers).concat(Object.keys(aliasMap));

  self.getCommandHandlers = () => handlers;

  self.hasDefaultCommand = () => !!defaultCommand;

  self.runCommand = function runCommand (command, yargs, parsed, commandIndex) {
    let aliases = parsed.aliases;
    const commandHandler = handlers[command] || handlers[aliasMap[command]] || defaultCommand;
    const currentContext = yargs.getContext();
    let numFiles = currentContext.files.length;
    const parentCommands = currentContext.commands.slice();

    // what does yargs look like after the builder is run?
    let innerArgv = parsed.argv;
    let innerYargs = null;
    let positionalMap = {};
    if (command) {
      currentContext.commands.push(command);
      currentContext.fullCommands.push(commandHandler.original);
    }
    if (typeof commandHandler.builder === 'function') {
      // a function can be provided, which builds
      // up a yargs chain and possibly returns it.
      innerYargs = commandHandler.builder(yargs.reset(parsed.aliases));
      if (!innerYargs || (typeof innerYargs._parseArgs !== 'function')) {
        innerYargs = yargs;
      }
      if (shouldUpdateUsage(innerYargs)) {
        innerYargs.getUsageInstance().usage(
          usageFromParentCommandsCommandHandler(parentCommands, commandHandler),
          commandHandler.description
        );
      }
      innerArgv = innerYargs._parseArgs(null, null, true, commandIndex);
      aliases = innerYargs.parsed.aliases;
    } else if (typeof commandHandler.builder === 'object') {
      // as a short hand, an object can instead be provided, specifying
      // the options that a command takes.
      innerYargs = yargs.reset(parsed.aliases);
      if (shouldUpdateUsage(innerYargs)) {
        innerYargs.getUsageInstance().usage(
          usageFromParentCommandsCommandHandler(parentCommands, commandHandler),
          commandHandler.description
        );
      }
      Object.keys(commandHandler.builder).forEach((key) => {
        innerYargs.option(key, commandHandler.builder[key]);
      });
      innerArgv = innerYargs._parseArgs(null, null, true, commandIndex);
      aliases = innerYargs.parsed.aliases;
    }

    if (!yargs._hasOutput()) {
      positionalMap = populatePositionals(commandHandler, innerArgv, currentContext);
    }

    const middlewares = globalMiddleware.slice(0).concat(commandHandler.middlewares);
    applyMiddleware$1(innerArgv, yargs, middlewares, true);

    // we apply validation post-hoc, so that custom
    // checks get passed populated positional arguments.
    if (!yargs._hasOutput()) yargs._runValidation(innerArgv, aliases, positionalMap, yargs.parsed.error);

    if (commandHandler.handler && !yargs._hasOutput()) {
      yargs._setHasOutput();
      // to simplify the parsing of positionals in commands,
      // we temporarily populate '--' rather than _, with arguments
      const populateDoubleDash = !!yargs.getOptions().configuration['populate--'];
      if (!populateDoubleDash) yargs._copyDoubleDash(innerArgv);

      innerArgv = applyMiddleware$1(innerArgv, yargs, middlewares, false);
      let handlerResult;
      if (isPromise(innerArgv)) {
        handlerResult = innerArgv.then(argv => commandHandler.handler(argv));
      } else {
        handlerResult = commandHandler.handler(innerArgv);
      }

      const handlerFinishCommand = yargs.getHandlerFinishCommand();
      if (isPromise(handlerResult)) {
        yargs.getUsageInstance().cacheHelpMessage();
        handlerResult
          .then(value => {
            if (handlerFinishCommand) {
              handlerFinishCommand(value);
            }
          })
          .catch(error => {
            try {
              yargs.getUsageInstance().fail(null, error);
            } catch (err) {
            // fail's throwing would cause an unhandled rejection.
            }
          });
      } else {
        if (handlerFinishCommand) {
          handlerFinishCommand(handlerResult);
        }
      }
    }

    if (command) {
      currentContext.commands.pop();
      currentContext.fullCommands.pop();
    }
    numFiles = currentContext.files.length - numFiles;
    if (numFiles > 0) currentContext.files.splice(numFiles * -1, numFiles);

    return innerArgv
  };

  function shouldUpdateUsage (yargs) {
    return !yargs.getUsageInstance().getUsageDisabled() &&
      yargs.getUsageInstance().getUsage().length === 0
  }

  function usageFromParentCommandsCommandHandler (parentCommands, commandHandler) {
    const c = DEFAULT_MARKER.test(commandHandler.original) ? commandHandler.original.replace(DEFAULT_MARKER, '').trim() : commandHandler.original;
    const pc = parentCommands.filter((c) => { return !DEFAULT_MARKER.test(c) });
    pc.push(c);
    return `$0 ${pc.join(' ')}`
  }

  self.runDefaultBuilderOn = function (yargs) {
    if (shouldUpdateUsage(yargs)) {
      // build the root-level command string from the default string.
      const commandString = DEFAULT_MARKER.test(defaultCommand.original)
        ? defaultCommand.original : defaultCommand.original.replace(/^[^[\]<>]*/, '$0 ');
      yargs.getUsageInstance().usage(
        commandString,
        defaultCommand.description
      );
    }
    const builder = defaultCommand.builder;
    if (typeof builder === 'function') {
      builder(yargs);
    } else {
      Object.keys(builder).forEach((key) => {
        yargs.option(key, builder[key]);
      });
    }
  };

  // transcribe all positional arguments "command <foo> <bar> [apple]"
  // onto argv.
  function populatePositionals (commandHandler, argv, context, yargs) {
    argv._ = argv._.slice(context.commands.length); // nuke the current commands
    const demanded = commandHandler.demanded.slice(0);
    const optional = commandHandler.optional.slice(0);
    const positionalMap = {};

    validation.positionalCount(demanded.length, argv._.length);

    while (demanded.length) {
      const demand = demanded.shift();
      populatePositional(demand, argv, positionalMap);
    }

    while (optional.length) {
      const maybe = optional.shift();
      populatePositional(maybe, argv, positionalMap);
    }

    argv._ = context.commands.concat(argv._);

    postProcessPositionals(argv, positionalMap, self.cmdToParseOptions(commandHandler.original));

    return positionalMap
  }

  function populatePositional (positional, argv, positionalMap, parseOptions) {
    const cmd = positional.cmd[0];
    if (positional.variadic) {
      positionalMap[cmd] = argv._.splice(0).map(String);
    } else {
      if (argv._.length) positionalMap[cmd] = [String(argv._.shift())];
    }
  }

  // we run yargs-parser against the positional arguments
  // applying the same parsing logic used for flags.
  function postProcessPositionals (argv, positionalMap, parseOptions) {
    // combine the parsing hints we've inferred from the command
    // string with explicitly configured parsing hints.
    const options = Object.assign({}, yargs.getOptions());
    options.default = Object.assign(parseOptions.default, options.default);
    options.alias = Object.assign(parseOptions.alias, options.alias);
    options.array = options.array.concat(parseOptions.array);
    delete options.config; //  don't load config when processing positionals.

    const unparsed = [];
    Object.keys(positionalMap).forEach((key) => {
      positionalMap[key].map((value) => {
        if (options.configuration['unknown-options-as-args']) options.key[key] = true;
        unparsed.push(`--${key}`);
        unparsed.push(value);
      });
    });

    // short-circuit parse.
    if (!unparsed.length) return

    const config = Object.assign({}, options.configuration, {
      'populate--': true
    });
    const parsed = yargsParser.detailed(unparsed, Object.assign({}, options, {
      configuration: config
    }));

    if (parsed.error) {
      yargs.getUsageInstance().fail(parsed.error.message, parsed.error);
    } else {
      // only copy over positional keys (don't overwrite
      // flag arguments that were already parsed).
      const positionalKeys = Object.keys(positionalMap);
      Object.keys(positionalMap).forEach((key) => {
        [].push.apply(positionalKeys, parsed.aliases[key]);
      });

      Object.keys(parsed.argv).forEach((key) => {
        if (positionalKeys.indexOf(key) !== -1) {
          // any new aliases need to be placed in positionalMap, which
          // is used for validation.
          if (!positionalMap[key]) positionalMap[key] = parsed.argv[key];
          argv[key] = parsed.argv[key];
        }
      });
    }
  }

  self.cmdToParseOptions = function (cmdString) {
    const parseOptions = {
      array: [],
      default: {},
      alias: {},
      demand: {}
    };

    const parsed = self.parseCommand(cmdString);
    parsed.demanded.forEach((d) => {
      const cmds = d.cmd.slice(0);
      const cmd = cmds.shift();
      if (d.variadic) {
        parseOptions.array.push(cmd);
        parseOptions.default[cmd] = [];
      }
      cmds.forEach((c) => {
        parseOptions.alias[cmd] = c;
      });
      parseOptions.demand[cmd] = true;
    });

    parsed.optional.forEach((o) => {
      const cmds = o.cmd.slice(0);
      const cmd = cmds.shift();
      if (o.variadic) {
        parseOptions.array.push(cmd);
        parseOptions.default[cmd] = [];
      }
      cmds.forEach((c) => {
        parseOptions.alias[cmd] = c;
      });
    });

    return parseOptions
  };

  self.reset = () => {
    handlers = {};
    aliasMap = {};
    defaultCommand = undefined;
    return self
  };

  // used by yargs.parse() to freeze
  // the state of commands such that
  // we can apply .parse() multiple times
  // with the same yargs instance.
  let frozens = [];
  self.freeze = () => {
    let frozen = {};
    frozens.push(frozen);
    frozen.handlers = handlers;
    frozen.aliasMap = aliasMap;
    frozen.defaultCommand = defaultCommand;
  };
  self.unfreeze = () => {
    let frozen = frozens.pop();
    handlers = frozen.handlers;
    aliasMap = frozen.aliasMap;
    defaultCommand = frozen.defaultCommand;
  };

  return self
};

function YError (msg) {
  this.name = 'YError';
  this.message = msg || 'yargs error';
  Error.captureStackTrace(this, YError);
}

YError.prototype = Object.create(Error.prototype);
YError.prototype.constructor = YError;

var yerror = YError;

// hoisted due to circular dependency on command.
var argsert_1 = argsert;
const command$1 = command();


const positionName = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
function argsert (expected, callerArguments, length) {
  // TODO: should this eventually raise an exception.
  try {
    // preface the argument description with "cmd", so
    // that we can run it through yargs' command parser.
    let position = 0;
    let parsed = { demanded: [], optional: [] };
    if (typeof expected === 'object') {
      length = callerArguments;
      callerArguments = expected;
    } else {
      parsed = command$1.parseCommand(`cmd ${expected}`);
    }
    const args = [].slice.call(callerArguments);

    while (args.length && args[args.length - 1] === undefined) args.pop();
    length = length || args.length;

    if (length < parsed.demanded.length) {
      throw new yerror(`Not enough arguments provided. Expected ${parsed.demanded.length} but received ${args.length}.`)
    }

    const totalCommands = parsed.demanded.length + parsed.optional.length;
    if (length > totalCommands) {
      throw new yerror(`Too many arguments provided. Expected max ${totalCommands} but received ${length}.`)
    }

    parsed.demanded.forEach((demanded) => {
      const arg = args.shift();
      const observedType = guessType(arg);
      const matchingTypes = demanded.cmd.filter(type => type === observedType || type === '*');
      if (matchingTypes.length === 0) argumentTypeError(observedType, demanded.cmd, position, false);
      position += 1;
    });

    parsed.optional.forEach((optional) => {
      if (args.length === 0) return
      const arg = args.shift();
      const observedType = guessType(arg);
      const matchingTypes = optional.cmd.filter(type => type === observedType || type === '*');
      if (matchingTypes.length === 0) argumentTypeError(observedType, optional.cmd, position, true);
      position += 1;
    });
  } catch (err) {
    console.warn(err.stack);
  }
}

function guessType (arg) {
  if (Array.isArray(arg)) {
    return 'array'
  } else if (arg === null) {
    return 'null'
  }
  return typeof arg
}

function argumentTypeError (observedType, allowedTypes, position, optional) {
  throw new yerror(`Invalid ${positionName[position] || 'manyith'} argument. Expected ${allowedTypes.join(' or ')} but received ${observedType}.`)
}

var completionShTemplate =
`###-begin-{{app_name}}-completions-###
#
# yargs command completion script
#
# Installation: {{app_path}} {{completion_command}} >> ~/.bashrc
#    or {{app_path}} {{completion_command}} >> ~/.bash_profile on OSX.
#
_yargs_completions()
{
    local cur_word args type_list

    cur_word="\${COMP_WORDS[COMP_CWORD]}"
    args=("\${COMP_WORDS[@]}")

    # ask yargs to generate completions.
    type_list=$({{app_path}} --get-yargs-completions "\${args[@]}")

    COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )

    # if no match was found, fall back to filename completion
    if [ \${#COMPREPLY[@]} -eq 0 ]; then
      COMPREPLY=()
    fi

    return 0
}
complete -o default -F _yargs_completions {{app_name}}
###-end-{{app_name}}-completions-###
`;

var completionZshTemplate = `###-begin-{{app_name}}-completions-###
#
# yargs command completion script
#
# Installation: {{app_path}} {{completion_command}} >> ~/.zshrc
#    or {{app_path}} {{completion_command}} >> ~/.zsh_profile on OSX.
#
_{{app_name}}_yargs_completions()
{
  local reply
  local si=$IFS
  IFS=$'\n' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" {{app_path}} --get-yargs-completions "\${words[@]}"))
  IFS=$si
  _describe 'values' reply
}
compdef _{{app_name}}_yargs_completions {{app_name}}
###-end-{{app_name}}-completions-###
`;

var completionTemplates = {
	completionShTemplate: completionShTemplate,
	completionZshTemplate: completionZshTemplate
};

// add bash completions to your
//  yargs-powered applications.
var completion = function completion (yargs, usage, command) {
  const self = {
    completionKey: 'get-yargs-completions'
  };

  let aliases;
  self.setParsed = function setParsed (parsed) {
    aliases = parsed.aliases;
  };

  const zshShell = (process.env.SHELL && process.env.SHELL.indexOf('zsh') !== -1) ||
    (process.env.ZSH_NAME && process.env.ZSH_NAME.indexOf('zsh') !== -1);
  // get a list of completion commands.
  // 'args' is the array of strings from the line to be completed
  self.getCompletion = function getCompletion (args, done) {
    const completions = [];
    const current = args.length ? args[args.length - 1] : '';
    const argv = yargs.parse(args, true);
    const parentCommands = yargs.getContext().commands;

    // a custom completion function can be provided
    // to completion().
    if (completionFunction) {
      if (completionFunction.length < 3) {
        const result = completionFunction(current, argv);

        // promise based completion function.
        if (typeof result.then === 'function') {
          return result.then((list) => {
            process.nextTick(() => { done(list); });
          }).catch((err) => {
            process.nextTick(() => { throw err });
          })
        }

        // synchronous completion function.
        return done(result)
      } else {
        // asynchronous completion function
        return completionFunction(current, argv, (completions) => {
          done(completions);
        })
      }
    }

    const handlers = command.getCommandHandlers();
    for (let i = 0, ii = args.length; i < ii; ++i) {
      if (handlers[args[i]] && handlers[args[i]].builder) {
        const builder = handlers[args[i]].builder;
        if (typeof builder === 'function') {
          const y = yargs.reset();
          builder(y);
          return y.argv
        }
      }
    }

    if (!current.match(/^-/) && parentCommands[parentCommands.length - 1] !== current) {
      usage.getCommands().forEach((usageCommand) => {
        const commandName = command.parseCommand(usageCommand[0]).cmd;
        if (args.indexOf(commandName) === -1) {
          if (!zshShell) {
            completions.push(commandName);
          } else {
            const desc = usageCommand[1] || '';
            completions.push(commandName.replace(/:/g, '\\:') + ':' + desc);
          }
        }
      });
    }

    if (current.match(/^-/) || (current === '' && completions.length === 0)) {
      const descs = usage.getDescriptions();
      Object.keys(yargs.getOptions().key).forEach((key) => {
        // If the key and its aliases aren't in 'args', add the key to 'completions'
        const keyAndAliases = [key].concat(aliases[key] || []);
        const notInArgs = keyAndAliases.every(val => args.indexOf(`--${val}`) === -1);
        if (notInArgs) {
          const startsByTwoDashes = s => /^--/.test(s);
          const isShortOption = s => /^[^0-9]$/.test(s);
          const dashes = !startsByTwoDashes(current) && isShortOption(key) ? '-' : '--';
          if (!zshShell) {
            completions.push(dashes + key);
          } else {
            const desc = descs[key] || '';
            completions.push(dashes + `${key.replace(/:/g, '\\:')}:${desc.replace('__yargsString__:', '')}`);
          }
        }
      });
    }

    done(completions);
  };

  // generate the completion script to add to your .bashrc.
  self.generateCompletionScript = function generateCompletionScript ($0, cmd) {
    const templates = completionTemplates;
    let script = zshShell ? templates.completionZshTemplate : templates.completionShTemplate;
    const name = path$2__default.basename($0);

    // add ./to applications not yet installed as bin.
    if ($0.match(/\.js$/)) $0 = `./${$0}`;

    script = script.replace(/{{app_name}}/g, name);
    script = script.replace(/{{completion_command}}/g, cmd);
    return script.replace(/{{app_path}}/g, $0)
  };

  // register a function to perform your own custom
  // completions., this function can be either
  // synchrnous or asynchronous.
  let completionFunction = null;
  self.registerFunction = (fn) => {
    completionFunction = fn;
  };

  return self
};

var ansiRegex = ({onlyFirst = false} = {}) => {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
	].join('|');

	return new RegExp(pattern, onlyFirst ? undefined : 'g');
};

var stripAnsi = string => typeof string === 'string' ? string.replace(ansiRegex(), '') : string;

/* eslint-disable yoda */

const isFullwidthCodePoint = codePoint => {
	if (Number.isNaN(codePoint)) {
		return false;
	}

	// Code points are derived from:
	// http://www.unix.org/Public/UNIDATA/EastAsianWidth.txt
	if (
		codePoint >= 0x1100 && (
			codePoint <= 0x115F || // Hangul Jamo
			codePoint === 0x2329 || // LEFT-POINTING ANGLE BRACKET
			codePoint === 0x232A || // RIGHT-POINTING ANGLE BRACKET
			// CJK Radicals Supplement .. Enclosed CJK Letters and Months
			(0x2E80 <= codePoint && codePoint <= 0x3247 && codePoint !== 0x303F) ||
			// Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
			(0x3250 <= codePoint && codePoint <= 0x4DBF) ||
			// CJK Unified Ideographs .. Yi Radicals
			(0x4E00 <= codePoint && codePoint <= 0xA4C6) ||
			// Hangul Jamo Extended-A
			(0xA960 <= codePoint && codePoint <= 0xA97C) ||
			// Hangul Syllables
			(0xAC00 <= codePoint && codePoint <= 0xD7A3) ||
			// CJK Compatibility Ideographs
			(0xF900 <= codePoint && codePoint <= 0xFAFF) ||
			// Vertical Forms
			(0xFE10 <= codePoint && codePoint <= 0xFE19) ||
			// CJK Compatibility Forms .. Small Form Variants
			(0xFE30 <= codePoint && codePoint <= 0xFE6B) ||
			// Halfwidth and Fullwidth Forms
			(0xFF01 <= codePoint && codePoint <= 0xFF60) ||
			(0xFFE0 <= codePoint && codePoint <= 0xFFE6) ||
			// Kana Supplement
			(0x1B000 <= codePoint && codePoint <= 0x1B001) ||
			// Enclosed Ideographic Supplement
			(0x1F200 <= codePoint && codePoint <= 0x1F251) ||
			// CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
			(0x20000 <= codePoint && codePoint <= 0x3FFFD)
		)
	) {
		return true;
	}

	return false;
};

var isFullwidthCodePoint_1 = isFullwidthCodePoint;
var default_1$1 = isFullwidthCodePoint;
isFullwidthCodePoint_1.default = default_1$1;

var emojiRegex = function () {
  // https://mths.be/emoji
  return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
};

const stringWidth = string => {
	string = string.replace(emojiRegex(), '  ');

	if (typeof string !== 'string' || string.length === 0) {
		return 0;
	}

	string = stripAnsi(string);

	let width = 0;

	for (let i = 0; i < string.length; i++) {
		const code = string.codePointAt(i);

		// Ignore control characters
		if (code <= 0x1F || (code >= 0x7F && code <= 0x9F)) {
			continue;
		}

		// Ignore combining characters
		if (code >= 0x300 && code <= 0x36F) {
			continue;
		}

		// Surrogates
		if (code > 0xFFFF) {
			i++;
		}

		width += isFullwidthCodePoint_1(code) ? 2 : 1;
	}

	return width;
};

var stringWidth_1 = stringWidth;
// TODO: remove this in the next major version
var default_1$2 = stringWidth;
stringWidth_1.default = default_1$2;

var objFilter = function objFilter (original, filter) {
  const obj = {};
  filter = filter || ((k, v) => true);
  Object.keys(original || {}).forEach((key) => {
    if (filter(key, original[key])) {
      obj[key] = original[key];
    }
  });
  return obj
};

var setBlocking = function (blocking) {
  [process.stdout, process.stderr].forEach(function (stream) {
    if (stream._handle && stream.isTTY && typeof stream._handle.setBlocking === 'function') {
      stream._handle.setBlocking(blocking);
    }
  });
};

var ansiRegex$1 = ({onlyFirst = false} = {}) => {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
	].join('|');

	return new RegExp(pattern, onlyFirst ? undefined : 'g');
};

var stripAnsi$1 = string => typeof string === 'string' ? string.replace(ansiRegex$1(), '') : string;

var ansiRegex$2 = ({onlyFirst = false} = {}) => {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
	].join('|');

	return new RegExp(pattern, onlyFirst ? undefined : 'g');
};

var stripAnsi$2 = string => typeof string === 'string' ? string.replace(ansiRegex$2(), '') : string;

var colorName = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};

/* MIT license */
/* eslint-disable no-mixed-operators */


// NOTE: conversions should only return primitive values (i.e. arrays, or
//       values that give correct `typeof` results).
//       do not use box values types (i.e. Number(), String(), etc.)

const reverseKeywords = {};
for (const key of Object.keys(colorName)) {
	reverseKeywords[colorName[key]] = key;
}

const convert = {
	rgb: {channels: 3, labels: 'rgb'},
	hsl: {channels: 3, labels: 'hsl'},
	hsv: {channels: 3, labels: 'hsv'},
	hwb: {channels: 3, labels: 'hwb'},
	cmyk: {channels: 4, labels: 'cmyk'},
	xyz: {channels: 3, labels: 'xyz'},
	lab: {channels: 3, labels: 'lab'},
	lch: {channels: 3, labels: 'lch'},
	hex: {channels: 1, labels: ['hex']},
	keyword: {channels: 1, labels: ['keyword']},
	ansi16: {channels: 1, labels: ['ansi16']},
	ansi256: {channels: 1, labels: ['ansi256']},
	hcg: {channels: 3, labels: ['h', 'c', 'g']},
	apple: {channels: 3, labels: ['r16', 'g16', 'b16']},
	gray: {channels: 1, labels: ['gray']}
};

var conversions = convert;

// Hide .channels and .labels properties
for (const model of Object.keys(convert)) {
	if (!('channels' in convert[model])) {
		throw new Error('missing channels property: ' + model);
	}

	if (!('labels' in convert[model])) {
		throw new Error('missing channel labels property: ' + model);
	}

	if (convert[model].labels.length !== convert[model].channels) {
		throw new Error('channel and label counts mismatch: ' + model);
	}

	const {channels, labels} = convert[model];
	delete convert[model].channels;
	delete convert[model].labels;
	Object.defineProperty(convert[model], 'channels', {value: channels});
	Object.defineProperty(convert[model], 'labels', {value: labels});
}

convert.rgb.hsl = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const min = Math.min(r, g, b);
	const max = Math.max(r, g, b);
	const delta = max - min;
	let h;
	let s;

	if (max === min) {
		h = 0;
	} else if (r === max) {
		h = (g - b) / delta;
	} else if (g === max) {
		h = 2 + (b - r) / delta;
	} else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	const l = (min + max) / 2;

	if (max === min) {
		s = 0;
	} else if (l <= 0.5) {
		s = delta / (max + min);
	} else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};

convert.rgb.hsv = function (rgb) {
	let rdif;
	let gdif;
	let bdif;
	let h;
	let s;

	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const v = Math.max(r, g, b);
	const diff = v - Math.min(r, g, b);
	const diffc = function (c) {
		return (v - c) / 6 / diff + 1 / 2;
	};

	if (diff === 0) {
		h = 0;
		s = 0;
	} else {
		s = diff / v;
		rdif = diffc(r);
		gdif = diffc(g);
		bdif = diffc(b);

		if (r === v) {
			h = bdif - gdif;
		} else if (g === v) {
			h = (1 / 3) + rdif - bdif;
		} else if (b === v) {
			h = (2 / 3) + gdif - rdif;
		}

		if (h < 0) {
			h += 1;
		} else if (h > 1) {
			h -= 1;
		}
	}

	return [
		h * 360,
		s * 100,
		v * 100
	];
};

convert.rgb.hwb = function (rgb) {
	const r = rgb[0];
	const g = rgb[1];
	let b = rgb[2];
	const h = convert.rgb.hsl(rgb)[0];
	const w = 1 / 255 * Math.min(r, Math.min(g, b));

	b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

	return [h, w * 100, b * 100];
};

convert.rgb.cmyk = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;

	const k = Math.min(1 - r, 1 - g, 1 - b);
	const c = (1 - r - k) / (1 - k) || 0;
	const m = (1 - g - k) / (1 - k) || 0;
	const y = (1 - b - k) / (1 - k) || 0;

	return [c * 100, m * 100, y * 100, k * 100];
};

function comparativeDistance(x, y) {
	/*
		See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
	*/
	return (
		((x[0] - y[0]) ** 2) +
		((x[1] - y[1]) ** 2) +
		((x[2] - y[2]) ** 2)
	);
}

convert.rgb.keyword = function (rgb) {
	const reversed = reverseKeywords[rgb];
	if (reversed) {
		return reversed;
	}

	let currentClosestDistance = Infinity;
	let currentClosestKeyword;

	for (const keyword of Object.keys(colorName)) {
		const value = colorName[keyword];

		// Compute comparative distance
		const distance = comparativeDistance(rgb, value);

		// Check if its less, if so set as closest
		if (distance < currentClosestDistance) {
			currentClosestDistance = distance;
			currentClosestKeyword = keyword;
		}
	}

	return currentClosestKeyword;
};

convert.keyword.rgb = function (keyword) {
	return colorName[keyword];
};

convert.rgb.xyz = function (rgb) {
	let r = rgb[0] / 255;
	let g = rgb[1] / 255;
	let b = rgb[2] / 255;

	// Assume sRGB
	r = r > 0.04045 ? (((r + 0.055) / 1.055) ** 2.4) : (r / 12.92);
	g = g > 0.04045 ? (((g + 0.055) / 1.055) ** 2.4) : (g / 12.92);
	b = b > 0.04045 ? (((b + 0.055) / 1.055) ** 2.4) : (b / 12.92);

	const x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
	const y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
	const z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

	return [x * 100, y * 100, z * 100];
};

convert.rgb.lab = function (rgb) {
	const xyz = convert.rgb.xyz(rgb);
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.hsl.rgb = function (hsl) {
	const h = hsl[0] / 360;
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;
	let t2;
	let t3;
	let val;

	if (s === 0) {
		val = l * 255;
		return [val, val, val];
	}

	if (l < 0.5) {
		t2 = l * (1 + s);
	} else {
		t2 = l + s - l * s;
	}

	const t1 = 2 * l - t2;

	const rgb = [0, 0, 0];
	for (let i = 0; i < 3; i++) {
		t3 = h + 1 / 3 * -(i - 1);
		if (t3 < 0) {
			t3++;
		}

		if (t3 > 1) {
			t3--;
		}

		if (6 * t3 < 1) {
			val = t1 + (t2 - t1) * 6 * t3;
		} else if (2 * t3 < 1) {
			val = t2;
		} else if (3 * t3 < 2) {
			val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
		} else {
			val = t1;
		}

		rgb[i] = val * 255;
	}

	return rgb;
};

convert.hsl.hsv = function (hsl) {
	const h = hsl[0];
	let s = hsl[1] / 100;
	let l = hsl[2] / 100;
	let smin = s;
	const lmin = Math.max(l, 0.01);

	l *= 2;
	s *= (l <= 1) ? l : 2 - l;
	smin *= lmin <= 1 ? lmin : 2 - lmin;
	const v = (l + s) / 2;
	const sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);

	return [h, sv * 100, v * 100];
};

convert.hsv.rgb = function (hsv) {
	const h = hsv[0] / 60;
	const s = hsv[1] / 100;
	let v = hsv[2] / 100;
	const hi = Math.floor(h) % 6;

	const f = h - Math.floor(h);
	const p = 255 * v * (1 - s);
	const q = 255 * v * (1 - (s * f));
	const t = 255 * v * (1 - (s * (1 - f)));
	v *= 255;

	switch (hi) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}
};

convert.hsv.hsl = function (hsv) {
	const h = hsv[0];
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;
	const vmin = Math.max(v, 0.01);
	let sl;
	let l;

	l = (2 - s) * v;
	const lmin = (2 - s) * vmin;
	sl = s * vmin;
	sl /= (lmin <= 1) ? lmin : 2 - lmin;
	sl = sl || 0;
	l /= 2;

	return [h, sl * 100, l * 100];
};

// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
convert.hwb.rgb = function (hwb) {
	const h = hwb[0] / 360;
	let wh = hwb[1] / 100;
	let bl = hwb[2] / 100;
	const ratio = wh + bl;
	let f;

	// Wh + bl cant be > 1
	if (ratio > 1) {
		wh /= ratio;
		bl /= ratio;
	}

	const i = Math.floor(6 * h);
	const v = 1 - bl;
	f = 6 * h - i;

	if ((i & 0x01) !== 0) {
		f = 1 - f;
	}

	const n = wh + f * (v - wh); // Linear interpolation

	let r;
	let g;
	let b;
	/* eslint-disable max-statements-per-line,no-multi-spaces */
	switch (i) {
		default:
		case 6:
		case 0: r = v;  g = n;  b = wh; break;
		case 1: r = n;  g = v;  b = wh; break;
		case 2: r = wh; g = v;  b = n; break;
		case 3: r = wh; g = n;  b = v; break;
		case 4: r = n;  g = wh; b = v; break;
		case 5: r = v;  g = wh; b = n; break;
	}
	/* eslint-enable max-statements-per-line,no-multi-spaces */

	return [r * 255, g * 255, b * 255];
};

convert.cmyk.rgb = function (cmyk) {
	const c = cmyk[0] / 100;
	const m = cmyk[1] / 100;
	const y = cmyk[2] / 100;
	const k = cmyk[3] / 100;

	const r = 1 - Math.min(1, c * (1 - k) + k);
	const g = 1 - Math.min(1, m * (1 - k) + k);
	const b = 1 - Math.min(1, y * (1 - k) + k);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.rgb = function (xyz) {
	const x = xyz[0] / 100;
	const y = xyz[1] / 100;
	const z = xyz[2] / 100;
	let r;
	let g;
	let b;

	r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
	g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
	b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

	// Assume sRGB
	r = r > 0.0031308
		? ((1.055 * (r ** (1.0 / 2.4))) - 0.055)
		: r * 12.92;

	g = g > 0.0031308
		? ((1.055 * (g ** (1.0 / 2.4))) - 0.055)
		: g * 12.92;

	b = b > 0.0031308
		? ((1.055 * (b ** (1.0 / 2.4))) - 0.055)
		: b * 12.92;

	r = Math.min(Math.max(0, r), 1);
	g = Math.min(Math.max(0, g), 1);
	b = Math.min(Math.max(0, b), 1);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.lab = function (xyz) {
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.lab.xyz = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let x;
	let y;
	let z;

	y = (l + 16) / 116;
	x = a / 500 + y;
	z = y - b / 200;

	const y2 = y ** 3;
	const x2 = x ** 3;
	const z2 = z ** 3;
	y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
	x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
	z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;

	x *= 95.047;
	y *= 100;
	z *= 108.883;

	return [x, y, z];
};

convert.lab.lch = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let h;

	const hr = Math.atan2(b, a);
	h = hr * 360 / 2 / Math.PI;

	if (h < 0) {
		h += 360;
	}

	const c = Math.sqrt(a * a + b * b);

	return [l, c, h];
};

convert.lch.lab = function (lch) {
	const l = lch[0];
	const c = lch[1];
	const h = lch[2];

	const hr = h / 360 * 2 * Math.PI;
	const a = c * Math.cos(hr);
	const b = c * Math.sin(hr);

	return [l, a, b];
};

convert.rgb.ansi16 = function (args, saturation = null) {
	const [r, g, b] = args;
	let value = saturation === null ? convert.rgb.hsv(args)[2] : saturation; // Hsv -> ansi16 optimization

	value = Math.round(value / 50);

	if (value === 0) {
		return 30;
	}

	let ansi = 30
		+ ((Math.round(b / 255) << 2)
		| (Math.round(g / 255) << 1)
		| Math.round(r / 255));

	if (value === 2) {
		ansi += 60;
	}

	return ansi;
};

convert.hsv.ansi16 = function (args) {
	// Optimization here; we already know the value and don't need to get
	// it converted for us.
	return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
};

convert.rgb.ansi256 = function (args) {
	const r = args[0];
	const g = args[1];
	const b = args[2];

	// We use the extended greyscale palette here, with the exception of
	// black and white. normal palette only has 4 greyscale shades.
	if (r === g && g === b) {
		if (r < 8) {
			return 16;
		}

		if (r > 248) {
			return 231;
		}

		return Math.round(((r - 8) / 247) * 24) + 232;
	}

	const ansi = 16
		+ (36 * Math.round(r / 255 * 5))
		+ (6 * Math.round(g / 255 * 5))
		+ Math.round(b / 255 * 5);

	return ansi;
};

convert.ansi16.rgb = function (args) {
	let color = args % 10;

	// Handle greyscale
	if (color === 0 || color === 7) {
		if (args > 50) {
			color += 3.5;
		}

		color = color / 10.5 * 255;

		return [color, color, color];
	}

	const mult = (~~(args > 50) + 1) * 0.5;
	const r = ((color & 1) * mult) * 255;
	const g = (((color >> 1) & 1) * mult) * 255;
	const b = (((color >> 2) & 1) * mult) * 255;

	return [r, g, b];
};

convert.ansi256.rgb = function (args) {
	// Handle greyscale
	if (args >= 232) {
		const c = (args - 232) * 10 + 8;
		return [c, c, c];
	}

	args -= 16;

	let rem;
	const r = Math.floor(args / 36) / 5 * 255;
	const g = Math.floor((rem = args % 36) / 6) / 5 * 255;
	const b = (rem % 6) / 5 * 255;

	return [r, g, b];
};

convert.rgb.hex = function (args) {
	const integer = ((Math.round(args[0]) & 0xFF) << 16)
		+ ((Math.round(args[1]) & 0xFF) << 8)
		+ (Math.round(args[2]) & 0xFF);

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.hex.rgb = function (args) {
	const match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
	if (!match) {
		return [0, 0, 0];
	}

	let colorString = match[0];

	if (match[0].length === 3) {
		colorString = colorString.split('').map(char => {
			return char + char;
		}).join('');
	}

	const integer = parseInt(colorString, 16);
	const r = (integer >> 16) & 0xFF;
	const g = (integer >> 8) & 0xFF;
	const b = integer & 0xFF;

	return [r, g, b];
};

convert.rgb.hcg = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const max = Math.max(Math.max(r, g), b);
	const min = Math.min(Math.min(r, g), b);
	const chroma = (max - min);
	let grayscale;
	let hue;

	if (chroma < 1) {
		grayscale = min / (1 - chroma);
	} else {
		grayscale = 0;
	}

	if (chroma <= 0) {
		hue = 0;
	} else
	if (max === r) {
		hue = ((g - b) / chroma) % 6;
	} else
	if (max === g) {
		hue = 2 + (b - r) / chroma;
	} else {
		hue = 4 + (r - g) / chroma;
	}

	hue /= 6;
	hue %= 1;

	return [hue * 360, chroma * 100, grayscale * 100];
};

convert.hsl.hcg = function (hsl) {
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;

	const c = l < 0.5 ? (2.0 * s * l) : (2.0 * s * (1.0 - l));

	let f = 0;
	if (c < 1.0) {
		f = (l - 0.5 * c) / (1.0 - c);
	}

	return [hsl[0], c * 100, f * 100];
};

convert.hsv.hcg = function (hsv) {
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;

	const c = s * v;
	let f = 0;

	if (c < 1.0) {
		f = (v - c) / (1 - c);
	}

	return [hsv[0], c * 100, f * 100];
};

convert.hcg.rgb = function (hcg) {
	const h = hcg[0] / 360;
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	if (c === 0.0) {
		return [g * 255, g * 255, g * 255];
	}

	const pure = [0, 0, 0];
	const hi = (h % 1) * 6;
	const v = hi % 1;
	const w = 1 - v;
	let mg = 0;

	/* eslint-disable max-statements-per-line */
	switch (Math.floor(hi)) {
		case 0:
			pure[0] = 1; pure[1] = v; pure[2] = 0; break;
		case 1:
			pure[0] = w; pure[1] = 1; pure[2] = 0; break;
		case 2:
			pure[0] = 0; pure[1] = 1; pure[2] = v; break;
		case 3:
			pure[0] = 0; pure[1] = w; pure[2] = 1; break;
		case 4:
			pure[0] = v; pure[1] = 0; pure[2] = 1; break;
		default:
			pure[0] = 1; pure[1] = 0; pure[2] = w;
	}
	/* eslint-enable max-statements-per-line */

	mg = (1.0 - c) * g;

	return [
		(c * pure[0] + mg) * 255,
		(c * pure[1] + mg) * 255,
		(c * pure[2] + mg) * 255
	];
};

convert.hcg.hsv = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const v = c + g * (1.0 - c);
	let f = 0;

	if (v > 0.0) {
		f = c / v;
	}

	return [hcg[0], f * 100, v * 100];
};

convert.hcg.hsl = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const l = g * (1.0 - c) + 0.5 * c;
	let s = 0;

	if (l > 0.0 && l < 0.5) {
		s = c / (2 * l);
	} else
	if (l >= 0.5 && l < 1.0) {
		s = c / (2 * (1 - l));
	}

	return [hcg[0], s * 100, l * 100];
};

convert.hcg.hwb = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;
	const v = c + g * (1.0 - c);
	return [hcg[0], (v - c) * 100, (1 - v) * 100];
};

convert.hwb.hcg = function (hwb) {
	const w = hwb[1] / 100;
	const b = hwb[2] / 100;
	const v = 1 - b;
	const c = v - w;
	let g = 0;

	if (c < 1) {
		g = (v - c) / (1 - c);
	}

	return [hwb[0], c * 100, g * 100];
};

convert.apple.rgb = function (apple) {
	return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
};

convert.rgb.apple = function (rgb) {
	return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
};

convert.gray.rgb = function (args) {
	return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
};

convert.gray.hsl = function (args) {
	return [0, 0, args[0]];
};

convert.gray.hsv = convert.gray.hsl;

convert.gray.hwb = function (gray) {
	return [0, 100, gray[0]];
};

convert.gray.cmyk = function (gray) {
	return [0, 0, 0, gray[0]];
};

convert.gray.lab = function (gray) {
	return [gray[0], 0, 0];
};

convert.gray.hex = function (gray) {
	const val = Math.round(gray[0] / 100 * 255) & 0xFF;
	const integer = (val << 16) + (val << 8) + val;

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.rgb.gray = function (rgb) {
	const val = (rgb[0] + rgb[1] + rgb[2]) / 3;
	return [val / 255 * 100];
};

/*
	This function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/

function buildGraph() {
	const graph = {};
	// https://jsperf.com/object-keys-vs-for-in-with-closure/3
	const models = Object.keys(conversions);

	for (let len = models.length, i = 0; i < len; i++) {
		graph[models[i]] = {
			// http://jsperf.com/1-vs-infinity
			// micro-opt, but this is simple.
			distance: -1,
			parent: null
		};
	}

	return graph;
}

// https://en.wikipedia.org/wiki/Breadth-first_search
function deriveBFS(fromModel) {
	const graph = buildGraph();
	const queue = [fromModel]; // Unshift -> queue -> pop

	graph[fromModel].distance = 0;

	while (queue.length) {
		const current = queue.pop();
		const adjacents = Object.keys(conversions[current]);

		for (let len = adjacents.length, i = 0; i < len; i++) {
			const adjacent = adjacents[i];
			const node = graph[adjacent];

			if (node.distance === -1) {
				node.distance = graph[current].distance + 1;
				node.parent = current;
				queue.unshift(adjacent);
			}
		}
	}

	return graph;
}

function link(from, to) {
	return function (args) {
		return to(from(args));
	};
}

function wrapConversion(toModel, graph) {
	const path = [graph[toModel].parent, toModel];
	let fn = conversions[graph[toModel].parent][toModel];

	let cur = graph[toModel].parent;
	while (graph[cur].parent) {
		path.unshift(graph[cur].parent);
		fn = link(conversions[graph[cur].parent][cur], fn);
		cur = graph[cur].parent;
	}

	fn.conversion = path;
	return fn;
}

var route = function (fromModel) {
	const graph = deriveBFS(fromModel);
	const conversion = {};

	const models = Object.keys(graph);
	for (let len = models.length, i = 0; i < len; i++) {
		const toModel = models[i];
		const node = graph[toModel];

		if (node.parent === null) {
			// No possible conversion, or this node is the source model.
			continue;
		}

		conversion[toModel] = wrapConversion(toModel, graph);
	}

	return conversion;
};

const convert$1 = {};

const models = Object.keys(conversions);

function wrapRaw(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];
		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		return fn(args);
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

function wrapRounded(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];

		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		const result = fn(args);

		// We're assuming the result is an array here.
		// see notice in conversions.js; don't use box types
		// in conversion functions.
		if (typeof result === 'object') {
			for (let len = result.length, i = 0; i < len; i++) {
				result[i] = Math.round(result[i]);
			}
		}

		return result;
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

models.forEach(fromModel => {
	convert$1[fromModel] = {};

	Object.defineProperty(convert$1[fromModel], 'channels', {value: conversions[fromModel].channels});
	Object.defineProperty(convert$1[fromModel], 'labels', {value: conversions[fromModel].labels});

	const routes = route(fromModel);
	const routeModels = Object.keys(routes);

	routeModels.forEach(toModel => {
		const fn = routes[toModel];

		convert$1[fromModel][toModel] = wrapRounded(fn);
		convert$1[fromModel][toModel].raw = wrapRaw(fn);
	});
});

var colorConvert = convert$1;

var ansiStyles = logger$2.createCommonjsModule(function (module) {

const wrapAnsi16 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${code + offset}m`;
};

const wrapAnsi256 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${38 + offset};5;${code}m`;
};

const wrapAnsi16m = (fn, offset) => (...args) => {
	const rgb = fn(...args);
	return `\u001B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
};

const ansi2ansi = n => n;
const rgb2rgb = (r, g, b) => [r, g, b];

const setLazyProperty = (object, property, get) => {
	Object.defineProperty(object, property, {
		get: () => {
			const value = get();

			Object.defineProperty(object, property, {
				value,
				enumerable: true,
				configurable: true
			});

			return value;
		},
		enumerable: true,
		configurable: true
	});
};

/** @type {typeof import('color-convert')} */
let colorConvert$1;
const makeDynamicStyles = (wrap, targetSpace, identity, isBackground) => {
	if (colorConvert$1 === undefined) {
		colorConvert$1 = colorConvert;
	}

	const offset = isBackground ? 10 : 0;
	const styles = {};

	for (const [sourceSpace, suite] of Object.entries(colorConvert$1)) {
		const name = sourceSpace === 'ansi16' ? 'ansi' : sourceSpace;
		if (sourceSpace === targetSpace) {
			styles[name] = wrap(identity, offset);
		} else if (typeof suite === 'object') {
			styles[name] = wrap(suite[targetSpace], offset);
		}
	}

	return styles;
};

function assembleStyles() {
	const codes = new Map();
	const styles = {
		modifier: {
			reset: [0, 0],
			// 21 isn't widely supported and 22 does the same thing
			bold: [1, 22],
			dim: [2, 22],
			italic: [3, 23],
			underline: [4, 24],
			inverse: [7, 27],
			hidden: [8, 28],
			strikethrough: [9, 29]
		},
		color: {
			black: [30, 39],
			red: [31, 39],
			green: [32, 39],
			yellow: [33, 39],
			blue: [34, 39],
			magenta: [35, 39],
			cyan: [36, 39],
			white: [37, 39],

			// Bright color
			blackBright: [90, 39],
			redBright: [91, 39],
			greenBright: [92, 39],
			yellowBright: [93, 39],
			blueBright: [94, 39],
			magentaBright: [95, 39],
			cyanBright: [96, 39],
			whiteBright: [97, 39]
		},
		bgColor: {
			bgBlack: [40, 49],
			bgRed: [41, 49],
			bgGreen: [42, 49],
			bgYellow: [43, 49],
			bgBlue: [44, 49],
			bgMagenta: [45, 49],
			bgCyan: [46, 49],
			bgWhite: [47, 49],

			// Bright color
			bgBlackBright: [100, 49],
			bgRedBright: [101, 49],
			bgGreenBright: [102, 49],
			bgYellowBright: [103, 49],
			bgBlueBright: [104, 49],
			bgMagentaBright: [105, 49],
			bgCyanBright: [106, 49],
			bgWhiteBright: [107, 49]
		}
	};

	// Alias bright black as gray (and grey)
	styles.color.gray = styles.color.blackBright;
	styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
	styles.color.grey = styles.color.blackBright;
	styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;

	for (const [groupName, group] of Object.entries(styles)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`
			};

			group[styleName] = styles[styleName];

			codes.set(style[0], style[1]);
		}

		Object.defineProperty(styles, groupName, {
			value: group,
			enumerable: false
		});
	}

	Object.defineProperty(styles, 'codes', {
		value: codes,
		enumerable: false
	});

	styles.color.close = '\u001B[39m';
	styles.bgColor.close = '\u001B[49m';

	setLazyProperty(styles.color, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, false));
	setLazyProperty(styles.bgColor, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, true));

	return styles;
}

// Make the export immutable
Object.defineProperty(module, 'exports', {
	enumerable: true,
	get: assembleStyles
});
});

const ESCAPES = new Set([
	'\u001B',
	'\u009B'
]);

const END_CODE = 39;

const wrapAnsi = code => `${ESCAPES.values().next().value}[${code}m`;

// Calculate the length of words split on ' ', ignoring
// the extra characters added by ansi escape codes
const wordLengths = string => string.split(' ').map(character => stringWidth_1(character));

// Wrap a long word across multiple rows
// Ansi escape codes do not count towards length
const wrapWord = (rows, word, columns) => {
	const characters = [...word];

	let isInsideEscape = false;
	let visible = stringWidth_1(stripAnsi$2(rows[rows.length - 1]));

	for (const [index, character] of characters.entries()) {
		const characterLength = stringWidth_1(character);

		if (visible + characterLength <= columns) {
			rows[rows.length - 1] += character;
		} else {
			rows.push(character);
			visible = 0;
		}

		if (ESCAPES.has(character)) {
			isInsideEscape = true;
		} else if (isInsideEscape && character === 'm') {
			isInsideEscape = false;
			continue;
		}

		if (isInsideEscape) {
			continue;
		}

		visible += characterLength;

		if (visible === columns && index < characters.length - 1) {
			rows.push('');
			visible = 0;
		}
	}

	// It's possible that the last row we copy over is only
	// ansi escape characters, handle this edge-case
	if (!visible && rows[rows.length - 1].length > 0 && rows.length > 1) {
		rows[rows.length - 2] += rows.pop();
	}
};

// Trims spaces from a string ignoring invisible sequences
const stringVisibleTrimSpacesRight = str => {
	const words = str.split(' ');
	let last = words.length;

	while (last > 0) {
		if (stringWidth_1(words[last - 1]) > 0) {
			break;
		}

		last--;
	}

	if (last === words.length) {
		return str;
	}

	return words.slice(0, last).join(' ') + words.slice(last).join('');
};

// The wrap-ansi module can be invoked in either 'hard' or 'soft' wrap mode
//
// 'hard' will never allow a string to take up more than columns characters
//
// 'soft' allows long words to expand past the column length
const exec = (string, columns, options = {}) => {
	if (options.trim !== false && string.trim() === '') {
		return '';
	}

	let pre = '';
	let ret = '';
	let escapeCode;

	const lengths = wordLengths(string);
	let rows = [''];

	for (const [index, word] of string.split(' ').entries()) {
		if (options.trim !== false) {
			rows[rows.length - 1] = rows[rows.length - 1].trimLeft();
		}

		let rowLength = stringWidth_1(rows[rows.length - 1]);

		if (index !== 0) {
			if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
				// If we start with a new word but the current row length equals the length of the columns, add a new row
				rows.push('');
				rowLength = 0;
			}

			if (rowLength > 0 || options.trim === false) {
				rows[rows.length - 1] += ' ';
				rowLength++;
			}
		}

		// In 'hard' wrap mode, the length of a line is never allowed to extend past 'columns'
		if (options.hard && lengths[index] > columns) {
			const remainingColumns = (columns - rowLength);
			const breaksStartingThisLine = 1 + Math.floor((lengths[index] - remainingColumns - 1) / columns);
			const breaksStartingNextLine = Math.floor((lengths[index] - 1) / columns);
			if (breaksStartingNextLine < breaksStartingThisLine) {
				rows.push('');
			}

			wrapWord(rows, word, columns);
			continue;
		}

		if (rowLength + lengths[index] > columns && rowLength > 0 && lengths[index] > 0) {
			if (options.wordWrap === false && rowLength < columns) {
				wrapWord(rows, word, columns);
				continue;
			}

			rows.push('');
		}

		if (rowLength + lengths[index] > columns && options.wordWrap === false) {
			wrapWord(rows, word, columns);
			continue;
		}

		rows[rows.length - 1] += word;
	}

	if (options.trim !== false) {
		rows = rows.map(stringVisibleTrimSpacesRight);
	}

	pre = rows.join('\n');

	for (const [index, character] of [...pre].entries()) {
		ret += character;

		if (ESCAPES.has(character)) {
			const code = parseFloat(/\d[^m]*/.exec(pre.slice(index, index + 4)));
			escapeCode = code === END_CODE ? null : code;
		}

		const code = ansiStyles.codes.get(Number(escapeCode));

		if (escapeCode && code) {
			if (pre[index + 1] === '\n') {
				ret += wrapAnsi(code);
			} else if (character === '\n') {
				ret += wrapAnsi(escapeCode);
			}
		}
	}

	return ret;
};

// For each newline, invoke the method separately
var wrapAnsi_1 = (string, columns, options) => {
	return String(string)
		.normalize()
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map(line => exec(line, columns, options))
		.join('\n');
};

const align = {
  right: alignRight,
  center: alignCenter
};
const top = 0;
const right = 1;
const bottom = 2;
const left = 3;

class UI {
  constructor (opts) {
    this.width = opts.width;
    this.wrap = opts.wrap;
    this.rows = [];
  }

  span (...args) {
    const cols = this.div(...args);
    cols.span = true;
  }

  resetOutput () {
    this.rows = [];
  }

  div (...args) {
    if (args.length === 0) {
      this.div('');
    }

    if (this.wrap && this._shouldApplyLayoutDSL(...args)) {
      return this._applyLayoutDSL(args[0])
    }

    const cols = args.map(arg => {
      if (typeof arg === 'string') {
        return this._colFromString(arg)
      }

      return arg
    });

    this.rows.push(cols);
    return cols
  }

  _shouldApplyLayoutDSL (...args) {
    return args.length === 1 && typeof args[0] === 'string' &&
      /[\t\n]/.test(args[0])
  }

  _applyLayoutDSL (str) {
    const rows = str.split('\n').map(row => row.split('\t'));
    let leftColumnWidth = 0;

    // simple heuristic for layout, make sure the
    // second column lines up along the left-hand.
    // don't allow the first column to take up more
    // than 50% of the screen.
    rows.forEach(columns => {
      if (columns.length > 1 && stringWidth_1(columns[0]) > leftColumnWidth) {
        leftColumnWidth = Math.min(
          Math.floor(this.width * 0.5),
          stringWidth_1(columns[0])
        );
      }
    });

    // generate a table:
    //  replacing ' ' with padding calculations.
    //  using the algorithmically generated width.
    rows.forEach(columns => {
      this.div(...columns.map((r, i) => {
        return {
          text: r.trim(),
          padding: this._measurePadding(r),
          width: (i === 0 && columns.length > 1) ? leftColumnWidth : undefined
        }
      }));
    });

    return this.rows[this.rows.length - 1]
  }

  _colFromString (text) {
    return {
      text,
      padding: this._measurePadding(text)
    }
  }

  _measurePadding (str) {
    // measure padding without ansi escape codes
    const noAnsi = stripAnsi$1(str);
    return [0, noAnsi.match(/\s*$/)[0].length, 0, noAnsi.match(/^\s*/)[0].length]
  }

  toString () {
    const lines = [];

    this.rows.forEach(row => {
      this.rowToString(row, lines);
    });

    // don't display any lines with the
    // hidden flag set.
    return lines
      .filter(line => !line.hidden)
      .map(line => line.text)
      .join('\n')
  }

  rowToString (row, lines) {
    this._rasterize(row).forEach((rrow, r) => {
      let str = '';
      rrow.forEach((col, c) => {
        const { width } = row[c]; // the width with padding.
        const wrapWidth = this._negatePadding(row[c]); // the width without padding.

        let ts = col; // temporary string used during alignment/padding.

        if (wrapWidth > stringWidth_1(col)) {
          ts += ' '.repeat(wrapWidth - stringWidth_1(col));
        }

        // align the string within its column.
        if (row[c].align && row[c].align !== 'left' && this.wrap) {
          ts = align[row[c].align](ts, wrapWidth);
          if (stringWidth_1(ts) < wrapWidth) {
            ts += ' '.repeat(width - stringWidth_1(ts) - 1);
          }
        }

        // apply border and padding to string.
        const padding = row[c].padding || [0, 0, 0, 0];
        if (padding[left]) {
          str += ' '.repeat(padding[left]);
        }

        str += addBorder(row[c], ts, '| ');
        str += ts;
        str += addBorder(row[c], ts, ' |');
        if (padding[right]) {
          str += ' '.repeat(padding[right]);
        }

        // if prior row is span, try to render the
        // current row on the prior line.
        if (r === 0 && lines.length > 0) {
          str = this._renderInline(str, lines[lines.length - 1]);
        }
      });

      // remove trailing whitespace.
      lines.push({
        text: str.replace(/ +$/, ''),
        span: row.span
      });
    });

    return lines
  }

  // if the full 'source' can render in
  // the target line, do so.
  _renderInline (source, previousLine) {
    const leadingWhitespace = source.match(/^ */)[0].length;
    const target = previousLine.text;
    const targetTextWidth = stringWidth_1(target.trimRight());

    if (!previousLine.span) {
      return source
    }

    // if we're not applying wrapping logic,
    // just always append to the span.
    if (!this.wrap) {
      previousLine.hidden = true;
      return target + source
    }

    if (leadingWhitespace < targetTextWidth) {
      return source
    }

    previousLine.hidden = true;

    return target.trimRight() + ' '.repeat(leadingWhitespace - targetTextWidth) + source.trimLeft()
  }

  _rasterize (row) {
    const rrows = [];
    const widths = this._columnWidths(row);
    let wrapped;

    // word wrap all columns, and create
    // a data-structure that is easy to rasterize.
    row.forEach((col, c) => {
      // leave room for left and right padding.
      col.width = widths[c];
      if (this.wrap) {
        wrapped = wrapAnsi_1(col.text, this._negatePadding(col), { hard: true }).split('\n');
      } else {
        wrapped = col.text.split('\n');
      }

      if (col.border) {
        wrapped.unshift('.' + '-'.repeat(this._negatePadding(col) + 2) + '.');
        wrapped.push("'" + '-'.repeat(this._negatePadding(col) + 2) + "'");
      }

      // add top and bottom padding.
      if (col.padding) {
        wrapped.unshift(...new Array(col.padding[top] || 0).fill(''));
        wrapped.push(...new Array(col.padding[bottom] || 0).fill(''));
      }

      wrapped.forEach((str, r) => {
        if (!rrows[r]) {
          rrows.push([]);
        }

        const rrow = rrows[r];

        for (let i = 0; i < c; i++) {
          if (rrow[i] === undefined) {
            rrow.push('');
          }
        }

        rrow.push(str);
      });
    });

    return rrows
  }

  _negatePadding (col) {
    let wrapWidth = col.width;
    if (col.padding) {
      wrapWidth -= (col.padding[left] || 0) + (col.padding[right] || 0);
    }

    if (col.border) {
      wrapWidth -= 4;
    }

    return wrapWidth
  }

  _columnWidths (row) {
    if (!this.wrap) {
      return row.map(col => {
        return col.width || stringWidth_1(col.text)
      })
    }

    let unset = row.length;
    let remainingWidth = this.width;

    // column widths can be set in config.
    const widths = row.map(col => {
      if (col.width) {
        unset--;
        remainingWidth -= col.width;
        return col.width
      }

      return undefined
    });

    // any unset widths should be calculated.
    const unsetWidth = unset ? Math.floor(remainingWidth / unset) : 0;

    return widths.map((w, i) => {
      if (w === undefined) {
        return Math.max(unsetWidth, _minWidth(row[i]))
      }

      return w
    })
  }
}

function addBorder (col, ts, style) {
  if (col.border) {
    if (/[.']-+[.']/.test(ts)) {
      return ''
    }

    if (ts.trim().length !== 0) {
      return style
    }

    return '  '
  }

  return ''
}

// calculates the minimum width of
// a column, based on padding preferences.
function _minWidth (col) {
  const padding = col.padding || [];
  const minWidth = 1 + (padding[left] || 0) + (padding[right] || 0);
  if (col.border) {
    return minWidth + 4
  }

  return minWidth
}

function getWindowWidth () {
  /* istanbul ignore next: depends on terminal */
  if (typeof process === 'object' && process.stdout && process.stdout.columns) {
    return process.stdout.columns
  }
}

function alignRight (str, width) {
  str = str.trim();
  const strWidth = stringWidth_1(str);

  if (strWidth < width) {
    return ' '.repeat(width - strWidth) + str
  }

  return str
}

function alignCenter (str, width) {
  str = str.trim();
  const strWidth = stringWidth_1(str);

  /* istanbul ignore next */
  if (strWidth >= width) {
    return str
  }

  return ' '.repeat((width - strWidth) >> 1) + str
}

var cliui = function (opts = {}) {
  return new UI({
    width: opts.width || getWindowWidth() || /* istanbul ignore next */ 80,
    wrap: opts.wrap !== false
  })
};

// this file handles outputting usage instructions,
// failures, etc. keeps logging in one place.







var usage = function usage (yargs, y18n) {
  const __ = y18n.__;
  const self = {};

  // methods for ouputting/building failure message.
  const fails = [];
  self.failFn = function failFn (f) {
    fails.push(f);
  };

  let failMessage = null;
  let showHelpOnFail = true;
  self.showHelpOnFail = function showHelpOnFailFn (enabled, message) {
    if (typeof enabled === 'string') {
      message = enabled;
      enabled = true;
    } else if (typeof enabled === 'undefined') {
      enabled = true;
    }
    failMessage = message;
    showHelpOnFail = enabled;
    return self
  };

  let failureOutput = false;
  self.fail = function fail (msg, err) {
    const logger = yargs._getLoggerInstance();

    if (fails.length) {
      for (let i = fails.length - 1; i >= 0; --i) {
        fails[i](msg, err, self);
      }
    } else {
      if (yargs.getExitProcess()) setBlocking(true);

      // don't output failure message more than once
      if (!failureOutput) {
        failureOutput = true;
        if (showHelpOnFail) {
          yargs.showHelp('error');
          logger.error();
        }
        if (msg || err) logger.error(msg || err);
        if (failMessage) {
          if (msg || err) logger.error('');
          logger.error(failMessage);
        }
      }

      err = err || new yerror(msg);
      if (yargs.getExitProcess()) {
        return yargs.exit(1)
      } else if (yargs._hasParseCallback()) {
        return yargs.exit(1, err)
      } else {
        throw err
      }
    }
  };

  // methods for ouputting/building help (usage) message.
  let usages = [];
  let usageDisabled = false;
  self.usage = (msg, description) => {
    if (msg === null) {
      usageDisabled = true;
      usages = [];
      return
    }
    usageDisabled = false;
    usages.push([msg, description || '']);
    return self
  };
  self.getUsage = () => {
    return usages
  };
  self.getUsageDisabled = () => {
    return usageDisabled
  };

  self.getPositionalGroupName = () => {
    return __('Positionals:')
  };

  let examples = [];
  self.example = (cmd, description) => {
    examples.push([cmd, description || '']);
  };

  let commands = [];
  self.command = function command (cmd, description, isDefault, aliases) {
    // the last default wins, so cancel out any previously set default
    if (isDefault) {
      commands = commands.map((cmdArray) => {
        cmdArray[2] = false;
        return cmdArray
      });
    }
    commands.push([cmd, description || '', isDefault, aliases]);
  };
  self.getCommands = () => commands;

  let descriptions = {};
  self.describe = function describe (key, desc) {
    if (typeof key === 'object') {
      Object.keys(key).forEach((k) => {
        self.describe(k, key[k]);
      });
    } else {
      descriptions[key] = desc;
    }
  };
  self.getDescriptions = () => descriptions;

  let epilogs = [];
  self.epilog = (msg) => {
    epilogs.push(msg);
  };

  let wrapSet = false;
  let wrap;
  self.wrap = (cols) => {
    wrapSet = true;
    wrap = cols;
  };

  function getWrap () {
    if (!wrapSet) {
      wrap = windowWidth();
      wrapSet = true;
    }

    return wrap
  }

  const deferY18nLookupPrefix = '__yargsString__:';
  self.deferY18nLookup = str => deferY18nLookupPrefix + str;

  const defaultGroup = 'Options:';
  self.help = function help () {
    if (cachedHelpMessage) return cachedHelpMessage
    normalizeAliases();

    // handle old demanded API
    const base$0 = yargs.customScriptName ? yargs.$0 : path$2__default.basename(yargs.$0);
    const demandedOptions = yargs.getDemandedOptions();
    const demandedCommands = yargs.getDemandedCommands();
    const groups = yargs.getGroups();
    const options = yargs.getOptions();

    let keys = [];
    keys = keys.concat(Object.keys(descriptions));
    keys = keys.concat(Object.keys(demandedOptions));
    keys = keys.concat(Object.keys(demandedCommands));
    keys = keys.concat(Object.keys(options.default));
    keys = keys.filter(filterHiddenOptions);
    keys = Object.keys(keys.reduce((acc, key) => {
      if (key !== '_') acc[key] = true;
      return acc
    }, {}));

    const theWrap = getWrap();
    const ui = cliui({
      width: theWrap,
      wrap: !!theWrap
    });

    // the usage string.
    if (!usageDisabled) {
      if (usages.length) {
        // user-defined usage.
        usages.forEach((usage) => {
          ui.div(`${usage[0].replace(/\$0/g, base$0)}`);
          if (usage[1]) {
            ui.div({ text: `${usage[1]}`, padding: [1, 0, 0, 0] });
          }
        });
        ui.div();
      } else if (commands.length) {
        let u = null;
        // demonstrate how commands are used.
        if (demandedCommands._) {
          u = `${base$0} <${__('command')}>\n`;
        } else {
          u = `${base$0} [${__('command')}]\n`;
        }
        ui.div(`${u}`);
      }
    }

    // your application's commands, i.e., non-option
    // arguments populated in '_'.
    if (commands.length) {
      ui.div(__('Commands:'));

      const context = yargs.getContext();
      const parentCommands = context.commands.length ? `${context.commands.join(' ')} ` : '';

      if (yargs.getParserConfiguration()['sort-commands'] === true) {
        commands = commands.sort((a, b) => a[0].localeCompare(b[0]));
      }

      commands.forEach((command) => {
        const commandString = `${base$0} ${parentCommands}${command[0].replace(/^\$0 ?/, '')}`; // drop $0 from default commands.
        ui.span(
          {
            text: commandString,
            padding: [0, 2, 0, 2],
            width: maxWidth(commands, theWrap, `${base$0}${parentCommands}`) + 4
          },
          { text: command[1] }
        );
        const hints = [];
        if (command[2]) hints.push(`[${__('default:').slice(0, -1)}]`); // TODO hacking around i18n here
        if (command[3] && command[3].length) {
          hints.push(`[${__('aliases:')} ${command[3].join(', ')}]`);
        }
        if (hints.length) {
          ui.div({ text: hints.join(' '), padding: [0, 0, 0, 2], align: 'right' });
        } else {
          ui.div();
        }
      });

      ui.div();
    }

    // perform some cleanup on the keys array, making it
    // only include top-level keys not their aliases.
    const aliasKeys = (Object.keys(options.alias) || [])
      .concat(Object.keys(yargs.parsed.newAliases) || []);

    keys = keys.filter(key => !yargs.parsed.newAliases[key] && aliasKeys.every(alias => (options.alias[alias] || []).indexOf(key) === -1));

    // populate 'Options:' group with any keys that have not
    // explicitly had a group set.
    if (!groups[defaultGroup]) groups[defaultGroup] = [];
    addUngroupedKeys(keys, options.alias, groups);

    // display 'Options:' table along with any custom tables:
    Object.keys(groups).forEach((groupName) => {
      if (!groups[groupName].length) return

      // if we've grouped the key 'f', but 'f' aliases 'foobar',
      // normalizedKeys should contain only 'foobar'.
      const normalizedKeys = groups[groupName].filter(filterHiddenOptions).map((key) => {
        if (~aliasKeys.indexOf(key)) return key
        for (let i = 0, aliasKey; (aliasKey = aliasKeys[i]) !== undefined; i++) {
          if (~(options.alias[aliasKey] || []).indexOf(key)) return aliasKey
        }
        return key
      });

      if (normalizedKeys.length < 1) return

      ui.div(__(groupName));

      // actually generate the switches string --foo, -f, --bar.
      const switches = normalizedKeys.reduce((acc, key) => {
        acc[key] = [ key ].concat(options.alias[key] || [])
          .map(sw => {
            // for the special positional group don't
            // add '--' or '-' prefix.
            if (groupName === self.getPositionalGroupName()) return sw
            else return (/^[^0-9]$/.test(sw) ? '-' : '--') + sw
          })
          .join(', ');

        return acc
      }, {});

      normalizedKeys.forEach((key) => {
        const kswitch = switches[key];
        let desc = descriptions[key] || '';
        let type = null;

        if (~desc.lastIndexOf(deferY18nLookupPrefix)) desc = __(desc.substring(deferY18nLookupPrefix.length));

        if (~options.boolean.indexOf(key)) type = `[${__('boolean')}]`;
        if (~options.count.indexOf(key)) type = `[${__('count')}]`;
        if (~options.string.indexOf(key)) type = `[${__('string')}]`;
        if (~options.normalize.indexOf(key)) type = `[${__('string')}]`;
        if (~options.array.indexOf(key)) type = `[${__('array')}]`;
        if (~options.number.indexOf(key)) type = `[${__('number')}]`;

        const extra = [
          type,
          (key in demandedOptions) ? `[${__('required')}]` : null,
          options.choices && options.choices[key] ? `[${__('choices:')} ${
            self.stringifiedValues(options.choices[key])}]` : null,
          defaultString(options.default[key], options.defaultDescription[key])
        ].filter(Boolean).join(' ');

        ui.span(
          { text: kswitch, padding: [0, 2, 0, 2], width: maxWidth(switches, theWrap) + 4 },
          desc
        );

        if (extra) ui.div({ text: extra, padding: [0, 0, 0, 2], align: 'right' });
        else ui.div();
      });

      ui.div();
    });

    // describe some common use-cases for your application.
    if (examples.length) {
      ui.div(__('Examples:'));

      examples.forEach((example) => {
        example[0] = example[0].replace(/\$0/g, base$0);
      });

      examples.forEach((example) => {
        if (example[1] === '') {
          ui.div(
            {
              text: example[0],
              padding: [0, 2, 0, 2]
            }
          );
        } else {
          ui.div(
            {
              text: example[0],
              padding: [0, 2, 0, 2],
              width: maxWidth(examples, theWrap) + 4
            }, {
              text: example[1]
            }
          );
        }
      });

      ui.div();
    }

    // the usage string.
    if (epilogs.length > 0) {
      const e = epilogs.map(epilog => epilog.replace(/\$0/g, base$0)).join('\n');
      ui.div(`${e}\n`);
    }

    // Remove the trailing white spaces
    return ui.toString().replace(/\s*$/, '')
  };

  // return the maximum width of a string
  // in the left-hand column of a table.
  function maxWidth (table, theWrap, modifier) {
    let width = 0;

    // table might be of the form [leftColumn],
    // or {key: leftColumn}
    if (!Array.isArray(table)) {
      table = Object.keys(table).map(key => [table[key]]);
    }

    table.forEach((v) => {
      width = Math.max(
        stringWidth_1(modifier ? `${modifier} ${v[0]}` : v[0]),
        width
      );
    });

    // if we've enabled 'wrap' we should limit
    // the max-width of the left-column.
    if (theWrap) width = Math.min(width, parseInt(theWrap * 0.5, 10));

    return width
  }

  // make sure any options set for aliases,
  // are copied to the keys being aliased.
  function normalizeAliases () {
    // handle old demanded API
    const demandedOptions = yargs.getDemandedOptions();
    const options = yargs.getOptions()

    ;(Object.keys(options.alias) || []).forEach((key) => {
      options.alias[key].forEach((alias) => {
        // copy descriptions.
        if (descriptions[alias]) self.describe(key, descriptions[alias]);
        // copy demanded.
        if (alias in demandedOptions) yargs.demandOption(key, demandedOptions[alias]);
        // type messages.
        if (~options.boolean.indexOf(alias)) yargs.boolean(key);
        if (~options.count.indexOf(alias)) yargs.count(key);
        if (~options.string.indexOf(alias)) yargs.string(key);
        if (~options.normalize.indexOf(alias)) yargs.normalize(key);
        if (~options.array.indexOf(alias)) yargs.array(key);
        if (~options.number.indexOf(alias)) yargs.number(key);
      });
    });
  }

  // if yargs is executing an async handler, we take a snapshot of the
  // help message to display on failure:
  let cachedHelpMessage;
  self.cacheHelpMessage = function () {
    cachedHelpMessage = this.help();
  };

  // given a set of keys, place any keys that are
  // ungrouped under the 'Options:' grouping.
  function addUngroupedKeys (keys, aliases, groups) {
    let groupedKeys = [];
    let toCheck = null;
    Object.keys(groups).forEach((group) => {
      groupedKeys = groupedKeys.concat(groups[group]);
    });

    keys.forEach((key) => {
      toCheck = [key].concat(aliases[key]);
      if (!toCheck.some(k => groupedKeys.indexOf(k) !== -1)) {
        groups[defaultGroup].push(key);
      }
    });
    return groupedKeys
  }

  function filterHiddenOptions (key) {
    return yargs.getOptions().hiddenOptions.indexOf(key) < 0 || yargs.parsed.argv[yargs.getOptions().showHiddenOpt]
  }

  self.showHelp = (level) => {
    const logger = yargs._getLoggerInstance();
    if (!level) level = 'error';
    const emit = typeof level === 'function' ? level : logger[level];
    emit(self.help());
  };

  self.functionDescription = (fn) => {
    const description = fn.name ? decamelize(fn.name, '-') : __('generated-value');
    return ['(', description, ')'].join('')
  };

  self.stringifiedValues = function stringifiedValues (values, separator) {
    let string = '';
    const sep = separator || ', ';
    const array = [].concat(values);

    if (!values || !array.length) return string

    array.forEach((value) => {
      if (string.length) string += sep;
      string += JSON.stringify(value);
    });

    return string
  };

  // format the default-value-string displayed in
  // the right-hand column.
  function defaultString (value, defaultDescription) {
    let string = `[${__('default:')} `;

    if (value === undefined && !defaultDescription) return null

    if (defaultDescription) {
      string += defaultDescription;
    } else {
      switch (typeof value) {
        case 'string':
          string += `"${value}"`;
          break
        case 'object':
          string += JSON.stringify(value);
          break
        default:
          string += value;
      }
    }

    return `${string}]`
  }

  // guess the width of the console window, max-width 80.
  function windowWidth () {
    const maxWidth = 80;
    if (typeof process === 'object' && process.stdout && process.stdout.columns) {
      return Math.min(maxWidth, process.stdout.columns)
    } else {
      return maxWidth
    }
  }

  // logic for displaying application version.
  let version = null;
  self.version = (ver) => {
    version = ver;
  };

  self.showVersion = () => {
    const logger = yargs._getLoggerInstance();
    logger.log(version);
  };

  self.reset = function reset (localLookup) {
    // do not reset wrap here
    // do not reset fails here
    failMessage = null;
    failureOutput = false;
    usages = [];
    usageDisabled = false;
    epilogs = [];
    examples = [];
    commands = [];
    descriptions = objFilter(descriptions, (k, v) => !localLookup[k]);
    return self
  };

  let frozens = [];
  self.freeze = function freeze () {
    let frozen = {};
    frozens.push(frozen);
    frozen.failMessage = failMessage;
    frozen.failureOutput = failureOutput;
    frozen.usages = usages;
    frozen.usageDisabled = usageDisabled;
    frozen.epilogs = epilogs;
    frozen.examples = examples;
    frozen.commands = commands;
    frozen.descriptions = descriptions;
  };
  self.unfreeze = function unfreeze () {
    let frozen = frozens.pop();
    failMessage = frozen.failMessage;
    failureOutput = frozen.failureOutput;
    usages = frozen.usages;
    usageDisabled = frozen.usageDisabled;
    epilogs = frozen.epilogs;
    examples = frozen.examples;
    commands = frozen.commands;
    descriptions = frozen.descriptions;
  };

  return self
};

/*
Copyright (c) 2011 Andrei Mackenzie

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
// Compute the edit distance between the two given strings
var levenshtein = function levenshtein (a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = [];

  // increment along the first column of each row
  let i;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1)); // deletion
      }
    }
  }

  return matrix[b.length][a.length]
};

const specialKeys = ['$0', '--', '_'];

// validation-type-stuff, missing params,
// bad implications, custom checks.
var validation = function validation (yargs, usage, y18n) {
  const __ = y18n.__;
  const __n = y18n.__n;
  const self = {};

  // validate appropriate # of non-option
  // arguments were provided, i.e., '_'.
  self.nonOptionCount = function nonOptionCount (argv) {
    const demandedCommands = yargs.getDemandedCommands();
    // don't count currently executing commands
    const _s = argv._.length - yargs.getContext().commands.length;

    if (demandedCommands._ && (_s < demandedCommands._.min || _s > demandedCommands._.max)) {
      if (_s < demandedCommands._.min) {
        if (demandedCommands._.minMsg !== undefined) {
          usage.fail(
            // replace $0 with observed, $1 with expected.
            demandedCommands._.minMsg ? demandedCommands._.minMsg.replace(/\$0/g, _s).replace(/\$1/, demandedCommands._.min) : null
          );
        } else {
          usage.fail(
            __('Not enough non-option arguments: got %s, need at least %s', _s, demandedCommands._.min)
          );
        }
      } else if (_s > demandedCommands._.max) {
        if (demandedCommands._.maxMsg !== undefined) {
          usage.fail(
            // replace $0 with observed, $1 with expected.
            demandedCommands._.maxMsg ? demandedCommands._.maxMsg.replace(/\$0/g, _s).replace(/\$1/, demandedCommands._.max) : null
          );
        } else {
          usage.fail(
            __('Too many non-option arguments: got %s, maximum of %s', _s, demandedCommands._.max)
          );
        }
      }
    }
  };

  // validate the appropriate # of <required>
  // positional arguments were provided:
  self.positionalCount = function positionalCount (required, observed) {
    if (observed < required) {
      usage.fail(
        __('Not enough non-option arguments: got %s, need at least %s', observed, required)
      );
    }
  };

  // make sure all the required arguments are present.
  self.requiredArguments = function requiredArguments (argv) {
    const demandedOptions = yargs.getDemandedOptions();
    let missing = null;

    Object.keys(demandedOptions).forEach((key) => {
      if (!argv.hasOwnProperty(key) || typeof argv[key] === 'undefined') {
        missing = missing || {};
        missing[key] = demandedOptions[key];
      }
    });

    if (missing) {
      const customMsgs = [];
      Object.keys(missing).forEach((key) => {
        const msg = missing[key];
        if (msg && customMsgs.indexOf(msg) < 0) {
          customMsgs.push(msg);
        }
      });

      const customMsg = customMsgs.length ? `\n${customMsgs.join('\n')}` : '';

      usage.fail(__n(
        'Missing required argument: %s',
        'Missing required arguments: %s',
        Object.keys(missing).length,
        Object.keys(missing).join(', ') + customMsg
      ));
    }
  };

  // check for unknown arguments (strict-mode).
  self.unknownArguments = function unknownArguments (argv, aliases, positionalMap) {
    const commandKeys = yargs.getCommandInstance().getCommands();
    const unknown = [];
    const currentContext = yargs.getContext();

    Object.keys(argv).forEach((key) => {
      if (specialKeys.indexOf(key) === -1 &&
        !positionalMap.hasOwnProperty(key) &&
        !yargs._getParseContext().hasOwnProperty(key) &&
        !self.isValidAndSomeAliasIsNotNew(key, aliases)
      ) {
        unknown.push(key);
      }
    });

    if ((currentContext.commands.length > 0) || (commandKeys.length > 0)) {
      argv._.slice(currentContext.commands.length).forEach((key) => {
        if (commandKeys.indexOf(key) === -1) {
          unknown.push(key);
        }
      });
    }

    if (unknown.length > 0) {
      usage.fail(__n(
        'Unknown argument: %s',
        'Unknown arguments: %s',
        unknown.length,
        unknown.join(', ')
      ));
    }
  };

  // check for a key that is not an alias, or for which every alias is new,
  // implying that it was invented by the parser, e.g., during camelization
  self.isValidAndSomeAliasIsNotNew = function isValidAndSomeAliasIsNotNew (key, aliases) {
    if (!aliases.hasOwnProperty(key)) {
      return false
    }
    const newAliases = yargs.parsed.newAliases;
    for (let a of [key, ...aliases[key]]) {
      if (!newAliases.hasOwnProperty(a) || !newAliases[key]) {
        return true
      }
    }
    return false
  };

  // validate arguments limited to enumerated choices
  self.limitedChoices = function limitedChoices (argv) {
    const options = yargs.getOptions();
    const invalid = {};

    if (!Object.keys(options.choices).length) return

    Object.keys(argv).forEach((key) => {
      if (specialKeys.indexOf(key) === -1 &&
        options.choices.hasOwnProperty(key)) {
        [].concat(argv[key]).forEach((value) => {
          // TODO case-insensitive configurability
          if (options.choices[key].indexOf(value) === -1 &&
              value !== undefined) {
            invalid[key] = (invalid[key] || []).concat(value);
          }
        });
      }
    });

    const invalidKeys = Object.keys(invalid);

    if (!invalidKeys.length) return

    let msg = __('Invalid values:');
    invalidKeys.forEach((key) => {
      msg += `\n  ${__(
        'Argument: %s, Given: %s, Choices: %s',
        key,
        usage.stringifiedValues(invalid[key]),
        usage.stringifiedValues(options.choices[key])
      )}`;
    });
    usage.fail(msg);
  };

  // custom checks, added using the `check` option on yargs.
  let checks = [];
  self.check = function check (f, global) {
    checks.push({
      func: f,
      global
    });
  };

  self.customChecks = function customChecks (argv, aliases) {
    for (let i = 0, f; (f = checks[i]) !== undefined; i++) {
      const func = f.func;
      let result = null;
      try {
        result = func(argv, aliases);
      } catch (err) {
        usage.fail(err.message ? err.message : err, err);
        continue
      }

      if (!result) {
        usage.fail(__('Argument check failed: %s', func.toString()));
      } else if (typeof result === 'string' || result instanceof Error) {
        usage.fail(result.toString(), result);
      }
    }
  };

  // check implications, argument foo implies => argument bar.
  let implied = {};
  self.implies = function implies (key, value) {
    argsert_1('<string|object> [array|number|string]', [key, value], arguments.length);

    if (typeof key === 'object') {
      Object.keys(key).forEach((k) => {
        self.implies(k, key[k]);
      });
    } else {
      yargs.global(key);
      if (!implied[key]) {
        implied[key] = [];
      }
      if (Array.isArray(value)) {
        value.forEach((i) => self.implies(key, i));
      } else {
        implied[key].push(value);
      }
    }
  };
  self.getImplied = function getImplied () {
    return implied
  };

  function keyExists (argv, val) {
    // convert string '1' to number 1
    let num = Number(val);
    val = isNaN(num) ? val : num;

    if (typeof val === 'number') {
      // check length of argv._
      val = argv._.length >= val;
    } else if (val.match(/^--no-.+/)) {
      // check if key/value doesn't exist
      val = val.match(/^--no-(.+)/)[1];
      val = !argv[val];
    } else {
      // check if key/value exists
      val = argv[val];
    }
    return val
  }

  self.implications = function implications (argv) {
    const implyFail = [];

    Object.keys(implied).forEach((key) => {
      const origKey = key
      ;(implied[key] || []).forEach((value) => {
        let key = origKey;
        const origValue = value;
        key = keyExists(argv, key);
        value = keyExists(argv, value);

        if (key && !value) {
          implyFail.push(` ${origKey} -> ${origValue}`);
        }
      });
    });

    if (implyFail.length) {
      let msg = `${__('Implications failed:')}\n`;

      implyFail.forEach((value) => {
        msg += (value);
      });

      usage.fail(msg);
    }
  };

  let conflicting = {};
  self.conflicts = function conflicts (key, value) {
    argsert_1('<string|object> [array|string]', [key, value], arguments.length);

    if (typeof key === 'object') {
      Object.keys(key).forEach((k) => {
        self.conflicts(k, key[k]);
      });
    } else {
      yargs.global(key);
      if (!conflicting[key]) {
        conflicting[key] = [];
      }
      if (Array.isArray(value)) {
        value.forEach((i) => self.conflicts(key, i));
      } else {
        conflicting[key].push(value);
      }
    }
  };
  self.getConflicting = () => conflicting;

  self.conflicting = function conflictingFn (argv) {
    Object.keys(argv).forEach((key) => {
      if (conflicting[key]) {
        conflicting[key].forEach((value) => {
          // we default keys to 'undefined' that have been configured, we should not
          // apply conflicting check unless they are a value other than 'undefined'.
          if (value && argv[key] !== undefined && argv[value] !== undefined) {
            usage.fail(__('Arguments %s and %s are mutually exclusive', key, value));
          }
        });
      }
    });
  };

  self.recommendCommands = function recommendCommands (cmd, potentialCommands) {
    const distance = levenshtein;
    const threshold = 3; // if it takes more than three edits, let's move on.
    potentialCommands = potentialCommands.sort((a, b) => b.length - a.length);

    let recommended = null;
    let bestDistance = Infinity;
    for (let i = 0, candidate; (candidate = potentialCommands[i]) !== undefined; i++) {
      const d = distance(cmd, candidate);
      if (d <= threshold && d < bestDistance) {
        bestDistance = d;
        recommended = candidate;
      }
    }
    if (recommended) usage.fail(__('Did you mean %s?', recommended));
  };

  self.reset = function reset (localLookup) {
    implied = objFilter(implied, (k, v) => !localLookup[k]);
    conflicting = objFilter(conflicting, (k, v) => !localLookup[k]);
    checks = checks.filter(c => c.global);
    return self
  };

  let frozens = [];
  self.freeze = function freeze () {
    let frozen = {};
    frozens.push(frozen);
    frozen.implied = implied;
    frozen.checks = checks;
    frozen.conflicting = conflicting;
  };
  self.unfreeze = function unfreeze () {
    let frozen = frozens.pop();
    implied = frozen.implied;
    checks = frozen.checks;
    conflicting = frozen.conflicting;
  };

  return self
};

function Y18N (opts) {
  // configurable options.
  opts = opts || {};
  this.directory = opts.directory || './locales';
  this.updateFiles = typeof opts.updateFiles === 'boolean' ? opts.updateFiles : true;
  this.locale = opts.locale || 'en';
  this.fallbackToLanguage = typeof opts.fallbackToLanguage === 'boolean' ? opts.fallbackToLanguage : true;

  // internal stuff.
  this.cache = {};
  this.writeQueue = [];
}

Y18N.prototype.__ = function () {
  if (typeof arguments[0] !== 'string') {
    return this._taggedLiteral.apply(this, arguments)
  }
  var args = Array.prototype.slice.call(arguments);
  var str = args.shift();
  var cb = function () {}; // start with noop.

  if (typeof args[args.length - 1] === 'function') cb = args.pop();
  cb = cb || function () {}; // noop.

  if (!this.cache[this.locale]) this._readLocaleFile();

  // we've observed a new string, update the language file.
  if (!this.cache[this.locale][str] && this.updateFiles) {
    this.cache[this.locale][str] = str;

    // include the current directory and locale,
    // since these values could change before the
    // write is performed.
    this._enqueueWrite([this.directory, this.locale, cb]);
  } else {
    cb();
  }

  return logger$2.require$$0.format.apply(logger$2.require$$0, [this.cache[this.locale][str] || str].concat(args))
};

Y18N.prototype._taggedLiteral = function (parts) {
  var args = arguments;
  var str = '';
  parts.forEach(function (part, i) {
    var arg = args[i + 1];
    str += part;
    if (typeof arg !== 'undefined') {
      str += '%s';
    }
  });
  return this.__.apply(null, [str].concat([].slice.call(arguments, 1)))
};

Y18N.prototype._enqueueWrite = function (work) {
  this.writeQueue.push(work);
  if (this.writeQueue.length === 1) this._processWriteQueue();
};

Y18N.prototype._processWriteQueue = function () {
  var _this = this;
  var work = this.writeQueue[0];

  // destructure the enqueued work.
  var directory = work[0];
  var locale = work[1];
  var cb = work[2];

  var languageFile = this._resolveLocaleFile(directory, locale);
  var serializedLocale = JSON.stringify(this.cache[locale], null, 2);

  logger$2.fs.writeFile(languageFile, serializedLocale, 'utf-8', function (err) {
    _this.writeQueue.shift();
    if (_this.writeQueue.length > 0) _this._processWriteQueue();
    cb(err);
  });
};

Y18N.prototype._readLocaleFile = function () {
  var localeLookup = {};
  var languageFile = this._resolveLocaleFile(this.directory, this.locale);

  try {
    localeLookup = JSON.parse(logger$2.fs.readFileSync(languageFile, 'utf-8'));
  } catch (err) {
    if (err instanceof SyntaxError) {
      err.message = 'syntax error in ' + languageFile;
    }

    if (err.code === 'ENOENT') localeLookup = {};
    else throw err
  }

  this.cache[this.locale] = localeLookup;
};

Y18N.prototype._resolveLocaleFile = function (directory, locale) {
  var file = path$2__default.resolve(directory, './', locale + '.json');
  if (this.fallbackToLanguage && !this._fileExistsSync(file) && ~locale.lastIndexOf('_')) {
    // attempt fallback to language only
    var languageFile = path$2__default.resolve(directory, './', locale.split('_')[0] + '.json');
    if (this._fileExistsSync(languageFile)) file = languageFile;
  }
  return file
};

// this only exists because fs.existsSync() "will be deprecated"
// see https://nodejs.org/api/fs.html#fs_fs_existssync_path
Y18N.prototype._fileExistsSync = function (file) {
  try {
    return logger$2.fs.statSync(file).isFile()
  } catch (err) {
    return false
  }
};

Y18N.prototype.__n = function () {
  var args = Array.prototype.slice.call(arguments);
  var singular = args.shift();
  var plural = args.shift();
  var quantity = args.shift();

  var cb = function () {}; // start with noop.
  if (typeof args[args.length - 1] === 'function') cb = args.pop();

  if (!this.cache[this.locale]) this._readLocaleFile();

  var str = quantity === 1 ? singular : plural;
  if (this.cache[this.locale][singular]) {
    str = this.cache[this.locale][singular][quantity === 1 ? 'one' : 'other'];
  }

  // we've observed a new string, update the language file.
  if (!this.cache[this.locale][singular] && this.updateFiles) {
    this.cache[this.locale][singular] = {
      one: singular,
      other: plural
    };

    // include the current directory and locale,
    // since these values could change before the
    // write is performed.
    this._enqueueWrite([this.directory, this.locale, cb]);
  } else {
    cb();
  }

  // if a %d placeholder is provided, add quantity
  // to the arguments expanded by util.format.
  var values = [str];
  if (~str.indexOf('%d')) values.push(quantity);

  return logger$2.require$$0.format.apply(logger$2.require$$0, values.concat(args))
};

Y18N.prototype.setLocale = function (locale) {
  this.locale = locale;
};

Y18N.prototype.getLocale = function () {
  return this.locale
};

Y18N.prototype.updateLocale = function (obj) {
  if (!this.cache[this.locale]) this._readLocaleFile();

  for (var key in obj) {
    this.cache[this.locale][key] = obj[key];
  }
};

var y18n = function (opts) {
  var y18n = new Y18N(opts);

  // bind all functions to y18n, so that
  // they can be used in isolation.
  for (var key in y18n) {
    if (typeof y18n[key] === 'function') {
      y18n[key] = y18n[key].bind(y18n);
    }
  }

  return y18n
};

let previouslyVisitedConfigs = [];

function checkForCircularExtends (cfgPath) {
  if (previouslyVisitedConfigs.indexOf(cfgPath) > -1) {
    throw new yerror(`Circular extended configurations: '${cfgPath}'.`)
  }
}

function getPathToDefaultConfig (cwd, pathToExtend) {
  return path$2__default.resolve(cwd, pathToExtend)
}

function mergeDeep (config1, config2) {
  const target = {};
  const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);
  Object.assign(target, config1);
  for (let key of Object.keys(config2)) {
    if (isObject(config2[key]) && isObject(target[key])) {
      target[key] = mergeDeep(config1[key], config2[key]);
    } else {
      target[key] = config2[key];
    }
  }
  return target
}

function applyExtends (config, cwd, mergeExtends) {
  let defaultConfig = {};

  if (Object.prototype.hasOwnProperty.call(config, 'extends')) {
    if (typeof config.extends !== 'string') return defaultConfig
    const isPath = /\.json|\..*rc$/.test(config.extends);
    let pathToDefault = null;
    if (!isPath) {
      try {
        pathToDefault = logger$2.commonjsRequire.resolve(config.extends);
      } catch (err) {
        // most likely this simply isn't a module.
      }
    } else {
      pathToDefault = getPathToDefaultConfig(cwd, config.extends);
    }
    // maybe the module uses key for some other reason,
    // err on side of caution.
    if (!pathToDefault && !isPath) return config

    checkForCircularExtends(pathToDefault);

    previouslyVisitedConfigs.push(pathToDefault);

    defaultConfig = isPath ? JSON.parse(logger$2.fs.readFileSync(pathToDefault, 'utf8')) : logger$2.commonjsRequire(config.extends);
    delete config.extends;
    defaultConfig = applyExtends(defaultConfig, path$2__default.dirname(pathToDefault), mergeExtends);
  }

  previouslyVisitedConfigs = [];

  return mergeExtends ? mergeDeep(defaultConfig, config) : Object.assign({}, defaultConfig, config)
}

var applyExtends_1 = applyExtends;

// Call this function in a another function to find out the file from
// which that function was called from. (Inspects the v8 stack trace)
//
// Inspired by http://stackoverflow.com/questions/13227489
var getCallerFile = function getCallerFile(position) {
    if (position === void 0) { position = 2; }
    if (position >= Error.stackTraceLimit) {
        throw new TypeError('getCallerFile(position) requires position be less then Error.stackTraceLimit but position was: `' + position + '` and Error.stackTraceLimit was: `' + Error.stackTraceLimit + '`');
    }
    var oldPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) { return stack; };
    var stack = new Error().stack;
    Error.prepareStackTrace = oldPrepareStackTrace;
    if (stack !== null && typeof stack === 'object') {
        // stack[0] holds this file
        // stack[1] holds where this function was called
        // stack[2] holds the file we're interested in
        return stack[position] ? stack[position].getFileName() : undefined;
    }
};

const pTry = (fn, ...arguments_) => new Promise(resolve => {
	resolve(fn(...arguments_));
});

var pTry_1 = pTry;
// TODO: remove this in the next major version
var default_1$3 = pTry;
pTry_1.default = default_1$3;

const pLimit = concurrency => {
	if (!((Number.isInteger(concurrency) || concurrency === Infinity) && concurrency > 0)) {
		return Promise.reject(new TypeError('Expected `concurrency` to be a number from 1 and up'));
	}

	const queue = [];
	let activeCount = 0;

	const next = () => {
		activeCount--;

		if (queue.length > 0) {
			queue.shift()();
		}
	};

	const run = (fn, resolve, ...args) => {
		activeCount++;

		const result = pTry_1(fn, ...args);

		resolve(result);

		result.then(next, next);
	};

	const enqueue = (fn, resolve, ...args) => {
		if (activeCount < concurrency) {
			run(fn, resolve, ...args);
		} else {
			queue.push(run.bind(null, fn, resolve, ...args));
		}
	};

	const generator = (fn, ...args) => new Promise(resolve => enqueue(fn, resolve, ...args));
	Object.defineProperties(generator, {
		activeCount: {
			get: () => activeCount
		},
		pendingCount: {
			get: () => queue.length
		}
	});

	return generator;
};

var pLimit_1 = pLimit;
var default_1$4 = pLimit;
pLimit_1.default = default_1$4;

class EndError extends Error {
	constructor(value) {
		super();
		this.value = value;
	}
}

// The input can also be a promise, so we await it
const testElement = async (element, tester) => tester(await element);

// The input can also be a promise, so we `Promise.all()` them both
const finder = async element => {
	const values = await Promise.all(element);
	if (values[1] === true) {
		throw new EndError(values[0]);
	}

	return false;
};

const pLocate = async (iterable, tester, options) => {
	options = {
		concurrency: Infinity,
		preserveOrder: true,
		...options
	};

	const limit = pLimit_1(options.concurrency);

	// Start all the promises concurrently with optional limit
	const items = [...iterable].map(element => [element, limit(testElement, element, tester)]);

	// Check the promises either serially or concurrently
	const checkLimit = pLimit_1(options.preserveOrder ? 1 : Infinity);

	try {
		await Promise.all(items.map(element => checkLimit(finder, element)));
	} catch (error) {
		if (error instanceof EndError) {
			return error.value;
		}

		throw error;
	}
};

var pLocate_1 = pLocate;
// TODO: Remove this for the next major release
var default_1$5 = pLocate;
pLocate_1.default = default_1$5;

const {promisify} = logger$2.require$$0;


const fsStat = promisify(logger$2.fs.stat);
const fsLStat = promisify(logger$2.fs.lstat);

const typeMappings = {
	directory: 'isDirectory',
	file: 'isFile'
};

function checkType({type}) {
	if (type in typeMappings) {
		return;
	}

	throw new Error(`Invalid type specified: ${type}`);
}

const matchType = (type, stat) => type === undefined || stat[typeMappings[type]]();

var locatePath = async (paths, options) => {
	options = {
		cwd: process.cwd(),
		type: 'file',
		allowSymlinks: true,
		...options
	};
	checkType(options);
	const statFn = options.allowSymlinks ? fsStat : fsLStat;

	return pLocate_1(paths, async path_ => {
		try {
			const stat = await statFn(path$2__default.resolve(options.cwd, path_));
			return matchType(options.type, stat);
		} catch (_) {
			return false;
		}
	}, options);
};

var sync = (paths, options) => {
	options = {
		cwd: process.cwd(),
		allowSymlinks: true,
		type: 'file',
		...options
	};
	checkType(options);
	const statFn = options.allowSymlinks ? logger$2.fs.statSync : logger$2.fs.lstatSync;

	for (const path_ of paths) {
		try {
			const stat = statFn(path$2__default.resolve(options.cwd, path_));

			if (matchType(options.type, stat)) {
				return path_;
			}
		} catch (_) {
		}
	}
};
locatePath.sync = sync;

const {promisify: promisify$1} = logger$2.require$$0;

const pAccess = promisify$1(logger$2.fs.access);

var pathExists = async path => {
	try {
		await pAccess(path);
		return true;
	} catch (_) {
		return false;
	}
};

var sync$1 = path => {
	try {
		logger$2.fs.accessSync(path);
		return true;
	} catch (_) {
		return false;
	}
};
pathExists.sync = sync$1;

var findUp = logger$2.createCommonjsModule(function (module) {




const stop = Symbol('findUp.stop');

module.exports = async (name, options = {}) => {
	let directory = path$2__default.resolve(options.cwd || '');
	const {root} = path$2__default.parse(directory);
	const paths = [].concat(name);

	const runMatcher = async locateOptions => {
		if (typeof name !== 'function') {
			return locatePath(paths, locateOptions);
		}

		const foundPath = await name(locateOptions.cwd);
		if (typeof foundPath === 'string') {
			return locatePath([foundPath], locateOptions);
		}

		return foundPath;
	};

	// eslint-disable-next-line no-constant-condition
	while (true) {
		// eslint-disable-next-line no-await-in-loop
		const foundPath = await runMatcher({...options, cwd: directory});

		if (foundPath === stop) {
			return;
		}

		if (foundPath) {
			return path$2__default.resolve(directory, foundPath);
		}

		if (directory === root) {
			return;
		}

		directory = path$2__default.dirname(directory);
	}
};

module.exports.sync = (name, options = {}) => {
	let directory = path$2__default.resolve(options.cwd || '');
	const {root} = path$2__default.parse(directory);
	const paths = [].concat(name);

	const runMatcher = locateOptions => {
		if (typeof name !== 'function') {
			return locatePath.sync(paths, locateOptions);
		}

		const foundPath = name(locateOptions.cwd);
		if (typeof foundPath === 'string') {
			return locatePath.sync([foundPath], locateOptions);
		}

		return foundPath;
	};

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const foundPath = runMatcher({...options, cwd: directory});

		if (foundPath === stop) {
			return;
		}

		if (foundPath) {
			return path$2__default.resolve(directory, foundPath);
		}

		if (directory === root) {
			return;
		}

		directory = path$2__default.dirname(directory);
	}
};

module.exports.exists = pathExists;

module.exports.sync.exists = pathExists.sync;

module.exports.stop = stop;
});
var findUp_1 = findUp.sync;
var findUp_2 = findUp.exists;
var findUp_3 = findUp.stop;

var requireMainFilename = function (_require) {
  _require = _require || logger$2.commonjsRequire;
  var main = _require.main;
  if (main && isIISNode(main)) return handleIISNode(main)
  else return main ? main.filename : process.cwd()
};

function isIISNode (main) {
  return /\\iisnode\\/.test(main.filename)
}

function handleIISNode (main) {
  if (!main.children.length) {
    return main.filename
  } else {
    return main.children[0].filename
  }
}

var yargs = logger$2.createCommonjsModule(function (module, exports) {













const { globalMiddlewareFactory } = middleware;


exports = module.exports = Yargs;
function Yargs (processArgs, cwd, parentRequire) {
  processArgs = processArgs || []; // handle calling yargs().

  const self = {};
  let command$1 = null;
  let completion$1 = null;
  let groups = {};
  let globalMiddleware = [];
  let output = '';
  let preservedGroups = {};
  let usage$1 = null;
  let validation$1 = null;
  let handlerFinishCommand = null;

  const y18n$1 = y18n({
    directory: path$2__default.resolve(__dirname, './locales'),
    updateFiles: false
  });

  self.middleware = globalMiddlewareFactory(globalMiddleware, self);

  if (!cwd) cwd = process.cwd();

  self.scriptName = function (scriptName) {
    self.customScriptName = true;
    self.$0 = scriptName;
    return self
  };

  // ignore the node bin, specify this in your
  // bin file with #!/usr/bin/env node
  if (/\b(node|iojs|electron)(\.exe)?$/.test(process.argv[0])) {
    self.$0 = process.argv.slice(1, 2);
  } else {
    self.$0 = process.argv.slice(0, 1);
  }

  self.$0 = self.$0
    .map((x, i) => {
      const b = rebase(cwd, x);
      return x.match(/^(\/|([a-zA-Z]:)?\\)/) && b.length < x.length ? b : x
    })
    .join(' ').trim();

  if (process.env._ !== undefined && process.argv[1] === process.env._) {
    self.$0 = process.env._.replace(
      `${path$2__default.dirname(process.execPath)}/`, ''
    );
  }

  // use context object to keep track of resets, subcommand execution, etc
  // submodules should modify and check the state of context as necessary
  const context = { resets: -1, commands: [], fullCommands: [], files: [] };
  self.getContext = () => context;

  // puts yargs back into an initial state. any keys
  // that have been set to "global" will not be reset
  // by this action.
  let options;
  self.resetOptions = self.reset = function resetOptions (aliases) {
    context.resets++;
    aliases = aliases || {};
    options = options || {};
    // put yargs back into an initial state, this
    // logic is used to build a nested command
    // hierarchy.
    const tmpOptions = {};
    tmpOptions.local = options.local ? options.local : [];
    tmpOptions.configObjects = options.configObjects ? options.configObjects : [];

    // if a key has been explicitly set as local,
    // we should reset it before passing options to command.
    const localLookup = {};
    tmpOptions.local.forEach((l) => {
      localLookup[l] = true
      ;(aliases[l] || []).forEach((a) => {
        localLookup[a] = true;
      });
    });

    // add all groups not set to local to preserved groups
    Object.assign(
      preservedGroups,
      Object.keys(groups).reduce((acc, groupName) => {
        const keys = groups[groupName].filter(key => !(key in localLookup));
        if (keys.length > 0) {
          acc[groupName] = keys;
        }
        return acc
      }, {})
    );
    // groups can now be reset
    groups = {};

    const arrayOptions = [
      'array', 'boolean', 'string', 'skipValidation',
      'count', 'normalize', 'number',
      'hiddenOptions'
    ];

    const objectOptions = [
      'narg', 'key', 'alias', 'default', 'defaultDescription',
      'config', 'choices', 'demandedOptions', 'demandedCommands', 'coerce'
    ];

    arrayOptions.forEach((k) => {
      tmpOptions[k] = (options[k] || []).filter(k => !localLookup[k]);
    });

    objectOptions.forEach((k) => {
      tmpOptions[k] = objFilter(options[k], (k, v) => !localLookup[k]);
    });

    tmpOptions.envPrefix = options.envPrefix;
    options = tmpOptions;

    // if this is the first time being executed, create
    // instances of all our helpers -- otherwise just reset.
    usage$1 = usage$1 ? usage$1.reset(localLookup) : usage(self, y18n$1);
    validation$1 = validation$1 ? validation$1.reset(localLookup) : validation(self, usage$1, y18n$1);
    command$1 = command$1 ? command$1.reset() : command(self, usage$1, validation$1, globalMiddleware);
    if (!completion$1) completion$1 = completion(self, usage$1, command$1);

    completionCommand = null;
    output = '';
    exitError = null;
    hasOutput = false;
    self.parsed = false;

    return self
  };
  self.resetOptions();

  // temporary hack: allow "freezing" of reset-able state for parse(msg, cb)
  let frozens = [];
  function freeze () {
    let frozen = {};
    frozens.push(frozen);
    frozen.options = options;
    frozen.configObjects = options.configObjects.slice(0);
    frozen.exitProcess = exitProcess;
    frozen.groups = groups;
    usage$1.freeze();
    validation$1.freeze();
    command$1.freeze();
    frozen.strict = strict;
    frozen.completionCommand = completionCommand;
    frozen.output = output;
    frozen.exitError = exitError;
    frozen.hasOutput = hasOutput;
    frozen.parsed = self.parsed;
    frozen.parseFn = parseFn;
    frozen.parseContext = parseContext;
    frozen.handlerFinishCommand = handlerFinishCommand;
  }
  function unfreeze () {
    let frozen = frozens.pop();
    options = frozen.options;
    options.configObjects = frozen.configObjects;
    exitProcess = frozen.exitProcess;
    groups = frozen.groups;
    output = frozen.output;
    exitError = frozen.exitError;
    hasOutput = frozen.hasOutput;
    self.parsed = frozen.parsed;
    usage$1.unfreeze();
    validation$1.unfreeze();
    command$1.unfreeze();
    strict = frozen.strict;
    completionCommand = frozen.completionCommand;
    parseFn = frozen.parseFn;
    parseContext = frozen.parseContext;
    handlerFinishCommand = frozen.handlerFinishCommand;
  }

  self.boolean = function (keys) {
    argsert_1('<array|string>', [keys], arguments.length);
    populateParserHintArray('boolean', keys);
    return self
  };

  self.array = function (keys) {
    argsert_1('<array|string>', [keys], arguments.length);
    populateParserHintArray('array', keys);
    return self
  };

  self.number = function (keys) {
    argsert_1('<array|string>', [keys], arguments.length);
    populateParserHintArray('number', keys);
    return self
  };

  self.normalize = function (keys) {
    argsert_1('<array|string>', [keys], arguments.length);
    populateParserHintArray('normalize', keys);
    return self
  };

  self.count = function (keys) {
    argsert_1('<array|string>', [keys], arguments.length);
    populateParserHintArray('count', keys);
    return self
  };

  self.string = function (keys) {
    argsert_1('<array|string>', [keys], arguments.length);
    populateParserHintArray('string', keys);
    return self
  };

  self.requiresArg = function (keys) {
    argsert_1('<array|string>', [keys], arguments.length);
    populateParserHintObject(self.nargs, false, 'narg', keys, 1);
    return self
  };

  self.skipValidation = function (keys) {
    argsert_1('<array|string>', [keys], arguments.length);
    populateParserHintArray('skipValidation', keys);
    return self
  };

  function populateParserHintArray (type, keys, value) {
    keys = [].concat(keys);
    keys.forEach((key) => {
      options[type].push(key);
    });
  }

  self.nargs = function (key, value) {
    argsert_1('<string|object|array> [number]', [key, value], arguments.length);
    populateParserHintObject(self.nargs, false, 'narg', key, value);
    return self
  };

  self.choices = function (key, value) {
    argsert_1('<object|string|array> [string|array]', [key, value], arguments.length);
    populateParserHintObject(self.choices, true, 'choices', key, value);
    return self
  };

  self.alias = function (key, value) {
    argsert_1('<object|string|array> [string|array]', [key, value], arguments.length);
    populateParserHintObject(self.alias, true, 'alias', key, value);
    return self
  };

  // TODO: actually deprecate self.defaults.
  self.default = self.defaults = function (key, value, defaultDescription) {
    argsert_1('<object|string|array> [*] [string]', [key, value, defaultDescription], arguments.length);
    if (defaultDescription) options.defaultDescription[key] = defaultDescription;
    if (typeof value === 'function') {
      if (!options.defaultDescription[key]) options.defaultDescription[key] = usage$1.functionDescription(value);
      value = value.call();
    }
    populateParserHintObject(self.default, false, 'default', key, value);
    return self
  };

  self.describe = function (key, desc) {
    argsert_1('<object|string|array> [string]', [key, desc], arguments.length);
    populateParserHintObject(self.describe, false, 'key', key, true);
    usage$1.describe(key, desc);
    return self
  };

  self.demandOption = function (keys, msg) {
    argsert_1('<object|string|array> [string]', [keys, msg], arguments.length);
    populateParserHintObject(self.demandOption, false, 'demandedOptions', keys, msg);
    return self
  };

  self.coerce = function (keys, value) {
    argsert_1('<object|string|array> [function]', [keys, value], arguments.length);
    populateParserHintObject(self.coerce, false, 'coerce', keys, value);
    return self
  };

  function populateParserHintObject (builder, isArray, type, key, value) {
    if (Array.isArray(key)) {
      // an array of keys with one value ['x', 'y', 'z'], function parse () {}
      const temp = {};
      key.forEach((k) => {
        temp[k] = value;
      });
      builder(temp);
    } else if (typeof key === 'object') {
      // an object of key value pairs: {'x': parse () {}, 'y': parse() {}}
      Object.keys(key).forEach((k) => {
        builder(k, key[k]);
      });
    } else {
      // a single key value pair 'x', parse() {}
      if (isArray) {
        options[type][key] = (options[type][key] || []).concat(value);
      } else {
        options[type][key] = value;
      }
    }
  }

  function deleteFromParserHintObject (optionKey) {
    // delete from all parsing hints:
    // boolean, array, key, alias, etc.
    Object.keys(options).forEach((hintKey) => {
      const hint = options[hintKey];
      if (Array.isArray(hint)) {
        if (~hint.indexOf(optionKey)) hint.splice(hint.indexOf(optionKey), 1);
      } else if (typeof hint === 'object') {
        delete hint[optionKey];
      }
    });
    // now delete the description from usage.js.
    delete usage$1.getDescriptions()[optionKey];
  }

  self.config = function config (key, msg, parseFn) {
    argsert_1('[object|string] [string|function] [function]', [key, msg, parseFn], arguments.length);
    // allow a config object to be provided directly.
    if (typeof key === 'object') {
      key = applyExtends_1(key, cwd, self.getParserConfiguration()['deep-merge-config']);
      options.configObjects = (options.configObjects || []).concat(key);
      return self
    }

    // allow for a custom parsing function.
    if (typeof msg === 'function') {
      parseFn = msg;
      msg = null;
    }

    key = key || 'config';
    self.describe(key, msg || usage$1.deferY18nLookup('Path to JSON config file'))
    ;(Array.isArray(key) ? key : [key]).forEach((k) => {
      options.config[k] = parseFn || true;
    });

    return self
  };

  self.example = function (cmd, description) {
    argsert_1('<string> [string]', [cmd, description], arguments.length);
    usage$1.example(cmd, description);
    return self
  };

  self.command = function (cmd, description, builder, handler, middlewares) {
    argsert_1('<string|array|object> [string|boolean] [function|object] [function] [array]', [cmd, description, builder, handler, middlewares], arguments.length);
    command$1.addHandler(cmd, description, builder, handler, middlewares);
    return self
  };

  self.commandDir = function (dir, opts) {
    argsert_1('<string> [object]', [dir, opts], arguments.length);
    const req = parentRequire || logger$2.commonjsRequire;
    command$1.addDirectory(dir, self.getContext(), req, getCallerFile(), opts);
    return self
  };

  // TODO: deprecate self.demand in favor of
  // .demandCommand() .demandOption().
  self.demand = self.required = self.require = function demand (keys, max, msg) {
    // you can optionally provide a 'max' key,
    // which will raise an exception if too many '_'
    // options are provided.
    if (Array.isArray(max)) {
      max.forEach((key) => {
        self.demandOption(key, msg);
      });
      max = Infinity;
    } else if (typeof max !== 'number') {
      msg = max;
      max = Infinity;
    }

    if (typeof keys === 'number') {
      self.demandCommand(keys, max, msg, msg);
    } else if (Array.isArray(keys)) {
      keys.forEach((key) => {
        self.demandOption(key, msg);
      });
    } else {
      if (typeof msg === 'string') {
        self.demandOption(keys, msg);
      } else if (msg === true || typeof msg === 'undefined') {
        self.demandOption(keys);
      }
    }

    return self
  };

  self.demandCommand = function demandCommand (min, max, minMsg, maxMsg) {
    argsert_1('[number] [number|string] [string|null|undefined] [string|null|undefined]', [min, max, minMsg, maxMsg], arguments.length);

    if (typeof min === 'undefined') min = 1;

    if (typeof max !== 'number') {
      minMsg = max;
      max = Infinity;
    }

    self.global('_', false);

    options.demandedCommands._ = {
      min,
      max,
      minMsg,
      maxMsg
    };

    return self
  };

  self.getDemandedOptions = () => {
    argsert_1([], 0);
    return options.demandedOptions
  };

  self.getDemandedCommands = () => {
    argsert_1([], 0);
    return options.demandedCommands
  };

  self.implies = function (key, value) {
    argsert_1('<string|object> [number|string|array]', [key, value], arguments.length);
    validation$1.implies(key, value);
    return self
  };

  self.conflicts = function (key1, key2) {
    argsert_1('<string|object> [string|array]', [key1, key2], arguments.length);
    validation$1.conflicts(key1, key2);
    return self
  };

  self.usage = function (msg, description, builder, handler) {
    argsert_1('<string|null|undefined> [string|boolean] [function|object] [function]', [msg, description, builder, handler], arguments.length);

    if (description !== undefined) {
      // .usage() can be used as an alias for defining
      // a default command.
      if ((msg || '').match(/^\$0( |$)/)) {
        return self.command(msg, description, builder, handler)
      } else {
        throw new yerror('.usage() description must start with $0 if being used as alias for .command()')
      }
    } else {
      usage$1.usage(msg);
      return self
    }
  };

  self.epilogue = self.epilog = function (msg) {
    argsert_1('<string>', [msg], arguments.length);
    usage$1.epilog(msg);
    return self
  };

  self.fail = function (f) {
    argsert_1('<function>', [f], arguments.length);
    usage$1.failFn(f);
    return self
  };

  self.onFinishCommand = function (f) {
    argsert_1('<function>', [f], arguments.length);
    handlerFinishCommand = f;
    return self
  };

  self.getHandlerFinishCommand = () => handlerFinishCommand;

  self.check = function (f, _global) {
    argsert_1('<function> [boolean]', [f, _global], arguments.length);
    validation$1.check(f, _global !== false);
    return self
  };

  self.global = function global (globals, global) {
    argsert_1('<string|array> [boolean]', [globals, global], arguments.length);
    globals = [].concat(globals);
    if (global !== false) {
      options.local = options.local.filter(l => globals.indexOf(l) === -1);
    } else {
      globals.forEach((g) => {
        if (options.local.indexOf(g) === -1) options.local.push(g);
      });
    }
    return self
  };

  self.pkgConf = function pkgConf (key, rootPath) {
    argsert_1('<string> [string]', [key, rootPath], arguments.length);
    let conf = null;
    // prefer cwd to require-main-filename in this method
    // since we're looking for e.g. "nyc" config in nyc consumer
    // rather than "yargs" config in nyc (where nyc is the main filename)
    const obj = pkgUp(rootPath || cwd);

    // If an object exists in the key, add it to options.configObjects
    if (obj[key] && typeof obj[key] === 'object') {
      conf = applyExtends_1(obj[key], rootPath || cwd, self.getParserConfiguration()['deep-merge-config']);
      options.configObjects = (options.configObjects || []).concat(conf);
    }

    return self
  };

  const pkgs = {};
  function pkgUp (rootPath) {
    const npath = rootPath || '*';
    if (pkgs[npath]) return pkgs[npath]
    const findUp$1 = findUp;

    let obj = {};
    try {
      let startDir = rootPath || requireMainFilename(parentRequire || logger$2.commonjsRequire);

      // When called in an environment that lacks require.main.filename, such as a jest test runner,
      // startDir is already process.cwd(), and should not be shortened.
      // Whether or not it is _actually_ a directory (e.g., extensionless bin) is irrelevant, find-up handles it.
      if (!rootPath && path$2__default.extname(startDir)) {
        startDir = path$2__default.dirname(startDir);
      }

      const pkgJsonPath = findUp$1.sync('package.json', {
        cwd: startDir
      });
      obj = JSON.parse(logger$2.fs.readFileSync(pkgJsonPath));
    } catch (noop) {}

    pkgs[npath] = obj || {};
    return pkgs[npath]
  }

  let parseFn = null;
  let parseContext = null;
  self.parse = function parse (args, shortCircuit, _parseFn) {
    argsert_1('[string|array] [function|boolean|object] [function]', [args, shortCircuit, _parseFn], arguments.length);
    freeze();
    if (typeof args === 'undefined') {
      const argv = self._parseArgs(processArgs);
      const tmpParsed = self.parsed;
      unfreeze();
      // TODO: remove this compatibility hack when we release yargs@15.x:
      self.parsed = tmpParsed;
      return argv
    }

    // a context object can optionally be provided, this allows
    // additional information to be passed to a command handler.
    if (typeof shortCircuit === 'object') {
      parseContext = shortCircuit;
      shortCircuit = _parseFn;
    }

    // by providing a function as a second argument to
    // parse you can capture output that would otherwise
    // default to printing to stdout/stderr.
    if (typeof shortCircuit === 'function') {
      parseFn = shortCircuit;
      shortCircuit = null;
    }
    // completion short-circuits the parsing process,
    // skipping validation, etc.
    if (!shortCircuit) processArgs = args;

    if (parseFn) exitProcess = false;

    const parsed = self._parseArgs(args, shortCircuit);
    completion$1.setParsed(self.parsed);
    if (parseFn) parseFn(exitError, parsed, output);
    unfreeze();

    return parsed
  };

  self._getParseContext = () => parseContext || {};

  self._hasParseCallback = () => !!parseFn;

  self.option = self.options = function option (key, opt) {
    argsert_1('<string|object> [object]', [key, opt], arguments.length);
    if (typeof key === 'object') {
      Object.keys(key).forEach((k) => {
        self.options(k, key[k]);
      });
    } else {
      if (typeof opt !== 'object') {
        opt = {};
      }

      options.key[key] = true; // track manually set keys.

      if (opt.alias) self.alias(key, opt.alias);

      const demand = opt.demand || opt.required || opt.require;

      // A required option can be specified via "demand: true".
      if (demand) {
        self.demand(key, demand);
      }

      if (opt.demandOption) {
        self.demandOption(key, typeof opt.demandOption === 'string' ? opt.demandOption : undefined);
      }

      if ('conflicts' in opt) {
        self.conflicts(key, opt.conflicts);
      }

      if ('default' in opt) {
        self.default(key, opt.default);
      }

      if ('implies' in opt) {
        self.implies(key, opt.implies);
      }

      if ('nargs' in opt) {
        self.nargs(key, opt.nargs);
      }

      if (opt.config) {
        self.config(key, opt.configParser);
      }

      if (opt.normalize) {
        self.normalize(key);
      }

      if ('choices' in opt) {
        self.choices(key, opt.choices);
      }

      if ('coerce' in opt) {
        self.coerce(key, opt.coerce);
      }

      if ('group' in opt) {
        self.group(key, opt.group);
      }

      if (opt.boolean || opt.type === 'boolean') {
        self.boolean(key);
        if (opt.alias) self.boolean(opt.alias);
      }

      if (opt.array || opt.type === 'array') {
        self.array(key);
        if (opt.alias) self.array(opt.alias);
      }

      if (opt.number || opt.type === 'number') {
        self.number(key);
        if (opt.alias) self.number(opt.alias);
      }

      if (opt.string || opt.type === 'string') {
        self.string(key);
        if (opt.alias) self.string(opt.alias);
      }

      if (opt.count || opt.type === 'count') {
        self.count(key);
      }

      if (typeof opt.global === 'boolean') {
        self.global(key, opt.global);
      }

      if (opt.defaultDescription) {
        options.defaultDescription[key] = opt.defaultDescription;
      }

      if (opt.skipValidation) {
        self.skipValidation(key);
      }

      const desc = opt.describe || opt.description || opt.desc;
      self.describe(key, desc);
      if (opt.hidden) {
        self.hide(key);
      }

      if (opt.requiresArg) {
        self.requiresArg(key);
      }
    }

    return self
  };
  self.getOptions = () => options;

  self.positional = function (key, opts) {
    argsert_1('<string> <object>', [key, opts], arguments.length);
    if (context.resets === 0) {
      throw new yerror(".positional() can only be called in a command's builder function")
    }

    // .positional() only supports a subset of the configuration
    // options available to .option().
    const supportedOpts = ['default', 'defaultDescription', 'implies', 'normalize',
      'choices', 'conflicts', 'coerce', 'type', 'describe',
      'desc', 'description', 'alias'];
    opts = objFilter(opts, (k, v) => {
      let accept = supportedOpts.indexOf(k) !== -1;
      // type can be one of string|number|boolean.
      if (k === 'type' && ['string', 'number', 'boolean'].indexOf(v) === -1) accept = false;
      return accept
    });

    // copy over any settings that can be inferred from the command string.
    const fullCommand = context.fullCommands[context.fullCommands.length - 1];
    const parseOptions = fullCommand ? command$1.cmdToParseOptions(fullCommand) : {
      array: [],
      alias: {},
      default: {},
      demand: {}
    };
    Object.keys(parseOptions).forEach((pk) => {
      if (Array.isArray(parseOptions[pk])) {
        if (parseOptions[pk].indexOf(key) !== -1) opts[pk] = true;
      } else {
        if (parseOptions[pk][key] && !(pk in opts)) opts[pk] = parseOptions[pk][key];
      }
    });
    self.group(key, usage$1.getPositionalGroupName());
    return self.option(key, opts)
  };

  self.group = function group (opts, groupName) {
    argsert_1('<string|array> <string>', [opts, groupName], arguments.length);
    const existing = preservedGroups[groupName] || groups[groupName];
    if (preservedGroups[groupName]) {
      // we now only need to track this group name in groups.
      delete preservedGroups[groupName];
    }

    const seen = {};
    groups[groupName] = (existing || []).concat(opts).filter((key) => {
      if (seen[key]) return false
      return (seen[key] = true)
    });
    return self
  };
  // combine explicit and preserved groups. explicit groups should be first
  self.getGroups = () => Object.assign({}, groups, preservedGroups);

  // as long as options.envPrefix is not undefined,
  // parser will apply env vars matching prefix to argv
  self.env = function (prefix) {
    argsert_1('[string|boolean]', [prefix], arguments.length);
    if (prefix === false) options.envPrefix = undefined;
    else options.envPrefix = prefix || '';
    return self
  };

  self.wrap = function (cols) {
    argsert_1('<number|null|undefined>', [cols], arguments.length);
    usage$1.wrap(cols);
    return self
  };

  let strict = false;
  self.strict = function (enabled) {
    argsert_1('[boolean]', [enabled], arguments.length);
    strict = enabled !== false;
    return self
  };
  self.getStrict = () => strict;

  let parserConfig = {};
  self.parserConfiguration = function parserConfiguration (config) {
    argsert_1('<object>', [config], arguments.length);
    parserConfig = config;
    return self
  };
  self.getParserConfiguration = () => parserConfig;

  self.showHelp = function (level) {
    argsert_1('[string|function]', [level], arguments.length);
    if (!self.parsed) self._parseArgs(processArgs); // run parser, if it has not already been executed.
    if (command$1.hasDefaultCommand()) {
      context.resets++; // override the restriction on top-level positoinals.
      command$1.runDefaultBuilderOn(self, true);
    }
    usage$1.showHelp(level);
    return self
  };

  let versionOpt = null;
  self.version = function version (opt, msg, ver) {
    const defaultVersionOpt = 'version';
    argsert_1('[boolean|string] [string] [string]', [opt, msg, ver], arguments.length);

    // nuke the key previously configured
    // to return version #.
    if (versionOpt) {
      deleteFromParserHintObject(versionOpt);
      usage$1.version(undefined);
      versionOpt = null;
    }

    if (arguments.length === 0) {
      ver = guessVersion();
      opt = defaultVersionOpt;
    } else if (arguments.length === 1) {
      if (opt === false) { // disable default 'version' key.
        return self
      }
      ver = opt;
      opt = defaultVersionOpt;
    } else if (arguments.length === 2) {
      ver = msg;
      msg = null;
    }

    versionOpt = typeof opt === 'string' ? opt : defaultVersionOpt;
    msg = msg || usage$1.deferY18nLookup('Show version number');

    usage$1.version(ver || undefined);
    self.boolean(versionOpt);
    self.describe(versionOpt, msg);
    return self
  };

  function guessVersion () {
    const obj = pkgUp();

    return obj.version || 'unknown'
  }

  let helpOpt = null;
  self.addHelpOpt = self.help = function addHelpOpt (opt, msg) {
    const defaultHelpOpt = 'help';
    argsert_1('[string|boolean] [string]', [opt, msg], arguments.length);

    // nuke the key previously configured
    // to return help.
    if (helpOpt) {
      deleteFromParserHintObject(helpOpt);
      helpOpt = null;
    }

    if (arguments.length === 1) {
      if (opt === false) return self
    }

    // use arguments, fallback to defaults for opt and msg
    helpOpt = typeof opt === 'string' ? opt : defaultHelpOpt;
    self.boolean(helpOpt);
    self.describe(helpOpt, msg || usage$1.deferY18nLookup('Show help'));
    return self
  };

  const defaultShowHiddenOpt = 'show-hidden';
  options.showHiddenOpt = defaultShowHiddenOpt;
  self.addShowHiddenOpt = self.showHidden = function addShowHiddenOpt (opt, msg) {
    argsert_1('[string|boolean] [string]', [opt, msg], arguments.length);

    if (arguments.length === 1) {
      if (opt === false) return self
    }

    const showHiddenOpt = typeof opt === 'string' ? opt : defaultShowHiddenOpt;
    self.boolean(showHiddenOpt);
    self.describe(showHiddenOpt, msg || usage$1.deferY18nLookup('Show hidden options'));
    options.showHiddenOpt = showHiddenOpt;
    return self
  };

  self.hide = function hide (key) {
    argsert_1('<string|object>', [key], arguments.length);
    options.hiddenOptions.push(key);
    return self
  };

  self.showHelpOnFail = function showHelpOnFail (enabled, message) {
    argsert_1('[boolean|string] [string]', [enabled, message], arguments.length);
    usage$1.showHelpOnFail(enabled, message);
    return self
  };

  var exitProcess = true;
  self.exitProcess = function (enabled) {
    argsert_1('[boolean]', [enabled], arguments.length);
    if (typeof enabled !== 'boolean') {
      enabled = true;
    }
    exitProcess = enabled;
    return self
  };
  self.getExitProcess = () => exitProcess;

  var completionCommand = null;
  self.completion = function (cmd, desc, fn) {
    argsert_1('[string] [string|boolean|function] [function]', [cmd, desc, fn], arguments.length);

    // a function to execute when generating
    // completions can be provided as the second
    // or third argument to completion.
    if (typeof desc === 'function') {
      fn = desc;
      desc = null;
    }

    // register the completion command.
    completionCommand = cmd || completionCommand || 'completion';
    if (!desc && desc !== false) {
      desc = 'generate completion script';
    }
    self.command(completionCommand, desc);

    // a function can be provided
    if (fn) completion$1.registerFunction(fn);

    return self
  };

  self.showCompletionScript = function ($0, cmd) {
    argsert_1('[string] [string]', [$0, cmd], arguments.length);
    $0 = $0 || self.$0;
    _logger.log(completion$1.generateCompletionScript($0, cmd || completionCommand || 'completion'));
    return self
  };

  self.getCompletion = function (args, done) {
    argsert_1('<array> <function>', [args, done], arguments.length);
    completion$1.getCompletion(args, done);
  };

  self.locale = function (locale) {
    argsert_1('[string]', [locale], arguments.length);
    if (arguments.length === 0) {
      guessLocale();
      return y18n$1.getLocale()
    }
    detectLocale = false;
    y18n$1.setLocale(locale);
    return self
  };

  self.updateStrings = self.updateLocale = function (obj) {
    argsert_1('<object>', [obj], arguments.length);
    detectLocale = false;
    y18n$1.updateLocale(obj);
    return self
  };

  let detectLocale = true;
  self.detectLocale = function (detect) {
    argsert_1('<boolean>', [detect], arguments.length);
    detectLocale = detect;
    return self
  };
  self.getDetectLocale = () => detectLocale;

  var hasOutput = false;
  var exitError = null;
  // maybe exit, always capture
  // context about why we wanted to exit.
  self.exit = (code, err) => {
    hasOutput = true;
    exitError = err;
    if (exitProcess) process.exit(code);
  };

  // we use a custom logger that buffers output,
  // so that we can print to non-CLIs, e.g., chat-bots.
  const _logger = {
    log () {
      const args = [];
      for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
      if (!self._hasParseCallback()) console.log.apply(console, args);
      hasOutput = true;
      if (output.length) output += '\n';
      output += args.join(' ');
    },
    error () {
      const args = [];
      for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
      if (!self._hasParseCallback()) console.error.apply(console, args);
      hasOutput = true;
      if (output.length) output += '\n';
      output += args.join(' ');
    }
  };
  self._getLoggerInstance = () => _logger;
  // has yargs output an error our help
  // message in the current execution context.
  self._hasOutput = () => hasOutput;

  self._setHasOutput = () => {
    hasOutput = true;
  };

  let recommendCommands;
  self.recommendCommands = function (recommend) {
    argsert_1('[boolean]', [recommend], arguments.length);
    recommendCommands = typeof recommend === 'boolean' ? recommend : true;
    return self
  };

  self.getUsageInstance = () => usage$1;

  self.getValidationInstance = () => validation$1;

  self.getCommandInstance = () => command$1;

  self.terminalWidth = () => {
    argsert_1([], 0);
    return typeof process.stdout.columns !== 'undefined' ? process.stdout.columns : null
  };

  Object.defineProperty(self, 'argv', {
    get: () => self._parseArgs(processArgs),
    enumerable: true
  });

  self._parseArgs = function parseArgs (args, shortCircuit, _calledFromCommand, commandIndex) {
    let skipValidation = !!_calledFromCommand;
    args = args || processArgs;

    options.__ = y18n$1.__;
    options.configuration = self.getParserConfiguration();

    const populateDoubleDash = !!options.configuration['populate--'];
    const config = Object.assign({}, options.configuration, {
      'populate--': true
    });
    const parsed = yargsParser.detailed(args, Object.assign({}, options, {
      configuration: config
    }));

    let argv = parsed.argv;
    if (parseContext) argv = Object.assign({}, argv, parseContext);
    const aliases = parsed.aliases;

    argv.$0 = self.$0;
    self.parsed = parsed;

    try {
      guessLocale(); // guess locale lazily, so that it can be turned off in chain.

      // while building up the argv object, there
      // are two passes through the parser. If completion
      // is being performed short-circuit on the first pass.
      if (shortCircuit) {
        return (populateDoubleDash || _calledFromCommand) ? argv : self._copyDoubleDash(argv)
      }

      // if there's a handler associated with a
      // command defer processing to it.
      if (helpOpt) {
        // consider any multi-char helpOpt alias as a valid help command
        // unless all helpOpt aliases are single-char
        // note that parsed.aliases is a normalized bidirectional map :)
        const helpCmds = [helpOpt]
          .concat(aliases[helpOpt] || [])
          .filter(k => k.length > 1);
        // check if help should trigger and strip it from _.
        if (~helpCmds.indexOf(argv._[argv._.length - 1])) {
          argv._.pop();
          argv[helpOpt] = true;
        }
      }

      const handlerKeys = command$1.getCommands();
      const requestCompletions = completion$1.completionKey in argv;
      const skipRecommendation = argv[helpOpt] || requestCompletions;
      const skipDefaultCommand = skipRecommendation && (handlerKeys.length > 1 || handlerKeys[0] !== '$0');

      if (argv._.length) {
        if (handlerKeys.length) {
          let firstUnknownCommand;
          for (let i = (commandIndex || 0), cmd; argv._[i] !== undefined; i++) {
            cmd = String(argv._[i]);
            if (~handlerKeys.indexOf(cmd) && cmd !== completionCommand) {
              // commands are executed using a recursive algorithm that executes
              // the deepest command first; we keep track of the position in the
              // argv._ array that is currently being executed.
              const innerArgv = command$1.runCommand(cmd, self, parsed, i + 1);
              return populateDoubleDash ? innerArgv : self._copyDoubleDash(innerArgv)
            } else if (!firstUnknownCommand && cmd !== completionCommand) {
              firstUnknownCommand = cmd;
              break
            }
          }

          // run the default command, if defined
          if (command$1.hasDefaultCommand() && !skipDefaultCommand) {
            const innerArgv = command$1.runCommand(null, self, parsed);
            return populateDoubleDash ? innerArgv : self._copyDoubleDash(innerArgv)
          }

          // recommend a command if recommendCommands() has
          // been enabled, and no commands were found to execute
          if (recommendCommands && firstUnknownCommand && !skipRecommendation) {
            validation$1.recommendCommands(firstUnknownCommand, handlerKeys);
          }
        }

        // generate a completion script for adding to ~/.bashrc.
        if (completionCommand && ~argv._.indexOf(completionCommand) && !requestCompletions) {
          if (exitProcess) setBlocking(true);
          self.showCompletionScript();
          self.exit(0);
        }
      } else if (command$1.hasDefaultCommand() && !skipDefaultCommand) {
        const innerArgv = command$1.runCommand(null, self, parsed);
        return populateDoubleDash ? innerArgv : self._copyDoubleDash(innerArgv)
      }

      // we must run completions first, a user might
      // want to complete the --help or --version option.
      if (requestCompletions) {
        if (exitProcess) setBlocking(true);

        // we allow for asynchronous completions,
        // e.g., loading in a list of commands from an API.
        const completionArgs = args.slice(args.indexOf(`--${completion$1.completionKey}`) + 1);
        completion$1.getCompletion(completionArgs, (completions) => {
          ;(completions || []).forEach((completion) => {
            _logger.log(completion);
          });

          self.exit(0);
        });
        return (populateDoubleDash || _calledFromCommand) ? argv : self._copyDoubleDash(argv)
      }

      // Handle 'help' and 'version' options
      // if we haven't already output help!
      if (!hasOutput) {
        Object.keys(argv).forEach((key) => {
          if (key === helpOpt && argv[key]) {
            if (exitProcess) setBlocking(true);

            skipValidation = true;
            self.showHelp('log');
            self.exit(0);
          } else if (key === versionOpt && argv[key]) {
            if (exitProcess) setBlocking(true);

            skipValidation = true;
            usage$1.showVersion();
            self.exit(0);
          }
        });
      }

      // Check if any of the options to skip validation were provided
      if (!skipValidation && options.skipValidation.length > 0) {
        skipValidation = Object.keys(argv).some(key => options.skipValidation.indexOf(key) >= 0 && argv[key] === true);
      }

      // If the help or version options where used and exitProcess is false,
      // or if explicitly skipped, we won't run validations.
      if (!skipValidation) {
        if (parsed.error) throw new yerror(parsed.error.message)

        // if we're executed via bash completion, don't
        // bother with validation.
        if (!requestCompletions) {
          self._runValidation(argv, aliases, {}, parsed.error);
        }
      }
    } catch (err) {
      if (err instanceof yerror) usage$1.fail(err.message, err);
      else throw err
    }

    return (populateDoubleDash || _calledFromCommand) ? argv : self._copyDoubleDash(argv)
  };

  // to simplify the parsing of positionals in commands,
  // we temporarily populate '--' rather than _, with arguments
  // after the '--' directive. After the parse, we copy these back.
  self._copyDoubleDash = function (argv) {
    if (!argv._ || !argv['--']) return argv
    argv._.push.apply(argv._, argv['--']);

    // TODO(bcoe): refactor command parsing such that this delete is not
    // necessary: https://github.com/yargs/yargs/issues/1482
    try {
      delete argv['--'];
    } catch (_err) {}

    return argv
  };

  self._runValidation = function runValidation (argv, aliases, positionalMap, parseErrors) {
    if (parseErrors) throw new yerror(parseErrors.message)
    validation$1.nonOptionCount(argv);
    validation$1.requiredArguments(argv);
    if (strict) validation$1.unknownArguments(argv, aliases, positionalMap);
    validation$1.customChecks(argv, aliases);
    validation$1.limitedChoices(argv);
    validation$1.implications(argv);
    validation$1.conflicting(argv);
  };

  function guessLocale () {
    if (!detectLocale) return
    const locale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || process.env.LANGUAGE || 'en_US';
    self.locale(locale.replace(/[.:].*/, ''));
  }

  // an app should almost always have --version and --help,
  // if you *really* want to disable this use .help(false)/.version(false).
  self.help();
  self.version();

  return self
}

// allow consumers to directly use the version of yargs-parser used by yargs
exports.Parser = yargsParser;

// rebase an absolute path to a relative one with respect to a base directory
// exported for tests
exports.rebase = rebase;
function rebase (base, dir) {
  return path$2__default.relative(base, dir)
}
});
var yargs_1 = yargs.Parser;
var yargs_2 = yargs.rebase;

// classic singleton yargs API, to use yargs
// without running as a singleton do:
// require('yargs/yargs')(process.argv.slice(2))


Argv(process.argv.slice(2));

var yargs_1$1 = Argv;

function Argv (processArgs, cwd) {
  const argv = yargs(processArgs, cwd, logger$2.commonjsRequire);
  singletonify(argv);
  return argv
}

/*  Hack an instance of Argv with process.argv into Argv
    so people can do
    require('yargs')(['--beeble=1','-z','zizzle']).argv
    to parse a list of args and
    require('yargs').argv
    to get a parsed version of process.argv.
*/
function singletonify (inst) {
  Object.keys(inst).forEach((key) => {
    if (key === 'argv') {
      Argv.__defineGetter__(key, inst.__lookupGetter__(key));
    } else if (typeof inst[key] === 'function') {
      Argv[key] = inst[key].bind(inst);
    } else {
      Argv.__defineGetter__('$0', () => {
        return inst.$0
      });
      Argv.__defineGetter__('parsed', () => {
        return inst.parsed
      });
    }
  });
}

var ansiStyles$1 = logger$2.createCommonjsModule(function (module) {

const wrapAnsi16 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${code + offset}m`;
};

const wrapAnsi256 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${38 + offset};5;${code}m`;
};

const wrapAnsi16m = (fn, offset) => (...args) => {
	const rgb = fn(...args);
	return `\u001B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
};

const ansi2ansi = n => n;
const rgb2rgb = (r, g, b) => [r, g, b];

const setLazyProperty = (object, property, get) => {
	Object.defineProperty(object, property, {
		get: () => {
			const value = get();

			Object.defineProperty(object, property, {
				value,
				enumerable: true,
				configurable: true
			});

			return value;
		},
		enumerable: true,
		configurable: true
	});
};

/** @type {typeof import('color-convert')} */
let colorConvert$1;
const makeDynamicStyles = (wrap, targetSpace, identity, isBackground) => {
	if (colorConvert$1 === undefined) {
		colorConvert$1 = colorConvert;
	}

	const offset = isBackground ? 10 : 0;
	const styles = {};

	for (const [sourceSpace, suite] of Object.entries(colorConvert$1)) {
		const name = sourceSpace === 'ansi16' ? 'ansi' : sourceSpace;
		if (sourceSpace === targetSpace) {
			styles[name] = wrap(identity, offset);
		} else if (typeof suite === 'object') {
			styles[name] = wrap(suite[targetSpace], offset);
		}
	}

	return styles;
};

function assembleStyles() {
	const codes = new Map();
	const styles = {
		modifier: {
			reset: [0, 0],
			// 21 isn't widely supported and 22 does the same thing
			bold: [1, 22],
			dim: [2, 22],
			italic: [3, 23],
			underline: [4, 24],
			inverse: [7, 27],
			hidden: [8, 28],
			strikethrough: [9, 29]
		},
		color: {
			black: [30, 39],
			red: [31, 39],
			green: [32, 39],
			yellow: [33, 39],
			blue: [34, 39],
			magenta: [35, 39],
			cyan: [36, 39],
			white: [37, 39],

			// Bright color
			blackBright: [90, 39],
			redBright: [91, 39],
			greenBright: [92, 39],
			yellowBright: [93, 39],
			blueBright: [94, 39],
			magentaBright: [95, 39],
			cyanBright: [96, 39],
			whiteBright: [97, 39]
		},
		bgColor: {
			bgBlack: [40, 49],
			bgRed: [41, 49],
			bgGreen: [42, 49],
			bgYellow: [43, 49],
			bgBlue: [44, 49],
			bgMagenta: [45, 49],
			bgCyan: [46, 49],
			bgWhite: [47, 49],

			// Bright color
			bgBlackBright: [100, 49],
			bgRedBright: [101, 49],
			bgGreenBright: [102, 49],
			bgYellowBright: [103, 49],
			bgBlueBright: [104, 49],
			bgMagentaBright: [105, 49],
			bgCyanBright: [106, 49],
			bgWhiteBright: [107, 49]
		}
	};

	// Alias bright black as gray (and grey)
	styles.color.gray = styles.color.blackBright;
	styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
	styles.color.grey = styles.color.blackBright;
	styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;

	for (const [groupName, group] of Object.entries(styles)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`
			};

			group[styleName] = styles[styleName];

			codes.set(style[0], style[1]);
		}

		Object.defineProperty(styles, groupName, {
			value: group,
			enumerable: false
		});
	}

	Object.defineProperty(styles, 'codes', {
		value: codes,
		enumerable: false
	});

	styles.color.close = '\u001B[39m';
	styles.bgColor.close = '\u001B[49m';

	setLazyProperty(styles.color, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, false));
	setLazyProperty(styles.bgColor, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, true));

	return styles;
}

// Make the export immutable
Object.defineProperty(module, 'exports', {
	enumerable: true,
	get: assembleStyles
});
});

const stringReplaceAll = (string, substring, replacer) => {
	let index = string.indexOf(substring);
	if (index === -1) {
		return string;
	}

	const substringLength = substring.length;
	let endIndex = 0;
	let returnValue = '';
	do {
		returnValue += string.substr(endIndex, index - endIndex) + substring + replacer;
		endIndex = index + substringLength;
		index = string.indexOf(substring, endIndex);
	} while (index !== -1);

	returnValue += string.substr(endIndex);
	return returnValue;
};

const stringEncaseCRLFWithFirstIndex = (string, prefix, postfix, index) => {
	let endIndex = 0;
	let returnValue = '';
	do {
		const gotCR = string[index - 1] === '\r';
		returnValue += string.substr(endIndex, (gotCR ? index - 1 : index) - endIndex) + prefix + (gotCR ? '\r\n' : '\n') + postfix;
		endIndex = index + 1;
		index = string.indexOf('\n', endIndex);
	} while (index !== -1);

	returnValue += string.substr(endIndex);
	return returnValue;
};

var util = {
	stringReplaceAll,
	stringEncaseCRLFWithFirstIndex
};

const TEMPLATE_REGEX = /(?:\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi;
const STYLE_REGEX = /(?:^|\.)(\w+)(?:\(([^)]*)\))?/g;
const STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
const ESCAPE_REGEX = /\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.)|([^\\])/gi;

const ESCAPES$1 = new Map([
	['n', '\n'],
	['r', '\r'],
	['t', '\t'],
	['b', '\b'],
	['f', '\f'],
	['v', '\v'],
	['0', '\0'],
	['\\', '\\'],
	['e', '\u001B'],
	['a', '\u0007']
]);

function unescape(c) {
	const u = c[0] === 'u';
	const bracket = c[1] === '{';

	if ((u && !bracket && c.length === 5) || (c[0] === 'x' && c.length === 3)) {
		return String.fromCharCode(parseInt(c.slice(1), 16));
	}

	if (u && bracket) {
		return String.fromCodePoint(parseInt(c.slice(2, -1), 16));
	}

	return ESCAPES$1.get(c) || c;
}

function parseArguments(name, arguments_) {
	const results = [];
	const chunks = arguments_.trim().split(/\s*,\s*/g);
	let matches;

	for (const chunk of chunks) {
		const number = Number(chunk);
		if (!Number.isNaN(number)) {
			results.push(number);
		} else if ((matches = chunk.match(STRING_REGEX))) {
			results.push(matches[2].replace(ESCAPE_REGEX, (m, escape, character) => escape ? unescape(escape) : character));
		} else {
			throw new Error(`Invalid Chalk template style argument: ${chunk} (in style '${name}')`);
		}
	}

	return results;
}

function parseStyle(style) {
	STYLE_REGEX.lastIndex = 0;

	const results = [];
	let matches;

	while ((matches = STYLE_REGEX.exec(style)) !== null) {
		const name = matches[1];

		if (matches[2]) {
			const args = parseArguments(name, matches[2]);
			results.push([name].concat(args));
		} else {
			results.push([name]);
		}
	}

	return results;
}

function buildStyle(chalk, styles) {
	const enabled = {};

	for (const layer of styles) {
		for (const style of layer.styles) {
			enabled[style[0]] = layer.inverse ? null : style.slice(1);
		}
	}

	let current = chalk;
	for (const [styleName, styles] of Object.entries(enabled)) {
		if (!Array.isArray(styles)) {
			continue;
		}

		if (!(styleName in current)) {
			throw new Error(`Unknown Chalk style: ${styleName}`);
		}

		current = styles.length > 0 ? current[styleName](...styles) : current[styleName];
	}

	return current;
}

var templates = (chalk, temporary) => {
	const styles = [];
	const chunks = [];
	let chunk = [];

	// eslint-disable-next-line max-params
	temporary.replace(TEMPLATE_REGEX, (m, escapeCharacter, inverse, style, close, character) => {
		if (escapeCharacter) {
			chunk.push(unescape(escapeCharacter));
		} else if (style) {
			const string = chunk.join('');
			chunk = [];
			chunks.push(styles.length === 0 ? string : buildStyle(chalk, styles)(string));
			styles.push({inverse, styles: parseStyle(style)});
		} else if (close) {
			if (styles.length === 0) {
				throw new Error('Found extraneous } in Chalk template literal');
			}

			chunks.push(buildStyle(chalk, styles)(chunk.join('')));
			chunk = [];
			styles.pop();
		} else {
			chunk.push(character);
		}
	});

	chunks.push(chunk.join(''));

	if (styles.length > 0) {
		const errMsg = `Chalk template literal is missing ${styles.length} closing bracket${styles.length === 1 ? '' : 's'} (\`}\`)`;
		throw new Error(errMsg);
	}

	return chunks.join('');
};

const {stdout: stdoutColor, stderr: stderrColor} = logger$2.require$$0$1;
const {
	stringReplaceAll: stringReplaceAll$1,
	stringEncaseCRLFWithFirstIndex: stringEncaseCRLFWithFirstIndex$1
} = util;

// `supportsColor.level` → `ansiStyles.color[name]` mapping
const levelMapping = [
	'ansi',
	'ansi',
	'ansi256',
	'ansi16m'
];

const styles = Object.create(null);

const applyOptions = (object, options = {}) => {
	if (options.level > 3 || options.level < 0) {
		throw new Error('The `level` option should be an integer from 0 to 3');
	}

	// Detect level if not set manually
	const colorLevel = stdoutColor ? stdoutColor.level : 0;
	object.level = options.level === undefined ? colorLevel : options.level;
};

class ChalkClass {
	constructor(options) {
		return chalkFactory(options);
	}
}

const chalkFactory = options => {
	const chalk = {};
	applyOptions(chalk, options);

	chalk.template = (...arguments_) => chalkTag(chalk.template, ...arguments_);

	Object.setPrototypeOf(chalk, Chalk.prototype);
	Object.setPrototypeOf(chalk.template, chalk);

	chalk.template.constructor = () => {
		throw new Error('`chalk.constructor()` is deprecated. Use `new chalk.Instance()` instead.');
	};

	chalk.template.Instance = ChalkClass;

	return chalk.template;
};

function Chalk(options) {
	return chalkFactory(options);
}

for (const [styleName, style] of Object.entries(ansiStyles$1)) {
	styles[styleName] = {
		get() {
			const builder = createBuilder(this, createStyler(style.open, style.close, this._styler), this._isEmpty);
			Object.defineProperty(this, styleName, {value: builder});
			return builder;
		}
	};
}

styles.visible = {
	get() {
		const builder = createBuilder(this, this._styler, true);
		Object.defineProperty(this, 'visible', {value: builder});
		return builder;
	}
};

const usedModels = ['rgb', 'hex', 'keyword', 'hsl', 'hsv', 'hwb', 'ansi', 'ansi256'];

for (const model of usedModels) {
	styles[model] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(ansiStyles$1.color[levelMapping[level]][model](...arguments_), ansiStyles$1.color.close, this._styler);
				return createBuilder(this, styler, this._isEmpty);
			};
		}
	};
}

for (const model of usedModels) {
	const bgModel = 'bg' + model[0].toUpperCase() + model.slice(1);
	styles[bgModel] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(ansiStyles$1.bgColor[levelMapping[level]][model](...arguments_), ansiStyles$1.bgColor.close, this._styler);
				return createBuilder(this, styler, this._isEmpty);
			};
		}
	};
}

const proto = Object.defineProperties(() => {}, {
	...styles,
	level: {
		enumerable: true,
		get() {
			return this._generator.level;
		},
		set(level) {
			this._generator.level = level;
		}
	}
});

const createStyler = (open, close, parent) => {
	let openAll;
	let closeAll;
	if (parent === undefined) {
		openAll = open;
		closeAll = close;
	} else {
		openAll = parent.openAll + open;
		closeAll = close + parent.closeAll;
	}

	return {
		open,
		close,
		openAll,
		closeAll,
		parent
	};
};

const createBuilder = (self, _styler, _isEmpty) => {
	const builder = (...arguments_) => {
		// Single argument is hot path, implicit coercion is faster than anything
		// eslint-disable-next-line no-implicit-coercion
		return applyStyle(builder, (arguments_.length === 1) ? ('' + arguments_[0]) : arguments_.join(' '));
	};

	// `__proto__` is used because we must return a function, but there is
	// no way to create a function with a different prototype
	builder.__proto__ = proto; // eslint-disable-line no-proto

	builder._generator = self;
	builder._styler = _styler;
	builder._isEmpty = _isEmpty;

	return builder;
};

const applyStyle = (self, string) => {
	if (self.level <= 0 || !string) {
		return self._isEmpty ? '' : string;
	}

	let styler = self._styler;

	if (styler === undefined) {
		return string;
	}

	const {openAll, closeAll} = styler;
	if (string.indexOf('\u001B') !== -1) {
		while (styler !== undefined) {
			// Replace any instances already present with a re-opening code
			// otherwise only the part of the string until said closing code
			// will be colored, and the rest will simply be 'plain'.
			string = stringReplaceAll$1(string, styler.close, styler.open);

			styler = styler.parent;
		}
	}

	// We can move both next actions out of loop, because remaining actions in loop won't have
	// any/visible effect on parts we add here. Close the styling before a linebreak and reopen
	// after next line to fix a bleed issue on macOS: https://github.com/chalk/chalk/pull/92
	const lfIndex = string.indexOf('\n');
	if (lfIndex !== -1) {
		string = stringEncaseCRLFWithFirstIndex$1(string, closeAll, openAll, lfIndex);
	}

	return openAll + string + closeAll;
};

let template;
const chalkTag = (chalk, ...strings) => {
	const [firstString] = strings;

	if (!Array.isArray(firstString)) {
		// If chalk() was called by itself or with a string,
		// return the string itself as a string.
		return strings.join(' ');
	}

	const arguments_ = strings.slice(1);
	const parts = [firstString.raw[0]];

	for (let i = 1; i < firstString.length; i++) {
		parts.push(
			String(arguments_[i - 1]).replace(/[{}\\]/g, '\\$&'),
			String(firstString.raw[i])
		);
	}

	if (template === undefined) {
		template = templates;
	}

	return template(chalk, parts.join(''));
};

Object.defineProperties(Chalk.prototype, styles);

const chalk = Chalk(); // eslint-disable-line new-cap
chalk.supportsColor = stdoutColor;
chalk.stderr = Chalk({level: stderrColor ? stderrColor.level : 0}); // eslint-disable-line new-cap
chalk.stderr.supportsColor = stderrColor;

// For TypeScript
chalk.Level = {
	None: 0,
	Basic: 1,
	Ansi256: 2,
	TrueColor: 3,
	0: 'None',
	1: 'Basic',
	2: 'Ansi256',
	3: 'TrueColor'
};

var source = chalk;

function printRegFileOutput(regFiles, baseDir) {
    const getRelativePathToBaseDir = logger$2.curry(path$2__default.relative)(baseDir, logger$2.__);
    regFiles.forEach(file => logger$2.pipe(() => file.compilerNode.fileName, getRelativePathToBaseDir, source.green, console.log)());
    console.info(`total registry files: ${source.cyan(regFiles.length)}`);
}
const log = logger$2.createLogger(handleList);
async function handleList(tsConfigPath) {
    log.verbose(`tsConfigPath: ${tsConfigPath}`);
    if (!tsConfigPath) {
        console.error(source.red('tsConfigPath is not string'));
        process.exit(1);
    }
    // absolute config path
    let abConfPth;
    try {
        abConfPth = path$2__default.resolve(tsConfigPath);
    }
    catch (error) {
        console.error(source.red(`can not get absolute path from ${tsConfigPath}. See error below`));
        console.error(source.red(error));
        process.exit(1);
    }
    console.log(`listing registry files in ${source.cyan(abConfPth)}`);
    const baseDir = path$2__default.parse(abConfPth).dir;
    log.verbose(`baseDir: ${baseDir}`);
    try {
        const files = await lib.listRegistryFiles(abConfPth);
        log.info(files);
        printRegFileOutput(files, baseDir);
    }
    catch (error) {
        log.error(error);
        console.error(source.red('Cannot list registry files. See error below'));
        console.error(source.red(error));
        process.exit(1);
    }
}

const logger = logger$2.createLogger(handleGen);
async function handleGen(tsConfigPath, outDir) {
    logger.verbose(`tsConfigPath: ${tsConfigPath}`);
    logger.verbose(`outDir: ${outDir}`);
    if (typeof tsConfigPath !== 'string') {
        console.error(source.red(`tsConfigPath: ${tsConfigPath} is not string`));
        process.exit(1);
    }
    if (typeof outDir !== 'string') {
        console.error(source.red(`outDir: ${outDir} is not string`));
        process.exit(1);
    }
    // absolute config path
    let abConfPth;
    try {
        abConfPth = path$2__default.resolve(tsConfigPath);
    }
    catch (error) {
        console.error(source.red(`can not get absolute path from ${tsConfigPath}. See error below`));
        console.error(source.red(error));
        process.exit(1);
    }
    let abOutDir;
    try {
        abOutDir = path$2__default.resolve(outDir);
    }
    catch (error) {
        console.error(source.red(`can not get absolute path from ${outDir}. See error below`));
        console.error(source.red(error));
        process.exit(1);
    }
    try {
        console.info(`generating registry project from ${source.cyan(abConfPth)}`);
        await lib.generate(abConfPth, abOutDir);
        console.info(`generated registry project to ${source.cyan(abOutDir)}`);
    }
    catch (error) {
        console.error(source.red('Cannot generate registry project. See error below'));
        console.error(error);
        process.exit(1);
    }
}

const rootLog = logger$2.createLogger('svc-p');
yargs_1$1
    .scriptName('svc-p')
    .option('verbose', {
    type: 'boolean',
    alias: 'v',
    default: false,
})
    .command(['gen <tsConfigPath> <outDir>', 'generate'], 'generate a module with declaration files from registry files in tsConfigPath to outDir', yargs => {
    return yargs
        .usage('gen <tsConfigPath> <outDir>')
        .positional('tsConfigPath', {
        type: 'string',
        describe: 'path to source project',
    })
        .positional('outDir', {
        type: 'string',
        describe: 'path to out dir',
    });
}, async (argv) => {
    const log = rootLog.child('generate');
    log.verbose('argv:');
    log.verbose(argv);
    await handleGen(argv.tsConfigPath, argv.outDir);
})
    .command(['ls <tsConfigPath>', 'list'], 'list the declaration files in source project', yargs => {
    return yargs.usage('ls <tsConfigPath>').positional('tsConfigPath', {
        type: 'string',
        describe: 'path to source project',
    });
}, argv => {
    const log = rootLog.child('list');
    log.verbose('argv:');
    log.verbose(argv);
    handleList(argv['tsConfigPath']);
}).argv;
