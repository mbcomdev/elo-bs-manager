//@include lib_Class.js
//@include lib_sol.common.Config.js
//@include lib_sol.common.TranslateTerms.js
//@include lib_sol.common.ObjectUtils.js
//@include lib_sol.common.SordUtils.js
//@include lib_sol.common.Template.js
//@include lib_sol.common.WfUtils.js

/**
 * @author ESt, ELO Digital Office GmbH
 * @version 1.03.000
 *
 * 
 * @eloas
 * @eloix
 *
 * Injection Mixin
 *
 * You can use this mixin in business solution classes to load configurations
 * and apply templating to them using sord- or other data
 *
 * As this mixin calls the including classes' inject method, you have to define an inject
 * method in the including class.
 *
 * Usually, this mixin is accompanied by a solution-specific `configuration`-mixin, which
 * is responsible for describing the relationship between a config-name and the config repository path.
 * (see sol.hr.mixins.Configuration for an example configuration-description file)
 *
 * A typical usage of this mixin would be e.g. an indexserver-service.
 * ## Possible Injections
 * Injections have to be defined in the classes `inject`-property.
 *
 * ### Config Injection
 *
 * You can inject configs or a property of a config by using the `config` and `prop` keywords:
 *
 *     { config: "hr", prop: "entities.file.valueA", template: true }
 *
 * This would initialize the hr.config, read the property `valueA` and apply templating to it.
 * The `template` keyword is optional. You can enable it, if the config property contains a handlebars template to render it.
 * You may also define `emptyNonRendered: true`, which will set the handlebars template to an empty string, if it could not be rendered.
 * (Otherwise the handlebars template will still be the value of the injected string)
 *
 * Every injected config property injection which results in an object or array will be deep-copied.
 *
 * ### Sord Injection
 *
 * Injecting sords is possible by using the `sordId` and `flowId` keywords:
 *
 *     { sordId: "12345", flowId: "442381" }
 *
 * Usually the objId and flowId are values one does not know at compile time and must therefore be determined dynamically.
 * You can use
 *
 *     { sordIdFromProp: "objId", flowIdFromProp: "flowId" }
 *
 * You can use the optional setting to skip injecting a sord if no objId was found:
 *
 *     { sordIdFromProp: "objId", flowIdFromProp: "flowId", optional: true }
 *
 * to access a property stored in `me`/`this` (see extensive example below)
 *
 * If you define the property `includeBlobs`, the sord's FormBlobs will also we read.
 *
 * All sords will automatically be added to the data used for handlebars templating.
 * If you don't want to add it to the templating data, you can define the property `forTemplating` as false.
 *
 * ### JSON Injection
 *
 * You can inject a json-string, which will then be parsed, by using the `json` property.
 *
 *     { json: '{ "myProp": 12345123 }' }
 *
 * As with sordIdFromProp, you can use `jsonFromProp` to read the JSON from a variable.
 *
 * All parsed JSON will be added to the data used for handlebars templating.
 * If you don't want to add it to templating, set the `forTemplating` property to false.
 *
 * ### Property Injection (Inject into templating data)
 *
 * You can add any data local to the class (`me`/`this`) to the handlebars templating by defining
 *
 *     { prop: "params" }
 *
 * Usually, the injection mechanism would overwrite the original params if you define
 *
 *     params: { prop: "params" }
 *
 * ### Add to templating but don't inject
 *
 * You can disable injection by defining the property `dontInject` as true.
 * This way, the property will be added to templating but won't be injected.
 * This is only possible in Sord-, JSON- and Property-Injection.
 *
 * ### Disable logging of an injected value
 *
 * You can disable the logging of specific injections by defining the property
 * `log` as false. This may be useful for sensitive data. Instead of the value,
 * `N/A` will be shown in the logs.
 * Always doublecheck if the actual logging outputs reflect your wishes.
 *
 * ### Usage of `sol.common.mixins.Injector.SordToken`
 *
 * Use this token mixin to inject automatically sord injectorId by objId or source prop.
 * The mixin function will append either `{sord: { "sordIdFromProp": "objId"}}` or `{sord: { "prop": "source"}}`
 * to your `inject: {}` variable. It depends which params you have defined in your function context. me.objId will always
 * win when it is set. Otherwise it will use me.source to create the sordToken.
 * The token will only append when token (injectorId) is not already set.
 *
 *  sol.define("sol.hr.ix.actions.GetMyServiceResult", {
 *      extend: "sol.common.ix.ServiceBase",
 *
 *      mixins: ["sol.hr.mixins.Configuration",  "sol.common.mixins.Injector.SordToken", "sol.common.mixins.Injector.SordToken"],
 *  }
 *
 *
 * It is important that `sol.common.mixins.Injector.SordToken` is included first before `sol.common.mixins.Injector.SordToken` mechanismus is triggered! 
 * It does not matter if the inject mechanism is called manually.
 *
 * ## Example
 *
 * This simple example reads a parameter from the config-file, applies a sord, a parameter and a translation to the template
 * and returns the value. Note: sords are retrieved with a normal user connection. If you need access to a sord via ixConnectAdmin,
 * you must checkout the sord manually in the initialize function and add it to the templating using the `prop`-option
 *
 *    /hr/Configuration/hr.config:
 *    {
 *      entities: { file: { valueA: "{{translate 'sol.hr.descr'}}{{PERSONNELFILE.objKeys.LASTNAME}}, {{params.name}}" } }
 *    }
 *
 *    /hr/All Rhino/lib_sol.hr.mixins.Configuration:
 *      //include lib_Class.js
 *
 *      sol.define("sol.hr.mixins.Configuration", {
 *        mixin: true,
 *
 *        $configRelation: {
 *          hr: "/hr/Configuration/hr.config",
 *          myOtherConfig: "/hr/Configuration/something.config",
 *          // load recruiting.config. if it is not found, load recruiting.fallback.config
 *          recruiting_in_hr: ["/recruiting/Configuration/recruiting.config", "/hr/Configuration/recruiting.fallback.config"]
 *        }
 *      });
 *
 *    note: this example implies that the parameters
 *      { objId: "12345", flowId: "441234", name: "Vertragsanpassung" }
 *    are passed to the service.
 *    //include lib_sol.hr.mixins.Configuration.js
 *    //include lib_sol.common.Injection.js
 *
 *    sol.define("sol.hr.ix.actions.GetMyServiceResult", {
 *      extend: "sol.common.ix.ServiceBase",
 *
 *      mixins: ["sol.hr.mixins.Configuration", "sol.common.mixins.Inject"],
 *
 *      inject: {
 *        myConfigValue: { config: "hr", prop: "entities.file.valueA", template: true }, // ""
 *        // templating data
 *        PERSONNELFILE: { sordIdFromProp: "objId", flowIdFromProp: "flowId" },
 *        params: { prop: "params" }
 *        // mySpecialSord: { prop: "myAdminAccessSord" }
 *      },
 *
 *      initialize: function (params) {
 *        var me = this;
 *        this.$super("sol.common.ix.ActionBase", "initialize", [params]);
 *        me.params = params;
 *        // me.myAdminAccessSord = me.getMySordViaAdminConnection();
 *      },
 *
 *      process: function () {
 *        var me = this;
 *        return me.myConfigValue;  // "Titel: Mayer, Vertragsanpassung"
 *      }
 *
 *  ## initializing config before initialize of calling class
 *
 *  If you need access to config values during initialize(), you can omit "sol.common.mixins.Inject" from the mixins array
 *  and call its constructor manually:
 *
 *      mixins: ["sol.hr.mixins.Configuration"],
 *      initialize: function (params) {
 *        var me = this;
 *        sol.create("sol.common.Injection").inject(me);  // sets up config including templating ...
 *
 *        me.tableTitle = me.dynkwl.tableTitle; // this is a config value we need before calling $super.initialize();
 *        me.$super("sol.hr.ix.dynkwl.MyIterator", "initialize", [config]);
 *      }
 *
 */
sol.define("sol.common.mixins.Inject", {
  mixin: true,

  initialize: function () {
    var me = this;
    me.logger && me.logger.debug(["Initializing injection mixin."]);
    sol.create("sol.common.Injection").inject(me);
  }
});

sol.define("sol.common.mixins.Injection.SordToken", {
  mixin: true,
  initialize: function (config) {
    var me = this, sordInjector;

    sordInjector = config.objId
      ? { sord: { sordIdFromProp: "objId" } }
      : { sord: { prop: "source" } };

    // We can pass source as templateSord directly to the function
    // in this case we dont want to checkout the sord again
    // so we provide the templateSord object as sord to handlebar.
    // That means we can use either objId or templateSord object to inject the
    // sord object to the handlebar context and resolve templates in configs
    sol.common.InjectionUtils.addInjections(me, sordInjector);
  }
});

sol.define("sol.common.Injection", {
  /**
   * @private
   * used in logging messages if a string if masked with ifLog() (injection.log===false)
   */
  noLogTxt: "N/A",

  /**
   * returns `any` if `log` is not false. Otherwise returns `me.noLogTxt`.
   */
  ifLog: function (log, any) {
    var me = this;
    return (log !== false) ? any : me.noLogTxt;
  },

   /**
   * retrieves template sord of objId/guid & flowId
   * make sure the objId/guid exists first!
   * @param {String} objId GUID/ObjId of sord to perform checkout on
   * @param {String} flowId used by getTemplateSord to retrieve wfMapKeys and formblobs
   * @return {TemplateSord} returns the requested templateSord
   */
  getSordData: function (objId, flowId, asAdmin, formBlobs) {
    var me = this;
    me.logger.debug(["Retrieving sord-data"]);
    return sol.common.WfUtils.getTemplateSord(
      ((asAdmin && typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect).ix().checkoutSord(objId, SordC.mbAllIndex, LockC.NO),
      flowId || me.flowId,
      { asAdmin: asAdmin, formBlobs: formBlobs }
    ).sord;
  },


  initConfig: function (configName, classContext) {
    var me = this, configPaths, configLoaded, useGlobalCache;
    me.logger.debug(["Reading configuration because injection requires access to configuration `{0}`. See further log for the actual config-property injection.", configName]);
    if (me.typeOf(classContext.$configRelation, "object")) {
      configPaths = classContext.$configRelation[configName];
      if (configPaths) {
        if  (!Array.isArray(configPaths)) {
          configPaths = [configPaths];
        }
          configLoaded = configPaths.some(function (path) {
            //path could be String (old implementation) or an Object (new implementation)
            path = me.typeOf(path, "object") ? path.src : path;
            useGlobalCache = me.typeOf(path, "object") && path.useGlobalCache;
            try {
              classContext.$configs[configName] = (sol.create("sol.common.Config", { compose: path, copy: true, useGlobalCache: useGlobalCache })).config;
            } catch (_) {}
            return !!classContext.$configs[configName];
          });
          if (!configLoaded) {
            throw "Config at path " + configPaths[0] + "was not found!";
          }
        me.logger.debug(["Configuration `{0}` loaded.", configName]);
      } else {
        throw "$configRelation of configuration-mixin did not contain a configuration-path for config `" + configName + "`.";
      }
    } else {
      throw "$configRelation is not defined or not a javascript object. Please make sure to include a configuration mixin in the calling class.";
    }
  },

  injectConfig: function (config, injectId, classContext) {
    var me = this, configName = String(config.config);
    me.logger.debug(["Setup configuration `{0}` for injection `{1}`.", configName, injectId]);
    classContext.$configs = classContext.$configs || {};
    classContext.$configs[configName] || me.initConfig(configName, classContext);
    me.logger.debug("Adding config-property injection object to backlog for subsequent injection", me.ifLog(config.log, config));
    me.$configInjections.push(config);
  },

  injectSordById: function (sordConfig, injectId, classContext) {
    var me = this, sordData,
        sordId = sordConfig.sordId || sol.common.ObjectUtils.getProp(classContext, sordConfig.sordIdFromProp),
        flowId = sordConfig.flowId || sol.common.ObjectUtils.getProp(classContext, sordConfig.flowIdFromProp);

    if (!sordId && sordConfig.optional) {
      me.logger.debug("Optional sord was not found and therefore not injected. Continuing ...");
      return;
    }
    me.logger.debug(["Injecting sord-data of injection `{0}` by id `{1}` using flowId `{2}`.", injectId, me.ifLog(sordConfig.log, sordId), me.ifLog(sordConfig.log, flowId || me.flowId)]);
    sordData = me.getSordData(sordId, flowId, false, (sordConfig.includeBlobs === true));
    if (sordConfig.forTemplating !== false) {  // is added to templating as default
      me.logger.debug("Adding retrieved sord-data to templating-data.");
      classContext.$templatingData = classContext.$templatingData || {};
      classContext.$templatingData[injectId] = sordData;  // also add sord to templating
    } else {
      me.logger.debug("Sord-data has been retrieved but has not been added to templating-data.");
    }
    return sordConfig.dontInject ? undefined : sordData;
  },

  injectJSON: function (json, injectId, classContext) {
    var me = this, result;
    me.logger.debug(["Parsing JSON of injection `{0}`.", injectId]);
    result = JSON.parse(me.typeOf(json.json, "string") ? String(json.json) : sol.common.ObjectUtils.getProp(classContext, json.jsonFromProp));
    if (json.forTemplating !== false) {  // is added to templating as default
      me.logger.debug("Adding parsed JSON to templating-data.");
      classContext.$templatingData = classContext.$templatingData || {};
      classContext.$templatingData[injectId] = result;  // also add data to templating
    } else {
      me.logger.debug("JSON has been parsed but has not been added to templating-data.");
    }
    return json.dontInject ? undefined : result;
  },

  injectFromThis: function (prop, injectId, classContext) {
    var me = this, result, propType;
    me.logger.debug(["Reading property of class-context as defined in injection `{0}`.", injectId]);
    result = sol.common.ObjectUtils.getProp(classContext, String(prop.prop));
    propType = me.typeOf(result);
    me.logger.debug("Property value read", me.ifLog(prop.log, result));
    if ((propType === "object") || (propType === "array")) {
      me.logger.debug("The value is an object or an array. It will be cloned to minimize sideeffects");
      result = me.copyConfig(result);
    }
    if (prop.forTemplating !== false) {  // is added to templating as default
      me.logger.debug("Adding value to templating-data");
      classContext.$templatingData = classContext.$templatingData || {};
      classContext.$templatingData[injectId] = result;  // also add data to templating
    } else {
      me.logger.debug("Property has been read but has not been added to templating-data.");
    }
    return prop.dontInject ? undefined : result;
  },

  injectConfigProperty: function (config, classContext) {
    var me = this, prop, propType;
    me.logger.debug(["Reading config-property `{0}` from configuration `{1}`.", config.prop, config.config]);
    prop = sol.common.ObjectUtils.getProp(classContext.$configs[config.config], config.prop);
    propType = me.typeOf(prop);
    me.logger.debug("Configuration value read", me.ifLog(config.log, prop));
    if ((propType === "object") || (propType === "array")) {
      me.logger.debug("The value is an object or an array. It will be cloned to minimize sideeffects");
      prop = me.copyConfig(prop);
    }
    return prop;
  },

  copyConfig: function (obj) {
    return JSON.parse(JSON.stringify(obj, function (_, val) {
      return (val && val.getClass) ? String(val) : val;
    }));
  },

  performInjection: function (injection, injectionId, classContext) {
    var me = this, injectionFct;
    me.logger.debug(["Deciding on injection mechanism for injection `{0}`", injectionId]);
    if ((me.typeOf(injection.config, "string") && String(injection.config)) && (me.typeOf(injection.prop, "string"))) {
      injectionFct = me.injectConfig; // setup config
    } else if ((injection.sordId || injection.sordIdFromProp) && (injection.sordId + "")) {
      injectionFct = me.injectSordById; // injects a sord by passed Id
    } else if (me.typeOf(injection.json, "string") || (me.typeOf(injection.jsonFromProp, "string") && String(injection.jsonFromProp))) {
      injectionFct = me.injectJSON; // injects data parsed from JSON
    } else if (me.typeOf(injection.prop, "string") && String(injection.prop)) {
      injectionFct = me.injectFromThis; // injects data from this to this (basically only used to expose data to templating)
    } else {
      throw "Injection `" + injectionId + "` did not match any injection mechanism or  the mechanism configuration is incomplete. (possible mechanisms: config, sordId, json, prop, ...)";
    }

    injection.injectId = injectionId;
    injection.template && me.$injectionsToTemplate.push(injection);

    return injectionFct && injectionFct.call(me, injection, injectionId, classContext);
  },

  /**
   * injects data into a class `classContext`
   * @param {InitializedClassContext} classContext me/this of the class to inject data into.
   */
  inject: function (classContext) {
    var me = this, injections = classContext.inject, injectionResult;
    me.$configInjections = [];
    me.$injectionsToTemplate = [];
    me.typeOf = sol.common.ObjectUtils.type;
    me.logger.enter("sol.common.Injection.inject");
    me.logger.debug("Running inject on class-context");
    if (me.typeOf(injections, "object")) {
      me.logger.debug("Analyzing injections", injections);
      Object.keys(injections).forEach(function (injectionId) {
        var injection = injections[injectionId];
        me.logger.debug(["Testing injection `{0}`", injectionId]);
        if (me.typeOf(injection, "object")) {
          me.logger.debug(["Acting on injection `{0}`", injectionId]);
          injectionResult = me.performInjection(injection, injectionId, classContext);
          // every function will return its result which will then be injected. only config properties don't return & will be injected later
          if (injectionResult !== undefined) {
            classContext[injectionId] = injectionResult;
            me.logger.debug(["Injection `{0}` has been injected into the class context. Value", injectionId], me.ifLog(injection.log, injectionResult));
          } else {
            me.logger.debug(["Injection value of injection `{0}` is undefined. This may be ok, if configuration was read or you defined `dontInject`", injectionId]);
          }
        } else {
          throw "Injecting `" + injectionId + "` failed. The property value is not a javascript object.";
        }
      });

      me.logger.debug("Inject config properties from backlog");
      me.$configInjections.forEach(function (injection) {
        classContext[injection.injectId] = me.injectConfigProperty(injection, classContext);
      });

      me.$injectionsToTemplate.forEach(function (injection) {
        if (injection.template) {
          me.logger.debug("Applying template to injected value. Value before templating", me.ifLog(injection.log, classContext[injection.injectId]));
          classContext[injection.injectId] = sol.common.TemplateUtils.render(classContext[injection.injectId], classContext.$templatingData, { emptyNonRendered: !!injection.emptyNonRendered });
          me.logger.debug("Value after templating", me.ifLog(injection.log, classContext[injection.injectId]));
        }
      });
      me.logger.debug("All injections have been performed.");
    } else {
      throw "No injections defined. `inject` property value must be a javascript object. Type was: `" + me.typeOf(injections) + "`";
    }
    me.logger.exit("sol.common.Injection.inject");
  }
});

sol.define("sol.common.InjectionUtils", {
  singleton: true,

  /**
   * Append all injection keys to `context.inject` when the key does not already exist
   * @param {*} context
   * @param {*} injections
   */
  addInjections: function (context, injections) {
    Object.keys(injections)
    .filter(function (key) {
      return !context.inject[key];
    })
    .forEach(function (key) {
      context.inject[key] = injections[key];
    });
  }

});