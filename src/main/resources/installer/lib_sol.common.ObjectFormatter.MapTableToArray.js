
importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js
//@include lib_sol.common.ObjectUtils.js


/**
 * Converts a MapTable of a TemplateSord structure into an array
 * All types except the mapKeys are ignored by the converter.
 *
 *
 * MapTable fields that are not in the output definition
 * are also not considered in the result and are discarded.
 *
 * This also works with wfMapKeys!
 * 
 *
 * Example of a TemplateSord object with MapTable
 *
 *    {
 *       mapKeys: {
 *          "PERSON_ADDRESS_STREET1": "Musterstraße",
 *          "PERSON_ADDRESS_CITY1": "Musterstadt"
 *       }
 *    }
 *
 * Example Call
 *
 *     var converter = sol.create("sol.common.ObjectFormatter.MapTableToArray", {
 *       output: [
 *         { source: { key: "PERSON_CRUD_STATUS" }, target: { prop: "status" } }
 *         { source: { key: "PERSON_ADDRESS_CITY" },  target: { prop: "city" } }
 *       ],
 *       options: {
 *         ignorePropertyNames: true,
 *         filter: [
 *          { "prop" : "sord.mapKeys.SOLUTION_FIELD", value: "CREATE" }
 *        ]
 *       }
 *     });
 *
 * Output
 *
 *    [
 *      { street: "Musterstraße", city: "Musterstadt", $mapIndex: "1"}
 *    ]
 *
 * The special prop $mapIndex is added to the result object to determine the mapIndex in
 * further processing
 *
 * ### Options
 *
 *    {
 *       options: { ignorePropertyNames: true }
 *    }
 *
 * When this parameter is defined, the target.prop name is ignored by default. An Array with objects on the original fieldnames will be created.
 *
 * #### propSelector
 *
 * When this parameter is defined the result array will be returned as simple string array instead of complex object
 * propSelector must select an output target prop. Only this prop will be returned. Others will be ignored.
 *
 *      var converter = sol.create("sol.common.ObjectFormatter.MapTableToArray", {
 *       output: [
 *         { source: { key: "PERSON_USERNAME1" }, target: { prop: "username" } }
 *         { source: { key: "PERSON_USERNAME2" },  target: { prop: "username" } }
 *       ],
 *       options: {
 *         propSelector: "username"
 *       }
 *     });
 *
 *  Output
 *
 *    [
 *      "Sandra Renz", "Bodo Kraft"
 *    ]
 *
 *
 * @requires sol.common.ObjectUtils
 *
 */
sol.define("sol.common.ObjectFormatter.MapTableToArray", {
  requiredConfig: ["output"],

  mixins: ["sol.common.mixins.ObjectFilter"],

  /**
   * @cfg {String} [kind=mapKeys] (optional)
   * Use formatter for wfMapKeys or mapKeys. Only this types are supported.
   * You have to decide wheather you want to convert wfMapKeys or mapKeys
   */

  /**
   * @cfg {Object} options
   * @cfg {Boolean} options.ignorePropertyNames all target prop definition will be ignored
   * @cfg {String|Boolean} options.propSelector return single property in a flat string array with the passed prop
   */

  initialize: function (config) {
    var me = this;
    if (!config.kind) {
      config.kind = "mapKeys";
    }

    me.$super("sol.Base", "initialize", [config]);
    me.outputCache = {};

    me.options = me.options || {};
    me.options.ignorePropertyNames = me.options.ignorePropertyNames || false;
    me.options.propSelector = me.options.propSelector || false;
    me.options.removeIfUsed = me.options.removeIfUsed || false;
    me.options.filter = me.options.filter || [];
    me.sanitizeOutputConfig(me.output);
  },

  sanitizeOutputConfig: function (output) {
    var me = this;

    // prepare an output temporary cache
    // With the cache we can find output definitions easier

    output.forEach(function (definition) {
       if (!definition.source) {
        throw Error("missing source prop in output definition, " + JSON.stringify(definition));
       }

       if (!sol.common.ObjectUtils.type(definition.source.key, "string")) {
         throw Error("key in output definition is not a string," + JSON.stringify(definition));
       }

       me.outputCache[definition.source.key] = definition;
    });

    if (!(me.kind === "wfMapKeys" || me.kind === "mapKeys" || me.kind === "flat")) {
      throw Error("Only wfMapKeys or mapKeys or flat are supported");
    }

  },

  /**
   * Convert mapKeys of a templateSord object to an array
   * @param {Object} templateSord
   * @param {Object} config
   * @param {Array} config.fields
   */
  format: function (templateSord) {
    var me = this, result = {}, tableData, filter, props;

    if (!templateSord) {
      return [];
    }

    if (me.kind === "mapKeys" && !templateSord.mapKeys) {
      return [];
    }

    if (me.kind === "wfMapKeys" && !templateSord.wfMapKeys) {
      return [];
    }

    props = me.kind === "flat"
      ? templateSord
      : templateSord[me.kind];


    Object.keys(props).forEach(function (key) {
      var mapIndex = me.getFieldNameIndex(key), outputDef, value, fieldName, targetFieldname;
      
      if (mapIndex > 0) {

        fieldName = me.getFieldName(key);
        outputDef = me.outputCache[fieldName];
    

        // transform mapKey only when output definition exists
        if (outputDef) {
          
          value = me.kind === "flat"
            ? me.getFieldValue(templateSord, key)
            : me.getFieldValue(templateSord[me.kind], key);
          
         
          if (!result[mapIndex]) {
            // create new entry, when we read a new row
            result[mapIndex] = {};
          }
          targetFieldname = me.getTargetFieldName(key, outputDef);
          sol.common.ObjectUtils.setProp(result[mapIndex], targetFieldname, value);

          if (me.options.removeIfUsed) {
            me.removeKeyFromSource(templateSord, key);
          }
          
        }
      } else {
        me.logger.debug(["skip field `{0}` because it is not a maptable", key]);
      }
    });

    tableData = me.convertToArray(result);

    me.logger.debug(["tableData {0}", JSON.stringify(tableData)])

    if (me.options.filter.length > 0) {
      // from mixin sol.common.ObjectUtils.ObjectFilter
      filter = me.generateFilter(me.options.filter || []);
      me.logger.debug(["user filter {0}", JSON.stringify(filter)]);
      tableData = tableData.filter(me.matchObject.bind(null, filter));
    }


    if (me.options.propSelector) {
      tableData = me.returnOnlyPropSelector(tableData);
    }

    return tableData;
  },

  removeKeyFromSource: function(templateSord, key) {
    var me = this;
    if (me.kind === "flat") {
      delete templateSord[key]
    } else {
      delete templateSord[me.kind][key]
    }
  },

  getFieldValue: function(obj, key) {
    return sol.common.ObjectUtils.getProp(obj, key);
  },

  /**
   * @returns mapIndex when field has any index otherwise -1
   */
  getFieldNameIndex: function (fieldName) {
    var me = this, pos;
    me.logger.debug("fieldname", fieldName);
    pos = me.getIndexPosition(fieldName);

    if (pos > 0) {
      return fieldName.substring(pos);
    }

    return "";
  },

  getFieldName: function (fieldName) {
    var me = this, pos;
    pos = me.getIndexPosition(fieldName);
    if (pos > 0) {
      return fieldName.substring(0, pos);
    }

    return "";
  },

  getIndexPosition: function (fieldName) {
    if (!sol.common.ObjectUtils.isString(fieldName)) {
      throw Error("`fieldName must be a string, type=`" + sol.common.ObjectUtils.type(fieldName));
    }
    return fieldName.search(/\d+$/);
  },

  getTargetFieldName: function (mapKey, outputDefinition) {
    var me = this;
    return me.options.ignorePropertyNames
      ? mapKey
      : outputDefinition.target.prop;
  },

  convertToArray: function (result) {

    return Object.keys(result).map(function (index) {
      result[index].$mapIndex = index;
      return result[index];
    });
  },

  returnOnlyPropSelector: function (arr) {
    var me = this,
      propSelector = me.options.propSelector;

    return arr.map(function (data) {
      return data[propSelector];
    });
  }

});
