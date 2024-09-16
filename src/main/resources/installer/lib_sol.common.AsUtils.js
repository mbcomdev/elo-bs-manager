
//@include lib_Class.js

/**
 * Utilities to interact with the ELO Automation Services
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.03.002
 *
 * @elojc
 * @eloas
 * @eloix
 *
 * @requires sol.common.Config
 * @requires sol.common.Template
 * @requires sol.common.WfUtils
 * @requires sol.common.HttpUtils
 * @requires sol.common.JsonUtils
 * @requires sol.common.ExceptionUtils
 */
sol.define("sol.common.AsUtils", {
  singleton: true,

  /**
   * @private
   */
  logger: sol.create("sol.Logger", { scope: "sol.common.AsUtils" }),

  /**
   * Returns the guessed ELOas base URL
   * @return {String} url. ELOas base URL.
   */
  guessAsBaseUrl: function () {
    var ixBaseUrl, asBaseUrl;

    ixBaseUrl = ixConnect.endpointUrl + "";
    ixBaseUrl = ixBaseUrl.replace(/\/ix$/, "");
    asBaseUrl = ixBaseUrl.replace(/\/ix/, "/as");

    return asBaseUrl;
  },

  /**
   * Tests a given ELOas URL
   * @param {String} url
   *
   *     var testResult = sol.common.AsUtils.testAsBaseUrl('http://elosrv01:8080/as-archive/');
   *     if (testResult.asUrlTestOk) {
   *       // valid url
   *     }
   *
   * @return {Object} response
   */
  testAsBaseUrl: function (url) {
    var httpResponse;

    httpResponse = sol.common.HttpUtils.sendRequest({ url: url, resolve: false, connectTimeout: 3000, readTimeout: 10000 });
    httpResponse.asUrlTestOk = (httpResponse.responseOk && (httpResponse.content.indexOf("ELO Automation Services") > -1));

    return httpResponse;
  },

  /**
   * Converts an ELOas URL to a configuration object.
   *
   *     sol.common.AsUtils.convertAsUrlToConfigObject('http://elosrv01:8080/as-archive');
   *     {
   *       protocol: 'http',
   *       server: 'elosrv01',
   *       port: '8080',
   *       name: 'as-archive'
   *     }
   *
   * @param {String} url ELOas URL
   * @return {Object} ELOas configuration object}
   */
  convertAsUrlToConfigObject: function (url) {
    var urlParts, asConfig;

    if (url.indexOf("de.elo.ix.plugin.proxy") > -1) {
      urlParts = url.match(/^(http|https):\/\/([a-z0-9.\-_]+):?([0-9]+)?\/([a-z0-9.\-_/]+de.elo.ix.plugin.proxy\/[a-z0-9.\-_]+)/i);
    } else {
      urlParts = url.match(/^(http|https):\/\/([a-z0-9.\-_]+):?([0-9]+)?\/([a-z0-9.\-_]+)/i);
    }

    if (!urlParts) {
      throw "Can't parse ELOas URL.";
    }
    asConfig = { protocol: urlParts[1], serverName: urlParts[2], port: urlParts[3], serviceName: urlParts[4] };

    return asConfig;
  },

  /**
   * Calls an ELOas rule
   *
   * @param {Object} config Configuration
   * @param {String} params.protocol Protocol
   * @param {String} params.serverName Server name
   * @param {String} params.port Port
   * @param {String} params.serviceName Service name
   * @param {String} config.ruleName Rule name
   * @param {String} config.ticket (optional) Adds the specified ticket
   * @param {String} [config.cmd=get] `run` for an asynchronous call, `get` for a synchronous call
   * @param {String} [config.solutionNameForAsConfig=common] This will be used to load the ELOas server configuration
   * @param {Boolean} [config.expectJsonResponse=true] Expect JSON response
   * @param {Boolean} [config.addTicket=true] Adds the user ticket
   * @param {Boolean} [config.throwException=true] If `true` then a exception will be thrown if an error occurs.
   * @param {String} params.param1 Parameter 1
   * @param {String} params.param2 Parameter 2
   * @param {Object} params.param2Obj Parameter object 2
   * @param {String} params.param3 Parameter 3
   * @param {Object} params.param3Obj Parameter object 3
   * @return {Object} result
   *
   */
  callAs: function (config) {
    var me = this,
        asUrl, logUrl, result, errorMessage, content;

    if (!config) {
      throw "Configuration is empty";
    }

    config.throwException = (config.throwException == false) ? false : true;
    config.addTicket = (config.addTicket == false) ? false : true;
    config.expectJsonResponse = (config.expectJsonResponse == false) ? false : true;

    if (!config.ruleName) {
      throw "Rule name is empty";
    }

    asUrl = me.buildAsUrl(config);
    me.obfuscateTicket(config);
    logUrl = me.buildAsUrl(config);

    me.logger.debug("Executing ELOas call: ", asUrl);

    result = sol.common.HttpUtils.sendGet(asUrl, {
      connectTimeout: 30000,
      readTimeout: 30000,
      contentType: "application/json;charset=UTF-8"
    });

    if (result.errorMessage) {
      if (result.errorMessage.message) {
        errorMessage = me.formatErrorMessage("HTTP error", [result.errorMessage.message + ": " + result.errorMessage.fileName + "#" + result.errorMessage.lineNumber]);
      } else {
        me.logger.error(["HTTP error: {0}, url={1}", result.errorMessage, logUrl]);
        errorMessage = me.formatErrorMessage("HTTP error", [result.errorMessage]);
      }
    } else if (!result.content) {
      errorMessage = me.formatErrorMessage("ELOas result is empty");
    } else if (result.content.indexOf("<h1>HTTP Status 500") > -1) {
      errorMessage = me.formatErrorMessage("ELOas exception", [result.content]);
    } else if (result.content.indexOf("Error") == 0) {
      errorMessage = me.formatErrorMessage("ELOas error", [result.content]);
    } else if (result.content.indexOf("undefined") == 0) {
      errorMessage = me.formatErrorMessage("ELOas result is 'undefined'");
    } else if (result.content.indexOf("Wait...") == 0) {
      errorMessage = me.formatErrorMessage("ELOas doesn't respond.");
    }

    if (!errorMessage && (config.cmd == "get") && config.expectJsonResponse) {
      try {
        content = JSON.parse(result.content);
        if (content.exception) {
          errorMessage = content.exception;
        }
      } catch (ex) {
        errorMessage = me.formatErrorMessage("Unexcepted response", [result.content]);
      }
    }

    if (errorMessage) {
      result.errorMessage = errorMessage;
      if (config.throwException) {
        throw errorMessage;
      }
    }

    return result || {};
  },

  /**
   * @private
   * Formats the error message
   * @param {String} message Message
   * @param {Array} lines Lines
   * @param {Object} params Parameters
   * @param {String} [params.format=JC] Format
   * @return {String} Error message
   */
  formatErrorMessage: function (message, lines, params) {
    var errorMessage;

    lines = lines || [];

    params = params || {};
    params.format = params.format || "JC";

    if (params.format == "JC") {
      errorMessage = "<h3>" + message + "</h3>";
      if (lines.length > 0) {
        errorMessage += lines.join("<br>") + "<br>";
      }
    } else {
      errorMessage = message;
      if (lines.length > 0) {
        errorMessage += ": " + lines.join("\r\n") + "\r\n";
      }
    }

    return errorMessage;
  },

  /**
   * @deprecated
   * Returns the ELOas URL
   *
   * @param {Object} config Configuration. The configuration will be send to ELOas via HTTP parameter 'param2'
   * @param {String} config.ruleName
   * @param {String} [config.mode="get"] (optional) "run" for an asynchronous call, "get" for a synchronous call
   * @param {String} [config.solutionNameForAsConfig="common"] (optional) This will be used to load the ELOas server configuration
   * @return {String}
   *
   * Example:
   *
   */
  getAsUrl: function (config) {
    var solutionName, mode, ruleName, asCfg, asUrlTpl, asUrl, objId,
        asUrlTplStringHead = "{{asCfg.protocol}}://{{asCfg.serverName}}:{{asCfg.port}}/{{asCfg.serviceName}}/as?cmd={{asCall.mode}}&name={{asCall.ruleName}}",
        asUrlTplStringTail = "&param2={{asCall.config}}&ticket={{ticket}}",
        asUrlTplString = asUrlTplStringHead + asUrlTplStringTail;

    if (!config) {
      throw "Configuration is empty";
    }

    if (!config.ruleName) {
      throw "Rule name is empty";
    }

    if (config.objId) {
      objId = config.objId;
      delete config.objId;
      asUrlTplString = asUrlTplStringHead + "&param1={{asCall.objId}}" + asUrlTplStringTail;
    }

    solutionName = config.solutionNameForAsConfig || "common";
    delete config.solutionNameForAsConfig;

    mode = config.mode || "get";
    delete config.mode;

    ruleName = config.ruleName;
    delete config.ruleName;

    asCfg = sol.create("sol.common.Config").loadEloAsConfig(solutionName);

    asUrlTpl = sol.create("sol.common.Template", { source: asUrlTplString });
    asUrl = asUrlTpl.apply({
      ticket: ixConnect.loginResult.clientInfo.ticket,
      asCfg: asCfg,
      asCall: {
        mode: mode,
        ruleName: encodeURIComponent(ruleName),
        objId: objId,
        config: encodeURIComponent(sol.common.JsonUtils.stringifyAll(config))
      }
    });
    return asUrl;
  },

  /**
   * Builds an ELOas URL
   * @param {Object} params Parameters
   * @param {String} params.solutionNameForAsConfig Solution name for AS config
   * @param {String} params.protocol Protocol
   * @param {String} params.serverName Server name
   * @param {String} params.port Port
   * @param {String} params.serviceName Service name
   * @param {String} [params.cmd=get] Command, e.g. ´run´ or ´get´
   * @param {String} params.ruleName Rule name
   * @param {String} params.param1 Parameter 1
   * @param {String} params.param2 Parameter 2
   * @param {Object} params.param2Obj Parameter object 2
   * @param {String} params.param3 Parameter 3
   * @param {Object} params.param3Obj Parameter object 3
   * @param {String} params.ticket (optional) Specific ticket
   * @param {Boolean} addTicket If true the session ticket will be added
   * @return {String} URL
   */
  buildAsUrl: function (params) {
    var me = this,
        urlParams = [],
        url, additionalParams;

    me.prepareParameter(params);
    me.checkParams(params);

    urlParams.push("cmd=" + params.cmd);
    urlParams.push("name=" + encodeURIComponent(params.ruleName));

    if (params.param1) {
      urlParams.push("param1=" + params.param1);
    } else if (params.objId) {
      urlParams.push("param1=" + params.objId);
    }

    additionalParams = me.prepareUrlParams(params);

    if (additionalParams.length > 0) {
      urlParams = urlParams.concat(additionalParams);
    } else {
      urlParams.push("param2=" + encodeURIComponent(me.prepareParam2(params)));
    }

    if (!params.ticket && params.addTicket) {
      params.params3 = params.params3 || {};
      params.params3.language = (params.params3.language || ixConnect.loginResult.clientInfo.language) + "";
      params.params3.timeZone = (params.params3.timeZone || ixConnect.loginResult.clientInfo.timeZone) + "";

      params.ticket = ixConnect.loginResult.clientInfo.ticket + "";
    }

    if (params.params3) {
      urlParams.push("param3=" + encodeURIComponent(JSON.stringify(params.params3)));
    }

    if (params.ticket) {
      urlParams.push("ticket=" + params.ticket);
    }

    url = params.protocol + "://" + params.serverName + ":" + params.port + "/" + params.serviceName + "/as?" + urlParams.join("&");

    return url;
  },

  /**
   * Obfuscate ticket
   * @param {Object} config Configuration
   */
  obfuscateTicket: function (config) {
    config = config || {};
    config.ticket += "";
    if (config.ticket && config.ticket.length > 11) {
      config.ticket = config.ticket.substr(0, 10) + "...";
    }
  },

  /**
   * @private
   * Applies the default values and the ELOas configuration. Used by {@link #buildAsUrl}.
   * @param {Object} params
   */
  prepareParameter: function (params) {
    var solutionNameForAsConfig, asCfg;

    if (!params.serverName) {
      if (params.param2Obj && params.param2Obj.solutionNameForAsConfig) {
        solutionNameForAsConfig = params.param2Obj.solutionNameForAsConfig;
        delete params.param2Obj.solutionNameForAsConfig;
      } else {
        solutionNameForAsConfig = params.solutionNameForAsConfig;
      }
      asCfg = sol.create("sol.common.Config").loadEloAsConfig(solutionNameForAsConfig);
      params.protocol = asCfg.protocol;
      params.serverName = asCfg.serverName;
      params.port = asCfg.port;
      params.serviceName = asCfg.serviceName;
    }

    params.protocol = params.protocol || "http";

    if (!params.port && params.protocol) {
      if (params.protocol == "http") {
        params.port = 80;
      }
      if (params.protocol == "https") {
        params.port = 443;
      }
    }

    params.cmd = params.cmd || params.mode || "get";
  },

  /**
   * @private
   * Checks, if all mandatory parameters are set. Used by {@link #buildAsUrl}.
   * @param {Object} params
   */
  checkParams: function (params) {
    if (!params.serverName) {
      throw "Property 'params.serverName' is empty";
    }

    if (!params.port) {
      throw "Property 'params.port' is empty";
    }

    if (!params.serviceName) {
      throw "Property 'params.serverName' is empty";
    }

    if (!params.ruleName) {
      throw "Property 'params.port' is empty";
    }
  },

  /**
   * @private
   * Prepares the additional parameters (param2 - param10). Used by {@link #buildAsUrl}.
   * @param {Object} params
   * @return {String[]}
   */
  prepareUrlParams: function (params) {
    var additionalParams = [],
        paramName, paramValue, i;

    for (i = 2; i <= 10; i++) {
      paramName = "param" + i;
      paramValue = params[paramName];
      if (paramValue) {
        additionalParams.push(paramName + "=" + encodeURIComponent(paramValue));
        continue;
      }

      paramValue = params["param" + i + "Obj"];
      if (paramValue) {
        paramValue = sol.common.JsonUtils.stringifyAll(paramValue);
        additionalParams.push(paramName + "=" + encodeURIComponent(paramValue));
      }
    }

    return additionalParams;
  },

  /**
   * @private
   * Prepares param2 with all properties from params (cleaned). Used by {@link #buildAsUrl}.
   * @param {Object} params
   * @return {String}
   */
  prepareParam2: function (params) {
    var param2 = {},
        ignoreProps, propertyName;

    ignoreProps = [
      "param1",
      "solutionNameForAsConfig",
      "protocol",
      "serverName",
      "port",
      "serviceName",
      "cmd",
      "ruleName"
    ];

    for (propertyName in params) {
      if (params.hasOwnProperty(propertyName) && (ignoreProps.indexOf(propertyName) < 0)) {
        param2[propertyName] = params[propertyName];
      }
    }

    return JSON.stringify(param2);
  }

});

