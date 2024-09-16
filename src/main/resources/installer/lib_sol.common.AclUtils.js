// Java includes
importPackage(Packages.de.elo.ix.client);

// JavaScript includes
//@include lib_Class.js

/**
 * Utility functions for ACL processing.
 *
 * The functions `addRights` and `removeRights` apply changes to an objects ACL items.
 * The `restore` function can restore the original rights if needed, and if there was a call to one of the before mentioned functions with a store command.
 *
 * ## Function parameters
 * For examples see {@link sol.common.AclUtils#addRights addRights} and {@link sol.common.AclUtils#removeRights removeRights}
 *
 * ### objId
 * ObjId of the Object which should be edited. If there is a `recursive` command (see config parameter) this is the starting point from which all sub-elements will ne processed.
 *
 * ### users (only `addRights` and `removeRights`)
 * This is an Array with user names or user objects (or a mix of both).
 * If there are valid usernames specified, only those users ACL items will be altered.
 * If this contains objects they need to have a `name` property and may have an additional `rights` object. E.g.:
 *
 *     {
 *       users: [
 *         { name: "AMustermann", rights: { r: true, w: true } },
 *         { name: "BMustermann", rights: { r: true, w: true, d: true } },
 *         { name: "CMustermann" },   // will get the fallback access rights
 *         "DMustermann"              // will get the fallback access rights
 *       ]
 *     }
 *
 * If this parameter is undefined or an empty Array, all existing ACL items will be adjusted.
 *
 * ### rights (only `addRights` and `removeRights`)
 * This Object specifies, which rights should be added/removed.
 * Both following forms are valid:
 *
 *     { r: true, w: true, d: false, e: false, l: false, p: false}
 *     { read: false, write: true, del: true, edit: true, list: true. perm: true}
 *
 * The `addRights` function will add all right, flaged with `true`, while `removeRights` will remove all rights flaged with `true`.
 *
 * ### config
 * This Object contains additional processing information.
 * Currently the following parameters are supported:
 *
 * - recursive: if `true`, all sub-elements will be processed
 * - storeAcl: Object which defines the store path: `{ type: "MAP", key: "OLD_ACL" }`. Currently only map fields are supported.
 * - asAdmin: if `true`, the rights will be altered in admin context.
 *
 * ## Compatibility
 * All usage of the permission right ('p' or 'perm') is only supported in ELO12 and later.
 *
 * @author ELO Digital Office GmbH
 *
 * @elojc
 * @eloas
 * @eloix
 * @requires sol.common.SordUtils
 * @requires sol.common.RepoUtils
 * @requires sol.common.UserUtils
 * @requires sol.common.JsonUtils
 * @requires sol.common.ObjectFormatter
 * @requires sol.common.Template
 * @requires sol.common.AsyncUtils
 */
sol.define("sol.common.AclUtils", {
  singleton: true,

  /**
   * @private
   * @property
   */
  sordZ: (function () {
    var sordZ = new SordZ(SordC.mbAcl);
    sordZ.add(SordC.mbAclItems);
    return sordZ;
  })(),

  /**
   * Adds rights to an archive entry/entries.
   *
   * The following example grants read, write and permission rights to the users "baum" and "renz" on exactly one object
   *
   *     sol.common.AclUtils.addRights(
   *       "4711",
   *       ["baum", "renz"],
   *       { r: true, w: true, d: false, e: false, l: false, p: true},
   *       { }
   *     );
   *
   * @param {String} objId The object which should be edited (if config has a `recursive` flag set to `true`, this object will be the starting point)
   * @param {String[]|Object[]} users If this contains strings, they serve as user names. If it contains objects, they have to contain a `name` property and an `rights` object. If empty, all existing ACL entries will be edited.
   * @param {Object} rights Object with flags for each right that should be added
   * @param {Object} config (optional) Additional configuration parameters
   * @param {Boolean} config.recursive (optional) Process children or not
   * @param {Object} config.storeAcl (optional) See example
   * @param {Boolean} config.asAdmin (optional) If `true` and admin context is available it will be used to perform the task
   * @param {Object[]} config.andGroups (optional) An array with and-group definitions (see {@link #changeRightsInBackground})
   */
  addRights: function (objId, users, rights, config) {
    var me = this;

    me.logger.enter("addRights", arguments);
    me.editRights(objId, users, rights, config, me.addSordRights);
    me.logger.exit("addRights");
  },

  /**
   * Removes rights from an archive entry/entries.
   *
   * The following example will remove all rights (exept for read) for all users, having access to the object (and all sub-objects)
   * and store the original right to an map field (OLC_ACL) for a later restore.
   *
   *     sol.common.AclUtils.removeRights(
   *       "4711",
   *       [],
   *       { read: false, write: true, del: true, edit: true, list: true, perm: true },
   *       { recursive: true, storeAcl: { type: "MAP", key: "OLD_ACL" } }
   *     );
   *
   * @param {String} objId The object which should be edited (if config has a `recursive` flag set to `true`, this object will be the starting point)
   * @param {String[]|Object[]} users If this contains strings, they serve as user names. If it contains objects, they have to contain a `name` property and an `rights` object. If empty, all existing ACL entries will be edited.
   * @param {Object} rights Object with flags for each right that should be removed
   * @param {Object} config (optional) Additional configuration parameters
   * @param {Boolean} config.recursive (optional) Process children or not
   * @param {Object} config.storeAcl (optional) See example
   * @param {Boolean} config.asAdmin (optional) If `true` and admin context is available it will be used to perform the task
   * @param {Object[]} config.andGroups (optional) An array with and-group definitions (see {@link #changeRightsInBackground})
   */
  removeRights: function (objId, users, rights, config) {
    var me = this;

    me.logger.enter("removeRights", arguments);
    // for backwards compatibility: remove p-right if nothing is specified
    if (!rights.hasOwnProperty("perm") && !rights.hasOwnProperty("p")) {
      rights.p = true;
    }
    me.editRights(objId, users, rights, config, me.removeSordRights);
    me.logger.exit("removeRights");
  },


  /**
   * Sets rights to an archive entry/entries.
   *
   * The following example grants read, write and permission rights to the users "baum" and "renz" on exactly one object
   *
   *     sol.common.AclUtils.setRights(
   *       "4711",
   *       ["baum", "renz"],
   *       { r: true, w: true, d: false, e: false, l: false, p: true},
   *       { }
   *     );
   *
   * @param {String} objId The object which should be edited (if config has a `recursive` flag set to `true`, this object will be the starting point)
   * @param {String[]|Object[]} users If this contains strings, they serve as user names. If it contains objects, they have to contain a `name` property and an `rights` object. If empty, all existing ACL entries will be edited.
   * @param {Object} rights Object with flags for each right that should be added
   * @param {Object} config (optional) Additional configuration parameters
   * @param {Boolean} config.recursive (optional) Process children or not
   * @param {Object} config.storeAcl (optional) See example
   * @param {Boolean} config.asAdmin (optional) If `true` and admin context is available it will be used to perform the task
   */
  setRights: function (objId, users, rights, config) {
    var me = this;

    me.logger.enter("setRights", arguments);
    me.editRights(objId, users, rights, config, me.setSordRights);
    me.logger.exit("setRights");
  },

  /**
   * Restores (saved) rights for an archive entry/entries.
   *
   * The following example will restore all rights which where stored to the specified map field.
   *
   *     sol.common.AclUtils.restoreRights(
   *       "4711",
   *       { recursive: true, storeAcl: { type: "MAP", key: "OLD_ACL" } }
   *     );
   *
   * @param {String} objId The object which should be edited (if config has a `recursive` flag set to `true`, this object will be the starting point)
   * @param {Object} config (optional) Additional configuration parameters
   * @param {Boolean} config.recursive (optional) Process children or not
   * @param {Object} config.storeAcl (optional) See example
   * @param {Boolean} config.asAdmin (optional) If `true` and admin context is available it will be used to perform the task
   */
  restoreRights: function (objId, config) {
    var me = this,
        elements;
    me.logger.enter("restoreRights", arguments);

    if (config && config.storeAcl) {
      elements = me.retrieveElements(objId, config.recursive, config.asAdmin, config);

      elements.forEach(function (sord) {
        me.restoreSordRights(sord, config);
      });
    }
    me.logger.exit("restoreRights");
  },

  /**
   * @private
   * @param {String} objId
   * @param {Array} users
   * @param {Object} rights
   * @param {Object} config
   * @param {Function} combineAclFunction
   */
  editRights: function (objId, users, rights, config, combineAclFunction) {
    var me = this,
        accessCode, asAdmin, recursive, storeAcl, userAcl, elements;

    accessCode = me.createAccessCode(rights);
    asAdmin = (config && config.asAdmin === true) ? true : false;
    recursive = (config && config.recursive === true) ? true : false;
    storeAcl = (config && config.storeAcl) ? config.storeAcl : null;
    userAcl = me.retrieveUserAcl(users, accessCode, asAdmin);
    elements = me.retrieveElements(objId, recursive, asAdmin, config);
    if (config && config.andGroups && (config.andGroups.length > 0)) {
      //we cannot change the array in the function appendAndGroupAcl because of reassigning kills the reference
      //so we have to do the reassignment here and then pass it to the function to get the result of the and-groups back
      userAcl = userAcl ? userAcl : [];
      me.appendAndGroupAcl(userAcl, objId, config, accessCode);
    }

    elements.forEach(function (sord) {
      me.editSordRights(sord, { combineAclFunction: combineAclFunction, newAclList: userAcl, accessCode: accessCode, storeAcl: storeAcl, asAdmin: asAdmin });
    });
  },

  /**
   * @private
   * @param {String[]|Object[]} users If this contains strings, they serve as user names. If it contains objects, they have to contain a `name` property and an `rights` object
   * @param {Number} accessCode
   * @param {Boolean} asAdmin
   * @return {de.elo.ix.client.AclItem[]}
   */
  retrieveUserAcl: function (users, accessCode, asAdmin) {
    var me = this,
        connection, tmpAccessCode, userNames, userAcl, userInfos, userInfo, i, max;

    connection = ((asAdmin === true) && (typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect;
    tmpAccessCode = null;

    if (users && users.length > 0) {
      userAcl = [];
      userNames = users.map(function (user) {
        return (user && user.hasOwnProperty && user.hasOwnProperty("name")) ? user.name : user + "";
      });

      userInfos = connection.ix().checkoutUsers(userNames, CheckoutUsersC.BY_IDS, LockC.NO);

      for (i = 0, max = userInfos.length; i < max; i++) {
        userInfo = userInfos[i];
        if (users[i] && users[i].hasOwnProperty && users[i].hasOwnProperty("rights")) {
          tmpAccessCode = me.createAccessCode(users[i].rights);
        }
        userAcl.push(me.createAclItemFromUserInfo(userInfo, tmpAccessCode || accessCode));
        tmpAccessCode = null;
      }
      return userAcl;
    }
    return null;
  },

  /**
   * @private
   * @param {Object} andGroup An and-group definition (see {@link #changeRightsInBackground})
   * @param {Number} defaultAccessCode
   * @param {Boolean} asAdmin
   * @return {de.elo.ix.client.AclItem}
   */
  retrieveAndGroupAcl: function (andGroup, defaultAccessCode, asAdmin) {
    var me = this,
        connection, groupsAccessCode, groupNames, groupInfos, userInfo, i, max,
        aclGroupsItem, idNameItem, idNames;

    connection = ((asAdmin === true) && (typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect;

    if (andGroup.groups && (andGroup.groups.length > 1)) {
      groupNames = andGroup.groups.map(function (group) {
        return (group && group.hasOwnProperty && group.hasOwnProperty("name")) ? group.name : group;
      });

      groupInfos = connection.ix().checkoutUsers(groupNames, CheckoutUsersC.BY_IDS, LockC.NO);
      if (andGroup.rights) {
        groupsAccessCode = me.createAccessCode(andGroup.rights);
      }

      aclGroupsItem = new AclItem();
      aclGroupsItem.id = groupInfos[0].id;
      aclGroupsItem.type = AclItemC.TYPE_GROUP;
      aclGroupsItem.access = groupsAccessCode || defaultAccessCode;
      idNames = [];
      for (i = 1, max = groupInfos.length; i < max; i++) {
        userInfo = groupInfos[i];
        // eslint-disable-next-line no-undef
        idNameItem = new IdName();
        idNameItem.name = String(userInfo.name);
        idNameItem.guid = String(userInfo.guid);
        idNameItem.id = String(userInfo.id);
        idNames.push(idNameItem);
      }
      aclGroupsItem.andGroups = idNames;
      return aclGroupsItem;
    }
    return null;
  },

  /**
   * @private
   * @param {de.elo.ix.client.Sord} sord
   * @param {Number} accessCode
   * @return {de.elo.ix.client.AclItem[]}
   */
  retrieveSordAcl: function (sord, accessCode) {
    var me = this,
        sordAcl, i, aclItem;
    me.logger.enter("retrieveSordAcl", arguments);
    sordAcl = [];

    if (sord && (sord instanceof Sord)) {
      for (i = 0; i < sord.aclItems.length; i++) {
        aclItem = sord.aclItems[i];
        sordAcl.push(me.createAclItemFromAcl(aclItem, accessCode));
      }
    }
    me.logger.exit("retrieveSordAcl", sordAcl);
    return sordAcl;
  },

  /**
   * @private
   * @param {String} objId
   * @param {Boolean} recursive
   * @param {Boolean} asAdmin   *
   * @param {*} config
   * @return {de.elo.ix.client.Sord[]}
   */
  retrieveElements: function (objId, recursive, asAdmin, config) {
    var me = this,
        connection = ((asAdmin === true) && (typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect,
        elements = [connection.ix().checkoutSord(objId, me.sordZ, LockC.NO)],
        createFindChildrenConfig = function (aConfig) {
          var findConfig = sol.common.ObjectUtils.clone(aConfig.findChildren || {});

          findConfig.includeFolders = typeof findConfig.includeFolders != "undefined" ? findConfig.includeFolders : true;
          findConfig.includeDocuments = typeof findConfig.includeDocuments != "undefined" ? findConfig.includeDocuments : true;
          findConfig.sordZ = me.sordZ;
          findConfig.recursive = typeof findConfig.recursive != "undefined" ? findConfig.recursive : true;
          findConfig.level = typeof findConfig.level != "undefined" ? findConfig.level : -1;

          return findConfig;
        };

    if (recursive === true) {
      return elements.concat(sol.common.RepoUtils.findChildren(
        objId,
        createFindChildrenConfig(config),
        connection
      ) || []);
    }
    return elements;
  },

  /**
   * @private
   * @param {de.elo.ix.client.AclItem[]} oldAclList
   * @param {de.elo.ix.client.AclItem[]} newAclList
   * @param {Boolean} asAdmin
   * @return {de.elo.ix.client.AclItem[]}
   */
  addSordRights: function (oldAclList, newAclList, asAdmin) {
    var connection, _result;

    connection = ((asAdmin === true) && (typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect;
    _result = connection.ix().combineAcl(oldAclList, newAclList, null).sum;
    return _result;
  },

  /**
   * @private
   * @param {de.elo.ix.client.AclItem[]} _oldAclList is not used here
   * @param {de.elo.ix.client.AclItem[]} newAclList
   * @param {Boolean} asAdmin
   * @return {de.elo.ix.client.AclItem[]}
   */
  setSordRights: function (_oldAclList, newAclList, asAdmin) {
    var connection;

    connection = ((asAdmin === true) && (typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect;
    return connection.ix().combineAcl(newAclList, null, null).sum;
  },

  /**
   * @private
   * @param {de.elo.ix.client.AclItem[]} oldAclList
   * @param {de.elo.ix.client.AclItem[]} newAclList
   * @param {Boolean} asAdmin
   * @return {de.elo.ix.client.AclItem[]}
   */
  removeSordRights: function (oldAclList, newAclList, asAdmin) {
    var connection, _result;

    connection = ((asAdmin === true) && (typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect;
    _result = connection.ix().combineAcl(oldAclList, newAclList, null).difference;
    return _result;
  },

  /**
   * @private
   * @param {de.elo.ix.client.Sord[]} sord
   * @param {Object} params
   */
  editSordRights: function (sord, params) {
    var me = this,
        connection, oldAclList, oldAclString;

    connection = ((params.asAdmin === true) && (typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect;
    oldAclList = sord.aclItems;
    oldAclString = sord.acl;

    if (params.storeAcl) {
      switch (params.storeAcl.type) {
        case "MAP":
          connection.ix().checkinMap(MapDomainC.DOMAIN_SORD, sord.id, sord.id, [new KeyValue(params.storeAcl.key, oldAclString)], LockC.NO);
          break;
        case "GRP":
          throw "store ACL to group is not implemented yet";
        default:
          throw "unkown field type";
      }
    }

    if (!params.newAclList) {
      params.newAclList = me.retrieveSordAcl(sord, params.accessCode);
    }

    sord.aclItems = params.combineAclFunction(oldAclList, params.newAclList, params.asAdmin);

    connection.ix().checkinSord(sord, me.sordZ, LockC.NO);
  },

  /**
   * @private
   * @param {de.elo.ix.client.Sord} sord
   * @param {Object} params
   */
  restoreSordRights: function (sord, params) {
    var me = this,
        connection, mapItems;

    connection = ((params.asAdmin === true) && (typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect;

    if (params.storeAcl.type === "MAP") {
      mapItems = connection.ix().checkoutMap(MapDomainC.DOMAIN_SORD, sord.id, [params.storeAcl.key], LockC.NO).items;
      if (mapItems && mapItems.length === 1) {
        sord.acl = mapItems[0].value;
        sord.aclItems = null;
        connection.ix().checkinSord(sord, me.sordZ, LockC.NO);
        connection.ix().deleteMap(MapDomainC.DOMAIN_SORD, sord.id, [params.storeAcl.key], LockC.NO);
      }
    }
  },

  /**
   * @private
   * @param {de.elo.ix.client.UserInfo} userInfo
   * @param {Number} accessCode
   * @return {de.elo.ix.client.AclItem}
   */
  createAclItemFromUserInfo: function (userInfo, accessCode) {
    var aclItem;

    aclItem = new AclItem();
    aclItem.id = userInfo.id;
    aclItem.type = (userInfo.type == UserInfoC.TYPE_GROUP) ? AclItemC.TYPE_GROUP : AclItemC.TYPE_USER;
    aclItem.access = accessCode;
    return aclItem;
  },

  /**
   * @private
   * @param {de.elo.ix.client.AclItem} aclItem
   * @param {Number} accessCode
   * @return {de.elo.ix.client.AclItem}
   */
  createAclItemFromAcl: function (aclItem, accessCode) {
    var me = this,
        newAclItem, i, newAndGroups, idName, newIdName;
    me.logger.enter("createAclItemFromAcl", arguments);

    newAclItem = new AclItem();
    newAclItem.id = aclItem.id;
    newAclItem.type = aclItem.type;
    newAclItem.access = accessCode;

    if (aclItem.andGroups && (aclItem.andGroups.length > 0)) {
      newAndGroups = [];
      for (i = 0; i < aclItem.andGroups.length; i++) {
        idName = aclItem.andGroups[i];
        // eslint-disable-next-line no-undef
        newIdName = new IdName();
        newIdName.id = idName.id;
        newIdName.name = idName.name;

        newAndGroups.push(newIdName);
      }
      newAclItem.andGroups = newAndGroups;
    }

    me.logger.exit("createAclItemFromAcl", newAclItem);
    return newAclItem;
  },

  /**
   * @private
   * @param {Object} rights
   * @return {Number}
   */
  createAccessCode: function (rights) {
    var me = this,
        code;

    code = 0;
    if (!rights) {
      throw "Rights are empty";
    }

    if ((rights.read === true) || (rights.r === true)) {
      code |= AccessC.LUR_READ;
    }
    if ((rights.write === true) || (rights.w === true)) {
      code |= AccessC.LUR_WRITE;
    }
    if ((rights.del === true) || (rights.d === true)) {
      code |= AccessC.LUR_DELETE;
    }
    if ((rights.edit === true) || (rights.e === true)) {
      code |= AccessC.LUR_EDIT;
    }

    if ((rights.list === true) || (rights.l === true)) {
      code |= AccessC.LUR_LIST;
    }

    if (((rights.perm === true) || (rights.p === true)) && (me.isAccessCodePermissionAvailable())) {
      code |= AccessC.LUR_PERMISSION;
    }

    return code;
  },

  /**
   * Is the access code `permission` available
   * Check must be compatible with Rhino, Nashorn and GraalVM
   *
   * @returns {Boolean}
   */
  isAccessCodePermissionAvailable: function () {
    var me = this,
        accessC, accessCClass;

    if (typeof me.accessCodePermissionAvailable == "undefined") {
      accessC = new AccessC;
      accessCClass = accessC.getClass();
      me.accessCodePermissionAvailable = me.hasClassField(accessCClass, "LUR_PERMISSION");
    }

    return me.accessCodePermissionAvailable;
  },

  /**
   * @private
   * @param {java.lang.Class} clazz
   * @param {String} fieldName
   * @return {Boolean} Has class field
   */
  hasClassField: function (clazz, fieldName) {
    var fields, i, field;

    fields = clazz.getDeclaredFields();

    for (i = 0; i < fields.length; i++) {
      field = fields[i];
      if (field.name == fieldName) {
        return true;
      }
    }

    return false;
  },

  /**
   * Sets or adds the rights by a background IX thread.
   *
   * Examples:
   *
   *     var jobState = sol.common.AclUtils.changeRightsInBackground("ARCPATH:/AclTest/Acl1", { inherit: true, users: ["weiler", {name: "zipfel", rights:{r: true, w: true, p: true}}], rights: { r: true } });
   *     var jobState = sol.common.AclUtils.changeRightsInBackground("ARCPATH:/AclTest/Acl1", { mode: "SET", users: ["zipfel"], rights: { r: true } });
   *     var jobState = sol.common.AclUtils.changeRightsInBackground("ARCPATH:/AclTest/Acl1", { mode: "SET", users: ["weiler", { name: "zipfel", rights:{ r: true, w: true } }], rights: { r: true }, andGroups: { groups: ["Pubsec.Registratur", { name: "Pubsec.Sachbearbeiter" }], rights: { d: true } } });
   *     var jobState = sol.common.AclUtils.changeRightsInBackground("ARCPATH:/AclTest/Acl1", { mode: "ADD", users: [{ "type": "GRP", "key": "CONTRACT_RESPONSIBLE", "rights": { "r": true, "w": true, "d": false, "e": false, "l": false } }] });
   *     var jobState = sol.common.AclUtils.changeRightsInBackground("ARCPATH:/AclTest/Acl1", { mode: "ADD", users: [{ "type": "GRP", "key": "CONTRACT_RESPONSIBLE", "mode": "SUPERVISOR", "supervisorLevel": 0, "rights": { "r": true, "w": true, "d": false, "e": false, "l": false } }] });
   *
   * Example with and-groups
   * (sets an and-group with the groups 'GroupA', 'GroupB' and the group from the CONTRACT_RESPONSIBLE field with read only,
   * as well as an and-group with the groups 'GroupX' and 'GroupY' with write access):
   *
   *     var jobState = sol.common.AclUtils.changeRightsInBackground("ARCPATH:/AclTest/Acl1", {
   *       mode: "SET",
   *       andGroups: [
   *         { groups: ["GroupA", "GroupB", { type: "GRP", key: "CONTRACT_RESPONSIBLE" }] },
   *         { groups: ["GroupX", "GroupY"], rights: { r: true, w: true } }
   *       ],
   *       rights: { r: true } // default rights
   *     });
   *
   * User or group names can be created using handlbars syntax (if the value will be read from an indexfield, that value could also contain handlebars syntax):
   *
   *     var jobState = sol.common.AclUtils.changeRightsInBackground("ARCPATH:/AclTest/Acl1", {
   *       mode: "ADD",
   *       users: [
   *         "LEGAL_DEP_{{sord.objKeys.CONTRACT_DEPARTMENT}}",
   *         { name: "CONTROLLING_{{sord.objKeys.CONTRACT_DEPARTMENT}}", rights: { r: true, w: true } }
   *       ],
   *       rights: { r: true } // default rights
   *     });
   *
   * @param {String|String[]} objId Object ID of the object which will be changed or an array with start ids where each will be prosessed. If an array of ids is used, the parameter `config.srcObjId` is mandatory.
   * @param {Object} config Configuration
   * @param {String} [config.mode="ADD"] "ADD", "SET" or "REMOVE" rights
   * @param {Object} config.inherit Inheritance configuration
   * @param {Boolean} config.inherit.fromDirectParent Inherit the ACL from the direct parent (default)
   * @param {Boolean} config.inherit.aclSrcObjId Source object ID for the ACL inheritance
   * @param {String[]} config.inherit.solutionObjectTypes Solution object types to find the ACL source object in the hierachy
   * @param {String[]|Object[]} config.users If this contains strings, they serve as user names. If it contains objects, they have to contain a `name` property and an `rights` object
   * @param {Object[]} config.andGroups An array with and-group definitions
   * @param {String[]|Object[]} config.andGroups.groups The groups contained in an and-group. Defined in the same way as `config.users` (but without the `rights` property).
   * If the `groups` array contains less than two entries the that and-group definition will be ignored.
   * @param {Object[]} config.andGroups.rights The rights of an and-group if deviant from fallback (`config.rights`)
   * @param {String} config.srcObjId If set, the user configurations will be read from this object instead of `objId`. Only mandatory if `objId` is an array.
   * @param {Object} config.rights Additional rights, e.g. { read: false, write: true, del: true, edit: true, list: true, perm: true }
   * @param {Boolean} [config.recursive=true] If true the ACL of the children will also be changed. Default is true.
   * @param {Boolean} [config.dontWait=false] Don't wait for the background process. Default is false (synchronous).
   * @param {String} config.flowId Flow ID to determine the values of flow map fields
   * @return {de.elo.ix.client.JobState}
   */
  changeRightsInBackground: function (objId, config) {
    var me = this,
        logObj = { objId: String(objId), config: config },
        newAclItems = [],
        conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect,
        processObjIds, metadataObjId, defaultAccessCode, jobState;

    me.logger.enter("changeRightsInBackground", logObj);

    config = config || {};

    me.checkPreconditions(objId, config);

    processObjIds = (sol.common.ObjectUtils.isArray(objId)) ? objId : [objId];
    metadataObjId = config.srcObjId || objId;

    me.initializeRights(newAclItems, metadataObjId, config, conn);

    defaultAccessCode = me.createAccessCode(config.rights);

    me.appendInheritedAcl(newAclItems, metadataObjId, config, conn);
    me.appendUserAcl(newAclItems, metadataObjId, config, defaultAccessCode);
    me.appendAndGroupAcl(newAclItems, metadataObjId, config, defaultAccessCode);

    if (me.canExecute(config.mode, newAclItems)) {
      jobState = me.executeBackgroundAclJob(conn, processObjIds, config, newAclItems);
    } else {
      jobState = null;
      me.logger.warn("no acl items to set/add/remove -> skip processing");
    }

    me.logger.exit("changeRightsInBackground", jobState);

    return jobState;
  },

  /**
   * @private
   * Checks the preconditions and throws an exception if they are not meet.
   * @param {String|String[]} objId
   * @param {Object} config
   */
  checkPreconditions: function (objId, config) {
    if (!objId) {
      throw "Object ID is empty";
    }

    if (sol.common.ObjectUtils.isArray(objId) && !config.srcObjId) {
      throw "If 'objId' is configured as array, the config paramater 'srcObjId' is mandatory.";
    }
  },

  /**
   * @private
   * Checks and initializes the rights config.
   * @param {de.elo.ix.client.AclItem[]} newAclItems
   * @param {String} objId
   * @param {Object} config
   * @param {de.elo.ix.client.IXConnection} conn
   */
  initializeRights: function (newAclItems, objId, config, conn) {
    var sord;
    if (config.mode == "REMOVE") {
      config.rights = config.rights || { read: false, write: true, del: true, edit: true, list: true, perm: true };
      if (!config.users) {
        sord = conn.ix().checkoutSord(objId, new SordZ(SordC.mbAclItems), LockC.NO);
        newAclItems = sord.aclItems;
      }
    } else {
      config.rights = config.rights || { read: true, write: true, del: true, edit: true, list: true, perm: true };
      if (!config.users && !config.andGroups && !config.inherit) {
        throw "Users, andGroups or inheritance must be set";
      }
    }
  },

  /**
   * @private
   * Appends the inherited ACL items to the `newAclItems` array as configured.
   * @param {de.elo.ix.client.AclItem[]} newAclItems
   * @param {String} objId
   * @param {Object} config
   * @param {de.elo.ix.client.IXConnection} conn
   */
  appendInheritedAcl: function (newAclItems, objId, config, conn) {
    var aclSrcSord, sord, i, aclItem;

    if (config.inherit) {
      if (config.inherit.aclSrcObjId) {
        aclSrcSord = conn.ix().checkoutSord(config.inherit.aclSrcObjId, new SordZ(SordC.mbAclItems), LockC.NO);
      } else if (config.inherit.solutionObjectTypes) {
        aclSrcSord = sol.common.RepoUtils.findObjectTypeInHierarchy(objId, config.inherit.solutionObjectTypes, { connection: conn });
      } else {
        sord = conn.ix().checkoutSord(objId, SordC.mbMin, LockC.NO);
        if (sord.parentId > 0) {
          aclSrcSord = conn.ix().checkoutSord(sord.parentId, new SordZ(SordC.mbAclItems), LockC.NO);
        }
      }

      if (aclSrcSord) {
        for (i = 0; i < aclSrcSord.aclItems.length; i++) {
          aclItem = aclSrcSord.aclItems[i];
          newAclItems.push(aclItem);
        }
      }
    }
  },

  /**
   * @private
   * Appends the user ACL items to the `newAclItems` array as configured.
   * @param {de.elo.ix.client.AclItem[]} newAclItems
   * @param {String} objId
   * @param {Object} config
   * @param {Number} defaultAccessCode
   */
  appendUserAcl: function (newAclItems, objId, config, defaultAccessCode) {
    var me = this,
        users, userAcls;
    users = me.preprocessUsers(objId, config.users, config);
    userAcls = me.retrieveUserAcl(users, defaultAccessCode);
    if (userAcls) {
      userAcls.forEach(function (userAcl) {
        newAclItems.push(userAcl);
      });
    }
  },

  /**
   * @private
   * Appends the and-group ACL items to the `newAclItems` array as configured.
   * @param {de.elo.ix.client.AclItem[]} newAclItems
   * @param {String} objId
   * @param {Object} config
   * @param {Number} defaultAccessCode
   */
  appendAndGroupAcl: function (newAclItems, objId, config, defaultAccessCode) {
    var me = this;
    if (config.andGroups && (config.andGroups.length > 0)) {
      config.andGroups.forEach(function (andGroup) {
        var andGroupAcl;
        andGroup.groups = me.preprocessUsers(objId, andGroup.groups, config);
        andGroupAcl = me.retrieveAndGroupAcl(andGroup, defaultAccessCode);
        if (andGroupAcl) {
          newAclItems.push(andGroupAcl);
        }
      });
    }
  },

  /**
   * @private
   * Checks, if the background processing should be executed.
   *
   * If mode is `SET` or `REPLACE` this always returns `true`, else it checks if there are acl items.
   * @param {String} mode
   * @param {Object[]} aclItems
   * @return {Boolean}
   */
  canExecute: function (mode, aclItems) {
    if ((mode == "SET") || (mode == "REPLACE")) {
      return true;
    }

    return aclItems && (aclItems.length > 0);
  },

  /**
   * @private
   * Executes the background processing of the rights.
   * @param {de.elo.ix.client.IXConnection} conn
   * @param {String[]} startIds
   * @param {Object} config
   * @param {de.elo.ix.client.AclItem[]} newAclItems
   * @return {de.elo.ix.client.JobState}
   */
  executeBackgroundAclJob: function (conn, startIds, config, newAclItems) {
    var me = this,
        procInfo, navInfo, jobState;

    me.logger.enter("executeBackgroundAclJob");

    procInfo = new ProcessInfo();
    procInfo.desc = (config.mode || "ADD") + " ACL";
    procInfo.errorMode = ProcessInfoC.ERRORMODE_SKIP_PROCINFO;
    procInfo.procAcl = new ProcessAcl();

    if (!newAclItems) {
      me.logger.warn("'newAclItems' are missing. Skip ACL job.");
      return;
    }

    if ((config.mode == "SET") || (config.mode == "REPLACE")) {
      procInfo.procAcl.setAclItems = newAclItems;
    } else if (config.mode == "REMOVE") {
      procInfo.procAcl.subAclItems = newAclItems;
    } else {
      procInfo.procAcl.addAclItems = newAclItems;
    }

    navInfo = new NavigationInfo();
    navInfo.startIDs = startIds;
    navInfo.maxDepth = (config.recursive === false) ? 1 : 0;

    jobState = conn.ix().processTrees(navInfo, procInfo);

    if (!config.dontWait && !me.ixExecutesBackgroundJobsSynchronous(conn)) {
      jobState = sol.common.AsyncUtils.waitForJob(jobState.jobGuid, { connection: conn });
    }

    me.logger.exit("executeBackgroundAclJob", jobState);

    return jobState;
  },

  /**
   * @private
   * Checks if the IX version processes background jobs synchronous.
   * This is true for IX version higher than '9.18.060', '10.18.060' and '11.01.000'.
   * @param {de.elo.ix.client.IXConnection} conn The connection wich is used to determine the IX version.
   * @return {Boolean}
   */
  ixExecutesBackgroundJobsSynchronous: function (conn) {
    return sol.common.RepoUtils.checkVersions(conn.clientVersion, ["9.18.060", "10.18.060", "11.01.000"]);
  },

  /**
   * Preprocesses users.
   * Retrieves user names from index fields.
   * If a user name or the retrieved value contains handlebars syntax, the sord will be applied to that string.
   * @param {String} objId Object ID
   * @param {String[]|Number[]|Object[]} users Array of user defintions. all Types can be mixed.
   * @param {Object} params Parameters
   * @param {String} params.flowId Workflow ID
   * @return {Object[]}
   *
   * # Example of the parameter 'users':
   *     [
   *       "mustermannm",
   *       23,
   *       { "type": "GRP", "key": "CONTRACT_RESPONSIBLE", "rights": { "r": true, "w": true, "d": false, "e": false, "l": false, "p": true } },
   *       { "type": "GRP", "key": "CONTRACT_DEPARTMENT", "rights": { "r": true, "w": true, "d": false, "e": false, "l": false, "p": true } },
   *       { "type": "GRP", "key": "CONTRACT_PROCUREMENT", "rights": { "r": true, "w": true, "d": false, "e": false, "l": false, "p": false } },
   *       { "name": "LEGAL_DEP_{{sord.objKeys.CONTRACT_DEPARTMENT}}", "rights": { "r": true, "w": false, "d": false, "e": false, "l": false, "p": false } }
   *     ]
   */
  preprocessUsers: function (objId, users, params) {
    var me = this,
        ctxSord = { objId: objId },
        conn, userCfgs;

    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;

    userCfgs = [];
    if (users && (users.length > 0)) {
      users = JSON.parse(sol.common.JsonUtils.stringifyAll(users));
      users.forEach(function (user) {
        var userNames = [],
            rawUserNames, rawUserName, userName, i, supervisorLevel, userInfos, sord;

        if (sol.common.ObjectUtils.isString(user) || sol.common.ObjectUtils.isNumber(user)) {
          user = me.replaceUserNamePlaceholders(String(user), ctxSord, conn, params.flowId);
          if (user) {
            userCfgs.push(user);
          }
        } else if (!user.name && user.type && user.key) {
          try {
            sord = me.enrichContextSord(ctxSord, false, conn, params.flowId).sord;

            if ((user.type == "WFMAP") && (params.flowId)) {
              rawUserName = sol.common.WfUtils.getWfMapValue(params.flowId, user.key);
              rawUserNames = (rawUserName) ? [rawUserName] : [];
            } else {
              rawUserNames = sol.common.SordUtils.getValues(sord, user);
            }

            supervisorLevel = user.supervisorLevel || 0;

            rawUserNames = rawUserNames || [];

            for (i = 0; i < rawUserNames.length; i++) {
              rawUserName = rawUserNames[i];
              userName = rawUserName;

              if (user.mode && (user.mode.toUpperCase() == "SUPERVISOR")) {
                userName = sol.common.UserUtils.getSupervisorOfLevel(rawUserName, supervisorLevel);
                if (!userName) {
                  me.logger.debug("Can't find supervisor: userName={0}", rawUserName);
                }
              }

              if (userName) {
                userNames.push(userName);
              }
            }

            if (userNames.length > 0) {
              userInfos = ixConnect.ix().checkoutUsers(userNames, CheckoutUsersC.BY_IDS, LockC.NO);
            }

            if (userInfos && (userInfos.length > 0)) {
              userInfos.forEach(function (userInfo) {
                var tmpUser = JSON.parse(sol.common.JsonUtils.stringifyAll(user)); // copy current user configuration for each user in the list
                tmpUser.name = me.replaceUserNamePlaceholders(userInfo.name, ctxSord, conn, params.flowId);
                if (tmpUser) {
                  userCfgs.push(tmpUser);
                }
              });
            }
          } catch (ignore) {
            me.logger.debug("error determining user(s)", ignore);
          }
        } else {
          user.name = me.replaceUserNamePlaceholders(user.name, ctxSord, conn, params.flowId);
          if (user && user.name) {
            userCfgs.push(user);
          }
        }
      });

      me.logger.debug(["preprocessUsers(): resolvedUsers={0}", JSON.stringify(userCfgs)]);

      return userCfgs;
    }
  },

  /**
   * @private
   * Replace user name place holders:
   *
   * - If `userName` equals '$CURRENTUSER' the current session user will be used.
   * - If `username` contains handlebars syntax, the sord will be applied to it
   *
   * @param {String} userName
   * @param {Object} ctxSord (optional) only used if `userName` contains handlebars syntax
   * @param {de.elo.ix.client.IXConnection} conn (optional) only used if `userName` contains handlebars syntax
   * @param {String} flowId (optional)
   * @return {String} Username
   */
  replaceUserNamePlaceholders: function (userName, ctxSord, conn, flowId) {
    var me = this,
        tplSord;

    userName = (userName || "") + "";

    if (userName == "$CURRENTUSER") {
      return String(ixConnect.loginResult.user.name);
    }
    if (userName.indexOf("{{") > -1) {
      tplSord = me.enrichContextSord(ctxSord, true, conn, flowId).tplSord;
      return sol.create("sol.common.Template", { source: userName }).apply(tplSord);
    }
    return userName;
  },

  /**
   * @private
   * Prefills the context object with sord and if requested with a template sord.
   * @param {Object} ctxSord
   * @param {Boolean} inclTplSord
   * @param {de.elo.ix.client.IXConnection} conn
   * @param {String} flowId (optional)
   * @return {Object} The ctxSord itself after enrichment
   */
  enrichContextSord: function (ctxSord, inclTplSord, conn, flowId) {
    if (!ctxSord.sord) {
      if (!ctxSord.objId) {
        throw "Object ID is empty";
      }
      ctxSord.sord = conn.ix().checkoutSord(ctxSord.objId, SordC.mbAllIndex, LockC.NO);
    }
    if (inclTplSord && !ctxSord.tplSord) {
      ctxSord.tplSord = flowId
        ? sol.common.WfUtils.getTemplateSord(ctxSord.sord, flowId)
        : sol.common.SordUtils.getTemplateSord(ctxSord.sord);
    }
    return ctxSord;
  },

  /**
   * Checks wether the users object contains the session user und the session user has already the effective rights
   * @param {Object} rightsConfig Rights configuration
   * @param {String} rightsConfig.objId Object ID
   * @param {Object} rightsConfig.rights Rights
   * @return {Boolean}
   */
  containsSessionUserAndhasEffectiveRights: function (rightsConfig) {
    var me = this,
        currUserName, effectiveRights;

    if (rightsConfig && rightsConfig.objId && rightsConfig.rights && rightsConfig.users && (rightsConfig.users.length == 1) && sol.common.ObjectUtils.isString(rightsConfig.users[0])) {
      currUserName = ixConnect.loginResult.user.name;
      if (rightsConfig.users[0] == currUserName) {
        effectiveRights = me.hasEffectiveRights(rightsConfig.objId, rightsConfig.rights);
        return effectiveRights;
      }
    }

    return false;
  },

  /**
   * Checks wether the current user has effective rights
   * @param {String|de.elo.ix.client.Sord} sord Object ID or Sord
   * @param {Object} params Parameters
   * @param {Object} params.rights Rights
   * @return {Boolean}
   */
  hasEffectiveRights: function (sord, params) {
    var me = this,
        hasRights = false, accessCode;

    if (!sord) {
      throw "Object ID is empty";
    }

    params = params || {};
    params.rights = params.rights || { r: true, w: true, d: true, e: true, l: true, p: true };

    try {
      if (!(sord instanceof Sord) || !sord.aclItems) {
        sord = ixConnect.ix().checkoutSord(sord, new SordZ(SordC.mbAclItems), LockC.NO);
      }

      accessCode = sol.common.AclUtils.getAccessCode(sord);

      hasRights = me.containsRights(accessCode, params.rights);
    } catch (ignore) {
      // ignore
    }

    return hasRights;
  },

  accessCodes: {
    r: AccessC.LUR_READ,
    read: AccessC.LUR_READ,
    w: AccessC.LUR_WRITE,
    write: AccessC.LUR_WRITE,
    d: AccessC.LUR_DELETE,
    del: AccessC.LUR_DELETE,
    e: AccessC.LUR_EDIT,
    edit: AccessC.LUR_EDIT,
    l: AccessC.LUR_LIST,
    list: AccessC.LUR_LIST,
    p: new AccessC().LUR_PERMISSION, // 'new' is necessary, because it throws no exception if property does not exist (prior to ELO12)
    perm: new AccessC().LUR_PERMISSION // 'new' is necessary, because it throws no exception if property does not exist (prior to ELO12)
  },

  /**
   * Checks wether the access code contains the requested rights
   * @param {Number} accessCode Access code
   * @param {Object} rights Rights
   * @return {Boolean}
   */
  containsRights: function (accessCode, rights) {
    var me = this,
        rightKey, accessFlag;

    if ((typeof accessCode === "undefined") || (typeof rights === "undefined")) {
      return true;
    }

    for (rightKey in rights) {
      if (rights.hasOwnProperty(rightKey)) {
        accessFlag = me.accessCodes[rightKey];
        if (accessFlag && ((accessCode & accessFlag) == 0)) {
          return false;
        }
      }
    }

    return true;
  },

  /**
   * Returns an object with the access rights of the current user on a sord.
   * @param {de.elo.ix.client.Sord} sord
   * @returns {Object}
   */
  getAccessRights: function (sord) {
    var accessCode;

    accessCode = sol.common.AclUtils.getAccessCode(sord);
    return sol.common.AclUtils.getAccessRightsByAccessCode(accessCode);
  },

  /**
   * Returns an object with the access rights of the given accessCode.
   * @param {number} accessCode
   * @returns {Object}
   */
  getAccessRightsByAccessCode: function (accessCode) {
    var accessRights = {
      r: sol.common.AclUtils.containsRights(accessCode, { r: true }),
      w: sol.common.AclUtils.containsRights(accessCode, { w: true }),
      d: sol.common.AclUtils.containsRights(accessCode, { d: true }),
      e: sol.common.AclUtils.containsRights(accessCode, { e: true }),
      l: sol.common.AclUtils.containsRights(accessCode, { l: true }),
      p: sol.common.AclUtils.containsRights(accessCode, { p: true })
    };

    return accessRights;
  },

  /**
   * Returns the access code of the given sord object
   * @param {String|de.elo.ix.client.Sord} sord Object ID or Sord
   * @param {Object} params Parameters
   * @param {de.elo.ix.client.IXConnection} params.connection Index server connection
   * @returns {number} access code
   */
  getAccessCode: function (sord, params) {
    var aclAccessInfo, conn, access;

    params = params || {};
    params.connection = params.connection || ixConnect;

    conn = params.connection;

    aclAccessInfo = new AclAccessInfo();
    if (!(sord instanceof Sord) || !sord.aclItems) {
      sord = conn.ix().checkoutSord(sord, new SordZ(SordC.mbAclItems), LockC.NO);
    }
    aclAccessInfo.aclItems = sord.aclItems;
    access = conn.ix().getAclAccess(aclAccessInfo).access;

    return access;
  }
});
