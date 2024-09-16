
importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js

/**
 * Helper class for reading a users locale settings.
 *
 *     var locale = sol.create('sol.common.Locale', {
 *       ec: ec
 *     });
 *
 *     // read user profile opts and default values
 *     locale.read();
 *
 *     // access properties of the locale object
 *     var lang = locale.language;
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloas
 * @eloix
 */
sol.define("sol.common.Locale", {

  requiredProperties: ["ec"],

  /**
   * @property {String} language
   * ISO language code of this user.
   *
   *     language = "de"
   */
  /**
   * @property {java.util.Locale} locale
   * Java locale object for this users language.
   */
  /**
   * @property {String} decimalFormatSymbols
   *
   */
  /**
   * @property {String} decimalSeparator
   */
  /**
   * @property {String} groupingSeparator
   */
  /**
   * @property {Object} profileOpts
   * Settings from this users profileOpts database.
   *
   * @property {Object} profileOpts.useDefaultDateFormat Is true if default date format should be used.
   * @property {Object} profileOpts.dateFormat Java Client date format entered by the user.
   * @property {Object} profileOpts.useDefaultSystemSeparator Is true if default separator format should be used.
   * @property {Object} profileOpts.decimalSeparator Separator setting from the Java Client that was entered by the user.
   * @property {Object} profileOpts.thousandSeparator Thousand Separator setting from the Java Client that was entered by the user.
   */

  /**
   * Reads and processes locale specific data from the elo profile opts database and java locale defaults.
   */
  read: function () {
    var me = this;
    me.logger.enter("read", arguments);

    me.language = me.ec.ci.language;
    me.locale = new java.util.Locale(me.language);
    me.decimalFormatSymbols = new java.text.DecimalFormatSymbols(me.locale);
    me.dateFormatSymbols = new java.text.DateFormatSymbols(me.locale);

    me.userProfile = sol.create("sol.common.UserProfile", { userId: me.ec.user.id });
    me.userProfile.read();

    me.profileOpts = {};
    me.profileOpts.useDefaultDateFormat = me.userProfile.getOption("EloJ.I.UseDefaultDateformat");
    me.profileOpts.dateFormat = me.userProfile.getOption("EloJ.S.DateFormat");

    if ((me.profileOpts.useDefaultDateFormat == "0") || !me.profileOpts.dateFormat) {
      me.dateFormat = me.getDefaultDateFormat();
    } else {
      me.dateFormat = me.normalizeDateFormat(me.profileOpts.dateFormat);
    }

    me.profileOpts.useDefaultSystemSeparator = me.userProfile.getOption("EloJ.I.UseDefaultSystemSeparator");
    me.profileOpts.decimalSeparator = me.userProfile.getOption("EloJ.S.DecimalSeparator");
    me.profileOpts.thousandSeparator = me.userProfile.getOption("EloJ.S.ThousandSeparator");

    if ((me.profileOpts.useDefaultSystemSeparator == "0") || !me.profileOpts.decimalSeparator) {
      me.decimalSeparator = me.getDefaultDecimalSeparator();
    } else {
      me.decimalSeparator = me.profileOpts.decimalSeparator;
    }

    if ((me.profileOpts.useDefaultSystemSeparator == "0") || !me.profileOpts.thousandSeparator) {
      me.groupingSeparator = me.getDefaultGroupingSeparator();
    } else {
      me.groupingSeparator = me.profileOpts.thousandSeparator;
    }
    me.logger.exit("read", { dateFormat: me.dateFormat, decimalSeparator: me.decimalSeparator, groupingSeparator: me.groupingSeparator });
  },

  /**
   * @private
   * reads the defaults date format from the java locale class.
   * @return {String} date result
   */
  getDefaultDateFormat: function () {
    var me = this;
    return String(java.text.DateFormat.getDateInstance(java.text.DateFormat.MEDIUM, me.locale).toPattern());
  },

  /**
   * @private
   * @param {Object} dateFormat Java Client date format entered by the user.
   * @return {String} date result
   */
  normalizeDateFormat: function (dateFormat) {
    dateFormat = String(dateFormat);
    dateFormat = dateFormat.replace(/y*/i, function (str) {
      if (str.length == 1) {
        return "yyyy";
      } else {
        return str;
      }
    });
    return dateFormat;
  },

  /**
   * Returns the default decimal separator
   * @return {String} default decimal separator
   */
  getDefaultDecimalSeparator: function () {
    var me = this;
    return me.javaCharToJsString(me.decimalFormatSymbols.decimalSeparator);
  },

  /**
   * Returns the default grouping separator
   * @return {String} default grouping separator
   */
  getDefaultGroupingSeparator: function () {
    var me = this;
    return me.javaCharToJsString(me.decimalFormatSymbols.groupingSeparator);
  },

  /**
   * @private
   * @param {Char} javaChar java character
   * @return {String} java character
   */
  javaCharToJsString: function (javaChar) {
    return String(java.lang.Character.toString(javaChar));
  },

  /**
   * Formats a decimal number
   * @param {String} decimal Decimal
   * @param {Object} params Parameters
   * @param {String} params.decimalSeparator Decimal separator
   * @param {String} params.groupingSeparator Grouping separator
   * @param {Number} params.minimumFractionDigits Minimum fraction digits
   * @param {Number} params.maximumFractionDigits Maximum fraction digits
   * @param {Boolean} params.groupingUsed Grouping used
   * @return {String} Formatted decimal
   */
  formatDecimal: function (decimal, params) {
    var me = this,
        decimalSeparator, groupingSeparator, decimalFormatSymbols, decimalFormat, decimalString, bigDecimal, formattedString;

    if (decimal == "") {
      return "";
    }

    decimalSeparator = (typeof params.decimalSeparator != "undefined") ? params.decimalSeparator : me.decimalSeparator;
    groupingSeparator = (typeof params.groupingSeparator != "undefined") ? params.groupingSeparator : me.groupingSeparator;

    params = params || {};
    params.groupingUsed = (params.groupingUsed == false) ? false : true;

    decimalFormat = new java.text.DecimalFormat();
    decimalFormatSymbols = new java.text.DecimalFormatSymbols();

    decimalFormatSymbols.decimalSeparator = new java.lang.Character(decimalSeparator);
    if (params.groupingUsed) {
      decimalFormat.groupingUsed = true;
      decimalFormatSymbols.groupingSeparator = new java.lang.Character(groupingSeparator);
    } else {
      decimalFormat.groupingUsed = false;
    }

    decimalFormat.decimalFormatSymbols = decimalFormatSymbols;
    if (typeof params.minimumFractionDigits != "undefined") {
      decimalFormat.minimumFractionDigits = java.lang.Integer(params.minimumFractionDigits);
    }
    if (typeof params.maximumFractionDigits != "undefined") {
      decimalFormat.maximumFractionDigits = java.lang.Integer(params.maximumFractionDigits);
    }

    decimalString = decimal + "";
    decimalString = decimalString.replace(",", ".");

    bigDecimal = new java.math.BigDecimal(decimalString);

    formattedString = decimalFormat.format(bigDecimal) + "";

    return formattedString;
  }
});
