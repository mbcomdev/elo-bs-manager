//@include lib_Class.js

/**
 * @class sol.common.Instance
 * @extends sol.Base
 * @singleton
 *
 * @experimental
 * This is an experimental new functionality, which may be removed in future versions.
 *
 * This class provides basic functionality to create solution instances.
 *
 * It can be used to create single independent instances of the defined instanceDefinition
 * and addresses misuses and / or misunderstandings regarding sol.define and sol.create.
 *
 * Contrary to sol.define, properties defined via sol.common.instance.define are not properties
 * defined as "class properties" which may be shared with other "class instances" of the same class
 * or of classes which extend the class, but are properties defined as "instance properties" which,
 * if not explicit set as "class properties", are only available and accessable within the same
 * "instance".
 *
 *
 * # Defining instances - basic syntax
 *
 * Every instance is represented by an instance name that should include a namespace and the instance
 * definition.
 * The instance definition is a js object that represents the contents of that instance. Functions and
 * properties that are part of the instanceDefinition will be part of the instance.
 *
 *     sol.common.instance.define(instanceName, intanceDefinition);
 *
 * ## initialize - Function
 *
 * The initialize function will be called during the creation of an instance with the provided
 * configuration.
 * Due to the fact that all instances (except "sol.common.instance.logger") extend at least
 * "sol.common.instance.base", every instance does have an initialize function.
 * "sol.common.instance.base"'s initialize functions applies the properties of then configuration
 * to the instance.
 *
 * @eloall
 */
sol.define("sol.common.instance", {
  singleton: true,
  $definedInstances: {},
  $definedSingletons: {},
  $globalParent: "sol.common.instance.base",
  baseInstances: [
    "sol.common.instance.base",
    "sol.common.instance.logger"
  ],
  setSingleton: function (name, singletonDefinition) {
    var me = this;

    me.$definedSingletons[name] = singletonDefinition;
  },
  getSingleton: function (name, _options) {
    var me = this;

    if (!me.$definedSingletons[name]) {
      me.logger.warn("could not get singleton instance definition of " + name);
    }
    return me.$definedSingletons[name];

  },
  setInstanceDefinition: function (name, instanceDefinition) {
    var me = this;

    me.$definedInstances[name] = instanceDefinition;
  },
  getInstanceDefinition: function (name, _options) {
    var me = this;

    if (!me.$definedInstances[name]) {
      me.logger.warn("could not get instance definition of " + name);
    }
    return me.clone(me.$definedInstances[name]);
  },
  define: function (name, instanceDefinition, config) {
    var me = this,
        // clone input definition to prevent manipulation of the definition
        clonedDefinition = me.clone(instanceDefinition);

    clonedDefinition.$name = name;

    me.setInstanceDefinition(name, clonedDefinition);

    if (clonedDefinition.singleton) {
      me.setSingleton(name, me.create(name, config || {}));
    }
  },
  create: function (name, config, options) {
    var me = this,
        instanceDefinition,
        singletonDefinition,
        instance,
        defaultOptions = {
          onCreate: ["initialize"]
        },
        mixinsContainer,
        parent,
        elementsToMerge = [];

    options = options || defaultOptions;

    // check if singleton and return clone
    singletonDefinition = me.getSingleton(name, options);
    if (singletonDefinition) {
      // singletons will be created on define once an then only returned
      return singletonDefinition;
    }


    // get instanceDefinition
    instanceDefinition = me.getInstanceDefinition(name, options);
    if (!instanceDefinition) {
      throw "Could not create instance '" + name + "', please define instance first";
    }
    // create mixins
    mixinsContainer = me.createMixins(instanceDefinition, config, options) || null;
    if (mixinsContainer) {
      elementsToMerge = elementsToMerge.concat(mixinsContainer.mixins);
    }

    // create parent
    parent = me.createParent(instanceDefinition, config, options) || {};
    elementsToMerge.push(parent);


    // add instanceDefinition and merge to instance
    elementsToMerge.push(instanceDefinition);

    instance = me.merge(elementsToMerge, {});


    // set $super function and bind it ($super executes in its own context)
    instance.$super = me.$instanceSuper.bind({}, instance);

    if (mixinsContainer) {
      // call onCreate functions (generally "initialize") of mixin classes
      me.callMethodsOnInstance(instance, mixinsContainer.$initialize, config);
    }
    // call onCreate functions (generally "initialize") of this class
    me.callMethodsOnInstance(instance, options.onCreate, config);

    return instance;
  },
  createMixins: function (instanceDefinition, config, options) {
    var me = this,
        mixinOptions,
        mixins,
        exists = function (elem) {
          return !!elem;
        };

    if (instanceDefinition.mixins) {
      mixinOptions = me.clone(options) || {};
      mixinOptions.onCreate = [];
      mixins = (instanceDefinition.mixins || [])
        .map(function (mixinName) {
          return me.create(mixinName, config, mixinOptions);
        });

      return {
        $initialize: mixins.map(function (mixin) {
          return mixin.initialize;
        }).filter(exists),
        mixins: mixins.map(function (mixin) {
          mixin.initialize = undefined;
          return mixin;
        }).filter(exists)
      };
    }
  },
  createParent: function (instanceDefinition, config, options) {
    var me = this,
        parentOptions,
        parent;

    if (instanceDefinition.extend || me.baseInstances.indexOf(instanceDefinition.$name) == -1) {
      parentOptions = me.clone(options) || {};
      parentOptions.onCreate = [];
      parent = me.create(instanceDefinition.extend || me.$globalParent, config, parentOptions);
      parent.$parent = me.clone(parent);
      return parent;
    }
    return null;
  },
  /**
   *
   * @private
   * Finds attribute in parent instance.
   * If found attribute is a function, attribute will be called in instance context and
   * with given args as arguments. Calls to $super within the attribute can only access
   * itself and its own parents.
   * if found attribute is not a function, a cloned version of attribute will be returned.
   *
   * @param {*} instance the current instance (gets bound as first parameter within create)
   * @param {String} name name of the parent class (Optional)
   * @param {String} attributeName name of the attribute (Mandatory)
   * @param {*} args arguments to pass to function, if value at aParent[attributeName] is a function (optional)
   * @returns {*} the result of a function call or the value at the given attribute
   */
  $instanceSuper: function (instance, name, attributeName, args) {
    var me = this,
        self = sol.common.instance,
        result,
        parentContainer,
        currentSuperInstance;

    me.$currentParents = me.$currentParents || [];

    currentSuperInstance = me.$currentParents.length > 0
      ? me.$currentParents[me.$currentParents.length]
      : instance;

    parentContainer = self.getParentAttribute(currentSuperInstance.$parent, name, attributeName);

    if (parentContainer) {
      if (typeof parentContainer.attribute == "function") {
        // push $parent to last index of $currentParents so that all calls to $super
        // within the upcoming function call can only access itself and its own parents
        // this would not work with asynchronous calls
        me.$currentParents.push(parentContainer.$instance);
        // call of $super function
        result = parentContainer.attribute.apply(instance, Array.isArray(args) ? args : [args]);
        // call is finished, instances can be removed from $currentParents
        me.$currentParents.pop();
      } else {
        result = self.clone(parentContainer.attribute);
      }
      return result;
    }
  },
  getParentAttribute: function (parent, name, attributeName) {
    var me = this;

    if (!parent) {
      return null;
    }

    return ((name && parent.$name == name) || (!name && parent[attributeName]))
      ? parent[attributeName]
        ? { $instance: parent, attribute: parent[attributeName] }
        : null
      : me.getParentAttribute(parent.$parent, name, attributeName);
  },
  callMethodsOnInstance: function (instance, methods, args) {
    (methods || [])
      .forEach(function (method) {
        if (typeof method == "string") {
          if (typeof instance[method] == "function") {
            instance[method].apply(instance, Array.isArray(args) ? args : [args]);
          }
        } else if (typeof method == "function") {
          method.apply(instance, Array.isArray(args) ? args : [args]);
        }
      });
  },
  merge: function (sources, target) {
    var me = this;

    return (sources || [])
      .reduce(function (aTarget, aSource) {
        if (typeof aSource == "object") {
          Object.keys(aSource)
            .forEach(function (key) {
              aTarget[key] = typeof aTarget[key] != "undefined"
                ? me.merge([aSource[key]], aTarget[key])
                : aSource[key] || aTarget[key];
            });
        } else {
          return aSource || aTarget;
        }
        return aTarget;
      }, target || {});
  },
  clone: function (obj) {
    var me = this,
        getType = function (any) {
          var intermediate;
          if (any !== any) {
            return "nan";
          }
          if (typeof any !== "object") {
            return typeof any;
          }
          if (typeof java !== "undefined" && any instanceof java.lang.String) {
            return "string";
          } else {
            intermediate = Object.prototype.toString.call(any);
            return intermediate.substring(8, intermediate.length - 1).toLowerCase();
          }
        },
        cloneArray = function (arr) {
          return arr.map(function (element) {
            return me.clone(element);
          });
        },
        cloneObj = function (anObject) {
          var toKeyValue = function (root, key) {
            return { key: key, value: root[key] };
          };

          return Object.keys(anObject)
            .map(toKeyValue.bind(null, anObject))
            .reduce(function (target, pair) {
              target[pair.key] = me.clone(pair.value);
              return target;
            }, {});
        };

    switch (getType(obj)) {
      case "array":
        return cloneArray(obj);
      case "object":
        return cloneObj(obj);
      case "function":
      case "string":
      case "boolean":
      case "number":
      case "nan":
      case "null":
      default:
        return obj;
    }
  }
});

/**
 * @class sol.common.instance.logger
 * @eloall
 * @experimental
 * This is an experimental new functionality, which may be removed in future versions.
 *
 * Please be aware that this class does not use sol.define  but sol.common.instance.define
 * and may be working slightly different.
 *
 * This instanceDefinition provides basic functionality to access and use the logger.
 */
sol.common.instance.define("sol.common.instance.logger", {
  scope: "sol",
  debugEnabled: false,
  timings: {},
  pattern: {
    error: "[{{scope}}] {{msg}} : {{object}}",
    warn: "[{{scope}}] {{msg}} : {{object}}",
    info: "[{{scope}}] {{msg}} : {{object}}",
    debug: "[{{scope}}] {{msg}} : {{object}}",
    enter: "[{{scope}}] ENTER {{msg}} : {{object}}",
    exit: "[{{scope}}] EXIT {{msg}} : {{time}}ms : {{object}}"
  },
  initialize: function (config) {
    var me = this;
    config = config || {};
    me.scope = config.scope || me.scope;

    me.setLogger(config);
    me.setDebugEnabled(typeof me.logger.isDebugEnabled == "function" ? me.logger.isDebugEnabled : false);
  },
  setLogger: function (config) {
    var me = this;

    if (config.logger) {
      me.logger = config.logger;
    } else {
      me.logger = (typeof console === "undefined" || typeof Graal !== "undefined") ? log : console;
    }
  },
  setDebugEnabled: function (enabled) {
    var me = this;
    me.debugEnabled = enabled;
  },
  error: function (msg, ex) {
    var me = this;

    me.logMessage(msg, ex ? ex : "", "error");
  },
  warn: function (msg, ex) {
    var me = this;

    me.logMessage(msg, ex ? ex : "", "warn");
  },
  info: function (msg, obj) {
    var me = this;
    me.logMessage(msg, me.stringify(obj) || "", "info");
  },
  debug: function (msg, obj) {
    var me = this;

    if (me.debugEnabled) {
      me.logMessage(msg, me.stringify(obj) || "", "debug", "info");
    }
  },
  enter: function (functionName, obj) {
    var me = this;

    if (me.debugEnabled) {
      me.setEnterTime(functionName);
      me.logMessage(functionName, me.stringify(obj) || "", "enter", "info");
    }
  },
  exit: function (functionName, obj) {
    var me = this;

    if (me.debugEnabled) {
      me.logMessage(functionName, me.stringify(obj) || "", "exit", "info");
    }
  },
  setEnterTime: function (functionName) {
    var me = this;
    me.enterTime = me.enterTime || {};
    me.enterTime[functionName] = Date.now();
  },
  getDuration: function (functionName) {
    var me = this,
        enterTime = me.enterTime[functionName],
        duration;

    me.enterTime[functionName] = undefined;

    if (enterTime) {
      duration = Date.now() - enterTime;
      if (duration < 0) {
        duration = 0;
      }
      return duration;
    } else {
      return -1;
    }
  },
  logMessage: function (msg, objectString, patternString, loggerFunction) {
    var me = this,
        message = me.pattern[patternString]
          .replace("{{scope}}", me.scope)
          .replace("{{msg}}", me.format(msg))
          .replace("{{object}}", objectString)
          .replace(/ : $/, "");

    if (patternString == "exit") {
      message = message.replace("{{time}}", me.getDuration(msg));
    }

    me.logger[loggerFunction || patternString](message);
  },
  format: function (msg) {
    var params;
    if (Object.prototype.toString.call(msg) === "[object Array]") {
      params = msg.slice(1);

      return msg[0].replace(/\{(\d+)\}/g, function (match, number) {
        return (typeof params[number] !== "undefined") ? params[number] : match;
      });
    }
    return msg;
  },
  stringify: function (obj) {
    var objType, str;
    if (typeof obj === "string") {
      return obj;
    }
    objType = Object.prototype.toString.call(obj);
    if ((objType == "[object Arguments]") || (objType == "[object JavaObject]")) {
      return "";
    }

    try {
      str = JSON.stringify(obj, function (key, value) {
        if (value instanceof java.lang.String) {
          return String(value);
        }
        if (value && value.getClass) {
          return String(value.toString());
        }
        return value;
      }) || "";

      return str;
    } catch (ex) {
      return typeof obj;
    }
  }
});

/**
 * @class sol.common.instance.base
 * @eloall
 * @experimental
 * This is an experimental new functionality, which may be removed in future versions.
 *
 * Please be aware that this instance does not use sol.define  but sol.common.instance.define
 * and may be working slightly different.
 *
 * This instanceDefinition applies all properties of config to the instance.
 * It is the superinstance of every class except sol.common.instance.logger.
 * If its initialize or toJSON function is overwritten by a child instance,
 * the child instance function has to call $super to execute these basic functions.
 */
sol.common.instance.define("sol.common.instance.base", {
  toJSON: function () {
    var me = this;
    return Object.keys(me)
      .reduce(
        function (target, key) {
          if (key.indexOf("$") == 0) {
            return target;
          }
          target[key] = me[key];
          return target;
        }
        , {});
  },
  initialize: function (config) {
    var me = this,
        reservedProperties = [
          "extend",
          "requiredConfig",
          "singleton",
          "$super",
          "$name",
          "$parent",
          "CONST",
          "$instances"
        ];

    Object.keys(config)
      .forEach(function (property) {
        if (config.hasOwnProperty(property)) {
          if (typeof me[property] == "function" && typeof config[property] != "function") {
            throw "[" + me.$name + "] Illegal overriding internal function with a value: " + property + ". Existing functions cannot be overriden with non functional values using sol.common.instance.create().";
          } else if (property.indexOf("$") == 0 || reservedProperties.indexOf(property) != -1) {
            throw "[" + me.$name + "] Illegal overriding internal object value: " + property + ". Reserved words " + reservedProperties + " and all words starting with '$' are protected and should not be set using sol.common.instance.create().";
          }
          me[property] = config[property];
        }
      });
  }
});