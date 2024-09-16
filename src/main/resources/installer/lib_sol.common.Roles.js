
//@include lib_Class.js
//@include lib_sol.common.ObjectUtils.js

/**
 * Roles can be used in order to identify a proper user e.g. in a workflow.
 *
 * E.g. in an invoice approval process a user should be added to the approval process if the invoice amount exceeds a
 * defined value. In this scenario, the management group should approve invoices that are more expansive than 100000€.
 *
 * Contains the functions used to determine the correct users using a configuration object. If more then one user will be suitable, the configuration order will be maintained.
 *
 * # Configuration
 * ## Example
 *
 * The configuration is an Array which contains Objects containing the rolenames as `name` property and an `users` property which is an Array of user configurations.
 * This user configuration objects have at least a `user` property, which is the ELO username. Additionally each object can contain several conditions, which are defined thanks to an Array.
 *
 *     var myRoleConfig = [
 *       {
 *         "name": "ROLE_1",
 *         "users": [
 *           { user : "user1", conditions: [ { type: "GRP", key: "AMOUNT", rel: "GT", val: 3000, dataType: "number" } ] },
 *           { user : "user2" }
 *         ]
 *       },
 *       {
 *         name: "ROLE_2",
 *         users: [
 *           { user: "user2", conditions: [ { type: "GRP", key: "RECIPIENT_NO", rel: "EQUALS", val: "4713"} ] },
 *           { user: "group1" }
 *         ]
 *       },
 *       {
 *         name: "ROLE_3",
 *         users: [
 *           { user: { type: "GRP", key: "PO_PURCHASE_USER", mode: "SUPERVISOR", supervisorLevel: 2 }, conditions: [ { type: "GRP", key: "AMOUNT", rel: "GE", val: "4714"} ] },
 *         ]
 *       }
 *     ]
 *
 * ## Conditions
 * Conditions are optional and are used to limit the users depending on the values in an Sord object. Conditions are an Array of Objects.
 *
 *     {
 *       // type of field (GRP|SORD)
 *       type: "GRP",
 *       // name of the index group, or sord property
 *       key : "{ELO OBJEKY GROUPNAME}",
 *       // relation for the check
 *       rel : "{RELATION}",
 *       // value to check for
 *       val : "{VALUE}"
 *     }
 *
 * If conditions are configured, all of them must meet the requirements.
 *
 * Supported relations are:
 *
 *  - `GT`: value is greater than `x`
 *  - `GE`: value is greater or equal than `x`
 *  - `LT`: value is lower than `x`
 *  - `LE`: value is lower or equal than `x`
 *  - `NOT`: value is not equal to `x`
 *  - `EQUALS`: value is equal to `x`
 *
 * # Retrieving a user list
 *
 *     var sord = ixConnect.ix().checkoutSord(...);
 *     var users = sol.common.Roles.getUsers('MYROLE', sord, myRoleConfig);
 *
 * @author PZ, ELO Digital Office GmbH
 * @version 1.03.000
 *
 * @eloix
 * @eloas
 * @requires handlebars
 * @requires sol.common.Template
 * @requires sol.common.SordUtils
 *
 */
sol.define("sol.common.Roles", {
  singleton: true,

  /**
   * @private
   * Contains the calculation rules.
   */
  fct: {
    EQUALS: function (param1, param2) {
      return param1 == param2;
    },
    GT: function (param1, param2) {
      return param1 > param2;
    },
    GE: function (param1, param2) {
      return param1 >= param2;
    },
    LT: function (param1, param2) {
      return param1 < param2;
    },
    LE: function (param1, param2) {
      return param1 <= param2;
    },
    NOT: function (param1, param2) {
      return param1 != param2;
    },
    STARTSWITH: function (param1, param2) {
      param1 = (param1 || "") + "";
      param2 = (param2 || "") + "";
      return (param1.indexOf(param2) == 0);
    }
  },

  /**
   * This function evaluates a configuration to find all suitable users for a role.
   * @param {String|Object} role Role name. If this is defined as an object, a `type` and a `key` has to be defined to load the role from the sords metadata (see {@link sol.common.SordUtils#getValue}).
   * @param {de.elo.ix.client.Sord} sord Sord to check conditions from config
   * @param {Object[]} config Configuration object
   * @return {String[]} Array of usernames (or an empty Array)
   *
   */
  getUsers: function (role, sord, config) {
    var me = this,
        users, result;
    me.logger.enter("getUsers", arguments);

    users = me.getUsers2(role, sord, config);

    result = users.map(function (entry) {
      return entry.name;
    });

    me.logger.exit("getUsers", result);
    return result;
  },

  /**
   * This function evaluates a configuration to find all suitable users for a role.
   * getUser2() considers the property 'mandatory'
   *
   * @param {String|Object} role Role name. If this is defined as an object, a `type` and a `key` has to be defined to load the role from the sords metadata (see {@link sol.common.SordUtils#getValue}).
   * @param {de.elo.ix.client.Sord} sord Sord to check conditions from config
   * @param {Object[]} originalConfig Configuration object
   * @return {Array} Array of user entries
   *
   */
  getUsers2: function (role, sord, originalConfig) {
    var me = this,
        applicableRules = [],
        userEntries = [],
        config, i, j, rules, rule, conditions, condition, conditionResult, allConditionsMeet, value,
        userName, sordMap, userLogString, applicableRule, userEntry;

    config = sol.common.ObjectUtils.clone(originalConfig);

    sordMap = sol.create("sol.common.SordMap", { objId: sord.id });
    sordMap.read();

    me.logger.enter("getUsers2", arguments);

    role = me.retrieveRole(role, config, sord);
    rules = me.getUsersByRole(role, config);

    if (rules && rules.length > 0) {
      for (i = 0; i < rules.length; i++) {
        rule = rules[i];
        conditions = rule.conditions;

        userLogString = sol.common.ObjectUtils.isObject(rule.user) ? JSON.stringify(rule.user) : rule.user;

        if (conditions && conditions.length > 0) {
          allConditionsMeet = true;
          for (j = 0; j < conditions.length; j++) {
            condition = conditions[j];
            value = me.getValue(sord, sordMap, condition);
            conditionResult = this.fct[condition.rel](value, condition.val);
            me.logger.debug(["getUser2: Condition: sord.id={0}, sord.name={1}, user={2}, condition.type={3}, condition.key={4}, value={5}, condition.rel={6}, condition.val={7}, condition.val.type={8}, result={9}", sord.id, sord.name, userLogString, condition.type, condition.key, value, condition.rel, condition.val, typeof condition.val, conditionResult]);
            if (!conditionResult) {
              allConditionsMeet = false;
              break;
            }
          }
          if (allConditionsMeet) {
            me.logger.debug(["getUsers2: All conditions meet: sord.id={0}, sord.name={1}, user={2}", sord.id, sord.name, userLogString]);
            applicableRules.push(rule);
          }
        } else {
          me.logger.debug(["getUsers2: Add constant user: sord.id={0}, sord.name={1}, user={2}", sord.id, sord.name, userLogString]);
          applicableRules.push(rule);
        }
      }
    }

    for (i = 0; i < applicableRules.length; i++) {
      applicableRule = applicableRules[i];
      userName = me.getUserName(sord, applicableRule);
      if (!userName) {
        me.logger.warn(["getUsers2: Can't determinate user name: {0}", JSON.stringify(applicableRule.user)]);
        continue;
      }

      userEntry = { name: userName, mandatory: applicableRule.mandatory };

      userEntries.push(userEntry);
    }

    me.logger.exit("getUsers2", JSON.stringify(userEntries));

    return userEntries;
  },

  /**
   * Determine if a configuration has a role configured.
   * @param {String|Object} role Role name. If this is defined as an object, a `type` and a `key` has to be defined to load the role from the sords metadata (see {@link sol.common.SordUtils#getValue}). It's also possible to define an object with a `template` property which contains a Handlebars template string.
   * @param {Object[]} rolesConfig Configuration object
   * @param {de.elo.ix.client.Sord} sord (optional) Sord to check conditions from config. If `role` is an object, this has to be defined.
   * @return {String} The name of the role
   */
  retrieveRole: function (role, rolesConfig, sord) {
    var me = this,
        configuredRole = null,
        tplSord;

    me.logger.enter("retrieveRole", role);

    if (role && rolesConfig && (rolesConfig.length > 0)) {
      if (role.type && role.key) {
        if (!sord) {
          throw "IllegalArgumentException: if role is defined by 'type' and 'key', a sord has to be passed.";
        }
        role = sol.common.SordUtils.getValue(sord, role);
      }

      if (role.template) {
        if (!sord) {
          throw "IllegalArgumentException: if role is defined by 'template', a sord has to be passed.";
        }
        tplSord = sol.common.SordUtils.getTemplateSord(sord);
        role = sol.create("sol.common.Template", { source: role.template }).apply(tplSord);
      }

      rolesConfig.some(function (roleConfig) {
        if (roleConfig.name == role) {
          configuredRole = roleConfig.name;
          return true;
        }
      });
    }

    if (!configuredRole) {
      me.logger.debug(["Role '{0}' is not defined in the configuration", role]);
    }

    me.logger.exit("retrieveRole", configuredRole);
    return configuredRole;
  },

  /**
   * @private
   * Returns the username
   * @param {de.elo.ix.client.Sord} sord Sord
   * @param {Object} rule Rule
   * @return {String}
   */
  getUserName: function (sord, rule) {
    var me = this,
        userName, mode;

    userName = rule.user;

    if (sol.common.ObjectUtils.isObject(rule.user)) {
      if (!rule.user.type) {
        throw "User definition type is empty";
      }
      if (!rule.user.key) {
        throw "User definition key is empty";
      }
      userName = sol.common.SordUtils.getValue(sord, rule.user);
    }

    if (!userName) {
      return;
    }

    userName += "";

    mode = rule.mode || rule.user.mode;

    if (mode) {
      switch (mode.toUpperCase()) {
        case "SUPERVISOR":
          userName = me.getSupervisor(rule, userName);
          break;

        default:
          break;
      }
    }

    return userName;
  },

  /**
   * Returns the supervisor of the specified level
   * @param {Object} userDef User definition
   * @param {String} userName User name
   * @return {String} Supervisor
   */
  getSupervisor: function (userDef, userName) {
    var me = this,
        supervisorLevel, supervisors, supervisor;

    userDef = userDef || {};
    userDef.user = userDef.user || {};

    supervisorLevel = userDef.user.supervisorLevel;
    supervisorLevel = (typeof supervisorLevel != "undefined") ? supervisorLevel : userDef.supervisorLevel;
    supervisorLevel = (typeof supervisorLevel != "undefined") ? supervisorLevel : 0;

    supervisors = sol.common.UserUtils.getSupervisorHierarchy(userName);
    if (!supervisors || (supervisors.length <= supervisorLevel)) {
      me.logger.debug(["Can't find supervisor: userConfig={0}, userName={1}, supervisors={2}, supervisorLevel={3}", JSON.stringify(userDef), userName, supervisors, supervisorLevel]);
      return;
    }
    supervisor = supervisors[supervisorLevel];

    me.logger.debug(["getSupervisor: userConfig={0}, userName={1}, supervisors={2}, supervisorLevel={3}, supervisor={4}", JSON.stringify(userDef), userName, supervisors, supervisorLevel, supervisor]);

    return supervisor;
  },

  /**
   * @private
   * Retrieves the users for a role from the configuration array.
   *
   * @param {String} role Lookup string in config object
   * @param {Object[]} config Configuration object
   * @return {Object[]} Array of user configurations
   *
   */
  getUsersByRole: function (role, config) {
    var me = this,
        result;
    me.logger.enter("getUsersByRole", arguments);
    if (config && config.length > 0) {
      config.some(function (roleObj) {
        if (roleObj.name == role) {
          result = roleObj.users;
          return true;
        }
      });
    }
    me.logger.exit("getUsersByRole", result);
    return result;
  },

  /**
   * @private
   * Gets a value from the Sord object.
   *
   * If the condition.val is a number this function tries to retrieve the value as a number.
   *
   * @param {de.elo.ix.client.Sord} sord Sord
   * @param {sol.common.SordMap} sordMap Sord map
   * @param {Object} condition Condition
   * @param {String} condition.type The type were the value should be looked up ("SORD"|"GRP")
   * @param {String} condition.key The lookup key (either an index field name or a sord property)
   * @param {String|Number} condition.val The value to which will be compared, here only used to determine the type (string or number)
   * @return {String|Number}
   */
  getValue: function (sord, sordMap, condition) {
    var value = null;

    switch (condition.type) {
      case "SORD":
        value = (sol.common.SordUtils.isSord(sord) && sord[condition.key]) ? sord[condition.key] : null;
        break;
      case "GRP":
        value = (((typeof condition.val) === "number") || (condition.dataType === "number")) ? sol.common.SordUtils.getObjKeyValueAsNumber(sord, condition.key) : sol.common.SordUtils.getObjKeyValue(sord, condition.key);
        break;
      case "MAP":
        if (condition.dataType === "number") {
          value = sordMap.getNumValue(condition.key);
        } else {
          value = (sordMap.getValue(condition.key) || "") + "";
        }
        break;
      default:
        break;
    }

    return value;
  }
});
