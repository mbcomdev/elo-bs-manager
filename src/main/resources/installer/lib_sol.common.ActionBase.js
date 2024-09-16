
//@include lib_Class.js
//@include lib_sol.common.StringUtils.js
//@include lib_sol.common.ObjectUtils.js
//@include lib_sol.common.JsonUtils.js
//@include lib_sol.common.SordUtils.js
//@include lib_sol.common.IxUtils.js
//@include lib_sol.common.CounterUtils.js
//@include lib_sol.common.AclUtils.js
//@include lib_sol.common.TranslateTerms.js
//@include lib_sol.common.Template.js
//@include lib_sol.common.WfUtils.js
//@include lib_sol.common.Map.js
//@include lib_sol.common.ix.RfUtils.js

/**
 * @abstract
 *
 * Base class for actions.
 *
 * Actions allow providing the same functionality in several clients. The primary goal is to handle core operations
 * (creating a folder and starting a workflow) in the process function of an action. Further logic should be implemented
 * by workflow function modules.
 *
 * Subclasses have to implement the two abstract methods 'getName' and 'process'. These are used by the 'execute' function.
 *
 * # Response
 *
 * Actions can return various types in form of a JSON String. The response is a standardized format and handled by this class.
 * There are three return types:
 *
 * - events
 * - messages (deprecated, because not used in standard action handling)
 * - arbitrary data (deprecated, because not used in standard action handling)
 *
 * ## Add event functions
 *
 * Events are used in order to define a postprocessing in the clients. This allows to trigger a goto to the created element in elo or display a dialog that contains a workflow form.
 *
 * Following example shows how to display a dialog by a given flow id.
 *
 *     me.addWfDialogEvent(flowId, { objId: objId });
 *
 * Currently following events are supported:
 *
 * - addWfDialogEvent
 * - addUrlDialogEvent
 * - addAppDialogEvent (utilizes url event)
 * - addActionEvent
 * - addRefreshEvent
 * - addGotoIdEvent
 * - addGotoWfTaskEvent
 * - addErrorEvent
 * - addInfoEvent
 * - addFeedbackEvent
 *
 * Please note that events are handled synchronously. If addWfDialogEvent and addRefreshEvent is called. The client will refresh the element after the users closes the dialog.
 *
 * # onSuccess and onFailure
 * These functions can be implemented by the subclass. They will be called either if the action was processed successfully or if there occured an error.
 *
 * # Conditional events
 *
 * It is possible to declare events as conditional. The client handler will evaluate if the event should be executed.
 * This is required since workflow processing can be influenced by the user. As an example: A WF-Form is displayed in a dialog. If the user clicks cancel refresh and goto events should'nt be excecuted.
 *
 * The events has to declare an `ON` property, which has to define the following properties.
 *
 * - type {String}: "WF_STATUS"|"SORD"|"GRP"|"MAP"
 * - key {String}: only for type="SORD"|"GRP"|"MAP", contains the sord property, the group key or map key
 * - objId {String}: only for type="SORD"|"GRP"|"MAP", the objId of the sord which should be checked
 * - flowId {String}: only for type="WF_STATUS", the workflow id to get the status from
 * - value {String}: the value which has to be fulfilled
 *
 * Following example shows a condition used by the refresh event.
 *
 *     me.addRefreshEvent(objId, {
 *       type: "WF_STATUS",
 *       value: "APPROVE",
 *       flowId: flowId
 *     });
 *
 * @author ELO Digital Office GmbH
 *
 * @eloix
 * @eloas
 * @requires sol.common.StringUtils
 * @requires sol.common.ObjectUtils
 * @requires sol.common.JsonUtils
 * @requires sol.common.SordUtils
 * @requires sol.common.IxUtils
 * @requires sol.common.CounterUtils
 * @requires sol.common.AclUtils
 * @requires sol.common.TranslateTerms
 * @requires sol.common.WfUtils
 * @requires sol.common.WfMap
 */
sol.define("sol.common.ActionBase", {

  _registeredEvents: undefined,

  _messages: undefined,

  _data: undefined,

  /**
   * @private
   * @property {String} _APP_URL_TEMPLATE Template for the app event
   */
  _APP_URL_TEMPLATE: "{{eloWfBaseUrl}}/apps/app/{{appName}}/?lang={{language}}&ticket={{ticket}}",

  /**
   * @private
   * @property {String} _APP_URL_TEMPLATE_12 Template for the app event since ELO12
   */
  _APP_URL_TEMPLATE_12: "{{eloWfBaseUrl}}/apps/app/{{appName}}/?lang={{language}}",

  actionId: undefined,

  initialize: function (config) {
    var me = this;

    if (me.$className === "sol.common.ActionBase") {
      throw "can not create instance of abstract class 'sol.common.ActionBase'";
    }
    RhinoManager.registerClass(me.$className);
    me.$super("sol.Base", "initialize", [config]);
    me._registeredEvents = [];
    me._messages = [];
    me._data = {};
    me.actionId = sol.common.CounterUtils.incCounter("SOL_ACTION_ID");
  },

  /**
   * @abstract
   * Name of the action. Has to be implemented by subclass.
   */
  getName: function () {
    throw "cannot call 'name' of abstract class 'sol.common.ActionBase'";
  },

  /**
   * @abstract
   * Implementation of the action. Has to be implemented by subclass.
   */
  process: function () {
    throw "cannot call 'process' of abstract class 'sol.common.ActionBase'";
  },

  /**
   * Will be called in case of a successfull action execution. The implementation in the subclass is optional.
   */
  onSuccess: function () { },

  /**
   * Will be called in case of an action failure. The implementation in the subclass is optional.
   * The default implementation will write an ERROR log entry and call {@link #addErrorEvent}.
   * @param {Exception} exception
   */
  onFailure: function (exception) {
    var me = this;
    me.logger.error(["Error processing '{0}'", me.$className], exception);
    me.addErrorEvent(exception.message || exception);
  },

  /**
   * @private
   * Marks an action (aka the workflow) as creation, or not.
   *
   * An action workflow will be marked as creation if there is a registered event with a `flowId` and either:
   *
   *  - the action defines a `$new: true` property
   *  - or it is a `StandardAction` with a `$new` parameter.
   *  - or the action name of the action start with 'create' (and `$new` is not set to `false` explicitly)
   *
   */
  markCreationAction: function () {
    var me = this,
        isNew, flowId, objId, wfmap;

    isNew = function () {
      var reason;
      if (me.$new === true) {
        reason = "Action defines '$new=true'";
      } else if (me.$className === "sol.common.ix.actions.Standard" && me.$new) {
        reason = "StandardAction with '$new' property";
      } else if ((me.getName().indexOf("Create") === 0) && (me.$new !== false)) {
        reason = "Action name starts with 'Create' and '$new=" + me.$new + "'";
      }
      if (reason) {
        me.logger.info("Mark as 'created' to suppress update registration in form. Reason: " + reason);
      }
      return !!reason;
    };

    me._registeredEvents.some(function (event) {
      if (event.obj && event.obj.flowId) {
        flowId = event.obj.flowId;
        return flowId;
      }
    });

    if (flowId && isNew()) {
      objId = sol.common.WfUtils.getWorkflow(flowId).objId;
      wfmap = sol.create("sol.common.WfMap", {
        flowId: flowId,
        objId: objId
      });
      wfmap.setValue("COMMON_SKIP_UPDATE_REGISTRATION", "true");
      wfmap.write();
    }
  },

  /**
   * Handles the execution of Actions and internally calls sol.common.ix.ActionHandler#process.
   * This function is called by sol.common.jc.ActionHandler.execute
   * @return {Object}
   */
  execute: function () {
    var me = this;

    me.logger.enter("execute_" + me.$className);
    me.logger.info(["executing action '{0}' => actionId={1}", me.getName(), me.actionId]);

    try {
      me.process();
      me.markCreationAction();
      me.onSuccess();
    } catch (ex) {
      me.onFailure(ex);
    }

    me.logger.exit("execute_" + me.$className);

    return me.buildResponse();
  },

  stringifyAll: function (obj) {
    return JSON.stringify(obj, function (key, value) {
      if (value instanceof java.lang.String) {
        value = String(value);
      }
      if (value && value.getClass) {
        value = String(value.toString());
      }
      return value;
    });
  },

  renderConfig: function (config) {
    var me = this, str;
    str = Handlebars.compile(me.stringifyAll(config))({
      objId: config.objId,
      type: (config.$templating ? config.$templating.$type : config.type),
      tree: (config.$templating ? config.$templating.$tree : config.tree),
      preconditions: (config.$templating ? config.$templating.$preconditions : config.preconditions)
    });
    str = str.replace(/&quot;/g, "\\&quot;");
    return JSON.parse(org.apache.commons.lang.StringEscapeUtils.unescapeHtml(str));
  },

  /**
   * Checks if a user has the required rights on an object.
   *
   * If some rights are missing this will throw an exception.
   *
   * @param {String|de.elo.ix.client.Sord} sord ObjId or sord to check the access rights on
   * @param {Object} params
   * @param {String|Object} params.rights Either a string (in form 'RWDEL' or 'RWDELP' since ELO12) or an object (see {@link sol.common.AclUtils rights}) specifying the rights the user requires
   * @param {String} params.message (optional) This can specify a message to override the default exception text from `sol.common.ix.actions.errorRequiredUserRights`. Has priority over `messageKey`.
   * @param {String} params.messageKey (optional) This can specify a translation key to override the default exception text from `sol.common.ix.actions.errorRequiredUserRights`
   * @param {String|de.elo.ix.client.ClientInfo} params.language (optional)
   * Either an ISO language String, or an de.elo.ix.client.ClientInfo Object. Default will be the ClientInfo from the connection. Not relevant for `message`.
   * @throws Throws an exception if the user has not the specified rights
   */
  requireUserRights: function (sord, params) {
    var me = this,
        hasRights = true,
        cfg, exception;

    if (params && params.rights) {
      cfg = {};
      if (!sol.common.ObjectUtils.isObject(params.rights)) {
        cfg.rights = {};
        if (sol.common.StringUtils.contains(params.rights, "R")) {
          cfg.rights.r = true;
        }
        if (sol.common.StringUtils.contains(params.rights, "W")) {
          cfg.rights.w = true;
        }
        if (sol.common.StringUtils.contains(params.rights, "D")) {
          cfg.rights.d = true;
        }
        if (sol.common.StringUtils.contains(params.rights, "E")) {
          cfg.rights.e = true;
        }
        if (sol.common.StringUtils.contains(params.rights, "L")) {
          cfg.rights.l = true;
        }
        if (sol.common.StringUtils.contains(params.rights, "P")) {
          cfg.rights.p = true;
        }
      } else {
        cfg.rights = params.rights;
      }
      hasRights = sol.common.AclUtils.hasEffectiveRights(sord, cfg);
    }

    if (!hasRights) {
      if (params && params.message) {
        exception = params.message;
      } else {
        exception = me.getLocalizedString(
          (params && params.language) ? params.language : ixConnect.loginResult.clientInfo,
          (params && params.messageKey) ? params.messageKey : "sol.common.ix.actions.errorRequiredUserRights"
        );
      }
      throw exception;
    }
  },

  /**
   * @deprecated 1.03.000 Not used for standard action handling and might be removed in future versions
   * Add a (localized) massage to the response.
   * @param {String|de.elo.ix.client.ClientInfo} language Either an ISO language String, or an de.elo.ix.client.ClientInfo Object
   * @param {String} msg Either a message string or a message key (if language is set)
   */
  addMessage: function (language, msg) {
    var me = this;

    if (language) {
      msg = this.getLocalizedString(language, msg);
    }

    me._messages.push(msg);
  },

  /**
   * @deprecated 1.03.000 Not used for standard action handling and might be removed in future versions
   * Add some payload data to the response
   * @param {String} key
   * @param {String} value
   */
  addPayload: function (key, value) {
    var me = this;
    me._data[key] = value;
  },

  /**
   * Add an event which tells the client to open a workflow form in a dialog.
   *
   * Please not that the flowId must be given in order to identify the current Workflow node for the user.
   *
   *     flowId = me.startWorkflow(contractObjId, contractConfig.workflows.approveContract.workflowTemplateName, wfName);
   *     me.addWfDialogEvent(flowId, { objId: objId });
   *
   * @param {Number} flowId (required)
   * @param {Object} params
   * @param {String} params.objId Either `nodeId` or `objId` is required
   * @param {Number} params.nodeId Either `nodeId` or `objId` is required
   * @param {String} params.title (optional) Dialog title
   * @param {String} params.dialogId (optional) Id so the client can save the size for the dialog
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addWfDialogEvent: function (flowId, params, on) {
    var me = this,
        eventdata = { flowId: flowId },
        wfCollectNode;

    if (params && params.nodeId) {
      eventdata.nodeId = params.nodeId;
    } else if (params && params.objId) {
      wfCollectNode = sol.common.WfUtils.findFirstActiveNode(params.objId, flowId);
      eventdata.flowId = wfCollectNode ? wfCollectNode.flowId : flowId; // could be the subworkflow ID
      eventdata.nodeId = wfCollectNode ? wfCollectNode.nodeId : null;
      eventdata.formSpec = (wfCollectNode && wfCollectNode.formSpec) ? wfCollectNode.formSpec : null;
    }

    if (!eventdata.flowId || !eventdata.nodeId) {
      return;
    }

    me.addDialogEvent(eventdata, params, on);
  },

  /**
   * Add an event which tells the client to open a URL in a dialog.
   *
   *     me.addUrlDialogEvent("http://server/myCustomApp");
   *
   * @param {String} url
   * @param {Object} params (optional)
   * @param {String} params.title (optional) Dialog title
   * @param {String} params.dialogId (optional) Id so the client can save the size for the dialog
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addUrlDialogEvent: function (url, params, on) {
    var me = this,
        eventdata = { url: url };

    me.addDialogEvent(eventdata, params, on);
  },

  /**
   * Add an event which tells the client to open a dialog with an app.
   *
   *     me.addAppDialogEvent();
   *
   * @param {String} appName The name of the app
   * @param {Object} params (optional)
   * @param {String} params.language (optional) Language shurtcut to call the app with. Default will be from IX connection.
   * @param {String} params.title (optional) Dialog title
   * @param {String} params.dialogId (optional) Id so the client can save the size for the dialog
   * @param {String} params.ixUrl (optional) IX URL as a basis for the WF URL
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addAppDialogEvent: function (appName, params, on) {
    var me = this,
        language, eloWfBaseUrl, urlTemplate, url, eventdata;

    params = params || {};
    language = params.language ? params.language : ixConnect.loginResult.clientInfo.language;
    eloWfBaseUrl = sol.common.WfUtils.getWfBaseUrl({ ixUrl: params.ixUrl });

    urlTemplate = (sol.common.IxUtils.checkVersion(ixConnect.implVersion, "12.00.000.000")) ? me._APP_URL_TEMPLATE_12 : me._APP_URL_TEMPLATE;

    url = sol.create("sol.common.Template", { source: urlTemplate }).apply({
      eloWfBaseUrl: eloWfBaseUrl,
      appName: appName,
      language: language,
      ticket: ixConnect.loginResult.clientInfo.ticket
    });

    if (!url) {
      return;
    }

    eventdata = { url: url };

    me.addDialogEvent(eventdata, params, on);
  },

  /**
   * @private
   * Adds a dialog event. Used by {@link #addWfDialogEvent}, {@link #addUrlDialogEvent} and {@link #addAppDialogEvent}
   * @param {Object} eventdata Prefilled data object (e.g. `url` or `flowId` and `nodeId`)
   * @param {Object} params (optional)
   * @param {String} params.title (optional) Dialog title
   * @param {String} params.dialogId (optional) Id so the client can save the size for the dialog
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addDialogEvent: function (eventdata, params, on) {
    var me = this,
        event;

    if (params && params.title) {
      eventdata.title = eventdata.title || params.title;
    }

    if (params && params.dialogId) {
      eventdata.dialogId = eventdata.dialogId || params.dialogId;
    }

    event = me.createEvent(sol.common.IxUtils.CONST.EVENT_TYPES.DIALOG, eventdata, on);

    me._registeredEvents.push(event);
  },

  /**
   * Adds an event which tells the client to start another action.
   *
   * @param {String} registeredFunction RF of the action which should be called next
   * @param {Object} params Params for the RF which should be called next
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addActionEvent: function () {
    throw "cannot call 'addActionEvent' of class 'sol.common.ActionBase', function has to be implemented by subclass";
  },

  /**
   * Adds an event which tells the client to refresh the current view.
   *
   *     me.addRefreshEvent(objId);
   *
   * @param {String} objId
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addRefreshEvent: function (objId, on) {
    var me = this;
    me._registeredEvents.push(me.createEvent(sol.common.IxUtils.CONST.EVENT_TYPES.REFRESH, { objId: objId }, on));
  },

  /**
   * Adds an event which tells the client to navigate to a given Sord id.
   *
   * Goto a new element.
   *
   *     me.addGotoIdEvent(objId);
   *
   * Goto a new element if the workflow status was set to "CREATE".
   *
   *     me.addGotoIdEvent(objId, undefined, {
   *       type: "WF_STATUS",
   *       value: "CREATE",
   *       flowId: flowId
   *     });
   *
   * Goto a new document and open the document for edit. (Checkout)
   *
   *     me.addGotoIdEvent(objId, true, {
   *       type: "WF_STATUS",
   *       value: "CREATE",
   *       flowId: flowId
   *     });
   *
   * @param {String} objId
   * @param {Boolean} checkout
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addGotoIdEvent: function (objId, checkout, on) {
    var me = this,
        eventCfg = { objId: objId };

    eventCfg.checkout = (checkout === true) ? true : false;

    me._registeredEvents.push(me.createEvent(sol.common.IxUtils.CONST.EVENT_TYPES.GOTO, eventCfg, on));
  },

  /**
   * Adds an event which tells the client to navigate to a given task.
   *
   *     me.addGotoWfTaskEvent(flowId);
   *
   * @param {String} flowId (required)
   * @param {Object} params
   * @param {String} params.objId Either `nodeId` or `objId` is required
   * @param {String} params.nodeId Either `nodeId` or `objId` is required
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addGotoWfTaskEvent: function (flowId, params, on) {
    var me = this,
        eventdata = { flowId: flowId },
        node;

    if (params && params.nodeId) {
      eventdata.nodeId = params.nodeId;
    } else if (params && params.objId) {
      node = sol.common.WfUtils.findFirstActiveNode(params.objId, flowId);
      eventdata.nodeId = (node) ? node.nodeId : null;
    }

    if (!eventdata.flowId || !eventdata.nodeId) {
      return;
    }

    me._registeredEvents.push(me.createEvent(sol.common.IxUtils.CONST.EVENT_TYPES.GOTO, eventdata, on));
  },

  /**
   * Adds an error event.
   *
   *     if (!me.templateId) {
   *       me.addErrorEvent("partner.msgs.errormessage", null, null, me.ci);
   *       return;
   *     }
   *
   * @param {String} message Either a message string or a message key (if language is set)
   * @param {String} errorcode (optional)
   * @param {String} exception (optional)
   * @param {String|de.elo.ix.client.ClientInfo} language (optional) Either an ISO language String, or an de.elo.ix.client.ClientInfo Object
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addErrorEvent: function (message, errorcode, exception, language, on) {
    var me = this,
        errorCfg = {},
        errorEvent;

    if (language) {
      message = me.getLocalizedString(language, message);
    }

    if (message) {
      errorCfg.msg = message;
    }
    if (errorcode) {
      errorCfg.code = errorcode;
    }
    if (exception) {
      errorCfg.ex = exception;
    }

    errorEvent = me.createEvent(sol.common.IxUtils.CONST.EVENT_TYPES.ERROR, errorCfg, on);

    me._registeredEvents.push(errorEvent);
  },

  /**
   * Adds an info event.
   *
   *     addFeedbackEvent("sol.pubsec.MyString", "de")
   *
   * will return the string as defined the relevant properties language file of the indexserver translation
   *
   *     addFeedbackEvent("hello {{str1}}", null, { str1: "world" })  ==> "hello world"
   *
   * Assuming, that we have property language keys defined for German (`sol.pubsec.MyString=Herr {{name}} wir grüßen Sie`) and English (`sol.pubsec.MyString=Greetings Mr. {{name}}`):
   *
   *     addFeedbackEvent("sol.pubsec.MyString", "de", { name: "Mustermann" })  ==> "Herr Mustermann wir grüßen Sie"
   *     addFeedbackEvent("sol.pubsec.MyString", "en", { name: "Mustermann" })  ==> "Greetings Mr. Mustermann"
   *
   * @param {String} message Either a message string or a message key (if language is set)
   * @param {String|de.elo.ix.client.ClientInfo} language (optional) Either an ISO language String, or an de.elo.ix.client.ClientInfo Object
   * @param {Object} params (optional) if set, the message will be used as a handlebars string with the params applied (if there is also a `language`, the translation will be applied first)
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addInfoEvent: function (message, language, params, on) {
    var me = this,
        feedbackCfg, feedbackEvent;

    feedbackCfg = me.createFeedbackEventCfg(message, language, params, on);
    if (feedbackCfg) {
      feedbackCfg.permanent = true;
      feedbackEvent = me.createEvent(sol.common.IxUtils.CONST.EVENT_TYPES.FEEDBACK, feedbackCfg, on);
      me._registeredEvents.push(feedbackEvent);
    }
  },

  /**
   * Adds a feedback event.
   *
   *     addFeedbackEvent("sol.pubsec.MyString", "de")
   *
   * will return the string as defined the relevant properties language file of the indexserver translation
   *
   *     addFeedbackEvent("hello {{str1}}", null, { str1: "world" })  ==> "hello world"
   *
   * Assuming, that we have property language keys defined for German (`sol.pubsec.MyString=Herr {{name}} wir grüßen Sie`) and English (`sol.pubsec.MyString=Greetings Mr. {{name}}`):
   *
   *     addFeedbackEvent("sol.pubsec.MyString", "de", { name: "Mustermann" })  ==> "Herr Mustermann wir grüßen Sie"
   *     addFeedbackEvent("sol.pubsec.MyString", "en", { name: "Mustermann" })  ==> "Greetings Mr. Mustermann"
   *
   * @param {String} message Either a message string or a message key (if language is set)
   * @param {String|de.elo.ix.client.ClientInfo} language (optional) Either an ISO language String, or an de.elo.ix.client.ClientInfo Object
   * @param {Object} params (optional) if set, the message will be used as a handlebars string with the params applied (if there is also a `language`, the translation will be applied first)
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  addFeedbackEvent: function (message, language, params, on) {
    var me = this,
        feedbackCfg, feedbackEvent;

    feedbackCfg = me.createFeedbackEventCfg(message, language, params, on);
    if (feedbackCfg) {
      feedbackCfg.permanent = false;
      feedbackEvent = me.createEvent(sol.common.IxUtils.CONST.EVENT_TYPES.FEEDBACK, feedbackCfg, on);
      me._registeredEvents.push(feedbackEvent);
    }
  },

  /**
   * @private
   * Creates an basic feedback event config. Used by {@link #addFeedbackEvent} and {@link addInfoEvent}.
   * @param {String} message
   * @param {String|de.elo.ix.client.ClientInfo} language
   * @param {Object} params
   * @param {Object} on
   * @return {Object}
   */
  createFeedbackEventCfg: function (message, language, params, on) {
    var me = this,
        feedbackCfg = {};

    if (!message) {
      return null;
    }
    if (language) {
      message = me.getLocalizedString(language, message);
    }

    if (params) {
      message = sol.create("sol.common.Template", { source: message }).apply(params);
    }

    feedbackCfg.msg = message;

    return feedbackCfg;
  },

  /**
   * Get a localized string for a key.
   * @param {String|de.elo.ix.client.ClientInfo} language Either an ISO language String, or an de.elo.ix.client.ClientInfo Object
   * @param {String} key The key in the resource files
   * @return {String}
   */
  getLocalizedString: function (language, key) {
    return sol.common.TranslateTerms.getTerm(language, key);
  },

  /**
   * Writes a feed event for an object.
   *
   * Uses {@link sol.common.ix.functions.FeedComment#RF_sol_function_FeedComment RF_sol_function_FeedComment}.
   *
   * @param {String} objId
   * @param {Object} params
   * @param {String} params.file The name of the language file (in `Administration/ELOwf Base/Feed/Script Locales`)
   * @param {String} params.key The key in the language file
   * @param {String[]} params.data (optional) Optional data, if the language key contains placeholders
   */
  writeFeedEvent: function (objId, params) {
    var me = this;
    if (!objId) {
      me.logger.error("IllegalArgumentException: can not write feed comment without an 'objId'");
      return;
    }
    if (!params || !params.file || !params.key) {
      me.logger.error("IllegalArgumentException: can not write feed comment without a 'file' or a 'key'");
      return;
    }
    sol.common.IxUtils.execute("RF_sol_function_FeedComment", params);
  },

  /**
   * Starts a workflow and returns the new workflow Id.
   * Uses {@link sol.common.WfUtils#startWorkflow WfUtils.startWorkflow}.
   *
   *
   *
   * @param {String} objId
   * @param {String} templateId
   * @param {String} name The workflow name
   * @return {String} The workflow ID
   */
  startWorkflow: function (objId, templateId, name) {
    return sol.common.WfUtils.startWorkflow(templateId, name, objId);
  },

  /**
   * Starts the workflow defined in the as standard workflow for the mask or in an index field.
   * If there is already an workflow, it will do nothing and return the first active one.
   * Uses {@link sol.common.WfUtils#startMaskStandardWorkflow WfUtils.startMaskStandardWorkflow}.
   *
   * @param {String} objId
   * @param {Object} params (optional) Default will be the sord name
   * @param {Object} params.name (optional) Default will be the sord name
   * @param {Object} params.field (optional) The field to read the workflow template from
   * @return {String} The workflow ID
   */
  startMaskStandardWorkflow: function (objId, params) {
    return sol.common.WfUtils.startMaskStandardWorkflow(objId, params);
  },

  /**
   * @private
   * Builds a json response including events, messages.
   * @return {String}
   */
  buildResponse: function () {
    var me = this,
        response = {};

    if (me.arrayIsNotEmpty(me._registeredEvents)) {
      response.events = me._registeredEvents;
    }

    if (me.arrayIsNotEmpty(me._messages)) {
      response.messages = me._messages;
    }

    response.data = me._data;

    return sol.common.JsonUtils.stringifyAll(response);
  },

  /**
   * @abstract
   * @private
   * @param {String} type The type of event which should be executed after function returns
   * @param {Object} params Object with key-value-pairs to configure the event
   * @param {Object} on (optional) Object with conditions for the event execution (see class documentation)
   */
  createEvent: function () {
    throw "cannot call 'createEvent' of class 'sol.common.ActionBase', function has to be implemented by subclass";
  },

  /**
   * @private
   * Checks if an Array is empty or not.
   * @param {Array} array
   * @returns {Boolean}
   */
  arrayIsNotEmpty: function (array) {
    return array && array.length > 0;
  }

});
