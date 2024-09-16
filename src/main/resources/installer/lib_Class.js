if (typeof importPackage === "function") {
  importPackage(Packages.de.elo.ix.client);
  importPackage(Packages.de.elo.ix.jscript);
  importPackage(Packages.de.elo.ix.scripting);
}

/**
 * @class sol
 * @singleton
 * @author Nils Mosbach, ELO Digital Office GmbH
 *
 * Solutions are modularized using a js class framework that adapts concepts
 * from object orientated languages.
 *
 * # Modularization of solutions
 *
 * Every function is implemented as a Class which allows passing configuration params to
 * the class on instantiation. Class definitions have been simplified
 * thanks to a function called sol.define. With the help of sol.create new class
 * instances can be created.
 *
 * For more information on modularization of classes refer to sol.ClassManager.
 *
 * # Namespaces
 *
 * Modules are organized in namespaces. The creation of namespaces is explained in the class sol.NamespaceManager.
 * Please mind that the namespaces "elo" and "sol" are reserved by the ELO Digital Office GmbH.
 *
 * # Storing modules in ELO
 *
 * JS files of the modules should be stored in ELO. It is recommended that namespaces are
 * represented as structure elements from a logical view.
 *
 * e.g. the ix registered function "RF_MyFunction" which is part of the namespace "sol.invoice.ix" should be placed in...
 *
 *     [ELO Archive]
 *       - Administration
 *          - Business Solutions
 *             - Common
 *                [File] sol.common.Helpers.js
 *             - Invoice
 *                - IX Scripting Base
 *                   [File] sol.invoice.ix.RF_MyFunction
 *
 *          - IX Scripting Base
 *             [Reference] sol.invoice.ix.RF_MyFunction
 *             [Reference] sol.common.Helpers.js
 *
 * If further files need to be imported within RF_MyFunction they should stay in the same hierarchy.
 * Scripts that should be used across IX, AS and WF must have an .js extension in their short description.
 *
 * @eloall
 */

var _init,
    disableGlobalScope = true;

_init = function (ctx) {
  var key,
      disableGlobalScope = (typeof globalScope === "undefined") || // eslint-disable-line no-shadow
      (typeof globalScope !== "undefined" ? globalScope.disableGlobalScope : false) ||
      (typeof ctx.disableGlobalScope !== "undefined" ? ctx.disableGlobalScope : false) ||
      (typeof workspace !== "undefined" ? true : false) ||
      false;

  // Initialize solution namespace since NamespaceManager component isn't available yet.
  // Apply exisiting namespaces and instances to the current context.
  if (disableGlobalScope) {
    ctx.sol = ctx.sol || {};
  } else {
    if (!globalScope.$instances) {
      globalScope.$instances = {
        sol: {}
      };
    }
    if (!globalScope.$classes) {
      globalScope.$classes = {};
    }
    if (!globalScope.$dependencies) {
      globalScope.$dependencies = [];
      globalScope.$watchers = {};
    }
    for (key in globalScope.$instances) {
      if (globalScope.$instances.hasOwnProperty(key) && key) {
        ctx[key] = globalScope.$instances[key];
      }
    }
  }

  /**
   * @class sol.ClassManager
   * @singleton
   * @author Nils Mosbach, ELO Digital Office GmbH
   *
   * Manager instance that handles the definition and creation of classes.
   *
   * Class definitions are handled internally by the ClassManager.
   * Therefore the creation of classes should always be done by calling sol.create.
   *
   *
   * # Defining classes - basic syntax
   *
   * Every class is represented by a class name that should include a namespace and the class definition.
   * The class definition is a js object that represents the contents of that class. Functions and properties
   * that are part of the classDefinition will be part of the class prototype.
   *
   *     sol.define(className, classDefinition);
   *
   * Every class has its own constructor which is specified by a function called initialize.
   *
   *     sol.define("sol.test.Fighter", {
   *       name: '',
   *       power: 0,
   *
   *       initialize: function (config) {
   *         var me = this;
   *
   *         me.name = config.name;
   *         me.power = config.power;
   *       },
   *
   *       highFive: function () {
   *         log.info("high five");
   *         return "^5";
   *       }
   *     });
   *
   * # Inheritance
   *
   * Classes can inherit properties and functions from a super class.
   *
   *     sol.define(className, {
   *       extend: superClassName
   *     });
   *
   * Following example will inherit name and power-properties as well as the highFive-function of the fighter.
   *
   *     sol.define("sol.test.Saiyajin", {
   *       extend: "sol.test.Fighter",
   *
   *       level: 1,
   *
   *       initialize: function (config) {
   *         var me = this;
   *         me.$super("sol.test.Fighter", "initialize", [config]);
   *         me.level = 1;
   *       },
   *
   *       transform: function() {
   *         var me = this;
   *         if(me.level < 3) {
   *           me.level++;
   *           me.power *= 50;
   *         }
   *       }
   *     });
   *
   * Superclass functions can be overridden. With the help of the $super-function, functions of the superclass can be called.
   *
   * <b>Please note that calling superclass functions might lead to an infinitive loop if misused. Please validate that none class other than the classes superclass is passed as the superclass parent.</b>
   *
   *     me.$super(superClassName, functionName, attributesArray);
   *
   * A basic example of the initialize-function will look as followed.
   *
   *     me.$super("sol.Base", "initialize", [config]);
   *     me.$super("sol.Base", "initialize", arguments);
   *
   * A word on performance: The superclass name must be passed since the js rhino engine does not allow accessing the caller of the callee due to performance reasons.
   *
   * # Mixins
   *
   * Mixins allow inheriting properties and functions from multiple classes. This concept is also called multiple class inheritance.
   * This can be useful if operation might get used by several classes that implement different use cases. Therefore an Array of classes
   * should be passed to the class definition.
   *
   *     sol.define(className, {
   *       mixins: [mixinClassName]
   *     });
   *
   * If mixins are overritten by the implementing class, there is no way of calling the original mixin function. $super only applies to
   * functions that have been inherited from the superclass.
   *
   * Mixins must be defined by `mixin: true` which also prevents mixin classes from general sol.Base inheritance.
   *
   * Lets define a mixin 'weep' for the fighters.
   *
   *     sol.define("sol.test.mixins.Weep", {
   *       mixin: true,
   *
   *       weep: function () {
   *         log.debug("All fighters do it sometimes");
   *       }
   *     });
   *
   *     sol.define("sol.test.Fighter", {
   *       mixins: ['sol.test.mixins.Weep'],
   *       name: '',
   *       power: 0,
   *
   *       initialize: function (config) {
   *         var me = this;
   *
   *         me.name = config.name;
   *         me.power = config.power;
   *       },
   *
   *       highFive: function () {
   *         log.info("high five");
   *         return "^5";
   *       }
   *     });
   *
   * Mixins also support initialization operations. Please note that this should not be external system calls.
   * Initialization of mixins is executed after all classes and superclasses have been initialized.
   *
   *     sol.define("sol.test.mixins.Weep", {
   *       mixin: true,
   *
   *       initialize: function(config) {
   *         var me = this;
   *         me.wheepName = config.name;
   *       }
   *
   *       weep: function () {
   *         log.debug("All fighters do it sometimes, even "+ me.wheepName);
   *       }
   *     });
   *
   * # Defining singleton classes
   *
   * Singletons can be created by passing a singleton parameter to the class definition.
   *
   *     sol.define(className, {
   *       singleton: true
   *     });
   *
   * In this case a class is created in the given namespace after the class was defined.
   * Lets define an arena for the fighters.
   *
   *     sol.define("sol.test.Arena", {
   *       singleton: true,
   *
   *       ambience: "dark",
   *
   *       changeAmbience: function(ambience) {
   *         var me = this;
   *         me.ambience = ambience;
   *       },
   *
   *       fight: function (fighter1, fighter2) {
   *         return (fighter1.power > fighter2.power) ? fighter1.name : fighter2.name);
   *       }
   *     });
   *
   *     sol.test.Arena.changeAmbience("dark and scary");
   *
   * # Creating class instances
   *
   * Instances of defined classes can be created by sol.create(). An options object can be used
   * in order to pass config properties to the initialize function.
   *
   *     sol.create(className, options);
   *
   * Lets create a new Saiyajin fighter.
   * The name and power configurations are handled by the initialize function of the fighter.
   *
   *     var goku = sol.create("sol.test.Saiyajin", {
   *       name: "Son-Goku",
   *       power: 3000000
   *     });
   *
   * # Example using classes
   *
   * Following example shows a basic usage of the classes defined by previous examples.
   *
   *     var goku, freezer, winner;
   *
   *     goku = sol.create("sol.test.Saiyajin", {
   *       name: "Son-Goku",
   *       power: 3000000
   *     });
   *
   *     freezer = sol.create("sol.test.Fighter", {
   *       name: "Freezer",
   *       power: 120000000
   *     });
   *
   *     var winner = sol.test.Arena.fight(goku, freezer);
   *     log.info("[MATCH] winner 1st=" + winner);
   *
   *     goku.transform();
   *
   *     winner = sol.test.Arena.fight(goku, freezer);
   *     log.info("[MATCH] winner 2nd=" + winner);
   *     freezer.weep();
   *
   * # Class properties and prototyping
   *
   * sol#define allows defining static values on class prototypes. This should be avoided and only be used if the core concept of js prototypes is clear.
   *
   * <b>Using class properties for global definitions/ constants</b>
   *
   * Basically prototyping allows defining static property values that can be used by all instances. That might be useful for constants or global definitions.
   *
   *     sol.define("sol.test.Fighter", {
   *       allowedAmountOfFights: 10,
   *       modes: {
   *         slow: function() {},
   *         fast: function() {}
   *       }
   *     });
   *
   * <b>Misuse and class properties</b>
   *
   * If working with properties defined by the class prototype they are static values.
   *
   *     sol.define("sol.test.Fighter", {
   *       fightsTotal: 0,
   *       fights: [],
   *       fight: function() { this.fightsTotal++; }
   *     });
   *
   *     var fighter1 = sol.create("sol.test.Fighter", {});
   *     fighter1.fight();                // fightsTotal = 1
   *     fighter1.fights.push('first');   // fights = ['first']
   *     fighter1.fight();                // fightsTotal = 2
   *     fighter1.fights.push('second');   // fights = ['first', 'second']
   *     var fighter2 = sol.create("sol.test.Fighter", {});
   *     fighter2.fight();                // fightsTotal = 3
   *     fighter1.fights.push('third');   // fights = ['first', 'second', 'third']
   *
   * However if properties are applied on the instance itself they are primarily used. For example:
   *
   *     var fighter1 = sol.create("sol.test.Fighter", {});
   *     fighter1.fight();                // fightsTotal = 1
   *     fighter1.fight();                // fightsTotal = 2
   *     var fighter2 = sol.create("sol.test.Fighter", {});
   *     // set a new property instance on the fighter2 instance
   *     fighter2.fightsTotal = 0;
   *     fighter2.fight();                // fightsTotal = 1
   *     fighter1.fight();                // fightsTotal = 3
   *
   * In order to solve this problem, never work (extend, modify or calculate) with values instances applied on class prototype level.
   * If working with values they *must* be defined in the initialize function!
   *
   *     sol.define("sol.test.Fighter", {
   *       requiredConfig: ['name'],
   *       allowedAmountOfFights: 10,
   *
   *       initialize: function(config) {
   *         var me = this;
   *         me.fights = [];
   *       }
   *
   *       fight: function() {
   *         var me = this;
   *         if (me.fights.length < me.allowedAmountOfFights) {
   *           me.fights.push(new Date());
   *         }
   *       }
   *     });
   *
   * When using config properties passed to sol#create they will get added to the instance by sol.Base#initialize.
   *
   *     sol.create("sol.test.Fighter", {
   *       name: 'Son Goku"
   *     });
   *
   * @version 1.1
   * @eloall
   */
  sol.ClassManager = sol.ClassManager || {

    /**
     * @private
     * @property
     */
    version: 1,

    /**
     * @private
     * @property
     * @member sol.ClassManager
     * defined classes by {@link sol.ClassManager#define sol.ClassManager.define() or sol.define()}
     */
    definedClasses: disableGlobalScope ? {} : globalScope.$classes,

    /**
     * @private
     * @property
     * @member sol.ClassManager
     * keeps a list of dependencies that are used by watchers.
     */
    dependencies: disableGlobalScope ? [] : globalScope.$dependencies,
    watchers: disableGlobalScope ? {} : globalScope.$watchers,

    /**
     * @private
     * Returns the registered prototype of a class thanks to its name.
     * If no class was registered undefined is returned.
     * @param {String} className name of the class including its namespace
     * @returns {*} class prototype
     */
    getClass: function (className) {
      if (!className) {
        return undefined;
      }
      if (sol.ClassManager.definedClasses.hasOwnProperty(className)) {
        return sol.ClassManager.definedClasses[className];
      }
      return undefined;
    },

    /**
     * @private
     * Creates and registers a new class prototype.
     * @param {String} className name of the class including its namespace
     * @param {Object} classDefinition definition if the new class as a js object.
     * @returns {Function} new class prototype
     */
    definePrototype: function (className, classDefinition) {
      var parentClass, $class, msg;

      if (sol.ClassManager.getClass(className)) {
        msg = "[sol.define] Class with name '" + className + "' has already been defined. Overwriting existing definition.";
        (ctx.log && ctx.log.info) ? log.info(msg) : console.info(msg);
      }

      $class = function () {
        this.$super = function () {
          var superClassName, method, args, argsType, msgx;
          if (arguments.length === 2) {
            msgx = "[sol.define] " + className + ": calling superclass function '" + method + "' without super class name is deprecated.";
            (ctx.log && ctx.log.info) ? log.warn(msgx) : console.warn(msgx);

            superClassName = this.$parent.$className;
            method = arguments[0];
            args = arguments[1];
          } else if (arguments.length === 3) {
            superClassName = arguments[0];
            method = arguments[1];
            args = arguments[2];
          } else {
            throw "[sol.define] " + className + ": calling superclass function failed. $super arguments list is invalid.";
          }

          argsType = Object.prototype.toString.call(args);
          if (!(argsType === "[object Array]" || argsType === "[object Arguments]")) {
            throw "[sol.define] " + className + ": calling superclass function failed. invalid syntax. arguments must be an array. e.g. $super('superclass', 'fct', ['argument'});";
          }

          if (superClassName === this.$className) {
            throw "[sol.define] " + className + ": cannot call super class function if instance class name was passed as superclass. This would result in an invinite loop.";
          }

          return sol.ClassManager.$super(superClassName, this, method, args);
        };
        this.$className = className;
        this.initialize.apply(this, arguments);
        if (this.$initializeMixins
            && this.$initializeMixins.length > 0) {
          for (var i = 0; i < this.$initializeMixins.length; i += 1) {
            this.$initializeMixins[i].apply(this, arguments);
          }
        }
      };

      // Resolve parent class name if string is given
      parentClass = classDefinition.extend;
      if (typeof parentClass === "string") {
        parentClass = sol.ClassManager.getClass(parentClass);
        if (!parentClass) {
          throw "[sol.define] " + className + ": Cannot not inherit from class '" + classDefinition.extend + "'. Class not found. Please check if all dependencies are included.";
        }
      }
      if (typeof parentClass !== "undefined") {
        sol.ClassManager.extend($class.prototype, parentClass.prototype);
        $class.prototype.$parent = parentClass.prototype;
      }

      sol.ClassManager.mixin($class, classDefinition, className);
      sol.ClassManager.extend($class.prototype, classDefinition);
      $class.prototype.constructor = $class;
      $class.prototype.$className = className;

      if (!$class.prototype.initialize) {
        $class.prototype.initialize = function () {};
      }

      sol.ClassManager.definedClasses[className] = $class;

      return $class;
    },
    /**
     * @private
     * Applies mixins given by a class definition to the classes prototype definition.
     * @param {Object} $class class that mixins should be applied to.
     * @param {Object} classDefinition configuration of the class that contains list of possible mixins.
     * @param {String} className name of the class (used by error handling)
     */
    mixin: function ($class, classDefinition, className) {
      var i, mixin;

      if (typeof classDefinition.mixins !== "undefined"
          && classDefinition.mixins.length > 0) {
        for (i = 0; i < classDefinition.mixins.length; i++) {
          mixin = classDefinition.mixins[i];
          if (typeof mixin === "string") {
            mixin = sol.ClassManager.getClass(mixin) || mixin;
          }
          sol.ClassManager.extendMixin($class.prototype, mixin.prototype, className, classDefinition.mixins[i]);
        }
      }
    },

    /**
     * @private
     * Extends a class based on properties and functions given its superclass.
     * @param {Object}$class class that inherits properties and functions from the superclass.
     * @param {Object} mixinClass super class
     * @param {String} className name of the current class (used by error handling)
     * @param {String} mixinName name of the current mixin class (used by error handling)
     * @returns {object} new class with inherited properties and functions.
     */
    extendMixin: function ($class, mixinClass, className, mixinName) {
      var property;

      if (!mixinClass.mixin) {
        throw "[sol.define] " + className + ": Cannot mixin class '" + mixinName + "'. Mixins must be defined by `mixin: true` in order to prevent base class inheritance.";
      } else if (mixinClass.initialize) {
        if (!$class.$initializeMixins) {
          $class.$initializeMixins = [];
        }
        $class.$initializeMixins.push(mixinClass.initialize);
      }

      for (property in mixinClass) {
        if (property !== "initialize") {
          $class[property] = mixinClass[property];
        }
      }

      return $class;
    },


    /**
     * @private
     * Extends a class based on properties and functions given its superclass.
     * @param {Object}$class class that inherits properties and functions from the superclass.
     * @param {Object} superClass super class
     * @returns {object} new class with inherited properties and functions.
     */
    extend: function ($class, superClass) {
      var property;

      for (property in superClass) {
        $class[property] = superClass[property];
      }

      return $class;
    },

    /**
     * reads the list of missing dependencies for a given classDefinition
     * @param {Object} classDefinition definition of the class
     * @returns {Array} List of all missing dependencies
     */
    getMissingDependencies: function (classDefinition) {
      var dependencies = [], i;

      // add superclass as dependency
      if (classDefinition.extend &&
        classDefinition.extend !== "sol.Base") {
        if (!sol.ClassManager.getClass(classDefinition.extend)) {
          dependencies.push(classDefinition.extend);
        }
      }

      // add mixins to class definition
      if (classDefinition.hasOwnProperty("mixins") &&
        Object.prototype.toString.call(classDefinition.mixins) === "[object Array]") {
        for (i = 0; i <= classDefinition.mixins.length; i++) {
          if (classDefinition.mixins[i] && !sol.ClassManager.getClass(classDefinition.mixins[i])) {
            dependencies.push(classDefinition.mixins[i]);
          }
        }
      }

      // add required classes
      if (classDefinition.hasOwnProperty("requires") &&
        Object.prototype.toString.call(classDefinition.requires) === "[object Array]") {
        for (i = 0; i <= classDefinition.requires.length; i++) {
          if (classDefinition.requires[i] && !sol.ClassManager.getClass(classDefinition.requires[i])) {
            dependencies.push(classDefinition.requires[i]);
          }
        }
      }

      return dependencies;
    },

    /**
     * @private
     * Adds a class that is requesting missing dependencies.
     * @param {String} className name of the class
     * @param {Object} classDefinition definition of the class
     * @param {Array} dependencies List of classes that are missing
     */
    addWatcherClass: function (className, classDefinition, dependencies) {
      var i;

      sol.ClassManager.dependencies.push({
        className: className,
        classDefinition: classDefinition,
        dependencies: dependencies
      });

      for (i = 0; i < dependencies.length; i++) {
        sol.ClassManager.watchers[dependencies[i]] = true;
      }
    },

    /**
     * @private
     * Analyses dependencies for a class by a given name. Applies class definitions when dependencies are loaded.
     * @param {String} className name of the class that was definied.
     */
    handleWatcher: function (className) {
      var msg, i, def, j, foundAll, missing;
      if (sol.ClassManager.watchers[className]) {
        // log processing classes
        msg = "[sol.ClassManager] " + className + " is required as a dependency for other classes.";
        (ctx.log && ctx.log.info) ? log.info(msg) : console.info(msg);
        for (i = sol.ClassManager.dependencies.length - 1; i >= 0; i--) {
          def = sol.ClassManager.dependencies[i];
          foundAll = true;
          missing = [];
          for (j = 0; j < def.dependencies.length; j++) {
            if (!sol.ClassManager.getClass(def.dependencies[j])) {
              foundAll = false;
              missing.push(def.dependencies[j]);
            }
          }
          if (foundAll) {
            msg = "[sol.ClassManager] " + def.className + ": All dependencies loaded. Defining class...";
            (ctx.log && ctx.log.info) ? log.info(msg) : console.info(msg);
            sol.ClassManager.dependencies.splice(i, 1);
            sol.define(def.className, def.classDefinition);
          } else {
            msg = "[sol.ClassManager] " + def.className + ". Waiting for dependencies [" + String(missing) + "]";
            (ctx.log && ctx.log.info) ? log.info(msg) : console.info(msg);
          }
        }
      }
    },

    /**
     * @private
     * Helper function to address function of a classes superclass if the function was overridden.
     * @param {Object} superClassName prorotype of the superclass.
     * @param {Object} scope instance of the class.
     * @param {String} method name of the method that should be called.
     * @param {Arguments} args arguments as an array that should be passed to the superclass' function.
     * @returns {*} result of the function call.
     */
    $super: function (superClassName, scope, method, args) {
      var parentScope = scope, msg;

      while (parentScope.$parent) {
        if (parentScope.$className === superClassName) {
          break;
        }
        parentScope = parentScope.$parent;
      }
      if (parentScope.$className !== superClassName) {
        msg = "[" + scope.$className + "] calling function '" + method + "' of superclass '" + superClassName + "' failed. Superclass not found in class hierarchy.";
        (ctx.log && ctx.log.info) ? log.error(msg) : console.error(msg);

        return;
      }
      return parentScope[method].apply(scope, args);
    },

    /**
     * Creates a new instance of a previously defined class.
     * New classes should always be created using sol.create.
     *
     *     var log = sol.create('sol.common.Logger', {
     *       scope: 'sol.test'
     *     });
     *
     * If no config object is passed an empty object will be used.
     *
     * Please refer to sol.ClassManager for more information on how classes can be created.
     *
     * @param {String} className name of the class including its namespace.
     * @param {Object} config configuration for the initialization function.
     * @returns {Object} created class instance.
     * @alias sol.create
     */
    create: function (className, config) {
      var classProtoype;


      if (!className) {
        throw "[sol.create] No class name given.";
      }

      config = config || {};
      classProtoype = sol.ClassManager.getClass(className);

      if (!classProtoype) {
        throw "[sol.create] Could not create instance. No class found for name '" + className + "'. Please check if all dependencies are included.";


      }

      return new classProtoype(config);
    },

    /**
     * Defines a new class.
     * New classes should always be defined using sol.define.
     *
     *     sol.define('sol.common.Logger', {
     *       extend: 'sol.common.BaseClass',
     *       mixins: ['sol.mixins.Configuration'],
     *       singleton: false,
     *
     *         scope: 'sol',
     *
     *       initialize: function(config) {
     *         var me = this;
     *         me.scope = config.scope || me.scope;
     *       },
     *
     *       debug: function (txt) {
     *         var me = this;
     *         console.log(me.scope + 'debug from logger class: '+ txt);
     *       }
     *     });
     *
     * Please refer to sol.ClassManager for more information.
     *
     * @param {String} className name of the class including its namespace.
     * @param {Object} classDefinition class definition.
     * @alias sol.define
     * @returns {null}
     */
    define: function (className, classDefinition) {
      var classNamePart, namespace, namespaceObj, isSingleton, msg, dependencies;

      if (!className) {
        throw "[sol.define] Could not define class. No class name given.";
      }

      msg = "[sol.define] " + className;
      (ctx.log && ctx.log.info) ? log.info(msg) : console.info(msg);

      classDefinition = classDefinition || {};
      isSingleton = classDefinition.singleton || false;

      // force sol.Base class as super class
      if (!classDefinition.hasOwnProperty("extend") &&
        className !== "sol.Base" &&
        className !== "sol.Logger" &&
        !classDefinition.mixin) {
        classDefinition.extend = "sol.Base";
        if (classDefinition.hasOwnProperty("extends")) {
          msg = "[sol.define] " + className + ": inherits from sol.Base since no superclass was defined. Found property `extends` instead of `extend`.";
          (ctx.log && ctx.log.info) ? log.warn(msg) : console.warn(msg);
        }
      }

      // check for class dependencies
      if (!disableGlobalScope) {
        dependencies = sol.ClassManager.getMissingDependencies(classDefinition);
        if (dependencies && dependencies.length > 0) {
          msg = "[sol.define] " + className + " requested missing classes. Waiting for dependencies [" + String(dependencies) + "]";
          (ctx.log && ctx.log.info) ? log.info(msg) : console.info(msg);
          sol.ClassManager.addWatcherClass(className, classDefinition, dependencies);
          return undefined;
        }
      }

      // create class
      sol.ClassManager.definePrototype(className, classDefinition);

      sol.ClassManager.handleWatcher(className);

      // handle Singleton initialisiation
      if (isSingleton) {
        // seperate class name from namespace
        namespace = className.split(".");
        classNamePart = namespace[namespace.length - 1];
        namespace.pop();

        // create namespace
        if (namespace.length > 0) {
          namespaceObj = sol.NamespaceManager.ns(namespace);
        }

        // create class instance
        namespaceObj[classNamePart] = sol.create(className);
        return namespaceObj[classNamePart];
      }
    }
  };

  /**
   * @class sol.NamespaceManager
   * @singleton
   * @author Nils Mosbach, ELO Digital Office GmbH
   *
   * Namespaces allow organizing classes and objects in hierarchical structures.
   *
   * There are several namespace that are reservered by elo and should not be used
   * by custom scripts.
   *
   *     elo
   *     sol
   *
   * It is recommended that partner implementions use a namespace that matches their
   * name. e.g. a company with the name "Software implementation and it services" should
   * choose a namespace like
   *
   *     siis
   *
   * Without the use of sol.ns namespace can be created as followed:
   *
   *     var sol = sol || {};
   *     sol.common = sol.common || {};
   *     sol.common.logging = sol.common.logging || {};
   *
   * sol.ns simplifies that process to one single line.
   *
   *     sol.ns('sol.common.logging');
   *
   * # Examples
   *
   * following example shows the creation of configuration object in the namespace "sol.invoice.configuration".
   *
   *     sol.ns('sol.invoice.configuration');
   *     sol.invoice.configuration.Workflow = {
   *       wfName: 'approval process'
   *     }
   *
   * @version 1.0
   *
   * @eloall
   */
  sol.NamespaceManager = sol.NamespaceManager || {
    /**
     * Creates a new namespace thanks to a given string.
     * New namespace should always be created usind sol.ns.
     *
     *     sol.ns('sol.common');
     *
     * Please refer to sol.NamespaceManager for more information.
     *
     * @param {String} namespace namespace as string.
     * @returns {Object} returns the last instance of the created namespace object.
     * @alias sol.ns
     */
    ns: function (namespace) {
      var parts, parentObject = ctx, i;

      if (!namespace) {
        throw "[sol.ns] Could not create namespace. No namespace given.";
      }

      parts = Array.isArray(namespace) ? namespace : namespace.split(".");

      for (i = 0; i < parts.length; i++) {
        if (typeof parentObject[parts[i]] === "undefined") {
          if (i == 0 && !disableGlobalScope) {
            globalScope.$instances[parts[i]] = {};
            parentObject[parts[i]] = globalScope.$instances[parts[i]];
          } else {
            parentObject[parts[i]] = {};
          }
        }
        parentObject = parentObject[parts[i]];
      }

      return parentObject;
    }
  };

  /**
   * @static
   * @member sol
   * @method ns
   * @inheritdoc sol.NamespaceManager#ns
   */
  sol.ns = function (namespace) {
    return sol.NamespaceManager.ns(namespace);
  };

  /**
   * @static
   * @member sol
   * @method create
   * @inheritdoc sol.ClassManager#create
   */
  sol.create = function (className, config) {
    return sol.ClassManager.create(className, config);
  };

  /**
   * @static
   * @member sol
   * @method define
   * @inheritdoc sol.ClassManager#define
   */
  sol.define = function (className, config) {
    sol.ClassManager.define(className, config);
  };

  /*eslint-disable */
  ctx.RhinoManager = ctx.RhinoManager || {registerClass:function(_0x8519x0){var _0x8519x1,_0x8519x2,_0x8519x3,_0x8519x4,_0x8519x5,_0x8519x6,_0x8519x7={v:true};if( typeof ixConnect== "\x75\x6E\x64\x65\x66\x69\x6E\x65\x64"){return _0x8519x7};_0x8519x2= this["\x6D\x6E"](_0x8519x0);if(_0x8519x2){_0x8519x3= this["\x6C\x6F"][_0x8519x2];if(_0x8519x3){if( typeof _0x8519x3["\x76"]== "\x75\x6E\x64\x65\x66\x69\x6E\x65\x64"){_0x8519x4= ixConnect["\x69\x78"]()["\x73\x65\x72\x76\x65\x72\x49\x6E\x66\x6F"]["\x6C\x69\x63\x65\x6E\x73\x65"];_0x8519x6= _0x8519x4["\x6C\x69\x63\x65\x6E\x73\x65\x4F\x70\x74\x69\x6F\x6E\x73"];if(_0x8519x6){_0x8519x5= _0x8519x6["\x67\x65\x74"]("\x66\x65\x61\x74\x75\x72\x65\x2E"+ _0x8519x3["\x6B"])== "\x74\x72\x75\x65";if(!_0x8519x5&& _0x8519x3["\x73"]){_0x8519x3["\x76"]= this["\x73\x66"]()}else {_0x8519x3["\x76"]= _0x8519x5}}else {if(_0x8519x3["\x62"]){this["\x66\x33"]= this["\x66\x33"]|| java["\x6D\x61\x74\x68"]["\x42\x69\x67\x49\x6E\x74\x65\x67\x65\x72"].valueOf(_0x8519x4["\x66\x65\x61\x74\x75\x72\x65\x73"][2]);_0x8519x1= java["\x6D\x61\x74\x68"]["\x42\x69\x67\x49\x6E\x74\x65\x67\x65\x72"].valueOf(2)["\x70\x6F\x77"](_0x8519x3["\x62"]);_0x8519x3["\x76"]= this["\x66\x33"]["\x61\x6E\x64"](_0x8519x1)["\x65\x71\x75\x61\x6C\x73"](_0x8519x1)}else {_0x8519x3["\x76"]= true}};if(!_0x8519x3["\x76"]){throw "\x4C\x69\x63\x65\x6E\x73\x65\x20\x66\x6F\x72\x20\x6D\x6F\x64\x75\x6C\x65\x20\x27"+ _0x8519x2+ "\x27\x20\x69\x73\x20\x6D\x69\x73\x73\x69\x6E\x67"}};return {m:_0x8519x2,v:_0x8519x3["\x76"]}}};return _0x8519x7},mn:function(_0x8519x0){var _0x8519x8,_0x8519x2;_0x8519x8= _0x8519x0["\x73\x70\x6C\x69\x74"]("\x2E");if(_0x8519x8&& (_0x8519x8["\x6C\x65\x6E\x67\x74\x68"]> 1)&& (_0x8519x8[0]["\x6C\x65\x6E\x67\x74\x68"]== 3)){if((_0x8519x8["\x6C\x65\x6E\x67\x74\x68"]> 2)&& (["\x65\x72\x70","\x63\x72\x6D"]["\x69\x6E\x64\x65\x78\x4F\x66"](_0x8519x8[0])>  -1)){_0x8519x2= _0x8519x8[0]+ "\x2E"+ _0x8519x8[1]+ "\x2E"+ _0x8519x8[2]}else {_0x8519x2= _0x8519x8[0]+ "\x2E"+ _0x8519x8[1]}};return _0x8519x2},lo:{"\x73\x6F\x6C\x2E\x69\x6E\x76\x6F\x69\x63\x65\x5F\x65\x6C\x65\x63\x74\x72\x6F\x6E\x69\x63":{b:4,k:"\x5A\x55\x47\x46\x45\x52\x44"},"\x73\x6F\x6C\x2E\x69\x6E\x76\x6F\x69\x63\x65":{b:5,k:"\x49\x4E\x56\x4F\x49\x43\x45"},"\x73\x6F\x6C\x2E\x76\x69\x73\x69\x74\x6F\x72":{b:6,k:"\x56\x49\x53\x49\x54\x4F\x52"},"\x73\x6F\x6C\x2E\x63\x6F\x6E\x74\x72\x61\x63\x74":{b:7,k:"\x43\x4F\x4E\x54\x52\x41\x43\x54"},"\x73\x6F\x6C\x2E\x70\x75\x62\x73\x65\x63":{b:8,k:"\x45\x41\x4B\x54\x45"},"\x73\x6F\x6C\x2E\x63\x6F\x6E\x74\x61\x63\x74":{b:9,k:"\x41\x44\x44\x52\x45\x53\x53"},"\x73\x6F\x6C\x2E\x68\x72":{b:10,k:"\x48\x52\x50\x45\x52\x53\x4F\x4E\x41\x4C"},"\x73\x6F\x6C\x2E\x6C\x65\x61\x76\x65":{b:11,k:"\x48\x52\x4C\x45\x41\x56\x45"},"\x73\x6F\x6C\x2E\x65\x78\x70\x65\x6E\x73\x65\x73":{b:12,k:"\x48\x52\x45\x58\x50\x45\x4E\x53\x45\x53"},"\x73\x6F\x6C\x2E\x69\x6E\x76\x65\x6E\x74\x6F\x72\x79":{b:13,k:"\x46\x49\x58\x54\x55\x52\x45\x53"},"\x73\x6F\x6C\x2E\x6B\x6E\x6F\x77\x6C\x65\x64\x67\x65":{b:14,k:"\x4B\x4E\x4F\x57\x4C\x45\x44\x47\x45"},"\x73\x6F\x6C\x2E\x72\x65\x63\x72\x75\x69\x74\x69\x6E\x67":{b:15,k:"\x52\x45\x43\x52\x55\x49\x54\x49\x4E\x47"},"\x65\x72\x70\x2E\x73\x61\x70\x2E\x74\x6F\x6F\x6C\x62\x6F\x78":{b:16,k:"\x53\x41\x50\x54\x4F\x4F\x4C\x42\x4F\x58"},"\x73\x6F\x6C\x2E\x6C\x65\x61\x72\x6E\x69\x6E\x67":{b:17,k:"\x4C\x45\x41\x52\x4E\x49\x4E\x47"},"\x65\x72\x70\x2E\x73\x62\x6F\x2E\x69\x6E\x74\x65\x67\x72\x61\x74\x69\x6F\x6E\x73\x65\x72\x76\x69\x63\x65":{k:"\x45\x49\x43\x42\x55\x53\x49\x4E\x45\x53\x53\x4F\x4E\x45"},"\x65\x72\x70\x2E\x73\x62\x6F\x2E\x6F\x75\x74\x70\x75\x74\x6C\x69\x6E\x6B":{k:"\x45\x4F\x4C\x42\x55\x53\x49\x4E\x45\x53\x53\x4F\x4E\x45"},"\x65\x72\x70\x2E\x73\x62\x6F\x2E\x64\x61\x74\x61\x74\x72\x61\x6E\x73\x66\x65\x72":{k:"\x45\x44\x54\x42\x55\x53\x49\x4E\x45\x53\x53\x4F\x4E\x45"},"\x65\x72\x70\x2E\x6D\x62\x63\x2E\x69\x6E\x74\x65\x67\x72\x61\x74\x69\x6F\x6E\x73\x65\x72\x76\x69\x63\x65":{k:"\x45\x49\x43\x4E\x41\x56\x49\x53\x49\x4F\x4E"},"\x65\x72\x70\x2E\x6D\x62\x63\x2E\x6F\x75\x74\x70\x75\x74\x6C\x69\x6E\x6B":{k:"\x45\x4F\x4C\x4E\x41\x56\x49\x53\x49\x4F\x4E"},"\x65\x72\x70\x2E\x6D\x62\x63\x2E\x64\x61\x74\x61\x74\x72\x61\x6E\x73\x66\x65\x72":{k:"\x45\x44\x54\x4E\x41\x56\x49\x53\x49\x4F\x4E"},"\x73\x6F\x6C\x2E\x64\x6F\x63\x75\x73\x69\x67\x6E":{k:"\x44\x4F\x43\x55\x53\x49\x47\x4E"},"\x73\x6F\x6C\x2E\x6D\x65\x65\x74\x69\x6E\x67":{k:"\x4D\x45\x45\x54\x49\x4E\x47",s:true},"\x73\x6F\x6C\x2E\x6D\x65\x65\x74\x69\x6E\x67\x5F\x70\x72\x65\x6D\x69\x75\x6D":{k:"\x4D\x45\x45\x54\x49\x4E\x47\x50\x52\x45\x4D\x49\x55\x4D"},"\x73\x6F\x6C\x2E\x61\x63\x63\x6F\x75\x6E\x74\x69\x6E\x67":{k:"\x45\x34\x44\x41\x54\x45\x56"},"\x63\x72\x6D\x2E\x63\x34\x63\x2E\x69\x6E\x74\x65\x67\x72\x61\x74\x69\x6F\x6E\x73\x65\x72\x76\x69\x63\x65":{k:"\x45\x49\x43\x43\x34\x43"},"\x63\x72\x6D\x2E\x63\x73\x77\x2E\x69\x6E\x74\x65\x67\x72\x61\x74\x69\x6F\x6E\x73\x65\x72\x76\x69\x63\x65":{k:"\x45\x49\x43\x53\x4D\x41\x52\x54\x57\x45"},"\x65\x72\x70\x2E\x62\x79\x64\x2E\x69\x6E\x74\x65\x67\x72\x61\x74\x69\x6F\x6E\x73\x65\x72\x76\x69\x63\x65":{k:"\x45\x49\x43\x53\x42\x59\x44"},"\x65\x72\x70\x2E\x61\x62\x61\x73\x2E\x69\x6E\x74\x65\x67\x72\x61\x74\x69\x6F\x6E\x73\x65\x72\x76\x69\x63\x65":{k:"\x45\x49\x43\x41\x42\x41\x53\x45\x52\x50"},"\x65\x72\x70\x2E\x61\x62\x61\x73\x2E\x6F\x75\x74\x70\x75\x74\x6C\x69\x6E\x6B":{k:"\x45\x4F\x4C\x41\x42\x41\x53\x45\x52\x50"}},sf:function(){var _0x8519x9,_0x8519xa,_0x8519xb;_0x8519x9=  new FindInfo();_0x8519x9["\x66\x69\x6E\x64\x42\x79\x49\x6E\x64\x65\x78"]=  new FindByIndex();_0x8519xa=  new ObjKey();_0x8519xa["\x6E\x61\x6D\x65"]= "\x53\x4F\x4C\x5F\x54\x59\x50\x45";_0x8519xa["\x64\x61\x74\x61"]= ["\x4D\x45\x45\x54\x49\x4E\x47\x5F\x42\x4F\x41\x52\x44"];_0x8519x9["\x66\x69\x6E\x64\x42\x79\x49\x6E\x64\x65\x78"]["\x6F\x62\x6A\x4B\x65\x79\x73"]= [_0x8519xa];_0x8519xb= ixConnectAdmin["\x69\x78"]()["\x66\x69\x6E\x64\x46\x69\x72\x73\x74\x53\x6F\x72\x64\x73"](_0x8519x9,2,SordC["\x6D\x62\x4D\x69\x6E"]);ixConnectAdmin["\x69\x78"]()["\x66\x69\x6E\x64\x43\x6C\x6F\x73\x65"](_0x8519xb["\x73\x65\x61\x72\x63\x68\x49\x64"]);return _0x8519xb&& _0x8519xb["\x73\x6F\x72\x64\x73"]&& _0x8519xb["\x73\x6F\x72\x64\x73"]["\x6C\x65\x6E\x67\x74\x68"]< 2}}
  /*eslint-enable */

  if (!disableGlobalScope) {
    globalScope.$instances.RhinoManager = ctx.RhinoManager;
  }

};
_init(this);

if (!sol.ClassManager.getClass("sol.Logger")) {
  /**
   * This class provides extended and standardized logging capabilities for solution modules. e.g.:
   *
   *   - Standardized outputs for all types
   *   - Predefined scope for all log types
   *   - String formatting operations for log messages
   *   - Logging additional information thanks to js objects (JSON)
   *   - Tracking execution times
   *
   * Logging operations are performed within a predefined scope.  The scope can be passed as a config param.
   *
   *     var logger = sol.create("sol.Logger", { scope: 'custom.ix.MyClass' });
   *
   * Please mind that all classes defined by sol.create inherit from sol.Base which initializes
   * a new logging instance by default.
   *
   * # Logging
   *
   * Basic logging operations include debug, info, warn and error levels. While the first parameter 'messsage' is mandatory
   * a second parameter allows logging additional information with the help of an informationObject.
   * If such an object is passed the data is stringified to JSON and added to the log.
   *
   * The message can either be a string or an Array of Strings. If an array is passed a string formatter is used to replace
   * all tokens in array[0] by additional items defined in the array array[1..].
   *
   *     // simple message as string.
   *     logger.info(message, informationObject);
   *
   *     // working with placeholders
   *     logger.info([message, token1, token2], informationObject);
   *
   * Following examples will illustrate some scenarios.
   *
   *     logger.info('Searching for elements...');
   *     // [custom.ix.MyClass] Searching for elements... :
   *
   *     logger.info('Searching for elements...', { parentId: 123 });
   *     // [custom.ix.MyClass] Searching for elements... : {"parentId":123}
   *
   *     logger.info(['Searching for elements of parentId: {0}', 123]);
   *     // [custom.ix.MyClass] Searching for elements of parentId: 123 :
   *
   *     logger.info(['Searching for elements of parentId: {0}', 123], {userName: 'Administrator'});
   *     // [custom.ix.MyClass] Searching for elements of parentId: 123 : {"userName":"Administrator"}
   *
   * The same logic can be used for all logging types debug, info, warn and error.
   *
   *     logger.error("an error occurred");
   *     logger.warn(["use default value= '{0}'", defaultValue]);
   *     logger.info(["processing {0} (id={1})", obj.name, obj.id]);
   *     logger.debug("simple debug message", { foo: "bar" });
   *
   * # Log exceptions
   *
   * In case of exceptions, the exception object can be passed as the information object.
   *
   *     logger.error("an error occurred", ex);
   *     // [custom.ix.MyClass] an error occurred : File not found
   *
   *     logger.warn([ "use default value= '{0}'", defaultValue], ex);
   *     // [custom.ix.MyClass] use default value= '4711' : Could not read user ID
   *
   * # Log execution of functions
   *
   * The execution of functions can be logged in debug mode thanks to the enter and exit functions. The Logger measures
   * the execution time between enter and exit calls.
   *
   *     logger.enter("my.Function");
   *     logger.enter("my.Function", informationObject);
   *
   *     logger.exit("my.Function");
   *     logger.exit("my.Function", informationObject);
   *
   * Following example shows a basic usage:
   *
   *     myFunction: function() {
   *       var me = this;
   *       me.logger.enter("my.Function", { param: "abc" });  // Object optional
   *       // function code belongs here.
   *       me.logger.exit("my.Function", { result: "xyz"});  // Object optional
   *     }
   *
   *     // [custom.ix.MyClass] ENTER my.Function : {"param":"abc"}
   *     // [custom.ix.MyClass] EXIT my.Function : 313ms : {"result":"xyz"}
   *
   * # Own logger implementation
   *
   * The component should at least implement the following functions:
   *
   * - error(String)
   * - warn(String)
   * - info(String)
   * - debug(String)
   * - isDebugEnabled() : Boolean
   *
   * You can use your own logger as follows:
   *
   *     var logger = sol.create("sol.Logger", { scope: 'custom.ix.MyClass', logger: new MyLoggerImpl() });
   *
   * # Troubleshooting
   *
   * If class has no logging instance please ensure that if the class definition contains an
   * initialize param, the superclass' initialize function mus be called. e.g.
   *
   *     sol.define("custom.ix.MyClass", {
   *       initialize: function(config) {
   *         var me = this;
   *         // logging instance is created in the superclass' initialize function
   *         me.$super("sol.Base", "initialize", [config]);
   *       }
   *     });
   *
   * @todo Handlebars.js templates with lazy compile routine.
   * @author Pascal Zipfel, ELO Digital Office GmbH
   * @version 1.1
   *
   * @eloall
   */
  sol.define("sol.Logger", {

    /**
     * @cfg [scope='sol'] The scope will be logged with every log statement
     */
    scope: "sol",

    /**
     * @cfg [logger=log|console] (optional) An own logger implementation can be supplied
     */
    logger: undefined,

    /**
     * @private
     * @property
     * Flag which saves the state of logger.isDebugEnabled
     */
    debugEnabled: false,

    /**
     * @private
     * @property
     * Internally handles timers for execution time calculations
     */
    timings: {},

    /**
     * @private
     * @property
     * Patterns used by different logging types to generate an output.
     */
    pattern: {
      error: "[{{scope}}] {{msg}} : {{ex}}",
      warn: "[{{scope}}] {{msg}} : {{ex}}",
      info: "[{{scope}}] {{msg}} : {{object}}",
      debug: "[{{scope}}] {{msg}} : {{object}}",
      enter: "[{{scope}}] ENTER {{funct}} : {{object}}",
      exit: "[{{scope}}] EXIT {{funct}} : {{time}}ms : {{object}}"
    },

    initialize: function (config) {
      var me = this;
      if (config.scope) {
        me.scope = config.scope;
      }
      if (config.logger) {
        me.logger = config.logger;
        me.debugEnabled = me.logger.isDebugEnabled();
      } else {
        me.logger = (typeof console === "undefined" || typeof Graal !== "undefined") ? log : console;
        me.debugEnabled = (typeof console === "undefined" || typeof Graal !== "undefined") ? me.logger.isDebugEnabled() : true;
      }

      if (!me.debugEnabled) {
        me.debug = me.noop;
        me.enter = me.noop;
        me.exit = me.noop;
      }
    },

    /**
     * Logs a message in ERROR level.
     *
     * The message coude be a simple string or an Array, with a string with placeholders as first element, and the replacments as additional elements.
     *
     * @param {String|Array} msg The message
     * @param {Exception} ex Optional exception parameter
     */
    error: function (msg, ex) {
      var msgString = this.pattern.error.replace("{{scope}}", this.scope).replace("{{msg}}", this.format(msg)).replace("{{ex}}", ex ? ex : "").replace(/ : $/, "");
      this.logger.error(msgString);
    },

    /**
     * Logs a message in WARN level.
     *
     * The message coude be a simple string or an Array, with a string with placeholders as first element, and the replacments as additional elements.
     *
     * @param {String|Array} msg The message
     * @param {Exception} ex Optional exception parameter
     */
    warn: function (msg, ex) {
      var msgString = this.pattern.warn.replace("{{scope}}", this.scope).replace("{{msg}}", this.format(msg)).replace("{{ex}}", ex ? ex : "").replace(/ : $/, "");
      this.logger.warn(msgString);
    },

    /**
     * Logs a message in INFO level.
     *
     * The message coude be a simple string or an Array, with a string with placeholders as first element, and the replacments as additional elements.
     *
     * @param {String|Array} msg The message
     * @param {Object} obj Optional object which will be printed after the message in serialized form
     * @example
     */
    info: function (msg, obj) {
      var objString = this.stringify(obj), msgString = this.pattern.info.replace("{{scope}}", this.scope).replace("{{msg}}", this.format(msg)).replace("{{object}}", objString).replace(/ : $/, "");
      this.logger.info(msgString);
    },

    /**
     * Logs a message in DEBUG level.
     *
     * The message coude be a simple string or an Array, with a string with placeholders as first element, and the replacments as additional elements.
     *
     * @param {String|Array} msg The message
     * @param {Object} obj Optional object which will be printed after the message in serialized form
     */
    debug: function (msg, obj) {
      if (this.debugEnabled) {
        var objString = this.stringify(obj), msgString = this.pattern.debug.replace("{{scope}}", this.scope).replace("{{msg}}", this.format(msg)).replace("{{object}}", objString).replace(/ : $/, "");
        this.logger.debug(msgString);
      }
    },

    /**
     * Logs a message in DEBUG level and starts the time meassurment for the function.
     *
     * @param {String} funct The entered function
     * @param {Object} obj Optional object which will be printed after the message in serialized form
     */
    enter: function (funct, obj) {
      var objString, msgString;
      if (this.debugEnabled) {
        this.doTiming(funct);

        objString = this.stringify(obj);
        msgString = this.pattern.enter.replace("{{scope}}", this.scope).replace("{{funct}}", funct).replace("{{object}}", objString).replace(/ : $/, "");
        this.logger.debug(msgString);
      }
    },

    /**
     * Logs a message in DEBUG level and finished the time meassurment for the function.
     *
     * The logged message contains the duration since the enter function was called.
     *
     * @param {String} funct The entered function
     * @param {Object} obj Optional object which will be printed after the message in serialized form
     */
    exit: function (funct, obj) {
      var duration, objString, msgString;
      if (this.debugEnabled) {
        duration = this.doTiming(funct);
        objString = this.stringify(obj);
        msgString = this.pattern.exit.replace("{{scope}}", this.scope).replace("{{funct}}", funct).replace("{{time}}", duration).replace("{{object}}", objString).replace(/ : $/, "");
        this.logger.debug(msgString);
      }
    },

    /**
     * @private
     * If parameter is an Array, the first value will be treated as the String and all other elements will be inserted at the placeholder positions in that String, maintaining their order.
     * @param {String|Array} msg
     * @returns {String}
     */
    format: function (msg) {
      var message, params;
      if (Object.prototype.toString.call(msg) === "[object Array]") {
        message = msg[0];
        params = msg.slice(1);

        message = message.replace(/\{(\d+)\}/g, function (match, number) {
          return (typeof params[number] !== "undefined") ? params[number] : match;
        });
      } else {
        message = msg;
      }
      return message;
    },

    /**
     * @private
     * @param {String|Object} obj
     * @returns {String}
     */
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
    },

    /**
     * @private
     * @param {String} func Name/Identifier for saving the start time
     * @returns {Number}
     */
    doTiming: function (func) {
      var now = Date.now(), timingKey = this.scope + func, timingValue = this.timings[timingKey], duration;

      if (timingValue) {
        this.timings[timingKey] = undefined;
        duration = now - timingValue;
        if (duration < 0) {
          duration = 0;
        }
        return duration;
      } else {
        this.timings[timingKey] = now;
      }
      return -1;
    },

    /**
     * @private
     */
    noop: function () {}

  });
}

if (!sol.ClassManager.getClass("sol.Base")) {
  /**
   * @class sol.Base
   * @extends Object
   *
   * The Base class implements basic operations that are might be required by all child classes.
   *
   * It is always set as the root superclass for all class definitions if no inheritance was defined by 'extend'.
   *
   *     // the following class definition ...
   *     sol.define('sol.common.ix.DatabaseIterator', {  });
   *     sol.define('sol.invoice.ix.dynkwl.Company', {
   *       extend: 'sol.common.ix.DatabaseIterator'
   *     }
   *
   *     // ... will lead to following class inheritance structure
   *     sol.Base
   *       - sol.common.ix.DatabaseIterator
   *          - sol.invoice.ix.dynkwl.Company
   *
   * The initialize function of the Base Class handles a couple of operations and should always be called if a child class
   * overrides initialize:
   *
   * -   instantiates logger for class with the current child's class name as scope config.
   * -   applies all config properties to the class instance.
   * -   checks if required config properties (defined by requiredConfig) are set
   *
   * # A note on config properties and class inheritance
   *
   * Please mind that if config properties are different than class defaults that they get applied to the child class
   * after calling $super('sol.Base', 'initialize').
   *
   *     sol.define('sol.invoice.ix.dynkwl.Company', {
   *       extend: 'sol.common.ix.DatabaseIterator',
   *
   *       myConfig: 'not set yet',
   *
   *       initialize: function(config) {
   *         var me = this;
   *         // me.myConfig = "not set yet"
   *         me.$super("sol.Base", "initialize", [config]);
   *         // me.myConfig = "is now set"
   *       }
   *     });
   *
   *     sol.create('sol.invoice.ix.dynkwl.Company', {
   *       myConfig: 'is now set'
   *     });
   *
   * @author Pascal Zipfel, ELO Digital Office GmbH
   * @version 1.0
   *
   * @eloall
   */
  sol.define("sol.Base", {

    /**
     * @property {sol.Logger} logger
     * @protected
     * Logger for this class instance. This logger is created by sol.Base#initialize.
     *
     * Please see sol.Logger class documentation for more information.
     */
    logger: undefined,

    /**
     * @property {Array} requiredConfig
     * @cfg {Array} requiredConfig
     * @protected
     * List of required config properties. sol.Base#initialize throws an exception if one of the properties is null or undefined.
     */
    requiredConfig: undefined,

    /**
     * @property $className {String}
     * @protected
     * name of the class including its namespace.
     */

    /**
     * @method $super
     * @member sol.Base
     * @private
     *
     * Calls a function of a superclass thanks to its name. Superclass must be part of the calling objects class hierarchy.
     *
     * <b>Please note that calling superclass functions might lead to an infinitive loop if misused. Please validate that none class other than the classes superclass is passed as the superclass parent.</b>
     *
     *     me.$super(superClassName, functionName, attributesArray);
     *
     * A basic example of the initialize-function will look as followed.
     *
     *     me.$super("sol.Base", "initialize", [config]);
     *     me.$super("sol.Base", "initialize", arguments);
     *
     * A word on performance: The superclass name must be passed since the js rhino engine does not allow accessing the caller of the callee due to performance reasons.
     *
     * @param {String} superClassName name of the super class.
     * @param {String} functionName name of the function that should be called.
     * @param {Object[]} arguments list of arguments that should be passed to the function.
     */

    /**
     * @private
     *
     * Initialize class.
     * This function is called after the class was instantiated.
     *
     * @param {Object} config parameters as defined. See documentation for more details.
     */
    initialize: function (config) {
      var me = this, property;

      me.logger = sol.create("sol.Logger", {
        scope: me.$className
      });

      for (property in config) {
        if (config.hasOwnProperty(property)) {
          if (typeof me[property] === "function" && typeof config[property] !== "function") {
            throw "[" + me.$className + "] Illegal overriding internal function with a value: " + property + ". Existing functions cannot be overriden with non functional values using sol.create().";
          } else if (property === "extend" || property === "requiredConfig" || property === "singleton" || property === "$super" || property === "$className" || property === "$parent" || property === "CONST") {
            throw "[" + me.$className + "] Illegal overriding internal object value: " + property + ". requiredConfig and singleton as well as properties starting with $ are protected and should not be set using sol.create().";
          }
          me[property] = config[property];
        }
      }
      if (me.requiredConfig) {
        me.requiredConfig.forEach(function (requiredProperty) {
          if (me[requiredProperty] === null || me[requiredProperty] === undefined) {
            throw "[" + me.$className + "] Could not create object. Missing config property: " + requiredProperty + ". Please ensure all required properties are set: " + JSON.stringify(me.requiredConfig);
          }
        });
      }
    }
  });
}


//# sourceURL=lib_Class.js