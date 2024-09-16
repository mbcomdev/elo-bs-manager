
//@include lib_Class.js

/**
 * Exception utilities
 *
 * @elojc
 * @eloas
 * @eloix
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.0
 *
 * @requires sol.common.ObjectUtils
 */
sol.define("sol.common.ExceptionUtils", {
  singleton: true,

  /**
   * Parses an exception
   * @param {Excecption} ex
   * @return {String}
   */
  parseException: function (ex) {
    var messageParts = [],
        message;

    if (!ex) {
      messageParts.push("Unknown exception");
    } else if (sol.common.ObjectUtils.isString(ex)) {
      messageParts.push(ex);
    } else if (ex.javaException) {
      messageParts.push(ex.javaException + "");
    }

    if (ex.message) {
      messageParts.push(ex.message);
    }

    if (ex.lineNumber) {
      messageParts.push(" (" + ex.fileName + "#" + ex.lineNumber);
      if (ex.columnNumber) {
        messageParts.push("-" + ex.columnNumber);
      }
      messageParts.push(")");
      if (ex.stack) {
        messageParts.push("\r\n");
        messageParts.push(ex.stack);
      }
      if (ex.scriptStackTrace) {
        messageParts.push("\r\n");
        messageParts.push(ex.scriptStackTrace);
      }
    }

    message = messageParts.join("");

    return message;
  },

  /**
   * Logs the ELOas script part where the exception occurs
   * @param {Exception} ex
   * @param {Object} params Parameters
   * @param {Number} params.numberOfLinesBefore Number of lines before
   * @param {Number} params.numberOfLinesAfter Number of lines after
   * @param {Object} params.logger Logger
   * @return {String}
   */
  logAsException: function (ex, params) {
    var me = this,
        script, scriptArr,
        partArr = [],
        i, part, lineNumber, beforeLineNumber, afterLineNumber, logger, message, line, mark;

    if (!ex) {
      return "";
    }

    params = params || {};
    logger = params.logger || log;

    message = me.parseException(ex);
    logger.error("Exception: " + message);

    if (typeof ruleset == "undefined") {
      return "";
    }
    logger.error("Ruleset name: " + ruleset.rulesetName);

    script = ruleset.JScript + "";

    lineNumber = ex.lineNumber;
    if (!lineNumber) {
      return "";
    }
    scriptArr = script.split(/\r\n|\r|\n/);

    params.numberOfLinesBefore = params.numberOfLinesBefore || 10;
    params.numberOfLinesAfter = params.numberOfLinesAfter || 10;

    beforeLineNumber = lineNumber - params.numberOfLinesBefore;
    afterLineNumber = lineNumber + params.numberOfLinesAfter;

    beforeLineNumber = (beforeLineNumber < 0) ? 0 : beforeLineNumber;
    afterLineNumber = (afterLineNumber > scriptArr.length) ? scriptArr.length : afterLineNumber;

    for (i = beforeLineNumber; i < afterLineNumber; i++) {
      line = scriptArr[i];
      mark = (i == (lineNumber - 1)) ? "*" : " ";
      logger.error("Line " + mark + " " + (i + 1) + ": " + line);
      partArr.push(line);
    }

    part = partArr.join("\r\n");

    me.exportAsScript({ logger: logger });

    return part;
  },

  /**
   * Exports the ELOas ruleset script file
   * @param {Object} params Parameters
   * @param {Object} params.logger Logger
   * @return {String}
   */
  exportAsScript: function (params) {
    var logger, script, tempDirPath, scriptTempDir, scriptFile;

    if (typeof ruleset == "undefined") {
      return "";
    }

    params = params || {};
    logger = params.logger || log;

    script = ruleset.JScript + "";

    tempDirPath = String(java.lang.System.getProperty("java.io.tmpdir"));
    scriptTempDir = new java.io.File(tempDirPath, "ELOasScripts");
    Packages.org.apache.commons.io.FileUtils.deleteQuietly(scriptTempDir);
    Packages.org.apache.commons.io.FileUtils.forceMkdir(scriptTempDir);
    scriptFile = new java.io.File(scriptTempDir, ruleset.rulesetName + ".js");
    logger.info("Export ruleset script file: " + scriptFile);
    Packages.org.apache.commons.io.FileUtils.writeStringToFile(scriptFile, script, "UTF-8");

    return script;
  }
});