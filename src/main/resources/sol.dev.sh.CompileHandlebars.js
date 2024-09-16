var EloCompile = {

  execute: function (file, json) {
    var me = this,
        content, tpl;

    EloShellScriptRunner.loadScript(undefined, "lib_handlebars.js", true);
    EloShellScriptRunner.loadScript(undefined, "lib_sol.common.Template", true);

    content = me.readFileToString(file);
    tpl = sol.create("sol.common.Template", {
      source: content
    });

    content = tpl.apply(JSON.parse(json));

    me.writeStringToFile(file, content);
  },

  /**
   * Reads a file into a string
   * @param {java.io.File} file
   * @param {Object} encoding
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
   * @param {Object} encoding
   */
  writeStringToFile: function (file, content, encoding) {
    content = content || "";
    Packages.org.apache.commons.io.FileUtils.writeStringToFile(file, content, encoding ? encoding : "UTF-8");
  }
}



EloCompile.execute($ARG[2], $ARG[3]);