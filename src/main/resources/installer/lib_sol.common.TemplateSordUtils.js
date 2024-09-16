//@include lib_Class.js



/**
 * This class contains convinience methods for working with templateSord formatted sord objects
 *
 * The structure of a templateSord object is the following:
 *
 *  {
 *    objKeys: {
 *        INDEXFIELD_A: "value",
 *        INDEXFIELD_B: "34"
 *    },
 *    mapKeys: {},
 *    wfMapKeys: {}
 *  }
 *
 *  @requires sol.common.ObjectUtils
 */
sol.define("sol.common.TemplateSordUtils", {
  singleton: true,

  /**
   * @private
   */
  TYPES: {
    GRP: "getObjKey",
    MAP: "getMapKey",
    WFMAP: "getWfMapKey"
  },

  /**
   *
   */
  create: function (objKeys, mapKeys) {
    return {
      objKeys: objKeys || {},
      mapKeys: mapKeys || {},
      wfMapKeys: {}
    };
  },

  /**
   *
   * @param {*} templateSord
   * @param {*} key
   * @returns
   */
  getObjKey: function (templateSord, key) {
    return sol.common.ObjectUtils.getProp(templateSord, "objKeys." + key) || "";
  },

  getMapKey: function (templateSord, key) {
    return sol.common.ObjectUtils.getProp(templateSord, "mapKeys." + key) || "";
  },

  getWfMapKey: function (templateSord, key) {
    return sol.common.ObjectUtils.getProp(templateSord, "wfMapKeys." + key) || "";
  },

  getValue: function (templateSord, typeDef) {
    var accessorFunction;
    if (!typeDef || !typeDef.type || !typeDef.key) {
      throw Error("type definition must not be null and have the structure of {type, key}");
    }

    // Delegate one of the templateSord getter methods
    accessorFunction = this.TYPES[typeDef.type.toUpperCase()];

    if (!accessorFunction) {
      throw Error("type " + typeDef.type + " is not supported");
    }

    return sol.common.TemplateSordUtils[accessorFunction].call(this, templateSord, typeDef.key);
  },

  /**
   * @requires sol.common.ObjectFormatter.MapTableToArray
   * @param {*} templateSord
   * @param {*} fields
   */
  getTable: function (templateSord, fields, tableKind) {
    var converter, outputDef,
      createOutputDef = function (key) {
        return { source: { key: key }, target: { prop: key } };
      };

    fields = sol.common.ObjectUtils.toArray(fields);

    // prepare output definition for ObjectFormatter.MapTableToArray
    // The class needs some special format of its output configurations
    outputDef = (fields || []).map(function (field) {
      return createOutputDef(field.key || field);
    });

    converter = sol.create("sol.common.ObjectFormatter.MapTableToArray", {
      kind: tableKind,
      output: outputDef
    });

    return converter.format(templateSord);
  }



});