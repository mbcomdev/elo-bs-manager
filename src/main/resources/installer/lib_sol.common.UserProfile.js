
importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js

/**
 * Represents the settings of an user
 *
 *     var userProfile = sol.create('sol.common.UserProfile', {
 *        userId: "123"
 *     });
 *
 *     // read options
 *     var options = userProfile.read({
 *       "keys": "sol*"
 *     });
 *
 *     // get an option
 *     var option = userProfile.getOption("Elo.J.S.Script.ELO.LastId");
 *
 *
 * @author ELO Digital Office GmbH
 *
 * @elojc
 * @eloas
 * @eloix
 *
 */
sol.define("sol.common.UserProfile", {

  /**
   * @cfg {String} userId
   * User ID
   */

  requiredProperties: ["userId"],

  initialize: function (config) {
    var me = this;
    me.$super("sol.Base", "initialize", [config]);
    me.newOptions = {};
  },

  /**
   * Reads the settings of an user
   * @param {Object} config Configuration
   * @param {Array} config.keys Keys
   * @return {Object} Options
   */
  read: function (config) {
    var me = this,
        userProfile, i, option;

    me.logger.enter("read", arguments);

    config = config || {};

    me.options = {};

    userProfile = new UserProfile();
    userProfile.userId = me.userId;

    if (config.keys) {
      userProfile.options = config.keys.map(function (key) {
        return new Packages.de.elo.ix.client.KeyValue(key, "");
      });
    }

    if (me.excludeGroupValues) {
      userProfile.excludeGroupValues = true;
    }

    if (me.excludeDefaultValues) {
      userProfile.excludeDefaultValues = true;
    }

    me.userProfile = ixConnect.ix().checkoutUserProfile(userProfile, LockC.NO);

    for (i = 0; i < me.userProfile.options.length; i++) {
      option = me.userProfile.options[i];
      me.options[String(option.key)] = String(option.value);
    }
    me.logger.exit("read");

    return me.options;
  },

  /**
   * Returns a single value of the user settings
   * @param {String} key Key of the user setting.
   * @return {String} single value of the user settings.
   */
  getOption: function (key) {
    var me = this;
    if (!me.options) {
      me.read();
    }
    return me.options[key] || "";
  },

  /**
   * Sets a profile option
   * @param {String} key Key of the user setting.
   * @param {String} value Key of the user setting.
   * @param {Object} config profile option.
   */
  setOption: function (key, value, config) {
    var me = this,
        newValue, separator;
    me.logger.enter("setOption", arguments);
    newValue = "";
    if (!key) {
      throw "Key is empty";
    }
    if (config && config.append) {
      separator = config.separator || "¶";
      newValue = me.getOption(key);
      if (newValue) {
        newValue += separator;
      }
    }
    newValue += value;
    if (me.options) {
      me.options[key] = newValue;
    }
    me.newOptions[key] = newValue;
    me.logger.exit("setOption", { key: key, newValue: newValue });
  },

  /**
   * Writes the changed profile options
   */
  write: function () {
    var me = this,
        userProfile, newKeyValues, key, _result;
    me.logger.enter("write", arguments);
    userProfile = new UserProfile();
    newKeyValues = [];
    for (key in me.newOptions) {
      newKeyValues.push(new KeyValue(key, me.newOptions[key]));
    }
    userProfile.userId = me.userId;
    userProfile.options = newKeyValues;
    ixConnect.ix().checkinUserProfile(userProfile, LockC.NO);

    _result = sol.common.JsonUtils.stringifyAll(me.newOptions) || "";
    _result = _result.split("\",\"").join("\"\n\"");
    me.logger.exit("write", _result);

    me.newOptions = {};
  }
});

/**
 * User profile utility methods
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.0
 *
 * @elojc
 * @eloas
 * @eloix
 */
sol.define("sol.common.UserProfileUtils", {

  singleton: true,

  /**
   * Checks wether a option bit is set
   * @param {Number} optionValue Option value
   * @param {Number} bitMask Bit mask
   * @return {Boolean}
   */
  isOptionBitSet: function (optionValue, bitMask) {
    var result;
    result = ((optionValue & bitMask) != 0);
    return result;
  },

  /**
   * Set an option bit
   * @param {Number} optionValue Option value
   * @param {Boolean} flag Flag
   * @param {Number} bitMask Bit mask
   * @return {Number} New optionValue
   */
  setOptionBit: function (optionValue, flag, bitMask) {
    if (flag === true) {
      optionValue |= bitMask;
    }
    if (flag === false) {
      optionValue &= ~bitMask;
    }
    return optionValue;
  }
});
