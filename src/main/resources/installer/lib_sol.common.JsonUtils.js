
//@include lib_Class.js

/**
 * Helper functions for JSON processing
 *
 * @author Michael Weiler, ELO Digital Office GmbH
 * @version 1.0
 *
 * @eloall
 * @requires sol
 */
sol.define("sol.common.JsonUtils", {

  singleton: true,

  /**
   * Stringify JavaScript objects and handles Java objects
   * @param {Object} obj Object to stringify
   * @param {Object} objFormat Object formatting stringify e.g. objFormat = {tabStop: 2}
   * @return {String} string value of object
   */
  stringifyAll: function (obj, objFormat) {
    var tabStop = null;
    if (objFormat) {
      if (objFormat.tabStop) {
        tabStop = objFormat.tabStop;
      }
    }
    return JSON.stringify(obj, function (key, value) {
      if (typeof value === "boolean") {
        return value;
      }
      if (value instanceof java.lang.String) {
        return String(value);
      }
      if (value && value.getClass) {
        return String(value.toString());
      }
      return value;
    }, tabStop);
  },

  stringifyQuick: function (obj) {
    return JSON.stringify(obj, function (_, val) {
      return (val && val.getClass) ? String(val) : val;
    });
  },

  /**
   * Serializes a Java object
   * @param {java.lang.Object} javaObject Java object
   * @return {String}
   */
  serialize: function (javaObject) {
    var gsonBuilder, gson,
        json = "";

    if (!javaObject) {
      return "";
    }
    gsonBuilder = new Packages.com.google.gson.GsonBuilder();
    gsonBuilder.disableHtmlEscaping();
    gsonBuilder.setPrettyPrinting();
    gson = gsonBuilder.create();
    json = gson.toJson(javaObject) + "";

    return json;
  },

  /**
   * Deserializes a Java object
   * @param {String} json JSON
   * @param {String} className Class name
   * @return {java.lang.Object} javaObject Java object
   */
  deserialize: function (json, className) {
    var javaObject, gsonBuilder, gson, clazz;

    if (!json) {
      return;
    }

    if (!className) {
      throw "Java class name is empty";
    }

    clazz = java.lang.Class.forName(className);

    gsonBuilder = new Packages.com.google.gson.GsonBuilder();
    gsonBuilder.disableHtmlEscaping();
    gsonBuilder.setPrettyPrinting();
    gson = gsonBuilder.create();
    javaObject = gson.fromJson(json, clazz);

    return javaObject;
  }
});
