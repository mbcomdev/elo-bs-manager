// only call in java scripting environment
typeof importPackage === "function" && (importPackage(Packages.de.elo.ix.client))

//@include lib_Class.js

/**
 * @class sol.common.IxUtils
 * @extends sol.Base
 * @singleton
 *
 * This class provides basic functionality for ix operations.
 *
 * @author NM, ELO Digital Office GmbH
 * @version 1.03.006
 *
 * @eloall
 */
sol.define("sol.common.IxUtils", {
  singleton: true,

  CONST: {
    EVENT_TYPES: {
      ACTION: "ACTION",
      REFRESH: "REFRESH",
      GOTO: "GOTO",
      SELECT: "SELECT",
      VIEW: "VIEW",
      DIALOG: "DIALOG",
      ERROR: "ERROR",
      FEEDBACK: "FEEDBACK"
    },
    COMPONENTS: {
      IX: "IX",
      AS: "AS"
    }
  },

  /**
   * Executes an ix registered function thanks to its name.
   * Handles the transformation of ix Any-Objects.
   *
   * Please note that executing Index Server calls in Web Applications must be done asynchronously doe to performance
   * reasons.
   *
   * Example for Rhino engine scripts (sync) (IX, AS, Java Client)
   *
   *     var result = sol.common.IxUtils.execute('RF_FunctionName', {
   *       objId: '1'
   *     });
   *
   * Example for ELO Web Client & ELO Apps (async)
   *
   *     var result = sol.common.IxUtils.execute('RF_FunctionName', {
   *       objId: '1'
   *     }, function (result) {
   *       // success
   *     }, function () {
   *       // error
   *     };
   *
   * # Performance optimizatios in ELO Apps (since ELOwf 10.01.002)
   *
   * ELO Apps allow establishing IX connections without loading the IXClient.js file.
   * This is handled by the module elo.module.session.light` and will lead to a performance
   * boost at startup time. Keep in mind that only Registered Function calls are supported.
   *
   * # Use custom IndexServer connection
   *
   * You can use your own ix connection object
   *
   *    var result = sol.common.IxUtils.execute("RF_FunctionName",
   *        {
   *          objId: 1
   *        },
   *        null,
   *        null,
   *        {
   *          connection: customConnection
   *        }
   *      )
   *
   * Hint: Using custom connection object is only supported in rhino
   *
   * @param {String} funcName
   * @param {Object} paramObj
   * @param {Function} successFct success handler. required if executing scripts in the Web Client
   * @param {Function} failureFct error handler. required if executing scripts in the Web Client
   * @param {Object} proxyCfg proxy configuration
   * @param {Object} proxyCfg.connection Function should be called with these connection instead of default connection.
   *
   *
   * @return {Object} jsonResult only returned if call is sync.
   */
  execute: function (funcName, paramObj, successFct, failureFct, proxyCfg) {
    var proxy, result;

    proxy = sol.create("sol.common.IxUtils.Proxy", {
      fctName: funcName,
      params: paramObj,
      successFct: successFct,
      failureFct: failureFct,
      connection: (proxyCfg || {}).connection
    });
    result = proxy.execute();

    return result;
  },

  /**
   * @protected
   * Wraps ixUtils.execute for optimized execution
   * The RF must implement an optimization mechanism which returns an optimization id if called with `optimize:true`
   * and uses the optimization, also returning the id, if passed said optimization id as `optimize:<optimizationId>`.
   * (Worst case, if the RF does not implement the mechanism the RF is executed as usual)
   * An optimization id can be any number/string, but it should be unique. An example for such an RF is sol.common.service.SordProvider
   * @param {String} rf
   * @param {Object} config params for RF
   * @param {Object} cacheObject should be a persistent javascript object in your calling class. Will hold optimization ids.
   * @param {String} optimization (optional) give an optimization a name. This must be used, if optimizedExecute is called
   * @param {String[]} excludeFromConfig (optional) define multiple config properties which will be set to undefined if optimization is available
   * @param {Object} proxyCfg (optional) proxy configuration (@see sol.common.IxUtils#execute)
   * @return {Object} whatever the RF returns
   */
  optimizedExecute: function (rf, config, cacheObject, optimization, excludeFromConfig, proxyCfg) {
    var result;
    try {
      config = config ? JSON.parse((sol.common.JsonUtils ? sol.common.JsonUtils.stringifyQuick : JSON.stringify)(config)) : {};
    } catch (_e) {
      throw "optimizedExecute of `" + rf + "`: config is not valid JSON. (Hint: Make sure the config-object does contain any java-strings.)";
    }
    try { // get optimization from cache
      (config.optimize = cacheObject[optimization || (optimization = "_")])
        && excludeFromConfig.forEach(function (excl) { // exclude unnecessary properties from config
          config[excl] = undefined;
        });
    } catch (_e) {}
    config.optimize || (config.optimize = true); // add optimize === true if optimization run for first time
    return (cacheObject[optimization] = (result = sol.common.IxUtils.execute(rf, config, null, null, proxyCfg)).optimization), result; // store optimization ID in cache
  },

  /**
   * @private
   * @since 1.04.000
   * @param {String} currentVersionString
   * @param {String} requiredVersionString
   * @return {Boolean}
   */
  checkVersion: function (currentVersionString, requiredVersionString) {
    var result = true,
        currentRegex, requiredRegex, currentVersionMatch, requiredVersionMatch, currentPart, requiredPart;

    currentRegex = /([0-9]+(\\.[0-9]+)*)/g;
    requiredRegex = /([0-9]+(\\.[0-9]+)*)/g;
    currentVersionMatch = currentRegex.exec(currentVersionString);
    requiredVersionMatch = requiredRegex.exec(requiredVersionString);

    while (requiredVersionMatch !== null) {
      currentPart = (currentVersionMatch) ? parseInt(currentVersionMatch[0], 10) : 0;
      requiredPart = parseInt(requiredVersionMatch[0], 10);
      if (requiredPart > currentPart) {
        result = false;
        break;
      } else if (requiredPart < currentPart) {
        result = true;
        break;
      }
      currentVersionMatch = currentRegex.exec(currentVersionString);
      requiredVersionMatch = requiredRegex.exec(requiredVersionString);
    }

    return result;
  }

});

/**
 * @private
 * @since 1.04.000
 */
sol.define("sol.common.IxUtils.Proxy", {

  MIN_VERSION_WF_SESSION_LIGHT: "10.02.000",

  initialize: function (config) {
    var me = this;

    me.fctName = config.fctName;

    me.connection = config.connection;


    me.successFct = config.successFct;
    me.failureFct = config.failureFct;

    me.params = config.params || {};
    if ((typeof ixConnectAdmin != "undefined") && ixConnectAdmin.loginResult && ixConnectAdmin.loginResult.clientInfo) {
      // pass admin ticket if called in rhino environments that have administration privileges.
      me.params.adminTicket = String(ixConnectAdmin.loginResult.clientInfo.ticket);
    }

    me.isWebClient = me.isWebClient();
    me.isEloApp = me.isEloApp();
    me.isEloWf = me.isEloWf();
    me.isWebApp = (me.isWebClient || me.isEloApp || me.isEloWf);
    me.isRhino = me.isRhino();

    if (!me.isRhino && me.connection) {
      throw Error("Custom connection is supported only in rhino engine");
    }

    if (me.isEloApp) {
      me.isSessionLight = !api.IX;
    } else if (me.isEloWf) {
      // only use session light in forms if called asynchronous to ensure backwards compatibiliy
      me.isSessionLight = me.successFct && me.wfSupportsSessionLight();
    }
  },

  isWebClient: function () {
    return (typeof api !== "undefined") && api.Webclient && api.Webclient.getIXConnection;
  },

  isEloApp: function () {
    return (typeof api !== "undefined") && api.webapps && api.webapps.WebApp;
  },

  isEloWf: function () {
    return (typeof elo !== "undefined") && elo.appInfo && elo.appInfo.application && elo.appInfo.application.name === "ELOwf";
  },

  isRhino: function () {
    var me = this;
    return (typeof ixConnect !== "undefined") && !(me.isWebClient || me.isEloApp || me.isEloWf);
  },

  wfSupportsSessionLight: function () {
    var me = this;
    return (typeof ELOWF_VERSION !== "undefined") ? sol.common.IxUtils.checkVersion(ELOWF_VERSION, me.MIN_VERSION_WF_SESSION_LIGHT) : false;
  },

  getIXConnection: function () {
    var me = this;
    if (me.isWebClient) {
      return api.Webclient.getIXConnection();
    }
    if (me.isEloApp) {
      return api.IX;
    }
    if (me.isEloWf) {
      return elo.IX;
    }
    if (me.isRhino) {
      // use passed ix connection instead of default ixConnect object
      return me.connection || ixConnect;
    }
  },

  getAny: function () {
    var me = this,
        any = me.params;
    if (!me.isSessionLight) {
      any = (typeof Any !== "undefined") ? new Any() : new Packages.de.elo.ix.client.Any();

      //TODO correct, as soon as ELOas gets CONST variable
      any.type = (typeof CONST !== "undefined") ? CONST.ANY.TYPE_STRING : ((typeof ixConnect !== "undefined") ? ixConnect.CONST.ANY.TYPE_STRING : elo.CONST.ANY.TYPE_STRING);
      any.stringValue = sol.common.JsonUtils ? sol.common.JsonUtils.stringifyAll(me.params) : JSON.stringify(me.params);
    }
    return any;
  },

  execute: function () {
    var me = this;

    if (!me.fctName) {
      throw "IllegalStateException: no function name set";
    }

    if (!me.params) {
      throw "IllegalStateException: no parameters set";
    }

    if (me.isWebApp && me.isSessionLight) {
      // webapp with session light mode (currently ELOwf and ELOapp)
      if (!me.successFct) {
        throw me.$className + ": synchronous ix functions calls are unsupported of running web apps and forms in session light mode.";
      }
      me.callAsyncSessionLight();
    } else if (me.isWebApp) {
      // webapp without session light mode
      if (!me.successFct) {
        console.warn(me.$className + ": synchronous ix functions calls should be used with care due to performance reasons. It is recommended to use function handlers instead.");
        return me.callSync();
      }
      me.callAsync();
    } else {
      // Rhino
      if (me.successFct) {
        throw "IllegalStateException: " + me.$className + ": async ix functions calls are currently not supported on the Rhino engine.";
      }
      return me.callSync();
    }

  },

  callSync: function () {
    var me = this,
        conn = me.getIXConnection(),
        anyResult, jsonResult;

    if (!conn) {
      if (me.isEloWf) {
        throw "IllegalStateException: " + me.$className + ": IX session not available. Use sol.common.forms.Utils.initializeIxSession.";
      } else {
        throw "IllegalStateException: IX connection not initialized";
      }
    }

    anyResult = conn.ix().executeRegisteredFunction(me.fctName, me.getAny());
    jsonResult = (anyResult && anyResult.stringValue) ? String(anyResult.stringValue) : "{}";

    return JSON.parse(jsonResult);
  },

  callAsync: function () {
    var me = this,
        conn = me.getIXConnection();

    if (!conn) {
      if (me.isEloWf) {
        // check if 'sol.common.forms.Utils' is included and initialize IX connection
        if (sol.common.forms && sol.common.forms.Utils && sol.common.forms.Utils.initializeIxSession) {
          sol.common.forms.Utils.initializeIxSession(function () {
            me.callAsync();
          });
          return;
        } else {
          throw "IllegalStateException: " + me.$className + ": can not initialize IX session. Include sol.common.forms.Utils.initializeIxSession.";
        }
      } else {
        throw "IllegalStateException: IX connection not initialized";
      }
    }

    conn.ix().executeRegisteredFunction(me.fctName, me.getAny(), new de.elo.ix.client.AsyncCallback(function (successAnyResult) {
      // sucess
      var successJsonResult = (successAnyResult && successAnyResult.stringValue) ? String(successAnyResult.stringValue) : "{}";
      me.successFct.call(me, JSON.parse(successJsonResult));
    }, function (ex) {
      // failure
      if (me.failureFct) {
        me.failureFct.call(me, ex);
      }
    }));
  },

  callAsyncSessionLight: function () {
    var me = this;

    if (me.isEloWf) {
      if (sol.common.forms && sol.common.forms.Utils && sol.common.forms.Utils.callRegisteredFunction) {
        sol.common.forms.Utils.callRegisteredFunction(me.fctName, me.params, me.successFct, function (errorObj) {
          // failure
          var ex = {},
              error;
          if (!!errorObj) {
            if (errorObj.constructor === String) {
              try {
                error = JSON.parse(errorObj);
                ex.msg = error.error.message;
                ex.code = error.error.code;
              } catch (e) {
                ex.msg = errorObj;
              }
            } else {
              ex.msg = errorObj.error.message;
              ex.code = errorObj.error.code;
            }
          }
          if (me.failureFct) {
            me.failureFct.call(me, ex);
          }
        });
      } else {
        throw "'sol.common.forms.Utils' not included or do not support session light for ELOwf";
      }
    } else if (me.isEloApp) {
      api.rest.RestUtils.callRegisteredFunction(me.fctName, me.params, me.successFct, function (errorObj) {
        // failure
        var ex = {},
            error;
        if (!!errorObj) {
          if (errorObj.constructor === String) {
            try {
              error = JSON.parse(errorObj);
              ex.msg = error.error.message;
              ex.code = error.error.code;
            } catch (e) {
              ex.msg = errorObj;
            }
          } else {
            ex.msg = errorObj.error.message;
            ex.code = errorObj.error.code;
          }
        }
        if (me.failureFct) {
          me.failureFct.call(me, ex);
        }
      });
    } else {
      throw "Session light only supported in ELOwf and ELOapps";
    }
  }

});


//# sourceURL=lib_sol.common.IxUtils.js
