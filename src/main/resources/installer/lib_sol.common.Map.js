
//@include lib_Class.js

/**
 * Base class that represents map data
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.02.001
 *
 * @eloix
 * @eloas
 * @elojc
 *
 * @requires sol.common.ObjectUtils
 *
 */
sol.define("sol.common.Map", {

  /**
   * @cfg {String} mapId
   * Map ID
   */

  /**
   * @cfg {String} objId
   * Object ID
   */

  /**
   * @cfg {Boolean} asAdmin
   * If `true`, the copy process will run in administrator context
   */
  asAdmin: undefined,

  initialize: function (config) {
    var me = this;
    me.logger = sol.create("sol.Logger", { scope: me.$className });
    if (!me.mapId) {
      throw "Map ID is empty";
    }
    if (!me.objId) {
      throw "Object ID is empty";
    }
    if (!me.mapDomain) {
      throw "Map domain is empty";
    }
    me.data = {};
    me.newEntries = {};
  },

  /**
   * Sets a map value of an ELO object.
   * @param {String} key
   * @param {String} value
   */
  setValue: function (key, value) {
    var me = this;

    if (!key) {
      throw "Key is empty";
    }

    key = String(key);
    value = (typeof value === "undefined" || value === null) ? "" : String(value);
    me.data[key] = value;

    key = new java.lang.String(key);
    me.newEntries[key] = new KeyValue(key, value);
  },

  /**
   * Set values
   * @param {Object} map Map
   */
  setValues: function (map) {
    var me = this,
        key, value;

    for (key in map) {
      if (map.hasOwnProperty(key)) {
        value = map[key];
        me.setValue(key, value);
      }
    }
  },

  /**
   * Writes the new map entries of an ELO object to the ix map database.
   */
  write: function () {
    var me = this,
        i = 0,
        mapValues = [], entry, key, ixConn;

    ixConn = (me.asAdmin === true && ixConnectAdmin !== 'undefined') ? ixConnectAdmin : ixConnect; //eslint-disable-line

    me.logger.enter("write", arguments);

    for (key in me.newEntries) {
      if (me.newEntries.hasOwnProperty(key)) {
        entry = me.newEntries[key];
        i++;
        me.logger.debug("Write entry " + i + ": " + entry.key + "=" + entry.value);
        mapValues.push(entry);
      }
    }

    if (mapValues.length > 0) {
      ixConn.ix().checkinMap(me.mapDomain, me.mapId, me.objId, mapValues, LockC.NO);
    }

    me.newEntries = {};

    me.logger.exit("write");
  },

  /**
   * Reads all map entries of an ELO object from the ix map database.
   * @param {String[]} keynames Keynames keys to be read (optional)
   * @return {Object}
   */
  read: function (keynames) {
    var me = this,
        result = {},
        ixConn = (me.asAdmin === true && ixConnectAdmin !== 'undefined') ? ixConnectAdmin : ixConnect, //eslint-disable-line
        items, keys, i, entry;
    me.logger.enter("read", arguments);

    me.data = {};
    if (keynames) {
      if (sol.common.ObjectUtils.isString(keynames)) {
        keys = [keynames];
        keynames = keys;
      } else if (!sol.common.ObjectUtils.isArray(keynames)) {
        keynames = null;
      }
    } else {
      keynames = null;
    }
    items = ixConn.ix().checkoutMap(me.mapDomain, me.mapId, keynames, LockC.NO).items;
    for (i = 0; i < items.length; i++) {
      entry = items[i];
      me.logger.debug("Read entry " + i + ": " + entry.key + "=" + entry.value);
      me.data[entry.key] = entry.value;
      result[entry.key] = entry.value;
    }
    me.logger.exit("read");

    return result;
  },

  /**
   * Gets a value from the map by a given key.
   * @param {String} key
   * @return {String}
   */
  getValue: function (key) {
    var me = this;
    if (me.data[key]) {
      return String(this.data[key]);
    }
    return "";
  },

  /**
   * Returns a number value
   * @param {type} key
   * @returns {String}
   */
  getNumValue: function (key) {
    var me = this,
        value;

    value = me.getValue(key).replace(",", ".");
    if ((value == "") || isNaN(value)) {
      return "";
    }
    return parseFloat(value);
  },

  /**
   * Sets a number value
   * @param {String} key
   * @param {String} value
   */
  setNumValue: function (key, value) {
    var me = this;

    value = String(value).replace(".", ",");

    me.setValue(key, value);
  },

  /**
   * Checks wether a key and value exists
   * @param {String} key Key
   * @return {Boolean}
   */
  keyAndValueExist: function (key) {
    var me = this;
    return !!me.data[key];
  },

  /**
   * Iterates over a table.
   * @param {String} endOfTableIndicatorColumnName Key name of a column to check wether the line exists
   * @param {Function} func Callback function for the iteration
   * @param {Object} ctx Execution context
   */
  forEachRow: function (endOfTableIndicatorColumnName, func, ctx) {
    var me = this,
        i = 1;
    if (!endOfTableIndicatorColumnName) {
      throw "The end of table indicator column name is empty.";
    }
    if (!func) {
      throw "The function parameter is emtpy.";
    }

    while (me.keyAndValueExist(endOfTableIndicatorColumnName + i)) {
      func.call(ctx, i++);
    }
  },

  /**
   * Returns the keyword list key
   * @param {String} key String
   * @param {String} separator Separator
   * @return {String}
   */
  getKwlKey: function (key, separator) {
    var me = this,
        str, separatorPos;
    str = me.getValue(key);
    if (!str) {
      return "";
    }
    separator = separator || "-";
    separatorPos = str.indexOf(separator);
    if (separatorPos < 0) {
      return str;
    }
    return str.substring(0, separatorPos).trim();
  }
});

/**
 * Represents the map data of an ELO object. This class utilizes reading and writing data to the map database.
 *
 *     var map = sol.create('sol.common.SordMap', {
 *       objId: '123'
 *     });
 *
 *     // read all map data from ix database
 *     map.read();
 *
 *     // read a property
 *     var zugferdImported = map.getValue('ZUGFERD_IMPORTED');
 *
 *     // change a property
 *     map.setValue('ZUGFERD_IMPORTED', 'true');
 *
 *     // write map data to ix database
 *     map.write();
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.1
 *
 * @eloix
 * @eloas
 * @elojc
 *
 * @requires sol.common.
 *
 */
sol.define("sol.common.SordMap", {
  extend: "sol.common.Map",

  /**
   * @cfg {String} objId
   * ID of the ELO object
   */

  initialize: function (config) {
    var me = this;
    if (!config.objId) {
      throw "Object ID is empty";
    }
    me.mapId = config.objId;
    me.objId = config.objId;
    if (config.asAdmin) {
      me.asAdmin = config.asAdmin;
    }
    me.mapDomain = MapDomainC.DOMAIN_SORD;
    me.$super("sol.common.Map", "initialize", [config]);
  }
});

/**
 * Represents the map data of an active workflow.
 *
 *     var map = sol.create("sol.common.WfMap", {
 *       flowId: "111",
 *       objId: "222"
 *     });
 *
 *     // read all workflow map data from the database
 *     map.read();
 *
 *     // read a property
 *     var zugferdImported = map.getValue('ZUGFERD_IMPORTED');
 *
 *     // change a property
 *     map.setValue('ZUGFERD_IMPORTED', 'true');
 *
 *     // write map data to database
 *     map.write();
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.1
 *
 * @eloix
 * @eloas
 * @elojc
 *
 * @requires sol.common.ObjectUtils
 *
 */
sol.define("sol.common.WfMap", {
  extend: "sol.common.Map",

  /**
   * @cfg {String} flowId
   * ID of the ELO object
   */

  /**
   * @cfg {String} objId
   */

  initialize: function (config) {
    var me = this;
    if (!config.flowId) {
      throw "Flow ID is empty";
    }
    if (!config.objId) {
      throw "Object ID is empty";
    }
    me.mapId = config.flowId;
    me.objId = config.objId;
    me.mapDomain = MapDomainC.DOMAIN_WORKFLOW_ACTIVE;
    me.$super("sol.common.Map", "initialize", [config]);
  }
});

/**
 * Represents map data as table
 *
 *     var sordMap = sol.create("sol.common.SordMap", { objId: objId });
 *     var sordMapTable = sol.create("sol.common.MapTable", { map: sordMap, columnNames: ["INVOICE_TAX_NET_AMOUNT", "INVOICE_TAX_AMOUNT", "INVOICE_TAX_RATE"] });
 *     if (sordMapTable.hasNextRow()) {
 *       sordMapTable.nextRow();
 *       var value = sordMapTable.getNumValue("INVOICE_TAX_RATE");
 *       if (value == 0) {
 *         sordMapTable.removeRow();
 *       }
 *     }
 *     sordMapTable.write();
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.1
 *
 * @eloix
 * @eloas
 * @elojc
 */
sol.define("sol.common.MapTable", {

  /**
   * @cfg {sol.common.Map} map (required)
   * Map object
   */

  /**
   * @cfg {Array} columnNames (required)
   * Column names
   */

  /**
   * @cfg {String} endOfTableIndicatorColumnName (optional)
   * End of table indicator column name
   */

  /**
   * @cfg {String} initEmpty (optional)
   * Provides an empty table
   */

  /**
   * @cfg {String} [read=true] (optional)
   * Read the map values
   */

  /**
   * @cfg {String} [reset=true] (optional)
   * Reset the table iterator
   */

  initialize: function (config) {
    var me = this,
        i, j, lastLine, columnName, row;

    me.logger = sol.create("sol.Logger", { scope: me.$className });

    i = 0;
    lastLine = false;

    config = config || {};
    config.read = (config.read == false) ? false : true;
    config.initEmpty = (config.initEmpty == true) ? true : false;
    config.reset = (config.reset == false) ? false : true;

    if (!config.map) {
      throw "Map is empty";
    }

    if (!config.columnNames || (config.columnNames.length == 0)) {
      throw "Column names are empty";
    }

    me.map = config.map;

    me.columnNames = config.columnNames;
    me.data = [];

    if (config.read || !config.initEmpty) {
      me.map.read();
    }

    if (!config.initEmpty) {
      do {
        i++;
        row = {};
        for (j = 0; j < me.columnNames.length; j++) {
          columnName = me.columnNames[j];
          row[columnName] = me.map.getValue(columnName + i);
        }
        if (me.endOfTableIndicatorColumnName) {
          lastLine = !row[me.endOfTableIndicatorColumnName];
        } else {
          for (j = 0; j < me.columnNames.length; j++) {
            lastLine = true;
            columnName = me.columnNames[j];
            if (row[columnName]) {
              lastLine = false;
              break;
            }
          }
        }
        if (!lastLine) {
          me.data.push(row);
        }
      } while (!lastLine);
    }

    me.writeRowsCount = i;
    me.index = me.data.length - 1;

    if (config.reset) {
      me.reset();
    }
  },

  /**
   * Resets the iterator
   */
  reset: function () {
    var me = this;
    me.index = -1;
    me.illegalState = true;
  },

  /**
   * Removes the first row and resets the table
   */
  shift: function () {
    var me = this;
    me.data.shift();
    me.reset();
  },

  /**
   * True if the table has a next row
   * @return {Boolean}
   */
  hasNextRow: function () {
    var me = this;
    return ((me.data.length - 1) > me.index);
  },

  /**
   * Moves the row pointer to the next row
   * @return {Object}
   */
  nextRow: function () {
    var me = this;
    me.illegalState = false;
    me.index++;
    return me.data[me.index];
  },

  /**
   * Returns a value
   * @param {String} columnName Column name
   * @return {String}
   */
  getValue: function (columnName) {
    var me = this;
    me.checkState();
    if (me.columnNames.indexOf(columnName) < 0) {
      throw "Key '" + columnName + "' hasn't been predefined as column name.";
    }
    return me.data[me.index][columnName] || "";
  },

  /**
   * Returns the index number
   * @return {Number}
   */
  getDisplayIndex: function () {
    var me = this,
        index;
    me.checkState();
    index = me.index + 1;
    return index;
  },

  /**
   * Returns a number value
   * @param {String} columnName Column name
   * @returns {String}
   */
  getNumValue: function (columnName) {
    var me = this,
        value;

    value = me.getValue(columnName).replace(",", ".");
    if (isNaN(value)) {
      return "";
    }
    return parseFloat(value);
  },

  /**
   * Checks the current row
   */
  checkState: function () {
    var me = this;
    if ((me.index < 0) || me.illegalState) {
      throw "Illegal state: call nextRow()";
    }
  },

  /**
   * Sets a value
   * @param {String} columnName Column name
   * @param {String} value
   */
  setValue: function (columnName, value) {
    var me = this;
    me.checkState();
    if (me.columnNames.indexOf(columnName) < 0) {
      throw "Key '" + columnName + "' hasn't been predefined as column name.";
    }
    me.data[me.index][columnName] = value;
  },

  /**
   * Sets a number value
   * @param {String} columnName Column name
   * @param {String} value
   */
  setNumValue: function (columnName, value) {
    var me = this;

    value = String(value).replace(".", ",");

    me.setValue(columnName, value);
  },

  /**
   * Inserts a row after the current row
   */
  insertRow: function () {
    var me = this;
    me.data.splice(me.index + 1, 0, {});
    me.illegalState = true;
  },

  /**
   * Deletes the current row
   */
  removeRow: function () {
    var me = this;
    me.checkState();
    me.data.splice(me.index, 1);
    me.illegalState = true;
    me.index--;
  },

  /**
   * Appends a row at the end of the table
   */
  appendRow: function () {
    var me = this;
    me.illegalState = false;
    me.index = me.data.length - 1;
    me.insertRow();
    me.nextRow();
  },

  /**
   * Returns the table length
   * @return {Number}
   */
  getLength: function () {
    var me = this,
        length;

    if (me.data) {
      length = me.data.length;
    }

    return length;
  },

  /**
   * Clears the table
   */
  clear: function () {
    var me = this,
        i, j, columnName;

    for (i = 0; i <= me.writeRowsCount; i++) {
      for (j = 0; j < me.columnNames.length; j++) {
        columnName = me.columnNames[j];
        me.map.setValue(columnName + (i + 1), "");
      }
    }
    me.map.write();
    me.data = [];
    me.writeRowsCount = 0;
    me.reset();
  },

  /**
   * Writes the data
   */
  write: function () {
    var me = this,
        i, j, columnName;
    me.logger.enter("write", arguments);

    for (i = 0; i < me.data.length; i++) {
      for (j = 0; j < me.columnNames.length; j++) {
        columnName = me.columnNames[j];
        me.map.setValue(columnName + (i + 1), me.data[i][columnName] || "");
      }
    }
    if (me.initEmpty) {
      me.writeRowsCount = i + 1;
    }
    // Add empty rows
    for (; i <= me.writeRowsCount; i++) {
      for (j = 0; j < me.columnNames.length; j++) {
        columnName = me.columnNames[j];
        me.map.setValue(columnName + (i + 1), "");
      }
    }
    me.map.write();
    me.logger.exit("write");
  }
});

