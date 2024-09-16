
//@include lib_Class.js

/**
 * Utils for handling decimals.
 *
 * Uses decimal.js-light.
 * Please refer to the official documentation of decimal.js-light for further information:
 * http://mikemcl.github.io/decimal.js-light/
 *
 * @eloall
 *
 * @author MW, ELO Digital Office GmbH
 *
 * @requires moment
 * @requires decimal-light
 */
sol.define("sol.common.DecimalUtils", {

  singleton: true,

  /**
   * Configure Decimals
   * @param {Object} config Configuration
   */
  configureDecimals: function (config) {

    config = config || {
      precision: 20,
      rounding: Decimal.ROUND_HALF_UP
    };

    Decimal.config(config);
  },

  /**
   * Returns a Decimal
   * @param {String} value Value
   * @param {Object} params parameters
   * @param {String} params.type Type
   * @param {String} params.thousandsSeparator Thousands separator
   * @param {String} params.decimalSeparator Decimal separator
   * @return {Decimal}
   */
  toDecimal: function (value, params) {
    var me = this,
        decimal;

    value += "";
    params = params || {};
    if (params.thousandsSeparator) {
      value = me.replaceAll(value, params.thousandsSeparator, "");
    }
    if (params.decimalSeparator) {
      value = me.replaceAll(value, params.decimalSeparator, ".");
    }
    value = me.replaceAll(value, " ", "");

    if (isNaN(value)) {
      value = 0;
    }

    decimal = new Decimal(value);

    return decimal;
  },

  /**
   * Replaces every occurrence of a substring with another string
   * @private
   * @param {String} str Input string
   * @param {String} target String to replace
   * @param {String} replacement Replacement string
   * @returns {String} String
   */
  replaceAll: function (str, target, replacement) {
    return String(str).split(target).join(replacement);
  }
});


//# sourceURL=lib_sol.common.DecimalUtils.js