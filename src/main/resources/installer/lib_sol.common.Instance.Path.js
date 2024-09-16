//@include lib_sol.common.Instance.js

/**
 * @class sol.common.instance.path
 * @extends sol.common.instance.base
 * @eloall
 * @experimental
 * This is an experimental new functionality, which may be removed in future versions.
 *
 * Please be aware that this class does not use sol.define  but sol.common.instance.define
 * and may be working slightly different.
 *
 * This instanceDefinition provides basic functionality to build a path
 */
sol.common.instance.define("sol.common.instance.path", {
  CONST: {
    ELO_DELIMITER: "&#182;",
    JSON_DELIMITER: "."
  },
  delimiter: "&#182;",
  _path: [],
  initialize: function (config) {
    var me = this;
    if (config.delimiter) {
      me.delimiter = me.CONST[config.delimiter] || config.delimiter;
    } else {
      me.delimter = me.CONST.ELO_DELIMITER;
    }
    me.$super(null, "initialize", config);
  },

  /**
   * @chainable
   * @param {String} element the element
   * @returns {sol.common.instance.path} this
   */
  add: function (element) {
    var me = this;
    me._path.add(element);
    return me;
  },
  get: function (config) {
    var me = this;

    return (config || {}).delimiter
      ? me._path.join(me.CONST[config.delimiter] || config.delimiter)
      : me._path.join(me.delimiter);
  }
});