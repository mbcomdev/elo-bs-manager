
//@include lib_Class.js

/**
 * A threadsafe cache implementation.
 *
 * The cache holds key-value pairs.
 * Keys should be strings, whereas values could be arbitary objects.
 *
 * @author PZ, ELO Digital Office GmbH
 * @version 1.03.000
 *
 * @eloix
 * @eloas
 * @elojc
 *
 */
sol.define("sol.common.Cache", {

  initialize: function (config) {
    var me = this;
    me.cache = new java.util.concurrent.ConcurrentHashMap(8, new java.lang.Float(0.9), 1);
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
