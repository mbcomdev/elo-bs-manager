//@include lib_sol.common.Instance.js
//@include lib_sol.common.Template.js

/**
 * @class sol.common.instance.mixins.create
 * @extends sol.common.instance.base
 * @eloall
 * @experimental
 * This is an experimental new functionality, which may be removed in future versions.
 *
 * Please be aware that this class does not use sol.define  but sol.common.instance.define
 * and may be working slightly different.
 */
sol.common.instance.define("sol.common.instance.mixins.create", {
  initialize: function (config) {
    var me = this,
        // split into 2 classes to hide implementation details from base clase
        module = sol.common.instance.create("sol.common.instance.mixins.create.applyInstances", {});
    module.applyInstances(me, config, me.$create);
  }
});

sol.common.instance.define("sol.common.instance.mixins.create.applyInstances", {
  applyInstances: function (baseInstance, config, instanceDefinitions) {
    var me = this;

    (instanceDefinitions || [])
      .forEach(me.applyInstance.bind(me, baseInstance, config));
  },
  applyInstance: function (baseInstance, config, instanceDescription) {
    var me = this,
        getInstanceConfig = function () {
          var anInstanceConfig;
          // TODO template instanceDescription.config with config an me
          if (instanceDescription.config) {
            anInstanceConfig = sol.common.TemplateUtils.render(instanceDescription.config, {
              instance: baseInstance,
              config: config
            });
          } else {
            // todo clone
            anInstanceConfig = sol.common.instance.clone(config || {});
          }
          return anInstanceConfig;
        },
        instanceConfig = getInstanceConfig(),
        instance;

    instance = sol.common.instance.create(instanceDescription.name, instanceConfig);

    if (instanceDescription.key) {
      me.setProperty(
        baseInstance,
        instanceDescription.key,
        instance
      );
    }
  },
  setProperty: function (obj, path, value) {
    var me = this;

    path = Array.isArray(path) ? path : path.split(".");
    if (path.length == 1) {
      obj[path[0]] = value;
    } else {
      obj[path[0]] = obj[path[0]] || {};
      me.setProperty(obj[path[0]], path.slice(1), value);
    }
  }
});