
importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js
//@include lib_sol.common.Cache.js
//@include lib_sol.common.StringUtils.js
//@include lib_sol.common.AclUtils.js
//@include lib_sol.common.JsonUtils.js
//@include lib_sol.common.ObjectFormatter.js

/**
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
 * This class contains convenience methods for working with Sord objects in server scripts.
 *
 * @author PZ, ELO Digital Office GmbH
 * @version 1.03.000
 *
 * @eloix
 * @eloas
 * @elojc
 *
 * @requires sol.common.Cache
 * @requires sol.common.StringUtils
 * @requires sol.common.ObjectFormatter
 */
sol.define("sol.common.SordUtils", {
  singleton: true,
  requires: ["sol.common.Cache"],

  pilcrow: "\u00b6",

  /**
   * @private
   * @property {sol.common.Cache} docMaskCache Cache for `de.elo.ix.client.DocMask`
   */

  initialize: function (config) {
    var me = this;
    me.$super("sol.Base", "initialize", [config]);
    me.docMaskCache = sol.create("sol.common.Cache");
  },

  /**
   * Checks, if an object is a de.elo.ix.client.Sord
   * @param {Object} sord
   * @return {Boolean}
   */
  isSord: function (sord) {
    return (sord instanceof Sord);
  },

  /**
   * Checks, if the index data (objKeys) is loaded
   * @param {de.elo.ix.client.Sord} sord
   * @return {Boolean}
   */
  isIndexdataLoaded: function (sord) {
    return sord && sord.objKeys && (sord.objKeys.length > 0);
  },

  /**
   * Checks, if a de.elo.ix.client.Sord is from type folder
   * @param {de.elo.ix.client.Sord} sord
   * @return {Boolean}
   */
  isFolder: function (sord) {
    return (sord.type < SordC.LBT_DOCUMENT);
  },

  /**
   * Checks, if a de.elo.ix.client.Sord is a dynamic folder.
   * @param {de.elo.ix.client.Sord} sord
   * @return {Boolean}
   */
  isDynamicFolder: function (sord) {
    var me = this,
        desc;
    if (!me.isFolder(sord)) {
      return false;
    }
    desc = sord.desc;
    return !sol.common.StringUtils.isBlank(desc) && (desc.matches("^![\+|\?|!].*"));
  },

  /**
   * Checks, if a de.elo.ix.client.Sord is from type document
   * @param {de.elo.ix.client.Sord} sord
   * @return {Boolean}
   */
  isDocument: function (sord) {
    return (sord.type >= SordC.LBT_DOCUMENT) && (sord.type <= SordC.LBT_DOCUMENT_MAX);
  },

  /**
   * Updates all of Sord attributes and ObjKeys.
   * Map Keys are not updated immediately, instead the function returns an Array with KeyValues, which can be checked in later.
   * @param {de.elo.ix.client.Sord} sord
   * @param {Object[]} data
   *
   *     {
   *       key: "name",
   *       type: "GRP", // SORD|GRP|MAP
   *       value: "hallo welt"
   *     }
   *
   * @param {Object} params Parameters
   * @param {Boolean} params.silent Silent
   * @returns {de.elo.ix.client.KeyValue[]}
   */
  updateSord: function (sord, data, params) {
    var me = this,
        mapEntries, result, dataString, paramsString;

    params = params || {};

    me.logger.enter("updateSord");

    if (me.logger.debugEnabled) {
      dataString = sol.common.JsonUtils.stringifyAll(data);
      paramsString = sol.common.JsonUtils.stringifyAll(params);
      me.logger.debug(["updateSord: data={0}, params={1}", dataString, paramsString]);
    }

    mapEntries = [];
    if (!me.isSord(sord) || !data) {
      me.logger.exit("updateSord");
      return;
    }

    if (!Array.isArray(data)) {
      throw "data has to be an Array";
    }

    data.forEach(function (entry) {
      if (!entry || !entry.type || !entry.key || entry.value === undefined || entry.value === null) {
        throw "illegal object: " + JSON.stringify(data);
      }
      switch (entry.type) {
        case "SORD":
          sord[entry.key] = entry.value;
          break;
        case "GRP":
          me.setObjKeyValue(sord, entry.key, entry.value, params);
          break;
        case "MAP":
          mapEntries.push(new KeyValue(entry.key, entry.value));
          break;
        default:
          throw "unsupported type: " + entry.type;
      }
    });

    result = (mapEntries.length > 0) ? mapEntries : null;
    me.logger.exit("updateSord", "mapEntries.length=" + mapEntries.length);
    return result;
  },

  /**
   * Updates a bunch of index data at once.
   * @param {de.elo.ix.client.Sord} sord
   * @param {Object} indexData Key-value-pairs with key=field and value=new value
   */
  updateKeywording: function (sord, indexData) {
    var me = this,
        property;

    me.logger.enter("updateKeywording", arguments);
    for (property in indexData) {
      if (indexData.hasOwnProperty(property)) {
        this.setObjKeyValue(sord, property, indexData[property]);
      }
    }
    me.logger.exit("updateKeywording");
  },

  /**
   * Checks if an ObjKey exists
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName
   * @returns {Boolean}
   */
  objKeyExists: function (sord, keyName) {
    return this.getObjKey(sord, keyName) !== null;
  },

  /**
   * Retrieves values from a Sord.
   * This could be a Sord property, an objKey, a map field or a form blob field.
   *
   * This can retrieve lists from `ObjKeys` and multiple map values.
   *
   *     {
   *       key: "FIELD_NAME",
   *       type: "GRP", // SORD|GRP|MAP
   *     }
   *
   *     {
   *       key: "INDEXED_MAP_FIELD*",
   *       type: "MAP", // SORD|GRP|MAP
   *     }
   *
   * @param {de.elo.ix.client.Sord} sord
   * @param {Object} params Parameter
   * @param {String} params.key Key
   * @param {String} params.type Type
   * @param {Number} params.maxLength Max length
   * @param {Number} params.fillString Fill string, e.g. `00000000000000`
   * @return {String[]} Can be null
   */
  getValues: function (sord, params) {
    var me = this,
        values = null,
        tmpValues, i, fieldDefString, value;

    if (!sord) {
      throw "Sord is empty";
    }
    if (!params || !params.type || !(params.key || params.value)) {
      fieldDefString = JSON.stringify(params);
      throw "Field definition is incomplete: fieldDef=" + fieldDefString;
    }

    switch (params.type) {
      case "SORD":
        if (sord[params.key]) {
          values = [String(sord[params.key])];
        }
        break;
      case "GRP":
        tmpValues = me.getObjKeyValues(sord, params.key);
        if (tmpValues && (tmpValues.length > 0)) {
          values = tmpValues;
        }
        break;
      case "MAP":
        tmpValues = ixConnect.ix().checkoutMap(MapDomainC.DOMAIN_SORD, sord.id, [params.key], LockC.NO).items;
        if (tmpValues && (tmpValues.length > 0)) {
          values = [];
          for (i = 0; i < tmpValues.length; i++) {
            values.push(String(tmpValues[i].value));
          }
        }
        break;
      case "SORDBLOB":
        value = me.getStringMapBlob({ mapDomain: MapDomainC.DOMAIN_SORD, mapId: sord.id, key: params.key });
        if (value) {
          values = [value];
        }
        break;
      case "FORMBLOB":
        value = me.getStringMapBlob({ mapDomain: "FORMDATA", mapId: sord.id, key: params.key });
        if (value) {
          values = [value];
        }
        break;
      case "CONST":
        if (params.value) {
          values = [String(params.value)];
        }
        break;
      default:
        throw "unsupported type: " + params.type;
    }

    if (values && (values.length > 0)) {

      if (params.maxLength) {
        for (i = 0; i < values.length; i++) {
          value = values[i] + "";
          value = (value.length > params.maxLength) ? value.substr(0, params.maxLength) : value;
          values[i] = value;
        }
      }

      if (params.fillString) {
        for (i = 0; i < values.length; i++) {
          value = values[i] + "";
          if (value.length < params.fillString.length) {
            value += params.fillString.substr(value.length);
          }
          values[i] = value;
        }
      }
    }

    return values;
  },

  /**
   * Returns an object map blob
   * @param {Object} params Parameters
   * @param {String} [params.mapDomain=MapDomainC.DOMAIN_SORD] Map domain
   * @param {String} params.mapId Map ID
   * @param {String} params.key Map key
   * @return {Object}
   */
  getObjectMapBlob: function (params) {
    var me = this,
        obj, str;

    params = params || {};

    str = me.getStringMapBlob(params);

    obj = JSON.parse(str);

    return obj;
  },

  /**
   * Returns a string map blob
   * @param {Object} params Parameters
   * @param {String} [params.mapDomain=MapDomainC.DOMAIN_SORD] Map domain
   * @param {String} params.mapId Map ID
   * @param {String} params.key Map key
   */
  getStringMapBlob: function (params) {
    var me = this,
        mapEntries, mapEntry, dataString;

    params = params || {};

    if (!params.mapId) {
      throw "Map ID is missing";
    }

    if (!params.key) {
      throw "Key is missing";
    }

    params.mapDomain = params.mapDomain || MapDomainC.DOMAIN_SORD;

    mapEntries = ixConnect.ix().checkoutMap(params.mapDomain, params.mapId, [params.key], LockC.NO).items;

    if (!mapEntries || (mapEntries.length == 0)) {
      return;
    }

    mapEntry = mapEntries[0];

    dataString = me.getBlobDataFromMapEntry(mapEntry);

    return dataString;
  },

  /**
   * Sets an object map blob
   * @param {Object} params Parameters
   * @param {String} params.mapId Map ID
   * @param {String} params.key Key
   * @param {Object} params.value Value
   * @param {String} [params.mapDomain=MapDomainC.DOMAIN_SORD] Map domain
   * @param {String} params.objId Object ID
   */
  setObjectMapBlob: function (params) {
    var me = this;

    params = params || {};

    params.value = JSON.stringify(params.value, 2);

    me.setStringMapBlob(params);
  },

  /**
   * Sets a string map blob
   * @param {Object} params Parameters
   * @param {String} params.mapId Map ID
   * @param {String} params.key Key
   * @param {String} params.value Value
   * @param {String} [params.mapDomain=MapDomainC.DOMAIN_SORD] Map domain
   * @param {String} params.objId Object ID
   */
  setStringMapBlob: function (params) {
    var me = this,
        stringMapBlob;

    params = params || {};

    if (!params.mapId) {
      throw "Map ID is missing";
    }

    if (!params.key) {
      throw "Map key is missing";
    }

    params.mapDomain = params.mapDomain || MapDomainC.DOMAIN_SORD;
    stringMapBlob = me.createStringMapBlob(params.key, params.value);

    if (!params.objId && (params.mapDomain == MapDomainC.DOMAIN_SORD)) {
      params.objId = params.mapId;
    }

    if (!params.objId) {
      throw "Object ID is empty";
    }

    ixConnect.ix().checkinMap(params.mapDomain, params.mapId, params.objId, [stringMapBlob], LockC.NO);
  },

  /**
   * Creates a string map blob
   * @param {String} key Key
   * @param {String} value Value
   * @return {de.elo.ix.client.MapValue} Map blob
   */
  createStringMapBlob: function (key, value) {
    var str, bytes, fileData, stringMapBlob;

    if (!key) {
      throw "Key is empty";
    }

    value = value || "";

    str = new java.lang.String(value);
    bytes = str.getBytes("UTF-8");

    fileData = new FileData("text/plain", bytes);
    stringMapBlob = new MapValue(key, fileData);

    return stringMapBlob;
  },

  /**
   * Retrieves a value from a Sord.
   * This could be a Sord property, an objKey or a map field.
   *
   * If there are more than one value, first value will be returned.
   *
   * Uses {@link #getValues}.
   *
   * @param {de.elo.ix.client.Sord} sord
   * @param {Object} params Parameter
   * @param {String} params.key Key
   * @param {String} params.type Type
   * @param {Number} params.fillString Fill string, e.g. `00000000000000`
   * @param {Number} params.maxLength Max length
   *
   *     {
   *       key: "name",
   *       type: "GRP", // SORD|GRP|MAP|FORMBLOB
   *     }
   *
   * @return {String}
   */
  getValue: function (sord, params) {
    var me = this,
        value = null,
        values;

    values = me.getValues(sord, params);

    if (values && (values.length > 0)) {
      value = values[0];
    }

    return value;
  },

  /**
   * Returns the ObjKey for a field
   * @param {de.elo.ix.client.Sord} sord
   * @param {string} keyName Name of the index field
   * @return {de.elo.ix.client.ObjKey} The ObjKey, or null if none was found
   */
  getObjKey: function (sord, keyName) {
    var keys, key, i;
    if (this.isSord(sord) && this.isIndexdataLoaded(sord) && keyName) {
      keys = sord.objKeys;
      for (i = 0; i < keys.length; i++) {
        key = keys[i];
        if (key.name == keyName) {
          return key;
        }
      }
    }
    return null;
  },

  /**
   * Returns the value of an ObjKey for a field
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName Name of the index field
   * @return {String} The field value
   */
  getObjKeyValue: function (sord, keyName) {
    var values = this.getObjKeyValues(sord, keyName);
    if (values) {
      return values[0];
    }
    return null;
  },

  /**
   * Returns the value of an ObjKey for a field as number.
   * The method takes care of wrong decimal separators.
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName Name of the index field
   * @param {Object} params Parameters
   * @param {Boolean} [params.throwException=false] Throw exception
   * @return {Number} The field value as number
   */
  getObjKeyValueAsNumber: function (sord, keyName, params) {
    var me = this,
        rawValue, validNumberFormat, message, stringValue, number;

    params = params || {};

    rawValue = me.getObjKeyValue(sord, keyName);

    if (rawValue == null) {
      me.logger.debug(["getObjKeyValueAsNumber: No values exist: sord.id={0}, sord.name={1}, keyName={2}", sord.id, sord.name, keyName]);
      return null;
    }

    rawValue += "";

    validNumberFormat = me.isValidNumberFormat(rawValue);

    if (!validNumberFormat) {
      message = me.logger.format(["getObjKeyValueAsNumber: Invalid number format: sord.id={0}, sord.name={1}, keyName={2}, rawValue={3}", sord.id, sord.name, keyName, rawValue]);
      if (params.throwException) {
        throw message;
      } else {
        me.logger.warn(message);
      }
    }

    stringValue = rawValue.replace(",", ".");

    number = parseFloat(stringValue);

    me.logger.debug(["getObjKeyValueAsNumber: sord.id={0}, sord.name={1}, keyName={2}, rawValue={3}, number={5}", sord.id, sord.name, keyName, rawValue, stringValue, number]);

    return number;
  },

  /**
   * Checks wether the numberString is a valid number
   * @param {String} numberString Number string
   * @return {Boolean} True if the string contains a valid number
   */
  isValidNumberFormat: function (numberString) {
    var valid;

    numberString = (numberString || "") + "";

    valid = /^-*\d*[.,]{0,1}\d*$/.test(numberString);

    return valid;
  },

  /**
   * Sets the value of an ObjKey for a field as number.
   * The method takes care of the decimal separator.
   *
   * Be carefull if using not the users IX connection to checkin the sord after using this method.
   * This could cause problems with the separator. Use additional `params.language` parameter where language is the ISO country code of the connection used to checkin the sord afterwards.
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName Name of the index field
   * @param {String} value Value
   * @param {Object} params (optional)
   * @param {String} params.language (optional) ISO language code to determine the decimal separator
   * @param {Boolean} [params.throwException=false] Throw exception
   * @param {de.elo.ix.client.IXConnection} params.conn IX connection
   */
  setObjKeyValueAsNumber: function (sord, keyName, value, params) {
    var me = this,
        validNumberFormat, stringValue, message, normalizedValue;

    params = params || {};
    stringValue = value + "";

    validNumberFormat = me.isValidNumberFormat(stringValue);

    if (!validNumberFormat) {
      message = me.logger.format(["setObjKeyValueAsNumber: Invalid number format: sord.id={0}, sord.name={1}, keyName={2}, value={3}, params={4}", sord.id, sord.name, keyName, value, JSON.stringify(params)]);
      if (params.throwException) {
        throw message;
      } else {
        me.logger.warn(message);
      }
    }

    normalizedValue = me.normalizeNumber(value, params.lang, params.conn);

    me.logger.debug(["setObjKeyValueAsNumber: sord.id={0}, sord.name={1}, keyName={2}, stringValue={3}, normalizedValue={4}", sord.id, sord.name, keyName, stringValue, normalizedValue]);
    me.setObjKeyValue(sord, keyName, normalizedValue);
  },

  /**
   * Increments the value of an ObjKey
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName Name of the index field
   * @return {Number} The field value as number
   */
  incObjKeyValue: function (sord, keyName) {
    var me = this,
        value;

    value = me.getObjKeyValueAsNumber(sord, keyName);
    value++;
    me.setObjKeyValueAsNumber(sord, keyName, value);

    return value;
  },

  /**
   * Decrements the value of an ObjKey
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName Name of the index field
   * @return {Number} The field value as number
   */
  decObjKeyValue: function (sord, keyName) {
    var me = this,
        value;

    value = me.getObjKeyValueAsNumber(sord, keyName);
    value--;
    if (value == 0) {
      me.setObjKeyValue(sord, keyName, value);
    } else {
      me.setObjKeyValueAsNumber(sord, keyName, value);
    }
    return value;
  },

  /**
   * Adjusts the decimal separator of a number
   * @param {String} value Value
   * @param {String} language ISO country code to determine the decimal separator
   * @param {de.elo.ix.client.IXConnection} conn IX connection
   * @return {String} normalized Number
   */
  normalizeNumber: function (value, language, conn) {
    var me = this,
        stringValue, groups, decimalSeparator, normalizedValue;

    stringValue = (value || "") + "";

    stringValue = stringValue.trim();

    groups = stringValue.match(/(^-?\d+)[\.|,](\d+$)/);

    decimalSeparator = (language) ? me.getDecimalSeparatorForLanguage(language) : me.getDecimalSeparatorForIx(conn);

    if (groups && (groups.length == 3)) {
      normalizedValue = groups[1] + decimalSeparator + groups[2];
    } else {
      normalizedValue = stringValue;
    }

    me.logger.debug(["normalizeNumber: value={0}, normalizedValue={1}", stringValue, normalizedValue]);

    return normalizedValue;
  },

  /**
   * Returns the decimal separator for the ELO index server
   * @param {de.elo.ix.client.IXConnection} conn IX connection
   * @returns {String}
   */
  getDecimalSeparatorForIx: function (conn) {
    var me = this,
        language, country, decimalSeparator, connectionUserName;

    conn = conn || ixConnect;

    language = conn.loginResult.clientInfo.language;
    country = conn.loginResult.clientInfo.country;

    decimalSeparator = me.getDecimalSeparatorForLanguage(language, country);

    connectionUserName = conn.loginResult.user.name;

    me.logger.debug(["getDecimalSeparatorForIX: connectionUserName={0}, language={1}, country={2}, decimalSeparator={3}", connectionUserName, language || "", country || "", decimalSeparator]);

    return decimalSeparator;
  },

  /**
   * Returns the decimal separator for a language
   * @param {String} language ISO language code to determine the decimal separator
   * @param {String} country ISO country code to determine the decimal separator
   * @returns {String}
   */
  getDecimalSeparatorForLanguage: function (language, country) {
    var decimalSeparatorChar, decimalSeparator;

    decimalSeparatorChar = new java.text.DecimalFormatSymbols(new java.util.Locale(language, country)).decimalSeparator;
    decimalSeparator = String(java.lang.Character.toString(decimalSeparatorChar));

    return decimalSeparator;
  },

  /**
   * Returns the values of an ObjKey for a field as array
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName Name of the index field
   * @return {String[]} The field values
   */
  getObjKeyValues: function (sord, keyName) {
    var me = this,
        key, values, i, value;

    key = me.getObjKey(sord, keyName);

    if (key && key.data) {
      for (i = 0; i < key.data.length; i++) {
        value = key.data[i];
        if (typeof value != "undefined") {
          values = values || [];
          values.push(String(value));
        }
      }
    }

    return values;
  },

  /**
   *
   * Sets the value of an ObjKey for a field
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName Name of the index field
   * @param {String|String[]} value could be a multi index string (e.g. a¶b¶c). In this case the value will convert to an array before each item is set
   * @param {Object} params Parameters
   * @param {Boolean} params.silent Silent
   * @return {de.elo.ix.client.ObjKey} The changed ObjKey
   */
  setObjKeyValue: function (sord, keyName, value, params) {

    var me = this;

    if (!Array.isArray(value)) {
      value = (value == undefined)
        ? [""]
        : String(value)
            .split(me.pilcrow)
            .filter(function (el) {
              return el.trim();
            });
    }
    return this.setObjKeyValues(sord, keyName, value, params);
  },

  /**
   * Sets the values of an ObjKey for a field
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} keyName Name of the index field
   * @param {String[]} values
   * @param {Object} params Parameters
   * @param {Boolean} params.silent Silent
   * @return {de.elo.ix.client.ObjKey} The changed ObjKey
   */
  setObjKeyValues: function (sord, keyName, values, params) {
    var me = this,
        newObjKey, objKeys, line, key, i, value;

    params = params || {};

    if (!sord) {
      throw "Sord is missing";
    }

    if (!keyName) {
      throw "Object key name is empty";
    }

    values = values || [""];

    if (params.fillString) {
      for (i = 0; i < values.length; i++) {
        value = values[i] + "";
        if (value.length < params.fillString.length) {
          value += params.fillString.substr(value.length);
        }
        values[i] = value;
      }
    }

    key = this.getObjKey(sord, keyName);
    if (key) {
      key.data = values;
    } else {

      // in some cases objKey array doesn't match mask definition.
      line = me.getDocMaskLine(sord.mask, keyName) || me.getHiddenLine(keyName);
      if (line) {
        me.logger.debug("ObjKey '" + keyName + "' does not exist. Adding ObjKey to list.");
        newObjKey = new ObjKey();
        newObjKey.id = line.id;
        newObjKey.name = keyName;
        newObjKey.data = values;
        objKeys = Array.prototype.slice.call(sord.objKeys);
        objKeys.push(newObjKey);
        sord.objKeys = objKeys;
        key = newObjKey;
      } else {
        if (!params.silent) {
          throw "ObjKey '" + keyName + "' not found.";
        }
        return;
      }
    }
    return key;
  },

  /**
   * Retrieves (and caches) the definition of document masks by their name
   * @param {String} name
   * @param {String} language
   * @returns {de.elo.ix.client.DocMask} mask
   */
  getDocMask: function (name, language) {
    var me = this,
        languageCache, _result;

    me.logger.enter("getDocMask", { name: name, language: language });

    if (!name && (name !== 0)) { // Issue BS-799: second check is for the special case if some of our scripts call this function with an integer (which can be zero)
      throw "Document mask name is empty";
    }

    language = language || ixConnect.loginResult.clientInfo.language;

    if (!me.docMaskCache.containsKey(language)) {
      me.docMaskCache.put(language, sol.create("sol.common.Cache"));
    }

    languageCache = me.docMaskCache.get(language);

    if (!languageCache.containsKey(name)) {
      languageCache.put(name, ixConnect.ix().checkoutDocMask(name + "", DocMaskC.mbAll, LockC.NO));
    }

    _result = languageCache.get(name);
    me.logger.exit("getDocMask", _result + "");
    return _result;
  },

  /**
   * Reads document mask names
   * @param {Object} params Parameters
   * @param {Object} params.allMasks if true, return all docmasks
   * @param {Object} params.filters Filters
   * @param {String} params.filters.nameTranslationKeyPrefix Name translation key prefix filter
   * @return {de.elo.ix.client.MaskName[]}
   */
  getDocMaskNames: function (params) {
    var maskNames = [],
        editInfoZ, editInfo, i, maskName;

    params = params || {};

    editInfoZ = new EditInfoZ(EditInfoC.mbMaskNames, new SordZ());
    editInfo = ixConnect.ix().createSord(params.allMasks === true ? null : "1", "", editInfoZ);
    for (i = 0; i < editInfo.maskNames.length; i++) {
      maskName = editInfo.maskNames[i];
      if (params.filters) {
        if (params.filters.nameTranslationKeyPrefix) {
          if (String(maskName.nameTranslationKey).indexOf(params.filters.nameTranslationKeyPrefix) == 0) {
            maskNames.push(maskName);
          }
        }
      } else {
        maskNames.push(maskName);
      }
    }
    return maskNames;
  },

  /**
   * Returns the GUID of a doc mask
   * @param {String} name Doc mask name
   * @returns {String} GUID
   */
  getDocMaskGuid: function (name) {
    var me = this,
        docMask;
    docMask = me.getDocMask(name);
    return docMask ? String(docMask.guid) : "";
  },

  /**
   * Checks, if a sord has the specified mask
   * @param {de.elo.ix.client.Sord} sord
   * @param {String} maskName The original mask name
   * @return {Boolean}
   */
  hasDocMask: function (sord, maskName) {
    var me = this,
        docMask;
    if (!me.isSord(sord) || !maskName) {
      return false;
    }
    docMask = me.getDocMask(maskName);
    return sord && (sord.mask === docMask.id);
  },

  /**
   * Gets the field information of a specific mask field
   * @param {String} maskName Name of the mask
   * @param {String} fieldName Name of the field
   * @return {de.elo.ix.client.DocMaskLine}
   */
  getDocMaskLine: function (maskName, fieldName) {
    var me = this,
        docMask, i, line;

    docMask = me.getDocMask(maskName);

    for (i = 0; i < docMask.lines.length; i++) {
      line = docMask.lines[i];
      if (line.key == fieldName) {
        return line;
      }
    }
  },

  /**
   * @private
   * Returns an hidden line object
   * @param {String} keyName Key name
   * @return {Objekt} line Line
   * @return {String} line.id Line ID
   * @return {String} line.name Key name
   */
  getHiddenLine: function (keyName) {
    var me = this,
        hiddenLine;

    if (!me.hiddenLines) {
      me.hiddenLines = {};
      me.hiddenLines[DocMaskLineC.NAME_FILENAME + ""] = { id: DocMaskLineC.ID_FILENAME + "", name: DocMaskLineC.NAME_FILENAME };
      me.hiddenLineExists("NAME_LINK") && (me.hiddenLines[DocMaskLineC.NAME_LINK + ""] = { id: DocMaskLineC.ID_LINK + "", name: DocMaskLineC.NAME_LINK });
      me.hiddenLineExists("NAME_MAINSCALE") && (me.hiddenLines[DocMaskLineC.NAME_MAINSCALE + ""] = { id: DocMaskLineC.ID_MAINSCALE + "", name: DocMaskLineC.NAME_MAINSCALE });
      me.hiddenLineExists("NAME_PERSONALDATA_DELETEAT") && (me.hiddenLines[DocMaskLineC.NAME_PERSONALDATA_DELETEAT + ""] = { id: DocMaskLineC.ID_PERSONALDATA_DELETEAT + "", name: DocMaskLineC.NAME_PERSONALDATA_DELETEAT });
      me.hiddenLineExists("NAME_PERSONALDATA_UID") && (me.hiddenLines[DocMaskLineC.NAME_PERSONALDATA_UID + ""] = { id: DocMaskLineC.ID_PERSONALDATA_UID + "", name: DocMaskLineC.NAME_PERSONALDATA_UID });
    }

    hiddenLine = me.hiddenLines[keyName];

    return hiddenLine;
  },

  /**
   * Checks if a hidden line exists
   * @param {String} constantName Constant name
   */
  hiddenLineExists: function (constantName) {
    var docMaskLineC, docMaskLineCClass, fields, i, field;

    docMaskLineC = new DocMaskLineC();
    docMaskLineCClass = docMaskLineC.getClass();

    fields = docMaskLineCClass.getDeclaredFields();

    for (i = 0; i < fields.length; i++) {
      field = fields[i];
      if (field.name == constantName) {
        return true;
      }
    }

    return false;
  },

  /**
   * Checks wether a mask exists
   * @param {String} maskName
   * @return {Boolean}
   */
  docMaskExists: function (maskName) {
    if (!maskName) {
      throw "Mask name is empty";
    }
    try {
      ixConnect.ix().checkoutDocMask(maskName + "", DocMaskC.mbAll, LockC.NO);
      return true;
    } catch (ex) {
      return false;
    }
  },

  /**
   * Retrieves values from a dynamic keyword list.
   *
   * Returns the values from the KWL associated with the REMINDER_PERIOD_UNIT field
   *
   *     sol.common.SordUtils.getDynamicKeywordlistValue("Contract", "REMINDER_PERIOD_UNIT");
   *
   * Returns the values from the KWL associated with the REMINDER_PERIOD_UNIT field and containing the string 'month'
   *
   *     sol.common.SordUtils.getDynamicKeywordlistValue("Contract", "REMINDER_PERIOD_UNIT", { data: "month" });
   *
   * Returns the values from the KWL associated with the REMINDER_PERIOD_UNIT field and the data from column 2
   *
   *     sol.common.SordUtils.getDynamicKeywordlistValue("Contract", "REMINDER_PERIOD_UNIT", { returnColumn: 2 });
   *
   * Returns the values from the KWL associated with the REMINDER_PERIOD_UNIT field and the data from column 2 filtering only thoase containing 'M' in column 1
   *
   *     sol.common.SordUtils.getDynamicKeywordlistValue("Contract", "REMINDER_PERIOD_UNIT", { data: "M", filterColumn: 0, returnColumn: 2 });
   *
   * @param {String} maskName The mask name used to determine the dynamic keyword list
   * @param {String} key The field which has the dynamic keyword list
   * @param {Object} params (optional)
   * @param {String} params.data (optional) lookup data (used to filter the result on the serverside, if supported by the KWL, or on clientside, if `returnColumn` and `filterColumn` are defined)
   * @param {Number} params.returnColumn (optional) If set, the content of this column will be returned
   * @param {Number} params.filterColumn (optional) If set (in addition to a return column), the result will be filtered on the clientside on the KWL column with this index (using `params.data`)
   * @return {String[]}
   */
  getDynamicKeywordlistValue: function (maskName, key, params) {
    var me = this,
        keywordsDynamicInfo = new KeywordsDynamicInfo(),
        sord = new Sord(),
        objKey = new ObjKey(), foreignObjKey = new ObjKey(),
        result = [], objKeys = [],
        columnMode = (params && (typeof params.returnColumn === "number")),
        docMaskLine, keywordsResult, i, max, keyIndex;

    key = new java.lang.String(key);

    objKey.name = key;
    objKey.data = (params && params.data && (typeof params.filterColumn !== "number")) ? [params.data] : [];
    objKeys.push(objKey);

    if (params && params.useForeignKey && (params.useForeignKey.key && params.useForeignKey.value)) {
      foreignObjKey.name = params.useForeignKey.key;
      foreignObjKey.data = [params.useForeignKey.value];
      objKeys.push(foreignObjKey);
    }

    sord.objKeys = objKeys;


    docMaskLine = me.getDocMaskLine(maskName, key);

    if (!docMaskLine) {
      throw "Can't find document mask line: maskName=" + maskName + ", key=" + key;
    }

    keywordsDynamicInfo.sord = sord;
    keywordsDynamicInfo.maskLineFocus = docMaskLine;

    keywordsResult = ixConnect.ix().checkoutKeywordsDynamic(keywordsDynamicInfo);

    if (columnMode) {
      keyIndex = params.returnColumn;
    } else {
      for (i = 0, max = keywordsResult.keyNames.size(); i < max; i++) {
        if (keywordsResult.keyNames.get(i).equals(key)) {
          keyIndex = i;
          break;
        }
      }
    }

    for (i = 0, max = keywordsResult.table.size(); i < max; i++) {
      if (!columnMode || !params.data || (typeof params.filterColumn !== "number") || (sol.common.StringUtils.startsWith(keywordsResult.table.get(i).get(params.filterColumn) + "", params.data))) {
        result.push(keywordsResult.table.get(i).get(keyIndex) + "");
      }
    }

    return result;
  },

  /**
   * Returns the key of a localized keyword list entry
   * @param {de.elo.ix.client.Sord} sord
   * @param {Object} fieldDef Field definition
   * @param {Object} config Configuration
   * @param {String} config.localizedKwlSeparator Localized keyword list separator
   * @return {String}
   */
  getLocalizedKwlKey: function (sord, fieldDef, config) {
    var me = this,
        value, separator, separatorPos;
    if (!sord) {
      throw "Sord is empty";
    }
    if (!fieldDef) {
      throw "Field definition is empty";
    }

    config = config || {};
    separator = config.localizedKwlSeparator || "-";

    value = String(me.getValue(sord, fieldDef));

    separatorPos = value.indexOf(separator);
    if (separatorPos < 0) {
      return value;
    }
    return value.substring(0, separatorPos).trim();
  },

  /**
   * Returns the localized kwl entry
   * @param {String} key Key
   * @param {Object} config Configuration
   * @param {String} config.scriptName Script name
   * @return {String}
   */
  getLocalizedKwlEntry: function (key, config) {
    var keywordsDynamicInfo, keywordsResult, entry;

    if (!key) {
      throw "Key is empty";
    }

    config = config || {};

    if (!config.localizedKwlScript) {
      throw "Localized keyword list script name is emtpy";
    }

    keywordsDynamicInfo = new KeywordsDynamicInfo();
    keywordsDynamicInfo.mapData = { $KEY: key };
    keywordsDynamicInfo.mapLineFocus = "$KEY";
    keywordsDynamicInfo.mapScriptName = config.localizedKwlScript;

    keywordsResult = ixConnect.ix().checkoutKeywordsDynamic(keywordsDynamicInfo);

    if (keywordsResult.table.size() != 1) {
      return "";
    }

    entry = String(keywordsResult.table.get(0).get(2));

    return entry;
  },

  /**
   * Creates a template sord from a Sord (see {@link sol.common.ObjectFormatter.TemplateSord TemplateSord}).
   *
   * @param {de.elo.ix.client.Sord} sord
   * @return {Object} templateSord structure, if sord is null then return undefined
   */
  getTemplateSord: function (sord) {
    var me = this,
        templateSord;

    if (!sord) {
      return;
    }

    me.logger.enter("getTemplateSord", arguments);
    templateSord = sol.common.ObjectFormatter.format({
      sord: {
        formatter: "sol.common.ObjectFormatter.TemplateSord",
        data: sord,
        config: {
          sordKeys: ["id", "guid", "maskName", "name", "desc", "IDateIso", "XDateIso", "ownerName"],
          allMapFields: true
        }
      }
    });
    me.logger.exit("getTemplateSord");
    return templateSord;
  },

  /**
   * Creates a statistic sord from a Sord (see {@link sol.common.ObjectFormatter.StatisticSord StatisticSord}).
   * @param {de.elo.ix.client.Sord} sord
   * @return {Object}
   */
  getStatisticSord: function (sord) {
    var me = this,
        statisticSord;

    me.logger.enter("getStatisticSord", arguments);
    statisticSord = sol.common.ObjectFormatter.format({
      sord: {
        formatter: "sol.common.ObjectFormatter.StatisticSord",
        data: sord,
        config: {
          sordKeys: ["id", "guid", "maskName", "name", "desc", "IDateIso", "XDateIso", "ownerName"],
          objKeys: ["VENDOR_NAME", "INVOICE_DATE", "INVOICE_CASH_DISCOUNT_AMOUNT"]
        }
      }
    });
    me.logger.exit("getStatisticSord");
    return statisticSord;
  },

  /**
   * Returns the display repository path
   * @param {de.elo.ix.client.Sord} sord
   * @param {Object} params Parameters
   * @param {String} [params.separator="/"] Separator
   * @param {Boolean} [params.withName=true] If true the name of the Sord will be appended
   * @return {String}
   */
  getDisplayRepoPath: function (sord, params) {
    var me = this,
        displayRepoPath;

    if (!sord) {
      throw "Sord is empty";
    }
    if (!sord.refPaths) {
      throw "Property 'sord.refPaths is empty'";
    }

    params = params || {};
    params.separator = params.separator || "/";
    params.withName = (typeof params.withName == "undefined") ? true : params.withName;

    displayRepoPath = sord.refPaths[0].pathAsString;
    displayRepoPath = sol.common.StringUtils.replaceAll(displayRepoPath, me.pilcrow, params.separator);
    if (params.withName) {
      displayRepoPath += params.separator + sord.name;
    }

    return displayRepoPath;
  },

  /**
   * Creates a Sord
   *
   * Backward-comptabilility added for createSord(maskId, params)
   *
   * @param {Object} params Parameters
   * @param {String} params.mask Mask
   * @param {String} params.name Name
   * @param {String} [params.parentId="1"] Parent ID
   * @param {String} params.sortOrder Sort order
   * @param {String} params.documentContainer Container document
   * @return {de.elo.ix.client.Sord} Sord
   */
  createSord: function (params) {
    var sord;
    params = params || {};

    // backward-compatibility
    if (arguments.length == 2) {
      params = arguments[1];
      params.mask = {
        mask: arguments[0]
      };
    }

    if (!params.mask) {
      throw "Mask ID is empty";
    }
    params.parentId = params.parentId || "1";
    sord = ixConnect.ix().createSord(params.parentId, params.mask, EditInfoC.mbSord).sord;

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

  /**
   * Clones a sord.
   * @param {de.elo.ix.client.Sord} srcSord Source sord
   * @param {Object} params (optional) Parameters
   * @param {de.elo.ix.client.Sord} params.dstSord (optional) Destination sord
   * @param {String} params.dstMask (optional) Destination mask
   * @param {de.elo.ix.client.Sord} params.dstParentId (optional) Destination parent ID. Hint: parameter is mandatory if no `dstSord` is configured
   * @param {String[]} [params.memberNames=["name"]] (optional) Member names to copy
   * @param {String[]} params.detailMemberNames (optional) Detail member names to copy, e.g. `sortOrder`
   * @param {String[]} params.objKeyNames (optional) Object key names to copy
   * @param {Boolean} [params.inheritDestinationAcl=false] (optional) If `true` (and the target is a sord) the ACL of the target will be inherited to the cloned sord. Hint: to copy the ACL of the source sord use member `aclItems` (but `inheritDestinationAcl` has priority).
   * @param {String} params.spaceGuid (optional) Space GUID
   * @return {de.elo.ix.client.Sord} Sord
   */
  cloneSord: function (srcSord, params) {
    var me = this,
        dstSord, dstMask, memberName, detailMemberName, now, i, parentSord, objKey, objKeyName, values, conn;

    if (!srcSord) {
      throw "Source Sord is emtpy";
    }

    params = params || {};
    params.memberNames = params.memberNames || ["name"];

    conn = params.conn || ixConnect;

    if (params.dstSord) {
      dstSord = new Sord(params.dstSord);
      dstSord.id = -1;
      dstSord.guid = "";
      dstSord.ownerId = ixConnect.loginResult.user.id;
      dstSord.ownerName = "";
      now = me.nowIsoForConnection(conn);
      dstSord.IDateIso = now;
      dstSord.XDateIso = now;
    } else {
      dstMask = params.dstMask || srcSord.mask;
      dstSord = me.createSord({ mask: dstMask, parentId: params.dstParentId });
    }

    for (i = 0; i < params.memberNames.length; i++) {
      memberName = params.memberNames[i];
      dstSord[memberName] = srcSord[memberName];
    }

    if (params.detailMemberNames) {
      for (i = 0; i < params.detailMemberNames.length; i++) {
        detailMemberName = params.detailMemberNames[i];
        dstSord.details[detailMemberName] = srcSord.details[detailMemberName];
      }
    }

    if (params.dstParentId) {
      if (params.dstParentId != "0") {
        parentSord = ixConnect.ix().checkoutSord(params.dstParentId, SordC.mbMin, LockC.NO);
        if (params.inheritDestinationAcl) {
          dstSord.aclItems = parentSord.aclItems;
        }
      }
      dstSord.parentId = (parentSord) ? parentSord.id : "0";
    }

    if (!params.objKeyNames || (params.objKeyNames.length > 0)) {
      for (i = 0; i < dstSord.objKeys.length; i++) {
        objKey = dstSord.objKeys[i];
        objKeyName = String(objKey.name);
        if (objKeyName == "" || (params.objKeyNames && (params.objKeyNames.indexOf(objKeyName) < 0))) {
          continue;
        }
        if (objKeyName != "") {
          values = me.getObjKeyValues(srcSord, objKeyName);
          me.setObjKeyValues(dstSord, objKeyName, values);
        }
      }
    }

    if (params.spaceGuid) {
      dstSord.spaceGuid = params.spaceGuid;
    }

    return dstSord;
  },

  /**
   * Adds rights
   * @param {de.elo.ix.client.Sord} sord Sord
   * @param {Object} params Parameters
   * @param {Array} params.users Users
   * @param {Object} params.rigths Rights, e.g. { r: true, w: true, d: true, e: true, l: true }
   */
  addRights: function (sord, params) {
    var accessCode, users, userAcls, newAclItems;

    if (!params) {
      throw "Rights configuration is empty";
    }
    if (!params.users) {
      throw "Users are empty";
    }

    params = params || {};

    users = params.users.map(function (userName) {
      if (userName == "$CURRENTUSER") {
        return String(ixConnect.loginResult.user.name);
      }
      return userName;
    });

    params.rights = params.rights || { r: true, w: true, d: true, e: true, l: true, p: true };

    accessCode = sol.common.AclUtils.createAccessCode(params.rights);
    userAcls = sol.common.AclUtils.retrieveUserAcl(users, accessCode);
    if (userAcls) {
      newAclItems = Array.prototype.slice.call(sord.aclItems);
      userAcls.forEach(function (userAcl) {
        newAclItems.push(userAcl);
      });
    }
    sord.aclItems = newAclItems;
  },

  /**
   * Changes the sord mask
   * @param {de.elo.ix.client.Sord} sord Sord
   * @param {Number|String} newMask New mask ID or name
   * @param {de.elo.ix.client.IXConnection} ixConnection (optional) contains the given IX-Connection
   * @return {de.elo.ix.client.Sord}
   */
  changeMask: function (sord, newMask, ixConnection) {
    var me = this,
        myConnection = ixConnection || ixConnect,
        changedSord;

    if (!sord) {
      throw "Sord is empty";
    }

    if (typeof newMask == "undefined") {
      throw "New mask is empty";
    }

    changedSord = myConnection.ix().changeSordMask(sord, newMask, EditInfoC.mbSord).sord;

    me.logger.debug(["conn.username={0}, changedSord={1}", myConnection.loginResult.user.name, changedSord.name]);


    return changedSord;
  },

  /**
   * Get links
   * @param {de.elo.ix.client.Sord} sord Sord
   * @return {Array} Object IDs
   */
  getLinks: function (sord) {
    var i,
        linksObj = {},
        links = [],
        objId;

    if (!sord) {
      throw "Sord is empty";
    }

    for (i = 0; i < sord.linksComeIn.length; i++) {
      linksObj[sord.linksComeIn[i].id + ""] = 1;
    }

    for (i = 0; i < sord.linksGoOut.length; i++) {
      linksObj[sord.linksGoOut[i].id + ""] = 1;
    }

    for (objId in linksObj) {
      links.push(objId);
    }

    return links;
  },

  /**
   * Returns now as ISO date considering the time zone
   * @param {de.elo.ix.client.IXConnection} [conn=ixConnect]
   * @param {Object} params Parameters
   * @param {Boolean} [params.startOfDay=false] (optional) Start of day
   * @return {String} ISO date
   */
  nowIsoForConnection: function (conn, params) {
    var me = this,
        nowIso, timeZone;
    conn = conn || ixConnect;
    params = params || {};
    timeZone = conn.loginResult.clientInfo.timeZone + "";
    params.utcOffset = me.getTimeZoneOffset(timeZone);
    nowIso = sol.common.DateUtils.nowIso(params);
    return nowIso;
  },

  /**
   * @private
   * Gets the time zone offset
   * @param {String} timeZoneString Time zone string
   * @return {String} Offset
   */
  getTimeZoneOffset: function (timeZoneString) {
    var timeZone, utcOffset, now;
    timeZone = java.util.TimeZone.getTimeZone(timeZoneString);
    now = new java.util.Date();
    utcOffset = timeZone.getOffset(now.time) / 1000 / 60;
    return utcOffset;
  },

  /**
   * Returns the field name index
   * @param {String} fieldName Field name
   * @returns {String}
   */
  getFieldNameIndex: function (fieldName) {
    if (!fieldName) {
      return "";
    }
    var pos = fieldName.search(/\d+$/);
    if (pos > 0) {
      return parseInt(fieldName.substring(pos), 10);
    }
    return "";
  },

  /**
   * Returns the ESW content
   * @param {String} objId Object ID
   * @param {String} params Parameters
   * @param {Object} params.timeZone Timezone, e.g. `GMT`
   * @return {String} ESW content
   */
  getEsw: function (objId, params) {
    var savedTimeZone,
        editInfo, eswOptions, fileDataArr, fileData, esw;

    if (!objId) {
      throw "Object ID is empty";
    }

    params = params || {};
    if (params.timeZone) {
      savedTimeZone = ixConnect.loginResult.clientInfo.timeZone;
      ixConnect.loginResult.clientInfo.timeZone = params.timeZone;
    }

    editInfo = ixConnect.ix().checkoutSord(objId, EditInfoC.mbSord, LockC.NO);
    eswOptions = new EditInfoEswOptions();
    fileDataArr = ixConnect.ix().getESWFromEditInfo([editInfo], eswOptions);
    fileData = fileDataArr[0];
    esw = new java.lang.String(fileData.data, "UTF-8") + "";

    if (savedTimeZone) {
      ixConnect.loginResult.clientInfo.timeZone = params.timeZone = savedTimeZone;
    }

    return esw;
  },

  /**
   * Returns blob data from a map entry
   * @param {de.elo.ix.client.KeyValue} mapEntry Map entry
   * @param {Object} params Parameters
   * @param {String} [params.returnType=String] returnType, e.g. `String`
   * @param {String} [params.encoding=UTF-8] encoding, e.g. `UTF-8`
   * @return {String}
   */
  getBlobDataFromMapEntry: function (mapEntry, params) {
    var fileData, stringValue;

    if (!mapEntry || !mapEntry.blobValue) {
      return;
    }

    fileData = mapEntry.blobValue;

    if (!fileData.stream) {
      return;
    }

    params = params || {};
    params.returnType = params.returnType || "String";
    params.encoding = params.encoding || "UTF-8";

    if (params.returnType == "String") {
      stringValue = Packages.org.apache.commons.io.IOUtils.toString(fileData.stream, params.encoding) + "";
      fileData.stream.close();
      return stringValue;
    }
  },

  /**
   * Returns the internal date for `iDate` and `xDate`
   * @param {String} isoDate ISO date
   * @param {Object} params Parameters
   * @param {Object} params.conn Connection
   * @param {String} Internal date
   */
  getInternalDate: function (isoDate, params) {
    var me = this,
        ELODATE_1970_01_01_UTC,
        conn, timeZone, utcOffset, date, systemMillis, internalDateInteger, internalDateString;

    ELODATE_1970_01_01_UTC = 36819360;

    params = params || {};

    conn = params.conn || ixConnect;

    timeZone = conn.loginResult.clientInfo.timeZone + "";
    utcOffset = me.getTimeZoneOffset(timeZone);

    if (isoDate) {
      date = Packages.org.apache.commons.lang3.time.DateUtils.parseDate(isoDate, ["yyyyMMddHHmmss", "yyyyMMdd"]);
    } else {
      date = new java.util.Date();
    }

    systemMillis = date.getTime();

    internalDateInteger = parseInt((systemMillis / 60 / 1000) + ELODATE_1970_01_01_UTC + utcOffset, 10);
    internalDateString = internalDateInteger + "";

    return internalDateString;
  },

  /**
   * Reads map entries for the defined `objId` (or `mapId`) and returns them as an object
   * @param {Object} config Configuration
   * @param {Array} config.keys Map-keys which should be returned
   * @param {String} [config.mapId=config.objId] Either `mapId` or `objId` must be passed. The specific map for the `mapId` or `objId` will be read.
   * @param {String} config.objId Object ID
   * @param {de.elo.ix.client.MapDomainDataC} [config.domain=MapDomainC.DOMAIN_SORD] Map domain
   * @param {de.elo.ix.client.IXConnection} [params.connection=ixConnect] Index server connection
   */
  getMapEntriesAsObject: function (config) {
    var mapId,
        mapObj = {},
        domain, keys, connection, keyValues, i, entry;

    config = config || {};
    mapId = config.mapId || config.objId;
    domain = config.domain || MapDomainC.DOMAIN_SORD;

    if (!mapId) {
      throw "Map ID is missing";
    }

    keys = config.keys || [];
    connection = config.connection || ixConnect;


    keyValues = connection.ix().checkoutMap(domain, mapId, keys, LockC.NO).items;

    for (i = 0; i < keyValues.length; i++) {
      entry = keyValues[i];
      mapObj[entry.key + ""] = entry.value + "";
    }

    return mapObj;
  }
});
