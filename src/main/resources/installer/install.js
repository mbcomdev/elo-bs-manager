
/* global installConfig buildConfig CURR_INST_FUNC */

//@config installConfig install.json
//@config buildConfig build.json

//@include lib_Class.js

Symbol = undefined;

//@include lib_moment.js
//@include lib_handlebars.js
//@include lib_sol.common.Cache.js
//@include lib_sol.common.Config.js
//@include lib_sol.common.Template.js
//@include lib_sol.common.IxUtils.js
//@include lib_sol.common.ObjectUtils.js
//@include lib_sol.common.JsonUtils.js
//@include lib_sol.common.StringUtils.js
//@include lib_sol.common.DateUtils.js
//@include lib_sol.common.AsyncUtils.js
//@include lib_sol.common.FileUtils.js
//@include lib_sol.common.ZipUtils.js
//@include lib_sol.common.ExecUtils.js
//@include lib_sol.common.SordUtils.js
//@include lib_sol.common.RepoUtils.js
//@include lib_sol.common.AclUtils.js
//@include lib_sol.common.WfUtils.js
//@include lib_sol.common.AsUtils.js
//@include lib_sol.common.HttpUtils.js
//@include lib_sol.common.UserUtils.js
//@include lib_sol.common.SordTypeUtils.js
//@include lib_sol.common.ExceptionUtils.js
//@include lib_sol.common.UserProfile.js
//@include lib_sol.dev.DateShiftUtils.js
//@include lib_sol.dev.install.Installer.js

var installConfig, buildConfig;

function onAsUrlCheckButtonClicked() {
  CURR_INST_FUNC.checkAsBaseUrl();
}

sol.dev.install.Installer.execute("install", installConfig, undefined, buildConfig);
