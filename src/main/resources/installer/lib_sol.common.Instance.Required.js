//@include lib_sol.common.Instance.js

/**
 * @class sol.common.instance.required
 * @extends sol.common.instance.base
 * @eloall
 * @experimental
 * This is an experimental new functionality, which may be removed in future versions.
 *
 * Please be aware that this class does not use sol.define  but sol.common.instance.define
 * and may be working slightly different.
 *
 * This instanceDefinition provides basic functionality to check for required configurations
 *
 * @requires sol.common.instance
 */
sol.common.instance.define("sol.common.instance.required", {
  initialize: function (config) {
    var me = this;

    (config.requiredConfig || me.$requiredConfig || [])
      .forEach(function (requiredProperty) {
        var property = me[requiredProperty] || (config || {})[requiredProperty];
        if (property == null) {
          throw "[" + me.$name + "] Could not create instance. Missing config property: " + requiredProperty + ". Please ensure all required properties are set: " + JSON.stringify(me.$requiredConfig);
        }
      });
  }
});