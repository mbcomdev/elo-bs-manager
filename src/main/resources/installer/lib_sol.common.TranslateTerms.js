
//@include lib_Class.js
//@include lib_sol.common.ObjectUtils.js
//@include lib_sol.common.Cache.js

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
 * Cache for Translate Terms. This class handles localization in Business Solutions.
 *
 * Property files should be placed in `Administration\Localization\`.
 *
 * ELO internal projects must use `Administration\Localization\system`. Modifications and Partner implementations must
 * use `Administration\Localization\custom`.
 *
 * # Using localization in scripts
 *
 * Thanks to a require function call all required translation terms will get loaded in the cache. This must be done
 * before terms are used by scripts. Following example shows a common usage for a dynamic keyword list.
 *
 * A property file must be located in the localization folder. e.g. `Administration\Localization\system\sol.invoice.locale.properties`
 *
 *     sol.invoice.dynkwl.Company.ID=Company id
 *     sol.invoice.dynkwl.Company.NAME=Company name
 *     sol.invoice.dynkwl.Company.CITY=City
 *
 * The TranslateTerms utilizes the use of translation keys.
 *
 *     sol.common.TranslateTerms.require('sol.invoice.dynkwl.Company');
 *
 *     var tableHeaders = [
 *       sol.common.TranslateTerms.translate('sol.invoice.dynkwl.Company.ID'),
 *       sol.common.TranslateTerms.translate('sol.invoice.dynkwl.Company.NAME'),
 *       sol.common.TranslateTerms.translate('sol.invoice.dynkwl.Company.CITY')];
 *
 * @author PZ, ELO Digital Office GmbH
 * @version 1.03.000
 *
 * @eloix
 * @eloas
 *
 * @requires sol.common.ObjectUtils
 * @requires sol.common.Cache
 */
sol.define("sol.common.TranslateTerms", {
  singleton: true,

  /**
   * Loads a list of translation keys by a given prefix.
   * Prefixes can be either passed as an array or string.
   * @param {String} prefixes
   * @param {String} additionalLanguage (optional)
   */
  require: function (prefixes, additionalLanguage) {
    var me = this,
        requestedCount, idx, findTranslateTermInfo, findResult, i, translateTerm, j, language, term;

    me.logger.enter("require", arguments);
    if (!prefixes) {
      me.logger.warn("Translation term key prefix not set; use prefix 'sol'.");
      prefixes = ["sol"];
    }

    if (!sol.common.ObjectUtils.isArray(prefixes)) {
      prefixes = [prefixes];
    }

    requestedCount = prefixes.length;
    me.getLangs(additionalLanguage);
    prefixes = me.filterPrefixes(prefixes);

    if (prefixes.length > 0) {
      me.logger.debug(["Load {0} of {1} requested prefixes", requestedCount, prefixes.length]);
      me.translateTerms = me.translateTerms || sol.create("sol.common.Cache");

      try {
        findTranslateTermInfo = new FindTranslateTermInfo();
        findTranslateTermInfo.terms = prefixes;
        findTranslateTermInfo.langs = me.languages;
        idx = 0;
        findResult = ixConnect.ix().findFirstTranslateTerms(findTranslateTermInfo, 10000); // Workaround EIX-3334
        while (true) {
          for (i = 0; i < findResult.translateTerms.length; i++) {
            translateTerm = findResult.translateTerms[i];
            for (j = 0; j < translateTerm.langs.length; j++) {
              language = translateTerm.langs[j];
              term = translateTerm.termLangs[j] || "";
              if (!me.translateTerms.containsKey(language)) {
                me.translateTerms.put(language, sol.create("sol.common.Cache"));
              }
              me.translateTerms.get(language).put(translateTerm.translationKey, term);
            }
          }
          if (!findResult.moreResults) {
            break;
          }
          idx += findResult.translateTerms.length;
          try {
            findResult = ixConnect.ix().findNextTranslateTerms(findResult.searchId, idx, 100);
          } catch (error) {
            throw new Error("Error while loading translates: Too may translates found. To fix, increase value in findFirstTranslateTerms as Workaround for EIX-3334 (lib_sol.common.TranslateTerms)");
          }
        }
        me.rememberPrefixes(prefixes);
      } finally {
        if (findResult) {
          ixConnect.ix().findClose(findResult.searchId);
        }
      }
    } else {
      me.logger.debug("All prefixes have already been cached.");
    }
    me.logger.exit("require");
  },

  /**
   * @private
   * Retrieves the system languages
   * @param {String} additionalLanguage (optional) Additional language
   */
  getLangs: function (additionalLanguage) {
    var me = this,
        langsTerm, i, lang;
    me.logger.enter("getLangs", arguments);
    if (me.languages) {
      me.addLang(additionalLanguage);
    } else {
      me.languages = [];
      langsTerm = ixConnect.ix().checkoutTranslateTerms([TranslateTermC.GUID_SYSTEM_LANGUAGES], LockC.NO);
      for (i = 0; i < langsTerm[0].langs.length; i++) {
        lang = langsTerm[0].langs[i];
        me.addLang(lang);
      }
    }
    me.logger.exit("getLangs", me.languages);
  },

  /**
   * @private
   * Adds a language
   * @param {String} language Language
   */
  addLang: function (language) {
    var me = this;
    language = String(language || "");
    if (language) {
      if (me.languages.indexOf(language) < 0) {
        me.languages.push(language);
        delete me.downloadedPrefixes;
      }
    }
  },

  /**
   * @private
   * Checks which prefixes have already been loaded.
   * @param {String[]} prefixes
   * @return {String[]}
   */
  filterPrefixes: function (prefixes) {
    var me = this,
        filteredCount = 0,
        filtered;
    if (me.downloadedPrefixes) {
      filtered = [];
      prefixes.forEach(function (prefix) {
        if (!me.downloadedPrefixes.containsKey(String(prefix))) {
          filtered.push(prefix);
        } else {
          filteredCount++;
        }
      });
    } else {
      filtered = prefixes;
    }
    me.logger.debug(["Filtered '{0}' prefixes that have already been loaded", filteredCount]);
    return filtered;
  },

  /**
   * @private
   * Saves the prefixes that have been loaded, to avoid repeated requests.
   * @param {String[]} prefixes
   */
  rememberPrefixes: function (prefixes) {
    var me = this;

    if (!me.downloadedPrefixes) {
      me.downloadedPrefixes = sol.create("sol.common.Cache");
    }
    if (me.downloadedPrefixes) {
      prefixes.forEach(function (prefix) {
        me.downloadedPrefixes.put(String(prefix), true);
      });
    }
  },

  /**
   * Get a translation for a key by a given language code.
   *
   *     sol.common.TranslationTerms.getTerm('de', sol.contract.ix.client');
   *
   * @param {String|de.elo.ix.client.ClientInfo} language Either an ISO language String, or an de.elo.ix.client.ClientInfo Object
   * @param {String} key The key in the resource files
   * @param {boolean} requestedTerm (optional) if not set, function requests term if not in list.
   * @return {String} result The value of the key
   */
  getTerm: function (language, key, requestedTerm) {
    var me = this,
        result;

    if (language instanceof ClientInfo) {
      language = language.language;
    }

    if (!language) {
      me.logger.warn("Language not set.");
      return key;
    }

    if (!me.translateTerms) {
      me.require();
    }

    if (!me.translateTerms.containsKey(language)) {
      me.translateTerms.put(language, sol.create("sol.common.Cache"));
    }

    result = me.translateTerms.get(language).get(key);
    if (!result) {
      if (!requestedTerm) {
        me.logger.debug("Translation key not found or cached. requesting key: " + key + ". This could be the case if used within templates. Please note that prefetching translation keys improves system performance.");
        me.require(key, language);

        return me.getTerm(language, key, true);
      } else {
        me.logger.warn("Translation key not found: " + key);
        return key;
      }
    }
    return result;
  },

  /**
   * Translates a key to the current language
   * @param {String} key The key in the resource files
   * @param {String} (optional) lang the language target otherwise use ixConnect language
   * @return {String} result The translated key
   *
   */
   translate: function (key, lang) {
    var me = this,
        language, _result;

    me.logger.enter("translate", arguments);
    if (lang || ixConnect) {
      language = lang || ixConnect.loginResult.clientInfo.language;
    } else {
      throw Error("IX connection is not available or lang argument must be set");
    }
    _result = String(me.getTerm(language, key));
    me.logger.exit("translate", _result);
    return _result;
  }
});
