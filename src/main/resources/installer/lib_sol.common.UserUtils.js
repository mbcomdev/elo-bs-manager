
importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js
//@include lib_sol.common.Cache.js
//@include lib_sol.common.RepoUtils.js

/*
 * Local definition of the class `sol.common.Cache` for backward compatibility of previous solution packages.
 */
if (!sol.ClassManager.getClass("sol.common.Cache")) {
  sol.define("sol.common.Cache", {

    initialize: function (config) {
      var me = this;
      me.cache = new java.util.concurrent.ConcurrentHashMap(8, 0.9, 1);
    },

    /**
     * Inserts the specified key-value pair into the cache.
     * @param {String} key
     * @param {Object} value
     * @return {Object} The previous value associated with the key, or null if there was no mapping before
     */
    put: function (key, value) {
      var me = this;
      return me.cache.put(key, value);
    },

    /**
     * Inserts all key-value pairs specified by an object into the cache. Existing mappings will be replaced.
     * @param {Object} data Property names will be used as keys and the associated values as values.
     */
    putAll: function (data) {
      var me = this;
      me.cache.putAll(data);
    },

    /**
     * Tests if the specified object is a key in the cache.
     * @param {String} key
     * @return {Boolean}
     */
    containsKey: function (key) {
      var me = this;
      return me.cache.containsKey(key);
    },

    /**
     * Returns the value for the specified key from the cache, or null if the chache contains no mapping for the key.
     * @param {String} key
     * @return {Object}
     */
    get: function (key) {
      var me = this;
      return me.cache.get(key);
    },

    /**
     * Returns an enumeration of all keys in the cache.
     * @return {Object} An `java.util.Enumeration` of all keys
     */
    keys: function () {
      var me = this;
      return me.cache.keys();
    },

    /**
     * Returns a collection view of the values contained in the cache.
     * @return {Object} An `java.util.Collection` of all values
     */
    values: function () {
      var me = this;
      return me.cache.values();
    },

    /**
     * Returns an enumeration of the values in the cache.
     * @return {Object} An `java.util.Enumeration` of all values
     */
    elements: function () {
      var me = this;
      return me.cache.elements();
    },

    /**
     * Removes the key (and its corresponding value) from the cache.
     * @param {String} key
     * @return {Object} The previous value associated with the key, or null if there was no value for the key
     */
    remove: function (key) {
      var me = this;
      return me.cache.remove(key);
    },

    /**
     * Returns the number of key-value pairs in the cache.
     * @return {Number}
     */
    size: function () {
      var me = this;
      return me.cache.size();
    },

    /**
     * Returns `true` if the chache contains no key-value pairs.
     * @return {Boolean}
     */
    isEmpty: function () {
      var me = this;
      return me.cache.isEmpty();
    },

    /**
     * Removes all of the mappings from the cache.
     */
    clear: function () {
      var me = this;
      me.cache.clear();
    }
  });
}

/**
 * User utilities
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.03.000
 *
 * @elojc
 * @eloas
 * @eloix
 *
 * @requires sol.common.Cache
 * @requires sol.common.JsonUtils
 * @requires sol.common.RepoUtils
 */
sol.define("sol.common.UserUtils", {
  singleton: true,
  requires: ["sol.common.Cache"],

  usersById: null,
  usersByGuid: null,
  usersByName: null,

  /**
   * @private
   * @property {sol.common.Cache} adminUsersById
   * The optimized cache for administrative users.
   * This will be initialized with all administrative users on first access.
   */

  /**
   * @private
   * @property {sol.common.Cache} serviceUsersById
   * The optimized cache for service users.
   * This will be initialized with all service users on first access.
   */

  initialize: function (config) {
    var me = this;
    me.$super("sol.Base", "initialize", [config]);
    me.usersById = sol.create("sol.common.Cache");
    me.usersByGuid = sol.create("sol.common.Cache");
    me.usersByName = sol.create("sol.common.Cache");
  },

  /**
   * Retrieves UserInfo objects.
   * @param {String[]} users The names, GUIDs or IDs of the users
   * @return {de.elo.ix.client.UserInfo[]} The retrieved UserInfo objects
   */
  getUserInfos: function (users) {
    var me = this,
        result;

    if (!users) {
      return;
    }

    me.requireUserInfos(users);

    result = users.map(function (user) {
      return me.getUserInfoFromCache(user);
    });

    return result;
  },

  /**
   * Load user infos into the cache
   * @param {Array} users
   */
  requireUserInfos: function (users) {
    var me = this,
        userInfos, i, userInfo;

    users = users.filter(function (user) {
      userInfo = me.getUserInfoFromCache(user);
      return !userInfo;
    });

    if (users && (users.length > 0)) {
      userInfos = ixConnect.ix().checkoutUsers(users, CheckoutUsersC.BY_IDS, LockC.NO);
      for (i = 0; i < userInfos.length; i++) {
        userInfo = userInfos[i];
        me.writeUserInfoToCache(userInfo);
      }
    }
  },

  /**
   * @private
   * Write user info into the cache
   * @param  {de.elo.ix.client.UserInfo} userInfo
   */
  writeUserInfoToCache: function (userInfo) {
    var me = this,
        osName, userName;

    me.usersById.put(userInfo.id + "", userInfo);
    userName = (userInfo.name + "").toLowerCase();
    me.usersByName.put(userName, userInfo);
    if (userInfo.userProps && (userInfo.userProps.length > UserInfoC.PROP_NAME_OS)) {
      osName = (userInfo.userProps[UserInfoC.PROP_NAME_OS] + "").toLowerCase();
      if (osName) {
        me.usersByName.put(osName, userInfo);
      }
    }
    me.usersByGuid.put(userInfo.guid + "", userInfo);
  },

  /**
   * @private
   * Retrieves the user info from the cache
   * @param {String} user User ID or name
   * @return {de.elo.ix.client.UserInfo} User info
   */
  getUserInfoFromCache: function (user) {
    var me = this,
        userName;

    user += "";

    if (me.isUserId(user)) {
      return me.usersById.get(user);
    } else if (me.isUserGuid(user)) {
      return me.usersByGuid.get(user);
    } else {
      userName = (user + "").toLowerCase();
      return me.usersByName.get(userName);
    }
  },

  /**
   * Checks wether the given string is a user ID
   * @param {String} user User
   * @return {Boolean}
   */
  isUserId: function (user) {
    return /^\d+$/.test(user);
  },

  /**
   * Checks wether the given string is a user GUID
   * @param {String} user User
   * @return {Boolean}
   */
  isUserGuid: function (user) {
    return /^\(\w{8}-\w{4}-\w{4}-\w{4}-\w{12}\)$/.test(String(user));
  },

  /**
   * Retrieves an UserInfo object.
   *
   * If the parameter is already an UserInfo, it returns the object itself.
   * Therefore this function can be used to make sure you're dealing with an UserInfo and not just a user name.
   *
   * @param {String|de.elo.ix.client.UserInfo} user The name, GUID or ID of the user (or an UserInfo object)
   * @return {de.elo.ix.client.UserInfo} The UserInfo object, if one was found
   */
  getUserInfo: function (user) {
    var me = this,
        userInfos, _result;
    me.logger.enter("getUserInfo", arguments);
    if (user instanceof UserInfo) {
      return user;
    }
    userInfos = me.getUserInfos([user]);

    _result = (userInfos && userInfos.length > 0) ? userInfos[0] : null;
    me.logger.exit("getUserInfo", _result + "");
    return _result;

    // return (userInfos && userInfos.length > 0) ? userInfos[0] : null;
  },

  /**
   * Returns the supervisior user name
   * @param {String|Number} user User name or ID
   * @return {String} Supervisior user name
   */
  getSupervisor: function (user) {
    var me = this,
        userInfo, userName, supervisorUserInfo;

    userInfo = me.getUserInfo(user);
    if (!userInfo) {
      me.logger.info("User not found: user=" + user);
      return user;
    }

    supervisorUserInfo = me.getUserInfo(userInfo.superiorId);
    userName = supervisorUserInfo.name + "";

    return userName;
  },

  /**
   * Returns the supervisor of the specified level
   * @param {String} userName User name
   * @param {Number} level Level
   * @return {String} Supervisor
   */
  getSupervisorOfLevel: function (userName, level) {
    var me = this,
        supervisors, supervisor;

    if (!userName) {
      me.logger.debug("Can't find supervisor: Username is empty");
      return;
    }

    level = level || 0;

    supervisors = me.getSupervisorHierarchy(userName);
    if (!supervisors || (supervisors.length <= level)) {
      me.logger.debug(["Can't find supervisor: userName={0}, supervisors={1}, level={2}", userName, supervisors, level]);
      return;
    }
    supervisor = supervisors[level];

    return supervisor;
  },

  /**
   * Returns the supervisior hierarchy
   * @param {String|Number} user User name or ID
   * @return {Array} Supervisiors
   */
  getSupervisorHierarchy: function (user) {
    var me = this,
        supervisors = [],
        userInfo, userName, supervisorUserInfo;

    userInfo = me.getUserInfo(user);

    while (true) {

      if (!userInfo || (userInfo.superiorId == userInfo.id) || (supervisors.length > 100)) {
        return supervisors;
      }

      supervisorUserInfo = me.getUserInfo(userInfo.superiorId);
      userName = supervisorUserInfo.name + "";

      supervisors.push(userName);

      userInfo = supervisorUserInfo;
    }
  },

  /**
   * Retrieves an UserInfo object of the current user
   * @return {de.elo.ix.client.UserInfo} The UserInfo object
   */
  getCurrentUserInfo: function () {
    var me = this;

    return me.getUserInfo(ixConnect.userId);
  },

  /**
   * Checks the permissions of the current user
   * @param {Array} flagNames Flags, e.g. "FLAG_IMPORT"
   * @return {Array} missingPermissions
   */
  checkCurrentPermissions: function (flagNames) {
    var missingPermissions = [],
        userInfo, i, flagName, flags, flag;

    if (!flagNames) {
      throw "Flag names are missing";
    }

    userInfo = ixConnect.ix().checkoutUsers([ixConnect.userId + ""], CheckoutUsersC.BY_IDS, LockC.NO)[0];

    for (i = 0; i < flagNames.length; i++) {
      flagName = flagNames[i];
      if (flagName.indexOf("FLAG_") == 0) {
        flags = userInfo.flags;
      } else if (flagName.indexOf("FLAG2_") == 0) {
        flags = userInfo.flags2;
      } else {
        throw "Unknown flag: " + flagName;
      }
      flag = AccessC[flagName];
      if ((flags & flag) == 0) {
        missingPermissions.push(flagName);
      }
    }
    return missingPermissions;
  },

  /**
   * Adds memberships
   *
   *     sol.common.UserUtils.addUsersToGroups(
   *       ['Max Brey', 'Steven Grog'],
   *       ['Accounting']
   *     );
   *
   * @param {Array} userNames Name of the member
   * @param {Array} groupNames Names of the groups
   * @param {Object} params (optional)
   * @param {de.elo.ix.client.IXConnection} params.connection (optional) Index server connection
   */
  addUsersToGroups: function (userNames, groupNames, params) {
    var me = this,
        groupIds = [],
        newUserInfos, groups, group, userInfos, userInfo, membershipIds, groupId, i, j, conn;

    me.logger.enter("addUsersToGroups", arguments);

    params = params || {};
    conn = params.connection || ixConnect;

    newUserInfos = [];
    if (!userNames || (userNames.length === 0) || !groupNames || (groupNames.length === 0)) {
      me.logger.exit("addUsersToGroups");
      return;
    }

    groups = conn.ix().getUserNames(groupNames, CheckoutUsersC.BY_IDS_RAW);
    for (i = 0; i < groups.length; i++) {
      group = groups[i];
      groupIds.push(parseInt(group.id, 10));
    }

    if (groupIds.length === 0) {
      me.logger.exit("addUsersToGroups");
      return;
    }

    userInfos = conn.ix().checkoutUsers(userNames, CheckoutUsersC.BY_IDS_RAW, LockC.NO);

    if (!userInfos && (userInfos.length > 0)) {
      me.logger.exit("addUsersToGroups");
      return;
    }
    for (i = 0; i < userInfos.length; i++) {
      userInfo = new UserInfo(userInfos[i]);

      membershipIds = [];
      for (j = 0; j < userInfo.groupList.length; j++) {
        membershipIds.push(parseInt(userInfo.groupList[j], 10));
      }
      for (j = 0; j < groupIds.length; j++) {
        groupId = groupIds[j];
        if (membershipIds.indexOf(groupId) < 0) {
          membershipIds.push(groupId);
        }
      }
      userInfo.groupList = membershipIds;
      newUserInfos.push(userInfo);
    }
    if (newUserInfos.length > 0) {
      conn.ix().checkinUsers(newUserInfos, CheckinUsersC.WRITE, LockC.NO);
    }
    me.logger.exit("addUsersToGroups");
  },

  /**
   * Remove memberships
   *
   *     sol.common.UserUtils.removeUsersFromGroups(["Everyone"], ["sol.contract.roles.Editors"]);
   *
   * @param {Array} userNames Name of the member
   * @param {Array} groupNames Names of the groups
   * @param {Object} params (optional)
   * @param {de.elo.ix.client.IXConnection} params.connection (optional) Index server connection
   */
  removeUsersFromGroups: function (userNames, groupNames, params) {
    var me = this,
        groupIds = [],
        newUserInfos, groupName, group, userInfos, userInfo, membershipIds, groupId, i, j, index, conn;

    me.logger.enter("removeUsersFromGroups", arguments);

    params = params || {};
    conn = params.connection || ixConnect;

    newUserInfos = [];
    if (!userNames || (userNames.length === 0) || !groupNames || (groupNames.length === 0)) {
      me.logger.exit("removeUsersFromGroups");
      return;
    }

    for (i = 0; i < groupNames.length; i++) {
      groupName = groupNames[i];
      try {
        group = conn.ix().getUserNames([groupName], CheckoutUsersC.BY_IDS_RAW)[0];
        groupIds.push(parseInt(group.id, 10));
      } catch (ex) {
        // ignore
      }
    }

    if (groupIds.length === 0) {
      me.logger.exit("removeUsersFromGroups");
      return;
    }

    userInfos = conn.ix().checkoutUsers(userNames, CheckoutUsersC.BY_IDS_RAW, LockC.NO);

    if (!userInfos && (userInfos.length > 0)) {
      me.logger.exit("removeUsersFromGroups");
      return;
    }
    for (i = 0; i < userInfos.length; i++) {
      userInfo = new UserInfo(userInfos[i]);

      membershipIds = [];
      for (j = 0; j < userInfo.groupList.length; j++) {
        membershipIds.push(parseInt(userInfo.groupList[j], 10));
      }
      for (j = 0; j < groupIds.length; j++) {
        groupId = groupIds[j];
        index = membershipIds.indexOf(groupId);
        if (index > -1) {
          membershipIds.splice(index, 1);
        }
      }
      userInfo.groupList = membershipIds;
      newUserInfos.push(userInfo);
    }
    if (newUserInfos.length > 0) {
      conn.ix().checkinUsers(newUserInfos, CheckinUsersC.WRITE, LockC.NO);
    }
    me.logger.exit("removeUsersFromGroups");
  },

  /**
   * Checks if an user is a main admin.
   *
   * For performance reasons this uses a separate cache for the administrative users.
   * This cache can only be used if the client version is newer then '10.17.010.005' and if this is called with an UserInfo or a Number.
   * In any other cases a fallback will be used and the performance might suffer.
   *
   * @param {de.elo.ix.client.UserInfo|Number|String} user
   * An UserInfo object, an user ID, name or GUID. UserInfo or user ID (Number) should be prefered due to better performance (only relevant for IX client versions above 10.17.010.005).
   * @return {Boolean}
   */
  isMainAdmin: function (user) {
    var me = this,
        userInfo, isAdmin;
    me.logger.enter("isMainAdmin", arguments);

    if (user instanceof UserInfo) {
      // shortcut for performace
      isAdmin = (user.flags >= 0) && ((user.flags & AccessC.FLAG_ADMIN) !== 0);
    } else if (me.useSpecialCaches(user)) {
      // only use cache version, if the version check was successfull and the user parameter is of type Number
      me.initializeSpecialUserCaches();
      isAdmin = !!me.adminUsersById.get((typeof user.id === "number") ? user.id : user);
    } else {
      // Fallback for backwarts compatibility without admin user cache
      userInfo = me.getUserInfo(user);
      isAdmin = (userInfo.flags & AccessC.FLAG_ADMIN) !== 0;
    }

    me.logger.exit("isMainAdmin", isAdmin);
    return isAdmin;
  },

  /**
   * Checks if the given ticket represents an administrative user
   * @param {String} ticket
   * @return {Boolean} True if the user has main admin rights
   */
  isMainAdminTicket: function (ticket) {
    var me = this,
        userInfo, isAdmin;

    if (!ticket) {
      return false;
    }

    me.mainAdminTicketCache = me.mainAdminTicketCache || sol.create("sol.common.Cache");

    ticket += "";
    isAdmin = me.mainAdminTicketCache.get(ticket);

    if (!isAdmin) {
      isAdmin = false;
      try {
        userInfo = me.getUserInfoFromTicket(ticket);
        isAdmin = (userInfo.flags >= 0) && ((userInfo.flags & AccessC.FLAG_ADMIN) !== 0);
        if (isAdmin) {
          me.mainAdminTicketCache.put(ticket, isAdmin);
        }
      } catch (ignore) {
      }
    }

    return isAdmin;
  },

  /**
   * Returns the user ID for a given ticket
   * @param {String} ticket Ticket
   * @return {de.elo.ix.client.UserInfo} User info
   */
  getUserIdFromTicket: function (ticket) {
    var me = this,
        userInfo, userId;

    userInfo = me.getUserInfoFromTicket(ticket);

    if (!userInfo) {
      return;
    }

    userId = userInfo.id;

    return userId;
  },

  /**
   * Returns the UserInfo for a given ticket
   * @param {String} ticket Ticket
   * @return {de.elo.ix.client.UserInfo} User info
   */
  getUserInfoFromTicket: function (ticket) {
    var conn, ticketClientInfo, ticketConnFact, ticketConn, userInfo;

    if (!ticket) {
      return;
    }

    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;

    ticketClientInfo = new ClientInfo();
    ticketClientInfo.ticket = ticket;

    ticketConnFact = sol.common.RepoUtils.createConnFact(conn.connProperties, conn.sessionOptions);
    ticketConn = ticketConnFact.createFromTicket(ticketClientInfo);
    userInfo = ticketConn.loginResult.user;

    ticketConn.close();

    return userInfo;
  },

  /**
   * @since 1.04.000
   * Checks if an user is a service user.
   * That's the case if the user has no interactive login rights and is a main admin.
   *
   * @param {de.elo.ix.client.UserInfo|Number|String} user
   * An UserInfo object, an user ID, name or GUID. UserInfo or user ID (Number) should be prefered due to better performance (only relevant for IX client versions above 10.17.010.005).
   * @return {Boolean}
   */
  isServiceUser: function (user) {
    var me = this,
        userInfo, isServiceUser;
    me.logger.enter("isServiceUser", arguments);

    if (user instanceof UserInfo) {
      // shortcut for performace
      isServiceUser = (user.flags >= 0) && (user.flags2 >= 0) && ((user.flags2 & AccessC.FLAG2_INTERACTIVE_LOGIN) === 0) && ((user.flags & AccessC.FLAG_ADMIN) !== 0);
    } else if (me.useSpecialCaches(user)) {
      // only use cache version, if the version check was successfull and the user parameter is of type Number
      me.initializeSpecialUserCaches();
      isServiceUser = !!me.serviceUsersById.get((typeof user.id === "number") ? user.id : user);
    } else {
      // Fallback for backwarts compatibility without admin user cache
      userInfo = me.getUserInfo(user);
      isServiceUser = ((userInfo.flags2 & AccessC.FLAG2_INTERACTIVE_LOGIN) === 0) && ((userInfo.flags & AccessC.FLAG_ADMIN) !== 0);
    }

    me.logger.exit("isServiceUser", isServiceUser);
    return isServiceUser;
  },

  /**
   * @private
   * Admin caches will only be used if `user` parameter is an UserInfo object or a `Number` and the IX version is above
   * @param {de.elo.ix.client.UserInfo|Number|String} user
   * An UserInfo object, an user ID, name or GUID. UserInfo or user ID (Number) should be prefered due to better performance (only relevant for IX client versions above 10.17.010.005).
   * @return {Boolean}
   */
  useSpecialCaches: function (user) {
    var me = this;
    me.versionCheckAdminCache = me.versionCheckAdminCache || sol.common.RepoUtils.checkVersion(ixConnect.clientVersion, "10.17.010.005"); // cache 'version check' result
    return me.versionCheckAdminCache && (typeof ixConnectAdmin != "undefined") && ((user instanceof UserInfo) || (typeof user === "number"));
  },

  /**
   * @private
   */
  initializeSpecialUserCaches: function () {
    var me = this,
        adminUserCache, serviceUserCache, fui, result, userIterator, userInfo;

    if (!me.specialUserCachesInitialized) {
      adminUserCache = sol.create("sol.common.Cache");
      serviceUserCache = sol.create("sol.common.Cache");

      fui = new FindUserInfo();
      fui.checkoutUsersZ = CheckoutUsersC.ALL_USERS_AND_GROUPS;
      fui.hasFlags = AccessC.FLAG_ADMIN;
      result = ixConnectAdmin.ix().findFirstUsers(fui, 1000);
      if (result.userNames && (result.userNames.size() > 0)) {
        userIterator = result.userNames.values().iterator();
        while (userIterator.hasNext()) {
          userInfo = userIterator.next();
          adminUserCache.put(userInfo.id, userInfo);
          if ((userInfo.flags2 & AccessC.FLAG2_INTERACTIVE_LOGIN) === 0) {
            serviceUserCache.put(userInfo.id, userInfo);
          }
        }
      }

      me.adminUsersById = adminUserCache;
      me.logger.info("'adminUsersById' cache was initialized.");

      me.serviceUsersById = serviceUserCache;
      me.logger.info("'serviceUsersById' cache was initialized.");

      me.specialUserCachesInitialized = true;
    }
  },

  /**
   * Checks, if a user is in a group.
   * @param {String} group Id or name of a group
   * @param {Object} params (optional)
   * @param {Number|String} params.userId (optional) If not set, the userId from `ixConnect` will be used
   * @return {Boolean}
   */
  isInGroup: function (group, params) {
    var me = this,
        isInGroup = false,
        userId, groupsOfUser;

    me.logger.enter("isInGroup", arguments);

    userId = (params && (params.userId || params.userId === 0)) ? params.userId : ixConnect.loginResult.user.id;

    groupsOfUser = ixConnect.ix().getUserNames([userId], CheckoutUsersC.GROUPS_OF_MEMBER_RECURSIVE);

    if (groupsOfUser && (groupsOfUser.length > 0)) {
      isInGroup = groupsOfUser.some(function (groupName) {
        return groupName.id === group || groupName.name.equals(group);
      });
    }

    me.logger.exit("isInGroup");

    return isInGroup;
  },

  /**
   * Returns the email address of an ELO user
   * @param {String|de.elo.ix.client.UserInfo} user The name, GUID or ID of the user (or an UserInfo object)
   * @return {String} Email address
   */
  getMailAddress: function (user) {
    var me = this,
        userInfo, mailAddress;
    me.logger.enter("getMailAddress", arguments);
    if (typeof user == "undefined") {
      throw "user is not defined";
    }
    userInfo = me.getUserInfo(user);
    mailAddress = userInfo.userProps[UserInfoC.PROP_NAME_EMAIL];
    me.logger.exit("getMailAddress", mailAddress + "");
    return mailAddress;
  },

  /**
   * Returns user names
   *
   * Notice: If both flags `onlyUsers` and `onlyGroups` are set an exception will be thrown
   *
   * @param {Object} config Configuration (optional)
   * @param {String} [config.name] (optional) Name If name and namePart is not set then use wildcard search `*`
   * @param {String} [config.namePart] (optional) NamePart Only used if name is not set. If name and namePart is not set use wildcard search `*`
   * @param {String} [config.max=100] (optional) maximum User names
   * @param {Boolean} [config.onlyUsers=false] (optional) If set to `true`, only users will be returned
   * @param {Boolean} [config.onlyGroups=false] (optional) If set to `true`, only groups will be returned.
   * @param {Boolean} [config.visible=false] (optional) If set to `true`, only users with the `visible in userlist` property will be returned
   * @param {Boolean} [config.excludeLockedUsers=false]  (optional) If set to 'true' then the locked users are excluded
   * @return {de.elo.ix.client.UserName[]}
   */
  getUserNames: function (config) {
    var me = this,
        findUserInfo, findResult, userNamesIterator, userNames, index, max, conn, _result;

    me.logger.enter("getUserNames", arguments);
    config = config || {};

    if (config.onlyUsers && config.onlyGroups) {
      // We throw an exception here because it is easier to find a configuration
      // error instead of passing wrong configs to the FindUserInfo Object
      throw Error("Only one flag can be set. Either `onlyUsers` or `onlyGroups`. They were mutually exclusive");
    }

    userNames = [];
    index = 0;
    max = 100;
    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;


    findUserInfo = new FindUserInfo();
    if (config.name) {
      findUserInfo.name = config.name;
    } else if (config.namePart) {
      findUserInfo.name = "*" + config.namePart + "*";
    } else {
      findUserInfo.name = "*";
    }

    if (config.onlyUsers) {
      findUserInfo.onlyUsers = true;
    } else if (config.onlyGroups) {
      findUserInfo.onlyGroups = true;
    }

    if (config.visible === true) {
      findUserInfo.hasFlags2 |= AccessC.FLAG2_VISIBLE_USER;
    }
    if (config.excludeLockedUsers === true) {
      findUserInfo.hasNotFlags |= AccessC.FLAG_NOLOGIN;
    }

    if (config.max) {
      max = config.max;
    }

    findResult = conn.ix().findFirstUsers(findUserInfo, max);
    try {
      while (true) {
        userNamesIterator = findResult.userNames.values().iterator();
        while (userNamesIterator.hasNext()) {
          userNames.push(userNamesIterator.next());
        }
        if (!findResult.isMoreResults()) {
          break;
        }
        if (config.max) {
          break;
        }
        index += findResult.userNames.size();
        findResult = conn.ix().findNextUsers(findResult.searchId, index, max);
      }
    } catch (ex) {
      throw ex;
    } finally {
      conn.ix().findClose(findResult.searchId);
    }

    _result = sol.common.JsonUtils.stringifyAll(userNames) || "";
    _result = _result.split("\",\"").join("\"\n\"");
    me.logger.exit("getUserNames", _result);
    return userNames;
  },

  /**
   * Checks wether a user exists
   * @param {String} userName User name
   * @return {Boolean}
   */
  userExists: function (userName) {
    try {
      ixConnect.ix().getUserNames([userName], CheckoutUsersC.BY_IDS_RAW);
      return true;
    } catch (ex) {
      return false;
    }
  },

  /**
   * Creates an user or group
   * @param {String} userName User name
   * @param {Object} params (optional) Configuration
   * @param {Boolean} [params.checkIfAlreadyExists=true] Don't create the user if it already exists.
   * @param {Number} params.id User ID
   * @param {String} params.guid User GUID
   * @param {String} [params.type=id] ID
   * @param {String} [params.type=user] Type
   * @param {String} params.desc (optional) Description
   * @param {Integer} params.superiorId (optional) Superior ID
   * @param {String} params.windowsUserName (optional) Windows user name
   * @param {String} params.password password (optional) Password
   * @param {Boolean} [params.locked=false] Locked
   * @param {Boolean} [params.visible=true] Visible
   * @param {String} params.email (optional) The E-Mail address of the new user
   * @param {Boolenan} [params.changePassword=true] Change password
   * @param {Boolean} [params.fileAccess=true] File Access
   * @param {Boolean} [params.allowInteractiveLogin=false] Only used if creating a user. User can login.
   * @param {Array} params.permissions (optional) Permissions, e.g. "FLAG_HASFILEACCESS", "FLAG2_SHOW_EXTRA_INFO"
   * @param {Object} params.userProps (optional) to change the "E1", "E2", "E3", "E4", "E5"
   * @return {Number} User ID
   */
  createUser: function (userName, params) {
    var me = this, connection,
        flags = 0,
        flags2 = 0,
        userInfo, userIds, i, permission, permissionParts, firstPermissionPart;

    if (!userName) {
      throw "User name is empty";
    }

    params = params || {};
    params.type = params.type || "user";
    params.checkIfAlreadyExists = (typeof params.checkIfAlreadyExists == "undefined") ? true : params.checkIfAlreadyExists;
    params.locked = (typeof params.locked == "undefined") ? false : params.locked;
    params.visible = (typeof params.visible == "undefined") ? true : params.visible;
    params.allowInteractiveLogin = (params.allowInteractiveLogin === true);
    params.changePassword = (typeof params.changePassword == "undefined") ? true : params.changePassword;
    params.fileAccess = (typeof params.fileAccess == "undefined") ? true : params.fileAccess;
    params.userProps = (typeof params.userProps == "undefined") ? null : params.userProps;

    connection = params.connection || ixConnect;

    if (params.checkIfAlreadyExists) {
      if (me.userExists(userName)) {
        return;
      }
    }
    userInfo = connection.ix().createUser(null);
    userInfo.name = userName;

    if (params.desc) {
      userInfo.desc = params.desc;
    }

    if ((typeof params.id != "undefined") && (params.id != "")) {
      if (!me.userExists(params.id)) {
        userInfo.id = java.lang.Integer.parseInt(params.id);
      }
    }

    if ((typeof params.guid != "undefined") && (params.guid != "")) {
      if (!me.userExists(params.guid)) {
        userInfo.guid = params.guid;
      }
    }

    if (typeof params.superiorId != "undefined") {
      userInfo.superiorId = params.superiorId;
    }

    if (params.type == "user") {
      userInfo.type = UserInfoC.TYPE_USER;
      if (params.allowInteractiveLogin) {
        flags2 |= AccessC.FLAG2_INTERACTIVE_LOGIN;
      }
    } else {
      userInfo.type = UserInfoC.TYPE_GROUP;
    }

    if (params.windowsUserName) {
      userInfo.userProps[UserInfoC.PROP_NAME_OS] = params.windowsUserName;
    }

    if (params.password) {
      userInfo.pwd = params.password;
    }

    if (params.locked) {
      flags |= AccessC.FLAG_NOLOGIN;
    }

    if (params.changePassword) {
      flags |= AccessC.FLAG_CHANGEPW;
    }

    if (params.fileAccess) {
      flags |= AccessC.FLAG_HASFILEACCESS;
    }

    if (params.visible) {
      flags2 |= AccessC.FLAG2_VISIBLE_USER;
    }

    if (params.email) {
      userInfo.userProps[UserInfoC.PROP_NAME_EMAIL] = params.email;
    }

    if (params.permissions) {
      for (i = 0; i < params.permissions.length; i++) {
        permission = params.permissions[i];
        permissionParts = permission.split("_");
        if (permissionParts.length > 1) {
          firstPermissionPart = permissionParts[0];
          if (firstPermissionPart == "FLAG") {
            flags |= AccessC[permission];
          } else if (firstPermissionPart == "FLAG2") {
            flags2 |= AccessC[permission];
          }
        }
      }
    }

    if (params.userProps) {
      if (typeof params.userProps.E1 !== "undefined") {
        userInfo.userProps[4] = params.userProps.E1;
      }
      if (typeof params.userProps.E2 !== "undefined") {
        userInfo.userProps[5] = params.userProps.E2;
      }
      if (typeof params.userProps.E3 !== "undefined") {
        userInfo.userProps[6] = params.userProps.E3;
      }
      if (typeof params.userProps.E4 !== "undefined") {
        userInfo.userProps[7] = params.userProps.E4;
      }
      if (typeof params.userProps.E5 !== "undefined") {
        userInfo.userProps[2] = params.userProps.E5;
      }
    }

    userInfo.flags = flags;
    userInfo.flags2 = flags2;
    userInfo.userProps[UserInfoC.PROP_ACTION] = "";

    userIds = connection.ix().checkinUsers([userInfo], CheckinUsersC.NEW_USER, LockC.NO);
    if (userIds && (userIds.length == 1)) {
      return userIds[0];
    }
  },

  /**
   * Checkout userfolder
   * @param {String|de.elo.ix.client.UserInfo} user The name, GUID or ID of the user (or an UserInfo object)
   * @return {de.elo.ix.client.Sord} sord
   */
  getUserFolder: function (user) {
    var me = this,
        userGuid = me.getUserInfo(user).guid;

    return ixConnect.ix().checkoutSord("OKEY:ELOUSERGUID=" + userGuid, EditInfoC.mbSord, LockC.NO).sord;
  },

  /**
   * Checkout folder username/data
   * @param {String|de.elo.ix.client.UserInfo} user The name, GUID or ID of the user (or an UserInfo object)
   * @return {de.elo.ix.client.Sord} sord
   */
  getFolderUserNameData: function (user) {
    var me = this,
        userGuid = me.getUserInfo(user).guid;

    return ixConnect.ix().checkoutSord("OKEY:ELOINDEX=" + ixConnect.CONST.SORD.ELOINDEX_USER_FOLDER_DATA + userGuid, SordC.mbMin, LockC.NO);
  },

  /**
   * Checkout folder username/data/elo.profile
   * @param {String|de.elo.ix.client.UserInfo} user The name, GUID or ID of the user (or an UserInfo object)
   * @return {de.elo.ix.client.Sord} sord
   */
  getFolderUserNameDataEloProfile: function (user) {
    var me = this,
        userGuid = me.getUserInfo(user).guid;

    return ixConnect.ix().checkoutSord("OKEY:ELOINDEX=" + ixConnect.CONST.SORD.ELOINDEX_USER_FOLDER_DATA_PROFILE + userGuid, SordC.mbMin, LockC.NO);
  },

  /**
   * Checkout folder username/private
   * @param {String|de.elo.ix.client.UserInfo} user The name, GUID or ID of the user (or an UserInfo object)
   * @return {de.elo.ix.client.Sord} sord
   */
  getFolderUserNamePrivate: function (user) {
    var me = this,
        userGuid = me.getUserInfo(user).guid;

    return ixConnect.ix().checkoutSord("OKEY:ELOINDEX=" + ixConnect.CONST.SORD.ELOINDEX_USER_FOLDER_PRIVATE + userGuid, SordC.mbMin, LockC.NO);
  },

  /**
   * Checkout folder username/inbox
   * @param {String|de.elo.ix.client.UserInfo} user The name, GUID or ID of the user (or an UserInfo object)
   * @return {de.elo.ix.client.Sord} sord
   */
  getFolderUserNameInbox: function (user) {
    var me = this,
        userGuid = me.getUserInfo(user).guid;

    return ixConnect.ix().checkoutSord("OKEY:ELOINDEX=" + ixConnect.CONST.SORD.ELOINDEX_USER_FOLDER_INBOX + userGuid, SordC.mbMin, LockC.NO);
  }
});