
importPackage(Packages.de.elo.ix.client.feed);

//@include lib_Class.js

/**
 * This class helps in creating simplified instances of de.elo.ix.client.*-objects like `Sord`. Simplified objects are
 * mostly used by sol.common.Template or sol.common.ix.functions.JsonDataCollector. Formatters are used by solutions if large
 * amounts of data are loaded from ELO or if properties needs to be accessible in templating environments.
 *
 * There are several formatter implementations for formatting objects e.g. `sol.common.ObjectFormatter.TemplateSord`.
 * Core formatting operations like objKey filtering, etc. is done by a base class
 * e.g. `sol.common.ObjectFormatter.BaseSord` which is the superclass of `TemplateSord` implementation.
 *
 *     var formattedObject = sol.common.ObjectFormatter.format({
 *       sord: {
 *         formatter: 'sol.common.ObjectFormatter.{FORMATTER CLASS NAME}',
 *         // original object returned by ix
 *         data: {IX OBJECT},
 *         config: {
 *           // formatter configuration as defined by the formatters base class
 *         }
 *     });
 *
 * Following list of Base classes can be used in order to process `Sords`, `Tasks` and keyword lists.
 *
 * - sol.common.ObjectFormatter.BaseSord
 * - sol.common.ObjectFormatter.BaseTask
 *
 * # Example usage by templates
 *
 * Templates can't access objKeys stored in array values in an easy way.
 *
 *     var data = sol.common.ObjectFormatter.format({
 *       sord: {
 *         formatter: 'sol.common.ObjectFormatter.TemplateSord',
 *         // instance of de.elo.ix.client.Sord
 *         data: sord
 *       }
 *     });
 *
 * The transformed object results as followed.
 *
 *     data = {
 *       "id": "7572",
 *       "maskName": "Incoming invoice",
 *       "name": "Invoice 0000",
 *       "IDateIso": "20150720142400",
 *       "XDateIso": "",
 *       "objKeys": {
 *         "VENDOR_NAME": "Weiler KG",
 *         "INVOICE_DATE": "20150601162415",
 *         "INVOICE_CASH_DISCOUNT_AMOUNT": 554
 *       }
 *     }
 *
 * # Example usage for statistical processing
 *
 * If working with large amounts of data it is mandatory to define the properties required for the data analys in order
 * to reduce the amount of data loaded from the client. IndexServer Sord-Objects contain a lot of information that might
 * not be required for the analysis. sol.common.ObjectFormatter.StatisticSord allows defining the sord keys, objKeys,
 * ... information that is required.
 *
 * Please note that using map keys is more expensive than storing values in objKeys since accessing these values requires
 * additional ix checkout calls. Furthermore objKeys can be converted to numeric values automatically.
 *
 * This functionality is used by services while collecting data for dashboard apps
 * developed in angular js.
 *
 *     var data = sol.common.ObjectFormatter.format({
 *       sord: {
 *         formatter: 'sol.common.ObjectFormatter.StatisticSord',
 *         // instance of de.elo.ix.client.Sord
 *         data: sord,
 *         config: {
 *           sordKeys: ['id', 'maskName', 'name', 'IDateIso', 'XDateIso'],
 *           objKeys: ['VENDOR_NAME', 'INVOICE_DATE', 'INVOICE_CASH_DISCOUNT_AMOUNT']
 *         }
 *     });
 *
 * The transformed object results as followed.
 *
 *     data = {
 *       "id": "7572",
 *       "maskName": "Incoming invoice",
 *       "name": "Invoice 0000",
 *       "IDateIso": "20150720142400",
 *       "XDateIso": "",
 *       "O_VENDOR_NAME": "Weiler KG",
 *       "O_INVOICE_DATE": "20150601162415",
 *       "O_INVOICE_CASH_DISCOUNT_AMOUNT": 554,
 *     }
 *
 *
 *
 * @author ELO Digital Office GmbH
 *
 * @eloix
 * @elojc
 * @eloas
 */
sol.define("sol.common.ObjectFormatter", {

  singleton: true,

  format: function (config) {
    var me = this, result = {},
        partName;
    config = config || {};
    for (partName in config) {
      me.formatPart(partName, config[partName], result);
    }
    return result;
  },

  /**
   * @private
   * @param {String} partName
   * @param {Object} configPart
   * @param {Object} result
   */
  formatPart: function (partName, configPart, result) {
    var formatter,
        data = configPart.data;

    if (data.getClass && data.getClass().isArray()) {
      data = Array.prototype.slice.call(data);
    }

    if (Array.isArray(data)) {
      result[partName] = [];
      data.forEach(function (dataPart) {
        formatter = sol.create(configPart.formatter, { data: dataPart, config: configPart.config });
        result[partName].push(formatter.build());
      });
    } else {
      formatter = sol.create(configPart.formatter, { data: configPart.data, config: configPart.config });
      result[partName] = formatter.build();
    }
  }
});

/**
 * Represents limited data of an de.elo.ix.client.Sord object.
 *
 * This class implements limiting objKeys, sord keys and map keys. Please refer to sub classes for more information on the
 * usage.
 *
 * @author Michael Weiler, ELO Digital Office GmbH
 * @author Nils Mosbach, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloix
 * @elojc
 * @eloas
 */
sol.define("sol.common.ObjectFormatter.BaseSord", {

  /**
   * @cfg {Array} sordKeys
   * Names of the properties that should be included.
   * The ID and the mask name are included by default.
   */
  sordKeys: ["guid", "id", "maskName"],

  /**
   * @cfg {Number} descMaxLen
   * Maximum length of the sord description
   */
  descMaxLen: undefined,

  /**
   * @cfg {Array} objKeys
   * Key names of the object keys that should be included.
   */
  objKeys: [],

  /**
   * @cfg {Boolean} hiddenObjKeys
   * Key names of the hidden object keys that should be included.
   */
  hiddenObjKeys: undefined,

  /**
   * @cfg {Array} mapKeys
   * Map field names of the map fields that should be included.
   */
  mapKeys: undefined,

  /**
   * @cfg {Array} wfMapKeys
   * Map field names of the workflow map fields that should be included.
   */
  wfMapKeys: undefined,

  /**
   * @cfg {Array} formBlobs
   * Form-Blob field names of the Form-Blob-fields that should be included.
   */
  formBlobs: undefined,

  /**
   * @cfg {Boolean} allObjKeys
   * Set to true if all objKeys should be included. objKeys[] configuration is ignored in this case.
   */
  allObjKeys: false,

  /**
   * @cfg {Boolean} allMapFields
   * Set to true if all map fields should be included. mapKeys[] configuration is ignored in this case.
   */
  allMapFields: false,

  /**
   * @cfg {Boolean} allFormBlobFields
   * Set to true if all Form-Blob fields should be included. formBlobs[] configuration is ignored in this case.
   */
  allFormBlobFields: false,

  /**
   * @cfg {String} objKeyPrefix
   * Defines a prefix for objKey field names.
   */
  objKeyPrefix: "",

  /**
   * @cfg {String} hiddenObjKeyPrefix
   * Defines a prefix for hidden objKey field names.
   */
  hiddenObjKeyPrefix: "",

  /**
   * @cfg {String} objKeyPrefix
   * Defines a prefix for mapKey field names.
   */
  mapKeyPrefix: "",

  /**
   * @cfg {String} formBlobPrefix
   * Defines a prefix for formBlob field names.
   */
  formBlobPrefix: "",

  /**
   * @private
   * @cfg {String} feedActions
   * This is an experimental feature. Don't rely on its existance.
   * Set to true if feed actions of this sord should be collected as well.
   */
  feedActions: false,

  /**
   * @private
   * @cfg {de.elo.ix.client.feed.EActionType[]} list of feed action types
   * This is an experimental feature. Don't rely on its existance.
   * Define a list of Feed Action types that should be returned.
   */
  feedActionTypes: [],

  /**
   * @private
   * @cfg {Number} maximum amount of actions that are read
   * This is an experimental feature. Don't rely on its existance.
   * The amount of feed actions that is returned by FindFirstActions.
   */
  feedActionsMax: 500,

  /**
   * @property {Boolean} flatObjStructure
   * Use a flat object structure. If true, objKeyPrefix and mapKeyPrefix must be set in order to prevent overriding sord keys.
   *
   * Default. flatObjStructure = false, objKeyPrefix ""
   *
   *     {
   *       name: "my invoice",
   *       objKeys: {
   *         INVOICE_NUMBER: "1234#2"
   *       }
   *     }
   *
   * Flat structure with objKeyPrefix "O_"
   *
   *     {
   *       name: "my invoice",
   *       O_INVOICE_NUMBER: "1234#2"
   *     }
   */
  flatObjStructure: false,

  pilcrow: "\u00b6",

  actionTypeMappings: {
    AutoComment: EActionType.AutoComment,
    Released: EActionType.Released,
    SordCreated: EActionType.SordCreated,
    UserComment: EActionType.UserComment,
    VersionCreated: EActionType.VersionCreated,
    WorkVersionCreated: EActionType.WorkVersionCreated,
    WorkVersionSwitched: EActionType.WorkVersionSwitched
  },

  initialize: function (params) {
    var me = this;

    me._cacheMaskObjKeys = {};

    me.$super("sol.Base", "initialize", [params.config]);

    if (me.sordKeys.length === 0) {
      me.sordKeys.push("id");
    }

    if (!me.objKeys) {
      me.objKeys = [];
    }

    me.sord = params.data;

    me.feedActionTypes = me.normalizeFeedActionTypes(me.feedActionTypes);
  },

  /**
   * Builds the base representation of the ELO object. This function is called by sol.common.ObjectFormatter#format
   * @param {de.elo.ix.client.Sord} originalSord
   * @return {Object} formattedSord
   */
  build: function (originalSord) {
    var me = this,
        sord, maskName, formattedSord;
    me.logger.enter("build", arguments);
    sord = originalSord || me.sord;
    maskName = String(sord.maskName);
    formattedSord = me.initialiseFormattedSord();

    // prepare cache for mask that allows fast iterations over required objKeys.
    me.buildCacheMaskObjKeys(maskName, sord.objKeys);

    me.applySordKeys(formattedSord, sord);
    me.applyObjKeys(formattedSord, maskName, sord.objKeys);
    me.applyMapData(formattedSord, sord);
    me.flowId && me.applyWfMapData(formattedSord, sord, me.flowId);
    me.applyFormBlobData(formattedSord, sord.id);
    me.applyFeedActions(formattedSord, sord);

    me.logger.exit("build", formattedSord);
    return formattedSord;
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {de.elo.ix.client.Sord} sord
   */
  applySordKeys: function (toObj, sord) {
    var me = this,
        key, value, i, length;

    for (i = 0, length = me.sordKeys.length; i < length; i++) {
      key = me.sordKeys[i];
      value = String(sord[key]);
      if ((key == "desc") && me.descMaxLen && value && (value.length > me.descMaxLen)) {
        value = value.substr(0, me.descMaxLen - 3) + "...";
      }
      toObj[key] = value;
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {String} maskName
   * @param {de.elo.ix.client.ObjKey[]} objKeys
   */
  applyObjKeys: function (toObj, maskName, objKeys) {
    var me = this,
        objKeyCache = me._cacheMaskObjKeys[maskName],
        objKey, i, length, dataArr,
        cachePos, objKeyName;

    for (i = 0, length = objKeyCache.length; i < length; i++) {
      cachePos = objKeyCache[i];
      if (cachePos && cachePos.arrPos < objKeys.length
          && objKeys[cachePos.arrPos].id === cachePos.id) {
        objKey = objKeys[cachePos.arrPos];
      } else {
        continue;
      }

      if (objKey) {
        dataArr = Array.prototype.slice.call(objKey.data);
        me.applyObjKey(toObj, me.objKeyPrefix, objKey.name, String(dataArr.join(me.pilcrow)));
      }
    }

    if (me.hiddenObjKeys) {
      for (i = objKeys.length - 1; i >= 0; i--) {
        objKey = objKeys[i];
        if (objKey.id < DocMaskLineC.MIN_ID_HIDDEN_VALUE) {
          break;
        }
        objKeyName = objKey.name + "";
        if (me.hiddenObjKeys.indexOf(objKeyName) > -1) {
          me.applyObjKey(toObj, me.hiddenObjKeyPrefix, objKey.name, String(dataArr.join(me.pilcrow)));
        }
      }
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {String} prefix
   * @param {String} key
   * @param {String} value
   */
  applyObjKey: function (toObj, prefix, key, value) {
    var me = this;
    if (me.flatObjStructure) {
      toObj[prefix + key] = value;
    } else {
      toObj.objKeys[prefix + key] = value;
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {de.elo.ix.client.Sord} sord
   */
  applyMapData: function (toObj, sord) {
    var me = this,
        keys = me.allMapFields ? null : me.mapKeys,
        mapItems, i, mapItem;

    if (me.allMapFields || me.mapKeys) {
      mapItems = ((me.asAdmin && typeof ixConnectAdmin !== "undefined" && ixConnectAdmin) || ixConnect).ix().checkoutMap(MapDomainC.DOMAIN_SORD, sord.id, keys, LockC.NO).items;
      for (i = 0; i < mapItems.length; i++) {
        mapItem = mapItems[i];
        me.applyMapKey(toObj, String(mapItem.key), String(mapItem.value));
      }
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} flowId
   */
  applyWfMapData: function (toObj, sord, flowId) {
    var me = this,
        keys = me.allMapFields ? null : me.wfMapKeys,
        mapItems, i, mapItem;

    if (me.allMapFields || me.wfMapKeys) {
      mapItems = ((me.asAdmin && typeof ixConnectAdmin !== "undefined" && ixConnectAdmin) || ixConnect).ix().checkoutMap(MapDomainC.DOMAIN_WORKFLOW_ACTIVE, flowId, keys, LockC.NO).items;
      for (i = 0; i < mapItems.length; i++) {
        mapItem = mapItems[i];
        me.applyWfMapKey(toObj, String(mapItem.key), String(mapItem.value));
      }
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {String} objId
   * @param {String} flowId
   */
  applyFormBlobData: function (toObj, objId) {
    var me = this,
        keys = me.allFormBlobFields ? null : me.formBlobs,
        blobItems, i, blobItem, binaryStream, str;

    if (me.allFormBlobFields || me.formBlobs) {
      blobItems = ((me.asAdmin && typeof ixConnectAdmin !== "undefined" && ixConnectAdmin) || ixConnect).ix().checkoutMap("formdata", objId, keys, LockC.NO).items;
      for (i = 0; i < blobItems.length; i++) {
        blobItem = blobItems[i];
        binaryStream = blobItem.getBlobValue().getStream();
        str = Packages.org.apache.commons.io.IOUtils.toString(binaryStream, java.nio.charset.StandardCharsets.UTF_8);
        binaryStream.close();
        me.applyFormBlobKey(toObj, String(blobItem.key), String(str));
      }
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {de.elo.ix.client.Sord} sord
   */
  applyFeedActions: function (toObj, sord) {
    var me = this;
    if (me.feedActions) {
      toObj.feedActions = JSON.parse(me.getFeedActionsJson(sord.guid));
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {String} key
   * @param {String} value
   */
  applyMapKey: function (toObj, key, value) {
    var me = this;
    if (me.flatObjStructure) {
      toObj[me.mapKeyPrefix + key] = value;
    } else {
      toObj.mapKeys[me.mapKeyPrefix + key] = value;
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {String} key
   * @param {String} value
   */
  applyWfMapKey: function (toObj, key, value) {
    var me = this;
    if (me.flatObjStructure) {
      toObj[me.mapKeyPrefix + key] = value;
    } else {
      toObj.wfMapKeys[me.mapKeyPrefix + key] = value;
    }
  },

  /**
   * @private
   * @param {Object} toObj
   * @param {String} key
   * @param {String} value
   */
  applyFormBlobKey: function (toObj, key, value) {
    var me = this;
    if (me.flatObjStructure) {
      toObj[me.formBlobPrefix + key] = value;
    } else {
      toObj.formBlobs[me.formBlobPrefix + key] = value;
    }
  },

  /**
   * Builds a cache for required objkeys. That allows reducing iteration times if thousands of sords are formatted.
   * @private
   * @param {String} maskName
   * @param {de.elo.ix.client.ObjKey[]} objKeys
   */
  buildCacheMaskObjKeys: function (maskName, objKeys) {
    var me = this,
        cache, i, objKey;
    if (!me._cacheMaskObjKeys.hasOwnProperty(maskName)) {
      cache = [];
      // iterate over all objKeys from the current sord
      for (i = 0; i < objKeys.length; i++) {
        objKey = objKeys[i];
        if (me.isValidObjKey(objKey)) {
          cache.push({
            id: objKey.id,
            arrPos: i
          });
        }
      }
      me._cacheMaskObjKeys[maskName] = cache;
    }
  },

  /**
   * checks if objKey should be applied to the formatted object.
   * @private
   * @param {de.elo.ix.client.ObjKey} sordObjKey
   * @return {Boolean} result
   */
  isValidObjKey: function (sordObjKey) {
    var me = this,
        i, length;

    if (sordObjKey.id < 0) {
      return false;
    }

    if (!me.allObjKeys) {
      for (i = 0, length = me.objKeys.length; i < length; i++) {
        if (sordObjKey.name == me.objKeys[i]) {
          return true;
        }
      }
    } else {
      return true;
    }
  },

  /**
   * @private
   * @return {Object} initial formattedSord
   */
  initialiseFormattedSord: function () {
    var me = this;

    return me.flatObjStructure ? {} : {
      objKeys: {},
      mapKeys: {},
      wfMapKeys: {},
      formBlobs: {}
    };
  },

  /**
   * Build JSON Data Structure. This function should only be used by the ELO Business Solutions team,
   * since API calls might change due to performance improvements!
   *
   * This function was designed to reduce processing times if huge amounts of data are collected by services.
   * Creation of objects and properties is more than 50 times slower than building the json result with a string buffer.
   *
   * Due to performance reasons, no map data is collected.
   *
   * @param {de.elo.ix.client.Sord} originalSord Index Server Sord object
   * @param {Object} mask (optional) Mask object created by e.g. Children data collector. Pass if
   * @param {Object} params (optional)
   * @param {String[]} params.dataAsString (optional) Contains the names of the fields, for which all values (not just the first) should be returned as pilcrow separated string
   * @param {String[]} params.dataAsArray (optional) Contains the names of the fields, for which all values (not just the first) should be returned as an array
   * @param {boolean} params.addSordTypeKind (optional) if set to true adds sord type kind (e.g. "REPOSITORY", "FOLDER", "DOCUMENT") to formattedSord
   * @return {Object}
   */
  buildJson: function (originalSord, mask, params) {
    var me = this,
        sord = originalSord || me.sord,
        maskName = sord.maskName,
        // generate json as string array
        formattedSord = [],
        key, i, length, lengthO, objKey, objKeyName,
        objKeyCache, addedObjKeys, value, cachePos,
        _result,
        alreadyContainsStartElement;

    // prepare cache for mask that allows fast iterations over required objKeys.
    me.buildCacheMaskObjKeys(maskName, sord.objKeys);

    formattedSord.push("{");

    if (me.shouldAddSordTypeKind(params)) {
      me.addSordTypeKind(formattedSord, sord);
      alreadyContainsStartElement = true;
    }

    if (me.sordKeys.length > 0 && alreadyContainsStartElement) {
      formattedSord.push(",");
    }

    // apply sordKeys
    for (i = 0, length = me.sordKeys.length; i < length; i++) {
      key = me.sordKeys[i];
      formattedSord.push('"');
      formattedSord.push(key);
      formattedSord.push('":');
      value = String(sord[key]);
      if ((key == "desc") && me.descMaxLen && value && (value.length > me.descMaxLen)) {
        value = value.substr(0, me.descMaxLen);
      }
      formattedSord.push(
        // set undefined to null
        sord[key] === undefined ? "null"
          : (
          // else: escape strings
            JSON.stringify(value)
          ));
      if (i != length - 1) {
        formattedSord.push(",");
      }
    }
    // < apply sordKeys

    // apply ObjKeys
    if (me.allObjKeys || (me.objKeys && me.objKeys.length > 0)) {

      objKeyCache = me._cacheMaskObjKeys[maskName];
      addedObjKeys = false;
      for (i = 0, lengthO = objKeyCache.length; i < lengthO; i++) {
        cachePos = objKeyCache[i];
        if (cachePos && cachePos.arrPos < sord.objKeys.length
            && sord.objKeys[cachePos.arrPos].id === cachePos.id) {
          objKey = sord.objKeys[cachePos.arrPos];
          me.addObjKeyJson(mask, params, formattedSord, addedObjKeys, me.objKeyPrefix, objKey);
          addedObjKeys = true;
        } else {
          continue;
        }
      }
    }

    if (me.hiddenObjKeys) {
      for (i = sord.objKeys.length - 1; i >= 0; i--) {
        objKey = sord.objKeys[i];
        if (objKey.id < DocMaskLineC.MIN_ID_HIDDEN_VALUE) {
          break;
        }
        objKeyName = objKey.name + "";
        if (me.hiddenObjKeys.indexOf(objKeyName) > -1) {
          me.addObjKeyJson(mask, params, formattedSord, addedObjKeys, me.hiddenObjKeyPrefix, objKey);
          addedObjKeys = true;
        }
      }
    }

    if (!me.flatObjStructure && addedObjKeys) {
      formattedSord.push("}");
    }

    // < apply sordKeys
    if (me.feedActions) {
      formattedSord.push(', "feedActions": ');
      formattedSord.push(me.getFeedActionsJson(sord.guid));
    }

    formattedSord.push("}");
    _result = formattedSord.join("");
    return _result;
  },

  addObjKeyJson: function (mask, params, formattedSord, addedObjKeys, objKeyPrefix, objKey) {
    var me = this,
        val, adjustValueFunction;

    if (objKey) {

      adjustValueFunction = function (value) {
        var field = mask ? mask.fields[objKey.name] : null;
        if (value === undefined || value === "" || value === null) {
          value = "null";
        } else if (field && field.type && (field.type.indexOf("NUMBER") === 0)) {
          if (value === "") {
            value = "null";
          }
          value = parseFloat(value.replace(",", ".")) || "null";
        } else {
          value = JSON.stringify(String(value));
        }
        return value;
      };

      if (addedObjKeys) {
        // add separators between objKeys
        formattedSord.push(",");
      } else {
      // add separators for objKey block
        formattedSord.push(",");
        if (!me.flatObjStructure) {
          formattedSord.push('"objKeys": {');
        }
      }
      formattedSord.push('"');
      formattedSord.push(objKeyPrefix + objKey.name);
      formattedSord.push('":');

      // adjust val
      if (params && params.dataAsString && (params.dataAsString.length > 0) && (params.dataAsString.indexOf(String(objKey.name)) !== -1)) {
        val = JSON.stringify(objKey.data.join(me.pilcrow));
      } else if (params && params.dataAsArray && (params.dataAsArray.length > 0) && (params.dataAsArray.indexOf(String(objKey.name)) !== -1)) {
        val = JSON.stringify(objKey.data.map(adjustValueFunction));
      } else {
        val = (objKey.data && (objKey.data.length > 0)) ? objKey.data[0] : "";
        val = adjustValueFunction(val);
      }
      // < adjust val

      formattedSord.push(val);
    }
  },

  /**
   * @param {String[]} formattedSord
   * @param {de.elo.ix.client.Sord} sord
   */
  addSordTypeKind: function (formattedSord, sord) {
    var me = this,
        value;

    formattedSord.push('"typeKind":');
    value = me.getSordTypeKind(String(sord["type"]));
    formattedSord.push(JSON.stringify(value) || "null");
  },


  /**
   * @param {Object} params
   * @returns {boolean} should set sord type kind
   */
  shouldAddSordTypeKind: function (params) {
    return (params || {}).addSordTypeKind;
  },

  /**
   * @param {Number} id
   * @returns {String}
   */
  getSordTypeKind: function (id) {
    if (id == "9999") {
      return "REPOSITORY";
    } else if (id < SordC.LBT_DOCUMENT) {
      return "FOLDER";
    } else if (id <= SordC.LBT_DOCUMENT_MAX) {
      return "DOCUMENT";
    }
    return "UNKNOWN";
  },

  /**
   * Reads the list of all actions for a given post.
   *
   * This is an experimental feature. Don't rely on its existence.
   * This feature should be used with care since this leads to performance issues if used within large datasets.
   * @private
   * @param {String} guid GUID
   * @returns {String} json array that contains all actions pre formatted as json.
   */
  getFeedActionsJson: function (guid) {
    var me = this,
        findInfo, findResult, o, i, action;
    try {
      findInfo = new FindActionsInfo();
      findInfo.objId = guid;
      findInfo.sordZ = SordC.mbOnlyGuid;
      findInfo.actionTypes = me.feedActionTypes || [];
      findResult = ixConnect.getFeedService().findFirstActions(findInfo, me.feedActionsMax, ActionC.mbAll);

      // using a string builder in order to speed up system performance
      o = ["["];
      for (i = 0; i < findResult.actions.length; i += 1) {
        action = findResult.actions[i];
        if (findInfo.actionTypes.length === 0 || findInfo.actionTypes.indexOf(action.type) !== -1) {
          if (o.length !== 1) {
            o.push(",");
          }
          o.push("{");
          o.push('"text": ');
          o.push(JSON.stringify(String(action.text)));
          o.push(', "userName": ');
          o.push(JSON.stringify(String(action.userName)));
          o.push(', "userId": ');
          o.push(action.userId);
          o.push(', "type": "');
          o.push(action.type);
          o.push('", "createDateIso": "');
          o.push(action.createDateIso);
          o.push('", "guid": "');
          o.push(action.guid);
          o.push('", "updateDateIso": "');
          o.push(action.updateDateIso);
          o.push('"');
          o.push("}");
        }
      }
      o.push("]");
      return o.join("");
    } catch (ex) {
      me.logger.error("reading feed comments failed.", ex);
      return "[]";
    }
  },

  /**
   * @private
   * If feed action types are defined as strings a mapping to EActionType is required.
   * @param {String[]|de.elo.ix.client.feed.EActionType[]} feedActionTypes
   * @return {de.elo.ix.client.feed.EActionType[]}
   */
  normalizeFeedActionTypes: function (feedActionTypes) {
    var me = this,
        normalizedTypes = [];

    if (feedActionTypes && (feedActionTypes.length > 0)) {
      feedActionTypes.forEach(function (type) {
        var typeEnum = (type instanceof EActionType) ? type : me.actionTypeMappings[type];
        if (typeEnum) {
          normalizedTypes.push(typeEnum);
        }
      });
    }

    return normalizedTypes;
  }

});

/**
 * Represents limited compact data of an ELO object for dashboards.
 *
 * If working with large amounts of data it is mandatory to define the properties required for the data analys in order
 * to reduce the amount of data loaded from the client. IndexServer Sord-Objects contain a lot of information that might
 * not be required for the analysis. sol.common.ObjectFormatter.StatisticSord allows defining the sord keys, objKeys,
 * ... information that is required.
 *
 * For more information on configuration properties please refer to sol.common.ObjectFormatter.BaseSord.
 *
 * This functionality is used by sol.common.ix.functions.ChildrenDataCollector while collecting data for dashboard apps
 * developed in angular js.
 *
 *     var data = sol.common.ObjectFormatter.format({
 *       sord: {
 *         formatter: 'sol.common.ObjectFormatter.StatisticSord',
 *         // instance of de.elo.ix.client.Sord
 *         data: sord,
 *         config: {
 *           sordKeys: ['id', 'maskName', 'name', 'IDateIso', 'XDateIso'],
 *           objKeys: ['VENDOR_NAME', 'INVOICE_DATE', 'INVOICE_CASH_DISCOUNT_AMOUNT']
 *         }
 *       }
 *     });
 *
 * The transformed object results as followed.
 *
 *     data = {
 *       "id": "7572",
 *       "maskName": "Incoming invoice",
 *       "name": "Invoice 0000",
 *       "IDateIso": "20150720142400",
 *       "XDateIso": "",
 *       "O_VENDOR_NAME": "Weiler KG",
 *       "O_INVOICE_DATE": "20150601162415",
 *       "O_INVOICE_CASH_DISCOUNT_AMOUNT": 554,
 *     }
 *
 * @author Michael Weiler, ELO Digital Office GmbH
 * @author Nils Mosbach, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloix
 * @elojc
 * @eloas
 */
sol.define("sol.common.ObjectFormatter.StatisticSord", {

  extend: "sol.common.ObjectFormatter.BaseSord",
  requiredProperties: ["sord"],

  flatObjStructure: true,
  objKeyPrefix: "O_",
  hiddenObjKeyPrefix: "H_",
  mapKeyPrefix: "M_"

});


/**
 * Represents limited compact data of an ELO object.
 *
 * This class includes all objKeys by default. For more information on configuration properties please refer to sol.common.ObjectFormatter.BaseSord.
 *
 * Templates can't access objKeys stored in array values in an easy way.
 *
 *     var data = sol.common.ObjectFormatter.format({
 *       sord: {
 *         formatter: 'sol.common.ObjectFormatter.TemplateSord',
 *         // instance of de.elo.ix.client.Sord
 *         data: sord
 *       }
 *     });
 *
 * The transformed object results as followed.
 *
 *     data = {
 *       "id": "7572",
 *       "maskName": "Incoming invoice",
 *       "name": "Invoice 0000",
 *       "IDateIso": "20150720142400",
 *       "XDateIso": "",
 *       "objKeys": {
 *         "VENDOR_NAME": "ELO Inc.",
 *         "INVOICE_DATE": "20150601162415",
 *         "INVOICE_CASH_DISCOUNT_AMOUNT": 554
 *       }
 *     }
 *
 * @author Michael Weiler, ELO Digital Office GmbH
 * @author Nils Mosbach, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloix
 * @elojc
 * @eloas
 */
sol.define("sol.common.ObjectFormatter.TemplateSord", {

  extend: "sol.common.ObjectFormatter.BaseSord",
  requiredProperties: ["sord"],

  sordKeys: ["guid", "id", "name", "maskName", "desc"],
  allObjKeys: true,
  allMapFields: false,
  allFormBlobFields: false,


  flatObjStructure: false,
  objKeyPrefix: "",
  mapKeyPrefix: ""

});

sol.define("sol.common.ObjectFormatter.WfMap", {

  extend: "sol.common.ObjectFormatter.BaseSord",
  requiredProperties: ["sord", "flowId"],

  sordKeys: ["guid", "id", "name", "maskName", "desc"],
  allObjKeys: true,
  allMapFields: false,
  allFormBlobFields: false,

  flatObjStructure: false,
  objKeyPrefix: "",
  mapKeyPrefix: ""

});


/**
 * Represents limited data of a task
 *
 * @author Michael Weiler, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloix
 * @elojc
 * @eloas
 */
sol.define("sol.common.ObjectFormatter.BaseTask", {

  requiredProperties: "task",

  /**
   * @cfg {String} formatter
   * Class name of the task formatter
   */

  /**
   * @cfg {Boolean} limitToSordList
   * True if the tasks should be limited to the Sord objects in the Sord list.
   */

  /**
   * @cfg {Array} wfKeys
   * Names of properties of the class WFCollectNode that should be included.
   */

  initialize: function (cfg) {
    var me = this;
    me.wfKeyMap = {};
    me.task = cfg.data;
    me.config = cfg.config || {};
  },

  /**
   * Builds the base representation of the task
   * @private
   * @param {Object} originalTask
   * @return {Object}
   */
  build: function (originalTask) {
    var me = this,
        key;
    if (originalTask) {
      me.task = originalTask;
    }
    me.getValues();
    me.element = { flowId: me.task.wfNode.flowId, nodeId: me.task.wfNode.nodeId };
    for (key in me.wfKeyMap) {
      me.element[key] = me.wfKeyMap[key].value;
    }
    return me.element;
  },

  /**
   * Retrieves the data of the ELO object from the original Java object
   * @private
   */
  getValues: function () {
    var me = this,
        key;
    me.prepareMaps();
    if (me.task.wfNode) {
      for (key in me.wfKeyMap) {
        me.wfKeyMap[key].value = String(me.task.wfNode[key]);
      }
    }
  },

  /**
   * Prepares JavaScript objects to gather the ELO object data
   * @private
   */
  prepareMaps: function () {
    var me = this;
    if (me.config.wfKeys) {
      me.config.wfKeys.forEach(function (key) {
        me.wfKeyMap[key] = { value: "" };
      });
    }
  }
});

/**
 * Represents limited compact data of an ELO object
 * for dashboards
 *
 * @author Michael Weiler, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloix
 * @elojc
 * @eloas
 */
sol.define("sol.common.ObjectFormatter.StatisticTask", {

  extend: "sol.common.ObjectFormatter.BaseTask"
});

/**
 * Represents limited compact data of an ELO object
 * for dashboards
 *
 * @author Michael Weiler, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloix
 *
 */
sol.define("sol.common.ObjectFormatter.TemplateTask", {

  extend: "sol.common.ObjectFormatter.BaseTask",

  initialize: function (cfg) {
    var me = this;
    me.$super("sol.common.ObjectFormatter.BaseTask", "initialize", [cfg]);
  },

  wfKeys: ["flowId", "flowName", "nodeId", "nodeName"]
});

/**
 * Represents limited data of a workflow collect node
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloix
 * @elojc
 * @eloas
 */
sol.define("sol.common.ObjectFormatter.BaseWfDiagramNode", {

  requiredProperties: ["flowId", "nodeId"],

  /**
   * @cfg {String} formatter
   * Class name of the task formatter
   */

  /**
   * @cfg {Array} wfKeys
   * Names of properties of the class WFDiagram that should be included.
   */

  /**
   * @cfg {Array} nodeKeys
   * Names of properties of the class WFNode that should be included.
   */

  initialize: function (cfg) {
    var me = this;
    me.wfDiagram = cfg.data;
    me.config = cfg.config || {};
    me.node = sol.common.WfUtils.getNode(me.wfDiagram, cfg.config.nodeId);
  },

  /**
   * Builds the base representation of the task
   *
   * @private
   * @return {Object} Node object
   * @return {String} return.flowId Flow ID
   * @return {String} return.flowName Flow name
   * @return {String} return.id Node ID
   * @return {String} return.name Node name
   */
  build: function () {
    var me = this;

    me.element = { flowId: String(me.config.flowId), id: String(me.config.nodeId) };

    if (me.wfDiagram) {
      me.element.flowName = String(me.wfDiagram.name);
    }

    if (me.node) {
      me.element.name = String(me.node.name);
    }

    return me.element;
  }
});

/**
 * Represents limited compact data of an ELO workflow diagram node
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloix
 *
 */
sol.define("sol.common.ObjectFormatter.TemplateWfDiagramNode", {

  extend: "sol.common.ObjectFormatter.BaseWfDiagramNode",

  initialize: function (cfg) {
    var me = this;
    me.$super("sol.common.ObjectFormatter.BaseWfDiagramNode", "initialize", [cfg]);
  }
});
