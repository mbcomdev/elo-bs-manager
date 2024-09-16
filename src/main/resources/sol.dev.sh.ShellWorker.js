/**
 * ELO Shell Script Runner
 *
 * @author ELO Digital Office GmbH
 *
 * @elosh
 */

/* eslint-disable no-redeclare*/
var $SCRIPT_NAME, $SCRIPT_CONFIG_PATH,
    rhinoVersion = "",
    jsEngine = "",
    $ARGS = [], // NOSONAR
    BASE_CONFIG = {},
    SCRIPT_CONFIG = {},
    log, logFile, osName, ixConnect, script,
    EloShellScriptRunner, configFileName;
/* eslint-enable no-redeclare*/

try {
  rhinoVersion = Packages.org.mozilla.javascript.Context.getCurrentContext().getImplementationVersion() + "";
} catch (ex) {
  // ignore
}

function detectJsEngine() {
  if (typeof Graal != "undefined") {
    return "GraalJS";
  } else if (rhinoVersion) {
    return "Rhino";
  } else {
    throw "Unknown JS engine";
  }
}

jsEngine = detectJsEngine();

if (jsEngine == "GraalJS") {
  load("nashorn:mozilla_compat.js");
}

importPackage(Packages.de.elo.ix.client);
importPackage(Packages.java.io);

Packages.java.lang.System.setProperty("logback.configurationFile", "logback.xml");
log = Packages.org.slf4j.LoggerFactory.getLogger("ELO CLI");

EloShellScriptRunner = {

  pilcrow: "\u00b6",

  baseConfigFileName: "./config/config.json",
  logFileName: "EloShellScript.log",

  execute: function (scriptName, scriptConfigPath) {
    var me = this,
        javaMinMajorVersion = 17,
        scriptDebug, workingDir, currentJavaMajorVersion, platformEncoding;

    Packages.org.apache.commons.io.FileUtils.deleteQuietly(new java.io.File(me.logFileName));

    scriptDebug = java.lang.System.getProperty("scriptDebug") + "";
    if (!scriptDebug) {
      me.devMode = true;
    }

    log.info("Execute ELO shell script...");
    log.info("scriptName=" + scriptName + ", scriptConfigPath=" + scriptConfigPath);

    osName = java.lang.System.getProperty("os.name") + "";
    platformEncoding = java.lang.System.getProperty("sun.jnu.encoding") + "";
    currentJavaMajorVersion = me.getCurrentJavaMajorVersion();

    log.info("osName=" + osName + ", sun.jnu.encoding=" + platformEncoding);
    log.info("Java: java.version=" + me.getJavaVersion() + ", javaMajorVersion=" + currentJavaMajorVersion + ", javaMinMajorVersion=" + javaMinMajorVersion + ", JAVA_HOME=" + java.lang.System.getenv("JAVA_HOME"));
    if ((osName.indexOf("Linux") > -1) && (platformEncoding != "UTF-8")) {
      log.warn("sun.jnu.encoding=" + platformEncoding + " - under Linux the platform encoding should be 'UTF-8'; install 'glibc-langpack-en'"); // NOSONAR
    }

    if (currentJavaMajorVersion < javaMinMajorVersion) {
      throw "Use Java version " + javaMinMajorVersion + " or higher. Set the environment variable JAVA_HOME to this Java version."; // NOSONAR
    }

    if (osName.indexOf("Windows") > -1) {
      log.info("Use Windows certificates");
      java.lang.System.setProperty("javax.net.ssl.trustStore", "NUL");
      java.lang.System.setProperty("javax.net.ssl.trustStoreType", "Windows-ROOT");
      java.lang.System.setProperty("javax.net.ssl.trustStoreProvider", "SunMSCAPI");
    }

    if (jsEngine == "Rhino") {
      log.info("JavaScript engine: Rhino: rhinoVersion=" + rhinoVersion);
    }

    if (jsEngine == "GraalJS") {
      log.info("JavaScript engine: Graal: Graal.isGraalRuntime=" + !!Graal.isGraalRuntime() + ", Graal.language=" + (Graal.language || "") + ", Graal.versionECMAScript=" + Graal.versionECMAScript);
    }

    workingDir = new java.io.File(".");
    log.info("baseConfigFileName=" + me.baseConfigFileName + ", workingDir=" + workingDir.canonicalPath);

    BASE_CONFIG = me.loadConfig(me.baseConfigFileName);
    log.info("BASE_CONFIG=" + JSON.stringify(BASE_CONFIG));
    log.info("scriptConfigPath=" + scriptConfigPath);
    me.loadScriptConfig(scriptConfigPath);
    log.info("SCRIPT_CONFIG=" + JSON.stringify(SCRIPT_CONFIG));

    BASE_CONFIG.ixUrl = SCRIPT_CONFIG.ixUrl || BASE_CONFIG.ixUrl;
    BASE_CONFIG.username = SCRIPT_CONFIG.username || BASE_CONFIG.username;
    BASE_CONFIG.password = SCRIPT_CONFIG.password || BASE_CONFIG.password;
    BASE_CONFIG.scriptSubDirName = BASE_CONFIG.scriptSubDirName || "script";

    me.loadScript(BASE_CONFIG.scriptSubDirName, scriptName, true);
  },

  getJavaVersion: function () {
    var javaRuntimeName, javaRuntimeVersion, bitness, javaVersion;

    javaRuntimeName = String(java.lang.System.getProperty("java.runtime.name"));
    javaRuntimeVersion = String(java.lang.System.getProperty("java.runtime.version"));
    bitness = String(java.lang.System.getProperty("sun.arch.data.model"));
    javaVersion = javaRuntimeName + " " + javaRuntimeVersion + " - " + bitness + " bit";
    return javaVersion;
  },

  getCurrentJavaMajorVersion: function () {
    var javaVersionString, javaMajorVersionString, javaMajorVersionMatches,
        currentJavaMajorVersion = 0;

    javaVersionString = String(java.lang.System.getProperty("java.runtime.version"));
    javaMajorVersionMatches = javaVersionString.match(/^(\d{1,2})[\.|\+]\d/);
    if (javaMajorVersionMatches && (javaMajorVersionMatches.length == 2)) {
      javaMajorVersionString = javaMajorVersionMatches[1];
      currentJavaMajorVersion = parseInt(javaMajorVersionString, 10);
    }

    return currentJavaMajorVersion;
  },

  loadScriptConfig: function (scriptConfigPath) {
    var me = this, scriptConfigFile;

    if (scriptConfigPath && Packages.org.apache.commons.lang3.StringUtils.endsWithIgnoreCase(new java.lang.String(scriptConfigPath + ""), ".json")) {
      scriptConfigFile = new File(scriptConfigPath + "");
      if (scriptConfigFile.exists()) {
        SCRIPT_CONFIG = me.loadConfig(scriptConfigFile.absolutePath);
      }
    }
  },

  loadConfig: function (configPath) {
    var configString = "{}",
        configFile;

    configFile = new java.io.File(configPath);

    if (configFile.exists()) {
      configString = Packages.org.apache.commons.io.FileUtils.readFileToString(configFile, "UTF-8") + "";
    }
    return JSON.parse(configString);
  },

  loadScript: function (scriptSubDirName, scriptName, clearScriptCache) {
    var me = this,
        content, regex, match, includeName, includePath, includeFile;

    scriptSubDirName = scriptSubDirName || BASE_CONFIG.scriptSubDirName;

    if (clearScriptCache) {
      sol = {}; // NOSONAR
      me.loadedScripts = [];
    }

    includePath = scriptSubDirName + File.separator + scriptName;
    includeFile = new java.io.File(includePath);
    if (!includeFile.exists()) {
      throw "Script file not found: sciptFile=" + includeFile.absolutePath; // NOSONAR
    }
    content = Packages.org.apache.commons.io.FileUtils.readFileToString(includeFile, "UTF-8") + "";
    regex = /(?:\/\/@include\s+)([^\s]*)/g;
    match = regex.exec(content);
    while (match) {
      includeName = match[1];
      me.loadScript(scriptSubDirName, includeName);
      match = regex.exec(content);
    }
    if (me.loadedScripts.indexOf(scriptName) < 0) {
      load(includePath);
      me.loadedScripts.push(scriptName);
    }
  },

  connectIx: function (ixUrl, username, password) {
    var me = this,
        computerName;

    log.info("Connect to IX: " + ixUrl);
    log.info("User name: " + username);
    log.info("Computer name: " + password);

    if (!ixUrl) {
      throw new Error("IX URL is missing");
    }

    me.connFactory = me.connFactory = new IXConnFactory(ixUrl, "ELO Shell Script", "1.0");

    if (ixConnect) {
      ixConnect.close();
    }

    computerName = java.net.InetAddress.getLocalHost().getHostName();

    ixConnect = me.connFactory.create(username, password, computerName, null);
    ixConnect.loginResult.clientInfo.language = "en";
  },

  downloadFiles: function (repoFolders, subDirName) {
    var me = this,
        repoPath, i;

    for (i = 0; i < repoFolders.length; i++) {
      repoPath = repoFolders[i];
      me.downloadChildren(repoPath, subDirName);
    }
  },

  downloadChildren: function (repoPath, subDirName) {
    var me = this,
        children, i, objId;
    log.info("Download scripts from ELO repository folder: " + repoPath);

    children = me.findChildren(repoPath);
    for (i = 0; i < children.length; i++) {
      objId = children[i];
      me.downloadFile(objId, subDirName);
    }
  },

  findChildren: function (repoPath) {
    var findInfo, findResult, parent;

    parent = ixConnect.ix().checkoutSord(repoPath, SordC.mbOnlyId, LockC.NO);

    findInfo = new FindInfo();
    findInfo.findChildren = new FindChildren();
    findInfo.findChildren.parentId = parent.id;
    findInfo.findChildren.endLevel = 1;
    findInfo.findChildren.mainParent = true;
    findInfo.findByType = new FindByType();
    findInfo.findByType.typeDocuments = true;

    findResult = ixConnect.ix().findFirstSords(findInfo, 1000, SordC.mbOnlyId);
    log.info("Found " + findResult.ids.length + " elements.");
    return findResult.ids;
  },

  downloadFile: function (objId, dstFolderPath) {
    var editInfo, sord, extension, url, dstFolder, filePath, file;

    editInfo = ixConnect.ix().checkoutDoc(objId, null, EditInfoC.mbSordDoc, LockC.NO);
    sord = editInfo.sord;
    log.info("Download file: " + sord.refPaths[0].pathAsString + this.pilcrow + sord.name + " -> " + dstFolderPath);
    extension = editInfo.document.docs[0].ext;
    url = editInfo.document.docs[0].url;
    dstFolder = new File(dstFolderPath);
    Packages.org.apache.commons.io.FileUtils.forceMkdir(dstFolder);
    filePath = dstFolderPath + java.io.File.separator + sord.name + "." + extension;
    file = new File(filePath);
    ixConnect.download(url, file);
  },

  copyCheckoutFiles: function () {
    var me = this,
        scriptNames = [],
        scriptDir, checkoutDirPath, i, scriptName, scriptPath, scriptFiles, scriptFile;
    scriptDir = new File(BASE_CONFIG.scriptSubDirName);
    checkoutDirPath = me.getCheckoutDirPath();
    log.info("Script directory path: " + scriptDir.canonicalPath);
    if (!scriptDir.exists()) {
      return;
    }
    scriptFiles = Packages.org.apache.commons.io.FileUtils.listFiles(scriptDir, ["js"], false).toArray();
    for (i = 0; i < scriptFiles.length; i++) {
      scriptNames.push(scriptFiles[i].name);
    }
    for (i = 0; i < scriptNames.length; i++) {
      scriptName = scriptNames[i];
      scriptPath = checkoutDirPath + File.separator + scriptName;
      scriptFile = new File(scriptPath);
      if (scriptFile.exists()) {
        log.info("Copy checkout file: " + scriptFile.canonicalPath + " -> " + scriptDir.canonicalPath);
        Packages.org.apache.commons.io.FileUtils.copyFileToDirectory(scriptFile, scriptDir, true);
      }
    }
  },

  getCheckoutDirPath: function () {
    var me = this,
        checkoutDirPath, repoName, userId;
    repoName = me.getRepoName();
    userId = SCRIPT_CONFIG.scriptEditorUserId || BASE_CONFIG.scriptEditorUserId || ixConnect.loginResult.user.id;
    checkoutDirPath = $ENV.APPDATA + File.separator + "ELO Digital Office" + File.separator + repoName + File.separator + userId + File.separator + "checkout";
    return checkoutDirPath;
  },

  getRepoName: function () {
    var rootSord, repoName;
    rootSord = ixConnect.ix().checkoutSord("1", SordC.mbLean, LockC.NO);
    repoName = rootSord.name;
    return repoName;
  },

  replaceAll: function (content, search, replacement) {
    return content.split(search).join(replacement);
  }
};

function readARGS() {
  var i;
  for (i = 0; i <= 13; i++) {
    $ARGS.push((java.lang.System.getProperty("scriptArg" + i) || "") + "");
  }
}

$SCRIPT_NAME = java.lang.System.getProperty("script") + "";
$SCRIPT_CONFIG_PATH = java.lang.System.getProperty("scriptConfig") + "";
readARGS();

EloShellScriptRunner.execute($SCRIPT_NAME, $SCRIPT_CONFIG_PATH);
log.info("Script finished");

if (jsEngine == "GraalJS") {
  exit();
}
