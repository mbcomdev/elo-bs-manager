
importPackage(java.io);

//@include lib_Class.js

/**
 * Execution utils
 *
 * @eloas
 * @eloix
 * @elojc
 */
sol.define("sol.common.ExecUtils", {

  singleton: true,

  /**
   * Starts a process
   * @param {Array} args Arguments
   * @param {Object} config Config
   * @param {String} config.dir Directory
   * @param {Boolean} config.wait Wait
   * @return {Object} Result
   */
  startProcess: function (args, config) {
    var process,
        outputArr = [],
        processBuilder, scanner, returnCode;

    config = config || {};

    processBuilder = new java.lang.ProcessBuilder(java.util.Arrays.asList(args));
    processBuilder.redirectErrorStream(true);

    if (config.dir) {
      processBuilder.directory(new File(config.dir));
    }

    process = processBuilder.start();
    if (config.wait == false) {
      return;
    }
    scanner = new java.util.Scanner(process.inputStream).useDelimiter("\\Z");
    while (scanner.hasNextLine()) {
      outputArr.push(scanner.nextLine());
    }
    scanner.close();
    returnCode = process.waitFor();
    return {
      returnCode: returnCode,
      output: outputArr.join("\r\n")
    };
  },

  /**
   * Opens a file by "ShellExecute"
   * @param {String} path
   */
  open: function (path) {
    if (!path) {
      return;
    }
    var file = new File(path);
    if (!file.exists()) {
      return;
    }
    Packages.java.awt.Desktop.getDesktop().open(file);
  },

  /**
   * Returns the user profile directory
   * @return {String} Path of the user profile directory
   */
  getUserProfileDir: function () {
    return String(java.lang.System.getenv("UserProfile"));
  },

  /**
   * Returns the program files directory
   * @return {String} Path of the program files directory
   */
  getProgramFilesDir: function () {
    return String(java.lang.System.getenv("ProgramFiles"));
  },

  /**
   * Returns the Program files directory
   * @return {String} Path of the Program files directory
   */
  getProgramFilesX86Dir: function () {
    return String(java.lang.System.getenv("ProgramFiles(x86)"));
  },

  /**
   * Runs a batch file in a command window
   * @param {Array} args Arguments. The first element must be the batch file name
   * @param {Object} params Parameters
   * @param {String} params.dir Directory
   */
  runBatchFileInWindow: function (args, params) {
    var dir = null,
        cmdString, argsString;

    params = params || {};
    if (!args || (args.length == 0)) {
      throw "The batch file name is empty";
    }
    if (params.dir) {
      dir = new File(params.file);
    }

    cmdString = 'cmd.exe /c start cmd.exe /k \"{0}\"';

    args = args.map(function (arg) {
      return '"' + arg + '"';
    });
    argsString = args.join(" ");
    cmdString = cmdString.replace("{0}", argsString);

    java.lang.Runtime.runtime.exec(cmdString, null, dir);
  },

  /**
   * Detects if the script runs inside Tomcat
   * @return {Boolean}
   */
  insideTomcat: function () {
    try {
      java.lang.Class.forName("org.apache.catalina.util.ServerInfo");
      return true;
    } catch (ignore) {
      // ignore
    }
    return false;
  },

  /**
   * Logs system info
   * @param {de.elo.ix.client.IXConnection} conn IXConnection
   */
  logSystemInfo: function (conn) {
    var me = this,
        connTimeZone, connTimeZoneOffset;

    if (!me.logger.debugEnabled) {
      return;
    }

    conn = conn || ixConnect;

    me.logger.debug(["java.version={0}", me.getJavaVersion()]);
    me.logger.debug(["java.timezone={0}, java.timeZoneOffset={1}", me.getJavaTimeZoneString(), me.getJavaTimeZoneOffsetString()]);


    me.logger.debug(["conn.userName={0}, conn.userName={1}", conn.loginResult.user.id + "", conn.loginResult.user.name + ""]);

    connTimeZone = conn.loginResult.clientInfo.timeZone;
    connTimeZoneOffset = me.getTimeZoneOffsetString(connTimeZone);

    me.logger.debug(["conn.timeZone={0}, conn.timeZoneOffset={1}", connTimeZone + "", connTimeZoneOffset + ""]);
  },

  /**
   * Returns the Java version
   * @return {String} Java version
   */
  getJavaVersion: function () {
    var javaRuntimeName, javaRuntimeVersion, bitness, javaVersion;

    javaRuntimeName = String(java.lang.System.getProperty("java.runtime.name"));
    javaRuntimeVersion = String(java.lang.System.getProperty("java.runtime.version"));
    bitness = String(java.lang.System.getProperty("sun.arch.data.model"));
    javaVersion = javaRuntimeName + " " + javaRuntimeVersion + " - " + bitness + " bit";
    return javaVersion;
  },

  /**
   * Returns the Java main version number
   * @return {Integer} Java main version number
   */
  getJavaMainVersionNumber: function () {
    var versionString, mainVersionString, dotPos, mainVersionNumber;
    versionString = java.lang.System.getProperty("java.version") + "";
    if (versionString.indexOf("1.") == 0) {
      mainVersionString = versionString.substring(2, 3);
    } else {
      dotPos = versionString.indexOf(".");
      if (dotPos > -1) {
        mainVersionString = versionString.substring(0, dotPos);
      }
    }

    mainVersionNumber = parseInt(mainVersionString, 10);

    return mainVersionNumber;
  },

  /**
   * Returns the Java time zone string
   * @return {String} Java time zone string
   */
  getJavaTimeZoneString: function () {
    var timeZone;

    timeZone = java.time.ZoneId.systemDefault().toString();

    return timeZone;
  },

  /**
   * Returns the Java time zone offset string
   * @return {String} Java time zone offset string
   */
  getJavaTimeZoneOffsetString: function () {
    var zoneId, offsetString;

    zoneId = java.time.ZoneId.systemDefault();
    offsetString = zoneId.rules.getOffset(java.time.Instant.now()).toString();

    return offsetString;
  },

  /**
   * Returns the time zone offset string from a given time zone string
   * @param {String} timeZoneString Time zone string
   * @return {String} Time zone offset string
   */
  getTimeZoneOffsetString: function (timeZoneString) {
    var zoneId, offsetString;

    zoneId = java.time.ZoneId.of(timeZoneString);
    offsetString = zoneId.rules.getOffset(java.time.Instant.now()).toString();

    return offsetString;
  },

  /**
   * Writes the JAR file path of a class into the log file
   */
  logJarFilePath: function (className) {
    var me = this,
        classExists = true,
        jarFilePath = "",
        clazz;

    if (!me.logger.debugEnabled || !className) {
      return;
    }

    try {
      clazz = java.lang.Class.forName(className);
    } catch (ex) {
      classExists = false;
    }

    if (classExists) {
      jarFilePath = clazz.protectionDomain.codeSource.location.path;
    }

    me.logger.debug("className=" + className + ", classExists=" + classExists + ", jarFilePath=" + jarFilePath);
  },

  /**
   * Detects if a class exists
   */
  classExists: function (className) {

    try {
      java.lang.Class.forName(className);
      return true;
    } catch (ex) {
      // ignore
    }
    return false;
  }
});
