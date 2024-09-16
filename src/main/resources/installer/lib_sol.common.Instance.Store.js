//@include lib_sol.common.Instance.js

/**
 * @class sol.common.instance.sord
 * @extends sol.common.instance.base
 * @eloall
 * @experimental
 * Provides a stores for all kind of properties.
 * A store can be accessed by name. The name is a required config property.
 *
 * Extend from this instance with care (only if you know what you do).
 *
 * It is recommended to create a store with mixin "sol.common.instance.mixins.create" and to use instances name ($name)
 * as store name to just share a store with members of the same instanceDefinition.
 *
 * Every instance can share a store with every other instance, it just needs to access the same store by the same name.
 *
 * E.g.
 * @example
 * sol.define("businesspartner.common.example.myInstance", {
 *  $create: [
 *    { key: "myStore", name: "sol.common.instance.store", config: { name: "{{instance.$name}}" } }
 *  ],
 *  mixins: [
 *    "sol.common.instance.required",
 *    "sol.common.instance.mixins.create"
 *  ]
 * });
 *
 * var myInstance1 = so.create("businesspartner.common.example.myInstance", {}),
 *     myInstance2 = so.create("businesspartner.common.example.myInstance", {});
 * myInstance1.myStore.set("myProperty", "myValue");
 * myInstance2.myStore.get("myProperty"); // returns "myValue";
 *
 * @example
 * sol.define("businesspartner.common.example.myInstance", {
 *  $create: [
 *    { key: "myStore", name: "sol.common.instance.store", config: { name: "myInternalStoreName" } }
 *  ],
 *  mixins: [
 *    "sol.common.instance.required",
 *    "sol.common.instance.mixins.create"
 *  ]
 * });
 * sol.define("businesspartner.common.example.myOtherInstance", {
 *  $create: [
 *    { key: "myStore", name: "sol.common.instance.store", config: { name: "myInternalStoreName" } }
 *  ],
 *  mixins: [
 *    "sol.common.instance.required",
 *    "sol.common.instance.mixins.create"
 *  ]
 * });
 *
 * var module1 = so.create("businesspartner.common.example.myInstance", {}),
 *     module2 = so.create("businesspartner.common.example.myOtherInstance", {});
 * module1.myStore.set("myProperty", "myValue");
 * module2.myStore.get("myProperty"); // return "myValue";
 *
 * @requires sol.common.instance
 */
sol.common.instance.define("sol.common.instance.store", {
  constructor: {
    prototype: {
      // properties within constructor cache behave like properties created with sol.create
      // use with care, all instances using store (via mixin or as extend) share
      $stores: {}
    }
  },
  $create: [
    { key: "logger", name: "sol.common.instance.logger", config: { scope: "{{instance.$name}}" } },
    { name: "sol.common.instance.required", config: { requiredConfig: ["name"], name: "{{config.name}}" } }

  ],
  mixins: [
    "sol.common.instance.mixins.create"
  ],
  initialize: function (config) {
    var me = this;
    if (config.name) {
      me.name = config.name;
      me.$stores[config.name] = {};
    }
  },
  set: function (key, value) {
    var me = this;
    me.$stores[me.name][key] = value;
  },
  get: function (key) {
    var me = this;
    return me.$stores[me.name][key];
  },
  delete: function (key) {
    var me = this;

    delete me.$stores[me.name][key];
  }
});