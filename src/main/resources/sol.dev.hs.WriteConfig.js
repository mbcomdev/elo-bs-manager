
var EloConfig;

var EloConfig;
EloConfig = {

    execute: function (operation, config, instance, user, password) {
        var me = this;

        if (operation == "read") {
            var config = me.read(config);
            log.info(config);
        }
        if (operation == "write") {
            var config = me.write(config, instance, user, password);
            log.info(config);
        }

    },

    read: function (configPath) {
        var me = this,
            configStr,
            config;

        configStr = me.readFileToString(configPath);
        config = JSON.parse(configString);

        return config;
    },

    write: function (configPath, instance, user, password) {
        var me = this,
            configStr,
            config;

        var config = me.read(configPath) || {};
        if (instance) {
            if (instance.indexOf("http") !== 0) {
                instance = "http://" + instance + ".dev.elo/ix-Solutions/ix";
            }
            if (user) {
                config.username = user;
            }
            if (password) {
                config.password = password;
            }
            config.ixUrl = instanace;
        }

        configStr = JSON.stringify(config, null, 2);
        me.writeStringToFile(configStr);

        return config;
    },

    /**
     * Reads a file into a string
     * @param {java.io.File} file
     * @return {String}
     */
    readFileToString: function (file, encoding) {
        var _result;

        _result = String(Packages.org.apache.commons.io.FileUtils.readFileToString(file, encoding ? encoding : "UTF-8"));
        return _result;
    },

    /**
     * Writes a string into a file
     * @param {java.io.File} file
     * @param {String} content Text content
     */
    writeStringToFile: function (file, content, encoding) {
        content = content || "";
        Packages.org.apache.commons.io.FileUtils.writeStringToFile(file, content, encoding ? encoding : "UTF-8");
    },

}



EloConfigWriter.execute($ARG[2], $ARG[3], $ARG[4], $ARG[5], $ARG[6]);