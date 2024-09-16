
//@include lib_Class.js
//@include lib_sol.common.ObjectUtils.js
//@include lib_sol.common.RepoUtils.js
//@include lib_sol.common.UserUtils.js
//@include lib_sol.common.IxUtils.js

/*
 * Local definition of the class `sol.common.Cache` for backward compatibility of previous solution packages.
 */
if (!sol.ClassManager.getClass("sol.common.Cache")) {
  sol.define("sol.common.Cache", {

    initialize: function (config) {
      var me = this;
      me.cache = new java.util.concurrent.ConcurrentHashMap(8, 0.9, 1);
    },

    /**
     * Inserts the specified key-value pair into the cache.
     * @param {String} key
     * @param {Object} value
     * @return {Object} The previous value associated with the key, or null if there was no mapping before
     */
    put: function (key, value) {
      var me = this;
      return me.cache.put(key, value);
    },

    /**
     * Inserts all key-value pairs specified by an object into the cache. Existing mappings will be replaced.
     * @param {Object} data Property names will be used as keys and the associated values as values.
     */
    putAll: function (data) {
      var me = this;
      me.cache.putAll(data);
    },

    /**
     * Tests if the specified object is a key in the cache.
     * @param {String} key
     * @return {Boolean}
     */
    containsKey: function (key) {
      var me = this;
      return me.cache.containsKey(key);
    },

    /**
     * Returns the value for the specified key from the cache, or null if the chache contains no mapping for the key.
     * @param {String} key
     * @return {Object}
     */
    get: function (key) {
      var me = this;
      return me.cache.get(key);
    },

    /**
     * Returns an enumeration of all keys in the cache.
     * @return {Object} An `java.util.Enumeration` of all keys
     */
    keys: function () {
      var me = this;
      return me.cache.keys();
    },

    /**
     * Returns a collection view of the values contained in the cache.
     * @return {Object} An `java.util.Collection` of all values
     */
    values: function () {
      var me = this;
      return me.cache.values();
    },

    /**
     * Returns an enumeration of the values in the cache.
     * @return {Object} An `java.util.Enumeration` of all values
     */
    elements: function () {
      var me = this;
      return me.cache.elements();
    },

    /**
     * Removes the key (and its corresponding value) from the cache.
     * @param {String} key
     * @return {Object} The previous value associated with the key, or null if there was no value for the key
     */
    remove: function (key) {
      var me = this;
      return me.cache.remove(key);
    },

    /**
     * Returns the number of key-value pairs in the cache.
     * @return {Number}
     */
    size: function () {
      var me = this;
      return me.cache.size();
    },

    /**
     * Returns `true` if the chache contains no key-value pairs.
     * @return {Boolean}
     */
    isEmpty: function () {
      var me = this;
      return me.cache.isEmpty();
    },

    /**
     * Removes all of the mappings from the cache.
     */
    clear: function () {
      var me = this;
      me.cache.clear();
    }
  });
}

/**
 * Helper for JSON configuration files.
 *
 * The constructor can take either a `load`, a `compose` parameter or a JavaScript object.
 * If the configuration was loaded from the repository (with an additional `writable=true`) as parameter, all changes can be saved back to the repository with {@link #save}.
 * Saving will always be deactivated if the configuration was loaded with compose.
 * If the instance was constructed with an object, it can be saved as a new repository element with {@link #saveNew}.
 *
 * # Load
 * This code loads a configuration in readonly mode from a repository file:
 *
 *     var myconfig = sol.create("sol.common.Config", { load: "(286B8C55-DBF6-2391-8447-479ED57FFDB0)" }).config;
 *
 * The next example also loads a configuration, but also saves changed back:
 *
 *     var cfg = sol.create("sol.common.Config", { load: "ARCPATH:/Administration/Configuration/MyJsonConfig", writable: true });
 *     var myconfig = cfg.config;
 *     // ... make some changes to myconfig ...
 *     cfg.save();
 *
 *
 * # Compose
 * If a new configuration object is created using `compose`,
 * it tries to load the original file as well as a customized file from the same path underneath the 'Business Solutions Costom' folder.
 * Both files will be merged, while the changes in the custom file will override the original settings.
 *
 *     var myconfig = sol.create("sol.common.Config", { compose: "/contract/Configuration/contract.config" }).config;
 *
 * If `compose` is used with an objId, it tries to figure out the relative path inside the Solution folder.
 * If there is none, nothing will be loaded.
 * If there is more then one valid path the first one will be used.
 *
 * # Config
 * To save a new configuration, you could:
 *
 *     var cfg = sol.create("sol.common.Config", { config: { exampleConfigProperty: "a String", anotherProperty: 4711 } });
 *     cfg.saveNew("ARCPATH:/Administration/Configuration/myNewExampleConfig");
 *
 * # Additional comments
 *
 * If used within clients that don't have an ixConnectAdmin-connection configurations are processed by ix function calls.
 * This allows for additional caching among all users and speed up client load times.
 *
 * # Protected config files
 * If a config file contains sensible data (e.g. passwords) it can be secured by adding a `$protected` property (top level).
 * This ensures that no user can obtain a configuration accidentally from cache, without having access to the file itself.
 *
 * @author PZ, ELO Digital Office GmbH
 * @author NM, ELO Digital Office GmbH
 * @version 1.06.000
 *
 * @elojc
 * @eloas
 * @eloix
 * @requires sol.common.ObjectUtils
 * @requires sol.common.RepoUtils
 * @requires sol.common.UserUtils
 * @requires sol.common.IxUtils
 */
sol.define("sol.common.Config", {

  pilcrow: "\u00b6",

  /**
   * @private
   * @property {String} CONFIG_PATH
   */
  CONFIG_PATH: "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/common/Configuration/base.config",

  /**
   * @private
   * @property {String[]} DEFAULT_BASE_PATHS
   */
  DEFAULT_BASE_PATHS: [
    "Business Solutions",
    "Business Solutions Custom"
  ],

  /**
   * @cfg {String} load (optional) This can be an objId, GUID or arcpath to checkout a JSON configuration file from the repository.
   */

  /**
   * @cfg {String} compose (optional) This has to be a relative arcpath underneath the 'Business Solution' folder or a valid objId
   */

  /**
   * @cfg {Object} config (optional)
   */

  /**
   * @cfg {Boolean} [merge=false] (optional)
   * If `true` the configuration loaded via `load`, will be merged (if possible).
   * This is only neccessary if constructor is invoked with `load`, other wise it will be ignored.
   */

  /**
   * @cfg {Boolean} [forceReload=false] (optional) If `true` cache will be refreshed.
   */

  /**
   * @cfg {Boolean} [copy=false] (optional) If `true`, `config`-property of initialized class will contain a new object instead of a cache reference.
   */

  /**
   * @cfg {Boolean} [writable=false] (optional) If `true`, the loaded configuration is writable via the {@link #save} function
   */

  /**
   * @cfg {Boolean} [exceptionOnBrokenConfig=false] (optional) If `true` the merge function throws an exception if on of the configs (which should be merged) is broken.
   */

  /**
   * @cfg {Boolean} [useGlobalCache=false] (optional) If `true` the global cache will be used.
   */

  /**
   * @cfg {de.elo.ix.client.IXConnection} connection IX connection
   */

  /**
   * @property {Object} config The loaded (or via constructor initialized) configuration object.
   */

  /**
   * @private
   * @property {String[]} basePaths
   */

  /**
   * @private
   * @property {String} objId Reference to the loaded configuration in the repository
   */

  /**
   * @private
   * @property {sol.Logger} log Internal logger
   */

  /**
   * @private
   * @property {String} eloAsPathPattern
   * Describes the paths where the `loadEloAsConfig` function looks for the ELOas configuration (inside the Solution folder)
   */
  eloAsPathPattern: "/{{SOLUTION}}/Configuration/as.config",

  initialize: function (config) {
    var me = this;

    me.log = sol.create("sol.Logger", { scope: "sol.common.Config" });
    me.merge = config.merge;
    me.copy = config.copy;
    me.forceReload = config.forceReload;
    me.exceptionOnBrokenConfig = config.exceptionOnBrokenConfig;
    me.useGlobalCache = config.useGlobalCache;

    me.conn = config.connection || ixConnect;

    me.log.enter("initilialize configuration", config);

    if (config.load && (config.merge !== true)) {
      me.objId = config.load;
      // load remotely if running in clients
      me.isRemote() ? me.reloadRemote(me.forceReload) : me.reload(me.forceReload);
    } else if (config.compose || (config.load && (config.merge === true))) {
      // load remotely if running in clients
      if (me.isRemote()) {
        me.compose = config.compose;
        me.reloadRemote(me.forceReload);
      } else {
        me.compose = me.getCompose(config);
        me.reload(me.forceReload);
      }
    } else if (config.config) {
      me.config = config.config;
      me.objId = config.objId;
    }

    if (config.writable === true && !me.compose) {
      me.writable = true;
    }

    me.config = me.copy && me.rawConfig || me.config;

    me.log.exit("initilialize configuration");
  },

  /**
   * This function identifies if a configuration should be loaded remotely.
   * @private
   * @return {boolean} true if configuration should load remotely
   */
  isRemote: function () {
    return (typeof ixConnectAdmin === "undefined")
      && !!sol.ClassManager.getClass("sol.common.IxUtils");
  },

  /**
   * This function reloads the configuration from the repository, and updates the `config` property remotely. This will allow caching configurations for all users in clients.
   * @param {Boolean} [force=false] (optional) If `true`, cached configs will be ignored.
   */
  reloadRemote: function (force) {
    var me = this,
        cacheKey = me.objId || me.compose, rawCacheKey = cacheKey + "_raw",
        cachedCfg, configObj, rawConfigStr;

    me.log.enter("load configuration remote");

    cachedCfg = sol.common.ConfigCache.get(cacheKey, { useGlobalCache: me.useGlobalCache });

    if (!cachedCfg || force === true) {

      if (me.objId) {
        me.log.info(["load configuration remotely: ", me.objId]);
        configObj = sol.common.IxUtils.execute("RF_sol_common_service_GetConfig", {
          objId: me.objId,
          forceReload: force
        }).config;
        rawConfigStr = JSON.stringify(configObj);
      } else if (me.compose) {
        // retrieve merged config using ix interface
        me.log.info(["load merged configuration remotely: ", me.compose]);
        configObj = sol.common.IxUtils.execute("RF_sol_common_service_GetMergedConfig", {
          compose: me.compose,
          forceReload: force
        }).config;
        rawConfigStr = JSON.stringify(configObj);
      }

      sol.common.ConfigCache.put(cacheKey, configObj, { useGlobalCache: me.useGlobalCache }); // cache reference to object
      me.config = configObj; // give access to reference
      sol.common.ConfigCache.put(rawCacheKey, rawConfigStr, { useGlobalCache: me.useGlobalCache }); // cache string
      me.rawConfig = me.copy && JSON.parse(rawConfigStr, { useGlobalCache: me.useGlobalCache }); //  give access to parsed-string -> returns a brand-new object

    } else {
      me.config = cachedCfg;
      me.rawConfig = me.copy && JSON.parse(String(sol.common.ConfigCache.get(rawCacheKey, { useGlobalCache: me.useGlobalCache })));
    }

    me.log.exit("load configuration");
  },


  /**
   * This function reloads the configuration from the repository, and updates the `config` property
   * @param {Boolean} [force=false] (optional) If `true`, cached configs will be ignored.
   */
  reload: function (force) {
    var me = this,
        cacheKey = me.objId || me.compose, rawCacheKey = cacheKey + "_raw",
        cachedCfg, configObj, rawConfigStr, mergeHierarchy, mergeObjects;

    me.log.enter("load configuration");

    cachedCfg = sol.common.ConfigCache.getProtected(cacheKey, { useGlobalCache: me.useGlobalCache });

    if (!cachedCfg || force === true) {

      if (me.objId) {
        me.log.debug(["load configuration in simple mode (objId={0})", me.objId]);
        try {
          rawConfigStr = sol.common.RepoUtils.downloadToString(me.objId, null, { connection: me.conn });
          configObj = JSON.parse(rawConfigStr);
        } catch (ex) {
          me.log.error("could not parse configuration");
          throw "Configuration error: " + ex;
        }
      } else if (me.compose) {
        mergeHierarchy = me.retrieveMergeHierarchy(true);
        mergeObjects = [];

        me.log.debug(["load configuration in merge mode (compose={0}), mergeing '{1}' configs", me.compose, mergeHierarchy.length]);

        mergeHierarchy.forEach(function (mergeObj) {
          if (mergeObj) {
            try {
              mergeObjects.push(JSON.parse(sol.common.RepoUtils.downloadToString(mergeObj.guid, null, { connection: me.conn })));
            } catch (ex) {
              me.log.warn(["no valid config in '{0}'", mergeObj.guid], ex);
              if (me.exceptionOnBrokenConfig === true) {
                throw "Error loading config file '" + mergeObj.arcPath + "'";
              }
            }
          }
        });

        configObj = sol.common.ObjectUtils.mergeObjects(mergeObjects.shift(), mergeObjects);
        rawConfigStr = JSON.stringify(configObj);
      }

      sol.common.ConfigCache.put(cacheKey, configObj, { useGlobalCache: me.useGlobalCache }); // cache reference to object
      me.config = configObj; // give access to reference
      sol.common.ConfigCache.put(rawCacheKey, rawConfigStr, { useGlobalCache: me.useGlobalCache }); // cache string
      me.rawConfig = me.copy && JSON.parse(rawConfigStr, { useGlobalCache: me.useGlobalCache }); //  give access to parsed-string -> returns a brand-new object

    } else {
      me.config = cachedCfg;
      me.rawConfig = me.copy && JSON.parse(String(sol.common.ConfigCache.get(rawCacheKey, { useGlobalCache: me.useGlobalCache })));
    }

    me.log.exit("load configuration");
  },

  /**
   * This function saves changes to the `config` property to the repository
   * @throws Throws an exception, if there is no reference to an repository element (see {@link #objId})
   * @throws Throws an exception, if the object was created in readonly mode (see {@link #writable})
   */
  save: function () {
    var me = this,
        fileContent;

    me.log.enter("save configuration");

    if (!me.writable) {
      throw "Config in readonly mode";
    }

    if (!me.objId) {
      throw "no target path";
    }

    fileContent = new java.lang.String(JSON.stringify(me.config, null, 2));
    sol.common.RepoUtils.uploadSmallContent(me.objId, fileContent);

    me.log.exit("save configuration");
  },

  /**
   * Saves a new configuration file to the repository.
   *
   * - <b>The path has to contain the element name</b>
   * - <b>The path needs to exist (except for the element name), i.e. no new folders will be created</b>
   *
   * @param {String} arcPath An repositoty path.
   * @param {Object} config Configuration
   * @param {de.elo.ix.client.IXConnection} config.connection Index server connection
   */
  saveNew: function (arcPath, config) {
    var me = this,
        conn;

    me.log.enter("save new configuration");

    config = config || {};
    conn = config.connection || ixConnect;

    if (!arcPath) {
      throw "Repository path is missing.";
    }
    sol.common.RepoUtils.saveToRepo({ repoPath: arcPath, maskId: CONST.DOC_MASK.GUID_ELOSCRIPTS, contentObject: me.config, connection: conn });

    me.log.exit("save new configuration");
  },

  /**
   * Retrieves all configs (objIds) for a given element which would be merged to it.
   *
   *     cfg.retrieveMergeHierarchy()   // => ["(7AEC9AD9-A487-F472-1C60-24925943A3CB)"]
   *
   *     cfg.retrieveMergeHierarchy(true)   // => [{ guid: "(7AEC9AD9-A487-F472-1C60-24925943A3CB)", basePath: "Business Solutions", arcPath: "ARCPATH:/..." }]
   *
   * @param {boolean} [extended=false] If `true`, this function returns additional infos.
   * @return {String[]|Object[]} Array with GUIDs
   */
  retrieveMergeHierarchy: function (extended) {
    var me = this,
        mergeHierarchy = [],
        composePath;

    me.log.enter("retrieve hierarchy");

    composePath = (me.compose) ? me.compose : me.retrieveComposePath(me.objId);

    if (composePath) {
      me.getBasePaths().forEach(function (basePath) {
        var sep, arcpath, sord;
        try {
          sep = composePath.charAt(0);
          arcpath = "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:" + sep + basePath + composePath;
          sord = me.conn.ix().checkoutSord(arcpath, SordC.mbOnlyId, LockC.NO);
          if (extended === true) {
            mergeHierarchy.push({
              guid: sord.guid,
              basePath: basePath,
              arcPath: arcpath
            });
          } else {
            mergeHierarchy.push(sord.guid);
          }
        } catch (ex) {
          mergeHierarchy.push(null);
          me.log.info(["could not determine guid for arcpath='{0}'", arcpath], ex);
        }

      });
    }

    me.log.exit("retrieve hierarchy");

    return mergeHierarchy;
  },

  /**
   * Retrieves the relative path for an object, which can be used to compose.
   * If there is more then one composable path, the first one will be used.
   * @param {String} objId
   * @return {String}
   */
  retrieveComposePath: function (objId) {
    var me = this,
        conn, sordZ, sord, validPath, refPaths;

    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;
    sordZ = new SordZ(SordC.mbMin);
    sordZ.add(SordC.mbRefPaths);
    sord = conn.ix().checkoutSord(objId, sordZ, LockC.NO);

    refPaths = Array.prototype.slice.call(sord.refPaths); // Conversion to JavaScript array for Nashorn compatibility

    refPaths.some(function (refpath) {
      var valid = false;

      if (!refpath.path || refpath.path.length <= 2) {
        return false;
      }

      if (refpath.path[0].guid != "(E10E1000-E100-E100-E100-E10E10E10E00)") {
        return;
      }

      valid = me.getBasePaths().some(function (entry) {
        return entry == refpath.path[1].name;
      });

      if (valid) {
        validPath = refpath;
        return true;
      }
    });

    if (validPath) {
      validPath = Array.prototype.slice.call(validPath.path, 2); // Nashorn compatible call
      validPath = me.pilcrow + validPath.map(function (e) {
        return e.name;
      }).join(me.pilcrow) + me.pilcrow + sord.name;

      me.log.debug(["Compose path for objId={0}: {1}", objId, validPath]);

      return validPath;
    }

    return null;
  },

  /**
   * Checks, if an object is in a valid location, so it can be used for `compose` mode.
   * @param {String} objId (optional) If `undefined` the internal value (from constructor: `load` or `compose`) will be used
   * @return {Boolean}
   */
  validForMergeing: function (objId) {
    var me = this,
        validPath;

    if (!objId && !me.objId) {
      return !!me.compose;
    }

    objId = objId || me.objId;
    validPath = me.retrieveComposePath(objId);

    return (validPath !== null);
  },

  /**
   * Loads the ELOas configuration. The filename has to be `as.config`
   *
   * The `as.config` file content has to be a valid JSON string with at least the following propperties:
   *
   *     {
   *       "protocol": "http",
   *       "server": "myservername",
   *       "port": "8080",
   *       "name": "as-myarchive"
   *     }
   *
   * If a `solution` string is provided, the function tries to lookup a solution specific ELOas configuration.
   * If no specific configuration is found, or no `solution` string is provied, it falls back to the `common` configuration.
   *
   * Lookup path:
   *
   *     "ARCPATH:/Administration/Business Solutions/{{SOLUTION}}/Configuration/as.config"
   *
   * Fallback path:
   *
   *     "ARCPATH:/Administration/Business Solutions/common/Configuration/as.config"
   *
   * The following examle tries to load an ELOas configuration specific for the 'invoice' solution:
   *
   *     var eloAsConfig = sol.create("sol.common.Config").loadEloAsConfig("invoice");
   *
   * The result for the configuration file above:
   *
   *     {
   *       protocol: "http",
   *       server: "myservername",
   *       port: "8080",
   *       name: "as-myarchive"
   *     }
   *
   * This uses the {@link sol.common.ConfigCache}.
   * First it tries to retrieve a configuration for the solution name.
   * If none was found it attempts to read the configuration from a solution specific file.
   * If there is no solution specific ELOas configuration (neither in cache, nor in the archive),
   * it will try to use a cached common configuration or get the one from the archive.
   *
   * @param {String} solution (optional)
   * @return {Object}
   */
  loadEloAsConfig: function (solution) {
    var me = this,
        oldCompose, oldObjId, eloAsConfig, result;

    me.log.enter("load ELOas configuration");

    if (solution) {
      eloAsConfig = sol.common.ConfigCache.getELOasCfg(solution, { useGlobalCache: me.useGlobalCache });
      if (!eloAsConfig) {
        try {
          oldCompose = me.compose;
          oldObjId = me.objId;
          me.objId = null;
          me.compose = me.eloAsPathPattern.replace("{{SOLUTION}}", solution);
          me.reload(me.forceReload);
          eloAsConfig = me.config;
          sol.common.ConfigCache.putELOasCfg(solution, eloAsConfig, { useGlobalCache: me.useGlobalCache });
        } catch (ex) {
          if (solution == "common") {
            me.log.warn("no ELOas configuration found in 'common'");
          } else {
            me.log.warn(["no solution specific ELOas configuration found for '{0}'", solution]);
          }
        } finally {
          me.objId = oldObjId;
          me.compose = oldCompose;
          me.reload(me.forceReload);
        }
      }
    }

    if (sol.common.ObjectUtils.isEmpty(eloAsConfig) && (solution != "common")) {
      me.log.debug("try fallback to 'common'");
      eloAsConfig = me.loadEloAsConfig("common");
    }

    result = (sol.common.ObjectUtils.isObject(eloAsConfig)) ? eloAsConfig : null;

    me.log.exit("load ELOas configuration");

    return result;
  },

  /**
   * @private
   * Retrieves the base paths from the common.config.baseMergePaths or uses {@link #DEFAULT_BASE_PATHS} as fallback.
   * @return {String}
   */
  getBasePaths: function () {
    var me = this,
        commonCfg;
    if (!me.basePaths) {
      try {
        commonCfg = sol.create("sol.common.Config", { load: me.CONFIG_PATH }).config;
        me.basePaths = (commonCfg && commonCfg.baseMergePaths) ? commonCfg.baseMergePaths : me.DEFAULT_BASE_PATHS;
      } catch (ex) {
        me.basePaths = me.DEFAULT_BASE_PATHS;
      }
    }
    return me.basePaths;
  },

  /**
   * @private
   * Retrieves the compose path from the constructors config object.
   * @param {Object} config
   * @return {String}
   */
  getCompose: function (config) {
    var me = this,
        checkObjId;
    if (config.compose) {
      checkObjId = me.getObjId(config.compose);
      return (checkObjId) ? me.retrieveComposePath(config.compose) : config.compose;
    }
    if (config.load && me.validForMergeing(config.load)) {
      return me.retrieveComposePath(config.load);
    }
    return null;
  },

  /**
   * @private
   * Returns the object ID of a given repository path.
   * @param {String} repoId Repository path. The path separator is defined by the first character after "ARCPATH:"
   * @return {String} The ID of the new element, or nothing if it does not exist
   */
  getObjId: function (repoId) {
    var conn, sord;
    if (sol.common.RepoUtils.isObjId(repoId) || sol.common.RepoUtils.isGuid(repoId)) {
      // It is already an objId or a guid
      return repoId;
    }

    // Check if repoId can be used for a checkout
    if (!(sol.common.RepoUtils.isArcpath(repoId)
      || sol.common.RepoUtils.isOkeyPath(repoId)
      || sol.common.RepoUtils.isMd5HashPath(repoId)
      || sol.common.RepoUtils.isLMatchPath(repoId))) {
      // 'repoId' is not an objId, guid or any other valid identifier that can be
      // used for a checkout.
      return;
    }

    try {
      conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;
      sord = conn.ix().checkoutSord(repoId, SordC.mbOnlyId, LockC.NO);
      return sord.id;
    } catch (ignore) {
      // Object not found
    }
  }

});


/**
 * Caching for configuration files.
 *
 * Cache is disabled for administrative users. If an administrative user requests a cached config this class always returns `null`.
 *
 * @elojc
 * @eloas
 * @eloix
 *
 * @author PZ, ELO Digital Office GmbH
 * @version 1.03.000
 */
sol.define("sol.common.ConfigCache", {
  singleton: true,
  requires: ["sol.common.Cache"],

  /**
   * @private
   * @property {sol.common.Cache} cache This contains the already loaded configurations
   */
  cache: sol.create("sol.common.Cache"),

  /**
   * @private
   * @property {sol.common.Cache} globalCache This contains the already loaded configurations in global scope
   */
  globalCache: null,

  /**
   * @private
   * @property {Boolean} useGlobalCache
   */
  useGlobalCache: false,

  eloAsKeyPrefix: "ELOASCONFIG#",

  /**
   * Initialization of global config cache.
   * @private
   */
  initGlobalCache: function () {
    var me = this;

    if (typeof globalScope == "object") {
      globalScope.$configCache = globalScope.$configCache || sol.create("sol.common.Cache");
      me.globalCache = globalScope.$configCache;
    } else {
      me.logger.debug("Global config cache could not be initialized.");
    }
  },

  /**
   * Returns the cache to be used based on the arguments provided
   * @param {Object} options
   * @returns {sol.common.Cache}
   */
  getCache: function (options) {
    var me = this,
        useGlobalCache =  (options && typeof options.useGlobalCache != "undefined") ? options.useGlobalCache : me.useGlobalCache;

    if (useGlobalCache) {
      me.initGlobalCache();
    }

    return useGlobalCache && me.globalCache ? me.globalCache : me.cache;
  },

  /**
   * Retrieves a configuration from the cache.
   * @param {String} key
   * @param {Object} options
   * @return {Object}
   */
  get: function (key, options) {
    var me = this,
        cachedCfg = null,
        cache = me.getCache(options);

    if (key === null) {
      throw "Can not access config cache with an 'null' as key";
    }
    if (!me.cacheDisabled() && cache.containsKey(key)) {
      me.logger.debug(["cache hit for key={0}", key]);
      cachedCfg = cache.get(key);
    }

    return cachedCfg;
  },

  /**
   * Retrieves a configuration from the cache. Configs with protected flag will only delivered from cache for service users.
   * @param {String} key
   * @return {Object}
   */
  getProtected: function (key, options) {
    var me = this,
        cachedCfg = null;

    cachedCfg = me.get(key, options);

    return (cachedCfg && !cachedCfg.hasOwnProperty("$protected")) ? cachedCfg : null;
  },

  /**
   * Puts a configuration into the cache.
   * @param {String} key
   * @param {Object} cfg
   * @param {Object} options
   */
  put: function (key, cfg, options) {
    var me = this,
        cache = me.getCache(options);
    if (key && cfg) {
      me.logger.debug(["put key={0} into cache", key]);
      cache.put(key, cfg);
    }
  },

  /**
   * Retrieves an ELOas configuration from the cache.
   * @param {String} solution
   * @param {Object} options
   * @return {Object}
   */
  getELOasCfg: function (solution, options) {
    var me = this;

    me.logger.debug(["load ELOas '{0}' config from cache", solution]);

    return me.get(me.eloAsKeyPrefix + solution, options);
  },

  /**
   * Puts an ELOas configuration into the cache.
   * @param {String} solution
   * @param {Object} options
   * @param {Object} cfg
   */
  putELOasCfg: function (solution, cfg, options) {
    var me = this;

    if (solution && cfg) {
      me.logger.debug(["put ELOas '{0}' config into cache", solution]);
      me.put(me.eloAsKeyPrefix + solution, cfg, options);
    }
  },

  /**
   * @private
   * Checks, if caching is disabled.
   * Currently caching is only disabled for administrative users with interactive login flag.
   * @return {Boolean}
   */
  cacheDisabled: function () {
    var me = this,
        userInfo, isDisabled;
    if (sol.common.UserUtils && sol.common.UserUtils.isMainAdmin && sol.common.UserUtils.isServiceUser) {
      userInfo = ixConnect.loginResult.user;
      isDisabled = sol.common.UserUtils.isMainAdmin(userInfo) && !sol.common.UserUtils.isServiceUser(userInfo);
    }
    if (isDisabled) {
      me.logger.debug("caching disabled for administrative users");
    }
    return isDisabled;
  }

});


/**
 * Utility functions to mix into objects and help working with configurations.
 *
 * @elojc
 * @eloas
 * @eloix
 *
 * @requires sol.common.Config
 * @requires sol.common.ObjectUtils
 * @requires sol.common.StringUtils
 */
sol.define("sol.common.ConfigMixin", {
  singleton: true,
  mixin: true,

  /**
   * Parses the configuration from an Object or a JSON String.
   *
   * Additionally, a JSON file can be specified, to load configuration from.
   *
   *     {
   *       $config: "4711",          // (optional) an objId, GUID or ARCPATH to a JSON file
   *       $property: "configParts.part1",  // (optional) if specified, and the property is an Object, this will be used, instead of the hole JSON file content (can reference sub-objects by using '.' notation)
   *       $useGlobalCache: true, // (optional) if specified, the global cache will be used to retrieve the configuration for the key provided
   *       extraParam: "extra"  // (optional) all properties, without `$` prefix, will be written into the result.config Object (possibly overwriting values from the JSON file)
   *     }
   *
   * If the JSON file (with objId=4711) would contain something like this:
   *
   *     {
   *       "someProperty": "string",
   *       "configParts": {
   *         "part1": {
   *           "firstParam": "first",
   *           "secondParam": "second"
   *         }
   *       }
   *     }
   *
   * The returned Object would look like this:
   *
   *     {
   *       $config: "4711",
   *       $property: "configParts.part1",
   *       $useGlobalCache: true,
   *       config: {
   *         firstParam: "first",
   *         secondParam: "second",
   *         extraParam: "extra"
   *       }
   *     }
   *
   * @param {Object|String} configuration A JavaScript Object, or a JSON String
   * @param {Boolean} allProps
   * @return {Object}
   */
  parseConfiguration: function (configuration, allProps, copy) {
    var me = this,
        configObj, configInstance, config, prop;

    configObj = (sol.common.ObjectUtils.isObject(configuration)) ? configuration : JSON.parse(configuration);

    // load the config from a JSON file
    if (configObj && configObj.$config) {
      configInstance = sol.create("sol.common.Config", { compose: configObj.$config, copy: !!copy, useGlobalCache: configObj.$useGlobalCache });
      if (!configInstance.validForMergeing()) {
        configInstance = sol.create("sol.common.Config", { load: configObj.$config, copy: !!copy, useGlobalCache: configObj.$useGlobalCache  }); // config is not in merge hierarchy -> reload in simple mode
      }
      config = configInstance.config;
    }

    // use only the property part of the loaded config
    if (config && configObj.$property) {
      config = me.extractConfigPart(config, configObj.$property);
    }

    if (!config) {
      config = {};
    }

    // copy remaining properties to config (override properties from the file)
    for (prop in configObj) {
      if (configObj.hasOwnProperty(prop) && (!sol.common.StringUtils.startsWith(prop, "$") || allProps)) {
        config[prop] = configObj[prop];
      }
    }

    configObj.config = config;

    return configObj;
  },

  /**
   * @private
   * Extracts a part of a bigger configuration object.
   * @param {Object} config The hole configuration object
   * @param {String} property The property (or path in dot notation), which holds the desired property part
   * @return {Object}
   */
  extractConfigPart: function (config, property) {
    var configPart = property.split(".").reduce(function (obj, key) {
      return obj[key];
    }, config);
    if (sol.common.ObjectUtils.isObject(configPart)) {
      return configPart;
    }
  },

  /**
   * Merge configuration
   * @param {Object|String} configuration A JavaScript Object, or a JSON String
   * @return {Object} merged configuration
   */
  mergeConfiguration: function (configuration) {
    var me = this;
    return me.parseConfiguration(configuration, true).config;
  }
});

