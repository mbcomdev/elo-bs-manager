
// Java includes
importPackage(Packages.de.elo.ix.client);

// JavaScript includes
//@include lib_Class.js

/**
 * Utility functions for counter.
 *
 * All counter-names will be normalized, by transforming them to upper case and replacing `&` with `__`.
 *
 *     // Generate the next record id for filing plan reference 1202.22
 *     var nextRecordId = sol.common.CounterUtils.incCounter('RECORDS-FP.1202.22', 1);
 *
 * @author Pascal Zipfel, ELO Digital Office GmbH
 * @version 1.04.002
 *
 * @elojc
 * @eloas
 * @eloix
 */
sol.define("sol.common.CounterUtils", {
  singleton: true,

  /**
   * Returns the next value of a counter, or creates a new one.
   * @param {String} name The name of the counter
   * @param {Number} [defaultValue=1] (optional) The default value of the counter, if a new one is created
   * @return {Number} The counter value
   */
  incCounter: function (name, defaultValue) {
    var me = this,
        _result;
    me.logger.enter("incCounter", arguments);

    defaultValue = defaultValue || 1;

    if (!this.exists(name)) {
      this.create(name, defaultValue);
    }
    _result = this.getValue(name);
    me.logger.exit("incCounter", _result);
    return _result;
  },

  /**
   * Creates a new counter or updates an existing one.
   *
   * Be carefull, if counter already exists, it will be overwritten.
   * You might want to use {@link sol.common.CounterUtils#incCounter} instead.
   *
   * @param {String} name The name of the counter
   * @param {Number} [value=1] (optional) The initial counter value
   */
  create: function (name, value) {
    var me = this,
        info;
    me.logger.enter("create", arguments);

    info = new CounterInfo();
    info.name = this.normalizeName(name);
    info.value = value || 1;

    ixConnect.ix().checkinCounters([info], LockC.NO);
    me.logger.exit("create");
  },

  /**
   * Checks if a counter exists without modifying it.
   * @param {String} name
   * @return {Boolean}
   */
  exists: function (name) {
    var me = this,
        infos, exists, _result;
    me.logger.enter("exists", arguments);

    exists = false;
    try {
      name = this.normalizeName(name);
      infos = ixConnect.ix().checkoutCounters([name], false, LockC.NO);

      if (infos && infos.length > 0) {
        exists = true;
      }
    } catch (ex) {
      exists = false;
    }
    _result = exists;
    me.logger.exit("exists", _result);
    return _result;
  },

  /**
   * Retrives the value of a counter.
   *
   * If not spezified differently, it will automatically increment the counter.
   *
   * @param {String} name
   * @param {Boolean} noInc (optional) If `true`, the counter will NOT be incremented (use carefully)
   * @return {Number} The value of the counter
   * @throws Throws an exception, if counter does not exist
   */
  getValue: function (name, noInc) {
    var increment, infos;

    increment = !noInc;
    name = this.normalizeName(name);
    infos = ixConnect.ix().checkoutCounters([name], increment, LockC.NO);

    if (!infos || infos.length <= 0) {
      throw "Counter does not exist";
    }
    return infos[0].value;
  },

  /**
   * @private
   * Performes the normalization on the counter name converts to upper case and replace `&`.
   * @param {String} name
   * @return {String} The normalized name
   */
  normalizeName: function (name) {
    name = String(name);
    if (name.length > CounterInfoC.lnName) {
      throw "Counter name is too long (>" + CounterInfoC.lnName + " chars): " + name;
    }
    return name.toUpperCase().replace(/\&/g, "__");
  }

});
