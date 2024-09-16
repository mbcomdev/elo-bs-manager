//@include lib_sol.common.Instance.js

/**
 * @class sol.common.instance.utils.Ix
 * @extends sol.common.instance.base
 * @eloall
 * @experimental
 * This is an experimental new functionality, which may be removed in future versions.
 *
 * Please be aware that this class does not use sol.define  but sol.common.instance.define
 * and may be working slightly different.
 *
 * This instanceDefinition provides basic functionality to use ixConnect
 *
 * @requires sol.common.instance
 */
sol.common.instance.define("sol.common.instance.utils.Ix", {
  $create: [
    { key: "ExecutionFactory", name: "sol.common.instance.utils.Ix.ExecutionFactory" },
    { key: "logger", name: "sol.common.instance.logger", config: { scope: "{{instance.$name}}" } }
  ],
  mixins: [
    "sol.common.instance.mixins.create"
  ],
  execute: function (functionName, params, successFunction, failureFunction) {
    var me = this;

    return me.executeRegisteredFunction(functionName, params, successFunction, failureFunction);
  },
  executeRegisteredFunction: function (functionName, params, successFunction, failureFunction) {
    var me = this;

    return me.demandExecuterFunction("executeRegisteredFunction")(functionName, params, successFunction, failureFunction);
  },
  createSord: function (params) {
    var me = this;

    return me.demandExecuterFunction("createSord")(params);
  },
  checkoutSord: function (objId, params) {
    var me = this;

    return me.demandExecuterFunction("checkoutSord")(objId, params);
  },
  checkinSord: function (sord, params) {
    var me = this;

    return me.demandExecuterFunction("checkinSord")(sord, params);
  },
  deleteSord: function (objId, params) {
    var me = this;

    return me.demandExecuterFunction("deleteSord")(objId, params);
  },
  checkoutMap: function (objId, params) {
    var me = this;

    return me.demandExecuterFunction("checkoutMap")(objId, params);
  },
  demandExecuterFunction: function (functionName) {
    var me = this,
        executer = me.ExecutionFactory.get();

    if (executer && typeof executer[functionName] == "function") {
      return executer[functionName].bind(executer);
    } else {
      me.logger.warn("Executer could not provide executer function '" + functionName + "'.");
      return function () {
        return null;
      };
    }
  }
});

sol.common.instance.define("sol.common.instance.utils.Ix.ExecutionFactory", {
  initialize: function () { },
  get: function () {
    var me = this;

    if (!me.executer) {
      me.initializeExecuter();
    }
    return me.executer;
  },
  initializeExecuter: function () {
    var me = this,
        contextName = me.getContextName();

    me.executer = sol.common.instance.create(me.determineExecuter(contextName));
  },
  determineExecuter: function (context) {
    var clientExecuters = {
      webclient: "sol.common.instance.utils.Ix.WebClientExecuter",
      eloapp: "sol.common.instance.utils.Ix.EloAppExecuter",
      elowf: "sol.common.instance.utils.Ix.EloWfExecuter",
      rhino: "sol.common.instance.utils.Ix.RhinoExecuter"
    };

    return clientExecuters[context];
  },
  getContextName: function () {
    var me = this;
    if (me.isWebClient()) {
      return "webclient";
    } else if (me.isEloApp()) {
      return "eloapp";
    } else if (me.isEloWf()) {
      return "elowf";
    } else if (me.isRhino()) {
      return "rhino";
    }
    throw "Could not determine execution context";
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
    return (typeof ixConnect !== "undefined") && !(me.isWebClient() || me.isEloApp() || me.isEloWf());
  }
});

sol.common.instance.define("sol.common.instance.utils.Ix.BaseExecuter", {
  $create: [
    { key: "logger", name: "sol.common.instance.logger", config: { scope: "{{instance.$name}}" } }
  ],
  mixins: [
    "sol.common.instance.mixins.create"
  ],
  initialize: function () {

  },
  getConnection: function () {
    var me = this;
    throw me.$name + " should implement function 'getConnection";
  },
  executeRegisteredFunction: function (functionName, params, successFct, failureFct) {
    var me = this;
    throw me.$name + " should implement function 'executeRegisteredFunction";
  },
  checkoutSord: function () {
    var me = this;
    throw me.$name + " should implement function 'checkoutSord";
  },
  checkinSord: function () {
    var me = this;
    throw me.$name + " should implement function 'checkinSord";
  },
  checkoutMap: function () {
    var me = this;
    throw me.$name + " should implement function 'checkoutMap";
  },
  checkinMap: function () {
    var me = this;
    throw me.$name + " should implement function 'checkoutMap";
  }
});
sol.common.instance.define("sol.common.instance.utils.Ix.WebClientExecuter", {
});
sol.common.instance.define("sol.common.instance.utils.Ix.EloAppExecuter", {
});
sol.common.instance.define("sol.common.instance.utils.Ix.EloWfExecuter", {
});
sol.common.instance.define("sol.common.instance.utils.Ix.RhinoExecuter", {
  extend: "sol.common.instance.utils.Ix.BaseExecuter",
  initialize: function (config) {
    var me = this;

    me.connection = ixConnect;
    me.adminConnection = ixConnectAdmin;
    me.anyType = me.determineAnyType();
  },
  determineAnyType: function () {
    return typeof CONST !== "undefined"
      ? CONST.ANY.TYPE_STRING
      : typeof ixConnect !== "undefined"
        ? ixConnect.CONST.ANY.TYPE_STRING
        : elo.CONST.ANY.TYPE_STRING;
  },
  getConnection: function (params) {
    var me = this;

    params = params || {};
    if (params.connection) {
      return params.connection;
    } else if (params.asAdmin) {
      return me.adminConnection;
    } else {
      return me.connection;
    }
  },
  executeRegisteredFunction: function (functionName, params, successFunction, failureFunction) {
    var me = this,
        connection = me.getConnection(params),
        extractResult = function (aResult) {
          return (aResult || {}).stringValue
            ? JSON.parse(String(aResult.stringValue))
            : {};
        },
        rfResult,
        messages = [];

    if (!functionName) {
      messages.push("No function name set.");
    }
    if (!params) {
      messages.push("No parameters set.");
    }
    if (!connection) {
      messages.push("IX connection not initialized.");
    }
    if (messages.length > 0) {
      throw "IllegalStateException: " + messages.join(" ");
    }

    try {
      me.logger.enter("executeRegisteredFunction: " + functionName);
      rfResult = connection.ix().executeRegisteredFunction(functionName, me.prepareParameters(params));
      me.logger.exit("executed RegisteredFunction");
    } catch (error) {
      me.logger.error(error);
      me.logger.exit("executed RegisteredFunction");
      if (failureFunction) {
        failureFunction(error);
      }
      return {};
    }
    if (successFunction) {
      successFunction(extractResult(rfResult));
      return;
    }
    return extractResult(rfResult);

  },
  prepareParameters: function (params) {
    var me = this,
        any = (typeof Any !== "undefined") ? new Any() : new de.elo.ix.client.Any(),
        stringify = sol.common.JsonUtils ? sol.common.JsonUtils.stringifyAll : JSON.stringify;

    any.type = me.anyType;
    any.stringValue = stringify(params);

    return any;
  },
  createSord: function (params) {
    var me = this,
        sord;

    params = params || {};

    if (!params.mask) {
      throw "Mask ID is empty";
    }

    params.parentId = params.parentId || "1";

    sord = me.getConnection().ix().createSord(params.parentId, params.mask, EditInfoC.mbSord).sord;

    if (typeof params.name != "undefined") {
      sord.name = params.name;
    }

    if (typeof params.sortOrder != "undefined") {
      sord.details.sortOrder = params.sortOrder;
    }

    if (typeof params.documentContainer != "undefined") {
      sord.details.documentContainer = params.documentContainer;
    }

    return sord;
  },
  checkoutSord: function (objId, params) {
    var me = this,
        sordZ, lockZ, conn, sord;

    params = params || {};

    sordZ = (params && params.sordZ) ? params.sordZ : SordC.mbAllIndex;
    lockZ = (params && params.lockZ) ? params.lockZ : LockC.NO;
    conn = me.getConnection(params);

    sord = conn.ix().checkoutSord(objId + "", sordZ, lockZ);

    me.logger.debug("getSord: sord.id=" + sord.id + ", sord.name=" + sord.name + ", conn.user.id=" + conn.loginResult.user.id +
      ", conn.user.name=" + conn.loginResult.user.name + ", conn.timeZone=" + conn.loginResult.clientInfo.timeZone);

    return sord;
  },
  checkinSord: function (sord, params) {
    var me = this, sordZ, lockZ;

    params = params || {};
    sordZ = params.sordZ || SordC.mbAllIndex;
    lockZ = params.lockZ || LockC.NO;

    return me.getConnection().ix().checkinSord(sord, sordZ, lockZ);
  },
  deleteSord: function (objId, params) {
    var me = this,
        sord,
        deleteOptions = null;

    me.logger.enter("deleteSord", arguments);
    params = params || {};
    params.parentId = params.parentId || "";
    sord = me.checkoutSord(objId, { sordZ: SordC.mbOnlyId, lockZ: LockC.NO });

    if (!sord) {
      if (!params.silent) {
        throw "Object not found: " + objId;
      }
      me.logger.exit("deleteSord");
      return;
    }
    if (params.deleteFinally) {
      deleteOptions = new DeleteOptions();
      deleteOptions.deleteFinally = true;
    }

    me.getConnection().ix().deleteSord(String(params.parentId), String(sord.id), LockC.NO, null);

    me.logger.exit("deleteSord");
    return "-1";
  },
  checkoutMap: function (objId, params) {
    var me = this,
        sordZ,
        lockZ,
        keys,
        conn;
    params = params || {};
    sordZ = params.sordZ || MapDomainC.DOMAIN_SORD;
    lockZ = params.sordZ || LockC.NO;
    keys = params.keys || null;

    conn = me.getConnection(params);

    return conn.ix().checkoutMap(sordZ, objId + "", keys, lockZ).items;
  },
  checkinMap: function (objId, params) {
    var me = this;

    return me.$super(null, "checkinMap", [objId, params]);
  }
});