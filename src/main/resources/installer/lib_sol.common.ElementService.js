//@include lib_Class.js
/**
 * This mixin class contains convenience methods for working with element Services like
 * SordProvider. You can use these functions in your own building blocks
 * to be able to integrate a generally valid search.
 *
 * An example implementation can be found in {@see sol.common.ix.services.StandardPreconditions}
 *
 * @author MHe (ELO Digital Office GmbH)
 *
 * @requires sol.common.IxUtils
 * @requires sol.common.ObjectUtils
 * @requires sol.common.Template
 */
sol.define("sol.common.mixins.ElementService", {
  mixin: true,

  initialize: function (config) {},

  sanitizeElementServiceConfig: function (opt) {
    var me = this, name = opt.name, isObj, validStr,
        args = opt.args || {};

    isObj = function (obj) {
      return sol.common.ObjectUtils.type(obj, "object");
    };

    validStr = function (str) {
      return sol.common.ObjectUtils.type(str, "string") && String(str) && str.trim();
    };

    if (!((name = validStr(name)) && name.indexOf("RF_") === 0)) {
      throw "`elementService.name` must be a string starting with 'RF_' (a valid registered service)`: " + name;
    }

    if (args && !isObj(args)) {
      throw "`elementService.args` must be an object if it is defined. current type: " + typeof args;
    }

    me.logger.info("elementService config ok");
    return { name: name, args: args };
  },

  /**
   * 
   * @param {Object} cfg
   * @param {String} cfg.name name of the registered function
   * @param {Object} cfg.args args of the registered function
   * @param {Object} templateData  
   * @param {Object} options
   * @param {boolean} options.template If set to true cfg.args will be templated
   * @returns {Object} Response of the registered function 
   */
  executeElementService: function (cfg, templateData, options) {
    var elements, args = cfg.args || {}, opt = options || {};
    
    opt.template = opt.template || false;

    if (opt.template) {
      if (!sol.common.TemplateUtils) {
        throw Error("templating can only be used with IX scripts which include `lib_sol.common.Template`");
      }
      args = sol.common.TemplateUtils.render(args, templateData || {});
    }

    elements = sol.common.IxUtils.execute(cfg.name, args);
    
    if (opt.elementArg) {
      return sol.common.ObjectUtils.getProp(elements, opt.elementArg);
    }

    elements = elements.sords || elements.elements;
    
    if (!Array.isArray(elements)) {
      throw Error("The RF defined as `elementService` must return an object containing a property `sords` or `elements` which contains an array (of objects)");
    }

    return elements;
  }
});