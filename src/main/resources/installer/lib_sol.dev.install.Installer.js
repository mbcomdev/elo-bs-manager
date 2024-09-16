importPackage(java.io);
importPackage(Packages.de.elo.client.scripting.constants);

//@include lib_Class.js

/**
 * Library functions for ELO solution package installation
 *
 * @author ELO Digital Office GmbH
 *
 * @elojc
 * @eloas
 *
 * @requires moment
 * @requires handlebars
 * @requires sol.common.Config
 * @requires sol.common.Template
 * @requires sol.common.IxUtils
 * @requires sol.common.ObjectUtils
 * @requires sol.common.StringUtils
 * @requires sol.common.AsyncUtils
 * @requires sol.common.FileUtils
 * @requires sol.common.ZipUtils
 * @requires sol.common.SordUtils
 * @requires sol.common.RepoUtils
 * @requires sol.common.AclUtils
 * @requires sol.common.WfUtils
 * @requires sol.common.AsUtils
 * @requires sol.common.HttpUtils
 * @requires sol.common.UserUtils
 * @requires sol.common.SordTypeUtils
 * @requires sol.common.ExceptionUtils
 * @requires sol.common.UserProfile
 * @requires sol.common.TranslateTerms
 * @requires sol.dev.DateShiftUtils
 */

if (typeof globalScope == "undefined") {
  globalScope = {};
}

sol.define("sol.dev.install.MultiProperties", {

  /**
   * @cfg {String} filePath
   * FilePath
   */

  /**
   * @cfg {String} language
   * Language
   */

  initialize: function (params) {
    var me = this;

    me.$super("sol.Base", "initialize", [params]);

    if (!me.filePath) {
      throw "Properties file path is empty";
    }
    me.file = new File(me.filePath);

    me.language = me.language || ixConnect.loginResult.clientInfo.language;

    me.defaultProps = me.readProps();
    if (!me.defaultProps) {
      throw "Can't load properties: " + me.filePath;
    }

    me.langProps = me.readProps(me.language);
  },

  /**
   * Returns the localized text
   * @param {String} key Key
   * @return {String} Text
   */
  getText: function (key) {
    var me = this,
        value;

    if (!key) {
      throw "Key is empty";
    }

    if (me.langProps) {
      value = me.langProps.getProperty(key);
    }
    if (!value) {
      value = me.defaultProps.getProperty(key);
    }
    return value ? String(value) : String(key);
  },

  /**
   * @private
   * Reads a properties file
   * @param {String} language Language
   * @return {java.util.Properties}
   */
  readProps: function (language) {
    var me = this,
        props, filePathWithoutExtension, path, extension,
        file, fileInputStream;

    props = new java.util.Properties();

    path = me.filePath;

    if (language) {
      language = String(language).toUpperCase();
      extension = sol.common.FileUtils.getExtension(me.file);
      filePathWithoutExtension = sol.common.FileUtils.removeExtension(me.file);
      path = filePathWithoutExtension + "_" + language + "." + extension;
    }
    file = new File(path);
    if (file.exists()) {
      fileInputStream = new java.io.FileInputStream(path);
      props.load(fileInputStream);

      return props;
    }
  }
});

sol.define("sol.dev.install.RepoDataUtils", {
  singleton: true,

  /**
   * Converts the export info to Object
   * @param {String} exportInfo Export info
   * @return {Object} Result
   *
   * Example:
   *
   */
  exportInfoToObject: function (exportInfo) {
    var me = this,
        raw, result, keys, i, j, key, docMaskInfo, maskElements, docMaskName,
        headingKeys, headings, lineExists, docMaskResult;

    result = {
      docMasks: {
      }
    };

    if (!exportInfo) {
      throw "Export info is empty";
    }
    raw = sol.common.StringUtils.parseIniString(exportInfo);
    keys = Object.keys(raw.MASKS);
    for (i = 0; i < keys.length; i++) {
      key = keys[i];
      docMaskInfo = raw["MASK" + key];
      maskElements = me.splitExportInfoLine(docMaskInfo.MaskElms);
      docMaskName = maskElements[6];
      headings = me.splitExportInfoLine(maskElements[11], { separator: "|" });
      headingKeys = me.splitExportInfoLine(docMaskInfo.MaskTextTK, { separator: "|" });

      docMaskResult = {
        id: maskElements[0],
        maskAcl: maskElements[1],
        storageId: maskElements[2],
        colorId: maskElements[3],
        flags: maskElements[4],
        name: docMaskName,
        nameKey: docMaskInfo.MaskNameTK || "",
        filingDefinition: maskElements[7],
        barcode: maskElements[8],
        docAcl: maskElements[10],
        headings: headings,
        headingKeys: headingKeys,
        lifetime: maskElements[12],
        timestamp: maskElements[13],
        defaultFlowName: maskElements[14],
        checkInFlowName: maskElements[15],
        guid: docMaskInfo.MaskGuid || "",
        lines: {}
      };

      j = 0;
      do {
        if (j == 50) {
          j = 60; // skip reserved lines
        }
        lineExists = me.analyzeExportDocLine(docMaskInfo, j, docMaskResult);
        j++;
      } while (lineExists && (j <= DocMaskLineC.MAX_ID_DOCMASK_LINE));

      result.docMasks[docMaskName] = docMaskResult;
    }

    return result;
  },

  /**
   * @private
   * @param {String} exportInfoString
   * @param {Object} params Parameters
   * @param {String} [params.separator=,] Separator
   * @param {String} [params.quoteChar="] Quote char
   * @return {Array}
   */
  splitExportInfoLine: function (exportInfoString, params) {
    var arr = [],
        inValue = false,
        value = "",
        char, i;

    exportInfoString = exportInfoString || "";

    exportInfoString += "";

    params = params || {};
    params.separator = params.separator || ",";
    params.quoteChar = params.quoteChar || "\"";

    for (i = 0; i < exportInfoString.length; i++) {
      char = exportInfoString[i];
      if ((char == params.quoteChar) && ((i == 0) || (i == exportInfoString.length - 1) || (exportInfoString[i - 1] == params.separator) || (exportInfoString[i + 1] == params.separator))) {
        inValue = !inValue;
      } else if ((char == params.separator) && !inValue) {
        arr.push(value);
        value = "";
      } else {
        value += char;
      }

      if (i == exportInfoString.length - 1) {
        arr.push(value);
      }
    }

    return arr;
  },

  /**
   * @private
   * @param {Object} docMaskInfo
   * @param {Number} lineIndex
   * @param {Object} docMaskResult
   * @return {Boolean} lineExists
   */
  analyzeExportDocLine: function (docMaskInfo, lineIndex, docMaskResult) {
    var me = this,
        posLines = [],
        linePositions = [],
        lineInfo, j, posLine, positionString, positions, propCount, startPropIndex,
        lineInfoElements, lineKey, lineFlags, lineObj;

    for (j = 0; j < 100; j++) {
      posLine = docMaskInfo["MaskPosInfo" + j];
      if (!posLine) {
        break;
      }
      posLines.push(posLine);
    }
    positionString = posLines.join("");
    if (positionString) {
      positionString = positionString.substr(1);
      positions = positionString.split(",");

      propCount = 6;
      startPropIndex = (lineIndex * propCount);
      linePositions = positions.slice(startPropIndex, startPropIndex + propCount);
    } else {
      linePositions = [0, 0, 0, 0, 0];
    }

    lineInfo = docMaskInfo["MaskLine" + lineIndex];

    if (!lineInfo) {
      return false;
    }
    lineInfoElements = me.splitExportInfoLine(lineInfo);
    lineKey = lineInfoElements[6];
    lineFlags = parseInt(lineInfoElements[7], 10);

    lineObj = {
      id: lineInfoElements[1],
      rawDataType: parseInt(lineInfoElements[2], 10),
      minLen: lineInfoElements[3],
      maxLen: lineInfoElements[4],
      name: lineInfoElements[5],
      nameKey: docMaskInfo["LineNameTK" + lineIndex] || "",
      key: lineKey,

      onlyKeywordListData: ((lineFlags & 1) == 1),
      prefixAsterix: ((lineFlags & 2) == 2),
      postfixAsterix: ((lineFlags & 4) == 4),
      nextTab: ((lineFlags & 8) == 8),
      hidden: ((lineFlags & 0x10) == 0x10),
      readOnly: ((lineFlags & 0x20) == 0x20),
      important: ((lineFlags & 0x40) == 0x40),
      displayOnCheckIn: ((lineFlags & 0x80) == 0x80),
      translateKeywordList: ((lineFlags & 0x100) == 0x100),
      disableF7Search: ((lineFlags & 0x200) == 0x200),
      inheritToChildren: ((lineFlags & 0x400) == 0x400),
      notTokenized: ((lineFlags & 0x800) == 0x800),
      inheritFromParent: ((lineFlags & 0x1000) == 0x1000),
      excludeFromISearch: ((lineFlags & 0x2000) == 0x2000),
      valueArray: ((lineFlags & 0x4000) == 0x4000),
      required: ((lineFlags & 0x8000) == 0x8000),

      acl: lineInfoElements[8],
      quickInfo: lineInfoElements[9] || "",
      quickInfoKey: docMaskInfo["LineCommentTK" + lineIndex] || "",
      externalData: lineInfoElements[10],
      defaultValue: lineInfoElements[11],
      tabIndex: lineInfoElements[12],
      guid: lineInfo.MaskGuid,
      script: docMaskInfo["serverScriptName" + lineIndex] || "",

      labelCol: linePositions[0],
      labelRow: linePositions[1],
      editCol: linePositions[2],
      editRow: linePositions[3],
      editWidth: linePositions[4],
      tabOrder: linePositions[5]
    };

    docMaskResult.lines[lineKey] = lineObj;

    return true;
  },

  /**
   * Compares the export data
   * @param {Object} exportData Export data
   * @return {Object} Difference
   */
  compareExportData: function (exportData) {
    var me = this,
        diffData = {
          docMasks: [],
          hints: []
        },
        maskName, docMaskData;

    if (!exportData) {
      throw "Export data is empty";
    }

    for (maskName in exportData.docMasks) {
      docMaskData = exportData.docMasks[maskName];
      me.compareDocMask(maskName, docMaskData, diffData);
    }

    return diffData;
  },

  /**
   * @private
   * Compares a document mask
   * @param {String} maskName Mask name
   * @param {Object} docMaskData Document mask data
   * @param {Object} diffData data
   */
  compareDocMask: function (maskName, docMaskData, diffData) {
    var me = this,
        lines, lineKey, maskGuid, docMaskLine, line, docMask, docMaskDiffData;

    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, false);

    maskGuid = docMaskData.guid;

    try {
      docMask = ixConnect.ix().checkoutDocMask(maskGuid + "", DocMaskC.mbAll, LockC.NO);
    } catch (ignore) {
    }

    if (!docMask) {
      try {
        docMask = ixConnect.ix().checkoutDocMask(maskName + "", DocMaskC.mbAll, LockC.NO);
      } catch (ignore) {
      }
    }

    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, true);

    if (!docMask) {
      diffData.hints.push("Can't read document mask '" + maskName + "' " + maskGuid);

      return;
    }

    for (lineKey in docMaskData.lines) {
      line = docMaskData.lines[lineKey];

      docMaskLine = me.getDocMaskLine(docMask, lineKey);

      if (!docMaskLine && (lineKey != "_RESERVED")) {
        lines = lines || [];
        lines.push(line);
      }
    }

    docMaskDiffData = {
      maskName: maskName,
      dstMaskGuid: docMask.guid + "",
      lines: lines
    };
    if (lines) {
      diffData.docMasks.push(docMaskDiffData);
    }
  },

  /**
   * @private
   * Returns the document mask line
   * @param {de.elo.ix.client.DocMask} docMask Document mask
   * @param {String} lineKey Line key
   * @return {de.elo.ix.client.DocMaskLine} Document mask line
   */
  getDocMaskLine: function (docMask, lineKey) {
    var i, docMaskLine;

    for (i = 0; i < docMask.lines.length; i++) {
      docMaskLine = docMask.lines[i];
      if (docMaskLine.key == lineKey) {
        return docMaskLine;
      }
    }
  }
});

sol.define("sol.dev.install.InstallHandlerBase", {

  /**
   * @cfg {String} payloadDirPath (required)
   */

  /**
   * @cfg {String} result (required)
   */

  initialize: function (config) {
    var me = this;

    me.$super("sol.Base", "initialize", [config]);

    if (!me.config) {
      throw "Parameter 'config' must be given";
    }

    if (!me.result) {
      throw "Parameter 'result' must be given";
    }
  },

  /**
   * Log
   * @param {Object} message Message
   * @param {String} message.text Message text
   * @param {String} message.data Message data
   */
  log: function (message) {
    var me = this;

    me.prepareMessage(message);
    me.logMessage(message);
  },

  /**
   * Process message
   * @param {Object} message Message
   * @param {String} message.key Message key
   * @param {String} message.data Message data
   * @return {Object}
   */
  prepareMessage: function (message) {
    var me = this,
        args;

    message = message || {};

    if (message.key) {
      message.text = me.getText(message.key);
      delete message.key;
    }
    if (message.data) {
      args = message.data || [];
      args.unshift(message.text);
      message.text = sol.common.StringUtils.format.apply(me, args);
      delete message.data;
    }

    return message;
  },

  addIssue: function (issue) {
    var me = this;

    me.result.issues.items.push(issue);
  },

  processIssues: function () {
    var me = this,
        scriptDirPath, htmlTemplate, textTemplate, textContent, lines;

    if (me.result.issues.items.length > 0) {
      me.result.issues.items.forEach(function (issue) {
        me.prepareMessage(issue.title);
        me.prepareMessage(issue.details);
      });
      me.result.issues.title = me.getText("sol.dev.install.title.issues");
      me.result.issues.continueSetup = me.getText("sol.dev.install.text.continueSetup");

      scriptDirPath = String(new File(me.payloadDirPath).parent);

      textTemplate = sol.common.FileUtils.readFileToString(scriptDirPath + File.separator + "issues_text_tpl.txt");
      textContent = sol.create("sol.common.Template", { source: textTemplate }).apply(me.result.issues);

      lines = sol.common.StringUtils.splitLines(textContent);
      lines.forEach(function (line) {
        me.logMessage({ text: line });
      });

      htmlTemplate = sol.common.FileUtils.readFileToString(scriptDirPath + File.separator + "issues_html_tpl.txt");
      me.result.issues.htmlContent = sol.create("sol.common.Template", { source: htmlTemplate }).apply(me.result.issues);

      me.handleIssues();
    }
  },

  /**
   * @abstract
   * @param {Object} params Parameters
   * @param {String} params.message Message
   */
  logMessage: function (params) {
    throw "Can't call abstract method 'sol.dev.install.InstallHandlerBase.logMessage()'";
  },

  /**
   * @abstract
   * @param {String} key
   */
  getText: function (key) {
    throw "Can't call abstract method 'sol.dev.install.InstallHandlerBase.getText()'";
  },

  /**
   * @abstract
   * @param {String} key
   */
  getTempDir: function (key) {
    throw "Can't call abstract method 'sol.dev.install.InstallHandlerBase.getTempDir()'";
  },

  /**
   * @abstract
   */
  handleIssues: function () {
    throw "Can't call abstract method 'sol.dev.install.InstallHandlerBase.handleIssues()'";
  },

  handleExportInfoDiffs: function () {
    return true;
  }
});

sol.define("sol.dev.install.JcHandler", {
  extend: "sol.dev.install.InstallHandlerBase",

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallHandlerBase", "initialize", [config]);
    me.fileLogger = sol.create("sol.dev.install.FileLogger", {
      tempDir: me.getTempDir(),
      config: me.config
    });

    if (workspace.directories.payloadDir) {
      me.payloadDirPath = String(workspace.directories.payloadDir.canonicalPath);
    }
  },

  getTempDir: function () {
    return workspace.directories.tempDir;
  },

  /**
   * @private
   * Writes a log message
   * @param {Object} message Log message
   * @param {String} message.text Messge text
   * @param {Boolean} message.statusBar Write to status bar
   */
  logMessage: function (message) {
    var me = this;

    message = message || {};

    me.fileLogger.log(message);
    if (message.statusBar) {
      workspace.setStatusMessage(message.text);
    }
  },

  handleIssues: function () {
    var me = this,
        htmlDialogContentTempFilePath, htmlDialogContentUrl, dialogResult;

    if (me.result.issues.htmlContent) {
      htmlDialogContentTempFilePath = me.getTempDir().canonicalPath + File.separator + "HtmlDialogContent_" + java.lang.System.nanoTime() + ".html";
      sol.common.FileUtils.writeStringToFile(htmlDialogContentTempFilePath, me.result.issues.htmlContent, { bom: true });
      htmlDialogContentUrl = sol.common.FileUtils.getUrlFromFilePath(htmlDialogContentTempFilePath);
      dialogResult = me.showHtmlDialog({ title: me.getText("sol.dev.install.title.installer"), url: htmlDialogContentUrl });
      me.log({ text: "dialogResult={0}", data: [dialogResult] });
      me.result.canceled = !dialogResult;
      if (!me.result.canceled) {
        globalScope.runningSetup = me.config.install.setupName;
      }
    }
  },

  handleExportInfoDiffs: function () {
    var me = this,
        htmlDialogContentTempFilePath, htmlDialogContentUrl, dialogResult;

    if (me.result.exportInfoDiffs.htmlContent) {
      htmlDialogContentTempFilePath = me.getTempDir().canonicalPath + File.separator + "HtmlDialogContent_" + java.lang.System.nanoTime() + ".html";
      sol.common.FileUtils.writeStringToFile(htmlDialogContentTempFilePath, me.result.exportInfoDiffs.htmlContent, { bom: true });
      htmlDialogContentUrl = sol.common.FileUtils.getUrlFromFilePath(htmlDialogContentTempFilePath);
      dialogResult = me.showHtmlDialog({ title: me.getText("sol.dev.install.title.installer"), url: htmlDialogContentUrl });
      me.log({ text: "dialogResult={0}", data: [dialogResult] });
      return dialogResult;
    }
  },

  /**
   * Shows a HTML dialog
   * @param {Object} params Parameter
   * @param {String} params.title Title
   * @param {String} params.url URL
   * @return {Boolean}
   */
  showHtmlDialog: function (params) {
    var appDialog, result;

    params = params || {};
    params.title = params.title || "";
    params.url = params.url || "";
    appDialog = workspace.createAppDialog(params.title);
    appDialog.loadUrl(params.url);
    result = appDialog.show();
    return result;
  },

  finalize: function () {
    var me = this,
        message, messageDetails, content;

    if (me.config.install.interactive) {
      return;
    }

    if (me.result.canceled) {
      message = me.result.canceledMessage || me.prepareMessage({ key: "sol.dev.install.message.canceled", data: [me.config.install.setupName], statusBar: true });
      me.logMessage(message);
      content = "<h3>" + message.text + "</h3>";
      workspace.showAlertBox(me.getText("sol.dev.install.title.installer"), content);
    } else {
      message = me.prepareMessage({ key: "sol.dev.install.message.finished", data: [me.config.install.setupName], statusBar: true });
      me.log(message);
      messageDetails = me.prepareMessage({ key: "sol.dev.install.message.finishedDetails" });
      me.log(messageDetails);
      content = "<h3>" + message.text + "</h3>" + messageDetails.text;
      workspace.showInfoBox(me.getText("sol.dev.install.title.installer"), content);
      globalScope.runningSetup = "";
    }

    me.fileLogger.finalize();

    try {
      Packages.de.elo.client.ioutil.Installer.message = message.text;
    } catch (ignore) {
      // ignore
    }

    if (me.debug || me.result.canceled) {
      Packages.java.awt.Desktop.getDesktop().open(me.fileLogger.logFile);
    }
  },

  /**
   * Helper function that returns the localized text of a resource file
   * @param {String} key Key of the text.
   * @return {String} Localized text.
   */
  getText: function (key) {
    return String(utils.getText("sol.dev.install", key));
  }
});

sol.define("sol.dev.install.AsHandler", {
  extend: "sol.dev.install.InstallHandlerBase",

  initialize: function (config) {
    var me = this,
        scriptDirPath;

    me.$super("sol.dev.install.InstallHandlerBase", "initialize", [config]);
    me.fileLogger = sol.create("sol.dev.install.FileLogger", {
      tempDir: me.getTempDir(),
      config: me.config
    });

    me.payloadDirPath = String(Packages.de.elo.mover.main.helper.ScriptHelper.getPayloadDirPath());
    scriptDirPath = String(new File(me.payloadDirPath).parent);

    me.props = sol.create("sol.dev.install.MultiProperties", { filePath: scriptDirPath + File.separator + "text_sol.dev.install.properties", language: "en" });
  },

  getTempDir: function () {
    var tempDirPath, tempDir;

    tempDirPath = sol.common.FileUtils.getTempDirPath();
    tempDir = new File(tempDirPath);
    return tempDir;
  },

  /**
   * @private
   * Writes a log message
   * @param {Object} message Log message
   * @param {String} message.text Messge text
   * @param {Boolean} message.statusBar Write to status bar
   */
  logMessage: function (message) {
    var me = this;

    message = message || {};

    me.fileLogger.log(message);
    if (message && message.text) {
      log.info(message.text);
    }
  },

  finalize: function () {
    var me = this,
        message;

    message = me.prepareMessage({ key: "sol.dev.install.message.finished", data: [me.config.install.setupName] });
    me.log(message);

    me.fileLogger.finalize();

    if (typeof installResult != "undefined") {
      installResult.httpStatus = "200";
      installResult.contentType = "application/json";
      installResult.httpContent = JSON.stringify(me.result);
    }
  },

  handleIssues: function () {
    var me = this;

    if (me.result.fatal) {
      me.result.canceled = true;
    }
  },

  getText: function (key) {
    var me = this;

    return me.props.getText(key);
  }
});

sol.define("sol.dev.install.IxHandler", {
  extend: "sol.dev.install.InstallHandlerBase",

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallHandlerBase", "initialize", [config]);
    me.stringLogger = sol.create("sol.dev.install.StringLogger", { config: me.config });
    sol.common.TranslateTerms.require("sol.dev.install");
  },

  /**
   * @private
   * Writes a log message
   * @param {Object} message Log message
   * @param {String} message.text Messge text
   */
  logMessage: function (message) {
    var me = this;

    message = message || {};

    me.stringLogger.log(message);
  },

  finalize: function () {
    var me = this,
        message;

    message = me.prepareMessage({ key: "sol.dev.install.message.finished", data: [me.config.install.setupName] });
    me.logMessage(message);

    me.stringLogger.finalize();
  },

  handleIssues: function () {
    var me = this;

    if (me.result.fatal) {
      me.result.canceled = true;
    }
  },

  getText: function (key) {
    return sol.common.TranslateTerms.translate(key);
  }
});

sol.define("sol.dev.install.ShHandler", {
  extend: "sol.dev.install.InstallHandlerBase",

  initialize: function (config) {
    var me = this,
        scriptDirPath;

    me.$super("sol.dev.install.InstallHandlerBase", "initialize", [config]);
    me.fileLogger = sol.create("sol.dev.install.FileLogger", {
      tempDir: me.getTempDir(),
      config: me.config
    });

    if (typeof ELOINSTDIR != "undefined") {
      me.payloadDirPath = ELOINSTDIR + File.separator + "install.data";
      scriptDirPath = ELOINSTDIR;
    } else {
      me.payloadDirPath = __DIR__ + "install.data";
      scriptDirPath = String(new File(me.payloadDirPath).parent);
    }

    me.props = sol.create("sol.dev.install.MultiProperties", { filePath: scriptDirPath + File.separator + "text_sol.dev.install.properties", language: "en" });
  },

  getTempDir: function () {
    var tempDirPath, tempDir;

    tempDirPath = sol.common.FileUtils.getTempDirPath();
    tempDir = new File(tempDirPath);
    return tempDir;
  },

  /**
   * @private
   * Writes a log message
   * @param {Object} message Log message
   * @param {String} message.text Messge text
   * @param {Boolean} message.statusBar Write to status bar
   */
  logMessage: function (message) {
    var me = this;

    message = message || {};

    me.fileLogger.log(message);
    if (message && message.text) {
      log.info(message.text);
    }
  },

  finalize: function () {
    var me = this,
        message;

    message = me.prepareMessage({ key: "sol.dev.install.message.finished", data: [me.config.install.setupName] });
    me.log(message);

    me.fileLogger.finalize();

    if (typeof installResult != "undefined") {
      installResult.httpStatus = "200";
      installResult.contentType = "application/json";
      installResult.httpContent = JSON.stringify(me.result);
    }
  },

  handleIssues: function () {
    var me = this;

    if (me.result.fatal) {
      me.result.canceled = true;
    }
  },

  getText: function (key) {
    var me = this;

    return me.props.getText(key);
  }
});

sol.define("sol.dev.install.TestHandler", {
  extend: "sol.dev.install.JcHandler",

  initialize: function (config) {
    var me = this,
        scriptDirPath, scriptDir, payloadDir;

    me.$super("sol.dev.install.InstallHandlerBase", "initialize", [config]);

    scriptDirPath = me.config.install.scriptDirPath || "c:/temp/BsInstall";
    me.payloadDirPath = scriptDirPath + File.separator + "install.data";

    scriptDir = new File(scriptDirPath);
    payloadDir = new File(me.payloadDirPath);

    sol.common.FileUtils.makeDirectories(payloadDir);
    sol.common.FileUtils.deleteFiles({ dirPath: scriptDirPath });

    me.fileLogger = sol.create("sol.dev.install.FileLogger", {
      tempDir: scriptDir,
      config: me.config
    });

    sol.common.FileUtils.downloadDocuments("ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/development/Package Installer", scriptDirPath);

    me.props = sol.create("sol.dev.install.MultiProperties", { filePath: scriptDirPath + File.separator + "text_sol.dev.install.properties", language: "en" });
  },

  /**
   * @private
   * Writes a log message
   * @param {Object} message Log message
   * @param {String} message.text Messge text
   * @param {Boolean} message.statusBar Write to status bar
   */
  logMessage: function (message) {
    var me = this;

    message = message || {};

    me.fileLogger.log(message);
    if (message && message.text) {
      log.info(message.text);
    }
  },

  finalize: function () {
    var me = this,
        message;

    message = me.prepareMessage({ key: "sol.dev.install.message.finished", data: [me.config.install.setupName] });
    me.log(message);

    me.fileLogger.finalize();
  },

  getText: function (key) {
    var me = this;

    return me.props.getText(key);
  }
});

/**
 * Logger base class
 */
sol.define("sol.dev.install.LoggerBase", {

  initialize: function (params) {
    var me = this;

    me.$super("sol.Base", "initialize", [params]);

    if (!me.config) {
      throw "Setup configuration is empty";
    }

    me.logFileName = "log_install_" + me.config.install.packageName + "_" + me.getCurrentTimeStamp("yyyyMMddHHmmss");
  },

  /**
   * @abstract
   */
  log: function () {
    throw "Can't call abstract method 'sol.dev.install.LoggerBase.log()'";
  },

  /**
   * @private
   * Returns a time stamp of the current time
   * @param {String} format Format of the timestamp.
   * @return {String}
   */
  getCurrentTimeStamp: function (format) {
    return String(new java.text.SimpleDateFormat(format).format(new java.util.Date()));
  },

  /**
   * @private
   * Determinates the log folder ID
   * @return {String} Log folder ID
   */
  getLogFolderId: function () {
    var me = this,
        logFolderId;

    if (me.config.install.packageFolderId) {
      me.logRepoFolderPath = "ARCPATH[" + me.config.install.packageFolderId + "]:/.eloinst";
    } else {
      me.logRepoFolderPath = sol.common.RepoUtils.resolveSpecialFolder("{{packageFolderPath}}/.eloinst", me.config.base.repoPathParamObj);
    }
    logFolderId = sol.common.RepoUtils.getObjId(me.logRepoFolderPath);
    return logFolderId;
  },

  /**
   * @abstract
   */
  finalize: function () {
    throw "Can't call abstract method 'sol.dev.install.LoggerBase.execute()'";
  }
});

/**
 * File logger
 */
sol.define("sol.dev.install.FileLogger", {
  extend: "sol.dev.install.LoggerBase",

  /**
   * @cfg {java.io.File} tempDir
   * Temp directory
   */

  initialize: function (params) {
    var me = this;

    me.$super("sol.dev.install.LoggerBase", "initialize", [params]);

    if (!me.tempDir) {
      throw "Temp directory is empty";
    }

    me.logFile = new File(params.tempDir.canonicalPath + File.separator + me.logFileName + ".txt");

    me.writer = new PrintWriter(new FileWriter(me.logFile), true);
  },

  /**
   * Writes a message into the log file
   * @param {Object} message
   */
  log: function (message) {
    var me = this,
        line;

    message = message || {};
    line = me.getCurrentTimeStamp("yyyy-MM-dd HH:mm:ss.SSS") + ": " + message.text;
    me.writer.println(line);
  },

  /**
   * Finalize the log file
   */
  finalize: function () {
    var me = this,
        logFolderId;

    me.writer.close();

    logFolderId = me.getLogFolderId();
    if (logFolderId) {
      sol.common.RepoUtils.saveToRepo({ parentId: logFolderId, name: me.logFileName, file: me.logFile });
    }
  }
});

/**
 * String logger
 */
sol.define("sol.dev.install.StringLogger", {
  extend: "sol.dev.install.LoggerBase",

  initialize: function (params) {
    var me = this;

    me.$super("sol.dev.install.LoggerBase", "initialize", [params]);

    me.lines = [];
  },

  /**
   * Writes a message into the log file
   * @param {Object} message
   */
  log: function (message) {
    var me = this,
        line;

    message = message || {};
    line = me.getCurrentTimeStamp("yyyy-MM-dd HH:mm:ss.SSS") + ": " + message.text;
    me.lines.push(line);
  },

  /**
   * Finalize the log file
   */
  finalize: function () {
    var me = this,
        logFolderId, content;

    content = me.lines.join("\r\n");
    log.debug(content);

    logFolderId = me.getLogFolderId();
    if (logFolderId) {
      sol.common.RepoUtils.saveToRepo({
        parentId: logFolderId,
        name: me.logFileName,
        extension: "txt",
        contentString: content,
        withoutBom: true
      });
    }
  }
});


var CURR_INST_FUNC;

sol.define("sol.dev.install.InstallFunctionBase", {

  /**
   * @cfg {Object} install (required)
   * Installation configuration
   */

  /**
   * @cfg {Object} result
   * Output
   */

  /**
   * @cfg {String} srcDirPath
   * Path of the source directory. If the directory doesn't exist, then the step will be skipped.
   */

  /**
   * @cfg {Array} handlers
   * Installation handlers, e.g. ´sol.dev.install.JcHandler´, ´sol.dev.install.AsHandler´, ´sol.dev.install.IxHandler´ or ´sol.dev.install.ShHandler´
   */

  /**
   * @cfg {Object} config (required)
   * Configuration
   */

  /**
   * @cfg {Object} config.base
   * Base configuration
   */

  /**
   * @cfg {Object} config.base.repoPathParamObj
   * Object that contains data to resolve repository paths
   */

  /**
   * @cfg {Object} config.install Installation configuration
   */

  /**
   * @cfg {Object} config.handler Install handler
   */

  pilcrow: "\u00b6",

  initialize: function (params) {
    var me = this;

    if (me.$className === "sol.dev.install.InstallFunctionBase") {
      throw "Can't create instance of base class 'sol.dev.install.InstallFunctionBase'";
    }

    if (!params.config) {
      throw "Configuration must be given";
    }

    if (!params.config.install) {
      throw "Parameter 'config.install' must be given";
    }

    if (!params.config.base) {
      throw "Parameter 'config.base' must be given";
    }

    if (!params.handler) {
      throw "Parameter 'handler' must be given";
    }

    if (!params.result) {
      throw "Parameter 'result' must be given";
    }

    me.$super("sol.Base", "initialize", [params]);
  },

  /**
   * Checks wether the function should run
   * This function can be overwritten.
   * @return {Boolean}
   */
  check: function () {
    return true;
  },

  /**
   * Processes the installation function
   */
  process: function () {
    var me = this;

    if (!me.check()) {
      return;
    }

    if (me.srcDirPath) {
      if (sol.common.FileUtils.exists(me.srcDirPath)) {
        me.srcDir = new File(me.srcDirPath);
      } else {
        return;
      }
    }

    if (me.handlers && (me.handlers.indexOf(me.handler.$className) < 0)) {
      me.handler.log({ text: "Installation function '" + me.$className + "' skipped." });
      return;
    }
    me.execute();
  },

  /**
   * @abstract
   */
  execute: function () {
    throw "Can't call abstract method 'sol.dev.install.InstallFunctionBase.execute()'";
  }
});

sol.define("sol.dev.install.mixin.InstallUtils", {
  mixin: true,

  /**
   * Sends a HTTP requests
   * @param {String} description
   * @param {String} url
   * @param {Boolean} params Parameters
   * @param {String} [params.method=get] Method
   * @param {Number} [params.readTimeout=10000] Read timeout
   */
  sendHttpRequest: function (description, url, params) {
    var me = this,
        responseObj, logStr,
        httpRequest = {};

    params = params || {};
    params.method = params.method || "get";
    params.readTimeout = params.readTimeout || 10000;

    httpRequest.url = sol.common.HttpUtils.resolveUrl(url, params);
    me.handler.log({ text: description + ": " + httpRequest.url, statusBar: true });
    httpRequest.resolve = false;
    httpRequest.connectTimeout = 3000;
    httpRequest.readTimeout = params.readTimeout;
    httpRequest.trustAllHosts = true;
    httpRequest.trustAllCerts = true;
    if (params.method == "post") {
      httpRequest.method = "post";
      httpRequest.contentType = "application/json;charset=UTF-8";
      httpRequest.addCookieTicket = true;
    }
    responseObj = sol.common.HttpUtils.sendRequest(httpRequest);
    if (responseObj.errorMessage) {
      logStr = "errorMessage=" + responseObj.errorMessage;
    } else {
      logStr = "responseCode=" + responseObj.responseCode + ", ok=" + responseObj.responseOk;
    }
    me.handler.log({ text: logStr });
  }
});

sol.define("sol.dev.install.functions.CheckRunningSetup", {
  extend: "sol.dev.install.InstallFunctionBase",

  handlers: ["sol.dev.install.JcHandler"],

  /**
   * Checks wether another installation is running
   */
  execute: function () {
    var me = this;

    if (globalScope.runningSetup) {
      me.result.canceled = true;
      me.result.canceledMessage = me.handler.prepareMessage({ key: "sol.dev.install.message.setupAlreadyRunning", data: [me.config.install.setupName], statusBar: true });
    }
  }
});

sol.define("sol.dev.install.functions.CheckJcRequirements", {
  extend: "sol.dev.install.InstallFunctionBase",

  handlers: ["sol.dev.install.JcHandler"],

  /**
   * Checks the JC requirements of the installation
   */
  execute: function () {
    var me = this,
        requiredJavaClientVersion;

    requiredJavaClientVersion = me.config.install.requiredJavaClientVersion || "9.03.006";
    me.handler.log({ text: "ELO Java Client version: {0}", data: [String(workspace.clientVersion)] });
    if (!sol.common.RepoUtils.checkVersion(workspace.clientVersion, requiredJavaClientVersion)) {
      me.handler.addIssue({
        title: { key: "sol.dev.install.message.higherJcVersionRequired", data: [requiredJavaClientVersion] }
      });
    }
  }
});

sol.define("sol.dev.install.functions.CheckIxRequirements", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Checks the IX requirements of the installation
   */
  execute: function () {
    var me = this,
        requiredIxVersion, currentIxVersion;

    try {
      currentIxVersion = ixConnect.version;
    } catch (ex) {
      me.handler.addIssue({
        messages: [{ key: "sol.dev.install.message.cannotDetectIxVersion" }]
      });
      return;
    }

    requiredIxVersion = me.config.install.requiredIxVersion || "9.00.050";
    me.handler.log({ text: "IX version: {0}", data: [String(ixConnect.version)] });
    if (!sol.common.RepoUtils.checkVersion(currentIxVersion, requiredIxVersion)) {
      me.handler.addIssue({
        title: { key: "sol.dev.install.message.higherIxVersionRequired", data: [requiredIxVersion] }
      });
    }
  }
});

sol.define("sol.dev.install.functions.CheckPermissions", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Checks the rights
   */
  execute: function () {
    var me = this,
        permissions, missingPermissions;

    permissions = ["FLAG_ADMIN", "FLAG_IMPORT"];

    missingPermissions = sol.common.UserUtils.checkCurrentPermissions(permissions);

    if (missingPermissions && (missingPermissions.length > 0)) {
      me.handler.addIssue({
        title: { key: "sol.dev.install.message.missingPermissions" },
        list: missingPermissions
      });
      me.result.fatal = true;
    }
  }
});

sol.define("sol.dev.install.functions.CheckPackageAlreadyInstalled", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Checks wether the package is already installed
   */
  execute: function () {
    var me = this,
        path, exists;

    path = sol.common.RepoUtils.resolveSpecialFolder("{{packageFolderPath}}", me.config.base.repoPathParamObj);

    exists = sol.common.RepoUtils.exists(path);
    if (exists) {
      me.handler.addIssue({
        title: { key: "sol.dev.install.message.packageAlreadyInstalled", data: [me.config.install.setupName] },
        details: { key: "sol.dev.install.message.packageAlreadyInstalledDetails" }
      });
      me.result.undeploy = true;
    }
  }
});

sol.define("sol.dev.install.functions.TransportWarning", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Transport warning
   */
  execute: function () {
    var me = this;

    me.handler.addIssue({
      title: { key: "sol.dev.install.message.transportPackage" },
      details: { key: "sol.dev.install.message.transportPackageCouldDamageRepo" }
    });
  }
});

sol.define("sol.dev.install.functions.CheckDocMasksMustNotExist", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.docMasksMustNotExist;
  },

  execute: function () {
    var me = this,
        existingMaskNames = [],
        i, maskName, exists, maskNamesExists;

    for (i = 0; i < me.config.install.docMasksMustNotExist.length; i++) {
      maskName = me.config.install.docMasksMustNotExist[i];

      exists = sol.common.SordUtils.docMaskExists(maskName);
      if (exists) {
        existingMaskNames.push(maskName);
        maskNamesExists = true;
      }
    }

    if (maskNamesExists) {
      me.handler.addIssue({
        title: { key: "sol.dev.install.message.masksAlreadyExist" },
        list: existingMaskNames
      });
    }
  }
});

sol.define("sol.dev.install.functions.CheckRepoPathsMustNotExist", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.repoPathsMustNotExist;
  },

  execute: function () {
    var me = this,
        existingRepoPaths = [],
        repoPathsExist = false,
        i, repoPath, exists;


    for (i = 0; i < me.config.install.repoPathsMustNotExist.length; i++) {
      repoPath = me.config.install.repoPathsMustNotExist[i];
      repoPath = sol.common.RepoUtils.resolveSpecialFolder(repoPath, me.config.base.repoPathParamObj);
      repoPath = sol.common.RepoUtils.normalizePath(repoPath, true);

      exists = sol.common.RepoUtils.exists(repoPath);
      if (exists) {
        existingRepoPaths.push(repoPath);
        repoPathsExist = true;
      }
    }

    if (repoPathsExist) {
      me.handler.addIssue({
        title: { key: "sol.dev.install.message.repoPathsAlreadyExist", list: existingRepoPaths }
      });
    }
  }
});

sol.define("sol.dev.install.functions.CheckWfIsRunning", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return (me.config.install.checkWfIsRunning);
  },

  /**
   * Checks wether the ELOwf is running
   */
  execute: function () {
    var me = this,
        resultObj, url, errorMessage;

    resultObj = sol.common.WfUtils.checkWfIsRunning();
    if (!resultObj.isRunning) {
      url = resultObj.url;
      errorMessage = resultObj.errorMessage || "";
      me.handler.addIssue({
        title: { key: "sol.dev.install.message.wfNotRunning" },
        details: { key: "sol.dev.install.message.wfUrl", data: [url, errorMessage] }
      });
    }
  }
});

sol.define("sol.dev.install.functions.CheckAsLibs", {
  extend: "sol.dev.install.InstallFunctionBase",

  libRepoPaths: [
    "{{{asBaseFolderPath}}}/JavaScript/ix: IndexServer Functions",
    "{{{asBaseFolderPath}}}/JavaScript/fu: File Utils"
  ],

  /**
   * Checks wether the ELOas libraries are incorrect or outdated
   */
  execute: function () {
    var me = this,
        incorrectLibs = [],
        i, libRepoPath, displayLibRepoPath, incorrect;

    for (i = 0; i < me.libRepoPaths.length; i++) {
      libRepoPath = sol.common.RepoUtils.resolveSpecialFolder(me.libRepoPaths[i], me.config.base.repoPathParamObj);
      incorrect = me.isLibIncorrect(libRepoPath);
      if (incorrect) {
        displayLibRepoPath = sol.common.StringUtils.replaceAll(libRepoPath, me.pilcrow, "/");
        incorrectLibs.push(displayLibRepoPath);
      }
    }

    if (incorrectLibs.length > 0) {
      me.handler.addIssue({
        title: { key: "sol.dev.install.message.asLibsIncorrect" },
        list: incorrectLibs
      });
    }
  },

  isLibIncorrect: function (repoPath) {
    var objId, sord, isFolder, content, remainder,
        lastCurlyBracketPos, nextChar;

    repoPath = sol.common.RepoUtils.resolveSpecialFolder(repoPath);
    objId = sol.common.RepoUtils.getObjId(repoPath);
    if (objId) {
      sord = sol.common.RepoUtils.getSord(objId, { sordZ: SordC.mbLean });
      isFolder = sol.common.SordUtils.isFolder(sord);
      if (isFolder) {
        return true;
      }
      try {
        content = sol.common.RepoUtils.downloadToString(objId);
      } catch (ex) {
        return true;
      }
      lastCurlyBracketPos = content.lastIndexOf("}");
      if (lastCurlyBracketPos > -1) {
        if (content.length > (lastCurlyBracketPos + 1)) {
          remainder = content.substr(lastCurlyBracketPos + 1).replace(/\s/g, "");
          nextChar = remainder.substr(0, 1);
          if (nextChar == ";") {
            return false;
          }
        }
      }
    }
    return true;
  }
});

sol.define("sol.dev.install.functions.CheckPackageDependencyInstalled", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Checks wether the package is already installed
   */
  execute: function () {
    var me = this,
        missingPackages = [], notRequiredVersions = [], key, sord, exists,
        i, delim = sol.common.RepoUtils.getPathSeparator(sol.common.RepoUtils.specialFolders.bsFolder[1]), dependency, path, version;

    if (me.config.install.dependencies && me.config.install.dependencies.length > 0) {
      me.handler.log({ text: "Dependency found, amount: " + me.config.install.dependencies.length });
      for (i = 0; i < me.config.install.dependencies.length; i++) {
        dependency = me.config.install.dependencies[i];
        me.handler.log({ text: "Checking dependency " + i + ": " + dependency.packageName });
        if (dependency.checkBase) {
          path = sol.common.RepoUtils.resolveSpecialFolder(sol.common.RepoUtils.specialFolders.bsFolder[1] + delim + dependency.packageName);
          exists = sol.common.RepoUtils.exists(path);
          if (!exists) {
            missingPackages.push(dependency.packageName);
          } else if (dependency.minReqVersionBase) {
            sord = sol.common.RepoUtils.getSord(path, { sordZ: SordC.mbLean });
            version = sol.common.SordUtils.getObjKeyValue(sord, "BS_VERSION_NO");
            if (!sol.common.RepoUtils.checkVersion(version, dependency.minReqVersionBase)) {
              notRequiredVersions.push(dependency.packageName + " " + version + " &lt; " + dependency.minReqVersionBase);
            }
          }
        }
        if (dependency.checkCustom) {
          path = sol.common.RepoUtils.resolveSpecialFolder(sol.common.RepoUtils.specialFolders.bsFolder[1] + " Custom" + delim + dependency.packageName);
          exists = sol.common.RepoUtils.exists(path);
          if (!exists) {
            missingPackages.push("custom_" + dependency.packageName);
          } else if (dependency.minReqVersionCustom) {
            sord = sol.common.RepoUtils.getSord(path, { sordZ: SordC.mbLean });
            version = sol.common.SordUtils.getObjKeyValue(sord, "BS_VERSION_NO");
            if (!sol.common.RepoUtils.checkVersion(version, dependency.minReqVersionCustom)) {
              notRequiredVersions.push("custom_" + dependency.packageName + " " + version + " &lt; " + dependency.minReqVersionCustom);
            }
          }
        }
      }
      if (missingPackages.length > 0 && notRequiredVersions.length > 0) {
        me.result.canceledMessage = me.handler.prepareMessage({ key: "sol.dev.install.message.bothNotSucceededDependencyDetails",
          data: [missingPackages.join(", "), notRequiredVersions.join(", ")] });
        me.result.canceled = true;
        return;
      }
      if (missingPackages.length > 0) {
        key = "sol.dev.install.message.missingDependencyDetailsSingular";
        if (missingPackages.length > 1) {
          key = "sol.dev.install.message.missingDependencyDetailsMultiple";
        }
        me .result.canceledMessage = me.handler.prepareMessage({ key: key, data: [missingPackages.join(", ")] });
        me.result.canceled = true;
        return;
      }
      if (notRequiredVersions.length > 0) {
        key = "sol.dev.install.message.notRequiredVersionDependencyDetailsSingular";
        if (notRequiredVersions.length > 1) {
          key = "sol.dev.install.message.notRequiredVersionDependencyDetailsMultiple";
        }
        me.result.canceledMessage = me.handler.prepareMessage({ key: key,
          data: [notRequiredVersions.join(", ")] });
        me.result.canceled = true;
        return;
      }
    }
    me.handler.log({ text: "No dependency found" });
  }
});

sol.define("sol.dev.install.functions.ProcessIssues", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Process issues
   */
  execute: function () {
    var me = this;

    me.handler.processIssues();
  }
});


sol.define("sol.dev.install.functions.CreateUsers", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.users;
  },

  /**
   * Creates new user
   */
  execute: function () {
    var me = this;

    me.handler.log({ text: "Create users...", statusBar: true });
    me.config.install.users.forEach(function (user) {
      var userId;

      if (user.type) {
        user.type = user.type.toLowerCase();
      } else {
        user.type = "user";
      }
      userId = sol.common.UserUtils.createUser(user.name, user);
      if (userId != undefined) {
        me.handler.log({ text: "User/group '" + user.name + "' (ID " + userId + ") created.", statusBar: true });
      } else {
        me.handler.log({ text: "Can't create user/group '" + user.name + "'." });
      }
    });
  }
});

sol.define("sol.dev.install.functions.CheckDocMasks", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Check document masks
   */
  execute: function () {
    var me = this,
        exportInfo, exportData, exportDataString, diffData, diffDataString, expInfoExists;

    me.config.base.importZipFilePath = me.config.base.importZipFilePath || me.handler.payloadDirPath + File.separator + "RepoData.zip";

    me.handler.log({ text: "Check document masks...", statusBar: true });

    expInfoExists = sol.common.ZipUtils.existsFilePathInZip(me.config.base.importZipFilePath, "ExpInfo.ini");

    if (!expInfoExists) {
      me.handler.log({ text: "ExpInfo.ini doesn't exist in Zip file. Skip checking document masks." });
      return;
    }

    exportInfo = sol.common.ZipUtils.readFileInZipToString(me.config.base.importZipFilePath, "/ExpInfo.ini", { encoding: "UTF-16LE" });

    exportData = sol.dev.install.RepoDataUtils.exportInfoToObject(exportInfo);

    exportDataString = JSON.stringify(exportData);

    me.handler.log({ text: "Export info: {0}", data: [exportDataString] });

    diffData = sol.dev.install.RepoDataUtils.compareExportData(exportData);

    me.result.exportInfoDiffs = diffData;
    diffDataString = JSON.stringify(diffData);

    me.handler.log({ text: "Differences to the export info file: {0}", data: [diffDataString] });
  }
});

sol.define("sol.dev.install.functions.CreateMasks", {
  extend: "sol.dev.install.InstallFunctionBase",

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
    me.prepareCreateMasks();
  },

  prepareCreateMasks: function () {
    var me = this;

    me.masksDirPath = me.handler.payloadDirPath + File.separator + "Masks";
    me.masksDir = new File(me.masksDirPath);

    me.masksFiles = me.masksDir.listFiles() || [];
  },

  check: function () {
    var me = this;

    try {
      java.lang.Class.forName("com.google.gson.GsonBuilder");
    } catch (ex) {
      me.handler.log({ text: "Can't load GSON library. Skip 'CreateMasks'." });
      return false;
    }

    return ((me.config.install.createMasks || me.config.install.transport) && (me.masksFiles && (me.masksFiles.length > 0)));
  },

  /**
   * Create masks
   */
  execute: function () {
    var me = this,
        createdMasksJson = [],
        i, maskFile, origMaskJson, maskJson, maskObj, docMask, maskId, exceptionString,
        childMaskName, childMaskNames, childMaskIds, j, childMaskId,
        flowName, flowId;

    me.handler.log({ text: "Create masks...", statusBar: true });

    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, false);

    try {

      for (i = 0; i < me.masksFiles.length; i++) {
        maskFile = me.masksFiles[i];
        origMaskJson = sol.common.FileUtils.readFileToString(maskFile.canonicalPath);

        maskObj = JSON.parse(origMaskJson);
        maskObj.maskIdsForChildEntries = [];

        if (maskObj.flowId && (typeof maskObj.flowId == "string")) {
          flowName = maskObj.flowId;
          try {
            flowId = sol.common.WfUtils.getWorkflowTemplateId(flowName);
            me.handler.log({ text: "Mask '{0}': Set default workflow template '{1}' to ID {2}", data: [maskObj.name + "", flowName, flowId] });
            maskObj.flowId = flowId;
          } catch (ex) {
            me.handler.log({ text: "Mask '{0}': Cannot find workflow template '{1}'", data: [maskObj.name + "", flowName] });
            maskObj.flowId = -1;
          }
        }

        maskJson = JSON.stringify(maskObj);

        docMask = sol.common.JsonUtils.deserialize(maskJson, "de.elo.ix.client.DocMask");

        maskId = me.getMaskId(docMask.name);
        docMask.id = (typeof maskId == "undefined") ? -1 : maskId;

        if ((docMask.id > -1) && !me.config.install.transport) {
          me.handler.log({ text: "Mask '{0}' (ID {1}) already exists.", data: [docMask.name + "", docMask.id + ""] });
          continue;
        }

        me.handler.log({ text: "Create mask '{0}': {1}", data: [docMask.name + "", maskJson] });

        createdMasksJson.push(origMaskJson);

        ixConnect.ix().checkinDocMask(docMask, DocMaskC.mbAll, LockC.NO);
      }

      if (sol.common.RepoUtils.checkVersion(ixConnect.version, "11.00.000")) {

        for (i = 0; i < createdMasksJson.length; i++) {
          maskJson = createdMasksJson[i];
          maskObj = JSON.parse(maskJson);
          if (maskObj.maskIdsForChildEntries) {
            childMaskNames = [];
            childMaskIds = [];
            for (j = 0; j < maskObj.maskIdsForChildEntries.length; j++) {
              childMaskName = maskObj.maskIdsForChildEntries[j];
              childMaskId = me.getMaskId(childMaskName);
              if (childMaskId > -1) {
                childMaskNames.push(childMaskName);
                childMaskIds.push(new java.lang.Integer(childMaskId));
              }
            }

            if (childMaskNames.length > 0) {
              docMask = ixConnect.ix().checkoutDocMask(maskObj.name + "", DocMaskC.mbAll, LockC.NO);
              docMask.maskIdsForChildEntries = childMaskIds;

              me.handler.log({ text: "Set child masks: mask=" + docMask.name + ", childMasks=" + childMaskNames });

              ixConnect.ix().checkinDocMask(docMask, DocMaskC.mbAll, LockC.NO);
            }
          }
        }
      }
    } catch (ex) {
      exceptionString = sol.common.ExceptionUtils.parseException(ex);
      me.handler.log({ text: "Can't create mask: name=" + docMask.name + ", exception=" + exceptionString + "json=" + maskJson });
    } finally {
      sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, true);
    }
  },

  getMaskId: function (maskName) {
    var mask;

    try {
      mask = ixConnect.ix().checkoutDocMask(maskName + "", DocMaskC.mbAll, LockC.NO);
      return mask.id + "";
    } catch (ignore) {
    }
  }
});

sol.define("sol.dev.install.functions.AdjustDocMasks", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return (me.config.install.adjustDocMasks !== false);
  },

  /**
   * Adjust document masks
   */
  execute: function () {
    var me = this,
        scriptDirPath, textTemplate, textContent, htmlTemplate, lines, applyDiff, i, j, docMaskData, lineData;

    me.handler.log({ text: "Adjust document masks...", statusBar: true });

    if (me.result.exportInfoDiffs && (me.result.exportInfoDiffs.docMasks.length > 0)) {

      me.result.exportInfoDiffs.docMaskDiffs = me.handler.getText("sol.dev.install.title.docMaskDiffs");
      me.result.exportInfoDiffs.adjustDocMasks = me.handler.getText("sol.dev.install.text.adjustDocMasks");

      for (i = 0; i < me.result.exportInfoDiffs.docMasks.length; i++) {
        docMaskData = me.result.exportInfoDiffs.docMasks[i];
        docMaskData.keyText = me.handler.getText("sol.dev.install.text.docMask").replace("{0}", docMaskData.maskName);
        for (j = 0; j < docMaskData.lines.length; j++) {
          lineData = docMaskData.lines[j];
          lineData.keyText = me.handler.getText("sol.dev.install.text.field").replace("{0}", lineData.key);
        }
      }

      scriptDirPath = String(new File(me.handler.payloadDirPath).parent);

      textTemplate = sol.common.FileUtils.readFileToString(scriptDirPath + File.separator + "exportInfoDiffs_text_tpl.txt");
      textContent = sol.create("sol.common.Template", { source: textTemplate }).apply(me.result.exportInfoDiffs);

      lines = sol.common.StringUtils.splitLines(textContent);
      lines.forEach(function (line) {
        me.handler.logMessage({ text: line });
      });

      htmlTemplate = sol.common.FileUtils.readFileToString(scriptDirPath + File.separator + "exportInfoDiffs_html_tpl.txt");
      me.result.exportInfoDiffs.htmlContent = sol.create("sol.common.Template", { source: htmlTemplate }).apply(me.result.exportInfoDiffs);

      applyDiff = me.handler.handleExportInfoDiffs();
      if (applyDiff) {
        me.applyExportInfoDiffs(me.result.exportInfoDiffs);
      }
    } else {
      me.handler.log({ text: "No document masks to adjust" });
    }
  },

  /**
   * Applies the export info differences
   * @param {Object} diffData Export info difference data
   */
  applyExportInfoDiffs: function (diffData) {
    var me = this,
        i, docMaskDiffData;

    if (!diffData) {
      throw "Export info difference data is emtpy";
    }

    for (i = 0; i < diffData.docMasks.length; i++) {
      docMaskDiffData = diffData.docMasks[i];
      me.updateDocMask(docMaskDiffData);
    }
  },

  /**
   * Updates a document mask
   * @param {Object} docMaskDiffData Document mask difference data
   */
  updateDocMask: function (docMaskDiffData) {
    var me = this,
        docMask, i, lines, docMaskLine, docMaskLineData, docMaskLineDataString, nextRow;

    me.handler.log({ text: "Update document mask '{0}'...", data: [docMaskDiffData.maskName], statusBar: true });

    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, false);
    docMask = ixConnect.ix().checkoutDocMask(docMaskDiffData.dstMaskGuid + "", DocMaskC.mbAll, LockC.NO);

    lines = Array.prototype.slice.call(docMask.lines);

    for (i = 0; i < docMaskDiffData.lines.length; i++) {
      docMaskLineData = docMaskDiffData.lines[i];
      docMaskLineDataString = JSON.stringify(docMaskLineData);

      nextRow = me.getNextRow(docMask, docMaskLineData.tabIndex);

      me.handler.log({ text: "Create document mask line: docMask={0}, lineKey={1}, tabIndex={2}, nextRow={3}, data={4}", data: [docMaskDiffData.maskName, docMaskLineData.key, docMaskLineData.tabIndex, nextRow, docMaskLineDataString] });

      docMaskLine = new DocMaskLine();
      docMaskLine.id = -1;

      docMaskLine.type = DocMaskLineC._TYPE_TYPE_ID + docMaskLineData.rawDataType;
      docMaskLine.min = docMaskLineData.minLen;
      docMaskLine.max = docMaskLineData.maxLen;
      docMaskLine.name = docMaskLineData.name;
      docMaskLine.nameTranslationKey = docMaskLineData.nameKey;
      docMaskLine.key = docMaskLineData.key;

      docMaskLine.onlyBuzzwords = docMaskLineData.onlyKeywordListData;
      docMaskLine.prefixAsterix = docMaskLineData.prefixAsterix;
      docMaskLine.postfixAsterix = docMaskLineData.postfixAsterix;
      docMaskLine.nextTab = docMaskLineData.nextTab;
      docMaskLine.hidden = docMaskLineData.hidden;
      docMaskLine.readOnly = docMaskLineData.readOnly;
      docMaskLine.important = docMaskLineData.important;
      docMaskLine.version = docMaskLineData.displayOnCheckIn;
      docMaskLine.translate = docMaskLineData.translateKeywordList;
      docMaskLine.disableWordWheel = docMaskLineData.disableF7Search;
      docMaskLine.inherit = docMaskLineData.inheritToChildren;
      docMaskLine.notTokenized = docMaskLineData.notTokenized;
      docMaskLine.inheritFromParent = docMaskLineData.inheritFromParent;

      docMaskLine.acl = docMaskLineData.acl;
      docMaskLine.comment = docMaskLineData.quickInfo;
      docMaskLine.commentTranslationKey = docMaskLineData.quickInfoKey;
      docMaskLine.externalData = docMaskLineData.externalData;
      docMaskLine.defaultValue = docMaskLineData.defaultValue;
      docMaskLine.tabIndex = docMaskLineData.tabIndex;
      docMaskLine.serverScriptName = docMaskLineData.script;

      if (sol.common.RepoUtils.checkVersion(ixConnect.clientVersion, "9.00.039.001")) {
        docMaskLine.valueArray = docMaskLineData.valueArray;
      }

      if (sol.common.RepoUtils.checkVersion(ixConnect.clientVersion, "10.00.020.010")) {
        docMaskLine.required = docMaskLineData.required;
      }

      if (sol.common.RepoUtils.checkVersion(ixConnect.clientVersion, "10.00.020.023")) {
        docMaskLine.excludeFromISearch = docMaskLineData.excludeFromISearch;
      }

      docMaskLine.editRow = nextRow;
      docMaskLine.labelRow = nextRow;

      lines = me.storeDocMaskLine(lines, docMaskLine);
    }

    docMask.lines = lines;

    me.handler.log({ text: "Write document mask '{0}'", data: [docMaskDiffData.maskName] });

    ixConnect.ix().checkinDocMask(docMask, DocMaskC.mbAll, LockC.NO);
    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, true);
  },

  /**
   * Returns the next free row of the tab
   * @param {de.elo.ix.client.DocMask} docMask Document mask
   * @param {Integer} tabIndex Tab index
   * @return {Integer} Next row number
   */
  getNextRow: function (docMask, tabIndex) {
    var i,
        maxRow = 0,
        docMaskLine;

    for (i = 0; i < docMask.lines.length; i++) {
      docMaskLine = docMask.lines[i];
      if (docMaskLine.tabIndex == tabIndex) {
        if (docMaskLine.editRow > maxRow) {
          maxRow = docMaskLine.editRow;
        }
      }
    }

    if (maxRow > 0) {
      maxRow++;
    }

    return maxRow;
  },

  reservedKeys: ["_RESERVED", "RESERVED"],

  /**
   * Stores a document mask line
   * @param {de.elo.ix.client.DocMaskLine[]} lines Document mask lines
   * @param {de.elo.ix.client.DocMaskLine} newLine Document mask line
   * @return {Array} Document mask lines
   */
  storeDocMaskLine: function (lines, newLine) {
    var me = this,
        maxId = -1,
        id, i, docMaskLine;

    for (i = 0; i < lines.length; i++) {
      docMaskLine = lines[i];
      id = parseInt(docMaskLine.id, 10);
      if (id > maxId) {
        maxId = id;
      }

      if (me.reservedKeys.indexOf(docMaskLine.key) > -1) {
        newLine.id = docMaskLine.id;
        lines[i] = newLine;
        me.handler.log({ text: "Reuse reserved line: line.id={0}, line.key={1}, newLine.key={2}", data: [docMaskLine.id, docMaskLine.key, newLine.key] });
        return lines;
      }
    }
    newLine.id = maxId + 1;
    if (newLine.id == 50) {
      newLine.id = 60; // skip reserved lines
    }
    if (newLine.id > DocMaskLineC.MAX_ID_DOCMASK_LINE) {
      me.handler.log({ text: "No more lines available: newLine.key={0}, newLine.id={1}", data: [newLine.key, newLine.id] });
      return lines;
    }

    me.handler.log({ text: "Append new line: newLine.key={0}, newLine.id={1}", data: [newLine.key, newLine.id] });
    lines.push(newLine);
    return lines;
  }
});

sol.define("sol.dev.install.mixin.UndeployUtils", {
  mixin: true,

  deleteReferences: function (folderId) {
    var me = this,
        sordZ, sords, displayRepoPath;

    sordZ = new SordZ(SordC.mbMin);
    sordZ.add(SordC.mbRefPaths);

    me.handler.log({ text: "Delete references...", statusBar: true });

    sords = sol.common.RepoUtils.findChildren(folderId, { includeFolders: true, includeDocuments: true, recursive: true, level: 20, sordZ: sordZ });
    sords.forEach(function (sord) {
      displayRepoPath = sol.common.SordUtils.getDisplayRepoPath(sord);
      me.handler.log({ text: "Delete references: {0}", data: [displayRepoPath], statusBar: true });
      sol.common.RepoUtils.deleteAllReferences(sord);
    });
  },

  renamePackage: function (packageFolderObjId) {
    var me = this,
        sord, oldName, newName, colorId;

    if (!packageFolderObjId) {
      throw "Package folder object ID is emtpy";
    }

    sord = sol.common.RepoUtils.getSord(packageFolderObjId, { sordZ: SordC.mbMin });
    oldName = sord.name;
    newName = oldName + " - undeployed - " + me.config.base.timestamp;
    if (oldName.indexOf("undeployed") > -1) {
      return;
    }

    me.handler.log({ text: "Rename old package: {0} -> {1}", data: [oldName, newName] });

    sord.name = newName;
    colorId = sol.common.RepoUtils.getColorId("sol.package.undeployed.warn");
    if (colorId) {
      sord.kind = colorId;
    }
    ixConnect.ix().checkinSord(sord, SordC.mbMin, LockC.NO);

    return newName;
  }
});

sol.define("sol.dev.install.functions.UndeployPackage", {
  extend: "sol.dev.install.InstallFunctionBase",
  mixins: ["sol.dev.install.mixin.UndeployUtils"],

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;

    return (me.result.undeploy || me.config.install.undeploy);
  },

  /**
   * Deletes the references
   */
  execute: function () {
    var me = this,
        packageFolderPath, packageFolderObjId, newPackageName, undeployRemove;

    packageFolderPath = sol.common.RepoUtils.resolveSpecialFolder("{{packageFolderPath}}", me.config.base.repoPathParamObj);

    me.handler.log({ text: "Undeploy package: {0}", data: [me.config.install.packageName], statusBar: true });

    me.deleteReferences(packageFolderPath, me.config.install.packageName);

    packageFolderObjId = me.config.install.packageFolderId || packageFolderPath;

    packageFolderObjId = sol.common.RepoUtils.getObjId(packageFolderObjId);

    newPackageName = me.renamePackage(packageFolderObjId);

    undeployRemove = (typeof me.config.install.undeployRemove != "undefined") ? me.config.install.undeployRemove : true;

    if (undeployRemove) {
      me.handler.log({ text: "Remove undeployed package: {0}", data: [newPackageName] });
      sol.common.RepoUtils.deleteSord(packageFolderObjId);
    }
  }
});

sol.define("sol.dev.install.functions.UndeployHotfix", {
  extend: "sol.dev.install.InstallFunctionBase",
  mixins: ["sol.dev.install.mixin.UndeployUtils"],

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;

    return ((me.result.undeploy || me.config.install.undeploy) && me.config.install.undeployHotfix);
  },

  /**
   * Deletes the references
   */
  execute: function () {
    var me = this,
        hotfixFolderPath, hotfixSectionName, exists;

    hotfixSectionName = me.config.install.hotfixSectionName || "Business Solutions Hotfix";

    me.handler.log({ text: "Undeploy hotfix: {0}", data: [me.config.install.packageName], statusBar: true });

    hotfixFolderPath = sol.common.RepoUtils.resolveSpecialFolder("{{administrationFolderPath}}" + me.pilcrow + hotfixSectionName + me.pilcrow + me.config.install.packageName, me.config.base.repoPathParamObj);

    exists = sol.common.RepoUtils.exists(hotfixFolderPath);
    if (!exists) {
      return;
    }

    me.deleteReferences(hotfixFolderPath, me.config.install.packageName);
    me.renamePackage(hotfixFolderPath);
  }
});

sol.define("sol.dev.install.functions.DeployRenamePackage", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return (me.config.install.deploy);
  },

  /**
   * Renames the existing package
   */
  execute: function () {
    var me = this,
        sord, oldName, newName;

    if (!me.config.install.packageFolderId) {
      throw "Package folder ID is empty";
    }

    sord = sol.common.RepoUtils.getSord(me.config.install.packageFolderId, { sordZ: SordC.mbMin });
    oldName = sord.name;
    newName = me.config.install.packageName;

    me.handler.log({ text: "Rename  package: {0} -> {1}", data: [oldName, newName] });
    sord.name = newName;
    sord.kind = 0;

    ixConnect.ix().checkinSord(sord, SordC.mbMin, LockC.NO);
  }
});

sol.define("sol.dev.install.functions.ReassignGuids", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.reassignGuids;
  },

  /**
   * Reassign GUIDs
   */
  execute: function () {
    var me = this,
        i, guid;

    me.handler.log({ text: "Reassign GUIDs...", statusBar: true });

    me.guids = me.config.install.reassignGuids;

    if (me.guids == "true") {
      me.guids = [
        "(9FD1AC0B-8744-6326-2EFD-FCC6E32DE515)",
        "(F4CFD23F-5745-367A-FFA1-78E0C19116D8)",
        "(DFD14BA1-4AC0-36E3-89CE-3CF322E3D607)",
        "(B7E96A85-0C63-B6AD-42E5-BA9F0018F01F)",
        "(AD913CFE-BBF2-3D89-48C3-3F156D497BFD)"
      ];
    }

    for (i = 0; i < me.guids.length; i++) {
      guid = me.guids[i];
      me.reassignGuid(guid);
    }
  },

  reassignGuid: function (guid) {
    var me = this,
        sord, isDocument, exceptionString;

    try {
      sord = sol.common.RepoUtils.getSord(guid, { sordZ: SordC.mbMin });
    } catch (ex) {
      return;
    }

    isDocument = sol.common.SordUtils.isDocument(sord);
    if (!isDocument) {
      return;
    }

    me.handler.log({ text: "Reassign GUID: guid=" + sord.guid + ", name=" + sord.name, statusBar: true });

    if (!sord.deleted) {
      me.handler.log({ text: "Copy sord: guid=" + sord.guid + ", name=" + sord.name });
      sol.common.RepoUtils.copySords(sord.id, sord.parentId);
    }

    me.handler.log({ text: "Delete finally: guid=" + sord.guid + ", name=" + sord.name });
    try {
      sol.common.RepoUtils.deleteSord(sord.guid, { deleteFinally: true });
    } catch (ex) {
      exceptionString = sol.common.ExceptionUtils.parseException(ex);
      me.handler.log({ text: "Can't delete sord to reassign GUID: guid=" + sord.guid + ", name=" + sord.name + ", exception=" + exceptionString });
    }
  }
});

sol.define("sol.dev.install.functions.ImportRepoData", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Imports the repository data
   */
  execute: function () {
    var me = this;

    me.config.base.importZipFilePath = me.config.base.importZipFilePath || me.handler.payloadDirPath + File.separator + "RepoData.zip";

    me.handler.log({ text: "Import repository data: " + me.config.base.importZipFilePath, statusBar: true });

    if (me.config.install.importDestinationFolderPath) {
      me.config.install.importDestinationFolderPath = sol.common.RepoUtils.resolveSpecialFolder(me.config.install.importDestinationFolderPath, me.config.base.repoPathParamObj);
    } else {
      me.config.install.importDestinationFolderPath = "";
    }

    sol.common.WfUtils.setSessionOptionStartDocMaskWorkflows(false);
    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, false);

    sol.common.RepoUtils.importRepoData(new File(me.config.base.importZipFilePath), me.config.install.importDestinationFolderPath, ImportOptionsC.GUIDS_KEEP, ImportOptionsC.IMPORT_KEYWORDS);

    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, true);
    sol.common.WfUtils.setSessionOptionStartDocMaskWorkflows(true);
  }
});

sol.define("sol.dev.install.functions.AdjustDocMaskRights", {
  extend: "sol.dev.install.InstallFunctionBase",

  /**
   * Imports the repository data
   */
  execute: function () {
    var me = this,
        docMaskNames, docMaskName, i, docMask, inheritAclItem;

    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, false);
    docMaskNames = sol.common.SordUtils.getDocMaskNames({ filters: { nameTranslationKeyPrefix: "sol." } });

    inheritAclItem = new AclItem();
    inheritAclItem.type = AclItemC.TYPE_INHERIT;

    for (i = 0; i < docMaskNames.length; i++) {
      docMaskName = docMaskNames[i];

      docMask = ixConnect.ix().checkoutDocMask(docMaskName.id + "", DocMaskC.mbAll, LockC.NO);
      if ((docMask.docAclItems.length == 1) && (docMask.docAclItems[0].id == UserInfoC.ID_EVERYONE_GROUP)) {
        docMask.docAclItems = [inheritAclItem];
        me.handler.log({ text: "Adjust document rights: docMaskName={0}, nameTranslationKey={1}", data: [docMask.name, docMask.nameTranslationKey] });
        ixConnect.ix().checkinDocMask(docMask, DocMaskC.mbAll, LockC.NO);

      }
    }
    sol.common.RepoUtils.setSessionOption(SessionOptionsC.TRANSLATE_TERMS, true);
  }
});

sol.define("sol.dev.install.functions.PrepareRepoPaths", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.repoPaths;
  },

  execute: function () {
    var me = this,
        path;

    me.handler.log({ text: "Prepare repository paths...", statusBar: true });
    me.config.install.repoPaths.forEach(function (repoPathSet) {
      path = sol.common.RepoUtils.resolveSpecialFolder(repoPathSet.path, me.config.base.repoPathParamObj);
      me.handler.log({ text: "Prepare repository path: path={0}, rights={1}", data: [path, JSON.stringify(repoPathSet.rightsConfig)] });
      sol.common.RepoUtils.preparePath(path, { rightsConfig: repoPathSet.rightsConfig });
    });

  }
});

sol.define("sol.dev.install.functions.PrepareExistingRepoPaths", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.existingRepoPaths;
  },

  execute: function () {
    var me = this,
        path, mode;

    me.handler.log({ text: "Change existing repository paths...", statusBar: true });
    me.config.install.existingRepoPaths.forEach(function (repoPathSet) {
      path = sol.common.RepoUtils.resolveSpecialFolder(repoPathSet.path, me.config.base.repoPathParamObj);
      mode = repoPathSet.mode;
      repoPathSet.rightsConfig.users.forEach(function (user) {
        me.handler.log({ text: "Changing existing repository path: path={0}, rights={1}, mode={2}", data: [path, JSON.stringify(user), mode] });
        try {
          sol.common.AclUtils.changeRightsInBackground(path, { mode: mode, users: [user.name], rights: user.rights });
        } catch (ex) {
          me.handler.log({ text: "Can't change rights: exception=" + ex });
        }
      });
    });
  }
});

sol.define("sol.dev.install.functions.ChangeRights", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.changeRights;
  },

  execute: function () {
    var me = this,
        path, objId;

    me.handler.log({ text: "Change rights...", statusBar: true });

    me.config.install.changeRights.forEach(function (rightsEntry) {

      path = sol.common.RepoUtils.resolveSpecialFolder(rightsEntry.path, me.config.base.repoPathParamObj);
      objId = sol.common.RepoUtils.getObjId(path) + "";

      me.handler.log({ text: "Change rights: path=" + path + ", objId=" + objId + ", config=" + JSON.stringify(rightsEntry) });
      try {
        sol.common.AclUtils.changeRightsInBackground(objId, rightsEntry);
      } catch (ex) {
        me.handler.log({ text: "Can't change rights: exception=" + ex });
      }
    });
  }
});

sol.define("sol.dev.install.mixin.RefUtils", {
  mixin: true,

  refPrioSectionOrder: ["Business Solutions", "Business Solutions Hotfix", "Other", "Business Solutions Custom", "Original"],

  refSord: function (refEntry, srcSord, dstFolderId) {
    var me = this;

    if (refEntry.refHard) {
      me.refHard(srcSord, dstFolderId);
    } else {
      me.refSubordinately(srcSord, dstFolderId);
    }
  },

  refHard: function (srcSord, dstFolderId) {
    var me = this,
        srcDisplayPath, dstSordDisplayPath;

    srcDisplayPath = sol.common.SordUtils.getDisplayRepoPath(srcSord);
    dstSordDisplayPath = sol.common.RepoUtils.getPathFromObjId(dstFolderId);

    me.handler.log({ text: "Create hard reference: " + srcDisplayPath + " -> " + dstSordDisplayPath, statusBar: true });
    ixConnect.ix().refSord("", dstFolderId + "", srcSord.id + "", -1);
  },

  refSubordinately: function (srcSord, dstFolderId) {
    var me = this,
        srcDisplayPath, srcObjId, dstFolderDisplayPath, name, dstDisplayPath,
        dstChildEntry, srcSectionName, srcSectionPrio, dstSectionPrio;

    me.refPrioSectionOrder = me.config.install.refPrioSectionOrder || me.refPrioSectionOrder;

    me.dstFolderChildrenCache = me.dstFolderChildrenCache || {};
    if (!me.dstFolderChildrenCache[dstFolderId]) {
      me.addDstChildrenToCache(dstFolderId);
    }

    name = srcSord.name + "";

    me.displayPathCache = me.displayPathCache || {};
    dstFolderDisplayPath = me.displayPathCache[dstFolderId];
    if (!dstFolderDisplayPath) {
      dstFolderDisplayPath = sol.common.RepoUtils.getPathFromObjId(dstFolderId);
      me.displayPathCache[dstFolderId] = dstFolderDisplayPath;
    }
    srcObjId = srcSord.id + "";
    srcDisplayPath = me.displayPathCache[srcObjId];
    if (!srcDisplayPath) {
      srcDisplayPath = sol.common.SordUtils.getDisplayRepoPath(srcSord);
      me.displayPathCache[srcObjId] = srcDisplayPath;
    }

    dstDisplayPath = dstFolderDisplayPath + "/" + name;

    dstChildEntry = me.getDstChildEntryFromCache(dstFolderId, name);

    if (dstChildEntry) {
      srcSectionName = me.getSectionName(dstFolderId, srcSord);
      srcSectionPrio = me.getSectionPrio(srcSectionName);
      dstSectionPrio = me.getSectionPrio(dstChildEntry.srcSectionName);

      me.handler.log({ text: "Entry name already exists in the destination folder: " + dstDisplayPath });

      if (srcSectionPrio <= dstSectionPrio) {
        me.handler.log({ text: "Source section priority '" + srcSectionName + "' <= Destination section priority '" + dstChildEntry.srcSectionName + "' -> Skip creating reference: " + dstDisplayPath });
        return;
      } else {
        if (dstChildEntry.parentId != dstFolderId) {
          me.handler.log({ text: "Source section priority '" + srcSectionName + "' > Destination section priority '" + dstChildEntry.srcSectionName + "' -> Delete existing reference: " + dstDisplayPath });
          ixConnect.ix().deleteSord(dstFolderId, dstChildEntry.objId + "", LockC.NO, new DeleteOptions());
          me.markUnreferencedSrcDocument(dstChildEntry.objId);
        }
      }
    }

    srcDisplayPath = sol.common.SordUtils.getDisplayRepoPath(srcSord);
    me.handler.log({ text: "Create reference: " + srcDisplayPath + " -> " + dstFolderDisplayPath, statusBar: true });

    if (dstFolderId == srcSord.id) {
      throw "Source and target object ID must not be identical: objId=" + dstFolderId;
    }

    ixConnect.ix().refSord("", dstFolderId + "", srcSord.id + "", -1);
    me.addDstChildToCache(dstFolderId, srcSord);
  },

  /**
   * Adds the destination children names to the cache
   * @param {String} dstFolderId Destination folder ID
   */
  addDstChildrenToCache: function (dstFolderId) {
    var me = this,
        sordZ, children;

    sordZ = new SordZ(SordC.mbMin);
    sordZ.add(SordC.mbRefPaths);

    children = sol.common.RepoUtils.findChildren(dstFolderId, { recursive: false, level: 1, includeReferences: true, sordZ: sordZ });
    children.forEach(function (child) {
      me.addDstChildToCache(dstFolderId, child);
    });
  },

  /**
   * Adds a destination child name to the cache
   * @param {String} dstFolderId Destination folder ID
   * @param {de.elo.ix.client.Sord} child Child
   */
  addDstChildToCache: function (dstFolderId, child) {
    var me = this,
        childName, srcSectionName, childObjId, childParentId;

    childName = child.name + "";
    me.dstFolderChildrenCache = me.dstFolderChildrenCache || {};
    me.dstFolderChildrenCache[dstFolderId] = me.dstFolderChildrenCache[dstFolderId] || {};
    srcSectionName = me.getSectionName(dstFolderId, child);
    childObjId = child.id + "";
    childParentId = child.parentId + "";
    me.dstFolderChildrenCache[dstFolderId][childName] = { objId: childObjId, srcSectionName: srcSectionName, parentId: childParentId };
  },

  /**
   * Returns the package name
   * @param {String} dstFolderId Destination folder ID
   * @param {de.elo.ix.client.Sord} sord Sord
   * @return {String} Package name
   */
  getSectionName: function (dstFolderId, sord) {
    var me = this,
        sectionNameIndex = 1,
        sectionName = "Other",
        repoPathParts;

    if (dstFolderId == sord.parentId) {
      return "Original";
    }

    if (!sord.refPaths || (sord.refPaths.length == 0)) {
      me.handler.log({ text: "Can't detect section name: Refpaths are empty: sord.id=" + sord.id + ", sord.name=" + sord.name });
      return sectionName;
    }

    if (!sord.refPaths[0].path || (sord.refPaths[0].path.length <= sectionNameIndex)) {
      return sectionName;
    }

    repoPathParts = sord.refPaths[0].path;
    sectionName = repoPathParts[sectionNameIndex].name + "";

    sectionName = (me.refPrioSectionOrder.indexOf(sectionName) > -1) ? sectionName : "Other";

    return sectionName;
  },

  getSectionPrio: function (sectionName) {
    var me = this,
        index;

    index = me.refPrioSectionOrder.indexOf(sectionName);
    return index;
  },

  /**
   * Checks whether the name exists in the destination child name cache
   * @param {String} dstFolderId Destination folder ID
   * @param {String} childName Destionation child name
   * @return {Boolean}
   */
  getDstChildEntryFromCache: function (dstFolderId, childName) {
    var me = this,
        exists;

    exists = (!!me.dstFolderChildrenCache && !!me.dstFolderChildrenCache[dstFolderId] && !!me.dstFolderChildrenCache[dstFolderId][childName]);
    if (exists) {
      return me.dstFolderChildrenCache[dstFolderId][childName];
    }
  },

  /**
   * Marks unreferenced source document
   * @param {String} objId
   */
  markUnreferencedSrcDocument: function (objId) {
    var me = this,
        sordZ, srcSord;

    sordZ = new SordZ(SordC.mbMinMembers);
    sordZ.add(SordC.mbRefPaths);

    srcSord = ixConnect.ix().checkoutSord(objId + "", SordC.mbAll, LockC.NO);

    if ((sol.common.SordUtils.isFolder(srcSord)) || (srcSord.refPaths.length > 1)) {
      return;
    }

    me.colorDisabled = me.colorDisabled || sol.common.RepoUtils.getColorId("sol.common.disabled");

    if (typeof me.colorDisabled != "undefined") {
      srcSord.kind = me.colorDisabled;
      ixConnect.ix().checkinSord(srcSord, new SordZ(ObjDataC.mbKind), LockC.NO);
    }
  }
});

sol.define("sol.dev.install.functions.CreateChildrenReferences", {
  extend: "sol.dev.install.InstallFunctionBase",
  mixins: ["sol.dev.install.mixin.RefUtils"],

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;

    return !!me.config.install.refChildren;
  },

  /**
   * Creates references of documents which are located in specified folders
   */
  execute: function () {
    var me = this;

    me.handler.log({ text: "Create children references...", statusBar: true });
    me.config.install.refChildren.forEach(function (refChildrenEntry) {
      me.processReferenceChildrenEntry(refChildrenEntry);
    });
  },

  /**
   * @private
   * * Processes the repository references of a single source folder
   * @param {Object} refChildrenEntry
   */
  processReferenceChildrenEntry: function (refChildrenEntry) {
    var me = this,
        srcPath, startFolder, findConfig, children;

    srcPath = sol.common.RepoUtils.resolveSpecialFolder(refChildrenEntry.source, me.config.base.repoPathParamObj);
    srcPath = sol.common.RepoUtils.normalizePath(srcPath, true);
    try {
      startFolder = ixConnect.ix().checkoutSord(srcPath + "", EditInfoC.mbSord, LockC.NO).sord;
    } catch (e) {
      me.handler.log({ text: "Source path not found: " + srcPath, statusBar: true });
      return;
    }

    if (refChildrenEntry.refFolders) {
      findConfig = { recursive: false, level: 1, includeDocuments: false, includeFolders: true };
    } else {
      findConfig = { recursive: true, level: 10, includeDocuments: true, includeFolders: false };
    }

    children = sol.common.RepoUtils.findChildren(startFolder.id, findConfig);
    children.forEach(function (child) {
      if ((refChildrenEntry.exclude) && (refChildrenEntry.exclude.indexOf(String(child.name)) > -1)) {
        return;
      }
      me.processReferenceChild(startFolder, child, refChildrenEntry);
    });
  },

  /**
   * @private
   * Builds the destination repository paths of a reference and creates them
   * @param {de.elo.ix.client.Sord} startFolder
   * @param {de.elo.ix.client.Sord} child
   * @param {Object} refChildrenEntry
   */
  processReferenceChild: function (startFolder, child, refChildrenEntry) {
    var me = this,
        i, j, dstFolderPathParts, dstFolderPath, childPathParts,
        destinations, startFolderPathPartsLen, dstFolderId;

    destinations = refChildrenEntry.destinations;
    startFolderPathPartsLen = startFolder.refPaths[0].path.length;
    for (i = 0; i < destinations.length; i++) {
      dstFolderPathParts = [sol.common.RepoUtils.resolveSpecialFolder(destinations[i], me.config.base.repoPathParamObj)];
      childPathParts = child.refPaths[0].path;
      if (!refChildrenEntry.ignoreSubfolders) {
        for (j = startFolderPathPartsLen + 1; j < childPathParts.length; j++) {
          dstFolderPathParts.push(childPathParts[j].name);
        }
      }
      dstFolderPath = dstFolderPathParts.join(me.pilcrow);

      dstFolderId = sol.common.RepoUtils.preparePath(dstFolderPath);
      me.refSord(refChildrenEntry, child, dstFolderId);
    }
  }
});

sol.define("sol.dev.install.functions.CreateSingleReferences", {
  extend: "sol.dev.install.InstallFunctionBase",
  mixins: ["sol.dev.install.mixin.RefUtils"],

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;

    return !!me.config.install.ref;
  },

  /**
   * Creates references of defined documents and folders
   */
  execute: function () {
    var me = this;

    me.handler.log({ text: "Create single references...", statusBar: true });
    me.config.install.ref.forEach(function (refEntry) {
      me.processRefEntry(refEntry);
    });
  },

  /**
   * @private
   * Processes the creation of a single reference
   * @param {Object} refEntry
   */
  processRefEntry: function (refEntry) {
    var me = this,
        srcPath, srcObjId, sordZ, srcSord, dstFolderId;

    srcPath = sol.common.RepoUtils.resolveSpecialFolder(refEntry.source, me.config.base.repoPathParamObj);
    srcObjId = sol.common.RepoUtils.getObjId(srcPath);

    if (!srcObjId) {
      me.handler.log({ text: "Source repository path not found: " + srcPath, statusBar: true });
      return;
    }

    sordZ = new SordZ(SordC.mbMin);
    sordZ.add(SordC.mbRefPaths);
    srcSord = ixConnect.ix().checkoutSord(srcObjId + "", sordZ, LockC.NO);

    refEntry.destinations.forEach(function (destination) {
      destination = sol.common.RepoUtils.resolveSpecialFolder(destination, me.config.base.repoPathParamObj);
      dstFolderId = sol.common.RepoUtils.preparePath(destination);

      me.refSord(refEntry, srcSord, dstFolderId);
    });

    me.markUnreferencedSrcDocument(srcSord.id);
  }
});

sol.define("sol.dev.install.functions.AddMemberships", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.memberships;
  },

  /**
   * Adds memberships to users or groups
   */
  execute: function () {
    var me = this,
        i, membership;

    me.handler.log({ text: "Add memberships...", statusBar: true });
    for (i = 0; i < me.config.install.memberships.length; i++) {
      membership = me.config.install.memberships[i];
      try {
        sol.common.UserUtils.addUsersToGroups(membership.names, membership.memberOf);
        me.handler.log({ text: "Add users/groups " + membership.names + " added to group(s): " + membership.memberOf, statusBar: true });
      } catch (ex) {
        me.handler.log({ text: "Can't add users/groups " + membership.names + " to group(s): " + membership.memberOf + ": " + ex, statusBar: false });
      }
    }
  }
});

sol.define("sol.dev.install.functions.RemoveMemberships", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.removeMemberships;
  },

  /**
   * Adds memberships to users or groups
   */
  execute: function () {
    var me = this,
        i, membership;

    me.handler.log({ text: "Remove memberships...", statusBar: true });
    for (i = 0; i < me.config.install.removeMemberships.length; i++) {
      membership = me.config.install.removeMemberships[i];
      try {
        sol.common.UserUtils.removeUsersFromGroups(membership.names, membership.memberOf);
        me.handler.log({ text: "Remove users/groups " + membership.names + " from group(s): " + membership.memberOf, statusBar: true });
      } catch (ex) {
        me.handler.log({ text: "Can't remove users/groups " + membership.names + " from group(s): " + membership.memberOf + ": " + ex, statusBar: false });
      }
    }
  }
});

sol.define("sol.dev.install.functions.CreateColors", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.colors;
  },

  /**
   * Creates the specified colors
   */
  execute: function () {
    var me = this;

    me.handler.log({ text: "Create colors...", statusBar: true });
    sol.common.RepoUtils.addColors(me.config.install.colors);
  }
});

sol.define("sol.dev.install.functions.InstallWorkflowTemplateFiles", {
  extend: "sol.dev.install.InstallFunctionBase",

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
    me.prepareWorkflowTemplates();
  },

  check: function () {
    var me = this;

    return (me.workflowTemplates.length > 0);
  },

  workflowTimestampSeparator: " | ",

  execute: function () {
    var me = this,
        i, workflowTemplate, workflowTemplateFile, exceptionString, importWorkflowTemplateResult;

    me.handler.log({ text: "Install workflow template files...", statusBar: true });

    for (i = 0; i < me.workflowTemplates.length; i++) {
      workflowTemplate = me.workflowTemplates[i];
      if (workflowTemplate.import) {
        try {
          me.handler.log({ text: "Install workflow template file'" + workflowTemplate.name + "'...", statusBar: true });
          me.handler.log({ text: "Included workflow templates: [" + workflowTemplate.includedWorkflowTemplates + "]", statusBar: false });
          me.renameWorkflowTemplates(workflowTemplate.includedWorkflowTemplates);
          workflowTemplateFile = new File(workflowTemplate.path);
          importWorkflowTemplateResult = sol.common.WfUtils.importWorkflow(workflowTemplate.name, workflowTemplateFile);
          me.handler.log({ text: "Workflow template file '" + workflowTemplate.name + "' imported.", statusBar: true });
          me.handler.log({ text: "importResult=" + JSON.stringify(importWorkflowTemplateResult), statusBar: false });
          me.mergeWorkflowTemplates(workflowTemplate.includedWorkflowTemplates);
          me.adjustSubWorkflowNodes(workflowTemplate.includedWorkflowTemplates);
          me.handler.log({ text: "Installation of workflow template file '" + workflowTemplate.name + "' completed.", statusBar: false });
        } catch (ex) {
          exceptionString = sol.common.ExceptionUtils.parseException(ex);
          me.handler.log({ text: "Can't import workflow '" + workflowTemplate.name + "' :" + exceptionString });
        }
      }
    }
  },

  prepareWorkflowTemplates: function () {
    var me = this,
        workflowTemplateFilter, workflowTemplates, workflowTemplatesDirPath, workflowTemplatesDir, workflowFileIterator,
        workflowTemplateNames, workflowFile, workflowName, workflowJsonContent, exceptionString, key;

    me.workflowTemplates = [];
    workflowTemplatesDirPath = me.handler.payloadDirPath + File.separator + "workflowTemplates";
    workflowTemplatesDir = new File(workflowTemplatesDirPath);

    if (workflowTemplatesDir.exists()) {
      workflowTemplateFilter = me.config.build.workflowTemplates || [];
      workflowTemplates = {};

      workflowFileIterator = Packages.org.apache.commons.io.FileUtils.iterateFiles(workflowTemplatesDir, ["json"], false);
      while (workflowFileIterator.hasNext()) {
        workflowFile = workflowFileIterator.next();
        try {
          workflowName = String(sol.common.FileUtils.removeExtension(workflowFile.name));
          if (workflowTemplateFilter.length === 0 || workflowTemplateFilter.indexOf(workflowName) > -1) {
            workflowJsonContent = sol.common.FileUtils.readFileToString(workflowFile.canonicalPath);
            workflowTemplateNames = sol.common.WfUtils.getAllWorkflowNamesFromJson(workflowJsonContent);

            workflowTemplateNames.forEach(function (templateName) { // eslint-disable-line no-loop-func
              // we'll mark the base workflow with true (to make sure it'll be imported)
              // all contained sub workflow will be marked with "false". We will ignore those during the import
              workflowTemplates[templateName] = {
                name: templateName,
                path: workflowTemplatesDirPath + File.separator + templateName + ".json",
                import: workflowTemplates.hasOwnProperty(templateName) ? false : (templateName == workflowName),
                order: workflowTemplateFilter.indexOf(workflowName)
              };
            });

            workflowTemplates[workflowName].includedWorkflowTemplates = workflowTemplateNames;
          }
        } catch (ex) {
          exceptionString = sol.common.ExceptionUtils.parseException(ex);
          me.handler.log({ text: "Can't collect sub workflow template names within workflow template file '" + workflowFile.canonicalPath + "' :" + exceptionString });
        }
      }

      // convert to an array
      for (key in workflowTemplates) {
        me.workflowTemplates.push(workflowTemplates[key]);
      }

      me.workflowTemplates.sort(function (a, b) {
        return a.order - b.order;
      });
    }
  },

  renameWorkflowTemplates: function (workflowTemplateNames) {
    var me = this,
        renamedWorkflowTemplates = {},
        i, workflowTemplateName, newWorkflowTemplateName, renameResult;

    for (i = 0; i < workflowTemplateNames.length; i++) {
      workflowTemplateName = workflowTemplateNames[i];
      newWorkflowTemplateName = workflowTemplateName + me.workflowTimestampSeparator + "origin - " + me.config.base.timestamp;
      renameResult = sol.common.WfUtils.renameWorkflowTemplate(workflowTemplateName, newWorkflowTemplateName);
      if (renameResult) {
        me.handler.log({ text: "Origin workflow template renamed: '" + workflowTemplateName + "' -> '" + newWorkflowTemplateName + "'", statusBar: true });
        me.handler.log({ text: "renameResult=" + JSON.stringify(renameResult) });
        renamedWorkflowTemplates[renameResult.oldName] = renameResult.wfTplId;
      }
    }

    return renamedWorkflowTemplates;
  },

  mergeWorkflowTemplates: function (workflowTemplateNames) {
    var me = this,
        i, workflowTemplateName, mergeTemplateResult;

    for (i = 0; i < workflowTemplateNames.length; i++) {
      workflowTemplateName = workflowTemplateNames[i];
      mergeTemplateResult = sol.common.WfUtils.mergeWorkflowTemplate(workflowTemplateName);
      if (mergeTemplateResult) {
        me.handler.log({ text: "Workflow template '" + mergeTemplateResult.wfTplName + "' merged.", statusBar: true });
        me.handler.log({ text: "mergeTemplateResult=" + JSON.stringify(mergeTemplateResult) });
      }
    }
  },

  adjustSubWorkflowNodes: function (workflowTemplateNames) {
    var me = this,
        wfDiag, i, j, workflowTemplateName, propertiesObj, subTemplateDiag, node, subTemplateName, subTemplateId, wfDiagChanged;

    for (i = 0; i < workflowTemplateNames.length; i++) {

      workflowTemplateName = workflowTemplateNames[i];

      wfDiag = ixConnect.ix().checkoutWorkflowTemplate(workflowTemplateName, "", WFDiagramC.mbAll, LockC.NO);

      wfDiagChanged = false;

      for (j = 0; j < wfDiag.nodes.length; j++) {
        node = wfDiag.nodes[j];

        if (node.type != WFNodeC.TYPE_CALL_SUB_WORKFLOW) {
          continue;
        }

        try {
          propertiesObj = JSON.parse(node.properties);
        } catch (ex) {
          me.handler.log({ text: "Can't parse sub workflow node properties: workflowTemplateName=" + workflowTemplateName + ", node.name=" + node.name + ", node.properties=" + node.properties });
          continue;
        }

        subTemplateName = propertiesObj.subTemplateName;

        if (subTemplateName) {
          try {
            subTemplateDiag = ixConnect.ix().checkoutWorkflowTemplate(subTemplateName, "", WFDiagramC.mbAll, LockC.NO);
          } catch (ex) {
            me.handler.log({ text: "Can't find sub workflow template: tplName=" + wfDiag.name + ", nodeName=" + node.name + ", subTplName=" + subTemplateName, statusBar: false });
            continue;
          }
          subTemplateId = subTemplateDiag.id;
          node.subTemplateId = subTemplateId;
          me.handler.log({ text: "Sub workflow template ID set: tplName=" + wfDiag.name + ", nodeName=" + node.name + ", subTplName=" + subTemplateName + ", subTplId=" + subTemplateId, statusBar: false });
          wfDiagChanged = true;
        }
      }

      if (wfDiagChanged) {
        ixConnect.ix().checkinWorkFlow(wfDiag, WFDiagramC.mbAll, LockC.NO);
      }
    }
  }
});

sol.define("sol.dev.install.functions.UninstallIxPlugins", {
  extend: "sol.dev.install.InstallFunctionBase",

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this,
        currentIxVersion;

    currentIxVersion = ixConnect.version;

    if (!sol.common.RepoUtils.checkVersion(currentIxVersion, "11.00.000")) {
      return false;
    }

    return (me.config.install.uninstallIxPlugins && me.config.install.uninstallIxPlugins.symbolicNamePrefixes);
  },

  /**
   * Uninstalls IX plug-ins
   */
  execute: function () {
    var me = this,
        uninstallPlugins = [],
        prefixes, i, prefix, pluginList, pluginListIterator, plugin, pluginSymbolicName, exceptionString;

    me.handler.log({ text: "Uninstall IX plug-ins...", statusBar: true });

    prefixes = me.config.install.uninstallIxPlugins.symbolicNamePrefixes;

    pluginList = ixConnect.pluginService.getPlugins();

    me.handler.log({ text: "Currently installed plug-ins:", statusBar: false });

    pluginListIterator = pluginList.iterator();

    while (pluginListIterator.hasNext()) {
      plugin = pluginListIterator.next();
      me.handler.log({ text: "id=" + plugin.id + ", symbolicName=" + plugin.symbolicName + ", state=" + plugin.state, statusBar: false });
    }

    pluginListIterator = pluginList.iterator();

    while (pluginListIterator.hasNext()) {
      plugin = pluginListIterator.next();
      pluginSymbolicName = plugin.symbolicName + "";
      for (i = 0; i < prefixes.length; i++) {
        prefix = prefixes[i];
        if (pluginSymbolicName.indexOf(prefix) == 0) {
          uninstallPlugins.push(plugin);
        }
      }
    }

    for (i = 0; i < uninstallPlugins.length; i++) {
      plugin = uninstallPlugins[i];
      try {
        ixConnect.pluginService.uninstall(plugin.id);
        me.handler.log({ text: "IX plug-in '" + plugin.symbolicName + "' uninstalled." });
      } catch (ex) {
        exceptionString = sol.common.ExceptionUtils.parseException(ex);
        me.handler.log({ text: "Can't uninstall IX plug-in: name=" + plugin.symbolicName + ", exception=" + exceptionString });
      }
    }
  }
});

sol.define("sol.dev.install.functions.InstallIxPlugins", {
  extend: "sol.dev.install.InstallFunctionBase",

  initialize: function (config) {
    var me = this,
        isJakarta, i, ixPluginDir, files, j;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
    me.ixPluginDirPaths = [me.handler.payloadDirPath + File.separator + "IX Plug-ins"];

    isJakarta = sol.common.RepoUtils.checkVersion(ixConnect.implVersion, "21.04.00");

    if (isJakarta) {
      me.ixPluginDirPaths.push(me.handler.payloadDirPath + File.separator + "IX Plug-ins - jakarta");
    } else {
      me.ixPluginDirPaths.push(me.handler.payloadDirPath + File.separator + "IX Plug-ins - javax");
    }

    me.handler.log({ text: "Install IX plug-ins...", statusBar: true });

    me.handler.log({ text: "isJakarta=" + isJakarta });
    me.handler.log({ text: "ixPluginDirPaths=" + me.ixPluginDirPaths });

    me.ixPluginFiles = [];

    for (i = 0; i < me.ixPluginDirPaths.length; i++) {
      ixPluginDir = new java.io.File(me.ixPluginDirPaths[i]);
      if (ixPluginDir.exists()) {
        files = ixPluginDir.listFiles();
        for (j = 0; j < files.length; j++) {
          me.ixPluginFiles.push(files[j]);
        }
      }
    }
  },

  check: function () {
    var me = this,
        currentIxVersion;

    currentIxVersion = ixConnect.version;

    if (!sol.common.RepoUtils.checkVersion(currentIxVersion, "11.00.000")) {
      return false;
    }

    return (me.ixPluginFiles && (me.ixPluginFiles.length > 0));
  },

  /**
   * Installs IX plug-ins
   */
  execute: function () {
    var me = this,
        i, ixPluginFile, inputStream, ixPluginFileName, pluginId, exceptionString;

    for (i = 0; i < me.ixPluginFiles.length; i++) {
      ixPluginFile = me.ixPluginFiles[i];
      ixPluginFileName = ixPluginFile.name + "";

      inputStream = new FileInputStream(ixPluginFile);

      try {
        me.handler.log({ text: "Install IX plug-in '" + ixPluginFileName + "': " + ixPluginFile.parentFile.name + java.io.File.separator + ixPluginFile.name });
        pluginId = ixConnect.pluginService.upload(inputStream);
      } catch (ex) {
        exceptionString = sol.common.ExceptionUtils.parseException(ex);
        me.handler.log({ text: "Can't install IX plug-in: " + ixPluginFile.absolutePath + ", exception=" + exceptionString });
        continue;
      }

      try {
        ixConnect.pluginService.start(pluginId);
        me.handler.log({ text: "IX plug-in '" + ixPluginFileName + "' (ID " + pluginId + ") started." });
      } catch (ex) {
        exceptionString = sol.common.ExceptionUtils.parseException(ex);
        me.handler.log({ text: "Can't start IX plug-in: name=" + ixPluginFileName + ", id=" + pluginId + ", exception=" + exceptionString });
      }
    }
  }
});

sol.define("sol.dev.install.functions.CreateSordTypes", {
  extend: "sol.dev.install.InstallFunctionBase",
  mixins: ["sol.dev.install.mixin.InstallUtils"],

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
    me.sordTypesDir = new File(me.handler.payloadDirPath + File.separator + "Sord types");
  },

  check: function () {
    var me = this;

    return me.sordTypesDir.exists();
  },

  /**
   * @private
   * Creates sord types
   */
  execute: function () {
    var me = this,
        sordTypeDirs, i, sordTypeDir, force;

    me.handler.log({ text: "Create sord types...", statusBar: true });

    force = (me.procName == "transport") ? true : false;

    sordTypeDirs = me.sordTypesDir.listFiles();
    for (i = 0; i < sordTypeDirs.length; i++) {
      sordTypeDir = sordTypeDirs[i];
      me.processCreateSordType(sordTypeDir, force);
    }

    me.sendHttpRequest("Refresh web sord type icons", "{{eloWfBaseUrl}}/apps/rest/cmd/refreshicons/", { method: "post", readTimeout: 30000 });
  },

  /**
   * @private
   */
  collectIcons: function (sordTypeName, sordTypeDir, iconName, sordTypeIconExtensions) {
    var me = this,
        sordTypeIconExtension, i, fileName, filePath,
        availableIcons = [],
        icons = [];

    for (i = 0; i < sordTypeIconExtensions.length; i++) {
      sordTypeIconExtension = sordTypeIconExtensions[i];
      fileName = iconName + "." + sordTypeIconExtension;
      filePath = sordTypeDir + java.io.File.separator + fileName;
      if (sol.common.FileUtils.exists(filePath)) {
        availableIcons.push(fileName);
        icons.push(sol.common.FileUtils.loadToFileData(filePath));
      }
    }

    me.handler.log({ text: "Available icons for Sord type '" + sordTypeName + "': " + availableIcons });

    return icons;
  },

  /**
   * @private
   * Processes the creation of a sord type
   * @param {java.io.File} sordTypeDir
   * @param {Boolean} force Force
   */
  processCreateSordType: function (sordTypeDir, force) {
    var me = this,
        sordTypeDirPath,
        configFilePath, config, result, exceptionString, possibleSordTypeIconExtensions;

    sordTypeDirPath = sordTypeDir.absolutePath;
    configFilePath = sordTypeDirPath + File.separator + "config.json";
    config = sol.common.FileUtils.readConfig(configFilePath);

    possibleSordTypeIconExtensions = sol.common.RepoUtils.checkVersion(ixConnect.implVersion, "23.02.000") ? ["ico"] : ["ico", "bmp", "jpg", "png"];
    me.handler.log({ text: "Possible icon extensions for Sord type '" + config.name + "': " + possibleSordTypeIconExtensions });

    try {
      result = sol.common.SordTypeUtils.createSordType(config.id, config.name, config.kind,
        me.collectIcons(config.name, sordTypeDir, "Icon", possibleSordTypeIconExtensions),
        me.collectIcons(config.name, sordTypeDir, "Disabled icon", possibleSordTypeIconExtensions),
        me.collectIcons(config.name, sordTypeDir, "Link icon", possibleSordTypeIconExtensions),
        config.extensions, force);

      if (result) {
        me.handler.log({ text: "Sord type '" + config.name + "' created.", statusBar: true });
      }

    } catch (ex) {
      exceptionString = sol.common.ExceptionUtils.parseException(ex);
      me.handler.log({ text: "Can't create sord type: sordType=" + config.name + ", exception=" + exceptionString });
    }
  }
});

sol.define("sol.dev.install.functions.AssignSordTypes", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.setSordTypes;
  },

  execute: function () {
    var me = this,
        sordTypeSet, objId, i, exceptionString;

    me.handler.log({ text: "Set sord types...", statusBar: true });
    for (i = 0; i < me.config.install.setSordTypes.length; i++) {
      sordTypeSet = me.config.install.setSordTypes[i];
      try {
        objId = sol.common.RepoUtils.resolveSpecialFolder(sordTypeSet.path, me.config.base.repoPathParamObj);
        sol.common.SordTypeUtils.setSordType(objId, sordTypeSet.name);
      } catch (ex) {
        exceptionString = sol.common.ExceptionUtils.parseException(ex);
        me.handler.log({ text: "Can't set sord type: objId=" + objId + ", sordType=" + sordTypeSet.name + ", exception=" + exceptionString });
      }
    }
  }
});

sol.define("sol.dev.install.functions.DeleteObjects", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.deleteSords;
  },

  /**
   * Delete sords
   */
  execute: function () {
    var me = this,
        i, repoPath, sord, displayRepoPath;

    me.handler.log({ text: "Delete objects...", statusBar: true });
    for (i = 0; i < me.config.install.deleteSords.length; i++) {
      sord = me.config.install.deleteSords[i];
      repoPath = sol.common.RepoUtils.resolveSpecialFolder(sord, me.config.base.repoPathParamObj);
      repoPath = sol.common.RepoUtils.normalizePath(repoPath, true);
      if (sol.common.RepoUtils.exists(repoPath)) {
        displayRepoPath = sol.common.RepoUtils.getPathFromObjId(repoPath);
        me.handler.log({ text: "Delete object: " + displayRepoPath, statusBar: true });
        sol.common.RepoUtils.deleteSord(repoPath, { deleteFinally: true });
      }
    }
  }
});

sol.define("sol.dev.install.functions.UpdateSords", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.updateSords;
  },

  /**
   * Update sords
   */
  execute: function () {
    var me = this,
        i, updateEntry, objId, changes, repoPath, displayRepoPath, sord, mapEntries;

    me.handler.log({ text: "Update objects...", statusBar: true });
    for (i = 0; i < me.config.install.updateSords.length; i++) {
      updateEntry = me.config.install.updateSords[i];
      objId = updateEntry.objId;

      repoPath = sol.common.RepoUtils.resolveSpecialFolder(objId, me.config.base.repoPathParamObj);
      repoPath = sol.common.RepoUtils.normalizePath(repoPath, true);
      objId = sol.common.RepoUtils.getObjId(repoPath);

      changes = updateEntry.changes;

      if (sol.common.RepoUtils.exists(objId)) {
        displayRepoPath = sol.common.RepoUtils.getPathFromObjId(objId);
        me.handler.log({ text: "Update object '{0}': {1}", data: [displayRepoPath, JSON.stringify(changes)] });
        sord = ixConnect.ix().checkoutSord(objId + "", SordC.mbAllIndex, LockC.NO);
        mapEntries = sol.common.SordUtils.updateSord(sord, changes, { silent: true });
        if (mapEntries) {
          ixConnect.ix().checkinMap(MapDomainC.DOMAIN_SORD, objId, objId, mapEntries, LockC.NO);
        }
        ixConnect.ix().checkinSord(sord, SordC.mbAllIndex, LockC.NO);
      }
    }
  }
});

sol.define("sol.dev.install.functions.SetPreviewForms", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.previewForms;
  },

  /**
   * Adds preview forms
   */
  execute: function () {
    var me = this;

    me.handler.log({ text: "Set preview forms...", statusBar: true });
    me.readPreviewForms();
    me.config.install.previewForms.forEach(function (previewFormSet) {
      me.processPreviewFormSet(previewFormSet);
    });
    me.writePreviewForms();
  },

  pilcrow: "\u00b6",
  maskFormsKey: "ELOwf.maskforms",

  /**
   * @private
   * Read preview forms
   */
  readPreviewForms: function () {
    var me = this,
        entries, value, entryParts, i, maskKey, form;

    me.previewForms = {};
    me.userProfile = sol.create("sol.common.UserProfile", { userId: UserProfileC.USERID_ALL });
    value = me.userProfile.getOption(me.maskFormsKey);
    entries = value.split(me.pilcrow);
    for (i = 0; i < entries.length; i++) {
      entryParts = entries[i].split(":");
      if ((entryParts.length < 2) || (entryParts[0].length < 2)) {
        continue;
      }
      maskKey = entryParts[0];
      form = entryParts[1];
      if (maskKey.charAt(0) != "(") {
        try {
          maskKey = sol.common.SordUtils.getDocMaskGuid(maskKey);
        } catch (ex) {
          me.handler.log({ text: "Mask '{0}' not found.", data: [maskKey] });
        }
      }
      if (maskKey) {
        me.previewForms[maskKey] = form;
      }
    }
  },

  /**
   * @private
   * Processes the setting of a preview form
   * @param {Object} previewFormSet
   */
  processPreviewFormSet: function (previewFormSet) {
    var me = this,
        maskGuid;

    try {
      maskGuid = sol.common.SordUtils.getDocMaskGuid(previewFormSet.mask);
    } catch (ignore) {
    }

    if (!maskGuid) {
      me.handler.log({ text: "Mask '{0}' not found.", data: [previewFormSet.mask] });
      return;
    }

    me.previewForms[maskGuid] = previewFormSet.form;
    me.handler.log({ text: "Set preview form for mask '{0}' {1}: {2}", data: [previewFormSet.mask, maskGuid, previewFormSet.form] });
  },

  writePreviewForms: function () {
    var me = this,
        entries = [],
        key, optValue;

    for (key in me.previewForms) {
      entries.push(key + ":" + me.previewForms[key]);
    }

    optValue = entries.join(me.pilcrow);
    me.handler.log({ text: "Write global profile option '{0}': {1}", data: [me.maskFormsKey, optValue] });
    me.userProfile.setOption(me.maskFormsKey, entries.join(me.pilcrow));
    me.userProfile.write();
  }
});

sol.define("sol.dev.install.functions.SetProfileOpts", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return !!me.config.install.profileOpts;
  },

  /**
   * Adds preview forms
   */
  execute: function () {
    var me = this;

    me.handler.log({ text: "Set profile options...", statusBar: true });

    me.config.install.profileOpts.forEach(function (profileOptsEntry) {
      me.processProfileOptsEntry(profileOptsEntry);
    });
  },

  previewKey: "EloJ.S.PreviewMappingModel",

  MAXIMIZED_BOTH: "6",

  /**
   * @private
   * Sets profile options
   * @param {Object} profileOptsEntry Profile options entry
   */
  processProfileOptsEntry: function (profileOptsEntry) {
    var me = this,
        i = 0,
        userProfile, extension, entry, option;

    me.handler.log({ text: "Set profile options for user '{0}': {1}", data: [profileOptsEntry.user, JSON.stringify(profileOptsEntry)] });

    userProfile = sol.create("sol.common.UserProfile", { userId: profileOptsEntry.user });

    if (profileOptsEntry.documentPreviews) {
      for (extension in profileOptsEntry.documentPreviews) {
        entry = profileOptsEntry.documentPreviews[extension];
        option = extension + ":" + entry.className + ":" + entry.confirm;
        userProfile.setOption(me.previewKey + i, option);
        i++;
      }
      userProfile.setOption(me.previewKey + i, me.pilcrow + "END" + me.pilcrow);
    }

    if (profileOptsEntry.skipTips) {
      userProfile.setOption("EloJ.B.ShowDYK", "false");
    }

    if (profileOptsEntry.maximized) {
      userProfile.setOption("EloJ.S.DlgSize.Workspace.0", "0,0,200,200," + me.MAXIMIZED_BOTH);
    }

    if (profileOptsEntry.entries) {
      for (i = 0; i < profileOptsEntry.entries.length; i++) {
        entry = profileOptsEntry.entries[i];
        userProfile.setOption(entry.key, entry.value);
      }
    }

    userProfile.write();
  }
});

sol.define("sol.dev.install.functions.ConfigureAsUrl", {
  extend: "sol.dev.install.InstallFunctionBase",

  check: function () {
    var me = this;

    return (!!me.config.install.asConfigDialog && !!me.config.install.asConfigDialog.configDestination);
  },

  /**
   * Shows an dialog to configure the ELOas URL
   */
  execute: function () {
    var me = this,
        panel, result, window;

    me.asUrl = me.findAsBaseUrl();

    if (me.config.base.scriptEnvironment == "JC") {

      me.dialog = workspace.createGridDialog(me.handler.getText("sol.dev.install.title.asConfig"), 8, 3);
      me.dialog.dialogId = "ConfigureAsUrl-" + java.lang.System.currentTimeMillis().toString();

      panel = me.dialog.gridPanel;
      panel.addLabel(1, 1, 1, me.handler.getText("sol.dev.install.label.asUrl"));
      me.txtAsUrl = panel.addTextField(2, 1, 6);
      me.txtAsUrl.text = me.asUrl;
      panel.addButton(8, 1, 1, me.handler.getText("sol.dev.install.button.urlCheck"), "onAsUrlCheckButtonClicked");
      me.checkAsBaseUrl();

      window = javax.swing.SwingUtilities.getWindowAncestor(panel);
      window.setMinimumSize(new java.awt.Dimension(1000, 100));

      result = me.dialog.show();
      if (result) {
        me.asUrl = (me.txtAsUrl.text || "") + "";
      }
    }

    me.updateAsConfig();
  },

  /**
   * @private
   * Finds the ELOas base URL
   */
  findAsBaseUrl: function () {
    var me = this,
        tries = 0,
        maxTries = 4,
        ixUrl, asProxyUrl, asProxyHttpResponse,
        asUrl, testAsUrl, match, httpResponse, port;

    me.handler.log({ text: "Configure ELOas URL...", statusBar: true });

    ixUrl = ixConnect.endpointUrl + "";
    asProxyUrl = ixUrl.substring(0, ixUrl.length - 3) + "/plugin/de.elo.ix.plugin.proxy/as/";

    asProxyHttpResponse = sol.common.AsUtils.testAsBaseUrl(asProxyUrl);
    me.handler.log({ text: "Test ELOas proxy URL: {0} -> ok={1}, error={2}", data: [asProxyUrl, asProxyHttpResponse.asUrlTestOk, asProxyHttpResponse.errorMessage || ""] });

    if (asProxyHttpResponse.asUrlTestOk) {
      return asProxyUrl;
    }

    asUrl = sol.common.AsUtils.guessAsBaseUrl();
    testAsUrl = asUrl;
    do {
      tries++;
      httpResponse = sol.common.AsUtils.testAsBaseUrl(testAsUrl);
      me.handler.log({ text: "Test ELOas URL: {0} -> ok={1}, error={2}", data: [testAsUrl, httpResponse.asUrlTestOk, httpResponse.errorMessage || ""] });
      if (httpResponse.asUrlTestOk) {
        asUrl = testAsUrl;
      } else {
        match = testAsUrl.match(/(?:\:)(\d{2,5})/);
        port = (match && (match.length == 2)) ? (parseInt(match[1], 10) - 10) : 0;
        testAsUrl = asUrl.replace(/(?:\:\d{2,5})/, ":" + port);
      }
    } while (!httpResponse.asUrlTestOk && port && (tries < maxTries));

    return asUrl;
  },

  /**
   * @private
   * Checks the ELOas URL
   */
  checkAsBaseUrl: function () {
    var me = this,
        httpResponse;

    me.asUrl = me.txtAsUrl.text;
    httpResponse = sol.common.AsUtils.testAsBaseUrl(me.asUrl);
    if (httpResponse.asUrlTestOk) {
      me.txtAsUrl.state = CONSTANTS.FIELD_STATE.CHECKED;
      me.dialog.setStatusNormal(me.handler.getText("sol.dev.install.statusBar.asUrlOk"));
    } else {
      me.txtAsUrl.state = CONSTANTS.FIELD_STATE.INVALID;
      if (httpResponse.errorMessage && httpResponse.errorMessage.message) {
        me.dialog.setStatusRed(httpResponse.errorMessage.message);
      } else {
        me.dialog.setStatusRed(me.handler.getText("sol.dev.install.statusBar.httpStatusCode").replace("{0}", httpResponse.responseCode));
      }
    }
  },

  /**
   * Updates the ELOas configuration
   */
  updateAsConfig: function () {
    var me = this,
        parentPath = "",
        name = "",
        asConfigObj, path, objId;

    me.handler.log({ text: "ELOas URL: " + me.asUrl, statusBar: true });
    asConfigObj = sol.common.AsUtils.convertAsUrlToConfigObject(me.asUrl);

    asConfigObj.readTimeout = 60000;

    me.handler.log({ text: "ELOas configuration: " + JSON.stringify(asConfigObj) });

    path = me.config.install.asConfigDialog.configDestination = me.config.install.asConfigDialog.configDestination || "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/common/Configuration/as.config";
    path = sol.common.RepoUtils.resolveSpecialFolder(path, me.config.base.repoPathParamObj);

    objId = sol.common.RepoUtils.getObjId(path);

    if (!objId) {
      parentPath = sol.common.RepoUtils.getParentPath(path);
      name = sol.common.RepoUtils.getNameFromPath(path);
    }

    me.handler.log({ text: "Update ELOas config: objId={0}, parentPath={1}, name={2}, content={3}", data: [objId, parentPath, name, JSON.stringify(asConfigObj)] });

    sol.common.RepoUtils.saveToRepo({
      objId: objId,
      name: name,
      parentId: parentPath,
      maskId: "ELO Business Solution Configuration",
      extension: "json",
      objKeysObj: {
        BS_CONFIG_NAME: "ELO AS settings",
        BS_CONFIG_VERSION: "1.0"
      },
      contentObject: asConfigObj,
      withoutBom: true,
      tryUpdate: true
    });
  }
});

sol.define("sol.dev.install.functions.ReloadModules", {
  extend: "sol.dev.install.InstallFunctionBase",
  mixins: ["sol.dev.install.mixin.InstallUtils"],

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;

    return !!me.config.install.reloads;
  },

  /**
   * Reloads modules
   */
  execute: function () {
    var me = this,
        exceptionString;

    if (me.config.install.reloads.ix) {
      if (me.config.base.scriptEnvironment == "SH") {
        me.handler.log({ text: "Skip IX reload: scriptEnvironment=" + me.config.base.scriptEnvironment });
      } else {
        me.handler.log({ text: "Reload ELOix...", statusBar: true });

        try {
          me.conn.ix().reload();
        } catch (ex) {
          exceptionString = sol.common.ExceptionUtils.parseException(ex);
          me.handler.log({ text: "Can't reload IX: exception=" + exceptionString });
        }
      }
    }

    if (me.config.install.reloads.wfForms) {
      me.sendHttpRequest("Reload ELOwf forms", "{{eloWfBaseUrl}}/wf/edit.jsp?reload=1&lang=en&ticket={{ticket}}");
    }

    if (me.config.install.reloads.apps) {
      me.sendHttpRequest("Reload ELOapps", "{{eloWfBaseUrl}}/apps/rest/cmd/refresh/", { method: "post" });
    }
  }
});

sol.define("sol.dev.install.functions.ExecuteRegisteredFunctions", {
  extend: "sol.dev.install.InstallFunctionBase",

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;
    return !!me.config.install.executeRegisteredFunctions;
  },

  /**
   * Executes registered functions
   */
  execute: function () {
    var me = this,
        funcCalls, i, funcCall, jsonParams, jsonResult, connPropsString;

    if (me.config.install.executeRegisteredFunctions.reloadScripts) {
      me.handler.log({ text: "Reload IX scripts...", statusBar: true });
      connPropsString = me.getPropertiesString(me.conn.connProperties);
      me.handler.log({ text: "connProps = " + connPropsString });
      me.conn.ix().reloadScripts();
      me.handler.log({ text: "Scripts reloaded." });
    }

    me.handler.log({ text: "Execute registered functions...", statusBar: true });

    funcCalls = me.config.install.executeRegisteredFunctions.funcCalls;

    for (i = 0; i < funcCalls.length; i++) {
      funcCall = funcCalls[i];
      jsonParams = JSON.stringify(funcCall.params);

      me.handler.log({ text: "Execute registered function '{0}': params={1}", data: [funcCall.funcName, jsonParams] });

      jsonResult = me.conn.ix().executeRegisteredFunctionString(funcCall.funcName, jsonParams);

      me.handler.log({ text: "result={0}", data: [jsonResult] });
    }
  },

  // For GraalJS compatibility
  getPropertiesString: function (props) {
    var entryIterator,
        strArr = [],
        entry;

    if (!props) {
      return "";
    }

    entryIterator = props.entrySet().iterator();
    while (entryIterator.hasNext()) {
      entry = entryIterator.next();
      strArr.push(entry.key + " = " + entry.value);
    }

    return "{ " + strArr.join(", ") + " }";
  }
});

sol.define("sol.dev.install.functions.UninstallApps", {
  extend: "sol.dev.install.InstallFunctionBase",
  mixins: ["sol.dev.install.mixin.InstallUtils"],

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;

    return !!me.config.install.uninstApps;
  },

  /**
   * Uninstalls ELOapps and ELOapps modules
   */
  execute: function () {
    var me = this;

    me.config.install.uninstApps.forEach(function (uninstObj) {
      me.sendHttpRequest("Uninstall ELOapp '" + uninstObj.appId + "'", "{{eloWfBaseUrl}}/apps/rest/cmd/app/undeploy/?namespace=" + uninstObj.namespace + "&appId=" + uninstObj.appId, { method: "post" });
    });
  }
});

sol.define("sol.dev.install.functions.InstallApps", {
  extend: "sol.dev.install.InstallFunctionBase",
  mixins: ["sol.dev.install.mixin.InstallUtils"],

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;

    return !!me.config.install.instApps;
  },

  /**
   * Installs ELOapps and ELOapps modules
   */
  execute: function () {
    var me = this,
        modulesRootRepoPath, modulesRootFolderId, appsRootRepoPath, appsRootFolderId, moduleFolders, appFolders, manifest;

    modulesRootRepoPath = sol.common.RepoUtils.resolveSpecialFolder("{{bsFolderPath}}/" + me.config.install.packageName + "/ELOapps/Modules", me.config.base.repoPathParamObj);
    modulesRootFolderId = sol.common.RepoUtils.getObjId(modulesRootRepoPath);

    if (modulesRootFolderId) {
      moduleFolders = sol.common.RepoUtils.findChildren(modulesRootFolderId, { includeFolders: true, includeDocuments: false });
      moduleFolders.forEach(function (folder) {
        manifest = me.getManifestObj(folder.id);
        if (manifest) {
          me.sendHttpRequest("Install ELOapp module '" + manifest.id + "'", "{{eloWfBaseUrl}}/apps/rest/cmd/module/deploy/?moduleId=" + manifest.id, { method: "post" });
        } else {
          me.handler.log({ text: "Module manifest not found: {0}", data: [folder.name] });
        }
      });
    }

    appsRootRepoPath = sol.common.RepoUtils.resolveSpecialFolder("{{bsFolderPath}}/" + me.config.install.packageName + "/ELOapps/Apps", me.config.base.repoPathParamObj);
    appsRootFolderId = sol.common.RepoUtils.getObjId(appsRootRepoPath);

    if (appsRootFolderId) {
      appFolders = sol.common.RepoUtils.findChildren(appsRootFolderId, { includeFolders: true, includeDocuments: false });
      appFolders.forEach(function (folder) {
        manifest = me.getManifestObj(folder.id);
        if (manifest) {
          me.sendHttpRequest("Install ELOapp '" + manifest.id + "'", "{{eloWfBaseUrl}}/apps/rest/cmd/app/deploy/?namespace=" + manifest.namespace + "&appId=" + manifest.id, { method: "post", readTimeout: 30000 });
        } else {
          me.handler.log({ text: "App manifest not found: {0}", data: [folder.name] });
        }
      });
    }

    me.sendHttpRequest("Refresh icons", "{{eloWfBaseUrl}}/apps/rest/cmd/refreshicons/", { method: "post", readTimeout: 30000 });
  },

  /**
   * @private
   * Gets the content of the manifest file
   * @param {String} folderId
   * @return {String}
   */
  getManifestObj: function (folderId) {
    var me = this,
        content, manifestRepoPath, manifestObjId;

    manifestRepoPath = "ARCPATH[" + folderId + "]:/manifest";
    manifestObjId = sol.common.RepoUtils.getObjId(manifestRepoPath);
    if (!manifestObjId) {
      me.handler.log({ text: "Manifest file not found: " + manifestRepoPath });
      return;
    }
    content = sol.common.RepoUtils.downloadToString(manifestObjId) || "{}";
    return JSON.parse(content);
  }
});

sol.define("sol.dev.install.functions.ShiftDates", {
  extend: "sol.dev.install.InstallFunctionBase",

  initialize: function (config) {
    var me = this;

    me.$super("sol.dev.install.InstallFunctionBase", "initialize", [config]);
  },

  check: function () {
    var me = this;

    return !!me.config.install.shiftDates;
  },

  /**
   * Shift data for presentations
   */
  execute: function () {
    var me = this,
        manifestFilePath, refDateIso, shiftDates, i, shiftDateEntry, result;

    manifestFilePath = (new File(me.handler.payloadDirPath).parent) + java.io.File.separator + "MANIFEST.MF";

    if (!sol.common.FileUtils.exists(manifestFilePath)) {
      me.handler.log({ text: "Manifest file '{0} doesn't exist. Shift dates skipped", data: [manifestFilePath] });
      return;
    }

    refDateIso = me.getManifestCreatedDate(manifestFilePath);

    shiftDates = me.config.install.shiftDates;

    me.handler.log({ text: "Shift dates...", statusBar: true });

    for (i = 0; i < shiftDates.length; i++) {
      shiftDateEntry = shiftDates[i];
      shiftDateEntry.refDateIso = refDateIso;
      result = sol.dev.DateShiftUtils.shiftDates(shiftDateEntry);
      me.handler.log({ text: "Dates shifted: " + JSON.stringify(result) });
    }
  },

  getManifestCreatedDate: function (manifestFilePath) {
    var attributes, value, date, isoDate;

    if (!manifestFilePath) {
      throw "File path is empty";
    }
    attributes = sol.common.FileUtils.readManifestFile(manifestFilePath);
    value = attributes.getValue("Created-At");

    date = Packages.org.apache.commons.lang3.time.DateUtils.parseDate(value, ["yyyy-MM-dd'T'HH:mm:ssXXX"]);
    isoDate = Packages.org.apache.commons.lang3.time.DateFormatUtils.format(date, "yyyyMMddHHmmss") + "";

    return isoDate;
  }
});

sol.define("sol.dev.install.Installer", {
  singleton: true,

  functions: {},

  handlerClassNames: {
    JC: "sol.dev.install.JcHandler",
    AS: "sol.dev.install.AsHandler",
    IX: "sol.dev.install.IxHandler",
    SH: "sol.dev.install.ShHandler",
    TEST: "sol.dev.install.TestHandler"
  },

  initialize: function () {
    var me = this;

    me.register("install", "sol.dev.install.functions.CheckRunningSetup");
    me.register("install", "sol.dev.install.functions.CheckJcRequirements");
    me.register("install", "sol.dev.install.functions.CheckIxRequirements");
    me.register("install", "sol.dev.install.functions.CheckPermissions");
    me.register("install", "sol.dev.install.functions.CheckPackageAlreadyInstalled");

    me.register("install", "sol.dev.install.functions.CheckRepoPathsMustNotExist");

    me.register("install", "sol.dev.install.functions.CheckWfIsRunning");
    me.register("install", "sol.dev.install.functions.CheckAsLibs");
    me.register("install", "sol.dev.install.functions.CheckPackageDependencyInstalled");

    me.register("install", "sol.dev.install.functions.ProcessIssues");

    me.register("install", "sol.dev.install.functions.CreateUsers");
    me.register("install", "sol.dev.install.functions.UndeployPackage");
    me.register("install", "sol.dev.install.functions.UndeployHotfix");
    me.register("install", "sol.dev.install.functions.ReassignGuids");
    me.register("install", "sol.dev.install.functions.AddMemberships");
    me.register("install", "sol.dev.install.functions.RemoveMemberships");
    me.register("install", "sol.dev.install.functions.CreateColors");
    me.register("install", "sol.dev.install.functions.InstallWorkflowTemplateFiles");
    me.register("install", "sol.dev.install.functions.CreateMasks");
    me.register("install", "sol.dev.install.functions.CheckDocMasks");
    me.register("install", "sol.dev.install.functions.AdjustDocMasks");
    me.register("install", "sol.dev.install.functions.UninstallIxPlugins");
    me.register("install", "sol.dev.install.functions.InstallIxPlugins");
    me.register("install", "sol.dev.install.functions.UninstallApps");
    me.register("install", "sol.dev.install.functions.PrepareRepoPaths");
    me.register("install", "sol.dev.install.functions.PrepareExistingRepoPaths");
    me.register("install", "sol.dev.install.functions.ImportRepoData");
    me.register("install", "sol.dev.install.functions.AdjustDocMaskRights");
    me.register("install", "sol.dev.install.functions.CreateSordTypes");
    me.register("install", "sol.dev.install.functions.AssignSordTypes");
    me.register("install", "sol.dev.install.functions.DeleteObjects");
    me.register("install", "sol.dev.install.functions.UpdateSords");
    me.register("install", "sol.dev.install.functions.SetPreviewForms");
    me.register("install", "sol.dev.install.functions.SetProfileOpts");
    me.register("install", "sol.dev.install.functions.CreateChildrenReferences");
    me.register("install", "sol.dev.install.functions.CreateSingleReferences");
    me.register("install", "sol.dev.install.functions.ChangeRights");
    me.register("install", "sol.dev.install.functions.ConfigureAsUrl");
    me.register("install", "sol.dev.install.functions.ReloadModules");
    me.register("install", "sol.dev.install.functions.ExecuteRegisteredFunctions");
    me.register("install", "sol.dev.install.functions.InstallApps");
    me.register("install", "sol.dev.install.functions.ShiftDates");

    me.register("transport", "sol.dev.install.functions.CheckRunningSetup");
    me.register("transport", "sol.dev.install.functions.CheckJcRequirements");
    me.register("transport", "sol.dev.install.functions.CheckIxRequirements");
    me.register("transport", "sol.dev.install.functions.CheckPermissions");
    me.register("transport", "sol.dev.install.functions.TransportWarning");
    me.register("transport", "sol.dev.install.functions.CheckPackageAlreadyInstalled");

    me.register("transport", "sol.dev.install.functions.CheckWfIsRunning");
    me.register("transport", "sol.dev.install.functions.CheckAsLibs");
    me.register("transport", "sol.dev.install.functions.CheckPackageDependencyInstalled");

    me.register("transport", "sol.dev.install.functions.ProcessIssues");

    me.register("transport", "sol.dev.install.functions.CreateUsers");
    me.register("transport", "sol.dev.install.functions.UndeployPackage");
    me.register("transport", "sol.dev.install.functions.UndeployHotfix");
    me.register("transport", "sol.dev.install.functions.ReassignGuids");
    me.register("transport", "sol.dev.install.functions.AddMemberships");
    me.register("transport", "sol.dev.install.functions.CreateColors");
    me.register("transport", "sol.dev.install.functions.InstallWorkflowTemplateFiles");
    me.register("transport", "sol.dev.install.functions.CreateMasks");
    me.register("transport", "sol.dev.install.functions.UninstallIxPlugins");
    me.register("transport", "sol.dev.install.functions.InstallIxPlugins");
    me.register("transport", "sol.dev.install.functions.UninstallApps");
    me.register("transport", "sol.dev.install.functions.PrepareRepoPaths");
    me.register("transport", "sol.dev.install.functions.PrepareExistingRepoPaths");
    me.register("transport", "sol.dev.install.functions.ImportRepoData");
    me.register("transport", "sol.dev.install.functions.AdjustDocMaskRights");
    me.register("transport", "sol.dev.install.functions.CreateSordTypes");
    me.register("transport", "sol.dev.install.functions.AssignSordTypes");
    me.register("transport", "sol.dev.install.functions.DeleteObjects");
    me.register("transport", "sol.dev.install.functions.UpdateSords");
    me.register("transport", "sol.dev.install.functions.SetPreviewForms");
    me.register("transport", "sol.dev.install.functions.SetProfileOpts");
    me.register("transport", "sol.dev.install.functions.CreateChildrenReferences");
    me.register("transport", "sol.dev.install.functions.CreateSingleReferences");
    me.register("transport", "sol.dev.install.functions.ConfigureAsUrl");
    me.register("transport", "sol.dev.install.functions.ReloadModules");
    me.register("transport", "sol.dev.install.functions.ExecuteRegisteredFunctions");
    me.register("transport", "sol.dev.install.functions.InstallApps");
    me.register("transport", "sol.dev.install.functions.ShiftDates");

    me.register("undeploy", "sol.dev.install.functions.UndeployPackage");

    me.register("deploy", "sol.dev.install.functions.DeployRenamePackage");
    me.register("deploy", "sol.dev.install.functions.CreateChildrenReferences");
    me.register("deploy", "sol.dev.install.functions.CreateSingleReferences");

    me.register("test", "sol.dev.install.functions.CheckDocMasks");
    me.register("test", "sol.dev.install.functions.AdjustDocMasks");
  },

  /**
   * Registers an installer function
   * @param {String} procName Installation procedure name
   * @param {String} funcName Function nameBlub
   */
  register: function (procName, funcName) {
    var me = this;

    if (!procName) {
      throw "Installation procedure name is empty";
    }

    if (!funcName) {
      throw "Function name is empty";
    }

    me.functions[procName] = me.functions[procName] || [];
    me.functions[procName].push(funcName);
  },

  /**
   * Call installer functions
   * @param {String} [procName=install] Installation procedure name
   * @param {Object} installConfig Installation configuration
   * @param {Object} result Output object
   * @param {Object} buildConfig Build configuration
   */
  execute: function (procName, installConfig, result, buildConfig) {
    var me = this,
        config, i, handlerClassName, procFunctions, funcName, func, javaVersion,
        scriptEnvironment, handler, connFact, timeoutSeconds,
        installFuncParams, timestamp, exceptionString;

    if (!installConfig) {
      throw "Configuration is empty";
    }

    buildConfig = buildConfig || {};

    if (installConfig.transport) {
      procName = "transport";
    }

    procName = procName || "install";

    result = result || {};
    result.issues = { items: [] };

    scriptEnvironment = (installConfig.test) ? "TEST" : sol.common.RepoUtils.detectScriptEnvironment();

    timestamp = sol.common.DateUtils.format(new Date(), "YYYY-MM-DD HH:mm");

    config = {
      install: installConfig,
      build: buildConfig,
      base: {
        scriptEnvironment: scriptEnvironment,
        repoPathParamObj: {
          packageName: installConfig.packageName,
          packageBaseFolderPath: installConfig.packageBaseFolderPath
        },
        timestamp: timestamp
      }
    };

    installFuncParams = {
      procName: procName,
      config: config,
      result: result
    };

    handlerClassName = me.handlerClassNames[scriptEnvironment];
    handler = sol.create(handlerClassName, installFuncParams);

    installFuncParams.handler = handler;

    procFunctions = me.functions[procName];
    if (!procFunctions) {
      throw "Installation procedure '" + procName + "' not found.";
    }

    javaVersion = sol.common.ExecUtils.getJavaVersion();

    handler.log({ text: "Start installation '{0}'", data: [config.install.setupName] });
    handler.log({ text: "Java version: {0}", data: [javaVersion] });
    handler.log({ text: "IX client library version: {0}", data: [ixConnect.clientVersion] });
    handler.log({ text: "mode={0}", data: [procName] });
    handler.log({ text: "scriptEnvironment={0}", data: [scriptEnvironment] });
    if (typeof Graal != "undefined") {
      handler.log({ text: "JavaScript engine: Graal: Graal.versionGraalVM={0}, Graal.isGraalRuntime={1}, Graal.language={2}, Graal.versionECMAScript={3}", data: [Graal.versionGraalVM || "", Graal.isGraalRuntime() || "", Graal.language || "", Graal.versionECMAScript || ""] });
    }

    if (scriptEnvironment != "IX") {

      timeoutSeconds = 600;

      handler.log({ text: "Create connection with different timeout: timoutSeconds={0}", data: [timeoutSeconds] });

      connFact = sol.common.RepoUtils.createConnFact(ixConnect.connProperties, ixConnect.sessionOptions, {
        timeoutSeconds: timeoutSeconds
      });
      installFuncParams.conn = connFact.createFromTicket(ixConnect.loginResult.clientInfo);
      installFuncParams.separateConn = true;
    } else {
      installFuncParams.conn = ixConnect;
      installFuncParams.separateConn = false;
    }

    for (i = 0; i < procFunctions.length; i++) {
      funcName = procFunctions[i];
      func = sol.create(funcName, installFuncParams);
      CURR_INST_FUNC = func;
      try {
        func.process();
      } catch (ex) {
        exceptionString = funcName + ": " + sol.common.ExceptionUtils.parseException(ex);
        handler.log({ text: "Exception: funcName={0}, exception={1}", data: [funcName, exceptionString] });
        if (globalScope && globalScope.runningSetup) {
          globalScope.runningSetup = false;
        }
        result.success = false;
        handler.finalize();
        throw exceptionString;
      }
      if (result.canceled) {
        break;
      }
      result.success = true;
    }

    if (installFuncParams.separateConn) {
      installFuncParams.conn.close();
      if (connFact) {
        connFact.done();
      }
    }

    handler.finalize();
  }
});