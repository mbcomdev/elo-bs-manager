
//@include lib_Class.js

/**
 * This class contains convenience methods for working with java script basic types and objects.
 *
 * @author PZ, ELO Digital Office GmbH
 * @version 1.1
 *
 * @eloall
 */
sol.define("sol.common.ObjectUtils", {
  singleton: true,

  /**
   * @private
   * @property {Function} _toStringFunction Reference to Object.prototype.toString
   */
  _toStringFunction: Object.prototype.toString,

  /**
   * Checks, if an Object is empty.
   * @param {Object} o
   * @return {Boolean}
   */
  isEmpty: function (o) {
    if (o === null || o === undefined) {
      return true;
    }
    if (o.length > 0) {
      return false;
    }
    if (Object.getOwnPropertyNames(o).length > 0) {
      return false;
    }
    return true;
  },

  /**
   * returns a variables real type. (typeof + null, nan, array, date, javaobject, regexp,...)
   * javastrings are reported as a normal string. Best practice: Always String() values this function reports as "string"
   *
   * e.g. type(123, "number") => true
   *      type([]) => "array"
   *
   * @param {Object} val the value to typecheck
   * @param {String} should the typename which should match
   * @returns {Boolean|String} returns Boolean if `should` is defined (true if determined type equals `should`, false if not). otherwise returns the determined type as a string
   */
  type: function (val, should) {
    var t; t = (
      (val !== val && "nan")
      || ((t = typeof val) !== "object" && t)
      || (typeof java !== "undefined" && val instanceof java.lang.String && "string")
      || ((t = Object.prototype.toString.call(val)), t.substring(8, t.length - 1).toLowerCase())
    );
    return should ? t === should : t;
  },

  /**
   * Checks, if an object is a JavaScript String
   * @param {Object} o
   * @returns {Boolean}
   */
  isString: function (o) {
    return this._toStringFunction.call(o) === "[object String]";
  },

  /**
   * Checks, if an object is a JavaScript Number
   * @param {Object} o
   * @returns {Boolean}
   */
  isNumber: function (o) {
    return this._toStringFunction.call(o) === "[object Number]";
  },

  /**
   * Checks, if an object is a JavaScript Date
   * @param {Object} o
   * @returns {Boolean}
   */
  isDate: function (o) {
    return this._toStringFunction.call(o) === "[object Date]";
  },

  /**
   * Checks, if an object is a JavaScript Array
   * @param {Object} o
   * @return {Boolean}
   */
  isArray: function (o) {
    return this._toStringFunction.call(o) === "[object Array]";
  },

  /**
   * Checks, if an object is a JavaScript Function
   * @param {Object} o
   * @return {Boolean}
   */
  isFunction: function (o) {
    return this._toStringFunction.call(o) === "[object Function]";
  },

  /**
   * Checks, if an object is a JavaScript object
   * @param {Object} o
   * @return {Boolean}
   */
  isObject: function (o) {
    return this._toStringFunction.call(o) === "[object Object]";
  },

  /**
   * Checks, if an object is a Java (Rhino) object
   * @param {Object} o
   * @return {Boolean}
   */
  isJavaObject: function (o) {
    return this._toStringFunction.call(o) === "[object JavaObject]";
  },

  /**
   * Checks, if an object is a JavaScript regular expression
   * @param {Object} o
   * @return {Boolean}
   */
  isRegExp: function (o) {
    return this._toStringFunction.call(o) === "[object RegExp]";
  },

  /**
   * Checks, if an object is blank. Works for Array (only contains ) and String, all other types always return `false`.
   * @param {Object} o
   * @return {Boolean}
   */
  isBlank: function (o) {
    if (this.isArray(o)) {
      o = o.filter(function (e) {
        return (typeof e !== "undefined");
      });
    }
    if (this.isString(o)) {
      o = o.trim();
      return o.length == 0;
    }
    return this.isEmpty(o);
  },


  /**
   * Determine whether the current object `o` is truthy
   * https://developer.mozilla.org/de/docs/Glossary/Truthy
   *
   * @param {*} o
   * @returns true when the passed obj is truthy otherwise false
   */
  isTruthy: function (o) {
    return !!o;
  },

  /**
   * Returns the passed object into an array.
   * When the object is already an array the original array
   * will return
   * @param {Object|Array} o object to wrap into an array
   * @returns capsulated object within an array
  */
  toArray: function (o) {
    return sol.common.ObjectUtils.isArray(o) ? o : [o];
  },

  /**
   * Merges a list of objects.
   *
   * The `base` object is the first object in the merging chain.
   * Properties from the `mergeList` objects will be added to the base object.
   * If there is already a property in the base object, it will only be overwritten, if the types match.
   *
   *     var o1 = { a: "hello", b: "world" };
   *     var o2 = { b: "developer", c: "foobar" };
   *     var merged = sol.common.ObjectUtils.mergeObject(o1, [o2]);  // merged => { a: "hello", b: "developer", c: "foobar" }
   *
   * @param {Object} base
   * @param {Object[]} mergeList (optional)
   * @param {Boolean} [preserveCustom=false] (optional) If `true`, all objects from `mergeList` will be cloned. Otherwise the merge process will work directly on the objects and may alter them
   * @param {String} path (optional) Startpath/objectname, used for logging
   * @param {Function} assignCallback (optional) Will be called for every property assignment (if set, this function has to take care of the assignment itself)
   * @param {Function} recursionCheck (optional) This function is called for every property and decides if the property has to be merged recursively (returns `true`) or not (returns `false`)
   * @return {Object} The merged object
   */
  mergeObjects: function (base, mergeList, preserveCustom, path, assignCallback, recursionCheck) {
    var me = this,
        log = [],
        custom = [],
        idx, curr, succ, logTemp;

    if (Array.isArray(mergeList)) {
      custom = mergeList.slice();
    } else if (!!mergeList) {
      custom.push(mergeList);
    }

    if (custom.length === 0) {
      return base;
    }

    function clone(o) {
      return !!preserveCustom ? me.clone(o) : o;
    }

    idx = custom.unshift(base) - 1;

    while (idx > 0) {
      curr = clone(custom[idx]);
      succ = clone(custom[idx - 1]);

      logTemp = [];
      custom[idx - 1] = me.merge(curr, succ, logTemp, path, assignCallback, recursionCheck);
      if (logTemp.length > 0) {
        logTemp.unshift("Custom argument id " + idx + " contains logs!");
        log = log.concat(logTemp);
      }

      idx--;
    }

    if (log.length > 0) {
      custom[0]._$mergeLog$_ = log;
    }

    return custom[0];
  },

  /**
   * Clones an object.
   * @param {Object} o
   * @returns {Object}
   */
  clone: function (o) {
    return JSON.parse(JSON.stringify(o));
  },

  /**
   * Merges all properties in base into custom. Existing properties in custom will be preserved, but only
   * if they match the type of the property in base. Otherwise the property of base will be used
   * and a log will be written to array parameter log.
   *
   * This function does not support functions. It does support Array, Object and Date and creates a clone from it.
   * @param {Object} custom The object containing all merged data (object will be altered)
   * @param {Object} base The object from which will be copied to the `custom` object
   * @param {String[]} [log=[]] (optional) Logging messages will be pushed to this array
   * @param {String} [path=''] (optional) Startpath/objectname, used for logging
   * @param {Function} assignCallback (optional) Will be called for every property assignment (if set, this function has to take care of the assignment itself)
   * @param {Function} recursionCheck (optional) This function is called for every property and decides if the property has to be merged recursively (returns `true`) or not (returns `false`)
   * @returns {Object} The merged object (`custom`)
   */
  merge: function (custom, base, log, path, assignCallback, recursionCheck) {
    var me = this,
        prop;
    log = log || [];
    path = path || "";

    recursionCheck = recursionCheck || function (custom, base, prop) { // eslint-disable-line no-shadow
      return base[prop] instanceof Object && !(base[prop] instanceof Array) && !(base[prop] instanceof Date);
    };

    assignCallback = assignCallback || function (target, source, propertyName) {
      target[propertyName] = source[propertyName];
    };

    for (prop in base) {
      if (base.hasOwnProperty(prop)) {
        //check for same type (array must be checked separately) and use default property instead
        if ((typeof custom[prop] !== "undefined") && (custom[prop] !== null) && (base[prop] !== null) && ((typeof custom[prop] !== typeof base[prop]) ||
          (Array.isArray(base[prop]) !== Array.isArray(custom[prop])))) {
          log.push("Warning: The type of custom property " + path + "." + prop + " is not the same as in the target. Custom property is ignored.");
          custom[prop] = me.clone(base[prop]);
        } else if (recursionCheck(custom, base, prop)) {
          //recursion
          custom[prop] = me.merge(custom[prop] || {}, base[prop], log, path + "." + prop, assignCallback, recursionCheck); //return empty object if p does not exist in target
        } else if (custom[prop] === undefined) {
          //copy default property only if not exist in custom
          if (base[prop] instanceof Date) {
            custom[prop] = new Date(base[prop]);
          } else if (base[prop] instanceof Array) {
            custom[prop] = me.clone(base[prop]);
          } else {
            assignCallback(custom, base, prop);
          }
        }
      }
    }
    return custom;
  },

  /**
   * Converts an array of objects to an object
   * @param {Array} arr
   * @param {keyPropName} keyPropName name of the property key for the new key
   * @return {Object}
   */
  getObjectFromArray: function (arr, keyPropName) {
    var i,
        o = {},
        entry;
    if (arr && keyPropName) {
      for (i = 0; i < arr.length; i++) {
        entry = arr[i];
        o[String(entry[keyPropName])] = entry;
      }
    }
    return o;
  },

  /**
   * Returns the values of an Object
   * @param {Object} o Object
   * @return {Array} Array
   */
  getValues: function (o) {
    var key,
        arr = [];
    if (o) {
      for (key in o) {
        if (o.hasOwnProperty(key)) {
          arr.push(o[key]);
        }
      }
    }
    return arr;
  },

  /**
   * Function ´forEach´ that works in Rhino and Nashorn
   * @param {Array} arr Array
   * @param {Function} callback Callback
   * @param {Object} context Context
   */
  forEach: function (arr, callback, context) {
    if (!callback) {
      throw "Callback is missing";
    }
    var i;
    for (i = 0; i < arr.length; i++) {
      callback(arr[i], i, context);
    }
  },

  /**
   * Function ´map´ that works in Rhino and Nashorn
   * @param {Array} arr Array
   * @param {Function} callback Callback
   * @param {Object} context Context
   * @return {Array} Array
   */
  map: function (arr, callback, context) {
    var i,
        resultArr = [];
    if (!callback) {
      throw "Callback is missing";
    }
    for (i = 0; i < arr.length; i++) {
      resultArr.push(callback(arr[i], i, context));
    }
    return resultArr;
  },

  // Polyfill for Array.prototype.find (Rhino <= 1.7R5)
  arrayFind: function (arr, cb) {
    var list = arr, length = list.length, value, i;

    for (i = 0; i < length; i++) {
      value = list[i];
      if (cb(value, i, list)) {
        return value;
      }
    }
    return undefined;
  },

  /**
  * Returns the first object of an array whose property "id" has the value val.
  * @param {Array} a array containing the objects
  * @param {Any} val value to search for
  * @param {String} customProp  custom property name, if the property is not "id"
  * @param {Function} customCallback custom callback for Array.find function
  * @return {Object} found object or undefined. false if a is not an Array
  * Rhino 1.7R5 does not implement Array.prototype.find. arrayFind takes is place in this case
  */
  findObjInArray: function (a, val, customProp, customCallback) {
    var me = this,
        cb = function (ae) {
          return ae[customProp || "id"] === val;
        };
    return (
      Array.isArray(a)
      &&
      (
        (a.find && a.find(customCallback || cb))
        || (!a.find && me.arrayFind(a, (customCallback || cb)))
      )
      || undefined
    );
  },

  /**
   * Returns an object containing only specific properties of the input object.
   * @param {Object} o  input object
   * @param {Array} include  array containing all properties to include as strings. Empty array includes all properties.
   * @param {Array} exclude  array containing all properties to exclude. Empty array means exclude nothing from include. If values are defined in include and exclude, they are excluded.
   * @return {Object}
   */
  getPropsOfObj: function (o, include, exclude) {
    var name,
        result = {};

    if (typeof o === "object" && (Array.isArray(include)) && (!exclude || Array.isArray(exclude))) {
      for (name in o) {
        name = name.trim();
        if (
          name.length > 0
          && (
            (include.length === 0 && (!exclude || exclude.indexOf(name) === -1))
            || (include.indexOf(name) > -1 && (!exclude || exclude.indexOf(name) === -1))
          )
        ) {
          result[name] = o[name];
        }
      }
    }
    return result;
  },

  /**
   * gets a property from an `object` by traversing the passed `path`.
   * if the property is inside an object which is inside an array, the array must contain
   * a property called `id` containing the corresponding part of the `path`.
   * e.g. y = { x: [ {id: "test", myniceprop: 42} ] }
   * if you want to retrieve "myniceprop", you would call getProp(y, "x.test.myniceprop")
   * note: this is also a better way to get a property from an object with probably uninitialized preceding properties
   * optional: if passed a `customPropName`, getProp will use the name as the array-object-property name
   * e.g. y = { x: [ {__ID: "test", myniceprop: 42} ] }    -->  getProp(y, "x.test.myniceprop", "__ID")
   *
   * If your target prop is an array you can use the special prop `$length` to determine the array
   * length of the element. This works only in context of array and will terminate the prop request.
   *
   * e.g. y = { x : [{ id:1 }, { id:2 }] } --> getProp(y, "x.$length")
   *
   * @param {Object} object Object
   * @param {String} path Path
   * @param {String} customPropName Custom property name
   * @returns {Object}
   */
  getProp: function (object, path, customPropName) {
    var arr = (typeof path === "string") && path.split("."), curr = undefined;
    if (arr.length > 0) {
      curr = object;
      arr.forEach(function (key) {
        if (curr && (key.length > 0)) {
          if (Array.isArray(curr)) {
            if (key === "$length") {
              // special prop to determine length of an array
              curr = curr.length;
            } else {
              curr = sol.common.ObjectUtils.findObjInArray(curr, key, customPropName);
            }
          } else if (typeof curr === "object") {
            curr = curr[key];
          }
        }
      });
    } else if (path === "" || path === undefined) {
      curr = object;
    }
    return curr;
  },

  /**
   * sets a property of an `object` by traversing the passed `path`.
   * the last part of the path is the target property name.
   * if a property is inside an object which is inside an array, the array must contain
   * a property called `id` containing the corresponding part of the `path`.
   * The function can then traverse the array and create an empty object if necessary.
   *
   * @param {Object} object Object
   * @param {String} path Path
   * @param {String} value Value to be set
   * @param {Boolean} overwrite Overwrite path property if it is not an object yet
   * @param {String} customPropName Custom property name
   * @returns {Object}
   */
  setProp: function (object, path, value, overwrite, customPropName) {
    var me = this, arr = (typeof path === "string") && path.split("."),
        targetProp = arr.pop(), curr = undefined;
    if (arr.length > 0) {
      curr = object;
      arr.forEach(function (key) {
        var val = curr[key],
            arrObj;
        if (me.type(curr[key], "object")) {
          curr = val;
        } else if (Array.isArray(curr[key])) {
          if (!(arrObj = sol.common.ObjectUtils.findObjInArray(val, customPropName.value, (customPropName || {}).key || key))) {
            arrObj = {};
            arrObj[(customPropName || {}).key || key || "id"] = customPropName.value;
            val.push(arrObj);
          }
          curr = arrObj;
        } else if (val == null || overwrite) {
          curr = (curr[key] = {});
        } else {
          throw "path part `" + key + "` was not an object. Pass true as 'overwrite' parameter to perform this action ...";
        }
      });
      curr[targetProp] = value;
    } else if (targetProp !== "") {
      object[targetProp] = value;
    } else if (path === "" || path === undefined) {
      throw "path must be defined in setProp";
    }

    return curr;
  },

  /**
   * Sorts a table by column
   * @param {Array} arr Array
   * @param {Number} columnIndex Column index
   */
  sortTableByColumn: function (arr, columnIndex) {

    if (!arr) {
      throw "Array is empty";
    }

    columnIndex = columnIndex || 0;

    arr.sort(function (a, b) {
      if (a[columnIndex] === b[columnIndex]) {
        return 0;
      } else {
        return (a[columnIndex] < b[columnIndex]) ? -1 : 1;
      }
    });

    return arr;
  },

  /**
   * Converts a JavaScript array to a Java array
   * @param {Array} jsArray JavaScript array
   * @param {Object} params Parameters
   * @param {String} [params.javaType=java.lang.String] Java type
   * @return {java.lang.Array} Java array
   */
  toJavaArray: function (jsArray, params) {
    var javaArray, clazz, i, elem;

    jsArray = jsArray || [];

    params = params || {};
    params.javaType = params.javaType || "java.lang.String";
    clazz = java.lang.Class.forName(params.javaType);

    javaArray = java.lang.reflect.Array.newInstance(clazz, jsArray.length);
    for (i = 0; i < jsArray.length; i++) {
      elem = jsArray[i];
      if (params.type == "java.lang.String") {
        elem = new java.lang.String(elem);
      }
      javaArray[i] = elem;
    }

    return javaArray;
  },


  /**
   * @param {Array|String} element
   * @param {*} wc
   * @param {*} ignoreCase
   * @returns {RegExp}
   */
  toRegExp: function (element, wc, ignoreCase) {
    return (typeof element === "string"
      ? sol.common.ObjectUtils.stringToRegExp
      : sol.common.ObjectUtils.arrayToRegExp
    )(element, wc, ignoreCase);
  },

  /**
   *
   * @param {*} arr
   * @param {*} wc
   * @returns {RegExp}
   */
  arrayToRegExp: function (arr, wc) {
    var compl, len = arr.length,
        addBitwiseOR = function (query, index, length) {
          return ((index + 1 < length) && (query += "|")), query;
        };

    compl = arr.reduce(function (acc, str, i) {
      if (typeof str !== "string") {
        throw "filter: only string elements are allowed for filter criteria arrays";
      }
      return acc + addBitwiseOR("^" + str + "$", i, len);
    }, "");

    return new RegExp(compl.replace(new RegExp("\\" + wc, "g"), "." + wc));
  },

  /**
   * @param {*} str
   * @param {*} wc
   * @param {*} ignoreCase
   * @returns {RegExp}
   */
  stringToRegExp: function (str, wc, ignoreCase) {
    return new RegExp("^" + str.replace(new RegExp("\\" + wc, "g"), "." + wc), (ignoreCase ? "i" : ""));
  },

  /**
   * Traverses all nodes of an object tree
   * @param {Object} obj Object
   * @param {Function} func Function
   */
  traverse: function (obj, func) {
    var me = this,
        key;

    for (key in obj) {
      if (obj[key] != null) {
        func.apply(this, [key, obj[key]]);
        if (typeof (obj[key]) == "object") {
          me.traverse(obj[key], func);
        }
      }
    }
  }
});

sol.define("sol.common.mixins.ObjectFilter", {
  mixin: true,

  generateFilter: function (filter) {
    if (!Array.isArray(filter)) {
      throw "filter must be an array of objects!";
    }

    function isValidCriterion(criterion) {
      if ((typeof criterion !== "object") || (typeof criterion.prop !== "string" && criterion.prop) || ((typeof criterion.value !== "string") && (!Array.isArray(criterion.value)))) {
        throw "filter criterion is no object, or prop or value not suited for filtering";
      }
      return true;
    }

    return filter
      .filter(isValidCriterion)
      // clone is important because next function mutates criterion value
      .map(sol.common.ObjectUtils.clone)
      .map(function (criterion) {
        criterion.value = sol.common.ObjectUtils.toRegExp(criterion.value, "*");
        return criterion;
      });
  },

  matchObject: function (filter, obj) {
    function testProperty(currentFilter) {
      var propertyValue = sol.common.ObjectUtils.getProp(obj, currentFilter.prop);
      return currentFilter.value.test(propertyValue);
    }

    return (filter || [])
      .reduce(function (matches, currentFilter) {
        return matches && testProperty(currentFilter);
      }, true);
  }
});

//# sourceURL=lib_sol.common.ObjectUtils.js
