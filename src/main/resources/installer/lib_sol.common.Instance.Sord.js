//@include lib_sol.common.Instance.js
//@include lib_sol.common.instance.utils.Ix.js
//@include lib_sol.common.SordUtils.js

/**
 * @class sol.common.instance.sord
 * @extends sol.common.instance.base
 * @eloall
 * @experimental
 * This is an experimental new functionality, which may be removed in future versions.
 *
 * Please be aware that this class does not use sol.define  but sol.common.instance.define
 * and may be working slightly different.
 *
 * This instanceDefinition provides functionality to create, checkout, checkin and delete a sord
 * and its mapItems as well as to set sordValues, ObjKeyValues and MapValues.
 *
 * @requires sol.common.instance
 * @requires sol.common.instance.utils.ix
 * @requires sol.common.SordUtils
 */
sol.common.instance.define("sol.common.instance.sord", {
  toJSON: function () {
    var me = this;
    return me.getTemplateSord();
  },
  pilcrow: "\u00b6",
  CONST: {
    pilcrow: "\u00b6",
    sordProps: ["id", "guid", 'maskName', 'name', "desc", "parentId"]
  },
  $create: [
    { key: "ixUtils", name: "sol.common.instance.utils.Ix" }
  ],
  mixins: [
    "sol.common.instance.mixins.create"
  ],
  initialize: function (config) {
    var me = this;

    me.loadSord(config);
    me.createProxySord(config);
  },
  loadSord: function (config) {
    var me = this;
    if (!me.sord || config.forceReload) {
      if (config.objId) {
        me.sord = me.ixUtils.checkoutSord(config.objId, {});
      } else if (config.create) {
        me.sord = me.ixUtils.createSord(config.create);
      }
    }
    return me.sord;
  },
  loadMapItems: function (config) {
    var me = this;

    if (!me.mapKeys || config.forceReload) {
      me.mapItems = me.ixUtils.checkoutMap(config.objId, {});
    }
    return me.mapItems;
  },
  createProxySord: function () {
    var me = this;
    me.proxySord = {};
    (me.CONST.sordProps)
      .forEach(function (sordProp) {
        me.proxySord[sordProp] = {
          value: me.sord[sordProp],
          changed: false
        };
      });
    me.proxySord.objKeys = {};
    (me.sord.objKeys || [])
      .forEach(function (objKey) {
        me.proxySord.objKeys[objKey.name] = {
          objKey: objKey,
          changed: false
        };
      });
    me.proxySord.mapKeys = {};
    (me.loadMapItems({ objId: me.sord.id }) || [])
      .forEach(function (mapItem) {
        me.proxySord.mapKeys[mapItem.key] = {
          mapItem: mapItem,
          changed: false
        };
      });
  },
  getTemplateSord: function () {
    var me = this,
        getObjKeys = function () {
          return Object.keys(me.proxySord.objKeys)
            .reduce(function (objKeys, prop) {
              objKeys[prop] = me.getObjKeyValue(prop);
              return objKeys;
            }, {});
        },
        getMapKeys = function () {
          return Object.keys(me.proxySord.mapKeys)
            .reduce(function (mapKeys, key) {
            // log.info("me.proxySord.mapKeys[key]" + me.proxySord.mapKeys[key]);
              mapKeys[key] = String(me.proxySord.mapKeys[key].mapItem.value);
              return mapKeys;
            }, {});
        },
        createTemplateSord = function (objKeys, mapKeys) {
          var applyValueFromProxySordOn = function (templateSord, sordProp) {
            if (me.proxySord[sordProp]) {
              templateSord[sordProp] = String(me.proxySord[sordProp].value);
            }
            return templateSord;
          };
          return me.CONST.sordProps
            .reduce(
              applyValueFromProxySordOn,
              {
                objKeys: objKeys,
                mapKeys: mapKeys
              }
            );
        };

    return createTemplateSord(getObjKeys(), getMapKeys());
  },
  setEntries: function (entries, options) {
    var me = this;

    (entries || [])
      .forEach(function (entry) {
        switch (entry.type) {
          case "SORD":
            me.setSordValue(entry.key, entry.value, entry.params);
            break;
          case "GRP":
            me.setObjKeyValue(entry.key, entry.value, entry.params);
            break;
          case "MAP":
            me.setMapKeyValue(entry.key, entry.value, entry.params);
            break;

          default:
            break;
        }
      });

    if (options.save) {
      me.save();
    }
  },
  getSordValue: function (prop) {
    var me = this,
        getSordValue = function () {
          return (me.proxySord[prop] || {});
        },
        proxyItem = getSordValue();

    return (proxyItem || {}).value ? String(proxyItem.value) : null;

  },
  setSordValue: function (prop, value, _options) {
    var me = this,
        getSordValue = function () {
          return me.CONST.sordProps.indexOf(prop) != -1 ? (me.proxySord[prop] || {}) : null;
        },
        proxyItem = getSordValue();

    if (proxyItem) {
      proxyItem.value = value;
      me.sord[prop] = value;
    }
  },
  getObjKeyValue: function (prop, options) {
    var me = this,
        getObjKey = function () {
          return me.proxySord.objKeys[prop].objKey;
        },
        objKey = getObjKey();

    return objKey ? String(Array.prototype.slice.call(objKey.data).join(me.pilcrow)) : null;
  },
  setObjKeyValue: function (prop, value, options) {
    var me = this,
        objKey;

    options = options || {};
    options.silent = typeof options.silent == "boolean" ? options.silent : true;

    objKey = sol.common.SordUtils.setObjKeyValue(me.sord, prop, value, options);

    if (objKey) {
      me.proxySord.objKeys[prop] = me.proxySord.objKeys[prop] || {};
      me.proxySord.objKeys[prop].objKey = objKey;
      me.proxySord.objKeys[prop].changed = true;
    }
  },
  getMapKeyValue: function (prop) {
    var me = this,
        getMapKey = function () {
          return (me.proxySord.mapKeys[prop] || {});
        },
        mapItem = getMapKey();

    return (mapItem || {}).value ? String(mapItem.value) : null;

  },
  setMapKeyValue: function (prop, value, _options) {
    var me = this;

    me.proxySord.mapKeys[prop] = {
      mapItem: new KeyValue(prop, value),
      changed: true
    };
  },
  getMapItems: function (filterFunction) {
    var me = this;

    return Object.keys(me.proxySord.mapKeys || {})
      .map(function (key) {
        return me.proxySord.mapKeys[key];
      })
      .filter(filterFunction)
      .map(function (proxyItem) {
        return proxyItem.mapItem;
      });
  },
  getObjKeys: function (filterFunction) {
    var me = this;

    return Object.keys(me.proxySord.objKeys || {})
      .map(function (key) {
        return me.proxySord.objKeys[key];
      })
      .filter(filterFunction)
      .map(function (proxyItem) {
        return proxyItem.objKey;
      });
  },
  save: function (params) {
    var me = this,
        objId = me.proxySord.id.value,
        onlyChanged = function (proxyItem) {
          return proxyItem.changed;
        },
        updateMapItems,
        updateObjKeys;

    // update mapItems
    updateMapItems = me.getMapItems(onlyChanged);

    if (updateMapItems && updateMapItems.length > 0) {
      ixConnect.ix().checkinMap(MapDomainC.DOMAIN_SORD, objId, objId, updateMapItems, LockC.NO);
    }

    updateObjKeys = me.getObjKeys(onlyChanged);

    if (String(me.proxySord.id.value) == "-1") {
      me.sord.id = me.ixUtils.checkinSord(me.sord, params);
      me.proxySord.id.value = me.sord.id;
    } else if (updateObjKeys && updateObjKeys.length > 0) {
      me.ixUtils.checkinSord(me.sord, params);
    }
  },
  delete: function (params) {
    var me = this;

    me.ixUtils.deleteSord(me.sord.id, params);
    me.sord.id = "-1";
    me.proxySord.id.value = me.sord.id;
  }
});