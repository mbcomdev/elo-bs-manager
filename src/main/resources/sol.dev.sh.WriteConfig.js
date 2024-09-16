
/* global EloInstallPackage, BASE_CONFIG, SCRIPT_CONFIG */

var EloConfig;

EloConfig = {

  execute: function (operation, config, instance, user, password, domain, credentials, debuggingPort, sshPort, flowsSshPort, flowsDebuggingPort, javaDebuggingPort, jmxDebuggingPort, workspace) { // NOSONAR
    var me = this,
        _config;

    log.info("WriteConfig: operation={}, config={}, instance={}, user={}, password={}, domain={}, credentials={}, debuggingPort={}, sshPort={}, flowsSshPort={}, flowsDebuggingPort={}, javaDebuggingPort={}, jmxDebuggingPort={}, workspace={}",
      operation, config, instance, user, password, domain, credentials, debuggingPort, sshPort, flowsSshPort, flowsDebuggingPort, javaDebuggingPort, jmxDebuggingPort, workspace);

    if (operation == "read") {
      _config = me.read(new java.io.File(config + ""));
      log.info("read: config=" + JSON.stringify(_config) + "");
    }
    if (operation == "write") {
      _config = me.write(new java.io.File(config + ""), instance, user, password, domain, credentials, debuggingPort, sshPort, flowsSshPort, flowsDebuggingPort, javaDebuggingPort, jmxDebuggingPort, workspace);
      log.info("write: config=" + JSON.stringify(_config) + "");
    }
  },

  read: function (configPath) {
    var me = this,
        configStr,
        config;

    try {
      configStr = me.readFileToString(configPath);
      config = JSON.parse(configStr);

      return config;
    } catch (e) {
      return null;
    }
  },

  write: function (configPath, instance, user, password, domain, credentials, debuggingPort, sshPort, flowsSshPort, flowsDebuggingPort, javaDebuggingPort, jmxDebuggingPort, workspace) { // NOSONAR
    var me = this,
        configStr,
        ixUrl,
        config;

    if (!domain) {
      domain = "dev.elo";
    }

    config = me.read(configPath) || {};

    if (instance) {
      ixUrl = instance;
      if (instance.indexOf("http") !== 0) {
        if (credentials) {
          ixUrl = "http://" + credentials + "@" + instance + "." + domain + "/ix-Solutions/ix";
        } else {
          ixUrl = "http://" + instance + "." + domain + "/ix-Solutions/ix";
        }
      }
      if (user) {
        config.username = user;
      }

      if (password) {
        config.password = password;
      }

      if (debuggingPort) {
        config.debuggingPort = debuggingPort;
      }

      if (sshPort) {
        config.sshPort = sshPort;
      }

      if (flowsSshPort) {
        config.flowsSshPort = flowsSshPort;
      }

      if (flowsDebuggingPort) {
        config.flowsDebuggingPort = flowsDebuggingPort;
      }

      if (javaDebuggingPort) {
        config.javaDebuggingPort = javaDebuggingPort;
      }

      if (jmxDebuggingPort) {
        config.jmxDebuggingPort = jmxDebuggingPort;
      }

      if (workspace) {
        config.workspace = workspace;
      }

      config.ixUrl = ixUrl;
      config.stack = instance;
    }

    configStr = JSON.stringify(config);
    me.writeStringToFile(configPath, configStr);

    return config;
  },

  /**
   * Reads a file into a string
   * @param {java.io.File} file
   * @param {String} encoding
   * @return {String}
   */
  readFileToString: function (file) {
    var _result;

    _result = String(Packages.org.apache.commons.io.FileUtils.readFileToString(file, java.nio.charset.StandardCharsets.UTF_8));
    return _result;
  },

  /**
   * Writes a string into a file
   * @param {java.io.File} file
   * @param {String} content Text content
   * @param {String} encoding
   */
  writeStringToFile: function (file, content) {
    content = content || "";
    Packages.org.apache.commons.io.FileUtils.writeStringToFile(file, content, java.nio.charset.StandardCharsets.UTF_8);
  }
};

EloConfig.execute($ARGS[0] + "", $ARGS[1] + "", $ARGS[2] + "", $ARGS[3] + "", $ARGS[4] + "", $ARGS[5] + "", $ARGS[6] + "", $ARGS[7] + "", $ARGS[8] + "", $ARGS[9] + "", $ARGS[10] + "", $ARGS[11] + "", $ARGS[12] + "");